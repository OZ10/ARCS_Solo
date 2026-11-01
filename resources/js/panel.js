// Player panels: building them, resources +/-, and the panel icons (vox, draw, seize, declare).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function onCollapse(playerNumber, isCollapsed) {
    const el = document.querySelectorAll("#playeroptions" + playerNumber);

    showHideElement(el, isCollapsed ? false : true);
}

function clonePlayerNodeAndSetup(player) {
    const playerNumber = player.number;
    const playertemplate = document.getElementById("playerTemplate").cloneNode(true);
    playertemplate.id = "player" + playerNumber.toString();
    playertemplate.classList.add("playerheader" + playerNumber.toString());
    playertemplate.classList.remove("d-none");
    playertemplate.querySelector('#' + "playernumber").innerHTML = "Player " + playerNumber.toString();

    // DONT THINK WE NEED THIS ANYMORE. ONLY THE HUMAN PLAYER HAS A HAND NOW
    const hand = playertemplate.querySelector("#playerhand");
    hand.id = "playerhand" + playerNumber.toString();

    const a = playertemplate.querySelector("#playerancor");
    a.id = "playerancor" + playerNumber.toString();
    a.dataset.bsTarget = "#playerpanel" + playerNumber.toString();

    const playerPanel = playertemplate.querySelector('#playerpanel');
    playerPanel.id = "playerpanel" + playerNumber.toString();
    playerPanel.classList.add("playerpanel" + playerNumber.toString());

    playerPanel.addEventListener('hidden.bs.collapse', function () {
        onCollapse(getPlayerNumberFromString(this.id), true);
    });

    playerPanel.addEventListener('show.bs.collapse', function () {
        onCollapse(getPlayerNumberFromString(this.id), false);
    });

    const playeroptions = playertemplate.querySelector('#playeroptions');
    playeroptions.id = "playeroptions" + playerNumber.toString();

    const playerinitiative = playertemplate.querySelector('#playerinitiative');
    playerinitiative.id = "playerinitiative" + playerNumber.toString();

    const playerpower = playertemplate.querySelector('#playerpower');
    playerpower.id = "playerpower" + playerNumber.toString();
    playerpower.innerHTML = "Power " + player.powerValue;

    const playcardbutton = playertemplate.querySelector('#playcard');
    playcardbutton.id = "playcard" + playerNumber.toString();
    playcardbutton.disabled = true;

    if (playerNumber == 1) {
        playcardbutton.classList.add("d-none");
        playerinitiative.classList.remove("d-none");

        const actiondiv = document.createElement("div");
        actiondiv.classList.add("mt-1", "sectionlabel", "text-center");
        actiondiv.innerHTML = "Actions"

        const actionbuttons = document.createElement("div");
        actionbuttons.classList.add("btn-group", "d-none", "d-flex");
        actionbuttons.id = "actionbuttons";

        createRadioButtons("LEAD", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("DECLARE", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("SURPASS", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("COPY", actionbuttons, "actiontype", "btn-light");
        createRadioButtons("PIVOT", actionbuttons, "actiontype", "btn-light");
        createClaimButton("CLAIM", actionbuttons, "actionclaim", "btn-light");

        playerPanel.appendChild(actiondiv);
        playerPanel.appendChild(actionbuttons);
    }

    // Only the human player's hand is shown, so bots don't need the Cards heading either
    const cardslabel = playertemplate.querySelector("#cardslabel");
    cardslabel.id = "cardslabel" + playerNumber.toString();

    if (playerNumber != 1) {
        hand.classList.add("d-none");
        cardslabel.classList.add("d-none");
    }

    // The Battle helper is for bots. The human player chooses their own dice
    const battlebutton = playertemplate.querySelector("#battlebutton");
    battlebutton.id = "battlebutton" + playerNumber.toString();
    if (player.isHuman) { battlebutton.classList.add("d-none"); }

    // Shown once the player has played their card: what they played, and Done to move
    // on (see finishPlay in game.js)
    const turndone = playertemplate.querySelector("#turndone");
    turndone.id = "turndone" + playerNumber.toString();
    playertemplate.querySelector("#turnsummary").id = "turnsummary" + playerNumber.toString();
    playertemplate.querySelector("#donebutton").id = "donebutton" + playerNumber.toString();
    // The human's actions are at the bottom of their panel, so Done goes after them
    if (player.isHuman) { playerPanel.appendChild(turndone); }

    // The resource and board tiles (see playerCounters in player.js)
    playerCounters.forEach(counter => setPlusMinusButtons(playertemplate, player, counter));

    const citiestotal = playertemplate.querySelector("#citiestotal");
    citiestotal.id = "citiestotal" + playerNumber.toString();
    citiestotal.innerHTML = getCityCount(player);

    document.getElementById("playerslots").appendChild(playertemplate);
}

function setPlusMinusButtons(playertemplate, player, type) {
    let btn = playertemplate.querySelector("#minusButton_" + type);
    btn.id = "minusButton_" + type + "_" + player.number;
    btn = playertemplate.querySelector("#plusButton_" + type);
    btn.id = "plusButton_" + type + "_" + player.number;

    let input = playertemplate.querySelector("#" + type + "Value");
    input.id = type + "Value_" + player.number;
    input.value = player[type + "Value"];
}

function declareAmbitionClick(ambition) {
    if (declaredAmbitions.length >= 3) {
        return;
    }

    // If the player has triggered this after playing a 7 card
    // there are hidden elements for:
    //      - when a 7 has been played the element will be set to TRUE
    //      - the player number is in the title
    //      - the card that was played
    const seven = document.getElementById("playedSeven");

    // The declaring player's number is in the modal's title
    const title = document.getElementById("declareAmbitionModalTitle");
    const player = getPlayer(getPlayerNumberFromString(title.innerHTML));

    showMessageToast("Player " + player.number, getAmbitionDeclaredMessage(ambition));

    if (seven.innerHTML == "TRUE") {
        const playedCardFullName = document.getElementById("playedCard").innerHTML;
        const playedCard = getCardByNameAndNumber(player.cards, playedCardFullName, true);

        playedCard.declared = true;

        // Reset the played card list and re-add the declared card
        // with a value of 0
        addPlayedCardToList(playedCard, "ANY", "DECLARE", true, player);

        seven.innerHTML = "";
    }

    declaredAmbitions.push(ambition);
    updateAmbitionsDisplay();

    // Update what Done shows the player played (e.g. a 7 used to declare)
    if (awaitingDone == player.number) { showTurnDone(player); }

    SaveAllSettings();
}

function showDeclareAmbitionModal(ele, hasPlayedASeven, player, playedCard) {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("declareAmbitionModal"));
    const playerNumber = ele != null ? getPlayerNumberFromElement(ele) : player.number;
    const title = document.getElementById("declareAmbitionModalTitle");
    title.innerHTML = "Player " + playerNumber;

    // Always set the flag, so a 7 whose declare modal was closed without choosing
    // doesn't make a later declare (from the Declare icon) treat it as a 7
    const seven = document.getElementById("playedSeven");
    seven.innerHTML = hasPlayedASeven ? "TRUE" : "";

    if (hasPlayedASeven) {
        const card = document.getElementById("playedCard");
        card.innerHTML = getCardFullName(playedCard);
    }

    modal.show();
}

function seizeInitiativeQuestion(ele) {
    if (hasInitiativeBeenClaimedThisTurn == true) {
        //alert("Initiative has already been claimed this turn");
        //showToast("messageToast", "messageToastHeader", "Initiative", "messageToastBody", "Initiative has already been claimed this turn!");
        showMessageToast("Initiative", "Initiative has already been claimed this turn!");
        return;
    } else {
        const playerNumber = getPlayerNumberFromElement(ele);

        showToast("seizeToast", "seizeToastHeader", "Player " + playerNumber, "", "");
    }
}

function seizeInitiative() {
    const header = document.querySelector("#seizeToastHeader");
    const playerNumber = getPlayerNumberFromString(header.innerHTML);
    hasInitiativeBeenClaimedThisTurn = true;
    changeInitiative(getPlayer(playerNumber));
}

function displayVoxCards() {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("voxCards"));
    modal.show();
}

function playVoxCard(btn) {
    switch (btn.innerText) {
        case "Call To Action":
            //Draw a card from action discard pile
            break;
        case "Populist Demands":
            //Declare ambition
            break;

        case "Song Of Freedom":
            //Return city you control to seize the initiative (if possible)
            break;

        default:
            break;
    }
}

function setDrawingPlayer(ele) {
    // Remember whose panel the Draw icon was clicked on, as
    // it isn't necessarily the current player who is drawing
    drawingPlayer = getPlayer(getPlayerNumberFromElement(ele));
}

function drawACard(pileName) {
    const player = (drawingPlayer != null) ? drawingPlayer : currentPlayer;

    switch (pileName) {
        case 'playedthisturn':
            showCardModal(player, playedCardList, "Cards Played This Turn", "Select a card to add to Player " + player.number + "'s hand", "DRAW")
            break;

        case 'discardpile':
            showCardModal(player, discardPile, "Cards In The Discard Pile", "Select a card to add to Player " + player.number + "'s hand", "DRAW")
            break;

        default:
            break;
    }

    SaveAllSettings();
}

function enableDisablePlayerPanels(playerNumber) {
    players.forEach(player => {
        let btn = document.querySelector("#playcard" + player.number);
        //btn.disabled = (player.number == playerNumber) ? false : true;

        if (player.number == playerNumber) {
            document.getElementById("player" + player.number).classList.add("playersTurn");
            btn.disabled = false;
        } else {
            document.getElementById("player" + player.number).classList.remove("playersTurn");
            btn.disabled = true;
        }

        // A bot can only battle on its own turn (the human's Battle button is hidden)
        enableDisableButton("battlebutton" + player.number, player.number != playerNumber || player.isHuman);

        showHidePlayerPanel(player, playerNumber);

        if (player.isHuman) { enableDisableButtonsByPlayerNumber(player.number, (player.number == playerNumber) ? true : false) }
    })
}

function showHidePlayerPanel(player, playerNumber) {
    const playerPanel = document.querySelector('#playerpanel' + player.number);

    const collapse = bootstrap.Collapse.getOrCreateInstance(playerPanel, {
        toggle: false // Prevents initial toggle
    });

    if (player.number == playerNumber) {
        // On a phone the current player can be off screen, so bring them into view. For the
        // human player that's their row at the top. For a bot it's their Play Card button,
        // which is under the resources, just above the footer.
        // Wait for the panel to finish opening, as the page moves while it does
        const scrollToPlayer = () => {
            if (player.isHuman) {
                document.getElementById("player" + player.number).scrollIntoView({ block: "start", behavior: "smooth" });
            } else {
                document.getElementById("playcard" + player.number).scrollIntoView({ block: "end", behavior: "smooth" });
            }
        };

        if (playerPanel.classList.contains("show")) {
            scrollToPlayer();
        } else {
            playerPanel.addEventListener('shown.bs.collapse', scrollToPlayer, { once: true });
        }

        collapse.show();
    } else {
        collapse.hide();
    }
}

function hidePlayerPanels() {
    players.forEach(player => {
        showHidePlayerPanel(player, 99);
        // Between turns it's nobody's turn, so nobody can battle
        enableDisableButton("battlebutton" + player.number, true);
    })
}

function enableDisableButtonsByPlayerNumber(playerNumber, enable) {
    document.querySelectorAll(".p" + playerNumber.toString()).forEach((btn) => {
        if (enable) {
            let card = getCardByNameAndNumber(getPlayer(playerNumber).cards, btn.id, false);
            if (card != null) {
                // Card is unplayed and button should be enabled
                btn.disabled = false;
            }
        } else {
            btn.disabled = true;
            btn.checked = false;
        }
    })
}

function plusMinusClicked(id, action) {
    const value = (action == 'minus') ? -1 : 1

    const idsplit = id.split('_');
    const resourceName = idsplit[1];
    let resourceValue = 0;
    const playerNumber = idsplit[2];

    const player = getPlayer(playerNumber);

    // Counts can't go below 0
    const newValue = Math.max(0, player[resourceName + "Value"] + value);

    if (resourceName == "power") {
        // Also updates the power shown in the player's header
        setPlayerPower(player, newValue);
    } else {
        player[resourceName + "Value"] = newValue;
    }
    resourceValue = player[resourceName + "Value"];

    // Keep the cities total in the Board section up to date
    if (cityCounters.includes(resourceName)) {
        document.getElementById("citiestotal" + playerNumber).innerHTML = getCityCount(player);
    }

    document.getElementById(resourceName + "Value_" + playerNumber).value = resourceValue;

    SaveAllSettings();
}
