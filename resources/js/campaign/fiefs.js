// Blighted Reach campaign (#85): the Warden's Fiefs and Lord titles (Seats & Fiefs, Feudal Law; the
// user's mock-ups, 2026-11-28). A Seat token above a city makes its owner Lord of that cluster (the
// Fief); Rivals with a Loyal city or Flagship there are its Vassals. The Lord taxes any city in the
// Fief, ignoring control (capturing from Vassals), and harm between a Lord and a Vassal there
// Provokes Outrage of every city type in the Fief.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getFiefs() {
    // [{ cluster, lord, seat }]: one for each Seat still above its owner's city. A Seat whose city
    // has gone returns to its owner, with the Lord title (Seats & Fiefs)
    if (typeof campaign == "undefined" || campaign == null) { return []; }
    return getSystemIds().flatMap(id => getTokens(id).filter(token => token.kind == "seat" && token.owner != null && getBuildings(id, token.owner, "city").length > 0)
        .map(token => ({ cluster: getCluster(id), lord: token.owner, seat: id })));
}

function getFiefLord(cluster) {
    const fief = getFiefs().find(item => item.cluster == cluster);
    return fief != null ? fief.lord : null;
}

function isVassalIn(playerNumber, cluster) {
    // A Rival of the Lord with a Loyal city or Flagship in the Fief
    const lord = getFiefLord(cluster);
    if (lord == null || lord == playerNumber) { return false; }
    return getSystemIds().some(id => getCluster(id) == cluster && (getBuildings(id, playerNumber, "city").length > 0 || getFlagships(id).some(flagship => flagship.owner == playerNumber)));
}

function getFiefCityTypes(cluster) {
    // Every city type in the Fief, for Feudal Law's Outrage
    return [...new Set(getSystemIds().filter(id => getCluster(id) == cluster).flatMap(id => getBuildings(id, null, "city").length > 0 ? getCityTypes(id) : []))];
}

function addFiefCities(playerNumber, cities) {
    // A Lord taxes any city in its Fiefs, ignoring control (Feudal Law)
    const fiefs = getFiefs().filter(fief => fief.lord == playerNumber).map(fief => fief.cluster);
    if (fiefs.length == 0) { return cities; }
    const listed = city => cities.some(other => other.system == city.system && other.owner == city.owner && other.resource == city.resource);
    const more = getSystemIds().filter(id => fiefs.includes(getCluster(id))).flatMap(id => getBuildings(id, null, "city")
        .flatMap(city => getCityTypes(id).map(resource => ({ system: id, owner: city.owner, resource: resource, gate: isGate(id), lord: getCluster(id) }))))
        .filter(city => !listed(city));
    return cities.concat(more);
}

function getFeudalRelation(a, b, system) {
    // In a Fief: { cluster, lord, vassal } when one of them is its Lord and the other a Vassal there
    if (system == null || typeof a != "number" || typeof b != "number") { return null; }
    const cluster = getCluster(system);
    const lord = getFiefLord(cluster);
    if (lord == a && isVassalIn(b, cluster)) { return { cluster: cluster, lord: a, vassal: b }; }
    if (lord == b && isVassalIn(a, cluster)) { return { cluster: cluster, lord: b, vassal: a }; }
    return null;
}

function getFeudalBattleNote() {
    // The Battle window's warning (mock-up L2)
    const attacker = battle.attacker, defender = battle.defender;
    if (attacker == null || defender == null) { return ""; }
    const relation = getFeudalRelation(attacker.number, defender.number, battle.boardSystem);
    if (relation == null) { return ""; }
    const types = getFiefCityTypes(relation.cluster).map(resource => preludeResourceNames[resource]);
    return "<div class=\"slotadvice w-100 text-start mt-1\"><b>Feudal Law, Cluster " + relation.cluster + "</b><div class=\"small\">Player " + relation.lord + " is Lord of Cluster " + relation.cluster + " and Player " + relation.vassal
        + " is a Vassal there. Whoever harms the other here Provokes Outrage of every city type in the Fief" + (types.length > 0 ? ": <b>" + types.join(", ") + "</b>" : "") + ". The app adds it when you apply the results.</div></div>";
}

function applyFeudalLaw() {
    // After a battle in a Fief between its Lord and a Vassal: whoever harmed the other Provokes
    // Outrage of every city type there. Returns the lines for the results
    const attacker = battle.attacker, defender = battle.defender, start = battle.start;
    if (attacker == null || defender == null || start == null) { return []; }
    const relation = getFeudalRelation(attacker.number, defender.number, battle.boardSystem);
    if (relation == null) { return []; }
    const types = getFiefCityTypes(relation.cluster);
    const defenderHarmed = battle.fresh < start.fresh || battle.damaged != start.damaged || battle.freshBuildings < start.freshBuildings || battle.damagedBuildings != start.damagedBuildings;
    const attackerHarmed = battle.ships < start.ships || (battle.attackerDamaged || 0) != (start.attackerDamaged || 0);
    const lines = [];
    [[attacker, defenderHarmed], [defender, attackerHarmed]].forEach(([player, harmed]) => {
        if (!harmed) { return; }
        types.forEach(resource => provokeOutrage(player, resource));
        lines.push("Feudal Law: Player " + player.number + " harmed " + (player.number == relation.lord ? "a Vassal" : "their Lord") + " in Cluster " + relation.cluster + " and Provokes Outrage of " + types.map(resource => preludeResourceNames[resource]).join(", ") + ".");
    });
    return lines;
}

function getFiefPanelHtml(player) {
    // A Lord's Fiefs and its Vassals, or where it's a Vassal (mock-up L3)
    const fiefs = getFiefs();
    if (fiefs.length == 0) { return ""; }
    const own = fiefs.filter(fief => fief.lord == player.number);
    const vassalOf = fiefs.filter(fief => isVassalIn(player.number, fief.cluster));
    if (own.length == 0 && vassalOf.length == 0) { return ""; }
    const vassals = fief => players.filter(other => isVassalIn(other.number, fief.cluster)).map(other => "Player " + other.number);
    return "<div class=\"small mb-1\">"
        + (own.length > 0 ? "<div><b>Lord of</b> " + own.map(fief => "Cluster " + fief.cluster + (vassals(fief).length > 0 ? " (Vassals: " + vassals(fief).join(", ") + ")" : "")).join("; ") + "</div>" : "")
        + (vassalOf.length > 0 ? "<div><b>Vassal</b> in " + vassalOf.map(fief => "Cluster " + fief.cluster + " (Lord: Player " + fief.lord + ")").join("; ") + "</div>" : "") + "</div>";
}

function countFiefCities(player) {
    // Lord Over the Fiefs: every city in Fiefs it's Lord of, Free and Seat cities too
    const clusters = getFiefs().filter(fief => fief.lord == player.number).map(fief => fief.cluster);
    return getSystemIds().filter(id => clusters.includes(getCluster(id))).reduce((total, id) => total + getBuildings(id, null, "city").length, 0);
}
