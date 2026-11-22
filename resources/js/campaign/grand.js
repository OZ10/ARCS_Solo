// Blighted Reach campaign (#85), Act III: the new ambitions (the Guardian's Edenguard and the
// Naturalist's Blightkin), the Pathfinder's question about the Portal, and a bot Conspirator's
// Conspiracies, kept secret by the app. The new ambitions count what's on the map, which the app
// can't see: a bot asks before declaring one, and the scoring window's counts are entered by hand.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// fate: who brings it in; replaces: the ambition it can be declared instead of
const newAmbitions = {
    edenguard: { fate: 20, replaces: "tycoon", condition: "most Fuel and Material planets", short: "most Fuel and Material planets",
        question: "Do I control more Fuel and Material planets than each Rival?", why: "My Fate, the Guardian, can't declare Tycoon: I would declare <b>Edenguard</b> instead." },
    blightkin: { fate: 21, replaces: "empath", condition: "most systems with fresh Blight", short: "most systems with fresh Blight",
        question: "Do I control more systems with fresh Blight than each Rival?", why: "My Fate, the Naturalist: I would declare <b>Blightkin</b> instead of Empath." }
};

// What each counts: the counts last entered in the scoring window. 0 outside Act III, so the base
// game never sees them
Object.entries(newAmbitions).forEach(([ambition, data]) => {
    ambitionResources[ambition] = player => getNewAmbitionCount(ambition, player);
    ambitionConditions[ambition] = data.condition + " (count them on the map)";
});
// Their chips in the top bar: Edenguard's planets, Blightkin's Blight
gameIcons.edenguard = gameIcons.materials;
gameIcons.blightkin = gameIcons.psionics;

function getNewAmbitionCount(ambition, player) {
    if (typeof campaign == "undefined" || campaign == null || campaign.act != 3 || campaign.newCounts == null) { return 0; }
    return (campaign.newCounts[ambition] || {})[player.number] || 0;
}

function isNewAmbitionInPlay(ambition) {
    // Its Fate is in play this Act, or it's been declared
    return campaign != null && campaign.act == 3 && (declaredAmbitions.includes(ambition) || players.some(player => hasFate(player, newAmbitions[ambition].fate)));
}

registerCampaignHook("ambitionList", () => {
    const list = [];
    ambitions.forEach(ambition => {
        list.push(ambition);
        Object.keys(newAmbitions).filter(added => newAmbitions[added].replaces == ambition && isNewAmbitionInPlay(added)).forEach(added => list.push(added));
    });
    return list;
});

registerCampaignHook("declareButtons", () => {
    // A human player can declare one instead of the ambition it replaces
    Object.entries(newAmbitions).filter(([ambition]) => isNewAmbitionInPlay(ambition)).forEach(([ambition, data]) => {
        const after = document.querySelector("#declareAmbitionModal button[onclick=\"declareAmbitionClick('" + data.replaces + "')\"]");
        if (after == null) { return; }
        after.insertAdjacentHTML("afterend", "<button type=\"button\" class=\"btn btn-outline-primary mb-3 campaignambition\" onclick=\"declareAmbitionClick('" + ambition + "')\" data-bs-dismiss=\"modal\">"
            + capitalise(ambition) + " <small class=\"d-block\">instead of " + capitalise(data.replaces) + ": " + data.short + "</small></button>");
    });
    return undefined;
});

registerCampaignHook("ambitionsScored", results => {
    // Remember the counts entered for a new ambition, as its count until it's next scored
    Object.keys(newAmbitions).forEach(ambition => {
        const inputs = document.querySelectorAll("#scoringList .scoringambition[data-ambition=\"" + ambition + "\"] input");
        if (inputs.length == 0) { return; }
        campaign.newCounts = campaign.newCounts || {};
        campaign.newCounts[ambition] = {};
        inputs.forEach(input => { campaign.newCounts[ambition][input.dataset.player] = parseInt(input.value) || 0; });
    });
    return undefined;
});

function getNewAmbitionFor(player, ambition) {
    // The new ambition a bot's Fate declares instead of this one, if any
    if (campaign == null || campaign.act != 3 || player.isHuman) { return null; }
    const found = Object.entries(newAmbitions).find(([added, data]) => data.replaces == ambition && hasFate(player, data.fate) && !declaredAmbitions.includes(added));
    return found != null ? found[0] : null;
}

// The questions a bot asks before choosing its card: the new ambition it could declare, and the Portal

registerCampaignHook("botQuestions", (player, carryOn) => {
    if (campaign == null || campaign.act != 3 || player.isHuman) { return undefined; }
    player.steerAnswers = player.steerAnswers || {};
    const answer = (key, focus, question, then) => {
        askYesNo(focus, question, yes => {
            player.steerAnswers[key] = yes;
            SaveAllSettings();
            carryOn();
        });
        return true;
    };
    // Leading with a card it could declare the new ambition with
    if (isLeadingThisTurn() && declaredAmbitions.length < 3 && canDeclareAmbition(player)) {
        const cards = getBotCards(player);
        const added = Object.keys(newAmbitions).find(ambition => player.steerAnswers[ambition] === undefined
            && cards.some(card => card.ambition == newAmbitions[ambition].replaces) && getNewAmbitionFor(player, newAmbitions[ambition].replaces) == ambition);
        if (added != null) {
            const data = newAmbitions[added];
            return answer(added, data.replaces.toUpperCase(), data.question + " (" + data.why + ") The First Regent counts the Empire's systems.");
        }
    }
    // The Pathfinder, with a card that can Move
    if (hasFate(player, 9) && player.steerAnswers.portal === undefined && getBotCards(player).some(card => card.actions.includes("move"))) {
        return answer("portal", "MOVE", "Do I control the Portal? (My Fate, the Pathfinder: see the Pilgrims delivered.) If not, I move my Flagship towards it.");
    }
    return undefined;
});

registerCampaignHook("declareInstead", (player, ambition, playedCard) => {
    // Nothing for a card with no ambition (the 1s): it can't declare
    if (ambition == null || ambitionResources[ambition] == null) { return undefined; }
    // A bot Conspirator places a Conspiracy instead of a marker
    if (isBotConspirator(player)) { return placeConspiracy(player, ambition, playedCard) ? true : undefined; }
    // The Guardian or Naturalist, told it controls the most: the new ambition instead
    const added = getNewAmbitionFor(player, ambition);
    if (added == null || player.steerAnswers == null || player.steerAnswers[added] !== true) { return undefined; }
    return { ambition: added, resources: 3, wins: true };
});

// The Conspirator (Fate 23, Act III). When it declares, it places a Conspiracy face down instead of
// an ambition marker: who it predicts will come first. After scoring, those on scored ambitions are
// revealed: right +1, wrong back 1. Each still face down +1. A Rival who secures a Vox card or a
// card with its agents may guess one: right, it's returned; wrong, the Conspirator advances 1

function isBotConspirator(player) {
    return campaign != null && campaign.act == 3 && !player.isHuman && hasFate(player, 23) && getCampaignPlayer(player).objective != null;
}

function getConspiracies(player) {
    return (campaign.conspiracies || []).filter(conspiracy => conspiracy.by == player.number);
}

function getConspiracyPick(player, ambition) {
    // The player it predicts will come first: the most now, itself on a tie
    const count = other => ambitionResources[ambition](other);
    return players.slice().sort((a, b) => (count(b) - count(a)) || ((b === player) - (a === player)))[0];
}

function placeConspiracy(player, ambition, playedCard) {
    // One on each ambition box, on one with no marker yet
    if (declaredAmbitions.includes(ambition) || (campaign.conspiracies || []).some(conspiracy => conspiracy.ambition == ambition)) { return false; }
    const pick = getConspiracyPick(player, ambition);
    campaign.conspiracies = (campaign.conspiracies || []).concat({ by: player.number, ambition: ambition, pick: pick.number });
    playedCard.declared = placesZeroMarker(player, ambition);
    addPlayedCardToList(playedCard, playedCard.playedAction, "DECLARE", true, player);
    showMessageToast("Player " + player.number + ": Conspiracy", "Instead of an ambition marker, it places a Conspiracy face down on " + capitalise(ambition)
        + ". Take any Conspiracy token without looking at its colour: the app keeps who it's for secret.");
    showCampaignPanel(player);
    SaveAllSettings();
    return true;
}

function getConspiracyLine(player) {
    const list = getConspiracies(player);
    return list.length > 0 ? "Conspiracies face down on " + list.map(conspiracy => capitalise(conspiracy.ambition)).join(" and ") + "." : "";
}

function moveObjectiveBack(player, amount, reason) {
    // A wrong Conspiracy moves its marker back up the track
    const state = getCampaignPlayer(player);
    if (state.objective == null) { return; }
    const before = state.objective;
    state.objective = Math.min(before + amount, state.objectiveStart ?? before + amount);
    state.objectiveLog = (state.objectiveLog || []).concat({ reason: reason, from: before, to: state.objective });
    showCampaignPanel(player);
    SaveAllSettings();
}

registerCampaignHook("ambitionsScored", results => {
    // Reveal those on scored ambitions; each still face down advances it 1
    if (campaign == null || campaign.act != 3) { return undefined; }
    players.filter(isBotConspirator).forEach(player => {
        const kept = [];
        getConspiracies(player).forEach(conspiracy => {
            const scored = results.filter(result => result.ambition == conspiracy.ambition);
            const pick = getPlayer(conspiracy.pick);
            if (!declaredAmbitions.includes(conspiracy.ambition)) {
                kept.push(conspiracy);
                advanceObjective(player, 1, "Its Conspiracy on " + capitalise(conspiracy.ambition) + " is still face down");
                return;
            }
            // First, or tied for first (everyone scored then placed second)
            const firsts = scored.some(result => result.place == 1) ? scored.filter(result => result.place == 1) : scored;
            const right = firsts.some(result => result.player === pick);
            const what = "Its Conspiracy on " + capitalise(conspiracy.ambition) + " was for Player " + pick.number + (right ? ", who came first: right. Return the token" : ", who didn't come first: wrong. Return the token");
            if (right) { advanceObjective(player, 1, what); } else { moveObjectiveBack(player, 1, what); }
        });
        campaign.conspiracies = (campaign.conspiracies || []).filter(conspiracy => conspiracy.by != player.number).concat(kept);
        showCampaignPanel(player);
    });
    return undefined;
});

function getConspiracyPanelHtml(player) {
    if (!isBotConspirator(player) || getConspiracies(player).length == 0) { return ""; }
    return "<div class=\"favors\"><span class=\"lbl\">Conspiracies on " + getConspiracies(player).map(conspiracy => capitalise(conspiracy.ambition)).join(", ") + "</span>"
        + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"showFoilWindow(" + player.number + ")\">Foil a Conspiracy</button></div>";
}

let foilChoice = { ambition: null, player: null };

function showFoilWindow(playerNumber) {
    const conspirator = getPlayer(playerNumber);
    const list = getConspiracies(conspirator);
    if (foilChoice.ambition == null || !list.some(conspiracy => conspiracy.ambition == foilChoice.ambition)) { foilChoice.ambition = list.length > 0 ? list[0].ambition : null; }
    if (foilChoice.player == null) { foilChoice.player = players[0].number; }
    const segment = (kind, options) => "<div class=\"brseg\">" + options.map(([value, label]) => "<button type=\"button\" class=\"btn btn-outline-secondary" + (foilChoice[kind] == value ? " active" : "") + "\" onclick=\"pickFoil(" + playerNumber + ", '" + kind + "', '" + value + "')\">" + label + "</button>").join("") + "</div>";
    showCampaignWindow("Foil a Conspiracy", "<div class=\"turnsection\"><div class=\"turnlabel\">" + getPlayerTag(conspirator) + " is the Conspirator</div>"
        + "<p class=\"small mb-2\">You secured a Vox card, or a card with Player " + playerNumber + "'s agents: guess one of its face-down Conspiracies. Right: it's returned. Wrong: Player " + playerNumber + "'s objective advances 1.</p>"
        + "<div class=\"small text-secondary mb-1\">Which ambition?</div>" + segment("ambition", list.map(conspiracy => [conspiracy.ambition, capitalise(conspiracy.ambition)]))
        + "<div class=\"small text-secondary mb-1 mt-2\">Who is it for?</div>" + segment("player", players.map(other => [other.number, "Player " + other.number])) + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"guessConspiracy(" + playerNumber + ")\">Guess</button>", conspirator);
}

function pickFoil(playerNumber, kind, value) {
    foilChoice[kind] = kind == "player" ? Number(value) : value;
    showFoilWindow(playerNumber);
}

function guessConspiracy(playerNumber) {
    const conspirator = getPlayer(playerNumber);
    const conspiracy = getConspiracies(conspirator).find(item => item.ambition == foilChoice.ambition);
    if (conspiracy == null) { closeCampaignWindow(); return; }
    let text;
    if (conspiracy.pick == foilChoice.player) {
        campaign.conspiracies = campaign.conspiracies.filter(item => item !== conspiracy);
        text = "<b>Right:</b> the Conspiracy on " + capitalise(conspiracy.ambition) + " was for Player " + conspiracy.pick + ". Return the token.";
    } else {
        advanceObjective(conspirator, 1, "A wrong guess at its Conspiracy on " + capitalise(conspiracy.ambition) + " (Foiling Conspiracies)");
        text = "<b>Wrong:</b> it isn't for Player " + foilChoice.player + ". The token stays face down, and Player " + playerNumber + "'s objective advances 1.";
    }
    showCampaignPanel(conspirator);
    SaveAllSettings();
    setCampaignWindow("Foil a Conspiracy", "<div class=\"turnsection\"><p class=\"mb-0\">" + text + "</p></div><button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"closeCampaignWindow()\">Close</button>", conspirator);
}
