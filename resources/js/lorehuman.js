// Leaders & Lore: a human player's Lore actions (the user's mock-ups, 2026-11-27, #221). A "Lore cards"
// section in their turn window for Lore that replace an action (Summon, Fire Rifles, Nurture, Prune,
// Guide, Martyr, Annex), each with a window that puts it on the app's board; and Lore prelude rows
// (Warlord's Terror, Tyrant's Ego, Tycoon's Ambition and Charm, and the discards that clear Outrage).
// The board changes are the bots' (leaderrules.js applyLoreBoardStep).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// [kind, name, Lore number, the action it replaces, what it does]
const humanLoreActions = [
    ["summon", "Summon", 1, "build", "a ship at any city you control, once a turn"],
    ["nurture", "Nurture", 10, "build", "tax a Loyal city"],
    ["annex", "Annex", 26, "build", "a building you control becomes yours (Tyrant declared)"],
    ["prune", "Prune", 10, "repair", "swap a Loyal starport and city"],
    ["guide", "Guide", 16, "move", "anyone's ships to or from your fresh starport"],
    ["martyr", "Martyr", 18, "move", "1 fresh ship of yours for 1 of a Rival's, as a Trophy"],
    ["rifles", "Fire Rifles", 2, "battle", "skirmish dice at a Rival next to your fresh ships"]
];

function getHumanLoreActions(player) {
    if (!leadersAndLore || !player.isHuman) { return []; }
    return humanLoreActions.filter(([kind, , number]) => hasLore(player, number) && (kind != "annex" || declaredAmbitions.includes("tyrant")));
}

// Where each can go on the board: [{ where, label, sub }]

function getHumanLorePlaces(player, kind) {
    const n = player.number;
    const rivals = players.filter(other => other !== player);
    const shipsOf = (id, number) => getShips(id, number).fresh + getShips(id, number).damaged;
    switch (kind) {
        case "summon":
            if (getShipSupply(player) == 0 || (player.loreUsedThisTurn || []).includes("summon")) { return []; }
            return getSystemIds().filter(id => getBuildings(id, null, "city").length > 0 && getController(id) == n)
                .map(id => ({ where: { kind: "summon", system: id }, label: getSystemName(id), sub: "A city you control" }));
        case "nurture":
            if (getEmptySlots(player) == 0) { return []; }
            return getTaxableCities(n).filter(city => city.owner == n && getResourceSupply(city.resource) > 0)
                .filter((city, index, cities) => cities.findIndex(other => other.system == city.system && other.resource == city.resource) == index)
                .map(city => ({ where: { kind: "nurture", system: city.system, resource: city.resource }, label: getSystemName(city.system), sub: "Gain 1 " + preludeResourceNames[city.resource] }));
        case "annex":
            return getSystemIds().filter(id => getController(id) == n).flatMap(id => getBuildings(id).filter(building => building.owner != n && building.owner != freeOwner)
                .filter(building => building.kind != "city" || getUncoveredCities(player) < maxCities)
                .map(building => ({ where: { kind: "annex", system: id, owner: building.owner, building: building.kind }, label: getSystemName(id), sub: "Player " + building.owner + "'s " + building.kind + " becomes yours" })));
        case "prune": {
            const toCity = getBoardBuildings(n, "starport").filter(port => isPlanet(port.system) && getUncoveredCities(player) < maxCities)
                .map(port => ({ where: { kind: "prune", system: port.system }, label: getSystemName(port.system), sub: "Your starport becomes a city" }));
            const toPort = getBoardBuildings(n, "city").filter(city => isPlanet(city.system))
                .map(city => ({ where: { kind: "pruneCity", system: city.system }, label: getSystemName(city.system), sub: "Your city becomes a starport" }));
            return toCity.concat(toPort);
        }
        case "guide": {
            // Between a system with its fresh starport and one next to it, either way, anyone's ships
            const ports = [...new Set(getBoardBuildings(n, "starport").filter(port => !port.damaged).map(port => port.system))];
            const owners = id => players.filter(other => shipsOf(id, other.number) > 0);
            return ports.flatMap(port => getAdjacent(port).flatMap(next => owners(port).map(owner => ({ from: port, to: next, owner: owner }))
                .concat(owners(next).map(owner => ({ from: next, to: port, owner: owner })))))
                .map(move => ({ where: { kind: "guide", from: move.from, to: move.to, owner: move.owner.number }, label: getSystemShortName(move.from) + " &rarr; " + getSystemShortName(move.to),
                    sub: (move.owner === player ? "Your" : "Player " + move.owner.number + "'s") + " " + shipsOf(move.from, move.owner.number) + " ship" + (shipsOf(move.from, move.owner.number) == 1 ? "" : "s") }));
        }
        case "martyr":
            return getSystemIds().filter(id => getShips(id, n).fresh > 0).flatMap(id => rivals.filter(rival => shipsOf(id, rival.number) > 0)
                .map(rival => ({ where: { kind: "martyr", system: id, rival: rival.number }, label: getSystemName(id), sub: "Destroy 1 of Player " + rival.number + "'s ships there, as a Trophy" })));
        case "rifles":
            return getSystemIds().filter(id => getShips(id, n).fresh > 0).flatMap(from => getAdjacent(from).flatMap(at => rivals.filter(rival => shipsOf(at, rival.number) > 0 || getBuildings(at, rival.number).length > 0)
                .map(rival => ({ where: { kind: "rifles", from: from, at: at, rival: rival.number, dice: getShips(from, n).fresh }, label: getSystemShortName(from) + " &rarr; " + getSystemShortName(at),
                    sub: getShips(from, n).fresh + " skirmish " + (getShips(from, n).fresh == 1 ? "die" : "dice") + " at Player " + rival.number }))));
        default:
            return [];
    }
}

// The turn window's Lore cards section

function getHumanLoreSectionHtml(player) {
    const actions = getHumanLoreActions(player);
    if (actions.length == 0) { return ""; }
    const use = getHumanActionUse(player);
    const rows = actions.map(([kind, name, number, replaces, does]) => {
        const free = use.left.some(slot => slot.types.includes(replaces));
        const places = getHumanLorePlaces(player, kind);
        const sub = getLoreCard(number).name + ": " + (!free ? "your card has no " + humanBoardActionNames[replaces] + " left" : places.length == 0 ? "nowhere on the board" : does);
        const button = "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"loreAct_" + kind + "\" onclick=\"openHumanLore('" + kind + "')\"" + (free && places.length > 0 ? "" : " disabled") + ">" + name + "</button>";
        return getTurnRow("<i class=\"bi bi-book\"></i>", name + " <span class=\"small text-secondary\">(instead of " + replacedActionNames[replaces] + ")</span>", sub, button);
    }).join("");
    return getTurnSection("Lore cards", rows);
}

let humanLoreWindow = null;

function openHumanLore(kind) {
    returnToTurnWindow = true;
    closeTurnWindow(() => queueLeaderWindow(() => showHumanLore(kind)));
}

function showHumanLore(kind) {
    const player = getTurnPlayer();
    const action = humanLoreActions.find(item => item[0] == kind);
    const places = getHumanLorePlaces(player, kind);
    humanLoreWindow = { kind: kind, places: places, chosen: null, fresh: 0, damaged: 0, hits: 0 };
    const intro = "<div class=\"small text-secondary mb-2\">" + getLoreCard(action[2]).name + " &middot; instead of " + replacedActionNames[action[3]] + "</div>";
    showLeaderWindow(player, action[1], intro + "<p class=\"mb-2\">Choose where:</p><div class=\"d-grid gap-2 mb-2\">"
        + places.map((place, index) => "<button type=\"button\" class=\"btn btn-outline-secondary text-start " + getSystemBarClass(place.where.system || place.where.from) + "\" id=\"lorePlace" + index + "\" onclick=\"chooseHumanLore(" + index + ")\">"
            + place.label + "<small class=\"d-block text-secondary\">" + tagPlayerNames(place.sub) + "</small></button>").join("")
        + "</div><button type=\"button\" class=\"btn btn-link w-100\" onclick=\"closeLeaderWindow()\">Don't</button>");
}

function chooseHumanLore(index) {
    const state = humanLoreWindow;
    state.chosen = state.places[index];
    // Guide: how many of whose ships; Fire Rifles: how many hits. Otherwise straight onto the board
    if (state.kind == "guide" || state.kind == "rifles") { renderHumanLoreCounts(); return; }
    confirmHumanLore();
}

function renderHumanLoreCounts() {
    const player = getTurnPlayer();
    const state = humanLoreWindow;
    const where = state.chosen.where;
    const action = humanLoreActions.find(item => item[0] == state.kind);
    let html = "<div class=\"small text-secondary mb-2\">" + getLoreCard(action[2]).name + " &middot; instead of " + replacedActionNames[action[3]] + "</div>";
    let ready = false, label = "";
    if (state.kind == "guide") {
        const ships = getShips(where.from, where.owner);
        html += "<p class=\"mb-2\">" + (where.owner == player.number ? "Your" : getPlayerTag(getPlayer(where.owner)) + "'s") + " ships " + getSystemName(where.from) + " &rarr; " + getSystemName(where.to) + ". How many?</p>"
            + "<div class=\"d-flex align-items-center flex-wrap gap-2 mb-2\"><span class=\"small\">Ships</span>" + getMoveStepper(state.fresh, "stepHumanLore('fresh', -1)", "stepHumanLore('fresh', 1)") + "<span class=\"small text-secondary\">fresh of " + ships.fresh + "</span>"
            + (ships.damaged > 0 ? getMoveStepper(state.damaged, "stepHumanLore('damaged', -1)", "stepHumanLore('damaged', 1)") + "<span class=\"small text-secondary\">damaged of " + ships.damaged + "</span>" : "") + "</div>";
        ready = state.fresh + state.damaged > 0;
        label = ready ? "Guide " + (state.fresh + state.damaged) + " ship" + (state.fresh + state.damaged == 1 ? "" : "s") : "Set how many ships";
    } else {
        html += "<p class=\"mb-2\">Roll " + where.dice + " skirmish " + (where.dice == 1 ? "die" : "dice") + " from " + getSystemName(where.from) + " at Player " + where.rival + " in " + getSystemName(where.at) + ". How many hits?</p>"
            + "<div class=\"d-flex justify-content-center mb-2\">" + getMoveStepper(state.hits, "stepHumanLore('hits', -1)", "stepHumanLore('hits', 1)") + "</div>"
            + "<p class=\"small text-muted\">Ships before buildings: damaged ships are destroyed first (your Trophies), then fresh ones are damaged.</p>";
        ready = true;
        label = "Apply " + state.hits + " hit" + (state.hits == 1 ? "" : "s") + " to the board";
    }
    html += "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"loreConfirm\" onclick=\"confirmHumanLore()\"" + (ready ? "" : " disabled") + ">" + label + "</button>";
    showLeaderWindow(player, action[1], html);
}

function stepHumanLore(field, change) {
    const state = humanLoreWindow;
    const where = state.chosen.where;
    const most = field == "hits" ? where.dice : getShips(where.from, where.owner)[field];
    state[field] = Math.min(Math.max(state[field] + change, 0), most);
    renderHumanLoreCounts();
}

function confirmHumanLore() {
    const player = getTurnPlayer();
    const state = humanLoreWindow;
    if (state == null || state.chosen == null) { return; }
    const action = humanLoreActions.find(item => item[0] == state.kind);
    const where = { ...state.chosen.where };
    if (where.kind == "nurture") {
        setPlayerResource(player, where.resource, player[where.resource + "Value"] + 1);
        showSlotAdvice(player, [where.resource]);
    } else if (where.kind == "pruneCity") {
        // A city back to the board, a starport in its place
        if (removeBuilding(where.system, player.number, "city")) { placeBuilding(where.system, player.number, "starport"); }
    } else {
        if (where.kind == "guide") { where.fresh = state.fresh; where.damaged = state.damaged; }
        if (where.kind == "rifles") { where.hits = state.hits; }
        applyLoreBoardStep(player, where);
    }
    if (where.kind == "summon") { player.loreUsedThisTurn = (player.loreUsedThisTurn || []).concat("summon"); }
    recordBoardAction(player, { action: action[3], text: action[1] + " (" + getLoreCard(action[2]).name + "): " + state.chosen.label.replace(/<[^>]+>/g, " "), undo: false });
    players.forEach(syncPanelFromBoard);
    humanLoreWindow = null;
    closeLeaderWindow();
}

// Lore in the prelude: [{ number, text, note, use }] while it can be used now

function getHumanLorePreludeOptions(player) {
    if (!leadersAndLore || !player.isHuman) { return []; }
    const used = getPreludeSpent(player).filter(spent => spent.lore != null).map(spent => spent.lore + ":" + spent.kind);
    const options = [];
    const add = (number, kind, text, note) => { if (hasLore(player, number) && !used.includes(number + ":" + kind)) { options.push({ number: number, kind: kind, text: text, note: note }); } };
    if (declaredAmbitions.includes("warlord") && player.trophiesValue > 0) { add(24, "terror", "Return Trophies to Influence", "Warlord is declared. You have " + player.trophiesValue + ": 1 Influence each"); }
    if (declaredAmbitions.includes("tyrant") && player.captivesValue > 0) { add(25, "ego", "Return Captives to Secure", "Tyrant is declared. You have " + player.captivesValue + ": 1 Secure each"); }
    const tycoon = declaredAmbitions.includes("tycoon");
    if (tycoon && getPreludeSpent(player).length == 0 && getBoardActions(player).length == 0 && declaredAmbitions.length < 3) {
        add(27, "ambition", "Discard all your Material and Fuel to declare an ambition", "Tycoon is declared, and before any other actions. No zero marker");
    }
    if (tycoon && player.materialsValue + player.fuelValue > 0) { add(28, "charm", "Discard Material and Fuel for other resources", "Tycoon is declared. You have " + player.materialsValue + " Material, " + player.fuelValue + " Fuel"); }
    // Discard the card to clear its Outrage
    [[19, ["psionics"]], [21, ["relics"]], [23, ["weapons"]], [25, ["weapons"]], [28, ["materials", "fuel"]]].forEach(([number, resources]) => {
        const outraged = resources.filter(resource => (player.outraged || []).includes(resource));
        if (outraged.length > 0) { add(number, "clear", "Discard it to clear your " + outraged.map(resource => preludeResourceNames[resource]).join(" and ") + " Outrage", "You have " + outraged.map(resource => preludeResourceNames[resource]).join(" and ") + " Outrage"); }
    });
    return options;
}

function getHumanLorePreludeRows(player) {
    return getHumanLorePreludeOptions(player).map(option => getTurnRow("<i class=\"bi bi-book\"></i>", getLoreCard(option.number).name + ": " + option.text, option.note,
        "<button type=\"button\" class=\"btn btn-outline-primary btn-sm turnact\" id=\"lorePrelude_" + option.number + "_" + option.kind + "\" onclick=\"useHumanLorePrelude(" + option.number + ", '" + option.kind + "')\">Use</button>"));
}

let humanLorePrelude = null;

function useHumanLorePrelude(number, kind) {
    const player = getTurnPlayer();
    if (kind == "clear") {
        const resources = { 19: ["psionics"], 21: ["relics"], 23: ["weapons"], 25: ["weapons"], 28: ["materials", "fuel"] }[number].filter(resource => (player.outraged || []).includes(resource));
        player.lore = (player.lore || []).filter(held => held != number);
        player.outraged = (player.outraged || []).filter(resource => !resources.includes(resource));
        showOutrageRow(player);
        addHumanLoreSpent(player, { lore: number, kind: kind, discarded: true, cleared: resources });
        return;
    }
    // The others choose how many, or what, in a window
    humanLorePrelude = { number: number, kind: kind, count: 1, materials: 0, fuel: 0, gains: {}, ambition: null };
    returnToTurnWindow = true;
    closeTurnWindow(() => queueLeaderWindow(() => renderHumanLorePrelude()));
}

function renderHumanLorePrelude() {
    const player = getTurnPlayer();
    const state = humanLorePrelude;
    const card = getLoreCard(state.number);
    let html = "<div class=\"small text-secondary mb-2\">" + card.name + " &middot; your prelude</div>";
    let ready = true, label = "";
    if (state.kind == "terror" || state.kind == "ego") {
        const counter = state.kind == "terror" ? "trophies" : "captives";
        const most = player[counter + "Value"];
        state.count = Math.min(Math.max(state.count, 1), most);
        html += "<p class=\"mb-2\">Return how many " + (counter == "trophies" ? "Trophies" : "Captives") + "? Each gives you 1 " + (state.kind == "terror" ? "Influence" : "Secure") + " this turn.</p>"
            + "<div class=\"d-flex justify-content-center mb-2\">" + getMoveStepper(state.count, "stepHumanLorePrelude('count', -1)", "stepHumanLorePrelude('count', 1)") + "</div>";
        label = "Return " + state.count + " for " + state.count + " " + (state.kind == "terror" ? "Influence" : "Secure");
    } else if (state.kind == "ambition") {
        const open = getDeclarableAmbitions().filter(ambition => !declaredAmbitions.includes(ambition));
        html += "<p class=\"mb-2\">Discard all your Material (" + player.materialsValue + ") and Fuel (" + player.fuelValue + ") to declare:</p><div class=\"d-grid gap-2 mb-2\">"
            + open.map(ambition => "<button type=\"button\" class=\"btn " + (state.ambition == ambition ? "btn-secondary" : "btn-outline-secondary") + "\" onclick=\"chooseHumanLoreAmbition('" + ambition + "')\">" + capitalise(ambition) + "</button>").join("") + "</div>";
        ready = state.ambition != null;
        label = ready ? "Declare " + capitalise(state.ambition) : "Choose an ambition";
    } else {
        // Charm: discard Material and Fuel, gain as many other resources
        const discarded = state.materials + state.fuel;
        const gained = Object.values(state.gains).reduce((total, count) => total + count, 0);
        const row = (text, value, field, most) => "<div class=\"d-flex align-items-center justify-content-between py-1 border-bottom\"><span>" + text + "</span>" + getMoveStepper(value, "stepHumanLorePrelude('" + field + "', -1)", "stepHumanLorePrelude('" + field + "', 1)") + "</div>";
        html += "<div class=\"turnlabel\">Discard</div>" + row(getGameIcon("materials") + " Material", state.materials, "materials", player.materialsValue) + row(getGameIcon("fuel") + " Fuel", state.fuel, "fuel", player.fuelValue)
            + "<div class=\"turnlabel mt-2\">Gain (" + gained + " of " + discarded + ")</div>"
            + preludeResources.map(resource => row(getGameIcon(resource) + " " + preludeResourceNames[resource], state.gains[resource] || 0, "gain:" + resource, 99)).join("");
        ready = discarded > 0 && gained == discarded;
        label = ready ? "Swap " + discarded : "Gain as many as you discard";
    }
    html += "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" id=\"lorePreludeConfirm\" onclick=\"confirmHumanLorePrelude()\"" + (ready ? "" : " disabled") + ">" + label + "</button>"
        + "<button type=\"button\" class=\"btn btn-link w-100\" onclick=\"closeLeaderWindow()\">Don't</button>";
    showLeaderWindow(player, card.name, html);
}

function chooseHumanLoreAmbition(ambition) {
    humanLorePrelude.ambition = ambition;
    renderHumanLorePrelude();
}

function stepHumanLorePrelude(field, change) {
    const player = getTurnPlayer();
    const state = humanLorePrelude;
    if (field.startsWith("gain:")) {
        const resource = field.slice(5);
        const gained = Object.values(state.gains).reduce((total, count) => total + count, 0);
        if (change > 0 && gained >= state.materials + state.fuel) { return; }
        state.gains[resource] = Math.max((state.gains[resource] || 0) + change, 0);
    } else if (field == "count") {
        state.count += change;
    } else {
        state[field] = Math.min(Math.max(state[field] + change, 0), player[field + "Value"]);
        // Never more gained than discarded
        let over = Object.values(state.gains).reduce((total, count) => total + count, 0) - (state.materials + state.fuel);
        Object.keys(state.gains).forEach(resource => { while (over > 0 && state.gains[resource] > 0) { state.gains[resource]--; over--; } });
    }
    renderHumanLorePrelude();
}

function confirmHumanLorePrelude() {
    const player = getTurnPlayer();
    const state = humanLorePrelude;
    if (state.kind == "terror" || state.kind == "ego") {
        const counter = state.kind == "terror" ? "trophies" : "captives";
        setPlayerResource(player, counter, player[counter + "Value"] - state.count);
        addHumanLoreSpent(player, { lore: state.number, kind: state.kind, costs: { [counter]: state.count }, slots: Array.from({ length: state.count }, () => [state.kind == "terror" ? "influence" : "secure"]) });
    } else if (state.kind == "ambition") {
        const costs = { materials: player.materialsValue, fuel: player.fuelValue };
        setPlayerResource(player, "materials", 0);
        setPlayerResource(player, "fuel", 0);
        declaredAmbitions.push(state.ambition);
        updateAmbitionsDisplay();
        showMessageToast("Player " + player.number, getAmbitionDeclaredMessage(state.ambition) + " (Tycoon's Ambition: no zero marker)");
        addHumanLoreSpent(player, { lore: state.number, kind: state.kind, costs: costs, declared: state.ambition });
    } else {
        const costs = { materials: state.materials, fuel: state.fuel };
        Object.entries(costs).forEach(([resource, count]) => setPlayerResource(player, resource, player[resource + "Value"] - count));
        Object.entries(state.gains).forEach(([resource, count]) => setPlayerResource(player, resource, player[resource + "Value"] + count));
        showSlotAdvice(player, Object.keys(state.gains).filter(resource => state.gains[resource] > 0));
        addHumanLoreSpent(player, { lore: state.number, kind: state.kind, costs: costs, gains: { ...state.gains } });
    }
    humanLorePrelude = null;
    closeLeaderWindow();
}

function addHumanLoreSpent(player, spent) {
    player.preludeSpent = getPreludeSpent(player).concat(spent);
    SaveAllSettings();
    if (document.getElementById("turnModal").classList.contains("show")) { renderTurn(player); }
}

function undoHumanLoreSpent(player, spent) {
    // Puts back what a Lore prelude spent, gained, discarded or declared (prelude.js undoPrelude)
    Object.entries(spent.costs || {}).forEach(([resource, count]) => setPlayerResource(player, resource, player[resource + "Value"] + count));
    Object.entries(spent.gains || {}).forEach(([resource, count]) => setPlayerResource(player, resource, player[resource + "Value"] - count));
    if (spent.discarded && !(player.lore || []).includes(spent.lore)) { player.lore = (player.lore || []).concat(spent.lore); }
    (spent.cleared || []).forEach(resource => { if (!(player.outraged || []).includes(resource)) { player.outraged = (player.outraged || []).concat(resource); } });
    if (spent.cleared != null) { showOutrageRow(player); }
    if (spent.declared != null) {
        const index = declaredAmbitions.lastIndexOf(spent.declared);
        if (index >= 0) { declaredAmbitions.splice(index, 1); updateAmbitionsDisplay(); }
    }
}

function getHumanLoreSpentText(spent) {
    const name = getLoreCard(spent.lore).name;
    if (spent.kind == "terror") { return name + ": " + spent.costs.trophies + " Troph" + (spent.costs.trophies == 1 ? "y" : "ies") + " for Influence"; }
    if (spent.kind == "ego") { return name + ": " + spent.costs.captives + " Captive" + (spent.costs.captives == 1 ? "" : "s") + " for Secure"; }
    if (spent.kind == "ambition") { return name + ": declared " + capitalise(spent.declared); }
    if (spent.kind == "charm") { return name + ": swapped Material and Fuel"; }
    return name + ": discarded, Outrage cleared";
}
