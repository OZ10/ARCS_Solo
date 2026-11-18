// Blighted Reach campaign (#85): the 24 Fates. Each player plays one Fate an Act; "A" Fates are chosen
// in Act I, "B" and "C" Fates in the Intermissions after Acts I and II.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html
//
// Each Fate has:
// number     - its Fate Set number (1-24)
// name       - the Fate's name
// set        - "A", "B" or "C"
// complexity - 1 to 3 dots, as printed
// path       - its Path to Power, one line for each Act it's played in
// objective  - Act I (A Fates): where the objective marker starts, by player count, and how it
//              advances. B and C Fates' objectives come with their later Acts
// setup      - Act I (A Fates): what its Setup side says to do
// firstRegent - it takes the First Regent tile in setup ("unlessSteward": only if the Steward isn't played)

const fates = [
    { number: 1, name: "Steward", set: "A", complexity: 2,
        path: ["Win ambitions as the First Regent.", "Extend the Empire's control and fill the Imperial Trust.", "Have the Empire control Outlaw cities, and fill the Imperial Trust as the First Regent."],
        objective: { start: { 2: 20, 3: 17, 4: 14 }, text: "<b>Consolidate Your Imperial Power:</b> each time you win an ambition while you're the First Regent, advance 1 for each Power you gain from it (including bonus city Power)." },
        setup: "Gain Imperial Authority (02) and Dealmakers (03). Take the First Regent tile.", firstRegent: true },
    { number: 2, name: "Founder", set: "A", complexity: 2,
        path: ["Win ambitions and control systems as an Outlaw.", "Lead the Commonwealth and spread Free cities.", "Protect Free cities outside the Empire."],
        objective: { start: { 2: 18, 3: 16, 4: 14 }, text: "<b>Inspire Confidence in the Cause:</b> while you're an Outlaw, advance 3 for each ambition you win. <b>Defy the Empire's Grip:</b> at the end of a chapter, if you're an Outlaw, advance 1 for each system you control." },
        setup: "Gain Parade Fleets (02)." },
    { number: 3, name: "Magnate", set: "A", complexity: 1,
        path: ["Barter for resources and Favors from Rivals during Summits.", "Take and hold Monopolies over the resource supplies.", "Hold Monopolies and escape the Reach with your riches."],
        objective: { start: { 2: 10, 3: 10, 4: 10 }, text: "<b>Close Deals with Rivals:</b> in Summit Negotiations, advance 2 each time a Rival gives you a Favor or resource (not one you gave them in this Summit). <b>Export to the Galactic Core:</b> in Negotiations, advance 2 each time you discard 3 resources." },
        setup: "Gain Merchant League (02)." },
    { number: 4, name: "Advocate", set: "A", complexity: 1,
        path: ["Use and recover Guild cards.", "Have more Guild cards than your Rivals in many suits.", "Fill the Court with Guild cards."],
        objective: { start: { 2: 18, 3: 18, 4: 18 }, text: "<b>Prove Yourself to the Overseers:</b> while you have Guild Overseers, advance 3 each time you use the Prelude of a Guild card that discards itself. <b>Keep the Guilds in Power:</b> while you have Guild Overseers, advance 2 for each Recover action." },
        setup: "Gain Guild Investigators (02) and Guild Overseers (03)." },
    { number: 5, name: "Caretaker", set: "A", complexity: 3,
        path: ["Control and awaken the Golems, and use them.", "Collect lore.", "Use the Golems to scrap lore, and then themselves."],
        objective: { start: { 2: 18, 3: 18, 4: 18 }, text: "<b>Find the Golems:</b> for each ambition you win, advance 2 for each Golem you have. <b>Use the Golems:</b> advance 2 each time any player spends a Golem in their Prelude." },
        setup: "Gain Golem Beacon (02), Golem Hearth (03) and Stone-Speakers (04). Shuffle the 4 Sleeping Golems and put one on each gate in a cluster with no Imperial ships. Add Golems (05) and Golem Actions (06) to the rules booklet." },
    { number: 6, name: "Partisan", set: "A", complexity: 1,
        path: ["Get the initiative, even by Provoking Outrage.", "Hold the initiative and Guild support.", "Have the most Guild cards and the initiative."],
        objective: { start: { 2: 12, 3: 11, 4: 10 }, text: "<b>Sow Division:</b> advance 1 each time you get the initiative marker, in any way. <b>Appeal to Your Supporters:</b> advance 2 for each ambition you win where you have no Outrage of its resource (Weapon Outrage stops Warlord)." },
        setup: "Gain Informants (02) and Partisan Seizing (03)." },
    { number: 7, name: "Admiral", set: "A", complexity: 1,
        path: ["Enlarge the Imperial fleet and use it in battle to take Trophies.", "Exert Imperial control of planets and dominate your foes.", "Control the Reach's planets and build the strongest navy."],
        objective: { start: { 2: 13, 3: 13, 4: 13 }, text: "<b>Prove Yourself as a New Admiral:</b> while you're a Regent and winning an ambition, advance 1 for each Imperial ship anyone places on the map. <b>Demonstrate the Navy's Might:</b> while you're a Regent, advance 1 for each Trophy you take in battle with attacking Imperial ships." },
        setup: "Gain Imperial Officers (02). Add Use Imperial Foundries (03) to the rules booklet. Take the First Regent tile, unless the Steward is being played.", firstRegent: "unlessSteward" },
    { number: 8, name: "Believer", set: "A", complexity: 3,
        path: ["Play Faithful action cards while winning ambitions.", "Spread Ideals and Doctrine.", "Win ambitions with your Ideals."],
        objective: { start: { 2: 10, 3: 9, 4: 8 }, text: "<b>Spread the Good Word:</b> for each ambition you win, advance 1 for each action pip on the top card of the Faithful stack. If the stack is empty, advance 10." },
        setup: "Gain Faithful Disciples (02) and Spreading the Faith (03). Stack the 9 Faithful action cards (04-12), \"1\" at the bottom and \"9\" on top. Add Faithful Cards (13) and Pluralistic Faith (14) to the rules booklet." },

    { number: 9, name: "Pathfinder", set: "B", complexity: 2, path: ["", "Find the Portal by following Clues (Flagship).", "Guide the Pilgrims into the Portal."] },
    { number: 10, name: "Hegemon", set: "B", complexity: 2, path: ["", "Plant Banners of the new order (Flagship).", "Keep many Banners on the map."] },
    { number: 11, name: "Planet Breaker", set: "B", complexity: 3, path: ["", "Repair the Planet Hammer and break a planet (Flagship).", "Spread Outrage everywhere and break planets."] },
    { number: 12, name: "Pirate", set: "B", complexity: 1, path: ["", "Fill the Pirate Hoard (Flagship).", "Keep your Haven secret."] },
    { number: 13, name: "Blight Speaker", set: "B", complexity: 1, path: ["", "Spread the Blight and win ambitions.", "Win Warlord and feed the Blight."] },
    { number: 14, name: "Pacifist", set: "B", complexity: 2, path: ["", "Hold no Trophies or Captives, and gather Psionics.", "Stay peaceful while Rivals hold Psionics."] },
    { number: 15, name: "Peacekeeper", set: "B", complexity: 2, path: ["", "Control the Weapon planets and confiscate Weapons.", "Call Ceasefires and keep clusters at peace."] },
    { number: 16, name: "Warden", set: "B", complexity: 3, path: ["", "Become Lord of Fiefs with Seat cities.", "Hold the Fiefs."] },

    { number: 17, name: "Overlord", set: "C", complexity: 1, path: ["", "", "Control Outraged planets and hold Outraged resources."] },
    { number: 18, name: "Survivalist", set: "C", complexity: 2, path: ["", "", "Build Bunkers, hold Captives and protect against the Blight."] },
    { number: 19, name: "Redeemer", set: "C", complexity: 1, path: ["", "", "Collect and destroy Relics, and make Keeper harder."] },
    { number: 20, name: "Guardian", set: "C", complexity: 1, path: ["", "", "Win the new Edenguard ambition, and capture Material and Fuel."] },
    { number: 21, name: "Naturalist", set: "C", complexity: 2, path: ["", "", "Win the new Blightkin ambition and keep the Blight fresh."] },
    { number: 22, name: "Gate Wraith", set: "C", complexity: 2, path: ["", "", "Collapse gates into the Twisted Passage."] },
    { number: 23, name: "Conspirator", set: "C", complexity: 2, path: ["", "", "Place hidden Conspiracies on ambitions instead of declaring."] },
    { number: 24, name: "Judge", set: "C", complexity: 3, path: ["", "", "Make ties for first place, and have Rivals use your ships."] }
];

function getFate(number) {
    return fates.find(fate => fate.number == number);
}

function getFatesInSet(set) {
    return fates.filter(fate => fate.set == set);
}

function getComplexityDots(fate) {
    return "&#9679;".repeat(fate.complexity) + "&#9675;".repeat(3 - fate.complexity);
}
