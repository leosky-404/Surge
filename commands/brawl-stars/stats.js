const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, CommandInteraction } = require('discord.js');
const { Canvas, loadImage } = require("@napi-rs/canvas");
const { join } = require('path');
const { access } = require('fs');

const { playerStats, getBattleLogs, allBrawlers, profileCard } = require('../../utils');
const { brawlStarsTags } = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Check your or another player\'s stats.')
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

            const stats = new Map();
            const { name: playerName, tag: playerTag, club: { name: clubName = 'No Club', tag: clubTag = '' } = {}, trophies, highestTrophies, expLevel, "3vs3Victories": trioVictories, soloVictories, duoVictories, brawlers, icon: { id: iconId = 0 } } = player;
                const brawlerCount = `${brawlers.length}/${allBrawlers.length}`;
                const { trophiesAfterReset, totalBlingAmount } = await calculateSeasonReset(brawlers);
                const { winPercentage } = calculateWinPercentage(await getBattleLogs(playerTag));
                const { playerRating } = calculatePlayerRating(brawlers);
                const highestBrawler = brawlers[0].id || 0;

                stats.set('playerName', playerName)
                    .set('clubName', clubName)
                    .set('trophies', trophies)
                    .set('highestTrophies', highestTrophies)
                    .set('trophiesAfterReset', trophiesAfterReset)
                    .set('expLevel', expLevel)
                    .set('trioVictories', trioVictories)
                    .set('soloVictories', soloVictories)
                    .set('duoVictories', duoVictories)
                    .set('winPercentage', winPercentage)
                    .set('playerRating', playerRating)
                    .set('totalBlingAmount', totalBlingAmount)
                    .set('highestBrawler', highestBrawler)
                    .set('brawlerCount', brawlerCount);

                await drawBackground();
                await drawInsideObjects(stats);
                await drawPlayerIcon(iconId)
                await drawNames(playerName, clubName);

                const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'stats.png' });
                const embed = new EmbedBuilder()
                    .setColor(0xEA8A8C)
                    .setAuthor({ name: `${playerName} | ${playerTag}`, iconURL: `https://cdn.brawlify.com/profile/${iconId}.png` })
                    .addFields(
                        { name: `Trophies`, value: `<:icon_trophy:1138726050059259944> ${trophies.toString()}`, inline: true },
                        { name: 'Highest Trophies', value: `<:highestTrophies:1138726047433629737> ${highestTrophies.toString()}`, inline: true },
                        { name: 'Season Reset', value: `<:icon_trophy:1138726050059259944> ${trophiesAfterReset.toString()}`, inline: true },
                        { name: 'Season Reward', value: `<:icon_bling:1138726036398411808> ${totalBlingAmount.toString()}`, inline: true },
                        { name: 'Recent Winrate', value: `<:wr:1138728555291889684> ${winPercentage.toString()} %`, inline: true },
                        { name: 'Experience Level', value: `<:exp:1138726028722835457> ${expLevel.toString()}`, inline: true },
                        { name: '3 vs 3 Victories', value: `<:3vs3:1138726006115545118> ${trioVictories.toString()}`, inline: true },
                        { name: 'Solo Victories', value: `<:showdown:1138726024755036332> ${soloVictories.toString()}`, inline: true },
                        { name: 'Duo Victories', value: `<:duo:1138726008523067394> ${duoVictories.toString()}`, inline: true },
                        { name: 'Brawler Unlocked', value: `<:icon_brawlers:1138726019814133780> ${brawlerCount}`, inline: true },
                        { name: 'Player Rating', value: `<:rating:1138730218106933290> ${playerRating}`, inline: true },
                        { name: 'Club', value: `<:club:1138726013807890474> ${clubName} \`${clubTag}\``, inline: true })
                    .setImage(`attachment://${attachment.name}`);

                await interaction.editReply({
                    embeds: [embed],
                    files: [attachment]
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

const canvasWidth = 1920;
const canvasHeight = 1080;
const canvas = new Canvas(canvasWidth, canvasHeight);
const context = canvas.getContext('2d');

function calculateWinPercentage(battles) {
    const battleLog = [];
    for (const battle of battles) {
        const battleMode = battle.battle?.type || "unranked";

        if (battleMode === "ranked") {
            battleLog.push(battle);
        }
    }

    let losesRecorded = 0;
    let winsRecorded = 0;

    if (battleLog.length >= 10) {
        for (const battle of battleLog) {
            const result = battle.battle.result;
            if (result === 'victory') {
                winsRecorded++;
            } else if (result === 'defeat') {
                losesRecorded++;
            }
        }
    }

    const totalBattles = winsRecorded + losesRecorded;

    const winPercentage = totalBattles !== 0 ? ((winsRecorded / totalBattles) * 100).toFixed(2) : 0;

    return {
        winsRecorded,
        losesRecorded,
        winPercentage,
    };
}
function calculatePlayerRating(brawlers) {
    const numberOfBrawlers = brawlers.length;
    let allTimeHighestTrophies = 0;

    for (const brawler of brawlers) {
        const highestBrawlerTrophies = brawler.highestTrophies;
        allTimeHighestTrophies += highestBrawlerTrophies;
    }

    const averageTrophies = Math.round(allTimeHighestTrophies / numberOfBrawlers);
    const ratingDivisions = [
        { start: 0, rating: 'F' },
        { start: 150, rating: 'D-' },
        { start: 200, rating: 'D' },
        { start: 250, rating: 'D+' },
        { start: 300, rating: 'C-' },
        { start: 350, rating: 'C' },
        { start: 400, rating: 'C+' },
        { start: 450, rating: 'B-' },
        { start: 500, rating: 'B' },
        { start: 550, rating: 'B+' },
        { start: 600, rating: 'A-' },
        { start: 650, rating: 'A' },
        { start: 700, rating: 'A+' },
        { start: 750, rating: 'S-' },
        { start: 800, rating: 'S' },
        { start: 850, rating: 'S+' }
    ];

    let playerRating = '?'
    for (const ratingDivision of ratingDivisions) {
        if (averageTrophies >= ratingDivision.start) {
            playerRating = ratingDivision.rating;
        } else {
            break;
        }
    }

    return {
        playerRating
    };
}

async function calculateSeasonReset(brawlers) {
    brawlers.sort((a, b) => b.trophies - a.trophies);

    const brawlersAfterReset = [];
    const top10Brawlers = new Map();
    const brawlersAbove500 = new Map();

    for (const brawler of brawlers) {
        if (brawler.trophies > 500) {
            brawlersAbove500.set(brawler.id, brawler);
            if (top10Brawlers.size < 10) {
                top10Brawlers.set(brawler.id, brawler);
            }
        }
    }

    let totalBlingAmount = 0;
    for (const top10Brawler of top10Brawlers.values()) {
        const brawlerTrophies = top10Brawler.trophies;
        const trophiesAfterReset = calculateBrawlerTrophiesAfterReset(brawlerTrophies);
        const blingAmount = calculateBlingRewards(brawlerTrophies);
        totalBlingAmount += blingAmount;

        const brawlerAfterReset = {
            id: top10Brawler.id,
            trophies: trophiesAfterReset,
        };
        brawlersAfterReset.push(brawlerAfterReset);
    }

    for (const brawlerAbove500 of brawlersAbove500.values()) {
        if (!top10Brawlers.has(brawlerAbove500.id)) {
            const brawlerAfterReset = {
                id: brawlerAbove500.id,
                trophies: brawlerAbove500.trophies,
            };
            brawlersAfterReset.push(brawlerAfterReset);
        }
    }

    for (const brawler of brawlers) {
        if (!top10Brawlers.has(brawler.id) && !brawlersAbove500.has(brawler.id)) {
            const brawlerAfterReset = {
                id: brawler.id,
                trophies: brawler.trophies,
            };
            brawlersAfterReset.push(brawlerAfterReset);
        }
    }

    let trophiesAfterReset = 0;
    for (const brawlerAfterReset of brawlersAfterReset) {
        const brawlerTrophies = brawlerAfterReset.trophies;
        trophiesAfterReset += brawlerTrophies;
    }

    return {
        trophiesAfterReset,
        totalBlingAmount
    }
}

function calculateBrawlerTrophiesAfterReset(brawlerTrophies) {
    const trophyRanges = [
        { start: 500, trophiesAfterReset: 500 },
        { start: 525, trophiesAfterReset: 524 },
        { start: 550, trophiesAfterReset: 549 },
        { start: 575, trophiesAfterReset: 574 },
        { start: 600, trophiesAfterReset: 599 },
        { start: 625, trophiesAfterReset: 624 },
        { start: 650, trophiesAfterReset: 649 },
        { start: 675, trophiesAfterReset: 674 },
        { start: 700, trophiesAfterReset: 699 },
        { start: 725, trophiesAfterReset: 724 },
        { start: 750, trophiesAfterReset: 749 },
        { start: 775, trophiesAfterReset: 774 },
        { start: 800, trophiesAfterReset: 799 },
        { start: 825, trophiesAfterReset: 824 },
        { start: 850, trophiesAfterReset: 849 },
        { start: 875, trophiesAfterReset: 874 },
        { start: 900, trophiesAfterReset: 899 },
        { start: 925, trophiesAfterReset: 924 },
        { start: 950, trophiesAfterReset: 949 },
        { start: 975, trophiesAfterReset: 974 },
        { start: 1000, trophiesAfterReset: 999 },
        { start: 1050, trophiesAfterReset: 1049 },
        { start: 1100, trophiesAfterReset: 1099 },
        { start: 1150, trophiesAfterReset: 1149 },
        { start: 1200, trophiesAfterReset: 1199 },
        { start: 1250, trophiesAfterReset: 1249 },
        { start: 1300, trophiesAfterReset: 1299 },
        { start: 1350, trophiesAfterReset: 1349 },
        { start: 1400, trophiesAfterReset: 1399 },
        { start: 1450, trophiesAfterReset: 1449 },
        { start: 1500, trophiesAfterReset: 1499 },
    ];

    let trophiesAfterReset;

    for (const range of trophyRanges) {
        if (brawlerTrophies >= range.start) {
            trophiesAfterReset = range.trophiesAfterReset;
        } else {
            break;
        }
    }

    return trophiesAfterReset;
}

function calculateBlingRewards(brawlerTrophies) {
    const blingAmounts = [
        { start: 500, amount: 4 },
        { start: 525, amount: 6 },
        { start: 550, amount: 8 },
        { start: 575, amount: 10 },
        { start: 600, amount: 12 },
        { start: 625, amount: 14 },
        { start: 650, amount: 16 },
        { start: 675, amount: 18 },
        { start: 700, amount: 20 },
        { start: 725, amount: 22 },
        { start: 750, amount: 24 },
        { start: 775, amount: 26 },
        { start: 800, amount: 28 },
        { start: 825, amount: 30 },
        { start: 850, amount: 32 },
        { start: 875, amount: 34 },
        { start: 900, amount: 36 },
        { start: 925, amount: 38 },
        { start: 950, amount: 40 },
        { start: 975, amount: 42 },
        { start: 1000, amount: 44 },
        { start: 1050, amount: 46 },
        { start: 1100, amount: 48 },
        { start: 1150, amount: 50 },
        { start: 1200, amount: 52 },
        { start: 1250, amount: 54 },
        { start: 1300, amount: 56 },
        { start: 1350, amount: 58 },
        { start: 1400, amount: 60 },
        { start: 1450, amount: 62 },
        { start: 1500, amount: 64 },
    ];

    let blingReward;

    for (const bling of blingAmounts) {
        if (brawlerTrophies >= bling.start) {
            blingReward = bling.amount;
        } else {
            break;
        }
    }

    return blingReward;
}

const { x: backgroundX, y: backgroundY, width: backgroundWidth, height: backgroundHeight } = profileCard.background
async function drawBackground() {
    const background = await loadImage(join(__dirname, '../../assets/backgrounds/1.png'));
    context.drawImage(background, backgroundX, backgroundY, backgroundWidth, backgroundHeight);
}

const { boxes, bigBox, brawler3DPortrait } = profileCard.objects
const { boxMarginLeft, boxMarginTop, numCols, numRows, boxGap, subBoxWidth, subBoxHeight, cornerRadius } = bigBox;
const transparentBlack = 'rgba(0, 0, 0, 0.25)';
let boxIndex = 0;

async function drawInsideObjects(stats) {
    const highestBrawler = stats.get('highestBrawler');
    await drawBrawlerPortrait(highestBrawler);

    const textArray = [
        stats.get('trophies'),
        stats.get('highestTrophies'),
        stats.get('expLevel'),
        stats.get('trioVictories'),
        stats.get('soloVictories'),
        stats.get('duoVictories'),
        stats.get('brawlerCount'),
        stats.get('playerRating'),
    ];

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            const subBoxX = boxMarginLeft + col * (subBoxWidth + boxGap);
            const subBoxY = boxMarginTop + row * (subBoxHeight + boxGap);
            context.fillStyle = transparentBlack;

            context.beginPath();
            context.moveTo(subBoxX + cornerRadius, subBoxY);
            context.arcTo(subBoxX + subBoxWidth, subBoxY, subBoxX + subBoxWidth, subBoxY + cornerRadius, cornerRadius);
            context.arcTo(subBoxX + subBoxWidth, subBoxY + subBoxHeight, subBoxX + subBoxWidth - cornerRadius, subBoxY + subBoxHeight, cornerRadius);
            context.arcTo(subBoxX, subBoxY + subBoxHeight, subBoxX, subBoxY + subBoxHeight - cornerRadius, cornerRadius);
            context.arcTo(subBoxX, subBoxY, subBoxX + cornerRadius, subBoxY, cornerRadius);
            context.closePath();
            context.fill();

            const { square, box } = boxes[boxIndex];
            const { size: squareSize, x: squareX, y: squareY } = square;
            const { x: iconX, y: iconY, width: iconSize } = box;
            const text = textArray[boxIndex].toString();
            const textHeight = 70;
            const { textWidth } = await measureTextMetrics(text);

            context.beginPath();
            context.moveTo(squareX + cornerRadius, squareY);
            context.arcTo(squareX, squareY, squareX, squareY + cornerRadius, cornerRadius);
            context.lineTo(squareX, squareY + squareSize - cornerRadius);
            context.arcTo(squareX, squareY + squareSize, squareX + cornerRadius, squareY + squareSize, cornerRadius);
            context.lineTo(squareX + squareSize, squareY + squareSize);
            context.lineTo(squareX + squareSize, squareY);
            context.closePath();
            context.fill();

            const statIcon = await loadImage(join(__dirname, `../../assets/statIcons/${boxIndex}.png`));
            context.drawImage(statIcon, iconX, iconY, iconSize, iconSize);

            const textX = subBoxX + squareSize + (subBoxWidth - squareSize - textWidth) / 2;
            const textY = subBoxY + subBoxHeight / 2 + textHeight / 2 - 10;

            context.fillStyle = 'white';
            context.font = '70px LilitaOne-Regular';
            context.fillText(text, textX, textY);
            context.fillStyle = transparentBlack;

            boxIndex++;
        }
    }
    boxIndex = 0;
}

const { x: portraitX, y: portraitY, width: portraitWidth, height: portraitHeight } = brawler3DPortrait;
async function drawBrawlerPortrait(highestBrawler) {
    const brawler3DPortrait = await loadAndFallbackImage('../../assets/brawlerPortraits', `${highestBrawler}.png`, '0.png');
    context.drawImage(brawler3DPortrait, portraitX, portraitY, portraitWidth, portraitHeight);
}

async function measureTextMetrics(text) {
    return new Promise((resolve) => {
        context.font = '70px LilitaOne-Regular';
        context.fillText(text, 0, 0);
        const textWidth = context.measureText(text).width;

        resolve({
            textWidth
        });
    });
}

const { x: iconX, y: iconY, size: iconSize } = profileCard.playerIcon.playerIcon
async function drawPlayerIcon(iconId) {
    const playerIcon = await loadAndFallbackImage('../../assets/playerIcons', `${iconId}.png`, '0.png');
    context.drawImage(playerIcon, iconX, iconY, iconSize, iconSize);
}

const { x, y, width, height } = profileCard.rectangles.rectangles

async function drawNames(playerName, clubName) {
    const playerNameSegments = separateTextAndEmojis(playerName);
    const clubNameSegments = separateTextAndEmojis(clubName);
    let currentPlayerNameX = x;
    let currentClubNameX = x;

    for (const playerNameSegment of playerNameSegments) {
        context.fillStyle = 'white';
        context.textAlign = 'left';
        let font = '90px LilitaOne-Regular';
        if (hasEmojis(playerNameSegment)) {
            font = '90px AppleColorEmoji';
        }
        context.font = font;

        const playerNameSegmentWidth = context.measureText(playerNameSegment).width;
        context.fillText(playerNameSegment, currentPlayerNameX, y[1] + height[1] / 2 + 35);

        currentPlayerNameX += playerNameSegmentWidth;
    }

    for (const clubNameSegment of clubNameSegments) {
        context.fillStyle = 'white';
        context.textAlign = 'left';
        let font = '70px LilitaOne-Regular';
        if (hasEmojis(clubNameSegment)) {
            font = '70px AppleColorEmoji';
        }
        context.font = font;

        const clubNameSegmentWidth = context.measureText(clubNameSegment).width;
        context.fillText(clubNameSegment, currentClubNameX, y[2] + height[2] / 2 + 25);

        currentClubNameX += clubNameSegmentWidth;
    }
}

function separateTextAndEmojis(inputString) {
    const emojiRegex = /\p{Emoji}/u;
    const segments = [];
    let currentSegment = '';

    for (const char of inputString) {
        if (char.match(emojiRegex)) {
            if (currentSegment !== '') {
                segments.push(currentSegment);
                currentSegment = '';
            }
            currentSegment += char;
        } else {
            if (currentSegment.match(emojiRegex)) {
                segments.push(currentSegment);
                currentSegment = '';
            }
            currentSegment += char;
        }
    }

    if (currentSegment !== '') {
        segments.push(currentSegment);
    }

    return segments;
}

function hasEmojis(str) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{20D0}-\u{20FF}\u{FE0F}]/gu;
    return emojiRegex.test(str);
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