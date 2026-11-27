// A human player's Guild card actions (#232): the Guild cards whose action can be taken instead of
// one of your card's actions (replacesActions in court.js), in a "Guild cards" section of your turn
// window, each with a window that changes your panel. Like your Lore actions (lorehuman.js).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// [kind, name, Guild card number, the action it replaces, what it does]
const humanGuildActions = [
    ["manufacture", "Manufacture", 2, "build", "gain 1 Material"],
    ["synthesize", "Synthesize", 9, "build", "gain 1 Fuel"],
    ["pressgang", "Pressgang", 12, "build", "return Captives for 1 resource each"],
    ["execute", "Execute", 12, "influence", "move Captives to your Trophies"],
    ["abduct", "Abduct", 14, "battle", "capture all Rival agents from a Court card with fewer than your Weapon icons"],
    ["trade", "Trade", 23, "tax", "swap a resource with a Rival whose city you control"]
];

function getHumanGuildActions(player) {
    if (!player.isHuman) { return []; }
    const held = getPlayerGuildCards(player).map(card => card.number);
    return humanGuildActions.filter(([, , number]) => held.includes(number));
}

function getWeaponIcons(player) {
    return player.weaponsValue + getGuildIconCount(player, "weapons");
}

function getTradeCities(player) {
    // Rival cities you control, where that Rival has a resource of the city's type to take
    return getTaxableCities(player.number).filter(city => typeof city.owner == "number" && city.owner != player.number && !city.slot)
        .filter(city => { const rival = getPlayer(city.owner); return rival != null && rival[city.resource + "Value"] > 0; })
        .filter((city, index, cities) => cities.findIndex(other => other.owner == city.owner && other.resource == city.resource) == index);
}

function getAbductCards(player) {
    // Court cards with Rival agents, fewer than your Weapon icons
    if (!isMarketKnown()) { return null; }
    const icons = getWeaponIcons(player);
    const rivalsOn = entry => getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);
    return courtMarket.filter(entry => rivalsOn(entry) > 0 && rivalsOn(entry) < icons);
}

function getHumanGuildBlock(player, kind) {
    // Why it can't be used now, or null
    if (kind == "manufacture" || kind == "synthesize") { return getEmptySlots(player) == 0 ? "no empty resource slot" : null; }
    if (kind == "pressgang" || kind == "execute") { return player.captivesValue > 0 ? null : "no Captives"; }
    if (kind == "abduct") {
        if (getWeaponIcons(player) < 2) { return "fewer than 2 Weapon icons"; }
        const cards = getAbductCards(player);
        return cards != null && cards.length == 0 ? "no Court card with fewer Rival agents than your " + getWeaponIcons(player) + " Weapon icons" : null;
    }
    if (kind == "trade") {
        if (!preludeResources.some(resource => player[resource + "Value"] > 0)) { return "no resource to give"; }
        return getTradeCities(player).length == 0 ? "no Rival city you control with a resource to take" : null;
    }
    return null;
}

function getHumanGuildSectionHtml(player) {
    const actions = getHumanGuildActions(player);
    if (actions.length == 0) { return ""; }
    const use = getHumanActionUse(player);
    const rows = actions.map(([kind, name, number, replaces, does]) => {
        const free = use.left.some(slot => slot.types.includes(replaces));
        const block = getHumanGuildBlock(player, kind);
        const sub = getCourtCard(number).name + ": " + (!free ? "your card has no " + humanBoardActionNames[replaces] + " left" : block != null ? block : does);
        const button = "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"guildAct_" + kind + "\" onclick=\"openHumanGuild('" + kind + "')\"" + (free && block == null ? "" : " disabled") + ">" + name + "</button>";
        return getTurnRow("<i class=\"bi bi-person-vcard\"></i>", name + " <span class=\"small text-secondary\">(instead of " + replacedActionNames[replaces] + ")</span>", sub, button);
    }).join("");
    return getTurnSection("Guild cards", rows);
}

// The windows

let humanGuildWindow = null;

function openHumanGuild(kind) {
    returnToTurnWindow = true;
    closeTurnWindow(() => queueLeaderWindow(() => showHumanGuild(kind)));
}

function showHumanGuild(kind) {
    humanGuildWindow = { kind: kind, counts: {}, count: 1, choice: null, give: null };
    renderHumanGuild();
}

function renderHumanGuild() {
    const player = getTurnPlayer();
    const state = humanGuildWindow;
    const action = humanGuildActions.find(item => item[0] == state.kind);
    let html = "<div class=\"small text-secondary mb-2\">" + getCourtCard(action[2]).name + " &middot; instead of " + replacedActionNames[action[3]] + "</div>";
    let ready = true, label = action[1];
    const choice = (id, text, sub, onclick, chosen) => "<button type=\"button\" class=\"btn " + (chosen ? "btn-secondary" : "btn-outline-secondary") + " text-start\" id=\"" + id + "\" onclick=\"" + onclick + "\">" + text + (sub ? "<small class=\"d-block opacity-75\">" + sub + "</small>" : "") + "</button>";
    if (state.kind == "manufacture" || state.kind == "synthesize") {
        const resource = state.kind == "manufacture" ? "materials" : "fuel";
        html += "<p class=\"mb-2\">Gain 1 " + preludeResourceNames[resource] + ".</p>";
        label = "Gain 1 " + preludeResourceNames[resource];
    } else if (state.kind == "execute") {
        state.count = Math.min(Math.max(state.count, 1), player.captivesValue);
        html += "<p class=\"mb-2\">Move how many of your " + player.captivesValue + " Captives to your Trophies?</p><div class=\"d-flex justify-content-center mb-2\">"
            + getMoveStepper(state.count, "stepHumanGuild('count', -1)", "stepHumanGuild('count', 1)") + "</div>";
        label = "Move " + state.count + " to Trophies";
    } else if (state.kind == "pressgang") {
        const total = Object.values(state.counts).reduce((sum, count) => sum + count, 0);
        html += "<p class=\"mb-2\">Return Captives (you have " + player.captivesValue + ") to their owners: 1 resource for each.</p>"
            + preludeResources.map(resource => "<div class=\"d-flex align-items-center justify-content-between py-1 border-bottom\"><span>" + getGameIcon(resource) + " " + preludeResourceNames[resource] + "</span>"
                + getMoveStepper(state.counts[resource] || 0, "stepHumanGuild('" + resource + "', -1)", "stepHumanGuild('" + resource + "', 1)") + "</div>").join("");
        ready = total > 0;
        label = ready ? "Return " + total + " Captive" + (total == 1 ? "" : "s") : "Choose what to gain";
    } else if (state.kind == "abduct") {
        const cards = getAbductCards(player);
        const icons = getWeaponIcons(player);
        if (cards != null) {
            const rivalsOn = entry => getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);
            html += "<p class=\"mb-2\">You have " + icons + " Weapon icons. Capture all Rival agents from:</p><div class=\"d-grid gap-2 mb-2\">"
                + cards.map(entry => choice("guildCard" + entry.number, getCourtCard(entry.number).name, rivalsOn(entry) + " Rival agent" + (rivalsOn(entry) == 1 ? "" : "s"), "chooseHumanGuild(" + entry.number + ")", state.choice == entry.number)).join("") + "</div>";
            ready = state.choice != null;
            label = ready ? "Capture them" : "Choose a Court card";
        } else {
            // The Court isn't entered: how many were captured, by hand
            html += "<p class=\"mb-2\">You have " + icons + " Weapon icons. Capture all Rival agents from a Court card with fewer than that. How many did you capture?</p><div class=\"d-flex justify-content-center mb-2\">"
                + getMoveStepper(state.count, "stepHumanGuild('count', -1)", "stepHumanGuild('count', 1)") + "</div>";
            label = "Add " + state.count + " Captive" + (state.count == 1 ? "" : "s");
        }
    } else if (state.kind == "trade") {
        const cities = getTradeCities(player);
        html += "<p class=\"mb-2\">Choose a Rival city you control: take 1 resource of its type from them.</p><div class=\"d-grid gap-2 mb-2\">"
            + cities.map((city, index) => choice("guildCity" + index, "Player " + city.owner + "'s " + preludeResourceNames[city.resource] + " city at " + getSystemName(city.system), "Take 1 " + preludeResourceNames[city.resource], "chooseHumanGuild(" + index + ")", state.choice == index)).join("") + "</div>";
        const city = state.choice != null ? cities[state.choice] : null;
        if (city != null) {
            const rival = getPlayer(city.owner);
            const gives = preludeResources.filter(resource => player[resource + "Value"] > 0 && rival[resource + "Value"] == 0 && resource != city.resource);
            html += "<p class=\"mb-2\">Give them a resource they don't have:</p><div class=\"d-grid gap-2 mb-2\">"
                + (gives.length > 0 ? gives.map(resource => choice("guildGive_" + resource, getGameIcon(resource) + " " + preludeResourceNames[resource], "", "chooseHumanGuildGive('" + resource + "')", state.give == resource)).join("")
                    : "<div class=\"small text-secondary\">You have nothing they don't have, so you can't Trade with them.</div>") + "</div>";
        }
        ready = city != null && state.give != null;
        label = ready ? "Trade" : city == null ? "Choose a city" : "Choose what to give";
    }
    html += "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"guildConfirm\" onclick=\"confirmHumanGuild()\"" + (ready ? "" : " disabled") + ">" + label + "</button>"
        + "<button type=\"button\" class=\"btn btn-link w-100\" onclick=\"closeLeaderWindow()\">Don't</button>";
    showLeaderWindow(player, action[1], html);
}

function stepHumanGuild(field, change) {
    const player = getTurnPlayer();
    const state = humanGuildWindow;
    if (field == "count") {
        state.count = Math.max(state.count + change, 1);
        if (state.kind == "execute") { state.count = Math.min(state.count, player.captivesValue); }
        if (state.kind == "abduct") { state.count = Math.min(state.count, Math.max(getWeaponIcons(player) - 1, 1)); }
    } else {
        // Pressgang: no more than your Captives in all
        const total = Object.values(state.counts).reduce((sum, count) => sum + count, 0);
        if (change > 0 && total >= player.captivesValue) { return; }
        state.counts[field] = Math.max((state.counts[field] || 0) + change, 0);
    }
    renderHumanGuild();
}

function chooseHumanGuild(choice) {
    humanGuildWindow.choice = choice;
    humanGuildWindow.give = null;
    renderHumanGuild();
}

function chooseHumanGuildGive(resource) {
    humanGuildWindow.give = resource;
    renderHumanGuild();
}

function confirmHumanGuild() {
    const player = getTurnPlayer();
    const state = humanGuildWindow;
    if (state == null) { return; }
    const action = humanGuildActions.find(item => item[0] == state.kind);
    const add = (who, resource, change) => setPlayerResource(who, resource, Math.max(who[resource + "Value"] + change, 0));
    let text = action[1];
    let slotsFor = [];
    if (state.kind == "manufacture" || state.kind == "synthesize") {
        const resource = state.kind == "manufacture" ? "materials" : "fuel";
        add(player, resource, 1);
        slotsFor = [resource];
        text += ": 1 " + preludeResourceNames[resource];
    } else if (state.kind == "execute") {
        add(player, "captives", -state.count);
        add(player, "trophies", state.count);
        text += ": " + state.count + " Captive" + (state.count == 1 ? "" : "s") + " to Trophies";
    } else if (state.kind == "pressgang") {
        const total = Object.values(state.counts).reduce((sum, count) => sum + count, 0);
        add(player, "captives", -total);
        Object.entries(state.counts).forEach(([resource, count]) => { if (count > 0) { add(player, resource, count); } });
        slotsFor = Object.keys(state.counts).filter(resource => state.counts[resource] > 0);
        text += ": " + total + " Captive" + (total == 1 ? "" : "s") + " returned";
    } else if (state.kind == "abduct") {
        if (getAbductCards(player) != null) {
            const entry = courtMarket.find(item => item.number == state.choice);
            if (entry == null) { return; }
            let captured = 0;
            players.filter(other => other !== player).forEach(rival => {
                const agents = getMarketAgents(entry, rival);
                if (agents > 0) { entry.agents[rival.number] = 0; rival.agentsCaptive = (rival.agentsCaptive || 0) + agents; captured += agents; }
            });
            add(player, "captives", captured);
            text += ": " + captured + " from " + getCourtCard(entry.number).name;
        } else {
            add(player, "captives", state.count);
            text += ": " + state.count + " Captive" + (state.count == 1 ? "" : "s");
        }
    } else if (state.kind == "trade") {
        const city = getTradeCities(player)[state.choice];
        if (city == null || state.give == null) { return; }
        const rival = getPlayer(city.owner);
        add(rival, city.resource, -1);
        add(player, city.resource, 1);
        add(player, state.give, -1);
        add(rival, state.give, 1);
        slotsFor = [city.resource];
        text += ": 1 " + preludeResourceNames[city.resource] + " from Player " + rival.number + " for 1 " + preludeResourceNames[state.give];
    }
    // It uses up one of your card's actions, like the action it replaces
    recordBoardAction(player, { action: action[3], text: text + " (" + getCourtCard(action[2]).name + ")", undo: false });
    if (slotsFor.length > 0) { showSlotAdvice(player, slotsFor); }
    SaveAllSettings();
    humanGuildWindow = null;
    closeLeaderWindow();
}
