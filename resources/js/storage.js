// Saving and loading the game (localStorage).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function loadPlayers() {
    for (let playerNumber = 1; playerNumber < 5; playerNumber++) {

        const player = getSettingObject(playerNumber);
        if (player != null) {
            // Games saved before power was tracked won't have it
            if (player.powerValue == null) { player.powerValue = 0; }

            players.push(player);
            clonePlayerNodeAndSetup(player);
        }
    }
    if (haveAllPlayersPlayedACard() == true) {
        // setCurrentPlayer isn't used when everyone has played, so show
        // the initiative star and give currentPlayer a value here
        currentPlayer = getPlayerWithInitiative();
        changeInitiative(currentPlayer);
        enableNextTurnButton();
    } else {
        setCurrentPlayer(findCurrentPlayer());
    }

    createCardButtonsForHumanPlayer();
}

function findCurrentPlayer() {

    let player = getPlayerWithInitiative();

    changeInitiative(player);

    if (player.hasPlayedACardThisTurn == false) {
        return player;
    } else {
        // Loop through all the players looking for the next player who hasn't played a card
        for (let playerNumber = player.number; playerNumber < players.length + 1; playerNumber++) {
            player = players[playerNumber];
            if (playerNumber > players.length - 1) {
                playerNumber = -1
            } else {
                if (player.hasPlayedACardThisTurn == false) {
                    return player;
                }
            }
        }
    }
}

function loadPlayedCardList() {
    const cardlist = getSettingObject('playedCardList');

    if (cardlist != null) {
        cardlist.forEach(card => {
            addPlayedCardToList(card, card.playedAction, card.cardAction, false);
        })
    }
}

function loadDiscardPile() {
    const pile = getSettingObject('discardPile');

    if (pile != null) {
        discardPile = pile;
    }
}

function loadAmbitions() {
    const ambitions = getSettingObject('ambitions');

    if (ambitions != null) {
        ambitions.forEach(ambition => {
            declaredAmbitions.push(ambition);
        })
    }

    updateAmbitionsDisplay();
}



const GetSettingsByValue = (val, includes = false) => {
    let settings = new Array();
    for (let [key, value] of Object.entries(localStorage)) {
        if (includes && value.includes(val)) {
            settings.push(key + "," + value);
        } else if (value == val) {
            settings.push(key + "," + value);
        }
    }
    return settings;
};

const GetSettingsByKey = (val, includes = false) => {
    let settings = new Array();
    for (let [key, value] of Object.entries(localStorage)) {
        if (includes && key.includes(val)) {
            settings.push(key + "," + value);
        } else if (key == val) {
            settings.push(key + "," + value);
        }
    }
    return settings;
};

const GetSettingValueByKey = (keytofind) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (key == keytofind) {
            return value;
        }
    }

    return "";
};

const SaveSetting = (key, value) => {
    localStorage.setItem(key, value);
};

const SaveSettings = (settings) => {
    for (let [key, value] of Object.entries(settings)) {
        localStorage.setItem(key, value);
    }

};

const SaveAllSettings = () => {
    savePlayers();
    saveSettingObject('ambitions', declaredAmbitions);
    saveSettingObject('discardPile', discardPile);
    SaveSetting("turn", turnNumber);
    SaveSetting("round", roundNumber);
    SaveSetting("initiaiteClaimed", hasInitiativeBeenClaimedThisTurn);
}

const saveSettingObject = (settingName, settingObject) => {
    localStorage.setItem(settingName, JSON.stringify(settingObject));
};

const getSettingObject = (settingName) => {
    return JSON.parse(localStorage.getItem(settingName));
};

const RemoveSettingByKey = (k) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (key === k) {
            localStorage.removeItem(key);
        }
    }
};

const RemoveSettingByValue = (val) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (value === val) {
            localStorage.removeItem(key);
        }
    }
};

function savePlayers() {
    players.forEach(player => {
        saveSettingObject(player.number, player);
    });
}

function saveAmbitions() {
    declaredAmbitions.forEach(ambition => {
        saveSettingObject(ambition, ambition);
    })
}
