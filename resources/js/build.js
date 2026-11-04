// Build (#75): helping a bot decide what to build. The bot can't see the board, so the Build
// window asks whether there's an empty building slot in a system where it has a piece, and on
// which resources, then says what it builds. Built it updates the bot's board counts.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// A player has 5 cities in all
const maxCities = 5;

// The Build window: the bot building, and the resources ticked for planets with an open slot
let build = { player: null, slots: [] };

function getBuildChoice(player, slotResources) {
    // What the bot builds, from the resources of planets with an empty building slot in
    // systems where it has a piece ([] if there are none). Returns { build, resource, reason }
    // with build "city", "starport", "ship" or "shipOrStarport" (the player decides)
    const citiesLeft = getCityCount(player) < maxCities;

    // A city on a resource it has no city on yet, so it can tax it. A resource for an
    // ambition it's chasing comes first, then one that could still be declared
    const needed = citiesLeft ? slotResources.filter(resource => player["cities" + capitalise(resource) + "Value"] == 0) : [];
    if (needed.length > 0) {
        const priority = resource => getResourceNeed(player, resource);
        // Equally good resources are picked at random, as a person might
        const best = Math.max(...needed.map(priority));
        const choices = needed.filter(resource => priority(resource) == best);
        const resource = choices[Math.floor(Math.random() * choices.length)];
        return { build: "city", resource: resource, reason: "It has no city on " + preludeResourceNames[resource].toLowerCase() + " yet, so it can tax it"
            + (best == 2 ? " and it's chasing " + capitalise(preludeAmbitions[resource]) : "") + "." };
    }

    // Short of ships: a ship, or a starport to build them at. The player decides
    if (player.shipsBoardValue < fewShipsOnBoard) {
        return { build: "shipOrStarport", reason: "Only " + player.shipsBoardValue + " ship" + (player.shipsBoardValue == 1 ? "" : "s") + " on the board." };
    }

    // A building it doesn't need: a city towards the city bonus (4 or 5 cities), else a starport
    if (slotResources.length > 0) {
        if (citiesLeft) {
            const resource = slotResources[Math.floor(Math.random() * slotResources.length)];
            return { build: "city", resource: resource, reason: "Another city towards the bonus for 4 or 5 cities." };
        }
        return { build: "starport", reason: "All its cities are built." };
    }

    return { build: "ship", reason: "There's nowhere it needs a building." };
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
    header.classList.add("playerbanner" + build.player.number);
    document.getElementById("buildTitle").innerHTML = "Player " + build.player.number + " builds";

    showBuildSlotQuestion();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("buildModal")).show();
}

function showBuildSlotQuestion() {
    document.getElementById("buildBody").innerHTML =
        "<p>Is there an empty building slot in a system where Player " + build.player.number + " has a piece?</p>"
        + "<div class=\"d-flex gap-2\">"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"buildSlotYes\" onclick=\"showBuildResourceQuestion()\">Yes</button>"
        + "<button type=\"button\" class=\"btn btn-secondary flex-fill\" id=\"buildSlotNo\" onclick=\"showBuildDecision()\">No</button>"
        + "</div>";
}

function showBuildResourceQuestion() {
    // Which resources the planets with an open slot have. More than one can be ticked
    const body = document.getElementById("buildBody");
    body.innerHTML = "<p>Which resources are on the planets with an empty slot? Tick all that apply.</p>";

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
        label.innerHTML = preludeResourceNames[resource];

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
}

function showBuildDecision() {
    const choice = getBuildChoice(build.player, build.slots);
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
            buttons = builtButton("Built it", "builtNothingCounted('a starport')");
            break;
        case "ship":
            headline = "Build a ship";
            buttons = builtButton("Built it", "builtShip()");
            break;
        default:
            // shipOrStarport: the player decides
            headline = "A ship or a starport: your call";
            buttons = builtButton("Built a ship", "builtShip()")
                + (build.slots.length > 0 ? builtButton("Built a starport", "builtNothingCounted('a starport')") : "");
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
    plusMinusClicked("plusButton_cities" + capitalise(resource) + "_" + build.player.number, "plus");
    finishBuild("a city on " + preludeResourceNames[resource].toLowerCase());
}

function builtShip() {
    // One more ship on the board (the supply isn't counted)
    plusMinusClicked("plusButton_shipsBoard_" + build.player.number, "plus");
    finishBuild("a ship");
}

function builtNothingCounted(what) {
    // Starports aren't counted
    finishBuild(what);
}

function finishBuild(what) {
    showMessageToast("Player " + build.player.number, "Built " + what);
    SaveAllSettings();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("buildModal")).hide();
}
