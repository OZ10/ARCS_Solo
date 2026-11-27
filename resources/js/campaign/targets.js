// Blighted Reach campaign (#85): the Free States, the Blight and the Empire as targets for a bot's
// battles (rulebook p.11, p.15, p.19). The app can't see where they are, so before choosing its
// card, a bot that may Battle and has a reason to fight one of them asks whether the best of them
// is in reach. A Yes makes it the turn's target; a No leaves its usual Rival.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// How much each reason is worth, to choose which to ask about
const campaignTargetWeights = { chased: 2, warlordEmpire: 2.5, warlordBlight: 2, warlordFree: 1.5, noRival: 1, founder: 1.5, clear: 1.75 };
// Blight is Tough (2 hits each), so only with a good few ships there
const blightFleet = 4;
// Fates that want the Blight left alone: the Blight Speaker (Act II) and the Naturalist (Act III)
const blightFriends = [13, 21];
const specialTargetTitles = { free: "Battle the Free States", blight: "Battle the Blight", empire: "Battle the Empire" };
// One defender for each kind, so the Battle window knows it's the bot's target
const specialDefenders = {};

function getSpecialDefender(kind) {
    if (specialDefenders[kind] == null) { specialDefenders[kind] = makeCampaignDefender(kind); }
    return specialDefenders[kind];
}

function canBattleFreely(player, rival) {
    // The Truce Law shields a Rival Regent wherever there are Imperial ships
    return !isRegent(player) || !isRegent(rival);
}

function getCampaignTargetOptions(player) {
    // What it could go after instead of a Rival, best first: [{ kind, reason, resource, value }]
    // None when its Fate rules out battles this Act (steering.js)
    if (avoidsBattle(player)) { return []; }
    const weights = campaignTargetWeights;
    const rivals = players.filter(other => other !== player
        && (other.shipsBoardValue > 0 || other.startingCity || cityCounters.some(counter => other[counter + "Value"] > 0)));
    const free = rivals.filter(rival => canBattleFreely(player, rival));
    const warlord = declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord");
    const fleet = hasAttackFleet(player);
    const options = [];

    // The Free States: a raid takes 1 resource of the planet's type, worth it for one it's chasing
    // that no Rival it can battle freely holds, and that it can't simply tax from its own or a
    // Rival's city of that type (#170: the Tax question comes first)
    const canTaxFor = resource => getResourceSupply(resource) > 0 && players.some(other => other["cities" + capitalise(resource) + "Value"] > 0);
    const chased = preludeResources.filter(resource => getResourceNeed(player, resource) == 2 && !canTaxFor(resource)
        && !free.some(rival => rival[resource + "Value"] + getStealableIconCount(rival, resource) > 0));
    if (chased.length > 0) { options.push({ kind: "free", reason: "chased", resource: chased[0], value: weights.chased }); }
    else if (warlord) { options.push({ kind: "free", reason: "warlord", value: weights.warlordFree }); }

    // The Blight: Trophies for Warlord; early in Act I, clearing it to spread out and build; otherwise
    // when it has no useful battle with a Rival (#168, the user 2026-11-27). The board says where it's
    // in reach with enough ships (fewer for damaged Blight). Not once the board said none this turn
    const blightAnswer = (player.steerAnswers || {}).blight;
    if (!blightFriends.includes(getFateNumber(player)) && blightAnswer !== false) {
        if (warlord && getFleetForBattle(player) >= blightFleet) { options.push({ kind: "blight", reason: "warlord", value: weights.warlordBlight }); }
        else if (!warlord && isEarlyCampaign()) { options.push({ kind: "blight", reason: "clear", value: weights.clear }); }
        else if (!warlord && getUsefulRivalBattle(player) == null) { options.push({ kind: "blight", reason: "noRival", value: weights.noRival }); }
    }

    // The Empire, for an Outlaw: Imperial ships are Trophies, and the Founder wants its systems
    if (!isRegent(player)) {
        if (warlord) { options.push({ kind: "empire", reason: "warlord", value: weights.warlordEmpire }); }
        else if (hasFate(player, 2) && campaign.act == 1 && fleet) { options.push({ kind: "empire", reason: "founder", value: weights.founder }); }
    }
    // Not the Free States or the Blight its Fate wants left alone (steering.js)
    const avoided = getSteerAvoidTargets(player);
    return options.filter(option => !avoided.includes(option.kind)).sort((a, b) => b.value - a.value);
}

function getCampaignTargetQuestion(player, option) {
    const regent = isRegent(player) && option.kind != "empire" ? " Imperial ships there can join my attack." : "";
    if (option.kind == "free") {
        if (option.resource != null) {
            const name = preludeResourceNames[option.resource];
            return "Is there a Free city or starport on a " + name.toLowerCase() + " planet, in a system where I have ships? (To raid 1 " + name + " from the Free States.)" + regent;
        }
        return "Is there a Free city or starport in a system where I have ships? (Free buildings destroyed are Trophies.)" + regent;
    }
    if (option.kind == "blight") {
        return "Is there Blight in a system where I have at least " + blightFleet + " ships? (Each Blight takes 2 hits, and is a Trophy.)" + regent;
    }
    return "Is there a system where my ships outnumber the Imperial ships? (As an Outlaw I can battle the Empire" + (option.reason == "founder" ? ", to take its systems.)" : ", and its ships are Trophies.)");
}

// #168: with no undefended Rival to fight, the Blight comes first, before the fleet question. A Yes
// makes it the turn's target and skips the fleet question; a No isn't asked again this turn
registerCampaignHook("botQuestionsFirst", (player, carryOn) => {
    if (player.isHuman || player.campaignTarget !== undefined || (player.steerAnswers || {}).blight !== undefined) { return undefined; }
    if (!getBotCards(player).some(card => card.actions.includes("battle")) && player.weaponsValue == 0) { return undefined; }
    const option = getCampaignTargetOptions(player).find(item => item.kind == "blight" && (item.reason == "noRival" || item.reason == "clear"));
    if (option == null) { return undefined; }
    // The board answers whether it's in reach, so it's never asked (#85 stage 7b)
    const system = findSpecialTargetSystem(player, option);
    player.steerAnswers = player.steerAnswers || {};
    player.steerAnswers.blight = system != null;
    if (system != null) {
        player.campaignTarget = { ...option, system: system };
        player.battleTargetNumber = null;
    }
    SaveAllSettings();
    return undefined;
});

registerCampaignHook("skipFleetQuestion", player => (player.campaignTarget != null && player.campaignTarget.kind == "blight") ? true : undefined);

registerCampaignHook("fleetQuestionNote", player => " Free buildings and Blight count too" + (isRegent(player) ? ", and Imperial ships can join me." : ", and so do Imperial ships.")
    + (hasRivalRegent(player) ? truceQuestionNote : ""));

registerCampaignHook("botQuestions", (player, carryOn) => {
    // Asked once a turn, when it has a card that can Battle and a reason to fight one of them
    if (player.campaignTarget !== undefined) { return undefined; }
    const option = getCampaignTargetOptions(player)[0];
    if (option == null || player.shipsBoardValue == 0 || !getBotCards(player).some(card => card.actions.includes("battle"))) {
        player.campaignTarget = null;
        return undefined;
    }
    // The board answers whether it's in reach (#85 stage 7b): the first option it can reach
    const reachable = getCampaignTargetOptions(player).map(item => ({ ...item, system: findSpecialTargetSystem(player, item) })).find(item => item.system != null);
    player.campaignTarget = reachable || null;
    if (reachable != null) { player.battleTargetNumber = null; }
    SaveAllSettings();
    return undefined;
});

registerCampaignHook("knownYes", (ambition, action, player) => {
    // A Yes already answers its ambition's Battle question
    const target = player.campaignTarget;
    if (target == null || action != "battle") { return undefined; }
    if (ambition == "WARLORD" && target.reason == "warlord") { return "the board shows " + getSpecialTargetPlace(target) + " in reach"; }
    const resources = ambitionTaxResources[ambition];
    if (target.kind == "free" && target.resource != null && resources != null && resources.includes(target.resource)) {
        return "the board shows a Free " + preludeResourceNames[target.resource].toLowerCase() + " building in reach";
    }
    return undefined;
});

function getSpecialTargetPlace(target) {
    return { free: "a Free building", blight: "Blight", empire: "a system with fewer Imperial ships" }[target.kind];
}

registerCampaignHook("specialBattleTarget", player => {
    const target = player.campaignTarget;
    if (target == null) { return undefined; }
    const regent = isRegent(player) && target.kind != "empire" ? " Imperial ships there can join its attack." : "";
    let why, where;
    if (target.kind == "free") {
        const name = target.resource != null ? preludeResourceNames[target.resource] : null;
        why = name != null ? "It wants " + name + " (it's chasing " + capitalise(target.resource == "weapons" ? "warlord" : preludeAmbitions[target.resource]) + "): a raid takes 1 " + name + " from a Free building on a " + name.toLowerCase() + " planet."
            : "Chasing Warlord: Free buildings destroyed are Trophies.";
        where = "A starport if there is one: destroying a Free city Provokes Outrage." + regent;
    } else if (target.kind == "blight") {
        why = target.reason == "warlord" ? "Chasing Warlord: Blight destroyed is a Trophy."
            : target.reason == "clear" ? "Early in the Act: clearing the Blight opens the planet to build on, and keeps it from hitting its ships in a Crisis."
            : "No battle with a Rival is worth it now: clearing the Blight keeps it from hitting its ships in a Crisis.";
        where = "Each Blight takes 2 hits." + regent;
    } else {
        why = target.reason == "warlord" ? "Chasing Warlord: Imperial ships destroyed are Trophies." : "Its Fate, the Founder, advances for each system it controls: the Empire holds them now.";
        where = "The First Regent takes any of its ships destroyed as Trophies.";
    }
    // Where, from the board (#85 stage 7b)
    if (target.system != null) { where = "At " + getSystemName(target.system) + ", from the board. " + where; }
    return { player: getSpecialDefender(target.kind), kind: target.kind, title: specialTargetTitles[target.kind], why: why, where: where };
});
