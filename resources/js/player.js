// Players: the player class, finding players and checks on whose turn it is.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

class player {
    constructor(number, isHuman) {
        this.number = number;
        this.isHuman = isHuman;
    }

    fuelValue = 0;
    materialsValue = 0;
    weaponsValue = 0;
    relicsValue = 0;
    psionicsValue = 0;
    captivesValue = 0;
    trophiesValue = 0;
    powerValue = 0;
    // Pieces on the board (see boardCounters)
    shipsSupplyValue = 0;
    shipsBoardValue = 0;
    citiesFuelValue = 0;
    citiesMaterialsValue = 0;
    citiesWeaponsValue = 0;
    citiesRelicsValue = 0;
    citiesPsionicsValue = 0;
    cards = [];
    // The numbers of the Guild cards held (see court.js)
    guildCards = [];
    hasInitiative = false;
    hasPlayedACardThisTurn = false;
    ambitionsEvaluated = [];
    // A bot's prelude this turn: { offers, spent } (prelude.js)
    prelude = null;
}

// Everything counted with -/+ tiles on a player's panel. Each is stored on the player as
// <name>Value (e.g. fuelValue, citiesFuelValue)
const resourceCounters = ["fuel", "materials", "weapons", "relics", "psionics", "captives", "trophies", "power"];

// The player's pieces on the board: ships in their supply and on the board, and how many
// of their cities are on each resource type
const boardCounters = ["shipsSupply", "shipsBoard", "citiesFuel", "citiesMaterials", "citiesWeapons", "citiesRelics", "citiesPsionics"];
const cityCounters = ["citiesFuel", "citiesMaterials", "citiesWeapons", "citiesRelics", "citiesPsionics"];

const playerCounters = resourceCounters.concat(boardCounters);

function getCityCount(player) {
    return cityCounters.reduce((total, counter) => total + player[counter + "Value"], 0);
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
