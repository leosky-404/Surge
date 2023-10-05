const { Client, IntentsBitField, Collection } = require('discord.js');
const { readdirSync, lstatSync } = require('fs');
const { join } = require('path');
const { token } = require('./config.json');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages
    ],
    commands: new Collection()
});

const { connectToDatabase } = require('./utils');
require('./deploy-commands');

client.commands = new Collection();
module.exports = { client };

connectToDatabase().then(async () => {

    const commandCategoriesPath = join(__dirname, 'commands');
    const commandCategoryFolders = readdirSync(commandCategoriesPath);

    for (const commandCategoryFolder of commandCategoryFolders) {
        const commandCategoryPath = join(commandCategoriesPath, commandCategoryFolder);
        const commandFiles = readdirSync(commandCategoryPath).filter(file => file.endsWith('.js'));

        for (const commandFile of commandFiles) {
            const filePath = join(commandCategoryPath, commandFile);
            const command = require(filePath);

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`Loaded command: ${command.data.name}`);
            } else {
                continue;
            }
        }
    }

    const eventCategoriesPath = join(__dirname, 'events');
    const eventCategoryFolders = readdirSync(eventCategoriesPath);

    for (const eventCategoryFolder of eventCategoryFolders) {
        const categoryPath = join(eventCategoriesPath, eventCategoryFolder);

        if (lstatSync(categoryPath).isDirectory()) {
            const eventFiles = readdirSync(categoryPath).filter(file => file.endsWith('.js'));

            for (const eventFile of eventFiles) {
                const filePath = join(categoryPath, eventFile);
                const event = require(filePath);
                if ('name' in event && 'execute' in event) {
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args));
                    } else {
                        client.on(event.name, (...args) => event.execute(...args));
                    }
                } else {
                    continue;
                }
            }
        }
    }

}).catch(error => {
    console.error('Error connecting to database: ', error);
    process.exit(1);
}).then(() => {
    client.login(token);
});