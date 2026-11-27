// Vox cards: what a bot does when it secures one. The Vox cards are listed with the Guild cards
// when adding a Court card to a bot, and tapping one shows what the bot does in the same window.
// The human player carries out their own cards.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function getBestAmbitionToDeclare(player) {
    // Populist Demands: the ambition it places best in, then the one it has most for. null if
    // no marker is left, or it has nothing towards any of them
    if (declaredAmbitions.length >= 3) { return null; }

    const options = getDeclarableAmbitions().filter(ambition => ambitionResources[ambition] != null).map(ambition => {
        const count = ambitionResources[ambition](player);
        return { ambition: ambition, count: count, place: getAmbitionPlacePoints(player, ambition, count) };
    }).filter(option => option.count > 0);

    return options.sort((a, b) => (b.place - a.place) || (b.count - a.count))[0] || null;
}

function getDeclarableAmbitions() {
    // The ambitions that can be declared: the five, and a campaign's new ones while they're in play
    // (campaign/grand.js), never in a base game (#218)
    return runCampaignHook("ambitionList") || ambitions.slice();
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

// Your Outrage Spreads (#119): the type you choose
let outrageSpreadsChoice = null;

function getOutrageLossText(resource) {
    // e.g. "Player 2 loses 2 and Loyal Engineers, you lose nothing". You last
    return players.slice().sort((a, b) => Number(a.isHuman) - Number(b.isHuman)).map(player => {
        const cards = getPlayerGuildCards(player).filter(card => card.resource == resource && !card.keepOnOutrage).map(card => card.name);
        const count = player[resource + "Value"];
        const losses = (count > 0 ? [String(count)] : []).concat(cards);
        const who = getYouOrPlayer(player);
        return who + (losses.length == 0 ? (isYou(player) ? " lose nothing" : " loses nothing") : (isYou(player) ? " lose " : " loses ") + losses.join(" and "));
    }).join(", ");
}

function showOutrageSpreads(player) {
    outrageSpreadsChoice = null;
    const card = getCourtCard(28);
    document.getElementById("guildTitle").innerHTML = card.name;
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("guildBody").innerHTML = "<div class=\"small text-muted mb-2\">" + card.text + "</div>"
        + "<div class=\"battleroll\">Which type?</div><div class=\"fst-italic mb-2\">Everyone Provokes Outrage of it: they discard their resources and Guild cards of that type, and can't spend it for its Prelude action.</div>"
        + "<div class=\"d-flex flex-wrap gap-2 mb-3\">" + preludeResources.map(resource =>
            "<button type=\"button\" class=\"btn btn-outline-secondary flex-fill\" id=\"spreads_" + resource + "\" onclick=\"chooseOutrageSpreads('" + resource + "')\">" + preludeResourceNames[resource] + "</button>").join("") + "</div>"
        + "<div class=\"small mb-3\" id=\"spreadsLoss\">Choose a type to see what each player loses.</div>"
        + "<div class=\"d-flex gap-2\"><button type=\"button\" class=\"btn btn-secondary flex-fill\" onclick=\"bootstrap.Modal.getOrCreateInstance(document.getElementById('guildModal')).hide()\">Cancel</button>"
        + "<button type=\"button\" class=\"btn btn-primary flex-fill\" id=\"spreadsConfirm\" disabled onclick=\"confirmOutrageSpreads()\">Provoke Outrage</button></div>";
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

function chooseOutrageSpreads(resource) {
    outrageSpreadsChoice = resource;
    preludeResources.forEach(other => {
        const button = document.getElementById("spreads_" + other);
        button.classList.toggle("btn-secondary", other == resource);
        button.classList.toggle("btn-outline-secondary", other != resource);
    });
    document.getElementById("spreadsLoss").innerHTML = tagPlayerNames("<b>" + preludeResourceNames[resource] + ":</b> " + getOutrageLossText(resource) + ".");
    document.getElementById("spreadsConfirm").disabled = false;
}

function confirmOutrageSpreads() {
    const resource = outrageSpreadsChoice;
    if (resource == null) { return; }
    players.forEach(other => provokeOutrage(other, resource));
    SaveAllSettings();
    showMessageToast("Outrage Spreads", "Everyone Provokes " + preludeResourceNames[resource] + " Outrage");
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
}

function getBestGuildCardToSteal(player) {
    // Guild Struggle: the Rival's Guild card it most needs, then the one with the most keys.
    // A Rival's Sworn Guardians has to be stolen before their other cards
    const guardians = getCourtCard(22);
    const options = players.filter(other => other !== player).flatMap(rival => {
        // A campaign's Fate cards are protected: they can't be stolen
        const cards = (rival.guildCards || []).includes(guardians.number) ? [guardians] : getPlayerGuildCards(rival).filter(card => !card.protected);
        return cards.map(card => ({ card: card, rival: rival, need: getResourceNeed(player, card.resource) }));
    });
    // From the leader first, when it needs the cards equally (#200)
    const leader = typeof getLeader == "function" ? getLeader(player) : null;
    return options.sort((a, b) => (b.need - a.need) || (Number(b.rival === leader) - Number(a.rival === leader)) || (b.card.keys - a.card.keys))[0] || null;
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
    setWindowBanner("guildModal", player);
    const body = document.getElementById("guildBody");
    body.innerHTML = "<div class=\"small text-muted mb-2\">" + card.text + "</div>"
        + "<div class=\"battleroll\">" + tagPlayerNames(headline) + "</div>"
        + (reason ? "<div class=\"fst-italic mb-2\">" + tagPlayerNames(reason) + "</div>" : "");

    const row = document.createElement("div");
    row.classList.add("d-flex", "flex-wrap", "gap-2", "mt-3");
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
            // Mass Uprising: the cluster from the board where the ships help it most (#204)
            const pick = getMassUprisingClusters(player)[0];
            if (pick == null) { nothing("No ships to place", "It has no ships left in its supply."); break; }
            showVoxDecision(player, card, "Cluster " + pick.cluster + ": " + pick.ships + " ship" + (pick.ships == 1 ? "" : "s"), pick.why, [
                { label: "Don't", run: close },
                { label: "Place them", run: () => finishVox(player, placeMassUprising(player, pick.cluster)) }
            ]);
            break;
        }

        case 27:
        case 101: {
            // Populist Demands (101 is the campaign's, #173)
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
            // The board shows whether it controls a Rival's city: returning that costs it nothing (#204)
            const rivalCity = getSongCities(player).find(city => city.owner != player.number);
            if (rivalCity != null) {
                showVoxDecision(player, card, "Return Player " + rivalCity.owner + "'s city at " + getSystemName(rivalCity.system) + " and seize", "It controls it, so it costs it nothing. Shuffle this card into the Court deck.", [
                    { label: "Don't", run: close },
                    { label: "Done", run: () => finishVox(player, returnSongCity(player, rivalCity)) }
                ]);
                break;
            }
            // Its own city: the one it needs least, now and then
            const own = getSongCities(player).filter(city => city.owner == player.number).sort((a, b) => getCityWorth(player, a.system) - getCityWorth(player, b.system))[0];
            if (own == null || getBoardCities(player.number).length < 2 || Math.random() * 100 >= getWhimChance(preludeChance.songOfFreedom)) {
                nothing("It keeps its cities", own == null || getBoardCities(player.number).length < 2 ? "It would be its last city." : "It isn't worth a city this time.");
                break;
            }
            showVoxDecision(player, card, "Return its city at " + getSystemName(own.system) + " and seize", "The city it needs least. Shuffle this card into the Court deck.", [
                { label: "Don't", run: close },
                { label: "Done", run: () => {
                    const message = returnSongCity(player, own);
                    const overCapacity = getOverCapacityAdvice(player);
                    finishVox(player, message + (overCapacity != null ? "<br>" + overCapacity : ""));
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

// The board (#160, #204): Mass Uprising's cluster and Song of Freedom's city

function getMassUprisingClusters(player) {
    // The clusters in play, the one where its ships help most first: its buildings there (more if a
    // Rival fleet can reach them), and Rival pieces to battle. ships: how many it can place (1 a system)
    const supply = getShipSupply(player);
    if (supply == 0) { return []; }
    const threatened = getThreatenedCity(player);
    return [...new Set(getSystemIds().map(getCluster))].map(cluster => {
        const systems = getSystemIds().filter(id => getCluster(id) == cluster);
        const own = systems.filter(id => getBuildings(id, player.number).length > 0).length;
        const rivals = systems.filter(id => players.some(other => other !== player && hasLoyalPiece(id, other.number))).length;
        const guards = threatened != null && getCluster(threatened.id) == cluster;
        const why = guards ? "It guards its threatened city at " + getSystemName(threatened.id) + "." : own > 0 ? "Near its buildings there." : rivals > 0 ? "Rival pieces there to battle." : "Somewhere to spread out.";
        return { cluster: cluster, ships: Math.min(systems.length, supply), score: (guards ? 6 : 0) + own * 2 + rivals + systems.length / 10, why: why };
    }).sort((a, b) => b.score - a.score);
}

function placeMassUprising(player, cluster) {
    // 1 ship in each system of the cluster in play, while it has ships in its supply
    let placed = 0;
    getSystemIds().filter(id => getCluster(id) == cluster).forEach(id => {
        if (getShipSupply(player) > 0) { addShips(id, player.number, 1); placed++; }
    });
    syncPanelFromBoard(player);
    SaveAllSettings();
    return "Mass Uprising: " + placed + " ship" + (placed == 1 ? "" : "s") + " placed in cluster " + cluster + ", already on the app's board";
}

function getSongCities(player) {
    // The cities it controls: its own, and Rival cities in systems it controls
    return getSystemIds().flatMap(id => getBuildings(id, null, "city").filter(city => city.owner == player.number || getController(id) == player.number)
        .map(city => ({ system: id, owner: city.owner })));
}

function returnSongCity(player, city) {
    // The city goes back to its owner's board, and the player seizes the initiative
    removeBuilding(city.system, city.owner, "city");
    syncPanelFromBoard(getPlayer(city.owner));
    seizeWithSong(player);
    SaveAllSettings();
    return (city.owner == player.number ? "Returned its city" : "Returned Player " + city.owner + "'s city") + " at " + getSystemName(city.system) + " and seized the initiative";
}

// A human player's Vox cards (#204): each in a window, carried out by the app

function showVoxForPlayer(player, card) {
    // A bot's decision, or a human player's window
    if (!player.isHuman) { showVoxCard(player, card); return; }
    if (card.number == 28) { showOutrageSpreads(player); return; }
    showHumanVox(player, card);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

function showHumanVox(player, card) {
    const close = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).hide();
    const header = document.querySelector("#guildModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    const choose = (headline, reason, options) => showVoxDecision(player, card, headline, reason, [{ label: "None", run: close }].concat(options));
    switch (card.number) {
        case 26: {
            const clusters = getMassUprisingClusters(player);
            if (clusters.length == 0) { choose("No ships to place", "You have no ships left in your supply.", []); break; }
            choose("Choose a cluster", "You place 1 ship in each of its systems in play.", clusters.sort((a, b) => a.cluster - b.cluster)
                .map(option => ({ label: "Cluster " + option.cluster + " (" + option.ships + ")", run: () => finishVox(player, placeMassUprising(player, option.cluster)) })));
            break;
        }
        case 27:
        case 101: {
            // Any ambition, even one already declared, while a marker is left; only a campaign's new
            // ambitions when they're in play (#218)
            const open = declaredAmbitions.length >= 3 ? [] : getDeclarableAmbitions();
            if (open.length == 0) { choose("No ambition marker is available", "", []); break; }
            choose("Declare an ambition", "", open.map(ambition => ({ label: capitalise(ambition), run: () => {
                declaredAmbitions.push(ambition);
                updateAmbitionsDisplay();
                finishVox(player, getAmbitionDeclaredMessage(ambition));
            } })));
            break;
        }
        case 29: {
            if (player.hasInitiative || hasInitiativeBeenClaimedThisTurn) { choose("You can't seize the initiative now", player.hasInitiative ? "You have it already." : "It's already been seized this round.", []); break; }
            choose("Return a city you control, and seize the initiative?", "It goes back to its owner's board.", getSongCities(player).map(city => ({
                label: (city.owner == player.number ? "Yours" : "Player " + city.owner + "'s") + " at " + getSystemName(city.system), run: () => finishVox(player, returnSongCity(player, city)) })));
            break;
        }
        case 30: {
            const cards = players.filter(other => other !== player).flatMap(other => getPlayerGuildCards(other).map(guild => ({ rival: other, card: guild })));
            choose("Steal a Guild card", "Then shuffle the Court discard pile's Guild cards into the Court deck.", cards.map(option => ({ label: option.card.name + " (Player " + option.rival.number + ")", run: () => {
                option.rival.guildCards = option.rival.guildCards.filter(number => number != option.card.number);
                // Sworn Guardians is buried when it's stolen
                if (option.card.number != 22) { player.guildCards.push(option.card.number); }
                showGuildCardsRow(option.rival);
                showGuildCardsRow(player);
                finishVox(player, "Stole " + option.card.name + " from Player " + option.rival.number);
            } })));
            break;
        }
        case 31: {
            const bottom = getDiscardedCards()[0];
            if (bottom == null) { choose("Nothing to draw", "The action discard pile is empty.", []); break; }
            choose("Draw the bottom card of the action discard pile", "", [{ label: "Draw it", run: () => {
                drawCardIntoHand(player, bottom);
                finishVox(player, "Drew " + getCardFullName(bottom) + " from the bottom of the discard pile");
            } }]);
            break;
        }
        default:
            choose("Carry out the card", "", []);
    }
}