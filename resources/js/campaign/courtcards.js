// Blighted Reach campaign (#85): the campaign's Court deck (marked "CC") and the Imperial Council.
// Its 10 Guild cards are the base game's (same names and text), so they keep their base numbers and
// everything the app knows about them. Its 5 Vox cards are new, numbered 101-105 here, and each has
// a Crisis as well as a When Secured. The Imperial Council is 100: always in the Court, In Session
// or Decided.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const campaignGuildCards = [2, 5, 8, 9, 13, 11, 16, 20, 22, 23];
const councilNumber = 100;

const campaignCourtCards = [
    new CourtCard(councilNumber, "Imperial Council", "vox", null, 0,
        "When Secured: Flip this card over to its Decided side, and tuck it partly under your played card. When the round ends, return it to the Court, then: 1. You may call a Summit. 2. If you're a Regent, become First Regent. 3. If you're an Outlaw, steal from the First Regent tile. 4. You must resolve either Crises or Edicts. While Decided, it can't be influenced or secured.",
        { council: true }),
    new CourtCard(101, "Populist Demands", "vox", null, 0,
        "When Secured: You may declare any ambition. (An ambition marker must be Available.) Bury this card.",
        { declares: true, crisis: "Return the declared ambition marker of highest Power to Available Ambitions." }),
    new CourtCard(102, "Council Intrigue", "vox", null, 0,
        "When Secured: Flip the Imperial Council to In Session. You may move any of your Loyal agents from this card to other Court cards (even the Council). Bury this card.",
        { crisis: "Flip the Imperial Council to In Session, and move the agents on this card onto it. Bury this card." }),
    new CourtCard(103, "Diplomatic Fiasco", "vox", null, 0,
        "When Secured: Rivals resolve the Crisis.",
        { crisis: "In turn order, each player with more Guild cards than agents in their supply must discard Guild cards until their Guild cards equal their agents. Bury this card. (Count protected Guild cards but don't discard them.)" }),
    new CourtCard(104, "Song of Freedom", "vox", null, 0,
        "When Secured: You may replace any Loyal or Rival city you control with a Free city. If you do, you may seize the initiative. Shuffle this card into the Court deck.",
        { seizes: true, crisis: "The player with the most Power must replace a Loyal city with a Free city." }),
    new CourtCard(105, "Blight Looms", "vox", null, 0,
        "When Secured: You may destroy all damaged Blight in a cluster with your Loyal pieces. Bury this card.",
        { crisis: "Repair all Blight in the rolled cluster. Place 1 damaged Blight at each planet of the rolled symbol that has no Blight. Bury this card." })
];

// How much a bot wants them in the market, like the base Vox cards (rules.js marketValues). New
// numbers, so the base game's values are untouched
Object.assign(marketValues.vox, { 100: 2, 101: 2, 102: 1, 103: 1, 104: 1, 105: 1.5 });

function getCouncilEntry() {
    return courtMarket.find(entry => entry.number == councilNumber);
}

function isCouncilDecided() {
    const entry = getCouncilEntry();
    return entry != null && entry.decided === true;
}

function setCouncilInSession() {
    // At the start of each Act, by Petition in a Summit, or by Council Intrigue
    const entry = getCouncilEntry();
    if (entry != null) { entry.decided = false; }
}

registerCampaignHook("courtCard", number => {
    const card = campaignCourtCards.find(other => other.number == number);
    // The Council's name says when it's Decided, wherever it's shown
    return (card != null && card.council && isCouncilDecided()) ? { ...card, name: card.name + " (Decided)" } : card;
});

registerCampaignHook("courtPool", () => campaignGuildCards.map(number => courtCards.find(card => card.number == number))
    .concat(campaignCourtCards.filter(card => !card.council)));

registerCampaignHook("courtSize", () => openingCourtCards[players.length] + (getCouncilEntry() != null ? 1 : 0));

registerCampaignHook("isCardClosed", entry => entry.number == councilNumber && entry.decided === true);

registerCampaignHook("courtRow", (entry, row) => {
    // Guild cards attached by Recover (Guild Investigators, #176), and the Council's side
    if (courtSetup) { return undefined; }
    addAttachedRows(entry, row);
    // The Council's side, to set by hand if it was secured or petitioned on the table without the
    // app (#169). While Decided, bots don't influence or secure it
    if (entry.number != councilNumber) { return undefined; }
    const side = (decided, label) => "<button type=\"button\" class=\"btn btn-outline-secondary btn-sm" + (isCouncilDecided() == decided ? " active" : "") + "\" onclick=\"setCouncilSide(" + decided + ")\">" + label + "</button>";
    row.insertAdjacentHTML("beforeend", "<div class=\"brseg councilside mb-1\">" + side(false, "In Session") + side(true, "Decided") + "</div>"
        + (isCouncilDecided() ? "<div class=\"small text-secondary text-center mb-1\">Decided: no one can influence or secure it until it's In Session again.</div>" : ""));
    return undefined;
});

// Recover (Guild Investigators, card 204): the top Guild card of the Court discard pile is attached
// to a Court card with no agents. It goes with that card when it's secured (#176)

function getAttachableCards() {
    // Guild cards that could be in the discard pile: not in the market, held or attached already
    const attached = courtMarket.flatMap(entry => entry.attached || []);
    return getCourtPool().filter(card => card.type == "guild" && !courtMarket.some(entry => entry.number == card.number)
        && getGuildCardHolder(card.number) == null && !attached.includes(card.number)).sort(byCardName);
}

function addAttachedRows(entry, row) {
    (entry.attached || []).forEach(number => {
        const card = getCourtCard(number);
        if (card == null) { return; }
        row.insertAdjacentHTML("beforeend", "<div class=\"d-flex align-items-center gap-1 mb-1 ps-3\"><i class=\"bi bi-arrow-return-right text-secondary\"></i>"
            + "<span class=\"guildchip" + (card.resource != null ? " guild-" + card.resource : "") + "\">" + card.name + "</span><span class=\"small text-secondary\">attached</span>"
            + "<button type=\"button\" class=\"btn btn-outline-secondary btn-sm py-0 ms-auto\" aria-label=\"Detach " + card.name + "\" onclick=\"detachCourtCard(" + entry.number + ", " + number + ")\"><i class=\"bi bi-x-lg\"></i></button></div>");
    });
    // Attaching: while someone holds Guild Investigators, to a card with no agents
    const recover = players.some(player => (player.guildCards || []).includes(204));
    const noAgents = Object.values(entry.agents || {}).every(count => count == 0);
    if (!recover || !noAgents || entry.number == councilNumber) { return; }
    row.insertAdjacentHTML("beforeend", "<select class=\"form-select form-select-sm mt-1\" aria-label=\"Attach a Guild card\" onchange=\"attachCourtCard(" + entry.number + ", this.value)\">"
        + "<option value=\"\">Attach a Guild card from the discard pile&hellip;</option>"
        + getAttachableCards().map(card => "<option value=\"" + card.number + "\">" + card.name + " (" + preludeResourceNames[card.resource] + ")</option>").join("") + "</select>");
}

function attachCourtCard(number, attachNumber) {
    const entry = courtMarket.find(item => item.number == number);
    if (entry == null || attachNumber == "") { return; }
    entry.attached = (entry.attached || []).concat(parseInt(attachNumber));
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function detachCourtCard(number, attachNumber) {
    const entry = courtMarket.find(item => item.number == number);
    if (entry == null) { return; }
    entry.attached = (entry.attached || []).filter(item => item != attachNumber);
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

function setCouncilSide(decided) {
    const entry = getCouncilEntry();
    if (entry == null) { return; }
    entry.decided = decided;
    SaveAllSettings();
    showCourtWindow();
    refreshTurnSummary();
}

registerCampaignHook("secureCard", (entry, player, captured) => {
    const card = getCourtCard(entry.number);
    if (card == null || card.number < councilNumber) { return undefined; }
    const capturedText = captured > 0 ? ", capturing " + captured + " agent" + (captured == 1 ? "" : "s") : "";
    if (card.council) {
        // It stays in the Court, Decided, and is resolved at the end of the round (rulebook p.14)
        entry.decided = true;
        entry.agents = {};
        campaign.councilSecuredBy = player.number;
        // Where the round had got to, so an Event played after it gives no actions (events.js)
        campaign.councilSecuredAt = discardPile.length;
        showMessageToast("Player " + player.number, "Secured the Imperial Council" + capturedText + ". It's now Decided: at the end of the round, Player " + player.number + " resolves it.");
        return true;
    }
    removeFromMarket(card.number);
    if (card.number == 102) { setCouncilInSession(); }
    // Populist Demands: a bot says which ambition it declares, as with the base game's (vox.js, #173)
    const decides = !player.isHuman && card.number == 101;
    showMessageToast("Player " + player.number, "Secured " + card.name + capturedText + ". " + (decides ? "" : card.text + " ") + "Add its replacement to the market."
        + (player.isHuman || decides ? "" : " (Bots don't yet decide this for themselves: choose for it.)"));
    if (decides) {
        document.getElementById("courtModal").addEventListener('hidden.bs.modal', () => {
            showVoxCard(player, card);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
        }, { once: true });
    }
    return true;
});
