const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const sharp = require('sharp');
const socketio = require('socket.io');
const https = require('https');
const token = require('./ignore/discord.json').token;
const tokenRBG = require('./ignore/removebg.js').token;

const { removeBackgroundFromImage } = require('./helpers/removebg');



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



async function processImage(emojiName, imagePath, miniImagePath) {
    if (emojiName === '1f308') { // Rainbow emoji
        await minifyImage(imagePath, miniImagePath);
    } else if (emojiName === '730078728058568784') { // LSD emoji
        const canvas = await removeBackgroundFromImage(imagePath);
        
        // Convert canvas to PNG buffer
        const imageBuffer = canvas.toBuffer();

        // Process the image buffer with Sharp.js
        const imageWithAlpha = sharp(imageBuffer);
        const metadata = await imageWithAlpha.metadata();

        if (metadata.channels === 4) {
            const alphaChannel = await imageWithAlpha.extractChannel(3).toBuffer();
            let invertedAlphaChannel = Buffer.from(alphaChannel).map(value => 255 - value);

            // Combine RGB channels from the original with the inverted alpha channel
            const rgbBuffer = await sharp(imageBuffer).extractChannel(0).raw().toBuffer();
            const maskedImageBuffer = Buffer.concat([rgbBuffer, invertedAlphaChannel]);

            // Save the final image
            await sharp(maskedImageBuffer, {
                raw: {
                    width: metadata.width,
                    height: metadata.height,
                    channels: 4
                }
            })
            .toFile(imagePath);
        }

        // Continue with minification
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
