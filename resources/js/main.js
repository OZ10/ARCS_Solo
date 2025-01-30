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
    new Card("Construction", 2, 4, false, "tycoon"),
    new Card("Construction", 3, 3, false, "tyrant"),
    new Card("Construction", 4, 3, false, "warlord"),
    new Card("Construction", 5, 2, false, "keeper"),
    new Card("Construction", 6, 2, false, "empath"),
    new Card("Aggression", 2, 3, false, "tycoon"),
    new Card("Aggression", 3, 2, false, "tyrant"),
    new Card("Aggression", 4, 2, false, "warlord"),
    new Card("Aggression", 5, 2, false, "keeper"),
    new Card("Aggression", 6, 2, false, "empath"),
    new Card("Administration", 2, 4, false, "tycoon"),
    new Card("Administration", 3, 3, false, "tyrant"),
    new Card("Administration", 4, 3, false, "warlord"),
    new Card("Administration", 5, 3, false, "keeper"),
    new Card("Administration", 6, 2, false, "empath"),
    new Card("Mobilisation", 2, 4, false, "tycoon"),
    new Card("Mobilisation", 3, 3, false, "tyrant"),
    new Card("Mobilisation", 4, 3, false, "warlord"),
    new Card("Mobilisation", 5, 2, false, "keeper"),
    new Card("Mobilisation", 6, 2, false, "empath"),
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
let declaredAmbitions = 0;
let currentPlayer;

document.addEventListener("DOMContentLoaded", () => {
    //currentactioncards = actioncards.slice();
});

function setupGame(numberOfPlayers) {

    players = [];
    turnNumber = 1;
    roundNumber = 1;
    declaredAmbitions = 0;

    createPlayers(numberOfPlayers);

    resetRound();

    dealCards();
}

function createPlayers(numberOfPlayers) {
    for (let playerNumber = 1; playerNumber < numberOfPlayers + 1; playerNumber++) {
        let p = new player(playerNumber, (playerNumber == 1) ? true : false);

        if (playerNumber == 1) {
            p.hasInitiative = true;
            currentPlayer = p;
        };

        players.push(p);

        clonePlayerNodeAndSetup(playerNumber);
    }
}

function playcardclick() {
    determineCardToPlay(currentPlayer);
}

function clonePlayerNodeAndSetup(playerNumber) {
    let clonenode = document.getElementById("playerTemplate").cloneNode(true);
    clonenode.id = "player" + playerNumber.toString();
    clonenode.classList.add("playerheader" + playerNumber.toString());
    clonenode.classList.remove("d-none");
    clonenode.querySelector('#' + "playernumber").innerHTML = "Player " + playerNumber.toString();

    let hand = clonenode.querySelector("#playerhand");
    hand.id = "playerhand" + playerNumber.toString();

    let a = clonenode.querySelector("#playerancor");
    a.id = "playerancor" + playerNumber.toString();
    a.dataset.bsTarget = "#playerpanel" + playerNumber.toString();

    let playerPanel = clonenode.querySelector('#playerpanel');
    playerPanel.id = "playerpanel" + playerNumber.toString();

    let playcardbutton = clonenode.querySelector('#playcard');
    playcardbutton.id = "playcard" + playerNumber.toString();
    playcardbutton.disabled = true;

    if (playerNumber == 1) {
        playcardbutton.classList.add("d-none");
        playerPanel.classList.remove("collapse");

        let togglebuttons = document.createElement("div");
        togglebuttons.classList.add("btn-group");
        togglebuttons.role = "group";

        createActionButtons("none", togglebuttons, false, true);
        createActionButtons("declare", togglebuttons, false, false);
        createActionButtons("copy", togglebuttons, true, false);

        playerPanel.appendChild(togglebuttons);
    }

    if (playerNumber != 1) { hand.classList.add("d-none") }

    document.getElementById("playerslots").appendChild(clonenode);
}

function createActionButtons(action, group, isenabled, isselected) {
    let input = document.createElement("input");
    input.type = "radio";
    input.classList.add("btn-check");
    input.name = "actiontype";
    input.id = "btn" + action;
    input.autocomplete = "off";
    input.checked = isselected;
    input.disabled = isenabled;

    let l = document.createElement("label");
    l.classList.add("btn", "btn-outline-secondary");
    l.htmlFor = "btn" + action;
    l.textContent = action.toUpperCase();

    group.appendChild(input);
    group.appendChild(l);
}

function enabledDisableActionButtons(action, isdisabled, isselected) {
    let input = document.querySelector("#btn" + action);
    input.checked = isselected;
    input.disabled = isdisabled;
}

function resetRound() {
    initiativeClaimed = false;
    playedCardList = [];
    declaredAmbitions = 0;

    document.getElementById("turnNumber").innerHTML = turnNumber.toString();
    document.getElementById("roundNumber").innerHTML = roundNumber.toString();

    enableDisableButton("nextRound", true);

    currentactioncards = structuredClone(actioncards); // actioncards.slice();
    resetDeck(currentactioncards);

    resetPlayedThisTurn();

    resetHandsAndPlayedCardsDisplay();

    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayCardButtons(currentPlayer.number);
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
        return;
    }

    initiativeClaimed = false;
    playedCardList = [];
    turnNumber += 1;
    document.getElementById("turnNumber").innerHTML = turnNumber.toString();

    resetPlayedThisTurn();

    currentPlayer = getPlayerWithInitiative();
    enableDisablePlayCardButtons(currentPlayer.number);

    if (currentPlayer.isHuman) {
        enabledDisableActionButtons("declare", false, false);
        enabledDisableActionButtons("copy", true, false);
    } else {
        enabledDisableActionButtons("declare", true, false);
        enabledDisableActionButtons("copy", false, false);
    }

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

    for (let playerNumber = 1; playerNumber < players.length + 1; playerNumber++) {
        const player = players[playerNumber - 1];

        player.cards.forEach(card => {
            let btn = document.createElement("button");
            btn.innerHTML = card.name + card.number;
            btn.className = "p" + playerNumber.toString();
            btn.classList.add("btn", "btn-secondary")
            btn.name = card.name;
            btn.value = card.number;
            btn.onclick = function () {
                // Card has been clicked, therefore played, and will be disabled
                btn.disabled = true;

                if (playerNumber == 1) {
                    let playedCard = getCardByNameAndNumber(player.cards, btn.name, btn.value, false);

                    if (player.hasInitiative) {
                        playCard(player, playedCard, "LEAD", false);
                        //nextTurn();
                    } else {
                        let aiPlayedLeadCard = playedCardList[0];

                        addPlayedCardToList(playedCard, "PLAYER", false);
                        player.hasPlayedACardThisTurn = true;

                        if (playedCardList.length == 1) {
                            // Human players card was added but list only have one entry
                            // AI hasn't played a card because, while it has inititive,
                            // it has no cards left to play because it has claimed at some point
                            checkInitiative(player, playedCard, false);
                        } else {

                            if (aiPlayedLeadCard.name == playedCard.name && aiPlayedLeadCard.number < playedCard.number) {
                                checkInitiative(player, playedCard, false);
                            }
                        }

                        changeCurrentPlayer(player);

                        if (allPlayersHavePlayedACard()) {
                            nextTurn();
                        }
                    }
                }
            };
            document.getElementById("playerhand" + playerNumber.toString()).append(btn);
        })
    }
}

function getCardByNameAndNumber(hand, name, number, played) {
    let returnCard;
    hand.forEach(card => {
        if (card.name == name && card.number == number && card.played == played) {
            //alert(card.name)
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
    // Can surpass = play card
    // Can't surpass
    //  - 1 - copy
    //  - 2 - claim
    //  - 3 - pivot

    addPlayedCardToList(playedCard, action, false);
    player.hasPlayedACardThisTurn = true;

    if (player.hasInitiative) {
        if (player.isHuman == false) {
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

                    // Cannot surpass and therefore must find focus

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

function otherPlayersPlayACard(player, playedCard, action, notify) {
    let playerNumber = player.number + 1;

    do {
        if (playerNumber > players.length) {
            playerNumber = 0;
        } else {
            player = players[playerNumber - 1];

            if (player.hasPlayedACardThisTurn == false) {
                let unplayedCards = getUnplayedCards(player.cards);
                let initiativeClaimedThisTurn = false;

                if (unplayedCards.length > 0) {
                    if (canSurpass(player, playedCardList[0], unplayedCards) == false) {

                        // Cannot surpass and therefore must find focus

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
            playerNumber = player.number + 1;
        }
    } while (playerNumber != 0);
}

function declareAmbition(player, playedCard) {
    let unplayedCards = getUnplayedCards(player.cards);
    let numberOfUnplayedCards = unplayedCards.length + 5;

    let num = Math.floor(Math.random() * 10);

    if (num > numberOfUnplayedCards) {
        alert("Player declared ambition: " + playedCard.ambition);
        playedCard.number = 0;

        addPlayedCardToList(playedCard, "LEAD", true);

        declaredAmbitions += 1;
        document.getElementById("declaredAmbitions").innerHTML = declaredAmbitions;
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
        // no card to copy with
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
    if (initiativeClaimed == false) {
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

function findButtonAndDisable(playerNumber, card) {
    document.querySelectorAll(".p" + playerNumber).forEach((btn) => {
        if (btn.innerHTML == card.name + card.number) {
            btn.disabled = true;
        }
    })
}

function enableDisablePlayCardButtons(playerNumber) {
    players.forEach(player => {
        let btn = document.querySelector("#playcard" + player.number);
        btn.disabled = (player.number == playerNumber) ? false : true;

        let playerPanel = document.querySelector('#playerpanel' + player.number);
        if (player.number == playerNumber) {
            playerPanel.classList.remove("collapse");
        } else {
            playerPanel.classList.add("collapse");
        }

        if (player.isHuman) { enableDisableButtonsByPlayerNumber(player.number, (player.number == playerNumber) ? true : false) }
    })
}

function enableDisableButtonsByPlayerNumber(playerNumber, enable) {
    document.querySelectorAll(".p" + playerNumber.toString()).forEach((btn) => {
        if (enable) {
            let card = getCardByNameAndNumber(getPlayer(playerNumber).cards, btn.name, btn.value, false);
            if (card != null) {
                // Card is unplayed and button should be enabled
                btn.disabled = false;
            }
        } else {
            btn.disabled = true;
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
        for (let index = 0; index < card.pips; index++) {
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
