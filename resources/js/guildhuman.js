// A human player's Guild card actions (#232): the Guild cards whose action can be taken instead of
// one of your card's actions (replacesActions in court.js), in a "Guild cards" section of your turn
// window, each with a window that changes your panel. Like your Lore actions (lorehuman.js).
// The campaign's Fate Guild cards too: Spy, Recover and Bargain (the user's mock-ups, 2026-11-28).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// [kind, name, Guild card number, the action it replaces, what it does]
const humanGuildActions = [
    ["manufacture", "Manufacture", 2, "build", "gain 1 Material"],
    ["synthesize", "Synthesize", 9, "build", "gain 1 Fuel"],
    ["pressgang", "Pressgang", 12, "build", "return Captives for 1 resource each"],
    ["execute", "Execute", 12, "influence", "move Captives to your Trophies"],
    ["abduct", "Abduct", 14, "battle", "capture all Rival agents from a Court card with fewer than your Weapon icons"],
    ["trade", "Trade", 23, "tax", "swap a resource with a Rival whose city you control"],
    // The campaign's Fate Guild cards (campaign/fatebots.js)
    ["spy", "Spy", 203, "influence", "give your highest card to a Rival for their highest, once a turn"],
    ["recover", "Recover", 204, "move", "attach the top Guild card of the Court discard pile to a Court card with no agents"],
    ["bargain", "Bargain", 206, "secure", "a Rival secures a card; you Influence once for each of their agents on it, then Secure"]
];

function getHumanGuildActions(player) {
    if (!player.isHuman) { return []; }
    const held = player.guildCards || [];
    return humanGuildActions.filter(([, , number]) => held.includes(number) && getCourtCard(number) != null);
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

function getHighestInHand(player) {
    return getHighestCard(getUnplayedCards(player.cards || []).filter(card => !isEventCard(card)));
}

function getSpyRivals(player) {
    return players.filter(other => other !== player && getHighestInHand(other) != null);
}

function getBargainChoices(player) {
    // [{ entry, rival }]: Court cards a Rival could secure now
    if (!isMarketKnown()) { return []; }
    return courtMarket.filter(entry => !isMarketCardClosed(entry))
        .flatMap(entry => players.filter(other => other !== player && canSecureEntry(entry, other)).map(rival => ({ entry: entry, rival: rival })));
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
    if (kind == "spy") {
        if (getBoardActions(player).some(action => action.guild == "spy")) { return "once a turn: used"; }
        if (getHighestInHand(player) == null) { return "no card in your hand"; }
        return getSpyRivals(player).length == 0 ? "no Rival has a card in hand" : null;
    }
    if (kind == "bargain") {
        if (!isMarketKnown()) { return "the Court isn't entered in the app"; }
        return getBargainChoices(player).length == 0 ? "no Court card a Rival could secure" : null;
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
    humanGuildWindow = { kind: kind, counts: {}, whose: {}, count: 1, choice: null, give: null };
    renderHumanGuild();
}

function sumOf(counts) {
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function getWhoseHtml(player, state) {
    // Whose agents your Captives are, so the app knows where they go (the user, 2026-11-28)
    return "<div class=\"turnlabel mt-2\">Whose Captives</div>" + players.filter(other => other !== player).map(rival => "<div class=\"d-flex align-items-center justify-content-between py-1 border-bottom\"><span>" + getPlayerTag(rival) + "</span>"
        + getMoveStepper(state.whose[rival.number] || 0, "stepHumanGuild('whose:" + rival.number + "', -1)", "stepHumanGuild('whose:" + rival.number + "', 1)") + "</div>").join("");
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
        const count = sumOf(state.whose);
        html += "<p class=\"mb-2\">Move your Captives (you have " + player.captivesValue + ") to your Trophies. Whose are they?</p>" + getWhoseHtml(player, state);
        ready = count > 0;
        label = ready ? "Move " + count + " to Trophies" : "Set whose Captives";
    } else if (state.kind == "pressgang") {
        const gained = sumOf(state.counts), returned = sumOf(state.whose);
        html += "<p class=\"mb-2\">Return Captives (you have " + player.captivesValue + ") to their owners: 1 resource for each.</p><div class=\"turnlabel\">Gain</div>"
            + preludeResources.map(resource => "<div class=\"d-flex align-items-center justify-content-between py-1 border-bottom\"><span>" + getGameIcon(resource) + " " + preludeResourceNames[resource] + "</span>"
                + getMoveStepper(state.counts[resource] || 0, "stepHumanGuild('" + resource + "', -1)", "stepHumanGuild('" + resource + "', 1)") + "</div>").join("")
            + getWhoseHtml(player, state);
        ready = gained > 0 && gained == returned;
        label = ready ? "Return " + returned + " Captive" + (returned == 1 ? "" : "s") : gained == 0 ? "Choose what to gain" : "Set whose " + gained + " Captive" + (gained == 1 ? "" : "s");
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
            // The Court isn't entered: whose agents were captured, by hand
            html += "<p class=\"mb-2\">You have " + icons + " Weapon icons. Capture all Rival agents from a Court card with fewer than that. Whose did you capture?</p>" + getWhoseHtml(player, state);
            ready = sumOf(state.whose) > 0;
            label = ready ? "Add " + sumOf(state.whose) + " Captive" + (sumOf(state.whose) == 1 ? "" : "s") : "Set whose agents";
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
    } else if (state.kind == "spy") {
        const own = getHighestInHand(player);
        html += "<p class=\"mb-2\">Give your highest card, <b>" + getCardFullName(own).replace(/([A-Za-z])(\d)/, "$1 $2") + "</b>, to a Rival. They give you their highest card.</p><div class=\"d-grid gap-2 mb-2\">"
            + getSpyRivals(player).map(rival => choice("guildRival" + rival.number, getPlayerTag(rival), "You take their <b>" + getCardFullName(getHighestInHand(rival)).replace(/([A-Za-z])(\d)/, "$1 $2") + "</b>", "chooseHumanGuild(" + rival.number + ")", state.choice == rival.number)).join("") + "</div>";
        ready = state.choice != null;
        label = ready ? "Swap with Player " + state.choice : "Choose a Rival";
    } else if (state.kind == "recover") {
        html += "<p class=\"mb-2\">Attach the topmost Guild card from the Court discard pile to a Court card with no agents on it. Add it to that card in the Court window.</p>";
        label = "I attached it";
    } else if (state.kind == "bargain") {
        const options = getBargainChoices(player);
        html += "<p class=\"mb-2\">Choose a Court card a Rival could secure. They secure it, returning the other agents instead of capturing them.</p><div class=\"d-grid gap-2 mb-2\">"
            + options.map((option, index) => {
                const agents = getMarketAgents(option.entry, option.rival);
                return choice("guildBargain" + index, getCourtCard(option.entry.number).name, getPlayerTag(option.rival) + " could secure it (" + agents + " agent" + (agents == 1 ? "" : "s") + "): you then Influence " + (agents == 1 ? "once" : agents == 2 ? "twice" : agents + " times"), "chooseHumanGuild(" + index + ")", state.choice == index);
            }).join("") + "</div>";
        const chosen = state.choice != null ? options[state.choice] : null;
        if (chosen != null) {
            const agents = getMarketAgents(chosen.entry, chosen.rival);
            html += "<div class=\"slotadvice small mb-2\">Then you <b>Influence " + (agents == 1 ? "once" : agents == 2 ? "twice" : agents + " times") + "</b> and <b>Secure once</b>: they're added to Your actions, done in the Court window.</div>";
        }
        ready = chosen != null;
        label = ready ? "Bargain for " + getCourtCard(chosen.entry.number).name : "Choose a Court card";
    }
    html += "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"guildConfirm\" onclick=\"confirmHumanGuild()\"" + (ready ? "" : " disabled") + ">" + label + "</button>"
        + "<button type=\"button\" class=\"btn btn-link w-100\" onclick=\"closeLeaderWindow()\">Don't</button>";
    showLeaderWindow(player, action[1], tagPlayerNames(html));
}

function stepHumanGuild(field, change) {
    const player = getTurnPlayer();
    const state = humanGuildWindow;
    if (field.startsWith("whose:")) {
        // No more than your Captives in all (Abduct by hand: fewer than your Weapon icons)
        const number = field.slice(6);
        const most = state.kind == "abduct" ? Math.max(getWeaponIcons(player) - 1, 0) : player.captivesValue;
        if (change > 0 && sumOf(state.whose) >= most) { return; }
        state.whose[number] = Math.max((state.whose[number] || 0) + change, 0);
    } else {
        // Pressgang: no more gained than your Captives
        if (change > 0 && sumOf(state.counts) >= player.captivesValue) { return; }
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

function returnCaptives(player, whose, toTrophies) {
    // Your Captives go back to their owners' supplies, or to your Trophies (Execute)
    Object.entries(whose).forEach(([number, count]) => {
        const rival = getPlayer(Number(number));
        if (rival == null || count == 0) { return; }
        rival.agentsCaptive = Math.max((rival.agentsCaptive || 0) - count, 0);
        if (toTrophies) { rival.agentsTrophy = (rival.agentsTrophy || 0) + count; }
    });
}

function bargainForCard(player, entry, rival) {
    // The Rival secures it without capturing: the other agents go back. You get their agents' worth of
    // Influence, then a Secure
    const card = getCourtCard(entry.number);
    const agents = getMarketAgents(entry, rival);
    takeAttachedCards(rival, entry);
    if (runCampaignHook("secureCard", entry, rival, 0) !== true) {
        removeFromMarket(entry.number);
        if (card.type == "guild") {
            rival.guildCards.push(entry.number);
            showGuildCardsRow(rival);
        } else if (rival.isHuman) {
            queueLeaderWindow(() => showVoxForPlayer(rival, card));
        } else {
            queueLeaderWindow(() => { showVoxCard(rival, card); bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show(); });
        }
    }
    player.guildSlots = (player.guildSlots || []).concat(Array.from({ length: agents }, () => ["influence"]), [["secure"]]);
    showMessageToast("Player " + player.number + ": Bargain", "Player " + rival.number + " secured " + card.name + " without capturing. Add its replacement to the market. You Influence " + agents + " time" + (agents == 1 ? "" : "s") + ", then Secure once.");
    return { card: card, agents: agents };
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
        const count = sumOf(state.whose);
        if (count == 0) { return; }
        add(player, "captives", -count);
        add(player, "trophies", count);
        returnCaptives(player, state.whose, true);
        text += ": " + count + " Captive" + (count == 1 ? "" : "s") + " to Trophies";
    } else if (state.kind == "pressgang") {
        const total = sumOf(state.whose);
        if (total == 0 || total != sumOf(state.counts)) { return; }
        add(player, "captives", -total);
        returnCaptives(player, state.whose, false);
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
            const count = sumOf(state.whose);
            if (count == 0) { return; }
            Object.entries(state.whose).forEach(([number, agents]) => { const rival = getPlayer(Number(number)); if (rival != null) { rival.agentsCaptive = (rival.agentsCaptive || 0) + agents; } });
            add(player, "captives", count);
            text += ": " + count + " Captive" + (count == 1 ? "" : "s");
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
    } else if (state.kind == "spy") {
        const rival = getPlayer(state.choice);
        if (rival == null) { return; }
        applySpy(player, { spy: rival.number });
        text += ": swapped your highest card with Player " + rival.number;
    } else if (state.kind == "recover") {
        if (typeof advanceAdvocate == "function") { advanceAdvocate(player, 2, "Recover (Guild Investigators)"); }
        text += ": a Guild card attached";
    } else if (state.kind == "bargain") {
        const chosen = getBargainChoices(player)[state.choice];
        if (chosen == null) { return; }
        const done = bargainForCard(player, chosen.entry, chosen.rival);
        text += ": Player " + chosen.rival.number + " secured " + done.card.name + "; you Influence " + done.agents + ", then Secure";
    }
    // It uses up one of your card's actions, like the action it replaces
    recordBoardAction(player, { action: action[3], guild: state.kind, text: text + " (" + getCourtCard(action[2]).name + ")", undo: false });
    if (slotsFor.length > 0) { showSlotAdvice(player, slotsFor); }
    SaveAllSettings();
    humanGuildWindow = null;
    closeLeaderWindow();
}
