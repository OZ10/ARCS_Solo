// Saving and loading the game (localStorage).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function loadPlayers() {
    for (let playerNumber = 1; playerNumber < 5; playerNumber++) {

        const player = getSettingObject(playerNumber);
        if (player != null) {
            // Games saved before power or the board counts were tracked won't have them
            playerCounters.forEach(counter => {
                if (player[counter + "Value"] == null) { player[counter + "Value"] = 0; }
            });

            players.push(player);
            clonePlayerNodeAndSetup(player);
        }
    }
    if (awaitingDone != null) {
        // A player had played their card and was carrying out their actions, so they're
        // still the current player until Done is tapped
        currentPlayer = getPlayer(awaitingDone);
        changeInitiative(getPlayerWithInitiative());
        enableDisablePlayerPanels(currentPlayer.number);
    } else if (haveAllPlayersPlayedACard() == true) {
        // setCurrentPlayer isn't used when everyone has played, so show
        // the initiative star and give currentPlayer a value here
        currentPlayer = getPlayerWithInitiative();
        changeInitiative(currentPlayer);
        enableNextTurnButton();
    } else {
        setCurrentPlayer(findCurrentPlayer());
    }

    createCardButtonsForHumanPlayer();

    // Show Done again (and switch off the human's cards) for a player who was mid-actions
    if (awaitingDone != null) { finishPlay(currentPlayer); }
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
    SaveSetting("awaitingDone", (awaitingDone == null) ? "" : awaitingDone);
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

// Saving the game to a file and loading it back (the Save and Load buttons in the
// Options window). The file holds everything the game saves to localStorage

// A game read from a file, waiting for the player to confirm loading it
let pendingGameLoad = null;

function setupSavedGameButtons() {
    document.getElementById("numberOfPlayersModal").addEventListener('show.bs.modal', () => {
        // Save is only available when there's a game to save
        enableDisableButton("saveGame", !hasSavedGame());

        // Start with the player count for a new game closed
        bootstrap.Collapse.getOrCreateInstance(document.getElementById("newGamePlayers"), { toggle: false }).hide();
    });
}

function hasSavedGame() {
    return localStorage.getItem("1") != null;
}

function saveGameToFile() {
    if (!hasSavedGame()) { return; }

    SaveAllSettings();

    let data = {};
    for (let [key, value] of Object.entries(localStorage)) {
        // The undo copy is only for this device
        if (key != undoKey) { data[key] = value; }
    }

    const exported = new Date();
    const file = {
        app: "ARCS Bot",
        version: document.getElementById("appVersion").textContent,
        exported: exported.toISOString(),
        data: data
    };

    // e.g. ARCS-2026-11-01-R3T2.json, using the local date
    const twoDigits = n => String(n).padStart(2, "0");
    const date = exported.getFullYear() + "-" + twoDigits(exported.getMonth() + 1) + "-" + twoDigits(exported.getDate());
    const name = "ARCS-" + date + "-R" + roundNumber + "T" + turnNumber + ".json";

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }));
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    showMessageToast("Game saved", name);
}

function chooseGameFile() {
    const input = document.getElementById("loadGameFile");
    // Cleared so choosing the same file again still counts as a change
    input.value = "";
    input.click();
}

function loadGameFile(input) {
    const file = input.files[0];
    if (file == null) { return; }

    const reader = new FileReader();
    reader.onload = () => {
        let game = null;
        try { game = JSON.parse(reader.result); } catch (e) { game = null; }

        if (!isGameFile(game)) {
            showMessageToast("Load Game", "That file isn't an ARCS Bot saved game");
            return;
        }

        pendingGameLoad = game;

        const numberOfPlayers = [1, 2, 3, 4].filter(n => game.data[n] != null).length;
        const exported = (game.exported != null) ? new Date(game.exported).toLocaleString() : "on an unknown date";
        document.getElementById("loadGameMessage").innerHTML = numberOfPlayers + " players, round " + game.data.round + ", turn " + game.data.turn
            + "<br><small class=\"text-muted\">Saved " + exported + (game.version != null ? " (" + game.version + ")" : "")
            + ". This replaces the current game.</small>";

        // Close the Options window first, as a modal can't open while another is closing
        const newGameModal = document.getElementById("numberOfPlayersModal");
        const showLoadModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("loadGameModal")).show();
        if (newGameModal.classList.contains("show")) {
            newGameModal.addEventListener('hidden.bs.modal', showLoadModal, { once: true });
            bootstrap.Modal.getOrCreateInstance(newGameModal).hide();
        } else {
            showLoadModal();
        }
    };
    reader.readAsText(file);
}

function isGameFile(game) {
    // A saved game has at least two players, plus the turn and round
    if (game == null || typeof game != "object" || game.data == null || typeof game.data != "object") { return false; }
    if (game.data.turn == null || game.data.round == null) { return false; }

    try {
        return JSON.parse(game.data["1"]) != null && JSON.parse(game.data["2"]) != null;
    } catch (e) {
        return false;
    }
}

function confirmLoadGame() {
    if (pendingGameLoad == null) { return; }

    // Replace the saved game with the one from the file and reload, so the game is
    // rebuilt by the normal loading code
    localStorage.clear();
    Object.entries(pendingGameLoad.data).forEach(([key, value]) => localStorage.setItem(key, value));
    location.reload();
}
