// Battle: helping a bot that's attacking another player choose its dice and how to
// assign the hits. The dice and the bot's personality are in rules.js.
// Raid dice aren't included yet (see the placeholder in the Battle window). When they are,
// review whether the bot should sometimes roll fewer dice than it could: with only assault
// and skirmish dice that's never better, but with raid dice it may be. Defending buildings
// aren't included either: hits beyond the defender's ships go to their buildings, and
// destroying one causes Outrage, so the bot may want fewer dice to avoid that too
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// What's entered in the Battle window
let battle = { attacker: null, defender: null, ships: 1, fresh: 1, damaged: 0 };

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

function evaluateDice(assaultDice, skirmishDice, fresh, damaged, personality) {
    // How good rolling these dice is: the hits that matter (no more than it takes to
    // destroy every defending ship) minus the damage the attacker expects to take, from its
    // own dice and from an ambush (one hit per fresh defending ship)
    const usefulHits = fresh * 2 + damaged;

    let expectedHits = 0;
    let expectedDamage = 0;
    let ambushChance = 0;

    getDiceOutcomes(assaultDice, skirmishDice).forEach(outcome => {
        expectedHits += Math.min(outcome.hits, usefulHits) * outcome.chance;
        expectedDamage += (outcome.damage + (outcome.ambush ? fresh : 0)) * outcome.chance;
        if (outcome.ambush) { ambushChance += outcome.chance; }
    });

    return {
        assaultDice: assaultDice,
        skirmishDice: skirmishDice,
        expectedHits: expectedHits,
        expectedDamage: expectedDamage,
        ambushChance: ambushChance,
        score: expectedHits - personality.riskWeight * expectedDamage
    };
}

function getDiceOptions(ships, fresh, damaged, personality) {
    // Every mix of assault and skirmish dice (up to one die per ship and maxDicePerType of
    // each), with the chance the bot picks each. Skirmish dice can't hurt the attacker, so the
    // ships not rolling assault roll skirmish, up to the limit. Options close to the best are
    // picked almost as often as the best (a person can't tell them apart and guesses), but
    // clearly worse ones quickly become rare. personality.randomness sets how far from the
    // best counts as "close"
    let options = [];
    for (let assaultDice = 0; assaultDice <= Math.min(ships, maxDicePerType); assaultDice++) {
        const skirmishDice = Math.min(ships - assaultDice, maxDicePerType);
        options.push(evaluateDice(assaultDice, skirmishDice, fresh, damaged, personality));
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

function getBattleAttitude(choice) {
    // What the bot might say about its roll
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
    battle.ships = 1;
    battle.fresh = 1;
    battle.damaged = 0;
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
        input.onchange = () => { battle.defender = player; clearBattleDecision(); };

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
    clearBattleDecision();
}

function clearBattleDecision() {
    // Anything changed, so the bot needs to choose again
    document.getElementById("battleAdvice").innerHTML =
        "<div class=\"text-muted\">Set up the battle, then choose the dice.</div>";
    document.getElementById("chooseBattleDice").innerHTML = "Choose dice";
}

function chooseBattleDice() {
    const advice = document.getElementById("battleAdvice");

    if (battle.fresh + battle.damaged == 0) {
        advice.innerHTML = "<div class=\"text-muted\">Player " + battle.defender.number + " has no ships to attack.</div>";
        return;
    }

    // This battle's mood, then a loose pick weighted towards the better options
    const mood = getBattleMood(defaultBotPersonality);
    const options = getDiceOptions(battle.ships, battle.fresh, battle.damaged, mood);
    const choice = pickDiceOption(options);
    const canAttackAgain = document.getElementById("battleAttackAgain").checked;
    const usefulHits = battle.fresh * 2 + battle.damaged;

    // The other options and how likely each was, so the weighting can be checked
    const others = options.filter(option => option !== choice && option.pickChance >= 0.01)
        .sort((a, b) => b.pickChance - a.pickChance)
        .map(option => describeDice(option) + " " + Math.round(option.pickChance * 100) + "%");

    const moodText = (mood.mood > 0.15) ? "more careful than usual" : (mood.mood < -0.15) ? "bolder than usual" : "about as usual";

    // Only what a human opponent would say is shown. The numbers behind the decision are
    // in Details, closed to start with
    advice.innerHTML =
        "<div class=\"battleroll\">Roll " + describeDice(choice) + "</div>"
        + "<div class=\"fst-italic\">" + getBattleAttitude(choice) + "</div>"
        + "<div class=\"mt-2\"><b>Assign hits:</b> " + getHitAdvice(canAttackAgain) + "</div>"
        + "<div><b>Own ships:</b> damage fresh ships before losing damaged ones.</div>"
        + "<details class=\"small text-muted mt-2\" id=\"battleDetails\"><summary>Details</summary>"
        + "<div>Expected hits: " + choice.expectedHits.toFixed(1) + " (" + usefulHits + " would destroy every ship)</div>"
        + (battle.fresh > 0 && choice.assaultDice > 0
            ? "<div>Ambush chance: " + Math.round(choice.ambushChance * 100) + "% (would take " + battle.fresh + " hit" + (battle.fresh == 1 ? "" : "s") + " first)</div>"
            : "<div>No risk of an ambush</div>")
        + "<div>Expected damage to own ships: " + choice.expectedDamage.toFixed(1) + "</div>"
        + "<div>Mood this battle: " + moodText + "</div>"
        + "<div>Chance of this choice " + Math.round(choice.pickChance * 100) + "%"
        + (others.length > 0 ? ". Others: " + others.join(", ") : "") + "</div>"
        + "</details>";

    // The bot may attack again (with the same or updated ships), so it can choose again
    document.getElementById("chooseBattleDice").innerHTML = "Choose again";
}
