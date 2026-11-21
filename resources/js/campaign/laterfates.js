// Blighted Reach campaign (#85): the Fates in Acts II and III. Each "A" and "B" Fate has an Act II
// objective; in Act III "A" and "B" Fates have two grand ambitions, scored each chapter, and "C"
// Fates have a final objective. The app moves objectives where it can tell (the Imperial Trust,
// Guild cards, Weapons, ties for first...) and otherwise asks in the objectives window at the end
// of each chapter. Fate-specific tokens (Banners, Clues, Bunkers...) stay on the table.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html
//
// laterFates[fate number]:
// act2  - { start (by player count), setup, text, auto: [{ reason, amount(player) }], ask: [{ text, per, when(player) }] }
// act3  - for "A" and "B" Fates: { setup, grand: name, conditions: [first, second] }
//         for "C" Fates: { start, setup, text, auto, ask }, a final objective
// per is the objective advance for each one counted, or a function of the player

const startAll = n => ({ 2: n, 3: n, 4: n });
const startByCount = (two, three, four) => ({ 2: two, 3: three, 4: four });
// The grand ambitions' Power on the Act III chapter track: [one fulfilled, both]
const grandAmbitionPower = { 1: [2, 4], 2: [3, 8], 3: [4, 14], 4: [5, 20] };

function countGuildSuits(player) {
    return new Set(getPlayerGuildCards(player).map(card => card.resource)).size;
}

function getAmbitionsWonThisChapter(player) {
    return getCampaignPlayer(player).ambitionsWon || 0;
}

const laterFates = {
    1: { act2: { start: startAll(22), setup: "Add Imperial Quorum (13) to the Edicts.",
            text: "<b>Expand the Empire:</b> at the end of a chapter, if First Regent, 1 for each cluster where the Empire controls any systems. <b>Ensure the Emperor's Tribute:</b> at the end of a chapter, 1 for each resource in the Imperial Trust.",
            auto: [{ reason: "resources in the Imperial Trust (Ensure the Emperor's Tribute)", amount: () => trustResources.reduce((total, resource) => total + campaign.trust[resource], 0) }],
            ask: [{ text: "First Regent: how many clusters have systems the Empire controls?", per: 1, when: player => isFirstRegent(player) }] },
        act3: { setup: "Add Imperial Sponsor (23); put the Sponsored token on the First Regent tile. Scrap Govern the Imperial Reach (03-05) and add Govern with Authority (24-26): the First Regent picks the one on top.",
            grand: "Entrench the Empire in the Reach", conditions: ["You're a Regent, and the Empire controls all Outlaw cities or there are no Outlaws.", "You're the First Regent, and the Imperial Trust has more resources than the current chapter."] } },
    2: { act2: { start: startByCount(12, 14, 16), setup: "Gain Founder of the Commonwealth (13) and the Commonwealth Ambition marker. Add Commonwealth Ambition (14) and Call for Armistice (15), with 2 Armistices (16-17) under it. Give a Member title (18-21) to each player, you too. Add Commonwealth Membership (22).",
            text: "<b>Distribute Power Fairly:</b> when the Commonwealth wins its ambition, 2 for each Member. <b>Protect Freedom:</b> at the end of a chapter, 1 for each Free city the Empire doesn't control.",
            ask: [{ text: "How many Free cities does the Empire not control?", per: 1 }, { text: "If the Commonwealth won its ambition this chapter: how many Members?", per: 2 }] },
        act3: { setup: "Scrap Call for Armistice and add Mass Call for Armistice (26). Gain Freedom Fighters (27).",
            grand: "Secure Freedom for All", conditions: ["The Commonwealth won its ambition, and 3 Free cities aren't controlled by the Empire or a non-Member.", "The Commonwealth won its ambition, and 7 such Free cities."] } },
    3: { act2: { start: startAll(12), setup: "Put the 5 Monopoly cards (13-17) in the supply, each holding its resource's supply. Add Gain Monopolies (18), Monopoly Consent (19) and War Profiteering (20). Put the War Profiteer marker on Warlord.",
            text: "<b>Corner the Market:</b> 1 each time you gain a Monopoly from the supply. <b>...And Hold It:</b> at the end of a chapter, 1 for each Monopoly you have.",
            ask: [{ text: "How many Monopolies did it gain from the supply this chapter?", per: 1 }, { text: "How many Monopolies does it have?", per: 1 }] },
        act3: { setup: "Tuck the Economy card (26) under the map: Closed if you're a Regent, Open if an Outlaw. Add Closed & Open Economy (27). Put the War Profiteer marker on Warlord.",
            grand: "Escape the Reach, Content with Your Riches", conditions: ["Have any Monopolies.", "Have at least 2 Monopolies. (After scoring, scrap 1 of your Monopolies and all resources of its type.)"] } },
    4: { act2: { start: startAll(12), setup: "Add Advocate's Demand (13) and Guild Negotiations (14).",
            text: "<b>Connect with the Guilds:</b> at the end of a chapter, 1 for each different Guild suit you have. <b>Improve Your Standing:</b> at the end of a chapter, 1 for each Rival you have more Guild cards than.",
            auto: [{ reason: "different Guild suits (Connect with the Guilds)", amount: player => countGuildSuits(player) },
                { reason: "Rivals with fewer Guild cards (Improve Your Standing)", amount: player => players.filter(other => other !== player && (other.guildCards || []).length < (player.guildCards || []).length).length }] },
        act3: { setup: "Gain Guild Loyalty (24). Add Guild Supremacy (25), with its reminder (26) by the ambition boxes.",
            grand: "Consolidate Guild Supremacy", conditions: ["More different Guild suits than the current chapter.", "Guild cards (with any attached) are more than half the Court."] } },
    5: { act2: { start: startByCount(7, 8, 9), setup: "Gain Librarians (13). Add Knowledge Set Free (14). Shuffle the extra Event card (15) into the action deck (the app adds it). Flip Sleeping Golems Awake.",
            text: "<b>Collect the Galaxy's Knowledge:</b> 2 for each lore card you secure, and 1 each time a Rival gives you a lore card in Negotiations. <b>Build the Largest Collection:</b> at the end of a chapter, 1 for each Rival you have more lore than.",
            ask: [{ text: "How many lore cards did it secure this chapter?", per: 2 }, { text: "How many Rivals does it have more lore than?", per: 1 }] },
        act3: { setup: "Add Golems Sate Their Appetite (21). Flip Sleeping Golems Awake.",
            grand: "Consume Dangerous Lore with the Golems, but Silence Them", conditions: ["At the end of the chapter, you have a Golem and choose to scrap 1 lore card (not Golem Hearth).", "At the end of the chapter, you choose to scrap 1 Golem."] } },
    6: { act2: { start: startByCount(18, 14, 12), setup: "Add Partisan Seizing (16) for everyone, with its reminder (03) by the card play area. Gain People's Hero (17).",
            text: "<b>Show Your Leadership:</b> 1 for each action card you play while you have the initiative. <b>Burnish Your Image:</b> when you clear Outrage with People's Hero, 1 for each Guild card you have.",
            ask: [{ text: "How many action cards did it play while it had the initiative this chapter?", per: 1 }, { text: "If it cleared Outrage with People's Hero: how many Guild cards did it have?", per: 1 }] },
        act3: { setup: "Gain Sower of Division (25).",
            grand: "Form a Dominant Power Bloc", conditions: ["More Guild cards than each Rival.", "Have the initiative marker."] } },
    7: { act2: { start: startAll(30), setup: "Shuffle Command Chaos (13) into the Court deck.",
            text: "<b>Expand the Navy's Holdings:</b> at the end of a chapter, if a Regent, 1 for each planet the Empire controls. <b>Crush the Empire's Foes:</b> while a Regent, 2 for each Outlaw piece taken as a Trophy in battle. <b>Dominate Rival Regents:</b> while a Regent, 2 for each Regent agent you capture.",
            ask: [{ text: "A Regent: how many planets does the Empire control?", per: 1, when: player => isRegent(player) }, { text: "How many Outlaw pieces did it take as Trophies in battle this chapter?", per: 2 }, { text: "How many Regent agents did it capture this chapter?", per: 2 }] },
        act3: { setup: "Add Martial Law (20), with its reminder (21) by the card play area.",
            grand: "Keep the Monopoly on Force", conditions: ["You're a Regent and control at least 9 planets.", "You're a Regent and have more Loyal ships on the map than each Rival."] } },
    8: { act2: { start: startByCount(20, 18, 16), setup: "Take the 5 Ideal markers. Add Set Doctrine (21). Tuck the Doctrine card (22) by the card play area: Zeal up if you have the initiative, otherwise Wisdom. Scrap Pluralistic Faith. Add Doctrinal Faith (23).",
            text: "<b>Develop the Ideals of Your Faith:</b> for each ambition you win that has an Ideal marker, 1 for each Power gained (with city bonus).",
            ask: [{ text: "How much Power did it gain this chapter from ambitions it won with an Ideal marker?", per: 1 }] },
        act3: { setup: "Tuck Dominant Faith (30) in front of Doctrinal Faith. Add Breaking the Faith (31). Flip the Doctrine to the Ideal with more markers (a tie: Wisdom), and put the Ideal markers back as logged.",
            grand: "Guide the Flock", conditions: ["Two ambition markers on ambitions with Ideals.", "All three ambition markers on ambitions with Ideals."] } },

    9: { act2: { start: startAll(8), setup: "Gain a Flagship (a starport on Slipstream Drive and a city on Hull). Gain Uncovering Clues (02). The player to your right secretly writes down a planet (cluster and symbol); give them Clues to the Portal (03), the 6 Clue tokens and the Portal token.",
            text: "<b>Find the Portal:</b> 1 for each Check Clue placed (this can't complete it), and 8 when the Portal token is placed.",
            ask: [{ text: "How many Check Clues were placed this chapter?", per: 1 }, { text: "Was the Portal token placed this chapter? (1 for yes)", per: 8 }] },
        act3: { setup: "Gain Pilgrims (08). Put 1 Seek the Portal (09) on top of the Court deck; tuck 10-11 under Pilgrims with the Portal card. Roll the event die and put a Pilgrim token on each planet of the rolled symbol.",
            grand: "See the Pilgrims Delivered", conditions: ["Control the Portal token.", "More Pilgrims on Pilgrims than the current chapter."] } },
    10: { act2: { start: startAll(14), setup: "Gain a Flagship (fresh starports on Defense Array and Slipstream Drive). Make up 6 Loyal ships besides the Flagship, then scrap 4 Loyal ships. Gain Planting Banners (02), the 8 Banner tokens and Song of the Banner (04). Add Banners of Hegemony (03).",
            text: "<b>Plant Banners of the New Order:</b> at the end of a chapter, 1 for each Banner on the map, and 1 more for each if you won any ambitions.",
            ask: [{ text: "How many Banners are on the map?", per: player => getAmbitionsWonThisChapter(player) > 0 ? 2 : 1 }] },
        act3: { setup: "Gain Happy Hosts (12).",
            grand: "Form One Body, One Mind", conditions: ["No Rival won Tyrant.", "More Banners on the map than the current chapter."] } },
    11: { act2: { start: startAll(12), setup: "Gain a Flagship (a fresh starport on Slipstream Drive). Gain Sycophants (02) and Hammer Fragments (03), with Planet Hammer (04) and 5 Refugees (05-09) under it. Roll the event die and put a Hammer Fragment on each planet of the rolled symbol.",
            text: "<b>Repair the Planet Hammer:</b> 1 for each Fragment taken from the map. <b>Crush a Planet into Dust:</b> 6 when you use Break World and flip a Hammer token.",
            ask: [{ text: "How many Hammer Fragments did it take from the map this chapter?", per: 1 }, { text: "Did it use Break World and flip a Hammer token? (1 for yes)", per: 6 }] },
        act3: { setup: "Put the pieces back on the Breaking Worlds. Remember: Broken World tokens make everyone Provoke Outrage.",
            grand: "Break the Worlds of the Reach", conditions: ["No Rival won Warlord, and every player has Outrage.", "No Rival won Warlord, and more buildings on Breaking Worlds than the current chapter, or no buildings on the map."] } },
    12: { act2: { start: startByCount(24, 21, 18), setup: "Gain a Flagship (fresh starports on Tractor Beam and Defense Array). Gain Pirate Hoard (02) and Pirate Fleet (03). Place 1 ship on the gate of each cluster with no Loyal ships.",
            text: "<b>Grow Your Hoard:</b> at the end of a chapter, 1 for each resource on the Hoard. <b>Embarrass Your Rivals:</b> at the end of a chapter, 2 for each resource type the Hoard has more of than each Rival.",
            ask: [{ text: "How many resources are on its Hoard?", per: 1 }, { text: "How many resource types does its Hoard have more of than each Rival?", per: 2 }] },
        act3: { setup: "Shuffle 2 Rumors Spread (09-10) into the Court deck. Place 2 True and 2 False Rumor tokens face down (the True ones mark the Haven's cluster and planet symbol). Add Rumors of the Haven (11) and Sharing Rumors (12). At the end of Act III, Rivals guess the Haven's planet: a right guess is +10 for them and -10 for the Pirate; no right guess is +10 for the Pirate.",
            grand: "Laugh at Your Rivals' Folly", conditions: ["The Hoard has 2+ resources, and you truthfully declare no Rival pieces are in the Haven's system.", "The Hoard has 2+ resources, and you truthfully declare one of your pieces is there."] } },
    13: { act2: { start: startByCount(18, 16, 14), setup: "Gain Spore Ships (02). Scrap 2 Loyal ships, then make up 8 Loyal ships on the map.",
            text: "<b>Contact an Ancient Intelligence:</b> for each ambition you win, 1 for each Blight in systems with your ships. <b>Spread the Spores:</b> 1 each time you place Blight with Spore Ships.",
            ask: [{ text: "How many Blight are in systems with its ships? (Counted once for each ambition it won.)", per: player => getAmbitionsWonThisChapter(player), when: player => getAmbitionsWonThisChapter(player) > 0 },
                { text: "How many Blight did it place with Spore Ships this chapter?", per: 1 }] },
        act3: { setup: "Gain Blight Hunger (13).",
            grand: "Gorge the Blight with Bodies", conditions: ["No Rival wins Warlord.", "Blight Hunger has more pieces than the current chapter."] } },
    14: { act2: { start: startByCount(16, 14, 12), setup: "Clear all your Outrage. Gain Witnesses (02) and Well of Empathy (03). Put a Witness token on each Weapon planet (spyglass side up). Make up 8 Loyal ships.",
            text: "<b>Commit to Pacifism:</b> at the end of a chapter, 2 if you have no Trophies, and 1 if you have no Captives. <b>Spread Empathy:</b> 1 for each Psionic spent in your Prelude while Empath is declared.",
            auto: [{ reason: "no Trophies (Commit to Pacifism)", amount: player => player.trophiesValue == 0 ? 2 : 0 }, { reason: "no Captives (Commit to Pacifism)", amount: player => player.captivesValue == 0 ? 1 : 0 }],
            ask: [{ text: "How many Psionics did it spend in its Preludes while Empath was declared this chapter?", per: 1 }] },
        act3: { setup: "Add Empathy for All (09), with its reminder (10) by the card play area. Add Reconcile with the Outraged (11) and Rebuke of the Empaths (12).",
            grand: "Demonstrate Nonviolence", conditions: ["No Trophies or Captives.", "Rivals together have more Psionics than you."] } },
    15: { act2: { start: startByCount(18, 16, 14), setup: "With 2 players, return the Weapons on Warlord. Clear all your Outrage, then Provoke Outrage of Weapons. Gain Oath of Peace (02) and Arsenal Keepers (03). Make up 8 Loyal ships.",
            text: "<b>Restrict the Weapons Supply:</b> at the end of a chapter, 1 for each Weapon you have. <b>Control the Arms Manufacturers:</b> at the end of a chapter, 1 for each Weapon planet you control.",
            auto: [{ reason: "Weapons held (Restrict the Weapons Supply)", amount: player => player.weaponsValue }],
            ask: [{ text: "How many Weapon planets does it control?", per: 1 }] },
        act3: { setup: "Put a Ceasefire token in each cluster (Peace side up if you control any system there). With 2 players, return the Weapons on Warlord. Add Ceasefires (08), Empire Balks at Peace (09), Peace Dividends (10) and Peace Accords (11).",
            grand: "A Peaceful Reach", conditions: ["2 or more clusters at Peace.", "5 or more clusters at Peace."] } },
    16: { act2: { start: startAll(22), setup: "Take the 6 Seat tokens (1st-6th). Gain Claims of Nobility (02). Put the 6 Lord titles (03-08) in the supply. Add Seats & Fiefs (09) and Feudal Law (10). Make up 8 Loyal ships.",
            text: "<b>Control the Fiefs' Seats:</b> at the end of a chapter, 2 for each Seat you control. <b>Lord Over the Fiefs:</b> at the end of a chapter, 1 for each city in Fiefs you're Lord of.",
            ask: [{ text: "How many Seats does it control?", per: 2 }, { text: "How many cities are in Fiefs it's Lord of (Free and Seat cities too)?", per: 1 }] },
        act3: { setup: "Put the 6 Court tokens (1st-6th) by the Court. Add Feudal Courts (18) and Lords Gain Power (19).",
            grand: "Return to the Old Ways", conditions: ["Lord of more Fiefs than each Rival.", "Control more Seats than the current chapter."] } },

    17: { act3: { start: startAll(20), setup: "With a Flagship, you may Resettle. Gain Sycophants (02). Add Reach Rejects Overlord (03). With no Outrage, you may Provoke Outrage once to place 2 ships at a planet of that type.",
            text: "<b>Rule by Fear Alone:</b> at the end of a chapter, 1 for each resource type you have that matches your Outrage. <b>Control by Fear Alone:</b> at the end of a chapter, 2 for each planet type you control that matches your Outrage.",
            auto: [{ reason: "resource types held that match its Outrage (Rule by Fear Alone)", amount: player => (player.outraged || []).filter(resource => player[resource + "Value"] > 0).length }],
            ask: [{ text: "How many planet types does it control that match its Outrage?", per: 2 }] } },
    18: { act3: { start: startByCount(22, 18, 14), setup: "You may Resettle. Gain Vow of Survival (02), Building Bunkers (03) and the 9 Bunker tokens. Add Bunkers (04) and Captive Release (05).",
            text: "<b>Keep the People Safe:</b> for each ambition you win, 1 for each Captive or each Bunker, whichever is lower. <b>Protect Against the Blight:</b> 1 each time a Blight Crisis happens at a planet with a Bunker.",
            ask: [{ text: "The lower of its Captives and its Bunkers? (Counted once for each ambition it won.)", per: player => getAmbitionsWonThisChapter(player), when: player => getAmbitionsWonThisChapter(player) > 0 },
                { text: "How many Blight Crises happened at planets with a Bunker this chapter?", per: 1 }] } },
    19: { act3: { start: startByCount(16, 14, 12), setup: "You may Resettle. Provoke Relic Outrage. Gain Ire of the Keepers (02). Add Rebuke of the Keepers (03). Put Relic Fence (04) on top of the Court deck. With 2 players, return the Relics on Keeper.",
            text: "<b>Subdue the Keepers:</b> after scoring, if you won Keeper or it wasn't declared, 3. <b>Shatter the Relics:</b> after scoring, if you won any ambitions, scrap any Relics you have, 2 for each.",
            auto: [{ reason: "won Keeper, or it wasn't declared (Subdue the Keepers)", amount: player => getCampaignPlayer(player).keeperSubdued ? 3 : 0 }],
            ask: [{ text: "It won an ambition: how many Relics did it scrap?", per: 2, when: player => getAmbitionsWonThisChapter(player) > 0 }] } },
    20: { act3: { start: startByCount(20, 18, 16), setup: "You may Resettle. Provoke Outrage of Fuel and Material. With 2 players, return the Material and Fuel on the ambition boxes. Put the Edenguard ambition tile by Tycoon. Gain Green Vault (02) and Ire of the Tycoons (03). Add Edenguard Ambition (04).",
            text: "<b>Give Back to the Land:</b> at the end of a chapter, if you win Tyrant or it's not declared, 1 for each Material or Fuel in your Captives. <b>Guard the Reach's Splendor:</b> at the end of a chapter, if you win Edenguard or it's not declared, 1 for each Material and Fuel planet you control.",
            ask: [{ text: "If it won Tyrant or Tyrant wasn't declared: how many Material and Fuel are in its Captives?", per: 1 }, { text: "If it won Edenguard or Edenguard wasn't declared: how many Material and Fuel planets does it control?", per: 1 }] } },
    21: { act3: { start: startByCount(18, 16, 14), setup: "You may Resettle. Gain Blight Society (02) and Spore Guides (03). Put the Blightkin ambition tile by Empath. Add Blightkin Ambition (04).",
            text: "<b>Live in the Garden:</b> at the end of a chapter, if you win Blightkin or it's not declared, 1 for each system you control with fresh Blight.",
            ask: [{ text: "If it won Blightkin or Blightkin wasn't declared: how many systems does it control with fresh Blight?", per: 1 }] } },
    22: { act3: { start: startByCount(24, 21, 18), setup: "You may Resettle. Gain Catapult Overdrive (02) and Breaking Gates & Placing Passages (03); put a Passage token on any gate (step 3 of card 03). Roll the event die and put it in the middle of the map. Place The Dead Live (04). Add Passages & the Twisted Passage (05). Put Passage Storms (06) on top of the Court deck.",
            text: "<b>Collapse the Gates:</b> for each ambition you win, 1 for each Passage token on the map. <b>Control the Twisted Passage:</b> at the end of a chapter, before scoring, 1 for each Passage token if you control the Twisted Passage.",
            ask: [{ text: "How many Passage tokens are on the map? (Counted once for each ambition it won.)", per: player => getAmbitionsWonThisChapter(player), when: player => getAmbitionsWonThisChapter(player) > 0 },
                { text: "If it controlled the Twisted Passage before scoring: how many Passage tokens?", per: 1 }] } },
    23: { act3: { start: startByCount(12, 9, 6), setup: "You may Resettle. Gain Farseers (02), the 8 Conspiracy tokens (2 in each colour) and Conspiracies (03). Add Scoring Conspiracies (04) and Foiling Conspiracies (05).",
            text: "<b>Control the Proceedings:</b> when scoring, 1 for each correct revealed Conspiracy and each unrevealed one.",
            // A bot Conspirator's are counted by the app (grand.js)
            ask: [{ text: "How many Conspiracies were correct when revealed, or are unrevealed?", per: 1, when: player => player.isHuman }] } },
    24: { act3: { start: startAll(6), setup: "You may Resettle. Gain Vow of Fairness (02), The Arbiter (03) and Judge's Chosen (04). Add Judge Sets Agenda (05).",
            text: "<b>Balance the Reach:</b> at the end of a chapter, 1 for each ambition where players are tied for first.",
            auto: [{ reason: "ambitions tied for first (Balance the Reach)", amount: () => campaign.tiesForFirst || 0 }] } }
};

function getLaterFate(number, act) {
    const entry = laterFates[number];
    return entry == null ? null : entry["act" + act];
}

function getLaterObjectiveStart(fate, act) {
    // Act II: every "A" and "B" Fate. Act III: only "C" Fates, a final objective
    const data = getLaterFate(fate.number, act);
    return (data != null && data.start != null) ? data.start[players.length] : null;
}

function getFateSetupText(fate, act) {
    if (act == 1) { return fate.setup || ""; }
    const data = getLaterFate(fate.number, act);
    return data != null ? data.setup : "";
}

function getFateObjectiveText(fate, act) {
    if (act == 1) { return fate.objective != null ? fate.objective.text : ""; }
    const data = getLaterFate(fate.number, act);
    if (data == null) { return ""; }
    if (data.grand != null) { return "<b>Grand ambitions, " + data.grand + ":</b> (1) " + data.conditions[0] + " (2) " + data.conditions[1]; }
    return data.text;
}

// What happens during scoring, for the Act II and III objectives

registerCampaignHook("ambitionsScored", results => {
    if (campaign.act == 1) { return undefined; }
    players.forEach(player => {
        const state = getCampaignPlayer(player);
        state.ambitionsWon = (state.ambitionsWon || 0) + results.filter(result => result.player === player && result.place == 1).length;
        // The Redeemer: it won Keeper, or Keeper wasn't declared
        const keeper = results.filter(result => result.ambition == "keeper");
        state.keeperSubdued = keeper.length == 0 || keeper.some(result => result.player === player && result.place == 1);
    });
    // The Judge: ambitions with a tie for first (no one placed first, and two or more placed second)
    const scored = [...new Set(results.map(result => result.ambition))];
    campaign.tiesForFirst = scored.filter(ambition => {
        const forAmbition = results.filter(result => result.ambition == ambition && !result.player.isNeutral);
        return !forAmbition.some(result => result.place == 1) && forAmbition.filter(result => result.place == 2).length >= 2;
    }).length;
    return undefined;
});

function applyLaterAutoObjectives() {
    // At the end of a chapter in Acts II and III, what the app can count
    if (campaign.act == 1) { return; }
    players.forEach(player => {
        const state = getCampaignPlayer(player);
        const data = getLaterFate(state.fate, campaign.act);
        if (data == null || state.objective == null || state.objective == 0) { return; }
        (data.auto || []).forEach(auto => {
            const amount = auto.amount(player);
            if (amount > 0) { advanceObjective(player, amount, amount + " " + auto.reason); }
        });
    });
}

function getLaterChapterQuestions() {
    if (campaign.act == 1) { return []; }
    const questions = [];
    players.forEach(player => {
        const state = getCampaignPlayer(player);
        const data = getLaterFate(state.fate, campaign.act);
        if (data == null) { return; }
        if (data.grand != null) {
            // Act III "A" and "B" Fates: their grand ambitions, scored with the ambitions
            const power = grandAmbitionPower[roundNumber] || grandAmbitionPower[4];
            questions.push({ player: player, grand: true, max: 2, text: "<b>" + data.grand + ":</b> how many grand ambitions did it fulfil? (1) " + data.conditions[0] + " (2) " + data.conditions[1]
                + " One is " + power[0] + " Power, both " + power[1] + ".", reason: "grand ambitions" });
            return;
        }
        if (state.objective == null || state.objective == 0) { return; }
        (data.ask || []).filter(ask => ask.when == null || ask.when(player)).forEach(ask => {
            const per = typeof ask.per == "function" ? ask.per(player) : ask.per;
            questions.push({ player: player, text: ask.text + (per != 1 ? " (" + per + " each)" : ""), reason: ask.text.replace(/\?.*$/, "").replace(/^.*: /, "").toLowerCase(), multiplier: per });
        });
    });
    return questions;
}

function applyGrandAmbitions(player, fulfilled) {
    if (fulfilled == 0) { return; }
    const power = (grandAmbitionPower[roundNumber] || grandAmbitionPower[4])[Math.min(fulfilled, 2) - 1];
    setPlayerPower(player, player.powerValue + power);
    showMessageToast("Player " + player.number + ": grand ambitions", (fulfilled == 1 ? "One" : "Both") + " fulfilled: +" + power + " Power");
}

function resetChapterCounts() {
    players.forEach(player => { const state = getCampaignPlayer(player); state.ambitionsWon = 0; state.keeperSubdued = false; });
    campaign.tiesForFirst = 0;
}
