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
    return own > 0 && own > Math.max(...getRivalAgents(entry, player)) && !isParanoidBlocked(entry, player) && !isMarketCardClosed(entry);
}

function isMarketCardClosed(entry) {
    // A card no one can influence or secure for now: a campaign's Imperial Council once Decided
    return runCampaignHook("isCardClosed", entry) === true;
}

function removeFromMarket(number) {
    courtMarket = courtMarket.filter(entry => entry.number != number);
}

// Guild Struggle (Vox): steal a Rival's Guild card when secured
const guildStruggleNumber = 30;

function getMarketCardValue(player, entry) {
    // How much the bot wants a card, from generic values by its type. A Guild card for its
    // resource icon, a Vox card by what it does, plus the agents it would capture
    const card = getCourtCard(entry.number);
    const chasingTyrant = declaredAmbitions.includes("tyrant") && isChasingAmbition(player, "tyrant");
    const rivalAgents = getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);

    let value = marketValues.base;
    if (card.type == "vox") {
        // Guild Struggle steals a Rival's Guild card: nothing to it while no Rival has one it could steal (#158)
        const nothingToSteal = card.number == guildStruggleNumber && getBestGuildCardToSteal(player) == null;
        value += nothingToSteal ? 0 : marketValues.vox[card.number];
    } else if (card.resource == "weapons") {
        if (declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord")) { value += marketValues.perNeed * 2; }
    } else {
        value += marketValues.perNeed * getResourceNeed(player, card.resource);
    }
    // What a Guild card does (#200 phase 4): drawing a card (another turn when others have run
    // out), stealing, or a new action
    if (card.type == "guild") { value += getCardAbilityValue(card); }
    // The leader (#200): capturing their agents, and taking a card they could secure now
    const leader = typeof getLeader == "function" ? getLeader(player) : null;
    if (leader != null) {
        const threat = getLeaderThreat(player, leader);
        value += getMarketAgents(entry, leader) * leaderWeights.capture * Math.min(threat, 2) / 2;
        if (canSecureEntry(entry, leader)) { value += leaderWeights.secureDeny * Math.min(threat, 2); }
    }
    // In a campaign, what the Imperial Council is worth to it (campaignhooks.js)
    return value + rivalAgents * (chasingTyrant ? marketValues.captiveTyrant : marketValues.captive) + (runCampaignHook("marketValue", player, entry) || 0)
        + getAttachedValue(player, entry);
}

// What a Guild card's ability is worth to a bot (#200 phase 4)
const cardAbilityValues = { draw: 1.5, steal: 1, action: 0.5 };

function getCardAbilityValue(card) {
    const text = card.text || "";
    let value = 0;
    if (card.drawsPlayed != null || /\bdraw/i.test(text)) { value += cardAbilityValues.draw; }
    if (/\bsteal/i.test(text) && !/cannot steal/i.test(text)) { value += cardAbilityValues.steal; }
    if (/\((Build|Move|Tax|Battle|Influence|Secure|Repair)\)/.test(text)) { value += cardAbilityValues.action; }
    return value;
}

function getAttachedValue(player, entry) {
    // Guild cards attached to it (Guild Investigators' Recover, #176) come with it when it's secured
    return (entry.attached || []).map(getCourtCard).filter(card => card != null).reduce((total, card) => total + marketValues.base
        + (card.resource == "weapons" ? (declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord") ? marketValues.perNeed * 2 : 0)
            : marketValues.perNeed * getResourceNeed(player, card.resource)), 0);
}

function takeAttachedCards(player, entry) {
    // The Guild cards attached to a card it secured or ransacked go to its Guild row (#176)
    const attached = (entry.attached || []).filter(number => getCourtCard(number) != null);
    attached.forEach(number => player.guildCards.push(number));
    entry.attached = [];
    if (attached.length > 0) { showGuildCardsRow(player); }
    return attached.map(number => getCourtCard(number).name);
}

function getMarketReason(player, entry) {
    // Why it wants a card, if there's a clear reason. In a campaign, the Imperial Council (campaignhooks.js)
    const special = runCampaignHook("marketReason", player, entry);
    if (special != null) { return special; }
    // Guild cards attached to it (#176)
    const attached = (entry.attached || []).map(getCourtCard).filter(card => card != null);
    if (attached.length > 0) { return "it comes with " + attached.map(card => card.name).join(" and ") + " attached"; }
    const card = getCourtCard(entry.number);
    const rivalAgents = getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);
    if (rivalAgents > 0 && declaredAmbitions.includes("tyrant") && isChasingAmbition(player, "tyrant")) { return "captures for Tyrant"; }
    if (card.resource == "weapons") { return declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord") ? "chasing Warlord" : ""; }
    if (card.resource != null && getResourceNeed(player, card.resource) == 2) { return "chasing " + capitalise(preludeAmbitions[card.resource] || "warlord"); }
    return "";
}

function getCardsToSecure(player) {
    // The cards it could secure now, the one it wants most first
    return courtMarket.filter(entry => canSecureEntry(entry, player))
        .sort((a, b) => getMarketCardValue(player, b) - getMarketCardValue(player, a));
}

function getAgentsLeft(player) {
    // Its 10 agents, less those on Court cards, on its Outrage slots, and held by Rivals (#123).
    // null if the Court hasn't been entered, so it can't tell
    if (!isMarketKnown()) { return null; }
    const onCourt = courtMarket.reduce((total, entry) => total + getMarketAgents(entry, player), 0);
    return Math.max(agentsPerPlayer - onCourt - (player.outraged || []).length - (player.agentsCaptive || 0) - (player.agentsTrophy || 0), 0);
}

function hasNoAgents(player) {
    // Out of agents, by the count or by your answer (#123)
    return getAgentsLeft(player) === 0 || player.agentsOut === true;
}

function recordCapturedAgents(entry, player, kind) {
    // The Rival agents on a card it took are now held by it, as Captives or Trophies (#123)
    players.filter(other => other !== player).forEach(other => {
        other[kind] = (other[kind] || 0) + getMarketAgents(entry, other);
    });
}

function getCardsToInfluence(player) {
    // The cards worth an agent, best first: what it's worth for the agents it takes to get ahead.
    // None on its last card, as there's no later turn to secure one. It leaves alone a card it's
    // already ahead on. None with no agents left (#123)
    if (getUnplayedCards(player.cards).length == 0 || hasNoAgents(player)) { return []; }

    const agentsNeeded = entry => Math.max(...getRivalAgents(entry, player)) + 1 - getMarketAgents(entry, player);
    // #200 phase 4: blocking a Rival who could secure a card now that's worth a lot to them (an
    // agent ties it); leaving alone a card it can't win, or where a Rival has 2 or more agents and
    // it needs 3 or more, as its agents would likely become their Captives
    const block = entry => players.some(rival => rival !== player && canSecureEntry(entry, rival) && getMarketCardValue(rival, entry) >= marketValues.base + marketValues.perNeed * 2);
    const turnsLeft = getUnplayedCards(player.cards).length;
    const agentsLeft = getAgentsLeft(player);
    const winnable = entry => agentsNeeded(entry) <= Math.min(agentsLeft == null ? 10 : agentsLeft, turnsLeft + 1)
        && !(Math.max(...getRivalAgents(entry, player)) >= 2 && agentsNeeded(entry) >= 3);
    // Blocking the leader comes first (#200)
    const leader = typeof getLeader == "function" ? getLeader(player) : null;
    const blocksLeader = entry => leader != null && canSecureEntry(entry, leader);
    const score = entry => getMarketCardValue(player, entry) / agentsNeeded(entry) + (block(entry) ? marketValues.blocking : 0)
        + (blocksLeader(entry) ? leaderWeights.blocking * Math.min(getLeaderThreat(player, leader), 2) : 0);
    return courtMarket.filter(entry => agentsNeeded(entry) > 0 && !isMarketCardClosed(entry) && (winnable(entry) || block(entry)))
        .sort((a, b) => score(b) - score(a));
}

function getInfluenceSequence(player, count) {
    // The card for each of count Influences, best first, each chosen as if its earlier agents were
    // already placed (#156). The agents are put back afterwards
    const before = new Map();
    const targets = [];
    for (let index = 0; index < count; index++) {
        const entry = getCardsToInfluence(player)[0];
        if (entry == null) { break; }
        targets.push(entry);
        if (!before.has(entry)) { before.set(entry, entry.agents[player.number]); }
        entry.agents[player.number] = getMarketAgents(entry, player) + 1;
    }
    before.forEach((agents, entry) => {
        if (agents === undefined) { delete entry.agents[player.number]; } else { entry.agents[player.number] = agents; }
    });
    return targets;
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
    hideIconTooltip(button, "courtModal");
    openCourt(getPlayerNumberFromString(button.parentNode.id));
}

function askOpeningCourt() {
    // A new game: the cards dealt to the Court. Skipping it just means the bots' advice is more general
    courtPlayer = players[0];
    courtSetup = true;

    const modal = document.getElementById("courtModal");
    modal.querySelector(".modal-header").classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    document.getElementById("courtTitle").innerHTML = "The Court";
    // Then the Leader draft, or setting up the players. A campaign has its own setup (campaignhooks.js)
    modal.addEventListener('hidden.bs.modal', () => {
        courtSetup = false;
        if (leadersAndLore) { startLeaderDraft(); } else if (runCampaignHook("setUpPlayers") !== true) { showSetUpPlayers(); }
    }, { once: true });

    showCourtWindow();
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

function showSetUpPlayers() {
    // A new game, once the Court has been entered: the setup card (rulebook p.4-5). The app deals
    // one, or the player picks the one they drew, and places everyone's pieces (board.js, #160)
    document.getElementById("guildTitle").innerHTML = "Set up the board";
    document.querySelector("#guildModal .modal-header").classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    const body = document.getElementById("guildBody");
    const cards = getSetupCards(players.length);
    body.innerHTML = "<p class=\"mb-2\">Deal a setup card for " + players.length + " players, or pick the one you drew. The app places everyone's starting pieces"
        + (leadersAndLore ? " (as their Leaders say)" : " and gives each player the 2 resources of their A and B planets") + ".</p>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mb-3\" id=\"dealSetupCard\" onclick=\"chooseSetupCard(null)\"><i class=\"bi bi-shuffle\"></i> Deal a setup card</button>"
        + "<div class=\"small text-secondary mb-1\">Or the one you drew:</div><div class=\"d-grid gap-2\">"
        + cards.map(card => "<button type=\"button\" class=\"btn btn-outline-secondary text-start\" onclick=\"chooseSetupCard(" + setupCards.indexOf(card) + ")\">"
            + players.length + " Players &middot; <b>" + card.name + "</b>" + (card.experienced ? " <small class=\"text-secondary\">for experienced players</small>" : "") + "</button>").join("")
        + "</div>";
    // It has to be finished: the mulligan and Round 1 follow (#135)
    showLockedModal(document.getElementById("guildModal"));
}

function chooseSetupCard(index) {
    // Dealt (null): one at random for the player count
    const cards = getSetupCards(players.length);
    const card = index != null ? setupCards[index] : cards[Math.floor(Math.random() * cards.length)];
    applySetupCard(card);
    showStartingPieces(card);
}

function showStartingPieces(card) {
    // What to place where, system by system, then on to the game
    document.getElementById("guildTitle").innerHTML = players.length + " Players &middot; " + card.name;
    const body = document.getElementById("guildBody");
    const systems = getSystemIds().filter(id => getPiecesText(id) != "");
    body.innerHTML = "<p class=\"mb-2\">" + (card.outOfPlay.length == 1 ? "Cluster " : "Clusters ") + card.outOfPlay.join(" and ") + " " + (card.outOfPlay.length == 1 ? "is" : "are") + " out of play: cover "
        + (card.outOfPlay.length == 1 ? "its gate with a path marker and its planets" : "their gates with path markers and their planets") + " with out-of-play markers. Place these:</p>"
        + "<div class=\"mb-2\">" + systems.map(id => "<div class=\"d-flex gap-2 py-1 border-bottom\"><span style=\"min-width:130px\">" + getSystemName(id) + " <small class=\"text-secondary\">" + id + "</small></span><span class=\"small\">" + tagPlayerNames(getPiecesText(id)) + "</span></div>").join("") + "</div>"
        + "<p class=\"small text-secondary mb-3\">" + (leadersAndLore ? "Resources, ships and Outrage come from each Leader." : "Each player's 2 starting resources are on their panel.")
        + (players.length == 2 ? " The resources of the out-of-play planets are on the ambition boxes." : "") + "</p>";

    const done = document.createElement("button");
    done.type = "button";
    done.id = "setUpPlayersDone";
    done.classList.add("btn", "btn-primary", "w-100");
    done.innerHTML = "OK";
    done.onclick = () => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
        lastAnnouncedLeader = null;
        // Then the mulligan (2 players), then Round 1 (#122)
        startRoundAfterMulligan();
    };
    body.appendChild(done);
    // The window is still open from choosing the card; it has to be finished (#135)
    const modal = document.getElementById("guildModal");
    if (!modal.classList.contains("show")) { showLockedModal(modal); }
}

function getMarketShortfall() {
    // How many cards the market is missing, if it has been entered
    if (!isMarketKnown()) { return 0; }
    return Math.max(getCourtSize() - courtMarket.length, 0);
}

function getMarketReminder(player) {
    // For the turn summary, until the replacement is added. Tapping it opens the Court window
    const shortfall = getMarketShortfall();
    if (shortfall == 0) { return null; }
    return "<a href=\"#0\" class=\"marketreminder small fw-normal\" onclick=\"openCourt(" + player.number + "); return false;\">The market is " + shortfall + " card" + (shortfall == 1 ? "" : "s") + " short: add " + (shortfall == 1 ? "the replacement" : "the replacements") + "</a>";
}

function openCourt(playerNumber) {
    courtPlayer = getPlayer(playerNumber);

    const header = document.querySelector("#courtModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(courtPlayer));
    document.getElementById("courtTitle").innerHTML = "Player " + courtPlayer.number + " at the Court";

    showCourtWindow();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("courtModal")).show();
}

function changeMarketAgents(number, playerNumber, change) {
    const entry = courtMarket.find(card => card.number == number);
    const before = entry.agents[playerNumber] || 0;
    entry.agents[playerNumber] = Math.max(before + change, 0);
    logManualChange({ type: "marketAgents", number: number, player: playerNumber, amount: change });
    // A human player's own agent on their turn is an Influence action (#186, boardhuman.js)
    if (entry.agents[playerNumber] != before) { countHumanInfluence(getPlayer(playerNumber), number, change); }
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function addToMarket(number) {
    courtMarket.push({ number: parseInt(number), agents: {} });
    logManualChange({ type: "marketAdd", number: parseInt(number) });
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function dealCourtForMe() {
    // At setup: the app deals the Court at random from the cards not yet in it, and the player
    // takes the same cards from their Court deck (#136)
    const target = getCourtSize();
    const available = getCourtPool().filter(card => !courtMarket.some(entry => entry.number == card.number) && getGuildCardHolder(card.number) == null);
    shuffleCards(available).slice(0, Math.max(target - courtMarket.length, 0)).forEach(card => addToMarket(card.number));
}

function removeMarketCard(number) {
    removeFromMarket(number);
    logManualChange({ type: "marketRemove", number: number });
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function refreshTurnSummary() {
    // The plan names market cards and the summary says if the market is short, so keep it up to date
    if (awaitingDone != null) { showTurnDone(getPlayer(awaitingDone)); }
    updateCardCounts();
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

    // Each with a button that does it for you, as + or the card's Secure would
    const row = (text, button) => "<div class=\"d-flex align-items-center gap-2\"><span class=\"flex-fill\">" + text + "</span>" + button + "</div>";
    const button = (id, label, icon, onclick) => "<button type=\"button\" class=\"btn btn-sm btn-primary py-0 text-nowrap\" id=\"" + id + "\" onclick=\"" + onclick + "\"><i class=\"bi " + icon + "\"></i> " + label + "</button>";
    let lines = [];
    if (secure != null) { lines.push(row("<b>Secure:</b> " + describe(secure), button("courtAdviceSecure", "Secure", "bi-check-lg", "secureMarketCard(" + secure.number + ")"))); }
    if (influence != null) { lines.push(row("<b>Influence:</b> " + describe(influence), button("courtAdviceAgent", "Add agent", "bi-plus-lg", "changeMarketAgents(" + influence.number + ", " + player.number + ", 1)"))); }
    if (lines.length == 0) { lines.push("Nothing worth doing here this turn."); }
    return "<div class=\"alert alert-secondary py-2 px-3 small mb-2 d-grid gap-1\" id=\"courtAdvice\">" + lines.join("") + "</div>";
}

function showCourtWindow() {
    const body = document.getElementById("courtBody");
    body.innerHTML = getCourtAdviceHtml(courtPlayer);


    const shortfall = getMarketShortfall();
    const hintText = courtSetup
        ? "Add the " + openingCourtCards[players.length] + " cards dealt to the Court, so the bots can plan around them."
        : (!isMarketKnown()
            ? "Add the cards in the market, and the app can track them and everyone's agents."
            : (shortfall > 0 ? "The market is " + shortfall + " card" + (shortfall == 1 ? "" : "s") + " short: add " + (shortfall == 1 ? "the replacement" : "the replacements") + " below." : ""));
    if (hintText != "") {
        const hint = document.createElement("div");
        hint.classList.add("small", "text-muted", "mb-2");
        hint.id = "courtHint";
        hint.innerHTML = hintText;
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
        // In a campaign, the Imperial Council's side (campaignhooks.js)
        runCampaignHook("courtRow", entry, row);

        // Everyone's agents on the card, in their colours
        const agents = document.createElement("div");
        agents.classList.add("d-flex", "flex-wrap", "gap-1", "justify-content-center");
        players.forEach(player => {
            const counter = document.createElement("div");
            counter.classList.add("marketcounter", "playertag" + getPlayerColour(player));
            counter.innerHTML = "<button type=\"button\" class=\"marketstep\" aria-label=\"One agent fewer for Player " + player.number + "\" onclick=\"changeMarketAgents(" + entry.number + ", " + player.number + ", -1)\"><i class=\"bi bi-dash-lg\"></i></button>"
                + "<span class=\"marketagents\" id=\"marketAgents_" + entry.number + "_" + player.number + "\">" + getMarketAgents(entry, player) + "</span>"
                + "<button type=\"button\" class=\"marketstep\" aria-label=\"One agent more for Player " + player.number + "\" onclick=\"changeMarketAgents(" + entry.number + ", " + player.number + ", 1)\"><i class=\"bi bi-plus-lg\"></i></button>";
            agents.appendChild(counter);
        });
        // No one has any agents yet when the Court is being set up
        if (!courtSetup) { row.appendChild(agents); }
        body.appendChild(row);
    });

    // Add a card, until the market is full: any Court card not held by anyone or already in the market
    const available = getCourtPool().filter(card => !courtMarket.some(entry => entry.number == card.number) && getGuildCardHolder(card.number) == null).sort(byCardName);
    const add = document.createElement("select");
    add.classList.add("form-select", "form-select-sm", "mt-2");
    add.id = "courtAdd";
    add.innerHTML = "<option value=\"\">Add a card to the market&hellip;</option>"
        + available.map(card => "<option value=\"" + card.number + "\">" + card.name + (card.type == "vox" ? " (Vox)" : " (" + preludeResourceNames[card.resource] + ")") + "</option>").join("");
    add.onchange = () => { if (add.value != "") { addToMarket(add.value); } };
    const isFull = courtMarket.length >= getCourtSize();
    if (!isFull) { body.appendChild(add); }

    // At setup, until it's full: or the app can deal the cards (#136)
    if (courtSetup && !isFull) {
        body.insertAdjacentHTML("beforeend", "<div class=\"courtdeal\"><div class=\"small flex-fill\">Or let the app deal them, then take the same cards from your Court deck.</div>"
            + "<button type=\"button\" class=\"btn btn-primary btn-sm\" id=\"courtDealForMe\" onclick=\"dealCourtForMe()\"><i class=\"bi bi-shuffle\"></i> Deal for me</button></div>");
    }

    if (courtSetup) {
        const done = document.createElement("button");
        done.type = "button";
        done.id = "courtSetupDone";
        done.classList.add("btn", isFull ? "btn-primary" : "btn-outline-secondary", "w-100", "mt-3");
        done.innerHTML = isFull ? "Done" : "Skip for now";
        done.onclick = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("courtModal")).hide();
        body.appendChild(done);
    }
}

function getRansackOptions(player, defender) {
    // Ransacking the Court: any card with any of the defender's agents (rulebook p.16), the one
    // the player wants most first
    // getMarketCardValue counts the leader's agents and a card they could secure (#200)
    return courtMarket.filter(entry => getMarketAgents(entry, defender) > 0)
        .sort((a, b) => getMarketCardValue(player, b) - getMarketCardValue(player, a));
}

function ransackMarketCard(player, number) {
    // Like securing it, except the Rival agents are taken as Trophies. Returns the card
    const entry = courtMarket.find(card => card.number == number);
    const card = getCourtCard(number);
    recordCapturedAgents(entry, player, "agentsTrophy");
    adjustCounter(player, "trophies", getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0));
    takeAttachedCards(player, entry);
    removeFromMarket(number);
    if (card.type == "guild") {
        player.guildCards.push(number);
        showGuildCardsRow(player);
    }
    return card;
}

function secureMarketCard(number) {
    // The player takes the card: their agents go back and any Rival agents on it are captured
    const player = courtPlayer;
    const entry = courtMarket.find(card => card.number == number);
    const card = getCourtCard(number);
    const captured = getRivalAgents(entry, player).reduce((total, agents) => total + agents, 0);
    recordCapturedAgents(entry, player, "agentsCaptive");
    // A human player's Secure on their turn counts as an action (#186, boardhuman.js)
    countHumanSecure(player, card.name);
    // Guild cards attached to it come too (#176)
    const attachedNames = takeAttachedCards(player, entry);
    if (attachedNames.length > 0) { showMessageToast("Player " + player.number, "Takes the attached " + attachedNames.join(" and ") + " too."); }
    // A campaign's own cards, such as the Imperial Council (campaignhooks.js)
    if (runCampaignHook("secureCard", entry, player, captured) === true) {
        adjustCounter(player, "captives", captured);
        SaveAllSettings();
        refreshTurnSummary();
        showCourtWindow();
        return;
    }

    removeFromMarket(number);
    adjustCounter(player, "captives", captured);
    const capturedText = captured > 0 ? ", capturing " + captured + " agent" + (captured == 1 ? "" : "s") : "";

    const modalElement = document.getElementById("courtModal");
    if (card.type == "guild") {
        player.guildCards.push(number);
        showGuildCardsRow(player);
        showMessageToast("Player " + player.number, "Secured " + card.name + capturedText + ". Add its replacement to the market.");
    } else if (player.isHuman && card.number == 28) {
        // Outrage Spreads: choose the type, and the app carries it out for everyone (#119)
        showMessageToast("Player " + player.number, "Secured " + card.name + capturedText + ". Add its replacement to the market.");
        modalElement.addEventListener('hidden.bs.modal', () => showOutrageSpreads(player), { once: true });
    } else if (player.isHuman) {
        // The app carries out the card in its own window (#204)
        showMessageToast("Player " + player.number, "Secured " + card.name + capturedText + ". Add its replacement to the market.");
        modalElement.addEventListener('hidden.bs.modal', () => showVoxForPlayer(player, card), { once: true });
    } else {
        // What the bot does with a Vox card, once this window has closed
        modalElement.addEventListener('hidden.bs.modal', () => {
            showVoxCard(player, card);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
        }, { once: true });
    }

    SaveAllSettings();
    refreshTurnSummary();
    // The window stays open to add the replacement (#124), unless a Vox card's window follows
    if (card.type == "vox") {
        bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    } else {
        showCourtWindow();
    }
}
