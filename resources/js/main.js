//import { Card } from "../class/card";

class Card {
    constructor(name, number, pips) {
      this.name = name;
      this.number = number;
      this.pips = pips;
    }
  }

const actioncards = [
   new Card("Construction", "2", "2"),
   new Card("Construction", "3", "2"),
   new Card("Construction", "4", "2"),
   new Card("Construction", "5", "2"),
   new Card("Construction", "6", "2"),
   new Card("Aggression", "2", "2"),
   new Card("Aggression", "3", "2"),
   new Card("Aggression", "4", "2"),
   new Card("Aggression", "5", "2"),
   new Card("Aggression", "6", "2"),
   new Card("Administration", "2", "2"),
   new Card("Administration", "3", "2"),
   new Card("Administration", "4", "2"),
   new Card("Administration", "5", "2"),
   new Card("Administration", "6", "2"),
   new Card("Mobilisation", "2", "2"),
   new Card("Mobilisation", "3", "2"),
   new Card("Mobilisation", "4", "2"),
   new Card("Mobilisation", "5", "2"),
   new Card("Mobilisation", "6", "2"),
];

const currentactioncards = actioncards.slice();

const player1hand = [];
const player2hand = [];

document.addEventListener("DOMContentLoaded", () => {
    //currentactioncards = actioncards.slice();
});


function testbtn(){
    let playerNumber = 1;
    do 
    {
        let num = Math.floor(Math.random() * currentactioncards.length);
        //alert(num);
        //alert(currentactioncards[num]);

        //const a = new Card("Construction", "2", "2");

        if (playerNumber == 1){
            player1hand.push(currentactioncards[num]);
            currentactioncards.splice(num,1);
            playerNumber = 2;
        }
        else{
            player2hand.push(currentactioncards[num]);
            currentactioncards.splice(num,1);
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
        btn.onclick = function () {
            btn.disabled = true;
        };
        document.getElementById("player1hand").append(btn);
    })
}