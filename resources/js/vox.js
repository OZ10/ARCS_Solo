// Vox cards: what a bot does when it secures one. The Vox cards are listed with the Guild cards
// when adding a Court card to a bot, and tapping one shows what the bot does in the same window.
// The human player carries out their own cards.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getBestAmbitionToDeclare(player) {
    // Populist Demands: the ambition it places best in, then the one it has most for. null if
    // no marker is left, or it has nothing towards any of them
    if (declaredAmbitions.length >= 3) { return null; }

    const ambitions = Object.keys(ambitionResources).map(ambition => {
        const count = ambitionResources[ambition](player);
        return { ambition: ambition, count: count, place: getAmbitionPlacePoints(player, ambition, count) };
    }).filter(option => option.count > 0);

    return ambitions.sort((a, b) => (b.place - a.place) || (b.count - a.count))[0] || null;
}

function getOutrageTypeCount(player, resource) {
    // What Outrage would cost: its resources and Guild cards of that type, except a card that says
    // to keep it
    return player[resource + "Value"] + getPlayerGuildCards(player).filter(card => card.resource == resource && !card.keepOnOutrage).length;
}

function getBestOutrageType(player) {
    // Outrage Spreads: the type that costs its Rivals most and it least. null if none is worth it
    const options = preludeResources.map(resource => {
        const own = getOutrageTypeCount(player, resource);
        const rivals = players.filter(other => other !== player).reduce((total, other) => total + getOutrageTypeCount(other, resource), 0);
        return { resource: resource, own: own, rivals: rivals, net: rivals - own };
    }).sort((a, b) => b.net - a.net);
    return (options[0].net > 0) ? options[0] : null;
}

function getBestGuildCardToSteal(player) {
    // Guild Struggle: the Rival's Guild card it most needs, then the one with the most keys.
    // A Rival's Sworn Guardians has to be stolen before their other cards
    const guardians = getCourtCard(22);
    const options = players.filter(other => other !== player).flatMap(rival => {
        const cards = (rival.guildCards || []).includes(guardians.number) ? [guardians] : getPlayerGuildCards(rival);
        return cards.map(card => ({ card: card, rival: rival, need: getResourceNeed(player, card.resource) }));
    });
    return options.sort((a, b) => (b.need - a.need) || (b.card.keys - a.card.keys))[0] || null;
}

function getCityToReturn(player) {
    // Song of Freedom, with a city of its own: the one on the resource it needs least, or its
    // starting city if that's not been set. null if it would be its last city
    if (getCityCount(player) < 2) { return null; }
    if (player.startingCity) { return "startingCity"; }
    return getTaxTargets(player).slice(-1)[0] || null;
}

function seizeWithSong(player) {
    hasInitiativeBeenClaimedThisTurn = true;
    changeInitiative(player);
}

function finishVox(player, message) {
    showMessageToast("Player " + player.number, message);
    SaveAllSettings();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
}

function showVoxDecision(player, card, headline, reason, buttons) {
    // In the Guild window: the card, what the bot does and why, then the buttons
    document.getElementById("guildTitle").innerHTML = card.name;
    const body = document.getElementById("guildBody");
    body.innerHTML = "<div class=\"small text-muted mb-2\">" + card.text + "</div>"
        + "<div class=\"battleroll\">" + headline + "</div>"
        + (reason ? "<div class=\"fst-italic mb-2\">" + reason + "</div>" : "");

    const row = document.createElement("div");
    row.classList.add("d-flex", "gap-2", "mt-3");
    buttons.forEach((button, index) => {
        const element = document.createElement("button");
        element.type = "button";
        element.classList.add("btn", index == buttons.length - 1 ? "btn-primary" : "btn-secondary", "flex-fill");
        element.innerHTML = button.label;
        element.onclick = button.run;
        row.appendChild(element);
    });
    body.appendChild(row);
}

function showVoxCard(player, card) {
    // What a bot does on securing this Vox card
    const close = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
    const nothing = (headline, reason) => showVoxDecision(player, card, headline, reason, [{ label: "OK", run: close }]);

    switch (card.number) {
        case 26: {
            // Mass Uprising: which cluster depends on the board
            let ships = 0;
            showVoxDecision(player, card, "Choose a cluster", "One where the ships help it most: near its buildings, or where it wants to battle.", [
                { label: "Placed none", run: close },
                { label: "Placed them", run: () => {
                    adjustCounter(player, "shipsBoard", ships);
                    finishVox(player, "Mass Uprising: " + ships + " ship" + (ships == 1 ? "" : "s") + " placed");
                } }
            ]);
            const tile = document.createElement("div");
            tile.classList.add("d-flex", "justify-content-center", "mt-2");
            tile.innerHTML = "<div class=\"resourcetile\"><div class=\"resourcelabel\">Ships placed</div><div class=\"resourcevalue\" id=\"voxShips\">0</div>"
                + "<div class=\"d-flex gap-1\"><button class=\"btn resourcebutton resourceminus\" type=\"button\" id=\"voxShipsMinus\" aria-label=\"One ship fewer\"><i class=\"bi bi-dash-lg\"></i></button>"
                + "<button class=\"btn resourcebutton resourceplus\" type=\"button\" id=\"voxShipsPlus\" aria-label=\"One ship more\"><i class=\"bi bi-plus-lg\"></i></button></div></div>";
            const body = document.getElementById("guildBody");
            body.insertBefore(tile, body.lastChild);
            const update = change => { ships = Math.max(ships + change, 0); document.getElementById("voxShips").innerHTML = ships; };
            document.getElementById("voxShipsMinus").onclick = () => update(-1);
            document.getElementById("voxShipsPlus").onclick = () => update(1);
            break;
        }

        case 27: {
            // Populist Demands
            const best = getBestAmbitionToDeclare(player);
            if (best == null) {
                nothing("It doesn't declare", declaredAmbitions.length >= 3 ? "All the ambition markers are placed." : "It has nothing towards any ambition.");
                break;
            }
            const name = capitalise(best.ambition);
            showVoxDecision(player, card, "Declare " + name, ambitionConditions[best.ambition] + ": it has " + best.count + ".", [
                { label: "Don't declare", run: close },
                { label: "Declare", run: () => {
                    declaredAmbitions.push(best.ambition);
                    updateAmbitionsDisplay();
                    finishVox(player, getAmbitionDeclaredMessage(best.ambition));
                } }
            ]);
            break;
        }

        case 28: {
            // Outrage Spreads: everyone, even the bot, Provokes Outrage of that type
            const best = getBestOutrageType(player);
            if (best == null) { nothing("It doesn't choose a type", "Any type would cost it as much as its Rivals."); break; }
            showVoxDecision(player, card, preludeResourceNames[best.resource] + " Outrage", "Rivals hold " + best.rivals + " of these, and it holds " + best.own + ". Everyone discards their resources and Guild cards of this type.", [
                { label: "Don't", run: close },
                { label: "Provoke Outrage", run: () => {
                    players.forEach(other => provokeOutrage(other, best.resource));
                    finishVox(player, "Everyone Provokes " + preludeResourceNames[best.resource] + " Outrage");
                } }
            ]);
            break;
        }

        case 29: {
            // Song of Freedom: seizing is only worthwhile if it's allowed
            if (player.hasInitiative || hasInitiativeBeenClaimedThisTurn) {
                nothing("It keeps its cities", player.hasInitiative ? "It already has the initiative." : "The initiative has already been seized this turn.");
                break;
            }
            showVoxDecision(player, card, "Does it control a Rival's city?", "Returning that costs it nothing.", [
                { label: "No", run: () => {
                    const city = getCityToReturn(player);
                    if (city == null || Math.random() * 100 >= preludeChance.songOfFreedom) {
                        nothing("It keeps its cities", city == null ? "It would be its last city." : "It isn't worth a city this time.");
                        return;
                    }
                    const cityName = (city == "startingCity") ? "starting" : preludeResourceNames[city].toLowerCase();
                    showVoxDecision(player, card, "Return its " + cityName + " city and seize", "The city it needs least. Shuffle this card into the Court deck.", [
                        { label: "Don't", run: close },
                        { label: "Done", run: () => {
                            if (city == "startingCity") {
                                player.startingCity = false;
                                document.getElementById("citiestotal" + player.number).innerHTML = getCityCount(player);
                            } else {
                                adjustCounter(player, "cities" + capitalise(city), -1);
                            }
                            seizeWithSong(player);
                            const overCapacity = getOverCapacityAdvice(player);
                            finishVox(player, "Seized the initiative" + (overCapacity != null ? "<br>" + overCapacity : ""));
                        } }
                    ]);
                } },
                { label: "Yes", run: () => {
                    showVoxDecision(player, card, "Return it and seize", "Update its owner's cities. Shuffle this card into the Court deck.", [
                        { label: "Don't", run: close },
                        { label: "Done", run: () => { seizeWithSong(player); finishVox(player, "Seized the initiative"); } }
                    ]);
                } }
            ]);
            break;
        }

        case 30: {
            // Guild Struggle
            const best = getBestGuildCardToSteal(player);
            if (best == null) { nothing("Nothing to steal", "No Rival has a Guild card."); break; }
            showVoxDecision(player, card, "Steal " + best.card.name, "From Player " + best.rival.number + ". Shuffle the Court discard pile's Guild cards into the Court deck.", [
                { label: "Don't", run: close },
                { label: "Steal it", run: () => {
                    best.rival.guildCards = best.rival.guildCards.filter(number => number != best.card.number);
                    // Sworn Guardians is buried when it's stolen
                    if (best.card.number != 22) { player.guildCards.push(best.card.number); }
                    showGuildCardsRow(best.rival);
                    showGuildCardsRow(player);
                    finishVox(player, "Stole " + best.card.name + " from Player " + best.rival.number);
                } }
            ]);
            break;
        }

        case 31: {
            // Call to Action
            const bottom = getDiscardedCards()[0];
            if (bottom == null) { nothing("Nothing to draw", "The action discard pile is empty."); break; }
            showVoxDecision(player, card, "Draw a card", "From the bottom of the action discard pile, unseen.", [
                { label: "Don't", run: close },
                { label: "Draw it", run: () => {
                    drawCardIntoHand(player, bottom);
                    finishVox(player, "Drew a card from the bottom of the discard pile");
                } }
            ]);
            break;
        }

        default:
            break;
    }
}
