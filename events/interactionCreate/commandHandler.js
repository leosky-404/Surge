const { Events, EmbedBuilder, CommandInteraction } = require('discord.js');
const { commandLogger, errorLogger } = require('../../utils')

module.exports = {
    name: Events.InteractionCreate,
    once: false,

    /**
     * 
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            return;
        }

        if (interaction.isChatInputCommand() || interaction.isUserContextMenuCommand()) {
            try {
                const startTime = Date.now();
                await command.execute(interaction);
                const endTime = Date.now();
                const timeTaken = endTime - startTime;

                const subCommandGroup = interaction.options.getSubcommandGroup(false);
                const subCommand = interaction.options.getSubcommand(false);
                const commandName = interaction.commandName + (subCommandGroup ? ` ${subCommandGroup}` : '') + (subCommand ? ` ${subCommand}` : '');

                const embed = new EmbedBuilder()
                    .setColor('Blurple')
                    .setDescription(`Command: </${commandName}:${interaction.commandId}>\nUser: <@${interaction.user.id}>\nChannel: <#${interaction.channelId}>\nGuild: ${interaction.guild.name} (${interaction.guild.id})\nExecution time: ${timeTaken} ms`)
                    .setTimestamp();

                await commandLogger.send({
                    username: `${interaction.client.user.username} | Command Logs`,
                    avatarURL: interaction.client.user.displayAvatarURL(),
                    embeds: [embed]
                });
            } catch (error) {
                if (!interaction.replied) {
                    await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
                }

                const errorMessage = error.message ? error.message : 'Unknown error';
                const webhookEmbed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(`Command: Interaction Handler\nError: \`${errorMessage}\`\nStack Trace: \`\`\`${error.stack}\`\`\``);

                errorLogger.send({
                    username: `${interaction.client.user.username} | Error Logs`,
                    avatarURL: interaction.client.user.displayAvatarURL(),
                    embeds: [webhookEmbed]
                });
            }
        }

        if (interaction.isAutocomplete()) {
            try {
                await command.autoComplete(interaction);
            } catch (error) {
                // Do nothing here to prevent logging the error
            }
        }
    }
}