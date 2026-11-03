// Battle: helping a bot that's attacking another player choose its dice and how to
// assign the hits. The dice and the bot's personality are in rules.js.
// Hits left over once every defending ship is destroyed go to the defender's buildings, and
// destroying one causes Outrage, so when there are buildings the bot may roll fewer dice than
// it could. Raid dice aren't included yet (see the placeholder in the Battle window)
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// What's entered in the Battle window
let battle = { attacker: null, defender: null, ships: 1, fresh: 1, damaged: 0, freshBuildings: 0, damagedBuildings: 0, start: null };

// The counts compared before and after the battle
const battleCounts = ["ships", "fresh", "damaged", "freshBuildings", "damagedBuildings"];

function getHitsToDestroy(fresh, damaged) {
    // Ships and buildings both take one hit to damage a fresh one and another to destroy it
    return fresh * 2 + damaged;
}

function getDiceOutcomes(assaultDice, skirmishDice) {
    // Every possible result of rolling the dice, as { hits, damage, ambush, chance }.
    // Results that are the same are combined, so this stays small
    let outcomes = [{ hits: 0, damage: 0, ambush: false, chance: 1 }];

    const rollDie = faces => {
        let next = new Map();
        outcomes.forEach(outcome => {
            faces.forEach(face => {
                const result = {
                    hits: outcome.hits + (face.hits || 0),
                    damage: outcome.damage + (face.damage || 0),
                    ambush: outcome.ambush || face.ambush == true
                };
                const key = result.hits + "|" + result.damage + "|" + result.ambush;
                const chance = outcome.chance / faces.length;

                if (next.has(key)) {
                    next.get(key).chance += chance;
                } else {
                    next.set(key, { ...result, chance: chance });
                }
            });
        });
        outcomes = [...next.values()];
    };

    for (let die = 0; die < assaultDice; die++) { rollDie(assaultDieFaces); }
    for (let die = 0; die < skirmishDice; die++) { rollDie(skirmishDieFaces); }

    return outcomes;
}

function evaluateDice(assaultDice, skirmishDice, fresh, damaged, buildingHits, personality) {
    // How good rolling these dice is: the hits on ships (no more than it takes to destroy
    // every defending ship) minus the damage the attacker expects to take, from its own dice
    // and from an ambush (one hit per fresh defending ship), minus the hits left over that
    // go to the defender's buildings (buildingHits is how many it takes to destroy them all)
    const usefulHits = getHitsToDestroy(fresh, damaged);

    let expectedHits = 0;
    let expectedBuildingHits = 0;
    let expectedDamage = 0;
    let ambushChance = 0;

    getDiceOutcomes(assaultDice, skirmishDice).forEach(outcome => {
        expectedHits += Math.min(outcome.hits, usefulHits) * outcome.chance;
        expectedBuildingHits += Math.min(Math.max(outcome.hits - usefulHits, 0), buildingHits) * outcome.chance;
        expectedDamage += (outcome.damage + (outcome.ambush ? fresh : 0)) * outcome.chance;
        if (outcome.ambush) { ambushChance += outcome.chance; }
    });

    return {
        assaultDice: assaultDice,
        skirmishDice: skirmishDice,
        expectedHits: expectedHits,
        expectedBuildingHits: expectedBuildingHits,
        expectedDamage: expectedDamage,
        ambushChance: ambushChance,
        score: expectedHits - personality.riskWeight * expectedDamage - personality.buildingWeight * expectedBuildingHits
    };
}

function getDiceOptions(ships, fresh, damaged, buildingHits, personality) {
    // Every mix of assault and skirmish dice (up to one die per ship and maxDicePerType of
    // each), with the chance the bot picks each. Skirmish dice can't hurt the attacker, so
    // with no buildings to hit the ships not rolling assault roll skirmish, up to the limit.
    // With buildings, rolling fewer dice than it could is an option too, to avoid hitting them.
    // Options close to the best are picked almost as often as the best (a person can't tell
    // them apart and guesses), but clearly worse ones quickly become rare.
    // personality.randomness sets how far from the best counts as "close"
    let options = [];
    for (let assaultDice = 0; assaultDice <= Math.min(ships, maxDicePerType); assaultDice++) {
        const mostSkirmishDice = Math.min(ships - assaultDice, maxDicePerType);
        const fewestSkirmishDice = (buildingHits > 0) ? (assaultDice == 0 ? 1 : 0) : mostSkirmishDice;
        for (let skirmishDice = fewestSkirmishDice; skirmishDice <= mostSkirmishDice; skirmishDice++) {
            options.push(evaluateDice(assaultDice, skirmishDice, fresh, damaged, buildingHits, personality));
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
    if (choice.assaultDice + choice.skirmishDice < getMostDice(ships)) { return "Holding back: no need to hit their buildings."; }
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
    return dice.join(" + ");
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
    document.getElementById("battleAttackAgain").checked = false;

    const header = document.querySelector("#battleModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + battle.attacker.number);
    document.getElementById("battleTitle").innerHTML = "Player " + battle.attacker.number + " attacks";

    // The defender can be any other player
    const defenders = document.getElementById("battleDefenders");
    defenders.replaceChildren();
    players.filter(player => player.number != battle.attacker.number).forEach((player, index) => {
        const input = document.createElement("input");
        input.type = "radio";
        input.classList.add("btn-check");
        input.name = "battleDefender";
        input.id = "battleDefender" + player.number;
        // A different defender is a different battle, so its counts start again
        input.onchange = () => { battle.defender = player; battle.start = null; clearBattleDecision(); };

        const label = document.createElement("label");
        label.classList.add("btn", "btn-outline-secondary", "btn-sm");
        label.htmlFor = input.id;
        label.innerHTML = "Player " + player.number;

        if (index == 0) {
            input.checked = true;
            battle.defender = player;
        }
        defenders.append(input, label);
    });

    updateBattleCounts();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("battleModal")).show();
}

function battleStep(field, change) {
    // The -/+ buttons. The attacker has at least one ship
    const minimum = (field == "ships") ? 1 : 0;
    battle[field] = Math.max(minimum, battle[field] + change);
    updateBattleCounts();
}

function updateBattleCounts() {
    document.getElementById("battleShips").innerHTML = battle.ships;
    document.getElementById("battleFresh").innerHTML = battle.fresh;
    document.getElementById("battleDamaged").innerHTML = battle.damaged;
    document.getElementById("battleFreshBuildings").innerHTML = battle.freshBuildings;
    document.getElementById("battleDamagedBuildings").innerHTML = battle.damagedBuildings;
    clearBattleDecision();
}

function clearBattleDecision() {
    // Anything changed, so the bot needs to choose again. Once it has rolled, the counts are
    // what's left, so it can attack again or finish
    document.getElementById("battleAdvice").innerHTML = (battle.start == null)
        ? "<div class=\"text-muted\">Set up the battle, then choose the dice.</div>"
        : "<div class=\"text-muted\">To attack again, choose the dice. Otherwise, Done battling updates the players' panels.</div>";
    document.getElementById("chooseBattleDice").innerHTML = "Choose dice";
    showHideElement([document.getElementById("chooseBattleDice")], true);
    showHideElement([document.getElementById("battleDone")], battle.start != null);
}

function chooseBattleDice() {
    const advice = document.getElementById("battleAdvice");

    const hasShips = battle.fresh + battle.damaged > 0;
    const buildingHits = getHitsToDestroy(battle.freshBuildings, battle.damagedBuildings);
    if (!hasShips && buildingHits == 0) {
        advice.innerHTML = "<div class=\"text-muted\">Player " + battle.defender.number + " has nothing to attack.</div>";
        return;
    }

    // This battle's mood, then a loose pick weighted towards the better options. With no
    // defending ships the bot is attacking the buildings on purpose, so hits on them are what
    // it wants: they count like hits on ships (buildings don't ambush) and nothing is held back
    const mood = getBattleMood(defaultBotPersonality);
    const options = hasShips
        ? getDiceOptions(battle.ships, battle.fresh, battle.damaged, buildingHits, mood)
        : getDiceOptions(battle.ships, 0, buildingHits, 0, mood);
    const choice = pickDiceOption(options);
    const canAttackAgain = document.getElementById("battleAttackAgain").checked;
    const usefulHits = hasShips ? getHitsToDestroy(battle.fresh, battle.damaged) : buildingHits;

    // The other options and how likely each was, so the weighting can be checked
    const others = options.filter(option => option !== choice && option.pickChance >= 0.01)
        .sort((a, b) => b.pickChance - a.pickChance)
        .map(option => describeDice(option) + " " + Math.round(option.pickChance * 100) + "%");

    const moodText = (mood.mood > 0.15) ? "more careful than usual" : (mood.mood < -0.15) ? "bolder than usual" : "about as usual";

    // Only what a human opponent would say is shown. The numbers behind the decision are
    // in Details, closed to start with
    advice.innerHTML =
        "<div class=\"battleroll\">Roll " + describeDice(choice) + "</div>"
        + "<div class=\"fst-italic\">" + getBattleAttitude(choice, battle.ships) + "</div>"
        + "<div class=\"mt-2\"><b>Assign hits:</b> "
        + (hasShips ? getHitAdvice(canAttackAgain) + (buildingHits > 0 ? " Any hits left over go to buildings." : "") : "All hits go to buildings.") + "</div>"
        + "<div><b>Own ships:</b> damage fresh ships before losing damaged ones.</div>"
        + "<details class=\"small text-muted mt-2\" id=\"battleDetails\"><summary>Details</summary>"
        + "<div>Expected hits: " + choice.expectedHits.toFixed(1) + " (" + usefulHits + " would destroy every " + (hasShips ? "ship" : "building") + ")</div>"
        + (battle.fresh > 0 && choice.assaultDice > 0
            ? "<div>Ambush chance: " + Math.round(choice.ambushChance * 100) + "% (would take " + battle.fresh + " hit" + (battle.fresh == 1 ? "" : "s") + " first)</div>"
            : "<div>No risk of an ambush</div>")
        + (hasShips && buildingHits > 0
            ? "<div>Expected hits on buildings: " + choice.expectedBuildingHits.toFixed(1) + " (destroying one causes Outrage)</div>"
            : "")
        + "<div>Expected damage to own ships: " + choice.expectedDamage.toFixed(1) + "</div>"
        + "<div>Mood this battle: " + moodText + "</div>"
        + "<div>Chance of this choice " + Math.round(choice.pickChance * 100) + "%"
        + (others.length > 0 ? ". Others: " + others.join(", ") : "") + "</div>"
        + "</details>"
        + "<div class=\"alert alert-secondary py-2 px-3 mt-2 mb-0 small\"><b>After the roll:</b> set the ships and buildings above to what's left.</div>";

    // The counts before the first roll, to work out what was lost when the battle is done
    if (battle.start == null) {
        battle.start = {};
        battleCounts.forEach(count => { battle.start[count] = battle[count]; });
    }
    showHideElement([document.getElementById("battleDone")], true);

    // The bot may attack again (with the same or updated ships), so it can choose again
    document.getElementById("chooseBattleDice").innerHTML = "Choose again";
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
    // What the battle changed, to confirm before the players' panels are updated
    const losses = getBattleLosses();
    const attacker = "Player " + battle.attacker.number, defender = "Player " + battle.defender.number;
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

    // Each destroyed building: a city goes back on the defender's player board (which resource?),
    // a starport back to their supply. Neither is a trophy
    if (losses.defenderBuildings > 0) {
        html += "<div class=\"mt-2\">" + defender + ": " + plural(losses.defenderBuildings, "building") + " destroyed. Which?</div>";
        for (let index = 0; index < losses.defenderBuildings; index++) {
            const options = ["<option value=\"starport\">Starport (back to supply)</option>"].concat(
                preludeResources.filter(resource => battle.defender["cities" + capitalise(resource) + "Value"] > 0)
                    .map(resource => "<option value=\"" + resource + "\">City on " + preludeResourceNames[resource].toLowerCase() + " (back to the player board)</option>"));
            html += "<select class=\"form-select form-select-sm mt-1 battlebuilding\">" + options.join("") + "</select>";
        }
        html += "<div class=\"alert alert-warning py-2 px-3 mt-2 mb-0 small\"><b>Remember:</b> destroying a building means Outrage, and Ransack.</div>";
    }

    html += "<div class=\"d-flex gap-2 mt-3\">"
        + "<button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"clearBattleDecision()\">Back</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"battleUpdate\" onclick=\"applyBattleResults()\">Update the panels</button>"
        + "</div>";

    document.getElementById("battleAdvice").innerHTML = html;
    showHideElement([document.getElementById("chooseBattleDice"), document.getElementById("battleDone")], false);
}

function adjustCounter(player, counter, change) {
    // Change a panel counter the same way its -/+ buttons do (totals, headers and saving included)
    const button = (change > 0 ? "plusButton_" : "minusButton_") + counter + "_" + player.number;
    for (let step = 0; step < Math.abs(change); step++) { plusMinusClicked(button, change > 0 ? "plus" : "minus"); }
}

function applyBattleResults() {
    // Update both players' panels and close the window
    const losses = getBattleLosses();
    const { attacker, defender } = battle;

    // Destroyed ships leave the board and become the other side's trophies
    adjustCounter(defender, "shipsBoard", -losses.defenderShips);
    adjustCounter(attacker, "trophies", losses.defenderShips);
    adjustCounter(attacker, "shipsBoard", -losses.attackerShips);
    adjustCounter(defender, "trophies", losses.attackerShips);

    // Destroyed cities go back on the defender's player board, starports back to their
    // supply (not counted)
    let cities = [];
    document.querySelectorAll("#battleAdvice .battlebuilding").forEach(select => {
        if (select.value == "starport") { return; }
        adjustCounter(defender, "cities" + capitalise(select.value), -1);
        cities.push(preludeResourceNames[select.value].toLowerCase());
    });

    SaveAllSettings();
    showMessageToast("Player " + attacker.number + " attacked Player " + defender.number,
        "Ships destroyed: " + losses.defenderShips + " (Player " + defender.number + "), " + losses.attackerShips + " (Player " + attacker.number + ")"
        + (losses.defenderBuildings > 0 ? "<br>Buildings destroyed: " + losses.defenderBuildings + (cities.length > 0 ? " (cities on " + cities.join(", ") + ")" : "") : ""));

    battle.start = null;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("battleModal")).hide();
}
