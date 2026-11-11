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
    const wanted = courtMarket.filter(entry => getMarketCardValue(player, entry) > marketValues.base);
    if (wanted.length == 0) { addLeaderNote(player, "Bold: nothing in the Court it wants"); return; }
    wanted.forEach(entry => { entry.agents[player.number] = (entry.agents[player.number] || 0) + 1; });
    addLeaderNote(player, "Bold: placed 1 agent on " + wanted.map(entry => getCourtCard(entry.number).name).join(" and "), "Already added in the Court window. Place them on the table.");
}

// Noble (Connected)

function showConnected(player) {
    // The app can't see the Court deck, so the player says what was drawn
    const choices = courtCards.filter(card => !courtMarket.some(entry => entry.number == card.number) && getGuildCardHolder(card.number) == null).sort(byCardName);
    const you = player.isHuman ? "You" : "Player " + player.number;
    showLeaderWindow(player, "Connected", "<p class=\"mb-2\">" + you + " declared an ambition that wasn't declared, so <b>Noble</b> draws and secures the top card of the Court deck. Which card was it?</p>"
        + "<select class=\"form-select mb-3\" id=\"connectedCard\">" + choices.map(card =>
            "<option value=\"" + card.number + "\">" + card.name + (card.type == "vox" ? " (Vox)" : " (" + preludeResourceNames[card.resource] + ")") + "</option>").join("") + "</select>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"closeLeaderWindow()\">The deck is empty</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"connectedSecure\" onclick=\"confirmConnected(" + player.number + ")\">Secure it</button></div>"
        + "<div class=\"small text-muted mt-2\">" + (player.isHuman ? "You" : "It") + " can't use its Prelude action this turn.</div>");
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

function getLeaderBattleSetupNote() {
    // Before the dice: Predictive Sensors lets the defender move ships in first
    if (hasLore(battle.defender, loreNumbers.predictiveSensors)) {
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
    const keen = chasing("warlord") || player.shipsBoardValue >= manyShipsOnBoard;
    let offers = [];
    const add = (number, name, action, chance, text, extras) => {
        if (hasLore(player, number) && can(action) && wants(chance)) {
            offers.push(Object.assign({ label: name + " instead of " + replacedActionNames[action] + " (" + getLoreCard(number).name + ")", text: text, lore: number }, extras));
        }
    };

    if (player.shipsBoardValue < fewShipsOnBoard || keen) { add(1, "Summon", "build", loreChance.summon, "build 1 ship at any city it controls, even a Rival's"); }
    if (keen && player.shipsBoardValue > 0) {
        add(2, "Fire Rifles", "battle", loreChance.rifles, "roll skirmish dice for its fresh ships in a system, at a Rival in an adjacent system (hit ships before buildings)");
    }
    const city = getCitiesToTax(player)[0];
    if (city != null && !hasLeader(player, 13) && getResourceNeed(player, city) == 2 && getEmptySlots(player) > 0) {
        add(10, "Nurture", "build", loreChance.nurture, "tax its " + preludeResourceNames[city].toLowerCase() + " city", { gains: { [city]: 1 } });
    } else if (isNearCityBonus(player)) {
        add(10, "Prune", "repair", loreChance.prune, "replace one of its starports with a city, towards the city bonus");
    }
    if (player.shipsBoardValue > 0 && getMoveGoal(player) != null) {
        add(16, "Guide", "move", loreChance.guide, "move any ships, even Rivals', between a system with its fresh starport and an adjacent one: its own towards a target, or Rival ships away from its buildings");
    }
    if (chasing("warlord") && player.shipsBoardValue > 0) {
        add(18, "Martyr", "move", loreChance.martyr, "destroy 1 of its fresh ships to destroy 1 Rival ship in that system, taking it as a Trophy (update both panels yourself)");
    }
    if (declaredAmbitions.includes("tyrant")) {
        add(26, "Annex", "build", loreChance.annex, "replace a Rival's city or starport it controls with its own (their city goes back to their board)");
    }
    return offers;
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
                discardsLore: number, clearsOutrage: outraged });
            used.push(number);
        }
    });
    const can = number => hasLore(player, number) && !used.includes(number);

    // Warlord's Terror: Trophies for influence, when Warlord isn't one it's chasing
    if (can(24) && declaredAmbitions.includes("warlord") && !chasing("warlord") && player.trophiesValue > 0 && !lastCard && wants(loreChance.terror)) {
        const count = Math.min(player.trophiesValue, 2);
        offers.push({ label: "Warlord's Terror", text: "return " + count + " Troph" + (count == 1 ? "y" : "ies") + " to influence " + (count == 1 ? "once" : "twice"), costs: { trophies: count } });
    }

    // Tyrant's Ego: Captives to secure, when Tyrant isn't one it's chasing
    const toSecure = isMarketKnown() ? getCardsToSecure(player).length : 1;
    if (can(25) && declaredAmbitions.includes("tyrant") && !chasing("tyrant") && player.captivesValue > 0 && toSecure > 0 && wants(loreChance.ego)) {
        const count = Math.min(player.captivesValue, toSecure, 2);
        offers.push({ label: "Tyrant's Ego", text: "return " + count + " Captive" + (count == 1 ? "" : "s") + " to secure " + (count == 1 ? "once" : "twice"), costs: { captives: count } });
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
            offers.push({ label: "Tycoon's Ambition", text: "discard all its Material and Fuel to declare " + capitalise(best.ambition), costs: costs, declares: best.ambition });
            used.push(27);
        }
    }

    // Tycoon's Charm: Material and Fuel for a resource it's chasing
    const wanted = preludeResources.find(resource => resource != "materials" && resource != "fuel" && getResourceNeed(player, resource) == 2);
    const spare = available.materials + available.fuel;
    if (can(28) && declaredAmbitions.includes("tycoon") && !chasing("tycoon") && wanted != null && spare > 0 && wants(loreChance.charm)) {
        const costs = { materials: available.materials, fuel: available.fuel };
        available.materials = 0; available.fuel = 0;
        offers.push({ label: "Tycoon's Charm", text: "discard " + spare + " Material and Fuel to gain " + spare + " " + preludeResourceNames[wanted], costs: costs, gains: { [wanted]: spare } });
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

function hasLoreOffers(offers) {
    return (offers || []).some(offer => offer.lore != null);
}