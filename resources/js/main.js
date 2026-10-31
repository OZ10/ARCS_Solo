//import { Card } from "../class/card.js";


class player {
    constructor(number, isHuman) {
        this.number = number;
        this.isHuman = isHuman;
    }

    fuelValue = 0;
    materialsValue = 0;
    weaponsValue = 0;
    relicsValue = 0;
    psionicsValue = 0;
    captivesValue = 0;
    trophiesValue = 0;
    cards = [];
    hasInitiative = false;
    hasPlayedACardThisTurn = false;
    ambitionsEvaluated = [];
}

class Card {
    constructor(name, number, pips, played, ambition, actions) {
        this.name = name;
        this.number = number;
        this.pips = pips;
        this.played = played;
        this.ambition = ambition;
        this.actions = actions;
    }

    cardAction = '';
    playedAction = '';
    playedByPlayerNumber = 0;
    declared = false;
}

function getCardFullName(card) {
    return card.name + card.number;
}

function getCardValue(card) {
    // A card used to declare an ambition counts as 0 for surpassing and
    // initiative, but keeps its printed number so it can still be found by name
    return card.declared ? 0 : card.number;
}

let players = [];

const actioncards = [
    //new Card("Construction", 1, 4, false, "null", "build,repair"),
    new Card("Construction", 2, 4, false, "tycoon", "build,repair"),
    new Card("Construction", 3, 3, false, "tyrant", "build,repair"),
    new Card("Construction", 4, 3, false, "warlord", "build,repair"),
    new Card("Construction", 5, 2, false, "keeper", "build,repair"),
    new Card("Construction", 6, 2, false, "empath", "build,repair"),
    //new Card("Construction", 7, 1, false, "anything", "build,repair"),
    //new Card("Aggression", 1, 3, false, "null", "move,secure,battle"),
    new Card("Aggression", 2, 3, false, "tycoon", "move,secure,battle"),
    new Card("Aggression", 3, 2, false, "tyrant", "move,secure,battle"),
    new Card("Aggression", 4, 2, false, "warlord", "move,secure,battle"),
    new Card("Aggression", 5, 2, false, "keeper", "move,secure,battle"),
    new Card("Aggression", 6, 2, false, "empath", "move,secure,battle"),
    //new Card("Aggression", 7, 1, false, "anything", "move,secure,battle"),
    //new Card("Administration", 1, 4, false, "null", "influence,tax,repair"),
    new Card("Administration", 2, 4, false, "tycoon", "influence,tax,repair"),
    new Card("Administration", 3, 3, false, "tyrant", "influence,tax,repair"),
    new Card("Administration", 4, 3, false, "warlord", "influence,tax,repair"),
    new Card("Administration", 5, 3, false, "keeper", "influence,tax,repair"),
    new Card("Administration", 6, 2, false, "empath", "influence,tax,repair"),
    //new Card("Administration", 7, 1, false, "anything", "influence,tax,repair"),
    //new Card("Mobilisation", 1, 4, false, "null", "move,influence"),
    new Card("Mobilisation", 2, 4, false, "tycoon", "move,influence"),
    new Card("Mobilisation", 3, 3, false, "tyrant", "move,influence"),
    new Card("Mobilisation", 4, 3, false, "warlord", "move,influence"),
    new Card("Mobilisation", 5, 2, false, "keeper", "move,influence"),
    new Card("Mobilisation", 6, 2, false, "empath", "move,influence"),
    //new Card("Mobilisation", 7, 1, false, "anything", "move,influence"),
];

const ambitions = [
    "tycoon",
    "tyrant",
    "warlord",
    "keeper",
    "empath"
];

let currentactioncards = actioncards.slice();

let playedCardList = [];
let discardPile = [];
let hasInitiativeBeenClaimedThisTurn = false;
let turnNumber = 1;
let roundNumber = 1;
let declaredAmbitions = [];
let currentPlayer;

document.addEventListener("DOMContentLoaded", () => {
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
        loadPlayers();
        loadAmbitions();
    }

    refreshTooltips();
});


// #region LOAD

function loadPlayers() {
    for (let playerNumber = 1; playerNumber < 5; playerNumber++) {

        const player = getSettingObject(playerNumber);
        if (player != null) {
            players.push(player);
            clonePlayerNodeAndSetup(player);
        }
    }
    if (haveAllPlayersPlayedACard() == true) {
        // setCurrentPlayer isn't used when everyone has played, so show
        // the initiative star and give currentPlayer a value here
        currentPlayer = getPlayerWithInitiative();
        changeInitiative(currentPlayer);
        enableNextTurnButton();
    } else {
        setCurrentPlayer(findCurrentPlayer());
    }

    createCardButtonsForHumanPlayer();
}

function findCurrentPlayer() {

    let player = getPlayerWithInitiative();

    changeInitiative(player);

    if (player.hasPlayedACardThisTurn == false) {
        return player;
    } else {
        // Loop through all the players looking for the next player who hasn't played a card
        for (let playerNumber = player.number; playerNumber < players.length + 1; playerNumber++) {
            player = players[playerNumber];
            if (playerNumber > players.length - 1) {
                playerNumber = -1
            } else {
                if (player.hasPlayedACardThisTurn == false) {
                    return player;
                }
            }
        }
    }
}

function loadPlayedCardList() {
    const cardlist = getSettingObject('playedCardList');

    if (cardlist != null) {
        cardlist.forEach(card => {
            addPlayedCardToList(card, card.playedAction, card.cardAction, false);
        })
    }
}

function loadDiscardPile() {
    const pile = getSettingObject('discardPile');

    if (pile != null) {
        discardPile = pile;
    }
}

function loadAmbitions() {
    const ambitions = getSettingObject('ambitions');

    if (ambitions != null) {
        ambitions.forEach(ambition => {
            declaredAmbitions.push(ambition);
        })
    }

    setElementValue("declaredAmbitions", declaredAmbitions.length);
}

// #endregion


function setupGame(numberOfPlayers) {

    localStorage.clear();

    players = [];
    turnNumber = 1;
    roundNumber = 1;
    declaredAmbitions = [];

    removeChildElements("playerslots");
    removeChildElements("playedcards");

    createPlayers(numberOfPlayers);

    resetRound();

    dealCards();

    SaveAllSettings();

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
    for (let playerNumber = 1; playerNumber < numberOfPlayers + 1; playerNumber++) {
        let p = new player(playerNumber, (playerNumber == 1) ? true : false);

        if (playerNumber == 1) {
            // Game is being setup, human player is player 1 and has
            // initiative and is set to be the current player
            p.hasInitiative = true;
            currentPlayer = p;
        };

        players.push(p);

        clonePlayerNodeAndSetup(p);
    }
}

function onCollapse(playerNumber, isCollapsed) {
    const el = document.querySelectorAll("#playeroptions" + playerNumber);

    showHideElement(el, isCollapsed ? false : true);
}

function clonePlayerNodeAndSetup(player) {
    const playerNumber = player.number;
    const playertemplate = document.getElementById("playerTemplate").cloneNode(true);
    playertemplate.id = "player" + playerNumber.toString();
    playertemplate.classList.add("playerheader" + playerNumber.toString());
    playertemplate.classList.remove("d-none");
    playertemplate.querySelector('#' + "playernumber").innerHTML = "Player " + playerNumber.toString();

    // DONT THINK WE NEED THIS ANYMORE. ONLY THE HUMAN PLAYER HAS A HAND NOW
    const hand = playertemplate.querySelector("#playerhand");
    hand.id = "playerhand" + playerNumber.toString();

    const a = playertemplate.querySelector("#playerancor");
    a.id = "playerancor" + playerNumber.toString();
    a.dataset.bsTarget = "#playerpanel" + playerNumber.toString();

    const playerPanel = playertemplate.querySelector('#playerpanel');
    playerPanel.id = "playerpanel" + playerNumber.toString();
    playerPanel.classList.add("playerpanel" + playerNumber.toString());

    playerPanel.addEventListener('hidden.bs.collapse', function () {
        onCollapse(getPlayerNumberFromString(this.id), true);
    });

    playerPanel.addEventListener('show.bs.collapse', function () {
        onCollapse(getPlayerNumberFromString(this.id), false);
    });

    const playeroptions = playertemplate.querySelector('#playeroptions');
    playeroptions.id = "playeroptions" + playerNumber.toString();

    const playerinitiative = playertemplate.querySelector('#playerinitiative');
    playerinitiative.id = "playerinitiative" + playerNumber.toString();

    const playcardbutton = playertemplate.querySelector('#playcard');
    playcardbutton.id = "playcard" + playerNumber.toString();
    playcardbutton.disabled = true;

    if (playerNumber == 1) {
        playcardbutton.classList.add("d-none");
        playerinitiative.classList.remove("d-none");

        const actiondiv = document.createElement("div");
        actiondiv.classList.add("mt-3", "header1", "text-center");
        actiondiv.innerHTML = "Actions"

        const actionbuttons = document.createElement("div");
        actionbuttons.classList.add("btn-group", "d-none", "d-flex");
        actionbuttons.id = "actionbuttons";

        createRadioButtons("LEAD", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("DECLARE", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("SURPASS", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("COPY", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("PIVOT", actionbuttons, "actiontype", "btn-light");
        createClaimButton("CLAIM", actionbuttons, "actionclaim", "btn-light");

        playerPanel.appendChild(actiondiv);
        playerPanel.appendChild(actionbuttons);
    }

    if (playerNumber != 1) { hand.classList.add("d-none") }

    setPlusMinusButtons(playertemplate, player, "fuel");
    setPlusMinusButtons(playertemplate, player, "materials");
    setPlusMinusButtons(playertemplate, player, "weapons");
    setPlusMinusButtons(playertemplate, player, "relics");
    setPlusMinusButtons(playertemplate, player, "psionics");
    setPlusMinusButtons(playertemplate, player, "captives");
    setPlusMinusButtons(playertemplate, player, "trophies");

    document.getElementById("playerslots").appendChild(playertemplate);
}

function setPlusMinusButtons(playertemplate, player, type) {
    let btn = playertemplate.querySelector("#minusButton_" + type);
    btn.id = "minusButton_" + type + "_" + player.number;
    btn = playertemplate.querySelector("#plusButton_" + type);
    btn.id = "plusButton_" + type + "_" + player.number;

    let input = playertemplate.querySelector("#" + type + "Value");
    input.id = type + "Value_" + player.number;
    input.classList.add("playerresources" + player.number);

    switch (type) {
        case "fuel":
            input.value = player.fuelValue;
            break;

        case "materials":
            input.value = player.materialsValue;
            break;

        case "weapons":
            input.value = player.weaponsValue;
            break;

        case "relics":
            input.value = player.relicsValue;
            break;

        case "psionics":
            input.value = player.psionicsValue;
            break;

        case "captives":
            input.value = player.captivesValue;
            break;

        case "trophies":
            input.value = player.trophiesValue;
            break;

        default:
            break;
    }
}

function createRadioButtons(btntext, group, groupname, btnstyle) {
    let input = document.createElement("input");
    input.type = "radio";
    input.classList.add("btn-check");
    input.name = groupname;
    input.id = btntext;
    input.autocomplete = "off";
    //input.setAttribute("data-bs-toggle","button");

    let l = document.createElement("label");
    // No id on the label, as the input already uses btntext and ids must be unique.
    // Find the label with label[for="..."] instead
    l.classList.add("btn", btnstyle, "m-1");
    l.htmlFor = btntext;
    l.textContent = btntext.toUpperCase();

    if (groupname == "actiontype") {
        input.onclick = function () {
            humanSelectedAction(btntext);

            // Reset checked on all action type buttons
            document.querySelectorAll('input[name=actiontype]').forEach(input => { input.checked = false });
        };
    }

    group.appendChild(input);
    group.appendChild(l);

    return input;
}

function createClaimButton(btntext, group, groupname) {
    let input = document.createElement("button");
    input.type = "button";
    input.classList.add("btn", "btn-outline-secondary");
    input.name = groupname;
    input.id = btntext;
    input.innerHTML = btntext;
    input.setAttribute("data-bs-toggle", "button");

    group.appendChild(input);

    return input;
}

function getActionButtonElements(action) {
    // The action's input (or CLAIM button) and the label that displays it
    return document.querySelectorAll('#' + action + ', label[for="' + action + '"]');
}

function showHideActionButtons(isleading, card) {
    if (isleading) {
        showHideElement(getActionButtonElements('LEAD'), true);
        showHideElement(getActionButtonElements('DECLARE'), (card.number != 1 && declaredAmbitions.length < 3) ? true : false);
        showHideElement(getActionButtonElements('SURPASS'), false);
        showHideElement(getActionButtonElements('COPY'), false);
        showHideElement(getActionButtonElements('PIVOT'), false);
        showHideElement(getActionButtonElements('CLAIM'), false);
        return;
    }

    const aiPlayedLeadCard = playedCardList[0];

    // Hide the CLAIM button by default
    showHideElement(getActionButtonElements('CLAIM'), false);

    // Only show the claim button if:
    // - the inititive hasn't already been claimed this turn OR
    // - the active player has two or more cards to play
    if (hasInitiativeBeenClaimedThisTurn == false && getUnplayedCards(players[0].cards).length > 2) {
        showHideElement(getActionButtonElements('CLAIM'), true);
    }
    //(getUnplayedCards(players[0].cards).length < 2) ? showHideElement(getActionButtonElements('CLAIM'), false) : showHideElement(getActionButtonElements('CLAIM'), true)

    // Not leading so cannot Lead or Declare
    showHideElement(getActionButtonElements('LEAD'), false);
    showHideElement(getActionButtonElements('DECLARE'), false);

    if (card.name == aiPlayedLeadCard.name) {
        if (card.number > getCardValue(aiPlayedLeadCard)) {
            // Played the same suit and the number is higher so can Surpass.
            // Any card can be played face down to Copy
            showHideElement(getActionButtonElements('SURPASS'), true);
            showHideElement(getActionButtonElements('COPY'), true);
            showHideElement(getActionButtonElements('PIVOT'), false);
        } else {
            // card is the same suit but not higher so can only COPY
            showHideElement(getActionButtonElements('SURPASS'), false);
            showHideElement(getActionButtonElements('COPY'), true);
            showHideElement(getActionButtonElements('PIVOT'), false);
        }
    } else {
        // played a different suit so can Copy or Pivot
        showHideElement(getActionButtonElements('SURPASS'), false);
        showHideElement(getActionButtonElements('COPY'), true);
        showHideElement(getActionButtonElements('PIVOT'), true);
    }
}

function playcardclick() {
    // This is the AI playing a card
    determineCardToPlay(currentPlayer);
}

function resetHandsAndPlayedCardsDisplay() {
    players.forEach(p => {
        removeChildElements("playerhand" + p.number);
    });

    removeChildElements("playedcards");
}

function nextTurn() {

    enableDisableButton("nextTurn", true);

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

    //currentPlayer = getPlayerWithInitiative();
    setCurrentPlayer(getPlayerWithInitiative());

    //checkIfPlayerHasCardsToPlay();

    if (haveAllCardsBeenPlayed()) {
        enableDisableButton("nextRound", false);
        return;
    }

    enableDisablePlayerPanels(currentPlayer.number);

    SaveAllSettings();
}

function hasPlayerGotCardsToPlay(player) {
    if (getUnplayedCards(player.cards).length == 0) {
        // Player has no cards left to play so will
        // move to the next player
        player.hasPlayedACardThisTurn = true;
        return false;
    }

    return true;
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

function resetPlayedThisTurn() {
    players.forEach(player => {
        player.hasPlayedACardThisTurn = false;
    })
}

function nextRound() {

    if (roundNumber == 5) {
        showMessageToast("End of Round 5", "Who won?");
        return;
    }

    turnNumber = 1;
    roundNumber += 1;

    resetRound();

    resetPlayersCards();

    dealCards();

    SaveAllSettings();
}

function resetRound() {
    hasInitiativeBeenClaimedThisTurn = false;

    resetPlayedCardList();

    declaredAmbitions = [];

    discardPile = [];

    setElementValue("turnNumber", turnNumber.toString());
    //setElementValue("roundNumber", roundNumber.toString());

    updateRoundNumber();

    setElementValue("declaredAmbitions", 0);

    enableDisableButton("nextRound", true);

    currentactioncards = structuredClone(actioncards);

    addExtraCards(players.length);

    resetDeck(currentactioncards);

    resetPlayedThisTurn();

    resetHandsAndPlayedCardsDisplay();

    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayerPanels(currentPlayer.number);
}

function updateRoundNumber() {
    for (let roundNum = 1; roundNum < 6; roundNum++) {
        let element = document.getElementById("roundNumber" + roundNum);
        if (roundNum == roundNumber) {
            element.classList.remove("numberCircle");
            element.classList.add("numberCircleSelected");
        } else {
            element.classList.add("numberCircle");
            element.classList.remove("numberCircleSelected");
        }
    }
}

function resetPlayedCardList() {
    playedCardList = [];
    removeChildElements("playedcards");
    RemoveSettingByKey("playedCardList");
}

function resetPlayersCards() {
    players.forEach(player => {
        player.cards = [];
    });
}

function resetPlayersAmibtions() {
    players.forEach(player => {
        player.ambitionsEvaluated = [];
    });
}

function getPlayerWithInitiative() {
    let player;
    for (let playerNumber = 0; playerNumber < players.length; playerNumber++) {
        if (players[playerNumber].hasInitiative) {
            player = players[playerNumber];
        };
    }
    return player;
}

function resetDeck(cards) {
    cards.forEach(card => {
        card.played = false;
    })
}

function humanSelectedAction(cardAction) {

    const player = players[0];

    const btnSelected = document.querySelector('input.p1:checked');

    const playedCard = getCardByNameAndNumber(player.cards, btnSelected.id, false);
    enableDisableButton(getCardFullName(playedCard), true);

    if (isLeadingThisTurn()) {
        playCard(player, playedCard, "ANY", cardAction, false);
        showHideElement(document.querySelectorAll("#actionbuttons"), false);

    } else {

        player.hasPlayedACardThisTurn = true;
        addPlayedCardToList(playedCard, "ANY", cardAction, false, player);

        const aiPlayedLeadCard = playedCardList[0];

        const hasPlayerClaimed = document.getElementById("CLAIM").className.includes("active") ? true : false;

        if (hasPlayerClaimed) {
            hasInitiativeBeenClaimedThisTurn = true;
            changeInitiative(player);

            showCardModal(player, getUnplayedCards(player.cards), "Claim Card List", "Please select a card second card to play", "CLAIM");

        } else if (cardAction == "SURPASS" && isPlayedCardSameSuitAndHigher(playedCard, aiPlayedLeadCard)) {
            // Only a face up SURPASS can take the initiative. A higher card
            // played face down as a COPY doesn't count
            checkInitiative(player, playedCard, false);
        }

        //changeCurrentPlayer(player, false);
        setCurrentPlayer(getNextPlayer(player.number));

        showHideElement(document.querySelectorAll("#actionbuttons"), false);

        if (haveAllPlayersPlayedACard()) {
            enableNextTurnButton();
        }
    }

    SaveAllSettings();
}

function showCardModal(player, cards, title, prompt, action) {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("cardsModal"));

    const cardsModalPrompt = document.querySelector("#cardsModalPrompt");
    cardsModalPrompt.innerHTML = prompt;

    const cardsModalTitle = document.querySelector("#cardsModalTitle");
    cardsModalTitle.innerHTML = title;

    const cardsModalList = document.querySelector("#cardsModalList");
    cardsModalList.replaceChildren();
    //const cards = getUnplayedCards(cards);
    cards.forEach(card => {
        let btn = document.createElement("button");
        btn.classList.add("btn", "btn-secondary", "mt-3");
        btn.setAttribute("data-bs-dismiss", "modal");
        btn.innerHTML = getCardFullName(card);

        switch (action) {
            case "CLAIM":
                btn.onclick = function () {
                    addPlayedCardToList(getCardByNameAndNumber(players[0].cards, btn.innerHTML, false), "ANY", "CLAIM", false, players[0]);
                    createCardButtonsForHumanPlayer();
                };
                break;

            case "DRAW":
                btn.onclick = function () {
                    const cardFullName = btn.innerHTML;

                    // add clicked card to players hand
                    // The ... below is a Spread copy meaning that the drawCard is
                    // shallow copy of the original card, not a reference to it
                    const drawCard = { ...getCardByNameAndNumber(cards, cardFullName, true) }
                    // Clear details of how the card was last played
                    drawCard.played = false;
                    drawCard.declared = false;
                    drawCard.cardAction = '';
                    drawCard.playedAction = '';
                    drawCard.playedByPlayerNumber = 0;

                    // The card now only exists in this player's hand, so remove it from the
                    // discard pile, this turn's played cards and the hand of whoever played it
                    removePlayedCard(discardPile, cardFullName);
                    removePlayedCard(playedCardList, cardFullName);
                    players.forEach(p => removePlayedCard(p.cards, cardFullName));

                    const playedDiv = document.getElementById("playedlist" + cardFullName);
                    if (playedDiv != null) { playedDiv.remove(); }

                    player.cards.push(drawCard);
                    createCardButtonsForHumanPlayer();

                    saveSettingObject('playedCardList', playedCardList);
                    SaveAllSettings();
                };
                break;

            default:
                break;
        }

        cardsModalList.appendChild(btn);
    });
    modal.show();
}

function removePlayedCard(cards, cardFullName) {
    const index = cards.findIndex(card => getCardFullName(card) == cardFullName && card.played);
    if (index >= 0) { cards.splice(index, 1); }
}

function isPlayedCardSameSuitAndHigher(playedCard, aiPlayedLeadCard) {
    return (aiPlayedLeadCard.name == playedCard.name && getCardValue(aiPlayedLeadCard) < playedCard.number) ? true : false;
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

    createCardButtonsForHumanPlayer();
}

function createCardButtonsForHumanPlayer() {
    const player = players[0];

    const playerhandDiv = document.getElementById("playerhand1");
    playerhandDiv.replaceChildren();

    player.cards.forEach(card => {

        let btn = createRadioButtons(getCardFullName(card), playerhandDiv, "cards", "btn-dark");

        btn.classList.add("p1");
        btn.value = card.number;

        // Add tooltip which displays the number of pips and ambition
        createTooltip('label[for="' + btn.id + '"]',getNumberOfPips(card, "LEAD") + "<br>" + card.ambition.toUpperCase() + "<br>" + getActionsOnCard(card));

        if (card.played) { btn.disabled = true; }

        btn.onclick = function () {
            showHideElement(document.querySelectorAll("#actionbuttons"), true);
            document.getElementById("CLAIM").classList.remove("active");
            if (isLeadingThisTurn()) {
                showHideActionButtons(true, getCardByNameAndNumber(players[0].cards, this.id, false));
            } else {
                const playedCard = getCardByNameAndNumber(player.cards, btn.id, false);
                showHideActionButtons(false, playedCard);
            }
        };

    });
}

function createTooltip(elementid, title) {
    const l = document.querySelector(elementid);
    l.setAttribute('data-bs-toggle', 'tooltip');
    l.setAttribute('data-bs-html', 'true');
    l.setAttribute('data-bs-custom-class', 'custom-tooltip');
    l.setAttribute('title', title);

    refreshTooltips();
}

function refreshTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    // getOrCreateInstance so elements that already have a tooltip don't get another one
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => bootstrap.Tooltip.getOrCreateInstance(tooltipTriggerEl));
}

function getActionsOnCard(card) {
    let actions;
    const cardActions = card.actions.split(",");
    cardActions.forEach(action => {
        if (actions == null) {
            actions = "<b>" + action + "</b>";
        } else {
            actions += " OR " + "<b>" + action + "</b>";
        }
    })

    return actions;
}

function getCardByNameAndNumber(hand, cardfullname, played) {
    let returnCard;
    hand.forEach(card => {
        if (getCardFullName(card) == cardfullname && card.played == played) {
            returnCard = card;
        }
    })

    return returnCard;
}

function getPlayer(playerNumber) {
    let returnplayer = null;
    players.forEach(player => {
        if (player.number == playerNumber) {
            returnplayer = player;
        }
    })

    return returnplayer;
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

    if (isLeading) {
        if (player.isHuman && cardAction == "DECLARE") {

            if (playedCard.ambition == "any") {
                // Show modal
                showDeclareAmbitionModal(null, true, player, playedCard);
            } else {
                showMessageToast("Player" + player.number, "Player declared ambition: " + playedCard.ambition);
                playedCard.declared = true;

                // Reset the played card list and re-add the declared card
                // with a value of 0
                addPlayedCardToList(playedCard, "ANY", "DECLARE", true, player);

                declaredAmbitions.push(playedCard.ambition);
                setElementValue("declaredAmbitions", declaredAmbitions.length);
            }

        } else if (player.isHuman == false) {
            // AI player will determine whether to declare or not
            declareAmbition(player, playedCard);
        }
    }
    setCurrentPlayer(getNextPlayer(player.number))

    if (player.isHuman && haveAllPlayersPlayedACard()) {
        enableNextTurnButton();
    }

    SaveAllSettings();
}

function haveAllPlayersPlayedACard() {
    for (let playerNumber = 0; playerNumber < players.length; playerNumber++) {
        if (players[playerNumber].hasPlayedACardThisTurn == false) { return false; }
    }
    return true;
}

function setCurrentPlayer(player) {

    if (haveAllPlayersPlayedACard()) {
        enableNextTurnButton();
        return;
    }

    if (hasPlayerGotCardsToPlay(player)) {
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

function getNextPlayer(previousPlayerNumber) {

    if (previousPlayerNumber > players.length - 1) {
        return players[0];
    } else {
        return players[previousPlayerNumber];
    }
}

function determineCardToPlay(player) {

    if (player.hasPlayedACardThisTurn == false) {
        let unplayedCards = getUnplayedCards(player.cards);

        findFocus(player, unplayedCards);

    }
}

function isLeadingThisTurn() {
    // The first card played in a turn is the lead. Initiative can change hands
    // mid-turn (surpass, claim, seize) so it can't be used to decide who is leading
    return playedCardList.length == 0;
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

let modal;
let currentQuestionNumber;

// The action each Yes/No question asks about, in the order the questions are asked.
// Question 1 is the first entry. The question text is in focus_tycoon, focus_tyrant etc.
const ambitionQuestionActions = {
    // materials and fuel: tax, secure, influence, raid
    TYCOON: ["tax", "secure", "influence", "battle"],
    // capture: tax a rival city, secure a card with rival agents, ransack the court
    TYRANT: ["tax", "secure", "battle"],
    // fight: battle, secure a weapons card, influence a weapons card
    WARLORD: ["battle", "secure", "influence"],
    // relics: tax, secure, influence, raid
    KEEPER: ["tax", "secure", "influence", "battle"],
    // psionics: tax, secure, influence, raid
    EMPATH: ["tax", "secure", "influence", "battle"]
};

function getNextQuestionNumber(ambition, afterQuestionNumber, possibleActions) {
    // Find the next question for the ambition that the player has a card
    // for, skipping any whose action isn't in their hand. 0 if there are none
    const questionActions = ambitionQuestionActions[ambition];
    for (let questionNumber = afterQuestionNumber + 1; questionNumber <= questionActions.length; questionNumber++) {
        if (possibleActions.includes(questionActions[questionNumber - 1])) {
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

function chaseAmbition(player, possibleActions, unplayedCards) {
    // TODO Need to determine which ambition is best to chase
    // - Have cards to chase?
    // - Have pieces to chase?
    // - Worth most points?
    for (let index = 0; index < declaredAmbitions.length; index++) {
        const ambition = declaredAmbitions[index].toUpperCase();

        if (player.ambitionsEvaluated.includes(ambition)) { continue; }

        // Ask the first question for this ambition the player has a card for
        const questionNumber = getNextQuestionNumber(ambition, 0, possibleActions);
        if (questionNumber > 0) {
            focus_ambition(ambition, questionNumber);
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

    switch (ambition) {
        case "TYCOON":
            focus_tycoon(questionNumber);
            break;

        case "TYRANT":
            focus_tyrant(questionNumber);
            break;

        case "WARLORD":
            focus_warlord(questionNumber);
            break;

        case "KEEPER":
            focus_keeper(questionNumber);
            break;

        case "EMPATH":
            focus_empath(questionNumber);
            break;

        default:
            break;
    }

    // Only show the modal if the previous 
    // answer was not 'No'
    if (answerNo == null) {
        modal.show();
    }
}

function updateYesNoText(text) {
    
    document.getElementById("yesNoTitle").innerHTML = "Player " + currentPlayer.number;

    const element = document.getElementById("yesNoMessage");
    element.innerHTML = text
    element.classList.add("flash");

    // Remove the class after the animation ends
    setTimeout(() => {
        element.classList.remove("flash");
    }, 1000); // Match the duration of the animation

}

function focus_tycoon(questionNumber) {
    switch (questionNumber) {
        case 1:
            updateYesNoText("Can I tax a city for materials or fuel?");
            break;

        case 2:
            updateYesNoText("Is there a materials or fuel card in the market I can secure?");
            //updateYesNoText("Is there a materials or fuel card in the market I can secure?";
            break;

        case 3:
            updateYesNoText("Is there a materials or fuel card in the market I can influence?");
            break;

        case 4:
            updateYesNoText("Can I raid a city for materials or fuel?");
            break;

        default:
            // Could not do any of the above
            // Move to next amibition?
            break;
    }
}

function focus_tyrant(questionNumber) {
    //let modal = openYesNoModal("TYRANT");

    switch (questionNumber) {
        case 1:
            updateYesNoText("Can I tax a rival's city to capture?");
            break;

        case 2:
            updateYesNoText("Is there a card in the market with rival agents on it that I can secure?");
            break;

        case 3:
            updateYesNoText("Can I destory a city to ransack the court?");
            break;

        default:
            // Could not do any of the above
            // Move to next amibition?
            break;
    }

    //modal.show();
}

function focus_warlord(questionNumber) {
    //let modal = openYesNoModal("WARLORD");

    switch (questionNumber) {
        case 1:
            updateYesNoText("Can I battle a rival?");
            break;

        case 2:
            updateYesNoText("Is there a weapons card in the market I can secure?");
            break;

        case 3:
            updateYesNoText("Is there a weapons card in the market I can influence?");
            break;

        default:
            // Could not do any of the above
            // Move to next amibition?
            break;
    }

    //modal.show();
}

function focus_keeper(questionNumber) {
    //let modal = openYesNoModal("KEEPER");

    switch (questionNumber) {
        case 1:
            updateYesNoText("Can I tax a city for a relic?");
            break;

        case 2:
            updateYesNoText("Is there a relic card in the market I can secure?");
            break;

        case 3:
            updateYesNoText("Is there a relic card in the market I can influence?");
            break;

        case 4:
            updateYesNoText("Can I raid a city for a relic?");
            break;

        default:
            // Could not do any of the above
            // Move to next amibition?
            break;
    }

    //modal.show();
}

function focus_empath(questionNumber) {
    //let modal = openYesNoModal("EMPATH");

    switch (questionNumber) {
        case 1:
            updateYesNoText("Can I tax a city for a psionic?");
            break;

        case 2:
            updateYesNoText("Is there a psionic card in the market I can secure?");
            break;

        case 3:
            updateYesNoText("Is there a psionic card in the market I can influence?");
            break;

        case 4:
            updateYesNoText("Can I raid a city for a psionic?");
            break;

        default:
            // Could not do any of the above
            // Move to next amibition?
            break;
    }

    //modal.show();
}

function openYesNoModal(focusTitle) {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("yesNo"));
    document.getElementById("yesNoTitle").innerHTML = "Player " + currentPlayer.number;
    document.getElementById("focusMessage").innerHTML = focusTitle;
    return modal;
}

function answerYes() {
    const unplayedCards = getUnplayedCards(currentPlayer.cards);
    const focus = document.getElementById("focusMessage").innerHTML;

    // The action the question that was just answered asks about
    const actionToPlay = ambitionQuestionActions[focus][currentQuestionNumber - 1];

    const cardsWithAction = getCardsWithAction(unplayedCards, actionToPlay);
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

        let cardsWithAmbition = findCardsWithAmbition(ambitionSorted, cards);

        if (cardsWithAmbition.length > 0) {
            cardToPlay = getHighestCard(cardsWithAmbition);    
         }else{
            if (chaseAmbition(currentPlayer, getPossibleActions(cards), cards ) == false){
                cardToPlay = getHighestCard(cards);
            } else {
                // The Yes/No modal is now open. answerYes/answerNo will
                // play the card, so don't play one here as well
                return;
            }
         }
    }

    //const cardToPlay = getHighestCard(cards);

    if (cardToPlay == "") { cardToPlay = getHighestCard(cards); }

    let cardAction = "";

    if (actionToPlay == "") { actionToPlay = "ANY" }

    if (isLeading) { cardAction = "LEAD" }

    if (cardToPlay != null && isLeading) {
        playCard(currentPlayer, cardToPlay, actionToPlay, cardAction);
    } else {
        if (canSurpass(currentPlayer, playedCardList[0], cards, actionToPlay) == false) {
            if (claim(currentPlayer, cards, actionToPlay) == false) {
                if (canCopy(currentPlayer, playedCardList[0], cards, actionToPlay) == false) {
                    pivot(currentPlayer, cards, actionToPlay);
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
    const focus = document.getElementById("focusMessage").innerHTML;
    const unplayedCards = getUnplayedCards(currentPlayer.cards);

    // Move on to the next question for this ambition that the player has a card for.
    // Questions whose action isn't in their hand are skipped
    const nextQuestionNumber = getNextQuestionNumber(focus, currentQuestionNumber, getPossibleActions(unplayedCards));
    if (nextQuestionNumber > 0) {
        focus_ambition(focus, nextQuestionNumber, true);
        return;
    }

    // No questions left for this ambition, so try the next ambition
    currentPlayer.ambitionsEvaluated.push(focus);

    // Wait for the modal to finish hiding before moving on. Bootstrap ignores
    // show() while the modal is fading out, so if findFocus asks about the next
    // ambition straight away the question would never be displayed
    document.getElementById("yesNo").addEventListener('hidden.bs.modal', () => {
        findFocus(currentPlayer, unplayedCards);
    }, { once: true });

    modal.hide();
}

function getHighestCard(cards) {
    let highestCard;
    if (cards.length > 0) {
        cards.forEach(card => {
            if (highestCard == null) {
                highestCard = card;
            } else {
                if (highestCard.number < card.number) {
                    highestCard = card;
                }
            }
        })
    }

    return highestCard;
}

function enableNextTurnButton() {
    if (haveAllCardsBeenPlayed()) {
        enableDisableButton("nextRound", false);
    } else if (haveAllPlayersPlayedACard()) {
        enableDisableButton("nextTurn", false);
    }
    hidePlayerPanels();
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

    let sum = 10;

    switch (ambition) {
        case "tycoon":
            sum -= player.fuelValue + player.materialsValue;
            break;

        case "tyrant":
            sum -= player.captivesValue
            break;

        case "warlord":
            sum -= player.trophiesValue;
            break;

        case "keeper":
            sum -= player.relicsValue;
            break;

        case "empath":
            sum -= player.psionicsValue;
            break;

        default:
            break;
    }

    // If sum is still 10 here then player has no resources
    // of the matching ambition and should not declare an ambition
    if (sum == 10) { return; }

    switch (roundNumber) {
        case 2:
        case 3:
            sum -= 2;
            break;

        case 4:
        case 5:
            sum -= 3;

        default:
            break;
    }

    if (sum < 0) { sum = 0 };

    let num = Math.floor(Math.random() * 10);

    if (num >= sum) {
        showMessageToast("Player" + player.number, "Player declared ambition: " + ambition);
        playedCard.declared = true;

        addPlayedCardToList(playedCard, playedCard.playedAction, "LEAD", true, player);

        declaredAmbitions.push(ambition);
        setElementValue("declaredAmbitions", declaredAmbitions.length);
    }
}

function declareAmbitionClick(ambition) {
    if (declaredAmbitions.length >= 3) {
        return;
    }

    // If the player has triggered this after playing a 7 card
    // there are hidden elements for:
    //      - when a 7 has been played the element will be set to TRUE
    //      - the player number is in the title
    //      - the card that was played
    const seven = document.getElementById("playedSeven");

    if (seven.innerHTML == "TRUE") {
        const title = document.getElementById("declareAmbitionModalTitle");
        const playerNumber = getPlayerNumberFromString(title.innerHTML);
        const player = getPlayer(playerNumber);
        const playedCardFullName = document.getElementById("playedCard").innerHTML;
        const playedCard = getCardByNameAndNumber(player.cards, playedCardFullName, true);

        showMessageToast("Player" + player.number, "Player declared ambition: " + ambition);
        playedCard.declared = true;

        // Reset the played card list and re-add the declared card
        // with a value of 0
        addPlayedCardToList(playedCard, "ANY", "DECLARE", true, player);

        seven.innerHTML = "";
    }

    declaredAmbitions.push(ambition);
    setElementValue("declaredAmbitions", declaredAmbitions.length);
    SaveAllSettings();
}

function showDeclareAmbitionModal(ele, hasPlayedASeven, player, playedCard) {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("declareAmbitionModal"));
    const playerNumber = ele != null ? getPlayerNumberFromElement(ele) : player.number;
    const title = document.getElementById("declareAmbitionModalTitle");
    title.innerHTML = "Player " + playerNumber;

    // Always set the flag, so a 7 whose declare modal was closed without choosing
    // doesn't make a later declare (from the Declare icon) treat it as a 7
    const seven = document.getElementById("playedSeven");
    seven.innerHTML = hasPlayedASeven ? "TRUE" : "";

    if (hasPlayedASeven) {
        const card = document.getElementById("playedCard");
        card.innerHTML = getCardFullName(playedCard);
    }

    modal.show();
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
        copyCards = getUnplayedCards(player.cards);
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

function getLowestCardtoPlay(cards) {
    // Find the lowest number card to play
    let lowestCard;
    cards.forEach(card => {
        if (lowestCard == null) {
            lowestCard = card;
        } else {
            if (lowestCard.number > card.number) {
                lowestCard = card;
            }
        }
    })

    return lowestCard;
}

function claim(player, cards, actionToPlay) {
    // Logic;
    //  claim needs to be based on a calc between: number of cards in hand, number of ambitions played, .... other things
    //  at the start of the game the calc needs to rarely succeed

    //let hasInitiativeBeenClaimedThisTurn = false;

    if (hasInitiativeBeenClaimedThisTurn == true) { return false; }

    // No point in claiming if cannot declare an ambition
    if (declaredAmbitions.length >= 3) { return false; }

    let unplayedCards = getUnplayedCards(player.cards);

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

    let num = Math.floor(Math.random() * 16);

    //num = 9;
    if (num >= totalValueOfCards) {
        // First play the card for this turn's action, chosen from the cards that have
        // the action the player is after. It couldn't surpass, so a card of the lead
        // suit can only COPY and any other card PIVOTs
        const actionCard = getLowestCardtoPlay(cards);
        const actionCardAction = (actionCard.name == playedCardList[0].name) ? "COPY" : "PIVOT";
        playCard(player, actionCard, actionToPlay, actionCardAction);

        // Then play a second card face down to claim the initiative
        playCard(player, getLowestCardtoPlay(getUnplayedCards(player.cards)), "ANY", "CLAIM");

        hasInitiativeBeenClaimedThisTurn = true;
        changeInitiative(player);
        return true;
    }

    return false;
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
                changeInitiative(player);
            }
        }

    })
}

function changeInitiative(player) {
    players.forEach(p => {
        p.hasInitiative = (p.number == player.number) ? true : false;

        const element = document.querySelectorAll("#playerinitiative" + p.number);
        showHideElement(element, (p.number == player.number) ? true : false);
    })

    SaveAllSettings();
}

function seizeInitiativeQuestion(ele) {
    if (hasInitiativeBeenClaimedThisTurn == true) {
        //alert("Initiative has already been claimed this turn");
        //showToast("messageToast", "messageToastHeader", "Initiative", "messageToastBody", "Initiative has already been claimed this turn!");
        showMessageToast("Initiative", "Initiative has already been claimed this turn!");
        return;
    } else {
        const playerNumber = getPlayerNumberFromElement(ele);

        showToast("seizeToast", "seizeToastHeader", "Player " + playerNumber, "", "");
    }
}

function getPlayerNumberFromString(s) {
    return s.slice(s.length - 1);
}

function getPlayerNumberFromElement(ele) {
    return ele.parentNode.parentNode.id.slice(ele.parentNode.parentNode.id.length - 1);
}

function seizeInitiative() {
    const header = document.querySelector("#seizeToastHeader");
    const playerNumber = getPlayerNumberFromString(header.innerHTML);
    hasInitiativeBeenClaimedThisTurn = true;
    changeInitiative(getPlayer(playerNumber));
}

function showMessageToast(headerValue, bodyValue) {
    showToast("messageToast", "messageToastHeader", headerValue, "messageToastBody", bodyValue);
}

function showToast(id, headerId, headerValue, bodyId, bodyValue) {
    const toast = document.getElementById(id);
    const header = toast.querySelector("#" + headerId);
    header.innerHTML = headerValue;

    if (bodyId != "") {
        const body = toast.querySelector("#" + bodyId);
        body.innerHTML = bodyValue;
    }

    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toast);
    toastBootstrap.show();
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

function displayVoxCards() {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("voxCards"));
    modal.show();
}

function playVoxCard(btn) {
    switch (btn.innerText) {
        case "Call To Action":
            //Draw a card from action discard pile
            break;
        case "Populist Demands":
            //Declare ambition
            break;

        case "Song Of Freedom":
            //Return city you control to seize the initiative (if possible)
            break;

        default:
            break;
    }
}

let drawingPlayer;

function setDrawingPlayer(ele) {
    // Remember whose panel the Draw icon was clicked on, as
    // it isn't necessarily the current player who is drawing
    drawingPlayer = getPlayer(getPlayerNumberFromElement(ele));
}

function drawACard(pileName) {
    const player = (drawingPlayer != null) ? drawingPlayer : currentPlayer;

    switch (pileName) {
        case 'playedthisturn':
            showCardModal(player, playedCardList, "Cards Played This Turn", "Select a card to add to Player " + player.number + "'s hand", "DRAW")
            break;

        case 'discardpile':
            showCardModal(player, discardPile, "Cards In The Discard Pile", "Select a card to add to Player " + player.number + "'s hand", "DRAW")
            break;

        default:
            break;
    }

    SaveAllSettings();
}

function enableDisablePlayerPanels(playerNumber) {
    players.forEach(player => {
        let btn = document.querySelector("#playcard" + player.number);
        //btn.disabled = (player.number == playerNumber) ? false : true;

        if (player.number == playerNumber) {
            document.getElementById("player" + player.number).classList.add("playersTurn");
            btn.disabled = false;
        } else {
            document.getElementById("player" + player.number).classList.remove("playersTurn");
            btn.disabled = true;
        }

        showHidePlayerPanel(player, playerNumber);

        if (player.isHuman) { enableDisableButtonsByPlayerNumber(player.number, (player.number == playerNumber) ? true : false) }
    })
}

function showHidePlayerPanel(player, playerNumber) {
    const playerPanel = document.querySelector('#playerpanel' + player.number);

    const collapse = bootstrap.Collapse.getOrCreateInstance(playerPanel, {
        toggle: false // Prevents initial toggle
    });

    if (player.number == playerNumber) {
        collapse.show();
    } else {
        collapse.hide();
    }
}

function hidePlayerPanels() {
    players.forEach(player => {
        showHidePlayerPanel(player, 99);
    })
}

function enableDisableButtonsByPlayerNumber(playerNumber, enable) {
    document.querySelectorAll(".p" + playerNumber.toString()).forEach((btn) => {
        if (enable) {
            let card = getCardByNameAndNumber(getPlayer(playerNumber).cards, btn.id, false);
            if (card != null) {
                // Card is unplayed and button should be enabled
                btn.disabled = false;
            }
        } else {
            btn.disabled = true;
            btn.checked = false;
        }
    })
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
            turnDiv.classList.add("w-100", "mt-4", "fw-bold", "text-center");
            turnDiv.id = "Turn" + turnNumber.toString();
            turnDiv.innerHTML = "Turn " + turnNumber.toString();

            turnListDiv.append(turnDiv);
        }

        let cardListDiv = document.getElementById("Turn" + turnNumber.toString());

        if (reset) {
            playedCardList = [];
            cardListDiv.replaceChildren();
            cardListDiv.innerHTML = "Turn " + turnNumber.toString();
        }

        playedCardList.push(card);

        let cardDiv = document.createElement("div");
        cardDiv.classList.add("fw-normal", "playercard" + card.playedByPlayerNumber);
        cardDiv.id = "playedlist" + getCardFullName(card);
        // If player COPIED, replace the suit played with XXXX 
        cardDiv.innerHTML = cardAction.toUpperCase() + ": " + actionToPlay.toUpperCase() + ": " + ((cardAction == "COPY" | cardAction == "CLAIM") ? "XXXX" : getCardFullName(card)) + (card.declared ? " (0)" : "") + getNumberOfPips(card, cardAction);
        cardListDiv.append(cardDiv);
        createTooltip("#" + "playedlist" + getCardFullName(card), getActionsOnCard(card));

        saveSettingObject('playedCardList', playedCardList);
    }
}

function getNumberOfPips(card, action) {
    let pips = "  &#9733;";

    // Only add extra pips if the action is...
    if (action == "SURPASS" | action == "LEAD" | action == "DECLARE" | action == "PLAYER") {
        for (let index = 0; index < card.pips - 1; index++) {
            pips += "&#9733;";
        }
    }
    return pips;
}

function getUnplayedCards(cards) {
    let unplayedCards = [];
    cards.forEach(card => {
        if (card.played == false) {
            unplayedCards.push(card);
        }
    });

    return unplayedCards;
}

function getCardsWithAction(cards, action) {
    let cardsWithAction = [];
    cards.forEach(card => {
        if (card.actions.includes(action)) {
            cardsWithAction.push(card);
        }
    });

    return cardsWithAction;
}

function getCardsWithAmbition(cards, ambition) {
    let cardsWithAmbition = [];
    cards.forEach(card => {
        if (card.ambition == ambition) {
            cardsWithAmbition.push(card);
        }
    });

    return cardsWithAmbition;
}

function plusMinusClicked(id, action) {
    const value = (action == 'minus') ? -1 : 1

    const idsplit = id.split('_');
    const resourceName = idsplit[1];
    let resourceValue = 0;
    const playerNumber = idsplit[2];

    const player = getPlayer(playerNumber);

    switch (resourceName) {
        case "fuel":
            player.fuelValue += value;
            resourceValue = player.fuelValue;
            break;

        case "materials":
            player.materialsValue += value;
            resourceValue = player.materialsValue;
            break;

        case "weapons":
            player.weaponsValue += value;
            resourceValue = player.weaponsValue;
            break;

        case "relics":
            player.relicsValue += value;
            resourceValue = player.relicsValue;
            break;

        case "psionics":
            player.psionicsValue += value;
            resourceValue = player.psionicsValue;
            break;

        case "captives":
            player.captivesValue += value;
            resourceValue = player.captivesValue;
            break;

        case "trophies":
            player.trophiesValue += value;
            resourceValue = player.trophiesValue;
            break;

        default:
            break;
    }

    document.getElementById(resourceName + "Value_" + playerNumber).value = resourceValue;

    SaveAllSettings();
}

// #region UTILS

function removeChildElements(id) {
    document.getElementById(id).replaceChildren();
}

function showHideElement(elements, show) {
    elements.forEach(element => {
        (show) ? element.classList.remove("d-none") : element.classList.add("d-none");
    })
}

function setElementValue(elementid, value) {
    document.getElementById(elementid).innerHTML = value;
}

function enableDisableButton(buttonName, isDisabled) {
    document.getElementById(buttonName).disabled = isDisabled;
}



// #endregion


// #region SAVE

const GetSettingsByValue = (val, includes = false) => {
    let settings = new Array();
    for (let [key, value] of Object.entries(localStorage)) {
        if (includes && value.includes(val)) {
            settings.push(key + "," + value);
        } else if (value == val) {
            settings.push(key + "," + value);
        }
    }
    return settings;
};

const GetSettingsByKey = (val, includes = false) => {
    let settings = new Array();
    for (let [key, value] of Object.entries(localStorage)) {
        if (includes && key.includes(val)) {
            settings.push(key + "," + value);
        } else if (key == val) {
            settings.push(key + "," + value);
        }
    }
    return settings;
};

const GetSettingValueByKey = (keytofind) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (key == keytofind) {
            return value;
        }
    }

    return "";
};

const SaveSetting = (key, value) => {
    localStorage.setItem(key, value);
};

const SaveSettings = (settings) => {
    for (let [key, value] of Object.entries(settings)) {
        localStorage.setItem(key, value);
    }

};

const SaveAllSettings = () => {
    savePlayers();
    saveSettingObject('ambitions', declaredAmbitions);
    saveSettingObject('discardPile', discardPile);
    SaveSetting("turn", turnNumber);
    SaveSetting("round", roundNumber);
    SaveSetting("initiaiteClaimed", hasInitiativeBeenClaimedThisTurn);
}

const saveSettingObject = (settingName, settingObject) => {
    localStorage.setItem(settingName, JSON.stringify(settingObject));
};

const getSettingObject = (settingName) => {
    return JSON.parse(localStorage.getItem(settingName));
};

const RemoveSettingByKey = (k) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (key === k) {
            localStorage.removeItem(key);
        }
    }
};

const RemoveSettingByValue = (val) => {
    for (let [key, value] of Object.entries(localStorage)) {
        if (value === val) {
            localStorage.removeItem(key);
        }
    }
};

function savePlayers() {
    players.forEach(player => {
        saveSettingObject(player.number, player);
    });
}

function saveAmbitions() {
    declaredAmbitions.forEach(ambition => {
        saveSettingObject(ambition, ambition);
    })
}

// #endregion

function test() {
    //document.getElementById("yesNo").modal('show');
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("yesNo"));
    updateYesNoText("Yo!");
    modal.show();
}