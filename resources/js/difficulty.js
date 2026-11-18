// Bot difficulty (#71): five levels, chosen in Options, for every bot. Level 3 is how the bots have
// always played. Lower levels choose more loosely and take more gambles; higher ones stick to their
// best move, and at 5 never act on a whim. See difficultyLevels in rules.js for what each changes.
// The app still can't see the board, so even at 5 the bots ask their questions and plan from what
// the app knows.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

let botDifficulty = defaultDifficulty;

function getDifficulty() {
    return difficultyLevels[botDifficulty] || difficultyLevels[defaultDifficulty];
}

function getBotPersonality() {
    // The battle personality at this difficulty
    const level = getDifficulty();
    return { ...defaultBotPersonality, randomness: defaultBotPersonality.randomness * level.randomness, moodSwing: defaultBotPersonality.moodSwing * level.moodSwing };
}

function getWhimChance(chance) {
    // A chance (%) of doing something on a whim, at this difficulty
    return chance * getDifficulty().chance;
}

function wouldWinAmbition(player, ambition) {
    // Declaring it now, it would come first
    return ambitionResources[ambition] != null && ambitionResources[ambition](player) > 0
        && getAmbitionPlacePoints(player, ambition, ambitionResources[ambition](player)) == 2;
}

function decideAtDifficulty(player, smartChoice, whim) {
    // Whether to do something that can be worked out (smartChoice) or left to a chance (whim, a
    // function so the dice are only rolled when they're needed)
    const smart = getDifficulty().smart;
    if (smart != "none" && smartChoice) { return true; }
    if (smart == "only") { return false; }
    return whim();
}

function applyOfferDifficulty(offers) {
    // On the easiest level it decides nothing itself: every prelude or Guild offer is your call
    if (getDifficulty().decides) { return offers; }
    return offers.map(offer => ({ ...offer, decided: false, why: null }));
}

function setBotDifficulty(level) {
    botDifficulty = level;
    saveSettingObject("botDifficulty", level);
    showBotDifficulty();
}

function showBotDifficulty() {
    const level = getDifficulty();
    const input = document.getElementById("botDifficulty" + botDifficulty);
    if (input != null) { input.checked = true; }
    const name = document.getElementById("botDifficultyName");
    if (name != null) { name.innerHTML = botDifficulty + " &middot; " + level.name; }
    const text = document.getElementById("botDifficultyText");
    if (text != null) { text.innerHTML = level.text; }
}

document.addEventListener("DOMContentLoaded", () => {
    const saved = getSettingObject("botDifficulty");
    botDifficulty = (difficultyLevels[saved] != null) ? saved : defaultDifficulty;
    showBotDifficulty();
});
