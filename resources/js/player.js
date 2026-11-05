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
    citiesFuelValue = 0;
    citiesMaterialsValue = 0;
    citiesWeaponsValue = 0;
    citiesRelicsValue = 0;
    citiesPsionicsValue = 0;
    // Everyone starts with one city on the map, but the app doesn't know which resource it's on
    // until a city tile is set during setup. It still counts towards the player's cities
    startingCity = true;
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
    // Union cards placed this turn: [{ guild, card }], drawn when the turn ends (prelude.js)
    unionDraws = [];
    // A bot's answer this turn to "Can I build or repair anything?" (null until asked, see bot.js)
    canBuild = null;
    // The ambitions it was told it can't Tax for this turn (see answerNo in bot.js)
    noTax = [];
    // Whether it fancies a city on a new resource this turn, once rolled (see bot.js)
    newCityWanted = null;
    // Why it chose its card this turn: { type, ambition } (see describeBuildChange)
    playReason = null;
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
const boardCounters = ["shipsBoard", "citiesFuel", "citiesMaterials", "citiesWeapons", "citiesRelics", "citiesPsionics"];
const cityCounters = ["citiesFuel", "citiesMaterials", "citiesWeapons", "citiesRelics", "citiesPsionics"];

const playerCounters = resourceCounters.concat(boardCounters);

function getCityCount(player) {
    return cityCounters.reduce((total, counter) => total + player[counter + "Value"], 0) + (player.startingCity ? 1 : 0);
}

function getUncoveredCities(player) {
    // How many city slots are open on a player's board: their cities on the map, and any held
    // as a Rival's Trophies
    return getCityCount(player) + (player.citiesAsTrophies || 0);
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
        player.guildActions = null;
        player.planVariation = null;
        player.canBuild = null;
        player.noTax = [];
        player.newCityWanted = null;
        player.playReason = null;
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
