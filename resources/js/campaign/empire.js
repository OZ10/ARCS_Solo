// Blighted Reach campaign (#85), Phase 2: bots in the Empire (rulebook p.10-15, p.19). Regents
// follow the Empire's laws: Imperial ships move with their own ships (1 for each), attack with them,
// and protect Regents from each other (the Truce Law). Outlaws can battle Regents freely and attack
// the Empire. The Empire, the Free States and the Blight can each defend in a battle. Bots value
// the Imperial Council and give their reasons at the end of a chapter.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// How much a Regent bot would rather battle an Outlaw than a Rival Regent (rules.js battleTargetWeights)
const empireTargetWeights = { outlaw: 2.5, rivalRegent: -1 };
// What the Imperial Council is worth to a bot in the Court (rules.js marketValues)
const councilValues = { becomeFirstRegent: 1.5, alreadyFirstRegent: 0.5, perStolen: 0.75 };

function isRegent(player) {
    return campaign != null && campaign.players[player.number] != null && campaign.players[player.number].title == "regent";
}

function getTitleWord(player) {
    return isRegent(player) ? "Regent" : "Outlaw";
}

function getTrustTotal() {
    return trustResources.reduce((total, resource) => total + campaign.trust[resource], 0);
}

// Choosing who to battle

registerCampaignHook("battleTargetBonus", (player, rival) => {
    // What its Fate steers it towards, such as the Pirate after Rivals holding resources (steering.js)
    const steer = getSteerTargetBonus(player, rival);
    if (!isRegent(player)) { return steer; }
    // The Admiral wants Trophies from battles alongside Imperial ships: Outlaws all the more (fatebots.js)
    return steer + (isRegent(rival) ? empireTargetWeights.rivalRegent : empireTargetWeights.outlaw + (hasFate(player, 7) ? 1 : 0));
});

registerCampaignHook("battleTargetWhere", (player, rival) => {
    if (isRegent(player) && isRegent(rival)) { return " Only where there are no Imperial ships: Regents can't harm each other there."; }
    if (isRegent(player)) { return " Imperial ships there can join its attack."; }
    if (isRegent(rival)) { return " Imperial ships there defend with them."; }
    return "";
});

// The Truce Law (#165): a Regent can attack a Rival Regent only where there are no Imperial ships
const truceQuestionNote = " <b>A Rival Regent only where there are no Imperial ships</b> (the Truce Law).";

function hasRivalRegent(player) {
    return isRegent(player) && players.some(other => other !== player && isRegent(other));
}

registerCampaignHook("questionNote", (player, action) => {
    if (!isRegent(player)) { return ""; }
    const truce = hasRivalRegent(player) ? truceQuestionNote : "";
    if (action == "reachBattle") { return " Imperial ships in a system with my ships can come along, 1 for each of my ships." + truce; }
    if (action == "battle" || action == "reachRaid") { return truce; }
    if (action == "tax" || action == "reachTax") { return " Not a Rival Regent's city in a system with Imperial ships."; }
    return "";
});

// The bot's turn window: the Empire's laws for its plan

registerCampaignHook("turnSections", (player, plan) => {
    const actions = plan.map(step => step.action);
    const rows = [];
    const regents = players.filter(isRegent);
    const outlaws = players.filter(other => !isRegent(other));
    const otherOutlaws = outlaws.filter(other => other !== player);
    const status = "Player " + player.number + " is " + (isRegent(player) ? "a <b>Regent</b>" : "an <b>Outlaw</b>") + "."
        + (otherOutlaws.length > 0 ? " " + otherOutlaws.map(other => "Player " + other.number).join(" and ") + (otherOutlaws.length == 1 ? " is an <b>Outlaw</b>." : " are <b>Outlaws</b>.") : "")
        + (campaign.firstRegent != null ? " Player " + campaign.firstRegent + " is First Regent." : " There's no First Regent.");
    if (isRegent(player)) {
        if (actions.includes("move")) { rows.push("<b>Move:</b> it can take 1 Imperial ship along for each of its own ships moving with it, from a system where it has pieces."); }
        if (actions.includes("battle")) { rows.push("<b>Battle:</b> it may add the Imperial ships in the system as attackers. It can't harm Imperial ships, or a Rival Regent where there are Imperial ships."); }
        if (actions.includes("tax")) { rows.push("<b>Tax:</b> not a Rival Regent's city where there are Imperial ships. Free cities it controls can be taxed (no Captives)."); }
        if (actions.some(action => ["move", "battle", "repair", "build", "tax"].includes(action))) { rows.push("It needs its own (Loyal) pieces in a system to use the Imperial ships there."); }
    } else {
        if (actions.includes("battle")) { rows.push("<b>Battle:</b> as an Outlaw it can battle Regents and the Empire. Imperial ships defend with a Regent."); }
        if (actions.includes("tax")) { rows.push("<b>Tax:</b> Free cities it controls can be taxed (no Captives)."); }
        if (actions.includes("move")) { rows.push("<b>Move:</b> a Catapult ends in a gate the Empire or a Regent controls."); }
    }
    // Its Fate first (fatebots.js), then the Empire
    return getFateTurnSection(player) + getTurnSection("The Empire", "<div class=\"small\">" + status + "</div>"
        + (rows.length > 0 ? "<div class=\"empirenote\">" + rows.join("<br>") + "</div>" : ""));
});

// The Court: the Imperial Council

registerCampaignHook("marketValue", (player, entry) => {
    // Other cards: what its Fate makes them worth (fatebots.js)
    if (entry.number != councilNumber) { return getFateMarketBonus(player, entry); }
    // The Steward wants to be First Regent all the more (fatebots.js)
    if (isRegent(player)) { return isFirstRegent(player) ? councilValues.alreadyFirstRegent : councilValues.becomeFirstRegent + (hasFate(player, 1) ? 1 : 0); }
    return Math.min(getTrustTotal(), getEmptySlots(player)) * councilValues.perStolen;
});

registerCampaignHook("marketReason", (player, entry) => {
    if (entry.number != councilNumber) { return undefined; }
    if (isRegent(player)) { return isFirstRegent(player) ? "it would choose Crises or Edicts" : "it would become First Regent and choose the Edicts"; }
    return getTrustTotal() > 0 && getEmptySlots(player) > 0 ? "it would steal from the Imperial Trust" : "it would choose Crises or Edicts";
});

// Battles: the Empire, the Free States and the Blight as defenders

const campaignDefenderKinds = {
    empire: "The Empire",
    free: "Free States",
    blight: "The Blight"
};

function makeCampaignDefender(kind) {
    // Stands in for a player in the Battle window. It holds nothing; the Free States have buildings
    const defender = { number: kind, label: campaignDefenderKinds[kind], colour: kind, campaignDefender: kind, isHuman: false,
        guildCards: [], unionDraws: [], shipsBoardValue: 0, starportsValue: kind == "free" ? 1 : 0, startingCity: null, powerValue: 0, outraged: [] };
    playerCounters.forEach(counter => { if (defender[counter + "Value"] == null) { defender[counter + "Value"] = 0; } });
    return defender;
}

registerCampaignHook("battleDefenders", defenders => {
    const attacker = battle.attacker;
    // Regents can't harm Imperial ships, so only an Outlaw can choose the Empire (rulebook p.11)
    const kinds = Object.keys(campaignDefenderKinds).filter(kind => kind != "empire" || !isRegent(attacker));
    // A bot's target may be one of these (targets.js): it starts chosen, with its reason
    const target = !attacker.isHuman ? getBattleTarget(attacker) : null;
    kinds.forEach(kind => {
        const input = document.createElement("input");
        input.type = "radio";
        input.classList.add("btn-check");
        input.name = "battleDefender";
        input.id = "battleDefender_" + kind;
        const defender = () => (target != null && target.kind == kind) ? target.player : makeCampaignDefender(kind);
        // The Free States defend with buildings only
        const freeCounts = () => { if (kind == "free") { battle.fresh = 0; battle.damaged = 0; battle.freshBuildings = Math.max(battle.freshBuildings + battle.damagedBuildings, 1) - battle.damagedBuildings; } };
        input.onchange = () => { battle.defender = defender(); battle.start = null; battle.ships = Math.max(battle.ships, 1); freeCounts(); resetBattleRaid(); updateBattleCounts(); };
        if (target != null && target.kind == kind) {
            input.checked = true;
            battle.defender = defender();
            freeCounts();
            resetBattleRaid();
        }
        const label = document.createElement("label");
        label.classList.add("btn", "btn-sm", "playerchoice", "playerchoice" + kind);
        label.htmlFor = input.id;
        label.innerHTML = campaignDefenderKinds[kind];
        defenders.append(input, label);
    });
    let note = document.getElementById("battleCampaignNote");
    if (note == null) {
        note = document.createElement("div");
        note.id = "battleCampaignNote";
        note.classList.add("defnote");
        defenders.after(note);
    }
    if (!defenders.dataset.campaignNote) {
        defenders.addEventListener("change", showBattleCampaignNote);
        defenders.dataset.campaignNote = "1";
    }
    showBattleCampaignNote();
});

registerCampaignHook("modeChanged", () => {
    // A base game has no Empire note in the Battle window
    if (!campaignMode) {
        const note = document.getElementById("battleCampaignNote");
        if (note != null) { note.remove(); }
    }
});

function showBattleCampaignNote() {
    const note = document.getElementById("battleCampaignNote");
    if (note == null || !campaignMode || campaign == null) { return; }
    const { attacker, defender } = battle;
    const firstRegent = campaign.firstRegent != null ? getPlayer(campaign.firstRegent) : null;
    let lines = [];
    if (defender.campaignDefender == "empire") {
        lines.push("<b>The Empire:</b> only the Imperial ships in the system defend. Enter them as the defender's ships. "
            + (firstRegent != null ? "The First Regent (Player " + firstRegent.number + ") takes any of Player " + attacker.number + "'s ships destroyed as Trophies." : "With no First Regent, any of Player " + attacker.number + "'s ships destroyed go back to it."));
    } else if (defender.campaignDefender == "free") {
        lines.push("<b>The Free States:</b> all the Free buildings in the system defend. Enter them as the defender's buildings. A raid takes exactly 1 resource of the planet's type. Destroying a Free city Provokes Outrage.");
    } else if (defender.campaignDefender == "blight") {
        lines.push("<b>The Blight:</b> all the Blight in the system defends. Enter it as the defender's ships, fresh and damaged. It's Tough: 2 hits damage or destroy it, and 1 hit does nothing. Only hits count against it (not building hits), and it doesn't intercept. Blight destroyed becomes a Trophy.");
    } else if (defender.campaignDefender == null) {
        if (isRegent(attacker) && isRegent(defender)) { lines.push("<b>Truce Law:</b> Regents can't battle each other in a system with Imperial ships."); }
        if (isRegent(defender)) { lines.push("Player " + defender.number + " is a Regent: the Imperial ships in this system defend with them. Count them as their ships."); }
    }
    if (isRegent(attacker) && defender.campaignDefender != "empire") { lines.push("Player " + attacker.number + " is a Regent: it may add the Imperial ships in this system to its attacking ships."); }
    note.innerHTML = tagPlayerNames(lines.join(" "));
    note.classList.toggle("d-none", lines.length == 0);
}

registerCampaignHook("battleTargets", () => {
    // Tough: a fresh Blight needs 4 hits to destroy, a damaged one 2, like 2 ships each. It doesn't intercept
    if (battle.defender.campaignDefender != "blight") { return undefined; }
    return { fresh: battle.fresh * 2, damaged: battle.damaged * 2, limits: { interceptHits: 0 } };
});

registerCampaignHook("raidWants", (attacker, defender) => {
    if (defender.campaignDefender == null) { return undefined; }
    // The Free States: exactly 1 resource of the planet's type, for 1 key (rulebook p.15)
    return defender.campaignDefender == "free" ? [{ id: "free", name: "1 resource of the planet's type", keys: 1, need: 1 }] : [];
});

registerCampaignHook("applyBattle", losses => {
    const { attacker, defender } = battle;
    if (defender.campaignDefender == null) { return undefined; }
    const lines = [];
    adjustCounter(attacker, "shipsBoard", -losses.attackerShips);
    if (defender.campaignDefender == "empire") {
        adjustCounter(attacker, "trophies", losses.defenderShips);
        if (losses.defenderShips > 0) { lines.push(losses.defenderShips + " Imperial ship" + (losses.defenderShips == 1 ? "" : "s") + " destroyed, taken as Trophies"); }
        const firstRegent = campaign.firstRegent != null ? getPlayer(campaign.firstRegent) : null;
        if (losses.attackerShips > 0) {
            if (firstRegent != null && firstRegent !== attacker) { adjustCounter(firstRegent, "trophies", losses.attackerShips); lines.push("Player " + firstRegent.number + " (First Regent) takes " + losses.attackerShips + " of its ships as Trophies"); }
            else { lines.push(losses.attackerShips + " of its ships destroyed, back to its supply"); }
        }
    } else if (defender.campaignDefender == "free") {
        adjustCounter(attacker, "trophies", losses.defenderBuildings);
        if (losses.defenderBuildings > 0) { lines.push(losses.defenderBuildings + " Free building" + (losses.defenderBuildings == 1 ? "" : "s") + " destroyed, taken as Trophies. A Free city destroyed Provokes Outrage of its type: tap it on the panel"); }
        if (losses.attackerShips > 0) { lines.push(losses.attackerShips + " of its ships destroyed"); }
        const stolenList = document.getElementById("battleStolenItems");
        if (getRaidTakenItems().length > 0 || (stolenList != null && stolenList.querySelector("input:checked") != null)) { lines.push("Add the resource it stole on its panel"); }
    } else {
        adjustCounter(attacker, "trophies", losses.defenderShips);
        if (losses.defenderShips > 0) { lines.push(losses.defenderShips + " Blight destroyed, taken as Trophies"); }
        if (losses.attackerShips > 0) { lines.push(losses.attackerShips + " of its ships destroyed"); }
    }
    showMessageToast("Player " + attacker.number + " attacked " + defender.label, lines.length > 0 ? lines.join("<br>") : "Nothing was destroyed.");
    // Objectives can advance for the Trophies taken (fatebots.js)
    runCampaignHook("afterBattle", losses);
    return true;
});
