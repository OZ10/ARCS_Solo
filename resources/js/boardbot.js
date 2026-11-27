// The bots and the board (#160): what's in each system answers most of the questions a bot used to
// ask: its biggest fleet, whether there's an empty slot, and whether it can tax, raid or battle, now
// or after one Move. The rest (its agents, the Court) are still asked (board.js).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getRivalNumbers(player) {
    return players.filter(other => other !== player).map(other => other.number);
}

function getRivalShipCount(id, playerNumber) {
    // Every ship of its Rivals there, fresh and damaged
    return Object.entries(getSystem(id).ships).filter(([number]) => Number(number) != playerNumber).reduce((total, [, ships]) => total + ships.fresh + ships.damaged, 0);
}

function hasRivalPieces(id, player) {
    // In a campaign, Blight, and the Empire's ships for an Outlaw, are something to battle too (#85)
    return getRivalShipCount(id, player.number) > 0 || getBuildings(id).some(building => building.owner != player.number)
        || hasBlight(id) || (isOutlawNumber(player.number) && hasImperialShips(id));
}

// The campaign's own targets on the board (#85 stage 7b): the Free States, the Blight and the Empire

function isSpecialTargetIn(id, option) {
    if (option.kind == "free") { return getBuildings(id, freeOwner).some(building => option.resource == null || getPlanetResource(id) == option.resource); }
    if (option.kind == "blight") { return hasBlight(id); }
    return hasImperialShips(id);
}

function getSpecialTargetNeeded(id, option) {
    // Fresh ships it wants there: enough for the Blight's toughness, more than the Imperial ships.
    // Only damaged Blight needs fewer (the user, 2026-11-27)
    if (option.kind == "blight") { const blight = getBlight(id); return blight.fresh > 0 ? blightFleet : Math.min(blight.damaged + 1, blightFleet); }
    if (option.kind == "empire") { return getImperial(id).fresh + 1; }
    return 1;
}

function findSpecialTargetSystem(player, option) {
    // Where its fresh ships already are with enough, or one Move away (with a card or a Fuel that
    // can Move), or null: the board answers "Is it in reach?"
    // Blight on its own buildings first: it hits the ships guarding them, and destroys them if none are left
    const own = id => option.kind == "blight" && getBuildings(id, player.number).length > 0 ? 1 : 0;
    const here = getSystemIds().filter(id => isSpecialTargetIn(id, option) && getShips(id, player.number).fresh >= getSpecialTargetNeeded(id, option))
        .sort((a, b) => own(b) - own(a) || getShips(b, player.number).fresh - getShips(a, player.number).fresh)[0];
    if (here != null) { return here; }
    const canMoveFirst = getBotPlay(player) != null ? canBotTakeAction(player, "move")
        : getFleetMove(player) != null || getBotCards(player).some(card => card.actions.includes("move"));
    return canMoveFirst ? (getReachableTargets(player, id => isSpecialTargetIn(id, option), id => getSpecialTargetNeeded(id, option))[0] || null) : null;
}

function getSpecialTargetSystem(player) {
    const target = player.campaignTarget;
    return target != null && target.system != null ? target.system : null;
}

function getMoveSources(player, to) {
    // Systems with its fresh ships that can reach to with one Move, most ships first
    return getSystemsWithShips(player.number).filter(from => from != to && getShips(from, player.number).fresh > 0 && canMove(from, to, player.number))
        .sort((a, b) => getShips(b, player.number).fresh - getShips(a, player.number).fresh);
}

// A Rival its ships can't reach this turn is a poor battle target, and one with a building it can
// reach that no ships guard is a good one (turnplan.js getBattleTarget)
const unreachableTargetPenalty = -100;
const exposedBuildingBonus = 2;
// A Rival's city it can destroy for little Outrage, holding the Loyal card of that type (#208)
const loyalCityBonus = 1.5;

function getExposedBuildings(player, rival) {
    // The Rival's buildings with none of their ships, in systems its ships are in or can reach
    // In a campaign, not where it can't battle them (the Truce Law), nor a Regent's with Imperial ships
    // there against an Outlaw: they defend it (the user, 2026-11-27)
    const guarded = id => campaignMode && getSystem(id).imperial != null && hasImperialShips(id) && isOutlawNumber(player.number) && isRegentNumber(rival.number);
    return getSystemIds().filter(id => getBuildings(id, rival.number).length > 0 && getShips(id, rival.number).fresh + getShips(id, rival.number).damaged == 0
        && canBattleIn(id, player.number, rival.number) && !guarded(id)
        && (getShips(id, player.number).fresh > 0 || getMoveSources(player, id).length > 0));
}

// Battles worth fighting (#198): one die per attacking ship, fresh or damaged (rulebook p.14)
const poorOddsPenalty = -6;

function getBattleOdds(player, rival, id, extra = 0) {
    // { mine, theirs, theirFresh }: its ships there (plus extra moving in) against the Rival's
    const ships = getShips(id, player.number), theirs = getShips(id, rival.number);
    const odds = { mine: ships.fresh + ships.damaged + extra, theirs: theirs.fresh + theirs.damaged, theirFresh: theirs.fresh };
    // In a campaign, Imperial ships there take a side (the user, 2026-11-27): they defend a Regent
    // against an Outlaw, and join a Regent's attack on an Outlaw, 1 for each of its own ships
    if (campaignMode && typeof rival.number == "number" && getSystem(id).imperial != null) {
        const imperial = getImperial(id);
        if (isOutlawNumber(player.number) && isRegentNumber(rival.number)) { odds.theirs += imperial.fresh + imperial.damaged; odds.theirFresh += imperial.fresh; }
        else if (isRegentNumber(player.number) && isOutlawNumber(rival.number)) { odds.mine += Math.min(imperial.fresh, odds.mine); }
    }
    return odds;
}

function isEarlyCampaign() {
    // The first two chapters of Act I: bots spread out, clear the Blight and build (the user, 2026-11-27)
    return campaignMode && typeof campaign != "undefined" && campaign != null && campaign.act == 1 && roundNumber <= 2;
}

function getUsefulRivalBattle(player) {
    // In a campaign, a battle with a Rival needs a reason, not just a fleet to do it with (the user,
    // 2026-11-27): chasing Warlord or Tyrant, raiding what it's chasing, slowing the leader, a building
    // with no ships guarding it (nor Imperial ships, against an Outlaw), a city it can destroy cheaply
    // (a Loyal card), or its Fate. { rival, reason } or null. Only where it can win (#198)
    const chasing = ambition => declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition);
    const chased = preludeResources.filter(resource => getResourceNeed(player, resource) == 2);
    const leader = getLeader(player);
    const steer = runCampaignHook("planSteer", player, "battle");
    for (const rival of players.filter(other => other !== player && hasFavourableBattle(player, other))) {
        if (chasing("warlord")) { return { rival: rival, reason: "chasing Warlord" }; }
        if (chasing("tyrant")) { return { rival: rival, reason: "chasing Tyrant" }; }
        const held = chased.find(resource => rival[resource + "Value"] + getStealableIconCount(rival, resource) > 0);
        if (held != null) { return { rival: rival, reason: "Player " + rival.number + " holds " + preludeResourceNames[held] + ", which it's chasing" }; }
        if (rival === leader) { return { rival: rival, reason: "to slow the leader, Player " + rival.number }; }
        if (getExposedBuildings(player, rival).length > 0) { return { rival: rival, reason: "Player " + rival.number + "'s building in reach has no ships guarding it" }; }
        if (getLoyalCities(player, rival).length > 0) { return { rival: rival, reason: "Player " + rival.number + "'s city it can destroy for little Outrage" }; }
        if (steer != null && (steer.add || 0) > 0) { return { rival: rival, reason: steer.reason || "for its Fate" }; }
    }
    return null;
}

function isFavourableBattle(odds) {
    // As many ships as theirs, or all of theirs damaged: one hit each takes a Trophy
    return odds.mine > 0 && (odds.mine >= odds.theirs || odds.theirFresh == 0);
}

function canBattleIn(id, attackerNumber, defenderNumber) {
    // The campaign's Truce Law, and its Ceasefires (campaign/fateboard.js): at Peace only with a Weapon to spend
    if (typeof canHarmIn == "function" && !canHarmIn(id, attackerNumber, defenderNumber)) { return false; }
    return !(typeof isCeasefireBlocked == "function" && board.clusterTokens != null && isCeasefireBlocked(id, attackerNumber));
}

function canFightNow(player, rival) {
    // It already shares a system with this Rival, and the odds there are good (#188)
    return getSystemIds().some(id => {
        const mine = getShips(id, player.number);
        if (mine.fresh + mine.damaged == 0) { return false; }
        if (!(getShips(id, rival.number).fresh + getShips(id, rival.number).damaged > 0 || getBuildings(id, rival.number).length > 0)) { return false; }
        if (!canBattleIn(id, player.number, rival.number)) { return false; }
        return isFavourableBattle(getBattleOdds(player, rival, id));
    });
}

function hasFavourableBattle(player, rival, canMoveOverride = null) {
    // Somewhere it can battle this Rival at good odds: where its ships are, or with its biggest
    // fleet moved in first when it can Move (canMoveOverride: whether it can, if already known)
    const hasPieces = id => (getShips(id, rival.number).fresh + getShips(id, rival.number).damaged > 0 || getBuildings(id, rival.number).length > 0)
        // The campaign's Truce Law, where that branch has it
        && canBattleIn(id, player.number, rival.number);
    const canMoveFirst = canMoveOverride != null ? canMoveOverride : getBotPlay(player) != null ? canBotTakeAction(player, "move")
        : getFleetMove(player) != null || getBotCards(player).some(card => card.actions.includes("move"));
    return getSystemIds().filter(hasPieces).some(id => {
        if (isFavourableBattle(getBattleOdds(player, rival, id))) { return getShips(id, player.number).fresh + getShips(id, player.number).damaged > 0; }
        if (!canMoveFirst) { return false; }
        const fleet = Math.max(0, ...getMoveSources(player, id).map(from => getShips(from, player.number).fresh));
        return fleet > 0 && isFavourableBattle(getBattleOdds(player, rival, id, fleet));
    });
}

function hasRepeatableBattle(player) {
    // A battle at good odds where the Rival has 2 or more pieces: attacking again can clear most or
    // all of them, so more than one Battle is worth planning (#200 phase 3, the user)
    return getSystemIds().some(id => players.some(rival => {
        if (rival === player) { return false; }
        if (!canBattleIn(id, player.number, rival.number)) { return false; }
        const odds = getBattleOdds(player, rival, id);
        return odds.mine > 0 && isFavourableBattle(odds) && odds.theirs + getBuildings(id, rival.number).length >= 2;
    }));
}

function getBattleTargetBoardBonus(player, rival) {
    if (!canReachRival(player, rival)) { return unreachableTargetPenalty; }
    // Only at poor odds: much less worth it (#198)
    if (!hasFavourableBattle(player, rival)) { return poorOddsPenalty; }
    return getExposedBuildings(player, rival).length > 0 ? exposedBuildingBonus : 0;
}

// Loyal Guild cards (#208): keeping the card and its Prelude action through Outrage makes
// destroying a Rival city of that type cheap

function getLoyalTypes(player) {
    return getPlayerGuildCards(player).filter(card => card.keepOnOutrage).map(card => card.resource);
}

function getLoyalCities(player, rival, fightNow = false) {
    // The Rival's cities of a type it holds a Loyal card for, where its fresh ships are (or can reach)
    const types = getLoyalTypes(player);
    if (types.length == 0 || !canRansackAgainst(rival)) { return []; }
    return getBoardCities(rival.number).filter(city => getCityTypes(city.system).some(resource => types.includes(resource))
        && (getShips(city.system, player.number).fresh > 0 || (!fightNow && getMoveSources(player, city.system).length > 0)));
}

function getLoyalCityBonus(player, rival) {
    return getLoyalCities(player, rival).length > 0 ? loyalCityBonus : 0;
}

function isOutrageComing(player, resource) {
    // It means to battle a Rival with a city of this type where its ships are, holding the Loyal card
    // for it: Outrage would discard what it holds of it, so it may as well spend it first (#208)
    const target = typeof player.battleTargetNumber == "number" ? getPlayer(player.battleTargetNumber) : null;
    return target != null && getLoyalTypes(player).includes(resource) && getLoyalCities(player, target, true).some(city => getCityTypes(city.system).includes(resource));
}

function getThreatenedCity(player) {
    // One of its cities that a Rival's fresh ships could reach this turn with more ships than it
    // has there: the most threatened first
    const threat = id => Math.max(0, ...getRivalNumbers(player).flatMap(number => getSystemsWithShips(number)
        .filter(from => from == id || canMove(from, id, number)).map(from => getShips(from, number).fresh)));
    return getBoardCities(player.number).map(city => city.system)
        .map(id => ({ id: id, gap: threat(id) - getShips(id, player.number).fresh })).filter(item => item.gap > 0)
        .sort((a, b) => b.gap - a.gap)[0] || null;
}

function getCityWorth(player, id) {
    // What its city here is worth to it (#207): 1, plus how much it needs that type (2 for an ambition
    // it's chasing, so a Relic city with Keeper declared). 0 if it has no city here. A gate city
    // counts its best type
    if (getBuildings(id, player.number, "city").length == 0) { return 0; }
    return 1 + Math.max(0, ...getCityTypes(id).map(resource => getOutrageNeed(player, resource)));
}

function getRivalReach(player) {
    // Each system Rivals' fresh ships could move into this turn, and the most that could get there
    const reach = {};
    getRivalNumbers(player).forEach(number => getSystemsWithShips(number).forEach(from => {
        const fresh = getShips(from, number).fresh;
        if (fresh > 0) { getMoveDestinations(from, number).forEach(id => { reach[id] = Math.max(reach[id] || 0, fresh); }); }
    }));
    return reach;
}

function getGateHoldValue(player, gate) {
    // What holding this gate protects: its buildings a Rival fleet could reach with more fresh ships
    // than it has there, only by Catapulting through the gate. A Catapult stops in a gate someone
    // else controls (rulebook p.13). { count, cities, need }: need is the fresh ships it must add
    const number = player.number;
    const control = Math.max(0, ...getRivalNumbers(player).map(rival => getShips(gate, rival).fresh)) + 1;
    const exposed = ships => withBoardCopy(() => {
        setShips(gate, number, ships, getShips(gate, number).damaged);
        const reach = getRivalReach(player);
        return getBoardBuildings(number).filter(building => (reach[building.system] || 0) > getShips(building.system, number).fresh);
    });
    const held = exposed(control);
    const saved = exposed(0).filter(building => !held.some(other => other.system == building.system && other.kind == building.kind));
    return { count: saved.length, cities: [...new Set(saved.filter(building => building.kind == "city").map(building => building.system))], need: Math.max(control - getShips(gate, number).fresh, 0) };
}

function getGatesToHold(player) {
    // The gates it doesn't control whose control protects some of its buildings from Catapults, those
    // protecting most first, its cities first (the user): [{ id, need, count, cities }]
    return getSystemIds().filter(isGate).filter(id => getController(id) != player.number)
        .map(id => ({ id: id, ...getGateHoldValue(player, id) })).filter(item => item.count > 0 && item.need > 0)
        .sort((a, b) => b.cities.length - a.cities.length || b.count - a.count);
}

function getHomeGate(player) {
    // A cluster with 2 or more of its buildings whose gate it doesn't control: holding the gate
    // guards them (the user). The gate's id, or null
    const clusters = {};
    getBoardBuildings(player.number).forEach(building => { const cluster = getCluster(building.system); clusters[cluster] = (clusters[cluster] || 0) + 1; });
    const gate = Object.keys(clusters).filter(cluster => clusters[cluster] >= 2).map(cluster => cluster + "g")
        .filter(id => isSystemInPlay(id) && getSystem(id) != null && getController(id) != player.number)
        .sort((a, b) => clusters[getCluster(b)] - clusters[getCluster(a)])[0];
    return gate || null;
}

function canReachRival(player, rival) {
    // Its fresh ships already with the Rival's pieces, or one Move away (if it can Move)
    // Not where the Truce Law shields a Rival Regent (#85, #180)
    const hasPieces = id => (getShips(id, rival.number).fresh + getShips(id, rival.number).damaged > 0 || getBuildings(id, rival.number).length > 0) && canBattleIn(id, player.number, rival.number);
    // Once its card is played, only that card (and its prelude) can Move it, not the rest of its hand (#188)
    const canMoveFirst = getBotPlay(player) != null ? canBotTakeAction(player, "move")
        : getFleetMove(player) != null || getBotCards(player).some(card => card.actions.includes("move"));
    return getSystemsWithShips(player.number).some(from => getShips(from, player.number).fresh > 0
        && (hasPieces(from) || (canMoveFirst && getMoveDestinations(from, player.number).some(hasPieces))));
}

// Fleets: the biggest group of fresh ships already with a Rival's pieces, or (when it can Move
// first) that one Move could bring to them

function getBoardFleet(player, canMoveFirst) {
    let best = { size: 0, from: null, to: null };
    getSystemsWithShips(player.number).forEach(from => {
        const fresh = getShips(from, player.number).fresh;
        if (fresh <= best.size) { return; }
        if (hasRivalPieces(from, player)) { best = { size: fresh, from: from, to: from }; return; }
        if (canMoveFirst) {
            const to = getMoveDestinations(from, player.number).find(id => hasRivalPieces(id, player));
            if (to != null) { best = { size: fresh, from: from, to: to }; }
        }
    });
    return best;
}

function setFleetFromBoard(player) {
    // In place of asking (turnplan.js): once a turn, as the answer would have been
    if (player.attackFleetSize != null) { return; }
    const move = getFleetMove(player);
    const fleet = getBoardFleet(player, move != null);
    player.attackFleetSize = fleet.size;
    player.attackFleetMove = (fleet.from != null && fleet.from != fleet.to) ? move : null;
    player.attackFleetFrom = fleet.from;
    player.attackFleetTo = fleet.to;
}

// Building: where there's an empty slot it can use

function getBoardSlotResources(player) {
    // The planet types with an empty slot in a system where it has a piece (rulebook p.12)
    // A gate it may build a city on (Gate Stations) offers each type of city in its cluster
    return [...new Set(getBuildableSystems(player.number).flatMap(id => isPlanet(id) ? [getPlanetResource(id)]
        : (getGateBuildKinds(id, player.number).includes("city") ? getGateCityTypes(id) : []))
        // Cloud Cities: planets it could build a city on outside the slots (leaderrules.js)
        .concat(getCloudCitySystems(player).map(getPlanetResource)))];
}

function canBuildFromBoard(player, intent) {
    if (intent == null) { return false; }
    if (intent.build == "ship") { return getBoardBuildings(player.number, "starport").length > 0; }
    const slots = getBoardSlotResources(player);
    if (intent.build == "starport" || intent.resources == null) { return slots.length > 0; }
    return slots.some(resource => intent.resources.includes(resource));
}

// The ambition questions (rules.js ambitionQuestionActions): true, false, or null when the board
// can't say (the Court)

function getTaxableTargets(player, resources) {
    // Its cities, and Rival cities in systems it controls, of these types (any, for null), with
    // some left in the supply. A Rival's city only for capturing (Tyrant)
    return getTaxableCities(player.number).filter(city => (resources == null || resources.includes(city.resource)) && getResourceSupply(city.resource) > 0);
}

function getRaidTargets(player, resources) {
    // Systems where it has fresh ships and a Rival holding these resources has a building, or
    // their ships if they have no buildings on the board (rulebook p.16)
    const holders = getRaidHolders(player, resources).map(holder => holder.player.number);
    return getSystemIds().filter(id => getShips(id, player.number).fresh > 0 && holders.some(number =>
        getBuildings(id, number).length > 0 || (getBoardBuildings(number).length == 0 && getShips(id, number).fresh + getShips(id, number).damaged > 0)));
}

function getOutnumberedSystems(player) {
    // Systems where its fresh ships outnumber a Rival's ships there
    return getSystemIds().filter(id => {
        const own = getShips(id, player.number).fresh;
        return own > 0 && getRivalNumbers(player).some(number => { const theirs = getShips(id, number); return theirs.fresh + theirs.damaged > 0 && own > theirs.fresh + theirs.damaged; });
    });
}

function getReachableTargets(player, isTarget, needed = () => 1) {
    // Systems it could Move into this turn that pass isTarget, with enough fresh ships to bring
    return getSystemIds().filter(to => isTarget(to) && getMoveSources(player, to).some(from => getShips(from, player.number).fresh + getShips(to, player.number).fresh >= needed(to)));
}

function getBoardAnswer(ambition, action, player) {
    const resources = ambitionTaxResources[ambition] || null;
    const tyrant = ambition == "TYRANT";
    switch (action) {
        case "tax": {
            const targets = getTaxableTargets(player, resources);
            return (tyrant ? targets.some(city => city.owner != player.number) : targets.length > 0);
        }
        case "reachTax": {
            // A Rival's city of the type, where it could bring more fresh ships than they have
            const rivalCity = id => getBuildings(id, null, "city").some(city => city.owner != player.number && (resources == null || resources.includes(getPlanetResource(id))) && getResourceSupply(getPlanetResource(id)) > 0);
            const needed = id => Math.max(...getRivalNumbers(player).map(number => getShips(id, number).fresh), 0) + 1;
            return getReachableTargets(player, rivalCity, needed).length > 0;
        }
        case "battle":
            if (ambition == "WARLORD") { return getOutnumberedSystems(player).length > 0; }
            if (tyrant) { return getSystemIds().some(id => getShips(id, player.number).fresh > 0 && getBuildings(id, null, "city").some(city => city.owner != player.number)); }
            return getRaidTargets(player, resources).length > 0;
        case "reachBattle":
            return getReachableTargets(player, id => getRivalShipCount(id, player.number) > 0, id => getRivalShipCount(id, player.number) + 1).length > 0;
        case "reachRaid": {
            const holders = getRaidHolders(player, resources).map(holder => holder.player.number);
            return getReachableTargets(player, id => holders.some(number => getBuildings(id, number).length > 0)).length > 0;
        }
        default:
            return null;
    }
}

// Where each step of a bot's plan happens. Worked out on a copy of the board, so a Move is where
// the next step's ships are. Each step gets where: { from, to, count } for a Move, { system, kind }
// for a Build, { system } for the others

function getUsefulMoveCount(player, most = 3) {
    // How many Moves the board has a use for this turn, one after another, never back the way it
    // came (#197)
    let count = 0;
    withBoardCopy(() => {
        // After its prelude's Moves and Builds, which come first (#203)
        const spent = getBotPreludeSpent(player).filter(offer => offer.where != null && !offer.applied);
        spent.forEach(offer => applyBoardStep(player, offer.where));
        const movedFrom = spent.filter(offer => offer.where.from != null).map(offer => offer.where.from);
        while (count < most) {
            const where = chooseBoardMove(player, null, getNewCityResource(player), movedFrom);
            if (where == null) { break; }
            movedFrom.push(where.from);
            applyBoardStep(player, where);
            count++;
        }
    });
    return count;
}

function getNextBoardMove(player) {
    // The board's best Move once its prelude's Moves and Builds are made, never back the way
    // they came. null if there's no other useful one (#203)
    return withBoardCopy(() => {
        const spent = getBotPreludeSpent(player).filter(offer => offer.where != null && !offer.applied);
        spent.forEach(offer => applyBoardStep(player, offer.where));
        const movedFrom = spent.filter(offer => offer.where.from != null).map(offer => offer.where.from);
        return chooseBoardMove(player, null, getNewCityResource(player), movedFrom);
    });
}

function withBoardCopy(work) {
    // Runs work on a copy of the board, then puts the real one back
    const real = board;
    board = JSON.parse(JSON.stringify(real));
    try { return work(); } finally { board = real; }
}

function getBattleSystem(player, targetNumber) {
    // Where its fresh ships meet the target's pieces: where it outnumbers them most, an unguarded
    // building of theirs first (raid dice there)
    // All its ships roll dice, damaged ones too (rulebook p.14); all of theirs damaged is a good edge (#198)
    const edge = id => getShips(id, player.number).fresh + getShips(id, player.number).damaged - getShips(id, targetNumber).fresh - getShips(id, targetNumber).damaged
        + (getShips(id, targetNumber).fresh == 0 && getShips(id, targetNumber).damaged > 0 ? 2 : 0)
        + (getBuildings(id, targetNumber).length > 0 && getShips(id, targetNumber).fresh + getShips(id, targetNumber).damaged == 0 ? exposedBuildingBonus : 0);
    return getSystemIds().filter(id => getShips(id, player.number).fresh > 0 && (getShips(id, targetNumber).fresh + getShips(id, targetNumber).damaged > 0 || getBuildings(id, targetNumber).length > 0)
        && canBattleIn(id, player.number, targetNumber))
        .sort((a, b) => edge(b) - edge(a))[0] || null;
}

function chooseBoardMove(player, battleTarget, wantsCity, avoid = []) {
    // No more ships than its Leader lets it move at a time (Rebel, Disorganized: leaderrules.js)
    const where = chooseBoardMoveAny(player, battleTarget, wantsCity, avoid);
    return where == null ? null : addDamagedShips(player, { ...where, count: Math.min(where.count, getLeaderMoveLimit(player)) });
}

function addDamagedShips(player, where) {
    // Its damaged ships go too (the user, 2026-11-27, #214): with the fleet when all its fresh ships
    // leave, so they aren't left alone and easy to destroy; and into a battle, where they roll dice too.
    // Otherwise they stay with the fresh ships left behind. Not on a Sprinter Drives step (fresh only)
    if (where == null || where.from == null) { return where; }
    const ships = getShips(where.from, player.number);
    if (ships.damaged == 0 || !getMoveDestinations(where.from, player.number, where.count, true).includes(where.to)) { return { ...where, damaged: 0 }; }
    const leavingAll = where.count >= ships.fresh;
    const toBattle = /battle/.test(where.why || "");
    if (!leavingAll && !toBattle) { return { ...where, damaged: 0 }; }
    const damaged = Math.min(ships.damaged, Math.max(getLeaderMoveLimit(player) - where.count, 0));
    return { ...where, damaged: damaged };
}

function getBotMoveText(player, where, to = where.to) {
    // e.g. "Move its Flagship and 2 fresh ships 1 ☾ Fuel → 1 ▲ Weapon": fresh and damaged said apart (#214)
    const flagship = player.flagship != null && hasFlagshipAt(where.from, player.number);
    const damaged = where.damaged || 0;
    const ships = where.count == 0 && damaged == 0 ? "" : (where.count > 0 ? where.count + " fresh" : "") + (where.count > 0 && damaged > 0 ? " and " : "") + (damaged > 0 ? damaged + " damaged" : "")
        + " ship" + (where.count + damaged == 1 ? "" : "s");
    return "Move " + (flagship ? "its Flagship" + (ships != "" ? " and " : "") : "") + ships + " " + getSystemName(where.from) + " &rarr; " + getSystemName(to);
}

function chooseBoardMoveAny(player, battleTarget, wantsCity, avoid = []) {
    // avoid: systems it moved ships out of this turn, never moved back into (#197)
    const ok = id => !avoid.includes(id);
    // { from, to, count }, or null: to the battle, else a Rival city to tax or raid, a planet to
    // build a city on, or one of its cities with no ships
    if (battleTarget != null) {
        // To the battle target's pieces, with its biggest fleet that can get there, unless it's
        // already with them
        const theirs = id => getShips(id, battleTarget).fresh + getShips(id, battleTarget).damaged > 0 || getBuildings(id, battleTarget).length > 0;
        if (getBattleSystem(player, battleTarget) == null) {
            const options = getSystemsWithShips(player.number).filter(from => getShips(from, player.number).fresh > 0 && !isSettledSpot(player, from))
                .flatMap(from => getMoveDestinations(from, player.number).filter(id => theirs(id) && ok(id)).map(to => ({ from: from, to: to, count: getShips(from, player.number).fresh })))
                .sort((a, b) => b.count - a.count);
            if (options.length > 0) { return { ...options[0], why: "to battle" }; }
        }
    }
    // A guard stays on its buildings when it holds resources worth raiding (#200 phase 3)
    const holdsLoot = preludeResources.some(resource => player[resource + "Value"] > 0);
    // Guards stay on its cities (#207): enough to hold one a Rival fleet could reach, at least 1
    // otherwise; on other buildings 1 when it holds resources worth raiding
    const reach = getRivalReach(player);
    const guards = from => {
        const fresh = getShips(from, player.number).fresh;
        if (getBuildings(from, player.number, "city").length > 0) { return Math.min(fresh, Math.max(1, reach[from] > 0 ? reach[from] + 1 : 0)); }
        return holdsLoot && getBuildings(from, player.number).length > 0 && fresh > 1 ? 1 : 0;
    };
    const canTake = from => Math.max(getShips(from, player.number).fresh - guards(from), 0);
    // to: where; count: how many it wants there; worth: what the city it's defending there is worth.
    // A city worth more keeps its guards, up to 2, rather than lose them to defend one worth less (#207)
    const move = (to, count, worth = null) => {
        if (!ok(to)) { return null; }
        const spare = from => worth != null && getCityWorth(player, from) > worth ? Math.max(getShips(from, player.number).fresh - Math.max(guards(from), 2), 0) : canTake(from);
        const from = getMoveSources(player, to).filter(source => !isSettledSpot(player, source) && spare(source) > 0)[0];
        return from == null ? null : { from: from, to: to, count: count == null ? spare(from) : Math.min(count, spare(from)) };
    };
    // Defending one of its cities a Rival's fleet could reach, with enough to hold it
    const threatened = getThreatenedCity(player);
    // Or holding a gate a Rival fleet would Catapult through to reach its buildings (the user): when
    // that protects more of them, or it hasn't the ships to hold the city itself
    // The first it can reach with enough ships to take control
    const gates = getGatesToHold(player);
    const holdGate = () => {
        for (const gate of gates) {
            const found = move(gate.id, gate.need);
            if (found == null || found.count < gate.need) { continue; }
            const what = gate.cities.length > 0 ? (gate.cities.length == 1 ? "its city at " + getSystemName(gate.cities[0]) : "its cities") : "its buildings";
            return { ...found, why: "to hold " + getSystemName(gate.id) + ", so Rival fleets can't Catapult through it to " + what, vital: gate.cities.length > 0, protects: gate.count };
        }
        return null;
    };
    const gate = gates[0] || null;
    if (threatened != null) {
        const found = move(threatened.id, threatened.gap + 1, getCityWorth(player, threatened.id));
        const direct = found != null && found.count >= threatened.gap + 1;
        if (!direct || (gate != null && gate.count > 1)) { const held = holdGate(); if (held != null) { return held; } }
        if (found != null) { return { ...found, why: "to defend its city there from a Rival fleet in reach" }; }
    }
    if (gate != null) { const held = holdGate(); if (held != null) { return held; } }
    // Where its Fate wants it (campaign/fateboard.js, #85): its Flagship with an escort, or ships to the place
    const fateMove = typeof getFateMoveTarget == "function" ? getFateMoveTarget(player) : null;
    if (fateMove != null && fateMove.flagship) {
        const from = typeof getFlagshipSystem == "function" ? getFlagshipSystem(player) : null;
        const to = from == null ? null : getMoveDestinations(from, player.number).find(id => ok(id) && fateMove.test(id));
        if (to != null) { return { from: from, to: to, count: Math.min(getShips(from, player.number).fresh, 1), why: fateMove.why }; }
    } else if (fateMove != null && fateMove.from != null) {
        // From where its Fate's token is, such as a Witness
        const to = getMoveDestinations(fateMove.from, player.number).find(id => ok(id) && fateMove.test(id));
        // The Gate Wraith collapses the gate it Catapults into, with all its fresh ships there (campaign/gatewraith.js)
        if (to != null && fateMove.breakGate) { return { from: fateMove.from, to: to, count: getShips(fateMove.from, player.number).fresh, why: fateMove.why, breakGate: to }; }
        if (to != null) { return { from: fateMove.from, to: to, count: canTake(fateMove.from) > 0 ? canTake(fateMove.from) : getShips(fateMove.from, player.number).fresh, why: fateMove.why }; }
    } else if (fateMove != null) {
        const to = getSystemIds().find(id => ok(id) && fateMove.test(id) && getMoveSources(player, id).length > 0);
        const found = to == null ? null : move(to, 2);
        if (found != null && found.count > 0) { return { ...found, why: fateMove.why }; }
    }
    // A Rival's city it doesn't control, only with enough fresh ships to control it once they're
    // there: more than any Rival's (#209). Otherwise it can't tax it, so the Move is no use
    const controlsAfter = (id, found) => getShips(id, player.number).fresh + found.count > Math.max(0, ...getRivalNumbers(player).map(number => getShips(id, number).fresh));
    if (battleTarget == null) {
        for (const id of getSystemIds().filter(id => ok(id) && getController(id) != player.number && getBuildings(id, null, "city").some(city => city.owner != player.number) && getMoveSources(player, id).length > 0)) {
            const found = move(id, null);
            if (found != null && found.count > 0 && controlsAfter(id, found)) { return { ...found, why: "to a Rival's city" }; }
        }
    }
    if (wantsCity != null) {
        const planet = getSystemIds().find(id => ok(id) && isPlanet(id) && getPlanetResource(id) == wantsCity && getEmptySlotCount(id) > 0 && !isControlledByOther(id, player.number) && getMoveSources(player, id).length > 0);
        // Or a gate it may build a city on (Gate Stations) that counts as that type, where it has no
        // piece yet: first when it gives more types it has no city of than the planet would
        const newTypes = id => getGateCityTypes(id).filter(resource => !hasCityOfType(player, resource));
        const gate = getSystemIds().filter(id => ok(id) && isGate(id) && !hasLoyalPiece(id, player.number) && getGateBuildKinds(id, player.number).includes("city")
            && getGateCityTypes(id).includes(wantsCity) && !isControlledByOther(id, player.number) && getMoveSources(player, id).length > 0)
            .sort((a, b) => newTypes(b).length - newTypes(a).length)[0];
        const toGate = () => { const found = move(gate, 1); return found == null ? null : { ...found, why: "to build a gate city there (Gate Stations: " + getGateCityTypes(gate).map(resource => preludeResourceNames[resource]).join(", ") + ")" }; };
        if (gate != null && (planet == null || newTypes(gate).length > 1)) { const found = toGate(); if (found != null) { return found; } }
        if (planet != null) { const found = move(planet, 1); if (found != null) { return { ...found, why: "to build a city" }; } }
        if (gate != null) { const found = toGate(); if (found != null) { return found; } }
    }
    const unguarded = getBoardCities(player.number).map(city => city.system).find(id => ok(id) && getShips(id, player.number).fresh == 0 && getMoveSources(player, id).length > 0);
    if (unguarded != null) { const found = move(unguarded, 1, getCityWorth(player, unguarded)); if (found != null) { return { ...found, why: "to guard its city" }; } }
    // Its cluster's gate, with 2 or more of its buildings there (the user)
    const home = getHomeGate(player);
    if (home != null && ok(home)) {
        const need = Math.max(0, ...getRivalNumbers(player).map(rival => getShips(home, rival).fresh)) + 1 - getShips(home, player.number).fresh;
        const found = move(home, need);
        if (found != null && need > 0 && found.count >= need) { return { ...found, why: "to hold " + getSystemName(home) + ", guarding its buildings in cluster " + getCluster(home) }; }
    }
    // Early in a campaign, a planet with a free slot and only damaged Blight: clear it, then build
    // there (the user, 2026-11-27). Enough ships to battle it. Before an empty planet when it holds a
    // card that can Battle (or a Weapon), otherwise after
    const blightFirst = isEarlyCampaign() && (getBotCards(player).some(card => card.actions.includes("battle")) || player.weaponsValue > 0);
    const blightMove = () => {
        if (!isEarlyCampaign() || blightFriends.includes(getFateNumber(player))) { return null; }
        const blighted = getSystemIds().filter(id => ok(id) && isPlanet(id) && getEmptySlotCount(id) > 0 && getBlight(id).fresh == 0 && getBlight(id).damaged > 0
            && getRivalShipCount(id, player.number) == 0 && !getBuildings(id).some(building => building.owner != player.number) && !(isOutlawNumber(player.number) && hasImperialShips(id))
            && !hasLoyalPiece(id, player.number) && getMoveSources(player, id).length > 0)
            .sort((a, b) => getBlight(a).damaged - getBlight(b).damaged)[0];
        if (blighted != null) {
            const need = getBlight(blighted).damaged + 1;
            const found = move(blighted, need);
            if (found != null && found.count >= need) { return { ...found, why: "to spread out to a planet with damaged Blight, to clear it and build there" }; }
        }
        return null;
    };
    if (blightFirst) { const found = blightMove(); if (found != null) { return found; } }
    // Spread out: an empty planet with a free slot and no Rival pieces, to build on later (#200 phase 3)
    const open = getSystemIds().find(id => ok(id) && isPlanet(id) && getEmptySlotCount(id) > 0 && !hasRivalPieces(id, player) && !hasLoyalPiece(id, player.number) && getMoveSources(player, id).length > 0);
    if (open != null) { const found = move(open, 2); if (found != null && found.count > 0) { return { ...found, why: "to spread out to an open planet, to build there later" }; } }
    if (!blightFirst) { const found = blightMove(); if (found != null) { return found; } }
    return null;
}

function isSettledSpot(player, id) {
    // A small group of its ships (1 or 2) on an open planet with a free slot and no Rival pieces:
    // there to build later, so they stay until that changes (#200 phase 3, the user)
    const ships = getShips(id, player.number);
    // Ships holding a gate that stops Rival Catapults to its buildings stay while that's so (the user)
    if (isGate(id)) { return getController(id) == player.number && getGateHoldValue(player, id).count > 0; }
    return isPlanet(id) && getEmptySlotCount(id) > 0 && !hasRivalPieces(id, player) && ships.fresh + ships.damaged > 0 && ships.fresh + ships.damaged <= 2;
}

function getMoveWhy(where) {
    const why = { "to battle": "to set up the Battle", "to a Rival's city": "to take control of a Rival's city and tax it", "to build a city": "to build a city there", "to guard its city": "to guard its city, which has no ships" }[where.why];
    return why || where.why;
}

function chooseBoardBuild(player) {
    // { system, kind, resource }: what the Build window would choose, at a place on the board
    const choice = getBuildChoice(player, getBoardSlotResources(player));
    const buildable = getBuildableSystems(player.number);
    const mine = id => (getController(id) == player.number ? 2 : 0) + (isControlledByOther(id, player.number) ? -2 : 0);
    if (choice.build == "city") {
        // A gate city (Gate Stations) counts as every city type in its cluster: better the more
        // types it doesn't have a city of yet
        const cityHere = id => isPlanet(id) ? getPlanetResource(id) == choice.resource : getGateBuildKinds(id, player.number).includes("city") && getGateCityTypes(id).includes(choice.resource);
        const newTypes = id => getCityTypes(id).filter(resource => !hasCityOfType(player, resource)).length;
        let system = buildable.filter(cityHere).sort((a, b) => newTypes(b) - newTypes(a) || mine(b) - mine(a))[0];
        // Cloud Cities, when there's no slot of that type
        const cloud = system == null ? getCloudCitySystems(player).find(id => getPlanetResource(id) == choice.resource) : null;
        if (cloud != null) { return { system: cloud, kind: "city", cloud: true, resource: choice.resource, reason: choice.reason + " Outside the slots (Cloud Cities: costs 1 " + preludeResourceNames[choice.resource] + ")." }; }
        const gateWhy = system != null && isGate(system) ? " A gate city counts as every city type in its cluster (Gate Stations): " + getCityTypes(system).map(resource => preludeResourceNames[resource]).join(", ") + "." : "";
        if (system != null) { return { system: system, kind: "city", resource: choice.resource, reason: choice.reason + gateWhy }; }
    }
    if (choice.build == "starport" || (choice.build != "ship" && buildable.length > 0)) {
        // A gate only with Gate Ports
        const system = buildable.filter(id => isPlanet(id) || getGateBuildKinds(id, player.number).includes("starport"))
            .sort((a, b) => mine(b) - mine(a) || getShips(b, player.number).fresh - getShips(a, player.number).fresh)[0];
        if (system != null) { return { system: system, kind: "starport", reason: choice.reason }; }
    }
    // A ship only with one left in its supply (#160)
    // Empath's Bond: at any starport (leaderrules.js)
    const starport = getShipSupply(player) > 0 ? getShipStarports(player)[0] : null;
    return starport != null ? { system: starport, kind: "ship", reason: choice.reason } : null;
}

function applyBoardStep(player, where) {
    // A step's effect on the board
    if (where == null) { return; }
    if (where.from != null) {
        // Fresh and damaged ships (#214)
        moveShips(where.from, where.to, player.number, where.count, Math.min(where.damaged || 0, getShips(where.from, player.number).damaged));
        // Its campaign Flagship goes with its fleet (campaign/flagships.js)
        if (player.flagship != null && hasFlagshipAt(where.from, player.number)) { moveFlagship(player, where.from, where.to); }
        // Its campaign tokens that go with its ships, such as Witnesses (campaign/fateboard.js)
        if (typeof carryFateTokens == "function") { carryFateTokens(player, where.from, where.to); }
        // The Gate Wraith's Catapult into its cluster's gate collapses it (campaign/gatewraith.js)
        if (where.breakGate != null && typeof breakGate == "function") { where.breakText = breakGate(player, where.from, where.breakGate); }
    }
    if (where.kind == "city" || where.kind == "starport") {
        // Cloud Cities: outside the slots, for 1 resource of the planet's type (leaderrules.js)
        if (placeBuilding(where.system, player.number, where.kind, isBuiltDamaged(where.system, player.number, where.kind), where.cloud === true) && where.cloud) {
            const resource = getPlanetResource(where.system);
            setPlayerResource(player, resource, Math.max(player[resource + "Value"] - 1, 0));
        }
    }
    if (where.kind == "ship") { addShips(where.system, player.number, 1, isBuiltDamaged(where.system, player.number, "ship")); }
    // Guild cards that place ships (#197): 1 in each gate in play, or some in one system
    if (where.kind == "gateShips") { getSystemIds().filter(isGate).forEach(id => addShips(id, player.number, 1)); }
    if (where.kind == "placeShips") { addShips(where.system, player.number, where.count); }
    if (where.kind == "repair") {
        if (getShips(where.system, player.number).damaged > 0) { removeShips(where.system, player.number, 1, true); addShips(where.system, player.number, 1); }
        else { setBuildingDamaged(where.system, player.number, where.building, false); }
    }
}

function getDamagedPieceCount(player) {
    // Its damaged ships and buildings on the board once its prelude is done: how many Repairs
    // are any use (#211)
    return withBoardCopy(() => {
        getBotPreludeSpent(player).filter(offer => offer.where != null && !offer.applied).forEach(offer => applyBoardStep(player, offer.where));
        return getSystemIds().reduce((total, id) => total + getShips(id, player.number).damaged, 0) + getBoardBuildings(player.number).filter(building => building.damaged).length;
    });
}

function getDamagedPiece(player) {
    // Something of its to repair: a damaged ship first, then a building
    const ship = getSystemIds().find(id => getShips(id, player.number).damaged > 0);
    if (ship != null) { return { system: ship, kind: "repair", piece: "a damaged ship" }; }
    const building = getBoardBuildings(player.number).find(item => item.damaged);
    return building != null ? { system: building.system, kind: "repair", building: building.kind, piece: "its damaged " + building.kind } : null;
}

function placeBoardPlan(player, plan) {
    // Adds where to each step, and says it in the step's name
    const battleStep = plan.find(step => step.action == "battle");
    const target = battleStep != null ? getBattleTarget(player) : null;
    const targetNumber = target != null && typeof target.player.number == "number" ? target.player.number : null;
    withBoardCopy(() => {
        // Its prelude's Moves, Builds and ship placements come first (#197)
        getBotPreludeSpent(player).filter(offer => offer.where != null && !offer.applied && canCompleteBotStep(offer)).forEach(offer => applyBoardStep(player, offer.where));
        // And its Lore actions that change the board, but Fire Rifles, whose hits aren't known yet
        getBotGuildSpent(player).filter(offer => isLoreBoardStep(offer.where) && offer.where.kind != "rifles" && !offer.applied).forEach(offer => applyLoreBoardStep(player, offer.where));
        // Systems it has moved ships out of this turn: never back into them (#197)
        const movedFrom = getBotPreludeSpent(player).filter(offer => offer.where != null && offer.where.from != null).map(offer => offer.where.from);
        const taxedCities = [];
        plan.forEach(step => {
            let where = null;
            if (step.action == "move") {
                // To the Free States, the Blight or the Empire it's going after, if it isn't there yet
                const special = getSpecialTargetSystem(player);
                if (special != null && targetNumber == null && getShips(special, player.number).fresh == 0) {
                    const from = getMoveSources(player, special)[0];
                    if (from != null) { where = addDamagedShips(player, { from: from, to: special, count: getShips(from, player.number).fresh, why: "to battle" }); }
                }
                if (where == null) { where = chooseBoardMove(player, targetNumber, getNewCityResource(player), movedFrom); }
                // Its reason is where it's going and why
                if (where != null) { movedFrom.push(where.from); step.text = getBotMoveText(player, where) + " (" + getMoveWhy(where) + ")"; }
                // Nothing useful on the board: say so rather than leave it vague (#197)
                else { step.text = "No Move: the board has nowhere useful to go, so skip this action"; }
            } else if (step.action == "build") {
                where = chooseBoardBuild(player);
                if (where != null) { step.text = step.text.replace(/^Build/, where.kind == "ship" ? "Build a ship at " + getSystemName(where.system) : "Build a " + where.kind + " at " + getSystemName(where.system)); }
            } else if (step.action == "battle" && targetNumber != null) {
                const system = getBattleSystem(player, targetNumber);
                if (system != null) { where = { system: system, battle: targetNumber }; }
            } else if (step.action == "battle" && getSpecialTargetSystem(player) != null) {
                where = { system: getSpecialTargetSystem(player), battle: player.campaignTarget.kind };
            } else if (step.action == "tax") {
                // "Tax a Rival's fuel city" for the Anarchist
                const resource = (step.text.match(/Tax (?:its|a Rival's) (\w+) city/) || [])[1];
                // A Rival's city: the leader's first, capturing their agent (#200)
                const leader = getLeader(player);
                // Each city once a turn, a gate city too whichever type it's taxed for (Gate Stations)
                // Warlord's Cruelty and Overseer (Ruthless) may tax a city again: then the same one will do
                const again = canTaxCityAgain(player) || hasLeader(player, 10);
                const cities = getTaxableCities(player.number).filter(item => again || !taxedCities.includes(item.system + ":" + item.owner));
                const rivalCities = cities.filter(item => item.owner != player.number)
                    .sort((a, b) => Number(leader != null && b.owner == leader.number) - Number(leader != null && a.owner == leader.number) || getResourceNeed(player, b.resource) - getResourceNeed(player, a.resource));
                // A planet city of that type before a gate city, which it may need for another type
                const city = cities.filter(item => item.owner == player.number && (resource == null || preludeResourceNames[item.resource].toLowerCase() == resource))
                    .sort((a, b) => Number(a.gate) - Number(b.gate))[0] || rivalCities[0];
                if (city != null) {
                    taxedCities.push(city.system + ":" + city.owner);
                    where = { system: city.system, tax: true, owner: city.owner, resource: city.resource, noCapture: city.noCapture === true };
                    step.text = step.text.replace(/^Tax[^(]*?(?= \(|$)/, match => (city.gate ? match.replace(/^Tax its \w+ city/, "Tax its gate city") : match) + " at " + getSystemName(city.system) + (city.gate ? " for " + preludeResourceNames[city.resource] : ""));
                }
            } else if (step.action == "repair") {
                where = getDamagedPiece(player);
                if (where != null) { step.text = step.text.replace(/^Repair/, "Repair " + where.piece + " at " + getSystemName(where.system)); }
            }
            step.where = where;
            applyBoardStep(player, where);
        });
    });
    return plan;
}

function refreshBotMoveStops(player) {
    // Where its Moves not yet carried out will really stop, on the board as it is now, after the
    // steps before them (the user): a Catapult stops in a gate someone else controls, so a Move
    // planned past one stops there instead, and says so. Its prelude's first, then its plan
    let changed = false;
    const fix = step => {
        const where = step.where;
        if (where == null || where.from == null || canMove(where.from, where.to, player.number)) { return; }
        const stop = getMoveStop(where.from, where.to, player.number);
        const planned = getSystemName(where.to);
        changed = true;
        if (stop == null) {
            step.where = null;
            step.text = "No Move: its ships at " + getSystemName(where.from) + " can't reach " + planned + " now, so skip this action";
            return;
        }
        const by = getController(stop);
        step.where = { ...where, to: stop, why: "stopped" };
        step.text = getBotMoveText(player, where, stop)
            + " (it can't go on to " + planned + " as " + (by != null ? "Player " + by + " controls " : "someone else controls ") + getSystemName(stop) + ", so its Catapult stops there)";
    };
    withBoardCopy(() => {
        getBotPreludeSpent(player).filter(offer => offer.where != null && !offer.applied).forEach(offer => { if (offer.action == "move") { fix(offer); } applyBoardStep(player, offer.where); });
        (player.turnPlan || []).filter(step => !step.applied).forEach(step => { if (step.action == "move") { fix(step); } applyBoardStep(player, step.where); });
    });
    if (changed) { SaveAllSettings(); }
}

function applyBotPlanToBoard(player) {
    // When its turn is done: its Moves, Builds and Repairs on the real board (a Battle's results
    // come from the Battle window). Any not carried out are put right in the board check
    // Its prelude's Moves, Builds and ship placements first, as they came first (#197)
    getBotPreludeSpent(player).forEach(offer => applyBotStep(player, offer));
    // Its Lore actions with a place (leaderrules.js)
    getBotGuildSpent(player).forEach(offer => applyBotStep(player, offer));
    (player.turnPlan || []).forEach(step => applyBotStep(player, step));
    syncPanelFromBoard(player);
    SaveAllSettings();
}

function getBotPreludeSpent(player) {
    return (player.prelude != null && player.prelude.spent != null) ? player.prelude.spent : [];
}

function applyBotStep(player, step) {
    // One step on the real board, once: when ticked Completed (#201) or when its turn is done.
    // A prelude offer with a place works the same way (#197)
    if (step.where == null || step.applied) { return; }
    // Gate Ports: a Rival captures an agent if it moves into their gate (leaderrules.js). Only on
    // the real board, before the ships move in
    if (step.action == "move" && step.where.from != null && step.where.to != null) { applyGatePortsCapture(player, [step.where.from, step.where.to]); }
    if (step.action == "move" || step.action == "build" || step.action == "repair" || step.where.kind == "gateShips" || step.where.kind == "placeShips") { applyBoardStep(player, step.where); }
    // A gate collapsed: everyone's panels, and what to do at the table
    if (step.where.breakText != null) { players.forEach(syncPanelFromBoard); showMessageToast("Player " + player.number + ": Breaking Gates", tagPlayerNames(step.where.breakText)); }
    // A Lore action (leaderrules.js). Fire Rifles only once its hits are known
    // A Fate card action (campaign/fateboard.js)
    if (typeof isFateBoardStep == "function" && isFateBoardStep(step.where)) { applyFateBoardStep(player, step.where); }
    if (isLoreBoardStep(step.where)) {
        if (step.where.kind == "rifles" && step.where.hits == null) { return; }
        applyLoreBoardStep(player, step.where);
    }
    // A Tax: the resource on its panel, if there's one left and room for it, and a Captive
    // from a Rival's city (#187)
    if (step.action == "tax" && step.where.tax) {
        // A gate city's type was chosen with the step (Gate Stations)
        const resource = step.where.resource || getPlanetResource(step.where.system);
        if (resource != null && getResourceSupply(resource) > 0 && getEmptySlots(player) > 0) {
            setPlayerResource(player, resource, player[resource + "Value"] + 1);
            // Empath's Bond takes no Captive (leaderrules.js)
            // A Free city has no agents to capture (campaign, #85)
            if (step.where.owner != null && step.where.owner != player.number && !step.where.noCapture && step.where.owner != freeOwner) { setPlayerResource(player, "captives", (player.captivesValue || 0) + 1); }
            // A Leader's extra resource for a Copy or Pivot Tax (leaderrules.js)
            applyLeaderTaxBonus(player);
            // Shaper (Mythic): the planet becomes the type it's chasing, if it holds one
            botMythic(player, step.where.system);
        }
    }
    step.applied = true;
}

function completeBotStep(index) {
    // The Completed button beside a step in its turn window (#201): on the board now, so the next
    // step's window counts from it
    const player = getTurnPlayer();
    if (player == null || player.isHuman) { return; }
    const step = (player.turnPlan || [])[index];
    if (step == null) { return; }
    applyBotStep(player, step);
    syncPanelFromBoard(player);
    SaveAllSettings();
    renderTurn(player);
}

function canCompleteBotStep(step) {
    return step.where != null && (["move", "build", "repair", "tax"].includes(step.action) || step.where.kind == "gateShips" || step.where.kind == "placeShips" || isLoreBoardStep(step.where) || (typeof isFateBoardStep == "function" && isFateBoardStep(step.where)));
}

function completeBotGuildOffer(index) {
    // The Completed button beside a Lore action with a place (leaderrules.js). Fire Rifles asks for
    // the hits first
    const player = getTurnPlayer();
    if (player == null || player.isHuman || player.guildActions == null) { return; }
    const offer = (player.guildActions.spent || [])[index];
    if (offer == null) { return; }
    if (offer.where != null && offer.where.kind == "rifles") {
        returnToTurnWindow = true;
        closeTurnWindow(() => queueLeaderWindow(() => showRiflesWindow(index)));
        return;
    }
    applyBotStep(player, offer);
    syncPanelFromBoard(player);
    SaveAllSettings();
    renderTurn(player);
}

function getBotGuildSpent(player) {
    return (player.guildActions != null && player.guildActions.spent != null) ? player.guildActions.spent : [];
}

function completeBotPreludeOffer(index) {
    // The Completed button beside a prelude spend with a place (#197)
    const player = getTurnPlayer();
    if (player == null || player.isHuman) { return; }
    const offer = getBotPreludeSpent(player)[index];
    if (offer == null) { return; }
    applyBotStep(player, offer);
    syncPanelFromBoard(player);
    SaveAllSettings();
    renderTurn(player);
}

// A bot's Battle window: the counts from the battle system on the board, and its results back on it

function prefillBattleFromBoard() {
    // A bot: the system in its plan. A human player: the first where both sides have pieces, and
    // they can choose another (boardhuman.js)
    battle.boardSystem = null;
    battle.boardBuildingKinds = null;
    battle.sensorsDone = false;
    battle.sensorsNote = null;
    const { attacker, defender } = battle;
    if (attacker != null && defender != null && typeof defender.number == "number") {
        const places = getBattlePlacesFor(attacker, defender);
        let system = places[0];
        if (!attacker.isHuman) {
            const step = (attacker.turnPlan || []).find(item => item.action == "battle" && item.where != null && item.where.battle == defender.number && !item.applied);
            // Its steps before this Battle go on the board first, such as the Move that sets it up,
            // so the counts are where its ships are now (#201)
            const plan = attacker.turnPlan || [];
            const upTo = step != null ? plan.indexOf(step) : plan.length;
            getBotPreludeSpent(attacker).filter(canCompleteBotStep).forEach(offer => applyBotStep(attacker, offer));
            plan.slice(0, upTo).filter(canCompleteBotStep).forEach(item => applyBotStep(attacker, item));
            syncPanelFromBoard(attacker);
            system = step != null ? step.where.system : getBattleSystem(attacker, defender.number);
        }
        if (system != null) { fillBattleFromSystem(system); }
    } else if (attacker != null && defender != null && defender.campaignDefender != null) {
        // The Free States, the Blight or the Empire (#85 stage 7b): the bot's chosen system, or the
        // first where both sides have pieces
        const places = getBattlePlacesFor(attacker, defender);
        const chosen = getSpecialTargetSystem(attacker);
        const system = chosen != null && places.includes(chosen) ? chosen : places[0];
        if (system != null) { fillBattleFromSystem(system); }
    }
    showBattleSystems();
}

function getBoardDestroyed(count) {
    // What the destroyed buildings were, from the defender's buildings in the battle system:
    // { planet, kinds, ask }. Only a city and a starport there, not all destroyed, needs asking
    // (the user). null with no board system. On a gate, a city is a gate city (Gate Stations), with
    // gateTypes: every city type in its cluster, each Provoking Outrage
    const system = battle.boardSystem;
    if (system == null || battle.defender == null || typeof battle.defender.number != "number") { return null; }
    const buildings = getBuildings(system, battle.defender.number).sort((a, b) => b.damaged - a.damaged);
    if (buildings.length == 0 || count > buildings.length) { return null; }
    const kinds = buildings.map(building => building.kind);
    const ask = new Set(kinds).size > 1 && count < buildings.length;
    return { planet: isGate(system) ? "gate" : getPlanetResource(system), kinds: ask ? null : kinds.slice(0, count), ask: ask, gateTypes: isGate(system) ? getGateCityTypes(system) : [] };
}

function applyBattleToBoard(losses) {
    // What's left on each side in the battle system
    const system = battle.boardSystem;
    if (system == null) { return; }
    const attacker = battle.attacker.number;
    // A campaign defender's pieces are the Blight, the Imperial ships or the Free buildings (#85 stage 7b)
    const kind = battle.defender.campaignDefender;
    // The Dead Live (campaign/gatewraith.js): the ships destroyed, and who holds them as Trophies
    const before = number => ({ ...getShips(system, number) });
    const attackerBefore = before(attacker);
    const firstRegent = typeof campaign != "undefined" && campaign != null && campaign.firstRegent != null && campaign.firstRegent != attacker ? campaign.firstRegent : null;
    const imperialBefore = { ...getImperial(system) };
    const noteDead = (owner, was, now, holder) => noteDestroyedShips(owner, { before: was, after: now }, holder);
    if (kind != null) {
        setShips(system, attacker, battle.ships, battle.attackerDamaged || 0);
        if (kind == "blight") { setBlight(system, battle.fresh, battle.damaged); }
        if (kind == "empire") { setImperial(system, battle.fresh, battle.damaged); noteDead("imperial", imperialBefore, getImperial(system), attacker); }
        noteDead(attacker, attackerBefore, getShips(system, attacker), kind == "empire" ? firstRegent : null);
        if (kind == "free") {
            for (let lost = 0; lost < losses.defenderBuildings; lost++) {
                const building = getBuildings(system, freeOwner).sort((a, b) => b.damaged - a.damaged)[0];
                if (building != null) { removeBuilding(system, freeOwner, building.kind); }
            }
            let damaged = battle.damagedBuildings;
            getBuildings(system, freeOwner).forEach(building => { building.damaged = damaged > 0; damaged--; });
        }
        const done = (battle.attacker.turnPlan || []).find(item => item.action == "battle" && item.where != null && item.where.system == system && !item.applied);
        if (done != null) { done.applied = true; }
        syncPanelFromBoard(battle.attacker);
        return;
    }
    const defender = battle.defender.number;
    const defenderBefore = before(defender);
    const removeOne = (number) => { if (getShips(system, number).damaged > 0) { removeShips(system, number, 1, true); } else { removeShips(system, number, 1); } };
    // The attacker's ships there: fresh and damaged, as the window says (#189)
    setShips(system, attacker, battle.ships, battle.attackerDamaged || 0);
    // The kinds the results said were destroyed, damaged ones of each first
    const kinds = battle.destroyed != null && battle.destroyed.kinds != null ? battle.destroyed.kinds : [];
    for (let lost = 0; lost < losses.defenderBuildings; lost++) {
        const left = getBuildings(system, defender).sort((a, b) => b.damaged - a.damaged);
        const building = left.find(item => kinds[lost] == null || item.kind == kinds[lost]) || left[0];
        if (building != null) { removeBuilding(system, defender, building.kind); }
    }
    // The defender's fresh and damaged ships, and damaged buildings, as the window says: a human
    // player's window has them too now (#194)
    setShips(system, defender, battle.fresh, battle.damaged);
    // Each side's destroyed ships are the other's Trophies
    noteDead(attacker, attackerBefore, getShips(system, attacker), defender);
    noteDead(defender, defenderBefore, getShips(system, defender), attacker);
    let damaged = battle.damagedBuildings;
    getBuildings(system, defender).forEach(building => { building.damaged = damaged > 0; damaged--; });
    // A Ceasefire at Peace flips to War, for a Weapon (campaign/fateboard.js)
    if (typeof applyCeasefireAfterBattle == "function" && board.clusterTokens != null) { applyCeasefireAfterBattle(system, battle.attacker); }
    // Quartermaster (Resilient) and Repair Drones repair ships there (leaderrules.js)
    applyLeaderBattleRepairs(system);
    const step = (battle.attacker.turnPlan || []).find(item => item.action == "battle" && item.where != null && item.where.system == system && !item.applied);
    if (step != null) { step.applied = true; }
    // Both panels follow the board, human players' too now their actions are on it
    [battle.attacker, battle.defender].forEach(syncPanelFromBoard);
}

// Each player has 15 ships: those not on the board or held as Rivals' Trophies are in its supply
const shipsPerPlayer = 15;

function getShipSupply(player) {
    // Less any its Leader scrapped in setup (Overseer, Hated: leaderrules.js)
    // And any its campaign Fate scrapped (campaign/fateboard.js)
    // And any on The Dead Live, till they come back on the Twisted Passage (campaign/gatewraith.js)
    const dead = typeof getDeadLiveShips == "function" ? getDeadLiveShips(player.number) : 0;
    return Math.max(shipsPerPlayer - getLeaderScrappedShips(player) - (player.scrappedShips || 0) - getBoardShips(player.number) - (player.shipsTrophy || 0) - dead, 0);
}

function getBoardYesReason(ambition, action) {
    // Why it went ahead without asking: the plan's reason
    return { tax: "the board shows a city to tax", reachTax: "the board shows a Rival's city it can reach", battle: "the board shows a battle it can win",
        reachBattle: "the board shows a Rival's ships it can reach", reachRaid: "the board shows a Rival's building it can reach" }[action] || "the board shows it can";
}
