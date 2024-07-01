const axios = require("axios");

class KillFetcher {
    constructor(discordBot, config) {
      this.discordBot = discordBot;
      this.config = config;
      this.publishedEventIds = [];
    }

  async fetchKills(limit = 51, offset = 0, retries = 3) {
    try {
      const response = await axios.get(
        `https://gameinfo.albiononline.com/api/gameinfo/events?limit=${limit}&offset=${offset}`
      );
      console.log(`Fetched ${response.data.length} kills`);
      this.parseKills(response.data);
    } catch (error) {
      console.error("Error fetching kills:", error.message);
      if (retries > 0) {
        console.log(`Retrying... (${retries} attempts left)`);
        setTimeout(() => this.fetchKills(limit, offset, retries - 1), 5000);
      } else {
        console.error("All retries failed");
      }
    }
  }

  async fetchKillsDelayed() {
    const offset = 102;
    try {
      const response = await axios.get(
        `https://gameinfo.albiononline.com/api/gameinfo/events?limit=51&offset=${offset}`
      );
      this.parseDelayedKills(response.data);
    } catch (error) {
      console.error("Error fetching delayed kills:", error.message);
    }
  }

  parseKills(events) {
    events.forEach((kill) => {
      if (this.publishedEventIds.includes(kill.EventId)) return;

      if (
        kill.Killer.AllianceName.toLowerCase() === this.config.allianceName.toLowerCase() ||
        kill.Victim.AllianceName.toLowerCase() === this.config.allianceName.toLowerCase() ||
        kill.Killer.GuildName.toLowerCase() === this.config.guildName.toLowerCase() ||
        kill.Victim.GuildName.toLowerCase() === this.config.guildName.toLowerCase() ||
        this.discordBot.playerNames.includes(kill.Killer.Name.toLowerCase()) ||
        this.discordBot.playerNames.includes(kill.Victim.Name.toLowerCase())
      ) {
        console.log(`Posting kill due to alliance/guild/player match: ${kill.EventId}`);
        this.discordBot.queueKill(kill);
        this.publishedEventIds.push(kill.EventId);

        if (this.publishedEventIds.length > 10) {
          this.publishedEventIds.shift();
        }
      }
    });

    console.log(`Parsed ${events.length} kills, ${this.publishedEventIds.length} unique kills published recently`);
  }

  parseDelayedKills(events) {
    events.forEach((kill) => {
      if (!this.publishedEventIds.includes(kill.EventId)) {
        if (
          kill.Killer.AllianceName.toLowerCase() === this.config.allianceName.toLowerCase() ||
          kill.Victim.AllianceName.toLowerCase() === this.config.allianceName.toLowerCase() ||
          kill.Killer.GuildName.toLowerCase() === this.config.guildName.toLowerCase() ||
          kill.Victim.GuildName.toLowerCase() === this.config.guildName.toLowerCase() ||
          this.discordBot.playerNames.includes(kill.Killer.Name.toLowerCase()) ||
          this.discordBot.playerNames.includes(kill.Victim.Name.toLowerCase())
        ) {
          console.log(`Delayed posting for event ID: ${kill.EventId}`);
          this.discordBot.queueKill(kill);
          this.publishedEventIds.push(kill.EventId);

          if (this.publishedEventIds.length > 10) {
            this.publishedEventIds.shift();
          }
        }
      }
    });
  }

  async fetchEventById(eventId) {
    try {
      const response = await axios.get(`https://gameinfo.albiononline.com/api/gameinfo/events/${eventId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching event info:", error);
    }
  }
}

module.exports = KillFetcher;