const { get } = require('axios');
const brawlerUrl = 'https://api.brawlapi.com/v1/brawlers';

const allBrawlers = [];

(async () => {
    const brawlers = (await get(brawlerUrl)).data.list;

    for (const brawler of brawlers) {
        const brawlerId = brawler.id;
        const brawlerName = brawler.name;

        allBrawlers.push({ brawlerId, brawlerName });
    }
    allBrawlers.reverse();
})();

module.exports = allBrawlers;