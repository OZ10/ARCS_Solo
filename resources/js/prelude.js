// Prelude (#72): after a bot plays its card, before its actions, it may spend resources for
// extra actions (with a Loyal card, any resource as that card's type) and use its Guild cards. The bot can't see the board, so it offers what it would like to spend in the
// Prelude window and the player ticks the ones that are worth doing. The settings are in rules.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The bot whose window is open or waiting to open, and which step: "prelude" or "guild"
// (its Guild card actions, see guildactions.js, which use the same window)
let preludePlayer = null;
let preludeStep = null;

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

function getResourceNeed(player, resource) {
    // How much the bot needs a resource: 2 for an ambition it's chasing, 1 for one that could
    // still be declared, otherwise 0
    const ambition = preludeAmbitions[resource];
    if (ambition == null) { return 0; }
    if (declaredAmbitions.includes(ambition) && isChasingAmbition(player, ambition)) { return 2; }
    return isAmbitionInPlay(ambition) ? 1 : 0;
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

function canBotTakeAction(player, action) {
    // The bot can take this action ("build" or "battle") this turn: its card has it
    // (Construction builds, Aggression battles), or its prelude gave it (a Material for
    // Build, a Weapon or Psionic for Battle, or a Psionic for an action from a lead card that has it)
    const play = getBotPlay(player);
    if (play == null) { return false; }
    if (play.actions.includes(action)) { return true; }

    const spent = (player.prelude != null && player.prelude.spent != null) ? player.prelude.spent : [];
    return spent.some(offer => offer.action == action || (offer.action == "lead" && playedCardList[0].actions.includes(action)));
}

function updateActionButtons(player) {
    // The Battle and Build icons only show for a bot that has played a card (or prelude)
    // that lets it battle or build, until its Done
    [["battlebutton", "battle"], ["buildbutton", "build"]].forEach(([id, action]) => {
        const button = document.getElementById(id + player.number);
        if (button == null) { return; }
        showHideElement([button], !player.isHuman && awaitingDone == player.number && canBotTakeAction(player, action));
    });

    // The human player keeps track of their own battles, once they've played a card. The app
    // doesn't know what they spend in their prelude, so it can't tell whether they can battle
    if (player.isHuman && awaitingDone == player.number) {
        showHideElement([document.getElementById("battlebutton" + player.number)], true);
    }
}

function getPreludeOffers(player) {
    // What the bot would like to do this turn, as [{ label, text, costs, gains, discards, seize, union }]:
    // the resources it spends and gains, a Guild card it discards, whether it seizes the
    // initiative and a Union card it places ({ guild, card }). See confirmPrelude
    const play = getBotPlay(player);
    if (play == null) { return []; }

    const wants = chance => Math.random() * 100 < Math.min(chance, preludeChance.max);
    const chasingWarlord = declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord");
    const manyShips = player.shipsBoardValue >= manyShipsOnBoard;
    const keenToBattle = chasingWarlord || manyShips;
    const guild = getPlayerGuildCards(player);
    const holds = number => guild.some(card => card.number == number);

    // What's left to spend, as offers are added
    let available = {};
    preludeResources.forEach(resource => { available[resource] = player[resource + "Value"]; });

    const payFor = resource => {
        // The resource to spend for this resource's prelude action: its own if it can spare
        // it, otherwise (with the Loyal card for it) any other resource it can spare, the one
        // it has most of. null if it can't pay
        if (available[resource] > 0 && canSpareResource(player, resource)) { return resource; }
        if (!guild.some(card => card.spendAnyAs == resource)) { return null; }
        return preludeResources.filter(other => other != resource && available[other] > 0 && canSpareResource(player, other))
            .sort((a, b) => available[b] - available[a])[0] || null;
    };

    let offers = [];
    // action is what it gives: "build", "move", "secure", "battle" or "lead" (an action from
    // the lead card), so the Build icon can show when the bot can build (see canBotBuild)
    const offerAction = (resource, text, action, converts) => {
        const pay = payFor(resource);
        if (pay == null) { return; }
        const amount = Math.min(available[pay], maxPreludePerResource);
        available[pay] -= amount;

        const loyal = guild.find(card => card.spendAnyAs == resource);
        const label = (pay == resource) ? amount + " " + preludeResourceNames[resource]
            : amount + " " + preludeResourceNames[pay] + " as " + preludeResourceNames[resource] + " (" + loyal.name + ")";
        offers.push({ label: label, text: text, costs: { [pay]: amount }, action: action, converts: converts });
    };

    const usefulIf = { materials: "Build or Repair, if there's a good spot", fuel: "Move, if there's a useful move", relics: "Secure, if there's a card worth securing" };
    const gives = { materials: "build", fuel: "move", relics: "secure" };
    ["materials", "fuel", "relics"].forEach(resource => {
        if (wants(preludeChance.spare)) { offerAction(resource, usefulIf[resource], gives[resource]); }
    });

    // Weapons turn the card's actions into battles (they don't give extra actions), so only
    // when the card has actions and doesn't battle already
    if (play.count > 0 && !play.actions.includes("battle")) {
        let chance = preludeChance.weaponsHavoc;
        if (chasingWarlord) { chance += preludeChance.weaponsWarlord; }
        if (manyShips) {
            chance += preludeChance.weaponsManyShips;
            if (!declaredAmbitions.includes("warlord") && declaredAmbitions.length < 3) { chance += preludeChance.weaponsSaveTrophies; }
        }
        if (wants(chance)) { offerAction("weapons", "Battle with one of the card's actions", "battle", true); }
    }

    // Psionics give an action from the lead card. When the bot led, that's only worth it for
    // more battles than its card allows
    const lead = playedCardList[0];
    if (play.leading) {
        const chance = (chasingWarlord ? preludeChance.psionicsWarlord : 0) + (manyShips ? preludeChance.psionicsManyShips : 0);
        if (play.actions.includes("battle") && chance > 0 && wants(chance)) { offerAction("psionics", "One more Battle than the card allows", "battle"); }
    } else {
        const chance = preludeChance.psionicsFollowing + ((keenToBattle && lead.actions.includes("battle")) ? preludeChance.psionicsBattle : 0);
        if (wants(chance)) { offerAction("psionics", "An action from the lead card (" + lead.actions.split(",").join(", ") + ")", "lead"); }
    }

    // The bot's own Guild cards
    const discard = (card, text, extras) => offers.push(Object.assign({ label: "Discard " + card.name, text: text, discards: card.number }, extras));

    // Lattice Spies: seize the initiative, unless it has it or it's been seized this turn
    if (holds(16) && !player.hasInitiative && !hasInitiativeBeenClaimedThisTurn && wants(preludeChance.seize)) {
        discard(getCourtCard(16), "seize the initiative", { seize: true });
    }

    // Ships: a ship in each gate, or 3 ships in a system it controls, when keen to battle.
    // Only one of these a turn
    if (keenToBattle) {
        const shipCard = guild.find(card => card.placesShips && card.number != 8);
        if (holds(8) && wants(preludeChance.gateShips)) {
            discard(getCourtCard(8), "place 1 ship in each gate (unless out of play)");
        } else if (shipCard != null && wants(preludeChance.placeShips)) {
            discard(shipCard, "place 3 ships in a system it controls");
        }
    }

    // Mining or Shipping Interest: fill its empty resource slots, when chasing Tycoon
    const interest = guild.find(card => card.number == 2 || card.number == 9);
    if (interest != null && getEmptySlots(player) > 0 && isAmbitionInPlay("tycoon") && isChasingAmbition(player, "tycoon") && wants(preludeChance.gainSupply)) {
        const emptySlots = getEmptySlots(player);
        discard(interest, "gain " + emptySlots + " " + preludeResourceNames[interest.resource] + ", filling its empty resource slots", { gains: { [interest.resource]: emptySlots } });
    }

    // Elder Broker: a material, fuel and weapon, when it can spare the card's relic icon
    if (holds(23) && canSpareResource(player, "relics") && wants(preludeChance.elderBroker)) {
        discard(getCourtCard(23), "gain 1 Material, 1 Fuel and 1 Weapon", { gains: { materials: 1, fuel: 1, weapons: 1 } });
    }

    // Relic Fence (kept): swap a spare resource for a relic, when chasing Keeper
    if (holds(24) && isAmbitionInPlay("keeper") && isChasingAmbition(player, "keeper") && wants(preludeChance.relicFence)) {
        const pay = preludeResources.filter(resource => resource != "relics" && available[resource] > 0 && canSpareResource(player, resource))
            .sort((a, b) => available[b] - available[a])[0];
        if (pay != null) {
            available[pay] -= 1;
            offers.push({ label: "Relic Fence", text: "discard 1 " + preludeResourceNames[pay] + " to gain 1 Relic", costs: { [pay]: 1 }, gains: { relics: 1 } });
        }
    }

    // Silver-Tongues: steal a Guild card or resource
    if (holds(20) && wants(preludeChance.steal)) {
        discard(getCourtCard(20), "steal a Guild card or a resource it's chasing an ambition with");
    }

    // Unions: placed next to the highest face-up played card of their suit, which the bot
    // draws when the turn ends. Not on its last card, as the round may then end
    if (getUnplayedCards(player.cards).length > 0) {
        guild.filter(card => card.drawsPlayed != null).forEach(card => {
            const target = playedCardList.filter(played => played.name == card.drawsPlayed && played.cardAction != "COPY" && played.cardAction != "CLAIM")
                .sort((a, b) => b.number - a.number)[0];
            if (target != null && wants(preludeChance.union)) {
                offers.push({ label: card.name, text: "place it next to " + getCardFullName(target) + " and draw that card when the turn ends",
                    union: { guild: card.number, card: getCardFullName(target) } });
            }
        });
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
    if (player.prelude.offers.length > 0 && player.prelude.spent == null) {
        showPreludeModal(player, "prelude");
    } else {
        startGuildActions(player);
    }
}

function showPreludeModal(player, step) {
    if (preludePlayer === player && preludeStep == step) { return; }

    // Another window (e.g. the Yes/No questions) may still be closing, and two can't be
    // open at once, so wait for it
    const open = document.querySelector(".modal.show");
    if (open != null && open.id != "preludeModal") {
        open.addEventListener('hidden.bs.modal', () => showPreludeModal(player, step), { once: true });
        return;
    }
    preludePlayer = player;
    preludeStep = step;

    const isGuild = (step == "guild");
    document.getElementById("preludeTitle").innerHTML = "Player " + player.number + (isGuild ? "'s Guild actions" : "'s prelude");
    document.getElementById("preludeIntro").innerHTML = (isGuild
        ? "In place of its normal actions, the bot would like to use these." : "Before its actions, the bot would like to spend these.") + " Tick the ones worth doing.";
    document.getElementById("confirmPrelude").innerHTML = isGuild ? "Use ticked" : "Spend ticked";
    const header = document.querySelector("#preludeModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + player.number);

    const list = document.getElementById("preludeList");
    list.replaceChildren();
    (isGuild ? player.guildActions : player.prelude).offers.forEach((offer, index) => {
        const row = document.createElement("div");
        row.classList.add("form-check", "mb-2");

        const input = document.createElement("input");
        input.type = "checkbox";
        input.classList.add("form-check-input");
        input.id = "preludeOffer" + index;

        const label = document.createElement("label");
        label.classList.add("form-check-label");
        label.htmlFor = input.id;
        label.innerHTML = "<b>" + offer.label + ":</b> " + offer.text;

        row.append(input, label);
        list.appendChild(row);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("preludeModal")).show();
}

function setPlayerResource(player, resource, value) {
    player[resource + "Value"] = Math.max(value, 0);
    const input = document.getElementById(resource + "Value_" + player.number);
    if (input != null) { input.value = player[resource + "Value"]; }
}

function applyPrelude(player, offers) {
    // Spend and gain the offers' resources and discard their Guild cards (undoLastCard puts them back)
    offers.forEach(offer => {
        Object.entries(offer.costs || {}).forEach(([resource, amount]) => setPlayerResource(player, resource, player[resource + "Value"] - amount));
        Object.entries(offer.gains || {}).forEach(([resource, amount]) => setPlayerResource(player, resource, player[resource + "Value"] + amount));
        if (offer.discards != null) { player.guildCards = player.guildCards.filter(number => number != offer.discards); }
    });
}

function confirmPrelude() {
    // Carry out the ticked offers
    const player = preludePlayer;
    if (player == null) { return; }

    const step = preludeStep;
    const record = (step == "guild") ? player.guildActions : player.prelude;
    record.spent = record.offers.filter((offer, index) => document.getElementById("preludeOffer" + index).checked);
    applyPrelude(player, record.spent);

    // Where to put anything it gained
    showSlotAdvice(player, record.spent.flatMap(offer => Object.keys(offer.gains || {}).filter(resource => preludeResources.includes(resource))));

    record.spent.forEach(offer => {
        if (offer.seize) {
            hasInitiativeBeenClaimedThisTurn = true;
            changeInitiative(player);
        }
        if (offer.union != null) { player.unionDraws.push(offer.union); }
    });
    showGuildCardsRow(player);

    preludePlayer = null;
    preludeStep = null;

    // After the prelude come its Guild card actions, once this window has closed
    const preludeModal = document.getElementById("preludeModal");
    if (step == "prelude") { preludeModal.addEventListener('hidden.bs.modal', () => startGuildActions(player), { once: true }); }
    bootstrap.Modal.getOrCreateInstance(preludeModal).hide();

    // The turn summary lists what was done
    if (awaitingDone == player.number) { showTurnDone(player); }
    SaveAllSettings();
}

function describePrelude(player) {
    // e.g. "Prelude: 1 Fuel (Move), Discard Lattice Spies (seize the initiative)"
    if (player.prelude == null || player.prelude.spent == null || player.prelude.spent.length == 0) { return null; }
    return "Prelude: " + player.prelude.spent.map(offer => offer.label + " (" + offer.text.replace(/, if .*$/, "") + ")").join(", ");
}

function drawUnionCards() {
    // The turn has ended: each Union card placed this turn draws its card into its holder's
    // hand, then is discarded
    players.forEach(player => {
        (player.unionDraws || []).forEach(draw => {
            const card = discardPile.find(played => getCardFullName(played) == draw.card);
            if (card != null) {
                drawCardIntoHand(player, card);
                showMessageToast("Player " + player.number, "Draws " + draw.card + " (" + getCourtCard(draw.guild).name + ")");
            }
            player.guildCards = player.guildCards.filter(number => number != draw.guild);
            showGuildCardsRow(player);
        });
        player.unionDraws = [];
    });
}