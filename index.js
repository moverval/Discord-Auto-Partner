require('dotenv').config();
const Discord = require('discord.js');
const fs = require('fs');
const statusConfig = require('./status.json');

const client = new Discord.Client({disableEveryone: true});
const MINIMAL_MEMBER = parseInt(process.env["MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED"]);
const GUILD_NAME = process.env["MAIN_GUILD_NAME"];
const GUILD_ID = process.env["MAIN_GUILD"];
const PARTNER_CATEGORY = process.env["PARTNER_CATEGORY"];
const PARTNER_MESSAGE = fs.readFileSync('pm.md', 'utf-8');
const DEBUG = false;

function addDebugMessage(...args) {
    if(DEBUG)
        console.log(...args)
};

/**
 * @type {Discord.Guild}
 */
let MAIN_GUILD = null;
let partnerInformation = {};

client.on('ready', async function() {
    console.log("Bot logged");
    if(!(MAIN_GUILD = client.guilds.get(GUILD_ID)) || !MAIN_GUILD.available) {
        console.log("Bot is not on main server. Please start when main server is reachable");
        process.exit(0);
    }
    registerCommands();
    client.user.setStatus('invisible');

    if(fs.existsSync('partners.json')) {
        partnerInformation = JSON.parse(fs.readFileSync('partners.json', 'utf-8'));
    }

    await checkPartnerServersValid();
    console.log("Partner Servers syncronized");
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
    registerCommand("partnership", commandFunction.partnership, "Can register a new partnership for your server");
}

function sendNotifyMessage(channel, description) {
    const embed = new Discord.RichEmbed();
    embed.setTitle("Note")
        .setDescription(description)
        .setColor(0xffe675);
    channel.send(embed);
}

client.on('messageDelete', async function(message) {
    if(isPartner(message.guild)) {
        if(partnerInformation[message.guild.id]["channel"]["id"] === message.channel.id) {
            if(partnerInformation[message.guild.id]["partnerMessage"]["id"] === message.id) {
                sendNotifyMessage(message.guild.owner.user, "Partner message updated");
                const partnerMessage = await message.channel.send(PARTNER_MESSAGE);
                partnerInformation[message.guild.id]["partnerMessage"]["id"] = partnerMessage.id;
                partnerInformation[message.guild.id]["partnerMessage"]["lastUpdate"] = new Date();
                fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
            }
        }
    }
    if(!isPartner(message.guild)) {
        let flags = await checkChannel(message.channel);
        addDebugMessage("Getting flags " + flags);
        if(flags > ChannelExpression.CHANNELNAME) {
            addDebugMessage("More steps than setting the name to channel");
            addDebugMessage(getChatExpressionStatus(flags));
            sendNotifyMessage(message.guild.owner.user, getChatExpressionStatus(flags));
            if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                await sendPartnerMessage(message.channel);
                flags = await checkChannel(message.channel);
            }
        }
        if(!flags) {
            addDebugMessage("Channel complete. Ready for partner");
            if(!isPartner(message.guild)) {
                sendNotifyMessage(message.guild.owner.user, getChatExpressionStatus(flags));
                createPartner(message.channel);
            }
        }
    }
});

client.on('message', async function(message) {
    if(isPartner(message.guild)) {
        if(partnerInformation[message.guild.id]["channelId"] === message.channel.id && message.member.user.id !== client.user.id) {
            const embed = new Discord.RichEmbed();
            embed.setColor(0xda746a)
            .setTitle("Partner channel removed")
            .setDescription("Partnership invalid because partner channel turned to invalid");
            message.guild.owner.send(embed);
            removePartner(message.guild);
        }
    }
    const prefix = process.env["CLIENT_INVOKE"];
    if(message.channel.type === 'text' && message.content.startsWith(prefix) && !message.member.user.bot && message.member.user.id !== client.user.id) {
        const args = message.content.substr(prefix.length).split(" ");
        const invoke = args.shift().toLowerCase();
        
        addDebugMessage("Got a message: " + message.content);
        if(commandMap[invoke]) {
            try {
                const result = commandMap[invoke]["callee"](message, invoke, args);
                if(typeof result === 'boolean') {
                    addDebugMessage("Command '" + invoke + "' did not execute correctly.");
                }
            } catch(err) {
                message.channel.send("Error occured. Please wait, a developer will fix this soon.");
                console.error(err);
            }
        } else {
            message.channel.send("Command not found");
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
        addDebugMessage("Not main server");
        if(guild.memberCount >= MINIMAL_MEMBER) {
            addDebugMessage("Enough members (" + MINIMAL_MEMBER + ")");
            const information = await checkGuild(guild);
            if(information.isPartner) {
                addDebugMessage("Server is already a partner");
                createPartner(information.channel);
                const embed = new Discord.RichEmbed();
                embed.setTitle("Success")
                    .setDescription("All requirements are fullfilled. A partner channel is available for you :)")
                    .setColor(0xa4da6a);
                guild.owner.user.send(embed);
            }
            else {
                addDebugMessage("Setting up");
                const embed = new Discord.RichEmbed();
                embed.setTitle("Thanks for inviting me :)")
                    .setDescription("I will now explain how we can partner.\n\nI do not need any special rights. Please do not give me a bot role for safety. I am marked as invisible so I do not show up in your online list.")
                    .setColor(0xa4da6a);
                guild.owner.user.send(embed);
                sendNotifyMessage(guild.owner.user, "Please create a channel named like our server (for example: partner: " + GUILD_NAME + "). After that I will write you the next task");
            }
        } else {
            addDebugMessage("Not enough members");
            const embed = new Discord.RichEmbed();
            embed.setTitle("Not Verified as a Public Server")
            .setColor(0xda746a)
            .setDescription("I recognized that you don't look like a public server (I verify servers as public when they have at least " + MINIMAL_MEMBER + " Members). When I verify you as a public server I'll write to you again.")
            guild.owner.user.send(embed);
        }
    }
    else {
        sendNotifyMessage(guild.owner.user, "Joined main server... Wait how did you do that? This should not be possible. Please report this as an error.");
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
    addDebugMessage("Checking channel " + channel.name);
    let rt = 0;
    if(channel.name.indexOf(GUILD_NAME.toLowerCase()) !== -1) {
        addDebugMessage("Name valid");
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
                message = statusConfig["ChatExpression"][status];
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
            const embed = new Discord.RichEmbed();
            embed.setTitle("Note")
            .setDescription(getChatExpressionStatus(flags))
            .setColor(0xffe675);
            channel.guild.owner.user.send(embed);
        }
    }
});

client.on('channelUpdate', async function(channelOld, channelNew) {
    if(channelNew.type === 'text') {
        addDebugMessage("This is a text channel");
        if(isPartner(channelNew.guild)) {
            addDebugMessage("This channel is on a partner guild");
            if(partnerInformation[channelNew.guild.id]["channelId"] === channelNew.id) {
                addDebugMessage("This is already a partner channel");
                const flags = await checkChannel(channelNew);
                if(flags) {
                    const embed = new Discord.RichEmbed();
                    addDebugMessage("Channel is now invalid, removing partner");
                    removePartner(channelOld.guild);
                    embed.setColor(0xda746a)
                    .setTitle("Partner channel removed")
                    .setDescription("Partnership invalid because partner channel has changed to invalid.");
                    channelNew.guild.owner.user.send(embed);
                }
            }
        }
        else {
            let flags = await checkChannel(channelNew);
            addDebugMessage("Getting flags " + flags);
            if(flags > ChannelExpression.CHANNELNAME) {
                addDebugMessage("More steps than setting the name to channel");
                addDebugMessage(getChatExpressionStatus(flags));
                sendNotifyMessage(channelOld.guild.owner.user, getChatExpressionStatus(flags));
                if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                    await sendPartnerMessage(channelOld);
                    flags = await checkChannel(channelNew);
                }
            }
            if(!flags) {
                addDebugMessage("Channel complete. Ready for partner");
                if(!isPartner(channelNew.guild)) {
                    sendNotifyMessage(channelOld.guild.owner.user, getChatExpressionStatus(flags));
                    createPartner(channelNew);
                }
            }
        }
    }
});

async function sendPartnerMessage(channel) {
    await channel.send(PARTNER_MESSAGE);
}

client.on('channelDelete', function(channel) {
    if(channel.type === 'text') {
        addDebugMessage("Text channel deleted");
        if(isPartner(channel.guild)) {
            addDebugMessage("Text channel was removed from partner server");
            if(partnerInformation[channel.guild.id]["channelId"] === channel.id) {
                addDebugMessage("This was the partner channel");
                removePartner(channel.guild);
                const embed = new Discord.RichEmbed();
                embed.setColor(0xda746a)
                .setTitle("Partner channel removed")
                .setDescription("Partnership invalid because partner channel is deleted");
                channel.guild.owner.send(embed);
            }
        }
    }
});

client.on('guildDelete', function(guild) {
    if(isPartner(guild)) {
        removePartner(guild);
        const user = client.users.get(guild.owner.id);
        if(user) {
            const embed = new Discord.RichEmbed();
            embed.setDescription("Partner channel removed")
            .setDescription("I lost track of the current status. I need to be on your server to verify that the partnership is set up correctly")
            .setColor(0xda746a);
            user.send(embed);
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
    partnerInformation[guildId]["partner"] = false;
    const partnerChannel = MAIN_GUILD.channels.get(partnerInformation[guildId]["mainServerChannel"]["id"]);
    partnerChannel.delete().then(function() {
        addDebugMessage("partner channel deleted");
    });
    fs.writeFileSync('partners.json', JSON.stringify(partnerInformation, null, '\t'));
}

/**
 * @param {Discord.Guild} guild 
 * @returns {{isPartner:boolean,channel:Discord.Channel}}
 */
function checkGuild(guild) {
    return new Promise(async resolve => {
        let count = 0;
        const guildChannels = guild.channels.filter(c => c.type === 'text');
        guildChannels.forEach(function(channel) {
            checkChannel(channel).then(function(flags) {
                count++;
                if(!flags) {
                    addDebugMessage("Server is ok");
                    return resolve({isPartner: true, channel});
                }
                if(flags & ChannelExpression.CHANNEL_MESSAGE) {
                    sendPartnerMessage(channel);
                    addDebugMessage("Message missing but the rest is ok");
                    return resolve({isPartner: true, channel});
                }
                if(count === guildChannels.size) {
                    return resolve({isPartner: false, channel: null});
                }
            });
        });
    });
}

async function checkPartnerServersValid() {
    for(const pGuildId in partnerInformation) {
        if(partnerInformation[pGuildId]["partner"]) {
            const guild = client.guilds.get(pGuildId);
            if(guild) {
                addDebugMessage("test1");
                const information = await checkGuild(guild);
                addDebugMessage("test2");
                if(!information.isPartner) {
                    removePartner(guild);
                    const embed = new Discord.RichEmbed();
                    embed.setColor(0xda746a)
                    .setTitle("Partner channel removed")
                    .setDescription("Partnership invalid because partner channel has changed to invalid.");
                    guild.owner.user.send(embed);
                    addDebugMessage("Partner " + pGuildId + "not valid. Partnership removed");
                }
                else {
                    information.channel.messages.get(partnerInformation[pGuildId]["partnerMessage"]["id"]).edit(PARTNER_MESSAGE);
                    addDebugMessage("Updating partner message on server " + pGuildId);
                }
            }
            else {
                removePartnerById(pGuildId);
                addDebugMessage("Partner " + pGuildId + " removed");
            }
        }
    }
}

const commandFunction = {
    partnership: function(message, invoke, args) {
        try {
            const embed = new Discord.RichEmbed();
            embed.setColor(0xa4da6a)
            .setTitle("Please invite me to your server")
            .setDescription(process.env["CLIENT_INVITE"])
            .setFooter("For our safety");
            message.member.user.send(embed);
        } catch(err) {
            message.channel.send("Please enable direct messages for this server");
        }
    }
};