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
const COMMAND_BOOST_ENABLED = process.env["COMMAND_BOOST"];
const CLIENT_INVITE = process.env["CLIENT_INVITE"];
const FEATURE_BROADCAST_ENABLED = process.env["FEATURE_BROADCAST"];
const COMMAND_AVATAR_ENABLED = false;
const BOT_PARTNER_ENABLED = process.env["BOT_COMMAND_PARTNER"];
const DEBUG = false;
const serverTempRoles = {};

function setChannelRole(guild, role) {
    serverTempRoles[guild.id] = role;
}

function removeChannelRole(guild) {
    partnerInformation[guild.id]["role"]["default"] = true;
    savePartnerInformation();
}

function getChannelRole(guild) {
    if(serverTempRoles[guild.id])
        return serverTempRoles[guild.id].id;

    if(partnerInformation[guild.id] && partnerInformation[guild.id].versionId && !partnerInformation[guild.id].role.default)
        return partnerInformation[guild.id].role.id;
    
    return false;
}

const JsonVars = {
    MINIMAL_MEMBER,
    GUILD_NAME,
    GUILD_ID,
    PARTNER_CATEGORY,
    PARTNER_MESSAGE,
    CLIENT_INVOKE,
    CLIENT_INVITE,
    GUILD_NAME_LOWER_CASE: GUILD_NAME.toLowerCase(),
    COMMAND_BOOST_ENABLED,
    FEATURE_BROADCAST_ENABLED
};

function addDebugMessage(...args) {
    if(DEBUG) 
        console.log(...args);
    fs.appendFileSync("basic.log", args.join(" ") + "\n");
};

function savePartnerInformation() {
    fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
}

function replaceStringVar(string, local=null) {
    return string.replace(/%([\w_]+)%/g, function(match, g1) {
        return JsonVars[g1] || local[g1];
    });
}

function getConsoleMessage(str, local=null) {
    return replaceStringVar(msg["ConsoleMessage"][str], local);
}

function getUserMessage(str, local=null) {
    return replaceStringVar(msg["UserMessage"][str], local);
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
    enableFeatures();
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
    if(COMMAND_BOOST_ENABLED) {
        registerCommand("boost", require("./commands/boost").command, getUserMessage("COMMAND_BOOST_HELP"));
    }
    if(COMMAND_AVATAR_ENABLED) {
        registerCommand("avatar", require("./commands/avatar").command, getUserMessage("COMMAND_AVATAR_HELP"));
    }
    registerCommand("verify", commandFunction.verify, getUserMessage("ROLE_HELP"));
    registerCommand("noverify", commandFunction.noverify, getUserMessage("NO_ROLE_HELP"));
    registerCommand("status", commandFunction.status, getUserMessage("STATUS_HELP"));
    registerCommand("help", commandFunction.help, getUserMessage("HELP_HELP"));
    registerCommand("eval", commandFunction.eval, getUserMessage("EVAL_HELP"));
    registerCommand("log", commandFunction.log, getUserMessage("LOG_HELP"));
    if(BOT_PARTNER_ENABLED) {
        bch.registerCommand("partner_request", require('./commands/bot_partner').bot_func);
    }
    // temp
    // registerCommand("test", require('./commands/bot_partner').command, "Test");
}

function enableFeatures() {
    if(FEATURE_BROADCAST_ENABLED) {
        require("./commands/broadcast").execute(cmdEnv);
    }
}

function sendEmbed(channel, backupchannel, title, description, color) {
    const embed = new Discord.RichEmbed();
    embed.setTitle(title)
    .setDescription(description)
    .setColor(color);
    channel.send(embed).catch(() => (backupchannel ? backupchannel.send(getUserMessage("ENABLE_DIRECT_MESSAGES")) : null));
}

function sendJSONResponse(channel, json) {
    return channel.send(JSON.stringify(json, null, '\t')).catch();
}

function sendNotifyMessage(channel, backupchannel, description) {
    sendEmbed(channel, backupchannel, getUserMessage("NOTE_TITLE"), description, 0x74766C);
}

client.on('messageDelete', async function(message) {
    reworkStatus(message.channel);
});

function botCommandJsonValid(json) {
    return json && typeof json['func'] === 'string'
                && typeof json['args'] === 'object';
}

function isBotResponse(json) {
    return typeof json['error'] === 'number' &&
            typeof json['errorMessage'] === 'string' &&
            typeof json['args'] !== 'undefined';
}

class BotCommandHandler {
    constructor() {
        this.commandMap = {};
        this.responseAwait = {};
        this.short = {
            getFunction: (json) => json['func'],
            getArgs: (json) => json['args']
        };
        this.registerCommand('_test', this.respondValid);
    }

    respondValid(message, json, main) {
        sendJSONResponse(message.channel, cmdEnv.createResponse(0, '', '_test', null));
    }

    registerCommand(command, func) {
        this.commandMap[command] = func;
    }

    unregisterCommand(command) {
        delete this.commandMap[command];
    }

    isCommand(command) {
        return typeof this.commandMap[command] === 'function';
    }

    callCommand(message, json) {
        if(botCommandJsonValid(json)) {
            if(this.isCommand(this.short.getFunction(json))) {
                const args = this.commandMap[this.short.getFunction(json)]['func'](message, json, cmdEnv);
                delete args['func'];
                delete args['error'];
                delete args['errorMessage'];
                sendJSONResponse(message.channel, cmdEnv.createResponse(args['error'] || 0, args['errorMessage'] || '', this.short.getFunction(json), args));
            } else {
                sendJSONResponse(message.channel, {
                    error: 2,
                    errorMessage: getUserMessage("BOT_CALL_NOT_FUNCTION")
                });
            }
        } else {
            sendJSONResponse(message.channel, {
                error: 3,
                errorMessage: getUserMessage("BOT_CALL_PARAMS_MISSING")
            });
        }
    }

    addResponseAwait(userId, funcName, func) {
        if(funcName.startsWith('__')) return;
        if(!this.responseAwait[userId]) {
            this.responseAwait[userId] = {};
            this.responseAwait[userId]['__current'] = {};
        }
        if(!this.responseAwait[userId][funcName]) { // Type must be registered
            this.responseAwait[userId][funcName] = [];
            this.responseAwait[userId]['__current'][funcName] = 0;
        }
        const size = this.responseAwait[userId][funcName].push(func);
        const before = this.responseAwait[userId]['__current'];

        setTimeout(() => {
            const current = this.responseAwait[userId]['__current'][funcName];
            if(current - before < size) {
                this.responseAwait[userId][funcName].splice(0, 1);
                console.log(getConsoleMessage("BOT_COMMUNICATION_REMOVED_AWAITED_RESPONSE", {USER_ID: userId, FUNCTION: funcName}));
            }
        }, 1e4); // After 10 Seconds Response gets canceled.
    }

    getResponse(message, json) {
        const funcName = this.short.getFunction(json);
        if(funcName.startsWith('__')) return;
        const userId = message.member.user.id;
        if(this.responseAwait[userId] && this.responseAwait[userId][funcName]
            && this.responseAwait[userId][funcName].size > 0) {
                const func = this.responseAwait[userId][funcName].shift();
                this.responseAwait[userId]['__current'][funcName] += 1;
                try {
                    func(message, json);
                } catch(Error) {
                    console.log(getConsoleMessage("BOT_COMMUNICATION_RESPONSE_FUNCTION_ERROR", {FUNCTION: funcName, USER_ID: userId}));
                }
            } else {
                console.log(getConsoleMessage("BOT_COMMUNICATION_RESPONSE_INVALID"));
            }
    }
}

function manageBotCommand(message) {
    try {
        const json = JSON.parse(message.content);
        if(isBotResponse(json)) {
            bch.getResponse(message, json);
        } else {
            bch.callCommand(message, json);
        }
    } catch(Error) {
        sendJSONResponse(message.channel, {
            error: 1,
            errorMessage: getUserMessage("BOT_EXAMINE_NOT_JSON")
        });
    }
}
const bch = new BotCommandHandler();
client.on('message', async function(message) {
    if(message.author.bot) {
        if(message.channel.type === 'dm' && message.author.id !== client.user.id) {
            manageBotCommand(message);
        }
        return;
    }
    reworkStatus(message.channel);
    const prefix = process.env["CLIENT_INVOKE"];
    if(message.content.startsWith(prefix) && !message.member.user.bot && message.member.id !== client.user.id) {
        const args = message.content.substr(prefix.length).split(" ");
        const invoke = args.shift().toLowerCase();
        
        addDebugMessage("[COMMAND_HANDLER] Got a command: " + message.content);
        if(commandMap[invoke]) {
            try {
                const result = await commandMap[invoke]["callee"](message, invoke, args, cmdEnv);
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

function createPartnerInformation(channel, partnered, mainServerChannel, partnerMessage, role=null) {
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
        role: {
            default: role ? false : true,
            id: role
        },
        partnershipRecorded: new Date(),
        channelId: channel.id,
        partner: partnered,
        channelName: channel.name,
        name: channel.guild.name,
        saveVersion: 'v0.0.1',
        versionId: 2
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
    CHANNEL_FOREIGN_MESSAGE: 1 << 5,
    ROLE_FEW_MEMBERS: 1 << 6,
    TOO_MUCH_MESSAGES: 1 << 7
};

/**
 * @param {Discord.TextChannel} channel 
 * @returns {boolean}
 */
async function checkChannel(channel) {
    /**
     * @type {Role}
     */
    let role = getChannelRole(channel.guild);
    if(!role) {
        role = channel.guild.id;
    } else {
        role = channel.guild.roles.get(role);
        if(!role) removeChannelRole(channel.guild);
        else if(role.members.size < MINIMAL_MEMBER || role.members.size / channel.guild.members.size < 0.5) {
            return ChannelExpression.ROLE_FEW_MEMBERS;
        }
    }
    let rt = 0;
    if(channel.name.indexOf(GUILD_NAME.toLowerCase()) !== -1) {
        const permissions = channel.permissionsFor(role);
        const botPermissions = channel.permissionsFor(client.user);
        if(permissions && permissions.has('READ_MESSAGES') && permissions.has('READ_MESSAGE_HISTORY') && !permissions.has('SEND_MESSAGES')) {
            if(botPermissions && botPermissions.has('SEND_MESSAGES') && botPermissions.has('READ_MESSAGES') && botPermissions.has('READ_MESSAGE_HISTORY')) {
                const messages = await channel.fetchMessages();
                const lastMessage = messages.first();
                if(lastMessage) {
                    if(lastMessage.member.user.id !== client.user.id)
                        return ChannelExpression.CHANNEL_FOREIGN_MESSAGE;
                    if(partnerInformation[channel.guild.id] && partnerInformation[channel.guild.id]["partnerMessage"]["id"] !== lastMessage.id) {
                        partnerInformation[channel.guild.id]["partnerMessage"]["id"] = lastMessage.id;
                        console.log(getConsoleMessage("PARTNER_MESSAGE_ID_UPDATED"));
                        savePartnerInformation();
                    }
                }
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

async function reworkStatus(channel) {
    if(channel.type === 'text') {
        const flags = await checkChannel(channel);
        if(isPartner(channel.guild)) {
            if(partnerInformation[channel.guild.id]["channel"]["id"] === channel.id) {
                if(flags) {
                    if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                        const message = await sendPartnerMessage(channel);
                        sendNotifyMessage(channel.guild.owner.user, null, getUserMessage("MESSAGE_UPDATED"));
                        partnerInformation[channel.guild.id]["partnerMessage"]["id"] = message.id;
                        partnerInformation[channel.guild.id]["partnerMessage"]["lastUpdate"] = new Date();
                        savePartnerInformation();
                    } else {
                        removePartner(channel.guild);
                        sendEmbed(channel.guild.owner, null, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
                    }
                }
            }
        } else {
            if(flags) {
                if(flags > ChannelExpression.CHANNELNAME) {
                    const status = getChatExpressionStatus(flags);
    
                    if(status) {
                        sendNotifyMessage(channel.guild.owner, channel, status);
                    }
                }
                
                if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                    sendPartnerMessage(channel);
                }
            } else {
                const status = getChatExpressionStatus(flags);
                sendNotifyMessage(channel.guild.owner, channel, status);
                createPartner(channel);
            }
        }
    }
}

client.on('channelCreate', reworkStatus);

client.on('channelUpdate', async function(channelOld, channelNew) {
    await reworkStatus(channelNew);
    // if(channelNew.type === 'text') {
    //     if(isPartner(channelNew.guild)) {
    //         addDebugMessage("[CHANNEL_UPDATE] This channel is on a partner guild");
    //         if(partnerInformation[channelNew.guild.id]["channelId"] === channelNew.id) {
    //             addDebugMessage("[CHANNEL_UPDATE] Channel is already registered as partner channel");
    //             const flags = await checkChannel(channelNew);
    //             if(flags) {
    //                 const embed = new Discord.RichEmbed();
    //                 addDebugMessage("[CHANNEL_UPDATE] Channel is now invalid, removing partner");
    //                 removePartner(channelOld.guild);
    //                 sendEmbed(channelNew.guild.owner, channelOld, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
    //             }
    //         }
    //     }
    //     else {
    //         let flags = await checkChannel(channelNew);
    //         addDebugMessage("[CHANNEL_UPDATE] Flags: " + flags);
    //         if(flags > ChannelExpression.CHANNELNAME) {
    //             addDebugMessage("[CHANNEL_UPDATE] More steps than setting the name to channel");
    //             addDebugMessage("[CHAT_EXPRESSION] " + getChatExpressionStatus(flags));
    //             sendNotifyMessage(channelOld.guild.owner.user, null, getChatExpressionStatus(flags));
    //             if(flags & ChannelExpression.CHANNEL_MESSAGE) {
    //                 await sendPartnerMessage(channelOld);
    //                 flags = await checkChannel(channelNew);
    //             }
    //         }
    //         if(!flags) {
    //             addDebugMessage("[CHANNEL_UPDATE] Channel complete. Ready for partner");
    //             if(!isPartner(channelNew.guild)) {
    //                 sendNotifyMessage(channelOld.guild.owner.user, null, getChatExpressionStatus(flags));
    //                 createPartner(channelNew);
    //             }
    //         }
    //     }
    // }
});

function createPartnerEmbed(partnerMessage) {
    const embed = new Discord.RichEmbed();
    embed.setTitle(GUILD_NAME).setDescription(partnerMessage).setFooter(getUserMessage("PARTNER_MESSAGE_FOOTER"), MAIN_GUILD.iconURL).setColor(0x202225).setThumbnail(MAIN_GUILD.iconURL);
    return embed;
}

async function sendPartnerMessage(channel, content=null) {
    if(!content) content = createPartnerEmbed(PARTNER_MESSAGE);
    return await channel.send(content).catch();
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
    const role = getChannelRole(channel.guild);
    partnerInformation[guild.id] = createPartnerInformation(channel, true, mGuildChannel, channel.messages.last(), role);
    savePartnerInformation();
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
    if(partnerChannel) {
        addDebugMessage("[PARTNER_MANAGER] Deleting partner channel");
        partnerChannel.delete().then(function() {
            addDebugMessage("[PARTNER_MANAGER] Partner channel removed");
        });
    }
    else addDebugMessage("[PARTNER_MANAGER] Partner channel already removed");
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
                    addDebugMessage("[GUILD_CHECK] Message missing but the rest is ok (sending message now)");
                    return resolve({isPartner: true, channel});
                }
                if(count === guildChannels.size) {
                    return resolve({isPartner: false, channel: null, potentialChannel: potentialChannel, flags: lastFlags});
                }
            });
        });
    });
}

/**
 * @param {Discord.Guild} guild 
 * @param {*} attachment 
 */
async function editPartnerMessage(guild, content=null) {
    //client.guilds.array()[0].fetchInvites().then(guildInvites => {
        
    //}); TODO make invite function for ++boost
    if(!content) content = createPartnerEmbed(PARTNER_MESSAGE);

    if(!isPartner(guild)) {
        return false;
    }

    const channelId = partnerInformation[guild.id]["channel"]["id"];
    const messageId = partnerInformation[guild.id]["partnerMessage"]["id"];
    
    await guild.channels.get(channelId).messages.get(messageId).edit(content).catch((error) => console.log("Error while editing Partner message" + error));

    return true;
}

async function checkPartnerServersValid() {
    for(const pGuildId in partnerInformation) {
        addDebugMessage("[PARTNER_CHECK] Checking potential partner " + pGuildId);
        const guildPartnerInformation = partnerInformation[pGuildId];
        if(guildPartnerInformation["partner"]) {
            const guild = client.guilds.get(pGuildId);
            if(guild) {
                const information = await checkGuild(guild);
                console.log(getConsoleMessage("CHECK_GUILD", {CURRENT_GUILD_NAME: guild.name, CURRENT_GUILD_ID: guild.id}));
                if(!information.isPartner) {
                    removePartner(guild);
                    sendEmbed(guild.owner.user, null, getUserMessage("PARTNER_CHANNEL_REMOVED_TITLE"), getUserMessage("PARTNER_CHANNEL_REMOVED_DESCRIPTION"), 0xda746a);
                    addDebugMessage("[PARTNER_CHECK] Partner " + pGuildId + "not valid. Partnership removed");
                }
                else {
                    if(information.channel.id !== guildPartnerInformation["channel"]["id"]) {
                        addDebugMessage("[PARTNER_CHECK] Channel has changed. Updating partners.json");
                        partnerInformation["channel"]["id"] = information.channel.id;
                        partnerInformation["channel"]["name"] = information.channel.name;
                        fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
                    }
                    editPartnerMessage(guild);
                    addDebugMessage("[PARTNER_CHECK] Updating partner message on server " + pGuildId);
                }
            }
            else {
                removePartnerById(pGuildId);
                addDebugMessage("[PARTNER_CHECK] Partner " + pGuildId + " removed");
            }
        }
    }
}

client.on('roleDelete', function(role) {
    if(isPartner(role.guild)) {
        if(partnerInformation[role.guild.id].versionId) {
            if(partnerInformation[role.guild.id].role.id === role.id) {
                removePartner(role.guild);
            }
        }
    }
});

client.on('roleUpdate', function(role) {
    if(role.members.size < MINIMAL_MEMBER)
    {
        removePartner(role.guild);
    }
});

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
        sendEmbed(message.member.user, message.channel, getUserMessage("PARTNERSHIP_INVITE_MESSAGE"), getUserMessage("PARTNERSHIP_INVITE_MESSAGE_DESCRIPTION"), 0x74766C);
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
        const siteLength = 18;
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
    },
    verify: function(message, invoke, args) {
        const role = message.mentions.roles.array()[0];
        if(message.channel.guild.id === MAIN_GUILD.id) return;
        if(!role) {
            sendEmbed(message.channel, null, getUserMessage("ROLE_NO_ROLE_GIVEN"), getUserMessage("ROLE_NO_ROLE_GIVEN_DESCRIPTION"), 0xFF837F);
            return;
        }
        if(role && message.mentions.roles.array()[0].members.array().length >= MINIMAL_MEMBER && role.members.size / message.channel.guild.members.size >= 0.5) {
            if(!isPartner(message.guild)) {
                setChannelRole(message.guild, role);
                sendEmbed(message.channel, null, getUserMessage("ROLE_SET"), getUserMessage("ROLE_SET_DESCRIPTION"), 0xFFFF7F);
            } else {
                sendEmbed(message.channel, null, getUserMessage("ROLE_ALREADY_PARTNER"), getUserMessage("ROLE_ALREADY_PARTNER_DESCRIPTION"), 0xFF837F);
            }
        } else {
            sendEmbed(message.channel, null, getUserMessage("ROLE_NOT_SET"), getUserMessage("ROLE_NOT_SET_DESCRIPTION"), 0xFF837F);
        }
    },
    noverify: function(message, invoke, args) {
        if(!isPartner(message.guild)) {
            sendEmbed(message.channel, null, getUserMessage("NO_ROLE"), getUserMessage("NO_ROLE_DESCRIPTION"), 0xFFFF7F);
        } else {
            sendEmbed(message.channel, null, getUserMessage("ROLE_ALREADY_PARTNER"), getUserMessage("ROLE_ALREADY_PARTNER_DESCRIPTION"), 0xFF837F);
        }
    },
    status: async function(message, invoke, args) {
        if(message.member.user.id === message.guild.owner.id) {
            const guildStatus = await checkGuild(message.guild);
            if(guildStatus.isPartner) {
                if(!isPartner(message.guild)) {
                    createPartner(guildStatus.channel);
                    sendEmbed(message.member.user, null, getUserMessage("STATUS_UPDATED"), getUserMessage("STATUS_UPDATED_DESCRIPTION"), 0xFFFF7F);
                } else {
                    sendEmbed(message.member.user, null, getUserMessage("STATUS_PARTNER"), getUserMessage("STATUS_PARTNER_DESCRIPTION"), 0xFFFF7F);
                }
            } else {
                sendNotifyMessage(message.member.user, null, getChatExpressionStatus(guildStatus.flags));
            }
        } else {
            sendEmbed(message.member.user, null, getUserMessage("STATUS_ONLY_OWNER"), getUserMessage("STATUS_ONLY_OWNER_DESCRIPTION"), 0xFF837F);
        }
    }
};

/**
 * @param {Discord.Guild} guild 
 */
async function getInvite(guild) { // TODO Create invite
    let channel = guild.systemChannel;
    if(!channel.permissionsFor(client.user).has('CREATE_INSTANT_INVITE')) {
        channel = guild.channels.find(channel => channel.permissionsFor(client.user).has('CREATE_INSTANT_INVITE'));
        if(!channel) return false;
    }
    return await channel.createInvite({unique: false, maxAge: 0, maxUses: 0});
}

const cmdEnv = {
    isPartner, MAIN_GUILD, editPartnerMessage, removePartnerById, sendEmbed, getUserMessage,
    getConsoleMessage, client, sendJSONResponse, checkChannel,
    createPartnerEmbed, getInvite, savePartnerInformation,
    getChatExpressionStatus, createPartner, bch,
    isString: value => typeof value === 'string',
    isNumber: value => typeof value === 'number',
    getPartnerInformation: () => partnerInformation,
    getMainGuild: () => MAIN_GUILD,
    getPartnerMessage: () => PARTNER_MESSAGE,
    getProcessEnv: () => process.env,
    createResponse: (error, errorMessage, func, json) => ({error, errorMessage, func, args: json}),
    createRequest: (func, args) => ({func, args}),
    createErrorCode: (major, minor) => (major << 24) + minor
};
