// Guild actions (#86): some Guild cards have an action a bot can take in place of one of its
// normal actions, such as Abduct instead of a Battle (see replacesActions in court.js). After a
// bot's prelude it offers the ones it would like in the same window, and the player ticks the
// ones worth doing. The chances are in rules.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// How each normal action reads in the window
const replacedActionNames = { battle: "a Battle", build: "a Build", influence: "an Influence", tax: "a Tax" };

function canUseGuildActionInsteadOf(player, action) {
    // The bot holds a card it could use in place of this action. Pressgang needs captives to return
    return getPlayerGuildCards(player).some(card => (card.replacesActions || []).some(guildAction =>
        guildAction.replaces == action && (guildAction.name != "Pressgang" || player.captivesValue > 0)));
}

function getBotActionCount(player) {
    // How many actions the bot has this turn: its card's, plus any extra from its prelude.
    // A Weapon only turns one of the card's actions into a Battle, so adds none
    const play = getBotPlay(player);
    if (play == null) { return 0; }
    const spent = (player.prelude != null && player.prelude.spent != null) ? player.prelude.spent : [];
    return play.count + spent.filter(offer => offer.action != null && !offer.converts).length;
}

function getGuildActionOffers(player) {
    // What the bot would like to do this turn, in the same form as its prelude offers
    const wants = chance => Math.random() * 100 < Math.min(chance, preludeChance.max);
    const holds = name => getPlayerGuildCards(player).some(card => (card.replacesActions || []).some(guildAction => guildAction.name == name));
    const can = action => canBotTakeAction(player, action);
    const labelFor = (name, action) => name + " instead of " + replacedActionNames[action];
    let offers = [];

    // Abduct: captures from a Court card with fewer Rival agents than its Weapon icons, so it
    // needs at least 2. The most use when chasing Tyrant. The Court isn't tracked, so the player
    // checks there's such a card and adds the captives
    const weaponIcons = player.weaponsValue + getGuildIconCount(player, "weapons");
    if (holds("Abduct") && can("battle") && weaponIcons >= 2) {
        const chasingTyrant = isAmbitionInPlay("tyrant") && isChasingAmbition(player, "tyrant");
        if (wants(guildActionChance.abduct + (chasingTyrant ? guildActionChance.abductTyrant : 0))) {
            offers.push({ label: labelFor("Abduct", "battle"),
                text: "capture all Rival agents from a Court card with fewer than " + weaponIcons + " Rival agents, if there is one (add the captives yourself)" });
        }
    }

    // Execute or Pressgang use up all its captives, so not if it's chasing Tyrant with them.
    // Execute if it wants trophies for Warlord, otherwise Pressgang for resources
    const captives = player.captivesValue;
    if (captives > 0 && !(isAmbitionInPlay("tyrant") && isChasingAmbition(player, "tyrant"))) {
        const wantsTrophies = isAmbitionInPlay("warlord") && isChasingAmbition(player, "warlord");
        if (holds("Execute") && can("influence") && wants(guildActionChance.execute + (wantsTrophies ? guildActionChance.executeWarlord : 0))) {
            offers.push({ label: labelFor("Execute", "influence"), text: "move " + captives + " Captive" + (captives == 1 ? "" : "s") + " to its Trophies",
                costs: { captives: captives }, gains: { trophies: captives } });
        } else if (holds("Pressgang") && can("build") && !wantsTrophies && getEmptySlots(player) > 0 && wants(guildActionChance.pressgang)) {
            // The resource it most needs. Equally good ones are picked at random, as a person might
            const best = Math.max(...preludeResources.map(resource => getResourceNeed(player, resource)));
            const choices = preludeResources.filter(resource => getResourceNeed(player, resource) == best);
            const resource = choices[Math.floor(Math.random() * choices.length)];
            // No more than it has empty slots for
            const amount = Math.min(captives, getEmptySlots(player));
            offers.push({ label: labelFor("Pressgang", "build"),
                text: "return " + amount + " Captive" + (amount == 1 ? "" : "s") + " to gain " + amount + " " + preludeResourceNames[resource],
                costs: { captives: amount }, gains: { [resource]: amount } });
        }
    }

    // Manufacture and Synthesize: a resource instead of a Build, more likely when chasing Tycoon
    [["Manufacture", "materials"], ["Synthesize", "fuel"]].forEach(([name, resource]) => {
        if (holds(name) && can("build") && getEmptySlots(player) > 0) {
            const chasingTycoon = isAmbitionInPlay("tycoon") && isChasingAmbition(player, "tycoon");
            if (wants(guildActionChance.gainResource + (chasingTycoon ? guildActionChance.gainResourceTycoon : 0))) {
                offers.push({ label: labelFor(name, "build"), text: "gain 1 " + preludeResourceNames[resource], gains: { [resource]: 1 } });
            }
        }
    });

    // Trade: it needs a resource to give. Who it trades with depends on the board
    if (holds("Trade") && can("tax") && preludeResources.some(resource => player[resource + "Value"] > 0) && wants(guildActionChance.trade)) {
        offers.push({ label: labelFor("Trade", "tax"),
            text: "if it controls a Rival city, take a resource of that city's type from them and give them one they don't have (adjust the resources yourself)" });
    }

    // No more than it has actions for
    return offers.slice(0, getBotActionCount(player));
}

function startGuildActions(player) {
    // Called after the prelude. Like the prelude, decided once and saved
    if (player.guildActions == null) {
        player.guildActions = { offers: getGuildActionOffers(player), spent: null };
        SaveAllSettings();
    }
    if (player.guildActions.offers.length > 0 && player.guildActions.spent == null) {
        showPreludeModal(player, "guild");
    } else {
        openTurnWindow();
    }
}

function describeGuildActions(player) {
    // e.g. "Guild actions: Abduct instead of a Battle"
    if (player.guildActions == null || player.guildActions.spent == null || player.guildActions.spent.length == 0) { return null; }
    return "Guild actions: " + player.guildActions.spent.map(offer => offer.label).join(", ");
}
