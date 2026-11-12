// Battle: helping a bot that's attacking another player choose its dice and how to
// assign the hits, and updating both players' values afterwards. The human player chooses their
// own dice, so for them the window only keeps track of the battle. The dice and the bot's
// personality are in rules.js.
// Hits left over once every defending ship is destroyed go to the defender's buildings.
// Destroying a city Provokes Outrage for the attacker, usually bad, but it also Ransacks the
// Court, so the bot weighs up what each building is worth to it and may roll fewer dice than it
// could, or more if it wants the building. Raid dice (#87) are for stealing: the app doesn't know which resource is in which
// slot, so the player enters the keys what the bot wants would cost, and it weighs up the chance
// of rolling them against the risk
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// What's entered in the Battle window
let battle = { attacker: null, defender: null, ships: 1, fresh: 1, damaged: 0, freshBuildings: 0, damagedBuildings: 0, start: null,
    keys: 0, raidItem: null, noBuildings: false, raidRolled: false, planet: null, buildingKinds: [], destroyed: null };

// The counts compared before and after the battle
const battleCounts = ["ships", "fresh", "damaged", "freshBuildings", "damagedBuildings"];

function getHitsToDestroy(fresh, damaged) {
    // Ships and buildings both take one hit to damage a fresh one and another to destroy it
    return fresh * 2 + damaged;
}

// Dice results already worked out. Choosing dice compares hundreds of mixes, and each is one
// die more than a mix already done, so this keeps it quick with lots of ships
const diceOutcomes = new Map();

function getSkirmishHits(skirmishDice, rerolls) {
    // The chance of each number of hits from skirmish dice (half the faces hit), rerolling blanks
    // up to the number of rerolls (Skirmishers)
    const choose = (n, k) => { let result = 1; for (let i = 1; i <= k; i++) { result = result * (n - k + i) / i; } return result; };
    let chances = new Array(skirmishDice + 1).fill(0);
    for (let hits = 0; hits <= skirmishDice; hits++) {
        const again = Math.min(rerolls, skirmishDice - hits);
        for (let extra = 0; extra <= again; extra++) {
            chances[hits + extra] += choose(skirmishDice, hits) * Math.pow(0.5, skirmishDice) * choose(again, extra) * Math.pow(0.5, again);
        }
    }
    return chances;
}

function getDiceOutcomes(assaultDice, skirmishDice, raidDice = 0, rerolls = 0) {
    // Every possible result of rolling the dice, as { hits, damage, ambush, keys, buildingHits, chance }.
    // Results that are the same are combined, so this stays small
    const dice = assaultDice + "|" + skirmishDice + "|" + raidDice + "|" + rerolls;
    if (diceOutcomes.has(dice)) { return diceOutcomes.get(dice); }

    // With Skirmishers, the other dice's results combined with the skirmish hits after rerolls
    if (rerolls > 0 && skirmishDice > 0) {
        const chances = getSkirmishHits(skirmishDice, rerolls);
        const combined = new Map();
        getDiceOutcomes(assaultDice, 0, raidDice).forEach(outcome => {
            chances.forEach((chance, hits) => {
                const result = { ...outcome, hits: outcome.hits + hits, chance: outcome.chance * chance };
                const key = result.hits + "|" + result.damage + "|" + result.ambush + "|" + result.keys + "|" + result.buildingHits;
                if (combined.has(key)) { combined.get(key).chance += result.chance; } else { combined.set(key, result); }
            });
        });
        diceOutcomes.set(dice, [...combined.values()]);
        return diceOutcomes.get(dice);
    }

    let outcomes = [{ hits: 0, damage: 0, ambush: false, keys: 0, buildingHits: 0, chance: 1 }];

    // The results of one die fewer, plus this die
    const rollDie = (previous, faces) => {
        let next = new Map();
        previous.forEach(outcome => {
            faces.forEach(face => {
                const result = {
                    hits: outcome.hits + (face.hits || 0),
                    damage: outcome.damage + (face.damage || 0),
                    ambush: outcome.ambush || face.ambush == true,
                    keys: outcome.keys + (face.keys || 0),
                    buildingHits: outcome.buildingHits + (face.buildingHits || 0)
                };
                const key = result.hits + "|" + result.damage + "|" + result.ambush + "|" + result.keys + "|" + result.buildingHits;
                const chance = outcome.chance / faces.length;

                if (next.has(key)) {
                    next.get(key).chance += chance;
                } else {
                    next.set(key, { ...result, chance: chance });
                }
            });
        });
        return [...next.values()];
    };

    if (raidDice > 0) {
        outcomes = rollDie(getDiceOutcomes(assaultDice, skirmishDice, raidDice - 1), raidDieFaces);
    } else if (skirmishDice > 0) {
        outcomes = rollDie(getDiceOutcomes(assaultDice, skirmishDice - 1), skirmishDieFaces);
    } else if (assaultDice > 0) {
        outcomes = rollDie(getDiceOutcomes(assaultDice - 1, 0), assaultDieFaces);
    }

    diceOutcomes.set(dice, outcomes);
    return outcomes;
}

function getOutrageNeed(player, resource) {
    // How much it needs a resource it would lose. Weapons count towards no ambition, but it
    // wants them when chasing Warlord
    if (resource == "weapons") { return wantsToKeep(player, resource) ? 2 : 0; }
    return getResourceNeed(player, resource);
}

function getBuildingValue(attacker, defender, type) {
    // What destroying a building is worth to the attacker, as { gain, cost, value }. type is
    // "starport", or a city's resource ("startingCity:" first if it's a starting city). A starport
    // is only a Trophy. A city also Ransacks the Court and Provokes Outrage (rulebook p.16)
    const weights = buildingValues;
    let gain = (declaredAmbitions.includes("warlord") && isChasingAmbition(attacker, "warlord")) ? weights.trophyWarlord : weights.trophy;
    let cost = 0;

    if (type != "starport") {
        const ransack = isMarketKnown() ? getRansackOptions(attacker, defender) : [];
        if (!isMarketKnown()) { gain += weights.ransackUnknown; }
        else if (ransack.length > 0) { gain += getMarketCardValue(attacker, ransack[0]) * weights.ransackFactor; }

        const resource = type.split(":").pop();
        const need = getOutrageNeed(attacker, resource);
        const cards = getPlayerGuildCards(attacker).filter(card => card.resource == resource);
        cost = attacker[resource + "Value"] * weights.resourceLost[need]
            + cards.filter(card => !card.keepOnOutrage).length * weights.guildCardLost[need];

        // Already Outraged, or a Loyal card ignores it for this resource: no further loss
        if (!(attacker.outraged || []).includes(resource) && !cards.some(card => card.keepOnOutrage)) { cost += weights.preludeLost; }
    }
    return { gain: gain, cost: cost, value: gain - cost };
}

function getBuildingScores(buildings) {
    // The best the attacker can do with each number of hits on the buildings, as an array by
    // hits. It chooses where they go, but must assign them all, so enough hits force it to
    // destroy a building it would rather not. buildings are [{ hits, value }]
    let scores = [0];
    buildings.forEach(building => {
        let next = [];
        scores.forEach((score, used) => {
            for (let hits = 0; hits <= building.hits; hits++) {
                const total = score + (hits == building.hits ? building.value : 0);
                if (next[used + hits] == null || total > next[used + hits]) { next[used + hits] = total; }
            }
        });
        scores = next;
    });
    return scores;
}

function evaluateDice(assaultDice, skirmishDice, fresh, damaged, buildingHits, personality, raidDice = 0, raid = null, rerolls = 0, buildingScores = [], limits = {}) {
    // How good rolling these dice is: the hits on ships (no more than it takes to destroy
    // every defending ship) minus the damage the attacker expects to take, from its own dice
    // and from an ambush (one hit per fresh defending ship), plus what the hits left over that go
    // to the defender's buildings are worth to it (buildingHits is how many it takes to destroy
    // them all, and buildingScores is getBuildingScores).
    // With raid dice, plus the value of what it's after times the chance of rolling the keys
    // (raid is { keys, value, buildingsAreTarget }). Raid dice hit buildings directly, which it
    // only wants if the buildings are what it's attacking. limits are what Leaders and Lore change
    // (see getBattleLimits)
    const usefulHits = getHitsToDestroy(fresh, damaged);
    const interceptHits = (limits.interceptHits != null) ? limits.interceptHits : fresh;

    let expectedHits = 0;
    let expectedBuildingHits = 0;
    let expectedBuildingValue = 0;
    let expectedDamage = 0;
    let ambushChance = 0;
    let keyChance = 0;
    const buildingsAreTarget = raid != null && raid.buildingsAreTarget;

    getDiceOutcomes(assaultDice, skirmishDice, raidDice, rerolls).forEach(outcome => {
        const directHits = buildingsAreTarget ? 0 : outcome.buildingHits;
        expectedHits += Math.min(outcome.hits + (buildingsAreTarget ? outcome.buildingHits : 0), usefulHits) * outcome.chance;
        const buildingHitsRolled = Math.min(Math.max(outcome.hits - usefulHits, 0) + directHits, buildingHits);
        expectedBuildingHits += buildingHitsRolled * outcome.chance;
        expectedBuildingValue += (buildingScores[buildingHitsRolled] || 0) * outcome.chance;
        if (raid != null && outcome.keys >= raid.keys) { keyChance += outcome.chance; }
        const ambush = outcome.ambush || (limits.mirror && assaultDice > 0);
        expectedDamage += (outcome.damage + (ambush ? interceptHits : 0)) * outcome.chance;
        if (ambush) { ambushChance += outcome.chance; }
    });
    expectedDamage += limits.preHits || 0;

    return {
        assaultDice: assaultDice,
        skirmishDice: skirmishDice,
        raidDice: raidDice,
        keyChance: keyChance,
        expectedHits: expectedHits,
        expectedBuildingHits: expectedBuildingHits,
        expectedBuildingValue: expectedBuildingValue,
        expectedDamage: expectedDamage,
        ambushChance: ambushChance,
        score: expectedHits - personality.riskWeight * expectedDamage + personality.buildingWeight * expectedBuildingValue
            + (raid != null ? keyChance * raid.value : 0)
    };
}

function getDiceOptions(ships, fresh, damaged, buildingHits, personality, raid = null, rerolls = 0, buildingScores = [], limits = {}) {
    // Every mix of assault and skirmish dice, and raid dice if it's after something (up to one
    // die per ship and maxDicePerType of each), with the chance the bot picks each. Skirmish dice can't hurt the attacker, so
    // with no buildings to hit the ships not rolling assault roll skirmish, up to the limit.
    // With buildings, rolling fewer dice than it could is an option too, to avoid destroying them.
    // Options close to the best are picked almost as often as the best (a person can't tell
    // them apart and guesses), but clearly worse ones quickly become rare.
    // personality.randomness sets how far from the best counts as "close"
    let options = [];
    const mostRaidDice = (raid != null) ? Math.min(ships, maxDicePerType, limits.maxRaidDice != null ? limits.maxRaidDice : Infinity) : 0;
    for (let raidDice = 0; raidDice <= mostRaidDice; raidDice++) {
        for (let assaultDice = 0; assaultDice <= Math.min(ships - raidDice, maxDicePerType); assaultDice++) {
            const mostSkirmishDice = Math.min(ships - raidDice - assaultDice, maxDicePerType);
            const fewestSkirmishDice = (buildingHits > 0) ? (assaultDice + raidDice == 0 ? 1 : 0) : mostSkirmishDice;
            for (let skirmishDice = fewestSkirmishDice; skirmishDice <= mostSkirmishDice; skirmishDice++) {
                // Corsair (Wary): no more assault dice than skirmish dice
                if (limits.wary && assaultDice > skirmishDice) { continue; }
                options.push(evaluateDice(assaultDice, skirmishDice, fresh, damaged, buildingHits, personality, raidDice, raid, rerolls, buildingScores, limits));
            }
        }
    }

    const bestScore = Math.max(...options.map(option => option.score));
    const randomness = Math.max(personality.randomness, 0.0001);
    const weights = options.map(option => Math.exp(-Math.pow((bestScore - option.score) / randomness, 2)));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    options.forEach((option, index) => { option.pickChance = weights[index] / totalWeight; });
    return options;
}

function getBattleMood(personality) {
    // Like a person, the bot doesn't weigh up every battle the same way: some battles it's
    // bolder, others more careful. Its concern for its own ships varies by up to
    // personality.moodSwing either way
    const swing = (Math.random() * 2 - 1) * personality.moodSwing;
    return { ...personality, riskWeight: Math.max(0, personality.riskWeight * (1 + swing)), mood: swing };
}

function getMostDice(ships) {
    // The most dice an attacker with this many ships can roll
    return Math.min(ships, maxDicePerType * 2);
}

function getBattleAttitude(choice, ships) {
    // What the bot might say about its roll
    if (choice.assaultDice + choice.skirmishDice + (choice.raidDice || 0) < getMostDice(ships)) { return "Holding back: no need to hit their buildings."; }
    if (choice.assaultDice == 0) { return "Playing it safe."; }
    if (choice.skirmishDice == 0) { return "Going all in!"; }
    return "Taking a bit of a risk.";
}

function pickDiceOption(options) {
    // Pick one option at random, using each option's chance
    let roll = Math.random();
    for (const option of options) {
        roll -= option.pickChance;
        if (roll < 0) { return option; }
    }
    return options[options.length - 1];
}

function describeDice(option) {
    // e.g. "2 assault + 1 skirmish"
    let dice = [];
    if (option.assaultDice > 0) { dice.push(option.assaultDice + " assault"); }
    if (option.skirmishDice > 0) { dice.push(option.skirmishDice + " skirmish"); }
    if (option.raidDice > 0) { dice.push(option.raidDice + " raid"); }
    return dice.join(" + ");
}

function getPlanetOptions(defender) {
    // What planet a battle with the defender's buildings could be on, as [{ value, name }]. A
    // battle is in one system, and only a planet has building slots, so all its buildings are on
    // one planet type (#103). The types the defender has a city on come first, then any type its
    // unset starting city could be on. "starport" is a planet where it has only starports
    const hasCity = resource => defender["cities" + capitalise(resource) + "Value"] > 0;
    const types = preludeResources.filter(hasCity).concat(defender.startingCity ? preludeResources.filter(resource => !hasCity(resource)) : []);
    return types.map(resource => ({ value: resource, name: preludeResourceNames[resource] })).concat({ value: "starport", name: "Starports only" });
}

function getBuildingTypesOn(defender, planet, kinds) {
    // What each building is, from the planet and whether it's a city or a starport: "starport",
    // the resource, or "startingCity:" and the resource for a city its counts don't show yet
    let recorded = (planet == "starport") ? 0 : defender["cities" + capitalise(planet) + "Value"];
    let startingCity = defender.startingCity;
    return kinds.map(kind => {
        if (planet == "starport" || kind == "starport") { return "starport"; }
        if (recorded > 0) { recorded--; return planet; }
        if (startingCity) { startingCity = Number(startingCity) - 1; return "startingCity:" + planet; }
        return planet;
    });
}

function getBattleBuildingTypes() {
    // What each defending building is, fresh ones first. They start as cities on a planet it has a
    // city on, so the bot is careful unless told otherwise
    const options = getPlanetOptions(battle.defender);
    if (!options.some(option => option.value == battle.planet)) { battle.planet = options[0].value; }
    const count = battle.freshBuildings + battle.damagedBuildings;
    while (battle.buildingKinds.length < count) { battle.buildingKinds.push("city"); }
    battle.buildingKinds.length = count;
    return getBuildingTypesOn(battle.defender, battle.planet, battle.buildingKinds);
}

function setBattlePlanet(planet) {
    battle.planet = planet;
    updateBattleCounts();
}

function setBuildingKind(index, kind) {
    battle.buildingKinds[index] = kind;
    updateBattleCounts();
}

function getBuildingChoiceHtml(id, planet, kinds, label, onPlanet, onKind) {
    // The planet once, then City or Starport for each building (none on a starports-only planet)
    const options = getPlanetOptions(battle.defender);
    let html = "<div class=\"boardgrouplabel mt-2\">Planet</div>"
        + "<select class=\"form-select form-select-sm\" id=\"" + id + "Planet\" onchange=\"" + onPlanet + "(this.value)\">"
        + options.map(option => "<option value=\"" + option.value + "\"" + (option.value == planet ? " selected" : "") + ">" + option.name + "</option>").join("") + "</select>";
    if (planet == "starport") { return html; }
    kinds.forEach((kind, index) => {
        const choice = (value, name) => "<input type=\"radio\" class=\"btn-check\" name=\"" + id + index + "\" id=\"" + id + index + value + "\"" + (kind == value ? " checked" : "")
            + " onchange=\"" + onKind + "(" + index + ", '" + value + "')\"><label class=\"btn btn-outline-secondary\" for=\"" + id + index + value + "\">" + name + "</label>";
        html += "<div class=\"d-flex align-items-center justify-content-between mt-2\"><span class=\"small fw-semibold\">" + label(index) + "</span>"
            + "<div class=\"btn-group btn-group-sm\" role=\"group\">" + choice("city", "City") + choice("starport", "Starport") + "</div></div>";
    });
    return html;
}

function getBuildingName(type) {
    if (type == "starport") { return "the starport"; }
    return "the city on " + preludeResourceNames[type.split(":").pop()].toLowerCase();
}

function getBattleBuildings() {
    // The defending buildings as the dice choice needs them, the one it most wants first
    return getBattleBuildingTypes().map((type, index) => ({
        type: type,
        hits: index < battle.freshBuildings ? 2 : 1,
        ...getBuildingValue(battle.attacker, battle.defender, type)
    })).sort((a, b) => b.value - a.value);
}

function getHitAdvice(canAttackAgain) {
    // How the bot assigns the hits it rolls. The attacker chooses, for both sides' ships
    if (declaredAmbitions.includes("warlord")) {
        return "Destroy damaged ships first: Warlord is declared and destroyed ships are trophies.";
    }
    if (canAttackAgain) {
        return "Damage fresh ships first, so the next attack faces fewer fresh ships and less risk of an ambush.";
    }
    return "Destroy damaged ships first, then damage fresh ones.";
}

// The Battle window

function showBattleModal(button) {
    // Opened from the Battle icon on a bot's panel. That bot is attacking
    battle.attacker = getPlayer(getPlayerNumberFromString(button.parentNode.id));
    hideIconTooltip(button, "battleModal");
    battle.ships = 1;
    battle.fresh = 1;
    battle.damaged = 0;
    battle.freshBuildings = 0;
    battle.damagedBuildings = 0;
    battle.start = null;
    resetBattleRaid();
    document.getElementById("battleAttackAgain").checked = false;
    // Only needed for the bot's advice
    showHideElement([document.getElementById("battleAttackAgain").parentNode], !battle.attacker.isHuman);

    const header = document.querySelector("#battleModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(battle.attacker));
    document.getElementById("battleTitle").innerHTML = "Player " + battle.attacker.number + " attacks";

    // The defender can be any other player, starting on who a bot would rather Battle
    const target = !battle.attacker.isHuman ? getBattleTarget(battle.attacker) : null;
    const defenders = document.getElementById("battleDefenders");
    defenders.replaceChildren();
    players.filter(player => player.number != battle.attacker.number).forEach((player, index) => {
        const input = document.createElement("input");
        input.type = "radio";
        input.classList.add("btn-check");
        input.name = "battleDefender";
        input.id = "battleDefender" + player.number;
        // A different defender is a different battle, so its counts start again
        input.onchange = () => { battle.defender = player; battle.start = null; battle.ships = Math.max(battle.ships, 1); resetBattleRaid(); updateBattleCounts(); };

        const label = document.createElement("label");
        label.classList.add("btn", "btn-sm", "playerchoice", "playerchoice" + getPlayerColour(player));
        label.htmlFor = input.id;
        label.innerHTML = "Player " + player.number;

        if (target != null ? player === target.player : index == 0) {
            input.checked = true;
            battle.defender = player;
        }
        defenders.append(input, label);
    });

    updateBattleCounts();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("battleModal")).show();
}

function battleStep(field, change) {
    // The -/+ buttons (and the keys for a raid). The attacker needs a ship to start, but can
    // lose them all once it has rolled
    const minimum = (field == "ships" && battle.start == null) ? 1 : 0;
    battle[field] = Math.max(minimum, battle[field] + change);
    updateBattleCounts();
}

function updateBattleCounts() {
    document.getElementById("battleShips").innerHTML = battle.ships;
    document.getElementById("battleFresh").innerHTML = battle.fresh;
    document.getElementById("battleDamaged").innerHTML = battle.damaged;
    document.getElementById("battleFreshBuildings").innerHTML = battle.freshBuildings;
    document.getElementById("battleDamagedBuildings").innerHTML = battle.damagedBuildings;
    showBattleRaid();
    clearBattleDecision();
}

// Raid dice: stealing from the defender

function resetBattleRaid() {
    battle.keys = 0;
    battle.raidItem = null;
    battle.noBuildings = false;
    battle.raidRolled = false;
    battle.inGate = false;
    battle.planet = null;
    battle.buildingKinds = [];
}

function setInGate(inGate) {
    // Gatekeepers: 2 more dice when battling in a gate
    battle.inGate = inGate;
    updateBattleCounts();
}

function getBattleDiceLimit() {
    // One die per ship, and 2 more with Gatekeepers in a gate
    return battle.ships + (battle.inGate && holdsGuildCard(battle.attacker, 8) ? 2 : 0) + getLeaderExtraDice(battle.attacker);
}

function getBattleRerolls() {
    // Skirmishers: rerolls up to its Weapon icons from resources and cards
    if (!holdsGuildCard(battle.attacker, 13)) { return 0; }
    return battle.attacker.weaponsValue + getGuildIconCount(battle.attacker, "weapons");
}

function isRaidAllowed() {
    // A defending building here, or the defender has no buildings on the board at all
    // (starports aren't counted, so the player says so)
    return isLeaderRaidAllowed(battle.freshBuildings + battle.damagedBuildings > 0 || battle.noBuildings);
}

function getRaidWants(attacker, defender) {
    // What the attacker could steal from the defender, most wanted first. Guild cards have
    // their keys printed on them; a resource's depend on its slot, so the player enters them.
    // Sworn Guardians stops anything else being stolen until it has been
    const guardians = getCourtCard(22);
    if ((defender.guildCards || []).includes(guardians.number)) {
        return [{ id: "guild:" + guardians.number, name: guardians.name, keys: guardians.keys, need: 0 }];
    }

    const resources = preludeResources.filter(resource => defender[resource + "Value"] > 0).map(resource => ({
        id: "resource:" + resource, resource: resource, name: preludeResourceNames[resource], need: getResourceNeed(attacker, resource)
    }));
    const guildCards = getPlayerGuildCards(defender).map(card => ({
        id: "guild:" + card.number, card: card.number, name: card.name, keys: card.keys, need: getResourceNeed(attacker, card.resource)
    }));
    return filterLeaderRaidWants(attacker, defender, resources.concat(guildCards)).sort((a, b) => b.need - a.need);
}

function getBattleRaidItem() {
    // What the bot is after in this battle, or null. Once it has rolled raid dice that stands,
    // even if the roll destroyed the last building
    if ((!isRaidAllowed() && !battle.raidRolled) || battle.raidItem == "none") { return null; }
    const wants = getRaidWants(battle.attacker, battle.defender);
    return wants.find(want => want.id == battle.raidItem) || wants[0] || null;
}

function getBattleRaid(buildingsAreTarget) {
    // What the dice choice needs to know about a raid. Without the keys it can't weigh it up
    const item = getBattleRaidItem();
    if (item == null || battle.keys == 0) { return null; }
    return { keys: battle.keys, value: defaultBotPersonality.raidWeight * raidNeedFactor[item.need], buildingsAreTarget: buildingsAreTarget };
}

function chooseRaidItem(id) {
    battle.raidItem = id;
    // A Guild card's keys are printed on it. A resource's depend on its slot
    const item = getBattleRaidItem();
    battle.keys = (item != null && item.keys != null) ? item.keys : 0;
    updateBattleCounts();
}

function setNoBuildings(noBuildings) {
    battle.noBuildings = noBuildings;
    updateBattleCounts();
}

function showBattleRaid() {
    // The raid part of the Battle window, which depends on the counts and the defender
    const section = document.getElementById("battleRaid");
    const defender = getPlayerTag(battle.defender);

    // The human player chooses their own dice, and says what they stole afterwards
    if (battle.attacker.isHuman) {
        section.innerHTML = "";
        return;
    }

    // Why it would rather Battle this Rival, and where
    const target = !battle.attacker.isHuman ? getBattleTarget(battle.attacker) : null;
    let html = (target != null && target.player === battle.defender)
        ? "<div class=\"small text-muted text-center mb-2\" id=\"battleTargetReason\">" + target.why + " " + target.where + "</div>" : "";
    if (holdsGuildCard(battle.attacker, 8)) {
        html += "<div class=\"form-check form-switch d-flex justify-content-center gap-2\">"
            + "<input class=\"form-check-input\" type=\"checkbox\" id=\"battleInGate\" onchange=\"setInGate(this.checked)\"" + (battle.inGate ? " checked" : "") + ">"
            + "<label class=\"form-check-label\" for=\"battleInGate\">In a gate (Gatekeepers: 2 more dice)</label></div>";
    }
    // What the buildings are, as destroying a city and a starport are very different. With no
    // cities, they can only be starports
    if (battle.freshBuildings + battle.damagedBuildings > 0 && getPlanetOptions(battle.defender).length > 1) {
        getBattleBuildingTypes();
        html += getBuildingChoiceHtml("battleBuilding", battle.planet, battle.buildingKinds,
            index => (index < battle.freshBuildings ? "Fresh" : "Damaged") + " building", "setBattlePlanet", "setBuildingKind");
    }
    if (battle.freshBuildings + battle.damagedBuildings == 0) {
        html += "<div class=\"form-check form-switch d-flex justify-content-center gap-2\">"
            + "<input class=\"form-check-input\" type=\"checkbox\" id=\"battleNoBuildings\" onchange=\"setNoBuildings(this.checked)\"" + (battle.noBuildings ? " checked" : "") + ">"
            + "<label class=\"form-check-label\" for=\"battleNoBuildings\">" + defender + " has no buildings on the board</label></div>";
    }

    if (!isRaidAllowed()) {
        section.innerHTML = html + "<div class=\"small text-muted text-center mt-1\">Raid dice need a building here, or a defender with none on the board.</div>";
        return;
    }

    const wants = getRaidWants(battle.attacker, battle.defender);
    if (wants.length == 0) {
        section.innerHTML = html + "<div class=\"small text-muted text-center mt-1\">" + defender + " has nothing to steal.</div>";
        return;
    }

    const item = getBattleRaidItem();
    if (item != null && item.keys != null) { battle.keys = item.keys; }
    html += "<div class=\"boardgrouplabel mt-2\">Raid: steal from " + defender + "</div>"
        + "<select class=\"form-select form-select-sm\" id=\"battleRaidItem\" onchange=\"chooseRaidItem(this.value)\">"
        + wants.map(want => "<option value=\"" + want.id + "\"" + (item != null && want.id == item.id ? " selected" : "") + ">" + want.name + (want.need == 2 ? " (it's chasing this)" : "") + "</option>").join("")
        + "<option value=\"none\"" + (item == null ? " selected" : "") + ">Nothing</option></select>";

    if (item != null) {
        const printed = item.keys != null;
        html += "<div class=\"d-flex align-items-center justify-content-center gap-2 mt-2\"><div class=\"resourcetile\">"
            + "<div class=\"resourcelabel\">Keys</div><div class=\"resourcevalue\" id=\"battleKeys\">" + battle.keys + "</div>"
            + (printed ? "" : "<div class=\"d-flex gap-1\"><button class=\"btn resourcebutton resourceminus\" type=\"button\" onclick=\"battleStep('keys', -1)\" aria-label=\"One key fewer\"><i class=\"bi bi-dash-lg\"></i></button>"
                + "<button class=\"btn resourcebutton resourceplus\" type=\"button\" onclick=\"battleStep('keys', 1)\" aria-label=\"One key more\"><i class=\"bi bi-plus-lg\"></i></button></div>")
            + "</div><div class=\"small text-muted\" style=\"max-width: 170px\">" + (printed ? "Printed on the card." : "How many keys does its slot on " + defender + "'s board show?") + "</div></div>";
    }
    section.innerHTML = html;
}

function clearBattleDecision() {
    // Anything changed, so the bot needs to choose again. Once it has rolled, the counts are
    // what's left, so it can attack again or finish. The human player rolls for themselves
    const isHuman = battle.attacker.isHuman;
    const advice = isHuman
        ? (battle.start == null
            ? "Set the ships and buildings before you roll, then start the battle."
            : "Roll your dice, then set the ships and buildings above to what's left. Do the same for any more attacks, then tap Done battling.")
        : (battle.start == null
            ? "Set up the battle, then choose the dice."
            : (battle.ships == 0
                ? "It has no ships left. Done battling updates the values."
                : "To attack again, choose the dice. Otherwise, Done battling updates the values."));
    document.getElementById("battleAdvice").innerHTML = "<div class=\"text-muted\">" + advice + "</div>";
    document.getElementById("chooseBattleDice").innerHTML = isHuman ? "Start battle" : "Choose dice";
    showHideElement([document.getElementById("chooseBattleDice")], !(battle.start != null && (isHuman || battle.ships == 0)));
    showHideElement([document.getElementById("battleDone")], battle.start != null);
}

function chooseBattleDice() {
    const advice = document.getElementById("battleAdvice");

    const hasShips = battle.fresh + battle.damaged > 0;
    const buildingHits = getHitsToDestroy(battle.freshBuildings, battle.damagedBuildings);
    if (!hasShips && buildingHits == 0) {
        advice.innerHTML = "<div class=\"text-muted\">" + getPlayerTag(battle.defender) + " has nothing to attack.</div>";
        return;
    }

    // The human player rolls for themselves, so just note the counts before the first roll
    if (battle.attacker.isHuman) {
        noteBattleStart();
        clearBattleDecision();
        return;
    }

    // This battle's mood, then a loose pick weighted towards the better options. With no
    // defending ships the bot is attacking the buildings on purpose if all are worth destroying,
    // so hits on them are what it wants: they count like hits on ships (buildings don't ambush)
    // and nothing is held back. If only some are, it holds back to spare the others. If none
    // are, it only attacks to steal
    const buildings = getBattleBuildings();
    const onPurpose = !hasShips && buildings.every(building => building.value >= 0);
    const mood = getBattleMood(defaultBotPersonality);
    const raid = getBattleRaid(onPurpose);
    if (!hasShips && buildings.every(building => building.value < 0) && raid == null) {
        advice.innerHTML = "<div class=\"battleroll\">Don't attack</div><div class=\"fst-italic\">Destroying "
            + buildings.map(building => getBuildingName(building.type)).join(" or ") + " would cost it more than it gains.</div>";
        return;
    }
    const raidItem = getBattleRaidItem();
    const limits = getBattleLimits();
    const options = onPurpose
        ? getDiceOptions(getBattleDiceLimit(), 0, buildingHits, 0, mood, raid, getBattleRerolls(), [], limits)
        : getDiceOptions(getBattleDiceLimit(), battle.fresh, battle.damaged, buildingHits, mood, raid, getBattleRerolls(), getBuildingScores(buildings), limits);
    const interceptHits = (limits.interceptHits != null) ? limits.interceptHits : battle.fresh;
    const choice = pickDiceOption(options);
    const canAttackAgain = document.getElementById("battleAttackAgain").checked;
    const usefulHits = onPurpose ? buildingHits : getHitsToDestroy(battle.fresh, battle.damaged);
    const wantedBuilding = buildings.find(building => building.value > 0);
    const buildingOrder = (buildings.length > 1 && new Set(buildings.map(building => building.value)).size > 1)
        ? ": " + buildings.map(building => getBuildingName(building.type)).join(", then ") : "";

    // The other options and how likely each was, so the weighting can be checked
    const others = options.filter(option => option !== choice && option.pickChance >= 0.01)
        .sort((a, b) => b.pickChance - a.pickChance)
        .map(option => describeDice(option) + " " + Math.round(option.pickChance * 100) + "%");

    const moodText = (mood.mood > 0.15) ? "more careful than usual" : (mood.mood < -0.15) ? "bolder than usual" : "about as usual";

    // Only what a human opponent would say is shown. The numbers behind the decision are
    // in Details, closed to start with
    advice.innerHTML = getLeaderBattleSetupNote()
        + "<div class=\"battleroll\">Roll " + describeDice(choice) + "</div>"
        + "<div class=\"fst-italic\">" + ((raid != null && choice.raidDice > 0) ? "Going after their " + raidItem.name + "." : getBattleAttitude(choice, getBattleDiceLimit())
            + (raid != null ? " Their " + raidItem.name + " isn't worth the risk." : "")
            + (hasShips && wantedBuilding != null && choice.expectedBuildingHits > 0 ? " Happy to hit " + getBuildingName(wantedBuilding.type) + "." : "")) + "</div>"
        + "<div class=\"mt-2\"><b>Assign hits:</b> "
        + (hasShips ? getHitAdvice(canAttackAgain) + (buildingHits > 0 ? " Any hits left over go to buildings" + buildingOrder + "." : "") : "All hits go to buildings" + buildingOrder + ".") + "</div>"
        + "<div><b>Own ships:</b> damage fresh ships before losing damaged ones.</div>"
        + (getBattleRerolls() > 0 && choice.skirmishDice > 0
            ? "<div><b>Skirmishers:</b> reroll up to " + getBattleRerolls() + " blank skirmish " + (getBattleRerolls() == 1 ? "die" : "dice") + " if it still needs hits.</div>" : "")
        + getLeaderDiceNotes(choice)
        + "<details class=\"small text-muted mt-2\" id=\"battleDetails\"><summary>Details</summary>"
        + (usefulHits > 0 ? "<div>Expected hits: " + choice.expectedHits.toFixed(1) + " (" + usefulHits + " would destroy every " + (hasShips ? "ship" : "building") + ")</div>" : "")
        + (raid != null && choice.raidDice > 0 ? "<div>Chance of " + raid.keys + " key" + (raid.keys == 1 ? "" : "s") + ": " + Math.round(choice.keyChance * 100) + "%</div>" : "")
        + (interceptHits > 0 && choice.ambushChance > 0
            ? "<div>Ambush or intercept chance: " + Math.round(choice.ambushChance * 100) + "% (would take " + interceptHits + " hit" + (interceptHits == 1 ? "" : "s") + " first)</div>"
            : "<div>No risk of an ambush</div>")
        + (hasShips && buildingHits > 0
            ? "<div>Expected hits on buildings: " + choice.expectedBuildingHits.toFixed(1) + "</div>"
            : "")
        + buildings.map(building => "<div>Destroying " + getBuildingName(building.type) + ": gains " + building.gain.toFixed(1) + ", costs " + building.cost.toFixed(1) + "</div>").join("")
        + "<div>Expected damage to own ships: " + choice.expectedDamage.toFixed(1) + "</div>"
        + "<div>Mood this battle: " + moodText + "</div>"
        + "<div>Chance of this choice " + Math.round(choice.pickChance * 100) + "%"
        + (others.length > 0 ? ". Others: " + others.join(", ") : "") + "</div>"
        + "</details>"
        + "<div class=\"alert alert-secondary py-2 px-3 mt-2 mb-0 small\"><b>After the roll:</b> set the ships and buildings above to what's left.</div>";

    noteBattleStart();
    if (choice.raidDice > 0) { battle.raidRolled = true; }
    showHideElement([document.getElementById("battleDone")], true);

    // The bot may attack again (with the same or updated ships), so it can choose again
    document.getElementById("chooseBattleDice").innerHTML = "Choose again";
}

function noteBattleStart() {
    // The counts before the first roll, to work out what was lost when the battle is done
    if (battle.start != null) { return; }
    battle.start = {};
    battleCounts.forEach(count => { battle.start[count] = battle[count]; });
    battle.start.buildingTypes = battle.attacker.isHuman ? [] : getBattleBuildingTypes().slice();
}

function getDestroyedBuildingTypes() {
    // What was said about the buildings that have gone, from those left. The player can correct it
    let left = getBattleBuildingTypes().slice();
    return (battle.start.buildingTypes || []).filter(type => {
        const index = left.indexOf(type);
        if (index == -1) { return true; }
        left.splice(index, 1);
        return false;
    });
}

function getDestroyedHtml() {
    const count = battle.destroyed.kinds.length;
    return getBuildingChoiceHtml("battleDestroyed", battle.destroyed.planet, battle.destroyed.kinds,
        index => "Destroyed building" + (count > 1 ? " " + (index + 1) : ""), "setDestroyedPlanet", "setDestroyedKind");
}

function setDestroyedPlanet(planet) {
    battle.destroyed.planet = planet;
    document.getElementById("battleDestroyed").innerHTML = getDestroyedHtml();
}

function setDestroyedKind(index, kind) {
    battle.destroyed.kinds[index] = kind;
    document.getElementById("battleDestroyed").innerHTML = getDestroyedHtml();
}

function getBattleLosses() {
    // What each side lost since the first roll, from the counts now
    const lost = (before, after) => Math.max(before - after, 0);
    return {
        attackerShips: lost(battle.start.ships, battle.ships),
        defenderShips: lost(battle.start.fresh + battle.start.damaged, battle.fresh + battle.damaged),
        defenderBuildings: lost(battle.start.freshBuildings + battle.start.damagedBuildings, battle.freshBuildings + battle.damagedBuildings)
    };
}

function showBattleResults() {
    // What the battle changed, to confirm before the players' values are updated
    const losses = getBattleLosses();
    const attacker = getPlayerTag(battle.attacker), defender = getPlayerTag(battle.defender);
    const plural = (count, word) => count + " " + word + (count == 1 ? "" : "s");

    let lines = [];
    if (losses.defenderShips > 0) {
        lines.push(defender + ": " + plural(losses.defenderShips, "ship") + " destroyed, taken by " + attacker + " as trophies");
    }
    if (losses.attackerShips > 0) {
        lines.push(attacker + ": " + plural(losses.attackerShips, "ship") + " destroyed, taken by " + defender + " as trophies");
    }

    let html = "<div class=\"fw-bold mb-1\">The battle</div>"
        + (lines.length > 0 ? lines.map(line => "<div>" + line + "</div>").join("") : (losses.defenderBuildings == 0 ? "<div class=\"text-muted\">Nothing was destroyed.</div>" : ""));

    // Each destroyed building is the attacker's Trophy (rulebook p.14). Destroying a city also
    // means Outrage for that resource and Ransacking the Court (p.16), so which was it?
    if (losses.defenderBuildings > 0) {
        html += "<div class=\"mt-2\">" + defender + ": " + plural(losses.defenderBuildings, "building") + " destroyed. " + (losses.defenderBuildings == 1 ? "What was it?" : "What were they?") + "</div>";

        // Filled in from what was said before the roll. The human player starts on starports
        const destroyed = getDestroyedBuildingTypes();
        const city = destroyed.find(type => type != "starport");
        const options = getPlanetOptions(battle.defender);
        const planet = (city != null) ? city.split(":").pop() : (battle.attacker.isHuman || battle.planet == null ? "starport" : battle.planet);
        battle.destroyed = {
            planet: options.some(option => option.value == planet) ? planet : "starport",
            kinds: Array.from({ length: losses.defenderBuildings }, (_, index) => destroyed[index] == "starport" ? "starport" : "city")
        };
        html += "<div id=\"battleDestroyed\">" + (options.length > 1 ? getDestroyedHtml() : "") + "</div>";
        const canRansack = canRansackAgainst(battle.defender);
        html += "<div class=\"alert alert-warning py-2 px-3 mt-2 mb-0 small\"><b>Destroying a city:</b> " + attacker + " Provokes Outrage of that resource, discarding its resources and Guild cards of that type"
            + (canRansack ? ", and Ransacks the Court.</div>" : ". " + defender + " is the Elder, so there's no Ransack (Beloved).</div>");

        // Ransack: which card? With no market entered, the player carries it out
        const ransack = (isMarketKnown() && canRansack) ? getRansackOptions(battle.attacker, battle.defender) : [];
        if (ransack.length > 0) {
            html += "<div class=\"mt-2\">If a city was destroyed, Ransack:</div><select class=\"form-select form-select-sm mt-1\" id=\"battleRansack\">"
                + ransack.map(entry => "<option value=\"" + entry.number + "\">" + getCourtCard(entry.number).name + "</option>").join("") + "<option value=\"\">Nothing</option></select>";
        }
    }

    html += getLeaderBattleResultsHtml(losses);

    // The human player says what they stole, if anything. With no attacking ships left, no one
    // can spend the keys (rulebook p.16)
    if (battle.attacker.isHuman && battle.ships > 0) {
        const wants = getRaidWants(battle.attacker, battle.defender);
        if (wants.length > 0) {
            html += "<div class=\"mt-2\">What did you steal?</div><select class=\"form-select form-select-sm mt-1\" id=\"battleStolenItem\"><option value=\"none\">Nothing</option>"
                + wants.map(want => "<option value=\"" + want.id + "\">" + want.name + "</option>").join("") + "</select>";
        }
    }

    // If the bot rolled raid dice, did it get the keys?
    const raidItem = getBattleRaidItem();
    if (!battle.attacker.isHuman && battle.raidRolled && raidItem != null && battle.ships > 0) {
        html += "<div class=\"form-check mt-2\"><input class=\"form-check-input\" type=\"checkbox\" id=\"battleStole\">"
            + "<label class=\"form-check-label\" for=\"battleStole\">" + attacker + " rolled " + battle.keys + " key" + (battle.keys == 1 ? "" : "s") + " and stole the " + raidItem.name + "</label></div>";
    }

    html += "<div class=\"d-flex gap-2 mt-3\">"
        + "<button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"clearBattleDecision()\">Back</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"battleUpdate\" onclick=\"applyBattleResults()\">Update values</button>"
        + "</div>";

    document.getElementById("battleAdvice").innerHTML = html;
    showHideElement([document.getElementById("chooseBattleDice"), document.getElementById("battleDone")], false);
}

function adjustCounter(player, counter, change) {
    // Change a panel counter the same way its -/+ buttons do (totals, headers and saving included)
    const button = (change > 0 ? "plusButton_" : "minusButton_") + counter + "_" + player.number;
    for (let step = 0; step < Math.abs(change); step++) { plusMinusClicked(button, change > 0 ? "plus" : "minus", true); }
}

function applyBattleResults() {
    // Update both players' values and close the window
    const losses = getBattleLosses();
    const { attacker, defender } = battle;

    // Destroyed ships leave the board and become the other side's trophies
    adjustCounter(defender, "shipsBoard", -losses.defenderShips);
    adjustCounter(attacker, "trophies", losses.defenderShips);
    adjustCounter(attacker, "shipsBoard", -losses.attackerShips);
    adjustCounter(defender, "trophies", losses.attackerShips);

    // Destroyed buildings are the attacker's Trophies (starports aren't otherwise counted). A city
    // leaves the map, but its slot stays open until the Trophies are returned. The attacker
    // then Provokes Outrage of that resource and Ransacks the Court (rulebook p.16)
    let cities = [];
    adjustCounter(attacker, "trophies", losses.defenderBuildings);
    const destroyedTypes = (losses.defenderBuildings > 0 && battle.destroyed != null) ? getBuildingTypesOn(defender, battle.destroyed.planet, battle.destroyed.kinds) : [];
    destroyedTypes.forEach(type => {
        if (type == "starport") { return; }
        defender.citiesAsTrophies = (defender.citiesAsTrophies || 0) + 1;
        const startingCity = type.startsWith("startingCity:");
        const resource = startingCity ? type.split(":")[1] : type;
        if (startingCity) {
            defender.startingCity = Number(defender.startingCity) - 1;
            document.getElementById("citiestotal" + defender.number).innerHTML = getCityCount(defender);
        } else {
            adjustCounter(defender, "cities" + capitalise(resource), -1);
        }
        provokeOutrage(attacker, resource);
        cities.push(preludeResourceNames[resource].toLowerCase());
    });

    // Ransack the Court, if a city was destroyed. With the market not entered, it's a reminder
    const ransackList = document.getElementById("battleRansack");
    let ransacked = null;
    if (cities.length > 0 && ransackList != null && ransackList.value != "") {
        ransacked = ransackMarketCard(attacker, parseInt(ransackList.value));
    }

    const leaderLines = applyLeaderBattleResults(losses);

    // What it stole moves across. Sworn Guardians is buried instead, so it leaves the game
    const stoleBox = document.getElementById("battleStole");
    const stolenList = document.getElementById("battleStolenItem");
    const stolen = (stolenList != null)
        ? (getRaidWants(attacker, defender).find(want => want.id == stolenList.value) || null)
        : ((stoleBox != null && stoleBox.checked) ? getBattleRaidItem() : null);
    if (stolen != null) {
        if (stolen.resource != null) {
            adjustCounter(defender, stolen.resource, -1);
            adjustCounter(attacker, stolen.resource, 1);
        } else {
            const number = parseInt(stolen.id.split(":")[1]);
            defender.guildCards = defender.guildCards.filter(card => card != number);
            if (number != 22) { attacker.guildCards.push(number); }
            showGuildCardsRow(defender);
            showGuildCardsRow(attacker);
        }
    }

    SaveAllSettings();
    refreshTurnSummary();
    showMessageToast("Player " + attacker.number + " attacked Player " + defender.number,
        "Ships destroyed: " + losses.defenderShips + " (Player " + defender.number + "), " + losses.attackerShips + " (Player " + attacker.number + ")"
        + (losses.defenderBuildings > 0 ? "<br>Buildings destroyed: " + losses.defenderBuildings + (cities.length > 0 ? " (cities: " + cities.join(", ") + ")" : "") : "")
        + (cities.length > 0 ? "<br>Player " + attacker.number + " Provokes Outrage: " + cities.join(", ") : "")
        + (ransacked != null ? "<br>Ransacked " + ransacked.name + ". Add its replacement to the market." : (cities.length > 0 && canRansackAgainst(defender) ? "<br>Ransack the Court." : ""))
        + leaderLines.map(line => "<br>" + line).join("")
        + (stolen != null ? "<br>Stole the " + stolen.name : "")
        + (cities.length > 0 && getOverCapacityAdvice(defender) != null ? "<br>" + getOverCapacityAdvice(defender) : ""));

    battle.start = null;

    // A bot's Ransacked Vox card resolves once this window has closed
    const battleModal = document.getElementById("battleModal");
    if (ransacked != null && ransacked.type == "vox" && !attacker.isHuman) {
        battleModal.addEventListener('hidden.bs.modal', () => {
            showVoxCard(attacker, ransacked);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
        }, { once: true });
    }
    bootstrap.Modal.getOrCreateInstance(battleModal).hide();
}
