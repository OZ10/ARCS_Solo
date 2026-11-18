// Blighted Reach campaign (#85), Phase 3: Fates in play. Each Fate's starting cards go on the panel,
// objectives the app can work out move by themselves, an objectives window follows scoring, and
// each Fate's Resolution card is spelled out in the Intermission. The bots learn each "A" Fate in
// turn: Admiral, Partisan, Advocate, Steward, Founder, Caretaker, Believer, Magnate. Bots aren't
// dealt the Magnate for now: it advances in Summit deals, and bots don't negotiate yet.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// Fate Guild cards, numbered 200 and up here. They're protected: they can't be stolen
const fateGuildCards = [
    new CourtCard(201, "Imperial Officers", "guild", "weapons", 0,
        "Bury this if you're an Outlaw. You ignore the Presence and Movement Laws: you can act with any Imperial ships, and you control all Empire-controlled systems on your turn.",
        { protected: true, code: "F7 02", buryIfOutlaw: true }),
    new CourtCard(202, "Honor Guard", "guild", "weapons", 0,
        "Your Weapon Guild cards can't be stolen while you have any Weapons.",
        { protected: true, code: "F7 05" }),
    new CourtCard(203, "Informants", "guild", "psionics", 0,
        "Spy (Influence): Once per turn, give your highest action card to a Rival. They give you their highest action card (it can be the same card).",
        { protected: true, code: "F6 02", replacesActions: [{ name: "Spy", replaces: "influence" }] }),
    new CourtCard(204, "Guild Investigators", "guild", "psionics", 0,
        "Recover (Move): Attach the topmost Guild card from the Court discard pile to a Court card with no agents on it.",
        { protected: true, code: "F4 02", replacesActions: [{ name: "Recover", replaces: "move" }] }),
    new CourtCard(205, "Guild Overseers", "guild", "relics", 0,
        "To use actions on Guild cards, you must be first or second for a declared ambition. When Secured: Take any 1 Guild card from the Court deck or discard pile.",
        { protected: true, code: "F4 03" })
];

// Fates the bots aren't dealt yet (the Magnate needs Summit deals)
const botsNotDealt = [3];

// What the app knows of each Fate beyond fates.js:
// cards       - Fate Guild cards gained at setup (on the panel)
// edicts      - Edicts added to the rules booklet at setup, resolved after Govern the Imperial Reach
// other       - other cards and rules it adds, listed on the panel
// resolution  - its Resolution card: { completed, failed, gain (Guild cards), scrapEdicts (on a fail) }
// taught      - the bots play towards its objective
const fateRules = {
    1: { resolution: { completed: "Add Council Intrigue (05), Tax Collectors (06) and Hunter Squads (07) to the Court deck. Add Imperial Protectors (08) to the rules booklet. Scrap Empire Falls (09) and 2 Lesser Regents (10-11).",
        failed: "Scrap Council Intrigue, Tax Collectors, Hunter Squads and Imperial Protectors (05-08). Add Empire Falls (09), 2 Lesser Regents (10-11) and Dealmakers (03) to the Court deck." } },
    2: { resolution: { completed: "Gain Book of Liberation (04). Add 3 Political Intrigue (05-07) to the Court deck. Put 2 Construction Union (08-09) and 2 Admin Union (10-11) behind the next Resolution card (23).",
        failed: "Scrap Book of Liberation and 3 Political Intrigue (04-07). Add 2 Construction Union and 2 Admin Union (08-11) to the Court deck." } },
    3: { resolution: { completed: "Add Elder Broker (04), Relic Fence (05) and Prison Wardens (06) to the Court deck. Put the 5 Cartels (07-11) behind the next Resolution card (21). If Mining or Shipping Interest is in the Court discard, add it to the Court deck.",
        failed: "Scrap Elder Broker, Relic Fence and Prison Wardens (04-06). Add the 5 Cartels (07-11) to the Court deck." } },
    4: { cards: [204, 205], taught: true,
        resolution: { completed: "Add Guild Overseers (03), the 5 Liaisons (05-09) and Diplomatic Fiasco (10) to the Court deck. Scrap Guild Struggle (11).",
            failed: "Add Guild Overseers to the Court deck. For each Guild suit you have more of than each Rival, add its Liaison; scrap the rest. Scrap Diplomatic Fiasco. Add Guild Struggle to the Court deck.", lose: [205] } },
    5: { resolution: { completed: "Scrap Golem Beacon. Put all the Golems on the map onto Golem Hearth. Add 1 random lore card for each player and the 4 Unstable cards (08-11) to the Court deck.",
        failed: "Scrap Golem Beacon. Add Stone-Speakers to the Court deck. Scrap the Golems on the map. Add the Unstable cards matching Golems still in play; scrap the rest." } },
    6: { cards: [203], other: ["Partisan Seizing"], taught: true,
        resolution: { completed: "Add the 5 Loyal cards (05-09) to the Court deck. Gain Galactic Bards (10). Scrap Spacing Union (11), Arms Union (12) and 2 Outrage Spreads (13-14).",
            failed: "Scrap the 5 Loyal cards (05-09). Add Galactic Bards, Spacing Union, Arms Union and 2 Outrage Spreads (10-14) to the Court deck. Scrap Partisan Seizing and clear your Outrage.", gain: [25], failClearsOutrage: true } },
    7: { cards: [201], edicts: [55], other: ["Use Imperial Foundries (Edict 55)"], taught: true,
        resolution: { completed: "Gain Honor Guard (05). Add 2 Rogue Admirals (06-07) and 2 Court Enforcers (08-09) to the Court deck. Scrap 2 Imperial Defectors (10-11).",
            failed: "Scrap Use Imperial Foundries. Scrap Honor Guard and 2 Rogue Admirals (05-07). Add 2 Court Enforcers and 2 Imperial Defectors (08-11) to the Court deck.", gain: [202], scrapEdicts: [55] } }
};

function getFateNumber(player) {
    return (campaign == null || campaign.players[player.number] == null) ? null : campaign.players[player.number].fate;
}

function hasFate(player, number) {
    return getFateNumber(player) == number;
}

function isWinningAnAmbition(player) {
    return declaredAmbitions.some(ambition => wouldWinAmbition(player, ambition));
}

registerCampaignHook("courtCard", number => fateGuildCards.find(card => card.number == number));

// Setup: each Fate's starting cards and Edicts (called when the Fates are revealed)

function applyFateSetups(act) {
    campaign.edicts = campaign.edicts || [];
    players.forEach(player => {
        const state = getCampaignPlayer(player);
        state.objectiveStart = state.objective;
        state.objectiveLog = [];
        const rules = fateRules[state.fate];
        if (act != 1 || rules == null) { return; }
        (rules.cards || []).forEach(number => { if (!player.guildCards.includes(number)) { player.guildCards.push(number); } });
        (rules.edicts || []).forEach(number => { if (!campaign.edicts.includes(number)) { campaign.edicts.push(number); } });
        showGuildCardsRow(player);
    });
}

function buryOutlawCards(player) {
    // Some Fate cards are buried when their holder becomes an Outlaw (Imperial Officers)
    const buried = getPlayerGuildCards(player).filter(card => card.buryIfOutlaw);
    if (buried.length == 0) { return; }
    player.guildCards = player.guildCards.filter(number => !buried.some(card => card.number == number));
    showGuildCardsRow(player);
    showMessageToast("Player " + player.number + " is an Outlaw", "Bury " + buried.map(card => card.name).join(" and ") + ".");
}

// Objectives: moved by the app where it can tell, with a note of why for the objectives window

function advanceObjective(player, amount, reason) {
    const state = getCampaignPlayer(player);
    if (state.objective == null || amount <= 0) { return; }
    const before = state.objective;
    state.objective = Math.max(before - amount, 0);
    state.objectiveLog = (state.objectiveLog || []).concat({ reason: reason, from: before, to: state.objective });
    showCampaignPanel(player);
    SaveAllSettings();
    showMessageToast("Player " + player.number + "'s objective", reason + ": " + before + " &rarr; " + state.objective + (state.objective == 0 ? " (complete)" : ""));
}

function imperialShipsPlaced(count, reason) {
    // The Admiral: while a Regent and winning an ambition, 1 for each Imperial ship anyone places
    players.filter(player => hasFate(player, 7) && isRegent(player) && isWinningAnAmbition(player))
        .forEach(player => advanceObjective(player, count, count + " Imperial ship" + (count == 1 ? "" : "s") + " placed (" + reason + ") while winning an ambition"));
}

registerCampaignHook("afterScoring", carryOn => {
    // What moved this chapter, then on. Nothing to show: carry straight on
    const moved = players.filter(player => (getCampaignPlayer(player).objectiveLog || []).length > 0);
    if (moved.length == 0) { return undefined; }
    const rows = moved.map(player => {
        const state = getCampaignPlayer(player);
        const log = state.objectiveLog;
        return "<div class=\"objrow\"><span>Player " + player.number + " &middot; " + getFate(state.fate).name
            + "<small class=\"d-block text-secondary\">" + log.map(entry => entry.reason).join("; ") + "</small></span>"
            + "<span class=\"objdelta\">" + log[0].from + " &rarr; " + log[log.length - 1].to + "</span></div>";
    }).join("");
    showCampaignWindow("End of chapter " + roundNumber + ": objectives", "<p class=\"mb-2\">The objective markers that moved this chapter. Move them on the Power track to match.</p>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">Worked out by the app</div>" + rows + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" data-bs-dismiss=\"modal\">OK</button>", null, true, () => {
            players.forEach(player => { getCampaignPlayer(player).objectiveLog = []; });
            SaveAllSettings();
            carryOn();
        });
    return true;
});

// The Edicts the Fates add, after Govern the Imperial Reach, lowest number first

function afterGovern() {
    const edicts = (campaign.edicts || []).slice().sort((a, b) => a - b);
    roundEvent.fateEdicts = edicts;
    nextFateEdict();
}

function nextFateEdict() {
    const number = roundEvent.fateEdicts.shift();
    if (number == null) { finishRoundEvent(); return; }
    if (number == 55) { showImperialFoundries(); return; }
    nextFateEdict();
}

function showImperialFoundries() {
    // Use Imperial Foundries: the holder of Imperial Officers may replace 1 Loyal ship at each of
    // its Loyal starports with an Imperial ship
    const holder = players.find(player => (player.guildCards || []).includes(201));
    const most = holder == null ? 0 : Math.min(holder.starportsValue || 0, holder.shipsBoardValue);
    if (holder == null || most == 0) { nextFateEdict(); return; }
    // A bot keeps a few ships of its own
    roundEvent.foundries = holder.isHuman ? most : Math.min(most, Math.max(holder.shipsBoardValue - 3, 0));
    showFoundries(holder, most);
}

function showFoundries(holder, most) {
    const choice = holder.isHuman
        ? "<div class=\"neutralsteps mb-2\"><span class=\"neutralstep\"><span>Ships to replace</span><button type=\"button\" onclick=\"stepFoundries(-1, " + most + ")\" aria-label=\"One fewer\"><i class=\"bi bi-dash\"></i></button><b>" + roundEvent.foundries
            + "</b><button type=\"button\" onclick=\"stepFoundries(1, " + most + ")\" aria-label=\"One more\"><i class=\"bi bi-plus\"></i></button></span></div>"
        : "<p class=\"mb-2\">Player " + holder.number + " (bot) replaces <b>" + roundEvent.foundries + "</b>" + (roundEvent.foundries < most ? ", keeping enough ships of its own" : "") + ".</p>";
    showCampaignWindow("Edicts", "<div class=\"turnsection\"><div class=\"turnlabel\">55 &middot; Use Imperial Foundries</div>"
        + "<p class=\"mb-2\">Player " + holder.number + " holds Imperial Officers: for each of its Loyal starports (" + (holder.starportsValue || 0) + "), it may replace 1 of its ships in that system with an Imperial ship.</p>"
        + choice + "</div><button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"applyFoundries(" + holder.number + ")\">OK</button>", holder, true);
}

function stepFoundries(change, most) {
    roundEvent.foundries = Math.min(Math.max(roundEvent.foundries + change, 0), most);
    const holder = players.find(player => (player.guildCards || []).includes(201));
    showFoundries(holder, most);
}

function applyFoundries(playerNumber) {
    const holder = getPlayer(playerNumber);
    const count = roundEvent.foundries;
    if (count > 0) {
        adjustCounter(holder, "shipsBoard", -count);
        imperialShipsPlaced(count, "Use Imperial Foundries");
        SaveAllSettings();
    }
    nextFateEdict();
}

// Battles: the Admiral's Trophies taken with attacking Imperial ships

registerCampaignHook("battleDefenders", () => {
    const attacker = battle.attacker;
    let check = document.getElementById("battleFateCheck");
    if (check != null) { check.remove(); }
    if (!(hasFate(attacker, 7) && isRegent(attacker))) { return undefined; }
    const note = document.getElementById("battleCampaignNote");
    note.insertAdjacentHTML("afterend", "<div class=\"form-check d-flex justify-content-center gap-2 mt-1\" id=\"battleFateCheck\"><input class=\"form-check-input\" type=\"checkbox\" id=\"battleWithImperials\""
        + (attacker.isHuman ? "" : " checked") + "><label class=\"form-check-label small\" for=\"battleWithImperials\">Imperial ships attacked with Player " + attacker.number + " (Admiral: each Trophy advances its objective)</label></div>");
    return undefined;
});

registerCampaignHook("modeChanged", () => {
    if (!campaignMode) {
        const check = document.getElementById("battleFateCheck");
        if (check != null) { check.remove(); }
    }
});

registerCampaignHook("afterBattle", losses => {
    const box = document.getElementById("battleWithImperials");
    const attacker = battle.attacker;
    if (box == null || !box.checked || !hasFate(attacker, 7) || !isRegent(attacker)) { return undefined; }
    const trophies = losses.defenderShips + losses.defenderBuildings;
    advanceObjective(attacker, trophies, trophies + " Troph" + (trophies == 1 ? "y" : "ies") + " taken in battle with attacking Imperial ships");
    return undefined;
});

// A bot's choices for its Fate: the Admiral's battle target is in empire.js (battleTargetBonus)

// The Partisan (Fate 6). Sow Division: 1 each time it gets the initiative. Appeal to Your
// Supporters: 2 for each ambition it wins without Outrage of that ambition's resource. Partisan
// Seizing: it can't seize by discarding a second card, but may seize when playing a card by
// Provoking Outrage of a resource it isn't Outraged on. Informants: Spy instead of an Influence

const ambitionOutrageResources = { tycoon: ["fuel", "materials"], tyrant: [], warlord: ["weapons"], keeper: ["relics"], empath: ["psionics"] };

registerCampaignHook("initiativeGained", player => {
    if (campaign == null || !hasFate(player, 6)) { return undefined; }
    advanceObjective(player, 1, "Got the initiative (Sow Division)");
    return undefined;
});

registerCampaignHook("ambitionsScored", results => {
    results.filter(result => result.place == 1 && !result.player.isNeutral && hasFate(result.player, 6)).forEach(result => {
        const outraged = (result.player.outraged || []).filter(resource => (ambitionOutrageResources[result.ambition] || []).includes(resource));
        if (outraged.length == 0) { advanceObjective(result.player, 2, "Won " + capitalise(result.ambition) + " without its Outrage (Appeal to Your Supporters)"); }
    });
    return undefined;
});

function getSeizeOutrages(player) {
    // The resources it isn't Outraged on
    return preludeResources.filter(resource => !(player.outraged || []).includes(resource));
}

function canPartisanSeize(player) {
    return hasFate(player, 6) && !hasInitiativeBeenClaimedThisTurn && !player.hasInitiative && getSeizeOutrages(player).length > 0;
}

registerCampaignHook("afterActionButtons", (card, player) => {
    // A human Partisan's CLAIM button seizes by Outrage instead
    const claim = document.getElementById(getActionId(player, "CLAIM"));
    if (claim == null) { return undefined; }
    const partisan = hasFate(player, 6);
    claim.innerHTML = partisan ? "SEIZE: OUTRAGE" : "CLAIM";
    if (partisan) { showHideElement(getActionButtonElements("CLAIM", player), canPartisanSeize(player)); }
    return undefined;
});

registerCampaignHook("seizeByOutrage", player => {
    if (!hasFate(player, 6)) { return undefined; }
    hasInitiativeBeenClaimedThisTurn = true;
    changeInitiative(player);
    const rows = getSeizeOutrages(player).map(resource => {
        const held = player[resource + "Value"], cards = getPlayerGuildCards(player).filter(card => card.resource == resource && !card.keepOnOutrage);
        const loses = [held > 0 ? held + " " + preludeResourceNames[resource] : null].concat(cards.map(card => card.name)).filter(item => item != null);
        return "<button type=\"button\" class=\"btn btn-outline-secondary text-start\" onclick=\"partisanOutrage(" + player.number + ", '" + resource + "')\">" + getGameIcon(resource) + " " + preludeResourceNames[resource]
            + "<small class=\"d-block text-secondary\">" + (loses.length > 0 ? "Discards your " + loses.join(" and ") : "You have none to discard") + "</small></button>";
    }).join("");
    showCampaignWindow("Partisan Seizing", "<p class=\"mb-2\">You seize the initiative: Provoke Outrage of a resource you aren't Outraged on. You discard all that resource and its Guild cards.</p>"
        + "<div class=\"d-grid gap-2\">" + rows + "</div>", player, true);
    return true;
});

function partisanOutrage(playerNumber, resource) {
    const player = getPlayer(playerNumber);
    provokeOutrage(player, resource);
    campaign.partisanSeize = { player: playerNumber, resource: resource, round: roundNumber, turn: turnNumber };
    SaveAllSettings();
    closeCampaignWindow();
    whenWindowsClosed(() => finishPlay(player));
}

registerCampaignHook("botClaim", (player, cards, actionToPlay) => {
    // A bot Partisan seizes when there's an Outrage that costs it little: a resource it holds at
    // most 1 of, with no Guild cards of it, and doesn't need for a declared ambition
    if (!hasFate(player, 6)) { return undefined; }
    if (!canPartisanSeize(player) || cards.length == 0) { return false; }
    const cost = resource => player[resource + "Value"] + getGuildIconCount(player, resource) * 2 + getResourceNeed(player, resource) * 3;
    const resource = getSeizeOutrages(player).sort((a, b) => cost(a) - cost(b))[0];
    if (cost(resource) > 1) { return false; }
    const actionCard = getLowestCardtoPlay(cards);
    playCard(player, actionCard, actionToPlay, actionCard.name == playedCardList[0].name ? "COPY" : "PIVOT");
    provokeOutrage(player, resource);
    hasInitiativeBeenClaimedThisTurn = true;
    changeInitiative(player);
    campaign.partisanSeize = { player: player.number, resource: resource, round: roundNumber, turn: turnNumber };
    showMessageToast("Player " + player.number, "Seized the initiative by Provoking Outrage of " + preludeResourceNames[resource] + " (Partisan Seizing)");
    SaveAllSettings();
    return true;
});

// The Fates' Guild card actions, offered after a bot's prelude (guildactions.js)

registerCampaignHook("guildActionOffers", (player, wants, can) => getSpyOffers(player, wants, can).concat(getRecoverOffers(player, wants, can)));

function getSpyOffers(player, wants, can) {
    // Spy (Informants): its highest card for a Rival's highest. Worth it when its own highest is low
    if (!(player.guildCards || []).includes(203) || !can("influence")) { return []; }
    const highest = hand => getHighestCard(getUnplayedCards(hand).filter(card => !isEventCard(card)));
    const own = highest(player.cards);
    const rivals = players.filter(other => other !== player && highest(other.cards) != null);
    if (own == null || rivals.length == 0) { return []; }
    const low = own.number <= 3;
    if (!low && !wants(guildActionChance.trade)) { return []; }
    const rival = rivals[Math.floor(Math.random() * rivals.length)];
    return [{ label: "Spy instead of an Influence (Informants)", text: "give its highest card, " + getCardFullName(own) + ", to Player " + rival.number + " and take their highest card. The app swaps them.",
        spy: rival.number, decided: low, why: low ? "Its highest card is only a " + own.number + "." : null }];
}

function getRecoverOffers(player, wants, can) {
    // Recover (Guild Investigators): worth a Move to the Advocate while it has Guild Overseers
    if (!(player.guildCards || []).includes(204) || !can("move")) { return []; }
    const overseers = (player.guildCards || []).includes(205);
    if (!overseers && !wants(guildActionChance.trade)) { return []; }
    return [{ label: "Recover instead of a Move (Guild Investigators)", text: "attach the top Guild card of the Court discard pile to a Court card with no agents (do it on the table)",
        recover: true, decided: overseers, why: overseers ? "With Guild Overseers, each Recover advances its objective 2." : null }];
}

registerCampaignHook("applyOffer", (player, offer) => {
    if (offer.spy != null) { applySpy(player, offer); }
    if (offer.recover) { advanceAdvocate(player, 2, "Recover (Guild Investigators)"); }
    if (offer.discards != null && getCourtCard(offer.discards) != null) { advanceAdvocate(player, 3, "Used the Prelude of " + getCourtCard(offer.discards).name + ", which discards itself"); }
    return undefined;
});

function applySpy(player, offer) {
    const rival = getPlayer(offer.spy);
    const highest = hand => getHighestCard(getUnplayedCards(hand).filter(card => !isEventCard(card)));
    const own = highest(player.cards), theirs = highest(rival.cards);
    if (own == null || theirs == null) { return; }
    player.cards = player.cards.filter(card => card !== own).concat(theirs);
    rival.cards = rival.cards.filter(card => card !== theirs).concat(own);
    createCardButtonsForHumanPlayer();
    showMessageToast("Spy (Informants)", "Player " + player.number + " gave " + getCardFullName(own) + " to Player " + rival.number + " and took " + getCardFullName(theirs) + ".");
}

// The Advocate (Fate 4). While it has Guild Overseers: 3 each time it uses the Prelude of a Guild
// card that discards itself, and 2 for each Recover. Guild Overseers: to use actions on Guild
// cards, it must be first or second for a declared ambition

function hasOverseers(player) {
    return hasFate(player, 4) && (player.guildCards || []).includes(205);
}

function advanceAdvocate(player, amount, reason) {
    if (hasOverseers(player)) { advanceObjective(player, amount, reason); }
}

function isPlacedInDeclaredAmbition(player) {
    return declaredAmbitions.some(ambition => getAmbitionPlacePoints(player, ambition, ambitionResources[ambition](player)) >= 1);
}

registerCampaignHook("guildActionsBlocked", player => (player.guildCards || []).includes(205) && !isPlacedInDeclaredAmbition(player) ? true : undefined);

registerCampaignHook("preludeOffers", (player, offers) => {
    // The Advocate: a Guild card's Prelude that discards it advances its objective, so it's a decision
    if (!hasOverseers(player)) { return undefined; }
    return offers.map(offer => offer.discards != null && getCourtCard(offer.discards) != null
        ? { ...offer, decided: true, why: "Its objective advances 3 for a Guild card's Prelude that discards itself." } : offer);
});

registerCampaignHook("guildPreludeUsed", (player, number, discarded) => {
    if (discarded) { advanceAdvocate(player, 3, "Used the Prelude of " + getCourtCard(number).name + ", which discards itself"); }
    return undefined;
});

registerCampaignHook("guildCardButtons", (player, card, body) => {
    // A human player's Recover, so the app can count it
    if (card.number != 204 || !player.isHuman) { return undefined; }
    const use = document.createElement("button");
    use.type = "button";
    use.classList.add("btn", "btn-primary", "w-100", "mb-2");
    use.innerHTML = "I used Recover" + (hasOverseers(player) ? " (objective &minus;2)" : "");
    use.onclick = () => {
        advanceAdvocate(player, 2, "Recover (Guild Investigators)");
        bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
    };
    body.appendChild(use);
    return undefined;
});

function getFateMarketBonus(player, entry) {
    // The Advocate wants Guild cards, for their Preludes
    const card = getCourtCard(entry.number);
    return (hasFate(player, 4) && card != null && card.type == "guild") ? 1 : 0;
}

// The bot's turn window: its Fate

function getFateTurnSection(player) {
    const state = getCampaignPlayer(player);
    const fate = getFate(state.fate);
    const rules = fateRules[state.fate];
    if (fate == null) { return ""; }
    let html = "";
    if (state.objective != null) {
        const start = state.objectiveStart || state.objective;
        const done = start > 0 ? Math.round((start - state.objective) / start * 100) : 100;
        html += "<div class=\"small\">Objective <b>" + state.objective + "</b> to go" + (state.objectiveStart != null ? " (from " + state.objectiveStart + ")" : "")
            + "<div class=\"objbar\"><div style=\"width:" + done + "%\"></div></div>" + (fate.objective != null && campaign.act == 1 ? fate.objective.text : "") + "</div>";
    }
    if (rules == null || !rules.taught) { html += "<div class=\"small text-secondary mt-1\">The bots don't play towards this Fate's objective yet.</div>"; }
    if (hasFate(player, 6)) {
        const seize = campaign.partisanSeize;
        const now = seize != null && seize.player == player.number && seize.round == roundNumber && seize.turn == turnNumber;
        html += "<div class=\"empirenote\">" + (now ? "<b>Seized the initiative</b> by Provoking Outrage of " + preludeResourceNames[seize.resource] + " (Partisan Seizing). "
            : "<b>Partisan Seizing:</b> it seizes the initiative by Provoking Outrage of a resource it doesn't need, never by discarding a second card. ")
            + "Getting the initiative advances its objective.</div>";
    }
    if (hasFate(player, 4)) {
        html += "<div class=\"empirenote\"><b>Guild Overseers:</b> " + (!hasOverseers(player) ? "it no longer has them." : isPlacedInDeclaredAmbition(player)
            ? "it's first or second for a declared ambition, so it can use its Guild card actions. It uses Guild Preludes that discard themselves, and Recovers, to advance its objective."
            : "it isn't first or second for a declared ambition, so it can't use its Guild card actions this turn.") + "</div>";
    }
    if (hasFate(player, 7) && (player.guildCards || []).includes(201)) {
        html += "<div class=\"empirenote\"><b>Imperial Officers:</b> it ignores the Presence and Movement Laws, so it can move and attack with any Imperial ships, even where it has no ships."
            + (isRegent(player) ? " Attacking alongside Imperial ships, each Trophy advances its objective." : "") + "</div>";
    }
    return getTurnSection("Fate: " + fate.name, html);
}

// Panels: the objective's progress and the Fate's other cards

function getFatePanelHtml(player) {
    const state = getCampaignPlayer(player);
    const fate = getFate(state.fate);
    if (fate == null) { return ""; }
    let html = "";
    if (state.objective != null && state.objectiveStart > 0) {
        const done = state.objectiveStart - state.objective;
        html += "<div class=\"mx-3 mb-2 small text-center\">" + fate.name + " objective: <b>" + done + " of " + state.objectiveStart + "</b> done"
            + "<div class=\"objbar\"><div style=\"width:" + Math.round(done / state.objectiveStart * 100) + "%\"></div></div></div>";
    }
    const rules = fateRules[state.fate];
    if (rules != null && (rules.other || []).length > 0 && campaign.act == 1) {
        html += "<div class=\"fatecards\"><span class=\"boardgrouplabel mb-0 me-1\">Fate</span>" + rules.other.map(name => "<span class=\"fatechip\">" + name + "</span>").join("") + "</div>";
    }
    return html;
}

// The Intermission: each Fate's Resolution card

function getResolutionHtml(player) {
    const state = getCampaignPlayer(player);
    const rules = fateRules[state.fate];
    if (rules == null || rules.resolution == null) { return "Follow its Resolution card."; }
    return state.completed ? rules.resolution.completed : rules.resolution.failed;
}

function applyResolutions() {
    players.forEach(player => {
        const state = getCampaignPlayer(player);
        const rules = fateRules[state.fate];
        if (rules == null || rules.resolution == null) { return; }
        // Cards that go back into the Court deck either way (Guild Overseers)
        player.guildCards = player.guildCards.filter(number => !(rules.resolution.lose || []).includes(number));
        if (state.completed) {
            (rules.resolution.gain || []).forEach(number => { if (!player.guildCards.includes(number)) { player.guildCards.push(number); } });
        } else {
            campaign.edicts = (campaign.edicts || []).filter(number => !(rules.resolution.scrapEdicts || []).includes(number));
            if (rules.resolution.failClearsOutrage) { player.outraged = []; }
        }
        showGuildCardsRow(player);
    });
}
