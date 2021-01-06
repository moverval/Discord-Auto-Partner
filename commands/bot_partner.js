exports.bot_func = async (message, json, main) => { // General passive communication with partner bot, NOT TESTED
                                                // ACTIVE COMMUNICATION IS MISSING, NEEDS TO BE ADDED
    if(main.isString(json['args']['server']) && main.isString(json['args']['channel'])) {
        try {
            const guild = main.client.guilds.get(json['args']['server']);
            try {
                const channel = guild.channels.get(json['args']['channel']);
                if(guild) {
                    const channelExpression = main.checkChannel(channel);
                    if(channelExpression) {
                        const message = main.getChatExpressionStatus(channelExpression);
                        return {
                            error: main.createErrorCode(6, channelExpression), // MAJOR 6 = Channel Change Requested
                            errorMessage: message
                        };
                    } else {
                        await main.createPartner(channel);
                        return {
                            error: 0,
                            errorMessage: '',
                            success: true,
                            partnerChannel: {
                                id: main.getPartnerInformation()[guild.id]['mainServerChannel']['id'],
                                name: main.getPartnerInformation()[guild.id]['mainServerChannel']['name']
                            }
                        };
                    }
                }
            } catch(ChannelError) {
                return {
                    error: main.createErrorCode(5, 2),
                    errorMessage: main.getUserMessage("BOT_PARTNER_CHANNEL_ID")
                };
            }
        } catch(Error) {
            return {
                error: main.createErrorCode(5, 1),
                errorMessage: main.getUserMessage("BOT_PARTNER_GUILD_ID")
            };
        }
    } else {
        return {
            error: main.createErrorCode(4, 1),
            errorMessage: main.getUserMessage("BOT_PARTNER_PARAMS")
        };
    }
};

exports.command = (message, invoke, args, main) => {
    if(message.mentions.members.size > 0) {
        const user = message.mentions.users.array()[0];
        if(user && user.bot) {
            main.sendJSONResponse(user, main.createRequest('_test', null));
            main.bch.addResponseAwait(message.member.user, '_test', (bot_message, json) => {
                message.channel.send("Test successful");
            });
        } else {
            main.sendEmbed(message.channel, null, main.getUserMessage("BOT_PARTNER_CMD_MUST_BOT"), main.getUserMessage("BOT_PARTNER_CMD_MUST_BOT_DESCRIPTION"));
        }
    }
};

// TODO respond to responses