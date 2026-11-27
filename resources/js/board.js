// The board (#160): the map's 24 systems, what's in each, and the moves between them. The app keeps
// track of every ship and building, so the bots can work out what's possible instead of asking.
// There's no map on screen: the windows offer lists of systems where they're needed.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html
//
// A system's id is its cluster number and a letter: g for the gate, then a, c and h for the planets
// with the arrow, crescent and hexagon ID symbols (rulebook p.6). Planets go round the map in that
// order: 1a, 1c, 1h, 2a ... 6h, then back to 1a.

const mapClusterCount = 6;
const planetLetters = ["a", "c", "h"];
const planetLetterNames = { a: "arrow", c: "crescent", h: "hexagon" };

// Each planet's type and building slots
const mapPlanets = {
    "1a": { resource: "weapons", slots: 2 }, "1c": { resource: "fuel", slots: 1 }, "1h": { resource: "materials", slots: 2 },
    "2a": { resource: "psionics", slots: 1 }, "2c": { resource: "weapons", slots: 1 }, "2h": { resource: "relics", slots: 2 },
    "3a": { resource: "materials", slots: 1 }, "3c": { resource: "fuel", slots: 1 }, "3h": { resource: "weapons", slots: 2 },
    "4a": { resource: "relics", slots: 2 }, "4c": { resource: "fuel", slots: 2 }, "4h": { resource: "materials", slots: 1 },
    "5a": { resource: "weapons", slots: 1 }, "5c": { resource: "relics", slots: 1 }, "5h": { resource: "psionics", slots: 2 },
    "6a": { resource: "materials", slots: 1 }, "6c": { resource: "fuel", slots: 2 }, "6h": { resource: "psionics", slots: 1 }
};

// Neighbouring planets in different clusters separated by a thick border: not adjacent
const blockedPlanetLinks = ["1h-2a", "3h-4a", "4h-5a", "6h-1a"];

// The board: which clusters are out of play, and each system's pieces:
// { outOfPlay: [cluster], systems: { id: { ships: { player: { fresh, damaged } }, buildings: [{ owner, kind, damaged }] } } }
// kind is "city" or "starport"
function newSystem() {
    // In a campaign (#85, stage 7a) a system also has Imperial ships, Blight, Flagships and Fate
    // tokens. Free buildings are buildings owned by "free"
    return { ships: {}, buildings: [], imperial: { fresh: 0, damaged: 0 }, blight: { fresh: 0, damaged: 0 }, flagships: [], tokens: [] };
}

function newBoard() {
    const systems = {};
    getAllSystemIds().forEach(id => { systems[id] = newSystem(); });
    // Tokens on a whole cluster, such as the Peacekeeper's Ceasefires: { cluster: [token] }
    return { outOfPlay: [], systems: systems, clusterTokens: {} };
}

// The campaign's pieces (#85, stage 7a)

// The owner of Free cities and starports
const freeOwner = "free";

// The Fates' tokens on the map: a name, whether a player owns it, and its two sides if it has them
const boardTokenKinds = {
    golem: { name: "Golem", sides: ["sleeping", "awake"] },
    banner: { name: "Banner", owned: true },
    hammer: { name: "Hammer" },
    brokenWorld: { name: "Broken World" },
    rumor: { name: "Rumor", sides: ["face down", "face up"] },
    witness: { name: "Witness", sides: ["spyglass side", "Psionic side"] },
    seat: { name: "Seat", owned: true },
    bunker: { name: "Bunker" },
    clue: { name: "Clue" },
    portal: { name: "Portal" },
    pilgrim: { name: "Pilgrim" },
    passage: { name: "Passage" },
    twistedPassage: { name: "Twisted Passage" }
};
const clusterTokenKinds = { ceasefire: { name: "Ceasefire", sides: ["War", "Peace"] } };

function getImperial(id) { return getSystem(id).imperial; }
function setImperial(id, fresh, damaged) { getSystem(id).imperial = { fresh: Math.max(fresh, 0), damaged: Math.max(damaged, 0) }; }
function getBlight(id) { return getSystem(id).blight; }
function setBlight(id, fresh, damaged) { getSystem(id).blight = { fresh: Math.max(fresh, 0), damaged: Math.max(damaged, 0) }; }
function getTokens(id) { return getSystem(id).tokens; }
function addToken(id, kind, owner = null, side = 0) { getSystem(id).tokens.push({ kind: kind, owner: owner, side: side }); }
function getFlagships(id) { return getSystem(id).flagships; }

function hitPieces(pieces, hits) {
    // Hits on fresh pieces first (each turns one damaged), then damaged ones (each destroys one).
    // { damaged, destroyed, left }: left is the hits with nothing to hit
    const before = { fresh: pieces.fresh, damaged: pieces.damaged };
    let left = 0;
    for (let hit = 0; hit < hits; hit++) {
        if (pieces.fresh > 0) { pieces.fresh--; pieces.damaged++; }
        else if (pieces.damaged > 0) { pieces.damaged--; }
        else { left = hits - hit; break; }
    }
    return { before: before, after: { fresh: pieces.fresh, damaged: pieces.damaged }, left: left };
}

function describeHits(label, result) {
    // e.g. "Player 2's ships: 1 destroyed, now 0 fresh and 2 damaged", or null if nothing changed
    const { before, after } = result;
    if (before.fresh == after.fresh && before.damaged == after.damaged) { return null; }
    const destroyed = before.fresh + before.damaged - after.fresh - after.damaged;
    return label + ": " + (destroyed > 0 ? destroyed + " destroyed, " : "") + "now " + after.fresh + " fresh and " + after.damaged + " damaged";
}

function applyBlightCrises() {
    // Each system with Blight (campaign rulebook p.18): each fresh Blight deals 3 hits, each damaged
    // one 1. Imperial ships take them first; once none are left, each remaining hit goes to the
    // Loyal ships of every player there. Fresh before damaged. Buildings aren't hit. Returns what
    // happened, system by system: [{ id, hits, lines }]
    return getSystemIds().filter(hasBlight).map(id => {
        const system = getSystem(id);
        const hits = system.blight.fresh * 3 + system.blight.damaged;
        const lines = [];
        const imperial = hitPieces(system.imperial, hits);
        const imperialLine = describeHits("Imperial ships", imperial);
        if (imperialLine != null) { lines.push(imperialLine); }
        // What's left once the Imperial ships are gone goes to every player there
        const left = imperial.left;
        if (left > 0) {
            const flagshipOwners = (system.flagships || []).map(flagship => flagship.owner);
            [...new Set(Object.keys(system.ships).map(Number).concat(flagshipOwners))].forEach(number => {
                const ships = { ...getShips(id, number) };
                const result = hitPieces(ships, left);
                setShips(id, number, ships.fresh, ships.damaged);
                const line = describeHits("Player " + number + "'s ships", result);
                if (line != null) { lines.push(line); }
                // A Flagship takes hits only once no other fresh Loyal ships remain: rightmost Armor,
                // then the rightmost Upgrade (campaign rulebook p.24; campaign/flagships.js)
                const player = getPlayer(number);
                if (flagshipOwners.includes(number) && result.left > 0 && ships.fresh == 0 && player != null && player.flagship != null) {
                    const hit = hitFlagship(player, result.left);
                    if (hit.length > 0) { lines.push("Player " + number + "'s Flagship: " + hit.join(", ")); }
                }
            });
        }
        return { id: id, hits: hits, lines: lines };
    });
}

function applyIntermissionToBoard() {
    // Step D (campaign rulebook p.28): repair all damaged Blight; destroy every damaged ship
    // (Imperial ones too) and building (Free ones too); then destroy the buildings in systems with
    // Blight and no ships. A bot left with no ships or starports places 3 fresh ships in a gate.
    // Returns the lines saying what changed
    const lines = [];
    getSystemIds().forEach(id => {
        const system = getSystem(id);
        const changes = [];
        if (system.blight.damaged > 0) { changes.push(system.blight.damaged + " Blight repaired"); system.blight = { fresh: system.blight.fresh + system.blight.damaged, damaged: 0 }; }
        if (system.imperial.damaged > 0) { changes.push(system.imperial.damaged + " damaged Imperial ship" + (system.imperial.damaged == 1 ? "" : "s") + " destroyed"); system.imperial.damaged = 0; }
        Object.keys(system.ships).map(Number).forEach(number => {
            const ships = getShips(id, number);
            if (ships.damaged > 0) { changes.push("Player " + number + "'s " + ships.damaged + " damaged ship" + (ships.damaged == 1 ? "" : "s") + " destroyed"); setShips(id, number, ships.fresh, 0); }
        });
        const damagedBuildings = system.buildings.filter(building => building.damaged);
        damagedBuildings.forEach(building => changes.push((building.owner == freeOwner ? "a damaged Free " : "Player " + building.owner + "'s damaged ") + building.kind + " destroyed"));
        system.buildings = system.buildings.filter(building => !building.damaged);
        const anyShips = Object.keys(system.ships).length > 0 || system.imperial.fresh + system.imperial.damaged > 0;
        if (hasBlight(id) && !anyShips && system.buildings.length > 0) {
            system.buildings.forEach(building => changes.push((building.owner == freeOwner ? "a Free " : "Player " + building.owner + "'s ") + building.kind + " destroyed by the Blight"));
            system.buildings = [];
        }
        if (changes.length > 0) { lines.push(getSystemName(id) + ": " + changes.join(", ")); }
    });
    // Damaged Upgrades and Armor on Flagships (campaign/flagships.js)
    players.forEach(player => {
        const cleared = typeof clearDamagedFlagshipPieces == "function" ? clearDamagedFlagshipPieces(player) : [];
        if (cleared.length > 0) { lines.push("Player " + player.number + "'s Flagship: damaged " + cleared.join(", ") + " destroyed"); }
    });
    // No ships or starports left: 3 fresh ships in a gate (a bot chooses one with no Blight)
    players.forEach(player => {
        // A Flagship can't be removed from the map, so its player always has a piece there
        if (getBoardShips(player.number) > 0 || getBoardBuildings(player.number, "starport").length > 0 || player.flagship != null) { return; }
        // A human player chooses a gate in the Intermission window (intermission.js)
        if (player.isHuman) { return; }
        const gate = getSystemIds().find(id => isGate(id) && !hasBlight(id)) || getSystemIds().find(isGate);
        addShips(gate, player.number, 3);
        lines.push("Player " + player.number + " has no ships or starports: 3 fresh ships at " + getSystemName(gate));
    });
    return lines;
}

function getTokenText(token) {
    // e.g. "Golem (sleeping)" or "Banner (Player 1)"
    const kind = boardTokenKinds[token.kind] || clusterTokenKinds[token.kind] || { name: token.kind };
    const extra = [kind.sides != null ? kind.sides[token.side || 0] : null, token.owner != null ? "Player " + token.owner : null].filter(text => text != null);
    return kind.name + (extra.length > 0 ? " (" + extra.join(", ") + ")" : "");
}

// The map

function getAllSystemIds() {
    const ids = [];
    for (let cluster = 1; cluster <= mapClusterCount; cluster++) { ids.push(cluster + "g", ...planetLetters.map(letter => cluster + letter)); }
    return ids;
}

function getCluster(id) { return parseInt(id); }
function isGate(id) { return id.endsWith("g"); }
function isPlanet(id) { return !isGate(id); }
function getPlanetResource(id) {
    // Shaper (Mythic) can change a planet's type for the rest of the game (board.planetTypes)
    if (!isPlanet(id)) { return null; }
    return (board != null && board.planetTypes != null && board.planetTypes[id]) || mapPlanets[id].resource;
}
function getPlanetSlots(id) { return isPlanet(id) ? mapPlanets[id].slots : 0; }
function isClusterInPlay(cluster) { return !board.outOfPlay.includes(cluster); }
function isSystemInPlay(id) { return isClusterInPlay(getCluster(id)); }

function getSystemIds() {
    // The systems in play
    return getAllSystemIds().filter(isSystemInPlay);
}

// Each planet's ID symbol, as printed on the board (rulebook p.6): an arrowhead, a crescent and a hexagon (#185)
const planetSymbolPaths = {
    a: "<path d=\"M8 1.5 L14.5 14.5 L8 10.5 L1.5 14.5 Z\"/>",
    c: "<path d=\"M7.98 2.02A6.5 6.5 0 1 0 13.79 10.15A5 5 0 0 1 7.98 2.02Z\"/>",
    h: "<polygon points=\"8,1 14.6,4.6 14.6,11.4 8,15 1.4,11.4 1.4,4.6\"/>"
};

function getPlanetSymbol(id) {
    return "<svg class=\"planetsymbol\" viewBox=\"0 0 16 16\" width=\"0.95em\" height=\"0.95em\" style=\"vertical-align:-0.1em\" fill=\"currentColor\" aria-label=\""
        + planetLetterNames[id.slice(-1)] + "\">" + planetSymbolPaths[id.slice(-1)] + "</svg>";
}

function getSystemShortName(id) {
    // e.g. "1 Gate" or "3 ⬢": the cluster number and the planet's symbol (#185)
    return isGate(id) ? getCluster(id) + " Gate" : getCluster(id) + "&nbsp;" + getPlanetSymbol(id);
}

function getSystemName(id) {
    // e.g. "1 Gate" or "3 ⬢ [icon] Weapon" (#185)
    if (isGate(id)) { return "<b class=\"text-nowrap\">" + getSystemShortName(id) + "</b>"; }
    const resource = getPlanetResource(id);
    return "<span class=\"text-nowrap\"><b>" + getSystemShortName(id) + "</b> " + getGameIcon(resource) + "&nbsp;" + preludeResourceNames[resource] + "</span>";
}

function nextCluster(cluster, step) {
    return ((cluster - 1 + step + mapClusterCount) % mapClusterCount) + 1;
}

function getNeighbourGate(cluster, step) {
    // The next gate round the map that's in play. A path marker on an out-of-play gate joins its
    // neighbours (rulebook p.6)
    let next = nextCluster(cluster, step);
    while (!isClusterInPlay(next) && next != cluster) { next = nextCluster(next, step); }
    return next == cluster ? null : next + "g";
}

function getAdjacent(id) {
    // The systems in play next to this one (rulebook p.6): a gate to its 3 planets and the
    // neighbouring gates; a planet to its gate and the neighbouring planets
    if (!isSystemInPlay(id)) { return []; }
    const cluster = getCluster(id);
    let adjacent;
    if (isGate(id)) {
        adjacent = planetLetters.map(letter => cluster + letter).concat([getNeighbourGate(cluster, -1), getNeighbourGate(cluster, 1)]);
    } else {
        const index = planetLetters.indexOf(id.slice(-1));
        adjacent = [cluster + "g"];
        // Within its cluster: the planets either side
        if (index > 0) { adjacent.push(cluster + planetLetters[index - 1]); }
        if (index < 2) { adjacent.push(cluster + planetLetters[index + 1]); }
        // Across to the neighbouring cluster, unless there's a thick border
        const across = index == 2 ? nextCluster(cluster, 1) + "a" : index == 0 ? nextCluster(cluster, -1) + "h" : null;
        if (across != null) {
            const link = index == 2 ? id + "-" + across : across + "-" + id;
            if (!blockedPlanetLinks.includes(link)) { adjacent.push(across); }
        }
    }
    return [...new Set(adjacent.filter(other => other != null && other != id && isSystemInPlay(other)))];
}

function areAdjacent(a, b) {
    return getAdjacent(a).includes(b);
}

// What's in each system

function getSystem(id) {
    return board.systems[id];
}

function getShips(id, playerNumber) {
    const ships = getSystem(id).ships[playerNumber];
    return ships != null ? ships : { fresh: 0, damaged: 0 };
}

function setShips(id, playerNumber, fresh, damaged) {
    const system = getSystem(id);
    if (fresh <= 0 && damaged <= 0) { delete system.ships[playerNumber]; return; }
    system.ships[playerNumber] = { fresh: Math.max(fresh, 0), damaged: Math.max(damaged, 0) };
}

function addShips(id, playerNumber, count, damaged = false) {
    const ships = getShips(id, playerNumber);
    setShips(id, playerNumber, ships.fresh + (damaged ? 0 : count), ships.damaged + (damaged ? count : 0));
}

function removeShips(id, playerNumber, count, damaged = false) {
    const ships = getShips(id, playerNumber);
    setShips(id, playerNumber, ships.fresh - (damaged ? 0 : count), ships.damaged - (damaged ? count : 0));
}

function moveShips(from, to, playerNumber, fresh, damaged = 0) {
    removeShips(from, playerNumber, fresh);
    removeShips(from, playerNumber, damaged, true);
    addShips(to, playerNumber, fresh);
    addShips(to, playerNumber, damaged, true);
}

function getBuildings(id, playerNumber = null, kind = null) {
    return getSystem(id).buildings.filter(building => (playerNumber == null || building.owner == playerNumber) && (kind == null || building.kind == kind));
}

function getEmptySlotCount(id) {
    // A city outside the slots (Cloud Cities) takes none
    return Math.max(getPlanetSlots(id) - getSystem(id).buildings.filter(building => !building.cloud).length, 0);
}

function getGateBuildKinds(id, playerNumber) {
    // What a player may build on a gate, max 1 of each per gate: starports with Gate Ports (Lore 8),
    // cities with Gate Stations (Lore 11). Gates have no slots otherwise
    if (!isGate(id) || typeof hasLore != "function") { return []; }
    const player = players.find(other => other.number == playerNumber);
    if (player == null) { return []; }
    return [[8, "starport"], [11, "city"]].filter(([lore, kind]) => hasLore(player, lore) && getBuildings(id, playerNumber, kind).length == 0).map(([, kind]) => kind);
}

function placeBuilding(id, playerNumber, kind, damaged = false, cloud = false) {
    // cloud: a city outside the building slots (Cloud Cities, leaderrules.js)
    if (cloud) { if (typeof canBuildCloudCity != "function" || !canBuildCloudCity(id, playerNumber)) { return false; } }
    else if (isGate(id) ? !getGateBuildKinds(id, playerNumber).includes(kind) : getEmptySlotCount(id) <= 0) { return false; }
    getSystem(id).buildings.push(cloud ? { owner: playerNumber, kind: kind, damaged: damaged, cloud: true } : { owner: playerNumber, kind: kind, damaged: damaged });
    return true;
}

function removeBuilding(id, playerNumber, kind) {
    // A damaged one first, as that's the one a battle destroys
    const buildings = getSystem(id).buildings;
    const index = buildings.findIndex(building => building.owner == playerNumber && building.kind == kind && building.damaged);
    const any = index >= 0 ? index : buildings.findIndex(building => building.owner == playerNumber && building.kind == kind);
    if (any < 0) { return false; }
    buildings.splice(any, 1);
    return true;
}

function setBuildingDamaged(id, playerNumber, kind, damaged) {
    const building = getSystem(id).buildings.find(item => item.owner == playerNumber && item.kind == kind && item.damaged != damaged);
    if (building == null) { return false; }
    building.damaged = damaged;
    return true;
}

function hasLoyalPiece(id, playerNumber) {
    const ships = getShips(id, playerNumber);
    return ships.fresh + ships.damaged > 0 || getBuildings(id, playerNumber).length > 0;
}

// Control (rulebook p.7): more fresh ships than each Rival. On a tie, no one controls it

function getController(id) {
    // A Flagship is a fresh Loyal ship (campaign rulebook p.22)
    const flagships = getSystem(id).flagships || [];
    const owners = [...new Set(Object.keys(getSystem(id).ships).map(Number).concat(flagships.map(flagship => flagship.owner)))];
    const fleets = owners.map(number => ({ number: number, fresh: getShips(id, number).fresh + flagships.filter(flagship => flagship.owner == number).length })).filter(fleet => fleet.fresh > 0);
    if (fleets.length == 0) { return null; }
    const most = Math.max(...fleets.map(fleet => fleet.fresh));
    const top = fleets.filter(fleet => fleet.fresh == most);
    return top.length == 1 ? top[0].number : null;
}

function isControlledByOther(id, playerNumber) {
    const controller = getControllerFor(id, playerNumber);
    return controller != null && controller != playerNumber;
}

// The campaign's Empire (rulebook pp.10-11; #85 stage 7b). Outside a campaign there are no
// Imperial ships or Blight, so none of this changes the base game

function isCampaignOn() {
    return typeof campaign != "undefined" && campaign != null && typeof isRegent == "function";
}

function isRegentNumber(playerNumber) {
    const player = typeof playerNumber == "number" ? getPlayer(playerNumber) : null;
    return isCampaignOn() && player != null && isRegent(player);
}

function isOutlawNumber(playerNumber) {
    const player = typeof playerNumber == "number" ? getPlayer(playerNumber) : null;
    return isCampaignOn() && player != null && !isRegent(player);
}

function hasImperialShips(id) {
    const imperial = getSystem(id).imperial;
    return imperial != null && imperial.fresh + imperial.damaged > 0;
}

function hasBlight(id) {
    const blight = getSystem(id).blight;
    return blight != null && blight.fresh + blight.damaged > 0;
}

function isEmpireControlled(id) {
    // Any fresh Imperial ship, whatever players' ships are there
    const imperial = getSystem(id).imperial;
    return imperial != null && imperial.fresh > 0;
}

function getControllerFor(id, playerNumber) {
    // Who controls it on this player's turn: the Empire's systems are theirs if they're a Regent
    // with Loyal pieces there (the Presence Law), otherwise "empire"
    if (isEmpireControlled(id)) { return isRegentNumber(playerNumber) && hasLoyalPiece(id, playerNumber) ? playerNumber : "empire"; }
    return getController(id);
}

function isCatapultStop(id, playerNumber) {
    // A gate that ends a Catapult move: any Blight; the Empire's for an Outlaw; anyone else's
    // (rulebook p.10, p.19). Control is checked before the ships move in (p.13)
    if (hasBlight(id)) { return true; }
    if (isEmpireControlled(id)) { return isOutlawNumber(playerNumber); }
    const controller = getController(id);
    return controller != null && controller != playerNumber;
}

function canHarmIn(id, attackerNumber, defenderNumber) {
    // The Truce Law: a Regent can't harm or tax a Rival Regent where there are Imperial ships
    return !(hasImperialShips(id) && isRegentNumber(attackerNumber) && isRegentNumber(defenderNumber));
}

// Moving (rulebook p.13): to an adjacent system. From a system with a Loyal starport, a Catapult
// keeps going until the ships move into a gate controlled by anyone else, or into any planet.
// Control is checked before moving in

function canCatapultFrom(from, playerNumber) {
    // A Catapult starts from a system with a Loyal starport. A Leader can change that (leaderrules.js)
    const base = getBuildings(from, playerNumber, "starport").length > 0;
    return typeof getLeaderCatapult == "function" ? getLeaderCatapult(from, playerNumber, base) : base;
}

function isBuiltDamaged(id, playerNumber, kind) {
    // A piece built in a system a Rival controls is damaged (rulebook p.12). Lore can change that
    const base = isControlledByOther(id, playerNumber);
    return typeof getLoreBuildDamaged == "function" ? getLoreBuildDamaged(id, playerNumber, kind, base) : base;
}

function getMoveDestinations(from, playerNumber, movingFresh = null, once = false) {
    // A Lore card can let fresh ships move one more time (Sprinter Drives, leaderrules.js). once: not that
    const reached = getMoveDestinationsOnce(from, playerNumber, movingFresh);
    return !once && typeof getLoreExtraMoves == "function" ? getLoreExtraMoves(from, playerNumber, reached) : reached;
}

function getMoveDestinationsOnce(from, playerNumber, movingFresh = null) {
    // Every system its ships at from could reach with one Move action. movingFresh: how many fresh
    // ships are moving (all of them at from if not given)
    const adjacent = getAdjacent(from);
    if (!canCatapultFrom(from, playerNumber)) { return adjacent; }
    const moving = movingFresh != null ? movingFresh : getShips(from, playerNumber).fresh;
    const reached = new Set();
    const queue = [from];
    while (queue.length > 0) {
        const at = queue.shift();
        getAdjacent(at).forEach(next => {
            if (next == from || reached.has(next)) { return; }
            reached.add(next);
            // It can keep going only through a gate no one else controls, checked before the ships
            // move in (rulebook p.13; #184 was looked at again and this stands)
            if (isGate(next) && !isCatapultStop(next, playerNumber)) { queue.push(next); }
        });
    }
    return [...reached];
}

function getMoveStop(from, to, playerNumber) {
    // Where ships heading for to will really stop: to if they can reach it, otherwise the first gate
    // on a Catapult route there that someone else controls (the user). null if they can't get
    // anywhere towards it
    if (canMove(from, to, playerNumber)) { return to; }
    if (!canCatapultFrom(from, playerNumber)) { return null; }
    // The shortest route through gates, whoever controls them
    const parent = { [from]: null };
    const queue = [from];
    while (queue.length > 0 && parent[to] === undefined) {
        const at = queue.shift();
        if (at != from && !isGate(at)) { continue; }
        getAdjacent(at).forEach(next => { if (parent[next] === undefined) { parent[next] = at; queue.push(next); } });
    }
    if (parent[to] === undefined) { return null; }
    const route = [];
    for (let at = to; at != from; at = parent[at]) { route.unshift(at); }
    return route.find(id => id == to || (isGate(id) && isControlledByOther(id, playerNumber))) || null;
}

function canMove(from, to, playerNumber, movingFresh = null) {
    return getMoveDestinations(from, playerNumber, movingFresh).includes(to);
}

// Totals, for the panels and the bots

function getBoardShips(playerNumber) {
    return getSystemIds().reduce((total, id) => { const ships = getShips(id, playerNumber); return total + ships.fresh + ships.damaged; }, 0);
}

function getBoardBuildings(playerNumber, kind) {
    return getSystemIds().flatMap(id => getBuildings(id, playerNumber, kind).map(building => ({ ...building, system: id })));
}

function getGateCityTypes(gate) {
    // A gate city (Gate Stations) matches all cities in its cluster: the types of the planets there
    // with a city on, anyone's (Lore 11). It can be taxed for any of them, and destroying it Provokes
    // Outrage of all of them
    const cluster = getCluster(gate);
    return preludeResources.filter(resource => getSystemIds().some(id => isPlanet(id) && getCluster(id) == cluster && getPlanetResource(id) == resource && getBuildings(id, null, "city").length > 0));
}

function getCityTypes(id) {
    // What a city in this system counts as: its planet's type, or a gate city's types
    if (isGate(id)) { return getGateCityTypes(id); }
    const resource = getPlanetResource(id);
    return resource != null ? [resource] : [];
}

function getBoardCities(playerNumber, resource = null) {
    // Its cities, or those that count as this type: a gate city counts as each of its types
    return getBoardBuildings(playerNumber, "city").filter(city => resource == null || getCityTypes(city.system).includes(resource));
}

function getSystemsWithShips(playerNumber) {
    return getSystemIds().filter(id => { const ships = getShips(id, playerNumber); return ships.fresh + ships.damaged > 0; });
}

function getControlledSystems(playerNumber) {
    return getSystemIds().filter(id => getController(id) == playerNumber);
}

function getBuildableSystems(playerNumber) {
    // Planets with an empty slot and a Loyal piece (rulebook p.12), and gates it may build on with
    // Gate Ports or Gate Stations
    return getSystemIds().filter(id => (isPlanet(id) ? getEmptySlotCount(id) > 0 : getGateBuildKinds(id, playerNumber).length > 0) && hasLoyalPiece(id, playerNumber));
}

function getTaxableCities(playerNumber) {
    // Its Loyal cities, and Rival cities in systems it controls (rulebook p.12). A gate city once for
    // each of its types, as it can be taxed for any one of them (Gate Stations)
    const cities = getSystemIds().flatMap(id => getBuildings(id, null, "city")
        // In a campaign: the Empire's systems where it has Presence, but not a Rival Regent's city where
        // there are Imperial ships (the Truce Law)
        .filter(city => city.owner == playerNumber || (getControllerFor(id, playerNumber) == playerNumber && canHarmIn(id, playerNumber, city.owner)))
        .flatMap(city => getCityTypes(id).map(resource => ({ system: id, owner: city.owner, resource: resource, gate: isGate(id) }))));
    // Leaders that change what can be taxed (leaderrules.js)
    return typeof getLeaderTaxableCities == "function" ? getLeaderTaxableCities(playerNumber, cities) : cities;
}

// The setup cards (rulebook p.4-5): the clusters out of play, and each seat's A, B and C systems.
// Seat 1 has the initiative, then clockwise. A has a city and 3 ships, B a starport and 3 ships,
// C 2 ships (in each of two systems with 2 players). Read from the cards with the map's cluster
// numbers: clockwise from the top 1-6, and within a cluster a, c, h clockwise
const setupCards = [
    { name: "Frontiers", players: 2, experienced: true, outOfPlay: [1, 6], seats: [["5h", "4h", ["3g", "3h"]], ["3a", "5a", ["5g", "4a"]]] },
    { name: "Mix Up 1", players: 2, outOfPlay: [2, 5], seats: [["4c", "3c", ["1g", "6a"]], ["6h", "3h", ["4g", "1c"]]] },
    { name: "Homelands", players: 2, outOfPlay: [1, 4], seats: [["5a", "6a", ["5g", "5h"]], ["3h", "3a", ["3g", "2a"]]] },
    { name: "Mix Up 2", players: 2, outOfPlay: [1, 4], seats: [["5c", "2a", ["3g", "6c"]], ["2c", "6a", ["5g", "3h"]]] },
    { name: "Mix Up", players: 3, outOfPlay: [1, 4], seats: [["3h", "5c", ["2g"]], ["5h", "2a", ["3g"]], ["2h", "3a", ["5g"]]] },
    { name: "Frontiers", players: 3, outOfPlay: [2, 3], seats: [["1h", "4h", ["6g"]], ["5h", "1c", ["5g"]], ["4c", "6a", ["1g"]]] },
    { name: "Homelands", players: 3, outOfPlay: [5, 6], seats: [["2h", "3c", ["3g"]], ["1h", "2a", ["2g"]], ["1a", "4h", ["4g"]]] },
    { name: "Core Conflict", players: 3, experienced: true, outOfPlay: [3, 6], seats: [["1h", "2c", ["1g"]], ["2h", "1c", ["2g"]], ["1a", "2a", ["4g"]]] },
    { name: "Mix Up 1", players: 4, outOfPlay: [3], seats: [["4a", "6h", ["1g"]], ["4h", "5h", ["6g"]], ["5a", "1h", ["4g"]], ["6a", "1a", ["5g"]]] },
    { name: "Mix Up 2", players: 4, outOfPlay: [4], seats: [["5h", "3a", ["2g"]], ["3h", "5c", ["1g"]], ["2h", "1h", ["3g"]], ["1a", "2a", ["5g"]]] },
    { name: "Frontiers", players: 4, outOfPlay: [5], seats: [["1h", "3c", ["2g"]], ["2h", "6h", ["3g"]], ["4c", "2a", ["6g"]], ["1a", "6a", ["4g"]]] },
    { name: "Mix Up 3", players: 4, outOfPlay: [6], seats: [["3h", "5c", ["1g"]], ["1a", "3a", ["2g"]], ["1h", "4h", ["3g"]], ["4a", "2c", ["5g"]]] }
];

function getSetupCards(count) {
    return setupCards.filter(card => card.players == count);
}

function getStartingPieces(player) {
    // [[building, ships] for A, B and C]: the usual ones, or its Leader's (Leaders & Lore)
    return (leadersAndLore && player.leader != null) ? getLeaderCard(player.leader).pieces : [["city", 3], ["starport", 3], [null, 2]];
}

// Where the ambition boxes' resources come from with 2 players (rulebook p.4, step K)
const outOfPlayAmbitions = { materials: "tycoon", fuel: "tycoon", weapons: "warlord", relics: "keeper", psionics: "empath" };

function applySetupCard(card) {
    // Everyone's starting pieces on the board, their starting resources (from their A and B
    // planets, unless their Leader gave them theirs) and, with 2 players, the ambition boxes
    board = newBoard();
    board.outOfPlay = card.outOfPlay.slice();
    board.setupCard = card.name;
    const place = (id, player, [building, ships]) => {
        addShips(id, player.number, ships);
        if (building != null) { placeBuilding(id, player.number, building); }
    };
    getTurnOrder().forEach((player, seat) => {
        const [a, b, c] = card.seats[seat];
        const pieces = getStartingPieces(player);
        place(a, player, pieces[0]);
        place(b, player, pieces[1]);
        c.forEach(id => place(id, player, pieces[2]));
        if (!(leadersAndLore && player.leader != null)) {
            [a, b].forEach(id => { const resource = getPlanetResource(id); setPlayerResource(player, resource, player[resource + "Value"] + 1); });
        }
        player.startingCity = 0;
        syncPanelFromBoard(player);
    });
    if (players.length == 2) {
        neutralCounts = {};
        getAllSystemIds().filter(id => isPlanet(id) && !isSystemInPlay(id)).forEach(id => {
            const ambition = outOfPlayAmbitions[getPlanetResource(id)];
            neutralCounts[ambition] = (neutralCounts[ambition] || 0) + 1;
        });
    }
    SaveAllSettings();
}

function syncPanelFromBoard(player) {
    // The panel's board tiles follow the board: ships on it, starports and cities by planet type
    setPlayerResource(player, "shipsBoard", getBoardShips(player.number));
    setPlayerResource(player, "starports", getBoardBuildings(player.number, "starport").length);
    // Each city once, by its planet's type. A gate city under its first type, so the total is right;
    // its other types count through the board (getBoardCities). With no type yet, startingCity holds it
    const cities = getBoardBuildings(player.number, "city");
    const counted = resource => cities.filter(city => getCityTypes(city.system)[0] == resource).length;
    cityCounters.forEach(counter => setPlayerResource(player, counter, counted(counter.replace(/^cities/, "").toLowerCase())));
    player.startingCity = cities.filter(city => getCityTypes(city.system).length == 0).length;
    const total = document.getElementById("citiestotal" + player.number);
    if (total != null) { total.innerHTML = getCityCount(player); }
    // A campaign Flagship's section (campaign/flagships.js)
    if (typeof renderFlagshipSection == "function" && player.flagship != null) { renderFlagshipSection(player); }
}

function getPiecesText(id) {
    // e.g. "Player 1: 3 ships, a city. Player 2: 2 ships (1 damaged)"
    const system = getSystem(id);
    const count = (pieces, word) => pieces.fresh + pieces.damaged > 0 ? (pieces.fresh + pieces.damaged) + " " + word + (pieces.damaged > 0 ? " (" + pieces.damaged + " damaged)" : "") : null;
    const owners = [...new Set(Object.keys(system.ships).map(Number).concat(system.buildings.map(building => building.owner).filter(owner => owner != freeOwner), (system.flagships || []).map(flagship => flagship.owner)))].sort();
    const lines = owners.map(number => {
        const ships = getShips(id, number);
        const parts = [];
        if (ships.fresh + ships.damaged > 0) { parts.push((ships.fresh + ships.damaged) + " ship" + (ships.fresh + ships.damaged == 1 ? "" : "s") + (ships.damaged > 0 ? " (" + ships.damaged + " damaged)" : "")); }
        getBuildings(id, number).forEach(building => parts.push("a " + (building.damaged ? "damaged " : "") + building.kind));
        (system.flagships || []).filter(flagship => flagship.owner == number).forEach(flagship => parts.push("a " + (flagship.damaged ? "damaged " : "") + "Flagship"));
        return "Player " + number + ": " + parts.join(", ");
    });
    // The campaign's pieces (#85)
    const imperial = system.imperial != null ? count(system.imperial, "Imperial ship" + (system.imperial.fresh + system.imperial.damaged == 1 ? "" : "s")) : null;
    if (imperial != null) { lines.push(imperial); }
    const free = getBuildings(id, freeOwner).map(building => "a " + (building.damaged ? "damaged " : "") + "Free " + building.kind);
    if (free.length > 0) { lines.push(free.join(", ")); }
    const blight = system.blight != null ? count(system.blight, "Blight") : null;
    if (blight != null) { lines.push(blight); }
    (system.tokens || []).forEach(token => lines.push(getTokenText(token)));
    return lines.join(". ");
}

// Saving: with the rest of the game (storage.js)

// An empty board until a game is started or loaded
board = newBoard();

function loadBoard() {
    const saved = getSettingObject("board");
    board = (saved != null && saved.systems != null) ? saved : newBoard();
    // Games saved before a system, or the campaign's pieces, existed
    getAllSystemIds().forEach(id => { board.systems[id] = Object.assign(newSystem(), board.systems[id] || {}); });
    if (board.clusterTokens == null) { board.clusterTokens = {}; }
}
