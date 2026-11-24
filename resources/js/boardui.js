// Checking the board (#160): what the app has in each system, one cluster at a time, to compare with
// the map and correct. At the end of each round, and from Check the board in the Options window.
// There's no map on screen: each system is a list of its pieces with − and + (board.js).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// { cluster, onDone, adding: { id, kind } } while the window is open
let boardCheck = null;

function getClustersInPlay() {
    return Array.from({ length: mapClusterCount }, (_, index) => index + 1).filter(isClusterInPlay);
}

function showBoardCheck(onDone = null) {
    boardCheck = { cluster: getClustersInPlay()[0], onDone: onDone, adding: null };
    renderBoardCheck();
    showLockedModal(document.getElementById("boardModal"));
}

function openBoardCheckFromOptions() {
    // From the Options window, once it has closed
    const options = document.getElementById("numberOfPlayersModal");
    options.addEventListener('hidden.bs.modal', () => showBoardCheck(), { once: true });
    bootstrap.Modal.getOrCreateInstance(options).hide();
}

function renderBoardCheck() {
    const clusters = getClustersInPlay();
    const index = clusters.indexOf(boardCheck.cluster);
    const cluster = boardCheck.cluster;
    const ids = [cluster + "g"].concat(planetLetters.map(letter => cluster + letter));
    const step = (onclick, value, label) => "<span class=\"favorstep\"><button type=\"button\" onclick=\"" + onclick.replace("CHANGE", "-1") + "\" aria-label=\"One fewer " + label + "\"><i class=\"bi bi-dash\"></i></button><b>" + value + "</b>"
        + "<button type=\"button\" onclick=\"" + onclick.replace("CHANGE", "1") + "\" aria-label=\"One more " + label + "\"><i class=\"bi bi-plus\"></i></button></span>";
    const systemHtml = id => {
        const system = getSystem(id);
        const ships = Object.keys(system.ships).map(Number).sort().map(number => {
            const count = getShips(id, number);
            return "<div class=\"d-flex align-items-center flex-wrap gap-2 mb-1\">" + getPlayerTag(getPlayer(number)) + "<span class=\"small\">ships</span>"
                + step("stepBoardShips('" + id + "', " + number + ", false, CHANGE)", count.fresh, "ship") + "<span class=\"small text-secondary\">damaged</span>"
                + step("stepBoardShips('" + id + "', " + number + ", true, CHANGE)", count.damaged, "damaged ship") + "</div>";
        }).join("");
        const buildings = system.buildings.map((building, position) => "<div class=\"d-flex align-items-center gap-2 mb-1\">" + getPlayerTag(getPlayer(building.owner))
            + "<span class=\"small\">" + building.kind + (building.damaged ? " (damaged)" : "") + "</span>"
            + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0 ms-auto\" onclick=\"toggleBoardBuilding('" + id + "', " + position + ")\">" + (building.damaged ? "Repaired" : "Damaged") + "</button>"
            + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"removeBoardBuilding('" + id + "', " + position + ")\" aria-label=\"Remove it\"><i class=\"bi bi-x-lg\"></i></button></div>").join("");
        const adding = boardCheck.adding != null && boardCheck.adding.id == id
            ? "<div class=\"d-flex flex-wrap gap-1 mt-1\"><span class=\"small align-self-center\">Whose " + (boardCheck.adding.kind == "ship" ? "ship" : boardCheck.adding.kind) + "?</span>"
                + players.map(player => "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"addBoardPiece('" + id + "', " + player.number + ")\">" + getPlayerTag(player) + "</button>").join("")
                + "<button type=\"button\" class=\"btn btn-sm btn-link py-0\" onclick=\"startBoardAdd(null)\">Cancel</button></div>"
            : "<div class=\"d-flex gap-1 mt-1\"><button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"startBoardAdd('" + id + "', 'ship')\">+ Ships</button>"
                + (getEmptySlotCount(id) > 0 ? "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"startBoardAdd('" + id + "', 'city')\">+ City</button>"
                    + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"startBoardAdd('" + id + "', 'starport')\">+ Starport</button>" : "") + "</div>";
        // Its name, with the short code in grey (#185)
        const title = getSystemName(id) + " <small class=\"text-secondary\">" + id + (isGate(id) ? "" : " &middot; " + getPlanetSlots(id) + " slot" + (getPlanetSlots(id) == 1 ? "" : "s")) + "</small>";
        return "<div class=\"turnsection\"><div class=\"turnlabel\">" + title + "</div>"
            + (ships + buildings == "" ? "<div class=\"small text-secondary\">Empty</div>" : ships + buildings) + adding + "</div>";
    };
    const tabs = "<div class=\"d-flex flex-wrap gap-1 mb-2\">" + clusters.map(number => "<button type=\"button\" class=\"btn btn-sm " + (number == cluster ? "btn-secondary" : "btn-outline-secondary")
        + "\" style=\"min-width:44px\" onclick=\"showBoardCluster(" + number + ")\">" + number + "</button>").join("") + "<span class=\"small text-secondary align-self-center ms-1\">clusters in play</span></div>";
    const previous = index > 0 ? "<button type=\"button\" class=\"btn btn-outline-secondary flex-fill\" onclick=\"showBoardCluster(" + clusters[index - 1] + ")\">&larr; Cluster " + clusters[index - 1] + "</button>" : "";
    const next = index < clusters.length - 1
        ? "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"boardNext\" onclick=\"showBoardCluster(" + clusters[index + 1] + ")\">Cluster " + clusters[index + 1] + " &rarr;</button>"
        : "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"boardDone\" onclick=\"finishBoardCheck()\">Done</button>";
    document.getElementById("boardTitle").innerHTML = "Check the board";
    document.getElementById("boardBody").innerHTML = "<p class=\"small mb-2\">Check what the app has against the map, one cluster at a time. Change anything that's different.</p>"
        + tabs + ids.map(systemHtml).join("")
        + "<div class=\"d-flex gap-2 mt-2\">" + previous + next + "</div>"
        + (index < clusters.length - 1 ? "<button type=\"button\" class=\"btn btn-link btn-sm w-100 mt-1\" id=\"boardSkip\" onclick=\"finishBoardCheck()\">It all matches: done</button>" : "");
}

function showBoardCluster(cluster) {
    boardCheck.cluster = cluster;
    boardCheck.adding = null;
    renderBoardCheck();
    document.getElementById("boardBody").scrollTop = 0;
}

function boardChanged() {
    // Saved, and the panels follow
    players.forEach(syncPanelFromBoard);
    SaveAllSettings();
    renderBoardCheck();
}

function stepBoardShips(id, playerNumber, damaged, change) {
    if (change > 0) { addShips(id, playerNumber, 1, damaged); } else { removeShips(id, playerNumber, 1, damaged); }
    boardChanged();
}

function startBoardAdd(id, kind) {
    boardCheck.adding = id == null ? null : { id: id, kind: kind };
    renderBoardCheck();
}

function addBoardPiece(id, playerNumber) {
    const kind = boardCheck.adding.kind;
    if (kind == "ship") { addShips(id, playerNumber, 1); } else { placeBuilding(id, playerNumber, kind); }
    boardCheck.adding = null;
    boardChanged();
}

function toggleBoardBuilding(id, position) {
    const building = getSystem(id).buildings[position];
    if (building != null) { building.damaged = !building.damaged; }
    boardChanged();
}

function removeBoardBuilding(id, position) {
    getSystem(id).buildings.splice(position, 1);
    boardChanged();
}

function finishBoardCheck() {
    const then = boardCheck != null ? boardCheck.onDone : null;
    boardCheck = null;
    const modal = document.getElementById("boardModal");
    if (then != null) { modal.addEventListener('hidden.bs.modal', () => then(), { once: true }); }
    bootstrap.Modal.getOrCreateInstance(modal).hide();
}
