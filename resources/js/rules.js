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
// buildingWeight: how much what it would gain or lose by destroying the defender's buildings
//             matters (see buildingValues). They take any hits left over once every defending
//             ship is destroyed (1 = as buildingValues says, 0 = doesn't mind)
// raidWeight: how much stealing something it wants matters, in hits on ships
// (randomness was 0.6, which made it nearly random between raids that scored about the same, #113)
const defaultBotPersonality = { riskWeight: 1, moodSwing: 0.5, randomness: 0.3, buildingWeight: 1, raidWeight: 3 };

// What destroying a building is worth to the attacker, in hits on ships (see getBuildingValue).
// resourceLost and guildCardLost are for each one Outrage discards, by how much it needs that
// resource (getResourceNeed). These could also become part of the bot personalities (#71)
const buildingValues = {
    trophy: 1,              // + the building as a Trophy
    trophyWarlord: 2,       // + instead, when chasing Warlord
    ransackFactor: 0.5,     // + this much of the market value of the best card it could Ransack
    ransackUnknown: 1,      // + instead, when the market hasn't been entered, so there might be one
    resourceLost: [0.5, 1, 2],
    guildCardLost: [1, 2, 3],
    preludeLost: 1.5        // - no longer being able to spend that resource for its Prelude action
};

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

// How many ships each player starts with on the board (rulebook p.5): 3 + 3 + 2, or another 2
// with 2 players
const startingShips = { 2: 10, 3: 8, 4: 8 };

// A bot with this many ships on the board is keen to battle
const manyShipsOnBoard = 10;

// Build (#75): a bot with fewer ships than this on the board might build a ship (or a
// starport to build them at) rather than a building it doesn't need
const fewShipsOnBoard = 5;

// The chance (%) of a bot offering each prelude action. These could become part of the bot
// personalities (#71)
// When a bot decides a prelude spend itself, rather than leaving it to the player (see prelude.js)
const preludeDecision = {
    relicCost: [0.5, 1.5, 3],   // what spending a Relic to Secure costs it, by how much it needs relics (getResourceNeed)
    rivalCaptives: 3            // a Rival with this many Captives makes Tyrant worth thinking about
};

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
    songOfFreedom: 40,      // Song of Freedom: return one of its own cities to seize the initiative
    farseers: 40,           // Farseers: discard cards to draw from the bottom of the discard pile
    galacticBards: 70,      // Galactic Bards: declare the ambition on the card it surpassed or pivoted with
    cartelSteal: 15,        // Material or Fuel Cartel: give up the supply to steal 1, when chasing Tycoon
    max: 90
};

// Turn plan (see turnplan.js): how much a bot wants each action on its card. These could also
// become part of the bot personalities (#71)
const turnPlanWeights = {
    // What each action starts at
    move: 1, battle: 1, secure: 2, influence: 1.5, tax: 1, build: 1.5, repair: 0.5,
    focus: 5,               // + what the player said it can do, in the Yes/No questions
    battleWarlord: 3,       // + chasing Warlord
    battleTyrant: 2,        // + chasing Tyrant
    battleManyShips: 1.5,   // + lots of ships on the board
    secureLastCard: 1,      // + its last card, so its last chance this round
    secureWanted: 1,        // + there's a resource it wants a card for
    influenceWanted: 0.5,   // + there's a resource it wants a card for
    taxTyrant: 2,           // + chasing Tyrant, as taxing a Rival's city captures
    taxPerNeed: 1.5,        // + for each level of need for the resource it would tax (getResourceNeed)
    buildFewShips: 1.5,     // + short of ships
    buildNearBonus: 1,      // + 1 or 2 cities short of a city bonus
    repairFewShips: 1,      // + short of ships
    repairManyShips: 1,     // - lots of ships on the board
    repairWarlord: 1,       // + Warlord is declared, as damaged ships are easy Trophies
    moveForBattle: 1.5,     // + a first Move, when it's also going to Battle
    moveGoal: 1.5,          // + a Move with a goal: a Rival to tax or raid, or a slot for a city it wants
    repeat: 1.5,            // - for each time the action is already in the plan
    variation: 1            // + up to this much at random per action, set once a turn
};
const planImpossible = -100;

// Who a bot would rather Battle (see getBattleTarget). These could also become part of the bot
// personalities (#71)
const battleTargetWeights = {
    holding: 2,             // + each resource or Guild card they hold of what it's chasing, to raid
    leader: 2,              // + they're ahead of everyone on Power
    power: 0.1,             // + each Power they have
    ship: 0.1,              // + each ship they have on the board
    shipWarlord: 0.5,       // + each ship they have on the board instead, when chasing Warlord
    variation: 1            // + up to this much at random per Rival, set once a turn
};

// The order to take the actions in, whichever are chosen
const turnPlanOrder = ["move", "battle", "influence", "secure", "tax", "build", "repair"];

// 2 players: the player without the initiative may swap their hand for 6 new cards (rulebook
// p.19). A bot does if the average number on its cards is below this
const mulliganBelow = 3.5;

// Farseers' swap (see getCardWorth): what a card in a Rival's hand is worth to a bot. It swaps if
// the best is worth this much more than its least useful card. These could also become part of
// the bot personalities (#71)
const farseersWeights = {
    ambition: 3,            // + the ambition on it, if it's chasing that one and could still declare it
    action: 2,              // + an action it needs (Battle for Warlord, Tax, Secure or Influence, Build)
    number: 0.2,            // + each point of its number, which wins the initiative
    gain: 1                 // how much better the card it takes must be
};

// Farseers: a bot swaps cards with this number or lower
const farseersLowCard = 3;

// The resource slots on a player board: the keys it takes to steal from each, and how many
// cities must be built to uncover it. Slots 5 and 6 are uncovered by the same city
const resourceSlots = [
    { slot: 1, keys: 3, cities: 0 },
    { slot: 2, keys: 1, cities: 0 },
    { slot: 3, keys: 1, cities: 1 },
    { slot: 4, keys: 2, cities: 2 },
    { slot: 5, keys: 1, cities: 3 },
    { slot: 6, keys: 3, cities: 3 }
];

// How many cards are in the Court market, by number of players (rulebook p.4)
const openingCourtCards = { 2: 3, 3: 4, 4: 4 };

// How much a bot wants a card in the Court market (see market.js). Generic values by card type,
// rather than each card's text. These could also become part of the bot personalities (#71)
const marketValues = {
    base: 1,
    perNeed: 1.5,           // + a Guild card, for each level of need for its icon (getResourceNeed)
    captive: 0.25,          // + each Rival agent it would capture
    captiveTyrant: 1.5,     // + each Rival agent it would capture, when chasing Tyrant
    // + a Vox card, by what it does: Mass Uprising, Populist Demands, Outrage Spreads,
    // Song of Freedom, Guild Struggle, Call to Action
    vox: { 26: 1.5, 27: 2, 28: 0.5, 29: 1, 30: 1.5, 31: 1 }
};

// The chance (%) a turn that a bot wants a city on a resource it has no city on, when no declared
// ambition calls for it (#92). This could also become part of the bot personalities (#71)
const newCityChance = 40;

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
    const cities = getUncoveredCities(player) || 0;
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

function scoreAmbition(counts, markers, ambition) {
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
        return applyLeaderScoring(first.map(c => ({ player: c.player, points: secondPlacePoints, cityBonus: 0, place: 2 })), ambition, secondPlacePoints);
    }

    const bonus = first[0].player.isNeutral ? 0 : getCityBonus(first[0].player);
    let results = [{ player: first[0].player, points: firstPlacePoints + bonus, cityBonus: bonus, place: 1 }];

    const rest = eligible.filter(c => c.count < highest);
    if (rest.length > 0) {
        const secondHighest = Math.max(...rest.map(c => c.count));
        const second = rest.filter(c => c.count == secondHighest);
        if (second.length == 1) {
            results.push({ player: second[0].player, points: secondPlacePoints, cityBonus: 0, place: 2 });
        }
    }

    // Some Leaders change what they score (leaderrules.js)
    return applyLeaderScoring(results, ambition, secondPlacePoints);
}

// The action each Yes/No question asks about, in the order the questions are asked.
// Question 1 is the first entry. The question text is in focus_tycoon, focus_tyrant etc.
// How many tokens of each resource there are (rulebook p.4)
const resourceTokens = 5;

// The resources each ambition's Tax question is about (Tyrant's is any Rival's city)
const ambitionTaxResources = { TYCOON: ["materials", "fuel"], KEEPER: ["relics"], EMPATH: ["psionics"] };

// The questions for each ambition, in order. reachTax, reachRaid and reachBattle ask if it can
// move into position for that, straight after a No to doing it now (#102)
const ambitionQuestionActions = {
    // materials and fuel: tax, secure, influence, raid
    TYCOON: ["tax", "reachTax", "secure", "influence", "battle", "reachRaid"],
    // capture: tax a rival city, secure a card with rival agents, ransack the court
    TYRANT: ["tax", "reachTax", "secure", "battle"],
    // fight: battle, secure a weapons card, influence a weapons card
    WARLORD: ["battle", "reachBattle", "secure", "influence"],
    // relics: tax, secure, influence, raid
    KEEPER: ["tax", "reachTax", "secure", "influence", "battle", "reachRaid"],
    // psionics: tax, secure, influence, raid
    EMPATH: ["tax", "reachTax", "secure", "influence", "battle", "reachRaid"]
};

// What each question says. The reach questions depend on the game (see getReachQuestion)
const ambitionQuestionText = {
    TYCOON: {
        tax: "Can I tax a city for materials or fuel?",
        secure: "Is there a materials or fuel card in the market I can secure?",
        influence: "Is there a materials or fuel card in the market I can influence?",
        battle: "Can I raid a city for materials or fuel?"
    },
    TYRANT: {
        tax: "Can I tax a rival's city to capture?",
        secure: "Is there a card in the market with rival agents on it that I can secure?",
        battle: "Can I destroy a city to ransack the court?"
    },
    WARLORD: {
        battle: "Can I battle a rival?",
        secure: "Is there a weapons card in the market I can secure?",
        influence: "Is there a weapons card in the market I can influence?"
    },
    KEEPER: {
        tax: "Can I tax a city for a relic?",
        secure: "Is there a relic card in the market I can secure?",
        influence: "Is there a relic card in the market I can influence?",
        battle: "Can I raid a city for a relic?"
    },
    EMPATH: {
        tax: "Can I tax a city for a psionic?",
        secure: "Is there a psionic card in the market I can secure?",
        influence: "Is there a psionic card in the market I can influence?",
        battle: "Can I raid a city for a psionic?"
    }
};

// "it has one, and fuel is left": why it's taxing its own city without asking (#104)
const resourceLeftWords = { fuel: "fuel is left", materials: "materials are left", relics: "relics are left", psionics: "psionics are left", weapons: "weapons are left" };

// How each ambition's resources read in a sentence
const ambitionResourceWords = { TYCOON: "materials or fuel", KEEPER: "relics", EMPATH: "psionics" };
