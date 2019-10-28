require('dotenv').config();
const Discord = require('discord.js');
const fs = require('fs');
const statusConfig = require('./status.json');

const client = new Discord.Client({disableEveryone: true});
const MINIMAL_MEMBER = parseInt(process.env["MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED"]);
const GUILD_NAME = process.env["MAIN_GUILD_NAME"];
const GUILD_ID = process.env["MAIN_GUILD"];
const PARTNER_CATEGORY = process.env["PARTNER_CATEGORY"];
/**
 * @type {Discord.Guild}
 */
let MAIN_GUILD = null;
let partnerInformation = {};

client.on('ready', function() {
    console.log("Bot logged");
    if(!(MAIN_GUILD = client.guilds.get(GUILD_ID)) || !MAIN_GUILD.available) {
        console.log("Bot is not on main server. Please start when main server is reachable");
        process.exit(0);
    }
    registerCommands();

    if(fs.existsSync('partners.json')) {
        partnerInformation = JSON.parse(fs.readFileSync('partners.json', 'utf-8'));
    }
});

client.login(process.env["CLIENT_SECRET"]);

const commandMap = {

};

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

client.on('message', function(message) {
    const prefix = process.env["CLIENT_INVOKE"];
    if(message.channel.type === 'text' && message.content.startsWith(prefix) && !message.member.user.bot && message.member.user.id !== client.user.id) {
        const args = message.content.substr(prefix.length).split(" ");
        const invoke = args.shift().toLowerCase();
        
        console.log("Got a message: " + message.content);
        if(commandMap[invoke]) {
            try {
                const result = commandMap[invoke]["callee"](message, invoke, args);
                if(typeof result === 'boolean') {
                    console.log("Command '" + invoke + "' did not execute correctly.");
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

client.on('guildCreate', async function(guild) {
    if(guild.id !== process.env["MAIN_GUILD"]) {
        console.log("Not main server");
        if(guild.memberCount >= MINIMAL_MEMBER) {
            console.log("Enough members (" + MINIMAL_MEMBER + ")");
            const information = await checkGuild(guild);
            if(information.isPartner) {
                console.log("Server is already a partner");
                createPartner(information.channel);
                const embed = new Discord.RichEmbed();
                embed.setTitle("Success")
                    .setDescription("All requirements are fullfilled. A partner channel is available for you :)")
                    .setColor(0xa4da6a);
                guild.owner.user.send(embed);
            }
            else {
                console.log("Setting up");
                const embed = new Discord.RichEmbed();
                embed.setTitle("Thanks for inviting me :)")
                    .setDescription("I will now explain how we can partner.\n\nI do not need any special rights. Please do not give me a bot role for safety. I am marked as invisible so I do not show up in your online list.")
                    .setColor(0xa4da6a);
                guild.owner.user.send(embed);
                const embed2 = new Discord.RichEmbed();
                embed.setTitle("Note")
                .setDescription("Please create a channel named like our server (for example: partner: " + GUILD_NAME + "). After that I will write you the next task")
                .setColor(0xffe675);
                guild.owner.user.send(embed2);
            }
        } else {
            console.log("Not enough members");
            const embed = new Discord.RichEmbed();
            embed.setTitle("Not Verified as a Public Server")
            .setColor(0xda746a)
            .setDescription("I recognized that you don't look like a public server (I verify servers as public when they have at least " + MINIMAL_MEMBER + " Members). When I verify you as a public server I'll write to you again.")
            guild.owner.user.send(embed);
        }
    }
    else {
        guild.owner.user.send("Joined main server... Wait how did you do that? This should not be possible. Please report this as an error.");
    }
});

const ChannelExpression = {
    NONE: 0,
    CHANNELNAME: 1,
    CHANNELPERMISSION_EVERYONE: 1 << 1,
    CHANNELPERMISSION_BOT: 1 << 2,
    CHANNEL_MESSAGE: 1 << 3,
    CHANNEL: 1 << 4
};

/**
 * @param {Discord.TextChannel} channel 
 * @returns {boolean}
 */
async function checkChannel(channel) {
    console.log("Checking channel " + channel.name);
    let rt = 0;
    if(channel.name.includes(GUILD_NAME)) {
        const permissions = channel.permissionsFor(channel.guild.id);
        const botPermissions = channel.permissionsFor(client.user);
        if(permissions.has('READ_MESSAGES') && permissions.has('READ_MESSAGE_HISTORY') && !permissions.has('SEND_MESSAGES')) {
            if(botPermissions.has('SEND_MESSAGES')) {
                const messages = await channel.fetchMessages();
                if(!messages.last().member.user.id === client.user.id)
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

client.on('channelCreate', function(channel) {
    if(channel.type === 'text') {
        const flags = checkChannel(channel);
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

client.on('channelUpdate', function(channelOld, channelNew) {
    if(channelNew.type === 'text') {
        if(isPartner(channelNew.guild)) {
            if(partnerInformation[channelNew.guild.id]["channelId"] === channelNew.id) {
                const flags = checkChannel(channelNew);
                const embed = new Discord.RichEmbed();
                embed.setTitle("Note")
                    .setDescription(getChatExpressionStatus(flags))
                    .setColor(0xffe675);
                channel.guild.owner.user.send(embed);
                if(flags) {
                    removePartner(channelNew);
                    embed.setColor(0xda746a)
                    .setTitle("Partner channel removed")
                    .setDescription("Partnership invalid because partner channel has changed to invalid.");
                    channel.guild.owner.user.send(embed);
                }
            }
        }
        else {
            const flags = checkChannel(channelNew);
            if(flags > ChannelExpression.CHANNELNAME) {
                const embed = new Discord.RichEmbed();
                embed.setTitle("Note")
                    .setDescription(getChatExpressionStatus(flags))
                    .setColor(0xffe675);
                channel.guild.owner.user.send(embed);
            }
            if(!flags) {
                const embed = new Discord.RichEmbed();
                embed.setTitle("Note")
                    .setDescription(getChatExpressionStatus(flags))
                    .setColor(0xffe675);
                channel.guild.owner.user.send(embed);
                createPartner(channelNew);
            }
        }
    }
});

client.on('channelDelete', function(channel) {
    if(channel.type === 'text') {
        if(isPartner(channel.guild)) {
            if(partnerInformation[channel.guild.id]["channelId"] === channel.id) {
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
        const user = client.users.find('id', guild.owner.id);
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
    return partnerInformation[guild] !== undefined && partnerInformation[guild]["partner"];
}

/**
 * @param {Discord.TextChannel} channel 
 */
async function createPartner(channel) {
    const guild = channel.guild;
    const category = MAIN_GUILD.channels.find(c => c.name === PARTNER_CATEGORY && c.type === 'category');
    const channel = await MAIN_GUILD.createChannel("｜" + guild.name, {
        type: 'text',
        parent: category
    });
    partnerInformation[guild.id] = {
        partner: true,
        name: guild.name,
        channelName: channel.name,
        channelId: channel.id
    };
    fs.writeFileSync('partners.json', JSON.stringify(partnerInformation));
    channel.overwritePermissions(guild.owner.id, {
        SEND_MESSAGES: true,
        MANAGE_MESSAGES: true,
        MANAGE_CHANNELS: true,
        MENTION_EVERYONE: false
    });
    channel.overwritePermissions(MAIN_GUILD.id, {
        READ_MESSAGES: true,
        READ_MESSAGE_HISTORY: true,
        SEND_MESSAGES: false,
        ADD_REACTIONS: true
    });
}

function removePartner(guild) {
    if(isPartner(guild)) {
        partnerInformation[guild.id]["partner"] = false;
        fs.writeFileSync('partners.json', JSON.stringify(partnerInformation));
    }
}

/**
 * @param {Discord.Guild} guild 
 * @returns {{isPartner:boolean,channel:Discord.Channel}}
 */
function checkGuild(guild) {
    return new Promise(resolve => {
        let count = 0;
        guild.channels.forEach(function(channel) {
            count++;
            if(channel.type === 'text') {
                if(!checkChannel(channel)) return resolve({isPartner: true, channel});
                if(count === guild.channels.size) {
                    return resolve({isPartner: false, channel: null});
                }
            }
        });
    });
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