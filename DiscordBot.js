const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");
const ImageGenerator = require("./ImageGenerator");
const fs = require("fs");

class DiscordBot {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.channel = null;
    this.sendQueue = [];
    this.isProcessingQueue = false;
    this.playerNames = config.players.map((player) => player.toLowerCase());
  }

  async initialize() {
    this.client.once("ready", async () => {
      console.log(`Logged in as ${this.client.user.tag}!`);
      console.log(`Connected to the following servers:`);
      this.client.guilds.cache.forEach((guild) => {
        console.log(` - ${guild.name}`);
      });

      this.channel = this.client.channels.cache.get(this.config.botChannel);
      if (!this.channel) {
        console.error(`Bot channel with ID ${this.config.botChannel} not found!`);
      } else {
        console.log(`Bot will post in channel: ${this.channel.name}`);
      }

      this.client.user.setActivity(this.config.playingGame);
    });

    this.client.on("messageCreate", async (message) => {
      if (!message.content.startsWith(this.config.cmdPrefix) || message.author.bot) return;

      const args = message.content.slice(this.config.cmdPrefix.length).trim().split(/ +/g);
      const command = args.shift().toLowerCase();

      if (command === "ping") {
        message.reply("pong");
      } else if (command === "kbinfo") {
        const killFetcher = new KillFetcher(this, this.config);
        const killData = await killFetcher.fetchEventById(args[0]);
        this.queueKill(killData);
      } else if (command === "kbclear") {
        if (
          this.config.admins.includes(message.author.id) &&
          message.channel.id === this.config.botChannel
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

    this.client.login(this.config.token);
  }

  queueKill(kill) {
    console.log(`Queueing kill: ${kill.EventId}`);
    this.sendQueue.push(kill);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessingQueue || this.sendQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.sendQueue.length > 0) {
      const kill = this.sendQueue.shift();
      try {
        await this.postKillWithTimeout(kill);
      } catch (error) {
        console.error(`Error posting kill ${kill.EventId}:`, error);
        // Requeue the failed kill for retry
        this.sendQueue.push(kill);
      }
    }

    this.isProcessingQueue = false;
  }

  async postKillWithTimeout(kill, timeout = 30000) { // Timeout set to 30 seconds
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout exceeded for posting kill ${kill.EventId}`));
      }, timeout);

      this.postKill(kill).then(() => {
        clearTimeout(timeoutId);
        resolve();
      }).catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async postKill(kill) {
    const imageGenerator = new ImageGenerator();

    if (kill.TotalVictimKillFame === 0) return;
    console.log(`Posting kill: ${kill.EventId}`);

    let eventColor = 0x008000;
    if (
      kill.Victim.AllianceName.toLowerCase() === this.config.allianceName.toLowerCase() ||
      kill.Victim.GuildName.toLowerCase() === this.config.guildName.toLowerCase() ||
      this.playerNames.includes(kill.Victim.Name.toLowerCase())
    ) {
      eventColor = 0x880808;
    }

    let inventoryPath = null;
    const filePath = await imageGenerator.generateCompositeImage(kill);
    if (kill.Victim.Inventory.some((item) => item !== null)) {
      inventoryPath = await imageGenerator.generateInventoryImage(kill.Victim);
    }

    const embed = {
      color: eventColor,
      author: {
        name: `${kill.Killer.Name} killed ${kill.Victim.Name}`,
        url: `https://albiononline.com/killboard/kill/${kill.EventId}`,
      },
      image: {
        url: "attachment://kill.png",
      },
      timestamp: new Date(kill.TimeStamp).toISOString(),
      footer: {
        text: `Kill #${kill.EventId}`,
      },
    };

    if (!this.channel) {
      console.error(`Channel ID ${this.config.botChannel} not found in cache.`);
      return;
    }

    try {
      await this.channel.send({
        embeds: [embed],
        files: [{ attachment: filePath, name: "kill.png" }],
      });

      fs.unlinkSync(filePath);

      if (inventoryPath !== null) {
        const inventoryEmbed = {
          color: eventColor,
          image: {
            url: "attachment://inventory.png",
          },
        };

        await this.channel.send({
          embeds: [inventoryEmbed],
          files: [{ attachment: inventoryPath, name: "inventory.png" }],
        });

        fs.unlinkSync(inventoryPath);
      }
    } catch (error) {
      console.error("Error sending kill or inventory images:", error);
      throw error; // Propagate error to be handled by the timeout mechanism
    }
  }
}

module.exports = DiscordBot;
