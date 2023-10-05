const { SlashCommandBuilder, EmbedBuilder, CommandInteraction } = require('discord.js');

const { developers } = require('../../config.json');
const { version } = require('../../package.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Shows some information about the bot.')
        .setDMPermission(false),

    /**
     * 
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        try {
            const client = interaction.client;
            const botName = client.user.username;
            const botAvatar = client.user.displayAvatarURL();

            const botDevelopers = developers.map(developer => `<@${developer}>`).join(', ');
            const uptime = formatUptime(client.uptime);
            const ping = client.ws.ping;
            const totalSystemMemory = Math.ceil(require('os').totalmem() / 1024 / 1024 / 1024)
            const memoryUsageRam = (process.memoryUsage().rss + process.memoryUsage().heapTotal) / 1024 / 1024;
            const nodeVersion = process.version;
            const totalMembers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

            const embed = new EmbedBuilder()
                .setColor(0xEA8A8C)
                .setAuthor({ name: `${botName} Info`, iconURL: botAvatar })
                .addFields(
                    { name: 'Developers', value: `${botDevelopers}`, inline: true },
                    { name: 'Uptime', value: `\`${uptime}\``, inline: true },
                    { name: 'Ping', value: `\`${ping} ms\``, inline: true },
                    { name: 'RAM Usage', value: `\`${memoryUsageRam.toFixed(2)} MB\/${totalSystemMemory.toFixed(2)} GB\``, inline: true },
                    { name: 'Node Version', value: `\`${nodeVersion}\``, inline: true },
                    { name: 'Total Members', value: `\`${totalMembers}\``, inline: true },
                )
                .setFooter({ text: `Version: ${version}`})
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
            });
        } catch (error) {
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(`**An error has occurred.** ${error.message}`);

            await interaction.reply({
                embeds: [embed]
            });
        }
    }
}

/**
 * Formats the uptime duration into a readable string.
 * @param {number} uptimeMilliseconds
 * @returns {string}
 */
function formatUptime(uptimeMilliseconds) {
    const seconds = Math.floor(uptimeMilliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
    const secondsLeft = ((seconds % 86400) % 3600) % 60;

    return `${days}d ${hours}h ${minutes}m ${secondsLeft}s`;
}