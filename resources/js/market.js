// The Court market (#74): the cards on offer and everyone's agents on them, entered in the Court
// window. From these a bot works out what to Influence and Secure, using generic values rather
// than each card's text. Secure needs more agents on the card than any Rival; the Rival agents
// on it are captured.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The player using the Court window
let courtPlayer = null;

function isMarketKnown() {
    // Until the market has been entered, the bot has to ask about it
    return courtMarket.length > 0;
}

function getMarketAgents(entry, player) {
    return entry.agents[player.number] || 0;
}

function getRivalAgents(entry, player) {
    return players.filter(other => other !== player).map(other => getMarketAgents(entry, other));
}

function canSecureEntry(entry, player) {
    const own = getMarketAgents(entry, player);
    return own > 0 && own > Math.max(...getRivalAgents(entry, player));
}

function removeFromMarket(number) {
    courtMarket = courtMarket.filter(entry => entry.number != number);
}

function getMarketCardValue(player, entry) {
    // How much the bot wants a card, from generic values by its type. A Guild card for its
    // resource icon, a Vox card by what it does, plus the agents it would capture
    const card = getCourtCard(entry.number);
    const chasingTyrant = declaredAmbitions.includes("tyrant") && isChasingAmbition(player, "tyrant");
    const rivalAgents = getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);

    let value = marketValues.base;
    if (card.type == "vox") {
        value += marketValues.vox[card.number];
    } else if (card.resource == "weapons") {
        if (declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord")) { value += marketValues.perNeed * 2; }
    } else {
        value += marketValues.perNeed * getResourceNeed(player, card.resource);
    }
    return value + rivalAgents * (chasingTyrant ? marketValues.captiveTyrant : marketValues.captive);
}

function getMarketReason(player, entry) {
    // Why it wants a card, if there's a clear reason
    const card = getCourtCard(entry.number);
    const rivalAgents = getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);
    if (rivalAgents > 0 && declaredAmbitions.includes("tyrant") && isChasingAmbition(player, "tyrant")) { return "captures for Tyrant"; }
    if (card.resource == "weapons") { return declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord") ? "chasing Warlord" : ""; }
    if (card.resource != null && getResourceNeed(player, card.resource) == 2) { return "chasing " + capitalise(preludeAmbitions[card.resource]); }
    return "";
}

function getCardsToSecure(player) {
    // The cards it could secure now, the one it wants most first
    return courtMarket.filter(entry => canSecureEntry(entry, player))
        .sort((a, b) => getMarketCardValue(player, b) - getMarketCardValue(player, a));
}

function getCardsToInfluence(player) {
    // The cards worth an agent, best first: what it's worth for the agents it takes to get ahead.
    // None on its last card, as there's no later turn to secure one. It leaves alone a card it's
    // already ahead on
    if (getUnplayedCards(player.cards).length == 0) { return []; }

    const agentsNeeded = entry => Math.max(...getRivalAgents(entry, player)) + 1 - getMarketAgents(entry, player);
    return courtMarket.filter(entry => agentsNeeded(entry) > 0)
        .sort((a, b) => (getMarketCardValue(player, b) / agentsNeeded(b)) - (getMarketCardValue(player, a) / agentsNeeded(a)));
}

function isMarketQuestionPossible(ambition, action, player) {
    // Whether a Yes/No question about the market could be answered Yes. If the market hasn't
    // been entered, it could
    if (!isMarketKnown() || (action != "secure" && action != "influence")) { return true; }

    const resourcesFor = { TYCOON: ["fuel", "materials"], WARLORD: ["weapons"], KEEPER: ["relics"], EMPATH: ["psionics"] };
    if (ambition == "TYRANT") {
        return courtMarket.some(entry => Math.max(...getRivalAgents(entry, player)) > 0 && (action != "secure" || canSecureEntry(entry, player)));
    }
    const matches = courtMarket.filter(entry => (resourcesFor[ambition] || []).includes(getCourtCard(entry.number).resource));
    return action == "influence" ? matches.length > 0 : matches.some(entry => canSecureEntry(entry, player));
}

// The Court window

function showCourtModal(button) {
    // Opened from the Court icon on a player's panel
    courtPlayer = getPlayer(getPlayerNumberFromString(button.parentNode.id));
    hideIconTooltip(button, "courtModal");

    const header = document.querySelector("#courtModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + courtPlayer.number);
    document.getElementById("courtTitle").innerHTML = "Player " + courtPlayer.number + " at the Court";

    showCourtWindow();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("courtModal")).show();
}

function changeMarketAgents(number, playerNumber, change) {
    const entry = courtMarket.find(card => card.number == number);
    entry.agents[playerNumber] = Math.max((entry.agents[playerNumber] || 0) + change, 0);
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function addToMarket(number) {
    courtMarket.push({ number: parseInt(number), agents: {} });
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function removeMarketCard(number) {
    removeFromMarket(number);
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function refreshTurnSummary() {
    // The plan names market cards, so keep it up to date
    if (courtPlayer != null && awaitingDone == courtPlayer.number) { showTurnDone(courtPlayer); }
}

function getCourtAdviceHtml(player) {
    // What a bot would do with what's in the market
    if (player.isHuman || !isMarketKnown()) { return ""; }

    const describe = entry => {
        const reason = getMarketReason(player, entry);
        return getCourtCard(entry.number).name + (reason ? " (" + reason + ")" : "");
    };
    const secure = canBotTakeAction(player, "secure") ? getCardsToSecure(player)[0] : null;
    const influence = canBotTakeAction(player, "influence") ? getCardsToInfluence(player)[0] : null;

    let lines = [];
    if (secure != null) { lines.push("<b>Secure:</b> " + describe(secure)); }
    if (influence != null) { lines.push("<b>Influence:</b> " + describe(influence)); }
    if (lines.length == 0) { lines.push("Nothing worth doing here this turn."); }
    return "<div class=\"alert alert-secondary py-2 px-3 small mb-2\" id=\"courtAdvice\">" + lines.join("<br>") + "</div>";
}

function showCourtWindow() {
    const body = document.getElementById("courtBody");
    body.innerHTML = getCourtAdviceHtml(courtPlayer);

    if (!isMarketKnown()) {
        const hint = document.createElement("div");
        hint.classList.add("small", "text-muted", "mb-2");
        hint.innerHTML = "Add the cards in the market, and the app can track them and everyone's agents.";
        body.appendChild(hint);
    }

    courtMarket.forEach(entry => {
        const card = getCourtCard(entry.number);
        const row = document.createElement("div");
        row.classList.add("marketcard");

        const heading = document.createElement("div");
        heading.classList.add("d-flex", "align-items-center", "gap-1", "mb-1");
        heading.innerHTML = "<span class=\"guildchip" + (card.resource != null ? " guild-" + card.resource : "") + "\">" + card.name + "</span><span class=\"ms-auto\"></span>";

        if (canSecureEntry(entry, courtPlayer)) {
            const secure = document.createElement("button");
            secure.type = "button";
            secure.classList.add("btn", "btn-primary", "btn-sm", "py-0");
            secure.innerHTML = "Secure";
            secure.onclick = () => secureMarketCard(entry.number);
            heading.appendChild(secure);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.classList.add("btn", "btn-outline-secondary", "btn-sm", "py-0");
        remove.setAttribute("aria-label", "Take " + card.name + " out of the market");
        remove.innerHTML = "<i class=\"bi bi-x-lg\"></i>";
        remove.onclick = () => removeMarketCard(entry.number);
        heading.appendChild(remove);
        row.appendChild(heading);

        // Everyone's agents on the card, in their colours
        const agents = document.createElement("div");
        agents.classList.add("d-flex", "flex-wrap", "gap-1", "justify-content-center");
        players.forEach(player => {
            const counter = document.createElement("div");
            counter.classList.add("marketcounter", "playertag" + player.number);
            counter.innerHTML = "<button type=\"button\" class=\"marketstep\" aria-label=\"One agent fewer for Player " + player.number + "\" onclick=\"changeMarketAgents(" + entry.number + ", " + player.number + ", -1)\"><i class=\"bi bi-dash-lg\"></i></button>"
                + "<span class=\"marketagents\" id=\"marketAgents_" + entry.number + "_" + player.number + "\">" + getMarketAgents(entry, player) + "</span>"
                + "<button type=\"button\" class=\"marketstep\" aria-label=\"One agent more for Player " + player.number + "\" onclick=\"changeMarketAgents(" + entry.number + ", " + player.number + ", 1)\"><i class=\"bi bi-plus-lg\"></i></button>";
            agents.appendChild(counter);
        });
        row.appendChild(agents);
        body.appendChild(row);
    });

    // Add a card: any Court card not held by anyone or already in the market
    const available = courtCards.filter(card => !courtMarket.some(entry => entry.number == card.number) && getGuildCardHolder(card.number) == null);
    const add = document.createElement("select");
    add.classList.add("form-select", "form-select-sm", "mt-2");
    add.id = "courtAdd";
    add.innerHTML = "<option value=\"\">Add a card to the market&hellip;</option>"
        + available.map(card => "<option value=\"" + card.number + "\">" + card.name + (card.type == "vox" ? " (Vox)" : " (" + preludeResourceNames[card.resource] + ")") + "</option>").join("");
    add.onchange = () => { if (add.value != "") { addToMarket(add.value); } };
    body.appendChild(add);
}

function secureMarketCard(number) {
    // The player takes the card: their agents go back and any Rival agents on it are captured
    const player = courtPlayer;
    const entry = courtMarket.find(card => card.number == number);
    const card = getCourtCard(number);
    const captured = getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);

    removeFromMarket(number);
    adjustCounter(player, "captives", captured);
    const capturedText = captured > 0 ? ", capturing " + captured + " agent" + (captured == 1 ? "" : "s") : "";

    const modalElement = document.getElementById("courtModal");
    if (card.type == "guild") {
        player.guildCards.push(number);
        showGuildCardsRow(player);
        showMessageToast("Player " + player.number, "Secured " + card.name + capturedText);
    } else if (player.isHuman) {
        showMessageToast("Player " + player.number, "Secured " + card.name + capturedText + ". Carry out the card.");
    } else {
        // What the bot does with a Vox card, once this window has closed
        modalElement.addEventListener('hidden.bs.modal', () => {
            showVoxCard(player, card);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
        }, { once: true });
    }

    SaveAllSettings();
    refreshTurnSummary();
    bootstrap.Modal.getOrCreateInstance(modalElement).hide();
}
