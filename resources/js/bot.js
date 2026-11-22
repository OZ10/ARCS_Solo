// Bot decisions: which card to play, chasing ambitions with the Yes/No questions, surpass/copy/claim/pivot and declaring.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function playcardclick() {
    // This is the AI playing a card. Save the game first so the card can be undone
    if (currentPlayer.hasPlayedACardThisTurn == false) { saveUndoPoint(currentPlayer.number); }

    askThenPlay(currentPlayer);
}

function askThenPlay(player) {
    // The questions a bot asks before choosing its card, one after another, then its card
    // Out of ships: declaring Warlord gets them back from Rivals' Trophies (#129)
    if (shouldAskOutOfShips(player)) {
        askYesNo("WARLORD", "Have I run out of ships to build? (Some of mine may be Rivals' Trophies.)", outOfShips => {
            player.outOfShips = outOfShips;
            SaveAllSettings();
            askThenPlay(player);
        });
        return;
    }
    // Agents: with the Court not entered it can't count them, so it asks when they may be gone (#123)
    if (shouldAskAgents(player)) {
        askYesNo("INFLUENCE", "Do I have any agents left in my supply?", agentsLeft => {
            player.agentsOut = !agentsLeft;
            SaveAllSettings();
            askThenPlay(player);
        });
        return;
    }
    // Construction only builds and repairs, so first check what it would build is possible (#62, #126)
    if (shouldAskCanBuild(player)) {
        const intent = getBuildIntent(player);
        askYesNo("BUILD", getBuildQuestion(intent), canBuild => {
            player.canBuild = canBuild;
            player.buildIntent = intent;
            SaveAllSettings();
            askThenPlay(player);
        });
        return;
    }
    // It would move to a planet to build a city there: first check it hasn't already a free slot (#146)
    if (shouldAskSlotForMove(player)) {
        const resource = getNewCityResource(player);
        askYesNo("MOVE", "Is there an empty building slot on a " + preludeResourceNames[resource].toLowerCase() + " planet in a system where I have a piece?", hasSlot => {
            player.hasSlotForCity = hasSlot;
            SaveAllSettings();
            askThenPlay(player);
        });
        return;
    }
    // Its ships are spread over the map: the biggest fleet it could attack with this turn
    if (shouldAskAttackFleet(player)) {
        const move = getFleetMove(player);
        askNumber("BATTLE", getAttackFleetQuestion(player, move), player.shipsBoardValue, "None", fleet => {
            player.attackFleetSize = fleet;
            player.attackFleetMove = move;
            player.battleTargetNumber = null;
            SaveAllSettings();
            askThenPlay(player);
        });
        return;
    }
    // In a campaign, whether the Free States, the Blight or the Empire are in reach (campaignhooks.js)
    if (runCampaignHook("botQuestions", player, () => askThenPlay(player)) === true) { return; }
    determineCardToPlay(player);
}

function shouldAskSlotForMove(player) {
    // Asked once a turn, when Moving to build a city is its best reason to Move and it has a card
    // that can Move
    if (player.hasSlotForCity != null || getNewCityResource(player) == null) { return false; }
    if (!getUnplayedCards(player.cards).some(card => card.actions.includes("move"))) { return false; }
    const goal = getMoveGoal(player);
    return goal != null && goal.endsWith("to build a city");
}

function shouldAskAgents(player) {
    // The Court isn't entered, it has a card that can Influence, and enough of its agents are known
    // to be in use that it may have none left (#123)
    if (player.agentsOut != null || isMarketKnown()) { return false; }
    if (!getBotCards(player).some(card => card.actions.includes("influence"))) { return false; }
    const inUse = (player.outraged || []).length + (player.agentsCaptive || 0) + (player.agentsTrophy || 0);
    return inUse >= agentsAskAt;
}

function shouldAskOutOfShips(player) {
    // It's leading, could declare Warlord with a card in its hand, and has few ships on the board
    if (player.outOfShips != null || !isLeadingThisTurn() || player.shipsBoardValue >= outOfShipsBelow) { return false; }
    if (declaredAmbitions.includes("warlord") || declaredAmbitions.length >= 3 || !canDeclareAmbition(player)) { return false; }
    return getBotCards(player).some(card => card.ambition == "warlord");
}

function shouldAskCanBuild(player) {
    // Only when the bot might play a Construction card face up for its actions: it has one,
    // and it's leading, Construction was led, or it has no card of the lead suit (so it may
    // pivot). Asked once a turn. Not if it has a Guild card action it can use instead of a Build,
    // as that doesn't need a slot, so Construction is still worth playing (#86). Not if it has no
    // reason to build, as the answer is nearly always Yes (#92)
    const hand = getBotCards(player);
    if (player.canBuild != null || !hand.some(card => card.name == "Construction")) { return false; }
    if (canUseGuildActionInsteadOf(player, "build") || !wantsToBuild(player)) { return false; }
    // Leading: only if a Yes would have it lead Construction (#155)
    if (isLeadingThisTurn()) { return wouldLeadConstruction(hand); }

    const lead = playedCardList[0];
    return lead.name == "Construction" || !hand.some(card => card.name == lead.name);
}

function wouldLeadConstruction(hand) {
    // The card it would lead if it could build (see findCardToPlay): the highest of the ambition
    // it would declare, otherwise its highest card
    const withAmbition = findCardsWithAmbition(prioritiseAndSortAmbitions(), hand);
    const top = getHighestCard(withAmbition.length > 0 ? withAmbition : hand);
    return top != null && top != "" && top.name == "Construction";
}

function wantsNewCityType(player) {
    // It has no city on a resource a declared ambition counts, or it might just fancy one on
    // another. Rolled once a turn, so its mind doesn't change partway through the turn
    if (getUncoveredCities(player) >= maxCities) { return false; }
    const missing = preludeResources.filter(resource => player["cities" + capitalise(resource) + "Value"] == 0);
    if (missing.length == 0) { return false; }
    if (missing.some(resource => declaredAmbitions.includes(resource == "weapons" ? "warlord" : preludeAmbitions[resource]))) { return true; }

    if (player.newCityWanted == null) { player.newCityWanted = Math.random() * 100 < newCityChance; }
    return player.newCityWanted;
}

function wantsToBuild(player) {
    // It has something it would build (#126)
    return getBuildIntent(player) != null;
}

function avoidsConstruction(player) {
    // It was told it can't build or repair, or it has no reason to. A Guild card action it can
    // use instead of a Build still makes Construction worth playing (#86)
    if (player.canBuild != null) { return player.canBuild === false; }
    return !wantsToBuild(player) && !canUseGuildActionInsteadOf(player, "build");
}

function withoutUselessConstruction(player, cards) {
    // A bot that can't build or repair doesn't play Construction face up for its actions,
    // unless that's all it has (#62)
    if (player.canBuild !== false) { return cards; }
    return withoutConstruction(cards);
}

function withoutUnwantedConstruction(player, cards) {
    // Likewise a bot with no reason to build (#92). Only for choosing a card for its actions: it
    // can still lead one to declare its ambition
    return avoidsConstruction(player) ? withoutConstruction(cards) : cards;
}

function withoutConstruction(cards) {
    const others = cards.filter(card => card.name != "Construction");
    return (others.length > 0) ? others : cards;
}

// A one-off Yes/No question that isn't about an ambition (see askYesNo)
let yesNoCallback = null;

function askYesNo(focus, question, onAnswer, player = null) {
    // Ask in the Yes/No window, then call onAnswer(true or false) once it has closed. Closed
    // with its X, nothing happens (tapping Play Card asks again). player: who it's for, if not
    // the current player
    let answer = null;
    yesNoCallback = value => { answer = value; };
    yesNoPlayer = player;
    document.getElementById("yesNo").addEventListener('hidden.bs.modal', () => {
        yesNoCallback = null;
        yesNoPlayer = null;
        if (answer != null) { onAnswer(answer); }
    }, { once: true });

    modal = openYesNoModal(focus);
    updateYesNoText(question);
    modal.show();
}

function askNumber(focus, question, most, noneLabel, onAnswer) {
    // A question answered with a number, in the Yes/No window: a button for each from 1 to most, and
    // one for none. Then onAnswer(number) once it has closed. Closed with its X, nothing happens
    // (tapping Play Card asks again)
    const yesNoWindow = document.getElementById("yesNo");
    const footer = yesNoWindow.querySelector(".modal-footer");
    let answer = null;
    numberCallback = value => {
        answer = value;
        bootstrap.Modal.getOrCreateInstance(yesNoWindow).hide();
    };
    yesNoWindow.addEventListener('hidden.bs.modal', () => {
        numberCallback = null;
        footer.classList.remove("d-none");
        if (answer != null) { onAnswer(answer); }
    }, { once: true });

    const modal = openYesNoModal(focus);
    const buttons = Array.from({ length: most }, (_, index) => "<button type=\"button\" class=\"numberanswer\" onclick=\"numberCallback(" + (index + 1) + ")\">" + (index + 1) + "</button>").join("")
        + "<button type=\"button\" class=\"numberanswer small\" onclick=\"numberCallback(0)\">" + noneLabel + "</button>";
    updateYesNoText(question + "<div class=\"numberanswers\">" + buttons + "</div>");
    footer.classList.add("d-none");
    modal.show();
}
let numberCallback = null;

function getBotCards(player) {
    // The cards a bot chooses from. A campaign's Event cards are played by their own rule (campaignhooks.js)
    return runCampaignHook("botCards", player) ?? getUnplayedCards(player.cards);
}

function determineCardToPlay(player) {

    if (player.hasPlayedACardThisTurn == false) {
        // A campaign may have the bot play an Event card instead (campaignhooks.js)
        if (runCampaignHook("botPlaysEvent", player) === true) { return; }
        let unplayedCards = getBotCards(player);

        findFocus(player, unplayedCards);

    }
}

function findFocus(player, unplayedCards) {
    // LOGIC:
    // - TODO Need to check if player is leading and then workout whether they should declare instead of chasing.
    //   At present, when leading, the AI looks to chase which leads to only one ambition being declared per round.
    // - Chase ambition
    // - Build for future turn
    // - random

    if (isLeadingThisTurn()){
        findCardToPlay(unplayedCards, "");
    }else{
        if (chaseAmbition(player, getPossibleActions(unplayedCards), unplayedCards) == false){
            // couldn't chase ambition. Play a card.
            findCardToPlay(unplayedCards, "");
        }
    }

    // CARDS CANNOT BE PLAYED BELOW THE ABOVE IF STATEMENT
    // ANY CODE BELOW WILL RUN WHILE THE MODAL PROMPT IS DISPLAYED
    // AND WILL RESULT IN THE PLAYER PLAYING MULITPLE CARDS
}

function getRaidHolders(player, resources) {
    // The Rivals with something of these resources to steal, most first. Not a protected Guild card
    // (a campaign's Fate cards, with an X for their keys), which can't be stolen (#171)
    return players.filter(other => other !== player)
        .map(other => ({ player: other, count: resources.reduce((total, resource) => total + other[resource + "Value"] + getStealableIconCount(other, resource), 0) }))
        .filter(holder => holder.count > 0).sort((a, b) => b.count - a.count);
}

function canMoveThenDo(player, action) {
    // Whether it holds a card to Move with, and a way to do this after: a different card on a
    // later turn, or the same card if it has both. A Weapon lets any card Battle
    const hand = getBotCards(player);
    return hand.some(card => card.actions.includes("move") && (card.actions.includes(action)
        || hand.some(other => other !== card && other.actions.includes(action))
        || (action == "battle" && player.weaponsValue > 0)));
}

function hasSlotForRaid(player, resources) {
    // An empty resource slot, or a resource it could spare in its prelude to free one (#158)
    if (getEmptySlots(player) > 0) { return true; }
    return preludeResources.some(resource => !resources.includes(resource) && player[resource + "Value"] > 0 && canSpareResource(player, resource) && !couldScoreFromHand(player, resource));
}

function isReachQuestionPossible(ambition, action, player) {
    // Whether it's worth asking if it can move into position. It needs ships, a card to Move
    // with, and something to go for
    if (player.shipsBoardValue == 0) { return false; }

    const resources = ambitionTaxResources[ambition];
    switch (action) {
        case "reachTax": {
            const rivals = players.filter(other => other !== player);
            const hasCity = other => other.startingCity || (resources == null
                ? cityCounters.some(counter => other[counter + "Value"] > 0)
                : resources.some(resource => other["cities" + capitalise(resource) + "Value"] > 0));
            const supply = resources == null || resources.some(resource => getResourceSupply(resource) > 0);
            return supply && rivals.some(hasCity) && canMoveThenDo(player, "tax");
        }
        case "reachRaid":
            return getRaidHolders(player, resources).length > 0 && canMoveThenDo(player, "battle") && hasSlotForRaid(player, resources);
        default:
            return canMoveThenDo(player, "battle");
    }
}

function getReachQuestion(ambition, action, player) {
    const catapult = "Count a Catapult from my starport.";
    const reach = "this turn, or get within one space";
    if (action == "reachTax") {
        const word = ambitionResourceWords[ambition];
        const city = (word == null) ? "a Rival's city" : "a Rival's " + word.replace(/relics/, "relic").replace(/psionics/, "psionic") + " city";
        return "Can I reach " + city + " " + reach + " of it? " + catapult + " I'd need more fresh ships there than they have.";
    }
    if (action == "reachRaid") {
        const holder = getRaidHolders(player, ambitionTaxResources[ambition])[0];
        return "Can I reach a building of Player " + holder.player.number + "'s " + reach + ", to raid them? They hold " + holder.count + " " + ambitionResourceWords[ambition] + ". " + catapult;
    }
    return "Can I reach a Rival's ships " + reach + "? " + catapult;
}

function getReachGoal(ambition, action, player) {
    // What a Yes means it's moving for, for the turn plan
    if (action == "reachBattle") { return "towards a Rival's ships, to Battle them"; }
    if (action == "reachRaid") {
        const holder = getRaidHolders(player, ambitionTaxResources[ambition])[0];
        return "towards Player " + holder.player.number + ", who holds " + holder.count + " " + ambitionResourceWords[ambition] + ", to raid them";
    }
    const word = ambitionResourceWords[ambition];
    return "towards " + ((word == null) ? "a Rival's city" : "a Rival's " + word.replace(/relics/, "relic").replace(/psionics/, "psionic") + " city")
        + ", with more fresh ships than they have there";
}

function getNextQuestionNumber(ambition, afterQuestionNumber, possibleActions, player) {
    // Find the next question for the ambition that the player has a card
    // for, skipping any whose action isn't in their hand. 0 if there are none
    // A campaign's new ambitions (Edenguard, Blightkin) count what's on the map, so have no questions
    const questionActions = ambitionQuestionActions[ambition] || [];

    // On the player's final turn of the round (their last card) there's no later turn
    // to secure a card influenced now, so don't ask about influencing
    const isFinalTurn = getBotCards(player).length <= 1;

    for (let questionNumber = afterQuestionNumber + 1; questionNumber <= questionActions.length; questionNumber++) {
        const action = questionActions[questionNumber - 1];
        if (isFinalTurn && action == "influence") { continue; }
        // In a campaign, nothing its Fate rules out this Act, such as a Battle (campaignhooks.js)
        if (["battle", "reachBattle", "reachRaid"].includes(action) && runCampaignHook("avoidsAction", player, "battle") === true) { continue; }

        // No need to ask about taxing for a resource that has run out
        const taxResources = ambitionTaxResources[ambition];
        if (action == "tax" && taxResources != null && !taxResources.some(resource => getResourceSupply(resource) > 0)) { continue; }

        // Moving into position has its own checks
        if (action.startsWith("reach")) {
            if (isReachQuestionPossible(ambition, action, player)) { return questionNumber; }
            continue;
        }

        // No need to ask about raiding for something no Rival has
        // (In a campaign, the Free States may have it: campaignhooks.js)
        if (action == "battle" && taxResources != null && getRaidHolders(player, taxResources).length == 0 && runCampaignHook("knownYes", ambition, action, player) == null) { continue; }
        // Nowhere to put what it raids: every slot full, and nothing it could spare to free one (#158)
        if (action == "battle" && taxResources != null && !hasSlotForRaid(player, taxResources)) { continue; }

        // With the market entered, there's no need to ask about a card that isn't there
        if (!isMarketQuestionPossible(ambition, action, player)) { continue; }

        if (possibleActions.includes(action)) {
            return questionNumber;
        }
    }
    return 0;
}

function getPossibleActions(unplayedCards) {
    let possibleActions = "";
    unplayedCards.forEach(card => {
        possibleActions += card.actions;
    });
    return possibleActions;
}

function getKnownYesReason(ambition, action, player) {
    // A question the app can answer Yes to itself, as the reason it gives, or null to ask (#104).
    // Its own city can be taxed anywhere, without control, if there's some left to take. With the
    // market entered, it knows which cards it can secure or influence (getNextQuestionNumber has
    // already skipped the questions that can't be a Yes)
    // In a campaign, you've already said the Free States, the Blight or the Empire are in reach (campaignhooks.js)
    const campaignKnown = runCampaignHook("knownYes", ambition, action, player);
    if (campaignKnown != null) { return campaignKnown; }
    const resources = ambitionTaxResources[ambition];
    if (action == "tax" && resources != null && !(player.noTax || []).includes(ambition)) {
        const own = resources.find(resource => player["cities" + capitalise(resource) + "Value"] > 0 && getResourceSupply(resource) > 0);
        if (own != null) { return "it has one, and " + resourceLeftWords[own]; }
    }
    if (isMarketKnown() && action == "secure") { return "it has the most agents on it"; }
    if (isMarketKnown() && action == "influence") { return "it's in the market"; }
    return null;
}

function chaseAmbition(player, possibleActions, unplayedCards) {
    // TODO Need to determine which ambition is best to chase
    // - Have cards to chase?
    // - Have pieces to chase?
    // - Worth most points?
    for (let index = 0; index < declaredAmbitions.length; index++) {
        const ambition = declaredAmbitions[index].toUpperCase();

        if (player.ambitionsEvaluated.includes(ambition)) { continue; }

        // Ask the first question for this ambition the player has a card for
        const questionNumber = getNextQuestionNumber(ambition, 0, possibleActions, player);
        if (questionNumber > 0) {
            // No need to ask what the app already knows
            const known = getKnownYesReason(ambition, ambitionQuestionActions[ambition][questionNumber - 1], player);
            if (known != null) {
                playForQuestion(player, ambition, questionNumber, known);
            } else {
                focus_ambition(ambition, questionNumber);
            }
            return true;
        }
    }

    return false;
}

function focus_ambition(ambition, questionNumber, answerNo) {
    currentQuestionNumber = questionNumber;

    // Only (re)open the modal and set the focus title if the
    // previous answer was not 'No'
    if (answerNo == null) {
        modal = openYesNoModal(ambition);
    }

    const action = ambitionQuestionActions[ambition][questionNumber - 1];
    // In a campaign, a note on the Empire's laws (campaignhooks.js)
    updateYesNoText((action.startsWith("reach") ? getReachQuestion(ambition, action, currentPlayer) : ambitionQuestionText[ambition][action] + getLeaderQuestionHint(currentPlayer, action))
        + (runCampaignHook("questionNote", currentPlayer, action) || ""));

    // Only show the modal if the previous 
    // answer was not 'No'
    if (answerNo == null) {
        modal.show();
    }
}

// Who a one-off question is for, when it isn't the current player (the mulligan, #122)
let yesNoPlayer = null;

function setYesNoTitle() {
    // The title names the player answering, and the title bar is in their colour
    const player = yesNoPlayer || currentPlayer;
    document.getElementById("yesNoTitle").innerHTML = "Player " + player.number;

    const header = document.querySelector("#yesNo .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
}

function updateYesNoText(text) {

    setYesNoTitle();

    const element = document.getElementById("yesNoMessage");
    // Any player it names, on their colour (#106)
    element.innerHTML = tagPlayerNames(text);
    element.classList.add("flash");

    // Remove the class after the animation ends
    setTimeout(() => {
        element.classList.remove("flash");
    }, 1000); // Match the duration of the animation

}

function openYesNoModal(focusTitle) {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("yesNo"));
    setYesNoTitle();

    // When the modal stays open and moves on to another ambition, flash
    // the ambition so it's clear the question is about something new
    const focusMessage = document.getElementById("focusMessage");
    if (focusMessage.innerHTML != focusTitle) {
        focusMessage.classList.add("flash");
        setTimeout(() => { focusMessage.classList.remove("flash"); }, 1000);
    }
    focusMessage.innerHTML = focusTitle;
    // A question with no ambition or action to name has no label (the mulligan, #122)
    focusMessage.classList.toggle("d-none", focusTitle == "");

    return modal;
}

function answerYes() {
    // A one-off question: Yes also closes the window, and askYesNo carries on from there
    if (yesNoCallback != null) { yesNoCallback(true); return; }

    playForQuestion(currentPlayer, document.getElementById("focusMessage").innerHTML, currentQuestionNumber, null);
}

function playForQuestion(player, focus, questionNumber, knownReason) {
    // Play a card for the action a question asks about: the player said Yes, or the app knew.
    // knownReason is why it didn't need to ask, for the turn plan
    const unplayedCards = getBotCards(player);
    player.playReason = { type: "chase", ambition: focus.toLowerCase() };
    player.focusReason = knownReason;

    // The action the question asks about
    let actionToPlay = ambitionQuestionActions[focus][questionNumber - 1];

    // Moving into position: say what for, and a card that can Battle too if that's the idea
    let cardsWithAction;
    if (actionToPlay.startsWith("reach")) {
        player.moveGoal = getReachGoal(focus, actionToPlay, player);
        cardsWithAction = getCardsWithAction(unplayedCards, "move");
        if (actionToPlay != "reachTax") {
            const both = getCardsWithAction(cardsWithAction, "battle");
            if (both.length > 0) { cardsWithAction = both; }
        }
        actionToPlay = "move";
    } else {
        cardsWithAction = getCardsWithAction(unplayedCards, actionToPlay);
    }
    findCardToPlay(cardsWithAction, actionToPlay);
}

function findCardToPlay(cards, actionToPlay) {
    let cardToPlay = "";
    const isLeading = isLeadingThisTurn();

    if (isLeading && actionToPlay == "") {
        // AI player is leading
        // Check which ambitions they should focus on
        // and play that card
        // If there is not a card to play, see if player can chase
        // an ambition, otherwise play the highest possible card

        const ambitionSorted = prioritiseAndSortAmbitions();

        let cardsWithAmbition = findCardsWithAmbition(ambitionSorted, withoutUselessConstruction(currentPlayer, cards));
        // Out of ships: it leads a Warlord card to declare it (#129)
        const warlordCards = currentPlayer.outOfShips ? cards.filter(card => card.ambition == "warlord") : [];

        if (warlordCards.length > 0) {
            cardToPlay = getHighestCard(warlordCards);
            currentPlayer.playReason = { type: "lead", ambition: "warlord" };
        } else if (cardsWithAmbition.length > 0) {
            cardToPlay = getHighestCard(cardsWithAmbition);
            currentPlayer.playReason = { type: "lead", ambition: cardToPlay.ambition };
         }else{
            if (chaseAmbition(currentPlayer, getPossibleActions(cards), cards ) == false){
                cardToPlay = getHighestCard(withoutUnwantedConstruction(currentPlayer, cards));
            } else {
                // The Yes/No modal is now open. answerYes/answerNo will
                // play the card, so don't play one here as well
                return;
            }
         }
    }

    //const cardToPlay = getHighestCard(cards);

    if (cardToPlay == "") { cardToPlay = getHighestCard(withoutUnwantedConstruction(currentPlayer, cards)); }

    let cardAction = "";

    if (actionToPlay == "") { actionToPlay = "ANY" }

    if (isLeading) { cardAction = "LEAD" }

    if (cardToPlay != null && isLeading) {
        playCard(currentPlayer, cardToPlay, actionToPlay, cardAction);
    } else {
        // A Construction lead is no use to a bot that can't or doesn't want to build, so rather than
        // surpass or copy it, it pivots with another suit if it can (#62)
        const usefulCards = withoutUnwantedConstruction(currentPlayer, cards);
        const skipLead = avoidsConstruction(currentPlayer) && playedCardList[0].name == "Construction"
            && getBotCards(currentPlayer).some(card => card.name != "Construction");
        const pivotCards = (skipLead && !usefulCards.some(card => card.name != "Construction"))
            ? getBotCards(currentPlayer).filter(card => card.name != "Construction") : usefulCards;

        if (skipLead || canSurpass(currentPlayer, playedCardList[0], cards, actionToPlay) == false) {
            if (claim(currentPlayer, pivotCards, actionToPlay) == false) {
                if (skipLead || canCopy(currentPlayer, playedCardList[0], cards, actionToPlay) == false) {
                    pivot(currentPlayer, pivotCards, actionToPlay);
                }
            }
        }
    }

    if (haveAllPlayersPlayedACard()) {
        enableNextTurnButton();
    }

    SaveAllSettings();
}

function findCardsWithAmbition(ambitionSorted, cards) {
    let cardsWithAmbition = [];

    for (let num = 0; num < ambitionSorted.length; num++) {
        const am = ambitionSorted[num];
        // Here the bot was still finding cards even when they
        // had no resources matching the ambition ( > 0 )
        if (am[1] > 0){
            cardsWithAmbition = getCardsWithAmbition(cards, am[0]);
            if (cardsWithAmbition.length > 0) { break; }
        }
    }
    return cardsWithAmbition;
}

function prioritiseAndSortAmbitions() {
    // In a campaign, an ambition its Fate wants declared comes first while it holds any of it (campaignhooks.js)
    const steered = runCampaignHook("sortAmbitions", currentPlayer, getAmbitionStanding());
    return steered != null ? steered : getAmbitionStanding();
}

function getAmbitionStanding() {
    let amibitions = [];
    amibitions.push(["empath", currentPlayer.psionicsValue]);
    amibitions.push(["keeper", currentPlayer.relicsValue]);
    amibitions.push(["warlord", currentPlayer.trophiesValue]);
    amibitions.push(["tyrant", currentPlayer.captivesValue]);
    amibitions.push(["tycoon", currentPlayer.fuelValue + currentPlayer.materialsValue]);

    const ambitionSorted = amibitions.slice().sort((a, b) => {
        const numA = typeof a === 'object' && a !== null ? a[1] : a[1];
        const numB = typeof b === 'object' && b !== null ? b[1] : b[1];
        return numB - numA;
    });
    return ambitionSorted;
}

function answerNo() {
    if (yesNoCallback != null) {
        yesNoCallback(false);
        modal.hide();
        return;
    }

    const focus = document.getElementById("focusMessage").innerHTML;
    const unplayedCards = getBotCards(currentPlayer);

    // The turn plan shouldn't then suggest what the player just said it can't do
    if (ambitionQuestionActions[focus][currentQuestionNumber - 1] == "tax") {
        currentPlayer.noTax = (currentPlayer.noTax || []).concat(focus);
    }

    // Move on to the next question for this ambition that the player has a card for.
    // Questions whose action isn't in their hand are skipped
    const nextQuestionNumber = getNextQuestionNumber(focus, currentQuestionNumber, getPossibleActions(unplayedCards), currentPlayer);
    if (nextQuestionNumber > 0) {
        // The app may know the answer to the next one
        const known = getKnownYesReason(focus, ambitionQuestionActions[focus][nextQuestionNumber - 1], currentPlayer);
        if (known != null) {
            modal.hide();
            playForQuestion(currentPlayer, focus, nextQuestionNumber, known);
        } else {
            focus_ambition(focus, nextQuestionNumber, true);
        }
        return;
    }

    // No questions left for this ambition, so try the next ambition
    currentPlayer.ambitionsEvaluated.push(focus);

    // Leave the modal open while the player decides what to do next. If they ask about
    // another ambition, only the modal's text changes. If they play a card instead,
    // there are no more questions, so close it
    const player = currentPlayer;
    findFocus(player, unplayedCards);

    if (player.hasPlayedACardThisTurn) {
        modal.hide();
    }
}

function declareAmbition(player, playedCard) {
    if (declaredAmbitions.length >= 3) {
        return;
    }

    let ambition = playedCard.ambition;

    if (ambition == "any") {
        const ambitionSorted = prioritiseAndSortAmbitions();
        ambition = ambitionSorted[0][0];
    }

    // In a campaign, its Fate may declare a new ambition instead ({ ambition, resources, wins }), or
    // place a Conspiracy (true, done) (campaignhooks.js)
    const instead = runCampaignHook("declareInstead", player, ambition, playedCard);
    if (instead === true) { return; }
    if (instead != null) { ambition = instead.ambition; }

    // Feastbringer can't declare without a Guild card to give
    if (!canDeclareAmbition(player)) { return; }
    // In a campaign, one its Fate can't declare, such as Warlord under an Oath of Peace (campaignhooks.js)
    if (runCampaignHook("cannotDeclare", player, ambition) === true) { return; }

    // Out of ships: it declares Warlord to get them back from Rivals' Trophies (#129)
    const forShips = ambition == "warlord" && player.outOfShips === true;

    // A bot with none of the ambition's resources doesn't declare it. This
    // includes the 1 cards, which have no ambition
    const resources = instead != null ? instead.resources : ((ambitionResources[ambition] == null) ? 0 : ambitionResources[ambition](player));
    if (resources == 0 && !forShips) { return; }

    // See declareChanceByRound at the top of the file
    const chance = Math.min(declareChanceByRound[roundNumber] + resources * declareChancePerResource, declareChanceMax);

    // By the difficulty (#71): on a whim, or when it would come first, or both
    const wins = instead != null ? instead.wins : wouldWinAmbition(player, ambition);
    if (forShips || decideAtDifficulty(player, wins, () => Math.random() * 100 < getWhimChance(chance))) {
        showMessageToast("Player " + player.number, getAmbitionDeclaredMessage(ambition));
        playedCard.declared = placesZeroMarker(player, ambition);

        // Shown as a Declare, not a Lead (#150)
        addPlayedCardToList(playedCard, playedCard.playedAction, "DECLARE", true, player);

        declaredAmbitions.push(ambition);
        updateAmbitionsDisplay();
        onAmbitionDeclared(player);
    }
}

function canSurpass(player, playedCard, unplayedCards, actionToPlay) {
    let surpass = false;

    let surpassCards = [];

    unplayedCards.forEach(card => {
        if (playedCard.name == card.name && getCardValue(playedCard) < card.number) {
            surpassCards.push(card);
        }
    })

    if (surpassCards.length == 0) {
        return surpass;
    }

    let cardToPlay = getLowestCardtoPlay(surpassCards);

    playCard(player, cardToPlay, actionToPlay, "SURPASS", true);
    surpass = true;
    checkInitiative(player, cardToPlay, false);

    return surpass;
}

function canCopy(player, playedCard, unplayedCards, actionToPlay) {
    let copyCards = [];
    let canCopy = false;

    // A card of the lead suit that can't surpass can only be played as a COPY
    unplayedCards.forEach(card => {
        if (playedCard.name == card.name) {
            copyCards.push(card);
        }
    })

    // Any card can be played face down to COPY. If the player is after an action
    // the lead card offers, copy with their lowest card and keep the rest for later
    if (copyCards.length == 0 && actionToPlay != "ANY" && playedCard.actions.includes(actionToPlay)) {
        copyCards = getBotCards(player);
    }

    if (copyCards.length == 0) {
        // no card to COPY with
        return canCopy;
    }

    let cardToPlay = getLowestCardtoPlay(copyCards);

    playCard(player, cardToPlay, actionToPlay, "COPY", true);
    canCopy = true;

    return canCopy;
}

function claim(player, cards, actionToPlay) {
    // Logic;
    //  claim needs to be based on a calc between: number of cards in hand, number of ambitions played, .... other things
    //  at the start of the game the calc needs to rarely succeed

    //let hasInitiativeBeenClaimedThisTurn = false;

    if (hasInitiativeBeenClaimedThisTurn == true) { return false; }

    // In a campaign, the Partisan seizes by Provoking Outrage instead (campaignhooks.js)
    const special = runCampaignHook("botClaim", player, cards, actionToPlay);
    if (special !== undefined) { return special; }

    // The player with the initiative can't seize it (rulebook p.10)
    if (player.hasInitiative) { return false; }

    // No point in claiming if cannot declare an ambition
    if (declaredAmbitions.length >= 3) { return false; }

    let unplayedCards = getBotCards(player);

    // No point in claiming if player has two or less cards
    if (unplayedCards.length <= 2) { return false; }

    // Need a card for this turn's action as well as one to claim with
    if (cards.length == 0) { return false; }

    // Get the total values of the unplayed cards. The lower the total number, the lower the 
    // card numbers the player has and therefore the less chance of surpassing
    let totalValueOfCards = 0;
    unplayedCards.forEach(card => {
        totalValueOfCards += card.number;
    })

    // On a whim, rarer on the easier difficulties, or (from Tough) when leading next round lets it declare an ambition from its hand that it would win (#71)
    const toDeclare = declaredAmbitions.length < 3 && ['tycoon', 'tyrant', 'warlord', 'keeper', 'empath'].some(ambition => holdsAmbitionCard(player, ambition) && wouldWinAmbition(player, ambition));
    if (decideAtDifficulty(player, toDeclare, () => Math.floor(Math.random() * 16 * getDifficulty().chance) >= totalValueOfCards)) {
        // First play the card for this turn's action, chosen from the cards that have
        // the action the player is after. It couldn't surpass, so a card of the lead
        // suit can only COPY and any other card PIVOTs
        const actionCard = getLowestCardtoPlay(cards);
        const actionCardAction = (actionCard.name == playedCardList[0].name) ? "COPY" : "PIVOT";
        playCard(player, actionCard, actionToPlay, actionCardAction);

        // Then play a second card face down to claim the initiative
        playCard(player, getLowestCardtoPlay(getBotCards(player)), "ANY", "CLAIM");

        hasInitiativeBeenClaimedThisTurn = true;
        changeInitiative(player);
        return true;
    }

    return false;
}

function pivot(player, cards, actionToPlay) {
    // Logic;
    //  - Needs to know what current goal is
    //      - has ambition been set?
    //          - yes: chase
    //      - no: which card to play?
    //          - need to know how many ships are in play
    //          - how many buildings are in play
    if (cards.length > 0) { playCard(player, cards[0], actionToPlay, "PIVOT", true) }
}
