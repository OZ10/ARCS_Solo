// Collapsible panel sections (#152). Each player's Resources (with Outrage), Board and Guild cards
// sit under a header that can be tapped to open or close them; a closed header shows small counts.
// The hand and Play Card always show. Options chooses how they start (saved on the device):
// "open" (always open), "turn" (closed until the player has played, then open until the next
// player's turn) or "closed" (tap to open). A closed section the app changes (after a battle, a tax,
// a prelude or scoring) opens until the next player's turn.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const panelSectionModes = ["open", "turn", "closed"];
const defaultPanelSectionMode = "turn";
const panelSectionKeys = ["res", "board", "guild"];
const panelSectionTitles = { res: "Resources", board: "Board", guild: "Guild cards" };
let panelSectionMode = defaultPanelSectionMode;

// By player number: { manual: { key: open }, flash: { key: true }, seen: { key: signature } }
let panelSectionState = {};

function getPanelSectionState(player) {
    if (panelSectionState[player.number] == null) { panelSectionState[player.number] = { manual: {}, flash: {}, seen: {} }; }
    return panelSectionState[player.number];
}

function setUpPanelSections(player, playerPanel) {
    // Wrap the panel's sections in headers. Called on the panel copied from the template
    const number = player.number;
    const resourcesLabel = playerPanel.querySelector(":scope > .sectionlabel");
    const tiles = resourcesLabel.nextElementSibling;
    const outrage = playerPanel.querySelector(".outragerow");
    const board = playerPanel.querySelector(".boardsection");
    const guild = playerPanel.querySelector("#guildcards" + number);
    resourcesLabel.remove();
    const boardLabel = board.querySelector(":scope > .sectionlabel");
    if (boardLabel != null) { boardLabel.remove(); }

    const wrap = (key, elements) => {
        const header = document.createElement("button");
        header.type = "button";
        header.className = "secthead";
        header.id = "secthead_" + key + "_" + number;
        header.setAttribute("aria-controls", "sectbody_" + key + "_" + number);
        header.setAttribute("onclick", "togglePanelSection(" + number + ", '" + key + "')");
        header.innerHTML = "<span class=\"sectionlabel\">" + panelSectionTitles[key] + "</span><span class=\"sectmini\" id=\"sectmini_" + key + "_" + number + "\"></span><i class=\"sectchevron bi bi-chevron-down\" aria-hidden=\"true\"></i>";
        const body = document.createElement("div");
        body.className = "sectbody";
        body.id = "sectbody_" + key + "_" + number;
        elements[0].before(header);
        header.after(body);
        elements.forEach(element => body.appendChild(element));
    };
    wrap("res", [tiles, outrage]);
    wrap("board", [board]);
    wrap("guild", [guild]);
}

function getPanelSectionSignature(player, key) {
    // What the section shows, to tell when the app has changed it
    if (key == "res") { return preludeResources.concat(["captives", "trophies", "power"]).map(counter => player[counter + "Value"]).join() + "|" + (player.outraged || []).join(); }
    if (key == "board") { return ["shipsBoard", "starports"].concat(cityCounters).map(counter => player[counter + "Value"]).join(); }
    return (player.guildCards || []).join();
}

function isPanelSectionOpen(player, key) {
    const state = getPanelSectionState(player);
    if (state.manual[key] != null) { return state.manual[key]; }
    if (state.flash[key]) { return true; }
    if (panelSectionMode == "open") { return true; }
    if (panelSectionMode == "closed") { return false; }
    return player.hasPlayedACardThisTurn === true;
}

function getPanelSectionMini(player, key) {
    // The small counts on a closed header
    const item = (icon, value) => "<span>" + icon + value + "</span>";
    if (key == "res") {
        const outraged = (player.outraged || []).length;
        return preludeResources.filter(resource => player[resource + "Value"] > 0).map(resource => item(getGameIcon(resource), player[resource + "Value"])).join("")
            + ["captives", "trophies"].filter(counter => player[counter + "Value"] > 0).map(counter => item(getGameIcon(counter), player[counter + "Value"])).join("")
            + item(getGameIcon("power"), player.powerValue)
            + (outraged > 0 ? "<span class=\"sectoutrage\">Outrage " + outraged + "</span>" : "");
    }
    if (key == "board") {
        return "<span>Ships " + player.shipsBoardValue + "</span><span>Starports " + (player.starportsValue || 0) + "</span><span>Cities " + getCityCount(player) + "</span>";
    }
    return "<span>" + (player.guildCards || []).length + "</span>";
}

function refreshPanelSections(player) {
    // Show each section open or closed, with its counts. A closed section whose values changed
    // since it was last seen opens until the next player's turn
    if (player == null || document.getElementById("secthead_res_" + player.number) == null) { return; }
    const state = getPanelSectionState(player);
    panelSectionKeys.forEach(key => {
        const signature = getPanelSectionSignature(player, key);
        if (state.seen[key] != null && state.seen[key] != signature && !isPanelSectionOpen(player, key)) { state.flash[key] = true; }
        state.seen[key] = signature;
        const open = isPanelSectionOpen(player, key);
        const header = document.getElementById("secthead_" + key + "_" + player.number);
        header.classList.toggle("open", open);
        header.setAttribute("aria-expanded", open ? "true" : "false");
        header.querySelector(".sectchevron").className = "sectchevron bi bi-chevron-" + (open ? "up" : "down");
        document.getElementById("sectmini_" + key + "_" + player.number).innerHTML = getPanelSectionMini(player, key);
        document.getElementById("sectbody_" + key + "_" + player.number).classList.toggle("d-none", !open);
    });
}

function refreshAllPanelSections() {
    players.forEach(refreshPanelSections);
}

function resetPanelSections() {
    // A new player's turn: back to how the setting says, with nothing changed yet
    players.forEach(player => {
        const state = getPanelSectionState(player);
        state.manual = {};
        state.flash = {};
        panelSectionKeys.forEach(key => { state.seen[key] = getPanelSectionSignature(player, key); });
    });
    refreshAllPanelSections();
}

function togglePanelSection(playerNumber, key) {
    const player = getPlayer(playerNumber);
    getPanelSectionState(player).manual[key] = !isPanelSectionOpen(player, key);
    refreshPanelSections(player);
}

// The setting, in Options

function setPanelSectionMode(mode) {
    panelSectionMode = panelSectionModes.includes(mode) ? mode : defaultPanelSectionMode;
    saveSettingObject("panelSections", panelSectionMode);
    showPanelSectionMode();
    resetPanelSections();
}

function showPanelSectionMode() {
    const input = document.getElementById("panelSections_" + panelSectionMode);
    if (input != null) { input.checked = true; }
}

document.addEventListener("DOMContentLoaded", () => {
    let saved = null;
    try { saved = getSettingObject("panelSections"); } catch (error) { saved = null; }
    panelSectionMode = panelSectionModes.includes(saved) ? saved : defaultPanelSectionMode;
    showPanelSectionMode();
});

// Windows (a battle, a prelude, scoring...) change the panels: show what changed once they close
document.addEventListener("hidden.bs.modal", () => refreshAllPanelSections());
