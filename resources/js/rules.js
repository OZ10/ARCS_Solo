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

// What each ambition counts when it's scored: resources, plus the matching icons on the
// player's Guild cards (getGuildIconCount in court.js)
const ambitionResources = {
    tycoon: player => player.fuelValue + player.materialsValue + getGuildIconCount(player, "fuel") + getGuildIconCount(player, "materials"),
    tyrant: player => player.captivesValue,
    warlord: player => player.trophiesValue,
    keeper: player => player.relicsValue + getGuildIconCount(player, "relics"),
    empath: player => player.psionicsValue + getGuildIconCount(player, "psionics")
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
// attacker's own ships, and ambush means the defender hits first with all its fresh ships
// (on the raid die this is the intercept symbol). keys are for stealing, and buildingHits go
// straight to the defender's buildings
const skirmishDieFaces = [
    { hits: 1 }, { hits: 1 }, { hits: 1 },
    {}, {}, {}
];
const raidDieFaces = [
    { ambush: true },
    { ambush: true, keys: 2 },
    { damage: 1, buildingHits: 1 }, { damage: 1, buildingHits: 1 },
    { damage: 1, keys: 1 },
    { buildingHits: 1, keys: 1 }
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
// buildingWeight: how much it wants to avoid hitting the defender's buildings, which take
//             any hits left over once every defending ship is destroyed. Destroying a
//             building causes Outrage (1 = a hit on a building cancels out a hit on a ship,
//             0 = doesn't mind)
// raidWeight: how much stealing something it wants matters, in hits on ships
const defaultBotPersonality = { riskWeight: 1, moodSwing: 0.5, randomness: 0.6, buildingWeight: 1, raidWeight: 3 };

// How much more or less it values stealing something, by how much it needs it (getResourceNeed):
// nothing it's after, an ambition that could still be declared, an ambition it's chasing
const raidNeedFactor = [0.5, 1, 1.5];

// Prelude (#72): before its card's actions a bot may spend resources for extra actions.
// What each resource gives, and the ambition it counts towards (weapons count towards none)
const preludeResources = ["materials", "fuel", "relics", "weapons", "psionics"];
const preludeResourceNames = { materials: "Material", fuel: "Fuel", relics: "Relic", weapons: "Weapon", psionics: "Psionic" };
const preludeAmbitions = { materials: "tycoon", fuel: "tycoon", relics: "keeper", psionics: "empath" };

// At most this many of each resource type a turn. Could be raised later
const maxPreludePerResource = 1;

// A bot keeps a resource it could use to chase an ambition: when spending one would cost it a
// place, or this many more would gain it one
const preludeReachGap = 2;

// In the first few turns of a round an undeclared ambition doesn't hold a bot back from
// spending. After that it might still be declared, so the bot keeps what it could chase it with
const preludeEarlyTurns = 2;

// A bot with this many ships on the board is keen to battle
const manyShipsOnBoard = 6;

// Build (#75): a bot with fewer ships than this on the board might build a ship (or a
// starport to build them at) rather than a building it doesn't need
const fewShipsOnBoard = 5;

// The chance (%) of a bot offering each prelude action. These could become part of the bot
// personalities (#71)
const preludeChance = {
    spare: 60,              // a material, fuel or relic it can spare
    weaponsHavoc: 10,       // a weapon, just to cause some havoc
    weaponsWarlord: 70,     // + chasing Warlord
    weaponsManyShips: 40,   // + lots of ships on the board
    weaponsSaveTrophies: 15,// + lots of ships and Warlord could still be declared, so trophies now could count later
    psionicsFollowing: 40,  // a psionic for an action from the lead card, when it didn't lead
    psionicsBattle: 20,     // + the lead card battles and the bot is keen to battle
    psionicsWarlord: 45,    // when it led: an extra battle, chasing Warlord
    psionicsManyShips: 35,  // when it led: an extra battle, lots of ships on the board
    // The bot's own Guild cards (see court.js)
    seize: 30,              // Lattice Spies: seize the initiative
    gateShips: 25,          // Gatekeepers: a ship in each gate, when keen to battle
    placeShips: 20,         // Prison Wardens, Skirmishers, Court Enforcers, Loyal Marines: 3 ships, when keen to battle
    gainSupply: 50,         // Mining or Shipping Interest: fill empty slots, when chasing Tycoon
    elderBroker: 40,        // Elder Broker: a material, fuel and weapon, when it can spare the relic icon
    relicFence: 50,         // Relic Fence: a spare resource for a relic, when chasing Keeper
    steal: 25,              // Silver-Tongues: steal a Guild card or resource
    union: 60,              // Admin, Construction, Spacing or Arms Union: draw a played card
    max: 90
};

// The chance (%) of a bot offering each Guild card action (see guildactions.js). These could
// also become part of the bot personalities (#71)
const guildActionChance = {
    abduct: 50,             // Abduct instead of a Battle
    abductTyrant: 40,       // + chasing Tyrant
    execute: 25,            // Execute instead of an Influence
    executeWarlord: 45,     // + chasing Warlord
    pressgang: 50,          // Pressgang instead of a Build
    gainResource: 40,       // Manufacture or Synthesize instead of a Build
    gainResourceTycoon: 30, // + chasing Tycoon
    trade: 40               // Trade instead of a Tax
};

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

// 2 players: the 6 resources from the out-of-play planets sit on the matching ambition boxes
// (fuel and material on Tycoon, weapons on Warlord as trophies, relics on Keeper, psionics
// on Empath) and are scored as a third player who gains no power (rulebook p.4, p.19)
const neutralAmbitions = ["tycoon", "warlord", "keeper", "empath"];
const neutralPlayer = { number: "neutral", isNeutral: true };

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
    // - The 2 player neutral (neutralPlayer) places like anyone else, but its points aren't added
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

    const bonus = first[0].player.isNeutral ? 0 : getCityBonus(first[0].player);
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
