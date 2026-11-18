// Blighted Reach campaign (#85): the end of a round with an event (rulebook p.12-21). If the
// Imperial Council was secured, its holder resolves it: maybe a Summit, then becoming First Regent
// (or, as an Outlaw, stealing from the Imperial Trust), then Crises or Edicts by choice. Otherwise,
// if an Event card was played, the player with the initiative may call a Summit, then rolls the
// event and number dice: Crises or Edicts. Then the round is scored as usual.
// Bots don't call Summits or negotiate yet (#85, to improve later).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The event being resolved: { kind: "council" or "event", player, carryOn, dice, choice }
let roundEvent = null;

registerCampaignHook("beforeScoring", carryOn => {
    ensureCouncilInCourt();
    const securer = (campaign.councilSecuredBy != null) ? getPlayer(campaign.councilSecuredBy) : null;
    if (securer == null && getEventsPlayedThisRound().length == 0) { return undefined; }
    // The Council comes first, and the Event cards are then ignored (rulebook p.14)
    roundEvent = { kind: securer != null ? "council" : "event", player: securer || getPlayerWithInitiative(), carryOn: carryOn, dice: null };
    askForSummit();
    return true;
});

function finishRoundEvent() {
    const carryOn = roundEvent.carryOn;
    roundEvent = null;
    campaign.councilSecuredBy = null;
    campaign.councilSecuredAt = null;
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    closeCampaignWindow();
    whenWindowsClosed(carryOn);
}

function getRoundEventTitle() {
    return roundEvent.kind == "council" ? "End of chapter " + roundNumber + ": the Imperial Council" : "End of chapter " + roundNumber + ": Event";
}

function getRoundEventIntro() {
    const player = roundEvent.player;
    if (roundEvent.kind == "council") {
        return "<p class=\"mb-2\">Player " + player.number + " secured the Imperial Council. Put it back in the Court, Decided side up."
            + (getEventsPlayedThisRound().length > 0 ? " The Event cards played this round are ignored." : "") + "</p>";
    }
    return "<p class=\"mb-2\">An Event card was played this round, and no one secured the Imperial Council. Player " + player.number + " has the initiative.</p>";
}

// The Summit (rulebook p.16-17)

function askForSummit() {
    const player = roundEvent.player;
    if (!player.isHuman) {
        // Bots don't call Summits yet
        roundEvent.summitNote = "Player " + player.number + " (bot) doesn't call a Summit.";
        afterSummit();
        return;
    }
    showCampaignWindow(getRoundEventTitle(), getRoundEventIntro()
        + "<div class=\"turnsection\"><div class=\"turnlabel\">" + (isYou(player) ? "You" : "Player " + player.number) + " may call a Summit</div>"
        + "<div class=\"brseg\"><button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"showSummit()\">Call a Summit<small>Call to Order, then deals</small></button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"afterSummit()\">No Summit<small>Carry on</small></button></div></div>", player, true);
}

function showSummit() {
    const player = roundEvent.player;
    const state = getCampaignPlayer(player);
    const noRegents = !players.some(other => getCampaignPlayer(other).title == "regent");
    const button = (label, note, action) => "<button type=\"button\" class=\"btn btn-outline-secondary w-100 mb-2 text-start summitaction\" onclick=\"" + action + "\"><b>" + label + "</b><small>" + note + "</small></button>";
    let actions = "";
    if (isCouncilDecided()) { actions += button("Petition the Council", "Flip the Imperial Council to In Session.", "petitionCouncil()"); }
    if (state.title == "regent") { actions += button("Leave the Empire", "Become an Outlaw." + (isFirstRegent(player) ? " The First Regent tile goes to the Regent with the most Power." : ""), "leaveEmpire(" + player.number + "); showSummit()"); }
    if (state.title == "outlaw" && noRegents) { actions += button("Revive the Empire", "There are no Regents: become a Regent and take the First Regent tile.", "reviveEmpire(" + player.number + "); showSummit()"); }
    setCampaignWindow("Summit: Player " + player.number + " calls it to order",
        "<div class=\"turnsection\"><div class=\"turnlabel\">Call to Order</div>"
        + "<p class=\"small mb-2\"><b>Return Favors:</b> give a Rival's agents on your Fate card back to them to force them to take Negotiation actions you choose, targeting you (1 Favor each; giving a resource costs its raid cost). Change the Favors on the panels. A bot does what you force it to.</p>"
        + actions + (actions == "" ? "<p class=\"small text-secondary\">Nothing else to do in the Call to Order.</p>" : "")
        + "<p class=\"small mb-0\">Player " + player.number + " is " + (getCampaignPlayer(player).title == "regent" ? "a Regent" : "an Outlaw") + (isFirstRegent(player) ? " and the First Regent" : "") + ". The Council is " + (isCouncilDecided() ? "Decided" : "In Session") + ".</p></div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">Negotiations</div><p class=\"small mb-0\">Human players may now make deals with each other: Cede Control, Delegate Authority, Promise Favor, Transfer Asset and, for the First Regent, Invite to Empire. Bots don't negotiate yet. Change the panels to match.</p></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"endSummit()\">End the Summit</button>", player);
}

function endSummit() {
    roundEvent.summitNote = "Player " + roundEvent.player.number + " called a Summit.";
    afterSummit();
}

function petitionCouncil() {
    setCouncilInSession();
    SaveAllSettings();
    showMessageToast("Summit", "The Imperial Council is In Session again.");
    showSummit();
}

function leaveEmpire(playerNumber) {
    // An Outlaw can't be First Regent: the tile goes to the Regent with the most Power. With no
    // Regents left, the Trust goes back to the supply, the old First Regent loses 1 Power for each,
    // and the tile goes to the supply (rulebook p.16)
    const player = getPlayer(playerNumber);
    getCampaignPlayer(player).title = "outlaw";
    buryOutlawCards(player);
    if (isFirstRegent(player)) {
        const regents = players.filter(other => getCampaignPlayer(other).title == "regent").sort((a, b) => b.powerValue - a.powerValue);
        if (regents.length > 0) {
            campaign.firstRegent = regents[0].number;
        } else {
            const returned = trustResources.reduce((total, resource) => total + campaign.trust[resource], 0);
            trustResources.forEach(resource => { campaign.trust[resource] = 0; });
            setPlayerPower(player, player.powerValue - returned);
            campaign.firstRegent = null;
        }
    }
    players.forEach(showCampaignPanel);
    SaveAllSettings();
}

function reviveEmpire(playerNumber) {
    campaign.players[playerNumber].title = "regent";
    campaign.firstRegent = playerNumber;
    players.forEach(showCampaignPanel);
    SaveAllSettings();
}

function afterSummit() {
    if (roundEvent.kind == "council") { councilTitleStep(); } else { rollEvent(); }
}

// The Imperial Council's holder: First Regent, or stealing from the Trust (rulebook p.14)

function councilTitleStep() {
    const player = roundEvent.player;
    if (getCampaignPlayer(player).title == "regent") {
        campaign.firstRegent = player.number;
        players.forEach(showCampaignPanel);
        SaveAllSettings();
        roundEvent.titleNote = "Player " + player.number + " is a Regent, so becomes First Regent. Pass them the First Regent tile; the Imperial Trust stays on it.";
        chooseCrisesOrEdicts();
        return;
    }
    // An Outlaw steals up to their empty resource slots
    const slots = getEmptySlots(player);
    const firstRegent = campaign.firstRegent != null ? getPlayer(campaign.firstRegent) : null;
    const trustTotal = trustResources.reduce((total, resource) => total + campaign.trust[resource], 0);
    if (firstRegent == null || slots == 0 || trustTotal == 0) {
        roundEvent.titleNote = "Player " + player.number + " is an Outlaw, but there's nothing to steal from the Imperial Trust" + (slots == 0 && trustTotal > 0 ? " (no empty resource slots)" : "") + ".";
        chooseCrisesOrEdicts();
        return;
    }
    roundEvent.steal = {};
    trustResources.forEach(resource => { roundEvent.steal[resource] = 0; });
    if (!player.isHuman) {
        // A bot takes what it needs most, then whatever is there
        let left = slots;
        trustResources.slice().sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a)).forEach(resource => {
            const take = Math.min(left, campaign.trust[resource]);
            roundEvent.steal[resource] = take;
            left -= take;
        });
        applySteal();
        return;
    }
    showSteal();
}

function showSteal() {
    const player = roundEvent.player;
    const slots = getEmptySlots(player);
    const taken = trustResources.reduce((total, resource) => total + roundEvent.steal[resource], 0);
    setCampaignWindow(getRoundEventTitle(), "<p class=\"mb-2\">Player " + player.number + " is an Outlaw: steal from the Imperial Trust, up to " + slots + " (empty resource slots). The First Regent, Player " + campaign.firstRegent + ", loses 1 Power for each.</p>"
        + "<div class=\"neutralsteps mb-2\">" + trustResources.filter(resource => campaign.trust[resource] > 0).map(resource => "<span class=\"neutralstep\"><span>" + getGameIcon(resource) + " " + preludeResourceNames[resource] + " (" + campaign.trust[resource] + ")</span>"
            + "<button type=\"button\" onclick=\"stepSteal('" + resource + "', -1)\" aria-label=\"One fewer\"><i class=\"bi bi-dash\"></i></button><b>" + roundEvent.steal[resource] + "</b>"
            + "<button type=\"button\" onclick=\"stepSteal('" + resource + "', 1)\" aria-label=\"One more\"><i class=\"bi bi-plus\"></i></button></span>").join("") + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"applySteal()\">Steal " + taken + "</button>", player);
}

function stepSteal(resource, change) {
    const slots = getEmptySlots(roundEvent.player);
    const taken = trustResources.reduce((total, other) => total + roundEvent.steal[other], 0);
    if (change > 0 && taken >= slots) { return; }
    roundEvent.steal[resource] = Math.min(Math.max(roundEvent.steal[resource] + change, 0), campaign.trust[resource]);
    showSteal();
}

function applySteal() {
    const player = roundEvent.player;
    const firstRegent = getPlayer(campaign.firstRegent);
    let total = 0;
    const taken = [];
    trustResources.forEach(resource => {
        const count = roundEvent.steal[resource];
        if (count == 0) { return; }
        campaign.trust[resource] -= count;
        adjustCounter(player, resource, count);
        total += count;
        taken.push(count + " " + preludeResourceNames[resource]);
    });
    setPlayerPower(firstRegent, firstRegent.powerValue - total);
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    const wanted = player.isHuman ? null : trustResources.filter(resource => roundEvent.steal[resource] > 0 && getResourceNeed(player, resource) == 2).map(resource => preludeResourceNames[resource]);
    roundEvent.titleNote = "Player " + player.number + " is an Outlaw and stole " + (taken.length > 0 ? taken.join(", ") : "nothing") + " from the Imperial Trust"
        + (wanted != null && wanted.length > 0 ? " (it's chasing the ambition for " + wanted.join(" and ") + ")" : "") + ". Player " + firstRegent.number + ", the First Regent, loses " + total + " Power.";
    chooseCrisesOrEdicts();
}

function chooseCrisesOrEdicts() {
    const player = roundEvent.player;
    if (!player.isHuman) {
        // A bot that's First Regent governs; an Outlaw pays nothing to the Empire, so lets the Crises hit its Rivals
        roundEvent.choice = isFirstRegent(player) ? "edicts" : "crises";
        roundEvent.choiceNote = "Player " + player.number + " (bot) chooses " + (roundEvent.choice == "edicts"
            ? "the <b>Edicts</b>: as First Regent, it governs the Empire."
            : "the <b>Crises</b>: " + (isRegent(player) ? "it isn't First Regent, so the Edicts would only take from it." : "as an Outlaw it pays nothing to the Empire, and the Crises hit everyone."));
        showCouncilSummary();
        return;
    }
    const steps = [roundEvent.summitNote, roundEvent.titleNote].filter(note => note != null).map(note => "<div class=\"setstep\"><span class=\"setnum\">&#10003;</span><span>" + note + "</span></div>").join("");
    showCampaignWindow(getRoundEventTitle(), getRoundEventIntro() + "<div class=\"turnsection\">" + steps + "</div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">Player " + player.number + " chooses</div><div class=\"brseg\">"
        + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"roundEvent.choice = 'crises'; startCrises()\">Crises<small>Blight, Fates, Court</small></button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"roundEvent.choice = 'edicts'; startEdicts()\">Edicts<small>The First Regent governs</small></button></div></div>", player, true);
}

function showCouncilSummary() {
    // A bot resolving the Council: what it did, then on to its choice
    const player = roundEvent.player;
    const steps = [roundEvent.summitNote, roundEvent.titleNote, roundEvent.choiceNote].map(note => "<div class=\"setstep\"><span class=\"setnum\">&#10003;</span><span>" + note + "</span></div>").join("");
    showCampaignWindow(getRoundEventTitle(), getRoundEventIntro() + "<div class=\"turnsection\">" + steps + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"" + (roundEvent.choice == "edicts" ? "startEdicts()" : "startCrises()") + "\">OK: resolve the " + (roundEvent.choice == "edicts" ? "Edicts" : "Crises") + "</button>", player, true);
}

// The event and number dice (rulebook p.13, p.18). Each face of the event die has the Crisis or
// Edict symbol and a planet symbol

function rollEventDice() {
    return { crisis: Math.random() < 0.5, symbol: rollPlanetSymbol(), cluster: rollNumberDie() };
}

function getDiceHtml(dice) {
    return "<span class=\"die\">" + (dice.crisis ? "<i class=\"bi bi-asterisk\"></i>" : "<i class=\"bi bi-file-earmark-text\"></i>") + "&nbsp;" + planetSymbols[dice.symbol] + "</span><span class=\"die\">" + dice.cluster + "</span>";
}

function rollEvent() {
    const player = roundEvent.player;
    roundEvent.dice = rollEventDice();
    roundEvent.choice = roundEvent.dice.crisis ? "crises" : "edicts";
    SaveAllSettings();
    const note = roundEvent.summitNote != null ? "<p class=\"small mb-2\">" + roundEvent.summitNote + "</p>" : "";
    showCampaignWindow(getRoundEventTitle(), getRoundEventIntro() + note
        + "<div class=\"turnsection\"><div class=\"turnlabel\">The app rolled</div><div class=\"mb-1\">" + getDiceHtml(roundEvent.dice) + "</div>"
        + "<div><b>" + (roundEvent.dice.crisis ? "Crises." : "Edicts.") + "</b>" + (roundEvent.dice.crisis ? " Rolled cluster " + roundEvent.dice.cluster + ", rolled symbol " + planetSymbols[roundEvent.dice.symbol] + "." : "") + "</div></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"" + (roundEvent.dice.crisis ? "startCrises()" : "startEdicts()") + "\">Resolve the " + (roundEvent.dice.crisis ? "Crises" : "Edicts") + "</button>", player, true);
}

// Crises (rulebook p.18): the Blight, then Fate cards, then the Court's Vox cards left to right

function startCrises() {
    // The Court Crises use the dice: rolled now, unless just rolled for an Event card
    if (roundEvent.dice == null) { roundEvent.dice = rollEventDice(); }
    const dice = roundEvent.dice;
    const step = (text, note) => "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"><span>" + text + (note ? "<small>" + note + "</small>" : "") + "</span></label>";
    const vox = courtMarket.map(entry => getCourtCard(entry.number)).filter(card => card != null && card.crisis != null);
    const fillDice = text => text.replace(/the rolled cluster/g, "cluster " + dice.cluster).replace(/the rolled symbol/g, "the rolled symbol (" + planetSymbols[dice.symbol] + ")");
    showCampaignWindow("Crises", "<p class=\"mb-2\">Resolve these in order on the table and tick each one. Dice: " + getDiceHtml(dice) + "</p>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">1 &middot; Blight Crises</div>"
        + step("In every system with Blight: each fresh Blight deals 3 hits, each damaged Blight 1 hit", "Imperial ships take hits first, then the Loyal ships of every player there, fresh before damaged. (A Flagship only once no other fresh Loyal ships remain.)") + "</div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">2 &middot; Fate Crises</div>"
        + step("Any cards with Crisis text that players hold, in turn order", "From their Fates.") + "</div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">3 &middot; Court Crises, left to right</div>"
        + (vox.length > 0 ? vox.map(card => step(card.name, fillDice(card.crisis))).join("") : "<p class=\"small mb-0\">No Vox cards in the Court (that the app knows of).</p>")
        + "<p class=\"small text-secondary mt-1 mb-0\">A card that leaves the Court returns its agents, and the Court is refilled.</p></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"finishCrises()\">Done: on to scoring</button>", roundEvent.player, true);
}

function finishCrises() {
    // The Court's Vox cards that leave after their Crisis. Council Intrigue's agents go onto the Council
    // (Populist Demands and Song of Freedom stay)
    const leaving = [102, 103, 105];
    const council = getCouncilEntry();
    const intrigue = courtMarket.find(entry => entry.number == 102);
    if (intrigue != null && council != null) {
        setCouncilInSession();
        Object.entries(intrigue.agents).forEach(([number, count]) => { council.agents[number] = (council.agents[number] || 0) + count; });
        intrigue.agents = {};
    }
    const gone = courtMarket.filter(entry => leaving.includes(entry.number)).map(entry => getCourtCard(entry.number).name);
    courtMarket = courtMarket.filter(entry => !leaving.includes(entry.number));
    if (gone.length > 0) { showMessageToast("Crises", gone.join(", ") + " left the Court. Add the replacements in the Court window."); }
    finishRoundEvent();
}

// Edicts (rulebook p.20-21), lowest number first: Guild Envoys Depart (2 players), then Govern the
// Imperial Reach

function startEdicts() {
    roundEvent.edictStep = players.length == 2 ? "envoys" : "govern";
    showEdicts();
}

function showEdicts() {
    if (roundEvent.edictStep == "envoys") { showGuildEnvoys(); return; }
    showGovern();
}

function showGuildEnvoys() {
    const bare = courtMarket.filter(entry => getCourtCard(entry.number).type == "guild" && Object.values(entry.agents).every(count => count == 0));
    showCampaignWindow("Edicts", "<div class=\"turnsection\"><div class=\"turnlabel\">00 &middot; Guild Envoys Depart</div>"
        + "<p class=\"mb-1\">Bury all Guild cards in the Court with no agents on them, then refill the Court.</p>"
        + "<p class=\"small mb-0\">" + (isMarketKnown() ? (bare.length > 0 ? "That's " + bare.map(entry => getCourtCard(entry.number).name).join(", ") + "." : "There are none.") : "") + "</p></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"applyGuildEnvoys()\">Done: next Edict</button>", roundEvent.player, true);
}

function applyGuildEnvoys() {
    const before = courtMarket.length;
    courtMarket = courtMarket.filter(entry => !(getCourtCard(entry.number).type == "guild" && Object.values(entry.agents).every(count => count == 0)));
    if (courtMarket.length < before) { showMessageToast("Edicts", "Add the replacements in the Court window."); }
    roundEvent.edictStep = "govern";
    SaveAllSettings();
    showEdicts();
}

const policyDemands = {
    peace: { resources: ["relics", "psionics"], fromSelf: true, words: "1 Relic or Psionic from each Regent, even the First Regent" },
    escalation: { resources: ["materials", "fuel", "weapons"], fromSelf: true, words: "1 Material, Fuel or Weapon from each Regent, even the First Regent" },
    war: { resources: ["trophies", "captives"], fromSelf: false, words: "1 Trophy or Captive (not Imperial or Regent pieces) from each Rival Regent" }
};
const policyActions = {
    peace: "Celebrate Regency: each Regent gains the bonus city Power shown on all uncovered city slots on their player board.",
    escalation: "Requisition Ships: place 2 fresh Imperial ships in an Empire-controlled system (if none, at a Loyal starport).",
    war: "Distribute Arms: give 1 Weapon to each Regent from the supply (if it's empty, from the Imperial Trust)."
};

function getDemandWord(kind) {
    return { trophies: "Trophy", captives: "Captive" }[kind] || preludeResourceNames[kind];
}

function getDemandPlan(policy = campaign.policy) {
    // Who pays what. The First Regent takes the kind the payer has most of
    const firstRegent = getPlayer(campaign.firstRegent);
    const demand = policyDemands[policy];
    return players.filter(player => getCampaignPlayer(player).title == "regent" && (demand.fromSelf || player !== firstRegent)).map(player => {
        const kind = demand.resources.slice().sort((a, b) => player[b + "Value"] - player[a + "Value"])[0];
        if (player[kind + "Value"] > 0) { return { player: player, kind: kind }; }
        if (player === firstRegent) { return { player: player, kind: null }; }
        return { player: player, kind: null, favor: true };
    });
}

function showGovern() {
    const firstRegent = campaign.firstRegent != null ? getPlayer(campaign.firstRegent) : null;
    if (firstRegent == null) {
        showCampaignWindow("Edicts", "<div class=\"turnsection\"><div class=\"turnlabel\">03 &middot; Govern the Imperial Reach</div><p class=\"mb-0\">There's no First Regent, so no one governs.</p></div>"
            + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"afterGovern()\">Next</button>", null, true);
        return;
    }
    const demand = policyDemands[campaign.policy];
    const plan = getDemandPlan();
    const describe = item => item.kind != null ? "Player " + item.player.number + " gives 1 " + getDemandWord(item.kind)
        : (item.favor ? "Player " + item.player.number + " has none: the First Regent takes 1 of their agents as a Favor" : "Player " + item.player.number + " (First Regent) has none to add");
    const intro = "<div class=\"turnsection\"><div class=\"turnlabel\">03 &middot; Govern the Imperial Reach</div>"
        + "<div class=\"policy\"><b class=\"t\">" + policyNames[campaign.policy] + "</b><br><b>Demand:</b> " + demand.words + ".<br><b>Action:</b> " + policyActions[campaign.policy] + "</div>";
    if (!firstRegent.isHuman) {
        // A bot enforces the Policy, unless it would gain little and another would serve it better next time
        const decision = choosePolicyForBot(firstRegent);
        const reasons = "<ul class=\"small mb-0\">" + decision.reasons.map(reason => "<li>" + reason + "</li>").join("") + "</ul>";
        if (decision.change != null) {
            showCampaignWindow("Edicts", intro + "<p class=\"mt-2 mb-1\">Player " + firstRegent.number + " (bot) is First Regent. It <b>changes the Policy to " + capitalise(decision.change) + "</b>:</p>" + reasons + "</div>"
                + "<p class=\"small\">Then any other Edicts in the rules booklet, in number order.</p>"
                + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"changePolicy('" + decision.change + "')\">OK</button>", firstRegent, true);
            return;
        }
        showCampaignWindow("Edicts", intro + "<p class=\"mt-2 mb-1\">Player " + firstRegent.number + " (bot) is First Regent and <b>enforces it</b>:</p>"
            + "<ul class=\"small mb-1\">" + plan.map(item => "<li>" + describe(item) + "</li>").join("") + "</ul>" + reasons + "</div>"
            + "<p class=\"small\">Then any other Edicts in the rules booklet, in number order.</p>"
            + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"enforcePolicy()\">OK: carry it out</button>", firstRegent, true);
        return;
    }
    const others = Object.keys(policyNames).filter(policy => policy != campaign.policy);
    showCampaignWindow("Edicts", intro + "<p class=\"mt-2 mb-1\">Player " + firstRegent.number + " is First Regent: enforce this Policy, or change it (the new one takes effect next time).</p>"
        + "<ul class=\"small mb-2\">" + plan.map(item => "<li>" + describe(item) + "</li>").join("") + "</ul>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mb-2\" onclick=\"enforcePolicy()\">Enforce " + policyNames[campaign.policy] + "</button>"
        + "<div class=\"brseg\">" + others.map(policy => "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"changePolicy('" + policy + "')\">Change<small>to " + capitalise(policy) + "</small></button>").join("") + "</div></div>"
        + "<p class=\"small\">Then any other Edicts in the rules booklet, in number order.</p>", firstRegent, true);
}

// What a Policy is worth to the First Regent: each piece it collects (they count for its ambitions),
// a little for each Favor, and what the Imperial Action gives it compared with its Rival Regents
// A change only takes effect next time, so it counts for less (laterFactor), and only when enforcing
// would gain it less than a piece
const policyWeights = { piece: 1, favor: 0.3, escalation: 0.5, changeMargin: 0.5, laterFactor: 0.75 };

function getPolicyValue(firstRegent, policy) {
    const plan = getDemandPlan(policy);
    const pieces = plan.filter(item => item.kind != null).length;
    const favors = plan.filter(item => item.favor).length;
    const rivals = players.filter(player => player !== firstRegent && isRegent(player));
    let action = 0, actionNote = "";
    if (policy == "peace") {
        const own = getCityBonus(firstRegent), best = Math.max(0, ...rivals.map(getCityBonus));
        action = own - best;
        actionNote = "Celebrate Regency gives it " + own + " Power" + (rivals.length > 0 ? ", and its Rival Regents up to " + best : "");
    } else if (policy == "escalation") {
        action = policyWeights.escalation;
        actionNote = "Requisition Ships adds 2 Imperial ships";
    } else {
        actionNote = "Distribute Arms gives every Regent a Weapon";
    }
    return { value: pieces * policyWeights.piece + favors * policyWeights.favor + action, pieces: pieces, favors: favors, actionNote: actionNote };
}

function choosePolicyForBot(firstRegent) {
    const current = getPolicyValue(firstRegent, campaign.policy);
    const others = Object.keys(policyNames).filter(policy => policy != campaign.policy)
        .map(policy => ({ policy: policy, ...getPolicyValue(firstRegent, policy) })).sort((a, b) => b.value - a.value);
    const describeDemand = result => result.pieces == 0 && result.favors == 0 ? "the Demand would collect nothing"
        : "the Demand would collect " + result.pieces + " piece" + (result.pieces == 1 ? "" : "s") + (result.favors > 0 ? " and " + result.favors + " Favor" + (result.favors == 1 ? "" : "s") : "");
    if (current.value < policyWeights.piece && others[0].value * policyWeights.laterFactor > current.value + policyWeights.changeMargin) {
        return { change: others[0].policy, reasons: [
            "Enforcing " + capitalise(campaign.policy) + ": " + describeDemand(current) + ". " + current.actionNote + ".",
            capitalise(others[0].policy) + " next time: " + describeDemand(others[0]) + ". " + others[0].actionNote + "."] };
    }
    return { change: null, reasons: [capitalise(describeDemand(current)) + ". " + current.actionNote + "."] };
}

function changePolicy(policy) {
    campaign.policy = policy;
    showMessageToast("Edicts", "Put " + policyNames[policy] + " on top of the Govern the Imperial Reach cards.");
    // Then the Fates' Edicts (fatebots.js)
    afterGovern();
}

function enforcePolicy() {
    const firstRegent = getPlayer(campaign.firstRegent);
    const notes = [];
    getDemandPlan().forEach(item => {
        if (item.kind == null) {
            if (item.favor) {
                const favors = getCampaignPlayer(firstRegent).favors;
                favors[item.player.number] = (favors[item.player.number] || 0) + 1;
                notes.push("Player " + firstRegent.number + " takes a Favor from Player " + item.player.number + " (if they have no agents left, they may be made an Outlaw)");
            }
            return;
        }
        adjustCounter(item.player, item.kind, -1);
        if (item.kind == "trophies" || item.kind == "captives") { adjustCounter(firstRegent, item.kind, 1); } else { campaign.trust[item.kind] += 1; }
        notes.push("Player " + item.player.number + " gives 1 " + getDemandWord(item.kind));
    });
    // The Imperial Action
    const regents = players.filter(player => getCampaignPlayer(player).title == "regent");
    if (campaign.policy == "peace") {
        regents.forEach(player => {
            const bonus = getCityBonus(player);
            if (bonus > 0) { setPlayerPower(player, player.powerValue + bonus); notes.push("Player " + player.number + " gains " + bonus + " Power"); }
        });
    } else if (campaign.policy == "war") {
        regents.forEach(player => {
            if (getResourceSupply("weapons") > 0) { adjustCounter(player, "weapons", 1); notes.push("Player " + player.number + " gains 1 Weapon"); }
            else if (campaign.trust.weapons > 0) { campaign.trust.weapons -= 1; adjustCounter(player, "weapons", 1); notes.push("Player " + player.number + " gains 1 Weapon from the Trust"); }
        });
    } else {
        notes.push("Place 2 fresh Imperial ships in an Empire-controlled system (or at a Loyal starport of Player " + firstRegent.number + "'s if there are none)");
        imperialShipsPlaced(2, "Requisition Ships");
    }
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    showMessageToast(policyNames[campaign.policy], notes.join("<br>"));
    // Then the Fates' Edicts (fatebots.js)
    afterGovern();
}
