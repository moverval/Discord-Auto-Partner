let lastBoosted = "";

exports.command = async (message, invoke, args, main) => {
    if(main.getMainGuild().id === message.guild.id) {
        main.sendEmbed(message.channel, null, main.getUserMessage("COMMAND_BOOST_SELF_BOOST"), main.getUserMessage("COMMAND_BOOST_SELF_BOOST_DESCRIPTION"), 0x74766C);
        return;
    }
    if(main.isPartner(message.guild)) {
        const lastBoostTimeStr = main.getPartnerInformation()[message.guild.id]["boost_time"];
        if(lastBoostTimeStr) {
            const lastBoostTime = new Date(lastBoostTimeStr);
            const timeNow = new Date();
            const timePassed = timeNow.getTime() - lastBoostTime.getTime();
            exports.command.hourGate = 36e6;
            if(timePassed < exports.command.hourGate) { // 10 Hours
                const timeToOver = exports.command.hourGate - timePassed;
                const seconds = Math.round(timeToOver / 1e3 % 60);
                const minutes = Math.floor(timeToOver / 6e4 % 60);
                const hours = Math.floor(timeToOver / 36e5);

                if(hours !== 0) {
                    main.sendEmbed(message.channel, null, main.getUserMessage("COMMAND_BOOST_TIME_NOT_OVER"), main.getUserMessage("COMMAND_BOOST_TIME_UNTIL_OVER_HOURS", {HOURS: hours, MINUTES: minutes, SECONDS: seconds}), 0xFF837F);
                } else if(minutes !== 0) {
                    main.sendEmbed(message.channel, null, main.getUserMessage("COMMAND_BOOST_TIME_NOT_OVER"), main.getUserMessage("COMMAND_BOOST_TIME_UNTIL_OVER_MINUTES", {HOURS: hours, MINUTES: minutes, SECONDS: seconds}), 0xFF837F);
                } else {
                    main.sendEmbed(message.channel, null, main.getUserMessage("COMMAND_BOOST_TIME_NOT_OVER"), main.getUserMessage("COMMAND_BOOST_TIME_UNTIL_OVER_SECONDS", {HOURS: hours, MINUTES: minutes, SECONDS: seconds}), 0xFF837F);
                }
                return;
            }
        }
        for(const pGuildId in main.getPartnerInformation()) {
            const guildPartnerInformation = main.getPartnerInformation()[pGuildId];
            if(guildPartnerInformation["partner"]) {
                const guild = main.client.guilds.get(pGuildId);
                if(guild) {
                    const mainChannel = main.getMainGuild().channels.get(guildPartnerInformation["mainServerChannel"]["id"]);
                    if(mainChannel) { // Else partner channel not found on main server
                        mainChannel.setPosition(0);
                        const invite = await main.getInvite(guild);
                        if(invite) {
                            await main.editPartnerMessage(guild, main.createPartnerEmbed(main.getPartnerMessage()).addField("Geboosteter Server", main.getUserMessage("COMMAND_BOOST_PARTNER_SUBMESSAGE", {INVITE_LINK: "https://discord.gg/" + invite.code, SERVER_NAME: guild.name, INVITE_CODE: invite.code}), false));
                            main.sendEmbed(message.channel, null, main.getUserMessage("COMMAND_BOOST_SERVER_BOOSTED"), main.getUserMessage("COMMAND_BOOST_SERVER_BOOSTED_DESCRIPTION"), 0xFFFF7F);
                            main.getPartnerInformation()[message.guild.id]["boost_time"] = new Date().toString();
                            main.savePartnerInformation();
                        } else {
                            main.sendEmbed(message.channel, main.getUserMessage("COMMAND_BOOST_MISSING_PERMISSIONS"), main.getUserMessage("COMMAND_BOOST_MISSING_PERMISSIONS_DESCRIPTION"), 0xFF837F);
                        }
                    }
                } else {
                    main.removePartnerById(pGuildId);
                }
            }
        }
    } else {
        main.sendEmbed(message.channel, null, main.getUserMessage("NOT_PARTNERED"), main.getUserMessage("NOT_PARTNERED_DESCRIPTION"), 0xFF837F);
    }
};