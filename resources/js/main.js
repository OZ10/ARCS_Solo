//import { Card } from "../class/card";

class player {
    constructor(number) {
        this.number = number;
    }

    cards = [];
    hasInitiative = false;
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

const players = [];

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

const currentactioncards = actioncards.slice();

const player1hand = [];
const player2hand = [];
const player1btn = [];
const player2btn = [];
const btnlist = [];
let playedCardList = [];
let initiativeClaimed = false;
let roundNumber = 1;

document.addEventListener("DOMContentLoaded", () => {
    //currentactioncards = actioncards.slice();
});

function nextTurn() {
    initiativeClaimed = false;
    playedCardList = [];
    roundNumber += 1;
    document.getElementById("roundNumber").innerHTML = roundNumber.toString();
}

function testbtn() {

    let player1 = new player(1);
    player1.hasInitiative = true;

    let player2 = new player(2);

    players.push(player1);
    players.push(player2);

    let playerNumber = 1;
    do {
        let num = Math.floor(Math.random() * currentactioncards.length);
        //alert(num);
        //alert(currentactioncards[num]);

        //const a = new Card("Construction", "2", "2");

        if (playerNumber == 1) {
            player1.cards.push(currentactioncards[num]);
            currentactioncards.splice(num, 1);
            playerNumber = 2;
        }
        else {
            player2.cards.push(currentactioncards[num]);
            currentactioncards.splice(num, 1);
            playerNumber = 1;
        }
        /*actioncards.forEach(card => {
            if (card.(num)) {
                alert(card);
            }
        });
        */
    }
    while (player2.cards.length < 5)
    //while (currentactioncards.length != 0)

    //alert(player1hand);
    //alert(player2hand);

    player1.cards.forEach(card => {
        //let btn = document.createElement("input");
        //btn.type = "checkbox"
        //btn.title = card;
        let btn = document.createElement("button");
        btn.innerHTML = card.name + card.number;
        btn.className = "p1";
        btn.name = card.name;
        btn.value = card.number;
        btn.onclick = function () {
            // Card has been clicked, therefore played, and will be disabled
            btn.disabled = true;

            if (player1.hasInitiative) {
                // Other player plays a card
                playcard(getCardByNameAndNumber(player1.cards, btn.name, btn.value, false), player2);
                nextTurn();
            } else {
                let aiPlayedCard = playedCardList[0];
                let playedCard = getCardByNameAndNumber(player1.cards, btn.name, btn.value, false);
                addPlayedCardToList(playedCard);
                if (aiPlayedCard.name == playedCard.name && aiPlayedCard.number < playedCard.number) {
                    changeInitiative(getPlayer(1));
                }
                nextTurn();
            }

        };
        document.getElementById("player1hand").append(btn);
        //player1btn.push(btn);
        btnlist.push(btn);
    })

    player2.cards.forEach(card => {
        //let btn = document.createElement("input");
        //btn.type = "checkbox"
        //btn.title = card;
        let btn = document.createElement("button");
        btn.innerHTML = card.name + card.number;
        btn.className = "p2";
        btn.name = card.name;
        btn.value = card.number;
        btn.onclick = function () {
            btn.disabled = true;
            aiPlayCard(getCardByNameAndNumber(player2.cards, btn.name, btn.value, false), "LEAD", true);

            enableDisableButtonsByPlayerNumber(2, false);
            enableDisableButtonsByPlayerNumber(1, true);
        };
        document.getElementById("player2hand").append(btn);
        //player2btn.push(btn);
        btnlist.push(btn);
    })

    enableDisableButtonsByPlayerNumber(2, false);
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

function playcard(hand1card, player2) {
    // Can surpass = play card
    // Can't surpass
    //  - 1 - copy
    //  - 2 - claim
    //  - 3 - pivot

    hand1card.played = true;
    addPlayedCardToList(hand1card);

    let unplayedCards = getUnplayedCards(player2.cards);
    let initiativeClaimedThisTurn = false;

    if (cansurpass(hand1card, unplayedCards) == false) {

        if (initiativeClaimed == false) {
            initiativeClaimedThisTurn = claim(player2)
        }

        if (initiativeClaimedThisTurn == false) {
            if (canCopy(hand1card, unplayedCards) == false) {
                pivot(unplayedCards);
            }
        }
    }
}

function cansurpass(hand1card, hand2) {
    let surpass = false;

    let surpassCards = [];

    hand2.forEach(hand2card => {
        if (hand1card.name == hand2card.name && hand1card.number < hand2card.number) {
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

    aiPlayCard(cardToPlay, "SURPASS", true);
    surpass = true;
    changeInitiative(getPlayer(2));

    return surpass;
}

function canCopy(hand1card, hand2) {
    let copyCards = [];
    let canCopy = false;

    hand2.forEach(hand2card => {
        if (hand1card.name == hand2card.name) {
            copyCards.push(hand2card);
        }
    })

    if (copyCards.length == 0) {
        // no card to copy with
        return canCopy;
    }

    let cardToPlay;

    if (surpassCards.length > 1) {
        cardToPlay = getLowestCardtoPlay(surpassCards);
    } else {
        cardToPlay = surpassCards[0];
    }

    aiPlayCard(cardToPlay, "COPY", true);
    canCopy = true;

    return canCopy;
}

function claim(player2) {
    // Logic;
    //  claim needs to be based on a calc between: number of cards in hand, number of ambitions played, .... other things
    //  at the start of the game the calc needs to rarely succeed

    let initiativeClaimedThisTurn = false;

    let unplayedCards = getUnplayedCards(player2);

    // For the moment, just do a random calc and selection
    let num = Math.floor(Math.random() * 10);
    //if (num > 8 && hand2.length > 2){
    if (unplayedCards.length > 2) {
        // ai has to have more than 2 cards to claim otherwise won't have any cards to play in the next round
        aiPlayCard(unplayedCards[0], "CLAIM", true);
        aiPlayCard(unplayedCards[1], "CLAIM", false);

        initiativeClaimed = true;
        initiativeClaimedThisTurn = true;
        changeInitiative(player2);
    }

    return initiativeClaimedThisTurn;
}

function changeInitiative(claimingPlayer) {
    players.forEach(player => {
        if (player.number == claimingPlayer.number) {
            player.hasInitiative = true;
            document.getElementById("initiative").innerHTML = "Player " + player.number.toString();
            enableDisableButtonsByPlayerNumber(player.number, true);
        } else {
            player.hasInitiative = false;
            enableDisableButtonsByPlayerNumber(player.number, false);
        }
    })
}

function pivot(cards) {
    // Logic;
    //  - Needs to know what current goal is
    //      - has ambition been set?
    //          - yes: chase
    //      - no: which card to play?
    //          - need to know how many ships are in play
    //          - how many buildings are in play
    if (cards.length > 0) { aiPlayCard(cards[0], "PIVOT", true) }
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

function aiPlayCard(card, action, notify) {
    card.played = true;
    findButtonAndDisable("p2", card);
    addPlayedCardToList(card);
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


function addPlayedCardToList(card) {
    playedCardList.push(card);
    let cardListDiv = document.getElementById("playedcards");
    let cardDiv = document.createElement("div");
    cardDiv.innerHTML = card.getFullName();
    cardListDiv.append(cardDiv);
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
