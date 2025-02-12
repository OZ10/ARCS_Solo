//import { Card } from "../class/card";

class player {
    constructor(number, isHuman) {
        this.number = number;
        this.isHuman = isHuman;
    }

    cards = [];
    hasInitiative = false;
    hasPlayedACardThisTurn = false;
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

    playedAction = '';
    playedByPlayerNumber = 0;
}

function getCardFullName(card) {
    return card.name + card.number;
}

let players = [];

const actioncards = [
    //new Card("Construction", 1, 4, false, "null", "build,repair,"),
    new Card("Construction", 2, 4, false, "tycoon", "build,repair,"),
    new Card("Construction", 3, 3, false, "tyrant", "build,repair,"),
    new Card("Construction", 4, 3, false, "warlord", "build,repair,"),
    new Card("Construction", 5, 2, false, "keeper", "build,repair,"),
    new Card("Construction", 6, 2, false, "empath", "build,repair,"),
    //new Card("Construction", 7, 1, false, "anything", "build,repair,"),
    //new Card("Aggression", 1, 3, false, "null", "move,secure,battle,"),
    new Card("Aggression", 2, 3, false, "tycoon", "move,secure,battle,"),
    new Card("Aggression", 3, 2, false, "tyrant", "move,secure,battle,"),
    new Card("Aggression", 4, 2, false, "warlord", "move,secure,battle,"),
    new Card("Aggression", 5, 2, false, "keeper", "move,secure,battle,"),
    new Card("Aggression", 6, 2, false, "empath", "move,secure,battle,"),
    //new Card("Aggression", 7, 1, false, "anything", "move,secure,battle,"),
    //new Card("Administration", 1, 4, false, "null", "influence,tax,repair,"),
    new Card("Administration", 2, 4, false, "tycoon", "influence,tax,repair,"),
    new Card("Administration", 3, 3, false, "tyrant", "influence,tax,repair,"),
    new Card("Administration", 4, 3, false, "warlord", "influence,tax,repair,"),
    new Card("Administration", 5, 3, false, "keeper", "influence,tax,repair,"),
    new Card("Administration", 6, 2, false, "empath", "influence,tax,repair,"),
    //new Card("Administration", 7, 1, false, "anything", "influence,tax,repair,"),
    //new Card("Mobilisation", 1, 4, false, "null", "move,influence,"),
    new Card("Mobilisation", 2, 4, false, "tycoon", "move,influence,"),
    new Card("Mobilisation", 3, 3, false, "tyrant", "move,influence,"),
    new Card("Mobilisation", 4, 3, false, "warlord", "move,influence,"),
    new Card("Mobilisation", 5, 2, false, "keeper", "move,influence,"),
    new Card("Mobilisation", 6, 2, false, "empath", "move,influence,"),
    //new Card("Mobilisation", 7, 1, false, "anything", "move,influence,"),
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
let initiativeClaimed = false;
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
                    setElementValue("roundNumber", value);
                    break;
                default:
                    break;
            }
        }

        loadPlayers();
        loadPlayedCardList();
        loadAmbitions();
    }
});

// #region LOAD

function loadPlayers() {
    for (let playerNumber = 1; playerNumber < 5; playerNumber++) {

        const player = getSettingObject(playerNumber);
        if (player != null) {
            players.push(player);
            clonePlayerNodeAndSetup(player.number);
        }
    }
    if (haveAllPlayersPlayedACard() == true) {
        enableNextTurnButton();
    } else {
        findCurrentPlayer();
    }

    createCardButtonsForHumanPlayer();
}

function findCurrentPlayer() {

    let player = getPlayerWithInitiative();

    if (player.hasPlayedACardThisTurn == false) {
        currentPlayer = player;
        enableDisablePlayCardButtons(player.number);
    } else {
        // Loop through all the players looking for the next player who hasn't played a card
        for (let playerNumber = player.number; playerNumber < players.length + 1; playerNumber++) {
            player = players[playerNumber];
            if (playerNumber > players.length - 1) {
                playerNumber = -1
            } else {
                if (player.hasPlayedACardThisTurn == false) {
                    currentPlayer = player;
                    enableDisablePlayCardButtons(player.number);
                    return;
                }
            }
        }
    }
}

function loadPlayedCardList() {
    const cardlist = getSettingObject('playedCardList');

    if (cardlist != null) {
        cardlist.forEach(card => {
            addPlayedCardToList(card, card.playedAction, false);
        })
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

        clonePlayerNodeAndSetup(playerNumber);
    }
}

function clonePlayerNodeAndSetup(playerNumber) {
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

    const playcardbutton = playertemplate.querySelector('#playcard');
    playcardbutton.id = "playcard" + playerNumber.toString();
    playcardbutton.disabled = true;

    if (playerNumber == 1) {
        playcardbutton.classList.add("d-none");
        playerPanel.classList.remove("collapse");

        const actiondiv = document.createElement("div");
        actiondiv.classList.add("row", "mt-3");
        //actiondiv.id = "actionbuttons";
        actiondiv.innerHTML = "Actions:"

        const actionbuttons = document.createElement("div");
        //actionbuttons.classList.add("d-none");
        actionbuttons.classList.add("btn-group", "d-none");
        actionbuttons.id = "actionbuttons";
        //actionbuttons.role = "group";

        createRadioButtons("LEAD", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("DECLARE", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("SURPASS", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("COPY", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("PIVOT", actionbuttons, "actiontype", "btn-light");

        actiondiv.appendChild(actionbuttons);
        playerPanel.appendChild(actiondiv);
    }

    if (playerNumber != 1) { hand.classList.add("d-none") }

    document.getElementById("playerslots").appendChild(playertemplate);
}

function createRadioButtons(btntext, group, groupname, btnstyle) {
    let input = document.createElement("input");
    input.type = "radio";
    input.classList.add("btn-check");
    input.name = groupname;
    input.id = btntext;
    input.autocomplete = "off";

    let l = document.createElement("label");
    l.classList.add("btn", btnstyle, "m-1");
    l.id = btntext;
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

function showHideActionButtons(isleading, card) {
    if (isleading) {
        showHideElement(document.querySelectorAll('#LEAD'), true);
        showHideElement(document.querySelectorAll('#DECLARE'), (declaredAmbitions.length < 3) ? true : false);
        showHideElement(document.querySelectorAll('#SURPASS'), false);
        showHideElement(document.querySelectorAll('#COPY'), false);
        showHideElement(document.querySelectorAll('#PIVOT'), false);
        return;
    }

    const aiPlayedLeadCard = playedCardList[0];

    // Not leading so cannot Lead or Declare
    showHideElement(document.querySelectorAll('#LEAD'), false);
    showHideElement(document.querySelectorAll('#DECLARE'), false);

    if (card.name == aiPlayedLeadCard.name) {
        if (card.number > aiPlayedLeadCard.number) {
            // Played the same suit and the number is higher so can Surpass
            showHideElement(document.querySelectorAll('#SURPASS'), true);
            showHideElement(document.querySelectorAll('#COPY'), false);
            showHideElement(document.querySelectorAll('#PIVOT'), false);
        } else {
            // card is the same suit but not higher so can only COPY
            showHideElement(document.querySelectorAll('#SURPASS'), false);
            showHideElement(document.querySelectorAll('#COPY'), true);
            showHideElement(document.querySelectorAll('#PIVOT'), false);
        }
    } else {
        // played a different suit so can Copy or Pivot
        showHideElement(document.querySelectorAll('#SURPASS'), false);
        showHideElement(document.querySelectorAll('#COPY'), true);
        showHideElement(document.querySelectorAll('#PIVOT'), true);
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

    initiativeClaimed = false;

    turnNumber += 1;
    setElementValue("turnNumber", turnNumber.toString());

    resetPlayedThisTurn();

    resetPlayedCardList();

    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayCardButtons(currentPlayer.number);

    SaveAllSettings();
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

    turnNumber = 1;
    roundNumber += 1;

    resetRound();

    resetPlayersHands();

    dealCards();

    SaveAllSettings();
}

function resetRound() {
    initiativeClaimed = false;

    resetPlayedCardList();

    declaredAmbitions = [];

    setElementValue("turnNumber", turnNumber.toString());
    setElementValue("roundNumber", roundNumber.toString());
    setElementValue("declaredAmbitions", 0);

    enableDisableButton("nextRound", true);

    currentactioncards = structuredClone(actioncards);

    resetDeck(currentactioncards);

    resetPlayedThisTurn();

    resetHandsAndPlayedCardsDisplay();

    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayCardButtons(currentPlayer.number);
}

function resetPlayedCardList() {
    playedCardList = [];
    removeChildElements("playedcards");
    RemoveSettingByKey("playedCardList");
}

function resetPlayersHands() {
    players.forEach(player => {
        player.cards = [];
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

function humanSelectedAction(action) {

    const player = players[0];

    const btnSelected = document.querySelector('input.p1:checked');

    const playedCard = getCardByNameAndNumber(player.cards, btnSelected.id, false);

    if (player.hasInitiative) {
        playCard(player, playedCard, action, false);
        showHideElement(document.querySelectorAll("#actionbuttons"), false);

    } else {

        addPlayedCardToList(playedCard, action, false, player);
        player.hasPlayedACardThisTurn = true;

        if (playedCardList.length == 1) {
            // Human players card was added but list only have one entry
            // AI hasn't played a card because, while it has inititive,
            // it has no cards left to play because it has claimed at some point
            checkInitiative(player, playedCard, false);
        } else {
            const aiPlayedLeadCard = playedCardList[0];

            if (isPlayedCardSameSuitAndHigher(playedCard, aiPlayedLeadCard)) {
                checkInitiative(player, playedCard, false);
            }
        }

        changeCurrentPlayer(player);

        showHideElement(document.querySelectorAll("#actionbuttons"), false);

        if (haveAllPlayersPlayedACard()) {
            enableNextTurnButton();
        }
    }

    SaveAllSettings();
}

function isPlayedCardSameSuitAndHigher(playedCard, aiPlayedLeadCard) {
    return (aiPlayedLeadCard.name == playedCard.name && aiPlayedLeadCard.number < playedCard.number) ? true : false;
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
    while (players[players.length - 1].cards.length < 5)

    createCardButtonsForHumanPlayer();
}

function createCardButtonsForHumanPlayer() {
    const player = players[0];

    const playerhandDiv = document.getElementById("playerhand1");

    player.cards.forEach(card => {

        let btn = createRadioButtons(getCardFullName(card), playerhandDiv, "cards", "btn-dark");

        btn.classList.add("p1");
        btn.value = card.number;

        if (card.played) { btn.disabled = true; }

        btn.onclick = function () {
            showHideElement(document.querySelectorAll("#actionbuttons"), true);

            if (player.hasInitiative) {
                showHideActionButtons(true, null);
            } else {
                const playedCard = getCardByNameAndNumber(player.cards, btn.id, false);
                showHideActionButtons(false, playedCard);
            }
        };

    });
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

function playCard(player, playedCard, action, notify) {
    // Can SURPASS = play card
    // Can't SURPASS
    //  - 1 - COPY
    //  - 2 - claim
    //  - 3 - PIVOT

    addPlayedCardToList(playedCard, action, false, player);
    player.hasPlayedACardThisTurn = true;

    if (player.hasInitiative) {
        if (player.isHuman && action == "DECLARE") {
            alert("Player declared ambition: " + playedCard.ambition);
            playedCard.number = 0;

            // Reset the played card list and re-add the declared card
            // with a value of 0
            addPlayedCardToList(playedCard, "LEAD", true, player);

            declaredAmbitions.push(playedCard.ambition);
            setElementValue("declaredAmbitions", declaredAmbitions.length);
        } else {
            // AI player will determine whether to declare or not
            declareAmbition(player, playedCard);
        }
        changeCurrentPlayer(player);
    }

    if (player.isHuman && haveAllPlayersPlayedACard()) {
        enableNextTurnButton();
        //nextTurn();
    }

    SaveAllSettings();
}

function haveAllPlayersPlayedACard() {
    for (let playerNumber = 0; playerNumber < players.length; playerNumber++) {
        if (players[playerNumber].hasPlayedACardThisTurn == false) { return false; }
    }
    return true;
}

function changeCurrentPlayer(player) {
    let playerNumber = player.number + 1;

    if (playerNumber > players.length) {
        // This is the human player
        currentPlayer = players[0];
        enableDisablePlayCardButtons(1);
    } else {
        currentPlayer = players[playerNumber - 1];
        // NOT SURE THIS IS REQUURED ANYMORE
        enableDisablePlayCardButtons(playerNumber);
    }
}

function determineCardToPlay(player) {

    if (player.hasPlayedACardThisTurn == false) {
        let unplayedCards = getUnplayedCards(player.cards);
        let initiativeClaimedThisTurn = false;

        findFocus(player, unplayedCards);
        /*
        if (unplayedCards.length > 0) {
            if (player.hasInitiative) {
                playCard(player, unplayedCards[0], "LEAD", true);
            } else {
                if (canSurpass(player, playedCardList[0], unplayedCards) == false) {

                    // Cannot SURPASS and therefore must find focus

                    if (initiativeClaimed == false) {
                        initiativeClaimedThisTurn = claim(player)
                    }

                    if (initiativeClaimedThisTurn == false) {
                        if (canCopy(player, playedCardList[0], unplayedCards) == false) {
                            pivot(player, unplayedCards);
                        }
                    }
                }
            }
        }
            */

        /*
        if (haveAllPlayersPlayedACard()) {
            enableNextTurnButton();
        } else {
            changeCurrentPlayer(player);
        }
            */
    }

    //SaveAllSettings();
}

function findFocus(player, unplayedCards) {
    // LOGIC:
    // - Chase ambition
    // - Build for future turn
    // - random

    let possibleActions = "";

    unplayedCards.forEach(card => {
        possibleActions += card.actions;
    })

    if (declaredAmbitions.length > 0) {
        // TODO Need to determine which ambition is best to chase
        // - Have cards to chase?
        // - Have pieces to chase?
        // - Worth most points?

        for (let index = 0; index < declaredAmbitions.length; index++) {
            const ambition = declaredAmbitions[index];
            switch (ambition) {
                case "tycoon":
                    // materials and fuel
                    // tax or steal or secure
                    // Q: Can I tax a city for weapons or fuel?
                    // Q: Is there a materials or fuel card in the market?
                    // Q: Can I raid a city for materials or fuel?
                    if (possibleActions.includes("tax")) {
                        focus_tycoon(1);
                        break;
                    }

                    if (possibleActions.includes("secure")) {
                        focus_tycoon(2);
                        break;
                    }

                    if (possibleActions.includes("battle")) {
                        focus_tycoon(3);
                        break;
                    }
                    break;

                case "tyrant":
                    // capture
                    // tax rival city or ransack or secure
                    // Q: Can I tax a rival city to capture?
                    // Q: Is there a card in the market with rival agents that I can secure?
                    // Q: Can I destroy a city to ransack the court?                    
                    break;

                case "warlord":
                    // fight
                    // battle or secure
                    // Q: Can I fight?
                    // Q: Is there a weapons card in the market?
                    break;

                case "keeper":
                    // relics
                    // tax or steal or secure
                    // Q: Can I tax a city for a relic?
                    // Q: Is there a relic card in the market?
                    // Q: Can I raid a city for a relic?
                    break;

                case "empath":
                    // psionic
                    // tax or steal or secure
                    // Q: Can I tax a city for a psionic?
                    // Q: Is there a psionic card in the market?
                    // Q: Can I raid a city for a psionic?
                    break;

                default:
                    break;
            }
        }

        return;
    }

    if (player.hasInitiative) {
        playCard(player, unplayedCards[0], "LEAD", true);
    }
}

function focus_tycoon(questionNumber) {
    let modal = new bootstrap.Modal(document.getElementById("yesNo"));

    switch (questionNumber) {
        case 1:
            document.getElementById("yesNoMessage").innerHTML = "Can I tax a city for weapons or fuel?";
            break;

        case 2:
            document.getElementById("yesNoMessage").innerHTML = "Is there a materials or fuel card in the market?";
            break;

        case 3:
            document.getElementById("yesNoMessage").innerHTML = "Can I raid a city for materials or fuel?";
            break;

        default:
            break;
    }

    modal.show();
}

function answerYes() {
    const unplayedCards = getUnplayedCards(currentPlayer.cards);
    let cardsWithAction;
    let cardToPlay;
    let actionToPlay;

    const question = document.getElementById("yesNoMessage").innerHTML;
    switch (question) {
        case "Can I tax a city for weapons or fuel?":
            actionToPlay = "tax";
            break;

        case "Is there a materials or fuel card in the market?":
            actionToPlay = "secure";
            break;

        case "Can I raid a city for materials or fuel?":
            actionToPlay = "battle";
            break;
        default:
            break;
    }

    cardsWithAction = getCardsWithAction(unplayedCards, actionToPlay);
    cardToPlay = getHighestCard(cardsWithAction);

    let initiativeClaimedThisTurn;

    if (cardToPlay != null) {
        playCard(currentPlayer, cardToPlay, actionToPlay, false);
    } else {
        if (canSurpass(currentPlayer, playedCardList[0], unplayedCards) == false) {

            // Cannot SURPASS and therefore must find focus

            if (initiativeClaimed == false) {
                initiativeClaimedThisTurn = claim(currentPlayer)
            }

            if (initiativeClaimedThisTurn == false) {
                if (canCopy(currentPlayer, playedCardList[0], unplayedCards) == false) {
                    pivot(currentPlayer, unplayedCards);
                }
            }
        }
    }


    if (haveAllPlayersPlayedACard()) {
        enableNextTurnButton();
    } else {
        changeCurrentPlayer(currentPlayer);
    }


    SaveAllSettings();
}

function answerNo() {
    // TODO Need to check at this point if player has the right cards
    // to play the action, otherwise don't ask the question
    const question = document.getElementById("yesNoMessage").innerHTML;

    // Think here I need to split this into what ambition the player
    // is trying to focus on - maybe by having the ambition name on the
    // yes/no prompt
    // The have IF statements below that can trigger one after another
    // depending on whether the player has the right cards to ask the
    // correct question
    //
    // Case AMBITION
    // If question and has card with action
    // else next question and has card with action
    // else check for next ambition??
    // else just play a random card

    switch (question) {
        case "Can I tax a city for weapons or fuel?":
            // Need to check for secure cards here
            focus_tycoon(2);
            break;

        case "Is there a materials or fuel card in the market?":
            // Need to check for battle cards here
            focus_tycoon(3);
            break;

        case "Can I raid a city for materials or fuel?":
            // TODO Player does not have the cards to focus on tycoon
            break;

        default:
            break;
    }
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
    if (turnNumber < 5) {
        enableDisableButton("nextTurn", false);
    } else {
        enableDisableButton("nextRound", false);
    }
    hidePlayerPanels();
}

function declareAmbition(player, playedCard) {
    if (declaredAmbitions == 3) {
        return;
    }

    let unplayedCards = getUnplayedCards(player.cards);
    let numberOfUnplayedCards = unplayedCards.length + 5;

    let num = Math.floor(Math.random() * 10);

    if (num > numberOfUnplayedCards) {
        alert("Player declared ambition: " + playedCard.ambition);
        playedCard.number = 0;

        addPlayedCardToList(playedCard, "LEAD", true, player);

        declaredAmbitions.push(playedCard.ambition);
        setElementValue("declaredAmbitions", declaredAmbitions.length);
    }
}

function canSurpass(player, playedCard, unplayedCards) {
    let surpass = false;

    let surpassCards = [];

    unplayedCards.forEach(card => {
        if (playedCard.name == card.name && playedCard.number < card.number) {
            surpassCards.push(card);
        }
    })

    if (surpassCards.length == 0) {
        return surpass;
    }

    let cardToPlay = getLowestCardtoPlay(surpassCards);

    playCard(player, cardToPlay, "SURPASS", true);
    surpass = true;
    checkInitiative(player, cardToPlay, false);

    return surpass;
}

function canCopy(player, playedCard, unplayedCards) {
    let copyCards = [];
    let canCopy = false;

    unplayedCards.forEach(card => {
        if (playedCard.name == card.name) {
            copyCards.push(card);
        }
    })

    if (copyCards.length == 0) {
        // no card to COPY with
        return canCopy;
    }

    let cardToPlay = getLowestCardtoPlay(copyCards);

    playCard(player, cardToPlay, "COPY", true);
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

function claim(player) {
    // Logic;
    //  claim needs to be based on a calc between: number of cards in hand, number of ambitions played, .... other things
    //  at the start of the game the calc needs to rarely succeed

    let initiativeClaimedThisTurn = false;

    let unplayedCards = getUnplayedCards(player.cards);

    // For the moment, just do a random calc and selection
    let num = Math.floor(Math.random() * 10);
    //num = 9;
    if (num > 9 && unplayedCards.length > 2) {
        //if (unplayedCards.length > 2) {
        // ai has to have more than 2 cards to claim otherwise won't have any cards to play in the next round
        playCard(player, unplayedCards[0], "CLAIM", true);
        playCard(player, unplayedCards[1], "CLAIM*", false);

        initiativeClaimed = true;
        initiativeClaimedThisTurn = true;
        checkInitiative(player, unplayedCards[0], true);
    }

    return initiativeClaimedThisTurn;
}

function checkInitiative(claimingPlayer, playedCard, hasClaimed) {
    if (initiativeClaimed == true) { return; }

    players.forEach(player => {
        if (player.number != claimingPlayer.number) { return; }

        if (hasClaimed) {
            player.hasInitiative = true;
            setElementValue("initiative", "Player " + player.number.toString());
        } else {
            let playedHighestCard = false;

            for (let cardNumber = 0; cardNumber < playedCardList.length; cardNumber++) {
                const card = playedCardList[cardNumber];

                if (playedCard.name == card.name) {
                    if (playedCard.number > card.number) {
                        playedHighestCard = true;
                    } else {
                        if (playedCard.number < card.number) {
                            playedHighestCard = false;
                        }
                    }
                }
            }

            if (playedHighestCard) {
                changeInitiative(player);
                setElementValue("initiative", "Player " + player.number.toString());
            }
        }

    })
}

function changeInitiative(player) {
    players.forEach(p => {
        p.hasInitiative = (p.number == player.number) ? true : false;
    })
}

function pivot(player, cards) {
    // Logic;
    //  - Needs to know what current goal is
    //      - has ambition been set?
    //          - yes: chase
    //      - no: which card to play?
    //          - need to know how many ships are in play
    //          - how many buildings are in play
    if (cards.length > 0) { playCard(player, cards[0], "PIVOT", true) }
}

function enableDisablePlayCardButtons(playerNumber) {
    players.forEach(player => {
        let btn = document.querySelector("#playcard" + player.number);
        btn.disabled = (player.number == playerNumber) ? false : true;

        showHidePlayerPanel(player, playerNumber);

        if (player.isHuman) { enableDisableButtonsByPlayerNumber(player.number, (player.number == playerNumber) ? true : false) }
    })
}

function showHidePlayerPanel(player, playerNumber) {
    let playerPanel = document.querySelector('#playerpanel' + player.number);
    if (player.number == playerNumber) {
        playerPanel.classList.remove("collapse");
    } else {
        playerPanel.classList.add("collapse");
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


function addPlayedCardToList(card, action, reset, player) {
    if (card != null) {
        card.played = true;

        // TODO The below two IF statements are horrid. Need a better way to do this
        if (card.playedAction == '') { card.playedAction = action };
        if (card.playedByPlayerNumber == 0) { card.playedByPlayerNumber = player.number };

        if (playedCardList.length == 0) {
            let turnListDiv = document.getElementById("playedcards");

            let turnDiv = document.createElement("div");
            turnDiv.classList.add("row", "justify-content-md-center", "mt-4", "fw-bold");
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
        cardDiv.classList.add("row", "justify-content-md-center", "fw-normal", "playercard" + card.playedByPlayerNumber);
        // If player COPIED, replace the suit played with XXXX 
        cardDiv.innerHTML = action.toUpperCase() + ": " + ((action == "COPY") ? "XXXX" : getCardFullName(card)) + getNumberOfPips(card, action);
        cardListDiv.append(cardDiv);

        saveSettingObject('playedCardList', playedCardList);
    }
}

function getNumberOfPips(card, action) {
    let pips = "  &#9733;";

    // Only add extra pips if the action is...
    if (action == "SURPASS" | action == "LEAD" | action == "PLAYER") {
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
    //saveAmbitions();
    saveSettingObject('ambitions', declaredAmbitions);
    SaveSetting("turn", turnNumber);
    SaveSetting("round", roundNumber);
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
    let modal = new bootstrap.Modal(document.getElementById("yesNo"));
    document.getElementById("yesNoMessage").innerHTML = "Yo!";
    modal.show();
}

