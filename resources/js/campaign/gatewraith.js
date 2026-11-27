// Blighted Reach campaign (#85): the Gate Wraith (Fate 22, Act III) on the app's board. The Twisted
// Passage is a gate in the middle of the map (board.js, "0g"); gates with a Passage token are out of
// play, and their neighbours join up (the user, 2026-11-27). Catapult Overdrive, Breaking Gates &
// Placing Passages, The Dead Live (every player's ships and Imperial ships) and Passage Storms.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getGateWraith() {
    if (typeof campaign == "undefined" || campaign == null || campaign.act != 3) { return null; }
    return players.find(player => hasFate(player, 22)) || null;
}

function hasCatapultOverdrive(playerNumber) {
    const wraith = getGateWraith();
    return wraith != null && wraith.number === playerNumber;
}

function canOverdriveFrom(from, playerNumber) {
    // Catapult Overdrive: with Rival starports it controls
    return hasCatapultOverdrive(playerNumber) && getControllerFor(from, playerNumber) == playerNumber
        && getBuildings(from, null, "starport").some(starport => starport.owner != playerNumber && starport.owner != freeOwner);
}

// The Twisted Passage, and the event die that says where ships go from it

function openTwistedPassage() {
    board.twistedPassage = { letter: null };
    board.systems[twistedPassageId] = newSystem();
    board.deadLive = { card: {}, trophies: [] };
    rollTwistedPassage();
}

function rollTwistedPassage() {
    board.twistedPassage.letter = planetSymbolLetters[rollPlanetSymbol()];
}

function getTwistedPassageSymbol() {
    // e.g. "▲": the event die in the middle of the map
    return hasTwistedPassage() ? planetSymbols[planetSymbolLetters.indexOf(board.twistedPassage.letter)] : "";
}

function rerollTwistedPassage() {
    // Ships moved out of it (board.js moveShips): roll the event die again
    if (!hasTwistedPassage()) { return; }
    rollTwistedPassage();
    showMessageToast("The Twisted Passage", "Ships left it: the event die is rerolled. Ships now leave it for the " + getTwistedPassageSymbol() + " planets. Turn the die on the table to match.");
}

// Breaking Gates & Placing Passages: a Catapult from a planet into its own cluster's gate

function getBreakableGate(player, from) {
    // The gate it could collapse with a Catapult from this planet, or null
    if (getGateWraith() !== player || !isPlanet(from) || !canCatapultFrom(from, player.number)) { return null; }
    const gate = getCluster(from) + "g";
    return isSystemInPlay(gate) ? gate : null;
}

function breakGate(player, from, gate) {
    // The card's steps 1-3, once its ships have moved into the gate. Returns what happened
    const n = player.number;
    const lines = [];
    // 2. The starport it Catapulted with: its own, or a Rival's it controls (Overdrive). No Trophies
    const starport = getBuildings(from, n, "starport")[0] || getBuildings(from, null, "starport").find(item => item.owner != freeOwner);
    if (starport != null) {
        removeBuilding(from, starport.owner, "starport");
        lines.push((starport.owner == n ? "its" : "Player " + starport.owner + "'s") + " starport at " + getSystemName(from) + " destroyed");
    }
    lines.push(collapseGate(gate));
    return "Breaking Gates: a Passage on " + getSystemName(gate) + "; " + lines.join("; ");
}

function collapseGate(gate) {
    // 1. A Passage on the gate. 3. Everything on it to the Twisted Passage; its buildings destroyed (no Trophies)
    const system = getSystem(gate);
    const into = getSystem(twistedPassageId);
    const moved = [];
    Object.keys(system.ships).map(Number).forEach(number => {
        const ships = getShips(gate, number);
        addShips(twistedPassageId, number, ships.fresh);
        addShips(twistedPassageId, number, ships.damaged, true);
        moved.push(getPlayerTag(getPlayer(number)) + "'s " + (ships.fresh + ships.damaged) + " ship" + (ships.fresh + ships.damaged == 1 ? "" : "s"));
    });
    system.ships = {};
    // Imperial ships, Blight and Flagships are pieces on the gate too
    ["imperial", "blight"].forEach(kind => {
        const pieces = system[kind];
        if (pieces.fresh + pieces.damaged > 0) {
            into[kind] = { fresh: into[kind].fresh + pieces.fresh, damaged: into[kind].damaged + pieces.damaged };
            moved.push((pieces.fresh + pieces.damaged) + (kind == "imperial" ? " Imperial ship" + (pieces.fresh + pieces.damaged == 1 ? "" : "s") : " Blight"));
            system[kind] = { fresh: 0, damaged: 0 };
        }
    });
    system.flagships.forEach(flagship => { into.flagships.push(flagship); moved.push("Player " + flagship.owner + "'s Flagship"); });
    system.flagships = [];
    system.tokens.forEach(token => { into.tokens.push(token); moved.push(getTokenText(token)); });
    system.tokens = [{ kind: "passage", owner: null, side: 0 }];
    const destroyed = system.buildings.map(building => (building.owner == freeOwner ? "a Free " : "Player " + building.owner + "'s ") + building.kind);
    // Panels follow once it's on the real board (the caller): this also runs on copies of the board
    system.buildings = [];
    return (moved.length > 0 ? moved.join(", ") + " to the Twisted Passage" : "nothing on it to move") + (destroyed.length > 0 ? "; " + destroyed.join(", ") + " destroyed" : "");
}

// Act III setup: the Twisted Passage, and a Passage on any gate (step 3 of the card)

function chooseBotPassageGate(player) {
    // Where Rivals have most, and it has least: they go into the Twisted Passage, their buildings destroyed
    const n = player.number;
    const rivals = id => players.filter(other => other !== player).reduce((total, other) => total + getShips(id, other.number).fresh + getShips(id, other.number).damaged + 2 * getBuildings(id, other.number).length, 0);
    const own = id => getShips(id, n).fresh + getShips(id, n).damaged + 2 * getBuildings(id, n).length;
    // Next to its pieces, so it can move into the Twisted Passage
    const near = id => getAdjacent(id).some(other => hasLoyalPiece(other, n)) ? 1 : 0;
    return getSystemIds().filter(id => isGate(id) && id != twistedPassageId)
        .sort((a, b) => (rivals(b) - own(b) + near(b)) - (rivals(a) - own(a) + near(a)))[0] || null;
}

function setUpTwistedPassage() {
    // Lines for the setup window. A human Gate Wraith chooses its gate in a window after it
    const wraith = getGateWraith();
    if (wraith == null) { return []; }
    openTwistedPassage();
    const lines = ["the Twisted Passage in the middle of the map, with the event die on " + getTwistedPassageSymbol()];
    if (wraith.isHuman) {
        campaign.setupSteps = (campaign.setupSteps || []).concat({ kind: "passage", player: wraith.number });
        lines.push("Player " + wraith.number + " places a Passage on a gate after this window");
        return lines;
    }
    const gate = chooseBotPassageGate(wraith);
    if (gate != null) { lines.push("Player " + wraith.number + " places a Passage on " + getSystemShortName(gate) + ": " + collapseGate(gate)); players.forEach(syncPanelFromBoard); }
    return lines;
}

// The Dead Live: ships destroyed this chapter, on the card or as Trophies, come back fresh on the
// Twisted Passage after scoring. board.deadLive = { card: { owner: count }, trophies: [{ holder, owner, count }] }

function noteDeadShips(owner, count, holder) {
    if (!hasTwistedPassage() || board.deadLive == null) { return; }
    if (holder == null) { board.deadLive.card[owner] = (board.deadLive.card[owner] || 0) + count; }
    else { board.deadLive.trophies.push({ holder: holder, owner: owner, count: count }); }
}

function getDeadLiveShips(playerNumber) {
    // On the card, out of its supply
    return hasTwistedPassage() && board.deadLive != null ? board.deadLive.card[playerNumber] || 0 : 0;
}

function applyDeadLive() {
    // After all scoring, even if Warlord wasn't scored. Returns what came back
    if (!hasTwistedPassage() || board.deadLive == null) { return null; }
    const back = {};
    Object.entries(board.deadLive.card).forEach(([owner, count]) => { back[owner] = (back[owner] || 0) + count; });
    board.deadLive.trophies.forEach(entry => {
        back[entry.owner] = (back[entry.owner] || 0) + entry.count;
        // Out of the holder's Trophies (if scoring hasn't already returned them)
        const holder = getPlayer(entry.holder);
        if (holder != null) { setPlayerResource(holder, "trophies", Math.max((holder.trophiesValue || 0) - entry.count, 0)); }
        const owner = typeof entry.owner == "number" ? getPlayer(entry.owner) : null;
        if (owner != null) { owner.shipsTrophy = Math.max((owner.shipsTrophy || 0) - entry.count, 0); }
    });
    board.deadLive = { card: {}, trophies: [] };
    const lines = Object.entries(back).filter(([, count]) => count > 0).map(([owner, count]) => {
        if (owner == "imperial") { const imperial = getImperial(twistedPassageId); setImperial(twistedPassageId, imperial.fresh + count, imperial.damaged); return count + " Imperial ship" + (count == 1 ? "" : "s"); }
        addShips(twistedPassageId, Number(owner), count);
        syncPanelFromBoard(getPlayer(Number(owner)));
        return "Player " + owner + "'s " + count + " ship" + (count == 1 ? "" : "s");
    });
    if (lines.length == 0) { return null; }
    const text = "Ships destroyed this chapter come back fresh on the Twisted Passage: " + lines.join(", ") + ". Place them there.";
    showMessageToast("The Dead Live", tagPlayerNames(text));
    SaveAllSettings();
    return text;
}

// Passage Storms (Vox): its Crisis hits each piece in the Twisted Passage

function applyPassageStorms() {
    if (!hasTwistedPassage()) { return []; }
    const system = getSystem(twistedPassageId);
    const lines = [];
    const imperial = hitPieces(system.imperial, system.imperial.fresh + system.imperial.damaged);
    noteDestroyedShips("imperial", imperial);
    const imperialLine = describeHits("Imperial ships", imperial);
    if (imperialLine != null) { lines.push(imperialLine); }
    Object.keys(system.ships).map(Number).forEach(number => {
        const ships = { ...getShips(twistedPassageId, number) };
        const result = hitPieces(ships, ships.fresh + ships.damaged);
        setShips(twistedPassageId, number, ships.fresh, ships.damaged);
        noteDestroyedShips(number, result);
        const line = describeHits("Player " + number + "'s ships", result);
        if (line != null) { lines.push(line); }
        syncPanelFromBoard(getPlayer(number));
    });
    hitPieces(system.blight, system.blight.fresh + system.blight.damaged);
    system.buildings.forEach(building => { building.damaged = true; });
    SaveAllSettings();
    return lines;
}

// A human Gate Wraith's windows (the user's mock-ups H to K, 2026-11-27)

function showPassageSetupWindow(player) {
    // H: its first Passage, on any gate, at Act III setup (a setupSteps "passage" step)
    const gates = getSystemIds().filter(id => isGate(id) && id != twistedPassageId);
    const option = id => "<button type=\"button\" class=\"btn btn-outline-secondary text-start\" id=\"passageGate_" + id + "\" onclick=\"placeSetupPassage('" + id + "')\">" + getSystemName(id)
        + "<small class=\"d-block text-secondary\">" + getCollapseText(id) + "</small></button>";
    const html = "<div class=\"small text-secondary mb-2\">The Gate Wraith &middot; Act III setup</div>"
        + "<p class=\"mb-2\">Place a Passage on any gate. Everything on it goes to the Twisted Passage, and its buildings are destroyed (no Trophies). The gate is then out of play.</p>"
        + "<div class=\"d-grid gap-2 mb-2\">" + gates.map(option).join("") + "</div>"
        + "<div class=\"small text-secondary\">The event die in the middle of the map: " + getTwistedPassageSymbol() + ". Ships leave the Twisted Passage for the " + getTwistedPassageSymbol() + " planets.</div>";
    document.getElementById("guildTitle").innerHTML = "Place your Passage";
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = tagPlayerNames(html);
    const modal = document.getElementById("guildModal");
    if (!modal.classList.contains("show")) { showLockedModal(modal); }
}

function getCollapseText(gate) {
    // What collapsing it would do, e.g. "Player 3: 2 ships → Twisted Passage · Player 3's city destroyed"
    const system = getSystem(gate);
    const parts = Object.keys(system.ships).map(Number).map(number => { const count = getShips(gate, number).fresh + getShips(gate, number).damaged; return "Player " + number + ": " + count + " ship" + (count == 1 ? "" : "s") + " &rarr; Twisted Passage"; });
    if (system.imperial.fresh + system.imperial.damaged > 0) { const count = system.imperial.fresh + system.imperial.damaged; parts.push(count + " Imperial ship" + (count == 1 ? "" : "s") + " &rarr; Twisted Passage"); }
    if (system.blight.fresh + system.blight.damaged > 0) { parts.push((system.blight.fresh + system.blight.damaged) + " Blight &rarr; Twisted Passage"); }
    system.flagships.forEach(flagship => parts.push("Player " + flagship.owner + "'s Flagship &rarr; Twisted Passage"));
    system.buildings.forEach(building => parts.push((building.owner == freeOwner ? "a Free " : "Player " + building.owner + "'s ") + building.kind + " destroyed"));
    return parts.length > 0 ? parts.join(" &middot; ") : "Empty";
}

function placeSetupPassage(gate) {
    const step = campaign.setupSteps[0];
    const text = collapseGate(gate);
    players.forEach(syncPanelFromBoard);
    showMessageToast("Player " + step.player + ": a Passage on " + getSystemShortName(gate), tagPlayerNames(text));
    finishSetupStep();
}

// I: the Move window. From a planet it Catapults from into its cluster's gate: a Break switch (off)

function getMoveBreakHtml(player, from, to) {
    if (from == null || to == null || getBreakableGate(player, from) != to) { if (humanMove != null) { humanMove.breakGate = false; } return ""; }
    const starport = getBuildings(from, player.number, "starport").length > 0 ? "Your starport" : "The Rival starport you control";
    const others = Object.keys(getSystem(to).ships).map(Number).filter(number => number != player.number).map(number => "Player " + number + "'s " + (getShips(to, number).fresh + getShips(to, number).damaged) + " ship" + (getShips(to, number).fresh + getShips(to, number).damaged == 1 ? "" : "s"));
    return "<div class=\"form-check form-switch mb-1\"><input class=\"form-check-input\" type=\"checkbox\" id=\"moveBreak\"" + (humanMove.breakGate ? " checked" : "") + " onchange=\"humanMove.breakGate = this.checked; renderHumanMove()\">"
        + "<label class=\"form-check-label\" for=\"moveBreak\"><b>Break the gate</b>: place a Passage on " + getSystemShortName(to) + "</label></div>"
        + "<div class=\"small text-secondary mb-2 ms-4\">" + starport + " at " + getSystemShortName(from) + " is destroyed; your ships" + (others.length > 0 ? " and " + others.join(", ") : "") + " on " + getSystemShortName(to)
        + " go to the Twisted Passage. " + getSystemShortName(to) + " is then out of play.</div>";
}

// J: Passage Storms' Crisis, when it's attached to a card in the Court (the app doesn't track that)

function getPassageStormsCrisisHtml() {
    if (!hasTwistedPassage() || getGateWraith() == null) { return ""; }
    const done = campaign.passageStorms != null && campaign.passageStorms.key == getCrisisKey();
    const now = getPiecesText(twistedPassageId);
    return "<div class=\"setstep d-flex align-items-start gap-2\" id=\"passageStormsStep\"><span class=\"flex-fill\">Passage Storms <span class=\"small text-secondary\">(if it's attached to a card in the Court)</span>"
        + "<small class=\"d-block\">Hit each piece in the Twisted Passage, then place it under the top card of the Court deck.</small>"
        + "<small class=\"d-block text-secondary\">" + (done ? "On the app's board: " + (campaign.passageStorms.lines.join(". ") || "nothing there to hit") : "Twisted Passage now: " + (now || "empty")) + "</small></span>"
        + (done ? "<i class=\"bi bi-check-lg\"></i>" : "<button type=\"button\" class=\"btn btn-sm btn-dark\" id=\"passageStormsHit\" onclick=\"hitPassageStorms()\">Hit them</button>") + "</div>";
}

function getCrisisKey() {
    return campaign.act + ":" + roundNumber + ":" + turnNumber;
}

function hitPassageStorms() {
    if (campaign.passageStorms != null && campaign.passageStorms.key == getCrisisKey()) { return; }
    campaign.passageStorms = { key: getCrisisKey(), lines: applyPassageStorms() };
    SaveAllSettings();
    const step = document.getElementById("passageStormsStep");
    if (step != null) { step.outerHTML = tagPlayerNames(getPassageStormsCrisisHtml()); }
}

// K: Check the board's Twisted Passage page (boardui.js)

function getTwistedPassageCheckHtml() {
    const passages = getPassageGates();
    return "<div class=\"turnsection\"><div class=\"d-flex align-items-center gap-2\"><b>Event die</b><span>" + getTwistedPassageSymbol() + "</span>"
        + "<span class=\"small text-secondary flex-fill\">ships leave for the " + getTwistedPassageSymbol() + " planets</span>"
        + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" id=\"twistedDie\" onclick=\"changeTwistedPassageDie()\">Change</button></div>"
        + "<div class=\"small text-secondary mt-1\">Passages: " + (passages.length > 0 ? passages.map(getSystemShortName).join(", ") + " (out of play)" : "none yet") + "</div></div>";
}

function changeTwistedPassageDie() {
    // To match the die on the table: the next symbol round
    const letters = planetSymbolLetters;
    board.twistedPassage.letter = letters[(letters.indexOf(board.twistedPassage.letter) + 1) % letters.length];
    boardChanged();
}

function getDeadLiveCheckHtml() {
    const dead = board.deadLive || { card: {}, trophies: [] };
    const counts = {};
    Object.entries(dead.card).forEach(([owner, count]) => { counts[owner] = (counts[owner] || 0) + count; });
    dead.trophies.forEach(entry => { counts[entry.owner] = (counts[entry.owner] || 0) + entry.count; });
    const lines = Object.entries(counts).filter(([, count]) => count > 0).map(([owner, count]) => owner == "imperial" ? count + " Imperial ship" + (count == 1 ? "" : "s") : getPlayerTag(getPlayer(Number(owner))) + " " + count + " ship" + (count == 1 ? "" : "s"));
    return "<div class=\"turnsection\"><b>The Dead Live</b><div class=\"small text-secondary\">Destroyed this chapter, back fresh here after scoring:</div><div class=\"small\">" + (lines.length > 0 ? lines.join(" &middot; ") : "None yet") + "</div></div>";
}

// The bot: when to collapse a gate, and when to hold the Twisted Passage

function getGateWraithMove(player) {
    // { from, test, why, breakGate } for getFateMoveTarget (fateboard.js), or null
    if (getGateWraith() !== player) { return null; }
    const n = player.number;
    // Collapse a gate: from a planet it can Catapult from, with fresh ships. Its own starport only
    // while it has another on the map; a Rival's (Overdrive) any time, as that's theirs destroyed
    const ownStarports = getBoardBuildings(n, "starport").length;
    const breaks = getSystemIds().filter(id => getBreakableGate(player, id) != null && getShips(id, n).fresh > 0)
        .filter(id => getBuildings(id, n, "starport").length == 0 || ownStarports >= 2)
        .map(id => ({ from: id, gate: getBreakableGate(player, id), rivalStarport: getBuildings(id, n, "starport").length == 0 }))
        // A Rival's starport first, then the gate with most Rival pieces on it
        .sort((a, b) => (b.rivalStarport - a.rivalStarport) || (rivalPiecesOn(player, b.gate) - rivalPiecesOn(player, a.gate)));
    if (breaks.length > 0) {
        const best = breaks[0];
        return { from: best.from, test: id => id == best.gate, breakGate: true,
            why: "for its Fate: Catapult into " + getSystemShortName(best.gate) + " and collapse it (Breaking Gates): a Passage there, its starport at " + getSystemShortName(best.from) + " destroyed, and everything on the gate to the Twisted Passage" };
    }
    // Hold the Twisted Passage at the end of the chapter (Control the Twisted Passage)
    if (hasTwistedPassage() && getPassageGates().length > 0 && getChapterController(twistedPassageId) != n) {
        return { test: id => id == twistedPassageId, why: "for its Fate: to control the Twisted Passage at the end of the chapter (" + getPassageGates().length + " Passage" + (getPassageGates().length == 1 ? "" : "s") + ")" };
    }
    return null;
}

function rivalPiecesOn(player, id) {
    return players.filter(other => other !== player).reduce((total, other) => total + getShips(id, other.number).fresh + getShips(id, other.number).damaged + getBuildings(id, other.number).length, 0);
}
