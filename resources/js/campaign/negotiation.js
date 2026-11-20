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
    promise: { get: 0.8, give: 1.2 },
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
    return "<div class=\"turnsection\"><div class=\"turnlabel\">Negotiations</div><p class=\"small mb-2\">Anyone may make deals. Offer a bot a deal and it says yes, no, or what it would take."
        + (humans.length > 1 ? " Deals between human players: change the panels to match." : "") + "</p>"
        + "<div class=\"negobtns\">" + bots.map(bot => "<button type=\"button\" class=\"btn btn-outline-secondary\" onclick=\"openDeal(" + bot.number + ", '" + back + "')\">Deal with Player " + bot.number
            + "<small>" + getFate(getCampaignPlayer(bot).fate).name + " &middot; bot</small></button>").join("") + "</div></div>";
}

function openDeal(botNumber, back) {
    const caller = roundEvent != null ? roundEvent.player : null;
    const human = (caller != null && caller.isHuman) ? caller : getHumanNegotiators()[0];
    negotiation = { bot: getPlayer(botNumber), human: human, give: {}, want: {}, giveDelegate: null, wantDelegate: null, invite: null, back: back, counter: null };
    showDealBuilder();
}

function closeDeal() {
    const back = negotiation.back;
    negotiation = null;
    if (back == "bot") { showBotSummitNegotiations(); } else { showSummit(); }
}

// What each side holds, and the most it can give

function getDealHolding(player, key) {
    if (dealCounters.includes(key)) { return player[key + "Value"]; }
    if (key == "promise") { const left = getAgentsLeft(player); return left == null ? 3 : left; }
    if (key == "ship") { return player.shipsBoardValue; }
    if (key == "starport") { return player.starportsValue || 0; }
    return player[key + "Value"];
}

function getDealMost(player, key) {
    // Not your last ship, starport or city (rulebook p.17)
    const held = getDealHolding(player, key);
    if (key == "ship" || key == "starport") { return Math.max(held - 1, 0); }
    if (cityCounters.includes(key)) { return Math.min(held, Math.max(getCityCount(player) - 1, 0)); }
    return held;
}

function getDealLabel(key, count) {
    if (dealCounters.includes(key)) { return count + " " + (key == "captives" ? "Captive" + (count == 1 ? "" : "s") : key == "trophies" ? "Troph" + (count == 1 ? "y" : "ies") : preludeResourceNames[key] + (count > 1 && key != "fuel" ? "s" : "")); }
    if (key == "promise") { return "Promise " + count + " Favor" + (count == 1 ? "" : "s"); }
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
            + "<small>of " + getDealHolding(owner, key) + "</small>"
            + "<button class=\"btn resourcebutton resourceminus\" type=\"button\" onclick=\"stepDeal('" + side + "', '" + key + "', -1)\" aria-label=\"One fewer\"><i class=\"bi bi-dash-lg\"></i></button><b>" + value + "</b>"
            + "<button class=\"btn resourcebutton resourceplus\" type=\"button\" onclick=\"stepDeal('" + side + "', '" + key + "', 1)\" aria-label=\"One more\"><i class=\"bi bi-plus-lg\"></i></button></span>";
    };
    const group = (label, html) => html == "" ? "" : "<div class=\"dealgroup\"><div class=\"grouplabel\">" + label + "</div>" + html + "</div>";
    const side = (key, owner, other) => {
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
                + (deal.invite == inviteKey ? "<i class=\"bi bi-check-lg\"></i> " : "") + "Invite Player " + other.number + " to the Empire</button>"
            : "<div class=\"small text-secondary\">Only the First Regent can invite an Outlaw.</div>";
        return group("Transfer Asset", assets == "" ? "<div class=\"small text-secondary\">Nothing to give.</div>" : "<div class=\"dealsteps\">" + assets + "</div>")
            + group("Favors", "<div class=\"dealsteps\">" + pill(key, "promise", null, "Promise Favor").replace(/(<small>of \d+)/, "$1 agents") + "</div>")
            + group("Cede Control", cede == "" ? "<div class=\"small text-secondary\">Nothing to cede.</div>" : "<div class=\"dealsteps\">" + cede + "</div>")
            + group("Delegate Authority", delegate == "" ? "<div class=\"small text-secondary\">No agents on Court cards.</div>" : delegate)
            + group("Invite to Empire", invite);
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
    negotiation[side][key] = Math.min(Math.max((negotiation[side][key] || 0) + change, 0), getDealMost(owner, key));
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
    if (preludeResources.includes(key)) { return count * v.resource[way][getResourceNeed(bot, key)]; }
    if (key == "captives" || key == "trophies") {
        const ambition = key == "captives" ? "tyrant" : "warlord";
        return count * (declaredAmbitions.includes(ambition) && isChasingAmbition(bot, ambition) ? v.chased[way] : v.idle[way]);
    }
    if (key == "promise") { return count * v.promise[way]; }
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
    const options = dealCounters.concat(["promise", "ship"]).map(key => ({ key: key, left: getDealMost(human, key) - (deal.give[key] || 0), value: getDealPartValue(bot, key, 1, true) }))
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
    const { bot, human } = deal;
    const table = [];
    const move = (from, to, parts) => Object.entries(parts).filter(([, count]) => count > 0).forEach(([key, count]) => {
        if (dealCounters.includes(key)) {
            adjustCounter(from, key, -count);
            adjustCounter(to, key, count);
            table.push("Player " + from.number + " gives Player " + to.number + " " + getDealLabel(key, count) + ".");
        } else if (key == "promise") {
            const favors = getCampaignPlayer(to).favors;
            favors[from.number] = (favors[from.number] || 0) + count;
            table.push("Player " + from.number + " puts " + count + " agent" + (count == 1 ? "" : "s") + " on Player " + to.number + "'s Fate card.");
        } else {
            const counter = key == "ship" ? "shipsBoard" : key == "starport" ? "starports" : key;
            adjustCounter(from, counter, -count);
            adjustCounter(to, counter, count);
            table.push("Cede Control: replace " + count + " of Player " + from.number + "'s " + (key == "ship" ? "ships" : key == "starport" ? "starports" : preludeResourceNames[key.replace(/^cities/, "").toLowerCase()].toLowerCase() + " cities")
                + " with Player " + to.number + "'s. Not a building with Player " + from.number + "'s own ships in its system.");
        }
    });
    move(human, bot, deal.give);
    move(bot, human, deal.want);
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
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    setCampaignWindow("Deal with Player " + bot.number, getDealSummaryHtml(deal) + "<div class=\"reply yes\"><div class=\"verdict\">Deal made</div>"
        + "<p class=\"small mb-1 mt-1\">The app has updated the panels. On the table:</p><ul class=\"small mb-0\">" + table.map(line => "<li>" + line + "</li>").join("") + "</ul></div>"
        + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"closeDeal()\">Back to the Summit</button>", bot);
}

// A Summit a bot called: the human players may still negotiate before it ends

function showBotSummitNegotiations() {
    const player = roundEvent.player;
    setOrShowCampaignWindow("Summit: Player " + player.number + " calls it to order",
        "<div class=\"turnsection\"><div class=\"setstep\"><span class=\"setnum\">&#10003;</span><span>" + roundEvent.summitNote + "</span></div></div>"
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
