// Resource slots: where a bot should put a resource it gains and what to lose when it's over
// capacity. Which resource is in which slot isn't tracked, but how many slots are open follows
// from the bot's cities (see resourceSlots in rules.js). The human player decides for themselves.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getOpenSlots(player) {
    const cities = getUncoveredCities(player);
    // Ancient Holdings (Lore) has one more slot, with 4 keys
    return resourceSlots.filter(slot => cities >= slot.cities).concat(hasLore(player, loreNumbers.ancientHoldings) ? [{ slot: "Ancient Holdings", keys: 4, cities: 0 }] : []);
}

function getUsedSlots(player) {
    return preludeResources.reduce((total, resource) => total + player[resource + "Value"], 0);
}

function getEmptySlots(player) {
    return Math.max(getOpenSlots(player).length - getUsedSlots(player), 0);
}

function wantsToKeep(player, resource) {
    // Whether a resource is worth protecting from being stolen: it's chasing that ambition, or
    // the ambition could still be declared. Weapons count towards no ambition, but it wants
    // them when chasing Warlord
    if (resource == "weapons") { return declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord"); }

    const ambition = preludeAmbitions[resource];
    if (declaredAmbitions.includes(ambition)) { return isChasingAmbition(player, ambition); }
    return declaredAmbitions.length < 3;
}

function getResourceToLose(player) {
    // The resource it needs least. Of equally unwanted ones, the one it has most of
    const held = preludeResources.filter(resource => player[resource + "Value"] > 0);
    return held.sort((a, b) => (wantsToKeep(player, a) - wantsToKeep(player, b)) || (player[b + "Value"] - player[a + "Value"]))[0];
}

function provokeOutrage(player, resource) {
    // Rulebook p.16: discard all resources and Guild cards of that type, except a card that says
    // to keep it, and that resource can no longer be spent for its Prelude action
    const lost = getPlayerGuildCards(player).filter(card => card.resource == resource && !card.keepOnOutrage).map(card => card.number);
    setPlayerResource(player, resource, 0);
    player.guildCards = player.guildCards.filter(number => !lost.includes(number));
    showGuildCardsRow(player);
    if (!(player.outraged || []).includes(resource)) { player.outraged = (player.outraged || []).concat(resource); }
}

function hasGameStarted() {
    // Before the first card, the player is still entering the bots' starting resources and cities
    return !(roundNumber == 1 && turnNumber == 1 && playedCardList.length == 0);
}

function getOverCapacityAdvice(player) {
    // What a bot should lose when it has more resources than open slots, or null
    if (player.isHuman || !hasGameStarted()) { return null; }

    const used = getUsedSlots(player), open = getOpenSlots(player).length;
    if (used <= open) { return null; }
    return used + " resources but only " + open + " slots: lose 1 " + preludeResourceNames[getResourceToLose(player)] + ", the one it needs least.";
}

function getKeepReason(player, resource) {
    // Why it wants to keep a resource hard to steal, or null if it doesn't
    if (!wantsToKeep(player, resource)) { return null; }
    const ambition = (resource == "weapons") ? "warlord" : preludeAmbitions[resource];
    return (declaredAmbitions.includes(ambition) ? "It's chasing " + capitalise(ambition) : capitalise(ambition) + " could still be declared") + ", so keep it hard to steal.";
}

function getSlotAdvice(player, resource) {
    // Where a bot should put a resource it has just gained: high keys if it wants to keep it,
    // so it's harder to steal, otherwise low keys. As { player, title, why, slots }, or null for
    // the human player
    if (player.isHuman || !hasGameStarted()) { return null; }

    const overCapacity = getOverCapacityAdvice(player);
    if (overCapacity != null) { return { player: player, title: overCapacity }; }

    const reason = getKeepReason(player, resource);
    return {
        player: player,
        title: "Put the " + preludeResourceNames[resource] + " in the first empty slot",
        why: reason != null ? reason : "It doesn't need this one, so use a slot with few keys.",
        slots: getOpenSlots(player).slice().sort((a, b) => reason != null ? b.keys - a.keys : a.keys - b.keys)
    };
}

function showSlotAdvice(player, resources) {
    // The advice for the resources just gained, once each. It stays until closed or the turn ends
    const advice = [...new Set(resources)].map(resource => getSlotAdvice(player, resource)).filter(line => line != null)
        .filter((line, index, all) => all.findIndex(other => other.title == line.title) == index);
    if (advice.length > 0) { setSlotAdvice(advice); }
}
