// Undo of the last card played.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// A single undo of the last card played. Just before a card is played, the saved game is
// copied. Undo puts that copy back, so everything the app did since is reversed, then replays
// what the player changed by hand since (tile taps, Guild cards, the Court), because those track
// the physical board. It then reloads the page, so the game is rebuilt by the normal loading
// code. Keeping a list of copies would allow more than one undo later
const undoKey = "undo";

function saveUndoPoint(playerNumber) {
    SaveAllSettings();

    let saved = {};
    for (let [key, value] of Object.entries(localStorage)) {
        if (key != undoKey) { saved[key] = value; }
    }

    localStorage.setItem(undoKey, JSON.stringify({ playerNumber: playerNumber, round: roundNumber, turn: turnNumber, saved: saved, manual: [] }));
    updateUndoButton();
}

function logManualChange(change) {
    // Something the player changed by hand since the card, to keep if the card is undone
    const undo = getUndoPoint();
    if (undo == null) { return; }
    undo.manual = (undo.manual || []).concat(change);
    saveSettingObject(undoKey, undo);
}

function getUndoPoint() {
    return getSettingObject(undoKey);
}

function clearUndoPoint() {
    RemoveSettingByKey(undoKey);
    updateUndoButton();
}

function updateUndoButton() {
    enableDisableButton("undo", getUndoPoint() == null);
}

function showUndoModal() {
    const undo = getUndoPoint();
    if (undo == null) { return; }

    document.getElementById("undoMessage").innerHTML = "Undo " + tagPlayerNames("Player " + undo.playerNumber + "'s") + " card in round " + undo.round + ", turn " + undo.turn + "?"
        + "<br><small class=\"text-muted\">Everything the app did since is reversed. What you've changed by hand stays.</small>";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("undoModal")).show();
}

function undoLastCard() {
    const undo = getUndoPoint();
    if (undo == null) { return; }

    // What the player changed by hand since, on top of the copy
    const savedPlayers = {};
    players.forEach(player => { if (undo.saved[player.number] != null) { savedPlayers[player.number] = JSON.parse(undo.saved[player.number]); } });
    let market = JSON.parse(undo.saved.courtMarket || "[]");

    (undo.manual || []).forEach(change => {
        const player = savedPlayers[change.player];
        switch (change.type) {
            case "counter":
                player[change.counter + "Value"] = Math.max((player[change.counter + "Value"] || 0) + change.amount, 0);
                break;
            case "startingCity":
                player.startingCity = Math.max(Number(player.startingCity) - 1, 0);
                break;
            case "guildAdd":
                if (!(player.guildCards || []).includes(change.number)) { player.guildCards = (player.guildCards || []).concat(change.number); }
                break;
            case "guildRemove":
                player.guildCards = (player.guildCards || []).filter(number => number != change.number);
                break;
            case "marketAdd":
                if (!market.some(entry => entry.number == change.number)) { market.push({ number: change.number, agents: {} }); }
                break;
            case "marketRemove":
                market = market.filter(entry => entry.number != change.number);
                break;
            case "marketAgents": {
                const entry = market.find(card => card.number == change.number);
                if (entry != null) { entry.agents[change.player] = Math.max((entry.agents[change.player] || 0) + change.amount, 0); }
                break;
            }
            default:
                break;
        }
    });

    Object.entries(savedPlayers).forEach(([number, player]) => { undo.saved[number] = JSON.stringify(player); });
    undo.saved.courtMarket = JSON.stringify(market);

    // Put the copy back. The undo point isn't included, as there's only one undo
    localStorage.clear();
    Object.entries(undo.saved).forEach(([key, value]) => localStorage.setItem(key, value));

    location.reload();
}
