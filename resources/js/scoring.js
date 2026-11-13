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

// How many markers each ambition had when the top bar was last shown, so a newly declared one
// can flip over (null until first shown, so nothing flips on loading)
let shownAmbitionMarkers = null;

function updateAmbitionsDisplay() {
    // Show every ambition in the top bar, with the markers on any that have been
    // declared, followed by the marker the next declared ambition will take
    const track = document.getElementById("ambitionTrack");
    disposeTooltips(track);
    track.replaceChildren();

    const declared = getDeclaredAmbitionMarkers();
    const before = shownAmbitionMarkers;
    shownAmbitionMarkers = {};
    declared.forEach(group => { shownAmbitionMarkers[group.ambition] = group.markers.length; });

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

        const chip = createAmbitionChip(ambition.toUpperCase(), points, (group == null) ? "" : "ambitiondeclared", info);
        // Just declared: it flips over, like turning over the marker
        if (before != null && group != null && group.markers.length > (before[ambition] || 0)) { chip.classList.add("ambitionflip"); }
        track.appendChild(chip);
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
    // Each declared ambition as a card with its 1st and 2nd place Power, a row for each player with
    // their count, place and Power, then everyone's Power after scoring
    const list = document.getElementById("scoringList");
    list.replaceChildren();

    document.getElementById("scoringModalTitle").innerHTML = "Round " + roundNumber + "<small>Scoring</small>";
    document.getElementById("scoringNeutralNote").classList.toggle("d-none", players.length != 2);

    getDeclaredAmbitionMarkers().forEach(group => {
        const section = document.createElement("div");
        section.classList.add("scoringambition", "scorecard");
        section.dataset.ambition = group.ambition;
        section.dataset.markers = JSON.stringify(group.markers);

        const first = group.markers.reduce((sum, marker) => sum + marker[0], 0);
        const second = group.markers.reduce((sum, marker) => sum + marker[1], 0);
        const header = document.createElement("div");
        header.classList.add("scorehead");
        header.innerHTML = "<div><div class=\"scorename\">" + capitalise(group.ambition) + "</div><div class=\"scorecond\">" + ambitionConditions[group.ambition] + "</div></div>"
            + "<div class=\"medals\"><span class=\"medal gold\">" + first + "<small>1st</small></span><span class=\"medal silver\">" + second + "<small>2nd</small></span></div>";
        section.appendChild(header);

        // With 2 players the neutral resources on the ambition box score like a third player
        let scorers = players.slice();
        if (players.length == 2 && neutralAmbitions.includes(group.ambition)) { scorers.push(neutralPlayer); }

        scorers.forEach((player, index) => {
            const row = document.createElement("div");
            row.classList.add("scorerow");
            const id = group.ambition + "_" + player.number;
            row.id = "scoreRow_" + id;
            // The rows appear one after another
            row.style.animationDelay = (index * 0.08) + "s";

            const label = document.createElement("label");
            label.classList.add("scorewho");
            label.htmlFor = "scoreCount_" + id;
            // On the player's colour (#107)
            label.innerHTML = player.isNeutral ? "Neutral" : getPlayerTag(player);

            // Filled in from the resources being tracked, but can be changed
            const step = document.createElement("div");
            step.classList.add("scorestep");
            const stepButton = (change, icon) => {
                const button = document.createElement("button");
                button.type = "button";
                button.innerHTML = "<i class=\"bi " + icon + "\"></i>";
                button.setAttribute("aria-label", (change > 0 ? "One more for " : "One fewer for ") + (player.isNeutral ? "Neutral" : "Player " + player.number));
                button.onclick = () => { input.value = Math.max((parseInt(input.value) || 0) + change, 0); updateScoringPreview(); };
                return button;
            };
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.id = "scoreCount_" + id;
            input.dataset.player = player.number;
            // The neutral count is remembered from the last time it was scored
            input.value = player.isNeutral ? (neutralCounts[group.ambition] || 0) : ambitionResources[group.ambition](player);
            input.oninput = updateScoringPreview;

            step.append(stepButton(-1, "bi-dash"), input, stepButton(1, "bi-plus"));

            const place = document.createElement("span");
            place.classList.add("scoreplace");
            place.id = "scorePlace_" + id;

            const points = document.createElement("span");
            points.classList.add("scorepoints");
            points.id = "scorePoints_" + id;

            row.append(label, step, place, points);
            section.appendChild(row);
        });

        list.appendChild(section);
    });

    // Everyone's Power after scoring, against the Power that wins
    const power = document.createElement("div");
    power.classList.add("powersummary");
    power.id = "scoringPower";
    power.innerHTML = "<div class=\"sectionlabel\">Power after scoring</div>" + players.map(player =>
        "<div class=\"powerline\">" + getPlayerTag(player) + "<div class=\"powerbar\"><div class=\"now playerbanner" + getPlayerColour(player) + "\" id=\"powerNow_" + player.number + "\"></div>"
        + "<div class=\"gain playerbanner" + getPlayerColour(player) + "\" id=\"powerGain_" + player.number + "\"></div></div>"
        + "<span class=\"powernum\" id=\"powerNum_" + player.number + "\"></span></div>").join("")
        + "<div class=\"powertarget\">" + powerToWin[players.length] + " Power wins</div>";
    list.appendChild(power);

    updateScoringPreview();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("scoringModal")).show();
}

function getScoringResults() {
    // Work out the points for each declared ambition from the counts in the scoring modal
    let results = [];

    document.querySelectorAll("#scoringList .scoringambition").forEach(section => {
        const counts = [...section.querySelectorAll("input")].map(input => ({
            player: (input.dataset.player == neutralPlayer.number) ? neutralPlayer : getPlayer(input.dataset.player),
            count: parseInt(input.value) || 0
        }));

        scoreAmbition(counts, JSON.parse(section.dataset.markers), section.dataset.ambition).forEach(result => {
            results.push({ ambition: section.dataset.ambition, player: result.player, points: result.points, cityBonus: result.cityBonus, note: result.note, place: result.place });
        });
    });

    return results;
}

function updateScoringPreview() {
    document.querySelectorAll("#scoringList .scorepoints").forEach(span => { span.innerHTML = "&ndash;"; span.classList.add("zero"); });
    document.querySelectorAll("#scoringList .scoreplace").forEach(span => { span.innerHTML = ""; span.classList.remove("first", "second"); });
    document.querySelectorAll("#scoringList .scorerow").forEach(row => row.classList.remove("winner"));

    const results = getScoringResults();
    results.forEach(result => {
        const id = result.ambition + "_" + result.player.number;
        // The points include any city bonus, which is shown underneath, with any Leader's note
        const bonus = (result.cityBonus > 0) ? "<span class=\"scorebonus\">incl. " + result.cityBonus + " city bonus</span>" : "";
        const note = (result.note != null) ? "<span class=\"scorebonus\">" + result.note + "</span>" : "";
        const span = document.getElementById("scorePoints_" + id);
        span.classList.toggle("zero", !(result.points > 0) && !result.player.isNeutral);
        // The neutral takes a place from the players but gains no power
        span.innerHTML = result.player.isNeutral ? "<span class=\"scorebonus\">places (no power)</span>" : (result.points > 0 ? "+" + result.points : "0") + bonus + note;
        const place = document.getElementById("scorePlace_" + id);
        if (result.place == 1) { place.innerHTML = "1st"; place.classList.add("first"); document.getElementById("scoreRow_" + id).classList.add("winner"); }
        else if (result.place == 2) { place.innerHTML = "2nd"; place.classList.add("second"); }
    });

    // Power after scoring: now, and striped, what this round adds
    const target = powerToWin[players.length];
    const width = value => Math.min(value / target * 100, 100) + "%";
    players.forEach(player => {
        const gain = results.filter(result => result.player === player).reduce((total, result) => total + result.points, 0);
        const now = document.getElementById("powerNow_" + player.number);
        if (now == null) { return; }
        now.style.width = width(player.powerValue);
        const bar = document.getElementById("powerGain_" + player.number);
        bar.style.left = width(player.powerValue);
        bar.style.width = width(Math.min(gain, Math.max(target - player.powerValue, 0)));
        document.getElementById("powerNum_" + player.number).innerHTML = "<b>" + (player.powerValue + gain) + "</b>" + (gain > 0 ? " <span class=\"text-success\">+" + gain + "</span>" : "");
    });
}

function confirmScoring() {
    let summary = [];
    const powerBefore = {};
    players.forEach(player => { powerBefore[player.number] = player.powerValue; });

    getScoringResults().filter(result => !result.player.isNeutral).forEach(result => {
        setPlayerPower(result.player, result.player.powerValue + result.points);
        if (result.points > 0) {
            summary.push("Player " + result.player.number + " +" + result.points + " (" + result.ambition
                + (result.cityBonus > 0 ? ", incl. " + result.cityBonus + " city bonus" : "") + ")");
        }
    });

    // Remember the neutral counts for the next time those ambitions are scored. The neutral's
    // weapons on Warlord stay, as they aren't trophies taken in battle
    document.querySelectorAll("#scoringList input[data-player=\"" + neutralPlayer.number + "\"]").forEach(input => {
        neutralCounts[input.closest(".scoringambition").dataset.ambition] = parseInt(input.value) || 0;
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

        // Cities held as Trophies go back on their owners' boards, which can cover slots again
        if (resource == "trophies") {
            players.forEach(player => {
                player.citiesAsTrophies = 0;
                const overCapacity = getOverCapacityAdvice(player);
                if (overCapacity != null) { returned.push("Player " + player.number + ": " + overCapacity); }
            });
        }
    });

    // A Cartel's holder keeps that resource's supply, and after scoring their Rivals discard
    // all of it (Material Cartel, Fuel Cartel)
    courtCards.filter(card => card.holdsSupply != null).forEach(card => {
        const holder = getGuildCardHolder(card.number);
        if (holder == null) { return; }
        players.filter(player => player !== holder).forEach(player => {
            player[card.holdsSupply + "Value"] = 0;
            const input = document.getElementById(card.holdsSupply + "Value_" + player.number);
            if (input != null) { input.value = 0; }
        });
        returned.push("Rivals of Player " + holder.number + " discard all " + preludeResourceNames[card.holdsSupply].toLowerCase() + " (" + card.name + ")");
    });

    // Fuel-Drinker (Lavish)
    returned = returned.concat(applyLeaderAfterScoring(scored));

    // The ambitions have been scored, so clear them to stop them being scored again
    declaredAmbitions = [];
    updateAmbitionsDisplay();
    SaveAllSettings();

    showMessageToast("Round " + roundNumber + " Scores", (summary.length > 0 ? summary : ["Nobody scored"]).concat(returned).join("<br>"));
    players.forEach(player => { if (player.powerValue > powerBefore[player.number]) { animatePower(player, powerBefore[player.number]); } });

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

function getTurnOrderPosition(player) {
    // 0 for the player with the initiative, then 1, 2... going round the table
    const leader = getPlayerWithInitiative();
    return (player.number - leader.number + players.length) % players.length;
}

function showGameOverModal() {
    // Most power wins. A tie goes to whoever is earliest in turn order (rulebook p.19)
    const standings = players.slice().sort((a, b) => (b.powerValue - a.powerValue) || (getTurnOrderPosition(a) - getTurnOrderPosition(b)));
    const winner = standings[0];
    const tied = standings.filter(player => player.powerValue == winner.powerValue);
    const target = powerToWin[players.length];
    const reachedTarget = standings.filter(player => player.powerValue >= target);

    document.getElementById("gameOverReason").innerHTML = "<div class=\"gameoverwinner playerbanner" + getPlayerColour(winner) + "\"><div class=\"gameovertitle\">Player " + winner.number + " wins</div></div>"
        + ((reachedTarget.length > 0)
        ? reachedTarget.map(getPlayerTag).join(" and ") + " reached " + target + " power"
        : "The end of round 5")
        + (tied.length > 1 ? "<br><small class=\"text-muted\">Tied on power: the earliest in turn order wins</small>" : "");

    const list = document.getElementById("gameOverList");
    list.replaceChildren();

    standings.forEach(player => {
        const row = document.createElement("div");
        row.classList.add("fs-5");
        if (player === winner) { row.classList.add("fw-bold"); }
        row.innerHTML = getPlayerTag(player) + ": " + player.powerValue + " power";
        list.appendChild(row);
    });

    bootstrap.Modal.getOrCreateInstance(document.getElementById("gameOverModal")).show();
}
