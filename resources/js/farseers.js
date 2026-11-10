// Farseers (#98): "When you declare an ambition, look at a Rival's hand. You may swap 1 card with
// them. Prelude: You may discard this and any number of cards from your hand. Draw the same number
// of cards (including Farseers) from the bottom of the action discard pile."
// A bot's prelude is offered in its prelude window (prelude.js). Here: the human player's prelude,
// the human player's swap, and a bot's swap. The app tracks every hand, so a swap changes both.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const farseersCard = 17;

function getCardLabel(card) {
    // e.g. "Aggression 6"
    return card.name + " " + card.number;
}

function whenWindowsClosed(run) {
    // Run once no window is open or closing, as two can't be open at once
    if (!isAnyWindowOpen()) { run(); return; }
    const wait = () => {
        if (isAnyWindowOpen()) { return; }
        document.removeEventListener('hidden.bs.modal', wait);
        run();
    };
    document.addEventListener('hidden.bs.modal', wait);
}

function showFarseersWindow(player, title, html) {
    document.getElementById("guildTitle").innerHTML = title;
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = html;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

function closeFarseersWindow() {
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
}

function getCardChoices(cards, type, name, onchange) {
    // A hand as buttons to tick (checkbox) or pick one of (radio)
    return "<div class=\"d-flex flex-wrap justify-content-center mb-2\">" + cards.map((card, index) =>
        "<input type=\"" + type + "\" class=\"btn-check\" name=\"" + name + "\" id=\"" + name + index + "\" value=\"" + index + "\" onchange=\"" + onchange + "\">"
        + "<label class=\"btn btn-outline-secondary btn-sm m-1\" for=\"" + name + index + "\">" + getCardFullName(card).toUpperCase() + "</label>").join("") + "</div>";
}

function swapCards(first, second, firstCard, secondCard) {
    // first gives firstCard to second, and takes secondCard
    first.cards = first.cards.filter(card => card !== firstCard).concat(secondCard);
    second.cards = second.cards.filter(card => card !== secondCard).concat(firstCard);
    if (first.isHuman || second.isHuman) { createCardButtonsForHumanPlayer(); }
}

function onAmbitionDeclared(player) {
    // Leaders first (leaderrules.js), then whoever holds Farseers looks at a Rival's hand
    onLeaderAmbitionDeclared(player);
    if (!holdsGuildCard(player, farseersCard)) { return; }
    if (player.isHuman) {
        queueLeaderWindow(() => showFarseersSwap(player));
    } else {
        botFarseersSwap(player);
    }
}

// The human player's prelude

let farseersPlayer = null;
let farseersRival = null;

function showFarseersPrelude(player) {
    // From the Farseers card in their Guild row: tick the cards to discard
    farseersPlayer = player;
    const hand = getUnplayedCards(player.cards);
    const bottom = getDiscardedCards().length;
    document.getElementById("guildTitle").innerHTML = "Farseers: your prelude";
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML =
        "<p class=\"mb-2\">Discard Farseers and any cards from your hand, then draw the same number, counting Farseers, from the bottom of the action discard pile.</p>"
        + "<div class=\"boardgrouplabel text-start\">Your hand: tick the ones to discard</div>"
        + getCardChoices(hand, "checkbox", "farseersDiscard", "updateFarseersPrelude()")
        + "<div class=\"small text-muted mb-3\" id=\"farseersPreludeNote\"></div>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"closeFarseersWindow()\">Cancel</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"farseersPreludeConfirm\" onclick=\"confirmFarseersPrelude()\"></button></div>";
    updateFarseersPrelude();
    if (bottom == 0) {
        document.getElementById("farseersPreludeNote").innerHTML = "The discard pile is empty, so there's nothing to draw.";
        document.getElementById("farseersPreludeConfirm").disabled = true;
    }
}

function getFarseersDiscards() {
    const hand = getUnplayedCards(farseersPlayer.cards);
    return [...document.querySelectorAll("input[name=farseersDiscard]:checked")].map(input => hand[parseInt(input.value)]);
}

function updateFarseersPrelude() {
    const ticked = getFarseersDiscards().length;
    const draws = Math.min(ticked + 1, getDiscardedCards().length);
    document.getElementById("farseersPreludeConfirm").innerHTML = "Discard and draw " + draws;
    document.getElementById("farseersPreludeNote").innerHTML = "Draws " + draws + ": Farseers" + (ticked > 0 ? " and the " + ticked + " you ticked" : "") + ". You'll see them once drawn.";
}

function confirmFarseersPrelude() {
    const player = farseersPlayer;
    const discards = getFarseersDiscards();

    // Take the cards from the bottom first, as what's discarded goes on top
    const draws = getDiscardedCards().slice(0, discards.length + 1);
    discards.forEach(card => {
        card.played = true;
        discardPile.push(card);
    });
    draws.forEach(card => drawCardIntoHand(player, card));

    player.guildCards = player.guildCards.filter(number => number != farseersCard);
    showGuildCardsRow(player);
    createCardButtonsForHumanPlayer();
    SaveAllSettings();
    showMessageToast("Player " + player.number, "Farseers: drew " + draws.map(getCardLabel).join(", "));
    closeFarseersWindow();
}

// The human player's swap

function showFarseersSwap(player) {
    // First choose whose hand to look at. Only that one is shown
    farseersPlayer = player;
    farseersRival = null;
    const rivals = players.filter(other => other !== player && getUnplayedCards(other.cards).length > 0);
    if (rivals.length == 0) {
        showMessageToast("Farseers", "No Rival has any cards left to look at.");
        return;
    }
    showFarseersWindow(player, "Farseers: swap a card",
        "<p class=\"mb-2\">You declared, so Farseers lets you look at one Rival's hand and swap 1 card with them.</p>"
        + "<div class=\"d-flex flex-wrap gap-1 justify-content-center mb-3\">" + rivals.map(rival =>
            "<input type=\"radio\" class=\"btn-check\" name=\"farseersRival\" id=\"farseersRival" + rival.number + "\" value=\"" + rival.number + "\" onchange=\"document.getElementById('farseersLook').disabled = false\">"
            + "<label class=\"btn btn-sm playerchoice playerchoice" + getPlayerColour(rival) + "\" for=\"farseersRival" + rival.number + "\">Player " + rival.number + "</label>").join("") + "</div>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"closeFarseersWindow()\">Not now</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"farseersLook\" disabled onclick=\"lookAtFarseersRival()\">Look at their hand</button></div>");
}

function lookAtFarseersRival() {
    // Once looked at, that's the hand: there's no going back to look at another
    const chosen = document.querySelector("input[name=farseersRival]:checked");
    farseersRival = getPlayer(parseInt(chosen.value));
    const theirs = getUnplayedCards(farseersRival.cards);
    const yours = getUnplayedCards(farseersPlayer.cards);
    document.getElementById("guildBody").innerHTML =
        "<div class=\"boardgrouplabel text-start\">Player " + farseersRival.number + "'s hand: take</div>"
        + getCardChoices(theirs, "radio", "farseersTake", "updateFarseersSwap()")
        + "<div class=\"boardgrouplabel text-start\">Your hand: give</div>"
        + (yours.length > 0 ? getCardChoices(yours, "radio", "farseersGive", "updateFarseersSwap()") : "<div class=\"small text-muted text-center mb-2\">You have no cards left to give.</div>")
        + "<div class=\"d-flex gap-2 mt-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" id=\"farseersNoSwap\" onclick=\"closeFarseersWindow()\">No swap</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"farseersSwap\" disabled onclick=\"confirmFarseersSwap()\">Swap</button></div>";
}

function updateFarseersSwap() {
    document.getElementById("farseersSwap").disabled = document.querySelector("input[name=farseersTake]:checked") == null
        || document.querySelector("input[name=farseersGive]:checked") == null;
}

function confirmFarseersSwap() {
    const take = getUnplayedCards(farseersRival.cards)[parseInt(document.querySelector("input[name=farseersTake]:checked").value)];
    const give = getUnplayedCards(farseersPlayer.cards)[parseInt(document.querySelector("input[name=farseersGive]:checked").value)];
    swapCards(farseersPlayer, farseersRival, give, take);
    SaveAllSettings();
    showMessageToast("Player " + farseersPlayer.number, "Farseers: swapped your " + getCardLabel(give) + " for Player " + farseersRival.number + "'s " + getCardLabel(take));
    closeFarseersWindow();
}

// A bot's swap

function getCardWorth(player, card) {
    // How much a bot wants a card, as { score, reason }: the ambition on it, if it's chasing that
    // one and could still declare it, then an action it needs, then its number. The reason given
    // is the biggest of these
    const weights = farseersWeights;
    const chasing = ambition => declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition);
    let score = card.number * weights.number;
    let reason = "A higher card, to win the initiative.";

    let action = null;
    if (card.actions.includes("battle") && chasing("warlord")) {
        action = "It wanted a Battle action, as it's chasing Warlord.";
    } else if (card.actions.includes("tax") && getCitiesToTax(player).some(resource => getResourceNeed(player, resource) == 2)) {
        const city = getCitiesToTax(player).find(resource => getResourceNeed(player, resource) == 2);
        action = "It wanted a Tax action, for its " + preludeResourceNames[city].toLowerCase() + " city.";
    } else if ((card.actions.includes("secure") || card.actions.includes("influence")) && getWantedCardResource(player) != null) {
        action = "It wanted " + (card.actions.includes("secure") ? "a Secure" : "an Influence") + " action, for a " + preludeResourceNames[getWantedCardResource(player)].toLowerCase() + " card.";
    } else if (card.actions.includes("build") && wantsToBuild(player)) {
        action = "It wanted a Build action.";
    }
    if (action != null) { score += weights.action; reason = action; }

    const options = (card.ambition == "any") ? Object.keys(ambitionResources) : [card.ambition];
    // Only one it has some of, as a bot doesn't declare an ambition it has none of
    const ambition = declaredAmbitions.length < 3
        ? options.find(option => ambitionResources[option] != null && ambitionResources[option](player) > 0 && isChasingAmbition(player, option)) : null;
    if (ambition != null) { score += weights.ambition; reason = "So it can declare " + capitalise(ambition) + ", which it's chasing."; }

    return { score: score, reason: reason };
}

function botFarseersSwap(player) {
    // It looks at the hand with the card it most wants, and swaps its least useful card for it if
    // that's clearly better. The turn window says what it did
    const own = getUnplayedCards(player.cards).map(card => ({ card: card, ...getCardWorth(player, card) })).sort((a, b) => a.score - b.score);
    const offers = players.filter(other => other !== player).flatMap(rival =>
        getUnplayedCards(rival.cards).map(card => ({ rival: rival, card: card, ...getCardWorth(player, card) }))).sort((a, b) => b.score - a.score);
    const best = offers[0], worst = own[0];

    if (best == null || worst == null || best.score - worst.score < farseersWeights.gain) {
        player.farseersSwap = { title: "Looked at a Rival's hand, but didn't swap", note: "Nothing there was better for it than what it has." };
        return;
    }
    swapCards(player, best.rival, worst.card, best.card);
    const theirs = best.rival.isHuman ? "your " : "Player " + best.rival.number + "'s ";
    player.farseersSwap = {
        title: "Swapped its " + getCardLabel(worst.card) + " for " + theirs + getCardLabel(best.card),
        note: (best.rival.isHuman ? "Give it your " + getCardLabel(best.card) + " and take its " + getCardLabel(worst.card) + ". " : "") + best.reason
    };
}
