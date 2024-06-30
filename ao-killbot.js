const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

var lastRecordedKill = -1;
var playerNames = config.players.map((player) => player.toLowerCase());

async function fetchKills(limit = 51, offset = 0, retries = 3) {
  try {
    const response = await axios.get(
      `https://gameinfo.albiononline.com/api/gameinfo/events?limit=${limit}&offset=${offset}`
    );
    console.log(`Fetched ${response.data.length} kills`);
    parseKills(response.data);
  } catch (error) {
    console.error("Error fetching kills:", error.message);
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts left)`);
      setTimeout(() => fetchKills(limit, offset, retries - 1), 5000);
    } else {
      console.error("All retries failed");
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
      // Log only when specific conditions are met
      if (
        kill.Killer.AllianceName.toLowerCase() ===
          config.allianceName.toLowerCase() ||
        kill.Victim.AllianceName.toLowerCase() ===
          config.allianceName.toLowerCase()
      ) {
        console.log(`Posting kill due to alliance match: ${kill.EventId}`);
        postKill(kill);
      } else if (
        kill.Killer.GuildName.toLowerCase() ===
          config.guildName.toLowerCase() ||
        kill.Victim.GuildName.toLowerCase() === config.guildName.toLowerCase()
      ) {
        console.log(`Posting kill due to guild match: ${kill.EventId}`);
        postKill(kill);
      } else if (
        playerNames.includes(kill.Killer.Name.toLowerCase()) ||
        playerNames.includes(kill.Victim.Name.toLowerCase())
      ) {
        console.log(`Posting kill due to player name match: ${kill.EventId}`);
        postKill(kill);
      }
    } else {
      count++;
    }

    return kill.EventId === breaker;
  });

  console.log(
    `Parsed ${events.length} kills, skipped ${count} already recorded kills`
  );
}

function getEquipmentImageUrl(equipment) {
  return equipment && equipment.Type
    ? `https://render.albiononline.com/v1/item/${equipment.Type}.png?count=${equipment.Count}&quality=${equipment.Quality}`
    : "https://albiononline.com/assets/images/killboard/kill__date.png";
}

function truncateText(text, maxLength) {
  return text.length > maxLength
    ? text.substring(0, maxLength - 3) + "..."
    : text;
}

async function downloadImage(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Image not found for URL: ${url}`);
      return null; // Return null if the image is not found
    } else {
      throw error; // Rethrow the error if it's not a 404
    }
  }
}

async function generateCompositeImage(kill) {
  const canvas = createCanvas(1200, 800);
  const ctx = canvas.getContext("2d");

  // Load and draw the background image with opacity
  const backgroundImage = await loadImage(
    await downloadImage("https://i.imgur.com/Cf4Ysrv.jpg")
  );
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  // Apply the darkness
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const killer = kill.Killer;
  const victim = kill.Victim;

  // Alliance and Guild Names
  ctx.fillStyle = "#FFF";
  ctx.font = "24px Arial"; // half the size of the player name
  ctx.textAlign = "center";
  ctx.fillText(`[${killer.AllianceName}] ${killer.GuildName}`, 250, 30);
  ctx.fillText(`[${victim.AllianceName}] ${victim.GuildName}`, 950, 30);

  // Timestamp Icon and Timestamp
  const timestampIcon = await loadImage(
    await downloadImage(
      "https://render.albiononline.com/v1/spell/SUMMONER_CD_REDUCTION.png"
    )
  );
  const timestampIconSize = 70;
  ctx.font = "16px Arial";
  ctx.drawImage(timestampIcon, 565, 20, timestampIconSize, timestampIconSize);
  ctx.fillText(new Date(kill.TimeStamp).toLocaleString(), 600, 105);

  // Participants Icon and Count
  if (kill.Participants.length > 1) {
    const participantsIcon = await loadImage(
      await downloadImage(
        "https://cdn.albiononline2d.com/game-images/INFO_ICON_PARTYFINDER.png"
      )
    );
    const participantsIconSize = 70;
    const participantsY = 200; // Position it below the timestamp with a 10px gap
    ctx.drawImage(
      participantsIcon,
      565,
      participantsY,
      participantsIconSize,
      participantsIconSize
    );
    ctx.font = "24px Arial";
    ctx.fillText(
      `${kill.Participants.length}`,
      600,
      participantsY + participantsIconSize + 20
    );
  }

  // Fame Icon and Fame Text
  const fameIcon = await loadImage(
    await downloadImage("https://i.imgur.com/geal9ri.png")
  );
  const fameIconSize = 50;
  const fameY = canvas.height / 2 - 15; // Center of the image
  ctx.drawImage(
    fameIcon,
    570,
    fameY - fameIconSize - 5,
    fameIconSize,
    fameIconSize
  ); // Position the icon above the text
  ctx.font = "24px Arial";
  ctx.fillText(`${dFormatter(kill.TotalVictimKillFame)}`, 600, fameY + 20);

  // Player Names
  ctx.font = "36px Arial"; // 20% bigger than the IP section
  ctx.fillText(killer.Name, 250, 70);
  ctx.fillText(victim.Name, 950, 70);

  // IP Section
  ctx.font = "24px Arial";
  ctx.fillText(`IP: ${Math.round(killer.AverageItemPower)}`, 250, 100);
  ctx.fillText(`IP: ${Math.round(victim.AverageItemPower)}`, 950, 100);

  const equipmentTypes = [
    "Bag",
    "Head",
    "Cape",
    "MainHand",
    "Armor",
    "OffHand",
    "Potion",
    "Shoes",
    "Food",
    "Mount",
  ];
  const gridWidth = 0.42 * canvas.width;
  const iconSize = (gridWidth / 3) * 0.85;

  const positions = [
    { x: 45, y: 125 },
    { x: 45 + iconSize, y: 125 },
    { x: 45 + 2 * iconSize, y: 125 },
    { x: 45, y: 125 + iconSize },
    { x: 45 + iconSize, y: 125 + iconSize },
    { x: 45 + 2 * iconSize, y: 125 + iconSize },
    { x: 45, y: 125 + 2 * iconSize },
    { x: 45 + iconSize, y: 125 + 2 * iconSize },
    { x: 45 + 2 * iconSize, y: 125 + 2 * iconSize },
    { x: 45 + iconSize, y: 125 + 3 * iconSize },
  ];
  const victimPositions = positions.map((pos) => ({
    x: canvas.width - 75 - iconSize * (3 - pos.x / iconSize),
    y: pos.y,
  }));

  for (let i = 0; i < equipmentTypes.length; i++) {
    const type = equipmentTypes[i];

    if (killer.Equipment[type]) {
      const killerImg = await loadImage(
        await downloadImage(getEquipmentImageUrl(killer.Equipment[type]))
      );
      ctx.drawImage(
        killerImg,
        positions[i].x,
        positions[i].y,
        iconSize,
        iconSize
      );
      if (killer.Equipment[type].Count >= 1) {
        ctx.fillStyle = "#FFF";
        ctx.font = "16px Arial";
        ctx.textAlign = "right";
        ctx.fillText(
          killer.Equipment[type].Count,
          positions[i].x + iconSize - 28,
          positions[i].y + iconSize - 30
        );
      }
    }

    if (victim.Equipment[type]) {
      const victimImg = await loadImage(
        await downloadImage(getEquipmentImageUrl(victim.Equipment[type]))
      );
      ctx.drawImage(
        victimImg,
        victimPositions[i].x,
        victimPositions[i].y,
        iconSize,
        iconSize
      );
      if (victim.Equipment[type].Count >= 1) {
        ctx.fillStyle = "#FFF";
        ctx.font = "16px Arial";
        ctx.textAlign = "right";
        ctx.fillText(
          victim.Equipment[type].Count,
          victimPositions[i].x + iconSize - 28,
          victimPositions[i].y + iconSize - 30
        );
      }
    }
  }

  // Draw Damage Bar
  const totalDamage = kill.Participants.reduce(
    (sum, participant) => sum + participant.DamageDone,
    0
  );
  const barWidth = canvas.width - 60; // Leave 10px space on each side
  const barHeight = 40; // Double the height
  const barX = 30; // 10px from the left edge
  const barY = positions[positions.length - 1].y + iconSize + 10;
  let currentX = barX;

  ctx.lineCap = "round"; // Rounded ends
  ctx.font = "16px Arial";
  ctx.textAlign = "center";

  const participantColors = {};

  for (const participant of kill.Participants) {
    if (participant.DamageDone === 0) continue;

    const damagePercentage = participant.DamageDone / totalDamage;
    const participantWidth = barWidth * damagePercentage;

    const color = getRandomColor();
    participantColors[participant.Name] = color;

    // Draw the rounded rect bar
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(currentX + 10, barY); // 10 is the radius of the rounded corners
    ctx.lineTo(currentX + participantWidth - 10, barY);
    ctx.quadraticCurveTo(
      currentX + participantWidth,
      barY,
      currentX + participantWidth,
      barY + 10
    );
    ctx.lineTo(currentX + participantWidth, barY + barHeight - 10);
    ctx.quadraticCurveTo(
      currentX + participantWidth,
      barY + barHeight,
      currentX + participantWidth - 10,
      barY + barHeight
    );
    ctx.lineTo(currentX + 10, barY + barHeight);
    ctx.quadraticCurveTo(
      currentX,
      barY + barHeight,
      currentX,
      barY + barHeight - 10
    );
    ctx.lineTo(currentX, barY + 10);
    ctx.quadraticCurveTo(currentX, barY, currentX + 10, barY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#FFF";
    ctx.fillText(
      `${Math.round(damagePercentage * 100)}%`,
      currentX + participantWidth / 2,
      barY + barHeight / 1.5
    );

    currentX += participantWidth;
  }

  // Draw Player Damage Text and Colored Boxes
  let textX = barX;
  const textY = barY + barHeight + 25;
  const boxSize = 15;
  const textPadding = 5;

  for (const participant of kill.Participants) {
    if (participant.DamageDone === 0) continue;

    const damageText = `${participant.Name} [${Math.round(
      participant.DamageDone
    )}]`;
    const textWidth = ctx.measureText(damageText).width;

    ctx.fillStyle = participantColors[participant.Name];
    ctx.fillRect(textX, textY - boxSize, boxSize, boxSize);

    ctx.fillStyle = "#FFF";
    ctx.textAlign = "left";
    ctx.fillText(damageText, textX + boxSize + textPadding, textY);

    textX += boxSize + textWidth + textPadding * 2;
  }

  const filePath = path.join(__dirname, `kill-${Date.now()}.png`);
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

async function generateInventoryImage(victim) {
  const iconSize = 100; // Adjust size as needed
  const padding = 5; // Padding between items
  const marginLeft = 10; // Left margin
  const marginTop = 10; // Top margin

  // Filter out null items
  const inventoryItems = victim.Inventory.filter((item) => item !== null);

  if (inventoryItems.length === 0) {
    return null; // No items to display
  }

  // Calculate the number of items per row based on canvas width
  const itemsPerRow = Math.floor(
    (1200 - 2 * marginLeft + padding) / (iconSize + padding)
  );
  const rows = Math.ceil(inventoryItems.length / itemsPerRow);

  // Adjust canvas height based on the number of rows
  const canvas = createCanvas(
    1200,
    rows * (iconSize + padding) + 2 * marginTop
  );
  const ctx = canvas.getContext("2d");

  const backgroundImage = await loadImage(
    await downloadImage("https://i.imgur.com/Cf4Ysrv.jpg")
  );
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  // Apply the darkness
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let currentX = marginLeft;
  let currentY = marginTop;

  for (let i = 0; i < inventoryItems.length; i++) {
    const item = inventoryItems[i];
    const itemImg = await loadImage(
      await downloadImage(getEquipmentImageUrl(item))
    );
    if (itemImg) {
      ctx.drawImage(itemImg, currentX, currentY, iconSize, iconSize);
    }
    // Display item count
    if (item.Count && item.Count > 0) {
      ctx.fillStyle = "#FFF";
      ctx.font = "20px Arial";
      ctx.fillText(
        item.Count,
        currentX + iconSize - 28,
        currentY + iconSize - 18
      );
    }

    currentX += iconSize + padding;
    if ((i + 1) % itemsPerRow === 0) {
      currentX = marginLeft;
      currentY += iconSize + padding;
    }
  }

  const filePath = path.join(__dirname, `inventory-${Date.now()}.png`);
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

async function postKill(kill, channel = config.botChannel) {
  if (kill.TotalVictimKillFame === 0) {
    return;
  }
  console.log(`Posting kill: ${kill.EventId}`);

  // Determine the color for the event
  let eventColor = 0x008000; // Default green color
  if (
    kill.Victim.AllianceName.toLowerCase() ===
      config.allianceName.toLowerCase() ||
    kill.Victim.GuildName.toLowerCase() === config.guildName.toLowerCase() ||
    playerNames.includes(kill.Victim.Name.toLowerCase())
  ) {
    eventColor = 0x880808; // Red color
  }

  let inventoryPath = null;
  const filePath = await generateCompositeImage(kill);
  if (kill.Victim.Inventory.some((item) => item !== null)) {
    inventoryPath = await generateInventoryImage(kill.Victim);
  }

  // Create and send kill embed
  const embed = {
    color: eventColor,
    author: {
      name: kill.Killer.Name + " killed " + kill.Victim.Name,
      url: "https://albiononline.com/killboard/kill/" + kill.EventId,
    },
    image: {
      url: "attachment://kill.png",
    },
    timestamp: new Date(kill.TimeStamp).toISOString(),
    footer: {
      text: "Kill #" + kill.EventId,
    },
  };

  const discordChannel = client.channels.cache.get(channel);
  if (!discordChannel) {
    console.error(`Channel ID ${channel} not found in cache.`);
    return;
  }

  // Send the kill image first
  discordChannel
    .send({
      embeds: [embed],
      files: [{ attachment: filePath, name: "kill.png" }],
    })
    .then(() => {
      fs.unlinkSync(filePath);
      // If there's an inventory image, send it next
      if (inventoryPath !== null) {
        const inventoryEmbed = {
          color: eventColor,
          image: {
            url: "attachment://inventory.png",
          },
        };

        discordChannel
          .send({
            embeds: [inventoryEmbed],
            files: [{ attachment: inventoryPath, name: "inventory.png" }],
          })
          .then(() => {
            fs.unlinkSync(inventoryPath);
          })
          .catch(console.error);
      }
    })
    .catch(console.error);
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Connected to the following servers:`);
  client.guilds.cache.forEach((guild) => {
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
  }, 20000);
});

client.on("messageCreate", (message) => {
  if (!message.content.startsWith(config.cmdPrefix) || message.author.bot)
    return;

  const args = message.content
    .slice(config.cmdPrefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.reply("pong");
  } else if (command === "kbinfo") {
    axios
      .get(`https://gameinfo.albiononline.com/api/gameinfo/events/${args[0]}`)
      .then((response) => {
        postKill(response.data, message.channel.id);
      })
      .catch((error) => {
        console.error("Error fetching event info:", error);
      });
  } else if (command === "kbclear") {
    if (
      config.admins.includes(message.author.id) &&
      message.channel.id === config.botChannel
    ) {
      message.channel.send("Clearing Killboard").then((msg) => {
        message.channel.messages.fetch().then((messages) => {
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

function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
