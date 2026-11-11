// Leaders & Lore (#88, rulebook p.21): the cards, the draft at the start of a game, setting each
// player up from their Leader, and the Leader and Lore chips on their panel.
// Part 1: setup only. The cards' powers aren't yet in the bots' logic, scoring or battles.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// Each Leader's powers, starting resources and starting pieces in its A, B and C systems
// (buildings and ships), as confirmed card by card. setup is anything else done in setup
const leaderCards = [
    { number: 1, name: "Elder", resources: ["relics", "materials"], pieces: [["city", 3], ["starport", 3], [null, 2]], powers: [
        ["Beloved", "After defending in <b>battle</b>, you may influence if the attacker took any Trophies. Rivals cannot Ransack the Court when they <b>battle</b> you."],
        ["Just", "When you're <b>scoring</b> Tyrant, gain no Power for second place, and gain Power for second place if you get first place. (Don't get bonus city Power.)"]] },
    { number: 2, name: "Mystic", resources: ["psionics", "relics"], pieces: [["city", 3], ["starport", 3], [null, 2]], outraged: ["materials", "fuel"], powers: [
        ["Attuned", "When you Copy or Pivot in order to <b>tax</b>, you gain 1 Psionic along with the taxed resource."],
        ["Cryptic", "In <b>setup</b>, place agents on your Material and Fuel Outrage slots on your player board."]] },
    { number: 3, name: "Fuel-Drinker", resources: ["fuel", "fuel"], pieces: [["city", 3], ["starport", 3], [null, 2]], powers: [
        ["Insatiable", "When you Copy or Pivot in order to <b>tax</b>, you gain 1 Fuel along with the taxed resource."],
        ["Lavish", "After <b>scoring</b>, you must discard all of your Fuel if the Tycoon ambition was scored."]] },
    { number: 4, name: "Upstart", resources: ["psionics", "materials"], pieces: [["city", 4], ["starport", 3], [null, 2]], powers: [
        ["Ambitious", "When you <b>declare an ambition</b>, you may gain any resource. (You must declare the ambition before taking any actions, including Prelude actions from resources.)"],
        ["Callow", "You can only <b>tax</b> Loyal cities if you control them."]] },
    { number: 5, name: "Rebel", resources: ["materials", "weapons"], pieces: [["city", 4], [null, 4], [null, 2]], powers: [
        ["Committed", "In <b>battle</b>, you collect 2 extra dice."],
        ["Disorganized", "You cannot <b>move</b> more than 2 ships at a time."]] },
    { number: 6, name: "Warrior", resources: ["weapons", "materials"], pieces: [["city", 3], ["starport", 3], [null, 2]], powers: [
        ["Tactical", "When you Copy or Pivot to <b>battle</b>, you may move before or after you battle. (You may do this even if you spent a Weapon to let you battle.)"],
        ["Violent", "When you're <b>scoring</b> Empath, gain no Power for second place, and gain Power for second place if you get first place. (Don't get bonus city Power.)"]] },
    { number: 7, name: "Feastbringer", resources: ["relics", "materials"], pieces: [["city", 3], ["city", 3], [null, 3]], powers: [
        ["Charismatic", "When you Copy or Pivot in order to <b>secure</b> a card, you may influence before or after you secure."],
        ["Generous", "To <b>declare an ambition</b>, you must give 1 Guild card to your Rival with the least Power."]] },
    { number: 8, name: "Demagogue", resources: ["psionics", "weapons"], pieces: [["city", 3], ["starport", 3], [null, 2]], powers: [
        ["Bold", "When you <b>declare an ambition</b>, you may influence any number of cards in the Court once."],
        ["Paranoid", "You cannot <b>secure</b> Guild cards with only 1 Loyal agent on them. (You can secure Vox cards as normal.) Ignore this if you Ransack the Court."]] },
    { number: 9, name: "Archivist", resources: ["relics", "relics"], pieces: [["city", 3], ["city", 3], [null, 2]], extraLore: true, powers: [
        ["Learned", "After <b>setup</b>, gain 2 extra Lore cards: draw 5 Lore, keep 2, and scrap the other 3 (returning them to the box)."],
        ["Academic", "When you're <b>scoring</b> Tycoon, gain no Power for second place, and gain Power for second place if you get first place. (Don't get bonus city Power.)"]] },
    { number: 10, name: "Overseer", resources: ["fuel", "materials"], pieces: [["city", 3], ["starport", 3], [null, 2]], powers: [
        ["Ruthless", "Once per turn, when you <b>tax</b> any city or <b>build</b> a ship at a starport, you may hit the building to take that action again with it. If you destroy a Loyal city, you Provoke Outrage. (If you destroy a Rival city, Provoke Outrage and Ransack the Court.)"],
        ["Hated", "In <b>setup</b>, scrap 2 Loyal ships and 3 Loyal agents. (Return them to the box.)"]] },
    { number: 11, name: "Corsair", resources: ["fuel", "weapons"], pieces: [["starport", 3], [null, 3], [null, 2]], powers: [
        ["Tricky", "When attacking in <b>battle</b>, you may reroll raid dice up to the number of different resources you have."],
        ["Wary", "When attacking in <b>battle</b>, you cannot collect more assault dice than skirmish dice."]] },
    { number: 12, name: "Noble", resources: ["psionics", "psionics"], pieces: [["city", 3], ["starport", 3], [null, 2]], powers: [
        ["Connected", "When you <b>declare an ambition</b> that's not declared, draw and secure the top card of the Court deck. (You can't use its Prelude action now.)"],
        ["Influential", "When you Copy or Pivot to <b>influence</b>, you may influence twice."],
        ["Proud", "When <b>scoring</b>, you only gain Power if you get first place (not tied)."]] },
    { number: 13, name: "Anarchist", resources: ["relics", "weapons"], pieces: [[null, 4], [null, 3], [null, 2]], scrappedCities: 2, powers: [
        ["Decentralized", "In <b>setup</b>, scrap your 2 leftmost cities from your player board."],
        ["Inspiring", "In systems with Loyal ships, you may <b>tax</b> Rival cities ignoring control, and you may tax empty building slots like Loyal cities."],
        ["Principled", "You cannot <b>tax</b> Loyal cities. (Remember, if you have no buildings on the map, Rivals can raid your ships!)"]] },
    { number: 14, name: "Shaper", resources: ["relics", "materials"], pieces: [["city", 3], [null, 3], [null, 3]], powers: [
        ["Mythic", "When you <b>tax</b> a city, you may place 1 resource you have over the planet's resource icon. From now on, its planet type is the placed resource, and its planet type cannot be changed again with Mythic."],
        ["Ancient", "You cannot Catapult <b>move</b> from starports, but you can Catapult move from gates."]] },
    { number: 15, name: "Agitator", resources: ["fuel", "materials"], pieces: [["city", 3], ["starport", 4], [null, 2]], powers: [
        ["Firebrand", "When you Copy or Pivot in order to <b>tax</b>, you gain 1 Weapon along with the taxed resource."],
        ["Irregular", "If a Rival attacks you in <b>battle</b> and rolls an intercept, they do not take hits from fresh defending ships. Instead, they take 1 hit per Weapon icon you have from cards and resources, then you discard 1 Weapon resource you have."]] },
    { number: 16, name: "Quartermaster", resources: ["fuel", "weapons"], pieces: [["starport", 4], [null, 3], [null, 2]], outraged: ["materials"], powers: [
        ["Resilient", "After any <b>battle</b> with you, repair 1 Loyal ship in the battle system per starport on the map you control. (Even Rival ones!)"],
        ["Greedy", "In <b>setup</b>, place an agent on your Material Outrage slot."]] }
];

// The Lore cards: their text, and what they're about in a few words for the draft
const loreCards = [
    { number: 1, name: "Tool-Priests", tags: "Summon (Build)", text: "<b>Summon (Build):</b> Once per turn, build 1 ship at <i>any</i> city you control. <i>Yes, even Rival cities you control!</i>" },
    { number: 2, name: "Galactic Rifles", tags: "Fire Rifles (Battle)", text: "<b>Fire Rifles (Battle):</b> Like in a battle, choose a system and collect <i>skirmish</i> dice for fresh Loyal ships there, choose a defender in an adjacent system, roll the collected dice, and deal 1 hit to the defender per hit rolled. (Hit ships before buildings.)" },
    { number: 3, name: "Sprinter Drives", tags: "Move", text: "When you <b>move</b> fresh Loyal ships, you may move any of them one more time. (Damaged ships can move with them once, but won't move one more time. Resolve this after all Catapult moves.)" },
    { number: 4, name: "Mirror Plating", tags: "Battle", text: "When you defend in <b>battle</b>, add 1 intercept to the attacker's roll if they rolled any number of assault dice." },
    { number: 5, name: "Hidden Harbors", tags: "Build · Battle", text: "You always <b>build</b> ships fresh. When defending in <b>battle</b>, the attacker cannot collect raid dice if you have a fresh defending starport." },
    { number: 6, name: "Signal Breaker", tags: "Battle", text: "When attacking in <b>battle</b>, if all attacking ships are fresh at the start of the battle, you ignore 1 intercept you roll." },
    { number: 7, name: "Repair Drones", tags: "Battle", text: "After you <b>battle</b> as the attacker, repair 1 Loyal attacking ship." },
    { number: 8, name: "Gate Ports", tags: "Build · Move", text: "You may <b>build</b> starports on gates, max 1 per gate. When Rival ships take a <b>move</b> into a gate you control with a fresh Loyal starport, capture 1 agent of that Rival." },
    { number: 9, name: "Cloud Cities", tags: "Build", text: "You may <b>build</b> cities on planets outside their building slots, max 1 per planet. This costs 1 resource of the planet type." },
    { number: 10, name: "Living Structures", tags: "Nurture (Build) · Prune (Repair)", text: "<b>Nurture (Build):</b> Tax a Loyal city.<br><b>Prune (Repair):</b> Replace a Loyal starport with a Loyal city or vice versa." },
    { number: 11, name: "Gate Stations", tags: "Build", text: "You may <b>build</b> cities on gates, max 1 per gate. A gate city's type matches all cities in its cluster. (Players may tax it for 1 resource of any of those cities. If it is destroyed, Provoke Outrage of all those city types.)" },
    { number: 12, name: "Railgun Arrays", tags: "Battle", text: "When defending in <b>battle</b>, before the attacker collects dice, they must take 1 hit if any Loyal defending ships are fresh." },
    { number: 13, name: "Ancient Holdings", tags: "Resources", text: "This card has one resource slot with a raid cost of 4 keys. (You can hold one resource here. It adds to your ambitions. You can spend it.)" },
    { number: 14, name: "Seeker Torpedoes", tags: "Battle", text: "When attacking in <b>battle</b>, after rolling dice, you may reroll up to 1 assault die for each fresh Loyal attacking ship." },
    { number: 15, name: "Predictive Sensors", tags: "Battle", text: "When defending in <b>battle</b>, before the attacker collects dice, you may move any number of fresh Loyal ships from systems adjacent to the battle system into it." },
    { number: 16, name: "Force Beams", tags: "Guide (Move)", text: "<b>Guide (Move):</b> Move any number of <i>any</i> ships (even if not Loyal) from a system with a fresh Loyal starport to an adjacent system, or vice versa, ignoring <b>move</b> modifiers in play areas." },
    { number: 17, name: "Raider Exosuits", tags: "Battle", text: "When attacking in <b>battle</b>, if there are no defending buildings, you may collect up to 1 raid die. (This is not an extra die. Follow the limit of 1 die per ship.)" },
    { number: 18, name: "Survival Overrides", tags: "Martyr (Move)", text: "<b>Martyr (Move):</b> Destroy 1 fresh Loyal ship on the map to destroy 1 ship that is not Loyal in its system, taking it as a Trophy. (Your Loyal ship does not become a Trophy.)" },
    { number: 19, name: "Empath's Vision", tags: "While Empath is declared · Prelude", text: "<b><i>While Empath is declared,</i></b> if you roll <i>any</i> dice (even outside battle), you may reroll any number of them once.<br><b>Prelude:</b> You may discard this to clear your Psionic Outrage." },
    { number: 20, name: "Empath's Bond", tags: "While Empath is declared", text: "<b><i>While Empath is declared,</i></b> you may <b>tax</b> <i>any</i> cities, and <b>build</b> ships and Catapult <b>move</b> with <i>any</i> starports, like they are Loyal. (Don't take Captives. Build ships damaged in Rival-controlled systems.)" },
    { number: 21, name: "Keeper's Trust", tags: "While Keeper is declared · Prelude", text: "<b><i>While Keeper is declared,</i></b> Rivals cannot steal resources from you that are the same as resources they have already.<br><b>Prelude:</b> You may discard this to clear your Relic Outrage." },
    { number: 22, name: "Keeper's Solidarity", tags: "While Keeper is declared", text: "<b><i>While Keeper is declared,</i></b> Rivals cannot steal Guild cards from you while you have any resources of the same type. (If you have both Relics and Sworn Guardians, neither can be stolen!)" },
    { number: 23, name: "Warlord's Cruelty", tags: "While Warlord is declared · Prelude", text: "<b><i>While Warlord is declared,</i></b> you may <b>tax</b> cities that you already taxed this turn.<br><b>Prelude:</b> You may discard this to clear your Weapon Outrage." },
    { number: 24, name: "Warlord's Terror", tags: "While Warlord is declared", text: "<b><i>While Warlord is declared,</i></b> you may spend Trophies in your Prelude, returning them, to influence once for each." },
    { number: 25, name: "Tyrant's Ego", tags: "While Tyrant is declared · Prelude", text: "<b><i>While Tyrant is declared,</i></b> you may spend Captives in your Prelude, returning them, to secure once for each.<br><b>Prelude:</b> You may discard this to clear your Weapon Outrage." },
    { number: 26, name: "Tyrant's Authority", tags: "Annex (Build)", text: "<b>Annex (Build):</b> <b><i>While Tyrant is declared,</i></b> replace <i>any</i> city or starport you control with a Loyal city or starport, respectively. (Cities return to player boards.)" },
    { number: 27, name: "Tycoon's Ambition", tags: "While Tycoon is declared · Prelude", text: "<b>Prelude:</b> <b><i>While Tycoon is declared,</i></b> before taking any other actions, you may discard all of your Material and Fuel to declare exactly 1 undeclared ambition. Do not place the zero marker. (You may do this just after declaring Tycoon.)" },
    { number: 28, name: "Tycoon's Charm", tags: "While Tycoon is declared · Prelude", text: "<b>Prelude:</b> <b><i>While Tycoon is declared,</i></b> you may discard any number of Material and Fuel to gain 1 resource for each.<br><b>Prelude:</b> You may discard this to clear your Material and Fuel Outrage." }
];

// Whether this game uses Leaders & Lore (saved with the game)
let leadersAndLore = false;
// The draft in progress: { rows: { leader, lore }, order, round, turn, picks: [{ player, kind, number }] }
let leaderDraft = null;
// The card open in the draft window, as "leader:3" or "lore:12"
let draftOpenCard = null;

const draftKinds = { leader: "Leader", lore: "Lore" };

function getLeaderCard(number) { return leaderCards.find(card => card.number == number); }
function getLoreCard(number) { return loreCards.find(card => card.number == number); }
function getDraftCard(kind, number) { return kind == "leader" ? getLeaderCard(number) : getLoreCard(number); }

function shuffledNumbers(cards) {
    return shuffleCards(cards.map(card => card.number));
}

function chooseStartingPlayer(numberOfPlayers) {
    // A random player starts with the initiative (rulebook p.4, setup step B)
    return 1 + Math.floor(Math.random() * numberOfPlayers);
}

function getTurnOrder() {
    // Starting with the player who has the initiative, then clockwise
    let order = [getPlayerWithInitiative()];
    while (order.length < players.length) { order.push(getNextPlayer(order[order.length - 1].number)); }
    return order;
}

// The draft (rulebook p.21)

function startLeaderDraft() {
    // Rows of players + 1 Leaders and Lore cards. Picks go in reverse turn order, starting with
    // the player to the right of whoever has the initiative, until everyone has one of each
    const size = players.length + 1;
    leaderDraft = {
        rows: { leader: shuffledNumbers(leaderCards).slice(0, size), lore: shuffledNumbers(loreCards).slice(0, size) },
        order: getTurnOrder().slice(1).reverse().concat(getPlayerWithInitiative()).map(player => player.number),
        round: 1, turn: 0, picks: []
    };
    continueLeaderDraft();
}

function getDraftPicks(playerNumber) {
    return leaderDraft.picks.filter(pick => pick.player == playerNumber);
}

function needsDraftKind(playerNumber, kind) {
    return !getDraftPicks(playerNumber).some(pick => pick.kind == kind);
}

function isDraftCardTaken(kind, number) {
    return leaderDraft.picks.some(pick => pick.kind == kind && pick.number == number);
}

function takeDraftCard(playerNumber, kind, number) {
    leaderDraft.picks.push({ player: playerNumber, kind: kind, number: number, round: leaderDraft.round });
    leaderDraft.turn++;
    if (leaderDraft.turn >= leaderDraft.order.length) { leaderDraft.turn = 0; leaderDraft.round++; }
    saveSettingObject("leaderDraft", leaderDraft);
}

function botDraftPick(playerNumber) {
    // A card it still needs, at random. Needing both, either kind
    const kinds = Object.keys(draftKinds).filter(kind => needsDraftKind(playerNumber, kind));
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const left = leaderDraft.rows[kind].filter(number => !isDraftCardTaken(kind, number));
    takeDraftCard(playerNumber, kind, left[Math.floor(Math.random() * left.length)]);
}

function continueLeaderDraft() {
    // Bots pick until it's the human player's turn or everyone has one of each
    while (leaderDraft.round <= 2) {
        const player = getPlayer(leaderDraft.order[leaderDraft.turn]);
        if (player.isHuman) { showLeaderDraft(); return; }
        botDraftPick(player.number);
    }
    finishLeaderDraft();
}

function getResourceChips(resources) {
    return resources.map(resource => "<span class=\"resourcechip\">" + preludeResourceNames[resource] + "</span>").join("");
}

function getStartingPiecesText(card) {
    // e.g. "a city + 3 ships, a starport + 3 ships, and 2 ships"
    const parts = card.pieces.map(([building, ships]) => (building ? "a " + building + " + " : "") + ships + " ships");
    return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

function getDraftCardText(kind, card) {
    if (kind == "lore") { return "<p>" + card.text + "</p>"; }
    return card.powers.map(([name, text]) => "<p><i>" + name + ".</i> " + text + "</p>").join("")
        + "<p class=\"small text-muted mb-0\">Starts with " + getStartingPiecesText(card) + ".</p>";
}

function showLeaderDraft() {
    const human = players[0];
    const order = leaderDraft.order.map(number => number == human.number ? "you" : getPlayerTag(getPlayer(number)));
    const initiative = getPlayerWithInitiative();
    const roundPicks = leaderDraft.picks.filter(pick => pick.round == leaderDraft.round);

    let html = "<div class=\"draftstatus\">"
        + "<div class=\"mb-1\">" + (initiative.isHuman ? "You have" : getPlayerTag(initiative) + " has") + " the initiative, so the draft goes "
        + order.slice(0, -1).join(", ") + ", then " + order[order.length - 1] + ".</div>"
        + roundPicks.map(pick => "<div>" + getPlayerTag(getPlayer(pick.player)) + " took <b>" + getDraftCard(pick.kind, pick.number).name + "</b></div>").join("")
        + "<div class=\"mt-1\"><b>Your pick:</b> " + (leaderDraft.round == 1
            ? "a Leader or a Lore card. You'll get the other kind next round."
            : "your " + (needsDraftKind(human.number, "leader") ? "Leader" : "Lore card") + ".") + "</div></div>";

    Object.keys(draftKinds).forEach(kind => {
        html += "<div class=\"turnlabel mt-2\">" + (kind == "leader" ? "Leaders" : "Lore") + "</div>";
        leaderDraft.rows[kind].forEach(number => {
            const card = getDraftCard(kind, number);
            const taken = leaderDraft.picks.find(pick => pick.kind == kind && pick.number == number);
            const id = kind + ":" + number;
            const open = (id == draftOpenCard && !taken);
            const canTake = needsDraftKind(human.number, kind);
            html += "<div class=\"draftcard" + (taken ? " drafttaken" : "") + (open ? " draftopen" : "") + "\" id=\"draft_" + kind + number + "\""
                + (taken ? "" : " onclick=\"openDraftCard('" + id + "')\"") + ">"
                + "<div class=\"draftcardhead\"><b>" + card.name + "</b>" + (taken ? getPlayerTag(getPlayer(taken.player)) : (kind == "leader" ? getResourceChips(card.resources) : "")) + "</div>"
                + "<div class=\"draftcardsub\">" + (kind == "leader" ? card.powers.map(power => power[0]).join(" &middot; ") : card.tags) + "</div>"
                + (open ? "<div class=\"draftcardtext\">" + getDraftCardText(kind, card) + "</div>"
                    + (canTake ? "<button type=\"button\" class=\"btn btn-primary btn-sm w-100\" id=\"draftTake\" onclick=\"event.stopPropagation(); humanDraftPick('" + kind + "', " + number + ")\">Take " + card.name + "</button>"
                        : "<div class=\"small text-muted\">You already have a " + draftKinds[kind] + ".</div>") : "")
                + "</div>";
        });
    });

    const modal = document.getElementById("guildModal");
    document.getElementById("guildTitle").innerHTML = "Leaders &amp; Lore: round " + leaderDraft.round;
    const header = modal.querySelector(".modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(human));
    document.getElementById("guildBody").innerHTML = html;
    if (!modal.classList.contains("show")) { bootstrap.Modal.getOrCreateInstance(modal).show(); }
}

function openDraftCard(id) {
    draftOpenCard = (draftOpenCard == id) ? null : id;
    showLeaderDraft();
}

function humanDraftPick(kind, number) {
    draftOpenCard = null;
    takeDraftCard(players[0].number, kind, number);
    continueLeaderDraft();
}

function finishLeaderDraft() {
    // Everyone has one of each: set each player up from their Leader
    leaderDraft.picks.forEach(pick => {
        const player = getPlayer(pick.player);
        if (pick.kind == "leader") { player.leader = pick.number; } else { player.lore = (player.lore || []).concat(pick.number); }
    });
    players.forEach(player => applyLeaderSetup(player));
    leaderDraft = null;
    RemoveSettingByKey("leaderDraft");
    SaveAllSettings();

    // The Archivist gains 2 extra Lore cards
    const archivist = players.find(player => getLeaderCard(player.leader).extraLore);
    const modal = document.getElementById("guildModal");
    const next = () => (archivist != null) ? offerArchivistLore(archivist) : showSetUpPlayers();
    if (modal.classList.contains("show")) {
        modal.addEventListener('hidden.bs.modal', next, { once: true });
        bootstrap.Modal.getOrCreateInstance(modal).hide();
    } else {
        next();
    }
}

function applyLeaderSetup(player) {
    // Starting resources, ships, cities still to place and Outrage, from the Leader
    const card = getLeaderCard(player.leader);
    const setValue = (counter, value) => {
        player[counter + "Value"] = value;
        const input = document.getElementById(counter + "Value_" + player.number);
        if (input != null) { input.value = value; }
    };
    preludeResources.forEach(resource => setValue(resource, card.resources.filter(held => held == resource).length));
    setValue("shipsBoard", card.pieces.reduce((total, [, ships]) => total + ships, 0));
    player.startingCity = card.pieces.filter(([building]) => building == "city").length;
    player.scrappedCities = card.scrappedCities || 0;
    player.outraged = (card.outraged || []).slice();
    const total = document.getElementById("citiestotal" + player.number);
    if (total != null) { total.innerHTML = getCityCount(player); }
    showGuildCardsRow(player);
}

// The Archivist (Learned): draw 5 Lore cards nobody holds, keep 2

let archivistChoice = null;

function offerArchivistLore(player) {
    const held = players.flatMap(other => other.lore || []);
    const drawn = shuffledNumbers(loreCards.filter(card => !held.includes(card.number))).slice(0, 5);
    if (!player.isHuman) {
        player.lore = player.lore.concat(shuffleCards(drawn).slice(0, 2));
        SaveAllSettings();
        showGuildCardsRow(player);
        showMessageToast("Player " + player.number, "Archivist: drew 5 Lore cards and kept " + player.lore.slice(-2).map(number => getLoreCard(number).name).join(" and "));
        showSetUpPlayers();
        return;
    }
    archivistChoice = { drawn: drawn, kept: [] };
    showArchivistChoice();
}

function showArchivistChoice() {
    const player = players[0];
    const html = "<p class=\"mb-2\">Learned: you drew 5 Lore cards. Keep 2, and the other 3 are scrapped.</p>"
        + archivistChoice.drawn.map(number => {
            const card = getLoreCard(number), kept = archivistChoice.kept.includes(number);
            return "<div class=\"draftcard" + (kept ? " draftopen" : "") + "\" id=\"archivist_" + number + "\" onclick=\"toggleArchivistLore(" + number + ")\">"
                + "<div class=\"draftcardhead\"><b>" + card.name + "</b>" + (kept ? "<i class=\"bi bi-check-circle-fill\"></i>" : "") + "</div>"
                + "<div class=\"draftcardtext\">" + card.text + "</div></div>";
        }).join("")
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" id=\"archivistKeep\"" + (archivistChoice.kept.length == 2 ? "" : " disabled")
        + " onclick=\"keepArchivistLore()\">Keep these 2</button>";
    const modal = document.getElementById("guildModal");
    document.getElementById("guildTitle").innerHTML = "Archivist: 2 more Lore cards";
    const header = modal.querySelector(".modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = html;
    if (!modal.classList.contains("show")) { bootstrap.Modal.getOrCreateInstance(modal).show(); }
}

function toggleArchivistLore(number) {
    const kept = archivistChoice.kept;
    if (kept.includes(number)) { archivistChoice.kept = kept.filter(other => other != number); }
    else if (kept.length < 2) { kept.push(number); }
    showArchivistChoice();
}

function keepArchivistLore() {
    const player = players[0];
    player.lore = player.lore.concat(archivistChoice.kept);
    archivistChoice = null;
    SaveAllSettings();
    showGuildCardsRow(player);
    const modal = document.getElementById("guildModal");
    modal.addEventListener('hidden.bs.modal', () => showSetUpPlayers(), { once: true });
    bootstrap.Modal.getOrCreateInstance(modal).hide();
}

// Setup: where each player's buildings go (rulebook p.5, step N)

function getSetupPlacesText(player, position) {
    // e.g. "City in 1A, starport in 1B". The usual pieces without Leaders
    const pieces = (leadersAndLore && player.leader != null) ? getLeaderCard(player.leader).pieces : [["city", 3], ["starport", 3], [null, 2]];
    const places = ["A", "B", "C"].map(box => position + box);
    const cities = places.filter((place, index) => pieces[index][0] == "city");
    const starports = places.filter((place, index) => pieces[index][0] == "starport");
    const list = items => items.length == 2 ? items[0] + "</b> and <b>" + items[1] : items[0];
    let parts = [];
    if (cities.length > 0) { parts.push((cities.length == 1 ? "City" : "Cities") + " in <b>" + list(cities) + "</b>"); }
    if (starports.length > 0) { parts.push((parts.length == 0 ? "Starport" : "starport") + " in <b>" + list(starports) + "</b>"); }
    if (cities.length == 0) { parts.unshift(starports.length == 0 ? "No buildings" : "No city."); }
    return parts.join(cities.length == 0 && starports.length > 0 ? " " : ", ");
}

function getSetupPlayersHtml() {
    const rows = getTurnOrder().map((player, index) => {
        const leader = (leadersAndLore && player.leader != null) ? "<b>" + getLeaderCard(player.leader).name + "</b> &middot; " : "";
        return "<div class=\"d-flex gap-2 align-items-start mb-2 setupplayer\">" + getPlayerTag(player)
            + "<div class=\"flex-fill small\">" + leader + "setup " + (index + 1) + "<br>" + getSetupPlacesText(player, index + 1) + "</div></div>";
    }).join("");
    return (leadersAndLore
        ? "<p class=\"mb-2\">Place each player's pieces in their systems on the setup card. Their resources, ships and Outrage are already filled in from their Leader.</p>"
        : "<p class=\"mb-2\">Place each player's pieces in their systems on the setup card, and add the 2 resources each player starts with on their panel.</p>")
        + rows
        + "<p class=\"mb-3 mt-2\">Then, on each panel, tap + on the type of planet each city is on.</p>";
}

// The Leader and Lore chips on a player's panel

function showLeaderRow(player) {
    // Above the Guild row. Nothing without Leaders & Lore
    const guild = document.getElementById("guildcards" + player.number);
    if (guild == null) { return; }
    let row = document.getElementById("leadercards" + player.number);
    if (player.leader == null) { if (row != null) { row.remove(); } return; }
    if (row == null) {
        row = document.createElement("div");
        row.id = "leadercards" + player.number;
        row.classList.add("d-flex", "flex-wrap", "align-items-center", "justify-content-center", "gap-1", "mx-3", "mb-1");
        guild.parentNode.insertBefore(row, guild);
    }
    const chip = (kind, number, className) => "<button type=\"button\" class=\"guildchip " + className + "\" onclick=\"showLeaderCard(" + player.number + ", '" + kind + "', " + number + ")\">" + getDraftCard(kind, number).name + "</button>";
    row.innerHTML = "<span class=\"boardgrouplabel mb-0 me-1\">Leader</span>" + chip("leader", player.leader, "leaderchip")
        + "<span class=\"boardgrouplabel mb-0 ms-2 me-1\">Lore</span>" + (player.lore || []).map(number => chip("lore", number, "lorechip")).join("");
}

function showLeaderCard(playerNumber, kind, number) {
    const player = getPlayer(playerNumber);
    const card = getDraftCard(kind, number);
    document.getElementById("guildTitle").innerHTML = card.name;
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = "<div class=\"small text-muted mb-2\">Player " + player.number + " &middot; " + draftKinds[kind] + "</div>"
        + (kind == "leader"
            ? card.powers.map(([name, text]) => "<p><i>" + name + ".</i> " + text + "</p>").join("")
                + "<div class=\"small text-muted\">Started with " + card.resources.map(resource => preludeResourceNames[resource]).join(" and ") + "; " + getStartingPiecesText(card) + ".</div>"
            : "<p class=\"mb-0\">" + card.text + "</p>");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

// A game saved mid-draft carries on with it, once the game has loaded (game.js loads it)
document.addEventListener("DOMContentLoaded", () => {
    leadersAndLore = getSettingObject("leadersAndLore") === true;
    const switchInput = document.getElementById("leadersAndLoreSwitch");
    if (switchInput != null) { switchInput.checked = leadersAndLore; }
    setTimeout(() => {
        leaderDraft = getSettingObject("leaderDraft");
        if (leaderDraft != null && players.length > 0) { continueLeaderDraft(); }
    }, 0);
});
