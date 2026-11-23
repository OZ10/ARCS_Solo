// Game flow: new game, turns, rounds, playing cards, initiative and starting up when the page loads. Loaded last.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

document.addEventListener("DOMContentLoaded", () => {
    keepClearOfFooter();

    if (localStorage.length > 0) {
        for (let [key, value] of Object.entries(localStorage)) {
            switch (key) {
                case "turn":
                    turnNumber = parseInt(value);
                    setElementValue("turnNumber", value);
                    break;
                case "round":
                    roundNumber = parseInt(value);
                    updateRoundNumber();
                    break;

                case "initiaiteClaimed":
                    // localStorage holds text, so convert "true"/"false" back to a boolean
                    hasInitiativeBeenClaimedThisTurn = (value === "true");
                    break;

                case "awaitingDone":
                    awaitingDone = (value == "") ? null : parseInt(value);
                    break;

                default:
                    break;
            }
        }

        // Played cards must be loaded before players, as setCurrentPlayer
        // relies on playedCardList to know if the turn has been led
        loadPlayedCardList();
        // Loaded after the played cards, as loading those adds them to the
        // discard pile again. The saved pile already includes them
        loadDiscardPile();
        // Ambitions must be loaded before players. Loading the players saves the whole
        // game, which would otherwise overwrite the saved ambitions with an empty list
        // The campaign's own state (campaignhooks.js), before the players as their panels show it.
        // Nothing outside a campaign
        campaignMode = getSettingObject("campaignMode") === true;
        runCampaignHook("load");
        loadAmbitions();
        loadPlayers();
    }
    notifyCampaignModeChanged();

    showChosenColour();
    updateAmbitionsDisplay();
    updateUndoButton();
    setupSavedGameButtons();
    refreshTooltips();

    // Information pop-ups, such as the Battle window's (i). Tapping anywhere else closes them
    document.querySelectorAll('[data-bs-toggle="popover"]').forEach(element => bootstrap.Popover.getOrCreateInstance(element));

    // So it can be installed as an app, and works offline (see service-worker.js)
    if ("serviceWorker" in navigator) { navigator.serviceWorker.register("service-worker.js").catch(() => null); }
});



function chooseNewGame(numberOfPlayers) {
    // A number tapped under New Game. While a game is being played, ask first: Undo can't bring
    // it back (#133). The question waits for the Options window to close
    if (!isGameInProgress()) { setupGame(numberOfPlayers); return; }
    document.getElementById("numberOfPlayersModal").addEventListener('hidden.bs.modal', () => {
        askYesNo("", "Start a new " + numberOfPlayers + "-player game?<br><br>The game you're playing (round " + roundNumber + ", turn " + turnNumber + ") will end, and Undo can't bring it back."
            + " To keep it, tap <b>No</b> and save it first from the Options window.", yes => { if (yes) { setupGame(numberOfPlayers, true); } }, players[0]);
        // It's about the app, not a player
        document.getElementById("yesNoTitle").innerHTML = "New Game";
        document.querySelector("#yesNo .modal-header").classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    }, { once: true });
}

function isGameInProgress() {
    // A game has been set up and hasn't finished: the last round's cards all played and scored
    return players.length > 0 && !(isGameOver() && haveAllCardsBeenPlayed() && declaredAmbitions.length == 0);
}

function setupGame(numberOfPlayers, optionsClosed = false) {

    localStorage.clear();

    players = [];
    awaitingDone = null;
    turnNumber = 1;
    roundNumber = 1;
    declaredAmbitions = [];
    neutralCounts = {};
    courtMarket = [];
    board = newBoard();
    // A Blighted Reach campaign (campaignhooks.js) has no Leaders
    campaignMode = isCampaignChosen();
    leadersAndLore = !campaignMode && document.getElementById("leadersAndLoreSwitch").checked;
    leaderDraft = null;
    notifyCampaignModeChanged();

    removeChildElements("playerslots");
    removeChildElements("playedcards");

    createPlayers(numberOfPlayers);

    resetRound();

    dealCards();

    // The campaign's own setup (campaignhooks.js). Nothing outside a campaign
    runCampaignHook("afterSetup");

    SaveAllSettings();
    saveSettingObject("leadersAndLore", leadersAndLore);
    // The difficulty carries on into the new game (#71)
    saveSettingObject("botDifficulty", botDifficulty);

    // localStorage was cleared above, so there's nothing to undo
    updateUndoButton();

    // The Options window is still closing, and one window can't open until another has closed.
    // After the New Game question it already has. A campaign has its own setup windows first
    const start = () => { if (runCampaignHook("startSetup", askOpeningCourt) !== true) { askOpeningCourt(); } };
    if (optionsClosed) { start(); return; }
    document.getElementById("numberOfPlayersModal").addEventListener('hidden.bs.modal', start, { once: true });
}

// New Game: tapping a number of players chooses it, and Start game starts the game

let chosenPlayerCount = null;

function choosePlayerCount(numberOfPlayers) {
    chosenPlayerCount = numberOfPlayers;
    showChosenPlayerCount();
}

function showChosenPlayerCount() {
    // A count hidden by the number of human players can't stay chosen
    const button = [...document.querySelectorAll(".playercount button")].find(other => parseInt(other.textContent) == chosenPlayerCount);
    if (button == null || button.classList.contains("d-none")) { chosenPlayerCount = null; }
    document.querySelectorAll(".playercount button").forEach(other => other.classList.toggle("chosen", parseInt(other.textContent) == chosenPlayerCount));
    enableDisableButton("startGameButton", chosenPlayerCount == null);
}

function startChosenGame() {
    if (chosenPlayerCount != null) { chooseNewGame(chosenPlayerCount); }
}

function showChosenColour() {
    // The next new game starts on the colour the human player has now
    if (players.length == 0) { return; }
    document.getElementById("humanColour" + getPlayerColour(players[0])).checked = true;
    document.getElementById("leadersAndLoreSwitch").checked = leadersAndLore;
    showLeadersRowsChoice();
    // How many human players, and their colours (#67)
    showHumanChoices();
}

function addExtraCards(numberOfPlayers) {
    if (numberOfPlayers == 4) {
        currentactioncards.push(new Card("Construction", 1, 4, false, "", "build,repair"));
        currentactioncards.push(new Card("Construction", 7, 1, false, "any", "build,repair"));
        currentactioncards.push(new Card("Aggression", 1, 3, false, "", "move,secure,battle"));
        currentactioncards.push(new Card("Aggression", 7, 1, false, "any", "move,secure,battle"));
        currentactioncards.push(new Card("Administration", 1, 4, false, "", "influence,tax,repair"));
        currentactioncards.push(new Card("Administration", 7, 1, false, "any", "influence,tax,repair"));
        currentactioncards.push(new Card("Mobilisation", 1, 4, false, "", "move,influence"));
        currentactioncards.push(new Card("Mobilisation", 7, 1, false, "any", "move,influence"));
    }
}

function createPlayers(numberOfPlayers) {
    // The human players take the first seats and the colours they chose; each bot takes its own
    // seat's colour, or one left over if a human player has it (#67)
    const humans = Math.min(getChosenHumanCount(), numberOfPlayers);
    const colours = getPlayerColours(numberOfPlayers, getChosenHumanColours().slice(0, humans));
    // A random player starts with the initiative (rulebook p.4)
    const starter = chooseStartingPlayer(numberOfPlayers);

    for (let playerNumber = 1; playerNumber < numberOfPlayers + 1; playerNumber++) {
        let p = new player(playerNumber, playerNumber <= humans);
        p.shipsBoardValue = startingShips[numberOfPlayers];
        // One starport each to start, in their B system (#130)
        p.starportsValue = 1;
        p.colour = colours[playerNumber - 1];

        players.push(p);

        clonePlayerNodeAndSetup(p);
    }

    // Whoever starts has the initiative and plays first
    changeInitiative(getPlayer(starter));
    currentPlayer = getPlayer(starter);
    handShownFor = null;
}

function resetHandsAndPlayedCardsDisplay() {
    players.forEach(p => {
        removeChildElements("playerhand" + p.number);
    });

    removeChildElements("playedcards");
}

function nextTurn() {

    enableDisableButton("nextTurn", true);

    // Union cards placed in a prelude: the turn has ended, so their holders draw the cards
    drawUnionCards();

    if (haveAllCardsBeenPlayed()) {
        enableDisableButton("nextRound", false);
        return;
    }

    hasInitiativeBeenClaimedThisTurn = false;

    turnNumber += 1;
    setElementValue("turnNumber", turnNumber.toString());

    resetPlayedThisTurn();

    resetPlayedCardList();

    resetPlayersAmibtions();

    // A new turn: every hand is covered again, even if the same human player leads (#67)
    handShownFor = null;

    //currentPlayer = getPlayerWithInitiative();
    setCurrentPlayer(getPlayerWithInitiative());

    //checkIfPlayerHasCardsToPlay();

    if (haveAllCardsBeenPlayed()) {
        enableDisableButton("nextRound", false);
        return;
    }

    enableDisablePlayerPanels(currentPlayer.number);

    SaveAllSettings();
    announceTurn(false);
}

function haveAllCardsBeenPlayed() {
    let allPlayed;

    players.forEach(player => {
        player.cards.forEach(card => {
            if (card.played == false) { allPlayed = false; return; }
        });
    });

    return (allPlayed == false) ? false : true;
}

function nextRound() {
    // The campaign's end-of-round steps come first, then it carries on here (campaignhooks.js)
    if (runCampaignHook("beforeScoring", scoreRound) === true) { return; }
    scoreRound();
}

function scoreRound() {
    // Score the ambitions declared this round before moving on.
    // The next round starts once the scores have been confirmed
    if (declaredAmbitions.length > 0) {
        showScoringModal();
    } else {
        startNextRound();
    }
}

function startNextRound(afterCampaign = false, boardChecked = false) {
    // A campaign checks its objectives first, then carries on here (campaignhooks.js)
    if (!afterCampaign && runCampaignHook("afterScoring", () => startNextRound(true)) === true) { return; }

    // The round has been scored, so undoing a card from it is no longer possible
    clearUndoPoint();

    if (isGameOver()) {
        enableDisableButton("nextRound", true);
        showGameOverModal();
        return;
    }

    // Before the next round: check the board against the map (boardui.js, #160)
    if (!boardChecked) { whenWindowsClosed(() => showBoardCheck(() => startNextRound(true, true))); return; }

    turnNumber = 1;
    roundNumber += 1;

    resetRound();

    resetPlayersCards();

    dealCards();

    SaveAllSettings();
    startRoundAfterMulligan();
}


function resetRound() {
    hasInitiativeBeenClaimedThisTurn = false;
    awaitingDone = null;

    resetPlayedCardList();

    declaredAmbitions = [];

    // New hands are dealt, so Union cards placed on the last turn have nothing to draw
    discardPile = [];
    players.forEach(player => { player.unionDraws = []; });

    setElementValue("turnNumber", turnNumber.toString());
    //setElementValue("roundNumber", roundNumber.toString());

    updateRoundNumber();

    updateAmbitionsDisplay();

    enableDisableButton("nextRound", true);

    currentactioncards = structuredClone(actioncards);

    addExtraCards(players.length);

    // The campaign adds its Event cards (campaignhooks.js). Nothing outside a campaign
    runCampaignHook("buildActionDeck", currentactioncards);

    resetDeck(currentactioncards);

    resetPlayedThisTurn();

    resetHandsAndPlayedCardsDisplay();

    // A new round: every hand is covered again, even if the same human player leads (#67)
    handShownFor = null;
    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayerPanels(currentPlayer.number);
}

function updateRoundNumber() {
    for (let roundNum = 1; roundNum < 6; roundNum++) {
        let element = document.getElementById("roundNumber" + roundNum);
        element.classList.toggle("roundcurrent", roundNum == roundNumber);
        element.classList.toggle("roundpast", roundNum < roundNumber);
    }
    // A campaign shows its Act and chapters (campaignhooks.js)
    runCampaignHook("roundShown");

    // Marker values change by round
    updateAmbitionsDisplay();
}

function resetPlayedCardList() {
    playedCardList = [];
    removeChildElements("playedcards");
    RemoveSettingByKey("playedCardList");
}

function resetDeck(cards) {
    cards.forEach(card => {
        card.played = false;
    })
}

function dealCards() {

    let playerNumber = 0;
    do {
        let num = Math.floor(Math.random() * currentactioncards.length);

        if (playerNumber > players.length - 1) {
            playerNumber = 0;
        }

        players[playerNumber].cards.push(currentactioncards[num]);;
        currentactioncards.splice(num, 1);

        playerNumber += 1;

    }
    while (players[players.length - 1].cards.length < 6)

    // The cards not dealt start the action discard pile, shuffled and face down (rulebook p.5).
    // Played cards go on top, so the bottom of the pile is unknown
    discardPile = shuffleCards(currentactioncards.slice());

    createCardButtonsForHumanPlayer();

    // The mulligan is offered once the windows before it have closed (see offerMulligan)
}

function shuffleCards(cards) {
    for (let index = cards.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [cards[index], cards[other]] = [cards[other], cards[index]];
    }
    return cards;
}

function takeMulligan(player) {
    // A new hand of 6, and the old hand goes into the discard pile with the rest. In a campaign,
    // Event cards are kept (campaignhooks.js)
    if (runCampaignHook("mulligan", player) === true) { createCardButtonsForHumanPlayer(); SaveAllSettings(); return; }
    const oldHand = player.cards;
    player.cards = discardPile.splice(0, 6);
    discardPile = shuffleCards(discardPile.concat(oldHand));
    createCardButtonsForHumanPlayer();
    SaveAllSettings();
}

function offerMulligan(then) {
    // 2 players: the player without the initiative may swap their hand (rulebook p.19). Offered
    // once the hands are dealt and the windows before it have closed (the Court and setup, or
    // scoring), then then() carries on: the round's announcement (#122)
    if (players.length != 2) { then(); return; }

    const player = players.find(other => !other.hasInitiative);
    if (player.isHuman) {
        // Your hand in the question, so you can decide (#122)
        const hand = "<div class=\"mullhand\">" + getUnplayedCards(player.cards).map(card => "<div class=\"mullcard\"><b>" + card.number + "</b><span class=\"mullname\">" + card.name + "</span>"
            + "<small>" + (card.ambition == "null" ? "&nbsp;" : card.ambition) + "</small></div>").join("") + "</div>";
        askYesNo("", "The other player has the initiative. Below is your hand of cards. Do you want to discard them and draw 6 new cards? You must keep the new hand." + getCoveredHandHtml(player, hand), yes => { if (yes) { takeMulligan(player); } }, player);
        // Carry on once it has closed, answered or not (after askYesNo's own handler)
        document.getElementById("yesNo").addEventListener('hidden.bs.modal', () => then(), { once: true });
        return;
    }
    if (player.cards.reduce((total, card) => total + card.number, 0) / player.cards.length < mulliganBelow) {
        takeMulligan(player);
        showMessageToast("Player " + player.number, "Discarded its hand and drew 6 new cards");
    }
    then();
}

function whenWindowsClosed(then) {
    // Once no window is open or closing. One can't open until another has fully closed
    if (!isAnyWindowOpen()) { then(); return; }
    document.addEventListener('hidden.bs.modal', () => whenWindowsClosed(then), { once: true });
}

function startRoundAfterMulligan() {
    // The new hands are dealt: the mulligan, then the round's announcement
    whenWindowsClosed(() => offerMulligan(() => announceTurn(true)));
}

function playCard(player, playedCard, actionToPlay, cardAction) {
    // Can SURPASS = play card
    // Can't SURPASS
    //  - 1 - COPY
    //  - 2 - claim
    //  - 3 - PIVOT

    const isLeading = isLeadingThisTurn();

    addPlayedCardToList(playedCard, actionToPlay, cardAction, false, player);
    player.hasPlayedACardThisTurn = true;
    // Its panel sections open once it has played, with the "Turn" setting (#152)
    refreshPanelSections(player);

    if (isLeading) {
        if (player.isHuman && cardAction == "DECLARE" && !canDeclareAmbition(player)) {
            // Feastbringer can't declare without a Guild card to give, so it's a lead
            showMessageToast("Feastbringer, Generous", "You need a Guild card to give before you can declare, so this card leads without declaring.");
        } else if (player.isHuman && cardAction == "DECLARE") {

            if (playedCard.ambition == "any") {
                // Show modal
                showDeclareAmbitionModal(null, true, player, playedCard);
            } else {
                showMessageToast("Player " + player.number, getAmbitionDeclaredMessage(playedCard.ambition));
                playedCard.declared = placesZeroMarker(player, playedCard.ambition);

                // Reset the played card list and re-add the declared card
                // with a value of 0
                addPlayedCardToList(playedCard, "ANY", "DECLARE", true, player);

                declaredAmbitions.push(playedCard.ambition);
                updateAmbitionsDisplay();
                onAmbitionDeclared(player);
            }

        } else if (player.isHuman == false) {
            // AI player will determine whether to declare or not
            declareAmbition(player, playedCard);
        }
    }

    // Stay with this player while their actions are carried out. Done moves on
    finishPlay(player);

    SaveAllSettings();
}

// After a player plays their card, their panel stays open so their actions can be carried
// out (moving ships, a battle, adjusting resources) before the game moves on. The panel
// shows what they played, and Done moves on to the next player

function finishPlay(player) {
    awaitingDone = player.number;

    if (player.isHuman) {
        // No more cards for the human this turn
        enableDisableButtonsByPlayerNumber(player.number, false);
        showHideElement(document.querySelectorAll("#actionbuttons"), false);
    }

    showTurnDone(player);
    SaveAllSettings();

    // A bot may spend resources before its actions. The human player's turn window opens now (#112)
    if (!player.isHuman) { startPrelude(player); } else { openTurnWindow(); }
}

function showTurnDone(player) {
    // A bot's turn has its own window, with the bar when that's closed
    if (usesTurnWindow(player)) {
        showHideElement([document.getElementById("playcard" + player.number).parentNode], false);
        updateActionButtons(player);
        renderTurn(player);
        return;
    }

    // In the order they happen: the prelude, then the card's actions and any Guild actions
    const prelude = describePrelude(player), plan = describeTurnPlan(player), guildActions = describeGuildActions(player);
    document.getElementById("turnsummary" + player.number).innerHTML = (prelude == null ? [] : [prelude])
        .concat(describePlayerPlays(player), describeBuildChange(player) || [], plan == null ? [] : [plan], guildActions == null ? [] : [guildActions], getMarketReminder(player) || []).join("<br>");

    const next = getNextPlayerToPlay(player);
    document.getElementById("donebutton" + player.number).innerHTML = (next == null) ? "Done: end of turn" : "Done &rarr; Player " + next.number;

    // A bot has played, so its Play Card button is replaced by Done
    if (!player.isHuman) { showHideElement([document.getElementById("playcard" + player.number).parentNode], false); }

    const done = document.getElementById("turndone" + player.number);
    showHideElement([done], true);

    // A player who can now battle or build has the Battle or Build icon
    updateActionButtons(player);
    document.getElementById("donebutton" + player.number).scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function hideTurnDone(player) {
    clearTurnDock();
    showHideElement([document.getElementById("turndone" + player.number)], false);
    showHideElement([document.getElementById("battlebutton" + player.number), document.getElementById("buildbutton" + player.number), document.getElementById("courtbutton" + player.number)], false);
    if (!player.isHuman) { showHideElement([document.getElementById("playcard" + player.number).parentNode], true); }
}

function doneClick() {
    if (awaitingDone == null) { return; }

    const player = getPlayer(awaitingDone);
    awaitingDone = null;
    hideTurnDone(player);

    // On to the next player, or Next Turn if everyone has played
    setCurrentPlayer(getNextPlayer(player.number));
    SaveAllSettings();
}

function getNextPlayerToPlay(player) {
    // Who Done moves on to: the next player who hasn't played this turn and has cards.
    // null means everyone has played
    let next = getNextPlayer(player.number);
    for (let i = 0; i < players.length; i++) {
        if (!next.hasPlayedACardThisTurn && getUnplayedCards(next.cards).length > 0) { return next; }
        next = getNextPlayer(next.number);
    }
    return null;
}

function describePlayerPlays(player) {
    // What the player played this turn and the actions it gives them, e.g.
    // "Surpassed with Aggression5: 3 actions (move, secure or battle)"
    const lead = playedCardList[0];

    return playedCardList.filter(card => card.playedByPlayerNumber == player.number).map(card => {
        // A campaign's Event card (campaignhooks.js)
        const special = runCampaignHook("describePlay", card, lead);
        if (special != null) { return special; }
        const focus = (card.playedAction != null && card.playedAction.toUpperCase() != "ANY") ? ", for " + card.playedAction : "";
        const declared = card.declared ? " and declared an ambition" : "";

        switch (card.cardAction) {
            case "CLAIM":
                return "Seized the initiative with a card face down";
            case "COPY":
                // A copy uses the lead card's actions
                return "Copied the lead: " + describeActions(1, lead.actions) + focus;
            case "PIVOT":
                return "Pivoted with " + getCardFullName(card) + ": " + describeActions(1, card.actions) + focus;
            case "SURPASS":
                return "Surpassed with " + getCardFullName(card) + ": " + describeActions(card.pips, card.actions) + focus;
            default:
                // LEAD or DECLARE
                return "Led with " + getCardFullName(card) + declared + ": " + describeActions(card.pips, card.actions) + focus;
        }
    });
}

function describeBuildChange(player) {
    // The player said it could build, but its card can't: say why it changed its mind (#92)
    const play = getBotPlay(player);
    if (player.isHuman || player.canBuild !== true || play == null || play.actions.split(",").includes("build")) { return null; }

    const reason = player.playReason;
    const ambition = (reason != null && Object.keys(ambitionResources).includes(reason.ambition)) ? capitalise(reason.ambition) : null;
    if (ambition != null && reason.type == "chase") { return "You said it could build, but it's chasing " + ambition + " instead."; }
    if (ambition != null) { return "You said it could build, but it's leading with its best card for " + ambition + " instead."; }
    return "You said it could build, but another card suited this turn better.";
}

function describeActions(count, actions) {
    // e.g. "3 actions (move, secure or battle)"
    const list = actions.split(",");
    const text = (list.length > 1) ? list.slice(0, -1).join(", ") + " or " + list[list.length - 1] : list[0];
    return count + " action" + (count == 1 ? "" : "s") + " (" + text + ")";
}

function setCurrentPlayer(player) {

    if (haveAllPlayersPlayedACard()) {
        enableNextTurnButton();
        return;
    }

    // In a campaign, a player due to lead with only Event cards passes the initiative (campaignhooks.js)
    const cannotLead = isLeadingThisTurn() && runCampaignHook("cannotLead", player) === true;
    if (hasPlayerGotCardsToPlay(player) && !cannotLead) {
        currentPlayer = player;
        enableDisablePlayerPanels(player.number);

    } else {
        const nextPlayer = getNextPlayer(player.number);
        // Only pass initiative on if the player with no cards was due to lead.
        // A follower with no cards is simply skipped
        if (isLeadingThisTurn()) { changeInitiative(nextPlayer); }
        setCurrentPlayer(nextPlayer);
    }
}

function isLeadingThisTurn() {
    // The first card played in a turn is the lead. Initiative can change hands
    // mid-turn (surpass, claim, seize) so it can't be used to decide who is leading
    return playedCardList.length == 0;
}

function enableNextTurnButton() {
    // Not while a player is still carrying out their actions. Their Done does this
    if (awaitingDone != null) { return; }

    if (haveAllCardsBeenPlayed()) {
        enableDisableButton("nextRound", false);
    } else if (haveAllPlayersPlayedACard()) {
        enableDisableButton("nextTurn", false);
    }
    hidePlayerPanels();
}

function checkInitiative(claimingPlayer, playedCard, hasClaimed) {
    if (hasInitiativeBeenClaimedThisTurn == true) { return; }

    players.forEach(player => {
        if (player.number != claimingPlayer.number) { return; }

        if (hasClaimed) {
            player.hasInitiative = true;
        } else {
            // The played card must beat every other face up card of the same suit
            // played this turn. Face down cards (COPY and CLAIM) don't count
            const playedHighestCard = playedCardList.every(card =>
                card === playedCard ||
                card.name != playedCard.name ||
                card.cardAction == "COPY" || card.cardAction == "CLAIM" ||
                getCardValue(playedCard) > getCardValue(card));

            if (playedHighestCard) {
                // Surpassing with a 7 seizes the initiative (rulebook p.10), so nobody
                // else can seize it this turn
                if (getCardValue(playedCard) == 7) {
                    hasInitiativeBeenClaimedThisTurn = true;
                    showMessageToast("Player " + player.number, "Seized the initiative by surpassing with a 7");
                }
                changeInitiative(player);
            }
        }

    })
}

function changeInitiative(player) {
    // The star pops in on its new holder
    const moved = !player.hasInitiative;
    players.forEach(p => {
        p.hasInitiative = (p.number == player.number) ? true : false;

        const element = document.querySelectorAll("#playerinitiative" + p.number);
        showHideElement(element, (p.number == player.number) ? true : false);
    })
    if (moved) {
        replayAnimation(document.getElementById("playerinitiative" + player.number), "starpop");
        // A campaign objective can advance for getting the initiative (campaignhooks.js)
        runCampaignHook("initiativeGained", player);
    }

    SaveAllSettings();
}

function drawCardIntoHand(player, card) {
    // Add a played card to a player's hand (the Draw button, or a Union card)
    const cardFullName = getCardFullName(card);

    // The ... below is a Spread copy meaning that the drawCard is
    // shallow copy of the original card, not a reference to it
    const drawCard = { ...card };
    // Clear details of how the card was last played
    drawCard.played = false;
    drawCard.declared = false;
    drawCard.cardAction = '';
    drawCard.playedAction = '';
    drawCard.playedByPlayerNumber = 0;

    // The card now only exists in this player's hand, so remove it from the
    // discard pile, this turn's played cards and the hand of whoever played it
    // In the pile it may never have been played: the bottom is the cards nobody was dealt
    const pileIndex = discardPile.findIndex(pileCard => getCardFullName(pileCard) == cardFullName);
    if (pileIndex >= 0) { discardPile.splice(pileIndex, 1); }
    removePlayedCard(playedCardList, cardFullName);
    players.forEach(p => removePlayedCard(p.cards, cardFullName));

    const playedDiv = document.getElementById("playedlist" + cardFullName);
    if (playedDiv != null) {
        const tooltip = bootstrap.Tooltip.getInstance(playedDiv);
        if (tooltip != null) { tooltip.dispose(); }
        playedDiv.remove();
    }

    player.cards.push(drawCard);
    createCardButtonsForHumanPlayer();

    saveSettingObject('playedCardList', playedCardList);
    SaveAllSettings();
}

function addPlayedCardToList(card, actionToPlay, cardAction, reset, player) {
    if (card != null) {
        card.played = true;

        // A reset re-adds a card that's already been played (declaring),
        // so it's already in the discard pile
        if (!reset) { discardPile.push(card); }

        // Always record how the card was played this time, so a card drawn back
        // and played again doesn't keep details from its previous play.
        // player is only omitted when reloading saved cards, which keep their saved player
        card.cardAction = cardAction;
        card.playedAction = actionToPlay;
        if (player != null) { card.playedByPlayerNumber = player.number };

        if (playedCardList.length == 0) {
            let turnListDiv = document.getElementById("playedcards");

            let turnDiv = document.createElement("div");
            // The turn's cards sit side by side and wrap, to keep the footer short on a phone
            turnDiv.classList.add("w-100", "fw-bold", "d-flex", "flex-wrap", "justify-content-center", "align-items-center", "gap-1");
            turnDiv.id = "Turn" + turnNumber.toString();
            turnDiv.innerHTML = "Turn " + turnNumber.toString();

            turnListDiv.append(turnDiv);
        }

        let cardListDiv = document.getElementById("Turn" + turnNumber.toString());

        if (reset) {
            playedCardList = [];
            disposeTooltips(cardListDiv);
            cardListDiv.replaceChildren();
            cardListDiv.innerHTML = "Turn " + turnNumber.toString();
        }

        playedCardList.push(card);

        // A button rather than text, so tapping it on Android shows the card's actions
        // instead of Chrome's "Touch to Search" overlay. The tooltip shows when tapped and
        // hides when anything else is tapped (focus trigger)
        let cardDiv = document.createElement("button");
        cardDiv.type = "button";
        // Played cards are loaded before the players, so the saved player may be needed
        const cardOwner = getPlayer(card.playedByPlayerNumber) || getSettingObject(card.playedByPlayerNumber);
        cardDiv.classList.add("fw-normal", "playedcard", "playercard" + (cardOwner != null ? getPlayerColour(cardOwner) : card.playedByPlayerNumber));
        cardDiv.id = "playedlist" + getCardFullName(card);
        cardDiv.setAttribute('data-bs-trigger', 'focus');
        // Only show the action when it's a specific one, to save space
        const actionText = (actionToPlay.toUpperCase() == "ANY") ? "" : actionToPlay.toUpperCase() + ": ";
        // If player COPIED, replace the suit played with XXXX
        cardDiv.innerHTML = cardAction.toUpperCase() + ": " + actionText + ((cardAction == "COPY" | cardAction == "CLAIM") ? "XXXX" : getCardFullName(card)) + (card.declared ? " (0)" : "") + getNumberOfPips(card, cardAction);
        cardListDiv.append(cardDiv);
        createTooltip("#" + "playedlist" + getCardFullName(card), getActionsOnCard(card));

        saveSettingObject('playedCardList', playedCardList);
    }
}

function test() {
    //document.getElementById("yesNo").modal('show');
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("yesNo"));
    updateYesNoText("Yo!");
    modal.show();
}
