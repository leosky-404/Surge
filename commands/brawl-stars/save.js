const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { playerStats } = require('../../utils');
const { brawlStarsTags } = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('save')
        .setDescription('Save your Brawl Stars tag.')
        .addStringOption(option => option
            .setName('tag')
            .setDescription('Your Brawl Stars tag.')),

    async execute(interaction) {
        await interaction.deferReply();

        const userTag = interaction.options.getString('tag').replace(/#/g, '').replace(/O/gi, '0').toUpperCase();
        const userId = interaction.user.id;

        try {
            const player = await playerStats(userTag);
            const { tag: playerTag, name: playerName, icon: { id: iconId } } = player;

            const existingProfile = await brawlStarsTags.findOne({
                userId
            });

            if (existingProfile) {
                existingProfile.playerTag = playerTag;
                await existingProfile.save();
            } else {
                const newProfile = new brawlStarsTags({
                    userId,
                    playerTag
                });
                newProfile.save();
            }

            const embed = new EmbedBuilder()
                .setColor(0xEA8A8C)
                .setAuthor({
                    name: `${playerName} | ${playerTag}`,
                    iconURL: `https://cdn.brawlify.com/profile/${iconId}.png`
                })
                .setDescription(`<@${interaction.user.id}>, your Brawl Stars tag has been saved successfully.`)

            await interaction.editReply({
                embeds: [embed]
            });
        } catch (error) {
            const errorMessages = {
                400: '**Client provided incorrect parameters.** Don\'t worry, this isn\'t your fault.',
                403: '**API Access denied.** This is not your fault, but a problem with the code.',
                404: '**Invalid Tag.** Make sure you entered the correct tag.',
                429: '**Request was throttled.** Too many other bots are making API requests at the moment.',
                503: '**Unable to access data.** The game is currently under maintenance. Try again later.',
                default: `**An error has occurred.** ${error.message}`,
            };
            const { code } = error;
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setDescription(errorMessages[code] || errorMessages.default);

            await interaction.editReply({
                embeds: [embed]
            });
        }
    }
}