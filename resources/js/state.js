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
// 2 players: the neutral resources on each ambition box, as { ambition: count }
let neutralCounts = {};
let currentPlayer;

// The number of the player who has played their card this turn and is carrying out their
// actions. The game moves on to the next player when Done is tapped. null when nobody is
let awaitingDone = null;

let modal;
let currentQuestionNumber;

let drawingPlayer;
