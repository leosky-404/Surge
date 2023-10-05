const { Client } = require('brawlstats');
const { brawlStatsKey } = require('../config.json');

const client = new Client({
    token: brawlStatsKey
});

function playerStats(tag) {
    return client.players.fetch(tag);
}

function getBattleLogs(tag) {
    return client.battlelogs.fetch(tag);
}

module.exports = {
    playerStats,
    getBattleLogs
}