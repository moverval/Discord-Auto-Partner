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
    const args = message.content.substr(prefix.length).split(" ");
    const invoke = args.shift().toLowerCase();
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
});

client.on('guildCreate', async function(guild) {
    if(guild.id !== process.env["MAIN_GUILD"]) {
        if(guild.memberCount >= MINIMAL_MEMBER) {
            let count = 0;
            let success = false;
            guild.channels.forEach(async function(channel) {
                const flags = await checkChannel(channel);
                if(flags & ChannelExpression.NONE) {
                    success = true;
                    // TODO Make partner channel create function and track changes on server
                }
            });
        } else {
            const embed = new Discord.RichEmbed();
            embed.setTitle("Not Verified as a Public Server")
            .setColor(0xda746a)
            .setDescription("I recognized that you don't look like a public server (I verify public servers when they have at least " + MINIMAL_MEMBER + " Members). When I verify you as a public server I'll write to you again.")
            guild.owner.send(embed);
        }
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
            console.log(status);
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
        
    }
});

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
        channelName: channel.name
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

function removePartner(channel) {
    const guild = channel.guild;
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