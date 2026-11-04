// Court cards: the base game's Guild and Vox cards (BC 01-31), as printed. The Guild cards each
// player holds are listed on their panel, and their icons count towards ambitions. Also here
// for bot preludes (#72), drawing played cards (#38) and bots securing Court cards (#74).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html
//
// Each card has:
// number   - the number printed in the bottom corner (BC 01-31)
// name     - the card's name
// type     - "guild" or "vox"
// resource - a Guild card's resource icon, which counts towards ambitions like a resource
//            (materials, fuel, weapons, relics or psionics, as the player counters are named)
// keys     - a Guild card's keys
// text     - the card's text
// And where it applies, to make the cards easier to use in the bot's logic:
// prelude     - the card has a Prelude ability
// spendAnyAs  - the holder may spend any resource as this resource (the Loyal cards)
// keepOnOutrage - the card is kept when its holder Provokes Outrage (the Loyal cards)
// holdsSupply - the card holds that resource's supply, which counts towards Tycoon but can't be spent
// drawsPlayed - Prelude: draw a played action card of this suit when the round ends
// seizes      - can be used to seize the initiative
// declares    - lets the holder declare an ambition
// placesShips - Prelude: discard to place ships
// replacesActions - actions the holder can take in place of a normal action (see guildactions.js)

class CourtCard {
    constructor(number, name, type, resource, keys, text, extras) {
        this.number = number;
        this.name = name;
        this.type = type;
        this.resource = resource;
        this.keys = keys;
        this.text = text;
        Object.assign(this, extras);
    }
}

const courtCards = [
    // Material
    new CourtCard(1, "Loyal Engineers", "guild", "materials", 3,
        "If you Provoke Outrage, keep this card. You may spend any resources as Material. You ignore Outrage when spending Material for its Prelude action.",
        { spendAnyAs: "materials", keepOnOutrage: true }),
    new CourtCard(2, "Mining Interest", "guild", "materials", 2,
        "Manufacture (Build): Gain 1 Material. Prelude: You may discard this to gain Material up to your number of empty resource slots. If the Material supply empties, steal the Material instead.",
        { prelude: true, replacesActions: [{ name: "Manufacture", replaces: "build" }] }),
    new CourtCard(3, "Material Cartel", "guild", "materials", 2,
        "You keep the Material supply on here. (You add it to Tycoon but can't spend it.) After scoring, Rivals discard all Material. Prelude: You may discard this to steal 1 Material.",
        { prelude: true, holdsSupply: "materials" }),
    new CourtCard(4, "Admin Union", "guild", "materials", 2,
        "Prelude: You may place this card next to a face-up played Administration card. When the round ends, draw that card into your hand and discard this card.",
        { prelude: true, drawsPlayed: "Administration" }),
    new CourtCard(5, "Construction Union", "guild", "materials", 2,
        "Prelude: You may place this card next to a face-up played Construction card. When the round ends, draw that card into your hand and discard this card.",
        { prelude: true, drawsPlayed: "Construction" }),

    // Fuel
    new CourtCard(6, "Fuel Cartel", "guild", "fuel", 2,
        "You keep the Fuel supply on here. (You add it to Tycoon but can't spend it.) After scoring, Rivals discard all Fuel. Prelude: You may discard this to steal 1 Fuel.",
        { prelude: true, holdsSupply: "fuel" }),
    new CourtCard(7, "Loyal Pilots", "guild", "fuel", 3,
        "If you Provoke Outrage, keep this card. You may spend any resources as Fuel. You ignore Outrage when spending Fuel for its Prelude action.",
        { spendAnyAs: "fuel", keepOnOutrage: true }),
    new CourtCard(8, "Gatekeepers", "guild", "fuel", 2,
        "When you battle in a gate, you may collect 2 more dice. Prelude: You may discard this to place 1 ship in each gate (unless out of play).",
        { prelude: true, placesShips: true }),
    new CourtCard(9, "Shipping Interest", "guild", "fuel", 2,
        "Synthesize (Build): Gain 1 Fuel. Prelude: You may discard this to gain Fuel up to your number of empty resource slots. If the Fuel supply empties, steal the Fuel instead.",
        { prelude: true, replacesActions: [{ name: "Synthesize", replaces: "build" }] }),
    new CourtCard(10, "Spacing Union", "guild", "fuel", 2,
        "Prelude: You may place this card next to a face-up played Mobilization card. When the round ends, draw that card into your hand and discard this card.",
        { prelude: true, drawsPlayed: "Mobilisation" }),

    // Weapons
    new CourtCard(11, "Arms Union", "guild", "weapons", 2,
        "Prelude: You may place this card next to a face-up played Aggression card. When the round ends, draw that card into your hand and discard this card.",
        { prelude: true, drawsPlayed: "Aggression" }),
    new CourtCard(12, "Prison Wardens", "guild", "weapons", 2,
        "Pressgang (Build): Return any number of your Captives to gain any 1 resource for each. Execute (Influence): Move any number of your Captives to your Trophies. Prelude: You may discard this to place 3 ships in a system you control.",
        { prelude: true, placesShips: true, replacesActions: [{ name: "Pressgang", replaces: "build" }, { name: "Execute", replaces: "influence" }] }),
    new CourtCard(13, "Skirmishers", "guild", "weapons", 2,
        "After you roll in battle, you may reroll a number of skirmish dice up to your total Weapon icons from resources and cards. Prelude: You may discard this to place 3 ships in a system you control.",
        { prelude: true, placesShips: true }),
    new CourtCard(14, "Court Enforcers", "guild", "weapons", 2,
        "Abduct (Battle): Capture all Rival agents from a card in the Court that has fewer Rival agents than your total Weapon icons from resources and cards. Prelude: You may discard this to place 3 ships in a system you control.",
        { prelude: true, placesShips: true, replacesActions: [{ name: "Abduct", replaces: "battle" }] }),
    new CourtCard(15, "Loyal Marines", "guild", "weapons", 3,
        "If you Provoke Outrage, keep this card. You may spend any resources as Weapons. You ignore Outrage when spending Weapons for their Prelude action. Prelude: You may discard this to place 3 ships in a system you control.",
        { prelude: true, placesShips: true, spendAnyAs: "weapons", keepOnOutrage: true }),

    // Psionics
    new CourtCard(16, "Lattice Spies", "guild", "psionics", 2,
        "Prelude: Before any other actions, you may discard this to seize the initiative. You can't seize the initiative if you have it or if it's already seized this round!",
        { prelude: true, seizes: true }),
    new CourtCard(17, "Farseers", "guild", "psionics", 2,
        "When you declare an ambition, look at a Rival's hand. You may swap 1 card with them. Prelude: You may discard this and any number of cards from your hand. Draw the same number of cards (including Farseers) from the bottom of the action discard pile.",
        { prelude: true }),
    new CourtCard(18, "Secret Order", "guild", "psionics", 2,
        "When you declare Keeper or Empath, do not place the zero marker.",
        {}),
    new CourtCard(19, "Loyal Empaths", "guild", "psionics", 3,
        "If you Provoke Outrage, keep this card. You may spend any resources as Psionic. You ignore Outrage when spending Psionic for its Prelude action.",
        { spendAnyAs: "psionics", keepOnOutrage: true }),
    new CourtCard(20, "Silver-Tongues", "guild", "psionics", 2,
        "Prelude: You may discard this to steal a Guild card or resource.",
        { prelude: true }),

    // Relics
    new CourtCard(21, "Loyal Keepers", "guild", "relics", 3,
        "If you Provoke Outrage, keep this card. You may spend any resources as Relics. You ignore Outrage when spending Relics for their Prelude action.",
        { spendAnyAs: "relics", keepOnOutrage: true }),
    new CourtCard(22, "Sworn Guardians", "guild", "relics", 1,
        "Rivals cannot steal your resources and other Guild cards. (In battle they can steal this first and then spend keys.) If this card is stolen, bury it. (Place it on the bottom of the Court deck.)",
        {}),
    new CourtCard(23, "Elder Broker", "guild", "relics", 2,
        "Trade (Tax): Choose a Rival city you control. Swap 1 resource with that Rival—take a resource of that city type from them, and give them a resource they don't have. Prelude: You may discard this to gain 1 Material, 1 Fuel, and 1 Weapon.",
        { prelude: true, replacesActions: [{ name: "Trade", replaces: "tax" }] }),
    new CourtCard(24, "Relic Fence", "guild", "relics", 2,
        "Prelude: Once per turn, you may discard 1 resource to gain 1 Relic.",
        { prelude: true }),
    new CourtCard(25, "Galactic Bards", "guild", "relics", 1,
        "When you Surpass or Pivot, before taking any actions, you may declare the ambition on your played card if an ambition has not been declared yet this round. Do not place the zero marker.",
        { declares: true }),

    // Vox
    new CourtCard(26, "Mass Uprising", "vox", null, 0,
        "When Secured: Choose a cluster on the map. You place 1 ship in each system of that cluster. Discard this card.",
        { placesShips: true }),
    new CourtCard(27, "Populist Demands", "vox", null, 0,
        "When Secured: You may declare any ambition. (An ambition marker must be Available.) Discard this card.",
        { declares: true }),
    new CourtCard(28, "Outrage Spreads", "vox", null, 0,
        "When Secured: You may choose an Outrage type. Each player (even you) must Provoke Outrage of that type. Discard this card.",
        {}),
    new CourtCard(29, "Song of Freedom", "vox", null, 0,
        "When Secured: You may return any one city you control to its player board. If you do, you may seize the initiative. Shuffle this card into the Court deck. You can't seize the initiative if you have it or if it's already seized this round!",
        { seizes: true }),
    new CourtCard(30, "Guild Struggle", "vox", null, 0,
        "When Secured: You may steal 1 Guild card from a Rival. Shuffle all Guild cards from the Court discard pile into the Court deck. Discard Guild Struggle.",
        {}),
    new CourtCard(31, "Call to Action", "vox", null, 0,
        "When Secured: Draw 1 action card from the bottom of the action discard pile. Discard Call to Action.",
        {})
];

function getCourtCard(number) {
    return courtCards.find(card => card.number == number);
}

function getGuildCards() {
    return courtCards.filter(card => card.type == "guild");
}

function getPlayerGuildCards(player) {
    // The Guild cards a player holds. Games saved before they were tracked have none
    return (player.guildCards || []).map(number => getCourtCard(number));
}

function getGuildIconCount(player, resource) {
    // Each Guild card has one resource icon, which counts towards ambitions
    return getPlayerGuildCards(player).filter(card => card.resource == resource).length;
}

function getGuildCardHolder(number) {
    // The player holding a Guild card, or undefined
    return players.find(player => (player.guildCards || []).includes(number));
}
