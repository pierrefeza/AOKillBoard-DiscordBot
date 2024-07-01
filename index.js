const DiscordBot = require("./DiscordBot");
const KillFetcher = require("./KillFetcher");
const config = require("./config.json");

const discordBot = new DiscordBot(config);
const killFetcher = new KillFetcher(discordBot, config);

discordBot.initialize().then(() => {
  // Initial fetch
  killFetcher.fetchKills();

  // Regular fetch interval (every 30 seconds)
  setInterval(() => killFetcher.fetchKills(), 30 * 1000);

  // Delayed fetch interval (every 5 minutes)
  setInterval(() => killFetcher.fetchKillsDelayed(), 5 * 60 * 1000);
});
