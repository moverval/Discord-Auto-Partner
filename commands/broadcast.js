exports.execute = (main) => {
    const date = new Date();
    let time = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 30, 0, 0);
    if(time.getTime() - date.getTime() < 0) {
        time.setTime(time.getTime() + 864e5);
    }

    console.log(main.getConsoleMessage("FEATURE_BROADCAST_REGISTERED"));

    setTimeout(() => {
        sendMessage(main, {embed: {
            description: main.getUserMessage("FEATURE_BROADCAST_MESSAGE"),
            color: 0x16E392
        }});

        setInterval(() => {
            sendMessage(main, {embed: {
                description: main.getUserMessage("FEATURE_BROADCAST_MESSAGE"),
                color: 0x16E392
            }});
        }, 864e5);
    }, time.getTime() - date.getTime());
};

function sendMessage(main, messageContent) {
    const broadcastChannel = main.getMainGuild().channels.get(main.getProcessEnv()["BROADCAST_CHANNEL"]);
    broadcastChannel.send(messageContent);
}