const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

var lastRecordedKill = -1;
var playerNames = config.players.map(player => player.toLowerCase());

async function fetchKills(limit = 51, offset = 0, retries = 3) {
    try {
        const response = await axios.get(`https://gameinfo.albiononline.com/api/gameinfo/events?limit=${limit}&offset=${offset}`);
        parseKills(response.data);
    } catch (error) {
        console.error('Error fetching kills:', error);
        if (retries > 0) {
            console.log(`Retrying... (${retries} attempts left)`);
            setTimeout(() => fetchKills(limit, offset, retries - 1), 5000);
        }
    }
}

function parseKills(events) {
    var count = 0;
    var breaker = lastRecordedKill;

    events.some(function (kill, index) {
        if (index === 0) {
            lastRecordedKill = kill.EventId;
        }

        if (kill.EventId !== breaker) {
            if (kill.Killer.AllianceName.toLowerCase() === config.allianceName.toLowerCase() || kill.Victim.AllianceName.toLowerCase() === config.allianceName.toLowerCase()) {
                postKill(kill);
            } else if (kill.Killer.GuildName.toLowerCase() === config.guildName.toLowerCase() || kill.Victim.GuildName.toLowerCase() === config.guildName.toLowerCase()) {
                postKill(kill);
            } else if (playerNames.includes(kill.Killer.Name.toLowerCase()) || playerNames.includes(kill.Victim.Name.toLowerCase())) {
                postKill(kill);
            }
        } else {
            count++;
        }

        return kill.EventId === breaker;
    });
}

function getEquipmentImageUrl(equipment) {
    return equipment && equipment.Type ? `https://render.albiononline.com/v1/item/${equipment.Type}.png` : 'https://albiononline.com/assets/images/killboard/kill__date.png';
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

async function downloadImage(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
}

async function generateCompositeImage(kill) {
    const canvas = createCanvas(1200, 800);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const killer = kill.Killer;
    const victim = kill.Victim;

    // Alliance and Guild Names
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial'; // half the size of the player name
    ctx.textAlign = 'center';
    ctx.fillText(`[${killer.AllianceName}] ${killer.GuildName}`, 250, 30);
    ctx.fillText(new Date(kill.TimeStamp).toLocaleString(), 600, 30);
    ctx.fillText(`[${victim.AllianceName}] ${victim.GuildName}`, 950, 30);

    // Player Names
    ctx.font = '36px Arial'; // 20% bigger than the IP section
    ctx.fillText(killer.Name, 250, 70);
    ctx.fillText(`Fame: ${dFormatter(kill.TotalVictimKillFame)}`, 600, 70);
    ctx.fillText(victim.Name, 950, 70);

    // IP Section
    ctx.font = '24px Arial';
    ctx.fillText(`IP: ${Math.round(killer.AverageItemPower)}`, 250, 100);
    ctx.fillText(`IP: ${Math.round(victim.AverageItemPower)}`, 950, 100);

    const equipmentTypes = ['Bag', 'Head', 'Cape', 'MainHand', 'Armor', 'OffHand', 'Potion', 'Shoes', 'Food', 'Mount'];
    const gridWidth = 0.42 * canvas.width;
    const iconSize = (gridWidth / 3) * 0.95;

    const positions = [
        { x: 5, y: 125 }, { x: 5 + iconSize, y: 125 }, { x: 5 + 2 * iconSize, y: 125 },
        { x: 5, y: 125 + iconSize }, { x: 5 + iconSize, y: 125 + iconSize }, { x: 5 + 2 * iconSize, y: 125 + iconSize },
        { x: 5, y: 125 + 2 * iconSize }, { x: 5 + iconSize, y: 125 + 2 * iconSize }, { x: 5 + 2 * iconSize, y: 125 + 2 * iconSize },
        { x: 5 + iconSize, y: 125 + 3 * iconSize }
    ];
    const victimPositions = positions.map(pos => ({ x: canvas.width - 5 - iconSize * (3 - pos.x / iconSize), y: pos.y }));

    for (let i = 0; i < equipmentTypes.length; i++) {
        const type = equipmentTypes[i];

        if (killer.Equipment[type]) {
            const killerImg = await loadImage(await downloadImage(getEquipmentImageUrl(killer.Equipment[type])));
            ctx.drawImage(killerImg, positions[i].x, positions[i].y, iconSize, iconSize);
        }

        if (victim.Equipment[type]) {
            const victimImg = await loadImage(await downloadImage(getEquipmentImageUrl(victim.Equipment[type])));
            ctx.drawImage(victimImg, victimPositions[i].x, victimPositions[i].y, iconSize, iconSize);
        }
    }

    const filePath = path.join(__dirname, `kill-${Date.now()}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);

    return filePath;
}

async function postKill(kill, channel = config.botChannel) {
    if (kill.TotalVictimKillFame === 0) {
        return;
    }

    const filePath = await generateCompositeImage(kill);

    var embed = {
        color: 0x008000,
        author: {
            name: kill.Killer.Name + " killed " + kill.Victim.Name,
            icon_url: 'https://albiononline.com/assets/images/killboard/kill__date.png',
            url: 'https://albiononline.com/en/killboard/kill/' + kill.EventId
        },
        title: "Kill Details",
        description: `**Fame:** ${dFormatter(kill.TotalVictimKillFame)}`,
        image: {
            url: 'attachment://kill.png'
        },
        timestamp: new Date(kill.TimeStamp).toISOString(),
        footer: {
            text: "Kill #" + kill.EventId
        }
    };

    const discordChannel = client.channels.cache.get(channel);
    if (!discordChannel) {
        console.error(`Channel ID ${channel} not found in cache.`);
        return;
    }

    discordChannel.send({ embeds: [embed], files: [{ attachment: filePath, name: 'kill.png' }] }).then(() => {
        fs.unlinkSync(filePath);
    }).catch(console.error);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Connected to the following servers:`);
    client.guilds.cache.forEach(guild => {
        console.log(` - ${guild.name}`);
    });

    const channel = client.channels.cache.get(config.botChannel);
    if (!channel) {
        console.error(`Bot channel with ID ${config.botChannel} not found!`);
    } else {
        console.log(`Bot will post in channel: ${channel.name}`);
    }

    client.user.setActivity(config.playingGame);

    fetchKills();

    var timer = setInterval(function () {
        fetchKills();
    }, 30000);
});

client.on('messageCreate', message => {
    if (!message.content.startsWith(config.cmdPrefix) || message.author.bot) return;

    const args = message.content.slice(config.cmdPrefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        message.reply('pong');
    } else if (command === 'kbinfo') {
        axios.get(`https://gameinfo.albiononline.com/api/gameinfo/events/${args[0]}`)
            .then(response => {
                postKill(response.data, message.channel.id);
            })
            .catch(error => {
                console.error('Error fetching event info:', error);
            });
    } else if (command === 'kbclear') {
        if (config.admins.includes(message.author.id) && message.channel.id === config.botChannel) {
            message.channel.send('Clearing Killboard').then(msg => {
                message.channel.messages.fetch().then(messages => {
                    message.channel.bulkDelete(messages);
                    console.log(`[ADMIN] ${message.author.username} cleared Killboard`);
                });
            });
        }
    }
});

client.login(config.token);

function dFormatter(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") || 0;
}
