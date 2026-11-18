// More than one human player (#67). Human players take the first seats (Players 1, 2...) and pass
// the device at their turn. Each one's hand is covered by frosted glass until they tap to show it,
// and covered again once play moves on. With one human player nothing is covered, and the app
// keeps calling them "you".
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The human player whose hand is showing now, or null
let handShownFor = null;

const humanColourNames = { 1: "Yellow", 2: "Red", 3: "White", 4: "Blue" };

function getHumanPlayers() {
    return players.filter(player => player.isHuman);
}

function isMultiHuman() {
    return getHumanPlayers().length > 1;
}

function isYou(player) {
    // The app says "you" only when there's one human player and it's them
    return player != null && player.isHuman && !isMultiHuman();
}

function getYouOrPlayer(player, capital = false) {
    // "you"/"You", or "Player 2"
    return isYou(player) ? (capital ? "You" : "you") : "Player " + player.number;
}

function getActionId(player, name) {
    // A human player's play buttons. Player 1's keep their plain names (LEAD, CLAIM, actionbuttons)
    return (player.number == 1) ? name : name + "_" + player.number;
}

// The hand covers

function getHandCoverHtml(player) {
    // Frosted glass over blank cards (never the real ones, so nothing can be read through it)
    const cards = Math.max(getUnplayedCards(player.cards).length, 1);
    const yourTurn = currentPlayer != null && currentPlayer.number == player.number;
    const message = yourTurn
        ? "<i class=\"bi bi-eye-slash\"></i><h6>Player " + player.number + "'s hand is hidden</h6><p>Pass the device to Player " + player.number + ", then tap to show it.</p>"
            + "<button type=\"button\" class=\"btn btn-light\" id=\"showHand" + player.number + "\" onclick=\"showHand(" + player.number + ")\">Show my hand</button>"
        : "<i class=\"bi bi-lock-fill\"></i><p><b>Player " + player.number + "'s hand</b> is hidden until their next turn.</p>";
    return "<div class=\"frostcards\">" + "<div class=\"frostcard\"></div>".repeat(cards) + "</div>"
        + "<div class=\"frostactions\"><div></div><div></div></div><div class=\"frostglass\">" + message + "</div>";
}

function updateHandCovers() {
    getHumanPlayers().forEach(player => {
        const cover = document.getElementById("handcover" + player.number);
        if (cover == null) { return; }
        const covered = isMultiHuman() && handShownFor != player.number;
        cover.innerHTML = covered ? getHandCoverHtml(player) : "";
        cover.classList.toggle("d-none", !covered);
        // The hand and the play buttons themselves are taken off the screen while covered
        ["playerhand" + player.number, getActionId(player, "actionbuttons"), "actionslabel" + player.number].forEach(id => {
            const element = document.getElementById(id);
            if (element != null) { element.classList.toggle("handcovered", covered); }
        });
    });
}

function showHand(playerNumber) {
    handShownFor = playerNumber;
    updateHandCovers();
}

function onCurrentPlayerChanged(playerNumber) {
    // A new player's turn: any hand that was showing is covered again
    if (handShownFor != playerNumber) { handShownFor = null; }
    updateHandCovers();
}

function getCoveredHandHtml(player, handHtml) {
    // A hand shown in a window (the mulligan): covered the same way until its human player taps
    if (!isMultiHuman()) { return handHtml; }
    const cards = Math.max(getUnplayedCards(player.cards).length, 1);
    return "<div class=\"windowcover\"><div class=\"frosthand\"><div class=\"frostcards\">" + "<div class=\"frostcard\"></div>".repeat(cards) + "</div>"
        + "<div class=\"frostglass\"><i class=\"bi bi-eye-slash\"></i><h6>Player " + player.number + "'s hand is hidden</h6><p>Pass the device to Player " + player.number + ", then tap to show it.</p>"
        + "<button type=\"button\" class=\"btn btn-light\" onclick=\"this.closest('.windowcover').classList.add('revealed')\">Show my hand</button></div></div>"
        + handHtml + "</div>";
}

// New Game: how many human players, and a colour each

function getChosenHumanCount() {
    const checked = document.querySelector("input[name=humanCount]:checked");
    return checked == null ? 1 : parseInt(checked.value);
}

function getChosenHumanColours() {
    // Each human player's colour, Player 1 first
    const colours = [parseInt(document.querySelector("input[name=humanColour]:checked").value)];
    for (let number = 2; number <= getChosenHumanCount(); number++) {
        const checked = document.querySelector("input[name=humanColour" + number + "]:checked");
        colours.push(checked == null ? 0 : parseInt(checked.value));
    }
    return colours;
}

function getPlayerColours(numberOfPlayers, humanColours) {
    // The human players' colours, then each bot its own seat's colour if it's free, otherwise
    // one that's left over (so with one human player, the bot with their colour takes theirs)
    const colours = humanColours.slice(0, numberOfPlayers);
    const clashes = [];
    for (let number = colours.length + 1; number <= numberOfPlayers; number++) {
        if (colours.includes(number)) { clashes.push(number); colours.push(0); } else { colours.push(number); }
    }
    const left = [1, 2, 3, 4].filter(colour => !colours.includes(colour));
    clashes.forEach(number => { colours[number - 1] = left.shift(); });
    return colours;
}

function setHumanCount(count) {
    // A colour row for each human player, and only the numbers of players that are enough
    const holder = document.getElementById("moreHumanColours");
    const kept = getChosenHumanColours().slice(1);
    let html = "";
    for (let number = 2; number <= count; number++) {
        html += "<div class=\"optrow\"><div class=\"optlabel\">Player " + number + "'s colour</div><div class=\"swatches\">"
            + [1, 2, 3, 4].map(colour => "<input type=\"radio\" class=\"btn-check\" name=\"humanColour" + number + "\" id=\"humanColour" + number + "_" + colour + "\" value=\"" + colour + "\" onchange=\"updateHumanColours(" + number + ")\">"
                + "<label class=\"btn btn-sm playerchoice playerchoice" + colour + "\" for=\"humanColour" + number + "_" + colour + "\">" + humanColourNames[colour] + "</label>").join("")
            + "</div></div>";
    }
    holder.innerHTML = html;
    // Keep what was chosen, or the first colour nobody has
    for (let number = 2; number <= count; number++) {
        const taken = getChosenHumanColours().slice(0, number - 1);
        const wanted = kept[number - 2];
        const colour = (wanted && !taken.includes(wanted)) ? wanted : [1, 2, 3, 4].find(other => !taken.includes(other));
        document.getElementById("humanColour" + number + "_" + colour).checked = true;
    }
    document.getElementById("humanCount" + count).checked = true;
    document.getElementById("humanColourLabel1").innerHTML = (count == 1) ? "Your colour" : "Player 1's colour";
    document.getElementById("humanCountHint").innerHTML = (count == 1) ? "Just you against the bots."
        : "Players 1" + (count > 2 ? ", " + Array.from({ length: count - 2 }, (_, index) => index + 2).join(", ") : "") + " and " + count + " are human players"
            + (count < 4 ? ", and the rest are bots" : "") + ". Pass the device at each human player's turn: their hand stays hidden until they tap to show it.";
    document.querySelectorAll(".playercount button").forEach(button => button.classList.toggle("d-none", parseInt(button.textContent) < count));
    // With 4 human players there's only one count to choose
    if (count == 4) { chosenPlayerCount = 4; }
    showChosenPlayerCount();
    updateHumanColours();
    updateBotDifficultyCard();
}

function updateHumanColours(changed = 1) {
    // A colour another human player has is faded out. If two clash, the other one moves
    const count = getChosenHumanCount();
    const colours = getChosenHumanColours();
    const inputFor = (number, colour) => document.getElementById(number == 1 ? "humanColour" + colour : "humanColour" + number + "_" + colour);
    for (let number = 1; number <= count; number++) {
        if (number == changed || colours[number - 1] != colours[changed - 1]) { continue; }
        const free = [1, 2, 3, 4].find(colour => !colours.includes(colour));
        inputFor(number, free).checked = true;
        colours[number - 1] = free;
    }
    for (let number = 1; number <= count; number++) {
        [1, 2, 3, 4].forEach(colour => {
            const input = inputFor(number, colour);
            if (input != null) { input.disabled = colours.some((other, index) => index != number - 1 && other == colour); }
        });
    }
    // With one human player every colour is free
    if (count == 1) { [1, 2, 3, 4].forEach(colour => { inputFor(1, colour).disabled = false; }); }
}

function updateBotDifficultyCard() {
    // No bots to set when every player is a human player: while 4 are chosen for a new game, or
    // during such a game
    const card = document.getElementById("botDifficultyCard");
    if (card == null) { return; }
    const choosing = document.getElementById("newGamePlayers").classList.contains("show");
    const noBots = choosing ? getChosenHumanCount() >= 4 : (players.length > 0 && players.every(player => player.isHuman));
    card.classList.toggle("d-none", noBots);
}

function showHumanChoices() {
    // The New Game choices as the last game had them
    const humans = getHumanPlayers();
    if (humans.length == 0) { return; }
    setHumanCount(humans.length);
    humans.forEach(player => {
        const input = player.number == 1 ? document.getElementById("humanColour" + getPlayerColour(player)) : document.getElementById("humanColour" + player.number + "_" + getPlayerColour(player));
        if (input != null) { input.checked = true; }
    });
    updateHumanColours();
}

document.addEventListener("DOMContentLoaded", () => {
    const newGame = document.getElementById("newGamePlayers");
    if (newGame == null) { return; }
    ["shown.bs.collapse", "hidden.bs.collapse"].forEach(event => newGame.addEventListener(event, updateBotDifficultyCard));
    document.getElementById("numberOfPlayersModal").addEventListener("show.bs.modal", updateBotDifficultyCard);
    // Player 1's colour can move another human player's away
    document.querySelectorAll("input[name=humanColour]").forEach(input => input.addEventListener("change", () => updateHumanColours(1)));
});
