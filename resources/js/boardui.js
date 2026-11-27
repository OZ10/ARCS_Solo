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
    // The Gate Wraith's Twisted Passage has a page of its own after the clusters ("0", campaign/gatewraith.js)
    const clusters = getClustersInPlay().concat(hasTwistedPassage() ? [0] : []);
    if (!clusters.includes(boardCheck.cluster)) { boardCheck.cluster = clusters[0]; }
    const index = clusters.indexOf(boardCheck.cluster);
    const cluster = boardCheck.cluster;
    const ids = cluster == 0 ? [twistedPassageId] : [cluster + "g"].concat(planetLetters.map(letter => cluster + letter));
    const pageName = number => number == 0 ? "Twisted Passage" : "Cluster " + number;
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
        const button = (label, onclick, extra = "") => "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0" + extra + "\" onclick=\"" + onclick + "\">" + label + "</button>";
        const ownerTag = owner => owner == freeOwner ? "<b>Free</b>" : getPlayerTag(getPlayer(owner));
        const buildings = system.buildings.map((building, position) => "<div class=\"d-flex align-items-center gap-2 mb-1\">" + ownerTag(building.owner)
            + "<span class=\"small\">" + building.kind + (building.damaged ? " (damaged)" : "") + "</span>"
            + button(building.damaged ? "Repaired" : "Damaged", "toggleBoardBuilding('" + id + "', " + position + ")", " ms-auto")
            + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"removeBoardBuilding('" + id + "', " + position + ")\" aria-label=\"Remove it\"><i class=\"bi bi-x-lg\"></i></button></div>").join("");
        // The campaign's pieces (#85, stage 7a): Imperial ships, Blight, Flagships and Fate tokens
        const inCampaign = isCampaignBoard();
        const counted = (label, kind) => { const pieces = system[kind]; return "<div class=\"d-flex align-items-center flex-wrap gap-2 mb-1\"><b>" + label + "</b>"
            + step("stepBoardPieces('" + id + "', '" + kind + "', false, CHANGE)", pieces.fresh, label) + "<span class=\"small text-secondary\">damaged</span>"
            + step("stepBoardPieces('" + id + "', '" + kind + "', true, CHANGE)", pieces.damaged, "damaged " + label) + "</div>"; };
        const campaignPieces = !inCampaign ? "" :
            (system.imperial.fresh + system.imperial.damaged > 0 ? counted("Imperial", "imperial") : "")
            + (system.blight.fresh + system.blight.damaged > 0 ? counted("Blight", "blight") : "")
            // A Flagship is always fresh: its Upgrades and Armor take the hits (campaign rulebook p.22)
            + system.flagships.map((flagship, position) => "<div class=\"d-flex align-items-center gap-2 mb-1\">" + getPlayerTag(getPlayer(flagship.owner)) + "<span class=\"small\">Flagship <span class=\"text-secondary\">(Upgrades and Armor on its Flagship board)</span></span>"
                + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0 ms-auto\" onclick=\"removeBoardFlagship('" + id + "', " + position + ")\" aria-label=\"Remove it\"><i class=\"bi bi-x-lg\"></i></button></div>").join("")
            + (system.tokens.length > 0 ? "<div class=\"d-flex flex-wrap gap-1 mb-1\">" + system.tokens.map((token, position) => "<span class=\"badge rounded-pill text-bg-light border\">" + tagPlayerNames(getTokenText(token))
                + ((boardTokenKinds[token.kind] || {}).sides ? " <a href=\"#\" onclick=\"flipBoardToken('" + id + "', " + position + "); return false;\">flip</a>" : "")
                + " <a href=\"#\" class=\"text-secondary\" onclick=\"removeBoardToken('" + id + "', " + position + "); return false;\" aria-label=\"Remove it\"><i class=\"bi bi-x-lg\"></i></a></span>").join("") + "</div>" : "");
        let adding;
        if (boardCheck.adding != null && boardCheck.adding.id == id) {
            const kind = boardCheck.adding.kind;
            const cancel = "<button type=\"button\" class=\"btn btn-sm btn-link py-0\" onclick=\"startBoardAdd(null)\">Cancel</button>";
            if (kind == "token") {
                adding = "<div class=\"d-flex flex-wrap gap-1 mt-1\"><span class=\"small align-self-center\">Which token?</span>"
                    + Object.entries(boardTokenKinds).map(([key, token]) => button(token.name, "addBoardToken('" + id + "', '" + key + "')")).join("") + cancel + "</div>";
            } else if (kind == "tokenOwner") {
                adding = "<div class=\"d-flex flex-wrap gap-1 mt-1\"><span class=\"small align-self-center\">Whose " + boardTokenKinds[boardCheck.adding.token].name + "?</span>"
                    + players.map(player => button(getPlayerTag(player), "addBoardToken('" + id + "', '" + boardCheck.adding.token + "', " + player.number + ")")).join("") + cancel + "</div>";
            } else {
                // Free cities and starports in a campaign
                const free = inCampaign && (kind == "city" || kind == "starport") ? button("<b>Free</b>", "addBoardPiece('" + id + "', '" + freeOwner + "')") : "";
                adding = "<div class=\"d-flex flex-wrap gap-1 mt-1\"><span class=\"small align-self-center\">Whose " + kind + "?</span>"
                    + players.map(player => button(getPlayerTag(player), "addBoardPiece('" + id + "', " + player.number + ")")).join("") + free + cancel + "</div>";
            }
        } else {
            adding = "<div class=\"d-flex flex-wrap gap-1 mt-1\">" + button("+ Ships", "startBoardAdd('" + id + "', 'ship')")
                + (getEmptySlotCount(id) > 0 ? button("+ City", "startBoardAdd('" + id + "', 'city')") + button("+ Starport", "startBoardAdd('" + id + "', 'starport')") : "")
                + (inCampaign ? button("+ Imperial", "stepBoardPieces('" + id + "', 'imperial', false, 1)") + button("+ Blight", "stepBoardPieces('" + id + "', 'blight', false, 1)")
                    + button("+ Flagship", "startBoardAdd('" + id + "', 'flagship')") + button("+ Token", "startBoardAdd('" + id + "', 'token')") : "") + "</div>";
        }
        // Its name, with the short code in grey (#185)
        const title = getSystemName(id) + " <small class=\"text-secondary\">" + id + (isGate(id) ? "" : " &middot; " + getPlanetSlots(id) + " slot" + (getPlanetSlots(id) == 1 ? "" : "s")) + "</small>";
        const pieces = ships + buildings + campaignPieces;
        return "<div class=\"turnsection " + getSystemBarClass(id) + "\"><div class=\"turnlabel\" style=\"text-transform:none\">" + title + "</div>"
            + (pieces == "" ? "<div class=\"small text-secondary\">Empty</div>" : pieces) + adding + "</div>";
    };
    // A cluster's own tokens, such as a Ceasefire
    const clusterTokens = (board.clusterTokens[cluster] || []).map((token, position) => "<div class=\"small text-secondary mb-2\">Cluster " + cluster + " &middot; " + getTokenText(token)
        + " <a href=\"#\" onclick=\"flipClusterToken(" + cluster + ", " + position + "); return false;\">flip</a></div>").join("");
    const tabs = "<div class=\"d-flex flex-wrap gap-1 mb-2\">" + clusters.map(number => "<button type=\"button\" class=\"btn btn-sm " + (number == cluster ? "btn-secondary" : "btn-outline-secondary")
        + "\" style=\"min-width:44px\" onclick=\"showBoardCluster(" + number + ")\">" + (number == 0 ? "Twisted Passage" : number) + "</button>").join("") + "<span class=\"small text-secondary align-self-center ms-1\">clusters in play</span></div>";
    const previous = index > 0 ? "<button type=\"button\" class=\"btn btn-outline-secondary flex-fill\" onclick=\"showBoardCluster(" + clusters[index - 1] + ")\">&larr; " + pageName(clusters[index - 1]) + "</button>" : "";
    const next = index < clusters.length - 1
        ? "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"boardNext\" onclick=\"showBoardCluster(" + clusters[index + 1] + ")\">" + pageName(clusters[index + 1]) + " &rarr;</button>"
        : "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"boardDone\" onclick=\"finishBoardCheck()\">Done</button>";
    document.getElementById("boardTitle").innerHTML = "Check the board";
    document.getElementById("boardBody").innerHTML = "<p class=\"small mb-2\">Check what the app has against the map, one cluster at a time. Change anything that's different.</p>"
        + tabs + (cluster == 0 ? getTwistedPassageCheckHtml() : "") + ids.map(systemHtml).join("") + clusterTokens
        + (cluster == 0 ? getDeadLiveCheckHtml() : "")
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
    if (kind == "ship") { addShips(id, playerNumber, 1); }
    else if (kind == "flagship") { getFlagships(id).push({ owner: playerNumber, damaged: false }); }
    else { placeBuilding(id, playerNumber, kind); }
    boardCheck.adding = null;
    boardChanged();
}

// The campaign's pieces (#85, stage 7a)

function isCampaignBoard() {
    return typeof campaign != "undefined" && campaign != null;
}

function stepBoardPieces(id, kind, damaged, change) {
    // Imperial ships or Blight
    const pieces = getSystem(id)[kind];
    const field = damaged ? "damaged" : "fresh";
    pieces[field] = Math.max(pieces[field] + change, 0);
    boardChanged();
}

function addBoardToken(id, kind, owner = null) {
    if (boardTokenKinds[kind].owned && owner == null) {
        boardCheck.adding = { id: id, kind: "tokenOwner", token: kind };
        renderBoardCheck();
        return;
    }
    addToken(id, kind, owner);
    boardCheck.adding = null;
    boardChanged();
}

function flipBoardToken(id, position) {
    const token = getTokens(id)[position];
    if (token != null) { token.side = token.side ? 0 : 1; }
    boardChanged();
}

function removeBoardToken(id, position) {
    getTokens(id).splice(position, 1);
    boardChanged();
}

function flipClusterToken(cluster, position) {
    const token = (board.clusterTokens[cluster] || [])[position];
    if (token != null) { token.side = token.side ? 0 : 1; }
    boardChanged();
}

function toggleBoardFlagship(id, position) {
    const flagship = getFlagships(id)[position];
    if (flagship != null) { flagship.damaged = !flagship.damaged; }
    boardChanged();
}

function removeBoardFlagship(id, position) {
    getFlagships(id).splice(position, 1);
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
