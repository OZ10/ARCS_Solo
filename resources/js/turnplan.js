// Turn plan: how a bot should use the actions on its card, shown in its turn summary. The bot
// can't see the board, so this is a suggestion for the player to carry out as best they can.
// The scores are in rules.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const rivalTaxReason = "a Rival's city, to capture";

function getTaxTargets(player) {
    // The resources it has cities on, the one it needs most first. A gate city counts for each of its
    // types (Gate Stations)
    return preludeResources.filter(resource => hasCityOfType(player, resource))
        .sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a));
}

function hasCityOfType(player, resource) {
    // A city of this type on its panel, or a gate city on the board that counts as it
    return player["cities" + capitalise(resource) + "Value"] > 0 || getBoardCities(player.number, resource).length > 0;
}

function getResourceSupply(resource) {
    // What's left to take: every token not held by a player. With 2 players some are out of play
    // on the ambitions, so this can be too high, but the Tax question still catches that
    return Math.max(resourceTokens - players.reduce((total, player) => total + player[resource + "Value"], 0), 0);
}

function getCitiesToTax(player) {
    // Its cities it can gain a resource from: there's one left, and it wasn't told it can't
    const ruledOut = (player.noTax || []).flatMap(ambition => ambitionTaxResources[ambition] || []);
    if (hasLeader(player, 13)) { return getAnarchistTaxTargets(player, ruledOut); }
    return getTaxTargets(player).filter(resource => getResourceSupply(resource) > 0 && !ruledOut.includes(resource) && isOutragedTaxWorthIt(player, resource));
}

function isOutragedTaxWorthIt(player, resource) {
    // An Outraged resource can't be spent in its prelude, only counted for its ambition (rulebook
    // p.17). So only when it's chasing that ambition, or holds a card to declare it (#193)
    if (!(player.outraged || []).includes(resource)) { return true; }
    const ambition = preludeAmbitions[resource];
    if (ambition == null) { return false; }
    if (getResourceNeed(player, resource) == 2) { return true; }
    return !declaredAmbitions.includes(ambition) && canDeclareAmbition(player) && holdsAmbitionCard(player, ambition);
}

function getMoveGoal(player) {
    // Its best reason to Move, or null if nothing stands out (#102)
    return getMoveGoals(player)[0] || null;
}

function getMoveReasons(player) {
    // Every reason it has to Move, best first (#118): its goals, then a planet to build on later if
    // it has cities left to place, then guarding one of its cities
    let reasons = getMoveGoals(player);
    if (getUncoveredCities(player) < maxCities && player.hasSlotForCity !== true) { reasons.push("towards a planet with an open building slot that no one controls, to build there later"); }
    reasons.push("to guard one of its cities with no ships");
    return reasons.filter((reason, index) => reasons.indexOf(reason) == index);
}

function getMoveGoals(player) {
    // Why it would Move, from what the app knows without asking: a Rival to tax or raid for what
    // it's chasing, or a slot for a city it wants. It needs a way to follow it up: more actions
    // on this card, or another card. Best first
    let goals = [];
    const play = getBotPlay(player);
    const hand = getUnplayedCards(player.cards);
    const canFollowUp = action => (play != null && play.count > 1 && play.actions.includes(action)) || hand.some(card => card.actions.includes(action));
    const rivals = players.filter(other => other !== player);
    const cityOn = (other, resource) => other["cities" + capitalise(resource) + "Value"] > 0;
    const named = resource => preludeResourceNames[resource].toLowerCase();

    for (const resource of preludeResources.filter(candidate => getResourceNeed(player, candidate) == 2)) {
        if (!cityOn(player, resource) && rivals.some(other => cityOn(other, resource)) && getResourceSupply(resource) > 0 && canFollowUp("tax")) {
            goals.push("towards a Rival's " + named(resource) + " city, with more fresh ships than they have there");
        }
        const holder = getRaidHolders(player, [resource])[0];
        // In a campaign, a Fate may rule out battles (campaignhooks.js)
        if (holder != null && canFollowUp("battle") && runCampaignHook("avoidsAction", player, "battle") !== true) {
            goals.push("towards Player " + holder.player.number + ", who holds " + holder.count + " " + named(resource) + (holder.count > 1 && resource != "fuel" ? "s" : "") + ", to raid them");
        }
    }

    const chasing = ambition => declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition);
    if (chasing("tyrant") && rivals.some(other => other.startingCity || cityCounters.some(counter => other[counter + "Value"] > 0)) && canFollowUp("tax")) {
        goals.push("towards a Rival's city, with more fresh ships than they have there, to capture");
    }
    if (chasing("warlord") && canFollowUp("battle") && runCampaignHook("avoidsAction", player, "battle") !== true) { goals.push("towards a Rival's ships, to Battle them"); }

    // Not if it said it already has an empty slot of that type where it has a piece (#146)
    const newCity = getNewCityResource(player);
    if (newCity != null && player.hasSlotForCity !== true && canFollowUp("build")) {
        goals.push("towards a " + named(newCity) + " planet with an open slot, to build a city");
    }
    // In a campaign, where its Fate wants it to go this Act, first (campaignhooks.js)
    return (runCampaignHook("moveGoals", player) || []).concat(goals);
}

function getNewCityResource(player) {
    // A planet type it has no city on and would like one, the one it needs most. null if none
    if (getUncoveredCities(player) >= maxCities) { return null; }
    return preludeResources.filter(resource => !hasCityOfType(player, resource) && getResourceNeed(player, resource) > 0)
        .sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a))[0] || null;
}

function getRepairablePieces(player) {
    // Its ships and buildings on the board: the most it could have damaged (#145)
    return player.shipsBoardValue + (player.starportsValue || 0) + getCityCount(player);
}

function getBattleActionCount(player) {
    // How many of its actions this turn can Battle: all of its card's if it can Battle, or a Weapon
    // spent in its prelude lets them all
    const play = getBotPlay(player);
    if (play == null) { return 0; }
    const weapon = player.prelude != null && (player.prelude.spent || []).some(offer => offer.converts);
    return (play.actions.includes("battle") || weapon) ? play.count : 0;
}

function getAttackFleet(player) {
    // The ships it battles with just because it can: 4 with 2 or more Battle actions this turn, 6
    // with only 1 (#125)
    return getBattleActionCount(player) >= 2 ? attackFleet.manyActions : attackFleet.oneAction;
}

// Its ships are spread over the map, so its total on the board says little about a battle. Before
// choosing its card it asks for the biggest fleet it could attack with this turn, counting one Move
// when it can Move first (see askThenPlay)

function getFleetMove(player) {
    // How it could Move before battling: "card" (a card that can Move and Battle, with 2 or more
    // pips), "fuel" (a Fuel it can spare for its prelude Move), or null
    if (getBotCards(player).some(card => card.actions.includes("move") && card.actions.includes("battle") && card.pips >= 2)) { return "card"; }
    const fuelFree = player.fuelValue > 0 && canSpareResource(player, "fuel") && !couldScoreFromHand(player, "fuel") && !(player.outraged || []).includes("fuel");
    return fuelFree ? "fuel" : null;
}

function shouldAskAttackFleet(player) {
    // The board shows its biggest fleet, so it's never asked (boardbot.js, #160)
    setFleetFromBoard(player);
    return false;
}

function getAttackFleetQuestion(player, move) {
    const where = move != null
        ? "Count my fresh ships in one system with a Rival's pieces, or that <b>one Move</b> could bring there (next door, or by Catapult)."
        : "Count only my fresh ships <b>already in a system</b> with a Rival's pieces.";
    const note = move == "card" ? "I have a card that can Move, then Battle." : move == "fuel" ? "I could spend a Fuel to Move first." : "I can't Move first this turn.";
    return "What's the biggest fleet I could attack a Rival with this turn? " + where
        + (runCampaignHook("fleetQuestionNote", player) || "")
        + "<div class=\"fleetnote\">" + note + " I have " + player.shipsBoardValue + " ships on the board.</div>";
}

function getFleetForBattle(player) {
    // The biggest fleet it could attack with this turn, from the board (boardbot.js, #160)
    setFleetFromBoard(player);
    return player.attackFleetSize;
}

function hasAttackFleet(player) {
    // A fleet big enough to attack just because it can (#125)
    return getFleetForBattle(player) >= getAttackFleet(player);
}

function hasManyShips(player) {
    // Lots of ships on the board, unless you said its biggest fleet this turn is too small to attack
    return player.shipsBoardValue >= manyShipsOnBoard && !(player.attackFleetSize != null && !hasAttackFleet(player));
}

function getFleetReason(player) {
    // e.g. "its fleet of 5 can attack this turn: enough for 2 Battle actions"
    const fleet = getFleetForBattle(player);
    if (player.attackFleetMove != null) { return "its fleet of " + fleet + " can attack this turn: Move it in first if it isn't there yet"; }
    const actions = getBattleActionCount(player);
    return "its fleet of " + fleet + " can attack this turn: enough for " + (actions >= 2 ? actions + " Battle actions" : "1 Battle action");
}

function getBattleTargetReason(player, rival) {
    // Why this Rival, as { why, where }. The app can't see the map, so where is a rule of thumb:
    // a defending fresh ship hits back on an intercept, and raid dice need a building there
    const outnumber = "Choose a system where it outnumbers their fresh ships.";
    const holding = preludeResources.filter(resource => getResourceNeed(player, resource) == 2)
        .map(resource => ({ resource: resource, count: rival[resource + "Value"] + getStealableIconCount(rival, resource) }))
        .filter(held => held.count > 0).sort((a, b) => b.count - a.count)[0];
    if (holding != null) {
        const name = preludeResourceNames[holding.resource].toLowerCase() + (holding.count > 1 && holding.resource != "fuel" ? "s" : "");
        // A starport: raid dice there can't lead to Outrage (#130)
        const where = (getCityCount(rival) == 0 && (rival.starportsValue || 0) == 0) ? "They have no buildings on the board, so raid dice work in any system with their ships."
            : (rival.starportsValue || 0) > 0 ? "Choose a system with one of their starports: raid dice there don't risk Outrage."
            : "Choose a system with a building of theirs, for raid dice.";
        return { why: "They hold " + holding.count + " " + name + " to raid.", where: where };
    }

    const others = players.filter(other => other !== rival);
    if (declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord")) {
        return { why: "They have " + rival.shipsBoardValue + " ship" + (rival.shipsBoardValue == 1 ? "" : "s") + " to destroy for Trophies.", where: outnumber };
    }
    if (others.every(other => rival.powerValue > other.powerValue)) { return { why: "They're leading on Power.", where: outnumber }; }
    // It outnumbers them: the plan step already says so (#125)
    if (hasAttackFleet(player)) { return { why: "", where: outnumber }; }
    return { why: "They have " + rival.shipsBoardValue + " ship" + (rival.shipsBoardValue == 1 ? "" : "s") + " on the board.", where: outnumber };
}

function getBattleTarget(player) {
    // Who it would rather Battle this turn, as { player, why, where }: whoever holds what it's
    // chasing, is ahead on Power or, for Warlord, has ships to destroy. Chosen once a turn so it
    // doesn't change as tiles are tapped, with a little variation so it isn't predictable. Only
    // Rivals with something on the board. null if there are none
    const weights = battleTargetWeights;
    // In a campaign, the Free States, the Blight or the Empire when you said they're in reach (campaignhooks.js)
    const special = runCampaignHook("specialBattleTarget", player);
    if (special != null) { return special; }
    const rivals = players.filter(other => other !== player
        && (other.shipsBoardValue > 0 || other.startingCity || cityCounters.some(counter => other[counter + "Value"] > 0)));
    if (rivals.length == 0) { return null; }

    let target = rivals.find(other => other.number == player.battleTargetNumber);
    // Chosen before its card was played, but out of reach now while another Rival isn't (#188)
    if (target != null && !canReachRival(player, target) && rivals.some(rival => canReachRival(player, rival))) { target = null; }
    if (target == null) {
        const chased = preludeResources.filter(resource => getResourceNeed(player, resource) == 2);
        const warlord = declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord");
        const score = rival => chased.reduce((total, resource) => total + (rival[resource + "Value"] + getStealableIconCount(rival, resource)) * weights.holding, 0)
            + (players.filter(other => other !== rival).every(other => rival.powerValue > other.powerValue) ? weights.leader : 0)
            + rival.powerValue * weights.power
            + rival.shipsBoardValue * (warlord ? weights.shipWarlord : weights.ship)
            + Math.random() * weights.variation * getDifficulty().planVariation
            // In a campaign, a Regent would rather battle an Outlaw (campaignhooks.js)
            + (runCampaignHook("battleTargetBonus", player, rival) || 0)
            // One its ships can't reach this turn hardly counts, and an unguarded building it can
            // reach counts for more (boardbot.js, #160)
            + getBattleTargetBoardBonus(player, rival)
            // The leader, more the further ahead and the nearer the target (#200)
            + getLeaderThreat(player, rival) * leaderWeights.battle;
        target = rivals.map(rival => ({ rival: rival, score: score(rival) })).sort((a, b) => b.score - a.score)[0].rival;
        player.battleTargetNumber = target.number;
    }
    const reason = getBattleTargetReason(player, target);
    // In a campaign, where the Empire's laws allow it (campaignhooks.js)
    reason.where += runCampaignHook("battleTargetWhere", player, target) || "";
    return { player: target, ...reason };
}

function getWantedCardResource(player) {
    // The resource it most wants a Court card for: the ambition it's chasing, otherwise one that
    // could still be declared. Weapons when chasing Warlord. null if nothing stands out
    if (declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord")) { return "weapons"; }
    const best = preludeResources.filter(resource => getResourceNeed(player, resource) > 0)
        .sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a))[0];
    return (best == null) ? null : best;
}

function getActionPlanScore(player, action, focus) {
    // How much the bot wants this action, and why. A score of planImpossible means it can't or
    // shouldn't do it at all. If the player said it can, their answer stands, as they can see
    // the board and a count may not be up to date
    const weights = turnPlanWeights;
    const chasing = ambition => declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition);
    const isLastCard = getUnplayedCards(player.cards).length == 0;
    let score = weights[action];
    let reason = "";

    switch (action) {
        case "move": {
            if (player.shipsBoardValue == 0 && action != focus) { return { score: planImpossible }; }
            const goal = getMoveGoal(player);
            if (goal != null) { score += weights.moveGoal; reason = goal; }
            else { reason = getMoveReasons(player)[0]; }
            // The board's best Move has a purpose (#200 phase 3). After its prelude's Moves, so a
            // card's Move counts only when ANOTHER Move is useful (#203, the user)
            const best = getNextBoardMove(player);
            // Spreading out counts for less than a battle, a defence, a Rival's city or a build
            if (best != null) { score += /^to spread/.test(best.why) ? weights.moveUseful / 2 : weights.moveUseful; reason = getMoveWhy(best); }
            break;
        }

        case "battle":
            if (player.shipsBoardValue == 0 && action != focus) { return { score: planImpossible }; }
            // No Rival its ships can reach this turn on the board (#188). A campaign's own targets aside
            if (!player.campaignTarget && !players.some(other => other !== player && canReachRival(player, other))) { return { score: planImpossible }; }
            // Nowhere it can fight at good odds: as many ships as the defender, or all theirs
            // damaged. Better to use the action for something else (#198)
            if (!player.campaignTarget && !players.some(other => other !== player && hasFavourableBattle(player, other))) { return { score: planImpossible }; }
            if (chasing("warlord")) { score += weights.battleWarlord; reason = "chasing Warlord"; }
            else if (chasing("tyrant")) { score += weights.battleTyrant; reason = "chasing Tyrant"; }
            if (hasManyShips(player)) { score += weights.battleManyShips; if (reason == "") { reason = "lots of ships on the board"; } }
            // Because it can: a fleet big enough for the Battle actions it has (#125), or its last card
            if (hasAttackFleet(player)) {
                score += weights.battleFleet;
                if (reason == "") { reason = getFleetReason(player); }
            }
            if (isLastCard) { score += weights.battleLastCard; if (reason == "") { reason = "its last card this round"; } }
            // A Rival's building in reach with no ships guarding it: stop them expanding (#200 phase 3)
            if (players.some(other => other !== player && getExposedBuildings(player, other).length > 0)) {
                score += weights.battleExposed;
                if (reason == "") { reason = "a Rival's building in reach has no ships guarding it"; }
            }
            break;

        case "secure":
            // With the market entered, it knows whether there's anything it can secure
            if (isMarketKnown() && getCardsToSecure(player).length == 0 && action != focus) { return { score: planImpossible }; }
            if (isLastCard) { score += weights.secureLastCard; }
            if (getWantedCardResource(player) != null) { score += weights.secureWanted; }
            break;

        case "influence":
            // No later turn to secure the card
            if (isLastCard) { return { score: planImpossible }; }
            if (isMarketKnown() && getCardsToInfluence(player).length == 0 && action != focus) { return { score: planImpossible }; }
            // No agents left (#123)
            if (hasNoAgents(player) && action != focus) { return { score: planImpossible }; }
            if (getWantedCardResource(player) != null) { score += weights.influenceWanted; }
            break;

        case "tax": {
            const targets = getCitiesToTax(player);
            if (chasing("tyrant") && !(player.noTax || []).includes("TYRANT")) { score += weights.taxTyrant; reason = rivalTaxReason; break; }
            // No room for the resource, even if it played the card for Tax (#187)
            if (getEmptySlots(player) == 0) { return { score: planImpossible }; }
            if (action != focus && targets.length == 0 && !player.startingCity) { return { score: planImpossible }; }
            if (targets.length > 0) { score += getResourceNeed(player, targets[0]) * weights.taxPerNeed; }
            // A resource whose prelude action its hand lacks: Fuel with few Move cards, Material
            // with few Build cards, a Weapon with few Battle cards (#200 phase 3)
            const lacks = { fuel: "move", materials: "build", weapons: "battle" };
            const hand = getUnplayedCards(player.cards);
            const short = targets.find(resource => lacks[resource] != null && hand.filter(card => card.actions.includes(lacks[resource])).length <= 1 && hand.length >= 2);
            if (short != null) { score += weights.taxForHand; if (reason == "") { reason = "its hand has few " + capitalise(lacks[short]) + " cards, and a " + preludeResourceNames[short] + " gives one"; } }
            break;
        }

        case "build":
            if (player.canBuild === false && !canUseGuildActionInsteadOf(player, "build")) { return { score: planImpossible }; }
            // Nothing the board allows it to build (#183)
            if (chooseBoardBuild(player) == null && !canUseGuildActionInsteadOf(player, "build")) { return { score: planImpossible }; }
            if (player.shipsBoardValue < getShipTarget(player)) { score += weights.buildFewShips; reason = "more ships: it wants about " + shipsPerBuilding + " per building, or repair a damaged one"; }
            else if (isNearCityBonus(player)) { score += weights.buildNearBonus; reason = "towards the city bonus"; }
            // #200 phase 3: a city opens a resource slot when they're full or nearly; ships when
            // Rivals have clearly more, to defend
            const planned = chooseBoardBuild(player);
            if (planned != null && planned.kind == "city" && getEmptySlots(player) <= 1) { score += weights.buildSlots; if (reason == "") { reason = "its resource slots are nearly full, and a city opens another"; } }
            const rivalShips = Math.max(0, ...players.filter(other => other !== player).map(other => getBoardShips(other.number)));
            if (rivalShips >= getBoardShips(player.number) + 3) { score += weights.buildDefend; if (reason == "") { reason = "Rivals have more ships: it needs to defend"; } }
            break;

        case "repair": {
            // Damage only matters for intercepts and control, which are about ships, and a building
            // takes hits only once the ships are gone. A city is worth it if it's chasing that
            // resource. With lots of ships, a damaged one matters less
            // The board shows nothing of its is damaged (#183)
            if (getDamagedPiece(player) == null) { return { score: planImpossible }; }
            const city = getTaxTargets(player).find(resource => getResourceNeed(player, resource) == 2);
            if (declaredAmbitions.includes("warlord")) { score += weights.repairWarlord; }
            else if (player.shipsBoardValue < fewShipsOnBoard) { score += weights.repairFewShips; }
            else if (player.shipsBoardValue >= manyShipsOnBoard) { score -= weights.repairManyShips; }

            if (declaredAmbitions.includes("warlord")) { reason = "damaged ships first: they're easy Trophies"; }
            else if (city != null) { reason = "if anything's damaged: its " + preludeResourceNames[city].toLowerCase() + " city, then ships"; }
            else if (player.shipsBoardValue < fewShipsOnBoard) { reason = "damaged ships first: it's short of them"; }
            else if (player.shipsBoardValue >= manyShipsOnBoard) { reason = "only if there's nothing better: it has plenty of ships"; }
            else { reason = "if anything's damaged: ships first, or a city with no ships guarding it"; }
            break;
        }

        default:
            break;
    }

    // A Leader that improves this action when it Copies or Pivots (leaderrules.js)
    score += getLeaderPlanBonus(player, action);

    // What the player said it can do, in the Yes/No questions
    if (action == focus) { score += weights.focus; reason = (action == "move" && player.moveGoal != null) ? player.moveGoal : (player.focusReason || "the board shows it can"); }
    // In a campaign, what its Fate wants this Act: { avoid, add, reason } (campaignhooks.js)
    const steer = runCampaignHook("planSteer", player, action);
    if (steer != null) {
        if (steer.avoid && action != focus) { return { score: planImpossible }; }
        score += steer.add || 0;
        if (steer.reason && action != focus) { reason = steer.reason; }
    }
    return { score: score, reason: reason, tag: (steer != null && action != focus) ? (steer.tag || "") : "" };
}

function getTurnPlan(player) {
    // The actions it should take this turn in the order to take them, as
    // [{ action, text }]. [] for the human player, or if its card gives no actions
    if (player.isHuman) { return []; }
    // Once its turn window has opened, the plan stays as it was (#105)
    if (player.turnPlan != null) { return player.turnPlan; }
    const play = getBotPlay(player);
    if (play == null) { return []; }

    // A little variation for the turn, so it isn't always the same plan. Kept so the plan
    // doesn't change every time the summary is redrawn
    if (player.planVariation == null) {
        player.planVariation = {};
        turnPlanOrder.forEach(action => { player.planVariation[action] = Math.random() * turnPlanWeights.variation * getDifficulty().planVariation; });
    }

    const preludeSpent = (player.prelude != null && player.prelude.spent != null) ? player.prelude.spent : [];
    const guildSpent = (player.guildActions != null && player.guildActions.spent != null) ? player.guildActions.spent : [];
    const card = playedCardList.find(played => played.playedByPlayerNumber == player.number && played.cardAction != "CLAIM");
    const focus = (card.playedAction || "").toLowerCase();

    // A Guild action uses up one of the card's actions. A Weapon lets any of them Battle this
    // turn (rulebook p.17), and it spent one because it means to, so at least one does
    let actionsLeft = Math.max(play.count - guildSpent.length, 0);
    let chosen = [];
    preludeSpent.filter(offer => offer.converts).forEach(() => {
        if (actionsLeft > 0) { chosen.push({ action: "battle", reason: "with a Weapon" }); actionsLeft -= 1; }
    });

    // The best action each time. Doing the same one again counts for less
    const available = play.actions.split(",").concat(preludeSpent.some(offer => offer.converts) ? ["battle"] : []);
    const scores = {};
    available.forEach(action => { scores[action] = getActionPlanScore(player, action, focus); });
    // No more Moves than the board has useful ones, never back the way it came (#197). A Move to
    // set up a Battle is added later if it needs one
    const usefulMoves = available.includes("move") ? getUsefulMoveCount(player) : 0;
    // Another Battle isn't worth less when attacking again can clear most or all of a Rival's
    // pieces at good odds (#200 phase 3, the user)
    const repeatBattle = available.includes("battle") && hasRepeatableBattle(player);
    while (actionsLeft > 0) {
        const value = action => scores[action].score + player.planVariation[action]
            - (action == "battle" && repeatBattle ? 0 : chosen.filter(pick => pick.action == action).length * turnPlanWeights.repeat)
            + (action == "move" && chosen.some(pick => pick.action == "battle") && !chosen.some(pick => pick.action == "move") ? turnPlanWeights.moveForBattle : 0);
        // No more Taxes than it has cities to tax, unless it's taxing Rivals to capture
        const canTaxAgain = scores.tax == null || scores.tax.reason == rivalTaxReason || canTaxCityAgain(player)
            || chosen.filter(pick => pick.action == "tax").length < Math.max(getCitiesToTax(player).length + Number(player.startingCity || 0), 1);
        // No more Secures than there are cards it can secure
        const canSecureAgain = !isMarketKnown() || chosen.filter(pick => pick.action == "secure").length < Math.max(getCardsToSecure(player).length, 1);
        // No more Influences than it has agents (#123)
        const agentsLeft = getAgentsLeft(player);
        const canInfluenceAgain = agentsLeft == null || chosen.filter(pick => pick.action == "influence").length < agentsLeft;
        // No more Repairs than it has pieces on the board to repair (#145)
        const canRepairAgain = chosen.filter(pick => pick.action == "repair").length < getRepairablePieces(player);
        const canMoveAgain = chosen.filter(pick => pick.action == "move").length < usefulMoves;
        const best = available.filter(action => scores[action].score > planImpossible && (action != "tax" || canTaxAgain) && (action != "secure" || canSecureAgain) && (action != "influence" || canInfluenceAgain) && (action != "repair" || canRepairAgain) && (action != "move" || canMoveAgain))
            .sort((a, b) => value(b) - value(a))[0];
        if (best == null) { break; }
        chosen.push({ action: best, reason: scores[best].reason, tag: scores[best].tag || "" });
        actionsLeft -= 1;
    }

    // Its fleet needs a Move to reach the battle (boardbot.js, #160): the first step it can spare
    // becomes that Move, if its card can Move
    setFleetFromBoard(player);
    // A Battle needs a Rival it can fight this turn (#188): who it wants to fight; can it, sharing a
    // system now, or with a Move first; if not, anyone else it can; and only at good odds
    if (chosen.some(pick => pick.action == "battle") && !player.campaignTarget) {
        chosen = makeBattleReachable(player, chosen, available, scores, preludeSpent);
    }

    // A move sets up a battle, if there's one
    const hasBattle = chosen.some(pick => pick.action == "battle");
    let taxTargets = getCitiesToTax(player);
    let secureTargets = isMarketKnown() ? getCardsToSecure(player) : [];
    // Each Influence in turn, as if the earlier ones were placed, so the Court window's advice
    // matches each step (#156)
    const influenceTargets = isMarketKnown() ? getInfluenceSequence(player, chosen.filter(pick => pick.action == "influence").length) : [];
    let ruthlessShown = false;
    // Each Move takes the next reason, and the last also says what to do otherwise (#118)
    const moveReasons = getMoveReasons(player);
    const moveCount = chosen.filter(pick => pick.action == "move").length;
    let movesSeen = 0, reasonIndex = 0;
    // Each step at a place on the board (boardbot.js, #160)
    return placeBoardPlan(player, chosen.sort((a, b) => turnPlanOrder.indexOf(a.action) - turnPlanOrder.indexOf(b.action)).map(pick => {
        let name = capitalise(pick.action);
        let reason = pick.reason;
        let details = {};

        if (pick.action == "move") {
            const first = movesSeen == 0;
            movesSeen += 1;
            if (first && hasBattle && reason != "the board shows it can" && player.moveGoal == null) {
                reason = "to set up the Battle";
            } else if (!first || focus != "move") {
                const last = movesSeen == moveCount;
                const index = Math.min(reasonIndex, moveReasons.length - 1);
                reason = moveReasons[index] + (last && index + 1 < moveReasons.length ? ", otherwise " + moveReasons[index + 1] : "");
                reasonIndex += 1;
            }
        }
        if (pick.action == "tax" && reason != rivalTaxReason && taxTargets.length > 0) {
            // Each Tax goes to the next city it wants. With Warlord's Cruelty it may tax one again
            details.resource = taxTargets.shift();
            if (canTaxCityAgain(player) && taxTargets.length == 0) { taxTargets.push(details.resource); }
            name = getTaxStepName(player, details.resource);
            // Outraged: it can't spend it in its prelude, but it still counts for its ambition
            // (rulebook p.17, #193)
            if ((player.outraged || []).includes(details.resource)) {
                const ambition = preludeAmbitions[details.resource];
                const plans = !declaredAmbitions.includes(ambition) ? ": it holds a " + capitalise(ambition) + " card to declare" : "";
                reason = (reason ? reason + "; " : "") + "it's Outraged in " + getResourceWord(details.resource) + ", so it can't spend it, but it counts for " + capitalise(ambition) + plans;
            }
        }
        if (pick.action == "tax" && reason == rivalTaxReason) {
            // Overseer (Ruthless) once a turn
            details.rivalTax = true;
            details.ruthless = !ruthlessShown;
            ruthlessShown = true;
        }
        if (pick.action == "secure" || pick.action == "influence") {
            // The card itself if the market's been entered, otherwise the kind it wants
            const entry = (pick.action == "secure") ? secureTargets.shift() : influenceTargets.shift();
            const resource = getWantedCardResource(player);
            if (entry != null) {
                name += " " + getCourtCard(entry.number).name;
                if (reason == "") { reason = getMarketReason(player, entry); }
            } else if (!isMarketKnown() && resource != null) {
                name += " a " + preludeResourceNames[resource].toLowerCase() + " card";
            }
        }
        return { action: pick.action, text: name + (reason ? " (" + reason + ")" : ""), tag: pick.tag || "", hints: getLeaderPlanHints(player, pick.action, details) };
    }));
}

function makeBattleReachable(player, chosen, available, scores, preludeSpent) {
    // Returns the plan with its Battles against a Rival it can fight this turn (#188):
    // 1. its target, if it shares a system with them at good odds;
    // 2. its target, with a Move first if it has one (a spare action becomes the Move);
    // 3. otherwise the best Rival it can fight now, then one it can Move to;
    // 4. otherwise no Battle: those actions go to the next best thing
    const rivals = players.filter(other => other !== player);
    // Warrior (Tactical): a Copy or Pivot to Battle may Move first, for free (leaderrules.js)
    const tactical = hasTacticalMove(player);
    const canMove = available.includes("move") || preludeSpent.some(offer => offer.action == "move") || tactical;
    const hasMove = () => chosen.some(pick => pick.action == "move") || preludeSpent.some(offer => offer.action == "move");
    const addMove = () => {
        if (hasMove()) { return true; }
        if (tactical) { chosen.unshift({ action: "move", reason: "a free Move before the Battle (Warrior, Tactical)", tag: "" }); return true; }
        if (!available.includes("move")) { return false; }
        const spare = chosen.findIndex(pick => pick.action != "battle");
        const index = spare >= 0 ? spare : (chosen.filter(pick => pick.action == "battle").length > 1 ? chosen.findIndex(pick => pick.action == "battle") : -1);
        if (index < 0) { return false; }
        chosen[index] = { action: "move", reason: "to set up the Battle", tag: "" };
        return true;
    };
    const target = getBattleTarget(player);
    const wanted = target != null && typeof target.player.number == "number" ? target.player : null;
    // Best first by how it rates them as a target (the target itself first)
    const ranked = [wanted].concat(rivals.filter(rival => rival !== wanted)).filter(rival => rival != null);
    const now = ranked.find(rival => canFightNow(player, rival));
    if (wanted != null && now === wanted) { return chosen; }
    if (wanted != null && canMove && hasFavourableBattle(player, wanted, true) && addMove()) { return chosen; }
    if (now != null) { player.battleTargetNumber = now.number; return chosen; }
    const byMoving = canMove ? ranked.find(rival => hasFavourableBattle(player, rival, true)) : null;
    if (byMoving != null && addMove()) { player.battleTargetNumber = byMoving.number; return chosen; }
    // Nobody to fight this turn: the card's other actions instead, best first, such as a Secure that's
    // possible or a Move the board has a use for (no more Moves than it has useful ones)
    const usefulMoves = available.includes("move") ? getUsefulMoveCount(player) : 0;
    let moves = chosen.filter(pick => pick.action == "move").length;
    const others = available.filter(action => action != "battle" && scores[action] != null && scores[action].score > planImpossible)
        .sort((a, b) => scores[b].score - scores[a].score);
    return chosen.map(pick => {
        if (pick.action != "battle") { return pick; }
        const next = others.find(action => action != "move" || moves < usefulMoves);
        if (next == null) { return null; }
        if (next == "move") { moves++; }
        return { action: next, reason: scores[next].reason || "", tag: "" };
    }).filter(pick => pick != null);
}

function describeTurnPlan(player) {
    // e.g. "Plan: Move (to set up the Battle) → Battle (chasing Warlord) ×2". null if there's none
    const plan = getTurnPlan(player);
    if (plan.length == 0) { return null; }

    // The same step twice in a row is shown once, with how many
    const steps = plan.map(step => step.text);
    const shown = steps.filter((step, index) => index == 0 || step != steps[index - 1])
        .map(step => { const count = steps.filter(other => other == step).length; return step + (count > 1 ? " &times;" + count : ""); });
    return "<b>Plan:</b> " + shown.join(" &rarr; ");
}
