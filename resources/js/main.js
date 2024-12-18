//import { Card } from "../class/card";

class Card {
    constructor(name, number, pips, played) {
        this.name = name;
        this.number = number;
        this.pips = pips;
        this.played = played;
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

    alert(player1hand);
    //alert(player2hand);

    player1hand.forEach(card => {
        //let btn = document.createElement("input");
        //btn.type = "checkbox"
        //btn.title = card;
        let btn = document.createElement("button");
        btn.innerHTML = card.name + card.number;
        btn.name = card.name;
        btn.value = card.number;
        btn.onclick = function () {
            // Card has been clicked, therefore played, and will be disabled
            btn.disabled = true;

            // Other player plays a card
            playcard(btn, player2btn);

            /*player2btn.some(p2card => {
                if (btn.name == p2card.name && btn.value < p2card.value) {
                    p2card.disabled = true;
                    return btn.name == p2card.name;
                }
                /* if (btn.name == p2card.name){ // && card.number < p2card.number){
                    p2card.disabled = true;
                    return btn.name == p2card.name; 
                } 
            }) */
        };
        document.getElementById("player1hand").append(btn);
        player1btn.push(btn);
        btnlist.push(btn);
    })

    player2hand.forEach(card => {
        //let btn = document.createElement("input");
        //btn.type = "checkbox"
        //btn.title = card;
        let btn = document.createElement("button");
        btn.innerHTML = card.name + card.number;
        btn.name = card.name;
        btn.value = card.number;
        btn.onclick = function () {
            btn.disabled = true;
        };
        document.getElementById("player2hand").append(btn);
        player2btn.push(btn);
        btnlist.push(btn);
    })

    function playcard(hand1card, hand2) {
        alert(cansurpass(hand1card, hand2));

        // Can surpass = play card
        // Can't surpass
        //  - 1 - follow
        //  - 2 - copy
        //  - 3 - claim
    }

    function playcard_old(btnP1, btnP2) {
        alert(cansurpass(btnP1, btnP2));

        // Can surpass = play card
        // Can't surpass
        //  - 1 - follow
        //  - 2 - copy
        //  - 3 - claim
    }

    function cansurpass(hand1card, hand2) {
        let surpass = false;
        hand2.some(hand2card => {
            if (hand1card.name == hand2card.name && hand1card.value < hand2card.value) {
                //p2card.disabled = true;
                // TODO Find button associated with this card and disable it
                surpass = true;
                return hand1card.name == hand2card.name;
            }
        })

        return surpass;
    }
    function cansurpass_old(btnP1, btnP2) {
        let surpass = false;
        btnP2.some(p2card => {
            if (btnP1.name == p2card.name && btnP1.value < p2card.value) {
                p2card.disabled = true;
                surpass = true;
                return btnP1.name == p2card.name;
            }
        })

        return surpass;
    }
}