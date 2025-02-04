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
    constructor(name, number, pips, played, ambition) {
        this.name = name;
        this.number = number;
        this.pips = pips;
        this.played = played;
        this.ambition = ambition;
    }
}

function getCardFullName(card) {
    return card.name + card.number;
}

let players = [];

const actioncards = [
    //new Card("Construction", 1, 4, false, "null"),
    new Card("Construction", 2, 4, false, "tycoon"),
    new Card("Construction", 3, 3, false, "tyrant"),
    new Card("Construction", 4, 3, false, "warlord"),
    new Card("Construction", 5, 2, false, "keeper"),
    new Card("Construction", 6, 2, false, "empath"),
    //new Card("Construction", 7, 1, false, "anything"),
    //new Card("Aggression", 1, 3, false, "null"),
    new Card("Aggression", 2, 3, false, "tycoon"),
    new Card("Aggression", 3, 2, false, "tyrant"),
    new Card("Aggression", 4, 2, false, "warlord"),
    new Card("Aggression", 5, 2, false, "keeper"),
    new Card("Aggression", 6, 2, false, "empath"),
    //new Card("Aggression", 7, 1, false, "anything"),
    //new Card("Administration", 1, 4, false, "null"),
    new Card("Administration", 2, 4, false, "tycoon"),
    new Card("Administration", 3, 3, false, "tyrant"),
    new Card("Administration", 4, 3, false, "warlord"),
    new Card("Administration", 5, 3, false, "keeper"),
    new Card("Administration", 6, 2, false, "empath"),
    //new Card("Administration", 7, 1, false, "anything"),
    //new Card("Mobilisation", 1, 4, false, "null"),
    new Card("Mobilisation", 2, 4, false, "tycoon"),
    new Card("Mobilisation", 3, 3, false, "tyrant"),
    new Card("Mobilisation", 4, 3, false, "warlord"),
    new Card("Mobilisation", 5, 2, false, "keeper"),
    new Card("Mobilisation", 6, 2, false, "empath"),
    //new Card("Mobilisation", 7, 1, false, "anything"),
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

});

function setupGame(numberOfPlayers) {

    players = [];
    turnNumber = 1;
    roundNumber = 1;
    declaredAmbitions = [];

    createPlayers(numberOfPlayers);

    resetRound();

    dealCards();
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

function showHideElement(elements, show) {
    elements.forEach(element => {
        (show) ? element.classList.remove("d-none") : element.classList.add("d-none");
    })
}

function playcardclick() {
    // This is the AI playing a card
    determineCardToPlay(currentPlayer);
}

function resetRound() {
    initiativeClaimed = false;
    playedCardList = [];
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

function setElementValue(elementid, value) {
    document.getElementById(elementid).innerHTML = value;
}

function resetHandsAndPlayedCardsDisplay() {
    players.forEach(p => {
        document.getElementById("playerhand" + p.number).replaceChildren();
    });

    document.getElementById("playedcards").replaceChildren();
}

function nextTurn() {

    if (haveAllCardsBeenPlayed()) {
        enableDisableButton("nextRound", false);
        hidePlayerPanels();
        return;
    }

    initiativeClaimed = false;
    playedCardList = [];
    turnNumber += 1;
    setElementValue("turnNumber", turnNumber.toString());

    resetPlayedThisTurn();

    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayCardButtons(currentPlayer.number);
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

    // If human player does not have initiative, find player who does and play a card
    if (players[0].hasInitiative == false) {

        currentPlayer = getPlayerWithInitiative();

        enableDisablePlayCardButtons(currentPlayer.number);
    }
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


        addPlayedCardToList(playedCard, action, false);
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

        if (allPlayersHavePlayedACard()) {
            nextTurn();
        }
    }
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

    addPlayedCardToList(playedCard, action, false);
    player.hasPlayedACardThisTurn = true;

    if (player.hasInitiative) {
        if (player.isHuman && action == "DECLARE") {
            alert("Player declared ambition: " + playedCard.ambition);
            playedCard.number = 0;

            // Reset the played card list and re-add the declared card
            // with a value of 0
            addPlayedCardToList(playedCard, "LEAD", true);

            declaredAmbitions.push(playedCard.ambition);
            setElementValue("declaredAmbitions", declaredAmbitions.length);
        } else {
            // AI player will determine whether to declare or not
            declareAmbition(player, playedCard);
        }
        changeCurrentPlayer(player);
    }

    if (player.isHuman && allPlayersHavePlayedACard()) {
        nextTurn();
    }
}

function allPlayersHavePlayedACard() {
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

        if (allPlayersHavePlayedACard()) {
            nextTurn();
        } else {
            changeCurrentPlayer(player);
        }
    }
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

        addPlayedCardToList(playedCard, "LEAD", true);

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

function checkInitiative_old(claimingPlayer, playedCard, hasClaimed) {
    if (initiativeClaimed == true) { return; }

    players.forEach(player => {
        if (player.number == claimingPlayer.number) {
            if (hasClaimed) {
                player.hasInitiative = true;
                document.getElementById("initiative").innerHTML = "Player " + player.number.toString();
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
                    document.getElementById("initiative").innerHTML = "Player " + player.number.toString();
                }
            }
        }
    })
}

function changeInitiative(player) {
    players.forEach(p => {
        p.hasInitiative = (p.number == player.number) ? true : false;
    })
}

function enableDisableButton(buttonName, isDisabled) {
    document.getElementById(buttonName).disabled = isDisabled;
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


function addPlayedCardToList(card, action, reset) {
    if (card != null) {
        card.played = true;

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
        cardDiv.classList.add("row", "justify-content-md-center", "fw-normal", "playercard" + currentPlayer.number);
        // If player COPIED, replace the suit played with XXXX 
        cardDiv.innerHTML = action.toUpperCase() + ": " + ((action == "COPY") ? "XXXX" : getCardFullName(card)) + getNumberOfPips(card, action); // " &#9733;";
        cardListDiv.append(cardDiv);
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
