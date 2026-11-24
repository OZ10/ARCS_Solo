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
        botSummit(player);
        const carryOn = () => {
            // The Favors it called in, in its Call to Order (negotiation.js)
            if ((roundEvent.callInResults || []).length > 0) { roundEvent.summitNote += "<br>" + roundEvent.callInResults.join("<br>"); }
            // Human players may negotiate in a Summit a bot called
            if (roundEvent.summitCalled && players.some(other => other.isHuman)) { showBotSummitNegotiations(); return; }
            // With only bots, their deals are settled straight away
            if (roundEvent.summitCalled) {
                const results = runBotOffersSilently();
                if (results.length > 0) { roundEvent.summitNote += "<br>" + results.join("<br>"); }
            }
            afterSummit();
        };
        if (roundEvent.summitCalled && roundEvent.callIns.length > 0) { runFavorCallIns(carryOn); return; }
        carryOn();
        return;
    }
    showCampaignWindow(getRoundEventTitle(), getRoundEventIntro()
        + "<div class=\"turnsection\"><div class=\"turnlabel\">" + (isYou(player) ? "You" : "Player " + player.number) + " may call a Summit</div>"
        + "<div class=\"brseg\"><button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"showSummit()\">Call a Summit<small>Call to Order, then deals</small></button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"afterSummit()\">No Summit<small>Carry on</small></button></div></div>", player, true);
}

function showSummit() {
    // The bots' offers first (negotiation.js)
    if (runBotOffersFirst("human")) { return; }
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
        // Deals with the bots (negotiation.js)
        + getOfferResultsHtml()
        + getNegotiationsHtml("human")
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

// A bot calling a Summit: it leaves the Empire when that's worth more than staying, revives it
// when there are no Regents, and petitions the Council when it wants it again. It doesn't
// negotiate yet

// What a Fate wants its holder's title to be, by Act
const fateTitleWants = { 1: { 1: "regent", 2: "regent", 3: "regent" }, 2: { 1: "outlaw" }, 7: { 1: "regent", 2: "regent", 3: "regent" } };
const summitWeights = { fate: 4, perSteal: 0.75, perStealChased: 0.5, edictCost: 1, truce: 1, firstRegent: 3, imperialShips: 1, targeted: 1, petition: 1.5, variation: 1, callForDeal: 1 };

function getFateTitleWant(player) {
    return (fateTitleWants[getCampaignPlayer(player).fate] || {})[campaign.act] || null;
}

function getLeaveEmpireCase(player) {
    // What it gains and loses by becoming an Outlaw, as { score, reasons, against }
    const weights = summitWeights;
    const fateName = getFate(getCampaignPlayer(player).fate).name;
    const reasons = [], against = [];
    let score = 0;
    const want = getFateTitleWant(player);
    if (want == "outlaw") { score += weights.fate; reasons.push("Its Fate, the " + fateName + ", advances its objective only while it's an Outlaw."); }
    if (want == "regent") { score -= weights.fate; against.push("Its Fate, the " + fateName + ", needs it to be a Regent."); }
    // As an Outlaw holding the Council, it steals from the Trust straight away
    const firstRegent = campaign.firstRegent != null ? getPlayer(campaign.firstRegent) : null;
    const steal = Math.min(getTrustTotal(), getEmptySlots(player));
    if (roundEvent.kind == "council" && steal > 0 && firstRegent != null && firstRegent !== player) {
        const chased = trustResources.filter(resource => campaign.trust[resource] > 0 && getResourceNeed(player, resource) == 2);
        score += steal * weights.perSteal + (chased.length > 0 ? weights.perStealChased : 0);
        reasons.push("As an Outlaw it steals from the Imperial Trust now: " + getTrustTotal() + " resource" + (getTrustTotal() == 1 ? "" : "s") + ", and it has " + getEmptySlots(player) + " empty slot" + (getEmptySlots(player) == 1 ? "" : "s")
            + (chased.length > 0 ? ", with " + chased.map(resource => preludeResourceNames[resource]).join(" and ") + " that it's chasing" : "") + ".");
    }
    // The Edicts keep taking what it's chasing
    const demanded = policyDemands[campaign.policy].resources.filter(resource => preludeResources.includes(resource) && player[resource + "Value"] > 0 && getResourceNeed(player, resource) == 2);
    if (!isFirstRegent(player) && demanded.length > 0) {
        score += weights.edictCost;
        reasons.push(policyNames[campaign.policy] + " would take " + demanded.map(resource => preludeResourceNames[resource]).join(" or ") + ", which it's chasing.");
    }
    // The Truce Law shields every Rival it could battle
    const rivals = players.filter(other => other !== player);
    if (rivals.length > 0 && rivals.every(isRegent) && hasAttackFleet(player)) {
        score += weights.truce;
        reasons.push("All its Rivals are Regents: the Truce Law shields them wherever there are Imperial ships.");
    }
    if (isFirstRegent(player)) { score -= weights.firstRegent; against.push("It's First Regent: it would lose the tile."); }
    score -= weights.imperialShips;
    against.push("Imperial ships move and battle alongside it while it's a Regent.");
    if (rivals.some(other => !other.isHuman && isRegent(other))) { score -= weights.targeted; against.push("Regent bots would rather battle an Outlaw."); }
    score += (Math.random() - 0.5) * weights.variation * getDifficulty().planVariation;
    return { score: score, reasons: reasons, against: against };
}

function wouldPetition(player) {
    // The Council is Decided, and it would want to secure it again
    if (!isCouncilDecided()) { return false; }
    const value = isRegent(player) ? (isFirstRegent(player) ? 0 : councilValues.becomeFirstRegent) : Math.min(getTrustTotal(), getEmptySlots(player)) * councilValues.perStolen;
    return value >= summitWeights.petition;
}

function botSummit(player) {
    const list = items => "<ul class=\"small mb-0 mt-1\">" + items.map(item => "<li>" + item + "</li>").join("") + "</ul>";
    const noRegents = !players.some(isRegent);
    const notes = [];
    let called = false;
    if (isRegent(player)) {
        const leave = getLeaveEmpireCase(player);
        if (leave.score > 0) {
            called = true;
            leaveEmpire(player.number);
            notes.push("Player " + player.number + " (bot) calls a Summit and <b>leaves the Empire</b>: flip its title to Outlaw." + list(leave.reasons.concat(leave.against.map(text => "Against: " + text))));
        } else {
            roundEvent.stayReasons = leave;
        }
    } else if (noRegents && getFateTitleWant(player) != "outlaw") {
        called = true;
        reviveEmpire(player.number);
        notes.push("Player " + player.number + " (bot) calls a Summit and <b>revives the Empire</b>: flip its title to Regent and give it the First Regent tile." + list(["There are no Regents left, so it becomes First Regent."]));
    }
    if (wouldPetition(player)) {
        setCouncilInSession();
        notes.push((called ? "It also" : "Player " + player.number + " (bot) calls a Summit and") + " <b>petitions the Council</b>: flip the Imperial Council to In Session." + list(["It wants to secure the Council again."]));
        called = true;
    }
    // A deal worth making is reason enough to call one (negotiation.js)
    const offer = called ? null : getBotOffer(player);
    // The Magnate calls one for any good deal: each one advances its objective
    if (offer != null && offer.gain >= (isMagnate(player) ? 0 : summitWeights.callForDeal)) {
        called = true;
        notes.push("Player " + player.number + " (bot) calls a Summit <b>to make deals</b>: it wants " + preludeResourceNames[offer.ask]
            + (getResourceNeed(player, offer.ask) == 2 ? " for " + capitalise(preludeAmbitions[offer.ask] || "warlord") : "") + ".");
    }
    // Rivals' Favors it holds: it calls them in to force what it's chasing
    roundEvent.callIns = getFavorCallIns(player);
    roundEvent.callInResults = [];
    if (roundEvent.callIns.length > 0 && !called) {
        called = true;
        notes.push("Player " + player.number + " (bot) calls a Summit <b>to call in Favors</b>.");
    }
    if (!called) {
        const stay = roundEvent.stayReasons;
        notes.push("Player " + player.number + " (bot) doesn't call a Summit" + (isRegent(player) ? ": it stays a Regent." : ".")
            + (stay != null ? list(stay.against.concat(stay.reasons.map(text => "For leaving: " + text))) : ""));
    }
    roundEvent.summitCalled = called;
    roundEvent.stayReasons = null;
    roundEvent.summitNote = notes.join("<br>");
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

function chooseRequisitionSystem(player) {
    // An Empire-controlled system, one with its pieces first (it Commands the ships there); with
    // none, one of its starports
    const empire = getSystemIds().filter(isEmpireControlled).sort((a, b) => Number(hasLoyalPiece(b, player.number)) - Number(hasLoyalPiece(a, player.number)));
    if (empire.length > 0) { return empire[0]; }
    const port = getBoardBuildings(player.number, "starport")[0];
    return port != null ? port.system : null;
}

// Crises (rulebook p.18): the Blight, then Fate cards, then the Court's Vox cards left to right

function startCrises() {
    // The Court Crises use the dice: rolled now, unless just rolled for an Event card
    if (roundEvent.dice == null) { roundEvent.dice = rollEventDice(); }
    const dice = roundEvent.dice;
    const step = (text, note) => "<label class=\"setstep\"><input class=\"form-check-input\" type=\"checkbox\"><span>" + text + (note ? "<small>" + note + "</small>" : "") + "</span></label>";
    const vox = courtMarket.map(entry => getCourtCard(entry.number)).filter(card => card != null && card.crisis != null);
    const fillDice = text => text.replace(/the rolled cluster/g, "cluster " + dice.cluster).replace(/the rolled symbol/g, "the rolled symbol (" + planetSymbols[dice.symbol] + ")");
    // The Blight Crises on the app's board, once (#85 stage 7c): what to change on the table
    const key = campaign.act + ":" + roundNumber + ":" + turnNumber;
    if (campaign.blightCrisis == null || campaign.blightCrisis.key != key) {
        campaign.blightCrisis = { key: key, systems: applyBlightCrises() };
        players.forEach(syncPanelFromBoard);
        SaveAllSettings();
    }
    const hit = campaign.blightCrisis.systems.filter(item => item.lines.length > 0);
    const blightHtml = hit.length > 0
        ? hit.map(item => step(getSystemName(item.id) + " &middot; " + item.hits + " hit" + (item.hits == 1 ? "" : "s"), tagPlayerNames(item.lines.join(". ")))).join("")
        : "<p class=\"small mb-0\">The Blight hits nothing: no ships share a system with it.</p>";
    showCampaignWindow("Crises", "<p class=\"mb-2\">Resolve these in order on the table and tick each one. Dice: " + getDiceHtml(dice) + "</p>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">1 &middot; Blight Crises</div>"
        + "<div class=\"small text-secondary mb-1\">The app has dealt the hits on its board: each fresh Blight 3, each damaged 1, Imperial ships first, then every player's ships there, fresh before damaged. Change the table to match.</div>"
        + blightHtml + "</div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">2 &middot; Fate Crises, in turn order</div>"
        + getTurnOrder().flatMap(player => getPlayerGuildCards(player).filter(card => card.crisis != null).map(card => step(card.name + " (Player " + player.number + ")", card.crisis))).join("")
        + step("Any other cards with Crisis text that players hold", "From their Fates.") + "</div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">3 &middot; Court Crises, left to right</div>"
        + (vox.length > 0 ? vox.map(card => step(card.name, fillDice(card.crisis))).join("") : "<p class=\"small mb-0\">No Vox cards in the Court (that the app knows of).</p>")
        + "<p class=\"small text-secondary mt-1 mb-0\">A card that leaves the Court returns its agents, and the Court is refilled.</p></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"finishCrises()\">Done: on to scoring</button>", roundEvent.player, true);
}

function finishCrises() {
    // The Court's Vox cards that leave after their Crisis. Council Intrigue's agents go onto the Council
    // (Populist Demands and Song of Freedom stay)
    const leaving = [102, 103, 105];
    // Merchant League's Crisis: discard all resources on it (negotiation.js)
    clearLeaguesInCrisis();
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
            + getOutlawChoicesHtml(firstRegent, plan)
            + "<p class=\"small\">Then any other Edicts in the rules booklet, in number order.</p>"
            + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"enforcePolicy()\">OK: carry it out</button>", firstRegent, true);
        return;
    }
    const others = Object.keys(policyNames).filter(policy => policy != campaign.policy);
    showCampaignWindow("Edicts", intro + "<p class=\"mt-2 mb-1\">Player " + firstRegent.number + " is First Regent: enforce this Policy, or change it (the new one takes effect next time).</p>"
        + "<ul class=\"small mb-2\">" + plan.map(item => "<li>" + describe(item) + "</li>").join("") + "</ul>"
        + (getOutlawChoicesHtml(firstRegent, plan) != "" ? "</div>" + getOutlawChoicesHtml(firstRegent, plan) + "<div class=\"turnsection\">" : "")
        + "<button type=\"button\" class=\"btn btn-primary w-100 mb-2\" onclick=\"enforcePolicy()\">Enforce " + policyNames[campaign.policy] + "</button>"
        + "<div class=\"brseg\">" + others.map(policy => "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"changePolicy('" + policy + "')\">Change<small>to " + capitalise(policy) + "</small></button>").join("") + "</div></div>"
        + "<p class=\"small\">Then any other Edicts in the rules booklet, in number order.</p>", firstRegent, true);
}

// A Rival Regent with nothing to give: the First Regent takes an agent as a Favor, or, with none
// left, may make them an Outlaw (rulebook p.21). The app can't count agents on the table, so it asks

function getOutlawReason(firstRegent, rival) {
    // Why a bot First Regent would make this Rival an Outlaw, or null. They're ahead of it or close
    // behind on Power, or its Fate gains from Outlaws (the Admiral in Act II); not while its own
    // grand ambition wants no Outlaws (the Steward in Act III)
    if (hasFate(firstRegent, 1) && campaign.act == 3) { return null; }
    if (hasFate(firstRegent, 7) && campaign.act == 2) { return "its Fate, the Admiral, advances for Outlaw pieces it takes as Trophies"; }
    if (rival.powerValue >= firstRegent.powerValue - outlawPowerGap) {
        return rival.powerValue > firstRegent.powerValue ? "they're ahead of it on Power (" + rival.powerValue + " to its " + firstRegent.powerValue + ")"
            : "they're close behind it on Power (" + rival.powerValue + " to its " + firstRegent.powerValue + ")";
    }
    return null;
}
const outlawPowerGap = 3;

function getOutlawChoicesHtml(firstRegent, plan) {
    const choice = (number, value, label, note, checked) => "<input type=\"radio\" class=\"btn-check\" name=\"outlawChoice" + number + "\" id=\"outlawChoice" + number + value + "\" value=\"" + value + "\"" + (checked ? " checked" : "") + ">"
        + "<label class=\"btn btn-outline-secondary\" for=\"outlawChoice" + number + value + "\">" + label + "<small>" + note + "</small></label>";
    return plan.filter(item => item.favor).map(item => {
        const rival = item.player;
        const words = demandWordsFor(campaign.policy);
        if (!firstRegent.isHuman) {
            const reason = getOutlawReason(firstRegent, rival);
            if (reason == null) { return ""; }
            return "<div class=\"turnsection\"><div class=\"turnlabel\">Player " + rival.number + " has no " + words + "</div><p class=\"small mb-2\">Does Player " + rival.number + " have an agent left in their supply? If not, Player " + firstRegent.number + " (bot) <b>makes them an Outlaw</b>: " + reason + ".</p>"
                + "<div class=\"brseg\">" + choice(rival.number, "favor", "Has agents", "Take 1 as a Favor", true) + choice(rival.number, "outlaw", "None left", "Make them an Outlaw", false) + "</div></div>";
        }
        return "<div class=\"turnsection\"><div class=\"turnlabel\">Player " + rival.number + " has no " + words + "</div><p class=\"small mb-2\">Take 1 of their agents as a Favor. If they have none left in their supply, you may make them an Outlaw.</p>"
            + "<div class=\"brseg brseg3\">" + choice(rival.number, "favor", "Has agents", "Take 1 as a Favor", true) + choice(rival.number, "none", "None left", "Stays a Regent", false) + choice(rival.number, "outlaw", "None left", "Make an Outlaw", false) + "</div></div>";
    }).join("");
}

function demandWordsFor(policy) {
    return policyDemands[policy].resources.map(getDemandWord).join(" or ");
}

function getOutlawChoice(rival) {
    // "favor" (the default), "none" or "outlaw"
    const checked = document.querySelector("input[name=outlawChoice" + rival.number + "]:checked");
    return checked != null ? checked.value : "favor";
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
    // What its Fate makes it worth, such as the Steward filling the Imperial Trust (steering.js)
    const fate = getSteerPolicyBonus(firstRegent, policy, plan);
    if (fate != null) {
        action += fate.value;
        actionNote += ". " + fate.note;
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
                const choice = getOutlawChoice(item.player);
                if (choice == "outlaw") {
                    applyTitle(item.player.number, "outlaw");
                    notes.push("Player " + item.player.number + " has no agents left: Player " + firstRegent.number + " makes them an Outlaw. Flip their title.");
                } else if (choice == "none") {
                    notes.push("Player " + item.player.number + " has no agents left to give, and stays a Regent");
                } else {
                    const favors = getCampaignPlayer(firstRegent).favors;
                    favors[item.player.number] = (favors[item.player.number] || 0) + 1;
                    notes.push("Player " + firstRegent.number + " takes a Favor from Player " + item.player.number);
                }
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
            // A bot with no room returns what it needs least (#167)
            const room = returnOverCapacity(player);
            if (room != null) { notes.push(room); }
        });
    } else {
        // On the app's board (#85 stage 7c): a bot First Regent chooses an Empire system where it has
        // pieces if it can; a human player places them and adds them with Check the board
        const where = !firstRegent.isHuman ? chooseRequisitionSystem(firstRegent) : null;
        if (where != null) {
            const imperial = getImperial(where);
            setImperial(where, imperial.fresh + 2, imperial.damaged);
            notes.push("Player " + firstRegent.number + " places 2 fresh Imperial ships at " + getSystemName(where));
        } else {
            notes.push("Place 2 fresh Imperial ships in an Empire-controlled system (or at a Loyal starport of Player " + firstRegent.number + "'s if there are none)"
                + (firstRegent.isHuman ? ", then add them with Check the board in Options" : ""));
        }
        imperialShipsPlaced(2, "Requisition Ships");
    }
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    showMessageToast(policyNames[campaign.policy], notes.join("<br>"));
    // Then the Fates' Edicts (fatebots.js)
    afterGovern();
}
