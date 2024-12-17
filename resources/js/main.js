

const actioncards = [
    ["Construction2"],
    ["Construction3"],
    ["Construction4"],
    ["Construction5"],
    ["Construction6"],
    ["Aggression2"],
    ["Aggression3"],
    ["Aggression4"],
    ["Aggression5"],
    ["Aggression6"],
    ["Administration2"],
    ["Administration3"],
    ["Administration4"],
    ["Administration5"],
    ["Administration6"],
    ["Mobilisation2"],
    ["Mobilisation3"],
    ["Mobilisation4"],
    ["Mobilisation5"],
    ["Mobilisation6"]
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
    alert(player2hand);
}