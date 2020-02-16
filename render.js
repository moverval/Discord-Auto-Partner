const {createCanvas, Image} = require('canvas');

exports.renderPartner = (width, height, url1, url2) => {
    return new Promise(resolve => {
        const imgUrl1 = url1;
        const imgUrl2 = url2;

        /**
         * @type {HTMLCanvasElement}
         */
        const   canvas  = createCanvas(width, height),
                ctx     = canvas.getContext('2d');

        const arcDiameter = 0.8;

        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#202020";
        ctx.fill();
        ctx.closePath();

        ctx.beginPath();
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.arc(canvas.height / 2, canvas.height / 2, canvas.height * arcDiameter / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#303030";
        ctx.fill();
        ctx.closePath();

        const image1 = new Image();

        image1.onload = function() {
            ctx.beginPath();
            ctx.arc(canvas.height / 2, canvas.height / 2, canvas.height * 0.9 * arcDiameter / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.save();
            ctx.clip();
            ctx.drawImage(image1, canvas.height * (1 - arcDiameter) / 2, canvas.height * (1 - arcDiameter) / 2, canvas.height * arcDiameter, canvas.height * arcDiameter);
            ctx.restore();

            ctx.beginPath();
            ctx.shadowBlur = 15;
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.arc(canvas.width - canvas.height / 2, canvas.height / 2, canvas.height * arcDiameter / 2, 0, Math.PI * 2);
            ctx.fillStyle = "#303030";
            ctx.fill();
            ctx.closePath();

            const image2 = new Image();

            image2.onload = function() {
                ctx.beginPath();
                ctx.arc(canvas.width - canvas.height / 2, canvas.height / 2, canvas.height * 0.9 * arcDiameter / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.save();
                ctx.clip();
                ctx.drawImage(image2, canvas.width - canvas.height * (arcDiameter + (1 - arcDiameter) / 2), canvas.height * (1 - arcDiameter) / 2, canvas.height * arcDiameter, canvas.height * arcDiameter);
                ctx.restore();

                ctx.beginPath();
                ctx.shadowBlur = 15;
                ctx.shadowColor = "rgba(0,0,0,0.4)";
                ctx.strokeStyle = '#151515';
                ctx.lineWidth = 2;
                ctx.moveTo(canvas.height * (arcDiameter + (1 - arcDiameter) / 2), canvas.height / 2);
                ctx.lineTo(canvas.width - canvas.height * (arcDiameter + (1 - arcDiameter) / 2), canvas.height / 2);
                ctx.stroke();
                ctx.closePath();

                const smallCircSize = 0.3;

                ctx.beginPath();
                ctx.shadowBlur = 15;
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.arc(canvas.width / 2, canvas.height * (arcDiameter + (1 - arcDiameter) / 2) - canvas.height * smallCircSize / 2, canvas.height * smallCircSize / 2, 0, Math.PI * 2);
                ctx.fillStyle = "#383838";
                ctx.fill();
                ctx.closePath();

                const tick = {
                    p1: {
                        x: 0,
                        y: 0.25
                    },
                    p2: {
                        x: 0.4,
                        y: 0
                    },
                    p3: {
                        x: 1,
                        y: 0.9
                    }
                };

                const yTickCircle = canvas.height * (arcDiameter + (1 - arcDiameter) / 2);

                function vpredrawQuad(main, coordinate) {
                    return main - tickQuad * canvas.height / 2 + coordinate * 0.8;
                }

                const tickQuad = smallCircSize - 0.1;

                ctx.beginPath();
                ctx.shadowBlur = 15;
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.moveTo(vpredrawQuad(canvas.width / 2, tick.p1.x * tickQuad * canvas.height + canvas.height * tickQuad / 8), vpredrawQuad(yTickCircle, tick.p1.y * tickQuad * canvas.height * -1 + canvas.height * tickQuad / 6));
                ctx.lineTo(vpredrawQuad(canvas.width / 2, tick.p2.x * tickQuad * canvas.height + canvas.height * tickQuad / 8), vpredrawQuad(yTickCircle, tick.p2.y * tickQuad * canvas.height * -1 + canvas.height * tickQuad / 6));
                ctx.lineTo(vpredrawQuad(canvas.width / 2, tick.p3.x * tickQuad * canvas.height + canvas.height * tickQuad / 8), vpredrawQuad(yTickCircle, tick.p3.y * tickQuad * canvas.height * -1 + canvas.height * tickQuad / 6));
                ctx.lineWidth = 5;
                ctx.strokeStyle = "#DDDDDD";
                ctx.stroke();
                ctx.closePath();

                return resolve(canvas.toBlob('image/png'));
            };

            image2.src = imgUrl2;
        };

        image1.src = imgUrl1;
    });
}