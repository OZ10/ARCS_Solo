// Undo of the last card played.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// A single undo of the last card played. Just before a card is played, the saved game is
// copied. Undo puts that copy back and reloads the page, so the game is rebuilt by the
// normal loading code. Resources and power are left as they are now, because they track
// the physical board. Keeping a list of copies would allow more than one undo later
const undoKey = "undo";

function saveUndoPoint(playerNumber) {
    SaveAllSettings();

    let saved = {};
    for (let [key, value] of Object.entries(localStorage)) {
        if (key != undoKey) { saved[key] = value; }
    }

    localStorage.setItem(undoKey, JSON.stringify({ playerNumber: playerNumber, round: roundNumber, turn: turnNumber, saved: saved }));
    updateUndoButton();
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

    document.getElementById("undoMessage").innerHTML = "Undo Player " + undo.playerNumber + "'s card in round " + undo.round + ", turn " + undo.turn + "?"
        + "<br><small class=\"text-muted\">Resources and power stay as they are.</small>";

    bootstrap.Modal.getOrCreateInstance(document.getElementById("undoModal")).show();
}

function undoLastCard() {
    const undo = getUndoPoint();
    if (undo == null) { return; }

    // Keep each player's resources and power as they are now
    const resources = ["fuelValue", "materialsValue", "weaponsValue", "relicsValue", "psionicsValue", "captivesValue", "trophiesValue", "powerValue"];
    players.forEach(player => {
        if (undo.saved[player.number] == null) { return; }
        const savedPlayer = JSON.parse(undo.saved[player.number]);
        resources.forEach(resource => { savedPlayer[resource] = player[resource]; });
        undo.saved[player.number] = JSON.stringify(savedPlayer);
    });

    // Put the copy back. The undo point isn't included, as there's only one undo
    localStorage.clear();
    Object.entries(undo.saved).forEach(([key, value]) => localStorage.setItem(key, value));

    location.reload();
}
