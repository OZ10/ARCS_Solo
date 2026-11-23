// A human player's actions on the board (#160 stage 3). Their turn window counts the actions
// their card and prelude give them, lists what they've done with Undo, and opens a window for each
// Move, Build, Tax or Repair that offers only what the board allows. A Battle is counted when its
// window updates the panels, and Secure or Influence with Done it.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The order the actions are listed in
const humanBoardActionOrder = ["move", "battle", "build", "repair", "tax", "secure", "influence"];
const humanBoardActionNames = { move: "Move", battle: "Battle", build: "Build", repair: "Repair", tax: "Tax", secure: "Secure", influence: "Influence" };

// The Move window while it's open: { from, to, fresh, damaged, route, routes, drops }
let humanMove = null;

function getBoardActions(player) {
    return player.boardActions || [];
}

// How many actions, and which kinds

function getHumanActionSlots(player) {
    // One slot for each action: [{ types, prelude }]. Prelude slots come first, as they're done first
    const slots = [];
    const spent = getPreludeSpent(player).filter(item => item.resource != null);
    spent.forEach(item => {
        if (item.resource == "weapons") { return; }
        const offer = humanPreludeActions[item.resource];
        const types = offer.action == "lead" ? (playedCardList.length > 0 ? playedCardList[0].actions.split(",") : [])
            : item.resource == "materials" ? ["build", "repair"] : [offer.action];
        slots.push({ types: types, prelude: true, resource: item.resource });
    });
    const play = getBotPlay(player);
    if (play != null) {
        // A Weapon lets any of the card's actions Battle
        const types = play.actions.split(",").concat(spent.some(item => item.resource == "weapons") ? ["battle"] : []);
        for (let count = 0; count < play.count; count++) { slots.push({ types: types, prelude: false }); }
    }
    return slots;
}

function getHumanActionUse(player) {
    // Which slot each action done used, a prelude one first. { slots, left, done }
    const slots = getHumanActionSlots(player).map(slot => ({ ...slot, used: false }));
    const done = getBoardActions(player).map(action => {
        const slot = slots.find(item => !item.used && item.prelude && item.types.includes(action.action))
            || slots.find(item => !item.used && item.types.includes(action.action));
        if (slot != null) { slot.used = true; }
        return { ...action, prelude: slot != null && slot.prelude, extra: slot == null };
    });
    return { slots: slots, left: slots.filter(slot => !slot.used), done: done };
}

function getHumanActionsLeftText(player) {
    const use = getHumanActionUse(player);
    return use.slots.length == 0 ? "No actions" : use.left.length + " of " + use.slots.length + " action" + (use.slots.length == 1 ? "" : "s") + " left";
}

// The turn window's sections

function getHumanActionNote(player, type) {
    // What's possible on the board for each kind
    const number = player.number;
    const list = ids => ids.length > 0 ? ids.join(", ") : "none";
    switch (type) {
        case "move": return "Your ships: " + list(getSystemsWithShips(number).map(id => { const ships = getShips(id, number); return id + " (" + (ships.fresh + ships.damaged) + ")"; }));
        case "battle": {
            const places = getHumanBattlePlaces(player);
            return places.length > 0 ? "Where your ships meet a Rival: " + places.map(place => place.system + " (" + place.rivals.map(rival => "Player " + rival).join(", ") + ")").join(", ") : "None of your ships share a system with a Rival";
        }
        case "build": return getHumanBuildOptions(player).length > 0 ? "Where you can: " + [...new Set(getHumanBuildOptions(player).map(option => option.system))].join(", ") : "Nowhere on the board";
        case "repair": return getHumanRepairOptions(player).length > 0 ? "Damaged: " + [...new Set(getHumanRepairOptions(player).map(option => option.system))].join(", ") : "Nothing damaged";
        case "tax": return getHumanTaxOptions(player).length > 0 ? "Cities you can tax: " + getHumanTaxOptions(player).map(option => option.system).join(", ") : "No cities to tax";
        default: return "In the Court window";
    }
}

function getHumanActionButton(type, enabled) {
    const disabled = enabled ? "" : " disabled";
    const icon = "<i class=\"bi " + (humanActionIcons[type] || "bi-dot") + "\"></i> ";
    if (type == "battle") { return "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"turnTool_battle\" onclick=\"useTurnTool('battle')\"" + disabled + ">" + icon + "Battle</button>"; }
    if (type == "secure" || type == "influence") {
        return "<span class=\"d-flex flex-column gap-1\"><button type=\"button\" class=\"btn btn-primary btn-sm turnact\" onclick=\"useTurnTool('court')\"" + disabled + ">" + icon + "Court</button>"
            + "<button type=\"button\" class=\"btn btn-outline-secondary btn-sm turnact\" id=\"humanDone_" + type + "\" onclick=\"recordCourtAction('" + type + "')\"" + disabled + ">Done it</button></span>";
    }
    return "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"humanAct_" + type + "\" onclick=\"openHumanBoardAction('" + type + "')\"" + disabled + ">" + icon + humanBoardActionNames[type] + "</button>";
}

function getHumanActionSections(player, offered) {
    // Done, then what's left. The windows offered are added to offered
    const use = getHumanActionUse(player);
    let html = "";
    if (use.done.length > 0) {
        html += getTurnSection("Done", use.done.map((action, index) => {
            const tag = action.prelude ? "<span class=\"preludetag\">Prelude</span>" : action.extra ? "<span class=\"preludetag\">Extra</span>" : "";
            const undo = action.undo === false ? "" : "<button type=\"button\" class=\"btn btn-link btn-sm p-0 turnact\" onclick=\"undoBoardAction(" + index + ")\">Undo</button>";
            return getTurnRow("<i class=\"bi bi-check-lg\"></i>", humanBoardActionNames[action.action] + tag, action.text, undo);
        }).join(""));
    }
    if (use.slots.length == 0) {
        return html + getTurnSection("Your actions", "<div class=\"small text-muted\">No actions this turn.</div>");
    }
    // Every kind the card and prelude give, greyed out once there's no action left for it
    const types = humanBoardActionOrder.filter(type => use.slots.some(slot => slot.types.includes(type)));
    const rows = types.map(type => {
        const open = use.left.some(slot => slot.types.includes(type));
        const preludeOnly = open && !use.left.some(slot => !slot.prelude && slot.types.includes(type));
        if (type == "battle") { offered.push("battle"); }
        if (type == "secure" || type == "influence") { offered.push("court"); }
        return getTurnRow("<i class=\"bi " + (humanActionIcons[type] || "bi-dot") + "\"></i>", humanBoardActionNames[type] + (preludeOnly ? "<span class=\"preludetag\">Prelude</span>" : ""),
            getHumanActionNote(player, type), getHumanActionButton(type, open));
    }).join("");
    return html + getTurnSection(getHumanActionsLeftText(player), rows);
}

// Recording and undoing

function recordBoardAction(player, action) {
    player.boardActions = getBoardActions(player).concat(action);
    syncPanelFromBoard(player);
    SaveAllSettings();
}

function recordCourtAction(type) {
    const player = getTurnPlayer();
    if (player == null) { return; }
    recordBoardAction(player, { action: type, text: type == "secure" ? "A card in the Court" : "An agent in the Court" });
    renderTurn(player);
}

function recordHumanBattle(attacker, defender, system) {
    // From the Battle window, when it updates the panels on the attacker's own turn
    if (!attacker.isHuman || getTurnPlayer() !== attacker || typeof defender.number != "number") { return; }
    attacker.boardActions = getBoardActions(attacker).concat({ action: "battle", text: "Player " + defender.number + (system != null ? " at " + system : ""), undo: false });
}

function undoBoardAction(index) {
    // Takes it off the board (and the panel), and gives the action back
    const player = getTurnPlayer();
    if (player == null) { return; }
    const action = getBoardActions(player)[index];
    if (action == null || action.undo === false) { return; }
    const number = player.number;
    if (action.action == "move") {
        action.placed.forEach(place => {
            const take = (count, damaged) => { const have = damaged ? getShips(place.to, number).damaged : getShips(place.to, number).fresh; const moved = Math.min(count, have); removeShips(place.to, number, moved, damaged); addShips(action.from, number, moved, damaged); };
            take(place.fresh, false);
            take(place.damaged, true);
        });
    } else if (action.action == "build") {
        if (action.kind == "ship") { removeShips(action.system, number, 1, action.damaged); }
        else { removeBuilding(action.system, number, action.kind); }
    } else if (action.action == "repair") {
        if (action.kind == "ship") { removeShips(action.system, number, 1); addShips(action.system, number, 1, true); }
        else { setBuildingDamaged(action.system, number, action.kind, true); }
    } else if (action.action == "tax") {
        setPlayerResource(player, action.resource, Math.max(player[action.resource + "Value"] - 1, 0));
        if (action.captured) { setPlayerResource(player, "captives", Math.max(player.captivesValue - 1, 0)); }
    }
    player.boardActions = getBoardActions(player).filter((other, at) => at != index);
    syncPanelFromBoard(player);
    SaveAllSettings();
    renderTurn(player);
}

// What the board allows

function getHumanBattlePlaces(player) {
    // Systems with its ships and a Rival's pieces: [{ system, rivals }]
    return getSystemsWithShips(player.number).map(id => ({ system: id, rivals: players.filter(other => other.number != player.number && hasLoyalPiece(id, other.number)).map(other => other.number) }))
        .filter(place => place.rivals.length > 0);
}

function getHumanBuildOptions(player) {
    // Cities and starports on planets with an empty slot and its piece; a ship at each starport
    // not yet used this turn. A system a Rival controls gets a damaged piece (rulebook p.12)
    const number = player.number;
    const shipsBuilt = getBoardActions(player).filter(action => action.action == "build" && action.kind == "ship").map(action => action.system);
    const options = [];
    getBuildableSystems(number).forEach(id => ["city", "starport"].forEach(kind => options.push({ system: id, kind: kind, damaged: isControlledByOther(id, number) })));
    getBoardBuildings(number, "starport").map(port => port.system).filter(id => !shipsBuilt.includes(id))
        .forEach(id => options.push({ system: id, kind: "ship", damaged: isControlledByOther(id, number) }));
    return options;
}

function getHumanRepairOptions(player) {
    const number = player.number;
    const ships = getSystemIds().filter(id => getShips(id, number).damaged > 0).map(id => ({ system: id, kind: "ship" }));
    const buildings = getBoardBuildings(number).filter(building => building.damaged).map(building => ({ system: building.system, kind: building.kind }));
    return ships.concat(buildings.filter((item, index) => buildings.findIndex(other => other.system == item.system && other.kind == item.kind) == index));
}

function getHumanTaxOptions(player) {
    // Each city once a turn
    const taxed = getBoardActions(player).filter(action => action.action == "tax").map(action => action.system + ":" + action.owner);
    return getTaxableCities(player.number).filter(city => !taxed.includes(city.system + ":" + city.owner))
        .filter((city, index, cities) => cities.findIndex(other => other.system == city.system && other.owner == city.owner) == index);
}

// The windows

function openHumanBoardAction(type) {
    returnToTurnWindow = true;
    closeTurnWindow(() => showHumanBoardAction(type));
}

function showHumanBoardAction(type) {
    const player = getTurnPlayer();
    if (player == null) { return; }
    const header = document.querySelector("#boardActionModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("boardActionTitle").innerHTML = humanBoardActionNames[type];
    if (type == "move") {
        const from = getSystemsWithShips(player.number)[0];
        humanMove = { from: null, to: null, fresh: 0, damaged: 0, route: null, routes: [], drops: {}, choosing: false };
        if (from != null) { chooseMoveFrom(from, false); }
        renderHumanMove();
    } else {
        renderHumanOptions(type);
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("boardActionModal")).show();
}

function closeHumanBoardAction() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById("boardActionModal")).hide();
}

function getOptionButton(main, sub, onclick, id) {
    return "<button type=\"button\" class=\"btn btn-outline-secondary text-start\"" + (id ? " id=\"" + id + "\"" : "") + " onclick=\"" + onclick + "\">" + main + "<small class=\"d-block text-secondary\">" + sub + "</small></button>";
}

function renderHumanOptions(type) {
    const player = getTurnPlayer();
    const body = document.getElementById("boardActionBody");
    let options = [];
    if (type == "build") {
        options = getHumanBuildOptions(player).map((option, index) => getOptionButton(
            option.kind == "ship" ? "<b>Ship</b> at your starport at " + option.system : "<b>" + capitalise(option.kind) + "</b> at " + getSystemName(option.system),
            (option.kind == "ship" ? "One per starport each turn" : getEmptySlotCount(option.system) + " empty slot" + (getEmptySlotCount(option.system) == 1 ? "" : "s")) + (option.damaged ? " &middot; damaged: a Rival controls it" : ""),
            "humanBuild(" + index + ")", "humanOption" + index));
    } else if (type == "repair") {
        options = getHumanRepairOptions(player).map((option, index) => getOptionButton("A damaged " + option.kind + " at " + option.system, "Turn it fresh side up", "humanRepair(" + index + ")", "humanOption" + index));
    } else if (type == "tax") {
        options = getHumanTaxOptions(player).map((option, index) => {
            const mine = option.owner == player.number;
            return getOptionButton((mine ? "Your " : "Player " + option.owner + "'s ") + "<b>" + preludeResourceNames[option.resource] + "</b> city at " + option.system,
                "Gain 1 " + preludeResourceNames[option.resource] + (mine ? "" : " and capture 1 of their agents (you control " + option.system + ")"), "humanTax(" + index + ")", "humanOption" + index);
        });
    }
    body.innerHTML = options.length > 0 ? "<div class=\"d-grid gap-2\">" + options.join("") + "</div>"
        : "<p class=\"text-muted mb-0\">Nothing on the app's board. If the table is different, fix it with Check the board in Options.</p>";
    body.innerHTML = tagPlayerNames(body.innerHTML);
}

function humanBuild(index) {
    const player = getTurnPlayer();
    const option = getHumanBuildOptions(player)[index];
    if (option == null) { return; }
    if (option.kind == "ship") { addShips(option.system, player.number, 1, option.damaged); }
    else if (!placeBuilding(option.system, player.number, option.kind, option.damaged)) { return; }
    recordBoardAction(player, { action: "build", system: option.system, kind: option.kind, damaged: option.damaged, text: "A " + (option.damaged ? "damaged " : "") + option.kind + " at " + option.system });
    closeHumanBoardAction();
}

function humanRepair(index) {
    const player = getTurnPlayer();
    const option = getHumanRepairOptions(player)[index];
    if (option == null) { return; }
    if (option.kind == "ship") { removeShips(option.system, player.number, 1, true); addShips(option.system, player.number, 1); }
    else { setBuildingDamaged(option.system, player.number, option.kind, false); }
    recordBoardAction(player, { action: "repair", system: option.system, kind: option.kind, text: "A " + option.kind + " at " + option.system });
    closeHumanBoardAction();
}

function humanTax(index) {
    const player = getTurnPlayer();
    const option = getHumanTaxOptions(player)[index];
    if (option == null) { return; }
    const captured = option.owner != player.number;
    setPlayerResource(player, option.resource, player[option.resource + "Value"] + 1);
    if (captured) { setPlayerResource(player, "captives", (player.captivesValue || 0) + 1); }
    recordBoardAction(player, { action: "tax", system: option.system, owner: option.owner, resource: option.resource, captured: captured,
        text: (captured ? "Player " + option.owner + "'s " : "Your ") + preludeResourceNames[option.resource].toLowerCase() + " city at " + option.system + ": 1 " + preludeResourceNames[option.resource] + (captured ? " and 1 Captive" : "") });
    closeHumanBoardAction();
}

// A Move: where from, where to, how many, and any left on the way

function getMoveRoutes(from, to, playerNumber) {
    // The shortest routes, through gates its ships can keep going through (a Catapult)
    if (areAdjacent(from, to)) { return [[from, to]]; }
    const routes = [];
    let paths = [[from]];
    const seen = new Set([from]);
    while (paths.length > 0 && routes.length == 0) {
        const next = [];
        const reachedNow = new Set();
        paths.forEach(path => {
            const at = path[path.length - 1];
            // Only the start, or a gate no one else controls, leads on
            if (at != from && !(isGate(at) && !isControlledByOther(at, playerNumber))) { return; }
            getAdjacent(at).filter(id => !seen.has(id)).forEach(id => {
                if (id == to) { routes.push(path.concat(id)); return; }
                next.push(path.concat(id));
                reachedNow.add(id);
            });
        });
        reachedNow.forEach(id => seen.add(id));
        paths = next;
    }
    return routes.slice(0, 6);
}

function chooseMoveFrom(from, render = true) {
    const ships = getShips(from, getTurnPlayer().number);
    humanMove.from = from;
    humanMove.to = null;
    humanMove.fresh = ships.fresh;
    humanMove.damaged = ships.damaged;
    humanMove.routes = [];
    humanMove.route = null;
    humanMove.drops = {};
    humanMove.choosing = false;
    if (render) { renderHumanMove(); }
}

function chooseMoveTo(to) {
    const player = getTurnPlayer();
    humanMove.to = to;
    humanMove.routes = getMoveRoutes(humanMove.from, to, player.number);
    humanMove.route = humanMove.routes[0] || [humanMove.from, to];
    humanMove.drops = {};
    humanMove.choosing = false;
    renderHumanMove();
}

function chooseMoveRoute(index) {
    humanMove.route = humanMove.routes[index];
    humanMove.drops = {};
    humanMove.choosing = false;
    renderHumanMove();
}

function toggleMoveRoutes() {
    humanMove.choosing = !humanMove.choosing;
    renderHumanMove();
}

function getMoveDropped() {
    return Object.values(humanMove.drops).reduce((total, count) => total + count, 0);
}

function stepMoveShips(field, change) {
    const ships = getShips(humanMove.from, getTurnPlayer().number);
    humanMove[field] = Math.min(Math.max(humanMove[field] + change, 0), ships[field]);
    // At least one ship arrives
    while (getMoveDropped() > 0 && getMoveDropped() >= humanMove.fresh + humanMove.damaged) {
        const last = Object.keys(humanMove.drops).filter(id => humanMove.drops[id] > 0).pop();
        humanMove.drops[last]--;
    }
    renderHumanMove();
}

function stepMoveDrop(id, change) {
    const total = humanMove.fresh + humanMove.damaged;
    const now = humanMove.drops[id] || 0;
    const next = Math.max(now + change, 0);
    if (change > 0 && getMoveDropped() + change >= total) { return; }
    humanMove.drops[id] = next;
    renderHumanMove();
}

function getMoveStepper(value, onminus, onplus) {
    return "<span class=\"favorstep\"><button type=\"button\" onclick=\"" + onminus + "\" aria-label=\"Fewer\"><i class=\"bi bi-dash\"></i></button><b>" + value + "</b>"
        + "<button type=\"button\" onclick=\"" + onplus + "\" aria-label=\"More\"><i class=\"bi bi-plus\"></i></button></span>";
}

function getMoveChip(id, sub, active, onclick) {
    return "<button type=\"button\" class=\"btn btn-sm " + (active ? "btn-secondary" : "btn-outline-secondary") + " text-start movechip\" style=\"min-width:96px\" id=\"moveChip_" + id + "\" onclick=\"" + onclick + "\">"
        + id + "<small class=\"d-block opacity-75\">" + sub + "</small></button>";
}

function getMoveSystemNote(id, playerNumber) {
    // Its type, and anyone else's pieces there
    const kind = isGate(id) ? "gate" : preludeResourceNames[getPlanetResource(id)];
    const others = players.filter(other => other.number != playerNumber && hasLoyalPiece(id, other.number)).map(other => "Player " + other.number);
    return kind + (others.length > 0 ? " &middot; " + others.join(", ") : "");
}

function getMoveText() {
    const total = humanMove.fresh + humanMove.damaged;
    const drops = Object.entries(humanMove.drops).filter(([, count]) => count > 0);
    return "Move " + total + " ship" + (total == 1 ? "" : "s") + " " + humanMove.from + " &rarr; " + humanMove.to
        + (drops.length > 0 ? ", leaving " + drops.map(([id, count]) => count + " at " + id).join(" and ") : "");
}

function renderHumanMove() {
    const player = getTurnPlayer();
    const number = player.number;
    const body = document.getElementById("boardActionBody");
    const sources = getSystemsWithShips(number);
    if (sources.length == 0) {
        body.innerHTML = "<p class=\"text-muted mb-0\">You have no ships on the app's board. If the table is different, fix it with Check the board in Options.</p>";
        return;
    }
    let html = "<div class=\"small text-secondary mb-1\">From</div><div class=\"d-flex flex-wrap gap-1 mb-2\">"
        + sources.map(id => {
            const ships = getShips(id, number);
            const starport = getBuildings(id, number, "starport").length > 0;
            return getMoveChip(id, (ships.fresh + ships.damaged) + " ship" + (ships.fresh + ships.damaged == 1 ? "" : "s") + (starport ? ", starport" : ""), id == humanMove.from, "chooseMoveFrom('" + id + "')");
        }).join("") + "</div>";
    if (humanMove.from != null) {
        const catapult = getBuildings(humanMove.from, number, "starport").length > 0;
        html += "<div class=\"small text-secondary mb-1\">To" + (catapult ? " <span class=\"text-body\">(" + humanMove.from + " has your starport: Catapult)</span>" : "") + "</div>"
            + "<div class=\"d-flex flex-wrap gap-1 mb-2\">" + getMoveDestinations(humanMove.from, number).map(id => getMoveChip(id, getMoveSystemNote(id, number), id == humanMove.to, "chooseMoveTo('" + id + "')")).join("") + "</div>";
        const ships = getShips(humanMove.from, number);
        html += "<div class=\"d-flex align-items-center flex-wrap gap-2 mb-2\"><span class=\"small\">Ships</span>"
            + getMoveStepper(humanMove.fresh, "stepMoveShips('fresh', -1)", "stepMoveShips('fresh', 1)") + "<span class=\"small text-secondary\">fresh</span>"
            + (ships.damaged > 0 ? getMoveStepper(humanMove.damaged, "stepMoveShips('damaged', -1)", "stepMoveShips('damaged', 1)") + "<span class=\"small text-secondary\">damaged</span>" : "") + "</div>";
    }
    if (humanMove.to != null && humanMove.route != null) {
        const between = humanMove.route.slice(1, -1);
        if (between.length > 0) {
            html += "<div class=\"small text-secondary mb-1\">Leave any on the way? <span class=\"text-body\">" + humanMove.route.join(" &rarr; ") + "</span></div>"
                + "<div class=\"mb-1\">" + between.map(id => "<div class=\"d-flex align-items-center gap-2 py-1 border-bottom\"><b style=\"min-width:40px\">" + id + "</b>"
                    + "<span class=\"small text-secondary flex-fill\">" + getMoveSystemNote(id, number) + "</span>"
                    + getMoveStepper(humanMove.drops[id] || 0, "stepMoveDrop('" + id + "', -1)", "stepMoveDrop('" + id + "', 1)") + "</div>").join("") + "</div>";
        }
        if (humanMove.routes.length > 1) {
            html += "<div class=\"small text-secondary mb-2\">Went another way? <a href=\"#\" id=\"moveRoutes\" onclick=\"toggleMoveRoutes(); return false;\">Choose the route</a></div>";
            if (humanMove.choosing) {
                html += "<div class=\"d-grid gap-1 mb-2\">" + humanMove.routes.map((route, index) => "<button type=\"button\" class=\"btn btn-sm " + (route === humanMove.route ? "btn-secondary" : "btn-outline-secondary") + "\" onclick=\"chooseMoveRoute(" + index + ")\">" + route.join(" &rarr; ") + "</button>").join("") + "</div>";
            }
        }
    }
    const ready = humanMove.to != null && humanMove.fresh + humanMove.damaged > 0;
    html += "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"moveConfirm\" onclick=\"confirmHumanMove()\"" + (ready ? "" : " disabled") + ">"
        + (ready ? getMoveText() : humanMove.to == null ? "Choose where to" : "Choose how many ships") + "</button>";
    body.innerHTML = tagPlayerNames(html);
}

function confirmHumanMove() {
    const player = getTurnPlayer();
    const number = player.number;
    if (humanMove == null || humanMove.to == null || humanMove.fresh + humanMove.damaged == 0) { return; }
    // Fresh ships are left first, then damaged ones
    let fresh = humanMove.fresh, damaged = humanMove.damaged;
    const placed = [];
    Object.entries(humanMove.drops).filter(([, count]) => count > 0).forEach(([id, count]) => {
        const leftFresh = Math.min(count, fresh);
        const leftDamaged = count - leftFresh;
        fresh -= leftFresh;
        damaged -= leftDamaged;
        placed.push({ to: id, fresh: leftFresh, damaged: leftDamaged });
    });
    placed.push({ to: humanMove.to, fresh: fresh, damaged: damaged });
    placed.forEach(place => moveShips(humanMove.from, place.to, number, place.fresh, place.damaged));
    recordBoardAction(player, { action: "move", from: humanMove.from, to: humanMove.to, placed: placed, text: getMoveText().replace(/^Move /, "") });
    humanMove = null;
    closeHumanBoardAction();
}

// The Battle window: where, from the board

function getBattlePlacesFor(attacker, defender) {
    if (attacker == null || defender == null || typeof defender.number != "number") { return []; }
    return getSystemsWithShips(attacker.number).filter(id => hasLoyalPiece(id, defender.number));
}

function showBattleSystems() {
    // The systems where both sides have pieces, the one the counts came from chosen
    const holder = document.getElementById("battleSystems");
    if (holder == null) { return; }
    const places = getBattlePlacesFor(battle.attacker, battle.defender);
    holder.innerHTML = places.length == 0 ? ""
        : "<span class=\"small text-secondary\">Where</span>" + places.map(id => "<button type=\"button\" class=\"btn btn-sm " + (id == battle.boardSystem ? "btn-secondary" : "btn-outline-secondary") + "\" id=\"battleSystem_" + id + "\" onclick=\"chooseBattleSystem('" + id + "')\">" + id + "</button>").join("");
}

function chooseBattleSystem(id) {
    fillBattleFromSystem(id);
    showBattleSystems();
    updateBattleCounts();
}

function fillBattleFromSystem(system) {
    // The counts in one system. A human player's window counts all the defender's ships and
    // buildings together; a bot's splits fresh and damaged
    const { attacker, defender } = battle;
    battle.boardSystem = system;
    const mine = getShips(system, attacker.number);
    const ships = getShips(system, defender.number);
    const buildings = getBuildings(system, defender.number);
    if (attacker.isHuman) {
        battle.ships = Math.max(mine.fresh + mine.damaged, 1);
        battle.fresh = ships.fresh + ships.damaged;
        battle.damaged = 0;
        battle.freshBuildings = buildings.length;
        battle.damagedBuildings = 0;
    } else {
        battle.ships = Math.max(mine.fresh, 1);
        battle.fresh = ships.fresh;
        battle.damaged = ships.damaged;
        battle.freshBuildings = buildings.filter(building => !building.damaged).length;
        battle.damagedBuildings = buildings.filter(building => building.damaged).length;
    }
    battle.planet = isPlanet(system) ? getPlanetResource(system) : null;
}
