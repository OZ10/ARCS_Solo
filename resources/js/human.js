// The human player choosing a card and an action.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function createRadioButtons(btntext, group, groupname, btnstyle) {
    let input = document.createElement("input");
    input.type = "radio";
    input.classList.add("btn-check");
    input.name = groupname;
    input.id = btntext;
    input.autocomplete = "off";
    //input.setAttribute("data-bs-toggle","button");

    let l = document.createElement("label");
    // No id on the label, as the input already uses btntext and ids must be unique.
    // Find the label with label[for="..."] instead
    l.classList.add("btn", btnstyle, "m-1");
    l.htmlFor = btntext;
    l.textContent = btntext.toUpperCase();

    if (groupname == "actiontype") {
        input.onclick = function () {
            humanSelectedAction(btntext);

            // Reset checked on all action type buttons
            document.querySelectorAll('input[name=actiontype]').forEach(input => { input.checked = false });
        };
    }

    group.appendChild(input);
    group.appendChild(l);

    return input;
}

function createClaimButton(btntext, group, groupname) {
    let input = document.createElement("button");
    input.type = "button";
    // Light so it shows on any player colour. claimbutton styles the toggled on (active) state
    input.classList.add("btn", "btn-light", "claimbutton");
    input.name = groupname;
    input.id = btntext;
    input.innerHTML = btntext;
    input.setAttribute("data-bs-toggle", "button");

    group.appendChild(input);

    return input;
}

function getActionButtonElements(action) {
    // The action's input (or CLAIM button) and the label that displays it
    return document.querySelectorAll('#' + action + ', label[for="' + action + '"]');
}

function showHideActionButtons(isleading, card) {
    if (isleading) {
        showHideElement(getActionButtonElements('LEAD'), true);
        showHideElement(getActionButtonElements('DECLARE'), (card.number != 1 && declaredAmbitions.length < 3) ? true : false);
        showHideElement(getActionButtonElements('SURPASS'), false);
        showHideElement(getActionButtonElements('COPY'), false);
        showHideElement(getActionButtonElements('PIVOT'), false);
        showHideElement(getActionButtonElements('CLAIM'), false);
        return;
    }

    const aiPlayedLeadCard = playedCardList[0];

    // Hide the CLAIM button by default
    showHideElement(getActionButtonElements('CLAIM'), false);

    // Only show the claim button if:
    // - the inititive hasn't already been claimed this turn OR
    // - the active player has two or more cards to play
    if (hasInitiativeBeenClaimedThisTurn == false && getUnplayedCards(players[0].cards).length > 2) {
        showHideElement(getActionButtonElements('CLAIM'), true);
    }
    //(getUnplayedCards(players[0].cards).length < 2) ? showHideElement(getActionButtonElements('CLAIM'), false) : showHideElement(getActionButtonElements('CLAIM'), true)

    // Not leading so cannot Lead or Declare
    showHideElement(getActionButtonElements('LEAD'), false);
    showHideElement(getActionButtonElements('DECLARE'), false);

    if (card.name == aiPlayedLeadCard.name) {
        if (card.number > getCardValue(aiPlayedLeadCard)) {
            // Played the same suit and the number is higher so can Surpass.
            // Any card can be played face down to Copy
            showHideElement(getActionButtonElements('SURPASS'), true);
            showHideElement(getActionButtonElements('COPY'), true);
            showHideElement(getActionButtonElements('PIVOT'), false);
        } else {
            // card is the same suit but not higher so can only COPY
            showHideElement(getActionButtonElements('SURPASS'), false);
            showHideElement(getActionButtonElements('COPY'), true);
            showHideElement(getActionButtonElements('PIVOT'), false);
        }
    } else {
        // played a different suit so can Copy or Pivot
        showHideElement(getActionButtonElements('SURPASS'), false);
        showHideElement(getActionButtonElements('COPY'), true);
        showHideElement(getActionButtonElements('PIVOT'), true);
    }
}

function humanSelectedAction(cardAction) {

    const player = players[0];

    // Save the game first so the card can be undone
    saveUndoPoint(player.number);

    const btnSelected = document.querySelector('input.p1:checked');

    const playedCard = getCardByNameAndNumber(player.cards, btnSelected.id, false);
    enableDisableButton(getCardFullName(playedCard), true);

    if (isLeadingThisTurn()) {
        playCard(player, playedCard, "ANY", cardAction, false);
        showHideElement(document.querySelectorAll("#actionbuttons"), false);

    } else {

        player.hasPlayedACardThisTurn = true;
        addPlayedCardToList(playedCard, "ANY", cardAction, false, player);

        const aiPlayedLeadCard = playedCardList[0];

        const hasPlayerClaimed = document.getElementById("CLAIM").className.includes("active") ? true : false;

        if (hasPlayerClaimed) {
            hasInitiativeBeenClaimedThisTurn = true;
            changeInitiative(player);

            showCardModal(player, getUnplayedCards(player.cards), "Claim Card List", "Please select a card second card to play", "CLAIM");

        } else if (cardAction == "SURPASS" && isPlayedCardSameSuitAndHigher(playedCard, aiPlayedLeadCard)) {
            // Only a face up SURPASS can take the initiative. A higher card
            // played face down as a COPY doesn't count
            checkInitiative(player, playedCard, false);
        }

        // Stay with the human while their actions are carried out. Done moves on
        finishPlay(player);
    }

    SaveAllSettings();
}

function showCardModal(player, cards, title, prompt, action) {
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("cardsModal"));

    const cardsModalPrompt = document.querySelector("#cardsModalPrompt");
    cardsModalPrompt.innerHTML = prompt;

    const cardsModalTitle = document.querySelector("#cardsModalTitle");
    cardsModalTitle.innerHTML = title;

    const cardsModalList = document.querySelector("#cardsModalList");
    cardsModalList.replaceChildren();
    //const cards = getUnplayedCards(cards);
    cards.forEach(card => {
        let btn = document.createElement("button");
        btn.classList.add("btn", "btn-secondary", "mt-3");
        btn.setAttribute("data-bs-dismiss", "modal");
        btn.innerHTML = getCardFullName(card);

        switch (action) {
            case "CLAIM":
                btn.onclick = function () {
                    addPlayedCardToList(getCardByNameAndNumber(players[0].cards, btn.innerHTML, false), "ANY", "CLAIM", false, players[0]);
                    createCardButtonsForHumanPlayer();
                    // Update what Done shows the human played
                    finishPlay(players[0]);
                };
                break;

            case "DRAW":
                btn.onclick = function () {
                    drawCardIntoHand(player, getCardByNameAndNumber(cards, btn.innerHTML, true));
                };
                break;

            default:
                break;
        }

        cardsModalList.appendChild(btn);
    });
    modal.show();
}

function createCardButtonsForHumanPlayer() {
    const player = players[0];

    const playerhandDiv = document.getElementById("playerhand1");
    disposeTooltips(playerhandDiv);
    playerhandDiv.replaceChildren();

    player.cards.forEach(card => {

        let btn = createRadioButtons(getCardFullName(card), playerhandDiv, "cards", "btn-dark");

        btn.classList.add("p1");
        btn.value = card.number;

        // Add tooltip which displays the number of pips and ambition
        createTooltip('label[for="' + btn.id + '"]',getNumberOfPips(card, "LEAD") + "<br>" + card.ambition.toUpperCase() + "<br>" + getActionsOnCard(card));

        // Cards can only be played on the human's turn, before they've played this turn
        const canPlayNow = currentPlayer != null && currentPlayer.number == player.number && awaitingDone != player.number;
        if (card.played || !canPlayNow) { btn.disabled = true; }

        btn.onclick = function () {
            showHideElement(document.querySelectorAll("#actionbuttons"), true);

            // On a small screen the actions can be off screen, so bring them into view
            document.getElementById("actionbuttons").scrollIntoView({ block: "nearest", behavior: "smooth" });
            document.getElementById("CLAIM").classList.remove("active");
            if (isLeadingThisTurn()) {
                showHideActionButtons(true, getCardByNameAndNumber(players[0].cards, this.id, false));
            } else {
                const playedCard = getCardByNameAndNumber(player.cards, btn.id, false);
                showHideActionButtons(false, playedCard);
            }
        };

    });
}
