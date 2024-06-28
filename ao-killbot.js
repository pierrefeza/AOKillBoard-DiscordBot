/*
 * @Author: Mark Arneman
 * @Date:   2017-08-18 11:12:18
 * @Last Modified by:   Mark Arneman
 * @Last Modified time: 2019-06-11
 */

// Define static constants
const config = require('./config.json');

// Require modules
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

var lastRecordedKill = -1;

var playerNames = [];
for (var i = 0; i < config.players.length; i++) {
    playerNames.push(config.players[i].toLowerCase());
}

async function fetchKills(limit = 51, offset = 0) {
    try {
        const response = await axios.get(`https://gameinfo.albiononline.com/api/gameinfo/events?limit=${limit}&offset=${offset}`);
        parseKills(response.data);
    } catch (error) {
        console.error('Error fetching kills:', error);
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

async function generateCompositeImage(killerItem, victimItem) {
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const equipmentTypes = ['MainHand', 'OffHand', 'Head', 'Armor', 'Shoes', 'Cape', 'Bag', 'Mount', 'Potion', 'Food'];

    for (let i = 0; i < equipmentTypes.length; i++) {
        const type = equipmentTypes[i];

        if (killerItem[type]) {
            const killerImg = await loadImage(await downloadImage(getEquipmentImageUrl(killerItem[type])));
            ctx.drawImage(killerImg, 50, i * 50, 50, 50);
        }

        if (victimItem[type]) {
            const victimImg = await loadImage(await downloadImage(getEquipmentImageUrl(victimItem[type])));
            ctx.drawImage(victimImg, 150, i * 50, 50, 50);
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

    var victory = false;
    if (kill.Killer.AllianceName.toLowerCase() === config.allianceName.toLowerCase() ||
        kill.Killer.GuildName.toLowerCase() === config.guildName.toLowerCase() ||
        config.players.includes(kill.Killer.Name.toLowerCase())) {
        victory = true;
    }

    var killerItem = kill.Killer.Equipment;
    var victimItem = kill.Victim.Equipment;

    var killerDetails = `
**Name:** ${kill.Killer.Name}
**Guild:** ${kill.Killer.GuildName || 'None'}
**Alliance:** ${kill.Killer.AllianceName || 'None'}
**Item Power:** ${Math.round(kill.Killer.AverageItemPower)}
`;

    var victimDetails = `
**Name:** ${kill.Victim.Name}
**Guild:** ${kill.Victim.GuildName || 'None'}
**Alliance:** ${kill.Victim.AllianceName || 'None'}
**Item Power:** ${Math.round(kill.Victim.AverageItemPower)}
`;

    const filePath = await generateCompositeImage(killerItem, victimItem);

    var embed = {
        color: victory ? 0x008000 : 0x800000,
        author: {
            name: kill.Killer.Name + " killed " + kill.Victim.Name,
            icon_url: victory ? 'https://i.imgur.com/CeqX0CY.png' : 'https://albiononline.com/assets/images/killboard/kill__date.png',
            url: 'https://albiononline.com/en/killboard/kill/' + kill.EventId
        },
        title: "Kill Details",
        description: `**Fame:** ${dFormatter(kill.TotalVictimKillFame)}`,
        thumbnail: {
            url: getEquipmentImageUrl(killerItem.MainHand)
        },
        fields: [
            {
                name: "Killer",
                value: truncateText(killerDetails, 1024),
                inline: true
            },
            {
                name: "Victim",
                value: truncateText(victimDetails, 1024),
                inline: true
            }
        ],
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
        // Delete the temporary file after the message is sent
        fs.unlinkSync(filePath);
    }).catch(console.error);
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`Connected to the following servers:`);
    client.guilds.cache.forEach(guild => {
        console.log(` - ${guild.name}`);
    });

    // Check the bot channel
    const channel = client.channels.cache.get(config.botChannel);
    if (!channel) {
        console.error(`Bot channel with ID ${config.botChannel} not found!`);
    } else {
        console.log(`Bot will post in channel: ${channel.name}`);
    }

    // Set 'Playing Game' in discord
    client.user.setActivity(config.playingGame);

    fetchKills();

    // Fetch kills every 30s
    var timer = setInterval(function () {
        fetchKills();
    }, 30000);
});

client.on('messageCreate', message => {
    if (!message.content.startsWith(config.cmdPrefix) || message.author.bot) return;

    const args = message.content.slice(config.cmdPrefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    // Test Command - !ping
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
    }

    // [ADMIN] - clear config.botChannel messages
    else if (command === 'kbclear') {
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
