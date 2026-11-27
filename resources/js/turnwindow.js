// The turn window (#99): once a player has played, everything about their turn in one place, with
// the buttons beside the steps they're for. Back to board shrinks it to a bar above the footer so
// the tiles can be tapped, and slot advice (#96) stays above the bar until it's closed or the
// turn ends. A bot's has its plan. The human player's lists their card's actions (#112).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// Open the window again as soon as whatever window is in the way has closed
let returnToTurnWindow = false;

// Where to put resources just gained (see getSlotAdvice)
let slotAdvice = [];

// The buttons a turn can offer: the panel's icons, which still do the work
const turnTools = {
    battle: { name: "Battle", icon: "bi-crosshair", button: "battlebutton", run: showBattleModal },
    build: { name: "Build", icon: "bi-hammer", button: "buildbutton", run: showBuildModal },
    court: { name: "Court", icon: "bi-bank", button: "courtbutton", run: showCourtModal },
    draw: { name: "Draw", icon: "bi-file-plus", headerIcon: true }
};

// Which button goes with an action in the plan or prelude
const turnActionTools = { battle: "battle", build: "build", secure: "court", influence: "court" };

// The human player's actions: an icon, a reminder for those with no window, and the window
const humanActionIcons = { move: "bi-arrows-move", battle: "bi-crosshair", secure: "bi-bank", influence: "bi-bank", tax: "bi-coin", build: "bi-hammer", repair: "bi-wrench" };
const humanActionNotes = { move: "Move your ships on the table", tax: "Tax a city you control", build: "Build on the table", repair: "Repair a damaged ship or building" };
const humanActionTools = { battle: "battle", secure: "court", influence: "court" };

function usesTurnWindow(player) {
    // Everyone's turn has the window (#112)
    return player != null;
}

function getTurnPlayer() {
    // The player whose turn window it is, or null
    const player = (awaitingDone != null) ? getPlayer(awaitingDone) : null;
    return (player != null && usesTurnWindow(player)) ? player : null;
}

function isAnyWindowOpen() {
    // Open or still closing. A window can't open until another has fully closed
    return document.querySelector(".modal-backdrop") != null
        || [...document.querySelectorAll(".modal")].some(modal => getComputedStyle(modal).display != "none");
}

function isTurnWindowOpen() {
    return document.getElementById("turnModal").classList.contains("show");
}

// Opening and closing

function openTurnWindow() {
    const player = getTurnPlayer();
    if (player == null) { return; }

    // The plan is set now, after its prelude and Guild actions. Securing a card or winning a
    // Battle can change what it's chasing, but the plan shouldn't reshuffle part way through (#105)
    if (player.turnPlan == null) {
        player.turnPlan = getTurnPlan(player);
        SaveAllSettings();
    }

    renderTurn(player);
    if (isTurnWindowOpen()) { return; }
    if (isAnyWindowOpen() || hasLeaderWindowsWaiting()) {
        returnToTurnWindow = true;
        return;
    }

    returnToTurnWindow = false;
    bootstrap.Modal.getOrCreateInstance(document.getElementById("turnModal")).show();
}

function closeTurnWindow(afterClosed) {
    const modal = document.getElementById("turnModal");
    if (afterClosed != null) { modal.addEventListener('hidden.bs.modal', afterClosed, { once: true }); }
    bootstrap.Modal.getOrCreateInstance(modal).hide();
}

// A bot's Battle from its prelude row (#231): the window opens before its card's actions
let battleFromPrelude = false;

function useTurnTool(name, fromPrelude = false) {
    // Close the window and open the tool's. The window comes back once that's finished
    const tool = turnTools[name];
    battleFromPrelude = fromPrelude === true;
    const number = awaitingDone;
    const run = () => {
        if (tool.headerIcon) {
            document.querySelector("#player" + number + " ." + tool.icon).click();
        } else {
            tool.run(document.getElementById(tool.button + number));
        }
    };

    returnToTurnWindow = true;
    closeTurnWindow(run);
}

function turnDone() {
    // A bot's Moves, Builds and Repairs go on the board (boardbot.js, #160)
    const player = getTurnPlayer();
    if (player != null && !player.isHuman) { applyBotPlanToBoard(player); }
    closeTurnWindow(doneClick);
}

document.addEventListener('hidden.bs.modal', event => {
    // A tool's window has closed. If it opened another, such as a Vox card, wait for that too
    if (returnToTurnWindow && event.target.id != "turnModal" && !isAnyWindowOpen()) { openTurnWindow(); }
});

// What it shows

function getToolButton(name, fromPrelude = false) {
    const tool = turnTools[name];
    return "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"turnTool_" + name + (fromPrelude ? "_prelude" : "") + "\" onclick=\"useTurnTool('" + name + "'" + (fromPrelude ? ", true" : "") + ")\"><i class=\"bi " + tool.icon + "\"></i> " + tool.name + "</button>";
}

function getTurnRow(marker, text, note, buttons) {
    return "<div class=\"turnstep\"><span class=\"turnmarker\">" + marker + "</span>"
        + "<div class=\"turnsteptext\">" + tagPlayerNames(text) + (note ? "<small>" + tagPlayerNames(note) + "</small>" : "") + "</div>"
        + (buttons || "") + "</div>";
}

function getTurnSection(label, html) {
    return "<div class=\"turnsection\"><div class=\"turnlabel\">" + label + "</div>" + html + "</div>";
}

function getSplitPlanStep(step, player) {
    // "Battle (chasing Warlord)" is the step and its reason. A Battle also says who and where
    const parts = /^(.*?) \((.*)\)$/.exec(step.text);
    const split = parts == null ? { name: step.text, reason: "" } : { name: parts[1], reason: capitalise(parts[2]) };
    // A Battle with nothing left to fight says so as it is (#228)
    const target = (step.action == "battle" && !step.skip) ? getBattleTarget(player) : null;
    if (target == null) { return split; }
    // Where, from the board (boardbot.js, #160)
    // Once the board has chosen the system, the general advice on where to battle is left out
    const at = step.where != null && step.where.system != null ? " at " + getSystemName(step.where.system) : "";
    // Its Rival and why, for the system the board chose: raid dice only where they work (#228). A
    // later Battle may have moved on to another Rival once the first had nothing left there
    const rival = step.where != null && typeof step.where.battle == "number" && target.title == null ? getPlayer(step.where.battle) : null;
    const why = rival != null ? getBattleTargetReason(player, rival, step.where.system).why : target.why;
    const name = rival != null ? "Battle Player " + rival.number : (target.title || "Battle Player " + target.player.number);
    return { name: name + at, reason: [split.reason ? split.reason + "." : "", why, at == "" ? target.where : ""].filter(text => text != null && text != "").join(" ") };
}

function getOfferRows(offers) {
    // Prelude or Guild actions carried out. Their tiles have already been updated
    // A bot's prelude Move, Build or ship placement has a place on the board, and a Completed
    // button like its plan's steps (#197)
    // Its Lore actions with a place too (leaderrules.js)
    const player = getTurnPlayer() || {};
    const isPrelude = offers === getBotPreludeSpent(player), isGuild = !player.isHuman && offers === getBotGuildSpent(player);
    // A bot's prelude Battle opens before its card's actions (#231)
    const tool = offer => turnActionTools[offer.action] != null ? getToolButton(turnActionTools[offer.action], offer.action == "battle" && !offer.converts && isPrelude && !player.isHuman) : "";
    const complete = (offer, index) => (isPrelude || isGuild) && canCompleteBotStep(offer)
        ? (offer.applied ? "<span class=\"small text-secondary\">Done</span>" : "<button type=\"button\" class=\"btn btn-outline-primary btn-sm turnact\" id=\"" + (isGuild ? "completeGuild" : "completeOffer") + index + "\" onclick=\"" + (isGuild ? "completeBotGuildOffer" : "completeBotPreludeOffer") + "(" + index + ")\"><i class=\"bi bi-check-lg\"></i> Completed</button>") : "";
    return offers.map((offer, index) => getTurnRow("<i class=\"bi bi-check-lg\"></i>", offer.label, capitalise(offer.text), tool(offer) + complete(offer, index))).join("");
}

function getCardHtml(player) {
    // What it played, then what that gives it. e.g. "Led with Aggression 5" and "2 actions (...)"
    const lines = describePlayerPlays(player).map(line => {
        const [played, actions] = line.split(": ");
        const declared = declaredAmbitions.length > 0 ? "declared " + capitalise(declaredAmbitions[declaredAmbitions.length - 1]) : "declared an ambition";
        return "<div><b>" + played.replace(/([A-Za-z])(\d)/, "$1 $2").replace("declared an ambition", declared) + "</b></div>"
            + (actions ? "<div class=\"small text-muted\">" + capitalise(actions) + "</div>" : "");
    });
    // (No "It could build, but..." note: the board answers that now, and it cluttered the window, #217)
    return lines.join("");
}

function getAlsoTools(player, planned) {
    // Anything else it could use: what its card allows but the plan doesn't list, and the rest
    // In a campaign, not a Battle its Fate rules out (campaignhooks.js)
    const possible = { battle: canBotTakeAction(player, "battle") && runCampaignHook("avoidsAction", player, "battle") !== true, build: canBotTakeAction(player, "build"), court: canBotTakeAction(player, "influence") || canBotTakeAction(player, "secure") };
    return Object.keys(possible).filter(name => possible[name] && !planned.includes(name)).concat("draw");
}

function getNewsSection() {
    // What happened, at the top of the turn window (ui.js keeps it up to date)
    const html = getNewsHtml();
    return "<div class=\"turnsection" + (html == "" ? " d-none" : "") + "\" id=\"turnNewsSection\">" + html + "</div>";
}

function getSlotAdviceHtml() {
    // Where to put what was just gained, the first slot to try first
    return slotAdvice.map(advice => {
        const who = (advice.player !== getTurnPlayer()) ? getPlayerTag(advice.player) + " " : "";
        const slots = (advice.slots || []).map(slot => "<span class=\"slotchip\"><b>" + (typeof slot.slot == "number" ? "Slot " + slot.slot : slot.slot) + "</b><small>" + slot.keys + " key" + (slot.keys == 1 ? "" : "s") + "</small></span>").join("<i class=\"bi bi-arrow-right\"></i>");
        return "<div class=\"slotadvice\"><div class=\"d-flex align-items-start\"><b class=\"flex-fill\">" + who + advice.title + "</b>"
            + "<button type=\"button\" class=\"btn-close btn-sm\" aria-label=\"Close\" onclick=\"clearSlotAdvice()\"></button></div>"
            + (advice.why ? "<div class=\"small text-muted\">" + advice.why + "</div>" : "")
            + (slots ? "<div class=\"slotchips\">" + slots + "</div>" : "") + "</div>";
    }).join("");
}

function getAlsoButton(name) {
    const tool = turnTools[name];
    return "<button type=\"button\" class=\"btn btn-outline-secondary\" id=\"turnTool_" + name + "\" onclick=\"useTurnTool('" + name + "')\"><i class=\"bi " + tool.icon + "\"></i>" + tool.name + "</button>";
}

function getMarketShortfallSection(offered) {
    // A card has left the market: add its replacement
    const shortfall = getMarketShortfall();
    if (shortfall <= 0) { return ""; }
    return getTurnSection("The Court", getTurnRow("<i class=\"bi bi-exclamation-lg\"></i>", "The market is " + shortfall + " card" + (shortfall == 1 ? "" : "s") + " short", "Add " + (shortfall == 1 ? "the replacement" : "the replacements"), offered.includes("court") ? "" : getToolButton("court")));
}

function showTurnHtml(player, title, html) {
    const header = document.querySelector("#turnModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("turnTitle").innerHTML = title;
    document.getElementById("turnBody").innerHTML = html;

    const next = getNextPlayerToPlay(player);
    document.getElementById("turnDone").innerHTML = (next == null) ? "Done: end of turn" : "Done &rarr; Player " + next.number;

    updateTurnDock();
}

function renderHumanTurn(player) {
    // The actions their card and prelude give them: what's done, with Undo, and how many are left,
    // each with its window. Battle and Court are always somewhere (boardhuman.js, #160)
    const offered = [];
    let html = getNewsSection();
    if (slotAdvice.length > 0) { html += getTurnSection("Resources gained", getSlotAdviceHtml()); }
    // What your resources and Guild cards can do first (#127)
    const prelude = getPreludeHtml(player);
    if (prelude != "") { html += getTurnSection("Prelude: before your actions", prelude); }
    html += getTurnSection("Card played", getCardHtml(player));
    html += getHumanActionSections(player, offered);
    // A Blighted Reach Fate's own actions, each on the board (campaign/fatehuman.js)
    if (typeof getHumanFateSectionHtml == "function") { html += getHumanFateSectionHtml(player); }
    // Leaders & Lore: your Lore cards' own actions (lorehuman.js, #221)
    if (typeof getHumanLoreSectionHtml == "function") { html += getHumanLoreSectionHtml(player); }
    const shortfall = getMarketShortfallSection(offered);
    if (shortfall != "") { html += shortfall; offered.push("court"); }
    html += getTurnSection("Also", "<div class=\"turntools\">" + ["battle", "court"].filter(name => !offered.includes(name)).concat("draw").map(getAlsoButton).join("") + "</div>");
    showTurnHtml(player, isYou(player) ? "Your turn" : "Player " + player.number + "'s turn", html);
}

function renderTurn(player) {
    if (player.isHuman) { renderHumanTurn(player); return; }
    // Its Moves where its ships will really stop, on the board as it is now (boardbot.js)
    if (player.turnPlan != null) { refreshBotMoveStops(player); }
    const plan = getTurnPlan(player).map(step => ({ ...step, ...getSplitPlanStep(step, player) }));
    const prelude = (player.prelude != null && player.prelude.spent != null) ? player.prelude.spent : [];
    const guild = (player.guildActions != null && player.guildActions.spent != null) ? player.guildActions.spent : [];
    const planned = plan.map(step => turnActionTools[step.action]).filter(name => name != null);

    // The window. A tool is offered once, against the first step that needs it
    const offered = [];
    const planRows = plan.map((step, index) => {
        const name = turnActionTools[step.action];
        let button = (name != null && !offered.includes(name)) ? getToolButton(name) : "";
        if (name != null) { offered.push(name); }
        // Completed: the step goes on the board now, so the next one counts from it (#201)
        const marker = step.applied ? "<i class=\"bi bi-check-lg\"></i>" : index + 1;
        if (canCompleteBotStep(step)) {
            button = step.applied ? "<span class=\"small text-secondary\">Done</span>"
                : button + "<button type=\"button\" class=\"btn btn-outline-primary btn-sm turnact\" id=\"completeStep" + index + "\" onclick=\"completeBotStep(" + index + ")\"><i class=\"bi bi-check-lg\"></i> Completed</button>";
        }
        // A campaign Fate's tag, on a step its Fate shaped (steering.js)
        return getTurnRow(marker, step.name, step.reason + (step.tag || "") + getLeaderHintsHtml(step.hints), button);
    }).join("");

    let html = getNewsSection();
    if (slotAdvice.length > 0) { html += getTurnSection("Resources gained", getSlotAdviceHtml()); }
    if (prelude.length > 0) { html += getTurnSection("Prelude: spend first", getOfferRows(prelude)); }
    html += getTurnSection("Card played", getCardHtml(player));
    // In a campaign, the Empire's laws for this plan (campaignhooks.js)
    html += runCampaignHook("turnSections", player, plan) || "";
    if ((player.leaderNotes || []).length > 0) {
        html += getTurnSection("Leader: " + getLeaderName(player), player.leaderNotes.map(note => getTurnRow("<i class=\"bi bi-check-lg\"></i>", note.title, note.note)).join(""));
    }
    if (player.farseersSwap != null) {
        html += getTurnSection("Farseers", getTurnRow("<i class=\"bi bi-arrow-left-right\"></i>", player.farseersSwap.title, player.farseersSwap.note));
    }
    if (planRows != "") { html += getTurnSection("Plan", planRows); }
    if (guild.length > 0) { html += getTurnSection(hasLoreOffers(guild) ? "Guild and Lore actions" : "Guild actions", getOfferRows(guild)); }
    const shortfall = getMarketShortfallSection(offered);
    if (shortfall != "") { html += shortfall; planned.push("court"); }
    html += getTurnSection("Also", "<div class=\"turntools\">" + getAlsoTools(player, planned).map(getAlsoButton).join("") + "</div>");

    showTurnHtml(player, "Player " + player.number + "'s turn", html);
}

function getBarPlan(player) {
    // The plan's steps, the same step twice in a row shown once with how many
    const steps = getTurnPlan(player).map(step => getSplitPlanStep(step, player).name);
    if (steps.length == 0) { return "No actions"; }
    return steps.filter((step, index) => index == 0 || step != steps[index - 1])
        .map(step => { const count = steps.filter(other => other == step).length; return step + (count > 1 ? " &times;" + count : ""); }).join(" &rarr; ");
}

function updateTurnDock() {
    // The bar and the slot advice above the footer
    const player = getTurnPlayer();
    // And each player's cards in hand, in their banner (#206)
    updateCardCounts();
    const bar = document.getElementById("turnBar");
    if (player != null) {
        bar.className = "turnbar playerbanner" + getPlayerColour(player);
        // The human player's bar has the actions their card gives them
        const summary = !player.isHuman ? getBarPlan(player) : getHumanActionsLeftText(player);
        bar.innerHTML = "<div class=\"turnbarplan\"><b>" + (isYou(player) ? "Your turn" : "Player " + player.number + "'s turn") + "</b><div class=\"turnbarsteps\">" + summary + "</div></div>"
            + "<button type=\"button\" class=\"btn btn-light btn-sm\" id=\"turnBarOpen\" onclick=\"openTurnWindow()\"><i class=\"bi bi-chevron-up\"></i> Open</button>";
    }
    showHideElement([bar], player != null);

    const advice = document.getElementById("turnAdvice");
    advice.innerHTML = getSlotAdviceHtml();
    showHideElement([advice], slotAdvice.length > 0);
}

function setSlotAdvice(advice) {
    slotAdvice = advice;
    const player = getTurnPlayer();
    if (player != null) { renderTurn(player); } else { updateTurnDock(); }
}

function clearSlotAdvice() {
    setSlotAdvice([]);
}

function clearTurnDock() {
    // The turn is over
    returnToTurnWindow = false;
    slotAdvice = [];
    updateTurnDock();
}

// Room for the bar and advice under the page, as for the footer (see keepClearOfFooter)
document.addEventListener("DOMContentLoaded", () => {
    if (typeof ResizeObserver == "undefined") { return; }
    const dock = document.getElementById("turnDock");
    new ResizeObserver(() => {
        document.documentElement.style.setProperty("--turndock-height", dock.offsetHeight + "px");
    }).observe(dock);
});
