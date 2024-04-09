const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const sharp = require('sharp');
const socketio = require('socket.io');
const https = require('https');
const token = require('./ignore/discord.json').token;
const tokenRBG = require('./ignore/removebg.js').token;

const client = new Client({
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    intents: [
		GatewayIntentBits.GuildMessageReactions, 
		GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent]
});



const io = socketio();

io.on('connection', socket => {
    console.log('Socket connected:', socket.id);
});

client.on('ready', async () => {
	console.log('Bot is ready!');
});

client.on('messageReactionAdd', async (reaction, user) => {
	if (!reaction.emoji.id) {
		reaction.emoji.id = reaction.emoji.toString().codePointAt(0).toString(16);
	}
	if (reaction.message.partial) await reaction.message.fetch();
    if (!reaction.message.guild) return;
    let member = reaction.message.guild.members.cache.get(user.id);
    if (!member.permissions.has("ADMINISTRATOR")) return;
    
	let messageToInspect = reaction.message;


    let imageUrl, imageName, image;

	image = reaction.message.attachments.map(attachment => attachment.toJSON())[0];
	imageUrl = image.attachment;
	imageName = image.name;
	
    if (imageUrl) {
        const imagePath = `./public/imglib/${imageName}`;
        const miniImagePath = `./public/mini/${imageName}`;

        https.get(imageUrl, (res) => {
            const path = fs.createWriteStream(imagePath);
            res.pipe(path);
            path.on('finish', () => {
                path.close();
                processImage(reaction.emoji.id, imagePath, miniImagePath);
            });
        }).on('error', (err) => {
            console.error('Image download error:', err);
        });
    } else {
        console.log('No image found in the message.');
    }
});


//async function removeBgFromImage(imagePath) {
    //try {
        //// Load the pre-trained DeepLab model
        //const model = await deeplab.load();

        //// Load the image
        //const image = new Image();
        //image.src = fs.readFileSync(imagePath);
        //const inputCanvas = createCanvas(image.width, image.height);
        //const ctx = inputCanvas.getContext('2d');
        //ctx.drawImage(image, 0, 0);

        //// Perform segmentation
        //const predictions = await model.segment(inputCanvas);

        //// Convert segmentation into a mask
        //const outputCanvas = createCanvas(image.width, image.height);
        //const outputCtx = outputCanvas.getContext('2d');
        //const imageData = outputCtx.createImageData(image.width, image.height);
        //const data = imageData.data;

        //for (let i = 0; i < data.length; i += 4) {
            //if (predictions.data[i / 4] === 0) { // Check if the pixel is background
                //data[i] = 0;     // Set red channel to 0
                //data[i + 1] = 0; // Set green channel to 0
                //data[i + 2] = 0; // Set blue channel to 0
                //data[i + 3] = 0; // Set alpha channel to 0 (transparent)
            //} else {
                //data[i + 3] = 255; // Set alpha channel to 255 (opaque)
            //}
        //}
        //outputCtx.putImageData(imageData, 0, 0);

        //// Save the output image
        //const outputPath = './processedImage.png';
        //const outStream = fs.createWriteStream(outputPath);
        //const stream = outputCanvas.createPNGStream();
        //stream.pipe(outStream);
        //await new Promise(resolve => outStream.on('finish', resolve));

        //console.log('Background removal completed.');
        //return outputPath;
    //} catch (error) {
        //console.error('Error in removing background:', error);
    //}
}
async function processImage(emojiName, imagePath, miniImagePath) {
    if (emojiName === '1f308') { // Rainbow emoji
        await minifyImage(imagePath, miniImagePath);
    } else if (emojiName === '730078728058568784') { // LSD emoji
        await removeBgFromImage(imagePath);

        const imageWithAlpha = sharp(imagePath);
        const metadata = await imageWithAlpha.metadata();

        if (metadata.channels === 4) {
            const alphaChannel = await imageWithAlpha.extractChannel(3).toBuffer();
			let invertedAlphaChannel = Buffer.from(alphaChannel).map(value => 255 - value);

			// Create an image from the original and apply the inverted alpha channel as a mask
			const imageBuffer = await sharp(imagePath).raw().toBuffer();
			const maskedImageBuffer = Buffer.concat([imageBuffer.slice(0, metadata.width * metadata.height * 3), invertedAlphaChannel]);

			// Create a new image using the masked buffer
			await sharp(maskedImageBuffer, {
				raw: {
					width: metadata.width,
					height: metadata.height,
					channels: 4
				}
			})
			.png()
			.toFile(imagePath);
        }

        await minifyImage(imagePath, miniImagePath);
    }
    io.emit('image:new', { path: miniImagePath });
}


async function minifyImage(inputPath, outputPath) {
    // Determine the minified size while maintaining aspect ratio
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    const scaleFactor = 300 / Math.max(metadata.width, metadata.height);
    const minifiedWidth = Math.round(metadata.width * scaleFactor);
    const minifiedHeight = Math.round(metadata.height * scaleFactor);

    await sharp(inputPath)
        .resize(minifiedWidth, minifiedHeight) // Resize with new dimensions
        .toFile(outputPath);
}

client.login(token);
