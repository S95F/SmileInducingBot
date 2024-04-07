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


async function removeBgFromImage(imagePath) {
    const data = JSON.stringify({
        image_file_b64: Buffer.from(await fs.promises.readFile(imagePath)).toString('base64'),
        size: 'auto'
    });

    const options = {
        hostname: 'api.remove.bg',
        path: '/v1.0/removebg',
        method: 'POST',
        headers: {
            'X-Api-Key': tokenRBG,
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let chunks = [];
            res.on('data', d => chunks.push(d));
            res.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                if (res.statusCode === 200) {
                    await fs.promises.writeFile(imagePath, buffer);
                    resolve();
                } else {
                    reject('Error removing background');
                }
            });
        });
        req.on('error', error => reject('Request error:', error));
        req.write(data);
        req.end();
    });
}

async function processImage(emojiName, imagePath, miniImagePath) {
    if (emojiName === '1f308') { //rainbow
        await minifyImage(imagePath, miniImagePath);
    } else if (emojiName === '730078728058568784') { //lsd
		const tempPath = imagePath + '.temp';
        await removeBgFromImage(imagePath);
        await sharp(imagePath).trim().toFile(tempPath);
        fs.renameSync(tempPath, imagePath);
        await minifyImage(imagePath, miniImagePath);
    }
    io.emit('image:new', { path: miniImagePath });
}

async function minifyImage(inputPath, outputPath) {
    await sharp(inputPath)
        .resize({ width: 300 })
        .toFile(outputPath);
}

client.login(token);
