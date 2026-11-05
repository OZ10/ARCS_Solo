// Turn plan: how a bot should use the actions on its card, shown in its turn summary. The bot
// can't see the board, so this is a suggestion for the player to carry out as best they can.
// The scores are in rules.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const rivalTaxReason = "a Rival's city, to capture";

function getTaxTargets(player) {
    // The resources it has cities on, the one it needs most first
    return preludeResources.filter(resource => player["cities" + capitalise(resource) + "Value"] > 0)
        .sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a));
}

function getResourceSupply(resource) {
    // What's left to take: every token not held by a player. With 2 players some are out of play
    // on the ambitions, so this can be too high, but the Tax question still catches that
    return Math.max(resourceTokens - players.reduce((total, player) => total + player[resource + "Value"], 0), 0);
}

function getCitiesToTax(player) {
    // Its cities it can gain a resource from: there's one left, and it wasn't told it can't
    const ruledOut = (player.noTax || []).flatMap(ambition => ambitionTaxResources[ambition] || []);
    return getTaxTargets(player).filter(resource => getResourceSupply(resource) > 0 && !ruledOut.includes(resource));
}

function getMoveGoal(player) {
    // Why it would Move, from what the app knows without asking: a Rival to tax or raid for what
    // it's chasing, or a slot for a city it wants. It needs a way to follow it up: more actions
    // on this card, or another card. null if nothing stands out (#102)
    const play = getBotPlay(player);
    const hand = getUnplayedCards(player.cards);
    const canFollowUp = action => (play != null && play.count > 1 && play.actions.includes(action)) || hand.some(card => card.actions.includes(action));
    const rivals = players.filter(other => other !== player);
    const cityOn = (other, resource) => other["cities" + capitalise(resource) + "Value"] > 0;
    const named = resource => preludeResourceNames[resource].toLowerCase();

    for (const resource of preludeResources.filter(candidate => getResourceNeed(player, candidate) == 2)) {
        if (!cityOn(player, resource) && rivals.some(other => cityOn(other, resource)) && getResourceSupply(resource) > 0 && canFollowUp("tax")) {
            return "towards a Rival's " + named(resource) + " city, with more fresh ships than they have there";
        }
        const holder = getRaidHolders(player, [resource])[0];
        if (holder != null && canFollowUp("battle")) {
            return "towards Player " + holder.player.number + ", who holds " + holder.count + " " + named(resource) + (holder.count > 1 && resource != "fuel" ? "s" : "") + ", to raid them";
        }
    }

    const chasing = ambition => declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition);
    if (chasing("tyrant") && rivals.some(other => other.startingCity || cityCounters.some(counter => other[counter + "Value"] > 0)) && canFollowUp("tax")) {
        return "towards a Rival's city, with more fresh ships than they have there, to capture";
    }
    if (chasing("warlord") && canFollowUp("battle")) { return "towards a Rival's ships, to Battle them"; }

    const newCity = preludeResources.filter(resource => !cityOn(player, resource) && getResourceNeed(player, resource) > 0)
        .sort((a, b) => getResourceNeed(player, b) - getResourceNeed(player, a))[0];
    if (newCity != null && getUncoveredCities(player) < maxCities && canFollowUp("build")) {
        return "towards a " + named(newCity) + " planet with an open slot, to build a city";
    }
    return null;
}

function getBattleTargetReason(player, rival) {
    // Why this Rival, as { why, where }. The app can't see the map, so where is a rule of thumb:
    // a defending fresh ship hits back on an intercept, and raid dice need a building there
    const outnumber = "Choose a system where it outnumbers their fresh ships.";
    const holding = preludeResources.filter(resource => getResourceNeed(player, resource) == 2)
        .map(resource => ({ resource: resource, count: rival[resource + "Value"] + getGuildIconCount(rival, resource) }))
        .filter(held => held.count > 0).sort((a, b) => b.count - a.count)[0];
    if (holding != null) {
        const name = preludeResourceNames[holding.resource].toLowerCase() + (holding.count > 1 && holding.resource != "fuel" ? "s" : "");
        return { why: "They hold " + holding.count + " " + name + " to raid.", where: "Choose a system with a building of theirs, for raid dice." };
    }

    const others = players.filter(other => other !== rival);
    if (declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord")) {
        return { why: "They have " + rival.shipsBoardValue + " ship" + (rival.shipsBoardValue == 1 ? "" : "s") + " to destroy for Trophies.", where: outnumber };
    }
    if (others.every(other => rival.powerValue > other.powerValue)) { return { why: "They're leading on Power.", where: outnumber }; }
    return { why: "They have " + rival.shipsBoardValue + " ship" + (rival.shipsBoardValue == 1 ? "" : "s") + " on the board.", where: outnumber };
}

function getBattleTarget(player) {
    // Who it would rather Battle this turn, as { player, why, where }: whoever holds what it's
    // chasing, is ahead on Power or, for Warlord, has ships to destroy. Chosen once a turn so it
    // doesn't change as tiles are tapped, with a little variation so it isn't predictable. Only
    // Rivals with something on the board. null if there are none
    const weights = battleTargetWeights;
    const rivals = players.filter(other => other !== player
        && (other.shipsBoardValue > 0 || other.startingCity || cityCounters.some(counter => other[counter + "Value"] > 0)));
    if (rivals.length == 0) { return null; }

    let target = rivals.find(other => other.number == player.battleTargetNumber);
    if (target == null) {
        const chased = preludeResources.filter(resource => getResourceNeed(player, resource) == 2);
        const warlord = declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord");
        const score = rival => chased.reduce((total, resource) => total + (rival[resource + "Value"] + getGuildIconCount(rival, resource)) * weights.holding, 0)
            + (players.filter(other => other !== rival).every(other => rival.powerValue > other.powerValue) ? weights.leader : 0)
            + rival.powerValue * weights.power
            + rival.shipsBoardValue * (warlord ? weights.shipWarlord : weights.ship)
            + Math.random() * weights.variation;
        target = rivals.map(rival => ({ rival: rival, score: score(rival) })).sort((a, b) => b.score - a.score)[0].rival;
        player.battleTargetNumber = target.number;
    }
    return { player: target, ...getBattleTargetReason(player, target) };
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
            else { reason = "to guard a city with no ships with it, if one needs it"; }
            break;
        }

        case "battle":
            if (player.shipsBoardValue == 0 && action != focus) { return { score: planImpossible }; }
            if (chasing("warlord")) { score += weights.battleWarlord; reason = "chasing Warlord"; }
            else if (chasing("tyrant")) { score += weights.battleTyrant; reason = "chasing Tyrant"; }
            if (player.shipsBoardValue >= manyShipsOnBoard) { score += weights.battleManyShips; if (reason == "") { reason = "lots of ships on the board"; } }
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
            if (getWantedCardResource(player) != null) { score += weights.influenceWanted; }
            break;

        case "tax": {
            const targets = getCitiesToTax(player);
            if (chasing("tyrant") && !(player.noTax || []).includes("TYRANT")) { score += weights.taxTyrant; reason = rivalTaxReason; break; }
            if (action != focus && (getEmptySlots(player) == 0 || (targets.length == 0 && !player.startingCity))) { return { score: planImpossible }; }
            if (targets.length > 0) { score += getResourceNeed(player, targets[0]) * weights.taxPerNeed; }
            break;
        }

        case "build":
            if (player.canBuild === false && !canUseGuildActionInsteadOf(player, "build")) { return { score: planImpossible }; }
            if (player.shipsBoardValue < fewShipsOnBoard) { score += weights.buildFewShips; reason = "short of ships, or repair a damaged one"; }
            else if (isNearCityBonus(player)) { score += weights.buildNearBonus; reason = "towards the city bonus"; }
            break;

        case "repair": {
            // Damage only matters for intercepts and control, which are about ships, and a building
            // takes hits only once the ships are gone. A city is worth it if it's chasing that
            // resource. With lots of ships, a damaged one matters less
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

    // What the player said it can do, in the Yes/No questions
    if (action == focus) { score += weights.focus; reason = (action == "move" && player.moveGoal != null) ? player.moveGoal : "you said it can"; }
    return { score: score, reason: reason };
}

function getTurnPlan(player) {
    // The actions it should take this turn in the order to take them, as
    // [{ action, text }]. [] for the human player, or if its card gives no actions
    if (player.isHuman) { return []; }
    const play = getBotPlay(player);
    if (play == null) { return []; }

    // A little variation for the turn, so it isn't always the same plan. Kept so the plan
    // doesn't change every time the summary is redrawn
    if (player.planVariation == null) {
        player.planVariation = {};
        turnPlanOrder.forEach(action => { player.planVariation[action] = Math.random() * turnPlanWeights.variation; });
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
    while (actionsLeft > 0) {
        const value = action => scores[action].score + player.planVariation[action]
            - chosen.filter(pick => pick.action == action).length * turnPlanWeights.repeat
            + (action == "move" && chosen.some(pick => pick.action == "battle") && !chosen.some(pick => pick.action == "move") ? turnPlanWeights.moveForBattle : 0);
        // No more Taxes than it has cities to tax, unless it's taxing Rivals to capture
        const canTaxAgain = scores.tax == null || scores.tax.reason == rivalTaxReason
            || chosen.filter(pick => pick.action == "tax").length < Math.max(getCitiesToTax(player).length + (player.startingCity ? 1 : 0), 1);
        // No more Secures than there are cards it can secure
        const canSecureAgain = !isMarketKnown() || chosen.filter(pick => pick.action == "secure").length < Math.max(getCardsToSecure(player).length, 1);
        const best = available.filter(action => scores[action].score > planImpossible && (action != "tax" || canTaxAgain) && (action != "secure" || canSecureAgain))
            .sort((a, b) => value(b) - value(a))[0];
        if (best == null) { break; }
        chosen.push({ action: best, reason: scores[best].reason });
        actionsLeft -= 1;
    }

    // A move sets up a battle, if there's one
    const hasBattle = chosen.some(pick => pick.action == "battle");
    let taxTargets = getCitiesToTax(player);
    let secureTargets = isMarketKnown() ? getCardsToSecure(player) : [];
    const influenceTarget = isMarketKnown() ? getCardsToInfluence(player)[0] : null;
    return chosen.sort((a, b) => turnPlanOrder.indexOf(a.action) - turnPlanOrder.indexOf(b.action)).map(pick => {
        let name = capitalise(pick.action);
        let reason = pick.reason;

        if (pick.action == "move" && hasBattle && reason != "you said it can" && player.moveGoal == null) { reason = "to set up the Battle"; }
        if (pick.action == "tax" && reason != rivalTaxReason && taxTargets.length > 0) {
            // Each Tax goes to the next city it wants
            name = "Tax its " + preludeResourceNames[taxTargets.shift()].toLowerCase() + " city";
        }
        if (pick.action == "secure" || pick.action == "influence") {
            // The card itself if the market's been entered, otherwise the kind it wants
            const entry = (pick.action == "secure") ? secureTargets.shift() : influenceTarget;
            const resource = getWantedCardResource(player);
            if (entry != null) {
                name += " " + getCourtCard(entry.number).name;
                if (reason == "") { reason = getMarketReason(player, entry); }
            } else if (!isMarketKnown() && resource != null) {
                name += " a " + preludeResourceNames[resource].toLowerCase() + " card";
            }
        }
        return { action: pick.action, text: name + (reason ? " (" + reason + ")" : "") };
    });
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
