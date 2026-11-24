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
    // The new Blight on the app's board, once for each Act (#85 stage 7c)
    if (campaign.laterSetupBoard == null || campaign.laterSetupBoard.act !== act) {
        campaign.laterSetupBoard = { act: act, ...addLaterActBlight(rolls.symbol) };
        SaveAllSettings();
    }
    const added = campaign.laterSetupBoard;
    const list = ids => ids.length > 0 ? "The app has added it on its board: " + ids.map(getSystemName).join(", ") + "." : "None needed.";
    let html = "<p class=\"mb-2\">Everything stays as " + actNames[act - 1] + " ended, including Power. Do each step on the table and tick it.</p>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">The Reach</div>"
        + step(act == 2 ? "Flip the lowest-Power ambition marker to its higher side" : "Flip the two lowest-Power ambition markers to their higher sides", "The others start on their lower sides. The app's markers match.")
        + step("Shuffle the Court deck and deal " + openingCourtCards[players.length] + " cards into the Court, with the Imperial Council In Session", "The cards you've just entered in the Court window.")
        + step("1 damaged Blight on each gate with no Blight and no ships", list(added.gates))
        + step("<span class=\"die\">" + symbol + "</span>In each cluster, 1 damaged Blight on the <b>" + symbol + "</b> planet if it has no Blight",
            "If it does have Blight, 1 damaged Blight on each planet in that cluster with no Blight. " + list(added.planets));
    if (players.length == 2) {
        neutralCounts = {};
        // The resources matching the planets in the rolled clusters (#85 stage 7c)
        [...new Set(rolls.clusters)].forEach(cluster => planetLetters.forEach(letter => {
            const ambition = outOfPlayAmbitions[getPlanetResource(cluster + letter)];
            neutralCounts[ambition] = (neutralCounts[ambition] || 0) + 1;
        }));
        html += "<div class=\"setstep\"><span class=\"setnum\">2p</span><span><span class=\"die\">" + rolls.clusters[0] + "</span><span class=\"die\">" + rolls.clusters[1] + "</span>Put the resources matching the planets in clusters "
            + rolls.clusters[0] + " and " + rolls.clusters[1] + " on the ambition boxes (as much as the supply has). Enter how many:"
            + "<span class=\"neutralsteps\">" + neutralAmbitions.map(ambition => "<span class=\"neutralstep\"><span>" + capitalise(ambition) + "</span>"
                + "<button type=\"button\" onclick=\"stepNeutral('" + ambition + "', -1)\" aria-label=\"One fewer on " + ambition + "\"><i class=\"bi bi-dash\"></i></button>"
                + "<b id=\"neutralSetup_" + ambition + "\">" + (neutralCounts[ambition] || 0) + "</b>"
                + "<button type=\"button\" onclick=\"stepNeutral('" + ambition + "', 1)\" aria-label=\"One more on " + ambition + "\"><i class=\"bi bi-plus\"></i></button></span>").join("") + "</span></span></div>";
    }
    html += "</div><div class=\"turnsection\"><div class=\"turnlabel\">The players</div>"
        + step("Each player does the Setup side of their objective card, then flips it", "In turn order if choices clash. Players may also rearrange their resources.")
        // Each player's Fate setup for this Act (laterfates.js)
        + getTurnOrder().map(player => {
            const fate = getFate(getCampaignPlayer(player).fate);
            return step("Player " + player.number + " &middot; " + fate.name, getFateSetupText(fate, act));
        }).join("")
        + step(act == 2 ? "Each player puts their objective marker on its starting space" : "Players with a \"C\" Fate put their objective marker on its starting space",
            (act == 3 ? "\"A\" and \"B\" Fates have grand ambitions instead. " : "") + "The app has set each one on the panels.")
        + "</div><button type=\"button\" class=\"btn btn-primary w-100 mt-2\" data-bs-dismiss=\"modal\">Done: start chapter 1</button>";
    showCampaignWindow(actNames[act] + " setup", html, null, true, () => {
        // The Act has started: a reload now carries on the game
        if (campaign.stage == "actSetup") { campaign.stage = null; SaveAllSettings(); }
        startRoundAfterMulligan();
    });
}

function ensureCouncilInCourt() {
    // Only once the Court has been entered: until then the bots ask about it
    if (courtMarket.length > 0 && getCouncilEntry() == null) { courtMarket.unshift({ number: councilNumber, agents: {}, decided: false }); }
}

function showActOneSetup() {
    if (campaign.setupRolls == null) {
        // Rolled once, so the window shows the same after loading
        campaign.setupRolls = { cluster: rollNumberDie(), symbol: rollPlanetSymbol() };
        SaveAllSettings();
    }
    // The Reach on the app's board, once (#85, stage 7a)
    if (!campaign.boardSetUp) { setUpReachBoard(campaign.setupRolls); }
    const rolls = campaign.setupRolls;
    const second = rolls.cluster % 6 + 1;
    const symbol = planetSymbols[rolls.symbol];
    const step = (text, note) => "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"><span>" + text + (note ? "<small>" + note + "</small>" : "") + "</span></label>";
    const order = getTurnOrder();
    const twoPlayers = players.length == 2;

    let html = "<p class=\"mb-2\">Do each step on the table and tick it. The app has rolled the dice for you, and put the Reach on its board.</p>"
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
        + "<div class=\"small\">Next, each player places <b>3 ships and 1 building</b> at a planet with an Imperial ship, in turn order (" + order.map(player => "Player " + player.number).join(", ")
        + ") and then again in reverse. The app places the bots' pieces and asks you where yours go. Then Free cities fill the empty slots on planets with Imperial ships.</div>"
        + "</div><button type=\"button\" class=\"btn btn-primary w-100 mt-2\" data-bs-dismiss=\"modal\">Done: place the players' pieces</button>";

    // It has to be finished: the placements, the mulligan and chapter 1 follow (#135)
    showCampaignWindow(actNames[1] + " setup", html, null, true, () => nextActOnePlacement());
}

function addLaterActBlight(symbolIndex) {
    // Acts II and III (rulebook p.7): C. damaged Blight on each gate with no Blight and no ships;
    // D. in each cluster, damaged Blight on the rolled-symbol planet if it has none, otherwise on each
    // planet there with no Blight. Returns { gates, planets } where it went
    const noShips = id => Object.keys(getSystem(id).ships).length == 0 && !hasImperialShips(id);
    const addDamaged = id => { const blight = getBlight(id); setBlight(id, blight.fresh, blight.damaged + 1); };
    const gates = getSystemIds().filter(id => isGate(id) && !hasBlight(id) && noShips(id));
    gates.forEach(addDamaged);
    const letter = planetSymbolLetters[symbolIndex];
    const planets = [];
    getClustersInPlay().forEach(cluster => {
        const rolled = cluster + letter;
        const targets = !hasBlight(rolled) ? [rolled] : planetLetters.map(other => cluster + other).filter(id => !hasBlight(id));
        targets.forEach(id => { addDamaged(id); planets.push(id); });
    });
    return { gates: gates, planets: planets };
}

// Act I on the app's board (#85, stage 7a)

// The event die's symbols, as the planets' letters: arrowhead, hexagon, crescent (planetSymbols' order)
const planetSymbolLetters = ["a", "h", "c"];

function getImperialClusters(rolls) {
    return [rolls.cluster, rolls.cluster % 6 + 1];
}

function setUpReachBoard(rolls) {
    // All clusters in play: Imperial ships in the two Imperial clusters, a Free city on each planet
    // of the rolled symbol elsewhere, and damaged Blight in every other system (rulebook p.5)
    board = newBoard();
    const imperial = getImperialClusters(rolls);
    getAllSystemIds().forEach(id => {
        if (imperial.includes(getCluster(id))) { setImperial(id, 1, 0); return; }
        setBlight(id, 0, 1);
        if (isPlanet(id) && id.endsWith(planetSymbolLetters[rolls.symbol])) { placeBuilding(id, freeOwner, "city"); }
    });
    // 2 players: the Imperial planets' resources on the ambition boxes
    if (players.length == 2) {
        neutralCounts = {};
        getAllSystemIds().filter(id => isPlanet(id) && imperial.includes(getCluster(id))).forEach(id => {
            const ambition = outOfPlayAmbitions[getPlanetResource(id)];
            neutralCounts[ambition] = (neutralCounts[ambition] || 0) + 1;
        });
    }
    players.forEach(player => { player.startingCity = 0; syncPanelFromBoard(player); });
    campaign.boardSetUp = true;
    campaign.placeIndex = 0;
    SaveAllSettings();
}

function getActOnePlacementOrder() {
    // In turn order, then again in reverse
    const order = getTurnOrder();
    return order.concat(order.slice().reverse());
}

function getActOnePlaces() {
    // Planets with an Imperial ship and an empty slot
    return getSystemIds().filter(id => isPlanet(id) && getImperial(id).fresh + getImperial(id).damaged > 0 && getEmptySlotCount(id) > 0);
}

function placeActOnePieces(player, id, kind) {
    addShips(id, player.number, 3);
    placeBuilding(id, player.number, kind);
    const resource = getPlanetResource(id);
    setPlayerResource(player, resource, player[resource + "Value"] + 1);
    syncPanelFromBoard(player);
    campaign.placeIndex = (campaign.placeIndex || 0) + 1;
    SaveAllSettings();
}

function chooseBotActOnePlace(player) {
    // A starport first, then a city: on a type of planet it has no resource of yet, with room,
    // and away from Rivals if it can
    const places = getActOnePlaces();
    const placedBefore = getBoardBuildings(player.number).length > 0;
    const score = id => (player[getPlanetResource(id) + "Value"] == 0 ? 4 : 0) + getEmptySlotCount(id)
        - players.filter(other => other !== player && hasLoyalPiece(id, other.number)).length * 2 + Math.random();
    const id = places.sort((a, b) => score(b) - score(a))[0];
    return id == null ? null : { id: id, kind: placedBefore ? "city" : "starport" };
}

function nextActOnePlacement() {
    // The next player to place, until everyone has placed twice
    const order = getActOnePlacementOrder();
    while ((campaign.placeIndex || 0) < order.length) {
        const player = order[campaign.placeIndex];
        if (player.isHuman) { showActOnePlacement(player); return; }
        const choice = chooseBotActOnePlace(player);
        if (choice == null) { campaign.placeIndex++; continue; }
        placeActOnePieces(player, choice.id, choice.kind);
    }
    finishActOnePlacements();
}

function showActOnePlacement(player, chosen = null, kind = "city") {
    const places = getActOnePlaces();
    if (places.length == 0) { campaign.placeIndex++; SaveAllSettings(); nextActOnePlacement(); return; }
    const id = chosen != null && places.includes(chosen) ? chosen : places[0];
    const order = getActOnePlacementOrder();
    const imperial = getImperialClusters(campaign.setupRolls);
    const option = place => {
        const others = getPiecesText(place).split(". ").filter(text => /^Player /.test(text)).join(", ");
        return "<button type=\"button\" class=\"btn " + (place == id ? "btn-secondary" : "btn-outline-secondary") + " text-start\" id=\"actOnePlace_" + place + "\" onclick=\"showActOnePlacement(getPlayer(" + player.number + "), '" + place + "', '" + kind + "')\">"
            + getSystemName(place) + "<small class=\"d-block " + (place == id ? "" : "text-secondary") + "\">" + getEmptySlotCount(place) + " empty slot" + (getEmptySlotCount(place) == 1 ? "" : "s") + " &middot; 1 Imperial ship"
            + (others ? " &middot; " + tagPlayerNames(others) : "") + "</small></button>";
    };
    const kindButton = value => "<button type=\"button\" class=\"btn " + (value == kind ? "btn-secondary" : "btn-outline-secondary") + "\" id=\"actOneKind_" + value + "\" onclick=\"showActOnePlacement(getPlayer(" + player.number + "), '" + id + "', '" + value + "')\">" + capitalise(value) + "</button>";
    const next = order[(campaign.placeIndex || 0) + 1];
    const html = "<p class=\"mb-2\">Place <b>3 ships and 1 building</b> in an empty slot at a planet with an Imperial ship. You gain 1 resource of that planet.</p>"
        + "<div class=\"small text-secondary mb-1\">Clusters " + imperial.join(" and ") + " are Imperial. Planets with an empty slot:</div>"
        + "<div class=\"d-grid gap-2 mb-3\">" + places.map(option).join("") + "</div>"
        + "<div class=\"d-flex align-items-center gap-2 mb-3\"><span class=\"small\">Building</span><div class=\"btn-group btn-group-sm\">" + kindButton("city") + kindButton("starport") + "</div></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"actOnePlaceDone\" onclick=\"confirmActOnePlacement(" + player.number + ", '" + id + "', '" + kind + "')\">Place 3 ships and a " + kind + " at " + getSystemName(id) + "</button>"
        + (next != null ? "<div class=\"small text-secondary mt-2\">Next: " + getPlayerTag(next) + (next.isHuman ? "" : " (bot)") + ".</div>" : "");
    document.getElementById("guildTitle").innerHTML = actNames[1] + " setup &middot; " + (isYou(player) ? "Your placement" : "Player " + player.number + "'s placement");
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = html;
    const modal = document.getElementById("guildModal");
    if (!modal.classList.contains("show")) { showLockedModal(modal); }
}

function confirmActOnePlacement(number, id, kind) {
    placeActOnePieces(getPlayer(number), id, kind);
    nextActOnePlacement();
}

function finishActOnePlacements() {
    // Free cities in every empty slot on a planet with an Imperial ship, then what to place on the table
    if (!campaign.freeCitiesPlaced) {
        getSystemIds().filter(id => isPlanet(id) && getImperial(id).fresh + getImperial(id).damaged > 0)
            .forEach(id => { while (getEmptySlotCount(id) > 0) { placeBuilding(id, freeOwner, "city"); } });
        campaign.freeCitiesPlaced = true;
        SaveAllSettings();
    }
    const systems = getSystemIds().filter(id => getPiecesText(id).split(". ").some(text => /^Player /.test(text)) || getBuildings(id, freeOwner).length > 0 && getImperial(id).fresh > 0);
    const html = "<p class=\"mb-2\">Place the players' pieces, and the Free cities on the Imperial planets:</p>"
        + "<div class=\"mb-2\">" + systems.map(id => "<div class=\"d-flex gap-2 py-1 border-bottom\"><span style=\"min-width:130px\">" + getSystemName(id) + "</span><span class=\"small\">" + tagPlayerNames(getPiecesText(id)) + "</span></div>").join("") + "</div>"
        + "<p class=\"small text-secondary mb-3\">Each player's resources are on their panel.</p>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"actOneSetupDone\" onclick=\"closeActOneSetup()\">Done: start chapter 1</button>";
    document.getElementById("guildTitle").innerHTML = actNames[1] + " setup &middot; The players' pieces";
    document.querySelector("#guildModal .modal-header").classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    document.getElementById("guildBody").innerHTML = html;
    const modal = document.getElementById("guildModal");
    if (!modal.classList.contains("show")) { showLockedModal(modal); }
}

function closeActOneSetup() {
    const modal = document.getElementById("guildModal");
    modal.addEventListener('hidden.bs.modal', () => { lastAnnouncedLeader = null; startRoundAfterMulligan(); }, { once: true });
    bootstrap.Modal.getOrCreateInstance(modal).hide();
}

function stepNeutral(ambition, change) {
    neutralCounts[ambition] = Math.max((neutralCounts[ambition] || 0) + change, 0);
    document.getElementById("neutralSetup_" + ambition).innerHTML = neutralCounts[ambition];
    SaveAllSettings();
}
