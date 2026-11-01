// Cards: the Card class, the action card deck and helpers for finding and describing cards.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

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

function removePlayedCard(cards, cardFullName) {
    const index = cards.findIndex(card => getCardFullName(card) == cardFullName && card.played);
    if (index >= 0) { cards.splice(index, 1); }
}

function isPlayedCardSameSuitAndHigher(playedCard, aiPlayedLeadCard) {
    return (aiPlayedLeadCard.name == playedCard.name && getCardValue(aiPlayedLeadCard) < playedCard.number) ? true : false;
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
