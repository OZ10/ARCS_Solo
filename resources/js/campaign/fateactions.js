// Blighted Reach campaign (#85): the Act II and III Fate cards' own actions for bots, offered in
// the bot's prelude window like any Guild card's (Claim Fief, Building Bunkers, Repair Hammer...).
// Each is decided from the app's board, with its place (campaign/fateboard.js). The Pathfinder's Clues
// are still for the player to carry out. Act I's (Spy, Recover, Teach...) are in fatebots.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function isFateActionPlayer(player, fate, acts) {
    return campaign != null && !player.isHuman && acts.includes(campaign.act) && hasFate(player, fate);
}

function getFateActionOffers(player, wants, can) {
    // Instead of one of its card's actions. Called from fatebots.js's guildActionOffers. Each is
    // decided from the app's board, with its place (campaign/fateboard.js, #85 stage 7d): none when
    // the board has nowhere for it
    const offers = [];
    const instead = (name, action) => name + " instead of " + replacedActionNames[action];
    const add = (name, action, kind, extras) => {
        if (!can(action)) { return; }
        const decided = getFateBoardOffer(player, kind, can);
        if (decided == null) { return; }
        offers.push(Object.assign({ label: instead(name, action), text: decided.text, decided: true, why: decided.why, where: decided.where }, extras));
    };

    // The Warden: a Seat above one of its Loyal cities in a cluster with no Seat
    if (isFateActionPlayer(player, 16, [2, 3])) { add("Claim Fief", "tax", "seat"); }
    // The Survivalist: a Bunker captures a Rival's agent, and Bunkers count with Captives
    if (isFateActionPlayer(player, 18, [3]) && player.agentsOut !== true) { add("Build a Bunker", "build", "bunker", { gains: { captives: 1 } }); }
    // The Planet Breaker: Hammer Fragments, then the Planet Hammer
    if (isFateActionPlayer(player, 11, [2])) {
        add("Repair Hammer", "repair", "fragment");
        add("Prepare", "build", "prepare");
        add("Break World", "battle", "break");
    }
    // The Blight Speaker: Spore Ships
    if (isFateActionPlayer(player, 13, [2])) { add("Spawn", "build", "spawn"); }
    // The Naturalist: Spore Guides
    if (isFateActionPlayer(player, 21, [3])) { add("Seed", "build", "seed"); }
    // The Founder: Freedom Fighters
    if (isFateActionPlayer(player, 2, [3])) { add("Incite Revolt", "battle", "revolt"); }
    // The Pathfinder (Act III): Use the Portal
    if (isFateActionPlayer(player, 9, [3])) { add("Use the Portal", "move", "portal"); }
    return offers;
}
function getFatePreludeOffers(player) {
    // In its prelude. Called from fatebots.js's preludeOffers
    const offers = [];
    // The Hegemon: Banners, more than once if it can
    if (isFateActionPlayer(player, 10, [2, 3])) {
        // At its Flagship's planet, when the board shows it can (campaign/fateboard.js)
        const banner = getFateBoardOffer(player, "banner");
        if (banner != null) { offers.push({ label: "Plant a Banner", text: banner.text, decided: true, why: banner.why, where: banner.where }); }
    }
    // The Pathfinder (Act III): its Pilgrims a step towards the Portal, once a turn (campaign/fateboard.js)
    if (isFateActionPlayer(player, 9, [3])) {
        const pilgrims = getFateBoardOffer(player, "pilgrims");
        if (pilgrims != null) { offers.push({ label: "Move Pilgrims", text: pilgrims.text, decided: true, why: pilgrims.why, where: pilgrims.where }); }
    }
    // The Pacifist: a Witness at a Psionic planet it controls, flipped and taken (campaign/fateboard.js)
    if (isFateActionPlayer(player, 14, [2])) {
        const witness = getFateBoardOffer(player, "witness");
        if (witness != null) { offers.push({ label: "Take a Witness", text: witness.text, gains: { psionics: 1 }, decided: true, why: witness.why, where: witness.where }); }
    }
    // The Pathfinder: Clues to the Portal
    if (isFateActionPlayer(player, 9, [2]) && preludeResources.some(resource => player[resource + "Value"] > 0)) {
        offers.push({ label: "Uncover a Clue", text: "with its Flagship at a planet with no Clue, spend 1 resource different from every planet type in that cluster. The player to its right places a Clue (Uncovering Clues). Take the resource off its panel" });
    }
    return offers;
}
