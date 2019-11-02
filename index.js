require('dotenv').config();
const Discord = require('discord.js');
const fs = require('fs');
const statusConfig = require('./status.json');
const msg = require('./msg.json');

const client = new Discord.Client({disableEveryone: true});
const MINIMAL_MEMBER = parseInt(process.env["MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED"]);
const GUILD_NAME = process.env["MAIN_GUILD_NAME"];
const GUILD_ID = process.env["MAIN_GUILD"];
const PARTNER_CATEGORY = process.env["PARTNER_CATEGORY"];
const CLIENT_INVOKE = process.env["CLIENT_INVOKE"];
const PARTNER_MESSAGE = fs.readFileSync('partnerMessage.md', 'utf-8');
const DEBUG = false;

const JsonVars = {
    MINIMAL_MEMBER,
    GUILD_NAME,
    GUILD_ID,
    PARTNER_CATEGORY,
    PARTNER_MESSAGE,
    CLIENT_INVOKE,
    GUILD_NAME_LOWER_CASE: GUILD_NAME.toLowerCase()
};

function addDebugMessage(...args) {
    if(DEBUG) 
        console.log(...args);
    fs.appendFileSync("basic.log", args.join(" ") + "\n");
};

function replaceStringVar(string) {
    return string.replace(/%([\w_]+)%/g, function(match, g1) {
        return JsonVars[g1];
    });
}

function getConsoleMessage(str) {
    return replaceStringVar(msg["ConsoleMessage"][str]);
}

function getUserMessage(str) {
    return replaceStringVar(msg["UserMessage"][str]);
}

/**
 * @type {Discord.Guild}
 */
let MAIN_GUILD = null;
let partnerInformation = {};

client.on('ready', async function() {
    console.log(getConsoleMessage("BOT_LOGGED"));
    if(!(MAIN_GUILD = client.guilds.get(GUILD_ID)) || !MAIN_GUILD.available) {
        console.log(getConsoleMessage("BOT_UNDEFINED_MAIN_SERVER"));
        process.exit(0);
    }
    registerCommands();
    client.user.setStatus('invisible');

    if(fs.existsSync('partners.json')) {
        partnerInformation = JSON.parse(fs.readFileSync('partners.json', 'utf-8'));
    }

    await checkPartnerServersValid();
    console.log(getConsoleMessage("BOT_SERVERS_CHECK_STARTUP_COMPLETE"));
});

client.login(process.env["CLIENT_SECRET"]);

const commandMap = {};

function registerCommand(command, func, help="") {
    if(!commandMap[command]) {
        commandMap[command] = {};
        commandMap[command]["callee"] = func;
        commandMap[command]["help"] = help;
    } else return false;
}

function registerCommands() {
    registerCommand("partnership", commandFunction.partnership, getUserMessage("PARTNERSHIP_HELP"));
    registerCommand("eval", commandFunction.eval, getUserMessage("EVAL_HELP"));
    registerCommand("help", commandFunction.help, getUserMessage("HELP_HELP"));
    registerCommand("log", commandFunction.log, getUserMessage("LOG_HELP"));
}

function sendEmbed(channel, backupchannel, title, description, color) {
    const embed = new Discord.RichEmbed();
    embed.setTitle(title)
    .setDescription(description)
    .setColor(color);
    channel.send(embed).catch(() => (backupchannel ? backupchannel.send(getUserMessage("ENABLE_DIRECT_MESSAGES")) : null));
}

function sendNotifyMessage(channel, backupchannel, description) {
    sendEmbed(channel, backupchannel, "Note", description, 0xffe675);
}

client.on('messageDelete', async function(message) {
    if(isPartner(message.guild)) {
        if(partnerInformation[message.guild.id]["channel"]["id"] === message.channel.id) {
            if(partnerInformation[message.guild.id]["partnerMessage"]["id"] === message.id) {
                sendNotifyMessage(message.guild.owner.user, null, getUserMessage("MESSAGE_UPDATED"));
                const partnerMessage = await message.channel.send(PARTNER_MESSAGE).catch();
                partnerInformation[message.guild.id]["partnerMessage"]["id"] = partnerMessage.id;
                partnerInformation[message.guild.id]["partnerMessage"]["lastUpdate"] = new Date();
                fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
            }
        }
    }
    if(!isPartner(message.guild)) {
        let flags = await checkChannel(message.channel);
        addDebugMessage("[MESSAGE_DELETION] Flags: " + flags);
        if(flags > ChannelExpression.CHANNELNAME) {
            addDebugMessage("[MESSAGE_DELETION] More steps than setting the name to channel");
            addDebugMessage("[CHAT_EXPRESSION]" + getChatExpressionStatus(flags));
            sendNotifyMessage(message.guild.owner.user, message.channel, null, getChatExpressionStatus(flags));
            if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                await sendPartnerMessage(message.channel);
                flags = await checkChannel(message.channel);
            }
        }
        if(!flags) {
            addDebugMessage("[MESSAGE_DELETION] Foreign messages out of partner channel. Ready to partner");
            if(!isPartner(message.guild)) {
                sendNotifyMessage(message.guild.owner.user, message.channel, null, getChatExpressionStatus(flags));
                createPartner(message.channel);
            }
        }
    }
});

client.on('message', async function(message) {
    if(isPartner(message.guild)) {
        if(partnerInformation[message.guild.id]["channelId"] === message.channel.id && message.member.user.id !== client.user.id) {
            sendEmbed(message.guild.owner, message.channel, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
            removePartner(message.guild);
        }
    }
    const prefix = process.env["CLIENT_INVOKE"];
    if(message.content.startsWith(prefix) && !message.member.user.bot && message.member.user.id !== client.user.id) {
        const args = message.content.substr(prefix.length).split(" ");
        const invoke = args.shift().toLowerCase();
        
        addDebugMessage("[COMMAND_HANDLER] Got a command: " + message.content);
        if(commandMap[invoke]) {
            try {
                const result = await commandMap[invoke]["callee"](message, invoke, args);
                if(typeof result === 'boolean') {
                    addDebugMessage("[COMMAND_HANDLER] Command '" + invoke + "' did not execute correctly.");
                }
            } catch(err) {
                message.channel.send(getUserMessage("ERROR_OCCURED")).catch(() => console.log(getConsoleMessage("MESSAGE_NOT_SENT"))).catch();
                console.error(err);
            }
        } else {
            message.channel.send(getUserMessage("COMMAND_NOT_FOUND")).catch(() => console.log(getConsoleMessage("MESSAGE_NOT_SENT"))).catch();
        }
    }
});

function createPartnerInformation(channel, partnered, mainServerChannel, partnerMessage) {
    return {
        channel: {
            id: channel.id,
            name: channel.name
        },
        guild: {
            id: channel.guild.id,
            name: channel.guild.name
        },
        mainServerChannel: {
            id: mainServerChannel.id,
            name: mainServerChannel.name
        },
        partnerMessage: {
            id: partnerMessage.id,
            lastUpdate: new Date()
        },
        partnershipRecorded: new Date(),
        channelId: channel.id,
        partner: partnered,
        channelName: channel.name,
        name: channel.guild.name,
        saveVersion: 'v0.0.1'
    };
}

client.on('guildCreate', async function(guild) {
    if(guild.id !== process.env["MAIN_GUILD"]) {
        addDebugMessage("[GUILD_CREATE] Not main server");
        if(guild.memberCount >= MINIMAL_MEMBER) {
            addDebugMessage("[GUILD_CREATE] Enough members (" + MINIMAL_MEMBER + ")");
            const information = await checkGuild(guild);
            if(information.isPartner) {
                addDebugMessage("[GUILD_CREATE] Server is already a partner");
                createPartner(information.channel);
                sendEmbed(guild.owner, null, getUserMessage("PARTNER_CHANNEL_SUCCESS_TITLE"), getUserMessage("PARTNER_CHANNEL_SUCCESS_DESCRIPTION"), 0xa4da6a);
            }
            else {
                addDebugMessage("[GUILD_CREATE] Setting up");
                if(information.potentialChannel) {
                    addDebugMessage("[GUILD_CREATE_CHECK] Found potential channel: " + information.potentialChannel.name);
                    sendEmbed(guild.owner, null, getUserMessage("POTENTIAL_CHANNEL_FOUND_TITLE"), getUserMessage("POTENTIAL_CHANNEL_FOUND_DESCRIPTION"), 0xa4da6a);
                    sendNotifyMessage(guild.owner, null, getChatExpressionStatus(information.flags));
                } else {
                    sendEmbed(guild.owner, null, getUserMessage("INVITE_THANKS_TITLE"), getUserMessage("INVITE_THANKS_DESCRIPTION"), 0xa4da6a);
                    sendNotifyMessage(guild.owner.user, null, getUserMessage("CREATE_CHANNEL"));
                }
            }
        } else {
            addDebugMessage("[GUILD_CREATE] Not enough members, leaving server");
            sendEmbed(guild.owner.user, null, getUserMessage("NOT_PUBLIC_SERVER_TITLE"), getUserMessage("NOT_PUBLIC_SERVER_DESCRIPTION"), 0xda746a);
            guild.leave().then(function() {
                console.log(getConsoleMessage("SERVER_LEFT_MEMBER_MISSING"));
            });
        }
    }
    else {
        sendNotifyMessage(guild.owner.user, null, getUserMessage("MAIN_SERVER_JOIN_ERROR"));
    }
});

const ChannelExpression = {
    NONE: 0,
    CHANNELNAME: 1,
    CHANNELPERMISSION_EVERYONE: 1 << 1,
    CHANNELPERMISSION_BOT: 1 << 2,
    CHANNEL_MESSAGE: 1 << 3,
    CHANNEL: 1 << 4,
    CHANNEL_FOREIGN_MESSAGE: 1 << 5
};

/**
 * @param {Discord.TextChannel} channel 
 * @returns {boolean}
 */
async function checkChannel(channel) {
    addDebugMessage("[CHANNEL_CHECK] Checking channel " + channel.name);
    let rt = 0;
    if(channel.name.indexOf(GUILD_NAME.toLowerCase()) !== -1) {
        const permissions = channel.permissionsFor(channel.guild.id);
        const botPermissions = channel.permissionsFor(client.user);
        if(permissions && permissions.has('READ_MESSAGES') && permissions.has('READ_MESSAGE_HISTORY') && !permissions.has('SEND_MESSAGES')) {
            if(botPermissions && botPermissions.has('SEND_MESSAGES') && botPermissions.has('READ_MESSAGES')) {
                const messages = await channel.fetchMessages();
                const lastMessage = messages.first();
                if(lastMessage && lastMessage.member.user.id !== client.user.id)
                    rt |= ChannelExpression.CHANNEL_FOREIGN_MESSAGE;
                if(!lastMessage)
                    rt |= ChannelExpression.CHANNEL_MESSAGE;
            } else rt |= ChannelExpression.CHANNELPERMISSION_BOT;
        } else rt |= ChannelExpression.CHANNELPERMISSION_EVERYONE;
    } else rt |= ChannelExpression.CHANNELNAME;
    return rt;
}

function getChatExpressionStatus(expression) {
    let message = "";
    if(expression === ChannelExpression.NONE) {
        message = statusConfig["ChatExpression"]["NONE"];
    } else
    for(const status in ChannelExpression) {
        if(ChannelExpression[status] !== undefined) {
            const statusValue = ChannelExpression[status];
            if(expression & statusValue) {
                message = replaceStringVar(statusConfig["ChatExpression"][status]);
            }
        } else return false;
    }
    return message;
}

client.on('channelCreate', async function(channel) {
    if(channel.type === 'text') {
        const flags = await checkChannel(channel);
        if(flags === ChannelExpression.NONE) return;
        if(!(flags & ChannelExpression.CHANNELNAME)) {
            const status = getChatExpressionStatus(flags);
            if(status) {
                sendNotifyMessage(channel.guild.owner, channel, status);
            }
        }
    }
});

client.on('channelUpdate', async function(channelOld, channelNew) {
    if(channelNew.type === 'text') {
        if(isPartner(channelNew.guild)) {
            addDebugMessage("[CHANNEL_UPDATE] This channel is on a partner guild");
            if(partnerInformation[channelNew.guild.id]["channelId"] === channelNew.id) {
                addDebugMessage("[CHANNEL_UPDATE] Channel is already registered as partner channel");
                const flags = await checkChannel(channelNew);
                if(flags) {
                    const embed = new Discord.RichEmbed();
                    addDebugMessage("[CHANNEL_UPDATE] Channel is now invalid, removing partner");
                    removePartner(channelOld.guild);
                    sendEmbed(channelNew.guild.owner, channelOld, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
                }
            }
        }
        else {
            let flags = await checkChannel(channelNew);
            addDebugMessage("[CHANNEL_UPDATE] Flags: " + flags);
            if(flags > ChannelExpression.CHANNELNAME) {
                addDebugMessage("[CHANNEL_UPDATE] More steps than setting the name to channel");
                addDebugMessage("[CHAT_EXPRESSION] " + getChatExpressionStatus(flags));
                sendNotifyMessage(channelOld.guild.owner.user, null, getChatExpressionStatus(flags));
                if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                    await sendPartnerMessage(channelOld);
                    flags = await checkChannel(channelNew);
                }
            }
            if(!flags) {
                addDebugMessage("[CHANNEL_UPDATE] Channel complete. Ready for partner");
                if(!isPartner(channelNew.guild)) {
                    sendNotifyMessage(channelOld.guild.owner.user, null, getChatExpressionStatus(flags));
                    createPartner(channelNew);
                }
            }
        }
    }
});

async function sendPartnerMessage(channel) {
    await channel.send(PARTNER_MESSAGE).catch();
}

client.on('channelDelete', function(channel) {
    if(channel.type === 'text') {
        addDebugMessage("[CHANNEL_DELETE]!");
        if(isPartner(channel.guild)) {
            addDebugMessage("[CHANNEL_DELETE] Text channel was removed from partner server");
            if(partnerInformation[channel.guild.id]["channelId"] === channel.id) {
                addDebugMessage("[CHANNEL_DELETE] This was the partner channel");
                removePartner(channel.guild);
                sendEmbed(channel.guild.owner, null, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
            }
        }
    }
});

client.on('guildDelete', function(guild) {
    addDebugMessage("[GUILD_DELETE]!");
    if(isPartner(guild)) {
        addDebugMessage("[GUILD_DELETE] This was a partner guild, removing partner from list");
        removePartner(guild);
        const user = client.users.get(guild.owner.id);
        if(user) {
            sendEmbed(user, null, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_GUILD_LEFT_DESCRIPTION"), 0xda746a);
        }
    }
});

function isPartner(guild) {
    return guild && guild.id !== MAIN_GUILD.id && partnerInformation[guild.id] !== undefined && partnerInformation[guild.id]["partner"];
}

/**
 * @param {Discord.TextChannel} channel 
 */
async function createPartner(channel) {
    addDebugMessage("[PARTNER_MANAGER] Creating partner and objects");
    const guild = channel.guild;
    const category = MAIN_GUILD.channels.find(c => c.name === PARTNER_CATEGORY && c.type === 'category');
    const mGuildChannel = await MAIN_GUILD.createChannel("｜" + guild.name, {
        type: 'text',
        parent: category
    });
    partnerInformation[guild.id] = createPartnerInformation(channel, true, mGuildChannel, channel.messages.last());
    fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
    mGuildChannel.overwritePermissions(guild.owner.id, {
        SEND_MESSAGES: true,
        MANAGE_MESSAGES: true,
        MANAGE_CHANNELS: true,
        MENTION_EVERYONE: false
    });
    mGuildChannel.overwritePermissions(MAIN_GUILD.id, {
        READ_MESSAGES: true,
        READ_MESSAGE_HISTORY: true,
        SEND_MESSAGES: false,
        ADD_REACTIONS: true
    });
}

function removePartner(guild) {
    if(isPartner(guild)) {
        removePartnerById(guild.id);
    }
}

function removePartnerById(guildId) {
    addDebugMessage("[PARTNER_MANAGER] Removing partner and objects");
    partnerInformation[guildId]["partner"] = false;
    const partnerChannel = MAIN_GUILD.channels.get(partnerInformation[guildId]["mainServerChannel"]["id"]);
    partnerChannel.delete().then(function() {
        addDebugMessage("[PARTNER_MANAGER] Partner channel removed");
    });
    fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
}

/**
 * @param {Discord.Guild} guild 
 * @returns {{isPartner:boolean,channel:Discord.Channel,potentialChannel:undefined|Discord.Channel,flags:number|undefined}}
 */
function checkGuild(guild) {
    return new Promise(async resolve => {
        let count = 0;
        const guildChannels = guild.channels.filter(c => c.type === 'text');
        let potentialChannel = null;
        let lastFlags = ChannelExpression.CHANNELNAME;
        guildChannels.forEach(function(channel) {
            checkChannel(channel).then(function(flags) {
                if(flags > lastFlags) {
                    potentialChannel = channel;
                    lastFlags = flags;
                }
                count++;
                if(!flags) {
                    addDebugMessage("[GUILD_CHECK] Server is ok");
                    return resolve({isPartner: true, channel});
                }
                if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                    sendPartnerMessage(channel);
                    addDebugMessage("[GUILD_CHECK] Message missing but the rest is ok (now sending message)");
                    return resolve({isPartner: true, channel});
                }
                if(count === guildChannels.size) {
                    return resolve({isPartner: false, channel: null, potentialChannel: potentialChannel, flags: lastFlags});
                }
            });
        });
    });
}

async function checkPartnerServersValid() {
    for(const pGuildId in partnerInformation) {
        addDebugMessage("[PARTNER_CHECK] Checking potential partner " + pGuildId);
        const guildPartnerInformation = partnerInformation[pGuildId];
        if(guildPartnerInformation["partner"]) {
            const guild = client.guilds.get(pGuildId);
            if(guild) {
                const information = await checkGuild(guild);
                if(!information.isPartner) {
                    removePartner(guild);
                    sendEmbed(guild.owner.user, null, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
                    addDebugMessage("[PARTNER_CHECK] Partner " + pGuildId + "not valid. Partnership removed");
                }
                else {
                    information.channel.messages.get(guildPartnerInformation["partnerMessage"]["id"]).edit(PARTNER_MESSAGE);
                    addDebugMessage("[PARTNER_CHECK] Updating partner message on server " + pGuildId);
                    if(information.channel.id !== guildPartnerInformation["channel"]["id"]) {
                        addDebugMessage("[PARTNER_CHECK] Channel has changed. Updating partners.json");
                        partnerInformation["channel"]["id"] = information.channel.id;
                        partnerInformation["channel"]["name"] = information.channel.name;
                        fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
                    }
                }
            }
            else {
                removePartnerById(pGuildId);
                addDebugMessage("[PARTNER_CHECK] Partner " + pGuildId + " removed");
            }
        }
    }
}

function createLogEmbed(channel, log, site, siteMax, fileSize) {
    const embed = new Discord.RichEmbed();
    embed.setTitle("Log")
    .setColor(0xda746a)
    .setDescription(log)
    .setFooter(site + " / " + siteMax + "    " + fileSize);
    channel.send(embed);
}

const commandFunction = {
    partnership: function(message, invoke, args) {
        try {
            const embed = new Discord.RichEmbed();
            embed.setColor(0xa4da6a)
            .setTitle("Please invite me to your server")
            .setDescription(process.env["CLIENT_INVITE"])
            .setFooter("For our safety");
            message.member.user.send(embed).catch(() => message.channel.send("Please enable direct messages on this server"));
        } catch(err) {
            message.channel.send("Please enable direct messages for this server").catch();
        }
    },
    eval: function(message, invoke, args) {
        const permissions = MAIN_GUILD.members.get(message.member.user.id).permissions;
        addDebugMessage("[EVAL_COMMAND] Checking permissions");
        if(permissions.has('ADMINISTRATOR')) {
            addDebugMessage("[EVAL_COMMAND] Permission granted for " + message.member.user.name + " (" + message.member.user.id + ")");
            try {
                const evalString = new String(message.content.substr(invoke.length + 1 + CLIENT_INVOKE.length));
                addDebugMessage("[EVAL_COMMAND] Executing " + evalString.toString());
                const result = eval(evalString.toString());
                if(typeof(result) === 'undefined') {
                    sendEmbed(message.channel, null, "Bang", getUserMessage("EVAL_EXECUTED_UNDEFINED_DESCRIPTION"), 0xa4da6a);
                }
                else {
                    sendEmbed(message.channel, null, "Bang", result, 0xa4da6a);
                }
                addDebugMessage("[EVAL_COMMAND] Eval completed");
            } catch(err) {
                addDebugMessage("[EVAL_COMMAND] Eval failed");
                sendEmbed(message.channel, null, getUserMessage("EVAL_ERROR_TITLE"), getUserMessage("EVAL_ERROR_DESCRIPTION"), 0xda746a);
            }
        } else {
            addDebugMessage("[EVAL_COMMAND] Permission denied for " + message.member.user.name + " (" + message.member.user.id + ")");
            sendEmbed(message.channel, null, getUserMessage("EVAL_NO_PERMISSIONS_TITLE"), getUserMessage("EVAL_NO_PERMISSIONS_DESCRIPTION"), 0xda746a);
        }
    },
    help: function(message, invoke, args) {
        if(args[0]) {
            const cmdName = args[0].toLowerCase();
            if(commandMap[cmdName]) {
                sendEmbed(message.channel, null, "Help", commandMap[cmdName]["help"], 0xa4da6a);
            }
            else {
                sendEmbed(message.channel, null, "Error", getUserMessage("COMMAND_NOT_FOUND"), 0xda746a);
            }
        } else {
            const embed = new Discord.RichEmbed();
                    embed.setTitle("Help")
                    .setColor(0xda746a);
            for(const cmd in commandMap) {
                const commandInfo = commandMap[cmd];
                if(commandInfo) {
                    embed.addField(cmd, commandInfo["help"], false);
                }
            }
            message.channel.send(embed);
        }
    },
    log: function(message, invoke, args) {
        const siteLength = 25;
        const logLines = fs.readFileSync("basic.log", 'utf-8').split('\n');
        const permissions = MAIN_GUILD.members.get(message.member.user.id).permissions;
        if(permissions.has('ADMINISTRATOR')) {
            if(args[0] && !isNaN(args[0])) {
                const site = parseInt(args[0]);
                if(site > 0 && logLines.length > (site - 1) * siteLength + 1) {
                    const point = (site - 1) * siteLength;
                    createLogEmbed(message.channel, logLines.slice(point, point + siteLength).join('\n'), site, Math.ceil(logLines.length / siteLength), Math.round(fs.statSync('basic.log').size / 1000) +  "kb");
                }
                else {
                    sendEmbed(message.channel, null, "Log", getUserMessage("LOG_SITE_NOT_EXISTS"), 0xda746a);
                }
            }
            else {
                createLogEmbed(message.channel, logLines.slice(0, siteLength).join('\n'), 1, Math.ceil(logLines.length / siteLength), Math.round(fs.statSync('basic.log').size / 1000) +  "kb");
            }
        }
        else {
            sendEmbed(message.channel, null, "Log", getUserMessage("LOG_NO_PERMISSIONS"), 0xda746a);
        }
    }
};