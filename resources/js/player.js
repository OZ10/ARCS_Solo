// Players: the player class, finding players and checks on whose turn it is.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

class player {
    constructor(number, isHuman) {
        this.number = number;
        this.isHuman = isHuman;
    }

    // Which of the four player colours in index.scss (1 yellow, 2 red, 3 white, 4 blue)
    colour = null;

    fuelValue = 0;
    materialsValue = 0;
    weaponsValue = 0;
    relicsValue = 0;
    psionicsValue = 0;
    captivesValue = 0;
    trophiesValue = 0;
    powerValue = 0;
    // Pieces on the board (see boardCounters)
    shipsBoardValue = 0;
    // Starports on the board (#130)
    starportsValue = 0;
    // This player's agents held by Rivals, as Captives and as Trophies (#123)
    agentsCaptive = 0;
    agentsTrophy = 0;
    // Its ships held as Rivals' Trophies, from the Battle window, until Warlord is scored (#160)
    shipsTrophy = 0;
    citiesFuelValue = 0;
    citiesMaterialsValue = 0;
    citiesWeaponsValue = 0;
    citiesRelicsValue = 0;
    citiesPsionicsValue = 0;
    // Everyone starts with one city on the map, but the app doesn't know which resource it's on
    // until a city tile is set during setup. It still counts towards the player's cities. With
    // Leaders it's how many such cities (0, 1 or 2), and true counts as 1
    startingCity = true;
    // Leaders & Lore (leaders.js): its Leader's number, its Lore cards' numbers, and cities
    // scrapped in setup, which open slots as if built but can't be built (the Anarchist)
    leader = null;
    lore = [];
    scrappedCities = 0;
    // Cities a Rival has destroyed and holds as Trophies. They don't go back on the player board
    // until those Trophies are returned, so the slots they uncovered stay open
    citiesAsTrophies = 0;
    // The resources this player has Outrage of (rulebook p.16)
    outraged = [];
    cards = [];
    // The numbers of the Guild cards held (see court.js)
    guildCards = [];
    hasInitiative = false;
    hasPlayedACardThisTurn = false;
    ambitionsEvaluated = [];
    // A bot's prelude this turn: { offers, spent } (prelude.js)
    prelude = null;
    // A bot's Guild card actions this turn: { offers, spent } (guildactions.js)
    guildActions = null;
    // A little variation in a bot's turn plan, set once a turn (turnplan.js)
    planVariation = null;
    // A bot's plan, set when its turn window first opens so it doesn't change as its steps are
    // carried out (#105, turnwindow.js)
    turnPlan = null;
    // Union cards placed this turn: [{ guild, card }], drawn when the turn ends (prelude.js)
    unionDraws = [];
    // Your prelude this turn, spent from your turn window (#127, prelude.js)
    preludeSpent = [];
    // Your actions on the board this turn, with what to undo (#160, boardhuman.js)
    boardActions = [];
    // A bot's answer this turn to "Can I build or repair anything?" (null until asked, see bot.js)
    canBuild = null;
    // The ambitions it was told it can't Tax for this turn (see answerNo in bot.js)
    noTax = [];
    // Whether it fancies a city on a new resource this turn, once rolled (see bot.js)
    newCityWanted = null;
    // Why it chose its card this turn: { type, ambition } (see describeBuildChange)
    playReason = null;
    // Why it's moving this turn, if the player said it could reach something (see answerYes)
    moveGoal = null;
    // Who it means to Battle this turn, once chosen (see getBattleTarget)
    battleTargetNumber = null;
    // In a campaign: the Free States, the Blight or the Empire to Battle this turn, once asked
    // (campaign/targets.js). undefined until asked, null for none
    campaignTarget = undefined;
    // The biggest fleet it could attack with this turn, once asked, and how it could Move first
    // ("card", "fuel" or null; see getFleetMove)
    attackFleetSize = null;
    attackFleetMove = null;
    // Why it played for an action without asking, as the plan's reason (see getKnownYesReason)
    focusReason = null;
    // What Farseers' swap did this turn, as { title, note } (see botFarseersSwap)
    farseersSwap = null;
    // What its Leader did this turn, as [{ title, note }] (see leaderrules.js)
    leaderNotes = [];
    // What a bot would build this turn, worked out before asking (#126, see getBuildIntent)
    buildIntent = null;
    // A bot's answer this turn to "Have I run out of ships to build?" (#129)
    outOfShips = null;
    // A bot's answer this turn to "Do I have any agents left in my supply?", as true for none (#123)
    agentsOut = null;
    // In a campaign: its answers this turn to its Fate's questions (campaign/steering.js), by question
    steerAnswers = {};
}

function getPlayerColour(player) {
    // Games saved before the colour could be chosen went by player number
    return player.colour || player.number;
}

// Everything counted with -/+ tiles on a player's panel. Each is stored on the player as
// <name>Value (e.g. fuelValue, citiesFuelValue)
const resourceCounters = ["fuel", "materials", "weapons", "relics", "psionics", "captives", "trophies", "power"];

// The player's pieces on the board: their ships, and how many
// of their cities are on each resource type
const boardCounters = ["shipsBoard", "starports", "citiesFuel", "citiesMaterials", "citiesWeapons", "citiesRelics", "citiesPsionics"];
const cityCounters = ["citiesFuel", "citiesMaterials", "citiesWeapons", "citiesRelics", "citiesPsionics"];

const playerCounters = resourceCounters.concat(boardCounters);

function getCityCount(player) {
    return cityCounters.reduce((total, counter) => total + player[counter + "Value"], 0) + Number(player.startingCity || 0);
}

function getUncoveredCities(player) {
    // How many city slots are open on a player's board: their cities on the map, and any held
    // as a Rival's Trophies
    // In a campaign, cities in a Flagship's Upgrade and Armor slots open slots too (#85)
    const flagshipCities = typeof getFlagshipCities == "function" ? getFlagshipCities(player) : 0;
    return getCityCount(player) + (player.citiesAsTrophies || 0) + (player.scrappedCities || 0) + flagshipCities;
}

function hasPlayerGotCardsToPlay(player) {
    if (getUnplayedCards(player.cards).length == 0) {
        // Player has no cards left to play so will
        // move to the next player
        player.hasPlayedACardThisTurn = true;
        return false;
    }

    return true;
}

function resetPlayedThisTurn() {
    players.forEach(player => {
        player.hasPlayedACardThisTurn = false;
        player.prelude = null;
        player.preludeSpent = [];
        player.boardActions = [];
        player.guildActions = null;
        player.planVariation = null;
        player.turnPlan = null;
        // The Planet Breaker's Prepare this turn (campaign/fateboard.js)
        player.preparedThisTurn = false;
        player.canBuild = null;
        player.hasSlotForCity = null;
        player.noTax = [];
        player.newCityWanted = null;
        player.playReason = null;
        player.moveGoal = null;
        player.battleTargetNumber = null;
        player.campaignTarget = undefined;
        player.attackFleetSize = null;
        player.attackFleetMove = null;
        player.focusReason = null;
        player.farseersSwap = null;
        player.buildIntent = null;
        player.outOfShips = null;
        player.agentsOut = null;
        player.leaderNotes = [];
        player.steerAnswers = {};
    })
}

function resetPlayersCards() {
    players.forEach(player => {
        player.cards = [];
    });
}

function resetPlayersAmibtions() {
    players.forEach(player => {
        player.ambitionsEvaluated = [];
    });
}

function getPlayerWithInitiative() {
    let player;
    for (let playerNumber = 0; playerNumber < players.length; playerNumber++) {
        if (players[playerNumber].hasInitiative) {
            player = players[playerNumber];
        };
    }
    return player;
}

function getPlayer(playerNumber) {
    let returnplayer = null;
    players.forEach(player => {
        if (player.number == playerNumber) {
            returnplayer = player;
        }
    })

    return returnplayer;
}

function haveAllPlayersPlayedACard() {
    for (let playerNumber = 0; playerNumber < players.length; playerNumber++) {
        if (players[playerNumber].hasPlayedACardThisTurn == false) { return false; }
    }
    return true;
}

function getNextPlayer(previousPlayerNumber) {

    if (previousPlayerNumber > players.length - 1) {
        return players[0];
    } else {
        return players[previousPlayerNumber];
    }
}

function getPlayerNumberFromString(s) {
    return s.slice(s.length - 1);
}

function getPlayerNumberFromElement(ele) {
    return ele.parentNode.parentNode.id.slice(ele.parentNode.parentNode.id.length - 1);
}
