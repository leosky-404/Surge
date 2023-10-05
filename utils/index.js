const connectToDatabase = require('./connectToDatabase');
const { profileLogger, commandLogger, errorLogger } = require('./webhookClient');
const { getBattleLogs, playerStats } = require('./brawlStarsClient');
const allBrawlers = require('./allBrawlers');
const brawlerCard = require('./brawlerCanvas');
const profileCard = require('./profileCanvas');

module.exports = {
    connectToDatabase,
    profileLogger,
    commandLogger,
    errorLogger,
    playerStats,
    getBattleLogs,
    allBrawlers,
    brawlerCard,
    profileCard
}