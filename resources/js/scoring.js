// The ambition track in the top bar, end of round scoring and the end of the game.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getDeclaredAmbitionMarkers() {
    // Each declared ambition took the highest marker left at the time, so the
    // nth ambition declared this round has the nth highest marker.
    // Returns the markers grouped by ambition, in the order first declared
    const markers = getRoundMarkers(roundNumber);
    let grouped = [];

    declaredAmbitions.forEach((ambition, index) => {
        // There are only three markers
        if (index >= markers.length) { return; }

        let group = grouped.find(g => g.ambition == ambition);
        if (group == null) {
            group = { ambition: ambition, markers: [] };
            grouped.push(group);
        }
        group.markers.push(markers[index]);
    });

    return grouped;
}

function updateAmbitionsDisplay() {
    // Show every ambition in the top bar, with the markers on any that have been
    // declared, followed by the marker the next declared ambition will take
    const track = document.getElementById("ambitionTrack");
    disposeTooltips(track);
    track.replaceChildren();

    const declared = getDeclaredAmbitionMarkers();

    ambitions.forEach(ambition => {
        const group = declared.find(g => g.ambition == ambition);
        const points = (group == null) ? "&ndash;" : group.markers.map(m => m[0] + "/" + m[1]).join(" + ");

        // Tapping the chip shows how the ambition is won and, once declared, what it's worth
        let info = "<b>" + ambition.toUpperCase() + "</b><br>" + ambitionConditions[ambition];
        if (group != null) {
            const first = group.markers.reduce((sum, m) => sum + m[0], 0);
            const second = group.markers.reduce((sum, m) => sum + m[1], 0);
            info += "<br>1st: " + first + " &middot; 2nd: " + second;
        }

        track.appendChild(createAmbitionChip(ambition.toUpperCase(), points, (group == null) ? "" : "ambitiondeclared", info));
    });

    const markers = getRoundMarkers(roundNumber);
    const next = (declaredAmbitions.length < markers.length) ? markers[declaredAmbitions.length].join("/") : "none";
    track.appendChild(createAmbitionChip("NEXT", next, "ambitionnext", "The marker the next declared ambition will take"));

    refreshTooltips();
}

function createAmbitionChip(name, points, style, info) {
    // A button so it can be tapped on a phone. The tooltip shows when tapped and
    // hides when anything else is tapped (focus trigger)
    const chip = document.createElement("button");
    chip.type = "button";
    chip.classList.add("ambitionchip");
    if (style != "") { chip.classList.add(style); }

    chip.setAttribute('data-bs-toggle', 'tooltip');
    chip.setAttribute('data-bs-trigger', 'focus');
    chip.setAttribute('data-bs-html', 'true');
    chip.setAttribute('data-bs-placement', 'bottom');
    chip.setAttribute('data-bs-custom-class', 'custom-tooltip');
    chip.setAttribute('title', info);

    const nameDiv = document.createElement("div");
    nameDiv.classList.add("ambitionname");
    nameDiv.innerHTML = name;

    const pointsDiv = document.createElement("div");
    pointsDiv.classList.add("ambitionpoints");
    pointsDiv.innerHTML = points;

    chip.append(nameDiv, pointsDiv);
    return chip;
}

function showScoringModal() {
    const list = document.getElementById("scoringList");
    list.replaceChildren();

    document.getElementById("scoringModalTitle").innerHTML = "Round " + roundNumber + " Scoring";

    getDeclaredAmbitionMarkers().forEach(group => {
        const section = document.createElement("div");
        section.classList.add("mb-3", "scoringambition");
        section.dataset.ambition = group.ambition;
        section.dataset.markers = JSON.stringify(group.markers);

        const header = document.createElement("div");
        header.classList.add("fw-bold");
        header.innerHTML = group.ambition.toUpperCase() + ' <span class="fw-light">' + group.markers.map(m => m[0] + "/" + m[1]).join(" + ") + " (" + ambitionConditions[group.ambition] + ")</span>";
        section.appendChild(header);

        players.forEach(player => {
            const row = document.createElement("div");
            row.classList.add("d-flex", "align-items-center", "mt-1");

            const id = group.ambition + "_" + player.number;

            const label = document.createElement("label");
            label.classList.add("me-2");
            label.style.width = "80px";
            label.htmlFor = "scoreCount_" + id;
            label.innerHTML = "Player " + player.number;

            // Filled in from the resources being tracked, but can be changed
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.classList.add("form-control", "form-control-sm");
            input.style.width = "80px";
            input.id = "scoreCount_" + id;
            input.dataset.player = player.number;
            input.value = ambitionResources[group.ambition](player);
            input.oninput = updateScoringPreview;

            const points = document.createElement("span");
            points.classList.add("ms-2", "fw-bold");
            points.id = "scorePoints_" + id;

            row.append(label, input, points);
            section.appendChild(row);
        });

        list.appendChild(section);
    });

    updateScoringPreview();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("scoringModal")).show();
}

function getScoringResults() {
    // Work out the points for each declared ambition from the counts in the scoring modal
    let results = [];

    document.querySelectorAll("#scoringList .scoringambition").forEach(section => {
        const counts = [...section.querySelectorAll("input")].map(input => ({
            player: getPlayer(input.dataset.player),
            count: parseInt(input.value) || 0
        }));

        scoreAmbition(counts, JSON.parse(section.dataset.markers)).forEach(result => {
            results.push({ ambition: section.dataset.ambition, player: result.player, points: result.points, cityBonus: result.cityBonus });
        });
    });

    return results;
}

function updateScoringPreview() {
    document.querySelectorAll("#scoringList span[id^=scorePoints_]").forEach(span => { span.innerHTML = ""; });

    getScoringResults().forEach(result => {
        // The points include any city bonus, which is shown alongside
        const bonus = (result.cityBonus > 0) ? " <span class=\"fw-light\">(incl. " + result.cityBonus + " city bonus)</span>" : "";
        document.getElementById("scorePoints_" + result.ambition + "_" + result.player.number).innerHTML = "+" + result.points + bonus;
    });
}

function confirmScoring() {
    let summary = [];

    getScoringResults().forEach(result => {
        setPlayerPower(result.player, result.player.powerValue + result.points);
        if (result.points > 0) {
            summary.push("Player " + result.player.number + " +" + result.points + " (" + result.ambition
                + (result.cityBonus > 0 ? ", incl. " + result.cityBonus + " city bonus" : "") + ")");
        }
    });

    // Once Warlord has been scored everyone's trophies go back, and likewise captives for Tyrant
    let returned = [];
    const scored = [...document.querySelectorAll("#scoringList .scoringambition")].map(section => section.dataset.ambition);
    Object.entries(scoredAmbitionReturns).forEach(([ambition, resource]) => {
        if (!scored.includes(ambition)) { return; }
        players.forEach(player => {
            player[resource + "Value"] = 0;
            const input = document.getElementById(resource + "Value_" + player.number);
            if (input != null) { input.value = 0; }
        });
        returned.push("All " + resource + " returned");
    });

    // The ambitions have been scored, so clear them to stop them being scored again
    declaredAmbitions = [];
    updateAmbitionsDisplay();
    SaveAllSettings();

    showMessageToast("Round " + roundNumber + " Scores", (summary.length > 0 ? summary : ["Nobody scored"]).concat(returned).join("<br>"));

    // Carry on once the scoring modal has closed, as the game over
    // modal can't open while another modal is still closing
    document.getElementById("scoringModal").addEventListener('hidden.bs.modal', () => {
        startNextRound();
    }, { once: true });
}

function setPlayerPower(player, power) {
    player.powerValue = power;

    const input = document.getElementById("powerValue_" + player.number);
    if (input != null) { input.value = power; }

    const header = document.getElementById("playerpower" + player.number);
    if (header != null) { header.innerHTML = "Power " + power; }
}

function isGameOver() {
    return roundNumber >= 5 || players.some(player => player.powerValue >= powerToWin[players.length]);
}

function showGameOverModal() {
    const standings = players.slice().sort((a, b) => b.powerValue - a.powerValue);
    const target = powerToWin[players.length];
    const reachedTarget = standings.filter(player => player.powerValue >= target);

    document.getElementById("gameOverReason").innerHTML = (reachedTarget.length > 0)
        ? reachedTarget.map(player => "Player " + player.number).join(" and ") + " reached " + target + " power"
        : "The end of round 5";

    const list = document.getElementById("gameOverList");
    list.replaceChildren();

    standings.forEach(player => {
        const row = document.createElement("div");
        row.classList.add("fs-5");
        if (player.powerValue == standings[0].powerValue) { row.classList.add("fw-bold"); }
        row.innerHTML = "Player " + player.number + ": " + player.powerValue + " power";
        list.appendChild(row);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("gameOverModal")).show();
}
