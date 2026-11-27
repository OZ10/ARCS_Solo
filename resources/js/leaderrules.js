// Leaders & Lore (#88): the Leader and Lore rules for scoring, declaring an ambition, securing
// and battles (part 2), and the bots playing to them (part 3). The cards themselves are in leaders.js. Bots carry their effects out
// themselves and their turn window says what they did; the human player gets a window or a reminder.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// Leader and Lore card numbers used here
const leaderNumbers = { elder: 1, fuelDrinker: 3, upstart: 4, rebel: 5, warrior: 6, feastbringer: 7, demagogue: 8, archivist: 9, corsair: 11, noble: 12, agitator: 15, quartermaster: 16 };
const loreNumbers = { mirrorPlating: 4, hiddenHarbors: 5, signalBreaker: 6, repairDrones: 7, railgunArrays: 12, ancientHoldings: 13, seekerTorpedoes: 14, predictiveSensors: 15, raiderExosuits: 17, keepersTrust: 21, keepersSolidarity: 22 };

function hasLeader(player, number) {
    return leadersAndLore && player != null && player.leader == number;
}

function hasLore(player, number) {
    return leadersAndLore && player != null && (player.lore || []).includes(number);
}

function getLeaderName(player) {
    return getLeaderCard(player.leader).name;
}

function addLeaderNote(player, title, note) {
    // Shown in a bot's turn window (see renderTurn)
    player.leaderNotes = (player.leaderNotes || []).concat({ title: title, note: note || "" });
}

// Windows one after another: each waits for the last to close

let leaderWindows = [];
let leaderWindowsRunning = false;

function queueLeaderWindow(open) {
    leaderWindows.push(open);
    if (!leaderWindowsRunning) {
        leaderWindowsRunning = true;
        whenWindowsClosed(runLeaderWindows);
    }
}

function runLeaderWindows() {
    const open = leaderWindows.shift();
    if (open == null) {
        leaderWindowsRunning = false;
        // The turn window waits for these (see openTurnWindow)
        if (returnToTurnWindow) { openTurnWindow(); }
        return;
    }
    open();
    whenWindowsClosed(runLeaderWindows);
}

function hasLeaderWindowsWaiting() {
    return leaderWindowsRunning || leaderWindows.length > 0;
}

function showLeaderWindow(player, title, html) {
    document.getElementById("guildTitle").innerHTML = title;
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = tagPlayerNames(html);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

function closeLeaderWindow() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
}

// Scoring (rulebook p.18, and the Leaders' scoring powers)

// Second place's Power instead of first, and none for second, for one ambition
const secondPlaceLeaders = { tyrant: [leaderNumbers.elder, "Just"], empath: [leaderNumbers.warrior, "Violent"], tycoon: [leaderNumbers.archivist, "Academic"] };

function applyLeaderScoring(results, ambition, secondPlacePoints) {
    // results are scoreAmbition's, with place 1 for an outright first and 2 otherwise
    const rule = secondPlaceLeaders[ambition];
    return results.map(result => {
        const player = result.player;
        if (player.isNeutral) { return result; }
        if (rule != null && hasLeader(player, rule[0])) {
            const name = getLeaderName(player) + ", " + rule[1];
            return result.place == 1
                ? { ...result, points: secondPlacePoints, cityBonus: 0, note: name + ": second place's Power" }
                : { ...result, points: 0, cityBonus: 0, note: name + ": no Power for second place" };
        }
        if (hasLeader(player, leaderNumbers.noble) && result.place != 1) {
            return { ...result, points: 0, cityBonus: 0, note: "Noble, Proud: only an untied first" };
        }
        return result;
    });
}

function applyLeaderAfterScoring(scored) {
    // Fuel-Drinker (Lavish): discards all its Fuel if Tycoon was scored. Returns what happened
    if (!scored.includes("tycoon")) { return []; }
    return players.filter(player => hasLeader(player, leaderNumbers.fuelDrinker) && player.fuelValue > 0).map(player => {
        setPlayerResource(player, "fuel", 0);
        return "Player " + player.number + " discards all fuel (Fuel-Drinker, Lavish)";
    });
}

// Securing

function isParanoidBlocked(entry, player) {
    // Demagogue (Paranoid): can't secure a Guild card with only 1 of its agents on it
    return hasLeader(player, leaderNumbers.demagogue) && getCourtCard(entry.number).type == "guild" && getMarketAgents(entry, player) < 2;
}

// Declaring an ambition

function canDeclareAmbition(player) {
    // Feastbringer (Generous) must give a Guild card to declare
    return !(hasLeader(player, leaderNumbers.feastbringer) && (player.guildCards || []).length == 0);
}

function getLeastPowerfulRival(player) {
    // Ties go to the earliest in turn order (rulebook p.22)
    return players.filter(other => other !== player)
        .sort((a, b) => (a.powerValue - b.powerValue) || (getTurnOrderPosition(a) - getTurnOrderPosition(b)))[0];
}

function onLeaderAmbitionDeclared(player) {
    // Just after an ambition is declared (see onAmbitionDeclared in farseers.js)
    if (!leadersAndLore || player.leader == null) { return; }
    const ambition = declaredAmbitions[declaredAmbitions.length - 1];
    const wasUndeclared = declaredAmbitions.filter(declared => declared == ambition).length == 1;

    if (hasLeader(player, leaderNumbers.feastbringer)) { player.isHuman ? queueLeaderWindow(() => showGenerous(player)) : botGenerous(player); }
    if (hasLeader(player, leaderNumbers.upstart)) { player.isHuman ? queueLeaderWindow(() => showAmbitious(player)) : botAmbitious(player, ambition); }
    if (hasLeader(player, leaderNumbers.demagogue)) { player.isHuman ? showMessageToast("Demagogue, Bold", "You may influence any number of cards in the Court once. Use the Court window.") : botBold(player); }
    if (hasLeader(player, leaderNumbers.noble) && wasUndeclared) { queueLeaderWindow(() => showConnected(player)); }
    SaveAllSettings();
}

// Feastbringer (Generous)

function giveGuildCard(player, rival, number) {
    player.guildCards = player.guildCards.filter(held => held != number);
    rival.guildCards = (rival.guildCards || []).concat(number);
    showGuildCardsRow(player);
    showGuildCardsRow(rival);
    SaveAllSettings();
}

function botGenerous(player) {
    // Its least useful Guild card
    const need = card => card.resource == "weapons" ? (wantsToKeep(player, "weapons") ? 2 : 0) : getResourceNeed(player, card.resource);
    const card = getPlayerGuildCards(player).sort((a, b) => need(a) - need(b))[0];
    const rival = getLeastPowerfulRival(player);
    giveGuildCard(player, rival, card.number);
    addLeaderNote(player, "Generous: gave " + card.name + " to Player " + rival.number, "Its Rival with the least Power. Already moved to their Guild row.");
}

function showGenerous(player) {
    const rival = getLeastPowerfulRival(player);
    showLeaderWindow(player, "Generous", "<p class=\"mb-2\">To declare, <b>Feastbringer</b> must give 1 Guild card to your Rival with the least Power: "
        + getPlayerTag(rival) + " (" + rival.powerValue + " Power).</p>"
        + "<div class=\"d-flex flex-wrap gap-1 justify-content-center mb-2\">" + getPlayerGuildCards(player).map(card =>
            "<button type=\"button\" class=\"guildchip guild-" + card.resource + "\" id=\"generous_" + card.number + "\" onclick=\"confirmGenerous(" + player.number + ", " + rival.number + ", " + card.number + ")\">" + card.name + "</button>").join("") + "</div>"
        + "<div class=\"small text-muted\">Tap the card to give.</div>");
}

function confirmGenerous(playerNumber, rivalNumber, number) {
    giveGuildCard(getPlayer(playerNumber), getPlayer(rivalNumber), number);
    showMessageToast("Player " + playerNumber, "Gave " + getCourtCard(number).name + " to Player " + rivalNumber);
    closeLeaderWindow();
}

// Upstart (Ambitious)

function gainLeaderResource(player, resource) {
    setPlayerResource(player, resource, player[resource + "Value"] + 1);
    showSlotAdvice(player, [resource]);
    SaveAllSettings();
}

function botAmbitious(player, ambition) {
    // The resource for the ambition it just declared, otherwise the one it needs most
    const available = preludeResources.filter(resource => getResourceSupply(resource) > 0);
    if (available.length == 0) { return; }
    const forAmbition = available.filter(resource => (resource == "weapons" ? "warlord" : preludeAmbitions[resource]) == ambition);
    const resource = forAmbition[0] || available.slice().sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a))[0];
    gainLeaderResource(player, resource);
    addLeaderNote(player, "Ambitious: gained 1 " + preludeResourceNames[resource], "Already added to its tiles.");
}

function showAmbitious(player) {
    showLeaderWindow(player, "Ambitious", "<p class=\"mb-2\">You declared, so <b>Upstart</b> lets you gain any resource.</p>"
        + "<div class=\"d-flex flex-wrap gap-2 mb-3\">" + preludeResources.map(resource =>
            "<button type=\"button\" class=\"btn btn-outline-secondary flex-fill\" id=\"ambitious_" + resource + "\" onclick=\"confirmAmbitious(" + player.number + ", '" + resource + "')\">" + preludeResourceNames[resource] + "</button>").join("") + "</div>"
        + "<button type=\"button\" class=\"btn btn-secondary w-100\" onclick=\"closeLeaderWindow()\">No thanks</button>");
}

function confirmAmbitious(playerNumber, resource) {
    gainLeaderResource(getPlayer(playerNumber), resource);
    closeLeaderWindow();
}

// Demagogue (Bold)

function botBold(player) {
    // 1 agent on each card in the Court it wants
    if (!isMarketKnown()) {
        addLeaderNote(player, "Bold: influence each Court card it wants, once", "The market isn't entered, so place them on the table yourself.");
        return;
    }
    // No more than it has agents (#123)
    const left = getAgentsLeft(player);
    const wanted = courtMarket.filter(entry => getMarketCardValue(player, entry) > marketValues.base).slice(0, left == null ? undefined : left);
    if (wanted.length == 0) { addLeaderNote(player, "Bold: nothing in the Court it wants"); return; }
    wanted.forEach(entry => { entry.agents[player.number] = (entry.agents[player.number] || 0) + 1; });
    addLeaderNote(player, "Bold: placed 1 agent on " + wanted.map(entry => getCourtCard(entry.number).name).join(" and "), "Already added in the Court window. Place them on the table.");
}

// Noble (Connected)

function showConnected(player) {
    // The app can't see the Court deck, so the player says what was drawn
    const choices = courtCards.filter(card => !courtMarket.some(entry => entry.number == card.number) && getGuildCardHolder(card.number) == null).sort(byCardName);
    const you = getYouOrPlayer(player, true);
    showLeaderWindow(player, "Connected", "<p class=\"mb-2\">" + you + " declared an ambition that wasn't declared, so <b>Noble</b> draws and secures the top card of the Court deck. Which card was it?</p>"
        + "<select class=\"form-select mb-3\" id=\"connectedCard\">" + choices.map(card =>
            "<option value=\"" + card.number + "\">" + card.name + (card.type == "vox" ? " (Vox)" : " (" + preludeResourceNames[card.resource] + ")") + "</option>").join("") + "</select>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"closeLeaderWindow()\">The deck is empty</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"connectedSecure\" onclick=\"confirmConnected(" + player.number + ")\">Secure it</button></div>"
        + "<div class=\"small text-muted mt-2\">" + (isYou(player) ? "You" : (player.isHuman ? "Player " + player.number : "It")) + " can't use its Prelude action this turn.</div>");
}

function confirmConnected(playerNumber) {
    const player = getPlayer(playerNumber);
    const card = getCourtCard(parseInt(document.getElementById("connectedCard").value));
    if (!player.isHuman) { addLeaderNote(player, "Connected: secured " + card.name + " from the Court deck"); }
    if (card.type == "guild") {
        player.guildCards = (player.guildCards || []).concat(card.number);
        showGuildCardsRow(player);
        SaveAllSettings();
        closeLeaderWindow();
    } else if (player.isHuman) {
        showMessageToast("Player " + player.number, "Secured " + card.name + ". Carry out the card.");
        closeLeaderWindow();
    } else {
        // What the bot does with the Vox card, in this window
        SaveAllSettings();
        showVoxCard(player, card);
    }
}

// Battles

function getBattleLimits() {
    // What Leaders and Lore change in a bot's dice choice
    const { attacker, defender } = battle;
    const noBuildingsHere = battle.freshBuildings + battle.damagedBuildings == 0;
    return {
        // Raider Exosuits: 1 raid die when there are no defending buildings
        maxRaidDice: (hasLore(attacker, loreNumbers.raiderExosuits) && noBuildingsHere && !battle.noBuildings) ? 1 : Infinity,
        // Corsair (Wary): no more assault dice than skirmish dice
        wary: hasLeader(attacker, leaderNumbers.corsair),
        // Agitator (Irregular): an intercept hits once per Weapon icon it has, not per fresh ship
        interceptHits: hasLeader(defender, leaderNumbers.agitator) ? defender.weaponsValue + getGuildIconCount(defender, "weapons") : null,
        // Mirror Plating: any assault dice bring an intercept
        mirror: hasLore(defender, loreNumbers.mirrorPlating),
        // Railgun Arrays: 1 hit before the dice if any defending ships are fresh
        preHits: (hasLore(defender, loreNumbers.railgunArrays) && battle.fresh > 0) ? 1 : 0
    };
}

function getLeaderExtraDice(player) {
    // Rebel (Committed): 2 extra dice
    return hasLeader(player, leaderNumbers.rebel) ? 2 : 0;
}

function isLeaderRaidAllowed(allowed) {
    // Hidden Harbors stops raid dice against a fresh defending starport. Raider Exosuits allows one
    // with no defending buildings
    const { attacker, defender } = battle;
    const fresh = getBattleBuildingTypes().slice(0, battle.freshBuildings);
    if (allowed && hasLore(defender, loreNumbers.hiddenHarbors) && fresh.includes("starport")) { return false; }
    if (!allowed && hasLore(attacker, loreNumbers.raiderExosuits) && battle.freshBuildings + battle.damagedBuildings == 0) { return true; }
    return allowed;
}

function filterLeaderRaidWants(attacker, defender, wants) {
    // Keeper's Trust and Keeper's Solidarity, while Keeper is declared
    if (!declaredAmbitions.includes("keeper")) { return wants; }
    return wants.filter(want => {
        if (want.resource != null && hasLore(defender, loreNumbers.keepersTrust) && attacker[want.resource + "Value"] > 0) { return false; }
        if (want.card != null && hasLore(defender, loreNumbers.keepersSolidarity) && defender[getCourtCard(want.card).resource + "Value"] > 0) { return false; }
        return true;
    });
}

function getLeaderDiceNotes(choice) {
    // Lines for the dice advice
    const { attacker, defender } = battle;
    let lines = [];
    if (hasLeader(attacker, leaderNumbers.corsair) && choice.raidDice > 0) {
        const kinds = preludeResources.filter(resource => attacker[resource + "Value"] > 0).length;
        if (kinds > 0) { lines.push("<b>Corsair, Tricky:</b> reroll up to " + kinds + " raid " + (kinds == 1 ? "die" : "dice") + " if it still needs keys."); }
    }
    if (hasLore(attacker, loreNumbers.seekerTorpedoes) && choice.assaultDice > 0) {
        lines.push("<b>Seeker Torpedoes:</b> reroll up to 1 assault die per fresh attacking ship.");
    }
    if (hasLore(attacker, 19) && declaredAmbitions.includes("empath")) { lines.push("<b>Empath's Vision:</b> reroll any number of its dice once."); }
    if (hasLore(attacker, loreNumbers.signalBreaker)) { lines.push("<b>Signal Breaker:</b> if all its ships here are fresh, ignore 1 intercept."); }
    if (hasLore(defender, loreNumbers.railgunArrays) && battle.fresh > 0) { lines.push("<b>Railgun Arrays:</b> it takes 1 hit before rolling."); }
    return lines.map(line => "<div>" + line + "</div>").join("");
}

function applyGatePortsCapture(mover, route) {
    // Gate Ports: when Rival ships move into a gate a player controls with a fresh Loyal starport,
    // that player captures 1 of the mover's agents. route: the systems the move goes through, from
    // first. Checked before the ships move in
    if (!leadersAndLore) { return; }
    route.slice(1).filter(isGate).forEach(id => {
        const holder = players.find(other => other !== mover && hasLore(other, 8) && getController(id) == other.number && getBuildings(id, other.number, "starport").some(port => !port.damaged));
        if (holder == null) { return; }
        setPlayerResource(holder, "captives", (holder.captivesValue || 0) + 1);
        showMessageToast("Gate Ports", "Player " + holder.number + " captures 1 of Player " + mover.number + "'s agents (moving into " + getSystemShortName(id) + "). Already added to their Captives.");
    });
}

function applyPredictiveSensors(system) {
    // A bot defender with Predictive Sensors moves its fresh ships in from adjacent systems before
    // the dice, leaving 1 on its buildings there. On the board, once a battle. true if it moved any
    const defender = battle.defender;
    if (battle.sensorsDone || defender == null || defender.isHuman || typeof defender.number != "number" || !hasLore(defender, loreNumbers.predictiveSensors)) { return false; }
    battle.sensorsDone = true;
    const moved = [];
    getAdjacent(system).forEach(id => {
        const take = getShips(id, defender.number).fresh - (getBuildings(id, defender.number).length > 0 ? 1 : 0);
        if (take > 0) { moveShips(id, system, defender.number, take); moved.push(take + " from " + getSystemName(id)); }
    });
    battle.sensorsNote = moved.length > 0 ? moved.join(" and ") : null;
    return moved.length > 0;
}

function getLeaderBattleSetupNote() {
    // Before the dice: Predictive Sensors lets the defender move ships in first
    if (battle.sensorsNote != null) {
        return "<div class=\"small text-muted text-center mb-2\">Predictive Sensors: " + getPlayerTag(battle.defender) + " moved fresh ships in, " + battle.sensorsNote + ". Already on the app's board and in the counts.</div>";
    }
    if (hasLore(battle.defender, loreNumbers.predictiveSensors) && (battle.defender.isHuman || battle.boardSystem == null)) {
        return "<div class=\"small text-muted text-center mb-2\">Predictive Sensors: " + getPlayerTag(battle.defender) + " may first move fresh ships in from adjacent systems. Update the counts before choosing the dice.</div>";
    }
    return "";
}

function canRansackAgainst(defender) {
    // Elder (Beloved): Rivals can't Ransack the Court when they battle it
    return !hasLeader(defender, leaderNumbers.elder);
}

function getLeaderBattleResultsHtml(losses) {
    // The Leaders & Lore box at the end of a battle
    const { attacker, defender } = battle;
    let lines = [];
    if (hasLeader(defender, leaderNumbers.agitator)) {
        lines.push("<div class=\"form-check mt-1\"><input class=\"form-check-input\" type=\"checkbox\" id=\"battleIntercept\"><label class=\"form-check-label\" for=\"battleIntercept\">An intercept was rolled (Agitator, Irregular: "
            + getPlayerTag(defender) + " discards 1 Weapon)</label></div>");
    }
    if (hasLeader(defender, leaderNumbers.elder) && losses.defenderShips + losses.defenderBuildings > 0) {
        lines.push("<div>Elder, Beloved: " + getPlayerTag(defender) + (defender.isHuman ? " may influence once." : " influences once, when you update the values.") + "</div>");
    }
    [attacker, defender].filter(player => hasLeader(player, leaderNumbers.quartermaster)).forEach(player => {
        lines.push("<div>Quartermaster, Resilient: " + getPlayerTag(player) + " repairs 1 ship here per starport it controls.</div>");
    });
    if (hasLore(attacker, loreNumbers.repairDrones)) { lines.push("<div>Repair Drones: " + getPlayerTag(attacker) + " repairs 1 attacking ship.</div>"); }
    if (lines.length == 0) { return ""; }
    return "<div class=\"alert alert-secondary py-2 px-3 mt-2 mb-0 small\" id=\"battleLeaders\"><b>Leaders &amp; Lore</b>" + lines.join("") + "</div>";
}

function applyLeaderBattleResults(losses) {
    // What the Leaders & Lore box changes. Returns lines for the message
    const { defender } = battle;
    let lines = [];
    const intercept = document.getElementById("battleIntercept");
    if (intercept != null && intercept.checked && defender.weaponsValue > 0) {
        adjustCounter(defender, "weapons", -1);
        lines.push("Player " + defender.number + " discards 1 Weapon (Irregular)");
    }
    if (hasLeader(defender, leaderNumbers.elder) && !defender.isHuman && losses.defenderShips + losses.defenderBuildings > 0) {
        const entry = isMarketKnown() ? getCardsToInfluence(defender)[0] : null;
        if (entry != null) {
            entry.agents[defender.number] = (entry.agents[defender.number] || 0) + 1;
            lines.push("Player " + defender.number + " influences " + getCourtCard(entry.number).name + " (Beloved)");
        } else {
            lines.push("Player " + defender.number + " may influence once (Beloved)");
        }
    }
    return lines;
}

// Part 3: the bots playing to their Leader and Lore. Hints under their plan steps, Lore actions
// in place of their normal actions, Lore in their prelude, and hints in the Yes/No questions

// How keen the bots are on these. These could also become part of the bot personalities (#71)
const leaderPlanWeights = {
    copyPivotPower: 2       // + an action its Leader improves, when it Copies or Pivots
};
const loreChance = {
    summon: 50,             // Tool-Priests: a ship at any city it controls, when short of ships or keen to battle
    rifles: 50,             // Galactic Rifles: skirmish dice at an adjacent system, when keen to battle
    nurture: 50,            // Living Structures: tax a city for a resource it's chasing
    prune: 30,              // Living Structures: a starport into a city, near the city bonus
    guide: 35,              // Force Beams: move any ships, when it has somewhere to go
    martyr: 45,             // Survival Overrides: swap a ship for a Rival's, when chasing Warlord
    annex: 60,              // Tyrant's Authority: take over a Rival's building, while Tyrant is declared
    clearOutrage: 70,       // discard an ambition Lore card to clear an Outrage it minds
    terror: 50,             // Warlord's Terror: Trophies for influence, when not chasing Warlord
    ego: 50,                // Tyrant's Ego: Captives to secure, when not chasing Tyrant
    charm: 50,              // Tycoon's Charm: Material and Fuel for what it's chasing
    tycoonsAmbition: 25     // Tycoon's Ambition: give up its Material and Fuel to declare another ambition
};

// What a Leader adds when it Copies or Pivots to take this action: [Leader, power, what it does]
const copyPivotPowers = {
    tax: [[2, "Mystic, Attuned", "gain 1 Psionic too"], [3, "Fuel-Drinker, Insatiable", "gain 1 Fuel too"], [15, "Agitator, Firebrand", "gain 1 Weapon too"]],
    influence: [[12, "Noble, Influential", "influence twice"]],
    secure: [[7, "Feastbringer, Charismatic", "may influence before or after securing"]],
    battle: [[6, "Warrior, Tactical", "may move before or after the Battle"]]
};

function isCopyOrPivot(player) {
    const card = playedCardList.find(played => played.playedByPlayerNumber == player.number && played.cardAction != "CLAIM");
    return card != null && (card.cardAction == "COPY" || card.cardAction == "PIVOT");
}

function getCopyPivotPower(player, action) {
    if (!leadersAndLore || !isCopyOrPivot(player)) { return null; }
    return (copyPivotPowers[action] || []).find(power => hasLeader(player, power[0])) || null;
}

function getLeaderFreeActions(player, chosen) {
    // With a Copy or Pivot: Noble (Influential) influences twice; Feastbringer (Charismatic) may
    // influence before or after it secures. Extra plan steps, not using up its card's action
    const extra = [];
    const power = action => getCopyPivotPower(player, action);
    // Never with no agents left (the user, #226)
    if (hasNoAgents(player)) { return extra; }
    if (chosen.some(pick => pick.action == "influence") && power("influence") != null && power("influence")[0] == 12) {
        extra.push({ action: "influence", reason: "a second Influence, free (Noble, Influential)", tag: "" });
    }
    if (chosen.some(pick => pick.action == "secure") && power("secure") != null && power("secure")[0] == 7 && (!isMarketKnown() || getCardsToInfluence(player).length > 0)) {
        extra.push({ action: "influence", reason: "a free Influence with the Secure (Feastbringer, Charismatic)", tag: "" });
    }
    return extra;
}

function getLeaderPlanBonus(player, action) {
    return getCopyPivotPower(player, action) != null ? leaderPlanWeights.copyPivotPower : 0;
}

function isLoreActive(player, number, ambition) {
    // An ambition Lore card works while that ambition is declared
    return hasLore(player, number) && declaredAmbitions.includes(ambition);
}

function canTaxCityAgain(player) {
    // Warlord's Cruelty
    return isLoreActive(player, 23, "warlord");
}

function getAnarchistTaxTargets(player, ruledOut) {
    // Anarchist (Principled) can't tax its own cities, but (Inspiring) taxes Rival cities and empty
    // slots where its ships are, so any resource it wants could do
    return preludeResources.filter(resource => getResourceNeed(player, resource) > 0 && getResourceSupply(resource) > 0 && !ruledOut.includes(resource))
        .sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a));
}

function getTaxStepName(player, resource) {
    const named = preludeResourceNames[resource].toLowerCase();
    return hasLeader(player, 13) ? "Tax a Rival's " + named + " city" : "Tax its " + named + " city";
}

function getLeaderPlanHints(player, action, details = {}) {
    // Lines under a plan step, as [{ lore, who, text }]. details: { resource, rivalTax, ruthless }
    if (!leadersAndLore || player.leader == null && (player.lore || []).length == 0) { return []; }
    let hints = [];
    const leader = (who, text) => hints.push({ lore: false, who: who, text: text });
    const lore = (number, text) => hints.push({ lore: true, who: getLoreCard(number).name, text: text });
    const named = resource => preludeResourceNames[resource].toLowerCase();

    const power = getCopyPivotPower(player, action);
    if (power != null) { leader(power[1], power[2]); }

    switch (action) {
        case "move":
            if (hasLeader(player, 5)) { leader("Rebel, Disorganized", "no more than 2 ships at a time"); }
            if (hasLeader(player, 14)) { leader("Shaper, Ancient", "Catapult from gates, not starports"); }
            if (hasLore(player, 3)) { lore(3, "fresh ships may move one more time"); }
            if (isLoreActive(player, 20, "empath")) { lore(20, "may Catapult with any starports, like its own"); }
            break;

        case "battle":
            if (hasLeader(player, 5)) { leader("Rebel, Committed", "2 extra dice, already in the Battle window"); }
            if (isLoreActive(player, 19, "empath")) { lore(19, "may reroll any number of dice once"); }
            break;

        case "tax": {
            if (hasLeader(player, 13)) { leader("Anarchist, Inspiring", "a Rival's city, or an empty slot, in a system with its ships. Not its own cities (Principled)"); }
            if (hasLeader(player, 4) && !details.rivalTax) { leader("Upstart, Callow", "only if it controls the city"); }
            if (hasLeader(player, 10) && details.rivalTax && details.ruthless) { leader("Overseer, Ruthless", "once this turn, hit the city to tax it again. Only a Rival's city, never its own"); }
            // Shaper (Mythic): turn the planet into what it's chasing, if it holds one to place
            const mythic = hasLeader(player, 14) && details.resource != null
                ? preludeResources.find(resource => resource != details.resource && getResourceNeed(player, resource) == 2 && player[resource + "Value"] > 0) : null;
            if (mythic != null) { leader("Shaper, Mythic", "may place 1 " + preludeResourceNames[mythic] + " over the planet, making it a " + named(mythic) + " planet from now on"); }
            if (isLoreActive(player, 20, "empath")) { lore(20, "may tax any city, like its own (no Captives)"); }
            if (canTaxCityAgain(player)) { lore(23, "may tax a city it already taxed this turn"); }
            break;
        }

        case "build":
            if (hasLore(player, 5)) { lore(5, "ships are built fresh"); }
            if (hasLore(player, 8)) { lore(8, "may build a starport on a gate (1 per gate)"); }
            if (hasLore(player, 9)) { lore(9, "may build a city on a planet outside its slots, for 1 resource of that type"); }
            if (hasLore(player, 11)) { lore(11, "may build a city on a gate (1 per gate)"); }
            if (isLoreActive(player, 20, "empath")) { lore(20, "may build ships at any starports (damaged in Rival-controlled systems)"); }
            break;

        default:
            break;
    }
    return hints;
}

function getLeaderHintsHtml(hints) {
    return (hints || []).map(hint => "<span class=\"leaderhint\"><i class=\"bi " + (hint.lore ? "bi-book" : "bi-person-badge") + "\"></i><span><b>"
        + hint.who + ":</b> " + hint.text + "</span></span>").join("");
}

function getLoreActionOffers(player, wants, can) {
    // Lore actions in place of one of its normal actions, like Guild actions
    if (!leadersAndLore || (player.lore || []).length == 0) { return []; }
    const chasing = ambition => isAmbitionInPlay(ambition) && isChasingAmbition(player, ambition);
    const keen = chasing("warlord") || hasManyShips(player);
    let offers = [];
    // Decided from the board, with where (#160, the user): no longer left to chance
    const add = (number, name, action, text, why, where, extras) => {
        if (hasLore(player, number) && can(action)) {
            offers.push(Object.assign({ label: name + " instead of " + replacedActionNames[action] + " (" + getLoreCard(number).name + ")", text: text, lore: number, decided: true, why: why, where: where }, extras));
        }
    };
    const n = player.number;
    const rivals = players.filter(other => other !== player);
    const leader = getLeader(player);
    const shipsOf = (id, number) => getShips(id, number).fresh + getShips(id, number).damaged;

    // Summon: 1 ship at a city it controls, even a Rival's: the one next to a Rival's ships, or a
    // threatened one, first
    if (hasLore(player, 1) && getShipSupply(player) > 0 && (player.shipsBoardValue < fewShipsOnBoard || keen || getThreatenedCity(player) != null)) {
        const threatened = getThreatenedCity(player);
        const score = id => (threatened != null && threatened.id == id ? 3 : 0) + (getAdjacent(id).concat(id).some(other => rivals.some(rival => shipsOf(other, rival.number) > 0)) ? 2 : 0) + getShips(id, n).fresh / 10;
        const system = getSystemIds().filter(id => getBuildings(id, null, "city").length > 0 && getController(id) == n).sort((a, b) => score(b) - score(a))[0];
        if (system != null) {
            add(1, "Summon", "build", "build 1 ship at " + getSystemName(system), (threatened != null && threatened.id == system ? "Its city there is threatened" : keen ? "It's keen to battle" : "It's short of ships") + ", and it controls the city at " + getSystemName(system) + ".", { kind: "summon", system: system });
        }
    }

    // Fire Rifles: skirmish dice (no risk to its ships) at Rival ships next to its fresh ones: the
    // leader's, or a fleet that's all damaged, first
    if (hasLore(player, 2)) {
        const shots = getSystemIds().filter(id => getShips(id, n).fresh > 0).flatMap(from => getAdjacent(from).flatMap(at => rivals.filter(rival => shipsOf(at, rival.number) > 0)
            .map(rival => ({ from: from, at: at, rival: rival, dice: getShips(from, n).fresh,
                score: getShips(from, n).fresh + (rival === leader ? 2 : 0) + (getShips(at, rival.number).fresh == 0 ? 2 : 0) }))));
        const shot = shots.sort((a, b) => b.score - a.score)[0];
        if (shot != null) {
            add(2, "Fire Rifles", "battle", shot.dice + " skirmish " + (shot.dice == 1 ? "die" : "dice") + " from " + getSystemName(shot.from) + " at Player " + shot.rival.number + "'s ships in " + getSystemName(shot.at),
                "No risk to its ships" + (shot.rival === leader ? ", and Player " + shot.rival.number + " leads" : getShips(shot.at, shot.rival.number).fresh == 0 ? ", and their ships there are all damaged" : "") + ".",
                { kind: "rifles", from: shot.from, at: shot.at, rival: shot.rival.number, dice: shot.dice });
        }
    }

    // Living Structures: Nurture taxes a city for a resource it's chasing; Prune turns one of its
    // starports into a city near the city bonus, or for a city type it wants
    const city = getCitiesToTax(player)[0];
    const cityAt = city != null ? getTaxableCities(n).find(item => item.owner == n && item.resource == city) : null;
    const wantsType = getNewCityResource(player);
    const prunable = getBoardBuildings(n, "starport").map(port => port.system).filter(id => isPlanet(id) && (wantsType == null || getPlanetResource(id) == wantsType));
    if (city != null && cityAt != null && !hasLeader(player, 13) && getResourceNeed(player, city) == 2 && getEmptySlots(player) > 0) {
        add(10, "Nurture", "build", "tax its " + preludeResourceNames[city].toLowerCase() + " city at " + getSystemName(cityAt.system), "It's chasing " + capitalise(preludeAmbitions[city] || "warlord") + ", and has that city.", null, { gains: { [city]: 1 } });
    } else if (getUncoveredCities(player) < maxCities && (player.starportsValue || 0) >= 2 && prunable.length > 0 && (isNearCityBonus(player) || wantsType != null)) {
        add(10, "Prune", "repair", "replace its starport at " + getSystemName(prunable[0]) + " with a city", isNearCityBonus(player) ? "Towards the city bonus, and it has starports to spare." : "It wants a " + preludeResourceNames[wantsType].toLowerCase() + " city, and has starports to spare.", { kind: "prune", system: prunable[0] });
    }

    // Guide: from a system with its fresh starport to an adjacent one or back: Rival ships off its
    // buildings there, or its own ships onto the Rival it means to battle
    if (hasLore(player, 16)) {
        const ports = getBoardBuildings(n, "starport").filter(port => !port.damaged).map(port => port.system);
        const awayTo = from => getAdjacent(from).filter(id => getBuildings(id, n).length == 0).sort((a, b) => shipsOf(a, n) - shipsOf(b, n))[0];
        const pushed = ports.flatMap(id => rivals.filter(rival => shipsOf(id, rival.number) > 0).map(rival => ({ from: id, rival: rival, to: awayTo(id) }))).filter(item => item.to != null)
            .sort((a, b) => shipsOf(b.from, b.rival.number) - shipsOf(a.from, a.rival.number))[0];
        const target = getBattleTarget(player);
        const targetNumber = target != null && typeof target.player.number == "number" ? target.player.number : null;
        const pulled = targetNumber == null ? null : ports.filter(id => getShips(id, n).fresh > 0).flatMap(from => getAdjacent(from).filter(at => shipsOf(at, targetNumber) > 0).map(at => ({ from: from, to: at })))[0];
        if (pushed != null) {
            const ships = getShips(pushed.from, pushed.rival.number);
            add(16, "Guide", "move", "move Player " + pushed.rival.number + "'s " + (ships.fresh + ships.damaged) + " ship" + (ships.fresh + ships.damaged == 1 ? "" : "s") + " " + getSystemName(pushed.from) + " &rarr; " + getSystemName(pushed.to),
                "Rival ships off its starport at " + getSystemName(pushed.from) + ".", { kind: "guide", from: pushed.from, to: pushed.to, owner: pushed.rival.number, fresh: ships.fresh, damaged: ships.damaged });
        } else if (pulled != null) {
            const ships = getShips(pulled.from, n);
            add(16, "Guide", "move", "move its " + (ships.fresh + ships.damaged) + " ships " + getSystemName(pulled.from) + " &rarr; " + getSystemName(pulled.to),
                "Onto Player " + targetNumber + ", the Rival it means to battle.", { kind: "guide", from: pulled.from, to: pulled.to, owner: n, fresh: ships.fresh, damaged: ships.damaged });
        }
    }

    // Martyr: 1 of its fresh ships for 1 Rival ship, taken as a Trophy: chasing Warlord, or when it
    // then controls a system with its buildings
    if (hasLore(player, 18)) {
        const gainsControl = (id, rival) => withBoardCopy(() => { removeShips(id, n, 1); removeShips(id, rival.number, 1, getShips(id, rival.number).fresh == 0); return getController(id) == n && getBuildings(id, n).length > 0; });
        const options = getSystemIds().filter(id => getShips(id, n).fresh > 0).flatMap(id => rivals.filter(rival => shipsOf(id, rival.number) > 0).map(rival => ({ id: id, rival: rival, control: gainsControl(id, rival) })))
            .filter(option => option.control || chasing("warlord")).sort((a, b) => Number(b.control) - Number(a.control) || Number(b.rival === leader) - Number(a.rival === leader));
        if (options.length > 0) {
            const option = options[0];
            add(18, "Martyr", "move", "destroy 1 of its fresh ships at " + getSystemName(option.id) + " to destroy 1 of Player " + option.rival.number + "'s there, taking it as a Trophy",
                option.control ? "It then controls " + getSystemName(option.id) + ", where its buildings are." : "It's chasing Warlord: a Trophy.", { kind: "martyr", system: option.id, rival: option.rival.number });
        }
    }

    // Annex: while Tyrant is declared, a Rival's building in a system it controls becomes its own,
    // a city first (while it has cities left to place)
    if (declaredAmbitions.includes("tyrant") && hasLore(player, 26)) {
        const citiesLeft = getUncoveredCities(player) < maxCities;
        const options = getSystemIds().filter(id => getController(id) == n).flatMap(id => getBuildings(id).filter(building => building.owner != n && (building.kind != "city" || citiesLeft)).map(building => ({ id: id, building: building })))
            .sort((a, b) => Number(b.building.kind == "city") - Number(a.building.kind == "city"));
        if (options.length > 0) {
            const option = options[0];
            add(26, "Annex", "build", "replace Player " + option.building.owner + "'s " + option.building.kind + " at " + getSystemName(option.id) + " with its own",
                "Tyrant is declared, and it controls " + getSystemName(option.id) + (option.building.kind == "city" ? ": their city goes back to their board." : "."), { kind: "annex", system: option.id, owner: option.building.owner, building: option.building.kind });
        }
    }
    return offers;
}

// The Lore actions' places on the board, carried out when ticked Completed or when its turn ends

function isLoreBoardStep(where) {
    return where != null && ["summon", "rifles", "prune", "guide", "martyr", "annex"].includes(where.kind);
}

function applyLoreBoardStep(player, where) {
    const n = player.number;
    if (where.kind == "summon") { addShips(where.system, n, 1); }
    if (where.kind == "prune" && removeBuilding(where.system, n, "starport")) { placeBuilding(where.system, n, "city"); }
    if (where.kind == "guide") { moveShips(where.from, where.to, where.owner, where.fresh, where.damaged); }
    if (where.kind == "martyr") {
        removeShips(where.system, n, 1);
        const rival = getPlayer(where.rival);
        removeShips(where.system, where.rival, 1, getShips(where.system, where.rival).fresh == 0);
        setPlayerResource(player, "trophies", (player.trophiesValue || 0) + 1);
        rival.shipsTrophy = (rival.shipsTrophy || 0) + 1;
        syncPanelFromBoard(rival);
    }
    if (where.kind == "annex" && removeBuilding(where.system, where.owner, where.building)) {
        placeBuilding(where.system, n, where.building);
        syncPanelFromBoard(getPlayer(where.owner));
    }
    if (where.kind == "rifles") { applyRiflesHits(player, where); }
}

function applyRiflesHits(player, where) {
    // Ships before buildings: a damaged ship is destroyed (a Trophy), then fresh ones are damaged;
    // then buildings likewise (the user agreed this order)
    const rival = getPlayer(where.rival);
    let trophies = 0;
    for (let hit = 0; hit < (where.hits || 0); hit++) {
        const ships = getShips(where.at, where.rival);
        const fresh = getBuildings(where.at, where.rival).find(building => !building.damaged);
        const damaged = getBuildings(where.at, where.rival).find(building => building.damaged);
        if (ships.damaged > 0) { removeShips(where.at, where.rival, 1, true); trophies++; rival.shipsTrophy = (rival.shipsTrophy || 0) + 1; }
        else if (ships.fresh > 0) { removeShips(where.at, where.rival, 1); addShips(where.at, where.rival, 1, true); }
        else if (fresh != null) { fresh.damaged = true; }
        else if (damaged != null) { removeBuilding(where.at, where.rival, damaged.kind); trophies++; }
    }
    if (trophies > 0) { setPlayerResource(player, "trophies", (player.trophiesValue || 0) + trophies); }
    syncPanelFromBoard(rival);
}

function showRiflesWindow(index) {
    // The hits can't be known, so the player says (the user's mock-up)
    const player = getTurnPlayer();
    const offer = player.guildActions.spent[index];
    const where = offer.where;
    riflesHits = Math.min(1, where.dice);
    const render = () => showLeaderWindow(player, "Fire Rifles", "<p class=\"mb-2\">Roll " + where.dice + " skirmish " + (where.dice == 1 ? "die" : "dice") + ". How many hits?</p>"
        + "<div class=\"d-flex justify-content-center mb-2\">" + getMoveStepper(riflesHits, "stepRiflesHits(-1, " + index + ")", "stepRiflesHits(1, " + index + ")") + "</div>"
        + "<p class=\"small text-muted\">Hits go on Player " + where.rival + "'s ships in " + getSystemName(where.at) + ": damaged ones are destroyed first, then fresh ones are damaged. It takes destroyed ships as Trophies.</p>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"closeLeaderWindow()\">Cancel</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"riflesApply\" onclick=\"confirmRifles(" + index + ")\">Apply to the board</button></div>");
    riflesRender = render;
    render();
}

let riflesHits = 0;
let riflesRender = null;

function stepRiflesHits(change, index) {
    const where = getTurnPlayer().guildActions.spent[index].where;
    riflesHits = Math.min(Math.max(riflesHits + change, 0), where.dice);
    if (riflesRender != null) { riflesRender(); }
}

function confirmRifles(index) {
    const player = getTurnPlayer();
    const offer = player.guildActions.spent[index];
    offer.where.hits = riflesHits;
    returnToTurnWindow = true;
    closeLeaderWindow();
    applyBotStep(player, offer);
    syncPanelFromBoard(player);
    SaveAllSettings();
}

function getLorePreludeOffers(player, wants, available) {
    // Lore in the bot's prelude. available is what it has left to spend, and is updated
    if (!leadersAndLore || (player.lore || []).length == 0) { return []; }
    const chasing = ambition => declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition);
    const lastCard = getUnplayedCards(player.cards).length == 0;
    let offers = [];
    let used = [];

    // Discard an ambition Lore card to clear an Outrage it minds
    const clears = [[19, ["psionics"]], [21, ["relics"]], [23, ["weapons"]], [25, ["weapons"]], [28, ["materials", "fuel"]]];
    clears.forEach(([number, resources]) => {
        if (!hasLore(player, number)) { return; }
        const outraged = resources.filter(resource => (player.outraged || []).includes(resource) && !offers.some(offer => (offer.clearsOutrage || []).includes(resource)));
        const minds = outraged.some(resource => resource == "weapons" ? isAmbitionInPlay("warlord") : getResourceNeed(player, resource) > 0);
        if (minds && wants(loreChance.clearOutrage)) {
            offers.push({ label: "Discard " + getLoreCard(number).name, text: "clear its " + outraged.map(resource => preludeResourceNames[resource]).join(" and ") + " Outrage",
                discardsLore: number, clearsOutrage: outraged, decided: true, why: "It's Outraged in a resource it needs." });
            used.push(number);
        }
    });
    const can = number => hasLore(player, number) && !used.includes(number);

    // Warlord's Terror: Trophies for influence, when Warlord isn't one it's chasing
    if (can(24) && declaredAmbitions.includes("warlord") && !chasing("warlord") && player.trophiesValue > 0 && !lastCard && wants(loreChance.terror)) {
        const count = Math.min(player.trophiesValue, 2);
        // The cards it would influence, with the Court entered (#88 group 4)
        const cards = isMarketKnown() ? getInfluenceSequence(player, count).map(entry => getCourtCard(entry.number).name) : [];
        offers.push({ label: "Warlord's Terror", text: "return " + count + " Troph" + (count == 1 ? "y" : "ies") + " to influence " + (cards.length > 0 ? cards.join(" and ") : (count == 1 ? "once" : "twice")),
            costs: { trophies: count }, action: "influence", decided: true, why: "Warlord is declared, and it isn't chasing it." });
    }

    // Tyrant's Ego: Captives to secure, when Tyrant isn't one it's chasing
    const toSecure = isMarketKnown() ? getCardsToSecure(player).length : 1;
    if (can(25) && declaredAmbitions.includes("tyrant") && !chasing("tyrant") && player.captivesValue > 0 && toSecure > 0 && wants(loreChance.ego)) {
        const count = Math.min(player.captivesValue, toSecure, 2);
        const cards = isMarketKnown() ? getCardsToSecure(player).slice(0, count).map(entry => getCourtCard(entry.number).name) : [];
        offers.push({ label: "Tyrant's Ego", text: "return " + count + " Captive" + (count == 1 ? "" : "s") + " to secure " + (cards.length > 0 ? cards.join(" and ") : (count == 1 ? "once" : "twice")),
            costs: { captives: count }, action: "secure", decided: true, why: "Tyrant is declared, and it isn't chasing it." });
    }

    // Tycoon's Ambition: give up its Material and Fuel to declare an ambition it does better in
    if (can(27) && declaredAmbitions.includes("tycoon") && !chasing("tycoon") && canDeclareAmbition(player) && wants(loreChance.tycoonsAmbition)) {
        const best = Object.keys(ambitionResources).filter(ambition => !declaredAmbitions.includes(ambition) && ambition != "tycoon")
            .map(ambition => ({ ambition: ambition, count: ambitionResources[ambition](player) }))
            .filter(option => option.count > 0 && getAmbitionPlacePoints(player, option.ambition, option.count) > 0)
            .sort((a, b) => b.count - a.count)[0];
        if (best != null) {
            const costs = { materials: available.materials, fuel: available.fuel };
            available.materials = 0; available.fuel = 0;
            offers.push({ label: "Tycoon's Ambition", text: "discard all its Material and Fuel to declare " + capitalise(best.ambition), costs: costs, declares: best.ambition, decided: true, why: "It isn't chasing Tycoon, and would place in " + capitalise(best.ambition) + "." });
            used.push(27);
        }
    }

    // Tycoon's Charm: Material and Fuel for a resource it's chasing
    const wanted = preludeResources.find(resource => resource != "materials" && resource != "fuel" && getResourceNeed(player, resource) == 2);
    const spare = available.materials + available.fuel;
    if (can(28) && declaredAmbitions.includes("tycoon") && !chasing("tycoon") && wanted != null && spare > 0 && wants(loreChance.charm)) {
        const costs = { materials: available.materials, fuel: available.fuel };
        available.materials = 0; available.fuel = 0;
        offers.push({ label: "Tycoon's Charm", text: "discard " + spare + " Material and Fuel to gain " + spare + " " + preludeResourceNames[wanted], costs: costs, gains: { [wanted]: spare }, decided: true, why: "It isn't chasing Tycoon, and needs " + getResourceWord(wanted) + " for " + capitalise(preludeAmbitions[wanted] || "warlord") + "." });
    }
    return offers;
}

function applyLorePrelude(player, offer) {
    // A Lore card discarded, and any Outrage it clears
    if (offer.discardsLore != null) { player.lore = (player.lore || []).filter(number => number != offer.discardsLore); }
    if (offer.clearsOutrage != null) { player.outraged = (player.outraged || []).filter(resource => !offer.clearsOutrage.includes(resource)); }
}

function getLeaderQuestionHint(player, action) {
    // A line under the Tax question, when its Leader or Lore changes what it can tax
    if (!leadersAndLore || action != "tax") { return ""; }
    let hint = null;
    if (hasLeader(player, 13)) { hint = ["bi-person-badge", "Anarchist: only a Rival's city, or an empty slot, in a system with its ships."]; }
    else if (hasLeader(player, 4)) { hint = ["bi-person-badge", "Upstart: only cities it controls, its own included."]; }
    else if (isLoreActive(player, 20, "empath")) { hint = ["bi-book", "Empath's Bond: any city counts, like its own."]; }
    return hint == null ? "" : "<div class=\"small text-muted mt-1\"><i class=\"bi " + hint[0] + "\"></i> " + hint[1] + "</div>";
}

// The board (#160): what Leaders and Lore change in moving, building and taxing. The board code
// calls these; without Leaders & Lore they change nothing

function getLeaderCatapult(from, playerNumber, base) {
    // Shaper (Ancient): Catapults from gates, never from starports. Empath's Bond: from any
    // starport, like its own, while Empath is declared
    const player = players.find(other => other.number == playerNumber);
    if (hasLeader(player, 14)) { return isGate(from); }
    return base || (isLoreActive(player, 20, "empath") && getBuildings(from, null, "starport").length > 0);
}

function getLoreExtraMoves(from, playerNumber, reached) {
    // Sprinter Drives: fresh ships may move one more time, after any Catapult
    const player = players.find(other => other.number == playerNumber);
    if (!hasLore(player, 3)) { return reached; }
    return [...new Set(reached.concat(reached.flatMap(id => getAdjacent(id))))].filter(id => id != from);
}

function getShipStarports(player) {
    // Where it can build ships: its starports, or any starport while Empath's Bond works
    const own = getBoardBuildings(player.number, "starport").map(port => port.system);
    if (!isLoreActive(player, 20, "empath")) { return [...new Set(own)]; }
    return [...new Set(own.concat(getSystemIds().filter(id => getBuildings(id, null, "starport").length > 0)))];
}

function canBuildCloudCity(id, playerNumber) {
    // Cloud Cities: a city on a planet outside its slots, 1 per planet, for 1 resource of its type,
    // where it has a piece
    const player = players.find(other => other.number == playerNumber);
    if (!hasLore(player, 9) || !isPlanet(id) || !hasLoyalPiece(id, playerNumber)) { return false; }
    return !getBuildings(id).some(building => building.cloud) && player[getPlanetResource(id) + "Value"] > 0;
}

function getCloudCitySystems(player) {
    // Planets it could build a Cloud City on: only where there's no slot left, with cities to place
    if (!hasLore(player, 9) || getUncoveredCities(player) >= maxCities) { return []; }
    return getSystemIds().filter(id => isPlanet(id) && getEmptySlotCount(id) == 0 && canBuildCloudCity(id, player.number));
}

function hasTacticalMove(player) {
    // Warrior (Tactical): a Copy or Pivot to Battle may Move before or after it
    const power = getCopyPivotPower(player, "battle");
    return power != null && power[0] == 6;
}

// Shaper (Mythic): a resource placed over a planet it taxes makes that its type from now on

function canMythic(player, system) {
    return hasLeader(player, 14) && isPlanet(system) && !(board.mythicPlanets || []).includes(system);
}

function setPlanetType(player, system, resource) {
    board.planetTypes = Object.assign({}, board.planetTypes, { [system]: resource });
    board.mythicPlanets = (board.mythicPlanets || []).concat(system);
    setPlayerResource(player, resource, Math.max(player[resource + "Value"] - 1, 0));
    // Cities there now count as the new type
    players.forEach(syncPanelFromBoard);
    SaveAllSettings();
}

function botMythic(player, system) {
    // The type it's chasing an ambition with, if it holds one and the planet isn't that already
    if (!canMythic(player, system)) { return; }
    const resource = preludeResources.find(item => item != getPlanetResource(system) && getResourceNeed(player, item) == 2 && player[item + "Value"] > 0);
    if (resource == null) { return; }
    setPlanetType(player, system, resource);
    addLeaderNote(player, "Mythic: " + getSystemShortName(system) + " is now a " + preludeResourceNames[resource] + " planet", "It placed 1 " + preludeResourceNames[resource] + " over the planet. Already on the app's board.");
}

function offerMythic(player, system) {
    // A human player chooses, or not
    if (!canMythic(player, system)) { return; }
    const held = preludeResources.filter(item => item != getPlanetResource(system) && player[item + "Value"] > 0);
    if (held.length == 0) { return; }
    queueLeaderWindow(() => showLeaderWindow(player, "Mythic", "<p class=\"mb-2\"><b>Shaper</b>: you may place 1 resource you have over " + getSystemName(system) + ". It becomes that type of planet from now on, and can't be changed again.</p>"
        + "<div class=\"d-flex flex-wrap gap-2 mb-3\">" + held.map(item => "<button type=\"button\" class=\"btn btn-outline-secondary flex-fill\" id=\"mythic_" + item + "\" onclick=\"confirmMythic(" + player.number + ", '" + system + "', '" + item + "')\">" + preludeResourceNames[item] + "</button>").join("") + "</div>"
        + "<button type=\"button\" class=\"btn btn-secondary w-100\" onclick=\"closeLeaderWindow()\">No thanks</button>"));
}

function confirmMythic(playerNumber, system, resource) {
    setPlanetType(getPlayer(playerNumber), system, resource);
    closeLeaderWindow();
}

function applyLeaderBattleRepairs(system) {
    // After a battle, on the board: Quartermaster (Resilient) repairs 1 of its ships there per
    // starport in systems it controls, whichever side it's on; Repair Drones repairs 1 attacking ship
    const repair = (player, count) => {
        const ships = getShips(system, player.number);
        const fixed = Math.min(count, ships.damaged);
        if (fixed > 0) { setShips(system, player.number, ships.fresh + fixed, ships.damaged - fixed); }
    };
    [battle.attacker, battle.defender].filter(player => player != null && typeof player.number == "number" && hasLeader(player, leaderNumbers.quartermaster)).forEach(player => {
        repair(player, getSystemIds().filter(id => getController(id) == player.number).reduce((total, id) => total + getBuildings(id, null, "starport").length, 0));
    });
    if (battle.attacker != null && hasLore(battle.attacker, loreNumbers.repairDrones)) { repair(battle.attacker, 1); }
}

function getLoreBuildDamaged(id, playerNumber, kind, base) {
    // Hidden Harbors: its ships are always built fresh
    const player = players.find(other => other.number == playerNumber);
    return kind == "ship" && hasLore(player, loreNumbers.hiddenHarbors) ? false : base;
}

function getLeaderMoveLimit(player) {
    // Rebel (Disorganized): no more than 2 ships at a time
    return hasLeader(player, leaderNumbers.rebel) ? 2 : Infinity;
}

function getLeaderScrappedShips(player) {
    // Overseer (Hated): 2 ships scrapped in setup, so never in its supply
    return hasLeader(player, 10) ? 2 : 0;
}

function getLeaderTaxableCities(playerNumber, cities) {
    // Anarchist: never its own cities (Principled), but Rival cities and empty slots in systems with
    // its ships, ignoring control (Inspiring). Upstart (Callow): its own cities only where it controls them
    const player = players.find(other => other.number == playerNumber);
    const listed = withEmpathsBond(player, getLeaderTaxableCitiesOwn(player, playerNumber, cities));
    return listed;
}

function withEmpathsBond(player, cities) {
    // Empath's Bond, while Empath is declared: any city, like its own, but no Captives
    if (!isLoreActive(player, 20, "empath")) { return cities; }
    const list = cities.slice();
    getSystemIds().forEach(id => getBuildings(id, null, "city").forEach(city => getCityTypes(id).forEach(resource => {
        if (!list.some(other => other.system == id && other.owner == city.owner && other.resource == resource)) { list.push({ system: id, owner: city.owner, resource: resource, gate: isGate(id), noCapture: true }); }
    })));
    return list;
}

function getLeaderTaxableCitiesOwn(player, playerNumber, cities) {
    if (hasLeader(player, 4)) { return cities.filter(city => city.owner != playerNumber || getController(city.system) == playerNumber); }
    if (!hasLeader(player, 13)) { return cities; }
    const list = cities.filter(city => city.owner != playerNumber);
    const add = item => { if (!list.some(other => other.system == item.system && other.owner == item.owner && other.resource == item.resource)) { list.push(item); } };
    getSystemIds().filter(id => getShips(id, playerNumber).fresh + getShips(id, playerNumber).damaged > 0).forEach(id => {
        getBuildings(id, null, "city").filter(city => city.owner != playerNumber).forEach(city => getCityTypes(id).forEach(resource => add({ system: id, owner: city.owner, resource: resource, gate: isGate(id) })));
        if (isPlanet(id) && getEmptySlotCount(id) > 0) { add({ system: id, owner: playerNumber, resource: getPlanetResource(id), slot: true }); }
    });
    return list;
}

function applyLeaderTaxBonus(player) {
    // Mystic (Attuned), Fuel-Drinker (Insatiable), Agitator (Firebrand): 1 more resource when it
    // Copies or Pivots to Tax, if there's one left and room for it
    const power = getCopyPivotPower(player, "tax");
    if (power == null) { return; }
    const resource = { 2: "psionics", 3: "fuel", 15: "weapons" }[power[0]];
    if (resource == null || getResourceSupply(resource) == 0 || getEmptySlots(player) == 0) { return; }
    setPlayerResource(player, resource, player[resource + "Value"] + 1);
    if (player.isHuman) { showMessageToast(power[1], "1 " + preludeResourceNames[resource] + " added too."); }
    else { addLeaderNote(player, power[1] + ": gained 1 " + preludeResourceNames[resource], "Already added to its tiles."); }
}

function hasLoreOffers(offers) {
    return (offers || []).some(offer => offer.lore != null);
}