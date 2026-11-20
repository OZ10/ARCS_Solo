// A human player choosing a card and an action. Any human player (#67): their buttons are named for
// them (see getActionId), Player 1's as they always were.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function createRadioButtons(btntext, group, groupname, btnstyle, player = null, id = btntext) {
    let input = document.createElement("input");
    input.type = "radio";
    input.classList.add("btn-check");
    input.name = groupname;
    input.id = id;
    input.autocomplete = "off";
    //input.setAttribute("data-bs-toggle","button");

    let l = document.createElement("label");
    // No id on the label, as the input already uses btntext and ids must be unique.
    // Find the label with label[for="..."] instead
    l.classList.add("btn", btnstyle, "m-1");
    l.htmlFor = id;
    l.textContent = btntext.toUpperCase();

    if (groupname == "actiontype") {
        input.onclick = function () {
            // The player as they are now, not as they were when the button was made
            humanSelectedAction(btntext, player == null ? undefined : getPlayer(player.number));

            // Reset checked on all action type buttons
            document.querySelectorAll('input[name=actiontype]').forEach(input => { input.checked = false });
        };
    }

    group.appendChild(input);
    group.appendChild(l);

    return input;
}

function createClaimButton(btntext, group, groupname, id = btntext) {
    let input = document.createElement("button");
    input.type = "button";
    // Light so it shows on any player colour. claimbutton styles the toggled on (active) state
    input.classList.add("btn", "btn-light", "claimbutton", "m-1");
    input.name = groupname;
    input.id = id;
    input.innerHTML = btntext;
    input.setAttribute("data-bs-toggle", "button");

    group.appendChild(input);

    return input;
}

function getActionButtonElements(action, player = players[0]) {
    // The action's input (or CLAIM button) and the label that displays it, for this human player
    const id = getActionId(player, action);
    return document.querySelectorAll('#' + id + ', label[for="' + id + '"]');
}

function showHideActionButtons(isleading, card, player = players[0]) {
    // A campaign's Event cards have a button of their own (campaignhooks.js)
    if (runCampaignHook("actionButtons", isleading, card, player) === true) { return; }
    if (isleading) {
        showHideElement(getActionButtonElements('LEAD', player), true);
        showHideElement(getActionButtonElements('DECLARE', player), (card.number != 1 && declaredAmbitions.length < 3) ? true : false);
        showHideElement(getActionButtonElements('SURPASS', player), false);
        showHideElement(getActionButtonElements('COPY', player), false);
        showHideElement(getActionButtonElements('PIVOT', player), false);
        showHideElement(getActionButtonElements('CLAIM', player), false);
        return;
    }

    const aiPlayedLeadCard = playedCardList[0];

    // Hide the CLAIM button by default
    showHideElement(getActionButtonElements('CLAIM', player), false);

    // Only show the claim button if:
    // - the inititive hasn't already been claimed this turn OR
    // - the active player has two or more cards to play
    if (hasInitiativeBeenClaimedThisTurn == false && getUnplayedCards(player.cards).length > 2) {
        showHideElement(getActionButtonElements('CLAIM', player), true);
    }
    //(getUnplayedCards(players[0].cards).length < 2) ? showHideElement(getActionButtonElements('CLAIM', player), false) : showHideElement(getActionButtonElements('CLAIM', player), true)

    // Not leading so cannot Lead or Declare
    showHideElement(getActionButtonElements('LEAD', player), false);
    showHideElement(getActionButtonElements('DECLARE', player), false);

    if (card.name == aiPlayedLeadCard.name) {
        if (card.number > getCardValue(aiPlayedLeadCard)) {
            // Played the same suit and the number is higher so can Surpass.
            // Any card can be played face down to Copy
            showHideElement(getActionButtonElements('SURPASS', player), true);
            showHideElement(getActionButtonElements('COPY', player), true);
            showHideElement(getActionButtonElements('PIVOT', player), false);
        } else {
            // card is the same suit but not higher so can only COPY
            showHideElement(getActionButtonElements('SURPASS', player), false);
            showHideElement(getActionButtonElements('COPY', player), true);
            showHideElement(getActionButtonElements('PIVOT', player), false);
        }
    } else {
        // played a different suit so can Copy or Pivot
        showHideElement(getActionButtonElements('SURPASS', player), false);
        showHideElement(getActionButtonElements('COPY', player), true);
        showHideElement(getActionButtonElements('PIVOT', player), true);
    }
    // In a campaign, a Fate can seize another way (campaignhooks.js)
    runCampaignHook("afterActionButtons", card, player);
}

function humanSelectedAction(cardAction, player = players[0]) {

    // Save the game first so the card can be undone
    saveUndoPoint(player.number);

    const btnSelected = document.querySelector('input.p' + player.number + ':checked');

    const playedCard = getCardByNameAndNumber(player.cards, btnSelected.id, false);
    enableDisableButton(getCardFullName(playedCard), true);

    if (isLeadingThisTurn()) {
        playCard(player, playedCard, "ANY", cardAction, false);
        showHideElement(document.querySelectorAll("#" + getActionId(player, "actionbuttons")), false);

    } else {

        player.hasPlayedACardThisTurn = true;
        addPlayedCardToList(playedCard, "ANY", cardAction, false, player);
        // Your panel sections open once you've played, with the "Turn" setting (#152)
        refreshPanelSections(player);

        const aiPlayedLeadCard = playedCardList[0];

        const hasPlayerClaimed = document.getElementById(getActionId(player, "CLAIM")).className.includes("active") ? true : false;

        // In a campaign, the Partisan seizes by Provoking Outrage, then carries on itself (campaignhooks.js)
        if (hasPlayerClaimed && runCampaignHook("seizeByOutrage", player) === true) {
            SaveAllSettings();
            return;
        }
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
    cardsModalPrompt.innerHTML = tagPlayerNames(prompt);

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
                    addPlayedCardToList(getCardByNameAndNumber(player.cards, btn.innerHTML, false), "ANY", "CLAIM", false, player);
                    createCardButtonsForHumanPlayer();
                    // Update what Done shows the human played
                    finishPlay(player);
                };
                break;

            case "DRAW":
                btn.onclick = function () {
                    // The card shown, played or not: the bottom of the discard pile can be a
                    // card nobody was dealt (#117)
                    drawCardIntoHand(player, cards.find(card => getCardFullName(card) == btn.innerHTML));
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
    // Every human player's hand, then whether each is covered (#67)
    players.filter(player => player.isHuman).forEach(createCardButtonsFor);
    updateHandCovers();
}

function createCardButtonsFor(player) {
    const playerhandDiv = document.getElementById("playerhand" + player.number);
    if (playerhandDiv == null) { return; }
    disposeTooltips(playerhandDiv);
    playerhandDiv.replaceChildren();

    player.cards.forEach(card => {

        let btn = createRadioButtons(getCardFullName(card), playerhandDiv, "cards" + (player.number == 1 ? "" : player.number), "btn-dark");

        btn.classList.add("p" + player.number);
        btn.value = card.number;

        // Add tooltip which displays the number of pips and ambition
        createTooltip('label[for="' + btn.id + '"]',getNumberOfPips(card, "LEAD") + "<br>" + card.ambition.toUpperCase() + "<br>" + getActionsOnCard(card));

        // Cards can only be played on the human's turn, before they've played this turn
        const canPlayNow = currentPlayer != null && currentPlayer.number == player.number && awaitingDone != player.number;
        if (card.played || !canPlayNow) { btn.disabled = true; }

        btn.onclick = function () {
            const actionButtons = getActionId(player, "actionbuttons");
            showHideElement(document.querySelectorAll("#" + actionButtons), true);

            // On a small screen the actions can be off screen, so bring them into view
            document.getElementById(actionButtons).scrollIntoView({ block: "nearest", behavior: "smooth" });
            document.getElementById(getActionId(player, "CLAIM")).classList.remove("active");
            if (isLeadingThisTurn()) {
                showHideActionButtons(true, getCardByNameAndNumber(player.cards, this.id, false), player);
            } else {
                const playedCard = getCardByNameAndNumber(player.cards, btn.id, false);
                showHideActionButtons(false, playedCard, player);
            }
        };

    });
}
