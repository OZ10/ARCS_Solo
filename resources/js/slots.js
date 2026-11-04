// Resource slots: where a bot should put a resource it gains and what to lose when it's over
// capacity. Which resource is in which slot isn't tracked, but how many slots are open follows
// from the bot's cities (see resourceSlots in rules.js). The human player decides for themselves.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getOpenSlots(player) {
    const cities = getCityCount(player);
    return resourceSlots.filter(slot => cities >= slot.cities);
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

function getSlotAdvice(player, resource) {
    // Where a bot should put a resource it has just gained: high keys if it wants to keep it,
    // so it's harder to steal, otherwise low keys. null for the human player
    if (player.isHuman || !hasGameStarted()) { return null; }

    const overCapacity = getOverCapacityAdvice(player);
    if (overCapacity != null) { return overCapacity; }

    const keep = wantsToKeep(player, resource);
    const order = getOpenSlots(player).slice().sort((a, b) => keep ? b.keys - a.keys : a.keys - b.keys);
    return (keep ? "Keep this " : "It doesn't need this ") + preludeResourceNames[resource] + ": first empty slot of "
        + order.map(slot => slot.slot + " (" + slot.keys + " key" + (slot.keys == 1 ? "" : "s") + ")").join(" &rarr; ") + ".";
}

function showSlotAdvice(player, resources) {
    // The advice for the resources just gained, once each
    const advice = [...new Set(resources.map(resource => getSlotAdvice(player, resource)))].filter(line => line != null);
    if (advice.length > 0) { showMessageToast("Player " + player.number, advice.join("<br>")); }
}
