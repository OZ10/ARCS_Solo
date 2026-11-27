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
    // Lore preludes that give actions: Warlord's Terror (Influence), Tyrant's Ego (Secure) (lorehuman.js)
    getPreludeSpent(player).filter(item => item.lore != null && item.slots != null).forEach(item => item.slots.forEach(types => slots.push({ types: types, prelude: true, lore: item.lore })));
    const play = getBotPlay(player);
    if (play != null) {
        // A Weapon lets any of the card's actions Battle
        const types = play.actions.split(",").concat(spent.some(item => item.resource == "weapons") ? ["battle"] : []);
        for (let count = 0; count < play.count; count++) { slots.push({ types: types, prelude: false }); }
        // Warrior (Tactical): a Copy or Pivot to Battle may also Move, before or after it (#216)
        if (typeof hasTacticalMove == "function" && hasTacticalMove(player)) { slots.push({ types: ["move"], prelude: false, tactical: true }); }
        // Noble (Influential): a Copy or Pivot to Influence influences twice; Feastbringer (Charismatic):
        // a Copy or Pivot to Secure may also Influence (leaderrules.js)
        if (typeof getCopyPivotPower == "function") {
            const power = action => getCopyPivotPower(player, action);
            if (power("influence") != null && power("influence")[0] == 12) { slots.push({ types: ["influence"], prelude: false, free: true }); }
            if (power("secure") != null && power("secure")[0] == 7) { slots.push({ types: ["influence"], prelude: false, free: true }); }
        }
    }
    return slots;
}

function getHumanActionUse(player) {
    // Which slot each action done used, a prelude one first. { slots, left, done }
    const slots = getHumanActionSlots(player).map(slot => ({ ...slot, used: false }));
    // Each action takes a prelude slot first, then the one that allows the fewest other actions, so a
    // Move takes the Warrior's free Move before the card's action that could Battle (#216)
    const fits = (item, action) => !item.used && item.types.includes(action.action);
    const done = getBoardActions(player).map(action => {
        const slot = slots.find(item => fits(item, action) && item.prelude)
            || slots.filter(item => fits(item, action)).sort((a, b) => a.types.length - b.types.length)[0];
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
        case "move": return "Your ships: " + list(getSystemsWithShips(number).map(id => { const ships = getShips(id, number); return getSystemShortName(id) + " (" + (ships.fresh + ships.damaged) + ")"; }));
        case "battle": {
            const places = getHumanBattlePlaces(player);
            return places.length > 0 ? "Where your ships meet a Rival: " + places.map(place => getSystemName(place.system) + " (" + place.rivals.map(rival => "Player " + rival).join(", ") + ")").join(", ") : "None of your ships share a system with a Rival";
        }
        case "build": return getHumanBuildOptions(player).length > 0 ? "Where you can: " + [...new Set(getHumanBuildOptions(player).map(option => option.system))].map(getSystemName).join(", ") : "Nowhere on the board";
        case "repair": return getHumanRepairOptions(player).length > 0 ? "Damaged: " + [...new Set(getHumanRepairOptions(player).map(option => option.system))].map(getSystemName).join(", ") : "Nothing damaged";
        case "tax": return getHumanTaxOptions(player).length > 0 ? "Cities you can tax: " + getHumanTaxOptions(player).map(option => getSystemName(option.system)).join(", ") : "No cities to tax";
        default: return "In the Court window: each agent placed or card secured counts";
    }
}

function getHumanActionButton(type, enabled) {
    const disabled = enabled ? "" : " disabled";
    const icon = "<i class=\"bi " + (humanActionIcons[type] || "bi-dot") + "\"></i> ";
    if (type == "battle") { return "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"turnTool_battle\" onclick=\"useTurnTool('battle')\"" + disabled + ">" + icon + "Battle</button>"; }
    // The Court window counts each agent placed and card secured (#186)
    if (type == "secure" || type == "influence") {
        return "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" onclick=\"useTurnTool('court')\"" + disabled + ">" + icon + "Court</button>";
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
    // Prelude actions come first (#192): while one is left, only its kinds are open, listed at the top
    const preludeLeft = use.left.filter(slot => slot.prelude);
    const inPrelude = type => preludeLeft.some(slot => slot.types.includes(type));
    const types = humanBoardActionOrder.filter(type => use.slots.some(slot => slot.types.includes(type)))
        .sort((a, b) => Number(inPrelude(b)) - Number(inPrelude(a)));
    const rows = types.map(type => {
        const open = preludeLeft.length > 0 ? inPrelude(type) : use.left.some(slot => slot.types.includes(type));
        const tagged = preludeLeft.length > 0 ? inPrelude(type) : false;
        if (type == "battle") { offered.push("battle"); }
        if (type == "secure" || type == "influence") { offered.push("court"); }
        return getTurnRow("<i class=\"bi " + (humanActionIcons[type] || "bi-dot") + "\"></i>", humanBoardActionNames[type] + (tagged ? "<span class=\"preludetag\">Prelude</span>" : ""),
            getHumanActionNote(player, type), getHumanActionButton(type, open));
    }).join("");
    const first = preludeLeft.length > 0 ? "<div class=\"small text-secondary mb-1\">Your prelude action" + (preludeLeft.length == 1 ? " comes" : "s come") + " first, then your card's.</div>" : "";
    return html + getTurnSection(getHumanActionsLeftText(player), first + rows);
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

function isHumanTurnOf(player) {
    return player != null && player.isHuman && getTurnPlayer() === player;
}

function countHumanInfluence(player, number, change) {
    // An agent added in the Court window on their own turn is an Influence; taking it off again
    // takes back the last Influence on that card (#186)
    if (!isHumanTurnOf(player)) { return; }
    if (change > 0) {
        player.boardActions = getBoardActions(player).concat({ action: "influence", card: number, text: "An agent on " + getCourtCard(number).name, undo: false });
    } else {
        const actions = getBoardActions(player);
        const last = actions.map(action => action.action == "influence" && action.card == number).lastIndexOf(true);
        if (last >= 0) { player.boardActions = actions.filter((action, index) => index != last); }
    }
    SaveAllSettings();
}

function countHumanSecure(player, name) {
    if (!isHumanTurnOf(player)) { return; }
    player.boardActions = getBoardActions(player).concat({ action: "secure", text: name, undo: false });
    SaveAllSettings();
}

function recordHumanBattle(attacker, defender, system) {
    // From the Battle window, when it updates the panels on the attacker's own turn
    if (!attacker.isHuman || getTurnPlayer() !== attacker || typeof defender.number != "number") { return; }
    attacker.boardActions = getBoardActions(attacker).concat({ action: "battle", text: "Player " + defender.number + (system != null ? " at " + getSystemName(system) : ""), undo: false });
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
        if (action.flagship) { moveFlagship(player, action.to, action.from); }
    } else if (action.action == "build") {
        if (action.kind == "ship") { removeShips(action.system, number, 1, action.damaged); }
        else { removeBuilding(action.system, number, action.kind); }
    } else if (action.action == "repair") {
        if (action.kind == "ship") { removeShips(action.system, number, 1); addShips(action.system, number, 1, true); }
        else { setBuildingDamaged(action.system, number, action.kind, true); }
    } else if (action.action == "tax") {
        if (action.gained !== false) { setPlayerResource(player, action.resource, Math.max(player[action.resource + "Value"] - 1, 0)); }
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
    return getSystemsWithShips(player.number).map(id => ({ system: id, rivals: players.filter(other => other.number != player.number && hasLoyalPiece(id, other.number) && canHarmIn(id, player.number, other.number)).map(other => other.number) }))
        .filter(place => place.rivals.length > 0);
}

function getHumanBuildOptions(player) {
    // Cities and starports on planets with an empty slot and its piece; a ship at each starport
    // not yet used this turn. A system a Rival controls gets a damaged piece (rulebook p.12)
    const number = player.number;
    const shipsBuilt = getBoardActions(player).filter(action => action.action == "build" && action.kind == "ship").map(action => action.system);
    const options = [];
    // On a gate, only what Gate Ports or Gate Stations allow
    getBuildableSystems(number).forEach(id => (isGate(id) ? getGateBuildKinds(id, number) : ["city", "starport"]).forEach(kind => options.push({ system: id, kind: kind, damaged: isBuiltDamaged(id, number, kind) })));
    // Cloud Cities: a city outside the slots, for 1 resource of the planet's type (leaderrules.js)
    getCloudCitySystems(player).forEach(id => options.push({ system: id, kind: "city", cloud: true, damaged: isBuiltDamaged(id, number, "city") }));
    // Ships only while some are left in the supply. Empath's Bond: at any starport (leaderrules.js)
    getShipStarports(player).filter(id => !shipsBuilt.includes(id) && getShipSupply(player) > 0)
        .forEach(id => options.push({ system: id, kind: "ship", damaged: isBuiltDamaged(id, number, "ship") }));
    return options;
}

function getHumanRepairOptions(player) {
    const number = player.number;
    const ships = getSystemIds().filter(id => getShips(id, number).damaged > 0).map(id => ({ system: id, kind: "ship" }));
    const buildings = getBoardBuildings(number).filter(building => building.damaged).map(building => ({ system: building.system, kind: building.kind }));
    return ships.concat(buildings.filter((item, index) => buildings.findIndex(other => other.system == item.system && other.kind == item.kind) == index));
}

function getHumanTaxOptions(player) {
    // Each city once a turn, unless Warlord's Cruelty lets you tax them again (Leaders & Lore review)
    const again = typeof canTaxCityAgain == "function" && canTaxCityAgain(player);
    const taxed = again ? [] : getBoardActions(player).filter(action => action.action == "tax").map(action => action.system + ":" + action.owner);
    // A gate city once for each of its types: tax it for any one of them (Gate Stations)
    return getTaxableCities(player.number).filter(city => !taxed.includes(city.system + ":" + city.owner))
        .filter((city, index, cities) => cities.findIndex(other => other.system == city.system && other.owner == city.owner && other.resource == city.resource) == index);
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

function getOptionButton(main, sub, onclick, id, system = null) {
    // system: its colour bar (board.js getSystemBarClass)
    return "<button type=\"button\" class=\"btn btn-outline-secondary text-start" + (system != null ? " " + getSystemBarClass(system) : "") + "\"" + (id ? " id=\"" + id + "\"" : "") + " onclick=\"" + onclick + "\">" + main + "<small class=\"d-block text-secondary\">" + sub + "</small></button>";
}

function renderHumanOptions(type) {
    const player = getTurnPlayer();
    const body = document.getElementById("boardActionBody");
    let options = [];
    if (type == "build") {
        options = getHumanBuildOptions(player).map((option, index) => getOptionButton(
            option.kind == "ship" ? "<b>Ship</b> at " + (getBuildings(option.system, player.number, "starport").length > 0 ? "your starport" : "the starport") + " at " + getSystemName(option.system)
                : option.cloud ? "<b>City</b> outside the slots at " + getSystemName(option.system) : "<b>" + capitalise(option.kind) + "</b> at " + getSystemName(option.system),
            (option.kind == "ship" ? "One per starport each turn" + (getBuildings(option.system, player.number, "starport").length > 0 ? "" : " (Empath's Bond)")
                : option.cloud ? "Cloud Cities: costs 1 " + preludeResourceNames[getPlanetResource(option.system)] : isGate(option.system) ? (option.kind == "city" ? "Gate Stations" : "Gate Ports") + ": 1 per gate" : getEmptySlotCount(option.system) + " empty slot" + (getEmptySlotCount(option.system) == 1 ? "" : "s")) + (option.damaged ? " &middot; damaged: a Rival controls it" : ""),
            "humanBuild(" + index + ")", "humanOption" + index, option.system));
    } else if (type == "repair") {
        options = getHumanRepairOptions(player).map((option, index) => getOptionButton("A damaged " + option.kind + " at " + getSystemName(option.system), "Turn it fresh side up", "humanRepair(" + index + ")", "humanOption" + index, option.system));
    } else if (type == "tax") {
        options = getHumanTaxOptions(player).map((option, index) => {
            const mine = option.owner == player.number;
            const free = option.owner == freeOwner;
            // Anarchist (Inspiring): an empty slot where its ships are
            if (option.slot) { return getOptionButton("An empty <b>" + preludeResourceNames[option.resource] + "</b> slot at " + getSystemName(option.system), "Gain 1 " + preludeResourceNames[option.resource] + " (Anarchist, Inspiring)", "humanTax(" + index + ")", "humanOption" + index, option.system); }
            // A Free city: no agent to capture (#85)
            return getOptionButton((mine ? "Your " : free ? "A Free " : "Player " + option.owner + "'s ") + (option.gate ? "gate city at " + getSystemName(option.system) + ", for <b>" + preludeResourceNames[option.resource] + "</b>" : "<b>" + preludeResourceNames[option.resource] + "</b> city at " + getSystemName(option.system)),
                (getResourceSupply(option.resource) > 0 ? "Gain 1 " + preludeResourceNames[option.resource] : "No " + preludeResourceNames[option.resource] + " left to gain") + (mine ? "" : free ? " (you control " + getSystemShortName(option.system) + ")" : option.noCapture ? " (Empath's Bond: no Captive)" : " and capture 1 of their agents (you control " + getSystemShortName(option.system) + ")"), "humanTax(" + index + ")", "humanOption" + index, option.system);
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
    else if (!placeBuilding(option.system, player.number, option.kind, option.damaged, option.cloud === true)) { return; }
    // Cloud Cities: 1 resource of the planet's type
    if (option.cloud) { const resource = getPlanetResource(option.system); setPlayerResource(player, resource, player[resource + "Value"] - 1); }
    recordBoardAction(player, { action: "build", system: option.system, kind: option.kind, damaged: option.damaged, text: "A " + (option.damaged ? "damaged " : "") + option.kind + " at " + getSystemName(option.system) });
    closeHumanBoardAction();
}

function humanRepair(index) {
    const player = getTurnPlayer();
    const option = getHumanRepairOptions(player)[index];
    if (option == null) { return; }
    if (option.kind == "ship") { removeShips(option.system, player.number, 1, true); addShips(option.system, player.number, 1); }
    else { setBuildingDamaged(option.system, player.number, option.kind, false); }
    recordBoardAction(player, { action: "repair", system: option.system, kind: option.kind, text: "A " + option.kind + " at " + getSystemName(option.system) });
    closeHumanBoardAction();
}

function humanTax(index) {
    const player = getTurnPlayer();
    const option = getHumanTaxOptions(player)[index];
    if (option == null) { return; }
    const free = option.owner == freeOwner;
    const captured = option.owner != player.number && !option.noCapture && !free;
    // None left in the supply: only the Captive (#210)
    const gained = getResourceSupply(option.resource) > 0;
    if (gained) { setPlayerResource(player, option.resource, player[option.resource + "Value"] + 1); }
    if (captured) { setPlayerResource(player, "captives", (player.captivesValue || 0) + 1); }
    // A Leader's extra resource for a Copy or Pivot Tax, and Shaper (Mythic) may change the planet (leaderrules.js)
    applyLeaderTaxBonus(player);
    offerMythic(player, option.system);
    recordBoardAction(player, { action: "tax", system: option.system, owner: option.owner, resource: option.resource, gained: gained, captured: captured,
        text: (captured ? "Player " + option.owner + "'s " : free ? "a Free " : "Your ") + preludeResourceNames[option.resource].toLowerCase() + " city at " + getSystemName(option.system) + ": " + (gained ? "1 " + preludeResourceNames[option.resource] : "no " + preludeResourceNames[option.resource] + " left") + (captured ? " and 1 Captive" : "") });
    closeHumanBoardAction();
}

// A Move: where from, where to, how many, and any left on the way

function hasFlagshipAt(id, playerNumber) {
    // Its campaign Flagship is in this system (#85 stage 7d)
    return (getSystem(id).flagships || []).some(flagship => flagship.owner == playerNumber);
}

function getMoveRoutes(from, to, playerNumber, movingFresh = null) {
    // The shortest routes, through gates its ships can keep going through (a Catapult): those no
    // one else controls once the moving ships are there (#184)
    const moving = movingFresh != null ? movingFresh : getShips(from, playerNumber).fresh;
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
            // Control is checked before the ships move in (rulebook p.13)
            if (at != from && !(isGate(at) && !isCatapultStop(at, playerNumber))) { return; }
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
    // None to start with: the player sets how many, so they don't move them all by mistake (the user,
    // 2026-11-27). The steppers stop at what's there, and at a Leader's limit (Rebel, Disorganized)
    humanMove.fresh = 0;
    humanMove.damaged = 0;
    // Its Flagship there moves too, unless untoggled (#85 stage 7d)
    humanMove.flagship = hasFlagshipAt(from, getTurnPlayer().number);
    humanMove.routes = [];
    humanMove.route = null;
    humanMove.drops = {};
    humanMove.choosing = false;
    if (render) { renderHumanMove(); }
}

function chooseMoveTo(to) {
    const player = getTurnPlayer();
    humanMove.to = to;
    humanMove.routes = getMoveRoutes(humanMove.from, to, player.number, humanMove.fresh);
    // Sprinter Drives: one more step for fresh ships only, so no damaged ones that far
    const once = getMoveDestinations(humanMove.from, player.number, humanMove.fresh, true);
    if (!once.includes(to)) {
        humanMove.damaged = 0;
        const via = getAdjacent(to).find(id => once.includes(id));
        if (humanMove.routes.length == 0 && via != null) { humanMove.routes = getMoveRoutes(humanMove.from, via, player.number, humanMove.fresh).map(route => route.concat(to)); }
    }
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
    // Rebel (Disorganized): no more than 2 ships at a time
    const most = getLeaderMoveLimit(getTurnPlayer());
    if (humanMove.fresh + humanMove.damaged > most) { humanMove[field] -= humanMove.fresh + humanMove.damaged - most; }
    // Fewer fresh ships may not take control of a gate on the way, so check where it can go (#184)
    if (humanMove.to != null) {
        const number = getTurnPlayer().number;
        if (!getMoveDestinations(humanMove.from, number, humanMove.fresh).includes(humanMove.to)) { humanMove.to = null; humanMove.route = null; humanMove.routes = []; humanMove.drops = {}; }
        else if (field == "fresh") { humanMove.routes = getMoveRoutes(humanMove.from, humanMove.to, number, humanMove.fresh); const same = humanMove.routes.find(route => humanMove.route != null && route.join() == humanMove.route.join()); if (same != null) { humanMove.route = same; } else { humanMove.route = humanMove.routes[0]; humanMove.drops = {}; } }
    }
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

function getMoveChipRows(ids, chip) {
    // A line for each cluster, in map order: Gate, Arrow, Crescent, Hexagon (the user, 2026-11-27)
    const rows = [];
    sortSystemsInMapOrder(ids).forEach(id => {
        const last = rows[rows.length - 1];
        if (last != null && last.cluster == getCluster(id)) { last.ids.push(id); } else { rows.push({ cluster: getCluster(id), ids: [id] }); }
    });
    // Each in its column, with a gap where one isn't listed (the Twisted Passage on its own)
    const cells = row => row.cluster == 0 ? row.ids.map(chip).join("")
        : [row.cluster + "g"].concat(planetLetters.map(letter => row.cluster + letter)).map(id => row.ids.includes(id) ? chip(id) : "<span class=\"movechipgap\"></span>").join("");
    return "<div class=\"mb-2\">" + rows.map(row => "<div class=\"d-flex gap-1 mb-1 movechiprow\">" + cells(row) + "</div>").join("") + "</div>";
}

function getMoveChip(id, sub, active, onclick) {
    return "<button type=\"button\" class=\"btn btn-sm " + (active ? "btn-secondary" : "btn-outline-secondary") + " text-start movechip " + getSystemBarClass(id) + "\" style=\"min-width:96px\" id=\"moveChip_" + id + "\" onclick=\"" + onclick + "\">"
        + getSystemShortName(id) + "<small class=\"d-block opacity-75\">" + sub + "</small></button>";
}

function getMoveSystemNote(id, playerNumber) {
    // Its type, and anyone else's pieces there
    // The Twisted Passage: where ships go from it (campaign/gatewraith.js)
    const kind = id == twistedPassageId ? "out to " + getTwistedPassageSymbol() + " planets" : isGate(id) ? "gate" : preludeResourceNames[getPlanetResource(id)];
    const others = players.filter(other => other.number != playerNumber && hasLoyalPiece(id, other.number)).map(other => "Player " + other.number);
    return kind + (others.length > 0 ? " &middot; " + others.join(", ") : "");
}

function getMoveText() {
    const total = humanMove.fresh + humanMove.damaged;
    const drops = Object.entries(humanMove.drops).filter(([, count]) => count > 0);
    return "Move " + (humanMove.flagship ? "the Flagship" + (total > 0 ? " and " : "") : "") + (total > 0 || !humanMove.flagship ? total + " ship" + (total == 1 ? "" : "s") : "") + " " + getSystemName(humanMove.from) + " &rarr; " + getSystemName(humanMove.to)
        + (drops.length > 0 ? ", leaving " + drops.map(([id, count]) => count + " at " + getSystemName(id)).join(" and ") : "")
        + (humanMove.breakGate ? " and break it" : "");
}

function renderHumanMove() {
    const player = getTurnPlayer();
    const number = player.number;
    const body = document.getElementById("boardActionBody");
    // Systems with its ships, and its Flagship's (#85 stage 7d)
    const flagshipSystem = typeof getFlagshipSystem == "function" && player.flagship != null ? getFlagshipSystem(player) : null;
    const sources = sortSystemsInMapOrder(getSystemsWithShips(number).concat(flagshipSystem != null && !getSystemsWithShips(number).includes(flagshipSystem) ? [flagshipSystem] : []));
    if (sources.length == 0) {
        body.innerHTML = "<p class=\"text-muted mb-0\">You have no ships on the app's board. If the table is different, fix it with Check the board in Options.</p>";
        return;
    }
    // From: its systems in map order, in a plain row (the user, 2026-11-27)
    let html = "<div class=\"small text-secondary mb-1\">From</div><div class=\"d-flex flex-wrap gap-1 mb-2\">"
        + sources.map(id => {
            const ships = getShips(id, number);
            const starport = getBuildings(id, number, "starport").length > 0;
            return getMoveChip(id, (ships.fresh + ships.damaged) + " ship" + (ships.fresh + ships.damaged == 1 ? "" : "s") + (starport ? ", starport" : ""), id == humanMove.from, "chooseMoveFrom('" + id + "')");
        }).join("") + "</div>";
    if (humanMove.from != null) {
        const catapult = canCatapultFrom(humanMove.from, number);
        // Where all its fresh ships there could go until it sets how many (#184: fewer may reach less far)
        const destinations = getMoveDestinations(humanMove.from, number, humanMove.fresh > 0 ? humanMove.fresh : null);
        // The system it's moving from shows in its place, greyed out, so no gap is left there
        const here = id => "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary text-start movechip " + getSystemBarClass(id) + "\" disabled>" + getSystemShortName(id) + "<small class=\"d-block opacity-75\">you're here</small></button>";
        html += "<div class=\"small text-secondary mb-1\">To" + (catapult ? " <span class=\"text-body\">(" + getSystemShortName(humanMove.from) + (isGate(humanMove.from) ? ": Catapult (Shaper, Ancient)" : " has your starport: Catapult") + ")</span>" : "") + "</div>"
            + getMoveChipRows(destinations.concat(humanMove.from), id => id == humanMove.from ? here(id) : getMoveChip(id, getMoveSystemNote(id, number), id == humanMove.to, "chooseMoveTo('" + id + "')"));
        const ships = getShips(humanMove.from, number);
        // None to start with: a reminder to set how many (the user, 2026-11-27)
        const none = humanMove.fresh + humanMove.damaged == 0;
        html += "<div class=\"d-flex align-items-center flex-wrap gap-2 mb-2\"><span class=\"small\">Ships</span>"
            + getMoveStepper(humanMove.fresh, "stepMoveShips('fresh', -1)", "stepMoveShips('fresh', 1)") + "<span class=\"small text-secondary\">fresh of " + ships.fresh + "</span>"
            + (ships.damaged > 0 ? getMoveStepper(humanMove.damaged, "stepMoveShips('damaged', -1)", "stepMoveShips('damaged', 1)") + "<span class=\"small text-secondary\">damaged of " + ships.damaged + "</span>" : "") + "</div>"
            + (none && ships.fresh + ships.damaged > 0 ? "<div class=\"small text-danger mb-2\" id=\"moveShipsReminder\"><i class=\"bi bi-exclamation-circle\"></i> Set how many ships you're moving</div>" : "");
    }
    if (humanMove.to != null && humanMove.route != null) {
        const between = humanMove.route.slice(1, -1);
        if (between.length > 0) {
            html += "<div class=\"small text-secondary mb-1\">Leave any on the way? <span class=\"text-body\">" + humanMove.route.map(getSystemShortName).join(" &rarr; ") + "</span></div>"
                + "<div class=\"mb-1\">" + between.map(id => "<div class=\"d-flex align-items-center gap-2 py-1 border-bottom\"><b style=\"min-width:48px\">" + getSystemShortName(id) + "</b>"
                    + "<span class=\"small text-secondary flex-fill\">" + getMoveSystemNote(id, number) + "</span>"
                    + getMoveStepper(humanMove.drops[id] || 0, "stepMoveDrop('" + id + "', -1)", "stepMoveDrop('" + id + "', 1)") + "</div>").join("") + "</div>";
        }
        if (humanMove.routes.length > 1) {
            html += "<div class=\"small text-secondary mb-2\">Went another way? <a href=\"#\" id=\"moveRoutes\" onclick=\"toggleMoveRoutes(); return false;\">Choose the route</a></div>";
            if (humanMove.choosing) {
                html += "<div class=\"d-grid gap-1 mb-2\">" + humanMove.routes.map((route, index) => "<button type=\"button\" class=\"btn btn-sm " + (route === humanMove.route ? "btn-secondary" : "btn-outline-secondary") + "\" onclick=\"chooseMoveRoute(" + index + ")\">" + route.map(getSystemShortName).join(" &rarr; ") + "</button>").join("") + "</div>";
            }
        }
    }
    // The Gate Wraith: a Catapult into its cluster's gate may collapse it (campaign/gatewraith.js)
    if (typeof getMoveBreakHtml == "function") { html += getMoveBreakHtml(player, humanMove.from, humanMove.to); }
    if (humanMove.from != null && hasFlagshipAt(humanMove.from, number)) {
        html += "<div class=\"form-check form-switch mb-2\"><input class=\"form-check-input\" type=\"checkbox\" id=\"moveFlagship\"" + (humanMove.flagship ? " checked" : "") + " onchange=\"humanMove.flagship = this.checked; renderHumanMove()\"><label class=\"form-check-label\" for=\"moveFlagship\">Flagship moves too</label></div>";
    }
    const ready = isHumanMoveReady(number);
    html += "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"moveConfirm\" onclick=\"confirmHumanMove()\"" + (ready ? "" : " disabled") + ">"
        + (ready ? getMoveText() : humanMove.to == null ? "Choose where to" : "Choose how many ships") + "</button>";
    body.innerHTML = tagPlayerNames(html);
}

function isHumanMoveReady(number) {
    // Somewhere to go, and at least 1 ship moving (the user, 2026-11-27). Its Flagship on its own only
    // where it has no other ships
    if (humanMove == null || humanMove.from == null || humanMove.to == null) { return false; }
    if (humanMove.fresh + humanMove.damaged > 0) { return true; }
    const ships = getShips(humanMove.from, number);
    return humanMove.flagship && ships.fresh + ships.damaged == 0;
}

function confirmHumanMove() {
    const player = getTurnPlayer();
    const number = player.number;
    if (!isHumanMoveReady(number)) { return; }
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
    // Gate Ports: a Rival captures an agent for each of its gates the move goes into, checked
    // before the ships move in (leaderrules.js)
    applyGatePortsCapture(player, humanMove.route || [humanMove.from, humanMove.to]);
    placed.forEach(place => moveShips(humanMove.from, place.to, number, place.fresh, place.damaged));
    if (humanMove.flagship) { moveFlagship(player, humanMove.from, humanMove.to); }
    // The Gate Wraith collapsed the gate (campaign/gatewraith.js): that can't be undone here
    const broken = humanMove.breakGate && typeof getBreakableGate == "function" && getBreakableGate(player, humanMove.from) == humanMove.to;
    const text = getMoveText().replace(/^Move /, "");
    if (broken) {
        const result = breakGate(player, humanMove.from, humanMove.to);
        players.forEach(syncPanelFromBoard);
        showMessageToast("Breaking Gates", tagPlayerNames(result));
    }
    recordBoardAction(player, { action: "move", from: humanMove.from, to: humanMove.to, placed: placed, flagship: !!humanMove.flagship, text: text, undo: broken ? false : undefined });
    humanMove = null;
    closeHumanBoardAction();
}

// The Battle window: where, from the board

function getBattlePlacesFor(attacker, defender) {
    if (attacker == null || defender == null) { return []; }
    // The Free States, the Blight or the Empire in a campaign (#85 stage 7b)
    if (defender.campaignDefender != null) { return getSystemsWithShips(attacker.number).filter(id => isSpecialTargetIn(id, { kind: defender.campaignDefender })); }
    if (typeof defender.number != "number") { return []; }
    // Not where the Truce Law shields a Rival Regent
    return getSystemsWithShips(attacker.number).filter(id => hasLoyalPiece(id, defender.number) && canHarmIn(id, attacker.number, defender.number));
}

function showBattleSystems() {
    // The systems where both sides have pieces, the one the counts came from chosen
    const holder = document.getElementById("battleSystems");
    if (holder == null) { return; }
    const places = getBattlePlacesFor(battle.attacker, battle.defender);
    holder.innerHTML = places.length == 0 ? ""
        : "<span class=\"small text-secondary\">Where</span>" + places.map(id => "<button type=\"button\" class=\"btn btn-sm " + (id == battle.boardSystem ? "btn-secondary" : "btn-outline-secondary") + "\" id=\"battleSystem_" + id + "\" onclick=\"chooseBattleSystem('" + id + "')\">" + getSystemName(id) + "</button>").join("");
    // A campaign Flagship in the battle (campaign rulebook pp.23-24): what it adds, to count in by hand
    const system = battle.boardSystem;
    if (system != null && typeof hasFlagship == "function") {
        const notes = [battle.attacker, battle.defender].filter(player => player != null && typeof player.number == "number" && hasFlagship(player) && hasFlagshipAt(system, player.number)).map(player => player === battle.attacker
            ? getPlayerTag(player) + "'s Flagship attacks too: " + getFlagshipFreshStarports(player) + " more dice (fresh starports). Its Upgrades and Armor take hits like ships."
            : getPlayerTag(player) + "'s Flagship defends: its Upgrades and Armor take hits like buildings, and it intercepts only with a Defense Array.");
        if (notes.length > 0) { holder.innerHTML += "<div class=\"small text-secondary w-100 text-center\">" + notes.join("<br>") + " Change its slots on the panel after the battle.</div>"; }
    }
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
    // The Free States' buildings, the Blight or the Imperial ships for a campaign defender (#85 stage 7b)
    const kind = defender.campaignDefender;
    const ships = kind == "blight" ? getBlight(system) : kind == "empire" ? getImperial(system) : kind == "free" ? { fresh: 0, damaged: 0 } : getShips(system, defender.number);
    const buildings = kind == "free" ? getBuildings(system, freeOwner) : kind != null ? [] : getBuildings(system, defender.number);
    // The attacker's fresh and damaged ships (#189)
    battle.attackerDamaged = mine.damaged;
    // Fresh and damaged, for a human player's window too (#194)
    // Fresh and damaged attacking ships both roll dice (rulebook p.14): no phantom fresh ship
    battle.ships = mine.fresh + mine.damaged > 0 ? mine.fresh : 1;
    battle.fresh = ships.fresh;
    battle.damaged = ships.damaged;
    battle.freshBuildings = buildings.filter(building => !building.damaged).length;
    battle.damagedBuildings = buildings.filter(building => building.damaged).length;
    // What they are, fresh first, so the window needn't ask (#160)
    battle.boardBuildingKinds = buildings.filter(building => !building.damaged).concat(buildings.filter(building => building.damaged)).map(building => building.kind);
    battle.buildingKinds = battle.boardBuildingKinds.slice();
    // On a gate, its city is a gate city (Gate Stations)
    battle.planet = isPlanet(system) ? getPlanetResource(system) : (getBuildings(system, defender.number, "city").length > 0 ? "gate" : null);
    // Gatekeepers' 2 more dice, in a gate (#160)
    battle.inGate = isGate(system);
    // Predictive Sensors: a bot defender first moves fresh ships in from next door (leaderrules.js)
    if (applyPredictiveSensors(system)) { fillBattleFromSystem(system); }
}
