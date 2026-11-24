// Build (#75): helping a bot decide what to build. The bot can't see the board, so the Build
// window asks whether there's an empty building slot in a system where it has a piece, and on
// which resources, then says what it builds. Built it updates the bot's board counts.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// A player has 5 cities in all
const maxCities = 5;

// The Build window: the bot building, and the resources ticked for planets with an open slot
let build = { player: null, slots: [] };

function getShipTarget(player) {
    // About shipsPerBuilding ships for each city and starport it has on the board (#125)
    return shipsPerBuilding * (getCityCount(player) + (player.starportsValue || 0));
}

function getStarportTarget() {
    // How many starports a bot wants: 2, then 3 later in the game (#142)
    return roundNumber >= starportsLaterFrom ? starportsWanted.later : starportsWanted.early;
}

function wantsStarport(player) {
    return (player.starportsValue || 0) < getStarportTarget();
}

function getStarportReason(player) {
    const has = player.starportsValue || 0;
    return "It has " + has + " starport" + (has == 1 ? "" : "s") + " and wants " + getStarportTarget() + ", to build more ships each turn.";
}

function getShipRatioReason(player) {
    const buildings = getCityCount(player) + (player.starportsValue || 0);
    return "It wants about " + shipsPerBuilding + " ships per building: it has " + player.shipsBoardValue + " ship" + (player.shipsBoardValue == 1 ? "" : "s")
        + " and " + buildings + " building" + (buildings == 1 ? "" : "s") + ".";
}

function getBuildIntent(player) {
    // What it would build, worked out before seeing the board (#126), as { build, resources } or
    // null if it doesn't need anything. A city on a resource it has none on comes first, then
    // starports up to 2 or 3 (#142), then ships while it's below its ratio, then a city towards the bonus
    const citiesLeft = getUncoveredCities(player) < maxCities;
    if (citiesLeft && wantsNewCityType(player)) {
        const missing = preludeResources.filter(resource => player["cities" + capitalise(resource) + "Value"] == 0);
        const wanted = missing.filter(resource => getResourceNeed(player, resource) > 0 || (resource == "weapons" && declaredAmbitions.includes("warlord")));
        return { build: "city", resources: wanted.length > 0 ? wanted : missing };
    }
    if (wantsStarport(player)) { return { build: "starport" }; }
    if (player.shipsBoardValue < getShipTarget(player)) { return { build: (player.starportsValue || 0) > 0 ? "ship" : "starport" }; }
    if (citiesLeft && isNearCityBonus(player)) { return { build: "city", resources: null }; }
    return null;
}

function getBuildQuestion(intent) {
    // The question for what it means to build (#126)
    const list = resources => resources.map(resource => preludeResourceNames[resource].toLowerCase()).join(" or ");
    if (intent.build == "ship") { return "Can I build a ship at one of my starports?"; }
    if (intent.build == "starport") { return "Is there an empty building slot in a system where I have a piece, for a starport?"; }
    if (intent.resources == null) { return "Is there an empty building slot in a system where I have a piece?"; }
    // Most types: shorter to say which it hasn't got
    if (intent.resources.length >= 4) { return "Is there an empty building slot, on a planet type I have no city on, in a system where I have a piece?"; }
    return "Is there an empty building slot on a " + list(intent.resources) + " planet in a system where I have a piece?";
}

function getBuildChoice(player, slotResources) {
    // What the bot builds, from the resources of planets with an empty building slot in
    // systems where it has a piece ([] if there are none). Returns { build, resource, reason }
    // with build "city", "starport", "ship" or "shipOrStarport" (the player decides)
    const citiesLeft = getUncoveredCities(player) < maxCities;

    // A city on a resource it has no city on yet, so it can tax it. A resource for an
    // ambition it's chasing comes first, then one that could still be declared
    const needed = citiesLeft ? slotResources.filter(resource => player["cities" + capitalise(resource) + "Value"] == 0) : [];
    if (needed.length > 0) {
        const priority = resource => getResourceNeed(player, resource);
        // Equally good resources are picked at random, as a person might
        const best = Math.max(...needed.map(priority));
        const choices = needed.filter(resource => priority(resource) == best);
        const resource = choices[Math.floor(Math.random() * choices.length)];
        return { build: "city", resource: resource, reason: "It has no city on a " + preludeResourceNames[resource].toLowerCase() + " planet yet"
            // Weapons have no ambition of their own: a Fate may still want them (campaign)
            + (best == 2 ? ", and it's chasing " + capitalise(preludeAmbitions[resource] || "warlord") : "") + "." };
    }

    // Fewer starports than it wants (#142), unless it can add a city for an ambition it's chasing
    const chasedCity = citiesLeft ? slotResources.find(resource => getResourceNeed(player, resource) == 2) : null;
    if (slotResources.length > 0 && wantsStarport(player) && chasedCity == null) {
        return { build: "starport", reason: getStarportReason(player) };
    }

    // Below its ratio of ships to buildings: a ship, or a starport to build them at if it has none (#125)
    if (player.shipsBoardValue < getShipTarget(player)) {
        if ((player.starportsValue || 0) > 0 || slotResources.length == 0) { return { build: "ship", reason: getShipRatioReason(player) }; }
        return { build: "starport", reason: "It wants more ships, and needs a starport to build them at." };
    }

    // Only planets it already has a city on. Another one means one more Tax each turn (the limit
    // is per city, rulebook p.12), but it's only worth it for a resource it's chasing, the city
    // bonus (4 or 5 cities), or a resource slot it needs. Otherwise a starport (#92)
    if (slotResources.length > 0) {
        if (citiesLeft) {
            const chased = slotResources.find(resource => getResourceNeed(player, resource) == 2);
            if (chased != null) {
                return { build: "city", resource: chased, reason: "It's chasing " + capitalise(preludeAmbitions[chased] || "warlord") + ", and another city means one more Tax each turn." };
            }

            const resource = slotResources[Math.floor(Math.random() * slotResources.length)];
            const cities = getUncoveredCities(player);
            if (isNearCityBonus(player)) {
                return { build: "city", resource: resource, reason: "Another city towards the bonus for 4 or 5 cities." };
            }
            if (getEmptySlots(player) == 0 && cities < 3) {
                return { build: "city", resource: resource, reason: "It has no empty resource slots, and another city opens one." };
            }
            return { build: "starport", reason: "It already has a city there, so a starport lets it build ships here instead." };
        }
        return { build: "starport", reason: "All its cities are built." };
    }

    return { build: "ship", reason: "There's nowhere it needs a building." };
}

function isNearCityBonus(player) {
    // Another city would reach the bonus for 4 or 5 cities
    const cities = getUncoveredCities(player);
    return cities == 3 || cities == 4;
}

function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// The Build window

function showBuildModal(button) {
    // Opened from the Build icon on a bot's panel
    build.player = getPlayer(getPlayerNumberFromString(button.parentNode.id));
    build.slots = [];
    hideIconTooltip(button, "buildModal");

    const header = document.querySelector("#buildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(build.player));
    document.getElementById("buildTitle").innerHTML = "Player " + build.player.number + " builds";

    // Its plan's next Build, at a place on the board (boardbot.js, #160). With none in its plan, the
    // board still chooses, so it never asks (#183)
    build.extra = null;
    if (getPlannedBuild(build.player) == null) {
        const where = chooseBoardBuild(build.player);
        if (where == null) {
            document.getElementById("buildBody").innerHTML = "<p>There's nothing it can build on the app's board: no empty slot where it has a piece, and no starport with ships left to build.</p>"
                + "<p class=\"small text-muted\">If the table is different, fix it with Check the board in Options.</p>";
            bootstrap.Modal.getOrCreateInstance(document.getElementById("buildModal")).show();
            return;
        }
        build.extra = { action: "build", where: where };
    }
    const planned = getPlannedBuild(build.player);
    // What it said it would build, and you said it can (#126): straight to it, without asking again
    const intent = (build.player.canBuild === true) ? build.player.buildIntent : null;
    if (planned != null) {
        showPlannedBuild(planned);
    } else if (intent != null && intent.build == "city" && intent.resources != null) {
        if (intent.resources.length == 1) { build.slots = intent.resources.slice(); showBuildDecision(); }
        else { showBuildResourceQuestion(intent.resources); }
    } else if (intent != null && intent.build != "city") {
        showBuildDecision(intent.build);
    } else {
        showBuildSlotQuestion();
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("buildModal")).show();
}

function showBuildSlotQuestion() {
    document.getElementById("buildBody").innerHTML =
        "<p>Is there an empty building slot in a system where " + getPlayerTag(build.player) + " has a piece?</p>"
        + "<div class=\"d-flex gap-2\">"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"buildSlotYes\" onclick=\"showBuildResourceQuestion(getWantedCityTypes())\">Yes</button>"
        + "<button type=\"button\" class=\"btn btn-secondary flex-fill\" id=\"buildSlotNo\" onclick=\"showBuildDecision()\">No</button>"
        + "</div>";
}

function getWantedCityTypes() {
    // The planet types it would build a new city on, for the stars (#157)
    const intent = getBuildIntent(build.player);
    return (intent != null && intent.build == "city" && intent.resources != null) ? intent.resources : [];
}

function showBuildResourceQuestion(wanted = []) {
    // Which resources the planets with an open slot have. More than one can be ticked. All five
    // types, with a star on those it said it wants a city on (#126), as the only open slot may be
    // on another type (#157)
    const body = document.getElementById("buildBody");
    body.innerHTML = "<p class=\"mb-1\">Which resources are on the planets with an empty slot, in a system where it has a piece? Tick all that apply.</p>"
        + (wanted.length > 0 ? "<p class=\"small text-secondary mb-2\">&#9733; the planet types it wants a new city on. Any type will do: it may still build a city, a starport or a ship there.</p>" : "");

    const group = document.createElement("div");
    group.classList.add("d-flex", "flex-wrap", "gap-1", "mb-3");
    preludeResources.forEach(resource => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.classList.add("btn-check");
        input.id = "buildSlot_" + resource;
        input.onchange = () => {
            build.slots = preludeResources.filter(r => document.getElementById("buildSlot_" + r).checked);
            document.getElementById("buildDecide").disabled = build.slots.length == 0;
        };

        const label = document.createElement("label");
        label.classList.add("btn", "btn-outline-secondary", "btn-sm");
        label.htmlFor = input.id;
        label.innerHTML = getGameIcon(resource) + " " + preludeResourceNames[resource] + (wanted.includes(resource) ? " &#9733;" : "");

        group.append(input, label);
    });
    body.appendChild(group);

    const decide = document.createElement("button");
    decide.type = "button";
    decide.classList.add("btn", "btn-primary", "w-100");
    decide.id = "buildDecide";
    decide.disabled = true;
    decide.innerHTML = "What does it build?";
    decide.onclick = showBuildDecision;
    body.appendChild(decide);

    // None of them (#163): it builds a ship or a starport, or repairs
    const none = document.createElement("button");
    none.type = "button";
    none.classList.add("btn", "btn-outline-secondary", "w-100", "mt-2");
    none.id = "buildNoSlot";
    none.innerHTML = "No empty slot";
    none.onclick = () => { build.slots = []; showBuildDecision(); };
    body.appendChild(none);
    body.insertAdjacentHTML("beforeend", "<p class=\"small text-secondary text-center mt-1 mb-0\">It then builds a ship or a starport, or repairs.</p>");
}

function showBuildDecision(forced = null) {
    // forced: a ship or starport it already said it would build (#126)
    const choice = (forced == "ship") ? { build: "ship", reason: getShipRatioReason(build.player) }
        : (forced == "starport") ? { build: "starport", reason: "It wants more ships, and needs a starport to build them at." }
        : getBuildChoice(build.player, build.slots);
    const body = document.getElementById("buildBody");

    const builtButton = (text, onclick) => "<button type=\"button\" class=\"btn btn-primary flex-fill\" onclick=\"" + onclick + "\">" + text + "</button>";
    let headline = "";
    let buttons = "";
    switch (choice.build) {
        case "city":
            headline = "Build a city on the " + preludeResourceNames[choice.resource].toLowerCase() + " planet";
            buttons = builtButton("Built it", "builtCity('" + choice.resource + "')");
            break;
        case "starport":
            headline = "Build a starport";
            buttons = builtButton("Built it", "builtStarport()");
            break;
        case "ship":
            headline = "Build a ship";
            buttons = builtButton("Built it", "builtShip()");
            break;
        default:
            // shipOrStarport: the player decides
            headline = "A ship or a starport: your call";
            buttons = builtButton("Built a ship", "builtShip()")
                + (build.slots.length > 0 ? builtButton("Built a starport", "builtStarport()") : "");
            break;
    }

    body.innerHTML = "<div class=\"battleroll\">" + headline + "</div>"
        + "<div class=\"fst-italic mb-2\">" + choice.reason + "</div>"
        + "<div class=\"small text-muted mb-3\">In a system a Rival controls, it's built damaged. Ships are built at a starport it controls, one per starport each turn, if it has any left in supply"
        + (choice.build == "ship" ? ". Nothing to build? Repair instead" : "") + ".</div>"
        + "<div class=\"d-flex gap-2\">" + buttons + "</div>";
}

function builtCity(resource) {
    // One more city on that resource (cities come from the player board, not the supply)
    plusMinusClicked("plusButton_cities" + capitalise(resource) + "_" + build.player.number, "plus", true);
    finishBuild("a city on " + preludeResourceNames[resource].toLowerCase());
}

function builtShip() {
    // One more ship on the board (the supply isn't counted)
    plusMinusClicked("plusButton_shipsBoard_" + build.player.number, "plus", true);
    finishBuild("a ship");
}

function builtStarport() {
    // One more starport on the board (#130)
    plusMinusClicked("plusButton_starports_" + build.player.number, "plus", true);
    finishBuild("a starport");
}

function getPlannedBuild(player) {
    // The next Build in its plan that has a place on the board and isn't done yet
    const step = (player.turnPlan || []).find(item => item.action == "build" && item.where != null && !item.applied);
    if (step != null) { return step; }
    // Or what the board chose when the plan had no Build (#183)
    return (build.extra != null && build.player === player && !build.extra.applied) ? build.extra : null;
}

function showPlannedBuild(step) {
    const where = step.where;
    const headline = where.kind == "ship" ? "Build a ship at its starport at " + getSystemName(where.system) : "Build a " + where.kind + " at " + getSystemName(where.system);
    document.getElementById("buildBody").innerHTML = "<div class=\"battleroll\">" + headline + "</div>"
        + (where.reason ? "<div class=\"fst-italic mb-2\">" + where.reason + "</div>" : "")
        + "<div class=\"small text-muted mb-3\">" + (isControlledByOther(where.system, build.player.number) ? "A Rival controls that system, so it's built damaged." : "From its plan, on the board.") + "</div>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-primary flex-fill\" onclick=\"builtPlanned()\">Built it</button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary flex-fill\" onclick=\"skipPlannedBuild()\">Something else</button></div>";
}

function skipPlannedBuild() {
    // It builds something else: the plan's Build isn't put on the board (the board check catches up)
    // No questions (#183): build what makes sense on the table, then put it right in the board check
    const step = getPlannedBuild(build.player);
    if (step != null) { step.applied = true; }
    document.getElementById("buildBody").innerHTML = "<p>Build what makes sense on the table instead.</p>"
        + "<p class=\"small text-muted mb-0\">Then add it to the app's board with Check the board in Options, so its panel and plans stay right.</p>";
}

function builtPlanned() {
    // On the board, and the panel follows
    const step = getPlannedBuild(build.player);
    if (step == null) { return; }
    applyBoardStep(build.player, step.where);
    step.applied = true;
    syncPanelFromBoard(build.player);
    finishBuild(step.where.kind == "ship" ? "a ship at " + getSystemName(step.where.system) : "a " + step.where.kind + " at " + getSystemName(step.where.system));
}

function finishBuild(what) {
    showMessageToast("Player " + build.player.number, "Built " + what);
    SaveAllSettings();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("buildModal")).hide();
}
