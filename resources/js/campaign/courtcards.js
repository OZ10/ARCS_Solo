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

registerCampaignHook("courtCard", number => campaignCourtCards.find(card => card.number == number));

registerCampaignHook("courtPool", () => campaignGuildCards.map(number => courtCards.find(card => card.number == number))
    .concat(campaignCourtCards.filter(card => !card.council)));

registerCampaignHook("courtSize", () => openingCourtCards[players.length] + (getCouncilEntry() != null ? 1 : 0));

registerCampaignHook("isCardClosed", entry => entry.number == councilNumber && entry.decided === true);

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
    showMessageToast("Player " + player.number, "Secured " + card.name + capturedText + ". " + card.text + " Add its replacement to the market."
        + (player.isHuman ? "" : " (Bots don't yet decide this for themselves: choose for it.)"));
    return true;
});
