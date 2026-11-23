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
    "5a": { resource: "weapons", slots: 2 }, "5c": { resource: "relics", slots: 1 }, "5h": { resource: "psionics", slots: 2 },
    "6a": { resource: "materials", slots: 1 }, "6c": { resource: "fuel", slots: 2 }, "6h": { resource: "psionics", slots: 1 }
};

// Neighbouring planets in different clusters separated by a thick border: not adjacent
const blockedPlanetLinks = ["1h-2a", "3h-4a", "4h-5a", "6h-1a"];

// The board: which clusters are out of play, and each system's pieces:
// { outOfPlay: [cluster], systems: { id: { ships: { player: { fresh, damaged } }, buildings: [{ owner, kind, damaged }] } } }
// kind is "city" or "starport"
function newBoard() {
    const systems = {};
    getAllSystemIds().forEach(id => { systems[id] = { ships: {}, buildings: [] }; });
    return { outOfPlay: [], systems: systems };
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
function getPlanetResource(id) { return isPlanet(id) ? mapPlanets[id].resource : null; }
function getPlanetSlots(id) { return isPlanet(id) ? mapPlanets[id].slots : 0; }
function isClusterInPlay(cluster) { return !board.outOfPlay.includes(cluster); }
function isSystemInPlay(id) { return isClusterInPlay(getCluster(id)); }

function getSystemIds() {
    // The systems in play
    return getAllSystemIds().filter(isSystemInPlay);
}

function getSystemName(id) {
    // e.g. "2h (Relic)" or "3 gate"
    return isGate(id) ? getCluster(id) + " gate" : id + " (" + preludeResourceNames[getPlanetResource(id)] + ")";
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
    return Math.max(getPlanetSlots(id) - getSystem(id).buildings.length, 0);
}

function placeBuilding(id, playerNumber, kind, damaged = false) {
    if (getEmptySlotCount(id) <= 0) { return false; }
    getSystem(id).buildings.push({ owner: playerNumber, kind: kind, damaged: damaged });
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
    const fleets = Object.entries(getSystem(id).ships).map(([number, ships]) => ({ number: parseInt(number), fresh: ships.fresh })).filter(fleet => fleet.fresh > 0);
    if (fleets.length == 0) { return null; }
    const most = Math.max(...fleets.map(fleet => fleet.fresh));
    const top = fleets.filter(fleet => fleet.fresh == most);
    return top.length == 1 ? top[0].number : null;
}

function isControlledByOther(id, playerNumber) {
    const controller = getController(id);
    return controller != null && controller != playerNumber;
}

// Moving (rulebook p.13): to an adjacent system. From a system with a Loyal starport, a Catapult
// keeps going until the ships move into a gate controlled by anyone else, or into any planet.
// Control is checked before moving in

function getMoveDestinations(from, playerNumber) {
    // Every system its ships at from could reach with one Move action
    const adjacent = getAdjacent(from);
    if (getBuildings(from, playerNumber, "starport").length == 0) { return adjacent; }
    const reached = new Set();
    const queue = [from];
    while (queue.length > 0) {
        const at = queue.shift();
        getAdjacent(at).forEach(next => {
            if (next == from || reached.has(next)) { return; }
            reached.add(next);
            // It can keep going only through a gate no one else controls
            if (isGate(next) && !isControlledByOther(next, playerNumber)) { queue.push(next); }
        });
    }
    return [...reached];
}

function canMove(from, to, playerNumber) {
    return getMoveDestinations(from, playerNumber).includes(to);
}

// Totals, for the panels and the bots

function getBoardShips(playerNumber) {
    return getSystemIds().reduce((total, id) => { const ships = getShips(id, playerNumber); return total + ships.fresh + ships.damaged; }, 0);
}

function getBoardBuildings(playerNumber, kind) {
    return getSystemIds().flatMap(id => getBuildings(id, playerNumber, kind).map(building => ({ ...building, system: id })));
}

function getBoardCities(playerNumber, resource = null) {
    return getBoardBuildings(playerNumber, "city").filter(city => resource == null || getPlanetResource(city.system) == resource);
}

function getSystemsWithShips(playerNumber) {
    return getSystemIds().filter(id => { const ships = getShips(id, playerNumber); return ships.fresh + ships.damaged > 0; });
}

function getControlledSystems(playerNumber) {
    return getSystemIds().filter(id => getController(id) == playerNumber);
}

function getBuildableSystems(playerNumber) {
    // Planets with an empty slot and a Loyal piece (rulebook p.12)
    return getSystemIds().filter(id => isPlanet(id) && getEmptySlotCount(id) > 0 && hasLoyalPiece(id, playerNumber));
}

function getTaxableCities(playerNumber) {
    // Its Loyal cities, and Rival cities in systems it controls (rulebook p.12)
    return getSystemIds().flatMap(id => getBuildings(id, null, "city")
        .filter(city => city.owner == playerNumber || getController(id) == playerNumber)
        .map(city => ({ system: id, owner: city.owner, resource: getPlanetResource(id) })));
}

// Saving: with the rest of the game (storage.js)

// An empty board until a game is started or loaded
board = newBoard();

function loadBoard() {
    const saved = getSettingObject("board");
    board = (saved != null && saved.systems != null) ? saved : newBoard();
    // Games saved before a system existed
    getAllSystemIds().forEach(id => { if (board.systems[id] == null) { board.systems[id] = { ships: {}, buildings: [] }; } });
}
