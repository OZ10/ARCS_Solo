// Prelude (#72): after a bot plays its card, before its actions, it may spend resources for
// extra actions. The bot can't see the board, so it offers what it would like to spend in the
// Prelude window and the player ticks the ones that are worth doing. The settings are in rules.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The bot whose Prelude window is open or waiting to open
let preludePlayer = null;

function getAmbitionPlacePoints(player, ambition, count) {
    // How this player would place in an ambition with this count against everyone else (and
    // the neutral with 2 players): 2 for first, 1 for second or a tie for first, 0 for nothing
    let counts = players.map(p => ({ player: p, count: (p === player) ? count : ambitionResources[ambition](p) }));
    if (players.length == 2 && neutralAmbitions.includes(ambition)) {
        counts.push({ player: neutralPlayer, count: neutralCounts[ambition] || 0 });
    }

    const result = scoreAmbition(counts, [[2, 1]]).find(r => r.player === player);
    return (result == null) ? 0 : result.points - result.cityBonus;
}

function couldGainPlace(player, ambition) {
    // A few more would move it up
    const own = ambitionResources[ambition](player);
    return getAmbitionPlacePoints(player, ambition, own + preludeReachGap) > getAmbitionPlacePoints(player, ambition, own);
}

function isChasingAmbition(player, ambition) {
    // Placing now, or close to it
    const own = ambitionResources[ambition](player);
    return getAmbitionPlacePoints(player, ambition, own) > 0 || couldGainPlace(player, ambition);
}

function isAmbitionInReach(player, ambition) {
    // Spending one would cost it a place, or a few more would gain it one
    const own = ambitionResources[ambition](player);
    const now = getAmbitionPlacePoints(player, ambition, own);
    return getAmbitionPlacePoints(player, ambition, Math.max(own - 1, 0)) < now || couldGainPlace(player, ambition);
}

function isAmbitionInPlay(ambition) {
    // Declared, or could still be declared after the first few turns of the round
    if (declaredAmbitions.includes(ambition)) { return true; }
    return turnNumber > preludeEarlyTurns && declaredAmbitions.length < 3;
}

function canSpareResource(player, resource) {
    // Never a resource it could use to chase an ambition within reach
    const ambition = preludeAmbitions[resource];
    if (ambition == null || !isAmbitionInPlay(ambition)) { return true; }
    return !isAmbitionInReach(player, ambition);
}

function getBotPlay(player) {
    // The actions the bot's card gives it this turn: { actions, count, leading }. A card
    // played face down to seize the initiative gives none
    const card = playedCardList.find(c => c.playedByPlayerNumber == player.number && c.cardAction != "CLAIM");
    if (card == null) { return null; }

    const lead = playedCardList[0];
    switch (card.cardAction) {
        case "COPY":
            return { actions: lead.actions, count: 1, leading: false };
        case "PIVOT":
            return { actions: card.actions, count: 1, leading: false };
        case "SURPASS":
            return { actions: card.actions, count: card.pips, leading: false };
        default:
            // LEAD or DECLARE
            return { actions: card.actions, count: card.pips, leading: true };
    }
}

function getPreludeOffers(player) {
    // What the bot would like to spend this turn, as [{ resource, amount, text }]
    const play = getBotPlay(player);
    if (play == null) { return []; }

    const wants = chance => Math.random() * 100 < Math.min(chance, preludeChance.max);
    const amountOf = resource => Math.min(player[resource + "Value"], maxPreludePerResource);
    const chasingWarlord = declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord");
    const manyShips = player.shipsBoardValue >= manyShipsOnBoard;
    const keenToBattle = chasingWarlord || manyShips;
    let offers = [];

    const usefulIf = { materials: "Build or Repair, if there's a good spot", fuel: "Move, if there's a useful move", relics: "Secure, if there's a card worth securing" };
    ["materials", "fuel", "relics"].forEach(resource => {
        if (amountOf(resource) > 0 && canSpareResource(player, resource) && wants(preludeChance.spare)) {
            offers.push({ resource: resource, amount: amountOf(resource), text: usefulIf[resource] });
        }
    });

    // Weapons turn the card's actions into battles, so only when the card has actions and
    // doesn't battle already
    if (amountOf("weapons") > 0 && play.count > 0 && !play.actions.includes("battle")) {
        let chance = preludeChance.weaponsHavoc;
        if (chasingWarlord) { chance += preludeChance.weaponsWarlord; }
        if (manyShips) {
            chance += preludeChance.weaponsManyShips;
            if (!declaredAmbitions.includes("warlord") && declaredAmbitions.length < 3) { chance += preludeChance.weaponsSaveTrophies; }
        }
        if (wants(chance)) {
            offers.push({ resource: "weapons", amount: amountOf("weapons"), text: "Battle with one of the card's actions" });
        }
    }

    // Psionics give an action from the lead card. When the bot led, that's only worth it for
    // more battles than its card allows
    if (amountOf("psionics") > 0 && canSpareResource(player, "psionics")) {
        const lead = playedCardList[0];
        if (play.leading) {
            const chance = (chasingWarlord ? preludeChance.psionicsWarlord : 0) + (manyShips ? preludeChance.psionicsManyShips : 0);
            if (play.actions.includes("battle") && chance > 0 && wants(chance)) {
                offers.push({ resource: "psionics", amount: amountOf("psionics"), text: "One more Battle than the card allows" });
            }
        } else {
            const chance = preludeChance.psionicsFollowing + ((keenToBattle && lead.actions.includes("battle")) ? preludeChance.psionicsBattle : 0);
            if (wants(chance)) {
                offers.push({ resource: "psionics", amount: amountOf("psionics"), text: "An action from the lead card (" + lead.actions.split(",").join(", ") + ")" });
            }
        }
    }

    return offers;
}

function startPrelude(player) {
    // Called once the bot's card is played. The offers are decided once and saved, so a
    // reload shows the same window again until it's answered
    if (player.prelude == null) {
        player.prelude = { offers: getPreludeOffers(player), spent: null };
        SaveAllSettings();
    }
    if (player.prelude.offers.length > 0 && player.prelude.spent == null) { showPreludeModal(player); }
}

function showPreludeModal(player) {
    if (preludePlayer === player) { return; }

    // Another window (e.g. the Yes/No questions) may still be closing, and two can't be
    // open at once, so wait for it
    const open = document.querySelector(".modal.show");
    if (open != null && open.id != "preludeModal") {
        open.addEventListener('hidden.bs.modal', () => showPreludeModal(player), { once: true });
        return;
    }
    preludePlayer = player;

    document.getElementById("preludeTitle").innerHTML = "Player " + player.number + "'s prelude";
    const header = document.querySelector("#preludeModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + player.number);

    const list = document.getElementById("preludeList");
    list.replaceChildren();
    player.prelude.offers.forEach((offer, index) => {
        const row = document.createElement("div");
        row.classList.add("form-check", "mb-2");

        const input = document.createElement("input");
        input.type = "checkbox";
        input.classList.add("form-check-input");
        input.id = "preludeOffer" + index;

        const label = document.createElement("label");
        label.classList.add("form-check-label");
        label.htmlFor = input.id;
        label.innerHTML = "<b>" + offer.amount + " " + preludeResourceNames[offer.resource] + ":</b> " + offer.text;

        row.append(input, label);
        list.appendChild(row);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("preludeModal")).show();
}

function confirmPrelude() {
    // Spend the ticked resources
    const player = preludePlayer;
    if (player == null) { return; }

    player.prelude.spent = player.prelude.offers.filter((offer, index) => document.getElementById("preludeOffer" + index).checked);
    player.prelude.spent.forEach(offer => {
        player[offer.resource + "Value"] = Math.max(player[offer.resource + "Value"] - offer.amount, 0);
        const input = document.getElementById(offer.resource + "Value_" + player.number);
        if (input != null) { input.value = player[offer.resource + "Value"]; }
    });

    preludePlayer = null;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("preludeModal")).hide();

    // The turn summary lists what was spent
    if (awaitingDone == player.number) { showTurnDone(player); }
    SaveAllSettings();
}

function describePrelude(player) {
    // e.g. "Prelude: 1 fuel (Move), 1 weapon (Battle with one of the card's actions)"
    if (player.prelude == null || player.prelude.spent == null || player.prelude.spent.length == 0) { return null; }
    return "Prelude: " + player.prelude.spent.map(offer => offer.amount + " " + preludeResourceNames[offer.resource].toLowerCase()
        + " (" + offer.text.replace(/, if .*$/, "") + ")").join(", ");
}
