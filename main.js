const Discord = require('discord.js');
const { Client, GatewayIntentBits } = require('discord.js');
const token = require('./discord.json').token;

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions] 
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const setupTasks = client.guilds.cache.map(async guild => {
        const generalChannel = await findGeneralChannel(guild);
        if (generalChannel) {
            await managePinnedMessage(generalChannel);
            return setupReactionCollector(generalChannel);
        }
    });
    await Promise.all(setupTasks).then(() => {
        console.log("All guilds have been set up.");
    }).catch(error => {
        console.error("An error occurred while setting up guilds:", error);
    });
});
async function findGeneralChannel(guild) {
    const generalChannel = guild.channels.cache.find(channel => channel.name === "general");
    if (!generalChannel) {
        console.error(`General channel not found in guild: ${guild.name}`);
        return null;
    }
    return generalChannel;
}
async function managePinnedMessage(channel) {
    const pinnedMessages = await channel.messages.fetchPinned();
    const botMessage = pinnedMessages.find(msg => msg.author.id === client.user.id);

    if (botMessage) {
        await botMessage.unpin();
        await botMessage.delete();
    }

    const newMessage = await channel.send('React to this message to get your roles!');
    await newMessage.pin();
}
async function setupReactionCollector(channel) {
    const message = await getLatestPinnedMessage(channel);
    const collector = message.createReactionCollector();
    collector.on('collect', async (reaction, user) => {
        if (user.bot) return;
		const guild = reaction.message.guild;
		const member = await guild.members.fetch(user.id).catch(err => {
			console.error(`Error fetching member: ${err}`);
			return null;
		});
		if (!member) return;
        let roleName = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
        let role = guild.roles.cache.find(r => r.name === roleName);
        const randomColor = Math.floor(Math.random() * 16777215).toString(16);
        if (!role) {
			try {
				role = await guild.roles.create({
					name: roleName,
					color: randomColor,
					reason: `we needed a role for ${roleName}`,
				});
			} catch (err) {
				console.error(`Error creating role: ${err}`);
				return;
			}
		}
        await member.roles.add(role);
        const memberRole = guild.roles.cache.find(r => r.name === 'member');
        if (memberRole && !member.roles.cache.has(memberRole.id)) {
            await member.roles.add(memberRole);
        }
    });

    collector.on('remove', async (reaction, user) => {
		if (user.bot) return;
		const guild = reaction.message.guild;
		const member = await guild.members.fetch(user.id).catch(err => {
			console.error(`Error fetching member: ${err}`);
			return null;
		});
		if (!member) return;
		console.log(reaction.emoji,member);
		let roleName = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
		const role = guild.roles.cache.find(r => r.name === roleName);
		if (role && member.roles.cache.has(role.id)) {
			console.log(`Attempting to remove role ${role.name} from user ${member.user.tag}`);
			try {
				await member.roles.remove(role);
				console.log(`Role ${role.name} removed from user ${member.user.tag}`);
			} catch (err) {
				console.error(`Error removing role: ${err}`);
			}
		}
	});
}

async function getLatestPinnedMessage(channel) {
    const pinnedMessages = await channel.messages.fetchPinned();
    return pinnedMessages.first();
}

client.login(token);
