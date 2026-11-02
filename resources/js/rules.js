// Rules: ambitions, ambition markers, the bots' declare odds, win conditions and how ambitions are scored.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const ambitions = [
    "tycoon",
    "tyrant",
    "warlord",
    "keeper",
    "empath"
];

// The three ambition markers for each round as [first place, second place].
// When an ambition is declared it takes the highest remaining marker (see getRoundMarkers)
const ambitionMarkerValues = {
    1: [[5, 3], [3, 2], [2, 0]],
    2: [[5, 3], [3, 2], [4, 2]],
    3: [[5, 3], [6, 3], [4, 2]],
    4: [[9, 4], [6, 3], [4, 2]],
    5: [[9, 4], [6, 3], [4, 2]]
};

// What each ambition counts when it's scored
const ambitionResources = {
    tycoon: player => player.fuelValue + player.materialsValue,
    tyrant: player => player.captivesValue,
    warlord: player => player.trophiesValue,
    keeper: player => player.relicsValue,
    empath: player => player.psionicsValue
};

// Chance (%) of a bot declaring the ambition on the card it leads with: a base chance for
// the round, plus more for each resource it has towards that ambition, up to a maximum.
// A bot with none of the ambition's resources never declares it. Tune after play testing
const declareChanceByRound = { 1: 20, 2: 30, 3: 30, 4: 40, 5: 40 };
const declareChancePerResource = 10;
const declareChanceMax = 90;

// How each ambition is won, shown to the players
const ambitionConditions = {
    tycoon: "most fuel and materials",
    tyrant: "most captives",
    warlord: "most trophies",
    keeper: "most relics",
    empath: "most psionics"
};

function getAmbitionDeclaredMessage(ambition) {
    // e.g. "Warlord declared (most trophies)"
    return ambition.charAt(0).toUpperCase() + ambition.slice(1) + " declared (" + ambitionConditions[ambition] + ")";
}

// A player reaching this much power at the end of a round ends the game
const powerToWin = { 2: 33, 3: 30, 4: 27 };

// Battle dice, one entry per face. hits are hits on the defender, damage is damage to the
// attacker's own ships, and ambush means the defender hits first with all its fresh ships.
// Raid dice aren't used yet
const skirmishDieFaces = [
    { hits: 1 }, { hits: 1 }, { hits: 1 },
    {}, {}, {}
];
const assaultDieFaces = [
    {},
    { hits: 1, damage: 1 }, { hits: 1, damage: 1 },
    { hits: 2 },
    { hits: 2, damage: 1 },
    { hits: 1, ambush: true }
];

// An attacker rolls up to one die per ship, but no more than this many of each type
const maxDicePerType = 6;

// How bots make decisions. The aim is for a bot to feel like a person guessing and sometimes
// taking a risk, not a calculator. Bot personalities (#71) can later give each bot its own values.
// riskWeight: how much damage to its own ships matters compared with damage it deals
//             (1 = the same, lower is braver)
// moodSwing:  how much riskWeight varies from one decision to the next, so some battles it
//             feels bold and others careful (0.5 = up to half as much or half as much again)
// randomness: how loosely it picks between options. Higher means it more often goes with
//             something other than the best, though clearly bad options stay rare
//             (0 = always the best)
const defaultBotPersonality = { riskWeight: 1, moodSwing: 0.5, randomness: 0.6 };

// City bonus: the outright winner of an ambition (first place, not tied) gains extra power
// for the city slots uncovered on their player board: 2 with four cities, or 5 with all
// five (not both). Only cities count, not starports (rulebook p.18)
const cityBonus = { 4: 2, 5: 5 };

function getCityBonus(player) {
    // Players without city counts (e.g. in older saved games) get no bonus
    const cities = getCityCount(player) || 0;
    if (cities >= 5) { return cityBonus[5]; }
    if (cities >= 4) { return cityBonus[4]; }
    return 0;
}

// After scoring, everyone returns these when that ambition was scored (rulebook p.19)
const scoredAmbitionReturns = { warlord: "trophies", tyrant: "captives" };

function getRoundMarkers(round) {
    // Highest marker first, ranked by its first place value
    return ambitionMarkerValues[round].slice().sort((a, b) => b[0] - a[0]);
}

function scoreAmbition(counts, markers) {
    // counts is [{ player, count }]. Returns [{ player, points, cityBonus }] for each player who scores
    // - A player needs at least one matching resource to score
    // - Most scores first place, second most scores second place
    // - A tie for first: all tied players score second place and nobody else scores
    // - A tie for second: the tied players don't place and nobody scores second
    // - An outright first place also scores the city bonus (see cityBonus), once per ambition
    // Several markers on one ambition are scored together
    const firstPlacePoints = markers.reduce((sum, marker) => sum + marker[0], 0);
    const secondPlacePoints = markers.reduce((sum, marker) => sum + marker[1], 0);

    const eligible = counts.filter(c => c.count > 0);
    if (eligible.length == 0) { return []; }

    const highest = Math.max(...eligible.map(c => c.count));
    const first = eligible.filter(c => c.count == highest);

    if (first.length > 1) {
        return first.map(c => ({ player: c.player, points: secondPlacePoints, cityBonus: 0 }));
    }

    const bonus = getCityBonus(first[0].player);
    let results = [{ player: first[0].player, points: firstPlacePoints + bonus, cityBonus: bonus }];

    const rest = eligible.filter(c => c.count < highest);
    if (rest.length > 0) {
        const secondHighest = Math.max(...rest.map(c => c.count));
        const second = rest.filter(c => c.count == secondHighest);
        if (second.length == 1) {
            results.push({ player: second[0].player, points: secondPlacePoints, cityBonus: 0 });
        }
    }

    return results;
}

// The action each Yes/No question asks about, in the order the questions are asked.
// Question 1 is the first entry. The question text is in focus_tycoon, focus_tyrant etc.
const ambitionQuestionActions = {
    // materials and fuel: tax, secure, influence, raid
    TYCOON: ["tax", "secure", "influence", "battle"],
    // capture: tax a rival city, secure a card with rival agents, ransack the court
    TYRANT: ["tax", "secure", "battle"],
    // fight: battle, secure a weapons card, influence a weapons card
    WARLORD: ["battle", "secure", "influence"],
    // relics: tax, secure, influence, raid
    KEEPER: ["tax", "secure", "influence", "battle"],
    // psionics: tax, secure, influence, raid
    EMPATH: ["tax", "secure", "influence", "battle"]
};
