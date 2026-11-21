// Blighted Reach campaign (#85), Phase 3: Fates in play. Each Fate's starting cards go on the panel,
// objectives the app can work out move by themselves, an objectives window follows scoring, and
// each Fate's Resolution card is spelled out in the Intermission. The bots learn each "A" Fate in
// turn: Admiral, Partisan, Advocate, Steward, Founder, Caretaker, Believer, Magnate. The Magnate
// advances in Summit deals (negotiation.js).
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
        { protected: true, code: "F4 03" }),
    new CourtCard(206, "Dealmakers", "guild", "psionics", 0,
        "Bargain (Secure): Choose a Court card that a Rival could secure. They secure it but return the agents they would capture. You influence once for each agent they had on the card, then you secure once.",
        { protected: true, code: "F1 03", replacesActions: [{ name: "Bargain", replaces: "secure" }] }),
    new CourtCard(207, "Parade Fleets", "guild", "fuel", 0,
        "When you declare an ambition, you may place 2 fresh ships at a Free city. Then, if you are a Regent, you may become an Outlaw.",
        { protected: true, code: "F2 02" }),
    new CourtCard(208, "Stone-Speakers", "guild", "materials", 0,
        "When you declare an ambition, you may end your turn: take any Golems from your Rivals, then roll the event die and resolve the Crises if they're rolled (not the Edicts).",
        { protected: true, code: "F5 04" }),
    new CourtCard(209, "Faithful Disciples", "guild", "relics", 0,
        "If you play a Faithful action card and declare an ambition you're winning, gain one more action pip.",
        { protected: true, code: "F8 02" }),
    new CourtCard(210, "Merchant League", "guild", "fuel", 0,
        "Crisis: Discard all resources on this card. When you declare an ambition, you may gain any 2 resources and place them here. They're frozen, except for Transfer Asset in Summits.",
        { protected: true, code: "F3 02", crisis: "Discard all resources on Merchant League." })
];

// Fates the bots aren't dealt yet. None since bots negotiate in Summits (the Magnate, negotiation.js)
const botsNotDealt = [];

// What the app knows of each Fate beyond fates.js:
// cards       - Fate Guild cards gained at setup (on the panel)
// edicts      - Edicts added to the rules booklet at setup, resolved after Govern the Imperial Reach
// other       - other cards and rules it adds, listed on the panel
// resolution  - its Resolution card: { completed, failed, gain (Guild cards), scrapEdicts (on a fail) }
// taught      - the bots play towards its objective
const fateRules = {
    1: { cards: [206], other: ["Imperial Authority"], taught: true, resolution: { completed: "Add Council Intrigue (05), Tax Collectors (06) and Hunter Squads (07) to the Court deck. Add Imperial Protectors (08) to the rules booklet. Scrap Empire Falls (09) and 2 Lesser Regents (10-11).",
        failed: "Scrap Council Intrigue, Tax Collectors, Hunter Squads and Imperial Protectors (05-08). Add Empire Falls (09), 2 Lesser Regents (10-11) and Dealmakers (03) to the Court deck." } },
    2: { cards: [207], taught: true, resolution: { completed: "Gain Book of Liberation (04). Add 3 Political Intrigue (05-07) to the Court deck. Put 2 Construction Union (08-09) and 2 Admin Union (10-11) behind the next Resolution card (23).",
        failed: "Scrap Book of Liberation and 3 Political Intrigue (04-07). Add 2 Construction Union and 2 Admin Union (08-11) to the Court deck." } },
    3: { cards: [210], taught: true, resolution: { completed: "Add Elder Broker (04), Relic Fence (05) and Prison Wardens (06) to the Court deck. Put the 5 Cartels (07-11) behind the next Resolution card (21). If Mining or Shipping Interest is in the Court discard, add it to the Court deck.",
        failed: "Scrap Elder Broker, Relic Fence and Prison Wardens (04-06). Add the 5 Cartels (07-11) to the Court deck." } },
    4: { cards: [204, 205], taught: true,
        resolution: { completed: "Add Guild Overseers (03), the 5 Liaisons (05-09) and Diplomatic Fiasco (10) to the Court deck. Scrap Guild Struggle (11).",
            failed: "Add Guild Overseers to the Court deck. For each Guild suit you have more of than each Rival, add its Liaison; scrap the rest. Scrap Diplomatic Fiasco. Add Guild Struggle to the Court deck.", lose: [205] } },
    5: { cards: [208], other: ["Golem Beacon", "Golem Hearth", "Golems", "Golem Actions"], taught: true, resolution: { completed: "Scrap Golem Beacon. Put all the Golems on the map onto Golem Hearth. Add 1 random lore card for each player and the 4 Unstable cards (08-11) to the Court deck.",
        failed: "Scrap Golem Beacon. Add Stone-Speakers to the Court deck. Scrap the Golems on the map. Add the Unstable cards matching Golems still in play; scrap the rest." } },
    6: { cards: [203], other: ["Partisan Seizing"], taught: true,
        resolution: { completed: "Add the 5 Loyal cards (05-09) to the Court deck. Gain Galactic Bards (10). Scrap Spacing Union (11), Arms Union (12) and 2 Outrage Spreads (13-14).",
            failed: "Scrap the 5 Loyal cards (05-09). Add Galactic Bards, Spacing Union, Arms Union and 2 Outrage Spreads (10-14) to the Court deck. Scrap Partisan Seizing and clear your Outrage.", gain: [25], failClearsOutrage: true } },
    8: { cards: [209], other: ["Spreading the Faith", "Faithful Cards", "Pluralistic Faith"], taught: true,
        resolution: { completed: "Gain The Young Light (16). Add Plot to Kidnap (17) to the Court deck. Scrap Spreading the Faith, The Prodigal One (18) and Secret Order (19). Add the Faithful cards left in your stack to the Court deck.",
            failed: "Scrap Spreading the Faith, The Young Light and Plot to Kidnap. Add The Prodigal One and Secret Order to the Court deck. Add the Faithful cards left in your stack to the Court deck." } },
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
        // The Caretaker shuffles a 4th Event card into the action deck in Act II (events.js)
        if (act == 2 && state.fate == 5) { campaign.extraEvent = true; }
        const rules = fateRules[state.fate];
        if (act != 1 || rules == null) { return; }
        (rules.cards || []).forEach(number => { if (!player.guildCards.includes(number)) { player.guildCards.push(number); } });
        (rules.edicts || []).forEach(number => { if (!campaign.edicts.includes(number)) { campaign.edicts.push(number); } });
        // The Believer's 9 Faithful cards, "9" on top
        if (state.fate == 8) { state.faithfulTop = 9; state.wonThisChapter = 0; }
        showGuildCardsRow(player);
    });
}

function buryOutlawCards(player) {
    // Some Fate cards are buried when their holder becomes an Outlaw (Imperial Officers, and the
    // Steward's Imperial Authority)
    const state = getCampaignPlayer(player);
    if (hasFate(player, 1) && !(state.buried || []).includes("Imperial Authority")) {
        state.buried = (state.buried || []).concat("Imperial Authority");
        showMessageToast("Player " + player.number + " is an Outlaw", "Bury Imperial Authority.");
    }
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
    // The Admiral in Act I: while a Regent and winning an ambition, 1 for each Imperial ship anyone places
    if (campaign.act != 1) { return; }
    players.filter(player => hasFate(player, 7) && isRegent(player) && isWinningAnAmbition(player))
        .forEach(player => advanceObjective(player, count, count + " Imperial ship" + (count == 1 ? "" : "s") + " placed (" + reason + ") while winning an ambition"));
}

registerCampaignHook("afterScoring", carryOn => {
    // What moved this chapter, and what the app needs to be told, then on. Nothing: carry straight on.
    // Acts II and III first count what they can (laterfates.js)
    applyLaterAutoObjectives();
    const moved = players.filter(player => (getCampaignPlayer(player).objectiveLog || []).length > 0);
    chapterQuestions = getChapterQuestions().concat(getLaterChapterQuestions()).map(question => ({ ...question, answer: 0 }));
    if (moved.length == 0 && chapterQuestions.length == 0) { resetChapterCounts(); return undefined; }
    chapterCarryOn = carryOn;
    showChapterObjectives();
    return true;
});

let chapterQuestions = [], chapterCarryOn = null;

function showChapterObjectives() {
    const moved = players.filter(player => (getCampaignPlayer(player).objectiveLog || []).length > 0);
    const rows = moved.map(player => {
        const state = getCampaignPlayer(player);
        const log = state.objectiveLog;
        return "<div class=\"objrow\"><span>Player " + player.number + " &middot; " + getFate(state.fate).name
            + "<small class=\"d-block text-secondary\">" + log.map(entry => entry.reason).join("; ") + "</small></span>"
            + "<span class=\"objdelta\">" + log[0].from + " &rarr; " + log[log.length - 1].to + "</span></div>";
    }).join("");
    const questions = chapterQuestions.map((question, index) => "<div class=\"objrow\"><span>Player " + question.player.number + " &middot; " + getFate(getCampaignPlayer(question.player).fate).name
        + "<small class=\"d-block text-secondary\">" + question.text + "</small></span>"
        + "<span class=\"neutralstep\"><button type=\"button\" onclick=\"stepChapterAnswer(" + index + ", -1)\" aria-label=\"One fewer\"><i class=\"bi bi-dash\"></i></button><b>" + question.answer
        + "</b><button type=\"button\" onclick=\"stepChapterAnswer(" + index + ", 1)\" aria-label=\"One more\"><i class=\"bi bi-plus\"></i></button></span></div>").join("");
    showCampaignWindow("End of chapter " + roundNumber + ": objectives", "<p class=\"mb-2\">The objective markers that moved this chapter" + (questions != "" ? ", and what the app needs to be told" : "") + ". Move them on the Power track to match.</p>"
        + (rows != "" ? "<div class=\"turnsection\"><div class=\"turnlabel\">Worked out by the app</div>" + rows + "</div>" : "")
        + (questions != "" ? "<div class=\"turnsection\"><div class=\"turnlabel\">Tell the app</div>" + questions + "</div>" : "")
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"finishChapterObjectives()\">OK</button>", null, true);
}

function stepChapterAnswer(index, change) {
    const question = chapterQuestions[index];
    question.answer = Math.min(Math.max(question.answer + change, 0), question.max ?? Infinity);
    showChapterObjectives();
}

function finishChapterObjectives() {
    // Grand ambitions are Power; the rest move objectives
    chapterQuestions.forEach(question => {
        if (question.grand) { applyGrandAmbitions(question.player, question.answer); return; }
        advanceObjective(question.player, question.answer * (question.multiplier || 1), question.answer + " " + question.reason);
    });
    chapterQuestions = [];
    resetChapterCounts();
    players.forEach(player => { getCampaignPlayer(player).objectiveLog = []; getCampaignPlayer(player).wonThisChapter = 0; });
    SaveAllSettings();
    closeCampaignWindow();
    const carryOn = chapterCarryOn;
    chapterCarryOn = null;
    whenWindowsClosed(() => setTimeout(carryOn, 0));
}

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
    if (!(campaign.act == 1 && hasFate(attacker, 7) && isRegent(attacker))) { return undefined; }
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
    if (box == null || !box.checked || campaign.act != 1 || !hasFate(attacker, 7) || !isRegent(attacker)) { return undefined; }
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
    if (campaign == null || campaign.act != 1 || !hasFate(player, 6)) { return undefined; }
    advanceObjective(player, 1, "Got the initiative (Sow Division)");
    return undefined;
});

registerCampaignHook("ambitionsScored", results => {
    results.filter(result => campaign.act == 1 && result.place == 1 && !result.player.isNeutral && hasFate(result.player, 6)).forEach(result => {
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
    // In Acts II and III the initiative advances its objective or a grand ambition, so it's keener
    if (cost(resource) > (campaign.act >= 2 ? 2 : 1)) { return false; }
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

// With the Act II and III Fates' own actions (fateactions.js)
registerCampaignHook("guildActionOffers", (player, wants, can) => getSpyOffers(player, wants, can).concat(getRecoverOffers(player, wants, can), getBargainOffers(player, wants, can), getAwakenOffers(player, wants, can), getTeachOffers(player, wants, can),
    getFateActionOffers(player, wants, can)));

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
    if (offer.teach) {
        const state = getCampaignPlayer(player);
        state.faithfulTop = Math.max((state.faithfulTop || 0) - 1, 0);
        showCampaignPanel(player);
    }
    if (offer.golem) {
        const state = getCampaignPlayer(player);
        state.golems = Math.max((state.golems || 0) - 1, 0);
        if (campaign.act == 1) { advanceObjective(player, 2, "Spent a Golem in its Prelude (Use the Golems)"); }
    }
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
    if (campaign.act == 1 && hasOverseers(player)) { advanceObjective(player, amount, reason); }
}

function isPlacedInDeclaredAmbition(player) {
    return declaredAmbitions.some(ambition => getAmbitionPlacePoints(player, ambition, ambitionResources[ambition](player)) >= 1);
}

registerCampaignHook("guildActionsBlocked", player => (player.guildCards || []).includes(205) && !isPlacedInDeclaredAmbition(player) ? true : undefined);

registerCampaignHook("preludeOffers", (player, offers) => {
    // The Advocate: a Guild card's Prelude that discards it advances its objective, so it's a
    // decision. The Caretaker spends its Golems
    const marked = !hasOverseers(player) ? offers : offers.map(offer => offer.discards != null && getCourtCard(offer.discards) != null
        ? { ...offer, decided: true, why: "Its objective advances 3 for a Guild card's Prelude that discards itself." } : offer);
    return marked.concat(getGolemPreludeOffers(player), getFatePreludeOffers(player));
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

// The Steward (Fate 1). Consolidate Your Imperial Power: each time it wins an ambition while First
// Regent, 1 for each Power gained from it (including bonus city Power). Imperial Authority: it may
// tax any Empire-controlled cities as if Loyal. Dealmakers: Bargain instead of a Secure

registerCampaignHook("ambitionsScored", results => {
    results.filter(result => campaign.act == 1 && result.place == 1 && !result.player.isNeutral && hasFate(result.player, 1) && isFirstRegent(result.player) && result.points > 0)
        .forEach(result => advanceObjective(result.player, result.points, "Won " + capitalise(result.ambition) + " as First Regent: " + result.points + " Power"));
    return undefined;
});

// The Founder (Fate 2). Inspire Confidence in the Cause: while an Outlaw, 3 for each ambition it
// wins. Defy the Empire's Grip: at the end of a chapter, if an Outlaw, 1 for each system it
// controls (asked in the objectives window). Parade Fleets: when it declares an ambition, it may
// place 2 fresh ships at a Free city, then a Regent may become an Outlaw

registerCampaignHook("ambitionsScored", results => {
    results.filter(result => campaign.act == 1 && result.place == 1 && !result.player.isNeutral && hasFate(result.player, 2) && !isRegent(result.player))
        .forEach(result => advanceObjective(result.player, 3, "Won " + capitalise(result.ambition) + " as an Outlaw (Inspire Confidence)"));
    return undefined;
});

registerCampaignHook("ambitionDeclared", player => {
    if (!(player.guildCards || []).includes(207)) { return undefined; }
    if (player.isHuman) {
        showMessageToast("Parade Fleets", "You may place 2 fresh ships at a Free city" + (isRegent(player) ? ", then become an Outlaw (tap Regent on your panel)." : "."));
        return undefined;
    }
    // A bot Founder does both: its objective needs it to be an Outlaw
    adjustCounter(player, "shipsBoard", 2);
    const leaving = isRegent(player);
    if (leaving) { applyTitle(player.number, "outlaw"); }
    showMessageToast("Player " + player.number + ": Parade Fleets", "Places 2 fresh ships at a Free city" + (leaving ? ", and becomes an Outlaw." : "."));
    return undefined;
});

function getChapterQuestions() {
    // What the objectives window asks at the end of a chapter in Act I: the Founder's systems as an
    // Outlaw, the Golems other players spent for the Caretaker, the Believer's pips
    if (campaign.act != 1) { return []; }
    const founders = players.filter(player => hasFate(player, 2) && !isRegent(player) && getCampaignPlayer(player).objective > 0)
        .map(player => ({ player: player, text: "An Outlaw: how many systems does it control?", reason: "systems controlled as an Outlaw (Defy the Empire's Grip)" }));
    const caretakers = players.filter(player => hasFate(player, 5) && getCampaignPlayer(player).objective > 0)
        .map(player => ({ player: player, text: "How many Golems did other players spend in their Preludes this chapter?" + (player.isHuman ? " (Count your own too.)" : " (The app counted its own.)"),
            reason: "Golems spent in Preludes (Use the Golems)", multiplier: 2, othersOnly: !player.isHuman }));
    const believers = players.filter(player => hasFate(player, 8) && getCampaignPlayer(player).objective > 0 && (getCampaignPlayer(player).wonThisChapter || 0) > 0 && getCampaignPlayer(player).faithfulTop > 0)
        .map(player => {
            const state = getCampaignPlayer(player);
            return { player: player, text: "It won " + state.wonThisChapter + " ambition" + (state.wonThisChapter == 1 ? "" : "s") + ": how many action pips are on the top card of its Faithful stack (the " + state.faithfulTop + ")?",
                reason: "action pips on its top Faithful card, for each ambition won (Spread the Good Word)", multiplier: state.wonThisChapter, believer: true };
        });
    return founders.concat(caretakers, believers);
}

// The Believer (Fate 8). Spread the Good Word: for each ambition it wins, 1 for each action pip on
// the top card of its Faithful stack, or 10 if the stack is empty. Spreading the Faith: Teach
// instead of an Influence, taking the top card of the stack. Its stack's top card is on its panel

registerCampaignHook("ambitionsScored", results => {
    results.filter(result => campaign.act == 1 && result.place == 1 && !result.player.isNeutral && hasFate(result.player, 8)).forEach(result => {
        const state = getCampaignPlayer(result.player);
        if ((state.faithfulTop || 0) == 0) { advanceObjective(result.player, 10, "Won " + capitalise(result.ambition) + " with its Faithful stack empty"); }
        else { state.wonThisChapter = (state.wonThisChapter || 0) + 1; }
    });
    return undefined;
});

function getTeachOffers(player, wants, can) {
    // Teach: the top Faithful card goes to a Guild card in the Court matching a planet where it has a
    // city. A lower card on top means more pips for its objective
    const state = hasFate(player, 8) ? getCampaignPlayer(player) : null;
    if (state == null || !(state.faithfulTop > 0) || !can("influence") || getCityCount(player) == 0) { return []; }
    return [{ label: "Teach instead of an Influence (Spreading the Faith)", text: "attach the top Faithful card (the " + state.faithfulTop + ") from its stack to a Guild card in the Court whose suit matches a planet with its city. If it does, scrap the bottom non-Event card of the action discard",
        teach: true, decided: true, why: "Each card taught leaves a lower Faithful card on top, with more action pips for its objective." }];
}

// The Caretaker (Fate 5). Find the Golems: for each ambition it wins, 2 for each Golem it has. Use
// the Golems: 2 each time any player spends a Golem in their Prelude. Golem Beacon: Awaken instead
// of an Influence. Its Golems are counted on its panel

registerCampaignHook("ambitionsScored", results => {
    results.filter(result => campaign.act == 1 && result.place == 1 && !result.player.isNeutral && hasFate(result.player, 5)).forEach(result => {
        const golems = getCampaignPlayer(result.player).golems || 0;
        advanceObjective(result.player, golems * 2, "Won " + capitalise(result.ambition) + " with " + golems + " Golem" + (golems == 1 ? "" : "s") + " (Find the Golems)");
    });
    return undefined;
});

function getGolemPreludeOffers(player) {
    // A bot Caretaker spends its Golems in its prelude: each one advances its objective
    const golems = hasFate(player, 5) ? (getCampaignPlayer(player).golems || 0) : 0;
    // In Act III it keeps its last Golem, for its grand ambition (steering.js)
    if (golems <= (campaign.act == 3 ? 1 : 0)) { return []; }
    return [{ label: "Spend a Golem", text: "spend an Awake Golem for its action (Warrior: destroy all damaged ships in a system; Protector: repair ships; Seeker: Catapult from a system; Harvester: gain any resource). Then it goes Sleeping into a Rival's empty resource slot",
        golem: true, decided: true, why: "Each Golem spent advances its objective 2." }];
}

function getAwakenOffers(player, wants, can) {
    // Awaken (Golem Beacon): take its Golems from the map. The player says how many on its panel
    if (!hasFate(player, 5) || campaign.act != 1 || !can("influence")) { return []; }
    return [{ label: "Awaken instead of an Influence (Golem Beacon)", text: "take the Golems it controls on the map onto Golem Hearth (Awake if it's winning a declared ambition). Add them to its Golems on its panel" }];
}

function getBargainOffers(player, wants, can) {
    // Bargain (Dealmakers): when a Rival could secure a card in the Court, the Steward takes over
    // their agents' worth of influence and then secures it. The player checks the Court
    if (!(player.guildCards || []).includes(206) || !can("secure")) { return []; }
    const rivalCanSecure = isMarketKnown() ? courtMarket.filter(entry => !isMarketCardClosed(entry) && players.some(other => other !== player && canSecureEntry(entry, other))) : [];
    if (isMarketKnown() && rivalCanSecure.length == 0) { return []; }
    const entry = rivalCanSecure[0];
    return [{ label: "Bargain instead of a Secure (Dealmakers)", text: entry != null
        ? "choose " + getCourtCard(entry.number).name + ": the Rival secures it without capturing; it influences once for each of their agents there, then secures once"
        : "choose a Court card a Rival could secure: they secure it without capturing; it influences once for each of their agents there, then secures once",
        decided: entry != null, why: entry != null ? "A Rival could secure " + getCourtCard(entry.number).name + "." : null }];
}

function getFateMarketBonus(player, entry) {
    // The Advocate wants Guild cards, for their Preludes. In Acts II and III, what its Fate steers
    // it towards (steering.js)
    const card = getCourtCard(entry.number);
    const steer = getSteerMarketBonus(player, entry);
    return ((hasFate(player, 4) && card != null && card.type == "guild") ? 1 : 0) + (steer != null ? steer.value : 0);
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
            + "<div class=\"objbar\"><div style=\"width:" + done + "%\"></div></div>" + getFateObjectiveText(fate, campaign.act) + "</div>";
    } else if (campaign.act == 3) {
        // Act III "A" and "B" Fates: grand ambitions, asked about at the end of each chapter
        html += "<div class=\"small\">" + getFateObjectiveText(fate, 3) + "</div>";
    }
    // In Acts II and III: what its Fate steers it towards (steering.js), where the bots have learned it
    const steering = getSteerHtml(player);
    if (steering != "") { html += steering; }
    else if (rules == null || !rules.taught || campaign.act > 1) { html += "<div class=\"small text-secondary mt-1\">The bots don't play towards this Fate's " + (campaign.act == 3 && state.objective == null ? "grand ambitions" : "objective") + " yet.</div>"; }
    if (hasFate(player, 6)) {
        const seize = campaign.partisanSeize;
        const now = seize != null && seize.player == player.number && seize.round == roundNumber && seize.turn == turnNumber;
        html += "<div class=\"empirenote\">" + (now ? "<b>Seized the initiative</b> by Provoking Outrage of " + preludeResourceNames[seize.resource] + " (Partisan Seizing). "
            : "<b>Partisan Seizing:</b> it seizes the initiative by Provoking Outrage of a resource it doesn't need, never by discarding a second card. ")
            + "Getting the initiative advances its objective.</div>";
    }
    if (hasFate(player, 1)) {
        html += "<div class=\"empirenote\">" + (isFirstRegent(player) ? "<b>First Regent:</b> each ambition it wins now advances its objective by the Power it gains."
            : "<b>Not First Regent:</b> it wants the Imperial Council, to become First Regent and advance its objective with ambitions it wins.")
            + ((getCampaignPlayer(player).buried || []).includes("Imperial Authority") ? "" : " <b>Imperial Authority:</b> it may tax any Empire-controlled city as if it were its own, ignoring the Presence and Truce Laws (no Captives).") + "</div>";
    }
    if (hasFate(player, 8)) {
        const top = getCampaignPlayer(player).faithfulTop || 0;
        html += "<div class=\"empirenote\"><b>Faithful stack:</b> " + (top > 0 ? "the " + top + " is on top. Each ambition it wins advances its objective by that card's action pips, so it Teaches to bring a lower card to the top."
            : "it's empty: each ambition it wins advances its objective 10.") + "</div>";
    }
    if (hasFate(player, 5)) {
        const golems = getCampaignPlayer(player).golems || 0;
        html += "<div class=\"empirenote\"><b>Golems:</b> it has " + golems + ". Each ambition it wins advances its objective 2 for each Golem, and each Golem anyone spends in a Prelude advances it 2. "
            + "It Awakens Golems it controls on the map (Golem Beacon), and spends them in its Prelude.</div>";
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
        html += "<div class=\"mx-3 mb-2 small text-center\">" + fate.name + (campaign.act == 3 ? " final objective" : " objective") + ": <b>" + done + " of " + state.objectiveStart + "</b> done"
            + "<div class=\"objbar\"><div style=\"width:" + Math.round(done / state.objectiveStart * 100) + "%\"></div></div></div>";
    } else if (campaign.act == 3 && getLaterFate(state.fate, 3) != null && getLaterFate(state.fate, 3).grand != null) {
        html += "<div class=\"mx-3 mb-2 small text-center\">Grand ambitions: <b>" + getLaterFate(state.fate, 3).grand + "</b></div>";
    }
    const rules = fateRules[state.fate];
    // The Believer's Faithful stack: the number of the card on top (0 when it's empty)
    if (hasFate(player, 8)) {
        html += "<div class=\"favors\"><span class=\"lbl\">Faithful stack: top card</span><span class=\"favorstep\"><button type=\"button\" onclick=\"stepCampaign('faithful', " + player.number + ", -1)\" aria-label=\"One card fewer\"><i class=\"bi bi-dash\"></i></button>"
            + "<b>" + (state.faithfulTop || 0) + "</b><button type=\"button\" onclick=\"stepCampaign('faithful', " + player.number + ", 1)\" aria-label=\"One card more\"><i class=\"bi bi-plus\"></i></button></span></div>";
    }
    // The Caretaker's Golems
    if (hasFate(player, 5)) {
        html += "<div class=\"favors\"><span class=\"lbl\">Golems</span><span class=\"favorstep\"><button type=\"button\" onclick=\"stepCampaign('golems', " + player.number + ", -1)\" aria-label=\"One Golem fewer\"><i class=\"bi bi-dash\"></i></button>"
            + "<b>" + (state.golems || 0) + "</b><button type=\"button\" onclick=\"stepCampaign('golems', " + player.number + ", 1)\" aria-label=\"One Golem more\"><i class=\"bi bi-plus\"></i></button></span></div>";
    }
    // Merchant League's frozen resources, for Summit deals (negotiation.js)
    html += getLeagueHtml(player);
    // A bot Conspirator's face-down Conspiracies, to foil (grand.js)
    html += getConspiracyPanelHtml(player);
    const other = (rules == null || campaign.act != 1) ? [] : (rules.other || []).filter(name => !(state.buried || []).includes(name));
    if (other.length > 0) {
        html += "<div class=\"fatecards\"><span class=\"boardgrouplabel mb-0 me-1\">Fate</span>" + other.map(name => "<span class=\"fatechip\">" + name + "</span>").join("") + "</div>";
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
