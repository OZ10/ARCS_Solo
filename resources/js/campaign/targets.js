// Blighted Reach campaign (#85): the Free States, the Blight and the Empire as targets for a bot's
// battles (rulebook p.11, p.15, p.19). The app can't see where they are, so before choosing its
// card, a bot that may Battle and has a reason to fight one of them asks whether the best of them
// is in reach. A Yes makes it the turn's target; a No leaves its usual Rival.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// How much each reason is worth, to choose which to ask about
const campaignTargetWeights = { chased: 2, warlordEmpire: 2.5, warlordBlight: 2, warlordFree: 1.5, noRival: 1, founder: 1.5 };
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
    const weights = campaignTargetWeights;
    const rivals = players.filter(other => other !== player
        && (other.shipsBoardValue > 0 || other.startingCity || cityCounters.some(counter => other[counter + "Value"] > 0)));
    const free = rivals.filter(rival => canBattleFreely(player, rival));
    const warlord = declaredAmbitions.includes("warlord") && isChasingAmbition(player, "warlord");
    const fleet = hasAttackFleet(player);
    const options = [];

    // The Free States: a raid takes 1 resource of the planet's type, worth it for one it's chasing
    // that no Rival it can battle freely holds
    const chased = preludeResources.filter(resource => getResourceNeed(player, resource) == 2
        && !free.some(rival => rival[resource + "Value"] + getGuildIconCount(rival, resource) > 0));
    if (chased.length > 0) { options.push({ kind: "free", reason: "chased", resource: chased[0], value: weights.chased }); }
    else if (warlord) { options.push({ kind: "free", reason: "warlord", value: weights.warlordFree }); }

    // The Blight: Trophies for Warlord, or with no Rival to battle freely, clearing it from its ships
    if (!blightFriends.includes(getFateNumber(player)) && getFleetForBattle(player) >= blightFleet) {
        if (warlord) { options.push({ kind: "blight", reason: "warlord", value: weights.warlordBlight }); }
        else if (free.length == 0 && fleet) { options.push({ kind: "blight", reason: "noRival", value: weights.noRival }); }
    }

    // The Empire, for an Outlaw: Imperial ships are Trophies, and the Founder wants its systems
    if (!isRegent(player)) {
        if (warlord) { options.push({ kind: "empire", reason: "warlord", value: weights.warlordEmpire }); }
        else if (hasFate(player, 2) && campaign.act == 1 && fleet) { options.push({ kind: "empire", reason: "founder", value: weights.founder }); }
    }
    return options.sort((a, b) => b.value - a.value);
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

registerCampaignHook("fleetQuestionNote", player => " Free buildings and Blight count too" + (isRegent(player) ? ", and Imperial ships can join me." : ", and so do Imperial ships."));

registerCampaignHook("botQuestions", (player, carryOn) => {
    // Asked once a turn, when it has a card that can Battle and a reason to fight one of them
    if (player.campaignTarget !== undefined) { return undefined; }
    const option = getCampaignTargetOptions(player)[0];
    if (option == null || player.shipsBoardValue == 0 || !getBotCards(player).some(card => card.actions.includes("battle"))) {
        player.campaignTarget = null;
        return undefined;
    }
    askYesNo("BATTLE", getCampaignTargetQuestion(player, option), inReach => {
        player.campaignTarget = inReach ? option : null;
        player.battleTargetNumber = null;
        SaveAllSettings();
        carryOn();
    });
    return true;
});

registerCampaignHook("knownYes", (ambition, action, player) => {
    // A Yes already answers its ambition's Battle question
    const target = player.campaignTarget;
    if (target == null || action != "battle") { return undefined; }
    if (ambition == "WARLORD" && target.reason == "warlord") { return "you said " + getSpecialTargetPlace(target) + " is in reach"; }
    const resources = ambitionTaxResources[ambition];
    if (target.kind == "free" && target.resource != null && resources != null && resources.includes(target.resource)) {
        return "you said a Free " + preludeResourceNames[target.resource].toLowerCase() + " building is in reach";
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
        where = "The Free " + (name != null ? name.toLowerCase() + " " : "") + "building you said is in reach. A starport if there is one: destroying a Free city Provokes Outrage." + regent;
    } else if (target.kind == "blight") {
        why = target.reason == "warlord" ? "Chasing Warlord: Blight destroyed is a Trophy." : "Every Rival is a Regent, shielded by the Truce Law: clearing the Blight keeps it from hitting its ships in a Crisis.";
        where = "The system with Blight where it has at least " + blightFleet + " ships. Each Blight takes 2 hits." + regent;
    } else {
        why = target.reason == "warlord" ? "Chasing Warlord: Imperial ships destroyed are Trophies." : "Its Fate, the Founder, advances for each system it controls: the Empire holds them now.";
        where = "Where its ships outnumber the Imperial ships. The First Regent takes any of its ships destroyed as Trophies.";
    }
    return { player: getSpecialDefender(target.kind), kind: target.kind, title: specialTargetTitles[target.kind], why: why, where: where };
});
