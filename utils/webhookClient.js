const { WebhookClient } = require('discord.js');
const { webhooks: { error, commands } } = require('../config.json');

const errorLogger = new WebhookClient({
    url: error
});

const commandLogger = new WebhookClient({
    url: commands
});

module.exports = { errorLogger, commandLogger }