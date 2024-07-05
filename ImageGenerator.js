const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

class ImageGenerator {

  formatGuildName(allianceName, guildName) {
    return allianceName ? `[${allianceName}] ${guildName}` : guildName;
  }
  
  async generateCompositeImage(kill) {
    const canvas = createCanvas(1200, 800);
    const ctx = canvas.getContext("2d");

    const backgroundImage = await loadImage(await this.downloadImage("https://i.imgur.com/Cf4Ysrv.jpg"));
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const killer = kill.Killer;
    const victim = kill.Victim;

    ctx.fillStyle = "#FFF";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(this.formatGuildName(killer.AllianceName, killer.GuildName), 250, 30);
    ctx.fillText(this.formatGuildName(victim.AllianceName, victim.GuildName), 950, 30);

    const timestampIcon = await loadImage(await this.downloadImage("https://render.albiononline.com/v1/spell/SUMMONER_CD_REDUCTION.png"));
    const timestampIconSize = 70;
    ctx.font = "16px Arial";
    ctx.drawImage(timestampIcon, 565, 20, timestampIconSize, timestampIconSize);
    ctx.fillText(new Date(kill.TimeStamp).toLocaleString(), 600, 105);

    if (kill.Participants.length > 1) {
      const participantsIcon = await loadImage(await this.downloadImage("https://cdn.albiononline2d.com/game-images/INFO_ICON_PARTYFINDER.png"));
      const participantsIconSize = 70;
      const participantsY = 200;
      ctx.drawImage(participantsIcon, 565, participantsY, participantsIconSize, participantsIconSize);
      ctx.font = "24px Arial";
      ctx.fillText(`${kill.Participants.length}`, 600, participantsY + participantsIconSize + 20);
    }

    const fameIcon = await loadImage(await this.downloadImage("https://i.imgur.com/geal9ri.png"));
    const fameIconSize = 50;
    const fameY = canvas.height / 2 - 15;
    ctx.drawImage(fameIcon, 570, fameY - fameIconSize - 5, fameIconSize, fameIconSize);
    ctx.font = "24px Arial";
    ctx.fillText(`${this.dFormatter(kill.TotalVictimKillFame)}`, 600, fameY + 20);

    // Add group icon if applicable
    if (kill.GroupMembers.length > 1 && kill.GroupMembers.length != kill.Participants.length) {
      const groupIcon = await loadImage(await this.downloadImage("https://i.imgur.com/josec2F.png"));
      const groupIconSize = 50;
      const groupY = fameY + 110; 
      ctx.drawImage(groupIcon, 570, groupY - groupIconSize + 30, groupIconSize, groupIconSize);
      ctx.font = "24px Arial";
      ctx.fillText(`${this.dFormatter(kill.GroupMembers.length)}`, 600, groupY + 50);
    }

    ctx.font = "36px Arial";
    ctx.fillText(killer.Name, 250, 70);
    ctx.fillText(victim.Name, 950, 70);

    ctx.font = "24px Arial";
    ctx.fillText(`IP: ${Math.round(killer.AverageItemPower)}`, 250, 100);
    ctx.fillText(`IP: ${Math.round(victim.AverageItemPower)}`, 950, 100);

    const equipmentTypes = ["Bag", "Head", "Cape", "MainHand", "Armor", "OffHand", "Potion", "Shoes", "Food", "Mount"];
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
        const killerImg = await loadImage(await this.downloadImage(this.getEquipmentImageUrl(killer.Equipment[type])));
        ctx.drawImage(killerImg, positions[i].x, positions[i].y, iconSize, iconSize);
        if (killer.Equipment[type].Count >= 1) {
          ctx.fillStyle = "#FFF";
          ctx.font = "16px Arial";
          ctx.textAlign = "right";
          ctx.fillText(killer.Equipment[type].Count, positions[i].x + iconSize - 28, positions[i].y + iconSize - 30);
        }
      }

      if (victim.Equipment[type]) {
        const victimImg = await loadImage(await this.downloadImage(this.getEquipmentImageUrl(victim.Equipment[type])));
        ctx.drawImage(victimImg, victimPositions[i].x, victimPositions[i].y, iconSize, iconSize);
        if (victim.Equipment[type].Count >= 1) {
          ctx.fillStyle = "#FFF";
          ctx.font = "16px Arial";
          ctx.textAlign = "right";
          ctx.fillText(victim.Equipment[type].Count, victimPositions[i].x + iconSize - 28, victimPositions[i].y + iconSize - 30);
        }
      }
    }

    const totalDamage = kill.Participants.reduce((sum, participant) => sum + participant.DamageDone, 0);
    const barWidth = canvas.width - 60;
    const barHeight = 40;
    const barX = 30;
    const barY = positions[positions.length - 1].y + iconSize + 10;
    let currentX = barX;

    ctx.lineCap = "round";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";

    const participantColors = {};

    for (const participant of kill.Participants) {
      if (participant.DamageDone === 0) continue;

      const damagePercentage = participant.DamageDone / totalDamage;
      const participantWidth = barWidth * damagePercentage;

      const color = this.getRandomColor();
      participantColors[participant.Name] = color;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(currentX + 10, barY);
      ctx.lineTo(currentX + participantWidth - 10, barY);
      ctx.quadraticCurveTo(currentX + participantWidth, barY, currentX + participantWidth, barY + 10);
      ctx.lineTo(currentX + participantWidth, barY + barHeight - 10);
      ctx.quadraticCurveTo(currentX + participantWidth, barY + barHeight, currentX + participantWidth - 10, barY + barHeight);
      ctx.lineTo(currentX + 10, barY + barHeight);
      ctx.quadraticCurveTo(currentX, barY + barHeight, currentX, barY + barHeight - 10);
      ctx.lineTo(currentX, barY + 10);
      ctx.quadraticCurveTo(currentX, barY, currentX + 10, barY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#FFF";
      ctx.fillText(`${Math.round(damagePercentage * 100)}%`, currentX + participantWidth / 2, barY + barHeight / 1.5);

      currentX += participantWidth;
    }

    let textX = barX;
    const textY = barY + barHeight + 25;
    const boxSize = 15;
    const textPadding = 5;

    for (const participant of kill.Participants) {
      if (participant.DamageDone === 0) continue;

      const damageText = `${participant.Name} [${Math.round(participant.DamageDone)}]`;
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

  async generateInventoryImage(victim) {
    const iconSize = 100;
    const padding = 5;
    const marginLeft = 10;
    const marginTop = 10;

    const inventoryItems = victim.Inventory.filter((item) => item !== null);

    if (inventoryItems.length === 0) {
      return null;
    }

    const itemsPerRow = Math.floor((1200 - 2 * marginLeft + padding) / (iconSize + padding));
    const rows = Math.ceil(inventoryItems.length / itemsPerRow);

    const canvas = createCanvas(1200, rows * (iconSize + padding) + 2 * marginTop);
    const ctx = canvas.getContext("2d");

    const backgroundImage = await loadImage(await this.downloadImage("https://i.imgur.com/Cf4Ysrv.jpg"));
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentX = marginLeft;
    let currentY = marginTop;

    for (let i = 0; i < inventoryItems.length; i++) {
      const item = inventoryItems[i];
      const itemImg = await loadImage(await this.downloadImage(this.getEquipmentImageUrl(item)));
      if (itemImg) {
        ctx.drawImage(itemImg, currentX, currentY, iconSize, iconSize);
      }
      if (item.Count && item.Count > 0) {
        ctx.fillStyle = "#FFF";
        ctx.font = "20px Arial";
        ctx.fillText(item.Count, currentX + iconSize - 28, currentY + iconSize - 18);
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

  async downloadImage(url) {
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.error(`Image not found for URL: ${url}`);
        const placeholderUrl = "https://i.imgur.com/LT0WPSw.jpeg";
        console.error(`Using placeholder image instead: ${placeholderUrl}`);
        const placeholderResponse = await axios.get(placeholderUrl, { responseType: "arraybuffer" });
        return placeholderResponse.data;
      } else {
        throw error;
      }
    }
  }

  getEquipmentImageUrl(equipment) {
    return equipment && equipment.Type
      ? `https://render.albiononline.com/v1/item/${equipment.Type}.png?count=${equipment.Count}&quality=${equipment.Quality}`
      : "https://albiononline.com/assets/images/killboard/kill__date.png";
  }

  getRandomColor() {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  dFormatter(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") || 0;
  }
}

module.exports = ImageGenerator;
