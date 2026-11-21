// Blighted Reach campaign (#85): bots playing towards their Act II and III objectives. Each Fate has
// a "steer" for each Act: what it changes in how the bot plays, through the levers the bot already
// has (what it needs, which actions it plans or rules out, where it moves, which ambition it leads
// with), a short list of it for its turn window, and, for Fates built around tokens the app can't
// see, what to do with them on the table. Act I is fatebots.js.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html
//
// fateSteers[fate number][act]:
// name    - the Fate's name for the plan's tag
// notes   - "Playing towards it": what it changes, for the turn window
// keep    - { resource: need } it holds on to (2 like an ambition it's chasing, 1 a little)
// spend   - { resource: { while: ambition declared, why } } it spends in its prelude instead
// avoid   - actions it doesn't take ("battle")
// prefer  - ambitions it leads with to declare, while it holds any of what they count
// plan    - { action: { add, reason } }: more (or less) keen, and why
// move    - a reason to Move it puts first
// table   - what to do with its tokens on the table
// keepAll - it holds on to every resource (the Pirate)
// cannotDeclare - ambitions it can't declare
// avoidTargets  - the Free States ("free") or the Blight ("blight") it won't battle
// court(player, card, entry)     - { value, reason } a Court card is worth more (or null)
// policy(firstRegent, policy, plan) - { value, note } a Policy is worth more or less as First Regent
// target(player, rival)          - how much more it wants to battle that Rival
// extra(player)                  - a line for its turn window that depends on the game
// keep, prefer and notes can also be functions of the player

const fateSteers = {
    // The Steward (Act II): First Regent, the Empire's clusters and the Imperial Trust
    1: { 2: {
        name: "Steward",
        notes: ["<b>Wants to be First Regent</b>: the Imperial Council is worth more to it, and it stays a Regent.",
            "<b>As First Regent</b>, it enforces the Policy whose Demand fills the Imperial Trust (Ensure the Emperor's Tribute).",
            "It counts the clusters where the Empire controls systems at the end of each chapter (Expand the Empire)."],
        plan: { influence: { add: 0.25 } },
        policy: (firstRegent, policy, plan) => {
            const trust = plan.filter(item => item.kind != null && trustResources.includes(item.kind)).length;
            return trust > 0 ? { value: trust * 0.5, note: "Each resource into the Imperial Trust advances its objective" } : null;
        } } },
    // The Founder (Act II): the Commonwealth, and Free cities the Empire doesn't control
    2: { 2: {
        name: "Founder",
        notes: ["<b>Won't battle the Free States</b>: each Free city the Empire doesn't control advances its objective (Protect Freedom).",
            "<b>Wants the Commonwealth to win its ambition</b>: 2 for each Member."],
        avoidTargets: ["free"],
        table: "<b>Founder of the Commonwealth:</b> when it declares an ambition, it may place the Commonwealth marker instead (Commonwealth Ambition). Members share it. <span class=\"text-secondary\">The app asks about the Free cities and Members at the end of the chapter.</span>" } },
    // The Magnate (Act II): Monopolies
    3: { 2: {
        name: "Magnate",
        notes: ["<b>Hoards the resource it holds most</b>, to hold more than half of it in play and take its Monopoly (Gain Monopolies).",
            "It trades the rest more readily in Summits."],
        keep: player => {
            const most = getMostHeldResource(player);
            return most != null ? { [most]: 2 } : {};
        },
        extra: player => {
            const most = getMostHeldResource(player);
            return most != null ? "Hoarding " + getGameIcon(most) + " " + preludeResourceNames[most] + "." : "";
        },
        table: "<b>Gain Monopolies</b> (Edict 20): a player with more than half of a resource type in play takes its Monopoly card from the supply. <span class=\"text-secondary\">The app asks how many it gained and holds at the end of the chapter.</span>" } },
    // The Advocate (Act II): Guild suits and more Guild cards than Rivals
    4: { 2: {
        name: "Advocate",
        notes: ["<b>Wants Guild cards of suits it doesn't have</b> (Connect with the Guilds).",
            "<b>Secures and influences more</b>, to have more Guild cards than each Rival (Improve Your Standing)."],
        plan: { secure: { add: 0.5 }, influence: { add: 0.5 } },
        court: (player, card) => {
            if (card.type != "guild" || card.resource == null) { return null; }
            const suits = new Set(getPlayerGuildCards(player).map(own => own.resource));
            return suits.has(card.resource) ? null : { value: 0.5, reason: "it has no " + preludeResourceNames[card.resource] + " Guild card yet (Connect with the Guilds)" };
        },
        table: "<b>Advocate's Demand</b> (Edict 45) and <b>Guild Negotiations</b>: follow the cards on the table." } },
    // The Caretaker (Act II): lore
    5: { 2: {
        name: "Caretaker",
        notes: ["<b>Wants lore cards</b> in the Court: each one it secures advances its objective 2 (Collect the Galaxy's Knowledge).",
            "<b>Secures more</b>, and asks Rivals for lore cards in Summits."],
        plan: { secure: { add: 0.5 } },
        table: "<b>Lore cards in the Court:</b> if one is in reach, it secures that before other cards. <b>Librarians</b> and <b>Knowledge Set Free:</b> follow the cards on the table." } },
    // The Partisan (Act II): the initiative
    6: { 2: {
        name: "Partisan",
        notes: ["<b>Keen to keep or seize the initiative</b>: each card it plays while it has it advances its objective (Show Your Leadership).",
            "It seizes by Provoking Outrage of a resource it holds little of."],
        table: "<b>People's Hero:</b> when it declares an ambition, it clears Outrage of that ambition's type if it has more Guild cards of that type than each Rival. <span class=\"text-secondary\">The app asks about it at the end of the chapter.</span>" } },
    // The Admiral (Act II): a Regent, Outlaws' pieces as Trophies, Regent agents captured
    7: { 2: {
        name: "Admiral",
        notes: ["<b>Stays a Regent</b>, and battles Outlaws before Rival Regents (Crush the Empire's Foes).",
            "<b>Wants Court cards with Rival Regents' agents</b>, to capture them (Dominate Rival Regents)."],
        court: (player, card, entry) => {
            if (!isRegent(player)) { return null; }
            const agents = players.filter(other => other !== player && isRegent(other)).reduce((total, other) => total + (entry.agents[other.number] || 0), 0);
            return agents > 0 ? { value: Math.min(agents * 0.5, 1.5), reason: "it would capture " + agents + " Regent agent" + (agents == 1 ? "" : "s") + " (Dominate Rival Regents)" } : null;
        },
        table: "<b>Command Chaos</b> is in the Court deck. <span class=\"text-secondary\">The app asks about the Empire's planets, Trophies and captured agents at the end of the chapter.</span>" } },
    // The Believer (Act II): ambitions with Ideal markers
    8: { 2: {
        name: "Believer",
        notes: ["<b>Asks which declared ambitions have an Ideal marker</b>, then leads with those ambitions and holds on to what they count (Develop the Ideals of Your Faith)."],
        prefer: player => getIdealAmbitions(player),
        keep: player => Object.fromEntries(preludeResources.filter(resource => getIdealAmbitions(player).includes(preludeAmbitions[resource])).map(resource => [resource, 2])),
        extra: player => {
            const ideals = getIdealAmbitions(player);
            return ideals.length > 0 ? "Ideal markers on " + ideals.map(capitalise).join(" and ") + "." : "";
        },
        table: "<b>Set Doctrine</b> and <b>Doctrinal Faith:</b> follow the cards on the table. <span class=\"text-secondary\">The app asks once a chapter whether each declared ambition has an Ideal marker.</span>" } },
    // The Pathfinder (Act II): Clues to the Portal
    9: { 2: {
        name: "Pathfinder",
        notes: ["<b>Moves its Flagship</b> to planets with no Clue, to uncover the next one (Find the Portal)."],
        plan: { move: { add: 0.75 } },
        move: "its Flagship to a planet with no Clue, to uncover one there next turn",
        table: "<b>Uncovering Clues</b> (prelude): with its Flagship at a planet with no Clue, it spends 1 resource different from every planet type in that cluster. The player to its right places a Clue: a Check Clue if the cluster or the symbol is right." } },
    // The Hegemon (Act II): Banners on the map, double if it wins an ambition
    10: { 2: {
        name: "Hegemon",
        notes: ["<b>Moves its Flagship on</b>: each planet with no Banner and no Rival pieces can take one (Plant Banners).",
            "<b>Wants to win an ambition</b> this chapter: every Banner then counts double."],
        plan: { move: { add: 1 } },
        move: "its Flagship to a planet with no Banner and no Rival pieces, to plant a Banner there next turn",
        table: "<b>Planting Banners</b> (prelude): place a Banner at its Flagship's planet if there's no Banner and no Rival ships or buildings there. It can do this more than once. <span class=\"text-secondary\">The app asks how many Banners are on the map at the end of the chapter.</span>" } },
    // The Planet Breaker (Act II): the Planet Hammer
    11: { 2: {
        name: "Planet Breaker",
        notes: ["<b>Moves its Flagship</b> to planets with Hammer Fragments, to take them (Repair the Planet Hammer).",
            "With the Planet Hammer, it Prepares a planet it controls, then breaks it (Crush a Planet into Dust)."],
        plan: { move: { add: 0.75 }, repair: { add: 0.5 }, build: { add: 0.25 } },
        move: "its Flagship to a planet with a Hammer Fragment, to take it",
        table: "<b>Repair Hammer</b> (instead of a Repair): take a Fragment it controls and place 1 fresh ship. With all 6, it takes the Planet Hammer. <b>Prepare</b> (instead of a Build): a Hammer token at a planet it controls. <b>Break World</b> (instead of a Battle): flip a Hammer token." } },
    // The Pirate (Act II): the Hoard
    12: { 2: {
        name: "Pirate",
        notes: ["<b>Keeps every resource</b>: it spends none in its prelude and trades none away.",
            "<b>Raids more</b>, and battles Rivals holding resources first: what it steals goes on its Hoard (Grow Your Hoard)."],
        keepAll: true,
        plan: { battle: { add: 0.5, reason: "Stolen resources go on its Hoard" } },
        target: (player, rival) => {
            const held = preludeResources.reduce((total, resource) => total + rival[resource + "Value"], 0);
            return held >= 2 ? 1 : 0;
        },
        table: "<b>Pirate Hoard:</b> resources it steals go on the Hoard, 2 keys each. <span class=\"text-secondary\">The app asks how many are on it at the end of the chapter.</span>" } },
    // The Blight Speaker (Act II): Blight near its ships
    13: { 2: {
        name: "Blight Speaker",
        notes: ["<b>Won't battle the Blight</b>, and moves its ships to systems with Blight (Contact an Ancient Intelligence).",
            "<b>Wants to win ambitions</b>: each one counts the Blight with its ships."],
        avoidTargets: ["blight"],
        plan: { move: { add: 0.5 }, build: { add: 0.25 } },
        move: "ships to a system with Blight",
        table: "<b>Spore Ships:</b> its Catapults aren't ended by Blight. <b>Spawn</b> (instead of a Build): damage a fresh Blight it controls to place a damaged Blight. <span class=\"text-secondary\">The app asks about the Blight at the end of the chapter.</span>" } },
    // The Pacifist (Act II): no Trophies or Captives; Psionics spent while Empath is declared
    14: { 2: {
        name: "Pacifist",
        notes: ["<b>No battles</b> that would take Trophies or Captives (Commit to Pacifism).",
            "<b>Keeps Psionics</b> until Empath is declared, then spends them in its prelude for an action from the lead card (Spread Empathy).",
            "<b>Leads with Empath</b> when it can, to declare it."],
        keep: { psionics: 2 },
        spend: { psionics: { while: "empath", why: "Spread Empathy: each Psionic spent in its prelude while Empath is declared advances its objective." } },
        avoid: ["battle"],
        prefer: ["empath"],
        plan: { secure: { add: 0.5 }, influence: { add: 0.5 } } } },
    // The Peacekeeper (Act II): Weapons and Weapon planets
    15: { 2: {
        name: "Peacekeeper",
        notes: ["<b>No battles</b>, and <b>can't declare Warlord</b> or enforce or change to War (Oath of Peace).",
            "<b>Keeps its Weapons</b> (Restrict the Weapons Supply), and moves to Weapon planets to control them."],
        keep: { weapons: 2 },
        avoid: ["battle"],
        cannotDeclare: ["warlord"],
        plan: { move: { add: 0.5 }, build: { add: 0.25 } },
        move: "ships to a Weapon planet, to control it",
        policy: (firstRegent, policy) => policy == "war" ? { value: -10, note: "Its Oath of Peace: it can't enforce or change to War" } : null,
        table: "<b>Oath of Peace:</b> it returns any Trophies except Blight. <b>Arsenal Keepers:</b> Weapons there are frozen." } },
    // The Warden (Act II): Seats and Fiefs
    16: { 2: {
        name: "Warden",
        notes: ["<b>Moves to clusters with no Seat</b>, and Claims Fiefs over its Loyal cities (Control the Fiefs' Seats).",
            "<b>Builds cities</b> and taxes more: Claim Fief is instead of a Tax."],
        plan: { tax: { add: 0.5, reason: "Claim Fief: a Seat above a Loyal city" }, build: { add: 0.25 }, move: { add: 0.25 } },
        move: "ships to a cluster with no Seat",
        table: "<b>Claim Fief</b> (instead of a Tax): place a Seat above one of its Loyal cities in a cluster with no Seat. <b>Seats &amp; Fiefs</b> and <b>Feudal Law:</b> follow the cards on the table." } },
};

function getSteer(player) {
    // Its steer for this Act, or null. Act I is played by fatebots.js
    if (campaign == null || campaign.act < 2 || player.isHuman) { return null; }
    const state = getCampaignPlayer(player);
    return state == null ? null : ((fateSteers[state.fate] || {})[campaign.act] || null);
}

function getSteerTag(steer) {
    return " <span class=\"steertag\">" + steer.name + "</span>";
}

function getSteerField(steer, field, player, empty) {
    // A field that may be a function of the player
    const value = steer[field];
    if (value == null) { return empty; }
    return typeof value == "function" ? (value(player) ?? empty) : value;
}

function avoidsBattle(player) {
    const steer = getSteer(player);
    return steer != null && (steer.avoid || []).includes("battle");
}

function getSteerAvoidTargets(player) {
    // The Free States or the Blight it won't battle (targets.js)
    const steer = getSteer(player);
    return steer == null ? [] : (steer.avoidTargets || []);
}

function getMostHeldResource(player) {
    // The Magnate's: the resource it holds most of, if any
    const held = preludeResources.filter(resource => player[resource + "Value"] > 0).sort((a, b) => player[b + "Value"] - player[a + "Value"]);
    return held.length > 0 ? held[0] : null;
}

function getIdealAmbitions(player) {
    // The Believer's: declared ambitions it was told have an Ideal marker this chapter
    const ideals = getCampaignPlayer(player).ideals;
    if (ideals == null || ideals.act != campaign.act || ideals.chapter != roundNumber) { return []; }
    return Object.keys(ideals.marked).filter(ambition => ideals.marked[ambition] && declaredAmbitions.includes(ambition));
}

function getKeep(steer, player, resource) {
    const spend = (steer.spend || {})[resource];
    if (spend != null && declaredAmbitions.includes(spend.while)) { return null; }
    return getSteerField(steer, "keep", player, {})[resource] ?? null;
}

registerCampaignHook("resourceNeed", (player, resource, need) => {
    const steer = getSteer(player);
    if (steer == null) { return undefined; }
    // Spent instead once its ambition is declared
    const keep = getKeep(steer, player, resource);
    return keep != null ? Math.max(need, keep) : undefined;
});

registerCampaignHook("keepsResource", (player, resource) => {
    // Never spared in its prelude: every resource for the Pirate, or one it keeps
    const steer = getSteer(player);
    if (steer == null) { return undefined; }
    return (steer.keepAll || (getKeep(steer, player, resource) || 0) >= 2) ? true : undefined;
});

registerCampaignHook("cannotDeclare", (player, ambition) => {
    const steer = getSteer(player);
    return (steer != null && (steer.cannotDeclare || []).includes(ambition)) ? true : undefined;
});

function getSteerMarketBonus(player, entry) {
    // What its Fate makes a Court card worth this Act (fatebots.js getFateMarketBonus)
    const steer = getSteer(player);
    const card = getCourtCard(entry.number);
    if (steer == null || steer.court == null || card == null) { return null; }
    return steer.court(player, card, entry);
}

registerCampaignHook("marketReason", (player, entry) => {
    const bonus = getSteerMarketBonus(player, entry);
    return bonus != null ? bonus.reason : undefined;
});

function getSteerPolicyBonus(firstRegent, policy, plan) {
    // What its Fate makes a Policy worth to it as First Regent (endofround.js getPolicyValue)
    const steer = getSteer(firstRegent);
    if (steer == null || steer.policy == null) { return null; }
    return steer.policy(firstRegent, policy, plan);
}

function getSteerTargetBonus(player, rival) {
    // How much more it wants to battle a Rival (empire.js battleTargetBonus)
    const steer = getSteer(player);
    return (steer == null || steer.target == null) ? 0 : steer.target(player, rival);
}

// The Believer asks once a chapter whether each declared ambition has an Ideal marker, on its
// first turn after it's declared
registerCampaignHook("botQuestions", (player, carryOn) => {
    if (getSteer(player) == null || !hasFate(player, 8)) { return undefined; }
    const state = getCampaignPlayer(player);
    if (state.ideals == null || state.ideals.act != campaign.act || state.ideals.chapter != roundNumber) {
        state.ideals = { act: campaign.act, chapter: roundNumber, marked: {} };
    }
    const ambition = declaredAmbitions.find(declared => state.ideals.marked[declared] === undefined);
    if (ambition == null) { return undefined; }
    askYesNo(ambition.toUpperCase(), "Is there an Ideal marker on " + capitalise(ambition) + "? (My Fate, the Believer, gains Power for winning ambitions with Ideals.)", marked => {
        state.ideals.marked[ambition] = marked;
        SaveAllSettings();
        carryOn();
    });
    return true;
});

registerCampaignHook("spendWhy", (player, resource, lead) => {
    // Spent for an action from the lead card, one it can use (not a Battle it rules out)
    const steer = getSteer(player);
    const spend = steer == null ? null : (steer.spend || {})[resource];
    if (spend == null || !declaredAmbitions.includes(spend.while)) { return undefined; }
    const useful = lead.actions.split(",").filter(action => !(steer.avoid || []).includes(action));
    return useful.length > 0 ? spend.why : undefined;
});

registerCampaignHook("avoidsAction", (player, action) => {
    const steer = getSteer(player);
    return (steer != null && (steer.avoid || []).includes(action)) ? true : undefined;
});

registerCampaignHook("planSteer", (player, action) => {
    const steer = getSteer(player);
    if (steer == null) { return undefined; }
    if ((steer.avoid || []).includes(action)) { return { avoid: true }; }
    const plan = (steer.plan || {})[action];
    if (plan == null) { return undefined; }
    // A Move's tag goes on the step with its Fate's reason only (see moveGoals)
    return { add: plan.add || 0, reason: plan.reason || null, tag: (action == "move" && steer.move != null) ? "" : getSteerTag(steer) };
});

registerCampaignHook("moveGoals", player => {
    const steer = getSteer(player);
    return (steer != null && steer.move != null) ? [steer.move + getSteerTag(steer)] : undefined;
});

registerCampaignHook("sortAmbitions", (player, standing) => {
    // An ambition it wants declared first, while it holds any of what it counts
    // One it can't declare goes last
    const steer = getSteer(player);
    if (steer == null || (steer.prefer == null && steer.cannotDeclare == null)) { return undefined; }
    const prefer = getSteerField(steer, "prefer", player, []);
    const never = steer.cannotDeclare || [];
    const first = standing.filter(([ambition, count]) => prefer.includes(ambition) && count > 0);
    const last = standing.filter(([ambition]) => never.includes(ambition));
    return first.concat(standing.filter(entry => !first.includes(entry) && !last.includes(entry)), last);
});

function getSteerHtml(player) {
    // "Playing towards it", and its tokens on the table, for its turn window. "" with no steer
    const steer = getSteer(player);
    if (steer == null) { return ""; }
    const extra = getSteerField(steer, "extra", player, "");
    return "<div class=\"steers\"><div class=\"lbl\">Playing towards it</div><ul>" + getSteerField(steer, "notes", player, []).map(note => "<li>" + note + "</li>").join("")
        + (extra != "" ? "<li>" + extra + "</li>" : "") + "</ul></div>"
        + (steer.table != null ? "<div class=\"tablenote\"><div class=\"lbl\">On the table: its tokens</div>" + steer.table + "</div>" : "");
}
