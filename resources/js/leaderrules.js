// Leaders & Lore, part 2 (#88): the Leader and Lore rules for scoring, declaring an ambition,
// securing and battles. The cards themselves are in leaders.js. Bots carry their effects out
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
    document.getElementById("guildBody").innerHTML = html;
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
