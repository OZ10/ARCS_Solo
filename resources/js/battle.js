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
let battle = { attacker: null, defender: null, ships: 1, attackerDamaged: 0, fresh: 1, damaged: 0, freshBuildings: 0, damagedBuildings: 0, start: null,
    raidPlan: null, keysRolled: null, noBuildings: false, raidRolled: false, planet: null, buildingKinds: [], destroyed: null };

// The counts compared before and after the battle
const battleCounts = ["ships", "attackerDamaged", "fresh", "damaged", "freshBuildings", "damagedBuildings"];

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

    // What the defender loses (#138): a starport they build ships at and Catapult from, most of all
    // their last one; a city they tax, which goes back on their board over a resource slot
    if (type == "starport") {
        gain += weights.starportDenied + ((defender.starportsValue || 0) <= 1 ? weights.lastStarport : 0);
    } else {
        gain += weights.cityDenied;
    }

    if (type != "starport") {
        const ransack = isMarketKnown() ? getRansackOptions(attacker, defender) : [];
        if (!isMarketKnown()) { gain += weights.ransackUnknown; }
        else if (ransack.length > 0) { gain += getMarketCardValue(attacker, ransack[0]) * weights.ransackFactor; }

        // A gate city: Outrage of every city type in its cluster (Gate Stations)
        const resources = type == "gate" ? (battle.boardSystem != null ? getGateCityTypes(battle.boardSystem) : []) : [type.split(":").pop()];
        resources.forEach(resource => {
            const need = getOutrageNeed(attacker, resource);
            const cards = getPlayerGuildCards(attacker).filter(card => card.resource == resource);
            cost += attacker[resource + "Value"] * weights.resourceLost[need]
                + cards.filter(card => !card.keepOnOutrage).length * weights.guildCardLost[need];
            // Already Outraged, or a Loyal card ignores it for this resource: no further loss
            if (!(attacker.outraged || []).includes(resource) && !cards.some(card => card.keepOnOutrage)) { cost += weights.preludeLost; }
        });
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
    // What the raid dice are expected to take: a smaller roll may still take something (#159)
    let raidValue = 0;
    const buildingsAreTarget = raid != null && raid.buildingsAreTarget;

    getDiceOutcomes(assaultDice, skirmishDice, raidDice, rerolls).forEach(outcome => {
        const directHits = buildingsAreTarget ? 0 : outcome.buildingHits;
        expectedHits += Math.min(outcome.hits + (buildingsAreTarget ? outcome.buildingHits : 0), usefulHits) * outcome.chance;
        const buildingHitsRolled = Math.min(Math.max(outcome.hits - usefulHits, 0) + directHits, buildingHits);
        expectedBuildingHits += buildingHitsRolled * outcome.chance;
        expectedBuildingValue += (buildingScores[buildingHitsRolled] || 0) * outcome.chance;
        if (raid != null && outcome.keys >= raid.keys) { keyChance += outcome.chance; }
        if (raid != null) { raidValue += getRaidValueFor(raid, outcome.keys) * outcome.chance; }
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
            + raidValue
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
    // limits.raidOnly: stealing from buildings it doesn't want destroyed, with no ships to hit, so
    // assault and skirmish dice could only destroy them (#113)
    const mostRaidDice = (raid != null) ? Math.min(ships, maxDicePerType, limits.maxRaidDice != null ? limits.maxRaidDice : Infinity) : 0;
    for (let raidDice = limits.raidOnly ? 1 : 0; raidDice <= mostRaidDice; raidDice++) {
        for (let assaultDice = 0; assaultDice <= (limits.raidOnly ? 0 : Math.min(ships - raidDice, maxDicePerType)); assaultDice++) {
            const mostSkirmishDice = limits.raidOnly ? 0 : Math.min(ships - raidDice - assaultDice, maxDicePerType);
            const fewestSkirmishDice = limits.raidOnly ? 0 : (buildingHits > 0) ? (assaultDice + raidDice == 0 ? 1 : 0) : mostSkirmishDice;
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

function getPlanetOptions(defender, withGate = false) {
    // What planet a battle with the defender's buildings could be on, as [{ value, name }]. A
    // battle is in one system, and only a planet has building slots, so all its buildings are on
    // one planet type (#103). The types the defender has a city on come first, then any type its
    // unset starting city could be on. None: it has no cities, so its buildings are starports.
    // Each building is set to a city or a starport, so there's no "starports only" planet (#139)
    const hasCity = resource => defender["cities" + capitalise(resource) + "Value"] > 0;
    const types = preludeResources.filter(hasCity).concat(defender.startingCity ? preludeResources.filter(resource => !hasCity(resource)) : []);
    // Gate Stations (Lore): its holder can have a city on a gate, of every type in its cluster (#120)
    const gate = (withGate && hasLore(defender, 11)) ? [{ value: "gate", name: "A gate (Gate Stations)" }] : [];
    return types.map(resource => ({ value: resource, name: preludeResourceNames[resource] })).concat(gate);
}

function getFirstPlanet(defender) {
    // The planet a city would be on, to start with. "starport" when it can't have a city here
    const options = getPlanetOptions(defender);
    return options.length > 0 ? options[0].value : "starport";
}

function getBuildingTypesOn(defender, planet, kinds) {
    // What each building is, from the planet and whether it's a city or a starport: "starport",
    // the resource, or "startingCity:" and the resource for a city its counts don't show yet
    let recorded = (planet == "starport") ? 0 : defender["cities" + capitalise(planet) + "Value"];
    let startingCity = defender.startingCity;
    return kinds.map(kind => {
        if (planet == "starport" || kind == "starport") { return "starport"; }
        if (planet == "gate") { return "gate"; }
        if (recorded > 0) { recorded--; return planet; }
        if (startingCity) { startingCity = Number(startingCity) - 1; return "startingCity:" + planet; }
        return planet;
    });
}

function getBattleBuildingTypes() {
    // What each defending building is, fresh ones first. They start as cities on a planet it has a
    // city on, so the bot is careful unless told otherwise
    const options = getPlanetOptions(battle.defender);
    // A gate city's battle is known from the board (Gate Stations)
    if (battle.planet != "gate" && !options.some(option => option.value == battle.planet)) { battle.planet = getFirstPlanet(battle.defender); }
    const count = battle.freshBuildings + battle.damagedBuildings;
    while (battle.buildingKinds.length < count) { battle.buildingKinds.push(options.length > 0 ? "city" : "starport"); }
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
    // City or Starport for each building, then the planet, only when one is a city (#139)
    const options = getPlanetOptions(battle.defender, id == "battleDestroyed");
    let html = "";
    kinds.forEach((kind, index) => {
        const choice = (value, name) => "<input type=\"radio\" class=\"btn-check\" name=\"" + id + index + "\" id=\"" + id + index + value + "\"" + (kind == value ? " checked" : "")
            + " onchange=\"" + onKind + "(" + index + ", '" + value + "')\"><label class=\"btn btn-outline-secondary\" for=\"" + id + index + value + "\">" + name + "</label>";
        html += "<div class=\"d-flex align-items-center justify-content-between mt-2\"><span class=\"small fw-semibold\">" + label(index) + "</span>"
            + "<div class=\"btn-group btn-group-sm\" role=\"group\">" + choice("city", "City") + choice("starport", "Starport") + "</div></div>";
    });
    const cities = kinds.filter(kind => kind == "city").length;
    // The planet known from the board (#160): only City or Starport is asked
    if (cities == 0 || options.length == 0 || (id == "battleDestroyed" && battle.destroyed != null && battle.destroyed.planetKnown)) { return html; }

    html += "<div class=\"boardgrouplabel mt-3\">Planet (for the " + (cities == 1 ? "city" : "cities") + ")</div>"
        + "<select class=\"form-select form-select-sm\" id=\"" + id + "Planet\" onchange=\"" + onPlanet + "(this.value)\">"
        + options.map(option => "<option value=\"" + option.value + "\"" + (option.value == planet ? " selected" : "") + ">" + option.name + "</option>").join("") + "</select>";
    if (planet == "gate") {
        // The gate city's types: each city type in its cluster
        const ticked = battle.destroyed.gateTypes || [];
        html += "<div class=\"small fw-semibold mt-2\">The gate city's types: tick each city type in its cluster</div><div class=\"gatetypes\">"
            + preludeResources.map(resource => "<input type=\"checkbox\" class=\"btn-check\" id=\"gateType_" + resource + "\"" + (ticked.includes(resource) ? " checked" : "")
                + " onchange=\"toggleGateType('" + resource + "', this.checked)\"><label class=\"btn btn-outline-secondary btn-sm\" for=\"gateType_" + resource + "\">" + preludeResourceNames[resource] + "</label>").join("") + "</div>"
            + "<div class=\"small text-muted mt-1\">Destroying a gate city Provokes Outrage of every one of its types.</div>";
    }
    return html;
}

function getBuildingReason(attacker, defender, type) {
    // Why it hits this building first (#138), e.g. "no Outrage, and it's their last starport"
    if (type == "starport") {
        return "no Outrage, and " + ((defender.starportsValue || 0) <= 1 ? "it's their last starport" : "they can't build ships there");
    }
    if (type == "gate") {
        // A gate city: Outrage of every city type in its cluster (Gate Stations)
        const types = battle.boardSystem != null ? getGateCityTypes(battle.boardSystem) : [];
        return types.length > 0 ? "it's a gate city they can tax for " + types.map(resource => getResourceWord(resource)).join(" or ") + ", though destroying it Provokes Outrage of each" : "it's a gate city";
    }
    const resource = type.split(":").pop();
    const word = getResourceWord(resource);
    const reasons = [];
    const ransack = isMarketKnown() ? getRansackOptions(attacker, defender) : [];
    if (ransack.length > 0) { reasons.push("it Ransacks " + getCourtCard(ransack[0].number).name); }
    else if (!isMarketKnown()) { reasons.push("it Ransacks the Court"); }
    const cards = getPlayerGuildCards(attacker).filter(card => card.resource == resource && !card.keepOnOutrage);
    if ((attacker.outraged || []).includes(resource)) { reasons.push("it's already Outraged in " + word); }
    else if (attacker[resource + "Value"] == 0 && cards.length == 0) { reasons.push("it has no " + word + " to lose to Outrage"); }
    else if (getOutrageNeed(attacker, resource) == 0) { reasons.push("it doesn't need its " + word); }
    if (reasons.length == 0) { reasons.push("they lose a city they tax"); }
    return reasons.join(", and ");
}

function getBuildingName(type) {
    if (type == "starport") { return "the starport"; }
    if (type == "gate") { return "the gate city"; }
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

function getDefenderPieces() {
    // What the defender's "ships" are: in a campaign, Blight or Imperial ships (#164)
    return runCampaignHook("defenderPieces", battle.defender) || "ships";
}

function getHitAdvice(canAttackAgain) {
    // How the bot assigns the hits it rolls. The attacker chooses, for both sides' ships
    const pieces = getDefenderPieces();
    if (declaredAmbitions.includes("warlord")) {
        return "Destroy damaged " + pieces + " first: Warlord is declared and destroyed " + pieces + " are trophies.";
    }
    if (canAttackAgain) {
        return "Damage fresh " + pieces + " first, so the next attack faces fewer fresh " + pieces + (pieces == "Blight" ? "." : " and less risk of an ambush.");
    }
    return "Destroy damaged " + pieces + " first, then damage fresh ones.";
}

// The Battle window

function showBattleModal(button) {
    // Opened from the Battle icon on a bot's panel. That bot is attacking
    battle.attacker = getPlayer(getPlayerNumberFromString(button.parentNode.id));
    hideIconTooltip(button, "battleModal");
    battle.ships = 1;
    battle.attackerDamaged = 0;
    battle.capsAt = null;
    battle.fresh = 1;
    battle.damaged = 0;
    battle.freshBuildings = 0;
    battle.damagedBuildings = 0;
    battle.start = null;
    resetBattleRaid();

    const header = document.querySelector("#battleModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(battle.attacker));
    document.getElementById("battleTitle").innerHTML = "Player " + battle.attacker.number + " attacks";

    // The defender can be any other player, starting on who a bot would rather Battle. A human
    // player starts on a Rival their ships share a system with on the board (#160)
    const sharing = battle.attacker.isHuman ? players.find(player => player.number != battle.attacker.number && getBattlePlacesFor(battle.attacker, player).length > 0) : null;
    const target = !battle.attacker.isHuman ? getBattleTarget(battle.attacker) : (sharing != null ? { player: sharing } : null);
    const defenders = document.getElementById("battleDefenders");
    defenders.replaceChildren();
    players.filter(player => player.number != battle.attacker.number).forEach((player, index) => {
        const input = document.createElement("input");
        input.type = "radio";
        input.classList.add("btn-check");
        input.name = "battleDefender";
        input.id = "battleDefender" + player.number;
        // A different defender is a different battle, so its counts start again
        input.onchange = () => { battle.defender = player; battle.start = null; battle.ships = Math.max(battle.ships, 1); resetBattleRaid(); prefillBattleFromBoard(); updateBattleCounts(); };

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

    // In a campaign, the Empire, the Free States and the Blight can defend too (campaignhooks.js)
    runCampaignHook("battleDefenders", defenders);
    battle.noBuildings = hasNoBuildings(battle.defender);
    // A bot's counts from the board (boardbot.js, #160)
    prefillBattleFromBoard();
    // Fresh and damaged for everyone now the board tracks damage (#194): the human player's window
    // used to count ships and buildings only (#147)
    showBattleCountTiles(false);
    updateBattleCounts();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("battleModal")).show();
}

function showBattleCountTiles(simple) {
    // A human player attacking only needs how many ships and buildings take part: what was
    // destroyed comes from the totals. A bot needs fresh and damaged for its dice (#147)
    const tile = id => document.getElementById(id).closest(".resourcetile");
    ["battleDamaged", "battleDamagedBuildings"].forEach(id => tile(id).classList.toggle("d-none", simple));
    tile("battleFresh").querySelector(".resourcelabel").textContent = simple ? "Ships" : "Fresh";
    tile("battleFreshBuildings").querySelector(".resourcelabel").textContent = simple ? "Buildings" : "Fresh";
    const groupLabel = id => tile(id).parentNode.parentNode.querySelector(".boardgrouplabel");
    groupLabel("battleFresh").textContent = simple ? "Defender" : "Defender ships";
    // Kept but blank, so the two counts line up side by side
    groupLabel("battleFreshBuildings").innerHTML = simple ? "&nbsp;" : "Defender buildings";
}

function battleStep(field, change) {
    // The -/+ buttons (and the keys for a raid). The attacker needs a ship to start, but can
    // lose them all once it has rolled
    // Before the battle it needs at least one attacking ship, fresh or damaged
    const minimum = (field == "ships" && battle.start == null && !(battle.attackerDamaged > 0)) ? 1 : 0;
    // Each fresh count and its damaged one (#195)
    const pairs = { ships: "attackerDamaged", fresh: "damaged", freshBuildings: "damagedBuildings" };
    const damagedOf = pairs[field];
    const freshOf = Object.keys(pairs).find(key => pairs[key] == field);
    // Once the battle has started, a fresh ship or building lost is damaged, and a damaged one lost is destroyed
    if (change < 0 && battle.start != null && damagedOf != null && battle[field] > minimum) {
        battle[field] -= 1;
        battle[damagedOf] = (battle[damagedOf] || 0) + 1;
        updateBattleCounts();
        return;
    }
    battle[field] = Math.max(minimum, (battle[field] || 0) + change);
    // Never more than the board has in the battle system, fresh and damaged together (#195)
    const caps = getBattleCaps();
    const pairKey = damagedOf != null ? field : freshOf;
    if (caps != null && pairKey != null && change > 0) {
        const total = battle[pairKey] + (battle[pairs[pairKey]] || 0);
        if (total > caps[pairKey]) { battle[field] -= total - caps[pairKey]; }
    }
    updateBattleCounts();
}

function getBattleCaps() {
    // What the board has in the battle system: { ships, fresh, freshBuildings } as totals of fresh and
    // damaged, or null with no system from the board (#195)
    const system = battle.boardSystem;
    if (system == null || battle.attacker == null || battle.defender == null) { return null; }
    const mine = getShips(system, battle.attacker.number);
    const kind = battle.defender.campaignDefender;
    const theirs = kind == "blight" ? getBlight(system) : kind == "empire" ? getImperial(system) : kind == "free" ? { fresh: 0, damaged: 0 } : getShips(system, battle.defender.number);
    const buildings = kind == "free" ? getBuildings(system, freeOwner) : kind != null ? [] : getBuildings(system, battle.defender.number);
    // Counted when the window opened, so the caps don't shrink as the board changes after it
    if (battle.capsAt == null || battle.capsAt.system != system || battle.capsAt.defender != battle.defender.number) {
        battle.capsAt = { system: system, defender: battle.defender.number, ships: mine.fresh + mine.damaged, fresh: theirs.fresh + theirs.damaged, freshBuildings: buildings.length };
    }
    return battle.capsAt;
}

function updateBattleCounts() {
    document.getElementById("battleShips").innerHTML = battle.ships;
    document.getElementById("battleAttackerDamaged").innerHTML = battle.attackerDamaged || 0;
    document.getElementById("battleFresh").innerHTML = battle.fresh;
    document.getElementById("battleDamaged").innerHTML = battle.damaged;
    document.getElementById("battleFreshBuildings").innerHTML = battle.freshBuildings;
    document.getElementById("battleDamagedBuildings").innerHTML = battle.damagedBuildings;
    // "Defender Blight" or "Defender Imperial ships" in a campaign (#164)
    const label = document.getElementById("battleDefenderShipsLabel");
    if (label != null && battle.defender != null) { label.innerHTML = "Defender " + getDefenderPieces(); }
    showBattleRaid();
    clearBattleDecision();
}

// Raid dice: stealing from the defender

function hasNoBuildings(player) {
    return getCityCount(player) == 0 && (player.starportsValue || 0) == 0;
}

function resetBattleRaid() {
    battle.raidPlan = null;
    battle.keysRolled = null;
    // A defender with no cities or starports has no buildings on the board (#130)
    battle.noBuildings = battle.defender != null && hasNoBuildings(battle.defender);
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
    // One die per attacking ship, fresh or damaged (rulebook p.14), and 2 more with Gatekeepers in a gate
    return battle.ships + (battle.attackerDamaged || 0) + (battle.inGate && holdsGuildCard(battle.attacker, 8) ? 2 : 0) + getLeaderExtraDice(battle.attacker);
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
    // The Free States: 1 resource of the planet's type (campaignhooks.js)
    const special = runCampaignHook("raidWants", attacker, defender);
    if (special != null) { return special; }
    const guardians = getCourtCard(22);
    if ((defender.guildCards || []).includes(guardians.number)) {
        return [{ id: "guild:" + guardians.number, name: guardians.name, keys: guardians.keys, need: 0 }];
    }

    const resources = preludeResources.filter(resource => defender[resource + "Value"] > 0).map(resource => ({
        id: "resource:" + resource, resource: resource, name: preludeResourceNames[resource], need: getResourceNeed(attacker, resource)
    }));
    // A campaign's protected Guild cards can't be stolen
    const guildCards = getPlayerGuildCards(defender).filter(card => !card.protected).map(card => ({
        id: "guild:" + card.number, card: card.number, name: card.name, keys: card.keys, need: getResourceNeed(attacker, card.resource)
    }));
    // From the leader, what they need for an ambition counts too: taking it denies them (#200). Near
    // the target, as much as what the attacker itself needs most
    if (typeof getLeader == "function" && getLeader(attacker) === defender) {
        const denied = isLeaderNearTarget(defender) ? 2 : 1;
        resources.forEach(row => { if (getResourceNeed(defender, row.resource) == 2) { row.need = Math.max(row.need, denied); } });
        guildCards.forEach(row => { const card = getCourtCard(row.card); if (card != null && card.resource != null && getResourceNeed(defender, card.resource) == 2) { row.need = Math.max(row.need, denied); } });
    }
    return filterLeaderRaidWants(attacker, defender, resources.concat(guildCards)).sort((a, b) => b.need - a.need);
}

// A raid can steal several things: resources and Guild cards whose keys add up to no more than the
// keys rolled (#159). The plan is a row for each thing it could take, best first, each with its keys
// (a Guild card's are printed; a resource's are on its slot, so they're entered) and whether it's
// going for it

function getRaidPlan() {
    // Made once for this attacker and defender, then kept as it's ticked and its keys entered
    const key = battle.attacker.number + ">" + battle.defender.number;
    if (battle.raidPlan != null && battle.raidPlan.key == key) { return battle.raidPlan.rows; }
    const wants = getRaidWants(battle.attacker, battle.defender);
    const rows = [];
    wants.forEach(want => {
        // A resource once for each the defender holds, as each is in its own slot
        const count = want.resource != null ? Math.max(battle.defender[want.resource + "Value"], 1) : 1;
        for (let index = 0; index < count; index++) {
            rows.push({ id: want.id, resource: want.resource, name: want.name, nth: index + 1, keys: want.keys != null ? want.keys : 0, printed: want.keys != null, need: want.need, on: false });
        }
    });
    // What it goes for: what it needs, as many resources as it has room for (empty slots, or a
    // resource it doesn't need to swap out). Otherwise the most wanted thing, as before
    let room = getEmptySlots(battle.attacker) + preludeResources.filter(resource => getResourceNeed(battle.attacker, resource) == 0)
        .reduce((total, resource) => total + battle.attacker[resource + "Value"], 0);
    rows.forEach(row => {
        if (row.need == 0) { return; }
        if (row.resource == null) { row.on = true; return; }
        if (room > 0) { row.on = true; room--; }
    });
    if (rows.length > 0 && !rows.some(row => row.on)) { rows[0].on = true; }
    battle.raidPlan = { key: key, rows: rows };
    return rows;
}

function getBattleRaidItems() {
    // What the bot is after in this battle, best first. Once it has rolled raid dice that stands,
    // even if the roll destroyed the last building
    if (!isRaidAllowed() && !battle.raidRolled) { return []; }
    return getRaidPlan().filter(row => row.on);
}

function getRaidRowName(row) {
    // e.g. "1 Relic", "2nd Fuel", "Mining Interest"
    if (row.resource == null) { return row.name; }
    return (row.nth == 1 ? "1 " : row.nth == 2 ? "2nd " : row.nth == 3 ? "3rd " : row.nth + "th ") + preludeResourceNames[row.resource];
}

function getRaidItemsText(items) {
    // e.g. "Relic, Material and 2 Fuel"
    const counts = new Map();
    items.forEach(row => { const name = row.resource != null ? preludeResourceNames[row.resource] : row.name; counts.set(name, (counts.get(name) || 0) + 1); });
    const names = [...counts.entries()].map(([name, count]) => count == 1 ? name : count + " " + name + (name == "Fuel" ? "" : "s"));
    return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : (names[0] || "");
}

function getBattleRaid(buildingsAreTarget) {
    // What the dice choice needs to know about a raid: each thing it's going for, in order, with its
    // keys and worth. Without any keys entered it can't weigh it up
    const items = getBattleRaidItems().filter(row => row.keys > 0);
    if (items.length == 0) { return null; }
    const worth = items.map(row => ({ keys: row.keys, value: defaultBotPersonality.raidWeight * raidNeedFactor[row.need] }));
    return { keys: worth.reduce((total, item) => total + item.keys, 0), value: worth.reduce((total, item) => total + item.value, 0), items: worth, buildingsAreTarget: buildingsAreTarget };
}

function getBestRaidPick(items, keys) {
    // Which of items ({ keys, value }) a roll of this many keys takes: the most valuable set that
    // fits, and on a tie the one with things higher on the list. As [true/false] for each
    let best = { value: -1, pick: items.map(() => false) };
    const count = Math.min(items.length, 10);
    for (let mask = 0; mask < (1 << count); mask++) {
        let used = 0, value = 0;
        for (let index = 0; index < count; index++) {
            if (mask & (1 << index)) { used += items[index].keys; value += items[index].value; }
        }
        if (used > keys) { continue; }
        // Higher on the list breaks a tie: a lower bit set for an earlier item scores a little more
        // Before that, the set that uses more keys: taking from the dearer slot leaves the cheap
        // one to raid again later (#190)
        const tie = items.slice(0, count).reduce((total, item, index) => total + ((mask & (1 << index)) ? 1 / (1 << (index + 1)) : 0), 0) * 0.001 + Math.min(used, 50) * 0.002;
        if (value + tie > best.value) { best = { value: value + tie, pick: items.map((item, index) => index < count && (mask & (1 << index)) != 0) }; }
    }
    return best.pick;
}

function getRaidValueFor(raid, keys) {
    // What a roll of this many keys takes: the most valuable things it's going for that fit
    if (raid.items == null) { return keys >= raid.keys ? raid.value : 0; }
    const pick = getBestRaidPick(raid.items, keys);
    return raid.items.reduce((total, item, index) => total + (pick[index] ? item.value : 0), 0);
}

function toggleRaidRow(index) {
    const row = getRaidPlan()[index];
    row.on = !row.on;
    updateBattleCounts();
}

function stepRaidKeys(index, change) {
    const row = getRaidPlan()[index];
    row.keys = Math.max(row.keys + change, 0);
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

    // Why it would rather Battle this Rival, and where: the system from the board, or general advice
    const target = !battle.attacker.isHuman ? getBattleTarget(battle.attacker) : null;
    const where = battle.boardSystem != null ? "At " + getSystemName(battle.boardSystem) + ", from the board." : (target != null ? target.where : "");
    let html = (target != null && target.player === battle.defender)
        ? "<div class=\"small text-muted text-center mb-2\" id=\"battleTargetReason\">" + target.why + " " + where + "</div>" : "";
    if (holdsGuildCard(battle.attacker, 8) && battle.boardSystem != null) {
        // The board knows whether the battle is in a gate (#160)
        battle.inGate = isGate(battle.boardSystem);
        if (battle.inGate) { html += "<div class=\"small text-center mb-2\">In a gate: Gatekeepers gives 2 more dice.</div>"; }
    } else if (holdsGuildCard(battle.attacker, 8)) {
        html += "<div class=\"form-check form-switch d-flex justify-content-center gap-2\">"
            + "<input class=\"form-check-input\" type=\"checkbox\" id=\"battleInGate\" onchange=\"setInGate(this.checked)\"" + (battle.inGate ? " checked" : "") + ">"
            + "<label class=\"form-check-label\" for=\"battleInGate\">In a gate (Gatekeepers: 2 more dice)</label></div>";
    }
    // What the buildings are, as destroying a city and a starport are very different. With no
    // cities, they can only be starports
    if (battle.freshBuildings + battle.damagedBuildings > 0 && getPlanetOptions(battle.defender).length > 0) {
        getBattleBuildingTypes();
        html += getBuildingChoiceHtml("battleBuilding", battle.planet, battle.buildingKinds,
            index => (index < battle.freshBuildings ? "Fresh" : "Damaged") + " building", "setBattlePlanet", "setBuildingKind");
    }
    // The app knows from its counters when the defender has no buildings, so it says so (#137)
    if (battle.freshBuildings + battle.damagedBuildings == 0 && battle.noBuildings) {
        html += "<div class=\"nobuildingsnote\" id=\"battleNoBuildingsNote\"><i class=\"bi bi-info-circle\"></i> " + defender + " has no buildings on the board, so raid dice are available.</div>";
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

    // Each thing it could take, best first: tick what it goes for, and enter the keys (#159)
    const rows = getRaidPlan();
    const chasing = row => row.need == 2 ? (row.resource != null ? "it's chasing " + capitalise(preludeAmbitions[row.resource] || "warlord") : "it's chasing this") : row.resource == null ? "Guild card" : "";
    html += "<div class=\"boardgrouplabel mt-2\">Raid: steal from " + defender + "</div>"
        + "<p class=\"small text-muted mb-1 text-center\">What it wants, best first. Enter the keys on each slot of " + defender + "'s board.</p><div id=\"battleRaidPlan\">"
        + rows.map((row, index) => "<div class=\"raidrow" + (row.on ? " on" : "") + "\"><input class=\"form-check-input m-0\" type=\"checkbox\" id=\"battleRaidRow" + index + "\"" + (row.on ? " checked" : "") + " onchange=\"toggleRaidRow(" + index + ")\">"
            + "<label class=\"raidname\" for=\"battleRaidRow" + index + "\">" + (row.resource != null ? getGameIcon(row.resource) + " " : "") + getRaidRowName(row) + (chasing(row) ? "<small>" + chasing(row) + "</small>" : "") + "</label>"
            + (row.printed ? "<span class=\"small text-muted\">" + row.keys + " key" + (row.keys == 1 ? "" : "s") + ", printed</span>"
                : "<span class=\"raidkeys\"><button class=\"btn resourcebutton resourceminus\" type=\"button\" onclick=\"stepRaidKeys(" + index + ", -1)\" aria-label=\"One key fewer\"><i class=\"bi bi-dash-lg\"></i></button>"
                    + "<b id=\"battleRaidKeys" + index + "\">" + row.keys + "</b><button class=\"btn resourcebutton resourceplus\" type=\"button\" onclick=\"stepRaidKeys(" + index + ", 1)\" aria-label=\"One key more\"><i class=\"bi bi-plus-lg\"></i></button></span>")
            + "</div>").join("") + "</div>";
    const items = getBattleRaidItems();
    const unknown = items.filter(row => row.keys == 0);
    const total = items.reduce((sum, row) => sum + row.keys, 0);
    html += "<div class=\"raidtotal\" id=\"battleRaidTotal\">" + (items.length == 0 ? "Not raiding."
        : "Raiding for <b>" + getRaidItemsText(items) + ": " + total + " key" + (total == 1 ? "" : "s") + "</b>." + (unknown.length > 0 ? " Enter the keys for " + getRaidItemsText(unknown) + "." : " The dice it chooses aim for that.")) + "</div>";
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
            // Damaged ships roll dice too (rulebook p.14)
            : (battle.ships + (battle.attackerDamaged || 0) == 0
                ? "It has no ships left. Done battling updates the values."
                : "To attack again, choose the dice. Otherwise, Done battling updates the values."));
    document.getElementById("battleAdvice").innerHTML = "<div class=\"text-muted\">" + advice + "</div>";
    document.getElementById("chooseBattleDice").innerHTML = isHuman ? "Start battle" : "Choose dice";
    showHideElement([document.getElementById("chooseBattleDice")], !(battle.start != null && (isHuman || battle.ships + (battle.attackerDamaged || 0) == 0)));
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
    // How loosely it chooses depends on the difficulty (#71)
    const mood = getBattleMood(getBotPersonality());
    const raid = getBattleRaid(onPurpose);
    if (!hasShips && buildings.every(building => building.value < 0) && raid == null) {
        advice.innerHTML = "<div class=\"battleroll\">Don't attack</div><div class=\"fst-italic\">Destroying "
            + buildings.map(building => getBuildingName(building.type)).join(" or ") + " would cost it more than it gains.</div>";
        return;
    }
    const raidText = getRaidItemsText(getBattleRaidItems().filter(row => row.keys > 0));
    const buildingScores = getBuildingScores(buildings);
    // With no ships to hit and no building it wants destroyed, only raid dice are any use (#113)
    const raidOnly = !hasShips && !onPurpose && raid != null && Math.max(...buildingScores) <= 0;
    // In a campaign the Blight takes 2 hits to damage or destroy, and doesn't intercept (campaignhooks.js)
    const targets = runCampaignHook("battleTargets") || { fresh: battle.fresh, damaged: battle.damaged, limits: {} };
    const limits = { ...getBattleLimits(), ...targets.limits, raidOnly: raidOnly };
    const options = onPurpose
        ? getDiceOptions(getBattleDiceLimit(), 0, buildingHits, 0, mood, raid, getBattleRerolls(), [], limits)
        : getDiceOptions(getBattleDiceLimit(), targets.fresh, targets.damaged, buildingHits, mood, raid, getBattleRerolls(), buildingScores, limits);

    // With no ships to hit, attacking at all can cost more than it gains: a raid that would
    // almost certainly destroy a city it doesn't want destroyed (#113)
    if (!hasShips && Math.max(...options.map(option => option.score)) < 0) {
        advice.innerHTML = "<div class=\"battleroll\">Don't attack</div><div class=\"fst-italic\">Raiding here would probably destroy "
            + buildings.map(building => getBuildingName(building.type)).join(" or ") + ", which would cost it more than it would steal.</div>";
        return;
    }
    const interceptHits = (limits.interceptHits != null) ? limits.interceptHits : battle.fresh;
    const choice = pickDiceOption(options);
    // From its plan: another Battle after this one (#205). No switch to set any more
    const canAttackAgain = !battle.attacker.isHuman && (battle.attacker.turnPlan || []).filter(step => step.action == "battle" && !step.applied).length >= 2;
    const usefulHits = onPurpose ? buildingHits : getHitsToDestroy(targets.fresh, targets.damaged);
    const wantedBuilding = buildings.find(building => building.value > 0);
    // Which building first, and why (#138). The attacker chooses where its hits go (rulebook p.14)
    const buildingOrder = (buildings.length > 1 && new Set(buildings.map(building => building.value)).size > 1)
        ? ": " + buildings.map(building => getBuildingName(building.type)).join(", then ") + ". "
            + capitalise(getBuildingName(buildings[0].type)) + " first: " + getBuildingReason(battle.attacker, battle.defender, buildings[0].type) : "";

    // The other options and how likely each was, so the weighting can be checked
    const others = options.filter(option => option !== choice && option.pickChance >= 0.01)
        .sort((a, b) => b.pickChance - a.pickChance)
        .map(option => describeDice(option) + " " + Math.round(option.pickChance * 100) + "%");

    const moodText = (mood.mood > 0.15) ? "more careful than usual" : (mood.mood < -0.15) ? "bolder than usual" : "about as usual";

    // Only what a human opponent would say is shown. The numbers behind the decision are
    // in Details, closed to start with
    // The dice line gives a shake when the choice is new
    const rollShake = battle.lastRoll != describeDice(choice);
    battle.lastRoll = describeDice(choice);
    advice.innerHTML = getLeaderBattleSetupNote()
        + "<div class=\"battleroll" + (rollShake ? " diceshake" : "") + "\">Roll " + describeDice(choice) + "</div>"
        + "<div class=\"fst-italic\">" + ((raid != null && choice.raidDice > 0) ? "Going after their " + raidText + "." : getBattleAttitude(choice, getBattleDiceLimit())
            + (raid != null ? " Their " + raidText + (raid.items.length == 1 ? " isn't" : " aren't") + " worth the risk." : "")
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
    if (choice.raidDice > 0) { battle.raidRolled = true; battle.keysRolled = null; }
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
    showCityEffects();
}

function showCityEffects() {
    // The Outrage warning and the Ransack choice, only when a destroyed building is a city (#149)
    const effects = document.getElementById("battleCityEffects");
    if (effects == null || battle.destroyed == null) { return; }
    const cityDestroyed = battle.destroyed.kinds.some(kind => kind != "starport") && (battle.destroyed.planetKnown || getPlanetOptions(battle.defender, true).length > 0);
    effects.classList.toggle("d-none", !cityDestroyed);
}

function toggleGateType(resource, ticked) {
    const types = (battle.destroyed.gateTypes || []).filter(type => type != resource);
    battle.destroyed.gateTypes = ticked ? types.concat(resource) : types;
}

function setDestroyedKind(index, kind) {
    battle.destroyed.kinds[index] = kind;
    document.getElementById("battleDestroyed").innerHTML = getDestroyedHtml();
    showCityEffects();
}

function getBattleLosses() {
    // What each side lost since the first roll, from the counts now
    const lost = (before, after) => Math.max(before - after, 0);
    return {
        // A fresh ship turned damaged isn't lost (#189)
        attackerShips: lost(battle.start.ships + (battle.start.attackerDamaged || 0), battle.ships + (battle.attackerDamaged || 0)),
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
        // From the board (#160): the defender's buildings in the battle system, and its planet. Only
        // a city and a starport there, not all destroyed, needs asking which went (the user)
        const known = getBoardDestroyed(losses.defenderBuildings);
        if (known != null && !known.ask) {
            battle.destroyed = { planet: known.planet, kinds: known.kinds, gateTypes: known.gateTypes, planetKnown: true };
            html += "<div class=\"mt-2\">" + defender + ": " + known.kinds.map(kind => kind != "city" ? "the starport at " + getSystemName(battle.boardSystem)
                : known.planet == "gate" ? "the gate city at " + getSystemName(battle.boardSystem) + (known.gateTypes.length > 0 ? " (" + known.gateTypes.map(resource => preludeResourceNames[resource]).join(", ") + ")" : "")
                : "the city on " + getSystemName(battle.boardSystem)).join(" and ") + " destroyed.</div>"
                + "<div id=\"battleDestroyed\"></div>";
        } else {
            html += "<div class=\"mt-2\">" + defender + ": " + plural(losses.defenderBuildings, "building") + " destroyed. " + (losses.defenderBuildings == 1 ? "What was it?" : "What were they?") + "</div>";

            // Filled in from what was said before the roll. The human player starts on starports, so
            // nothing Provokes Outrage by mistake. With no cities, they can only be starports
            const destroyed = getDestroyedBuildingTypes();
            const city = destroyed.find(type => type != "starport");
            const options = getPlanetOptions(battle.defender);
            const planet = known != null ? known.planet : ((city != null) ? city.split(":").pop() : battle.planet);
            battle.destroyed = {
                planet: known != null || options.some(option => option.value == planet) ? planet : getFirstPlanet(battle.defender),
                kinds: Array.from({ length: losses.defenderBuildings }, (_, index) => (battle.attacker.isHuman || options.length == 0 || destroyed[index] == "starport") ? "starport" : "city"),
                gateTypes: known != null ? known.gateTypes : [],
                // The planet is known from the board: only City or Starport is asked
                planetKnown: known != null
            };
            html += "<div id=\"battleDestroyed\">" + (options.length > 0 || known != null ? getDestroyedHtml() : "") + "</div>";
        }
        // Only once a city is chosen: a starport doesn't Provoke Outrage or Ransack the Court (#149)
        const canRansack = canRansackAgainst(battle.defender);
        html += "<div id=\"battleCityEffects\"><div class=\"alert alert-warning py-2 px-3 mt-2 mb-0 small\"><b>Destroying a city:</b> " + attacker + " Provokes Outrage of that resource, discarding its resources and Guild cards of that type"
            + (canRansack ? ", and Ransacks the Court.</div>" : ". " + defender + " is the Elder, so there's no Ransack (Beloved).</div>");

        // Ransack: which card? With no market entered, the player carries it out
        const ransack = (isMarketKnown() && canRansack) ? getRansackOptions(battle.attacker, battle.defender) : [];
        if (ransack.length > 0) {
            html += "<div class=\"mt-2\">The city was destroyed, so Ransack:</div><select class=\"form-select form-select-sm mt-1\" id=\"battleRansack\">"
                + ransack.map(entry => "<option value=\"" + entry.number + "\">" + getCourtCard(entry.number).name + "</option>").join("") + "<option value=\"\">Nothing</option></select>";
        }
        html += "</div>";
    }

    html += getLeaderBattleResultsHtml(losses);

    // The human player says what they stole, if anything: only when a raid was possible, a
    // building here or the defender with none on the board (#128). With no attacking ships left, no
    // one can spend the keys (rulebook p.16)
    const startBuildings = (battle.start != null) ? battle.start.freshBuildings + battle.start.damagedBuildings : 0;
    // Raiding needs any attacking ship left, damaged ones too (rulebook: "if any attacking ships remain", #199)
    if (battle.attacker.isHuman && battle.ships + (battle.attackerDamaged || 0) > 0 && isLeaderRaidAllowed(startBuildings > 0 || battle.noBuildings)) {
        const wants = getRaidWants(battle.attacker, battle.defender);
        if (wants.length > 0) {
            // A resource can be stolen more than once, up to how many they hold (#144). A Guild card is ticked
            html += "<div class=\"mt-2\">What did you steal?</div><div class=\"stealist mt-1\" id=\"battleStolenItems\">"
                + wants.map((want, index) => {
                    if (want.resource != null) {
                        const held = battle.defender[want.resource + "Value"];
                        return "<div class=\"stealrow\"><div>" + getGameIcon(want.resource) + " " + want.name + " <small>(they have " + held + ")</small></div>"
                            + "<div class=\"stealstep\" data-id=\"" + want.id + "\" data-max=\"" + held + "\" data-count=\"0\">"
                            + "<button type=\"button\" class=\"btn btn-outline-secondary\" aria-label=\"One fewer " + want.name + "\" onclick=\"stepStolen(this, -1)\"><i class=\"bi bi-dash-lg\"></i></button>"
                            + "<b>0</b><button type=\"button\" class=\"btn btn-outline-secondary\" aria-label=\"One more " + want.name + "\" onclick=\"stepStolen(this, 1)\"><i class=\"bi bi-plus-lg\"></i></button></div></div>";
                    }
                    return "<div class=\"stealrow\"><label class=\"flex-fill\" for=\"battleStolen" + index + "\">" + want.name + " <small>(Guild card)</small></label>"
                        + "<input class=\"form-check-input m-0\" type=\"checkbox\" id=\"battleStolen" + index + "\" value=\"" + want.id + "\"></div>";
                }).join("") + "</div>";
        }
    }

    // If the bot rolled raid dice: the keys rolled, and what that takes (#159)
    if (!battle.attacker.isHuman && battle.raidRolled && getBattleRaidItems().length > 0 && battle.ships + (battle.attackerDamaged || 0) > 0) {
        html += "<div id=\"battleRaidResult\">" + getRaidResultHtml() + "</div>";
    }

    html += "<div class=\"d-flex gap-2 mt-3\">"
        + "<button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"clearBattleDecision()\">Back</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"battleUpdate\" onclick=\"applyBattleResults()\">Update values</button>"
        + "</div>";

    document.getElementById("battleAdvice").innerHTML = html;
    showCityEffects();
    showHideElement([document.getElementById("chooseBattleDice"), document.getElementById("battleDone")], false);
}

function getRaidResultHtml() {
    // The keys rolled (it starts on 0, to be set to what was rolled: #175), and the things that
    // takes, ticked: what it wants most that still fits. Untick anything it didn't take
    const items = getBattleRaidItems();
    if (battle.keysRolled == null) {
        battle.keysRolled = 0;
        battle.raidTaken = null;
    }
    if (battle.raidTaken == null) {
        // The most valuable things that fit in the keys rolled (rows with no keys entered can't be weighed)
        const worth = items.map(row => ({ keys: row.keys > 0 ? row.keys : 99, value: defaultBotPersonality.raidWeight * raidNeedFactor[row.need] }));
        battle.raidTaken = getBestRaidPick(worth, battle.keysRolled);
    }
    const taken = items.filter((row, index) => battle.raidTaken[index]);
    const used = taken.reduce((total, row) => total + row.keys, 0);
    return "<div class=\"boardgrouplabel mt-2\">Raid result</div>"
        + "<div class=\"d-flex justify-content-center mb-2\"><div class=\"resourcetile\"><div class=\"resourcelabel\">Keys rolled</div><div class=\"resourcevalue\" id=\"battleKeysRolled\">" + battle.keysRolled + "</div>"
        + "<div class=\"d-flex gap-1\"><button class=\"btn resourcebutton resourceminus\" type=\"button\" onclick=\"stepKeysRolled(-1)\" aria-label=\"One key fewer\"><i class=\"bi bi-dash-lg\"></i></button>"
        + "<button class=\"btn resourcebutton resourceplus\" type=\"button\" onclick=\"stepKeysRolled(1)\" aria-label=\"One key more\"><i class=\"bi bi-plus-lg\"></i></button></div></div></div>"
        + "<p class=\"small text-muted mb-1 text-center\">" + (battle.keysRolled == 0 ? "Set the keys rolled with + and &minus;. " : "")
        + "It takes what it wants most that adds up to " + battle.keysRolled + " key" + (battle.keysRolled == 1 ? "" : "s") + " or fewer. Untick anything it didn't take.</p>"
        + "<div id=\"battleRaidTaken\">" + items.map((row, index) => "<div class=\"raidrow\"><input class=\"form-check-input m-0\" type=\"checkbox\" id=\"battleTaken" + index + "\"" + (battle.raidTaken[index] ? " checked" : "") + " onchange=\"toggleRaidTaken(" + index + ")\">"
            + "<label class=\"raidname\" for=\"battleTaken" + index + "\">" + (row.resource != null ? getGameIcon(row.resource) + " " : "") + getRaidRowName(row) + "<small>" + row.keys + " key" + (row.keys == 1 ? "" : "s")
            + (!battle.raidTaken[index] && row.keys > battle.keysRolled - used ? ": no keys left" : "") + "</small></label></div>").join("") + "</div>"
        + "<div class=\"raidtotal\">" + (taken.length > 0 ? "Steals <b>" + getRaidItemsText(taken) + "</b> (" + used + " of " + battle.keysRolled + " keys). Update values moves them on the panels." : "Steals nothing.") + "</div>";
}

function stepKeysRolled(change) {
    battle.keysRolled = Math.max(battle.keysRolled + change, 0);
    battle.raidTaken = null;
    document.getElementById("battleRaidResult").innerHTML = getRaidResultHtml();
}

function toggleRaidTaken(index) {
    battle.raidTaken[index] = !battle.raidTaken[index];
    document.getElementById("battleRaidResult").innerHTML = getRaidResultHtml();
}

function getRaidTakenItems() {
    // What the bot stole, as raid wants ({ id, resource, name })
    if (battle.raidTaken == null || document.getElementById("battleRaidTaken") == null) { return []; }
    return getBattleRaidItems().filter((row, index) => battle.raidTaken[index]);
}

function stepStolen(button, change) {
    // One more or fewer of a resource you stole, from 0 to how many they hold (#144)
    const step = button.closest(".stealstep");
    const count = Math.min(Math.max(parseInt(step.dataset.count) + change, 0), parseInt(step.dataset.max));
    step.dataset.count = count;
    step.querySelector("b").textContent = count;
}

function getStolenText(stolenItems) {
    // e.g. "2 psionics and the Skirmishers"
    const parts = [];
    stolenItems.forEach(stolen => {
        if (parts.some(part => part.id == stolen.id)) { parts.find(part => part.id == stolen.id).count++; return; }
        parts.push({ id: stolen.id, resource: stolen.resource, name: stolen.name, count: 1 });
    });
    return parts.map(part => part.resource == null ? "the " + part.name
        : (part.count == 1 ? "1 " + preludeResourceNames[part.resource].toLowerCase() : part.count + " " + getResourceWord(part.resource))).join(" and ");
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
    // A campaign's Empire, Free States or Blight as the defender (campaignhooks.js)
    if (runCampaignHook("applyBattle", losses) === true) {
        // What's left in the battle system goes on the board too (#85 stage 7b)
        applyBattleToBoard(losses);
        battle.start = null;
        SaveAllSettings();
        refreshTurnSummary();
        bootstrap.Modal.getOrCreateInstance(document.getElementById("battleModal")).hide();
        return;
    }

    // Destroyed ships leave the board and become the other side's trophies
    adjustCounter(defender, "shipsBoard", -losses.defenderShips);
    adjustCounter(attacker, "trophies", losses.defenderShips);
    adjustCounter(attacker, "shipsBoard", -losses.attackerShips);
    adjustCounter(defender, "trophies", losses.attackerShips);
    // Whose ships they are, so a bot knows how many it has left to build (#160)
    defender.shipsTrophy = (defender.shipsTrophy || 0) + losses.defenderShips;
    attacker.shipsTrophy = (attacker.shipsTrophy || 0) + losses.attackerShips;

    // Destroyed buildings are the attacker's Trophies (starports aren't otherwise counted). A city
    // leaves the map, but its slot stays open until the Trophies are returned. The attacker
    // then Provokes Outrage of that resource and Ransacks the Court (rulebook p.16)
    let cities = [];
    adjustCounter(attacker, "trophies", losses.defenderBuildings);
    const destroyedTypes = (losses.defenderBuildings > 0 && battle.destroyed != null) ? getBuildingTypesOn(defender, battle.destroyed.planet, battle.destroyed.kinds) : [];
    destroyedTypes.forEach(type => {
        if (type == "starport") {
            // One starport fewer on the board (#130)
            if ((defender.starportsValue || 0) > 0) { adjustCounter(defender, "starports", -1); }
            return;
        }
        if (type == "gate") {
            // A gate city (Gate Stations): Outrage of each of its types (#120). It's counted on the
            // defender's panel as one of them
            defender.citiesAsTrophies = (defender.citiesAsTrophies || 0) + 1;
            const gateTypes = battle.destroyed.gateTypes || [];
            const counted = gateTypes.find(resource => defender["cities" + capitalise(resource) + "Value"] > 0);
            if (counted != null) { adjustCounter(defender, "cities" + capitalise(counted), -1); }
            gateTypes.forEach(resource => provokeOutrage(attacker, resource));
            cities.push("the gate city" + (gateTypes.length > 0 ? " (" + gateTypes.map(resource => preludeResourceNames[resource].toLowerCase()).join(", ") + ")" : ""));
            return;
        }
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
    const stolenList = document.getElementById("battleStolenItems");
    const wants = getRaidWants(attacker, defender);
    // Each resource once for each one stolen (#144), and each Guild card ticked. A bot: what its
    // raid took (#159)
    const stolenItems = (stolenList != null)
        ? [...stolenList.querySelectorAll(".stealstep")].flatMap(step => Array(parseInt(step.dataset.count)).fill(step.dataset.id))
            .concat([...stolenList.querySelectorAll("input:checked")].map(input => input.value))
            .map(id => wants.find(want => want.id == id)).filter(want => want != null)
        : getRaidTakenItems();
    stolenItems.forEach(stolen => {
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
    });
    // A bot with no room for what it stole returns what it needs least (#172)
    const roomNote = stolenItems.some(stolen => stolen.resource != null) ? returnOverCapacity(attacker) : null;
    // What's left in the battle system goes on the board (boardbot.js, #160)
    applyBattleToBoard(losses);
    // A human player's Battle counts as one of their actions (boardhuman.js)
    recordHumanBattle(attacker, defender, battle.boardSystem);

    // A campaign's objectives can advance for Trophies taken (campaignhooks.js)
    runCampaignHook("afterBattle", losses);
    SaveAllSettings();
    refreshTurnSummary();
    showMessageToast("Player " + attacker.number + " attacked Player " + defender.number,
        "Ships destroyed: " + losses.defenderShips + " (Player " + defender.number + "), " + losses.attackerShips + " (Player " + attacker.number + ")"
        + (losses.defenderBuildings > 0 ? "<br>Buildings destroyed: " + losses.defenderBuildings + (cities.length > 0 ? " (cities: " + cities.join(", ") + ")" : "") : "")
        + (cities.length > 0 ? "<br>Player " + attacker.number + " Provokes Outrage: " + cities.join(", ") : "")
        + (ransacked != null ? "<br>Ransacked " + ransacked.name + ". Add its replacement to the market." : (cities.length > 0 && canRansackAgainst(defender) ? "<br>Ransack the Court." : ""))
        + leaderLines.map(line => "<br>" + line).join("")
        + (stolenItems.length > 0 ? "<br>Stole " + getStolenText(stolenItems) : "")
        + (roomNote != null ? "<br>" + roomNote : "")
        + (cities.length > 0 && getOverCapacityAdvice(defender) != null ? "<br>" + getOverCapacityAdvice(defender) : ""));

    battle.start = null;

    // A Ransacked Vox card resolves once this window has closed: a bot's decision, or a human
    // player's window (#204)
    const battleModal = document.getElementById("battleModal");
    if (ransacked != null && ransacked.type == "vox") {
        battleModal.addEventListener('hidden.bs.modal', () => {
            if (attacker.isHuman) { showVoxForPlayer(attacker, ransacked); return; }
            showVoxCard(attacker, ransacked);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
        }, { once: true });
    }
    bootstrap.Modal.getOrCreateInstance(battleModal).hide();
}
