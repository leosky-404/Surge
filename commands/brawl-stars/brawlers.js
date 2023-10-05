const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, CommandInteraction } = require('discord.js');
const { Canvas, loadImage } = require('@napi-rs/canvas');
const emojiRegex = require('emoji-regex');
const { join } = require('path');
const { access } = require('fs');

const { brawlStarsTags } = require('../../database');
const { playerStats, allBrawlers, brawlerCard } = require('../../utils');
const { canvasWidth, canvasHeight, numColumns, numRows, cellGap, cellWidth, cellHeight, playerNameStartingY, nameStartingX, clubNameStartingY, playerNameFontSize, clubNameFontSize } = brawlerCard;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('brawlers')
        .setDescription('Check your\'s or another player\'s top 30 Brawlers')
        .setDMPermission(false)
        .addUserOption(option => option
            .setName('user')
            .setDescription('Mention a user')
            .setRequired(false)),

    /**
     * 
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        await interaction.deferReply();

        const { id: userId, username } = interaction.options.getUser('user') || interaction.user;
        const isSelf = userId === interaction.user.id;

        try {
            const profile = await brawlStarsTags.findOne({
                userId: userId
            });

            if (!profile) {
                const saveCommandId = await interaction.client.application.commands.fetch().then(
                    commands => commands.find(command => command.name === 'save').id
                );

                const description = isSelf
                    ? `You don't have a profile saved. Use </save:${saveCommandId}> to save your profile and then try again.`
                    : `**${username}** doesn't have a profile saved.`;

                const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setDescription(description)

                return await interaction.editReply({
                    embeds: [embed]
                });
            }

            const player = await playerStats(profile.playerTag);
            const { brawlers, name: playerName, club: { name: clubName = 'No Club' }, icon: { id: iconId } } = player;

            brawlers.sort((a, b) => b.rank - a.rank);
            allBrawlers.filter(brawler => !brawlers.some(b => b.id === brawler.brawlerId)).forEach(brawler => brawlers.push({ id: brawler.brawlerId, rank: 0 }));

            const canvas = new Canvas(canvasWidth, canvasHeight);
            const context = canvas.getContext('2d');

            await Promise.all([
                context.drawImage(await loadImage(join(__dirname, '../../assets/backgrounds/0.png')), 0, 0, 1920, 1080),
                context.drawImage(await loadImage(join(__dirname, '../../assets/otherAssets/backPanel.png')), 32, 265, 1853, 768),
                context.drawImage(await loadImage(join(__dirname, '../../assets/otherAssets/statsPanel.png')), 0, 0, 1920, 1080),
                context.drawImage(await loadAndFallbackImage('../../assets/playerIcons', `${iconId}.png`, '0.png'), 32, 45, 175, 175)
            ]);

            drawName(playerName, playerNameStartingY, playerNameFontSize, context, true);
            drawName(clubName, clubNameStartingY, clubNameFontSize, context, true);

            let index = 0;
            for (let row = 0; row < numRows; row++) {
                for (let column = 0; column < numColumns; column++) {
                    if (index >= brawlers.length) break;

                    const brawlerId = brawlers[index].id;
                    const rank = brawlers[index].rank;

                    const brawlerIcon = await loadAndFallbackImage('../../assets/brawlerIcons', `${brawlerId}.png`, '0.png');
                    const rankIcon = await loadAndFallbackImage('../../assets/rankIcons', `${rank}.png`, '0.png');

                    const x = column * cellWidth + cellGap * column + 32 + cellGap;
                    const y = row * cellHeight + cellGap * row + 265 + cellGap;

                    context.drawImage(rankIcon, x, y, cellWidth, cellHeight);
                    context.drawImage(brawlerIcon, x, y, cellWidth, cellHeight);

                    index++;
                }
            }

            const highestTrophies = player.highestTrophies.toString();
            const trioVictories = player['3vs3Victories'].toString();
            const soloVictories = player.soloVictories.toString();
            const duoVictories = player.duoVictories.toString();

            context.font = '50px LilitaOne-Regular';
            context.fillStyle = 'rgba(255, 255, 255)';
            context.fillText(highestTrophies, 956 + 225 - (context.measureText(highestTrophies).width / 2), 45 + 57.5);
            context.fillText(trioVictories, 956 + 225 - (context.measureText(trioVictories).width / 2), 140 + 57.5);
            context.fillText(soloVictories, 1438 + 225 - (context.measureText(soloVictories).width / 2), 45 + 57.5);
            context.fillText(duoVictories, 1438 + 225 - (context.measureText(duoVictories).width / 2), 140 + 57.5);

            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'brawlers.png' });

            await interaction.editReply({
                files: [attachment]
            });
        } catch (error) {
            // console.error(error);
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

async function loadAndFallbackImage(directory, fileName, fallbackFileName) {
    const imagePath = join(__dirname, directory, fileName);
    const fallbackImagePath = join(__dirname, directory, fallbackFileName);

    const imageExists = await new Promise((resolve) => {
        access(imagePath, (error) => {
            if (error) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });

    if (imageExists) {
        return await loadImage(imagePath);
    } else {
        return await loadImage(fallbackImagePath);
    }
}

function drawName(name, nameStartingY, fontSize, context, textShadow) {
    let x = nameStartingX;
    let font = 'NotoSansJP-Bold';

    for (const character of name) {
        if (emojiRegex().test(character)) {
            font = 'AppleColorEmoji';
        } else if (/^[a-zA-Z0-9]+$/.test(character)) {
            font = 'LilitaOne-Regular';
        } else if (/[.,\/#!$%\^&\*;:{}=\-_`~()]/g.test(character)) {
            font = 'LilitaOne-Regular';
        } else if (character === ' ') {
            x += context.measureText(character).width;
            font = 'Arial'
        }

        if (textShadow) {
            context.font = `${fontSize}px ${font}`;
            context.fillStyle = 'rgba(0, 0, 0, 0.25)';
            context.fillText(character, x, nameStartingY + 5);
        }

        context.font = `${fontSize}px ${font}`;
        context.fillStyle = 'rgba(255, 255, 255)';
        context.fillText(character, x, nameStartingY);

        x += context.measureText(character).width;
    }
}