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

function getRoundMarkers(round) {
    // Highest marker first, ranked by its first place value
    return ambitionMarkerValues[round].slice().sort((a, b) => b[0] - a[0]);
}

function scoreAmbition(counts, markers) {
    // counts is [{ player, count }]. Returns [{ player, points }] for each player who scores
    // - A player needs at least one matching resource to score
    // - Most scores first place, second most scores second place
    // - A tie for first: all tied players score second place and nobody else scores
    // - A tie for second: all tied players score second place
    // Several markers on one ambition are scored together
    const firstPlacePoints = markers.reduce((sum, marker) => sum + marker[0], 0);
    const secondPlacePoints = markers.reduce((sum, marker) => sum + marker[1], 0);

    const eligible = counts.filter(c => c.count > 0);
    if (eligible.length == 0) { return []; }

    const highest = Math.max(...eligible.map(c => c.count));
    const first = eligible.filter(c => c.count == highest);

    if (first.length > 1) {
        return first.map(c => ({ player: c.player, points: secondPlacePoints }));
    }

    let results = [{ player: first[0].player, points: firstPlacePoints }];

    const rest = eligible.filter(c => c.count < highest);
    if (rest.length > 0) {
        const secondHighest = Math.max(...rest.map(c => c.count));
        rest.filter(c => c.count == secondHighest).forEach(c => {
            results.push({ player: c.player, points: secondPlacePoints });
        });
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
