const Discord = require('discord.js');

const client = new Discord.Client({disableEveryone: true});
const MINIMAL_MEMBER = parseInt(process.env["MAIN_GUILD_MINIMAL_MEMBERS_REQUIRED"]);
const GUILD_NAME = process.env["MAIN_GUILD_NAME"];

client.on('ready', function() {
    console.log("Bot logged");
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

client.on('guildCreate', function(guild) {
    if(guild.id !== process.env["MAIN_GUILD"]) {
        if(guild.memberCount >= MINIMAL_MEMBER) {
            let count = 0;
            let success = false;
            guild.channels.forEach(function(channel) {
                const flags = checkChannel(channel);
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
    GUILDNAME: 1,
    CHANNELPERMISSION_EVERYONE: 1 << 1,
    CHANNELPERMISSION_BOT: 1 << 2,
    CHANNEL_MESSAGE: 1 << 3,
    CHANNEL: 1 << 4
};

/**
 * @param {Discord.TextChannel} channel 
 * @returns {boolean}
 */
function checkChannel(channel) {
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
    } else rt |= ChannelExpression.GUILDNAME;
    return rt;
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