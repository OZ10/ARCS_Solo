// Blighted Reach campaign (#85): setting up Act I at the table (rulebook p.4-6). The app rolls the
// dice and chooses the starting Policy, and each step is ticked off as it's done.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const planetSymbols = ["&#9650;", "&#11042;", "&#9790;"];
const policyNames = { war: "A Policy of War", peace: "A Policy of Peace", escalation: "A Policy of Escalation" };

function rollNumberDie() {
    return 1 + Math.floor(Math.random() * 6);
}

function rollPlanetSymbol() {
    return Math.floor(Math.random() * 3);
}

registerCampaignHook("setUpPlayers", () => {
    // Once the opening Court has been entered. The Imperial Council is always the leftmost card
    ensureCouncilInCourt();
    if (campaign.act == 1) { showActOneSetup(); } else { showLaterActSetup(); }
    return true;
});

function showLaterActSetup() {
    // Acts II and III start as the last Act ended, with these changes (rulebook p.7)
    const act = campaign.act;
    if (campaign.setupRolls == null) {
        campaign.setupRolls = { symbol: rollPlanetSymbol(), clusters: [rollNumberDie(), rollNumberDie()] };
        SaveAllSettings();
    }
    const rolls = campaign.setupRolls;
    const symbol = planetSymbols[rolls.symbol];
    const step = (text, note) => "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"><span>" + text + (note ? "<small>" + note + "</small>" : "") + "</span></label>";
    let html = "<p class=\"mb-2\">Everything stays as " + actNames[act - 1] + " ended, including Power. Do each step on the table and tick it.</p>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">The Reach</div>"
        + step(act == 2 ? "Flip the lowest-Power ambition marker to its higher side" : "Flip the two lowest-Power ambition markers to their higher sides", "The others start on their lower sides. The app's markers match.")
        + step("Shuffle the Court deck and deal " + openingCourtCards[players.length] + " cards into the Court, with the Imperial Council In Session", "The cards you've just entered in the Court window.")
        + step("1 damaged Blight on each gate with no Blight and no ships")
        + step("<span class=\"die\">" + symbol + "</span>In each cluster, 1 damaged Blight on the <b>" + symbol + "</b> planet if it has no Blight",
            "If it does have Blight, 1 damaged Blight on each planet in that cluster with no Blight.");
    if (players.length == 2) {
        neutralCounts = {};
        html += "<div class=\"setstep\"><span class=\"setnum\">2p</span><span><span class=\"die\">" + rolls.clusters[0] + "</span><span class=\"die\">" + rolls.clusters[1] + "</span>Put the resources matching the planets in clusters "
            + rolls.clusters[0] + " and " + rolls.clusters[1] + " on the ambition boxes (as much as the supply has). Enter how many:"
            + "<span class=\"neutralsteps\">" + neutralAmbitions.map(ambition => "<span class=\"neutralstep\"><span>" + capitalise(ambition) + "</span>"
                + "<button type=\"button\" onclick=\"stepNeutral('" + ambition + "', -1)\" aria-label=\"One fewer on " + ambition + "\"><i class=\"bi bi-dash\"></i></button>"
                + "<b id=\"neutralSetup_" + ambition + "\">0</b>"
                + "<button type=\"button\" onclick=\"stepNeutral('" + ambition + "', 1)\" aria-label=\"One more on " + ambition + "\"><i class=\"bi bi-plus\"></i></button></span>").join("") + "</span></span></div>";
    }
    html += "</div><div class=\"turnsection\"><div class=\"turnlabel\">The players</div>"
        + step("Each player does the Setup side of their objective card, then flips it", "In turn order if choices clash. Players may also rearrange their resources.")
        + step(act == 2 ? "Each player sets their objective marker, and enters it on their panel" : "Players with a \"C\" Fate set their objective marker, and enter it on their panel",
            act == 3 ? "\"A\" and \"B\" Fates have grand ambitions instead." : "")
        + "</div><button type=\"button\" class=\"btn btn-primary w-100 mt-2\" data-bs-dismiss=\"modal\">Done: start chapter 1</button>";
    showCampaignWindow(actNames[act] + " setup", html, null, true, () => startRoundAfterMulligan());
}

function ensureCouncilInCourt() {
    // Only once the Court has been entered: until then the bots ask about it
    if (courtMarket.length > 0 && getCouncilEntry() == null) { courtMarket.unshift({ number: councilNumber, agents: {}, decided: false }); }
}

function showActOneSetup() {
    if (campaign.setupRolls == null) {
        // Rolled once, so the window shows the same after loading
        campaign.setupRolls = { cluster: rollNumberDie(), symbol: rollPlanetSymbol() };
        // Each player starts with 6 ships (3 placed twice). A bot places a starport first, then a city
        players.forEach(player => {
            adjustCounter(player, "shipsBoard", 6 - player.shipsBoardValue);
            adjustCounter(player, "starports", (player.isHuman ? 0 : 1) - player.starportsValue);
        });
        SaveAllSettings();
    }
    const rolls = campaign.setupRolls;
    const second = rolls.cluster % 6 + 1;
    const symbol = planetSymbols[rolls.symbol];
    const step = (text, note) => "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"><span>" + text + (note ? "<small>" + note + "</small>" : "") + "</span></label>";
    const order = getTurnOrder();
    const twoPlayers = players.length == 2;

    let html = "<p class=\"mb-2\">Do each step on the table and tick it. The app has rolled the dice for you.</p>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">The Reach</div>"
        + step("<span class=\"die\">" + rolls.cluster + "</span>Imperial clusters: <b>" + rolls.cluster + " and " + second + "</b>", "Place 1 Imperial ship in each system of clusters " + rolls.cluster + " and " + second + " (8 in all).")
        + step("<span class=\"die\">" + symbol + "</span>A Free city on every <b>" + symbol + "</b> planet", "Outside clusters " + rolls.cluster + " and " + second + ".")
        + step("1 damaged Blight in every system outside clusters " + rolls.cluster + " and " + second, "Shaded side up.")
        + step("The Imperial Council, In Session, as the leftmost Court card", "Then shuffle 1 lore card for each player into the Court deck.")
        + step("The rules booklet: " + (twoPlayers ? "Guild Envoys Depart (02) in the first slot, then " : "") + "the 3 Govern the Imperial Reach edicts (03-05)",
            "Put <b>" + policyNames[campaign.policy] + "</b> on top: it's the Policy to start with.");
    if (twoPlayers) {
        // The 6 resources of the Imperial clusters' planets go on the ambition boxes (rulebook p.5)
        html += "<div class=\"setstep\"><span class=\"setnum\">2p</span><span>Put the resources matching the planets in clusters " + rolls.cluster + " and " + second + " on the ambition boxes: Material and Fuel on Tycoon, Weapons on Warlord, Relics on Keeper, Psionics on Empath. Enter how many:"
            + "<span class=\"neutralsteps\">" + neutralAmbitions.map(ambition => "<span class=\"neutralstep\"><span>" + capitalise(ambition) + "</span>"
                + "<button type=\"button\" onclick=\"stepNeutral('" + ambition + "', -1)\" aria-label=\"One fewer on " + ambition + "\"><i class=\"bi bi-dash\"></i></button>"
                + "<b id=\"neutralSetup_" + ambition + "\">" + (neutralCounts[ambition] || 0) + "</b>"
                + "<button type=\"button\" onclick=\"stepNeutral('" + ambition + "', 1)\" aria-label=\"One more on " + ambition + "\"><i class=\"bi bi-plus\"></i></button></span>").join("") + "</span></span></div>";
    }
    html += "</div><div class=\"turnsection\"><div class=\"turnlabel\">The players</div>"
        + step("Each player places <b>3 ships and 1 building</b> in an empty slot at a planet with an Imperial ship, and gains 1 resource of that planet",
            "In turn order: " + order.map(player => "Player " + player.number).join(", ") + ". Then again in reverse order. Bots place a starport first, then a city, on a type of planet they have no resource of yet if they can.")
        + step("Add each player's buildings and 2 resources on their panel", "The app has set 6 ships each, and a starport for each bot. Tap + on the type of planet each city is on.")
        + step("Free cities in all empty building slots on planets with Imperial ships", players.length == 4 ? "With 4 players there may be none." : "")
        + "</div><button type=\"button\" class=\"btn btn-primary w-100 mt-2\" data-bs-dismiss=\"modal\">Done: start chapter 1</button>";

    // It has to be finished: the mulligan and chapter 1 follow (#135)
    showCampaignWindow(actNames[1] + " setup", html, null, true, () => {
        lastAnnouncedLeader = null;
        startRoundAfterMulligan();
    });
}

function stepNeutral(ambition, change) {
    neutralCounts[ambition] = Math.max((neutralCounts[ambition] || 0) + change, 0);
    document.getElementById("neutralSetup_" + ambition).innerHTML = neutralCounts[ambition];
    SaveAllSettings();
}
