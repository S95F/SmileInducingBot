const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const sharp = require('sharp');
const socketio = require('socket.io');
const https = require('https');

const token = require('./ignore/discord.json').token;
const tokenRBG = require('./ignore/removebg.js').token;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions]
});

const io = socketio();

io.on('connection', socket => {
    console.log('Socket connected:', socket.id);
});

client.on('ready', async () => {
	console.log('Bot is ready!');
});

client.on('messageReactionAdd', async (reaction, user) => {
    console.log(reaction,user);
    if (!reaction.message.guild) return;
    let member = reaction.message.guild.members.cache.get(user.id);
    if (!member.permissions.has("ADMINISTRATOR")) return;
	
    if (reaction.emoji.name === 'rainbow' || reaction.emoji.name === 'lsd') {
        const imageAttachment = reaction.message.attachments.find(attachment => attachment.url && (attachment.url.endsWith('.png') || attachment.url.endsWith('.jpg') || attachment.url.endsWith('.jpeg')));
        
        if (imageAttachment) {
            const imageUrl = imageAttachment.url;
            const imageName = imageAttachment.name;
            const imagePath = `./public/imglib/${imageName}`;
            const miniImagePath = `./public/mini/${imageName}`;

            https.get(imageUrl, (res) => {
                const path = fs.createWriteStream(imagePath);
                res.pipe(path);
                path.on('finish', () => {
                    path.close();
                    processImage(reaction.emoji.name, imagePath, miniImagePath);
                });
            }).on('error', (err) => {
                console.error('Image download error:', err);
            });
        }
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
    if (emojiName === 'rainbow') {
        await minifyImage(imagePath, miniImagePath);
    } else if (emojiName === 'lsd') {
        await removeBgFromImage(imagePath);
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
