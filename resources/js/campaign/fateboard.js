// Blighted Reach campaign (#85 stage 7d part 2c): the Fates' card actions and tokens on the app's
// board. A bot decides them from the board, with a place and a reason, like its Lore actions; its
// turn window's Completed button puts them on the board (boardbot.js). The end-of-chapter
// objectives the board can answer are counted here too, rather than asked.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// Who controls a system at the end of a chapter: the Empire where it has a fresh ship, otherwise
// the player with the most fresh ships (and Flagships)
function getChapterController(id) {
    return isEmpireControlled(id) ? "empire" : getController(id);
}

function getSystemsControlledBy(playerNumber) {
    return getSystemIds().filter(id => getChapterController(id) == playerNumber);
}

function countTokens(kind, owner = undefined) {
    return getSystemIds().reduce((total, id) => total + getTokens(id).filter(token => token.kind == kind && (owner === undefined || token.owner == owner)).length, 0);
}

// The objectives the board can count (laterfates.js asks the rest)

const boardObjectiveCounts = {
    // The Steward: clusters where the Empire controls any system, as First Regent
    empireClusters: () => getClustersInPlay().filter(cluster => getSystemIds().some(id => getCluster(id) == cluster && isEmpireControlled(id))).length,
    // The Founder: Free cities the Empire doesn't control
    freeCitiesOutsideEmpire: () => getSystemIds().filter(id => !isEmpireControlled(id)).reduce((total, id) => total + getBuildings(id, freeOwner, "city").length, 0),
    // The Admiral: planets the Empire controls
    empirePlanets: () => getSystemIds().filter(id => isPlanet(id) && isEmpireControlled(id)).length,
    // The Hegemon: Banners on the map
    banners: () => countTokens("banner"),
    // The Blight Speaker: Blight in systems with its ships
    blightWithShips: player => getSystemIds().filter(id => getShips(id, player.number).fresh + getShips(id, player.number).damaged > 0)
        .reduce((total, id) => total + getBlight(id).fresh + getBlight(id).damaged, 0),
    // The Peacekeeper: Weapon planets it controls
    weaponPlanets: player => getSystemsControlledBy(player.number).filter(id => getPlanetResource(id) == "weapons").length,
    // The Warden: Seats it controls
    seats: player => getSystemIds().filter(id => getChapterController(id) == player.number).reduce((total, id) => total + getTokens(id).filter(token => token.kind == "seat").length, 0),
    // The Overlord: planet types it controls that match its Outrage
    outragePlanetTypes: player => new Set(getSystemsControlledBy(player.number).map(getPlanetResource).filter(resource => resource != null && (player.outraged || []).includes(resource))).size,
    // The Survivalist: the lower of its Captives and its Bunkers
    bunkersOrCaptives: player => Math.min(player.captivesValue || 0, countTokens("bunker")),
    // The Gate Wraith: Passages on the map
    passages: () => countTokens("passage")
};

// Where its Fate wants it to Move (steering.js's "move"), as a place on the board, so a Fate's Move
// isn't dropped for having no useful board Move (#197). { flagship, test(id), why } or null

function getFateMoveTarget(player) {
    if (typeof getSteer != "function") { return null; }
    const steer = getSteer(player);
    const text = steer == null ? null : getSteerField(steer, "move", player, null);
    if (text == null) { return null; }
    const n = player.number;
    const has = (id, kind) => getTokens(id).some(token => token.kind == kind);
    const blight = id => getBlight(id).fresh + getBlight(id).damaged > 0;
    const others = id => players.some(other => other !== player && hasLoyalPiece(id, other.number)) || getBuildings(id, freeOwner).length > 0 || getImperial(id).fresh + getImperial(id).damaged > 0 || blight(id);
    const notMine = id => getChapterController(id) != n;
    const targets = [
        [/no Clue/, true, id => isPlanet(id) && !has(id, "clue")],
        [/no Banner/, true, id => isPlanet(id) && !has(id, "banner") && !others(id)],
        [/Hammer Fragment/, true, id => has(id, "hammerFragment")],
        [/with fresh Blight/, false, id => getBlight(id).fresh > 0 && notMine(id)],
        [/with Blight/, false, id => blight(id)],
        [/Weapon planet/, false, id => getPlanetResource(id) == "weapons" && notMine(id)],
        [/cluster with no Seat/, false, id => getBuildings(id, n, "city").length > 0 && !getSystemIds().some(other => getCluster(other) == getCluster(id) && has(other, "seat"))],
        [/cluster with none of its ships/, false, id => !getSystemIds().some(other => getCluster(other) == getCluster(id) && getShips(other, n).fresh + getShips(other, n).damaged > 0)],
        [/Fuel or Material planet/, false, id => ["fuel", "materials"].includes(getPlanetResource(id)) && notMine(id)],
        [/to a gate, to Catapult/, false, id => isGate(id) && !has(id, "passage")],
        [/gate with a Golem/, false, id => isGate(id) && has(id, "golem") && notMine(id)]
    ];
    const match = targets.find(([pattern]) => pattern.test(text));
    return match == null ? null : { flagship: match[1], test: match[2], why: "for its Fate: " + text.replace(/^(its Flagship|ships) to /, "to ") };
}

// The Fate card actions, decided from the board

function isFateBoardStep(where) {
    return where != null && typeof where.kind == "string" && where.kind.startsWith("fate:");
}

function getFateBoardOffer(player, kind, can) {
    // { where, text, why } for one of its Fate card actions, or null when the board has no place for it
    const n = player.number;
    const controls = id => getControllerFor(id, n) == n;
    const fresh = id => getShips(id, n).fresh;
    const rivalPieces = id => players.some(other => other !== player && hasLoyalPiece(id, other.number)) || getBuildings(id, freeOwner).length > 0
        || getImperial(id).fresh + getImperial(id).damaged > 0 || getBlight(id).fresh + getBlight(id).damaged > 0;
    const best = (ids, score) => ids.slice().sort((a, b) => score(b) - score(a))[0] || null;

    switch (kind) {
        case "seat": {
            // The Warden's Claim Fief: a Seat above a Loyal city it controls, in a cluster with no Seat
            const seated = new Set(getSystemIds().filter(id => getTokens(id).some(token => token.kind == "seat")).map(getCluster));
            const cities = getSystemIds().filter(id => getBuildings(id, n, "city").length > 0 && controls(id) && !seated.has(getCluster(id)));
            const system = best(cities, id => getSystemIds().filter(other => getCluster(other) == getCluster(id) && getBuildings(other, null, "city").length > 0).length);
            return system == null ? null : { where: { kind: "fate:seat", system: system }, text: "place a Seat above its city at " + getSystemName(system) + " (Claim Fief): it becomes Lord of cluster " + getCluster(system),
                why: "Each Seat it controls advances its objective 2, and the cluster's cities count for it." };
        }
        case "bunker": {
            // The Survivalist's Building Bunkers: a planet with no Bunker where it has a piece, its
            // cities first, then where Blight could strike
            const planets = getSystemIds().filter(id => isPlanet(id) && hasLoyalPiece(id, n) && !getTokens(id).some(token => token.kind == "bunker"));
            const system = best(planets, id => getBuildings(id, n, "city").length * 2 + (getSystemIds().some(other => getCluster(other) == getCluster(id) && getBlight(other).fresh + getBlight(other).damaged > 0) ? 1 : 0));
            return system == null ? null : { where: { kind: "fate:bunker", system: system }, text: "scrap 1 of its agents to place a Bunker at " + getSystemName(system) + ", then capture 1 agent from a Rival's supply (Building Bunkers). The app adds the Captive",
                why: "Each ambition it wins counts the lower of its Captives and its Bunkers: a Bunker adds one of each." };
        }
        case "fragment": {
            // The Planet Breaker's Repair Hammer: take a Hammer Fragment it controls, and place a fresh ship there
            const system = getSystemIds().find(id => controls(id) && getTokens(id).some(token => token.kind == "hammerFragment"));
            return system == null ? null : { where: { kind: "fate:fragment", system: system }, text: "take the Hammer Fragment at " + getSystemName(system) + " and place 1 fresh ship there (Repair Hammer)",
                why: "Each Fragment taken advances its objective 1; with all 6 it takes the Planet Hammer." };
        }
        case "prepare": {
            // With the Planet Hammer: a Hammer token at a planet it controls, the one with most Rival buildings
            if ((player.hammerFragments || 0) < 6) { return null; }
            const planets = getSystemIds().filter(id => isPlanet(id) && controls(id) && !getTokens(id).some(token => token.kind == "hammer" || token.kind == "brokenWorld"));
            const system = best(planets, id => getBuildings(id).filter(building => building.owner != n).length - getBuildings(id, n).length);
            return system == null ? null : { where: { kind: "fate:prepare", system: system }, text: "place a Hammer token at " + getSystemName(system) + " (Prepare)",
                why: "It holds the Planet Hammer: Break World there later advances its objective 6." };
        }
        case "break": {
            // Break World: a Hammer token at a planet it controls, not placed this turn
            if (player.preparedThisTurn) { return null; }
            const system = getSystemIds().find(id => controls(id) && getTokens(id).some(token => token.kind == "hammer"));
            return system == null ? null : { where: { kind: "fate:break", system: system }, text: "flip the Hammer token at " + getSystemName(system) + " (Break World): everyone Provokes " + preludeResourceNames[getPlanetResource(system)] + " Outrage, and every building there is destroyed (no Trophies, no Ransack)",
                why: "Crush a Planet into Dust: its objective advances 6." };
        }
        case "spawn": {
            // The Blight Speaker's Spawn: damage a fresh Blight it controls to place a damaged one there,
            // where its ships are (Blight in systems with its ships counts for its objective)
            const systems = getSystemIds().filter(id => controls(id) && getBlight(id).fresh > 0);
            const system = best(systems, id => fresh(id));
            return system == null ? null : { where: { kind: "fate:spawn", system: system }, text: "damage a fresh Blight at " + getSystemName(system) + " to place a damaged Blight there (Spawn)",
                why: "Spread the Spores: each Blight placed advances its objective 1." };
        }
        case "seed": {
            // The Naturalist's Seed: the app rolls the number die; a damaged Blight in a system with none in
            // that cluster, one it controls first
            const cluster = Math.floor(Math.random() * 6) + 1;
            const systems = getSystemIds().filter(id => getCluster(id) == cluster && getBlight(id).fresh + getBlight(id).damaged == 0);
            const system = best(systems, id => (controls(id) ? 2 : 0) + fresh(id) / 10);
            return system == null ? null : { where: { kind: "fate:seed", system: system, roll: cluster }, text: "rolled " + cluster + ": place a damaged Blight at " + getSystemName(system) + " (Seed)",
                why: "Live in the Garden: systems it controls with Blight count for it." };
        }
        case "revolt": {
            // The Founder's Incite Revolt: a system with a fresh Free city and damaged Rival or Imperial ships
            const damagedThere = id => getImperial(id).damaged + players.filter(other => other !== player).reduce((total, other) => total + getShips(id, other.number).damaged, 0);
            const systems = getSystemIds().filter(id => getBuildings(id, freeOwner, "city").some(city => !city.damaged) && damagedThere(id) > 0);
            const system = best(systems, damagedThere);
            return system == null ? null : { where: { kind: "fate:revolt", system: system }, text: "destroy the " + damagedThere(system) + " damaged Rival and Imperial ship" + (damagedThere(system) == 1 ? "" : "s") + " at " + getSystemName(system) + ", ignoring the Truce Law. No Trophies (Incite Revolt)",
                why: "The Free city there rises up for the Commonwealth." };
        }
        case "banner": {
            // The Hegemon's Planting Banners: at its Flagship's planet, with no Banner and nothing that isn't Loyal
            const system = typeof getFlagshipSystem == "function" ? getFlagshipSystem(player) : null;
            if (system == null || !isPlanet(system) || getTokens(system).some(token => token.kind == "banner") || rivalPieces(system)) { return null; }
            return { where: { kind: "fate:banner", system: system }, text: "place a Banner at its Flagship's planet, " + getSystemName(system) + " (Planting Banners)",
                why: "Plant Banners of the New Order: each Banner on the map advances its objective at the end of a chapter." };
        }
        default:
            return null;
    }
}

function applyFateBoardStep(player, where) {
    // On the board, once ticked Completed or at the end of its turn
    const n = player.number;
    const system = where.system;
    switch (where.kind) {
        case "fate:seat": addToken(system, "seat", n); break;
        case "fate:bunker": addToken(system, "bunker", n); break;
        case "fate:fragment": {
            removeToken(system, "hammerFragment");
            addShips(system, n, 1);
            player.hammerFragments = (player.hammerFragments || 0) + 1;
            advanceObjective(player, 1, "took a Hammer Fragment (Repair the Planet Hammer)");
            if (player.hammerFragments >= 6) { showMessageToast("Player " + n, "All 6 Hammer Fragments: it takes the Planet Hammer. Warn everyone, and flip Hammer Fragments."); }
            break;
        }
        case "fate:prepare": addToken(system, "hammer", n); player.preparedThisTurn = true; break;
        case "fate:break": {
            removeToken(system, "hammer");
            addToken(system, "brokenWorld", null);
            const resource = getPlanetResource(system);
            players.forEach(other => provokeOutrage(other, resource));
            getBuildings(system).slice().forEach(building => removeBuilding(system, building.owner, building.kind));
            advanceObjective(player, 6, "used Break World (Crush a Planet into Dust)");
            players.forEach(other => { if (typeof other.number == "number") { syncPanelFromBoard(other); } });
            break;
        }
        case "fate:spawn": {
            const blight = getBlight(system);
            setBlight(system, blight.fresh - 1, blight.damaged + 2);
            advanceObjective(player, 1, "placed Blight with Spore Ships (Spread the Spores)");
            break;
        }
        case "fate:seed": { const blight = getBlight(system); setBlight(system, blight.fresh, blight.damaged + 1); break; }
        case "fate:revolt": {
            players.filter(other => other !== player).forEach(other => { const ships = getShips(system, other.number); if (ships.damaged > 0) { setShips(system, other.number, ships.fresh, 0); syncPanelFromBoard(other); } });
            const imperial = getImperial(system); setImperial(system, imperial.fresh, 0);
            break;
        }
        case "fate:banner": addToken(system, "banner", n); break;
        default: break;
    }
    syncPanelFromBoard(player);
}

function removeToken(id, kind) {
    const tokens = getTokens(id);
    const index = tokens.findIndex(token => token.kind == kind);
    if (index >= 0) { tokens.splice(index, 1); }
}

// The Planet Breaker's Hammer Fragments, at the start of Act II: one on each planet of a rolled symbol

function placeHammerFragments(player) {
    campaign.setupRolls = campaign.setupRolls || {};
    if (campaign.setupRolls.fragmentSymbol == null) { campaign.setupRolls.fragmentSymbol = rollPlanetSymbol(); }
    const symbol = campaign.setupRolls.fragmentSymbol;
    const planets = getSystemIds().filter(id => isPlanet(id) && id.endsWith(planetSymbolLetters[symbol]));
    planets.forEach(id => addToken(id, "hammerFragment", null, 0));
    return "rolled " + planetSymbols[symbol] + ": a Hammer Fragment at " + planets.map(getSystemShortName).join(", ");
}
