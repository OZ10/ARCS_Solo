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

function getSystemDistance(from, to) {
    // Steps between two systems through adjacent systems, ignoring who's there
    if (from == to) { return 0; }
    const seen = new Set([from]);
    let frontier = [from], steps = 0;
    while (frontier.length > 0 && steps < 20) {
        steps++;
        const next = [];
        for (const id of frontier) {
            for (const other of getAdjacent(id)) {
                if (other == to) { return steps; }
                if (!seen.has(other)) { seen.add(other); next.push(other); }
            }
        }
        frontier = next;
    }
    return 99;
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

// Act III grand ambitions the board can check: how many of the two are fulfilled
const boardGrandCounts = {
    // The Admiral: a Regent controlling 9+ planets; a Regent with more Loyal ships on the map than each Rival
    admiral: player => {
        if (!isRegent(player)) { return 0; }
        const planets = getSystemIds().filter(id => isPlanet(id) && getControllerFor(id, player.number) == player.number).length;
        const ships = getBoardShips(player.number);
        return (planets >= 9 ? 1 : 0) + (players.filter(other => other !== player).every(other => getBoardShips(other.number) < ships) ? 1 : 0);
    },
    // The Pathfinder: controls the Portal token; more Pilgrims delivered than the current chapter
    pathfinder: player => {
        const portal = getSystemIds().find(id => getTokens(id).some(token => token.kind == "portal"));
        return (portal != null && getControllerFor(portal, player.number) == player.number ? 1 : 0) + ((getCampaignPlayer(player).pilgrimsDelivered || 0) > roundNumber ? 1 : 0);
    },
    // The Peacekeeper: 2+ clusters at Peace, 5+ clusters at Peace
    peacekeeper: () => {
        const peace = getClustersInPlay().filter(isPeaceCluster).length;
        return (peace >= 2 ? 1 : 0) + (peace >= 5 ? 1 : 0);
    }
};

// Where its Fate wants it to Move (steering.js's "move"), as a place on the board, so a Fate's Move
// isn't dropped for having no useful board Move (#197). { flagship, test(id), why } or null

function getFateMoveTarget(player) {
    if (typeof getSteer != "function") { return null; }
    // The Pacifist (Act II): carry a Witness it controls to a Psionic planet, to flip and take it
    if (typeof campaign != "undefined" && campaign != null && campaign.act == 2 && hasFate(player, 14)) {
        const from = getWitnessSystems(player).find(id => getPlanetResource(id) != "psionics" && getShips(id, player.number).fresh > 0);
        if (from != null) { return { flagship: false, from: from, test: id => getPlanetResource(id) == "psionics", why: "for its Fate: to carry its Witness to a Psionic planet, to take it" }; }
    }
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

// The Pacifist's Witnesses: Loyal tokens that move with its ships

function getWitnessSystems(player) {
    // Where it has a Witness still on its spyglass side, in a system it controls
    return getSystemIds().filter(id => getTokens(id).some(token => token.kind == "witness" && token.owner == player.number && (token.side || 0) == 0)
        && getControllerFor(id, player.number) == player.number);
}

function carryFateTokens(player, from, to) {
    // Its Witnesses go with its ships (Witnesses: "move Witnesses you control")
    const tokens = getTokens(from);
    const moving = tokens.filter(token => token.kind == "witness" && token.owner == player.number);
    // (Called once its ships have gone, so control was checked when the Move was chosen)
    if (moving.length == 0 || getShips(to, player.number).fresh + getShips(to, player.number).damaged == 0) { return; }
    getSystem(from).tokens = tokens.filter(token => !moving.includes(token));
    moving.forEach(token => getTokens(to).push(token));
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
        case "witness": {
            // The Pacifist's prelude: flip a Witness at a Psionic planet it controls, and take it
            const system = getWitnessSystems(player).find(id => getPlanetResource(id) == "psionics");
            return system == null || getEmptySlots(player) == 0 ? null : { where: { kind: "fate:witness", system: system }, text: "flip its Witness at " + getSystemName(system) + " to its Psionic side and take it (Witnesses)",
                why: "A Psionic for its Fate: Spread Empathy pays for Psionics spent while Empath is declared." };
        }
        case "pilgrims": {
            // The Pathfinder (Act III), once a turn: each Pilgrim one step into a system it controls or
            // with its Flagship, towards the Portal (or its Flagship while there's no Portal)
            const portal = getSystemIds().find(id => getTokens(id).some(token => token.kind == "portal"));
            const goal = portal || (typeof getFlagshipSystem == "function" ? getFlagshipSystem(player) : null);
            if (goal == null) { return null; }
            const flagshipAt = typeof getFlagshipSystem == "function" ? getFlagshipSystem(player) : null;
            const open = id => getControllerFor(id, n) == n || id == flagshipAt;
            const steps = [];
            getSystemIds().forEach(id => getTokens(id).filter(token => token.kind == "pilgrim" && token.owner == n).forEach(() => {
                const now = getSystemDistance(id, goal);
                const to = getAdjacent(id).filter(open).sort((a, b) => getSystemDistance(a, goal) - getSystemDistance(b, goal))[0];
                if (to != null && getSystemDistance(to, goal) < now) { steps.push({ from: id, to: to }); }
            }));
            if (steps.length == 0) { return null; }
            return { where: { kind: "fate:pilgrims", steps: steps }, text: "move " + steps.length + " Pilgrim" + (steps.length == 1 ? "" : "s") + " one step: " + steps.map(step => getSystemShortName(step.from) + " &rarr; " + getSystemShortName(step.to)).join(", ") + " (Pilgrims)",
                why: "Towards " + (portal != null ? "the Portal, to deliver them" : "its Flagship, ready for the Portal") + ": See the Pilgrims Delivered." };
        }
        case "portal": {
            // Use the Portal (instead of a Move): it controls the Portal, and Pilgrims are there
            const system = getSystemIds().find(id => getTokens(id).some(token => token.kind == "portal") && getControllerFor(id, n) == n
                && getTokens(id).some(token => token.kind == "pilgrim" && token.owner == n));
            if (system == null) { return null; }
            const count = getTokens(system).filter(token => token.kind == "pilgrim" && token.owner == n).length;
            return { where: { kind: "fate:portal", system: system }, text: "take the " + (count == 1 ? "Pilgrim" : count + " Pilgrims") + " at the Portal, " + getSystemName(system) + ", onto its objective card, and put a Seek the Portal on top of the Court deck (Use the Portal)",
                why: "See the Pilgrims Delivered: more Pilgrims on its card than the current chapter." };
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
        case "fate:pilgrims": {
            (where.steps || []).forEach(step => {
                const tokens = getTokens(step.from);
                const index = tokens.findIndex(token => token.kind == "pilgrim" && token.owner == n);
                if (index >= 0) { getTokens(step.to).push(tokens.splice(index, 1)[0]); }
            });
            break;
        }
        case "fate:portal": {
            const tokens = getTokens(system);
            const delivered = tokens.filter(token => token.kind == "pilgrim" && token.owner == n).length;
            getSystem(system).tokens = tokens.filter(token => !(token.kind == "pilgrim" && token.owner == n));
            const state = getCampaignPlayer(player);
            state.pilgrimsDelivered = (state.pilgrimsDelivered || 0) + delivered;
            showMessageToast("Player " + n, delivered + " Pilgrim" + (delivered == 1 ? "" : "s") + " delivered through the Portal: " + state.pilgrimsDelivered + " on its card. Put a Seek the Portal on top of the Court deck.");
            break;
        }
        case "fate:awaken": {
            // The Caretaker's Golems leave the board for Golem Hearth, and are counted on its panel
            let taken = 0;
            (where.systems || []).forEach(id => { const tokens = getTokens(id); const left = tokens.filter(token => token.kind != "golem"); taken += tokens.length - left.length; getSystem(id).tokens = left; });
            if (taken > 0) { stepCampaign("golems", n, taken); }
            break;
        }
        case "fate:witness": {
            const tokens = getTokens(system);
            const index = tokens.findIndex(token => token.kind == "witness" && token.owner == n);
            if (index >= 0) { tokens.splice(index, 1); }
            break;
        }
        default: break;
    }
    syncPanelFromBoard(player);
}

function removeToken(id, kind) {
    const tokens = getTokens(id);
    const index = tokens.findIndex(token => token.kind == kind);
    if (index >= 0) { tokens.splice(index, 1); }
}

// A bot's ships in its Fate's setup (#85 stage 7d part 2b): making up its Loyal ships on the map,
// scrapping some, or the Pirate's ship on each gate. A human player does theirs on the table
// makeUp: Loyal ships on the map it makes up to (besides its Flagship); scrapBefore/After: ships scrapped
const fateShipSetups = {
    10: { act: 2, makeUp: 6, scrapAfter: 4 },
    13: { act: 2, scrapBefore: 2, makeUp: 8 },
    14: { act: 2, makeUp: 8 },
    15: { act: 2, makeUp: 8 },
    16: { act: 2, makeUp: 8 },
    12: { act: 2, gateShips: true }
};

function applyBotFateShips(player, act) {
    const setup = fateShipSetups[getFateNumber(player)];
    if (setup == null || setup.act != act || player.isHuman) { return null; }
    const n = player.number;
    const lines = [];
    const shipsOn = id => getShips(id, n).fresh + getShips(id, n).damaged;
    const scrap = count => {
        // Where they matter least: no buildings of its own, fewest ships, damaged ones first
        let scrapped = 0;
        while (scrapped < count) {
            const id = getSystemIds().filter(other => shipsOn(other) > 0).sort((a, b) => getBuildings(a, n).length - getBuildings(b, n).length || shipsOn(a) - shipsOn(b))[0];
            if (id == null) { break; }
            removeShips(id, n, 1, getShips(id, n).damaged > 0);
            scrapped++;
        }
        player.scrappedShips = (player.scrappedShips || 0) + scrapped;
        if (scrapped > 0) { lines.push("scrapped " + scrapped + " ship" + (scrapped == 1 ? "" : "s")); }
    };
    if (setup.scrapBefore) { scrap(setup.scrapBefore); }
    if (setup.makeUp) {
        // Into systems with its Loyal pieces: its buildings first, then where it has most ships
        const places = getSystemIds().filter(id => hasLoyalPiece(id, n)).sort((a, b) => getBuildings(b, n).length - getBuildings(a, n).length || shipsOn(b) - shipsOn(a));
        const added = {};
        let index = 0;
        while (getBoardShips(n) < setup.makeUp && getShipSupply(player) > 0 && places.length > 0) {
            const id = places[index % places.length];
            addShips(id, n, 1);
            added[id] = (added[id] || 0) + 1;
            index++;
        }
        const list = Object.entries(added).map(([id, count]) => count + " at " + getSystemShortName(id));
        if (list.length > 0) { lines.push("made up its ships to " + setup.makeUp + ": " + list.join(", ")); }
    }
    if (setup.scrapAfter) { scrap(setup.scrapAfter); }
    if (setup.gateShips) {
        // The Pirate: 1 ship on the gate of each cluster with no Loyal ships
        const gates = getClustersInPlay().filter(cluster => !getSystemIds().some(id => getCluster(id) == cluster && getShips(id, n).fresh + getShips(id, n).damaged > 0)).map(cluster => cluster + "g").filter(id => getSystem(id) != null);
        gates.forEach(id => { if (getShipSupply(player) > 0) { addShips(id, n, 1); } });
        if (gates.length > 0) { lines.push("placed 1 ship at " + gates.map(getSystemShortName).join(", ")); }
    }
    syncPanelFromBoard(player);
    return lines.length > 0 ? "Player " + n + " " + lines.join(", then ") + ", on the app's board" : null;
}

// The Peacekeeper's Ceasefires (Act III): to harm anything in a cluster at Peace, other than Loyal
// pieces and Blight, spend 1 Weapon and flip it to War

function isPeaceCluster(cluster) {
    return (board.clusterTokens[cluster] || []).some(token => token.kind == "ceasefire" && token.side == 1);
}

function isCeasefireBlocked(id, attackerNumber) {
    // At Peace, and no Weapon to spend
    const attacker = players.find(other => other.number == attackerNumber);
    return isPeaceCluster(getCluster(id)) && (attacker == null || (attacker.weaponsValue || 0) == 0);
}

function applyCeasefireAfterBattle(system, attacker) {
    // A battle in a cluster at Peace spent a Weapon and flipped it to War
    const cluster = getCluster(system);
    if (!isPeaceCluster(cluster)) { return; }
    board.clusterTokens[cluster].forEach(token => { if (token.kind == "ceasefire") { token.side = 0; } });
    if ((attacker.weaponsValue || 0) > 0) { setPlayerResource(attacker, "weapons", attacker.weaponsValue - 1); }
    showMessageToast("Ceasefire", "Cluster " + cluster + " flipped to War: Player " + attacker.number + " spent 1 Weapon to battle there. Already on the app's board and panel.");
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
