const axios = require("axios");

class KillFetcher {
  constructor(discordBot, config) {
    this.discordBot = discordBot;
    this.config = config;
    this.publishedEventIds = new Set(); // Use a Set for efficient storage and lookup
    this.fetchCount = 0; // Counter to track the number of fetches
  }

  async fetchKills(retryCount = 0) {
    try {
      const response = await axios.get(
        `https://gameinfo.albiononline.com/api/gameinfo/events?limit=51&offset=0`
      );
      this.parseKills(response.data);

      // Log only every 10th fetch to reduce log spam
      this.fetchCount++;
      if (this.fetchCount % 10 === 0) {
        console.log(`Fetched ${response.data.length} kills (fetch count: ${this.fetchCount})`);
      }

      // Add a slight delay before the next fetch
      setTimeout(() => this.fetchKills(), 1000); // 1 second delay
    } catch (error) {
      console.error("Error fetching kills:", error.message);
      if (retryCount < 5) { // Retry up to 5 times
        console.log(`Retrying fetchKills (${retryCount + 1}/5)`);
        setTimeout(() => this.fetchKills(retryCount + 1), 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        console.error("Max retries reached for fetchKills");
      }
    }
  }

  async fetchKillsDelayed(retryCount = 0) {
    const offset = 102;
    try {
      const response = await axios.get(
        `https://gameinfo.albiononline.com/api/gameinfo/events?limit=51&offset=${offset}`
      );
      this.parseDelayedKills(response.data);

      // Log only every 10th fetch to reduce log spam
      this.fetchCount++;
      if (this.fetchCount % 10 === 0) {
        console.log(`Fetched delayed ${response.data.length} kills (fetch count: ${this.fetchCount})`);
      }

      // Add a slight delay before the next fetch
      setTimeout(() => this.fetchKillsDelayed(), 1000); // 1 second delay
    } catch (error) {
      console.error("Error fetching delayed kills:", error.message);
      if (retryCount < 5) { // Retry up to 5 times
        console.log(`Retrying fetchKillsDelayed (${retryCount + 1}/5)`);
        setTimeout(() => this.fetchKillsDelayed(retryCount + 1), 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        console.error("Max retries reached for fetchKillsDelayed");
      }
    }
  }

  parseKills(events) {
    // Sort events by kill timestamp before processing
    events.sort((a, b) => new Date(a.TimeStamp) - new Date(b.TimeStamp));

    events.forEach((kill) => {
      if (this.publishedEventIds.has(kill.EventId)) return; // Check existence using Set's has method

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
        this.publishedEventIds.add(kill.EventId); // Add to Set

        // Trim the set to maintain a maximum of 10 recent unique kills
        if (this.publishedEventIds.size > 10) {
          this.publishedEventIds.delete(this.publishedEventIds.values().next().value); // Remove oldest element
        }
      }
    });

    console.log(`Parsed ${events.length} kills, ${this.publishedEventIds.size} unique kills published recently`);
  }

  parseDelayedKills(events) {
    // Sort events by kill timestamp before processing
    events.sort((a, b) => new Date(a.TimeStamp) - new Date(b.TimeStamp));

    events.forEach((kill) => {
      if (!this.publishedEventIds.has(kill.EventId)) { // Check existence using Set's has method
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
          this.publishedEventIds.add(kill.EventId); // Add to Set

          // Trim the set to maintain a maximum of 10 recent unique kills
          if (this.publishedEventIds.size > 10) {
            this.publishedEventIds.delete(this.publishedEventIds.values().next().value); // Remove oldest element
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
