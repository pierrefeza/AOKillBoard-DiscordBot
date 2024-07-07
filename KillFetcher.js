const axios = require("axios");

class KillFetcher {
  constructor(discordBot, config) {
    this.discordBot = discordBot;
    this.config = config;
    this.publishedEventIds = new Set(); // Use a Set for efficient storage and lookup
    this.fetchCount = 0; // Counter to track the number of fetches
    this.isFetching = false;
    this.lastFetchedEventId = null; // To store the ID of the first event of the last fetch
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

      // Check if the first event ID is the same as the last fetched event ID
      const firstEventId = response.data.length > 0 ? response.data[0].EventId : null;
      if (firstEventId !== this.lastFetchedEventId) {
        this.lastFetchedEventId = firstEventId;
        this.fetchAllOffsets(); // Fetch all offsets if there are new events
      }

      // Recursive call with a delay
      setTimeout(() => this.fetchKills(), 1000); // 1 second delay
    } catch (error) {
      console.error("Error fetching kills:", error.message);
      if (retryCount < 5) { // Retry up to 5 times
        console.log(`Retrying fetchKills (${retryCount + 1}/5)`);
        setTimeout(() => this.fetchKills(retryCount + 1), 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        console.error("Max retries reached for fetchKills");
        // Continue fetching even if max retries reached
        setTimeout(() => this.fetchKills(), 1000); // 1 second delay
      }
    }
  }

  async fetchEventsTo(latestEventId, offset = 0, events = []) {
    if (offset >= 1000) {
      console.log(`Reached maximum offset of 1000. Total events fetched: ${events.length}`);
      return events;
    }

    try {
      const response = await axios.get(
        `https://gameinfo.albiononline.com/api/gameinfo/events?limit=51&offset=${offset}`
      );
      const albionEvents = response.data;
      let foundLatest = false;

      for (const evt of albionEvents) {
        if (!latestEventId) latestEventId = evt.EventId - 1;
        if (evt.EventId <= latestEventId) {
          foundLatest = true;
          console.log(`Found event with ID ${evt.EventId} which is less than or equal to latestEventId ${latestEventId}. Breaking the loop.`);
          break;
        }
        if (events.findIndex((e) => e.EventId === evt.EventId) < 0) {
          events.push(evt);
        }
      }

      return foundLatest
        ? events
        : this.fetchEventsTo(latestEventId, offset + albionEvents.length, events);
    } catch (error) {
      console.error(`Unable to fetch event data from API: ${error.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return this.fetchEventsTo(latestEventId, offset, events);
    }
  }

  async fetchAllOffsets() {
    if (this.isFetching) return;
    this.isFetching = true;

    const events = await this.fetchEventsTo(this.lastFetchedEventId);
    this.parseKills(events);

    console.log(`Completed fetchAllOffsets. Total events fetched: ${events.length}`);
    this.isFetching = false;

    // Recursive call with a delay
    setTimeout(() => this.fetchAllOffsets(), 30000); // 3 seconds delay
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
