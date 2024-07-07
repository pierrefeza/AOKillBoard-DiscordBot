const DiscordBot = require('./DiscordBot');
const KillFetcher = require('./KillFetcher');
const config = require("./config.json");
const discordBot = new DiscordBot(config);
const killFetcher = new KillFetcher(discordBot,config);

discordBot.initialize().then(() => {
  // Initial fetch
  killFetcher.fetchKills();
});
