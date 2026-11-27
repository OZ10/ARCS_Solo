// Blighted Reach campaign (#85 stage 7d, the user's mock-ups E, F and G): a human player's Fate card
// actions in their turn window, each in a window that puts it on the app's board; the Pathfinder's
// Clues (the app keeps a bot's secret planet); and a human player's ships in their Fate's setup.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// Each Fate card action: [kind, name, the action it replaces ("prelude" for none), Fate, Acts]
const fateCardActions = [
    ["seat", "Claim Fief", "tax", 16, [2, 3]],
    ["bunker", "Build a Bunker", "build", 18, [3]],
    ["fragment", "Repair Hammer", "repair", 11, [2]],
    ["prepare", "Prepare", "build", 11, [2]],
    ["break", "Break World", "battle", 11, [2]],
    ["spawn", "Spawn", "build", 13, [2]],
    ["seed", "Seed", "build", 21, [3]],
    ["revolt", "Incite Revolt", "battle", 2, [3]],
    ["portal", "Use the Portal", "move", 9, [3]],
    ["awaken", "Awaken", "influence", 5, [1]],
    ["banner", "Plant a Banner", "prelude", 10, [2, 3]],
    ["witness", "Take a Witness", "prelude", 14, [2]],
    ["pilgrims", "Move Pilgrims", "prelude", 9, [3]],
    ["clue", "Uncover a Clue", "prelude", 9, [2]]
];

function getFateCardActions(player) {
    if (typeof campaign == "undefined" || campaign == null) { return []; }
    return fateCardActions.filter(([, , , fate, acts]) => hasFate(player, fate) && acts.includes(campaign.act))
        // The Clues need the app to hold the secret planet: a bot to their right
        .filter(([kind]) => kind != "clue" || isClueHolderBot());
}

// Every place on the board for one of them, as [{ where, label, sub }] (the bot picks the best)

function getFatePlaces(player, kind) {
    const n = player.number;
    const controls = id => getControllerFor(id, n) == n;
    const has = (id, kinds) => getTokens(id).some(token => kinds.includes(token.kind));
    const place = (where, sub) => ({ where: where, label: getSystemName(where.system), sub: sub });
    switch (kind) {
        case "seat": {
            const seated = new Set(getSystemIds().filter(id => has(id, ["seat"])).map(getCluster));
            return getSystemIds().filter(id => getBuildings(id, n, "city").length > 0 && controls(id) && !seated.has(getCluster(id)))
                .map(id => place({ kind: "fate:seat", system: id }, "Your city · cluster " + getCluster(id) + " has no Seat"));
        }
        case "bunker":
            return getSystemIds().filter(id => isPlanet(id) && hasLoyalPiece(id, n) && !has(id, ["bunker"])).map(id => place({ kind: "fate:bunker", system: id }, tagPlayerNames(getPiecesText(id))));
        case "fragment":
            return getSystemIds().filter(id => controls(id) && has(id, ["hammerFragment"])).map(id => place({ kind: "fate:fragment", system: id }, "A Hammer Fragment you control"));
        case "prepare":
            if ((player.hammerFragments || 0) < 6) { return []; }
            return getSystemIds().filter(id => isPlanet(id) && controls(id) && !has(id, ["hammer", "brokenWorld"])).map(id => place({ kind: "fate:prepare", system: id }, "A planet you control"));
        case "break":
            if (player.preparedThisTurn) { return []; }
            return getSystemIds().filter(id => controls(id) && has(id, ["hammer"])).map(id => place({ kind: "fate:break", system: id }, "Everyone Provokes " + preludeResourceNames[getPlanetResource(id)] + " Outrage; every building there is destroyed"));
        case "spawn":
            return getSystemIds().filter(id => controls(id) && getBlight(id).fresh > 0).map(id => place({ kind: "fate:spawn", system: id }, "Damage a fresh Blight, place a damaged one"));
        case "seed": {
            const cluster = player.fateSeedRoll || (player.fateSeedRoll = Math.floor(Math.random() * 6) + 1);
            return getSystemIds().filter(id => getCluster(id) == cluster && getBlight(id).fresh + getBlight(id).damaged == 0).map(id => place({ kind: "fate:seed", system: id, roll: cluster }, "Rolled " + cluster + ": no Blight here"));
        }
        case "revolt": {
            const damaged = id => getImperial(id).damaged + players.filter(other => other !== player).reduce((total, other) => total + getShips(id, other.number).damaged, 0);
            return getSystemIds().filter(id => getBuildings(id, freeOwner, "city").some(city => !city.damaged) && damaged(id) > 0).map(id => place({ kind: "fate:revolt", system: id }, damaged(id) + " damaged Rival or Imperial ships destroyed"));
        }
        case "portal": case "banner": case "witness": {
            const offer = getFateBoardOffer(player, kind);
            return offer == null ? [] : [place(offer.where, offer.text)];
        }
        case "awaken": {
            const systems = getSystemIds().filter(id => has(id, ["golem"]) && controls(id));
            return systems.length == 0 ? [] : [{ where: { kind: "fate:awaken", systems: systems }, label: systems.map(getSystemName).join(" and "), sub: "Take the Golems you control onto Golem Hearth" }];
        }
        default:
            return [];
    }
}

// The turn window's Fate cards section (mock-up E)

function getHumanFateSectionHtml(player) {
    const actions = getFateCardActions(player);
    if (actions.length == 0) { return ""; }
    const use = getHumanActionUse(player);
    const used = player.fateUsedThisTurn || [];
    const rows = actions.map(([kind, name, replaces]) => {
        const places = kind == "pilgrims" ? getPilgrimMoves(player) : kind == "clue" ? (getClueSpot(player) != null ? [1] : []) : getFatePlaces(player, kind);
        const free = replaces == "prelude" ? !used.includes(kind) : use.left.some(slot => slot.types.includes(replaces));
        const why = replaces == "prelude" ? (used.includes(kind) ? "Done this turn" : "In your prelude")
            : (free ? "Instead of " + replacedActionNames[replaces] : "Your card has no " + humanBoardActionNames[replaces] + " left");
        const sub = places.length == 0 ? "Nowhere on the board" : why;
        const button = "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"fateAct_" + kind + "\" onclick=\"openFateAction('" + kind + "')\"" + (free && places.length > 0 ? "" : " disabled") + ">" + name + "</button>";
        return getTurnRow("<i class=\"bi bi-stars\"></i>", name + (replaces == "prelude" ? "" : " <span class=\"small text-secondary\">(instead of " + replacedActionNames[replaces] + ")</span>"), sub, button);
    }).join("");
    return getTurnSection("Fate cards", rows);
}

function openFateAction(kind) {
    returnToTurnWindow = true;
    closeTurnWindow(() => queueLeaderWindow(() => showFateAction(kind)));
}

function showFateAction(kind) {
    const player = getTurnPlayer();
    const action = fateCardActions.find(item => item[0] == kind);
    if (kind == "pilgrims") { showPilgrimsWindow(player); return; }
    if (kind == "clue") { showClueWindow(player); return; }
    const places = getFatePlaces(player, kind);
    fateWindowPlaces = places;
    showLeaderWindow(player, action[1], "<p class=\"mb-2\">Choose where:</p><div class=\"d-grid gap-2 mb-2\">"
        + places.map((option, index) => "<button type=\"button\" class=\"btn btn-outline-secondary text-start\" id=\"fatePlace" + index + "\" onclick=\"confirmFateAction('" + kind + "', " + index + ")\">" + option.label + "<small class=\"d-block text-secondary\">" + option.sub + "</small></button>").join("")
        + "</div><button type=\"button\" class=\"btn btn-link w-100\" onclick=\"closeLeaderWindow()\">Don't</button>");
}

let fateWindowPlaces = [];

function confirmFateAction(kind, index) {
    const player = getTurnPlayer();
    const option = fateWindowPlaces[index];
    const action = fateCardActions.find(item => item[0] == kind);
    if (option == null || action == null) { return; }
    applyFateBoardStep(player, option.where);
    // What the card gives besides the board: a Bunker's Captive, a Witness's Psionic
    if (kind == "bunker") { setPlayerResource(player, "captives", (player.captivesValue || 0) + 1); }
    if (kind == "witness") { setPlayerResource(player, "psionics", player.psionicsValue + 1); }
    recordFateAction(player, kind, action[2], action[1] + ": " + option.label);
    closeLeaderWindow();
}

function recordFateAction(player, kind, replaces, text) {
    // In place of an action, it uses one up; a prelude one is once a turn
    if (replaces != "prelude") { recordBoardAction(player, { action: replaces, text: text, undo: false }); return; }
    player.fateUsedThisTurn = (player.fateUsedThisTurn || []).concat(kind);
    syncPanelFromBoard(player);
    SaveAllSettings();
}

// Pilgrims (pattern C): each one may move once into an adjacent system you control or with your Flagship

function getPilgrimMoves(player) {
    const n = player.number;
    const flagshipAt = typeof getFlagshipSystem == "function" ? getFlagshipSystem(player) : null;
    const open = id => getControllerFor(id, n) == n || id == flagshipAt;
    return getSystemIds().flatMap(id => getTokens(id).filter(token => token.kind == "pilgrim" && token.owner == n).map(() => ({ from: id, options: getAdjacent(id).filter(open) })))
        .filter(item => item.options.length > 0);
}

let pilgrimChoices = [];

function showPilgrimsWindow(player) {
    const moves = getPilgrimMoves(player);
    if (pilgrimChoices.length != moves.length) { pilgrimChoices = moves.map(() => null); }
    const row = (item, index) => "<div class=\"py-2 border-bottom\"><div class=\"mb-1\"><i class=\"bi bi-person-walking\"></i> Pilgrim at " + getSystemName(item.from) + "</div><div class=\"d-flex flex-wrap gap-1\">"
        + [null].concat(item.options).map(to => "<button type=\"button\" class=\"btn btn-sm " + (pilgrimChoices[index] == to ? "btn-secondary" : "btn-outline-secondary") + "\" onclick=\"choosePilgrim(" + index + ", " + (to == null ? "null" : "'" + to + "'") + ")\">" + (to == null ? "Stay" : getSystemShortName(to)) + "</button>").join("") + "</div></div>";
    const moving = pilgrimChoices.filter(to => to != null).length;
    showLeaderWindow(player, "Move Pilgrims", "<p class=\"mb-1\">Move each Pilgrim once, into an adjacent system you control or with your Flagship.</p>" + moves.map(row).join("")
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-3\" id=\"pilgrimsConfirm\" onclick=\"confirmPilgrims()\"" + (moving == 0 ? " disabled" : "") + ">Move " + moving + " Pilgrim" + (moving == 1 ? "" : "s") + "</button>");
}

function choosePilgrim(index, to) {
    pilgrimChoices[index] = to;
    showPilgrimsWindow(getTurnPlayer());
}

function confirmPilgrims() {
    const player = getTurnPlayer();
    const moves = getPilgrimMoves(player);
    const steps = moves.map((item, index) => pilgrimChoices[index] != null ? { from: item.from, to: pilgrimChoices[index] } : null).filter(step => step != null);
    applyFateBoardStep(player, { kind: "fate:pilgrims", steps: steps });
    recordFateAction(player, "pilgrims", "prelude", "Moved " + steps.length + " Pilgrim" + (steps.length == 1 ? "" : "s"));
    pilgrimChoices = [];
    closeLeaderWindow();
}

// The Pathfinder's Clues (Act II). The player to its right secretly chooses the Portal's planet:
// when that's a bot, the app chooses and keeps it secret, and places each Clue for them

function getPathfinder() {
    return players.find(player => hasFate(player, 9)) || null;
}

function getPlayerToRight(player) {
    const index = players.indexOf(player);
    return players[(index - 1 + players.length) % players.length];
}

function isClueHolderBot() {
    const holder = campaign.portalHolder != null ? getPlayer(campaign.portalHolder) : null;
    return holder != null && !holder.isHuman;
}

function isCluesOffTheApp(player) {
    // A human Pathfinder and a human holder: the Clues are on the table only
    const holder = campaign.portalHolder != null ? getPlayer(campaign.portalHolder) : null;
    return player.isHuman && (holder == null || holder.isHuman);
}

function setUpClues() {
    // At Act II's setup: who holds Clues to the Portal, and a bot's secret planet. A line for the setup window
    const pathfinder = getPathfinder();
    if (pathfinder == null) { return null; }
    const holder = getPlayerToRight(pathfinder);
    campaign.portalHolder = holder.number;
    if (holder.isHuman) { return "Player " + holder.number + " (to the Pathfinder's right) secretly writes down the Portal's planet, and holds Clues to the Portal"; }
    const planets = getSystemIds().filter(id => isPlanet(id));
    campaign.portalPlanet = planets[Math.floor(Math.random() * planets.length)];
    return "Player " + holder.number + " (a bot, to the Pathfinder's right) has chosen the Portal's planet: the app keeps it secret and places the Clues";
}

function getClueSpot(player) {
    // Its Flagship at a planet with no Clue or Portal, and a resource it holds that's no type of planet in that cluster
    const system = typeof getFlagshipSystem == "function" ? getFlagshipSystem(player) : null;
    if (system == null || !isPlanet(system) || getTokens(system).some(token => token.kind == "clue" || token.kind == "portal")) { return null; }
    const types = getSystemIds().filter(id => isPlanet(id) && getCluster(id) == getCluster(system)).map(getPlanetResource);
    const pay = preludeResources.filter(resource => !types.includes(resource) && player[resource + "Value"] > 0);
    return pay.length == 0 ? null : { system: system, pay: pay };
}

function resolveClue(player, system) {
    // The Clue the app places for a bot holder: the Portal, a Check (right cluster or symbol), or an X
    const portal = campaign.portalPlanet;
    if (portal == null) { return null; }
    if (system == portal) { return "portal"; }
    return getCluster(system) == getCluster(portal) || system.slice(-1) == portal.slice(-1) ? "check" : "x";
}

function placeClue(player, system, result) {
    // On the board, and the Pathfinder's objective: 1 for a Check, 8 for the Portal
    if (result == "portal") {
        getSystemIds().forEach(id => { getSystem(id).tokens = getTokens(id).filter(token => token.kind != "clue"); });
        addToken(system, "portal", null, 0);
        advanceObjective(player, 8, "found the Portal (Find the Portal)");
    } else {
        addToken(system, "clue", null, result == "check" ? 0 : 1);
        if (result == "check") { advanceObjective(player, 1, "a Check Clue (Find the Portal)"); }
    }
    SaveAllSettings();
}

const clueResultText = { check: "&#10003; Check: right cluster or right symbol", x: "&#10007; X: neither", portal: "the Portal: this is the planet" };

function showClueWindow(player) {
    // A human Pathfinder, with a bot holding the secret (mock-up F)
    const spot = getClueSpot(player);
    if (spot == null) { closeLeaderWindow(); return; }
    clueWindowPay = clueWindowPay && spot.pay.includes(clueWindowPay) ? clueWindowPay : spot.pay[0];
    const holder = getPlayer(campaign.portalHolder);
    showLeaderWindow(player, "Uncover a Clue", "<div class=\"small text-secondary mb-2\">Uncovering Clues &middot; your prelude</div>"
        + "<p class=\"mb-2\">Your Flagship is at " + getSystemName(spot.system) + ", with no Clue. Spend 1 resource that isn't a type of planet in cluster " + getCluster(spot.system) + ":</p>"
        + "<div class=\"d-flex flex-wrap gap-2 mb-3\">" + spot.pay.map(resource => "<button type=\"button\" class=\"btn " + (resource == clueWindowPay ? "btn-secondary" : "btn-outline-secondary") + "\" onclick=\"chooseCluePay('" + resource + "')\">" + preludeResourceNames[resource] + "</button>").join("") + "</div>"
        + "<div class=\"alert alert-secondary py-2 small mb-3\">" + getPlayerTag(holder) + " (a bot) chose the Portal's planet at setup. The app keeps it secret and places the Clue for them.</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"clueConfirm\" onclick=\"confirmClue()\">Spend 1 " + preludeResourceNames[clueWindowPay] + " and uncover the Clue</button>");
}

let clueWindowPay = null;

function chooseCluePay(resource) {
    clueWindowPay = resource;
    showClueWindow(getTurnPlayer());
}

function confirmClue() {
    const player = getTurnPlayer();
    const spot = getClueSpot(player);
    if (spot == null) { return; }
    setPlayerResource(player, clueWindowPay, player[clueWindowPay + "Value"] - 1);
    const result = resolveClue(player, spot.system);
    placeClue(player, spot.system, result);
    recordFateAction(player, "clue", "prelude", "A Clue at " + getSystemName(spot.system));
    showLeaderWindow(player, "Uncover a Clue", "<p class=\"mb-2\">The Clue at " + getSystemName(spot.system) + ":</p><div class=\"battleroll\">" + clueResultText[result] + "</div>"
        + "<p class=\"small text-secondary\">Place it on the table. It's on the app's board, and your objective has moved.</p><button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"closeLeaderWindow()\">OK</button>");
}

// A bot Pathfinder's Clue: decided from the board; a human holder answers (pattern D)

function applyBotClue(player, where) {
    const holder = getPlayer(campaign.portalHolder);
    if (holder != null && !holder.isHuman) { placeClue(player, where.system, resolveClue(player, where.system)); return; }
    // From the bot's turn window: it comes back once the holder has answered
    const turnModal = document.getElementById("turnModal");
    if (turnModal != null && turnModal.classList.contains("show")) {
        returnToTurnWindow = true;
        closeTurnWindow(() => askClueHolder(player, holder, where));
    } else { askClueHolder(player, holder, where); }
}

function askClueHolder(player, holder, where) {
    queueLeaderWindow(() => showLeaderWindow(holder, "Place a Clue", "<div class=\"small text-secondary mb-2\">Clues to the Portal &middot; " + getPlayerTag(player) + " (Pathfinder) uncovers a Clue</div>"
        + "<p class=\"mb-2\">" + getPlayerTag(player) + "'s Flagship is at " + getSystemName(where.system) + ". You wrote down the Portal's planet. Which Clue do you place there? The app doesn't know your planet, so it can't check.</p><div class=\"d-grid gap-2 mb-2\">"
        + ["check", "x", "portal"].map(result => "<button type=\"button\" class=\"btn btn-outline-secondary text-start\" id=\"clueAnswer_" + result + "\" onclick=\"answerClue(" + player.number + ", '" + where.system + "', '" + result + "')\"><b>" + { check: "&#10003; Check", x: "&#10007; X", portal: "Portal" }[result] + "</b><small class=\"d-block text-secondary\">"
            + { check: "Right cluster or right symbol", x: "Neither", portal: "This is the planet: place the Portal, and scrap the Clues and both cards" }[result] + "</small></button>").join("") + "</div>"));
}

function answerClue(playerNumber, system, result) {
    placeClue(getPlayer(playerNumber), system, result);
    closeLeaderWindow();
}

// A human player's ships in their Fate's setup (mock-up G): scrap, make up, or a ship on each gate

let fateShipsEdit = null;

function showFateShipsWindow(player, setup) {
    if (fateShipsEdit == null || fateShipsEdit.player != player.number) { fateShipsEdit = { player: player.number, scrap: {}, add: {} }; }
    const n = player.number;
    const sum = list => Object.values(list).reduce((total, count) => total + count, 0);
    const scrapping = (setup.scrapBefore || 0) + (setup.scrapAfter || 0);
    const onMap = getBoardShips(n) - sum(fateShipsEdit.scrap) + sum(fateShipsEdit.add);
    const toAdd = setup.makeUp ? Math.max(setup.makeUp - (getBoardShips(n) - (setup.scrapBefore || 0)), 0) : 0;
    const stepper = (part, id, count) => "<div class=\"d-flex align-items-center justify-content-between py-1 border-bottom\"><span>" + getSystemName(id) + "</span><span class=\"favorstep\">"
        + "<button type=\"button\" onclick=\"stepFateShips('" + part + "', '" + id + "', -1)\" aria-label=\"Fewer\"><i class=\"bi bi-dash\"></i></button><b>" + count + "</b>"
        + "<button type=\"button\" onclick=\"stepFateShips('" + part + "', '" + id + "', 1)\" aria-label=\"More\"><i class=\"bi bi-plus\"></i></button></span></div>";
    let html = "<div class=\"small text-secondary mb-2\">" + getFateName(player) + " &middot; Act " + ["", "I", "II", "III"][campaign.act] + " setup</div>";
    if (setup.gateShips) {
        const gates = getPirateGates(player);
        html += "<p class=\"mb-2\">Place 1 ship on the gate of each cluster with none of your ships: " + gates.map(getSystemName).join(", ") + ".</p>";
    } else {
        html += "<p class=\"mb-2\">" + (setup.scrapBefore ? "Scrap " + setup.scrapBefore + " Loyal ships, then make" : "Make") + " up " + setup.makeUp + " Loyal ships on the map, in systems with your pieces" + (setup.scrapAfter ? ", then scrap " + setup.scrapAfter : "") + ".</p>";
        if (scrapping > 0) {
            html += "<div class=\"turnlabel\">Scrap " + scrapping + " (" + sum(fateShipsEdit.scrap) + " chosen)</div>"
                + getSystemIds().filter(id => getShips(id, n).fresh + getShips(id, n).damaged > 0).map(id => stepper("scrap", id, fateShipsEdit.scrap[id] || 0)).join("");
        }
        html += "<div class=\"turnlabel mt-2\">Add " + toAdd + " (" + sum(fateShipsEdit.add) + " placed, " + onMap + " on the map)</div>"
            + getSystemIds().filter(id => hasLoyalPiece(id, n)).map(id => stepper("add", id, fateShipsEdit.add[id] || 0)).join("");
    }
    const ready = setup.gateShips || (sum(fateShipsEdit.scrap) == scrapping && sum(fateShipsEdit.add) == Math.min(toAdd, getShipSupply(player) + scrapping));
    html += "<button type=\"button\" class=\"btn btn-primary w-100 mt-3\" id=\"fateShipsDone\" onclick=\"confirmFateShips()\"" + (ready ? "" : " disabled") + ">Done: on the app's board</button>";
    document.getElementById("guildTitle").innerHTML = setup.gateShips ? "Place your ships" : "Make up your ships";
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = tagPlayerNames(html);
    const modal = document.getElementById("guildModal");
    if (!modal.classList.contains("show")) { showLockedModal(modal); }
}

function getFateName(player) {
    const fate = fates.find(item => item.number == getFateNumber(player));
    return fate != null ? "The " + fate.name : "Your Fate";
}

function getPirateGates(player) {
    const n = player.number;
    return getClustersInPlay().filter(cluster => !getSystemIds().some(id => getCluster(id) == cluster && getShips(id, n).fresh + getShips(id, n).damaged > 0)).map(cluster => cluster + "g");
}

function stepFateShips(part, id, change) {
    const step = campaign.setupSteps[0];
    const player = getPlayer(step.player);
    const list = fateShipsEdit[part];
    const most = part == "scrap" ? getShips(id, player.number).fresh + getShips(id, player.number).damaged : 99;
    list[id] = Math.min(Math.max((list[id] || 0) + change, 0), most);
    showFateShipsWindow(player, step.setup);
}

function confirmFateShips() {
    const step = campaign.setupSteps[0];
    const player = getPlayer(step.player);
    const n = player.number;
    if (step.setup.gateShips) {
        getPirateGates(player).forEach(id => { if (getShipSupply(player) > 0) { addShips(id, n, 1); } });
    } else {
        let scrapped = 0;
        Object.entries(fateShipsEdit.scrap).forEach(([id, count]) => { for (let i = 0; i < count; i++) { removeShips(id, n, 1, getShips(id, n).damaged > 0); scrapped++; } });
        player.scrappedShips = (player.scrappedShips || 0) + scrapped;
        Object.entries(fateShipsEdit.add).forEach(([id, count]) => addShips(id, n, count));
    }
    fateShipsEdit = null;
    syncPanelFromBoard(player);
    finishSetupStep();
}
