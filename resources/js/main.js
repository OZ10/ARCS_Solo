//import { Card } from "../class/card";

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

document.addEventListener("DOMContentLoaded", () => {
    //currentactioncards = actioncards.slice();
});


function testbtn() {
    let playerNumber = 1;
    do {
        let num = Math.floor(Math.random() * currentactioncards.length);
        //alert(num);
        //alert(currentactioncards[num]);

        //const a = new Card("Construction", "2", "2");

        if (playerNumber == 1) {
            player1hand.push(currentactioncards[num]);
            currentactioncards.splice(num, 1);
            playerNumber = 2;
        }
        else {
            player2hand.push(currentactioncards[num]);
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
    while (player2hand.length < 5)
    //while (currentactioncards.length != 0)

    //alert(player1hand);
    //alert(player2hand);

    player1hand.forEach(card => {
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

            // Other player plays a card
            playcard(getCardByNameAndNumber(player1hand, btn.name, btn.value, false), player2hand);

        };
        document.getElementById("player1hand").append(btn);
        //player1btn.push(btn);
        btnlist.push(btn);
    })

    player2hand.forEach(card => {
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
        };
        document.getElementById("player2hand").append(btn);
        //player2btn.push(btn);
        btnlist.push(btn);
    })

    function getCardByNameAndNumber(hand, name, number, played)
    {
        let returnCard;
        hand.forEach(card => {
            if (card.name == name && card.number == number && card.played == played){
                //alert(card.name)
                returnCard = card;
            }
        })

        return returnCard;
    }

    function playcard(hand1card, hand2) {
        // Can surpass = play card
        // Can't surpass
        //  - 1 - copy
        //  - 2 - pivot
        //  - 3 - claim

        if (cansurpass(hand1card, hand2) == false){
            
            if (canCopy(hand1card, hand2) == false){

            }
        }
    }

    function cansurpass(hand1card, hand2) {
        let surpass = false;

        let surpassCards = [];
        
        hand2.forEach(hand2card => {
            if (hand2card.played == false && hand1card.name == hand2card.name && hand1card.number < hand2card.number){
                surpassCards.push(hand2card);
            }
        })

        if (surpassCards.length == 0){
            return surpass;
        }

        if (surpassCards.length > 1){
            getLowestCardtoPlay(surpassCards);

            aiPlayCard(lowestCard, "SURPASS");
            surpass = true;
        }else{
            aiPlayCard(surpassCards[0], "SURPASS");
            surpass = true;
        }

        return surpass;
    }

    function canCopy(hand1card, hand2){
        let copyCards = [];
        let canCopy = false;

            hand2.forEach(hand2card => {
                if (hand2card.played == false && hand1card.name == hand2card.name){
                    copyCards.push(hand2card);
                }
            })

            if (copyCards.length == 0){
                // no card to copy with
            }
    
            if (copyCards.length > 1){
                getLowestCardtoPlay(copyCards);
    
                aiPlayCard(lowestCard, "COPY");
                canCopy = true;
            }else{
                aiPlayCard(copyCards[0], "COPY");
                canCopy = true;
            }
    }

    function pivot(){
        // Logic;
        //  - Needs to know what current goal is
        //      - has ambition been set?
        //          - yes: chase
        //      - no: which card to play?
        //          - need to know how many ships are in play
        //          - how many buildings are in play
    }

    function getLowestCardtoPlay(cards){
        // Find the lowest number card to play
        let lowestCard;
        cards.forEach(card => {
            if (lowestCard == null){
                lowestCard = card;
            }else{
                if (lowestCard.number > card.number){
                    lowestCard = card;
                }
            }
        })
    }

    function aiPlayCard(card, action){
        card.played = true;
        findButtonAndDisable("p2", card);
        alert("AI played card " + card.getFullName() + " to " + action);
    }

    function findButtonAndDisable(playerNumber, card){
        document.querySelectorAll("." + playerNumber).forEach((btn) => {
            if (btn.innerHTML == card.name + card.number){
                btn.disabled = true;
            }
        })
    }
}