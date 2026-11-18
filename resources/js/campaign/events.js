// Blighted Reach campaign (#85): Event action cards (rulebook p.12). 2 are shuffled into the action
// deck (3 with 4 players). An Event can't lead, copy or be discarded to seize the initiative. Played
// after the lead, it takes actions exactly like the lead card, unless another Event was played earlier
// this round or the Imperial Council was secured earlier this round. A player with the initiative
// and only Events passes the initiative. Any Event played sets off an event at the end of the round.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const eventCardName = "Event";
// How much a bot wants an Event that gives actions: it plays one when the lead card has at least
// this many action pips, and it isn't a card it would rather not use
const eventMinLeadPips = 3;

function isEventCard(card) {
    return card != null && card.name == eventCardName;
}

function getEventsPlayedThisRound() {
    // In the order played. The discard pile holds every card played this round, after the cards no one was dealt
    return discardPile.filter(card => isEventCard(card) && card.played && card.cardAction == "EVENT");
}

function wouldEventGiveActions() {
    // An Event played now: none played before it this round, and the Council not secured
    return getEventsPlayedThisRound().length == 0 && campaign.councilSecuredBy == null;
}

function doesEventGiveActions(card) {
    // An Event already played: it was the round's first, and the Council wasn't secured before it
    const first = getEventsPlayedThisRound()[0];
    if (first == null || getCardFullName(first) != getCardFullName(card)) { return false; }
    return campaign.councilSecuredAt == null || campaign.councilSecuredAt > discardPile.indexOf(first);
}

registerCampaignHook("buildActionDeck", cards => {
    const count = players.length == 4 ? 3 : 2;
    for (let number = 1; number <= count; number++) { cards.push(new Card(eventCardName, number, 0, false, "null", "event")); }
});

registerCampaignHook("cannotLead", player => {
    // Only Event cards left: pass the initiative
    const hand = getUnplayedCards(player.cards);
    if (hand.length == 0 || hand.some(card => !isEventCard(card))) { return false; }
    if (players.some(other => other !== player && getUnplayedCards(other.cards).some(card => !isEventCard(card)))) { return true; }
    // No one has a card that can lead, so the round is over: the Events left in hands are discarded
    // unplayed (the rulebook doesn't say; an Event can't be played without a lead card)
    players.forEach(other => getUnplayedCards(other.cards).forEach(card => {
        card.played = true;
        card.cardAction = "UNPLAYED";
        discardPile.push(card);
    }));
    createCardButtonsForHumanPlayer();
    showMessageToast("End of the chapter", "No one has a card to lead with, so the Event cards left in hands are discarded unplayed.");
    return true;
});

registerCampaignHook("mulligan", player => {
    // 2 players: Event cards stay in the hand, and only as many cards are drawn as were discarded (rulebook p.12)
    const keep = player.cards.filter(card => isEventCard(card) && !card.played);
    const discard = player.cards.filter(card => !keep.includes(card));
    player.cards = keep.concat(discardPile.splice(0, discard.length));
    discardPile = shuffleCards(discardPile.concat(discard));
    return true;
});

registerCampaignHook("actionButtons", (isLeading, card, player) => {
    const eventButton = getActionButtonElements("EVENT", player);
    if (!isEventCard(card)) { showHideElement(eventButton, false); return undefined; }
    // An Event: only the EVENT button, and never to lead
    ["LEAD", "DECLARE", "SURPASS", "COPY", "PIVOT", "CLAIM"].forEach(action => showHideElement(getActionButtonElements(action, player), false));
    showHideElement(eventButton, !isLeading);
    if (isLeading) { showMessageToast("Player " + player.number, "An Event card can't lead. Choose another card."); }
    return true;
});

registerCampaignHook("panelBuilt", player => {
    // The EVENT button, with the human player's other action buttons
    if (!player.isHuman) { return; }
    const group = document.getElementById(getActionId(player, "actionbuttons"));
    if (group == null || document.getElementById(getActionId(player, "EVENT")) != null) { return; }
    const input = createRadioButtons("EVENT", group, "actiontype", "btn-light", player, getActionId(player, "EVENT"));
    showHideElement([input, group.querySelector("label[for=\"" + input.id + "\"]")], false);
});

registerCampaignHook("botCards", player => getUnplayedCards(player.cards).filter(card => !isEventCard(card)));

registerCampaignHook("botPlaysEvent", player => {
    // A bot plays an Event when it gives the lead card's actions and the lead is worth it, or when
    // it has nothing else. It never leads with one (cannotLead passes the initiative instead)
    const hand = getUnplayedCards(player.cards);
    const event = hand.find(isEventCard);
    if (event == null || isLeadingThisTurn()) { return false; }
    const others = hand.filter(card => !isEventCard(card));
    const lead = playedCardList[0];
    const worthIt = wouldEventGiveActions() && lead.pips >= eventMinLeadPips && !(lead.name == "Construction" && avoidsConstruction(player));
    if (others.length > 0 && !worthIt) { return false; }
    player.playReason = { type: "event" };
    playCard(player, event, "ANY", "EVENT");
    return true;
});

registerCampaignHook("botPlay", (card, lead) => {
    if (!isEventCard(card)) { return undefined; }
    return { actions: lead.actions, count: doesEventGiveActions(card) ? lead.pips : 0, leading: false };
});

registerCampaignHook("describePlay", (card, lead) => {
    if (!isEventCard(card)) { return undefined; }
    if (!doesEventGiveActions(card)) {
        const first = getEventsPlayedThisRound()[0];
        const reason = (first != null && getCardFullName(first) != getCardFullName(card)) ? "another Event" : "the Imperial Council";
        return "Played an Event: no actions, as " + reason + " came first this round. It still sets off an event at the end of the round";
    }
    return "Played an Event: the lead card's actions, " + describeActions(lead.pips, lead.actions) + ". It sets off an event at the end of the round";
});
