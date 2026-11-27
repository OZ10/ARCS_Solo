// Blighted Reach campaign (#85 stage 7d): Flagships. Where each is on the map (board.js keeps the
// piece), its 6 Upgrade slots with Armor above (on the player as player.flagship), the panel section
// that shows them, and gaining one (Loyal buildings on the map become Free buildings)
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The Upgrade slots, left to right (campaign rulebook p.25), with the planet types the Flagship must
// be at to build the Upgrade and its Armor. The Hull takes any planet
const flagshipSlots = [
    { key: "crane", name: "Ship Crane", upgrade: "materials", armor: "fuel" },
    { key: "defense", name: "Defense Array", upgrade: "weapons", armor: "psionics" },
    { key: "slipstream", name: "Slipstream Drive", upgrade: "fuel", armor: "relics" },
    { key: "control", name: "Control Array", upgrade: "psionics", armor: "materials" },
    { key: "tractor", name: "Tractor Beam", upgrade: "relics", armor: "weapons" },
    { key: "hull", name: "Hull", upgrade: null, armor: null }
];

// The slot being changed on a panel: { player, slot, part }
let flagshipEditing = null;

function hasFlagship(player) {
    return player != null && player.flagship != null;
}

function getFlagshipSystem(player) {
    return getSystemIds().find(id => getFlagships(id).some(flagship => flagship.owner == player.number)) || null;
}

function newFlagshipBoard(pieces = {}) {
    // pieces: { slotKey: "city" | "starport" } on Upgrades
    const slots = {};
    flagshipSlots.forEach(slot => { slots[slot.key] = { upgrade: pieces[slot.key] ? { kind: pieces[slot.key], damaged: false } : null, armor: null }; });
    return { slots: slots };
}

function getFlagshipPieces(player) {
    // Every building on its Flagship board: [{ slot, part, kind, damaged }]
    if (!hasFlagship(player)) { return []; }
    return flagshipSlots.flatMap(slot => ["armor", "upgrade"].map(part => ({ slot: slot.key, part: part, piece: player.flagship.slots[slot.key][part] })))
        .filter(item => item.piece != null).map(item => ({ slot: item.slot, part: item.part, kind: item.piece.kind, damaged: item.piece.damaged }));
}

function getFlagshipFreshStarports(player) {
    // Its dice in battle (rulebook p.23)
    return getFlagshipPieces(player).filter(piece => piece.kind == "starport" && !piece.damaged).length;
}

function getFlagshipCities(player) {
    // Each opens a resource slot (rulebook p.25)
    return getFlagshipPieces(player).filter(piece => piece.kind == "city").length;
}

// Gaining one (rulebook p.22): Loyal buildings on the map become Free buildings of the same type

function gainFlagship(player, system, pieces) {
    getSystemIds().forEach(id => getBuildings(id, player.number).forEach(building => { building.owner = freeOwner; }));
    player.flagship = newFlagshipBoard(pieces);
    getFlagships(system).push({ owner: player.number });
    syncPanelFromBoard(player);
    renderFlagshipSection(player);
    SaveAllSettings();
}

function chooseBotFlagshipSystem(player) {
    // Where it has the most Loyal pieces
    const score = id => getShips(id, player.number).fresh + getShips(id, player.number).damaged + getBuildings(id, player.number).length * 2;
    return getSystemIds().filter(id => hasLoyalPiece(id, player.number)).sort((a, b) => score(b) - score(a))[0] || null;
}

function moveFlagship(player, from, to) {
    const flagships = getFlagships(from);
    const index = flagships.findIndex(flagship => flagship.owner == player.number);
    if (index < 0) { return false; }
    flagships.splice(index, 1);
    getFlagships(to).push({ owner: player.number });
    return true;
}

// Hits: rightmost Armor first, then the rightmost Upgrade (rulebook p.24). A hit damages a fresh
// building, and destroys a damaged one

function hitFlagship(player, hits) {
    const lines = [];
    for (let hit = 0; hit < hits; hit++) {
        const target = [...flagshipSlots].reverse().map(slot => ({ slot: slot, piece: player.flagship.slots[slot.key].armor, part: "armor" })).find(item => item.piece != null)
            || [...flagshipSlots].reverse().map(slot => ({ slot: slot, piece: player.flagship.slots[slot.key].upgrade, part: "upgrade" })).find(item => item.piece != null);
        if (target == null) { break; }
        const name = target.slot.name + " " + (target.part == "armor" ? "Armor" : "Upgrade");
        if (target.piece.damaged) { player.flagship.slots[target.slot.key][target.part] = null; lines.push(name + " destroyed"); }
        else { target.piece.damaged = true; lines.push(name + " damaged"); }
    }
    return lines;
}

function clearDamagedFlagshipPieces(player) {
    // The Intermission destroys damaged Upgrades and Armor (rulebook p.28)
    if (!hasFlagship(player)) { return []; }
    const lines = [];
    flagshipSlots.forEach(slot => ["armor", "upgrade"].forEach(part => {
        const piece = player.flagship.slots[slot.key][part];
        if (piece != null && piece.damaged) { player.flagship.slots[slot.key][part] = null; lines.push(slot.name + " " + (part == "armor" ? "Armor" : "Upgrade")); }
    }));
    return lines;
}

// The panel: a Flagship section in the Board section, in place of the map's building tiles

function renderFlagshipSection(player) {
    const panel = document.querySelector("#player" + player.number + " .boardsection");
    if (panel == null) { return; }
    let section = panel.querySelector(".flagshipsection");
    // The map's starport and city tiles: hidden with a Flagship, unless it has map buildings
    // (Gate Ports, Cloud Cities: rulebook p.25)
    const mapBuildings = getBoardBuildings(player.number).length > 0;
    const groups = [...panel.querySelectorAll(".boardgrouplabel")].map(label => label.parentNode).filter(group => /Starports|Cities/.test(group.querySelector(".boardgrouplabel").textContent));
    groups.forEach(group => group.classList.toggle("d-none", hasFlagship(player) && !mapBuildings));
    if (!hasFlagship(player)) { if (section != null) { section.remove(); } return; }
    if (section == null) {
        section = document.createElement("div");
        section.className = "flagshipsection mt-2";
        panel.appendChild(section);
    }
    const system = getFlagshipSystem(player);
    const editing = flagshipEditing != null && flagshipEditing.player == player.number ? flagshipEditing : null;
    const piece = (slot, part) => {
        const built = player.flagship.slots[slot.key][part];
        const planet = slot[part];
        const active = editing != null && editing.slot == slot.key && editing.part == part ? " border-primary border-2" : "";
        const label = part == "armor" ? "Armor" : "Upgrade";
        const inner = built == null
            ? "<span class=\"text-secondary small\">" + label + "</span><br>" + (planet ? getGameIcon(planet) : "<small>any</small>")
            : "<i class=\"bi " + (built.kind == "city" ? "bi-buildings" : "bi-rocket-takeoff") + "\"></i> " + capitalise(built.kind) + "<br><small>" + (built.damaged ? "damaged" : "fresh") + "</small>";
        const style = built == null ? "btn-outline-secondary" : built.damaged ? "btn-outline-danger" : "btn-secondary";
        return "<button type=\"button\" class=\"btn btn-sm w-100 py-1 " + style + active + "\" style=\"min-height:44px\" id=\"flagship_" + player.number + "_" + slot.key + "_" + part + "\" onclick=\"editFlagshipSlot(" + player.number + ", '" + slot.key + "', '" + part + "')\">" + inner + "</button>";
    };
    const grid = "<div class=\"d-grid gap-1\" style=\"grid-template-columns:repeat(3,1fr)\">" + flagshipSlots.map(slot => "<div class=\"border rounded p-1 text-center\"><div class=\"small fw-semibold mb-1\" style=\"font-size:.72rem\">" + slot.name + "</div>"
        + piece(slot, "armor") + "<div class=\"mt-1\"></div>" + piece(slot, "upgrade") + "</div>").join("") + "</div>";
    let actions = "";
    if (editing != null) {
        const built = player.flagship.slots[editing.slot][editing.part];
        const button = (label, action) => "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"changeFlagshipSlot(" + player.number + ", '" + action + "')\">" + label + "</button>";
        actions = "<div class=\"d-flex flex-wrap gap-1 mt-1\">" + (built == null ? button("Build a city", "city") + button("Build a starport", "starport")
            : button(built.damaged ? "Repaired" : "Damaged", "toggle") + button("Destroyed", "destroy")) + button("Cancel", "cancel") + "</div>";
    }
    const freshPorts = getFlagshipFreshStarports(player), cities = getFlagshipCities(player);
    section.innerHTML = "<div class=\"d-flex justify-content-between align-items-center mb-1\"><div><i class=\"bi bi-star-fill\"></i> <b>Flagship</b>"
        + (system != null ? " at " + getSystemName(system) : " <span class=\"text-secondary\">(not on the board)</span>") + "</div></div>"
        + grid + actions
        + "<div class=\"d-flex flex-wrap gap-3 mt-1 small\"><span><b>" + freshPorts + "</b> fresh starport" + (freshPorts == 1 ? "" : "s") + ": " + freshPorts + " " + (freshPorts == 1 ? "die" : "dice") + " in battle</span>"
        + "<span><b>" + cities + "</b> cit" + (cities == 1 ? "y" : "ies") + ": open" + (cities == 1 ? "s " : " ") + cities + " resource slot" + (cities == 1 ? "" : "s") + "</span></div>";
}

function editFlagshipSlot(number, slot, part) {
    flagshipEditing = { player: number, slot: slot, part: part };
    renderFlagshipSection(getPlayer(number));
}

function changeFlagshipSlot(number, action) {
    const player = getPlayer(number);
    const { slot, part } = flagshipEditing;
    const slots = player.flagship.slots[slot];
    if (action == "city" || action == "starport") {
        // Armor only over a fresh Upgrade (rulebook p.22)
        if (part == "armor" && (slots.upgrade == null || slots.upgrade.damaged)) { showMessageToast("Flagship", "Armor needs a fresh Upgrade below it."); }
        else { slots[part] = { kind: action, damaged: false }; }
    }
    if (action == "toggle" && slots[part] != null) { slots[part].damaged = !slots[part].damaged; }
    if (action == "destroy") { slots[part] = null; }
    flagshipEditing = null;
    SaveAllSettings();
    renderFlagshipSection(player);
}
