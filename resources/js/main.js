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
    constructor(name, number, pips, played) {
        this.name = name;
        this.number = number;
        this.pips = pips;
        this.played = played;
    }

    getFullName() {
        return this.name + this.number;
    }
}

let players = [];

const actioncards = [
    new Card("Construction", 2, 2, false),
    new Card("Construction", 3, 2, false),
    new Card("Construction", 4, 2, false),
    new Card("Construction", 5, 2, false),
    new Card("Construction", 6, 2, false),
    new Card("Aggression", 2, 2, false),
    new Card("Aggression", 3, 2, false),
    new Card("Aggression", 4, 2, false),
    new Card("Aggression", 5, 2, false),
    new Card("Aggression", 6, 2, false),
    new Card("Administration", 2, 2, false),
    new Card("Administration", 3, 2, false),
    new Card("Administration", 4, 2, false),
    new Card("Administration", 5, 2, false),
    new Card("Administration", 6, 2, false),
    new Card("Mobilisation", 2, 2, false),
    new Card("Mobilisation", 3, 2, false),
    new Card("Mobilisation", 4, 2, false),
    new Card("Mobilisation", 5, 2, false),
    new Card("Mobilisation", 6, 2, false),
];

let currentactioncards = actioncards.slice();

let playedCardList = [];
let initiativeClaimed = false;
let turnNumber = 1;
let roundNumber = 1;

document.addEventListener("DOMContentLoaded", () => {
    //currentactioncards = actioncards.slice();
});

function setupGame(numberOfPlayers) {

    players = [];

    for (let playerNumber = 1; playerNumber < numberOfPlayers + 1; playerNumber++) {
        let p = new player(playerNumber, (playerNumber == 1) ? true : false);

        if (playerNumber == 1) { p.hasInitiative = true };

        players.push(p);
    }

    turnNumber = 1;
    roundNumber = 1;

    resetRound();

    dealCards();
}

function resetRound() {
    initiativeClaimed = false;
    playedCardList = [];

    document.getElementById("turnNumber").innerHTML = turnNumber.toString();
    document.getElementById("roundNumber").innerHTML = roundNumber.toString();

    enableDisableButton("nextRound", true);

    currentactioncards = actioncards.slice();
    resetDeck(currentactioncards);

    resetPlayedThisTurn();

    document.getElementById("playerhand1").replaceChildren();
    document.getElementById("playerhand2").replaceChildren();
    document.getElementById("playerhand3").replaceChildren();
    document.getElementById("playerhand4").replaceChildren();
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

    let player = getPlayerWithInitiative();

    if (player.isHuman == false) {

        let unplayedCards = getUnplayedCards(player.cards);

        playCard(player, unplayedCards[0], "LEAD", true);

        player.hasPlayedACardThisTurn = true;

        //enableDisableButtonsByPlayerNumber(2, false);
        enableDisableButtonsByPlayerNumber(1, true);

        otherPlayersPlayACard(player, unplayedCards[0], "LEAD", true);
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
                    if (cansurpass(player, playedCard, unplayedCards) == false) {

                        if (initiativeClaimed == false) {
                            initiativeClaimedThisTurn = claim(player)
                        }

                        if (initiativeClaimedThisTurn == false) {
                            if (canCopy(player, playedCard, unplayedCards) == false) {
                                pivot(player, unplayedCards);
                            }
                        }
                    }
                }


                if (notify) { alert("AI played card " + playedCard.getFullName() + " to " + action) }
            }
            playerNumber = player.number + 1;
        }
    } while (playerNumber != 0);
}

function haveAllCardsBeenPlayed() {
    let allPlayed;

    players.forEach(player => {
        player.cards.forEach(card => {
            if (card.played == false) { allPlayed = false; return; }
        });
    });
    //if (allPlayed == false) {return false;}
    //return true;
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

    players.forEach(player => {
        player.cards = [];
    });

    dealCards();

    // If human player does not have initiative, find player who does and play a card
    if (players[0].hasInitiative == false) {

        let player = getPlayerWithInitiative();

        let unplayedCards = getUnplayedCards(player.cards);;
        playCard(player, unplayedCards[0], "LEAD", true);

        player.hasPlayedACardThisTurn = true;

        enableDisableButtonsByPlayerNumber(1, true);
    }
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
    let testing = false;

    //TODO These are hardcoded values!
    let player1 = players[0];
    let player2 = players[1];

    if (testing) {
        player1.cards.push(currentactioncards[15], currentactioncards[8], currentactioncards[3], currentactioncards[0], currentactioncards[1]);
        player2.cards.push(currentactioncards[7], currentactioncards[16], currentactioncards[17], currentactioncards[18], currentactioncards[11]);
    } else {
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
    }

    for (let playerNumber = 1; playerNumber < players.length + 1; playerNumber++) {
        const player = players[playerNumber - 1];

        player.cards.forEach(card => {
            let btn = document.createElement("button");
            btn.innerHTML = card.name + card.number;
            btn.className = "p" + playerNumber.toString();
            btn.name = card.name;
            btn.value = card.number;
            btn.onclick = function () {
                // Card has been clicked, therefore played, and will be disabled
                btn.disabled = true;

                if (playerNumber == 1) {
                    let playedCard = getCardByNameAndNumber(player.cards, btn.name, btn.value, false);

                    if (player.hasInitiative) {
                        playCard(player, playedCard, "LEAD", false);
                        nextTurn();
                    } else {
                        let aiPlayedLeadCard = playedCardList[0];

                        if (playedCardList.length == 0) {
                            // AI hasn't played a card because, while it has inititive,
                            // it has no cards left to play because it has claimed at some point
                            changeInitiative(player);
                        } else {
                            if (aiPlayedLeadCard.name == playedCard.name && aiPlayedLeadCard.number < playedCard.number) {
                                changeInitiative(player);
                            }
                        }
                        addPlayedCardToList(playedCard, "PLAYER");
                        otherPlayersPlayACard(player, playedCard, "PLAYER", true);
                        nextTurn();
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

    addPlayedCardToList(playedCard, action);
    player.hasPlayedACardThisTurn = true;

    if (player.hasInitiative) {
        otherPlayersPlayACard(player, playedCard, action, notify);
    }
}

function playcard_old2(playedCard) {
    // This function is only triggered by the human player clicking a button to LEAD
    // Can surpass = play card
    // Can't surpass
    //  - 1 - copy
    //  - 2 - claim
    //  - 3 - pivot

    addPlayedCardToList(playedCard, "LEAD");
    players[0].hasPlayedACardThisTurn = true;

    for (let playerNumber = 1; playerNumber < players.length; playerNumber++) {
        const player = players[playerNumber];

        let unplayedCards = getUnplayedCards(player.cards);
        let initiativeClaimedThisTurn = false;

        if (unplayedCards.length > 0) {
            if (cansurpass(player, playedCard, unplayedCards) == false) {

                if (initiativeClaimed == false) {
                    initiativeClaimedThisTurn = claim(player)
                }

                if (initiativeClaimedThisTurn == false) {
                    if (canCopy(player, playedCard, unplayedCards) == false) {
                        pivot(player, unplayedCards);
                    }
                }
            }
        }
    }
}

function playcard_old(playedCard, player2) {
    // Can surpass = play card
    // Can't surpass
    //  - 1 - copy
    //  - 2 - claim
    //  - 3 - pivot

    //playedCard.played = true;
    addPlayedCardToList(playedCard, "LEAD");

    let unplayedCards = getUnplayedCards(player2.cards);
    let initiativeClaimedThisTurn = false;

    if (unplayedCards.length > 0) {
        if (cansurpass(playedCard, unplayedCards) == false) {

            if (initiativeClaimed == false) {
                initiativeClaimedThisTurn = claim(player2)
            }

            if (initiativeClaimedThisTurn == false) {
                if (canCopy(playedCard, unplayedCards) == false) {
                    pivot(unplayedCards);
                }
            }
        }
    }
}

function cansurpass(player, playedCard, hand2) {
    let surpass = false;

    let surpassCards = [];

    hand2.forEach(hand2card => {
        if (playedCard.name == hand2card.name && playedCard.number < hand2card.number) {
            surpassCards.push(hand2card);
        }
    })

    if (surpassCards.length == 0) {
        return surpass;
    }

    let cardToPlay;

    if (surpassCards.length > 1) {
        cardToPlay = getLowestCardtoPlay(surpassCards);
    } else {
        cardToPlay = surpassCards[0];
    }

    //aiPlayCard(player, cardToPlay, "SURPASS", true);
    playCard(player, cardToPlay, "SURPASS", true);
    surpass = true;
    changeInitiative(player);

    return surpass;
}

function canCopy(player, playedCard, hand2) {
    let copyCards = [];
    let canCopy = false;

    hand2.forEach(hand2card => {
        if (playedCard.name == hand2card.name) {
            copyCards.push(hand2card);
        }
    })

    if (copyCards.length == 0) {
        // no card to copy with
        return canCopy;
    }

    let cardToPlay;

    if (copyCards.length > 1) {
        cardToPlay = getLowestCardtoPlay(copyCards);
    } else {
        cardToPlay = copyCards[0];
    }

    //aiPlayCard(player, cardToPlay, "COPY", true);
    playCard(player, cardToPlay, "COPY", true);
    canCopy = true;

    return canCopy;
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
    if (num > 8 && unplayedCards.length > 2) {
    //if (unplayedCards.length > 2) {
        // ai has to have more than 2 cards to claim otherwise won't have any cards to play in the next round
        //aiPlayCard(player, unplayedCards[0], "CLAIM", true);
        //aiPlayCard(player, unplayedCards[1], "CLAIM*", false);
        playCard(player, unplayedCards[0], "CLAIM", true);
        playCard(player, unplayedCards[1], "CLAIM*", false);

        initiativeClaimed = true;
        initiativeClaimedThisTurn = true;
        changeInitiative(player);
    }

    return initiativeClaimedThisTurn;
}

function changeInitiative(claimingPlayer) {
    players.forEach(player => {
        if (player.number == claimingPlayer.number) {
            player.hasInitiative = true;
            document.getElementById("initiative").innerHTML = "Player " + player.number.toString();
            //enableDisableButtonsByPlayerNumber(player.number, true);
        } else {
            player.hasInitiative = false;
            //enableDisableButtonsByPlayerNumber(player.number, false);
        }
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
    //if (cards.length > 0) { aiPlayCard(player, cards[0], "PIVOT", true) }
    if (cards.length > 0) { playCard(player, cards[0], "PIVOT", true) }
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

function aiPlayCard(player, card, action, notify) {

    player.hasPlayedACardThisTurn = true;
    //findButtonAndDisable("p2", card);
    addPlayedCardToList(card, action);
    if (notify) { alert("AI played card " + card.getFullName() + " to " + action) }
}

function aiPlayCard_old(card, action, notify) {
    //card.played = true;
    findButtonAndDisable("p2", card);
    addPlayedCardToList(card, action);
    if (notify) { alert("AI played card " + card.getFullName() + " to " + action) }
}

function findButtonAndDisable(playerNumber, card) {
    document.querySelectorAll(".p" + playerNumber).forEach((btn) => {
        if (btn.innerHTML == card.name + card.number) {
            btn.disabled = true;
        }
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


function addPlayedCardToList(card, action) {
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

        playedCardList.push(card);

        let cardListDiv = document.getElementById("Turn" + turnNumber.toString());
        let cardDiv = document.createElement("div");
        cardDiv.classList.add("row", "justify-content-md-center", "fw-normal");
        cardDiv.innerHTML = action.toUpperCase() + ": " + card.getFullName();
        cardListDiv.append(cardDiv);
    }
}

function getUnplayedCards(hand2) {
    let unplayedCards = [];
    hand2.forEach(card => {
        if (card.played == false) {
            unplayedCards.push(card);
        }
    });

    return unplayedCards;
}
