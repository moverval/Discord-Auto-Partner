const {createCanvas, registerFont} = require('canvas');
const Discord = require('discord.js');

function rnd(min, max) {
    return Math.random() * (max - min) + min;
}

exports.command = (message, invoke, args, main) => {
    if(!exports.command.userList)
        exports.command.userList = {}

    if(exports.command.userList[message.member.user.id]) {
        const dateBefore = exports.command.userList[message.member.user.id];
        const now = new Date();
        if(now.getTime() - dateBefore.getTime() < 6e4) { // 1 Minute
            message.channel.send({embed: {
                description: main.getUserMessage("COMMAND_AVATAR_MUCH_MESSAGING")
            }});
            return;
        }
    }

    registerFont("./res/Solway-Regular.ttf", {family: 'Solway'});
    const   canvas  = createCanvas(1000, 1000);
    const   ctx     = canvas.getContext('2d');

    const NAME = message.member.user.username;

    const fontSize = Math.min(canvas.width, canvas.height);
    const drawSize = Math.min(canvas.width, canvas.height);

    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1b1a1a";
    ctx.fill();
    ctx.closePath();

    const FULL_CIRCLE = Math.PI * 2;

    ctx.beginPath();
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rnd(0, FULL_CIRCLE));
    ctx.arc(0, 0, drawSize * 0.4, 0, Math.PI * 2 * rnd(0.3, 0.8));
    ctx.strokeStyle = "#FFBBAC";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.rotate(rnd(0, FULL_CIRCLE));
    ctx.arc(0, 0, drawSize * 0.42, 0, Math.PI * 2 * rnd(0.3, 0.8));
    ctx.strokeStyle = "#FFEDAC";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.rotate(rnd(0, FULL_CIRCLE));
    ctx.arc(0, 0, drawSize * 0.44, 0, Math.PI * 2 * rnd(0.3, 0.8));
    ctx.strokeStyle = "#ACFFB9";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.rotate(rnd(0, FULL_CIRCLE));
    ctx.arc(0, 0, drawSize * 0.46, 0, Math.PI * 2 * rnd(0.3, 0.8));
    ctx.strokeStyle = "#ACDCFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.closePath();

    ctx.beginPath();
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = 4;
    ctx.font = `${fontSize/10}px Solway`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "#cdcdcd";
    ctx.fillText(NAME, canvas.width / 2, canvas.height / 2, drawSize * 0.7);
    ctx.beginPath();
    const attachment = new Discord.Attachment(canvas.toBuffer(), "avatar.png");
    message.channel.send(main.getUserMessage("COMMAND_AVATAR_RENDER_FINISHED"), attachment);
    exports.command.userList[message.member.user.id] = new Date();
};