const { Events, Client, ActivityType } = require('discord.js');
const { version } = require('../../package.json');
const { join } = require('path')
const { GlobalFonts } = require('@napi-rs/canvas');

GlobalFonts.registerFromPath(join(__dirname, '../../assets/fonts/LilitaOne-Regular.ttf'), 'LilitaOne-Regular');
GlobalFonts.registerFromPath(join(__dirname, '../../assets/fonts/AppleColorEmoji.ttf'), 'AppleColorEmoji');
GlobalFonts.registerFromPath(join(__dirname, '../../assets/fonts/NotoSansJP-Bold.ttf'), 'NotoSans-JP-Bold');

module.exports = {
    name: Events.ClientReady,
    once: false,

    /**
     * Executes when the client is ready.
     * @param {Client} client
     */
    async execute(client) {
        client.user.setActivity({
            type: ActivityType.Custom,
            name: 'custom',
            state: `v${version} update is out now!`,
        });
        console.log(`${client.user.tag} is online.`);
    }
};
