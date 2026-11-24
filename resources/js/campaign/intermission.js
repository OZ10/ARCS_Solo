// Blighted Reach campaign (#85): the end of an Act. After Acts I and II, the Intermission (rulebook
// p.28-29): Fates resolved, the Court and pieces cleared, Power shifted, then new Fates. Then the
// next Act, now or after packing up. After Act III, the campaign's winner (rulebook p.8-9).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

registerCampaignHook("showGameOver", () => {
    // The Act is over, so its setup certainly is
    if (campaign.stage == "actSetup") { campaign.stage = null; }
    // Already between Acts (after a reload): carry on from that step, not from the start
    if (campaign.act < 3 && ["choosingFates", "betweenActs"].includes(campaign.stage)) { resumeBetweenActs(); return true; }
    if (campaign.act < 3) { startIntermission(); } else { showCampaignWinner(); }
    return true;
});

registerCampaignHook("modeChanged", () => {
    // Loaded between Acts: carry on from the step it had got to
    if (!campaignMode || campaign == null) { return; }
    resumeBetweenActs();
});

function resumeBetweenActs() {
    // Each step is saved as it's reached, so nothing is done twice and the same Fates are on offer
    if (campaign.stage == "intermission") { whenWindowsClosed(showIntermission); }
    if (campaign.stage == "choosingFates") { whenWindowsClosed(() => resumeFateChoice(afterLaterFatesChosen)); }
    if (campaign.stage == "betweenActs") { whenWindowsClosed(showNextAct); }
    if (campaign.stage == "actSetup") {
        // Only while no card has been played in the new Act; after that it's under way
        if (roundNumber == 1 && turnNumber == 1 && playedCardList.length == 0) { whenWindowsClosed(askOpeningCourt); }
        else { campaign.stage = null; SaveAllSettings(); }
    }
}

function startIntermission() {
    campaign.stage = "intermission";
    // Completed objectives are at 0. They can be changed in the window
    players.forEach(player => { getCampaignPlayer(player).completed = getCampaignPlayer(player).objective === 0; });
    SaveAllSettings();
    showIntermission();
}

function getIntermissionPower(player) {
    // A. a failed objective loses its marker's space, then E. anyone above 1 Power loses half,
    // rounding to lose less (7 becomes 4)
    const state = getCampaignPlayer(player);
    const afterFate = player.powerValue - (state.completed ? 0 : (state.objective || 0));
    return afterFate > 1 ? afterFate - Math.floor(afterFate / 2) : afterFate;
}

function showIntermission() {
    const act = campaign.act;
    const step = (text, note) => "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"><span>" + text + (note ? "<small>" + note + "</small>" : "") + "</span></label>";
    const fateRows = players.map(player => {
        const state = getCampaignPlayer(player);
        // Its Resolution card, for a completed or failed objective (fatebots.js)
        return "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"" + (state.completed ? " checked" : "") + " onchange=\"setObjectiveCompleted(" + player.number + ", this.checked)\">"
            + "<span>Player " + player.number + " &middot; " + getFate(state.fate).name + ": <b>" + (state.completed ? "completed" : "failed") + "</b> (marker at " + (state.objective ?? "&ndash;") + ")"
            + "<small>" + getResolutionHtml(player) + "</small></span></label>";
    }).join("");
    const highest = players.slice().sort((a, b) => getIntermissionPower(b) - getIntermissionPower(a) || getTurnOrderPosition(a) - getTurnOrderPosition(b))[0];
    const powerRows = players.map(player => {
        const state = getCampaignPlayer(player);
        const lost = state.completed ? "&#10003; Done" : "<span class=\"lost\">&minus;" + (state.objective || 0) + "</span>";
        return "<tr><td>Player " + player.number + "<small class=\"d-block\">" + getFate(state.fate).name + "</small></td><td>" + player.powerValue + "</td><td>" + lost + "</td><td><b>" + getIntermissionPower(player) + "</b></td></tr>";
    }).join("");
    const next = { 1: "B", 2: "C" }[act];
    showCampaignWindow(actNames[act] + " is over: Intermission",
        "<div class=\"turnsection\"><div class=\"turnlabel\">A &middot; Resolve Fate</div><div class=\"mb-1\">Who completed their objective (marker at 0)?</div>" + fateRows
        + "<small class=\"text-secondary\">Tick each completed objective; each player follows their Resolution card. The app adds any cards gained to the panels.</small></div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">Power, worked out by the app</div><table class=\"ptable\"><tr><th>Player</th><th>Power</th><th>Objective</th><th>" + actNames[act + 1] + "</th></tr>" + powerRows + "</table>"
        + "<small class=\"text-secondary d-block mt-1\">A failed objective loses its marker's space, then anyone above 1 Power loses half (rounding to lose less). Player " + highest.number + " takes the initiative.</small></div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">B&ndash;D &middot; On the table</div>"
        + step("Clear the Court", "All cards but the Imperial Council back into the Court deck (with any attached cards), agents home, scrap the Court discard.")
        + step("Clear pieces", "Trophies and Captives home, frozen resources and the Imperial Trust to the supply." + (players.length == 2 ? " The resources on the ambition boxes go to the supply." : "") + " The app clears these on the panels.")
        + getIntermissionBoardHtml(step) + "</div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">F &middot; Choose Fate</div><div>Players who completed their objective draw 1 \"" + next + "\" Fate and choose between it and their own. The others draw 2 \"" + next + "\" Fates.</div></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"applyIntermission()\">Choose Fates</button>", null, true);
}

function getIntermissionBoardHtml(step) {
    // Step D on the app's board, once for each Act (#85 stage 7c), and what to change on the table
    if (campaign.intermissionBoard == null || campaign.intermissionBoard.act !== campaign.act) {
        campaign.intermissionBoard = { act: campaign.act, lines: applyIntermissionToBoard() };
        players.forEach(syncPanelFromBoard);
        SaveAllSettings();
    }
    const lines = campaign.intermissionBoard.lines;
    return step("Repair all damaged Blight, destroy every damaged ship, building, Upgrade and Armor, and the buildings in systems with Blight and no ships",
        "The app has done this on its board and the panels. " + (lines.length > 0 ? "On the table: " + tagPlayerNames(lines.join("; ")) + "." : "Nothing changes on the table.")
        + " Remove damaged Upgrades and Armor from the Flagships yourself.");
}

function setObjectiveCompleted(playerNumber, completed) {
    campaign.players[playerNumber].completed = completed;
    SaveAllSettings();
    showIntermission();
}

function applyIntermission() {
    // A and E: Power. C: Trophies, Captives, the Trust (and the ambition boxes with 2 players). B: the Court.
    // Once only for each Act (#179): tapped again, or reloaded, it doesn't take the Power away twice
    if (campaign.intermissionDone !== campaign.act) {
        const powers = {};
        players.forEach(player => { powers[player.number] = getIntermissionPower(player); });
        // The Resolution cards: cards gained, Edicts scrapped (fatebots.js)
        applyResolutions();
        players.forEach(player => {
            setPlayerPower(player, powers[player.number]);
            ["trophies", "captives"].forEach(counter => adjustCounter(player, counter, -player[counter + "Value"]));
            player.agentsCaptive = 0;
            player.agentsTrophy = 0;
            player.citiesAsTrophies = 0;
            // Ships held as Trophies go home too (#160)
            player.shipsTrophy = 0;
        });
        trustResources.forEach(resource => { campaign.trust[resource] = 0; });
        if (players.length == 2) { neutralCounts = {}; }
        const council = getCouncilEntry();
        courtMarket = (council != null) ? [{ number: councilNumber, agents: {}, decided: council.decided }] : [];
        // The initiative to the player with the most Power
        const highest = players.slice().sort((a, b) => powers[b.number] - powers[a.number] || getTurnOrderPosition(a) - getTurnOrderPosition(b))[0];
        changeInitiative(highest);
        campaign.intermissionDone = campaign.act;
    }
    // Next: choosing Fates, saved as it goes (campaign.js). Already started: the same Fates again
    const resuming = campaign.stage == "choosingFates" && campaign.fateChoice != null;
    campaign.stage = "choosingFates";
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    closeCampaignWindow();
    whenWindowsClosed(() => resuming ? resumeFateChoice(afterLaterFatesChosen) : chooseFates(campaign.act + 1, afterLaterFatesChosen));
}

function afterLaterFatesChosen() {
    campaign.stage = "betweenActs";
    SaveAllSettings();
    showNextAct();
}

function showNextAct() {
    const next = campaign.act + 1;
    showCampaignWindow("Next: " + actNames[next], "<p>Play " + actNames[next] + " now, or pack up and play it later.</p>"
        + "<p class=\"small text-secondary\">To pack up, keep everything on the map and in each play area as it is (see Packing Up in the rulebook). The app keeps the campaign: save it to a file from the Options window to be safe. When you're back, open the app and this window shows again.</p>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mb-2\" onclick=\"startNextAct()\">Set up " + actNames[next] + "</button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary w-100\" data-bs-dismiss=\"modal\">Pack up for now</button>", null, false);
}

function startNextAct() {
    // As the previous Act ended, including Power, with the changes in the Act II & III setup (rulebook p.7)
    campaign.act += 1;
    // Until the setup window is done: reloaded, it starts with the Court again (setup.js)
    campaign.stage = "actSetup";
    campaign.setupRolls = null;
    campaign.councilSecuredBy = null;
    campaign.councilSecuredAt = null;
    setCouncilInSession();
    turnNumber = 1;
    roundNumber = 1;
    declaredAmbitions = [];
    resetRound();
    resetPlayersCards();
    dealCards();
    players.forEach(showCampaignPanel);
    showCampaignTopBar();
    SaveAllSettings();
    closeCampaignWindow();
    // The Court, then the Act's setup (setup.js), then the mulligan and chapter 1
    whenWindowsClosed(askOpeningCourt);
}

// The end of the campaign: the most Power over all three Acts, ties to "A" Fates over "B" over "C",
// then turn order. A "C" Fate that completed its final objective with at least 1 Power wins first

function showCampaignWinner() {
    const setRank = player => ({ A: 0, B: 1, C: 2 }[getFate(getCampaignPlayer(player).fate).set]);
    const byPower = (a, b) => (b.powerValue - a.powerValue) || (setRank(a) - setRank(b)) || (getTurnOrderPosition(a) - getTurnOrderPosition(b));
    const finalWinners = getFinalObjectiveWinners().sort(byPower);
    const standings = players.slice().sort(byPower);
    const winner = finalWinners.length > 0 ? finalWinners[0] : standings[0];
    const reason = finalWinners.length > 0 ? "Player " + winner.number + " completed their final objective" + (finalWinners.length > 1 ? " (with the most Power of those who did)" : "")
        : "The most Power over all three Acts";
    campaign.stage = "over";
    SaveAllSettings();
    showCampaignWindow("The campaign is over", "<div class=\"gameoverwinner playerbanner" + getPlayerColour(winner) + "\"><div class=\"gameovertitle\">Player " + winner.number + " wins</div></div>"
        + "<p class=\"mt-2\">" + reason + ".</p>"
        + standings.map(player => "<div class=\"fatechosen\"><span>Player " + player.number + "</span><b>" + player.powerValue + " Power</b><span>" + getFate(getCampaignPlayer(player).fate).name + "</span></div>").join(""), null, false);
}
