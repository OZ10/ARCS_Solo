// Blighted Reach campaign (#85): Negotiations in a Summit (rulebook p.17), step 1. A human player
// offers a bot a deal, built from the Negotiation actions: Transfer Asset (resources, Captives,
// Trophies), Promise Favor, Cede Control (a ship, starport or city), Delegate Authority (an agent on a
// Court card) and Invite to Empire. The bot weighs what it gets against what it gives, asks more of
// the Power leader, remembers deals kept, and accepts, counter-offers or refuses with its reasons.
// The app then updates the panels and says what to move on the table.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// What each part is worth to a bot: [getting it, giving it]. A resource by how much it needs it (0-2)
const dealValues = {
    resource: { get: [0.75, 1.5, 3], give: [0.75, 1.75, 3.5] },
    chased: { get: 2.5, give: 2.75 }, idle: { get: 0.5, give: 0.75 },
    promise: { get: 0.8, give: 1.2 }, favorBack: { get: 1, give: 0.6 },
    ship: { get: 0.8, give: 1 }, starport: { get: 2.5, give: 3 }, city: { get: 3, give: 4 }, cityChased: 1,
    delegate: 0.4, inviteGive: 1,
    want: 0.1, leader: 1, leaderPerPower: 0.15, goodwill: 0.25, goodwillMost: 1, counterRange: 4, counterMost: 3
};
const dealCounters = preludeResources.concat(["captives", "trophies"]);
const cedeKinds = ["ship", "starport"].concat(cityCounters);

// The deal being made: { bot, human, give: { key: count }, want: { key: count }, giveDelegate, wantDelegate,
// invite: "give" (you invite it) or "want" (it invites you) or null, back, counter }
let negotiation = null;

function getHumanNegotiators() {
    return players.filter(player => player.isHuman);
}

function getNegotiationsHtml(back) {
    // The Summit's Negotiations section: a deal button for each bot
    const bots = players.filter(player => !player.isHuman);
    const humans = getHumanNegotiators();
    if (bots.length == 0 || humans.length == 0) {
        return "<div class=\"turnsection\"><div class=\"turnlabel\">Negotiations</div><p class=\"small mb-0\">Human players may make deals with each other. Change the panels to match.</p></div>";
    }
    // A human Magnate may export 3 resources
    const exporters = humans.filter(player => isMagnate(player));
    const exportButtons = exporters.map(player => "<button type=\"button\" class=\"btn btn-outline-secondary w-100 mt-2\" onclick=\"showExport(" + player.number + ", '" + back + "')\">Export to the Galactic Core"
        + (exporters.length > 1 || humans.length > 1 ? " (Player " + player.number + ")" : "") + "<small class=\"d-block\">Discard 3 resources: objective +2</small></button>").join("");
    return "<div class=\"turnsection\"><div class=\"turnlabel\">Negotiations</div><p class=\"small mb-2\">Anyone may make deals. Offer a bot a deal and it says yes, no, or what it would take."
        + (humans.length > 1 ? " Deals between human players: change the panels to match." : "") + "</p>"
        + "<div class=\"negobtns\">" + bots.map(bot => "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"openDeal(" + bot.number + ", '" + back + "')\">Deal with Player " + bot.number
            + "<small>" + getFate(getCampaignPlayer(bot).fate).name + " &middot; bot</small></button>").join("") + "</div>" + exportButtons + "</div>";
}

function openDeal(botNumber, back) {
    const caller = roundEvent != null ? roundEvent.player : null;
    const human = (caller != null && caller.isHuman) ? caller : getHumanNegotiators()[0];
    negotiation = { bot: getPlayer(botNumber), human: human, give: {}, want: {}, giveDelegate: null, wantDelegate: null, invite: null, back: back, counter: null };
    showDealBuilder();
}

function closeDeal() {
    const { back, bot, human } = negotiation;
    negotiation = null;
    if (back == "offers" && roundEvent.offer != null) {
        // Your counter-offer to a bot's offer
        const made = (roundEvent.dealt || []).includes(bot.number) && (roundEvent.dealt || []).includes(human.number);
        roundEvent.offerResults.push("Player " + bot.number + " offered you a deal and you made a counter-offer: " + (made ? "<b>agreed</b>. The app has moved it." : "<b>no deal</b>."));
        nextBotOffer();
        return;
    }
    showSummitView(back);
}

function showSummitView(back) {
    if (back == "bot") { showBotSummitNegotiations(); } else { showSummit(); }
}

// What each side holds, and the most it can give

function getDealHolding(player, key, other = null) {
    if (key.startsWith("league:")) { return getLeague(player)[key.slice(7)] || 0; }
    // The other side's Favors it holds, to hand back
    if (key == "favorBack") { return other == null ? 0 : ((getCampaignPlayer(player).favors || {})[other.number]) || 0; }
    if (dealCounters.includes(key)) { return player[key + "Value"]; }
    if (key == "promise") { const left = getAgentsLeft(player); return left == null ? 3 : left; }
    if (key == "ship") { return player.shipsBoardValue; }
    if (key == "starport") { return player.starportsValue || 0; }
    return player[key + "Value"];
}

function getDealMost(player, key, other = null) {
    // Not your last ship, starport or city (rulebook p.17)
    const held = getDealHolding(player, key, other);
    if (key == "ship" || key == "starport") { return Math.max(held - 1, 0); }
    if (cityCounters.includes(key)) { return Math.min(held, Math.max(getCityCount(player) - 1, 0)); }
    return held;
}

function getDealLabel(key, count) {
    if (key.startsWith("league:")) { return getDealLabel(key.slice(7), count) + " (Merchant League)"; }
    if (dealCounters.includes(key)) { return count + " " + (key == "captives" ? "Captive" + (count == 1 ? "" : "s") : key == "trophies" ? "Troph" + (count == 1 ? "y" : "ies") : preludeResourceNames[key] + (count > 1 && key != "fuel" ? "s" : "")); }
    if (key == "promise") { return "Promise " + count + " Favor" + (count == 1 ? "" : "s"); }
    if (key == "favorBack") { return "Return " + count + " Favor" + (count == 1 ? "" : "s") + " (an agent back to its owner)"; }
    if (key == "ship" || key == "starport") { return "Cede " + count + " " + key + (count == 1 ? "" : "s"); }
    return "Cede " + count + " " + preludeResourceNames[key.replace(/^cities/, "").toLowerCase()].toLowerCase() + " cit" + (count == 1 ? "y" : "ies");
}

function describeDealSide(parts, delegate, invite) {
    const items = Object.entries(parts).filter(([, count]) => count > 0).map(([key, count]) => getDealLabel(key, count));
    if (delegate != null) { items.push("Delegate Authority on " + getCourtCard(delegate).name); }
    if (invite) { items.push("Invite to Empire"); }
    return items.length > 0 ? items.join(", ") : "nothing";
}

function getDealSummaryHtml(deal) {
    return "<div class=\"dealsum\"><div><b>You give</b>" + describeDealSide(deal.give, deal.giveDelegate, deal.invite == "give") + "</div>"
        + "<div><b>You want</b>" + describeDealSide(deal.want, deal.wantDelegate, deal.invite == "want") + "</div></div>";
}

// The deal builder

function showDealBuilder() {
    const deal = negotiation;
    const { bot, human } = deal;
    const pill = (side, key, icon, label) => {
        const owner = side == "give" ? human : bot;
        const value = deal[side][key] || 0;
        return "<span class=\"dealstep" + (value > 0 ? " on" : "") + "\">" + (icon ? "<span class=\"dealicon\">" + icon + "</span>" : "<span>" + label + "</span>")
            + "<small>of " + getDealHolding(owner, key, side == "give" ? bot : human) + "</small>"
            // The boxed steppers, as in the other windows (the user, 2026-11-28)
            + getMoveStepper(value, "stepDeal('" + side + "', '" + key + "', -1)", "stepDeal('" + side + "', '" + key + "', 1)") + "</span>";
    };
    const group = (label, html) => html == "" ? "" : "<div class=\"dealgroup\"><div class=\"grouplabel\">" + label + "</div>" + html + "</div>";
    const side = (key, owner, other) => {
        // Only what can be used: the rest in one line at the bottom (the user, 2026-11-28)
        const notPossible = [];
        const assets = dealCounters.filter(counter => getDealHolding(owner, counter) > 0)
            .map(counter => pill(key, counter, counter == "captives" || counter == "trophies" || preludeResources.includes(counter) ? getGameIcon(counter) : null, counter)).join("");
        const cede = ["ship", "starport"].filter(kind => getDealHolding(owner, kind) > 0).map(kind => pill(key, kind, null, capitalise(kind))).join("")
            + cityCounters.filter(counter => getDealHolding(owner, counter) > 0).map(counter => pill(key, counter, null, "City " + getGameIcon(counter))).join("");
        const agentsOn = courtMarket.filter(entry => getMarketAgents(entry, owner) > 0);
        const chosen = key == "give" ? deal.giveDelegate : deal.wantDelegate;
        const delegate = agentsOn.length == 0 ? "" : "<select class=\"form-select dealsel\" onchange=\"setDealDelegate('" + key + "', this.value)\"><option value=\"\">None</option>"
            + agentsOn.map(entry => "<option value=\"" + entry.number + "\"" + (entry.number == chosen ? " selected" : "") + ">" + (key == "give" ? "Your" : "Its") + " agent on " + getCourtCard(entry.number).name + "</option>").join("") + "</select>";
        // Invite to Empire: the First Regent invites an Outlaw
        const canInvite = isFirstRegent(owner) && !isRegent(other);
        const inviteKey = key == "give" ? "give" : "want";
        const invite = canInvite ? "<button type=\"button\" class=\"btn btn-sm " + (deal.invite == inviteKey ? "btn-dark" : "btn-outline-secondary") + "\" onclick=\"toggleDealInvite('" + inviteKey + "')\">"
                + (deal.invite == inviteKey ? "<i class=\"bi bi-check-lg\"></i> " : "") + "Invite Player " + other.number + " to the Empire</button>" : "";
        const league = preludeResources.filter(resource => getDealHolding(owner, "league:" + resource) > 0).map(resource => pill(key, "league:" + resource, getGameIcon(resource), resource)).join("");
        if (assets == "") { notPossible.push("Transfer Asset (no resources, Captives or Trophies)"); }
        if (cede == "") { notPossible.push("Cede Control (nothing to cede)"); }
        if (delegate == "") { notPossible.push("Delegate Authority (no agents on Court cards)"); }
        if (invite == "") { notPossible.push("Invite to Empire (only the First Regent can invite an Outlaw)"); }
        return group("Transfer Asset", assets == "" ? "" : "<div class=\"dealsteps\">" + assets + "</div>")
            + group("Merchant League", league == "" ? "" : "<div class=\"dealsteps\">" + league + "</div>")
            + group("Favors", "<div class=\"dealsteps\">" + pill(key, "promise", null, "Promise Favor").replace(/(<small>of \d+)/, "$1 agents")
                // The other side's Favors held, handed back (the user, 2026-11-27)
                + (getDealHolding(owner, "favorBack", other) > 0 || (deal[key].favorBack || 0) > 0 ? pill(key, "favorBack", null, "Return Favor") : "") + "</div>")
            + group("Cede Control", cede == "" ? "" : "<div class=\"dealsteps\">" + cede + "</div>")
            + group("Delegate Authority", delegate)
            + group("Invite to Empire", invite)
            + (notPossible.length > 0 ? "<div class=\"small text-secondary mt-1\">Not possible: " + notPossible.join(", ") + ".</div>" : "");
    };
    const humans = getHumanNegotiators();
    const who = humans.length > 1 ? "<div class=\"brseg mb-2\">" + humans.map(other => "<button type=\"button\" class=\"btn " + (other === human ? "btn-dark" : "btn-outline-secondary") + "\" onclick=\"setDealHuman(" + other.number + ")\">Player " + other.number + "<small>offering</small></button>").join("") + "</div>" : "";
    setCampaignWindow("Deal with Player " + bot.number, who + getDealSummaryHtml(deal)
        + "<div class=\"dealside\"><div class=\"turnlabel\">You give</div>" + side("give", human, bot) + "</div>"
        + "<div class=\"dealside\"><div class=\"turnlabel\">You want from Player " + bot.number + "</div>" + side("want", bot, human) + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"offerDeal()\">Offer to Player " + bot.number + "</button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary w-100 mt-2\" onclick=\"closeDeal()\">Back to the Summit</button>", human);
}

function stepDeal(side, key, change) {
    const owner = side == "give" ? negotiation.human : negotiation.bot;
    const other = side == "give" ? negotiation.bot : negotiation.human;
    negotiation[side][key] = Math.min(Math.max((negotiation[side][key] || 0) + change, 0), getDealMost(owner, key, other));
    showDealBuilder();
}

function setDealDelegate(side, value) {
    negotiation[side + "Delegate"] = value == "" ? null : Number(value);
    showDealBuilder();
}

function toggleDealInvite(side) {
    negotiation.invite = negotiation.invite == side ? null : side;
    showDealBuilder();
}

function setDealHuman(number) {
    negotiation = { ...negotiation, human: getPlayer(number), give: {}, giveDelegate: null, invite: null };
    showDealBuilder();
}

// How the bot weighs it

function getDealPartValue(bot, key, count, getting) {
    // What count of this is worth to the bot, getting it or giving it
    const v = dealValues;
    const way = getting ? "get" : "give";
    // Merchant League's resources are frozen: worth a resource to whoever gets one, little to the Magnate
    if (key.startsWith("league:")) { return getting ? getDealPartValue(bot, key.slice(7), count, true) : count * magnateValues.league; }
    if (preludeResources.includes(key)) { return count * v.resource[way][getResourceNeed(bot, key)]; }
    if (key == "captives" || key == "trophies") {
        const ambition = key == "captives" ? "tyrant" : "warlord";
        return count * (declaredAmbitions.includes(ambition) && isChasingAmbition(bot, ambition) ? v.chased[way] : v.idle[way]);
    }
    if (key == "promise") { return count * v.promise[way]; }
    // A Rival's own Favors handed back: their agents free again, and a hold the bot gives up
    if (key == "favorBack") { return count * v.favorBack[way]; }
    if (key == "ship" || key == "starport") { return count * v[key][way]; }
    const resource = key.replace(/^cities/, "").toLowerCase();
    return count * (v.city[way] + (getResourceNeed(bot, resource) == 2 ? v.cityChased : 0));
}

function getDealReasons(deal) {
    // The worth of the deal to the bot, with reasons: { net, required, reasons }
    const { bot, human } = deal;
    const reasons = [];
    let net = 0;
    Object.entries(deal.give).filter(([, count]) => count > 0).forEach(([key, count]) => {
        const value = getDealPartValue(bot, key, count, true);
        net += value;
        if (preludeResources.includes(key)) {
            const need = getResourceNeed(bot, key);
            reasons.push(need == 2 ? "It's chasing " + capitalise(preludeAmbitions[key] || "warlord") + ": " + getDealLabel(key, count) + " helps it." : need == 0 ? getDealLabel(key, count) + " is worth little to it." : getDealLabel(key, count) + " would be useful.");
        }
    });
    Object.entries(deal.want).filter(([, count]) => count > 0).forEach(([key, count]) => {
        net -= getDealPartValue(bot, key, count, false);
        if (preludeResources.includes(key)) {
            const need = getResourceNeed(bot, key);
            reasons.push(need == 2 ? "It's chasing " + capitalise(preludeAmbitions[key] || "warlord") + " and would give up " + getDealLabel(key, count) + " it needs." : need == 0 ? "It isn't chasing anything " + preludeResourceNames[key] + " counts for, so " + getDealLabel(key, count) + " is worth little to it." : "Giving " + getDealLabel(key, count) + " costs it a little.");
        }
        if ((key == "starport" || cityCounters.includes(key)) && count > 0) { reasons.push("Ceding a building costs it a lot."); }
    });
    if ((deal.give.promise || 0) > 0) { reasons.push("A Favor from you is worth a little to it."); }
    // The Magnate's objective advances for each resource or Favor a Rival gives it
    const forMagnate = isMagnate(bot) ? countMagnateItems(deal.give) : 0;
    if (forMagnate > 0) {
        net += forMagnate * magnateValues.item;
        reasons.push("Close Deals with Rivals: each resource or Favor you give it advances its objective by 2.");
    }
    if ((deal.want.promise || 0) > 0) { reasons.push("A Favor it promises lets you force it in a later Summit."); }
    if (deal.giveDelegate != null) { net += getMarketCardValue(bot, courtMarket.find(entry => entry.number == deal.giveDelegate)) * dealValues.delegate; }
    if (deal.wantDelegate != null) { net -= getMarketCardValue(bot, courtMarket.find(entry => entry.number == deal.wantDelegate)) * dealValues.delegate; }
    if (deal.invite == "give") {
        const stay = -getLeaveEmpireCase(bot).score;
        net += stay;
        reasons.push(stay >= 0 ? "Becoming a Regent again suits it." : "It would rather stay an Outlaw" + (getFateTitleWant(bot) == "outlaw" ? ": its Fate needs it." : "."));
    }
    if (deal.invite == "want") { net -= dealValues.inviteGive; reasons.push("Inviting you makes you a Regent it can't harm where there are Imperial ships."); }

    // It asks more of the Power leader, and less of those who kept their deals with it
    let required = dealValues.want;
    const others = players.filter(other => other !== human);
    if (others.every(other => human.powerValue > other.powerValue)) {
        required += dealValues.leader + Math.max(human.powerValue - bot.powerValue, 0) * dealValues.leaderPerPower;
        reasons.push("You lead on Power (" + human.powerValue + " to its " + bot.powerValue + "), so it asks more of you.");
    }
    const kept = getDealsKept(bot, human);
    if (kept > 0) {
        required -= Math.min(kept * dealValues.goodwill, dealValues.goodwillMost);
        reasons.push("You've made " + kept + " deal" + (kept == 1 ? "" : "s") + " with it before.");
    }
    return { net: net, required: required, reasons: reasons };
}

function getDealsKept(bot, human) {
    return ((campaign.deals || {})[bot.number + "-" + human.number]) || 0;
}

function findCounterOffer(deal, gap) {
    // The least it would ask on top: what you have left, cheapest for you first, until the gap is closed
    const { bot, human } = deal;
    // Not anything it's giving you in this deal (#177)
    const options = dealCounters.concat(["promise", "ship"]).filter(key => !((deal.want[key] || 0) > 0) && !((deal.want["league:" + key] || 0) > 0))
        .map(key => ({ key: key, left: getDealMost(human, key) - (deal.give[key] || 0), value: getDealPartValue(bot, key, 1, true) }))
        .filter(option => option.left > 0 && option.value > 0);
    // One item that covers it, the smallest
    const single = options.filter(option => option.value >= gap).sort((a, b) => a.value - b.value)[0];
    if (single != null) { return { [single.key]: 1 }; }
    // Otherwise the most valuable, a few at a time
    const extra = {};
    let covered = 0, count = 0;
    for (const option of options.sort((a, b) => b.value - a.value)) {
        let left = option.left;
        while (left > 0 && covered < gap && count < dealValues.counterMost) {
            extra[option.key] = (extra[option.key] || 0) + 1;
            covered += option.value; left--; count++;
        }
    }
    return covered >= gap ? extra : null;
}

function offerDeal() {
    const deal = negotiation;
    const nothing = describeDealSide(deal.give, deal.giveDelegate, deal.invite == "give") == "nothing" && describeDealSide(deal.want, deal.wantDelegate, deal.invite == "want") == "nothing";
    if (nothing) { showMessageToast("Deal", "Choose what you give and what you want first."); return; }
    const weighed = getDealReasons(deal);
    const gap = weighed.required - weighed.net;
    const list = items => "<ul class=\"small mb-0 mt-1\">" + items.map(item => "<li>" + item + "</li>").join("") + "</ul>";
    const reply = (kind, verdict, reasons) => "<div class=\"reply " + kind + "\"><div class=\"verdict\">" + verdict + "</div>" + list(reasons) + "</div>";
    if (gap <= 0) {
        setCampaignWindow("Deal with Player " + deal.bot.number, getDealSummaryHtml(deal) + reply("yes", "Player " + deal.bot.number + " accepts", weighed.reasons)
            + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"acceptDeal(false)\">Make the deal</button>"
            + "<button type=\"button\" class=\"btn btn-outline-secondary w-100 mt-2\" onclick=\"showDealBuilder()\">Change my offer</button>", deal.bot);
        return;
    }
    const extra = gap <= dealValues.counterRange ? findCounterOffer(deal, gap) : null;
    if (extra != null) {
        const give = { ...deal.give };
        Object.entries(extra).forEach(([key, count]) => { give[key] = (give[key] || 0) + count; });
        deal.counter = { ...deal, give: give, counter: null };
        const asked = describeDealSide(extra, null, false);
        setCampaignWindow("Deal with Player " + deal.bot.number, getDealSummaryHtml(deal) + reply("counter", "Player " + deal.bot.number + " would do it for more",
            weighed.reasons.concat("It would do the deal if you also give " + asked + "."))
            + "<div class=\"negobtns\"><button type=\"button\" class=\"btn btn-primary\" onclick=\"acceptDeal(true)\">Accept<small>" + describeDealSide(give, deal.giveDelegate, deal.invite == "give") + "</small></button>"
            + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"showDealBuilder()\">Change my offer<small>Back to the deal</small></button></div>"
            + "<button type=\"button\" class=\"btn btn-outline-secondary w-100 mt-2\" onclick=\"closeDeal()\">No deal</button>", deal.bot);
        return;
    }
    setCampaignWindow("Deal with Player " + deal.bot.number, getDealSummaryHtml(deal) + reply("no", "Player " + deal.bot.number + " refuses",
        weighed.reasons.concat(gap > dealValues.counterRange ? "It would give up far more than it gets." : "Nothing you have left would make up for it."))
        + "<div class=\"negobtns\"><button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"showDealBuilder()\">Change my offer<small>Back to the deal</small></button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"closeDeal()\">No deal<small>Back to the Summit</small></button></div>", deal.bot);
}

// Carrying it out

function acceptDeal(countered) {
    const deal = countered ? negotiation.counter : negotiation;
    const table = applyDeal(deal);
    setCampaignWindow("Deal with Player " + deal.bot.number, getDealSummaryHtml(deal) + "<div class=\"reply yes\"><div class=\"verdict\">Deal made</div>"
        + "<p class=\"small mb-1 mt-1\">The app has updated the panels. On the table:</p><ul class=\"small mb-0\">" + table.map(line => "<li>" + line + "</li>").join("") + "</ul></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"closeDeal()\">" + (negotiation.back == "offers" ? "Next" : "Back to the Summit") + "</button>", deal.bot);
}

function applyDeal(deal) {
    // Carry out a deal between deal.human (giving deal.give) and deal.bot (giving deal.want). Either
    // can be a bot. What to move on the table, as lines
    const { bot, human } = deal;
    const table = [];
    const move = (from, to, parts) => Object.entries(parts).filter(([, count]) => count > 0).forEach(([key, count]) => {
        if (key.startsWith("league:")) {
            const resource = key.slice(7);
            getLeague(from)[resource] = Math.max((getLeague(from)[resource] || 0) - count, 0);
            adjustCounter(to, resource, count);
            table.push("Player " + from.number + " gives Player " + to.number + " " + getDealLabel(key, count) + ".");
        } else if (dealCounters.includes(key)) {
            adjustCounter(from, key, -count);
            adjustCounter(to, key, count);
            table.push("Player " + from.number + " gives Player " + to.number + " " + getDealLabel(key, count) + ".");
        } else if (key == "promise") {
            const favors = getCampaignPlayer(to).favors;
            favors[from.number] = (favors[from.number] || 0) + count;
            table.push("Player " + from.number + " puts " + count + " agent" + (count == 1 ? "" : "s") + " on Player " + to.number + "'s Fate card.");
        } else if (key == "favorBack") {
            // Their own agents back from its Fate card (Transfer Asset of a Favor)
            const favors = getCampaignPlayer(from).favors;
            favors[to.number] = Math.max((favors[to.number] || 0) - count, 0);
            table.push("Player " + from.number + " returns " + count + " of Player " + to.number + "'s agents from its Fate card to Player " + to.number + "'s supply.");
        } else {
            // Cede Control on the app's board, where there's a piece it can be (cedeOnBoard)
            const name = key == "ship" ? "ships" : key == "starport" ? "starports" : preludeResourceNames[key.replace(/^cities/, "").toLowerCase()].toLowerCase() + " cities";
            const places = [];
            for (let i = 0; i < count; i++) { const at = cedeOnBoard(from, to, key); if (at != null) { places.push(at); } }
            table.push("Cede Control: replace " + count + " of Player " + from.number + "'s " + name + (places.length > 0 ? " (at " + places.map(getSystemShortName).join(", ") + ")" : "")
                + " with Player " + to.number + "'s. Not a building with Player " + from.number + "'s own ships in its system."
                + (places.length < count ? " The app's board had nowhere for " + (count - places.length) + " of them: fix it with Check the board." : ""));
        }
    });
    move(human, bot, deal.give);
    move(bot, human, deal.want);
    // A bot with no room for what it was given returns what it needs least (#172)
    [bot, human].forEach(player => { const room = returnOverCapacity(player); if (room != null) { table.push(room); } });
    // The Magnate (human or bot): its objective, and what it gave, which doesn't count coming back
    magnateDealt(human, bot, deal.give, deal.want);
    magnateDealt(bot, human, deal.want, deal.give);
    const delegate = (from, to, number) => {
        if (number == null) { return; }
        const entry = courtMarket.find(card => card.number == number);
        entry.agents[from.number] = Math.max((entry.agents[from.number] || 0) - 1, 0);
        entry.agents[to.number] = (entry.agents[to.number] || 0) + 1;
        table.push("Delegate Authority: replace 1 of Player " + from.number + "'s agents on " + getCourtCard(number).name + " with Player " + to.number + "'s.");
    };
    delegate(human, bot, deal.giveDelegate);
    delegate(bot, human, deal.wantDelegate);
    if (deal.invite != null) {
        const invited = deal.invite == "give" ? bot : human;
        applyTitle(invited.number, "regent");
        table.push("Player " + invited.number + " is invited to the Empire: flip their title to Regent.");
    }
    campaign.deals = campaign.deals || {};
    const key = bot.number + "-" + human.number;
    campaign.deals[key] = (campaign.deals[key] || 0) + 1;
    // A bot that made a deal in this Summit doesn't offer another
    if (roundEvent != null) { roundEvent.dealt = (roundEvent.dealt || []).concat(bot.number, human.number); }
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    return table;
}

// A Summit a bot called: the human players may still negotiate before it ends

function showBotSummitNegotiations() {
    // The bots' offers first (step 2)
    if (runBotOffersFirst("bot")) { return; }
    const player = roundEvent.player;
    setOrShowCampaignWindow("Summit: Player " + player.number + " calls it to order",
        "<div class=\"turnsection\"><div class=\"setstep\"><span class=\"setnum\">&#10003;</span><span>" + roundEvent.summitNote + "</span></div></div>"
        + getOfferResultsHtml()
        + getNegotiationsHtml("bot")
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"endBotSummit()\">End the Summit</button>", player);
}

function setOrShowCampaignWindow(title, html, player) {
    if (getCampaignModal().classList.contains("show")) { setCampaignWindow(title, html, player); } else { showCampaignWindow(title, html, player, true); }
}

function endBotSummit() {
    // Its note has been shown here, so the next window doesn't repeat it
    roundEvent.summitNote = "Player " + roundEvent.player.number + " (bot) called a Summit.";
    afterSummit();
}

// Step 2: the bots offer deals. When a Summit opens, each bot in turn order from the caller may offer
// one: a resource it's chasing, from a Rival who holds it and isn't chasing it, for what it can spare
// that the Rival wants most (or a Promised Favor). Two bots settle it at once, if both come out
// ahead; a human player accepts it, makes a counter-offer or says no thanks

function getBotOffer(bot) {
    // Its best offer, as { rival, ask, give, gain, reasons }, or null. Not to anyone it already dealt
    // with in this Summit. Asking the Power leader costs it more (see getDealReasons)
    const dealt = roundEvent.dealt || [];
    if (dealt.includes(bot.number)) { return null; }
    const options = [];
    players.filter(rival => rival !== bot && !dealt.includes(rival.number)).forEach(rival => {
        // The Magnate wants any resource a Rival gives it: its objective advances for each
        const magnate = isMagnate(bot);
        preludeResources.filter(resource => (getResourceNeed(bot, resource) == 2 || magnate) && rival[resource + "Value"] > 0 && getResourceNeed(rival, resource) < 2).forEach(ask => {
            // Merchant League's frozen resources first: they're only good for trading
            const byNeed = (a, b) => getResourceNeed(rival, b.replace("league:", "")) - getResourceNeed(rival, a.replace("league:", ""));
            const league = preludeResources.filter(resource => resource != ask && (getLeague(bot)[resource] || 0) > 0).map(resource => "league:" + resource).sort(byNeed);
            const spareOwn = preludeResources.filter(resource => resource != ask && bot[resource + "Value"] > 0 && getResourceNeed(bot, resource) == 0).sort(byNeed);
            // A Favor of theirs it holds: their agent back is worth more to them than it costs the bot (the user, 2026-11-27)
            const favorsHeld = ((getCampaignPlayer(bot).favors || {})[rival.number]) || 0;
            const spare = league.concat(favorsHeld > 0 ? ["favorBack"] : [], spareOwn)[0];
            if (spare == null && getDealMost(bot, "promise") == 0) { return; }
            const give = spare != null ? { [spare]: 1 } : { promise: 1 };
            // From its own side: it gets the resource it asks for, and gives the rest
            const own = getDealReasons({ bot: bot, human: rival, give: { [ask]: 1 }, want: give, giveDelegate: null, wantDelegate: null, invite: null });
            if (own.net < own.required) { return; }
            const holds = (rival.isHuman ? "you hold " : "Player " + rival.number + " holds ") + rival[ask + "Value"] + " " + preludeResourceNames[ask] + (rival[ask + "Value"] > 1 && ask != "fuel" ? "s" : "");
            const reasons = [getResourceNeed(bot, ask) == 2 ? "It's chasing " + capitalise(preludeAmbitions[ask] || "warlord") + ", and " + holds + "." : "Close Deals with Rivals: each resource or Favor you give it advances its objective by 2, and " + holds + "."];
            reasons.push(spare == null ? "It has nothing to spare, so it offers a Favor: one of its agents on your Fate card."
                : spare == "favorBack" ? "It holds " + favorsHeld + " of " + (rival.isHuman ? "your" : "Player " + rival.number + "'s") + " Favors, and gives one back: an agent back in " + (rival.isHuman ? "your" : "their") + " supply."
                : spare.startsWith("league:") ? "The " + preludeResourceNames[spare.slice(7)] + " is frozen on Merchant League: it can only give it away in a Summit."
                : "It isn't chasing anything " + preludeResourceNames[spare] + " counts for, so it can spare one.");
            options.push({ rival: rival, ask: ask, give: give, gain: own.net - own.required, reasons: reasons });
        });
    });
    return options.sort((a, b) => b.gain - a.gain)[0] || null;
}

function getNoOfferReason(bot) {
    // Why a bot offers no deal this Summit (#177), so every bot is accounted for
    const chased = preludeResources.filter(resource => getResourceNeed(bot, resource) == 2);
    const name = resource => preludeResourceNames[resource];
    if (chased.length == 0 && !isMagnate(bot)) { return "it isn't chasing any resource"; }
    const asks = (isMagnate(bot) ? preludeResources : chased).filter(resource => players.some(rival => rival !== bot && rival[resource + "Value"] > 0 && getResourceNeed(rival, resource) < 2));
    if (asks.length == 0) { return "no Rival holds the " + chased.map(name).join(" or ") + " it's chasing without needing it too"; }
    const spare = preludeResources.some(resource => !asks.includes(resource) && bot[resource + "Value"] > 0 && getResourceNeed(bot, resource) == 0)
        || preludeResources.some(resource => (getLeague(bot)[resource] || 0) > 0) || getDealMost(bot, "promise") > 0;
    if (!spare) { return "it has nothing to spare to give for it"; }
    return "no deal would be worth what it gives up";
}

function noteNoOffer(bot) {
    if (bot.isHuman || (roundEvent.dealt || []).includes(bot.number)) { return; }
    roundEvent.offerResults.push("Player " + bot.number + " had no deal to offer: " + getNoOfferReason(bot) + ".");
}

function getOfferDeal(bot, offer) {
    // As a deal between the bot (deal.bot) and the Rival it asks (deal.human)
    return { bot: bot, human: offer.rival, give: { [offer.ask]: 1 }, want: { ...offer.give }, giveDelegate: null, wantDelegate: null, invite: null };
}

function runBotOffersFirst(back) {
    // Once a Summit: true if the bots' offers have started (they show the Summit when they're done)
    if (roundEvent.offersStarted) { return false; }
    roundEvent.offersStarted = true;
    roundEvent.offerResults = [];
    roundEvent.offersBack = back;
    const order = getTurnOrder();
    const start = Math.max(order.indexOf(roundEvent.player), 0);
    roundEvent.offerQueue = order.slice(start).concat(order.slice(0, start)).filter(player => !player.isHuman).map(player => player.number);
    nextBotOffer();
    return true;
}

function nextBotOffer() {
    while (roundEvent.offerQueue.length > 0) {
        const bot = getPlayer(roundEvent.offerQueue.shift());
        magnateExport(bot);
        const offer = getBotOffer(bot);
        if (offer == null) { noteNoOffer(bot); continue; }
        if (offer.rival.isHuman) {
            roundEvent.offer = { bot: bot, ...offer };
            showBotOffer();
            return;
        }
        settleBotDeal(bot, offer);
    }
    roundEvent.offer = null;
    showSummitView(roundEvent.offersBack);
}

function settleBotDeal(bot, offer) {
    // Between two bots: the other weighs it from its side
    const rival = offer.rival;
    const theirs = getDealReasons({ bot: rival, human: bot, give: { ...offer.give }, want: { [offer.ask]: 1 }, giveDelegate: null, wantDelegate: null, invite: null });
    const gives = describeDealSide(offer.give, null, false);
    const asks = getDealLabel(offer.ask, 1);
    if (theirs.net >= theirs.required) {
        const table = applyDeal(getOfferDeal(bot, offer));
        roundEvent.offerResults.push("Player " + bot.number + " and Player " + rival.number + " agreed: Player " + bot.number + " gives " + gives + ", Player " + rival.number + " gives " + asks + "."
            + "<small class=\"d-block text-secondary\">On the table: " + table.join(" ") + "</small>");
        return;
    }
    roundEvent.offerResults.push("Player " + bot.number + " offered Player " + rival.number + " " + gives + " for " + asks + ": <b>Player " + rival.number + " refused</b>"
        + (getResourceNeed(rival, offer.ask) > 0 ? " (it needs it)." : "."));
}

function showBotOffer() {
    const offer = roundEvent.offer;
    const { bot, rival } = offer;
    const list = items => "<ul class=\"small mb-0 mt-1\">" + items.map(item => "<li>" + item + "</li>").join("") + "</ul>";
    setOrShowCampaignWindow("Player " + bot.number + " offers a deal", "<p class=\"small mb-2\">In the Summit, each bot may offer one deal, in turn order from the caller." + (getHumanNegotiators().length > 1 ? " This one is for Player " + rival.number + "." : "") + "</p>"
        + "<div class=\"dealsum dealoffer\"><div><b>Player " + bot.number + " gives</b> " + describeDealSide(offer.give, null, false) + "</div><div><b>You give</b> " + getDealLabel(offer.ask, 1) + "</div></div>"
        + "<div class=\"reply why\"><div class=\"verdict\">Why Player " + bot.number + " offers it</div>" + list(offer.reasons) + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"acceptBotOffer()\">Accept</button>"
        + "<div class=\"negobtns\"><button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"counterBotOffer()\">Counter-offer<small>Change the deal</small></button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"refuseBotOffer()\">No thanks<small>It remembers</small></button></div>", bot);
}

function acceptBotOffer() {
    const offer = roundEvent.offer;
    const table = applyDeal(getOfferDeal(offer.bot, offer));
    roundEvent.offerResults.push("Player " + offer.bot.number + " offered Player " + offer.rival.number + " " + describeDealSide(offer.give, null, false) + " for " + getDealLabel(offer.ask, 1) + ": <b>accepted</b>. The app has moved them."
        + "<small class=\"d-block text-secondary\">On the table: " + table.join(" ") + "</small>");
    nextBotOffer();
}

function refuseBotOffer() {
    // It remembers: one less deal's goodwill
    const offer = roundEvent.offer;
    campaign.deals = campaign.deals || {};
    const key = offer.bot.number + "-" + offer.rival.number;
    campaign.deals[key] = Math.max((campaign.deals[key] || 0) - 1, 0);
    SaveAllSettings();
    roundEvent.offerResults.push("Player " + offer.bot.number + " offered Player " + offer.rival.number + " " + describeDealSide(offer.give, null, false) + " for " + getDealLabel(offer.ask, 1) + ": <b>no thanks</b>.");
    nextBotOffer();
}

function counterBotOffer() {
    // The deal builder, filled in with its offer: what you want is what it gives
    const offer = roundEvent.offer;
    negotiation = { bot: offer.bot, human: offer.rival, give: { [offer.ask]: 1 }, want: { ...offer.give }, giveDelegate: null, wantDelegate: null, invite: null, back: "offers", counter: null };
    showDealBuilder();
}

function getOfferResultsHtml() {
    const results = roundEvent.offerResults || [];
    if (results.length == 0) { return ""; }
    // Bots with no offer, still each accounted for (#177), folded into one line (the user, 2026-11-28)
    const none = results.filter(result => / had no deal to offer: /.test(result));
    const deals = results.filter(result => !none.includes(result));
    return "<div class=\"turnsection\"><div class=\"turnlabel\">The bots' deals</div>"
        + deals.map(result => "<div class=\"setstep\"><span class=\"setnum\">&#10003;</span><span>" + result + "</span></div>").join("")
        + (none.length > 0 ? "<div class=\"small text-secondary\">No offer from " + none.map(result => result.replace(/ had no deal to offer: (.*)\.$/, " ($1)")).join("; ") + ".</div>" : "") + "</div>";
}

function runBotOffersSilently() {
    // With no human players, the bots' deals are settled straight away, and listed in the Summit note
    roundEvent.offersStarted = true;
    roundEvent.offerResults = [];
    const order = getTurnOrder();
    const start = Math.max(order.indexOf(roundEvent.player), 0);
    order.slice(start).concat(order.slice(0, start)).forEach(bot => {
        magnateExport(bot);
        const offer = getBotOffer(bot);
        if (offer != null && !offer.rival.isHuman) { settleBotDeal(bot, offer); }
        else if (offer == null) { noteNoOffer(bot); }
    });
    return roundEvent.offerResults;
}

// Step 3: a bot that called the Summit calls in Favors. It returns a Rival's agents from its Fate card
// to force that Rival into a Negotiation action targeting it (rulebook p.16): a resource it's chasing
// (its raid cost in Favors, asked as the app can't see the slot), or a Captive or Trophy it's chasing
// with Tyrant or Warlord (1 Favor each)

// What else a Favor can force, 1 Favor each (the user, 2026-11-27; rulebook p.16-17): Invite to Empire
// (an Outlaw that wants to be a Regent, from the First Regent), Cede Control (a Rival's city with none of
// their ships in its system, not their last), Delegate Authority (their agent on a Court card it wants)
const favorValues = { invite: 3, cityChased: 1, delegateWin: 1 };

function getFavorOptions(bot, rival) {
    // Everything its Favors of this Rival's could force, as [{ kind, resource?, system?, card?, value, why }]
    const options = preludeResources.filter(resource => getResourceNeed(bot, resource) == 2 && rival[resource + "Value"] > 0)
        .map(resource => ({ kind: "resource", resource: resource, value: dealValues.resource.get[2], why: "it's chasing " + capitalise(preludeAmbitions[resource] || "warlord") }));
    [["captives", "tyrant"], ["trophies", "warlord"]].forEach(([counter, ambition]) => {
        if (rival[counter + "Value"] > 0 && declaredAmbitions.includes(ambition) && isChasingAmbition(bot, ambition)) { options.push({ kind: counter, resource: counter, value: dealValues.chased.get, why: "it's chasing " + capitalise(ambition) }); }
    });
    // Invite to Empire: back to being a Regent, when that suits it
    if (!isRegent(bot) && isFirstRegent(rival) && -getLeaveEmpireCase(bot).score > 0) {
        options.push({ kind: "invite", value: favorValues.invite, why: "it would rather be a Regent again" + (getFateTitleWant(bot) == "regent" ? ": its Fate needs it" : "") });
    }
    // Cede Control: a city of theirs with none of their ships there, and room for one more of its own
    if (getCityCount(bot) < maxCities && getBoardBuildings(rival.number, "city").length > 1) {
        getBoardBuildings(rival.number, "city").filter(city => getShips(city.system, rival.number).fresh + getShips(city.system, rival.number).damaged == 0).forEach(city => {
            const types = getCityTypes(city.system);
            const chased = types.some(resource => getResourceNeed(bot, resource) == 2);
            options.push({ kind: "cede", system: city.system, value: dealValues.city.get + (chased ? favorValues.cityChased : 0),
                why: "their city at " + getSystemShortName(city.system) + " becomes its own" + (chased ? ", a type it's chasing" : "") });
        });
    }
    // Delegate Authority: their agent on a Court card it wants, swapped for one of its own
    const agentsLeft = getAgentsLeft(bot);
    if (isMarketKnown() && (agentsLeft == null || agentsLeft > 0)) {
        // Not the Imperial Council, which can't be influenced or secured
        courtMarket.filter(entry => (entry.agents || {})[rival.number] > 0 && entry.number != councilNumber && getCourtCard(entry.number) != null).forEach(entry => {
            const card = getMarketCardValue(bot, entry);
            if (card <= 0) { return; }
            // Taking the lead on it is worth the card; otherwise a step towards it
            const mine = (entry.agents[bot.number] || 0) + 1;
            const most = Math.max(0, ...Object.entries(entry.agents).filter(([number]) => Number(number) != bot.number).map(([number, count]) => count - (Number(number) == rival.number ? 1 : 0)));
            const leads = mine > most;
            options.push({ kind: "delegate", card: entry.number, value: card * (leads ? favorValues.delegateWin : dealValues.delegate),
                why: "one of its agents replaces theirs on " + getCourtCard(entry.number).name + (leads ? ", giving it the most there" : "") });
        });
    }
    return options.sort((a, b) => b.value - a.value);
}

function getFavorCallIns(bot) {
    // The best thing its Favors of each Rival's can force, the leader's first (the user, 2026-11-27)
    const favors = getCampaignPlayer(bot).favors || {};
    const leader = getLeader(bot);
    const callIns = [];
    players.filter(rival => rival !== bot && (favors[rival.number] || 0) > 0).forEach(rival => {
        const options = getFavorOptions(bot, rival);
        const best = options[0];
        // Every resource it could ask for, the one they hold most of first, in case the first costs too much
        const resources = options.filter(option => option.kind == "resource").map(option => option.resource).sort((a, b) => rival[b + "Value"] - rival[a + "Value"]);
        if (best != null) {
            callIns.push({ bot: bot.number, rival: rival.number, ...best, resource: best.kind == "resource" ? resources[0] : best.resource, resources: resources, tried: [],
                fallback: options.find(option => option.kind != "resource") || null, leader: rival === leader });
        }
    });
    return callIns.sort((a, b) => Number(b.leader) - Number(a.leader) || b.value - a.value);
}

function runFavorCallIns(then) {
    // One at a time, then carry on
    roundEvent.callInsThen = then;
    nextFavorCallIn();
}

function nextFavorCallIn() {
    const callIn = (roundEvent.callIns || []).shift();
    if (callIn == null) {
        const then = roundEvent.callInsThen;
        roundEvent.callInsThen = null;
        then();
        return;
    }
    if (callIn.kind == "resource") { askCallInKeys(callIn); return; }
    applyCallInOption(callIn, callIn);
    nextFavorCallIn();
}

function askCallInKeys(callIn) {
    const bot = getPlayer(callIn.bot), rival = getPlayer(callIn.rival);
    const held = getCampaignPlayer(bot).favors[rival.number] || 0;
    const name = preludeResourceNames[callIn.resource];
    const whose = rival.isHuman ? "your" : "Player " + rival.number + "'s";
    roundEvent.callIn = callIn;
    setOrShowCampaignWindow("Player " + bot.number + " calls in " + (rival.isHuman ? "your" : "Player " + rival.number + "'s") + " Favors",
        "<p class=\"small mb-2\">Player " + bot.number + " called the Summit and holds <b>" + held + " of " + whose + " Favors</b> (agents on its Fate card). In its Call to Order it returns them to force a Negotiation action that targets it.</p>"
        // When the last resource cost too much: why it's asking about this one
        + (callIn.note ? "<p class=\"small mb-2 text-secondary\">" + callIn.note + "</p>" : "")
        + "<div class=\"reply why\"><div class=\"verdict\">It forces " + (rival.isHuman ? "you" : "Player " + rival.number) + " to give it 1 " + name + "</div><ul class=\"small mb-0 mt-1\"><li>It's chasing " + capitalise(preludeAmbitions[callIn.resource] || "warlord") + ", and "
            + (rival.isHuman ? "you hold " : "Player " + rival.number + " holds ") + getDealLabel(callIn.resource, rival[callIn.resource + "Value"]) + ".</li><li>Each Favor it returns goes back to " + (rival.isHuman ? "your" : "Player " + rival.number + "'s") + " supply.</li></ul></div>"
        + "<div class=\"turnsection\"><div class=\"turnlabel\">Transfer Asset costs a resource's raid cost</div><p class=\"small mb-1\">How many keys does the slot with " + whose + " " + name + " show? It returns that many Favors, if it holds them.</p>"
        + "<div class=\"numberanswers\">" + [1, 2, 3].map(keys => "<button type=\"button\" class=\"numberanswer\" onclick=\"answerCallInKeys(" + keys + ")\">" + keys + "</button>").join("") + "</div></div>", bot);
}

function answerCallInKeys(keys) {
    const callIn = roundEvent.callIn;
    const bot = getPlayer(callIn.bot);
    const held = getCampaignPlayer(bot).favors[callIn.rival] || 0;
    if (keys <= held) {
        applyCallIn(callIn, callIn.resource, keys);
        nextFavorCallIn();
        return;
    }
    // Too costly: the next resource it's chasing, then a Captive or Trophy, then nothing
    callIn.tried = (callIn.tried || []).concat({ resource: callIn.resource, keys: keys });
    const next = (callIn.resources || []).find(resource => !callIn.tried.some(tried => tried.resource == resource));
    const costly = callIn.tried.map(tried => "the " + preludeResourceNames[tried.resource] + " would cost " + tried.keys).join(" and ");
    if (next != null) {
        callIn.resource = next;
        callIn.note = capitalise(costly) + " Favors and it holds " + held + ", so it asks about the " + preludeResourceNames[next] + ".";
        askCallInKeys(callIn);
        return;
    }
    if (callIn.fallback != null) {
        applyCallInOption(callIn, callIn.fallback, capitalise(costly) + " Favors and it holds " + held + ", so instead: ");
    } else {
        roundEvent.callInResults.push("Player " + bot.number + " wanted Player " + callIn.rival + "'s resources, but " + costly + " Favors and it holds " + held + ": nothing forced. It keeps the Favors.");
    }
    nextFavorCallIn();
}

function applyCallInOption(callIn, option, prefix = "") {
    // 1 Favor: a Captive or Trophy, or Invite to Empire, Cede Control or Delegate Authority
    if (option.kind == "captives" || option.kind == "trophies") { applyCallIn(callIn, option.kind, 1, prefix); return; }
    const bot = getPlayer(callIn.bot), rival = getPlayer(callIn.rival);
    const favors = getCampaignPlayer(bot).favors;
    favors[rival.number] = Math.max((favors[rival.number] || 0) - 1, 0);
    let what = "", table = "";
    if (option.kind == "invite") {
        applyTitle(bot.number, "regent");
        what = "Invite to Empire: Player " + rival.number + " (First Regent) makes it a Regent";
        table = "flip Player " + bot.number + "'s title to Regent";
    } else if (option.kind == "cede") {
        cedeOnBoard(rival, bot, "city", option.system);
        what = "Cede Control: Player " + rival.number + "'s city at " + getSystemName(option.system) + " becomes Player " + bot.number + "'s";
        table = "replace Player " + rival.number + "'s city at " + getSystemName(option.system) + " with one of Player " + bot.number + "'s";
    } else if (option.kind == "delegate") {
        const entry = courtMarket.find(card => card.number == option.card);
        entry.agents[rival.number] = Math.max((entry.agents[rival.number] || 0) - 1, 0);
        entry.agents[bot.number] = (entry.agents[bot.number] || 0) + 1;
        what = "Delegate Authority: one of its agents replaces Player " + rival.number + "'s on " + getCourtCard(option.card).name;
        table = "swap 1 of Player " + rival.number + "'s agents on " + getCourtCard(option.card).name + " for one of Player " + bot.number + "'s";
    }
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    roundEvent.callInResults.push(prefix + "Player " + bot.number + " <b>calls in 1 of Player " + rival.number + "'s Favors</b>: " + what + " (" + option.why + ")."
        + "<small class=\"d-block text-secondary\">On the table: " + table + ", and Player " + rival.number + " takes back 1 agent from Player " + bot.number + "'s Fate card. The app has moved them.</small>");
}

function cedeOnBoard(from, to, kind, system = null) {
    // Cede Control on the app's board (rulebook p.17): one of from's pieces becomes to's. A building only
    // where from has no ships; not their last. A ship anywhere from has one, where to has pieces first.
    // The system used, or null if there's none
    if (kind == "ship") {
        const at = system || getSystemsWithShips(from.number).sort((a, b) => Number(hasLoyalPiece(b, to.number)) - Number(hasLoyalPiece(a, to.number)))[0];
        if (at == null || getBoardShips(from.number) <= 1) { return null; }
        const damaged = getShips(at, from.number).fresh == 0;
        removeShips(at, from.number, 1, damaged);
        addShips(at, to.number, 1, damaged);
        [from, to].forEach(syncPanelFromBoard);
        return at;
    }
    const resource = kind.startsWith("cities") ? kind.replace(/^cities/, "").toLowerCase() : null;
    const type = resource != null ? "city" : kind;
    if (getBoardBuildings(from.number, type).length <= 1) { return null; }
    const building = getBoardBuildings(from.number, type).find(item => (system == null || item.system == system)
        && (resource == null || getCityTypes(item.system).includes(resource)) && getShips(item.system, from.number).fresh + getShips(item.system, from.number).damaged == 0);
    if (building == null) { return null; }
    const piece = getSystem(building.system).buildings.find(item => item.owner == from.number && item.kind == type);
    piece.owner = to.number;
    [from, to].forEach(syncPanelFromBoard);
    return building.system;
}

function applyCallIn(callIn, counter, favorsSpent, prefix = "") {
    const bot = getPlayer(callIn.bot), rival = getPlayer(callIn.rival);
    const favors = getCampaignPlayer(bot).favors;
    favors[rival.number] = Math.max((favors[rival.number] || 0) - favorsSpent, 0);
    adjustCounter(rival, counter, -1);
    adjustCounter(bot, counter, 1);
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    roundEvent.callInResults.push(prefix + "Player " + bot.number + " <b>calls in " + favorsSpent + " of Player " + rival.number + "'s Favors</b>: Player " + rival.number + " gives it " + getDealLabel(counter, 1) + "."
        + "<small class=\"d-block text-secondary\">On the table: move it, and Player " + rival.number + " takes back " + favorsSpent + " agent" + (favorsSpent == 1 ? "" : "s") + " from Player " + bot.number + "'s Fate card. The app has moved them.</small>");
}

// Step 4: the Magnate. Merchant League's frozen resources (gained when it declares an ambition) can
// only be given away in Summit deals. Its objective advances 2 for each resource or Favor a Rival
// gives it (not one it gave that Rival in this Summit), and 2 for each 3 resources it exports
const magnateValues = { item: 1.5, league: 0.3, exportAt: 3 };

function isMagnate(player) {
    return hasFate(player, 3);
}

function getLeague(player) {
    const state = getCampaignPlayer(player);
    if (state.league == null) { state.league = {}; }
    return state.league;
}

function holdsMerchantLeague(player) {
    return (player.guildCards || []).includes(210);
}

function getLeagueHtml(player) {
    if (!holdsMerchantLeague(player)) { return ""; }
    const league = getLeague(player);
    const shown = player.isHuman ? preludeResources : preludeResources.filter(resource => (league[resource] || 0) > 0);
    return "<div class=\"favors leaguerow\"><span class=\"lbl\">Merchant League</span>" + (shown.length == 0 ? "<span class=\"small\">empty</span>" : shown.map(resource =>
        "<span class=\"favorstep\"><button type=\"button\" onclick=\"stepLeague(" + player.number + ", '" + resource + "', -1)\" aria-label=\"One " + preludeResourceNames[resource] + " fewer\"><i class=\"bi bi-dash\"></i></button>"
        + "<span class=\"leagueres\">" + getGameIcon(resource) + (league[resource] || 0) + "</span>"
        + "<button type=\"button\" onclick=\"stepLeague(" + player.number + ", '" + resource + "', 1)\" aria-label=\"One " + preludeResourceNames[resource] + " more\"><i class=\"bi bi-plus\"></i></button></span>").join("")) + "</div>";
}

function stepLeague(playerNumber, resource, change) {
    const player = getPlayer(playerNumber);
    const league = getLeague(player);
    league[resource] = Math.max((league[resource] || 0) + change, 0);
    showCampaignPanel(player);
    SaveAllSettings();
}

registerCampaignHook("ambitionDeclared", player => {
    // Merchant League: when it declares an ambition, it may gain any 2 resources onto it
    if (!holdsMerchantLeague(player)) { return undefined; }
    if (player.isHuman) {
        showMessageToast("Merchant League", "You may gain any 2 resources and place them on Merchant League. Add them on its line on your panel.");
        return undefined;
    }
    // A bot takes what its Rivals want most, for its deals
    const rivals = players.filter(other => other !== player);
    const wanted = preludeResources.filter(resource => getResourceSupply(resource) > 0)
        .sort((a, b) => rivals.reduce((total, rival) => total + getResourceNeed(rival, b), 0) - rivals.reduce((total, rival) => total + getResourceNeed(rival, a), 0));
    const league = getLeague(player);
    const taken = [];
    for (let index = 0; index < 2 && wanted.length > 0; index++) {
        const resource = wanted[index % wanted.length];
        league[resource] = (league[resource] || 0) + 1;
        taken.push(preludeResourceNames[resource]);
    }
    showCampaignPanel(player);
    SaveAllSettings();
    if (taken.length > 0) { showMessageToast("Player " + player.number + ": Merchant League", "Gains " + taken.join(" and ") + " onto Merchant League, for its deals in Summits. Take them from the supply."); }
    return undefined;
});

function clearLeaguesInCrisis() {
    // Merchant League's Crisis: discard all resources on it
    players.filter(holdsMerchantLeague).forEach(player => {
        const league = getLeague(player);
        if (Object.values(league).some(count => count > 0)) { showMessageToast("Merchant League", "Player " + player.number + " discards the resources on Merchant League."); }
        getCampaignPlayer(player).league = {};
        showCampaignPanel(player);
    });
}

function countMagnateItems(parts) {
    // Resources (its own or a Merchant League's) and Favors in a deal
    return Object.entries(parts).filter(([key]) => preludeResources.includes(key) || key.startsWith("league:") || key == "promise").reduce((total, [, count]) => total + count, 0);
}

function magnateDealt(from, to, given, received) {
    // to got given from from. A Magnate's objective advances for what a Rival gives it, less what it
    // gave that Rival in this Summit
    roundEvent.magnateGave = roundEvent.magnateGave || {};
    if (isMagnate(from)) {
        const record = roundEvent.magnateGave[from.number + "-" + to.number] = roundEvent.magnateGave[from.number + "-" + to.number] || {};
        Object.entries(given).forEach(([key, count]) => { const resource = key.replace("league:", ""); record[resource] = (record[resource] || 0) + count; });
    }
    if (!isMagnate(to)) { return; }
    const record = roundEvent.magnateGave[to.number + "-" + from.number] || {};
    let counted = 0;
    Object.entries(given).forEach(([key, count]) => {
        if (!(preludeResources.includes(key) || key.startsWith("league:") || key == "promise")) { return; }
        const resource = key.replace("league:", "");
        const back = Math.min(record[resource] || 0, count);
        record[resource] = (record[resource] || 0) - back;
        counted += count - back;
    });
    if (counted > 0) { advanceObjective(to, 2 * counted, counted + " resource" + (counted == 1 ? "" : "s") + " or Favor" + (counted == 1 ? "" : "s") + " from Player " + from.number + " (Close Deals with Rivals)"); }
}

function magnateExport(bot) {
    // Export to the Galactic Core: once a Summit, 3 resources it doesn't need
    if (!isMagnate(bot) || (roundEvent.exported || []).includes(bot.number)) { return; }
    const spare = [];
    preludeResources.filter(resource => getResourceNeed(bot, resource) == 0).sort((a, b) => bot[b + "Value"] - bot[a + "Value"])
        .forEach(resource => { for (let count = 0; count < bot[resource + "Value"]; count++) { spare.push(resource); } });
    if (spare.length < magnateValues.exportAt) { return; }
    const exported = spare.slice(0, magnateValues.exportAt);
    exported.forEach(resource => setPlayerResource(bot, resource, bot[resource + "Value"] - 1));
    roundEvent.exported = (roundEvent.exported || []).concat(bot.number);
    advanceObjective(bot, 2, "Exported 3 resources (Export to the Galactic Core)");
    const counts = {};
    exported.forEach(resource => { counts[resource] = (counts[resource] || 0) + 1; });
    const named = Object.entries(counts).map(([resource, count]) => getDealLabel(resource, count));
    roundEvent.offerResults.push("Player " + bot.number + " (Magnate) <b>exports to the Galactic Core</b>: it discards " + (named.length > 1 ? named.slice(0, -1).join(", ") + " and " + named[named.length - 1] : named[0]) + " it doesn't need."
        + "<small class=\"d-block text-secondary\">On the table: return them to the supply.</small>");
    players.forEach(showCampaignPanel);
    SaveAllSettings();
}

// A human Magnate's export: choose 3 resources to discard

let exportChoice = null;

function showExport(playerNumber, back) {
    if (exportChoice == null || exportChoice.player != playerNumber) { exportChoice = { player: playerNumber, back: back, parts: {} }; }
    const player = getPlayer(playerNumber);
    const total = Object.values(exportChoice.parts).reduce((sum, count) => sum + count, 0);
    const pills = preludeResources.filter(resource => player[resource + "Value"] > 0).map(resource => {
        const value = exportChoice.parts[resource] || 0;
        return "<span class=\"dealstep" + (value > 0 ? " on" : "") + "\"><span class=\"dealicon\">" + getGameIcon(resource) + "</span><small>of " + player[resource + "Value"] + "</small>"
            + "<button class=\"btn resourcebutton resourceminus\" type=\"button\" onclick=\"stepExport('" + resource + "', -1)\" aria-label=\"One fewer\"><i class=\"bi bi-dash-lg\"></i></button><b>" + value + "</b>"
            + "<button class=\"btn resourcebutton resourceplus\" type=\"button\" onclick=\"stepExport('" + resource + "', 1)\" aria-label=\"One more\"><i class=\"bi bi-plus-lg\"></i></button></span>";
    }).join("");
    setCampaignWindow("Export to the Galactic Core", "<p class=\"small mb-2\">Discard 3 resources: Player " + playerNumber + "'s objective advances 2.</p>"
        + "<div class=\"dealsteps mb-2\">" + (pills || "<span class=\"small text-secondary\">No resources to export.</span>") + "</div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"applyExport()\"" + (total == magnateValues.exportAt ? "" : " disabled") + ">Export " + total + " of 3</button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary w-100 mt-2\" onclick=\"closeExport()\">Back to the Summit</button>", player);
}

function stepExport(resource, change) {
    const player = getPlayer(exportChoice.player);
    const total = Object.values(exportChoice.parts).reduce((sum, count) => sum + count, 0);
    if (change > 0 && total >= magnateValues.exportAt) { return; }
    exportChoice.parts[resource] = Math.min(Math.max((exportChoice.parts[resource] || 0) + change, 0), player[resource + "Value"]);
    showExport(exportChoice.player, exportChoice.back);
}

function applyExport() {
    const player = getPlayer(exportChoice.player);
    Object.entries(exportChoice.parts).forEach(([resource, count]) => setPlayerResource(player, resource, player[resource + "Value"] - count));
    advanceObjective(player, 2, "Exported 3 resources (Export to the Galactic Core)");
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    closeExport();
}

function closeExport() {
    const back = exportChoice.back;
    exportChoice = null;
    showSummitView(back);
}