// Blighted Reach campaign (#85): the Act II and III Fate cards' own actions for bots, offered in
// the bot's prelude window like any Guild card's (Claim Fief, Building Bunkers, Repair Hammer...).
// The app decides one itself when it can tell it's possible and worth it; the rest depend on the
// map, so they're left for the player to tick. Act I's (Spy, Recover, Teach...) are in fatebots.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function isFateActionPlayer(player, fate, acts) {
    return campaign != null && !player.isHuman && acts.includes(campaign.act) && hasFate(player, fate);
}

function getFateActionOffers(player, wants, can) {
    // Instead of one of its card's actions. Called from fatebots.js's guildActionOffers
    const offers = [];
    const instead = (name, action) => name + " instead of " + replacedActionNames[action];

    // The Warden: a Seat above one of its Loyal cities in a cluster with no Seat
    if (isFateActionPlayer(player, 16, [2, 3]) && can("tax") && getCityCount(player) > 0) {
        offers.push({ label: instead("Claim Fief", "tax"), text: "place a Seat above one of its Loyal cities in a cluster with no Seat (Claims of Nobility). If every cluster with its cities has a Seat, it Taxes instead",
            decided: true, why: "Each Seat it controls advances its objective 2, and its Fiefs count for its cities." });
    }
    // The Survivalist: a Bunker captures a Rival's agent, and Bunkers count with Captives
    if (isFateActionPlayer(player, 18, [3]) && can("build") && player.agentsOut !== true) {
        offers.push({ label: instead("Build a Bunker", "build"), text: "scrap 1 of its agents to place a Bunker on a planet with none, then capture 1 agent from a Rival's supply (Building Bunkers). The app adds the Captive",
            gains: { captives: 1 }, decided: true, why: "Each ambition it wins counts the lower of its Captives and its Bunkers: a Bunker adds one of each." });
    }
    // The Planet Breaker: the Planet Hammer
    if (isFateActionPlayer(player, 11, [2])) {
        if (can("repair")) { offers.push({ label: instead("Repair Hammer", "repair"), text: "take a Hammer Fragment it controls and place 1 fresh ship. With all 6 Fragments it takes the Planet Hammer" }); }
        if (can("build")) { offers.push({ label: instead("Prepare", "build"), text: "with the Planet Hammer: place a Hammer token at a planet it controls" }); }
        if (can("battle")) { offers.push({ label: instead("Break World", "battle"), text: "flip a Hammer token at a planet it controls (Crush a Planet into Dust: its objective advances 6)" }); }
    }
    // The Blight Speaker: Spore Ships
    if (isFateActionPlayer(player, 13, [2]) && can("build")) {
        offers.push({ label: instead("Spawn", "build"), text: "damage a fresh Blight it controls to place a damaged Blight (Spore Ships). Each one placed advances its objective 1" });
    }
    // The Naturalist: Spore Guides
    if (isFateActionPlayer(player, 21, [3]) && can("build")) {
        offers.push({ label: instead("Seed", "build"), text: "roll the number die (change it by 1 for each Loyal agent returned from the Court), and place 1 damaged Blight in a system with no Blight in that cluster (Spore Guides)" });
    }
    // The Founder: Freedom Fighters
    if (isFateActionPlayer(player, 2, [3]) && can("battle")) {
        offers.push({ label: instead("Incite Revolt", "battle"), text: "in a system with a fresh Free city, destroy all damaged Rival and Imperial ships, ignoring the Truce Law. No Trophies (Freedom Fighters)" });
    }
    return offers;
}

function getFatePreludeOffers(player) {
    // In its prelude. Called from fatebots.js's preludeOffers
    const offers = [];
    // The Hegemon: Banners, more than once if it can
    if (isFateActionPlayer(player, 10, [2, 3])) {
        offers.push({ label: "Plant a Banner", text: "place a Banner at its Flagship's planet, if there's no Banner and no Rival ships or buildings there (Planting Banners)" });
    }
    // The Pathfinder: Clues to the Portal
    if (isFateActionPlayer(player, 9, [2]) && preludeResources.some(resource => player[resource + "Value"] > 0)) {
        offers.push({ label: "Uncover a Clue", text: "with its Flagship at a planet with no Clue, spend 1 resource different from every planet type in that cluster. The player to its right places a Clue (Uncovering Clues). Take the resource off its panel" });
    }
    return offers;
}
