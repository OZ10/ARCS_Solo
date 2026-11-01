// Game state: the variables that hold the current game. Loaded after cards.js, as the deck starts as a copy of the action cards.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

let players = [];

let currentactioncards = actioncards.slice();

let playedCardList = [];
let discardPile = [];
let hasInitiativeBeenClaimedThisTurn = false;
let turnNumber = 1;
let roundNumber = 1;
let declaredAmbitions = [];
let currentPlayer;

let modal;
let currentQuestionNumber;

let drawingPlayer;
