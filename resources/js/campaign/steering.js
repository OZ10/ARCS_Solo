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

const fateSteers = {
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
    // The Hegemon (Act II): Banners on the map, double if it wins an ambition
    10: { 2: {
        name: "Hegemon",
        notes: ["<b>Moves its Flagship on</b>: each planet with no Banner and no Rival pieces can take one (Plant Banners).",
            "<b>Wants to win an ambition</b> this chapter: every Banner then counts double."],
        plan: { move: { add: 1 } },
        move: "its Flagship to a planet with no Banner and no Rival pieces, to plant a Banner there next turn",
        table: "<b>Planting Banners</b> (prelude): place a Banner at its Flagship's planet if there's no Banner and no Rival ships or buildings there. It can do this more than once. <span class=\"text-secondary\">The app asks how many Banners are on the map at the end of the chapter.</span>" } }
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

function avoidsBattle(player) {
    const steer = getSteer(player);
    return steer != null && (steer.avoid || []).includes("battle");
}

registerCampaignHook("resourceNeed", (player, resource, need) => {
    const steer = getSteer(player);
    if (steer == null) { return undefined; }
    // Spent instead once its ambition is declared
    const spend = (steer.spend || {})[resource];
    if (spend != null && declaredAmbitions.includes(spend.while)) { return undefined; }
    const keep = (steer.keep || {})[resource];
    return keep != null ? Math.max(need, keep) : undefined;
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
    const steer = getSteer(player);
    if (steer == null || steer.prefer == null) { return undefined; }
    const first = standing.filter(([ambition, count]) => steer.prefer.includes(ambition) && count > 0);
    return first.concat(standing.filter(entry => !first.includes(entry)));
});

function getSteerHtml(player) {
    // "Playing towards it", and its tokens on the table, for its turn window. "" with no steer
    const steer = getSteer(player);
    if (steer == null) { return ""; }
    return "<div class=\"steers\"><div class=\"lbl\">Playing towards it</div><ul>" + steer.notes.map(note => "<li>" + note + "</li>").join("") + "</ul></div>"
        + (steer.table != null ? "<div class=\"tablenote\"><div class=\"lbl\">On the table: its tokens</div>" + steer.table + "</div>" : "");
}
