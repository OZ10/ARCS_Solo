// The turn window (#99): once a bot has played, everything about its turn in one place, with
// the buttons beside the steps they're for. Back to board shrinks it to a bar above the footer so
// the tiles can be tapped, and slot advice (#96) stays above the bar until it's closed or the
// turn ends. The human player chooses their own actions, so keeps the panel (see showTurnDone).
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

function usesTurnWindow(player) {
    return !player.isHuman;
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

function useTurnTool(name) {
    // Close the window and open the tool's. The window comes back once that's finished
    const tool = turnTools[name];
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
    closeTurnWindow(doneClick);
}

document.addEventListener('hidden.bs.modal', event => {
    // A tool's window has closed. If it opened another, such as a Vox card, wait for that too
    if (returnToTurnWindow && event.target.id != "turnModal" && !isAnyWindowOpen()) { openTurnWindow(); }
});

// What it shows

function getToolButton(name) {
    const tool = turnTools[name];
    return "<button type=\"button\" class=\"btn btn-primary btn-sm turnact\" id=\"turnTool_" + name + "\" onclick=\"useTurnTool('" + name + "')\"><i class=\"bi " + tool.icon + "\"></i> " + tool.name + "</button>";
}

function getTurnRow(marker, text, note, buttons) {
    return "<div class=\"turnstep\"><span class=\"turnmarker\">" + marker + "</span>"
        + "<div class=\"turnsteptext\">" + text + (note ? "<small>" + note + "</small>" : "") + "</div>"
        + (buttons || "") + "</div>";
}

function getTurnSection(label, html) {
    return "<div class=\"turnsection\"><div class=\"turnlabel\">" + label + "</div>" + html + "</div>";
}

function getSplitPlanStep(step, player) {
    // "Battle (chasing Warlord)" is the step and its reason. A Battle also says who and where
    const parts = /^(.*?) \((.*)\)$/.exec(step.text);
    const split = parts == null ? { name: step.text, reason: "" } : { name: parts[1], reason: capitalise(parts[2]) };
    const target = (step.action == "battle") ? getBattleTarget(player) : null;
    if (target == null) { return split; }
    return { name: "Battle Player " + target.player.number, reason: [split.reason ? split.reason + "." : "", target.why, target.where].filter(text => text != "").join(" ") };
}

function getOfferRows(offers) {
    // Prelude or Guild actions carried out. Their tiles have already been updated
    const tool = offer => turnActionTools[offer.action] != null ? getToolButton(turnActionTools[offer.action]) : "";
    return offers.map(offer => getTurnRow("<i class=\"bi bi-check-lg\"></i>", offer.label, capitalise(offer.text), tool(offer))).join("");
}

function getCardHtml(player) {
    // What it played, then what that gives it. e.g. "Led with Aggression 5" and "2 actions (...)"
    const lines = describePlayerPlays(player).map(line => {
        const [played, actions] = line.split(": ");
        const declared = declaredAmbitions.length > 0 ? "declared " + capitalise(declaredAmbitions[declaredAmbitions.length - 1]) : "declared an ambition";
        return "<div><b>" + played.replace(/([A-Za-z])(\d)/, "$1 $2").replace("declared an ambition", declared) + "</b></div>"
            + (actions ? "<div class=\"small text-muted\">" + capitalise(actions) + "</div>" : "");
    });
    const change = describeBuildChange(player);
    return lines.join("") + (change != null ? "<div class=\"small fst-italic mt-1\">" + change + "</div>" : "");
}

function getAlsoTools(player, planned) {
    // Anything else it could use: what its card allows but the plan doesn't list, and the rest
    const possible = { battle: canBotTakeAction(player, "battle"), build: canBotTakeAction(player, "build"), court: canBotTakeAction(player, "influence") || canBotTakeAction(player, "secure") };
    return Object.keys(possible).filter(name => possible[name] && !planned.includes(name)).concat("draw");
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

function renderTurn(player) {
    const plan = getTurnPlan(player).map(step => ({ ...step, ...getSplitPlanStep(step, player) }));
    const prelude = (player.prelude != null && player.prelude.spent != null) ? player.prelude.spent : [];
    const guild = (player.guildActions != null && player.guildActions.spent != null) ? player.guildActions.spent : [];
    const planned = plan.map(step => turnActionTools[step.action]).filter(name => name != null);

    // The window. A tool is offered once, against the first step that needs it
    const offered = [];
    const planRows = plan.map((step, index) => {
        const name = turnActionTools[step.action];
        const button = (name != null && !offered.includes(name)) ? getToolButton(name) : "";
        if (name != null) { offered.push(name); }
        return getTurnRow(index + 1, step.name, step.reason + getLeaderHintsHtml(step.hints), button);
    }).join("");
    const shortfall = getMarketShortfall();

    let html = "";
    if (slotAdvice.length > 0) { html += getTurnSection("Resources gained", getSlotAdviceHtml()); }
    if (prelude.length > 0) { html += getTurnSection("Prelude: spend first", getOfferRows(prelude)); }
    html += getTurnSection("Card played", getCardHtml(player));
    if ((player.leaderNotes || []).length > 0) {
        html += getTurnSection("Leader: " + getLeaderName(player), player.leaderNotes.map(note => getTurnRow("<i class=\"bi bi-check-lg\"></i>", note.title, note.note)).join(""));
    }
    if (player.farseersSwap != null) {
        html += getTurnSection("Farseers", getTurnRow("<i class=\"bi bi-arrow-left-right\"></i>", player.farseersSwap.title, player.farseersSwap.note));
    }
    if (planRows != "") { html += getTurnSection("Plan", planRows); }
    if (guild.length > 0) { html += getTurnSection(hasLoreOffers(guild) ? "Guild and Lore actions" : "Guild actions", getOfferRows(guild)); }
    if (shortfall > 0) {
        html += getTurnSection("The Court", getTurnRow("<i class=\"bi bi-exclamation-lg\"></i>", "The market is " + shortfall + " card" + (shortfall == 1 ? "" : "s") + " short", "Add " + (shortfall == 1 ? "the replacement" : "the replacements"), offered.includes("court") ? "" : getToolButton("court")));
        planned.push("court");
    }
    html += getTurnSection("Also", "<div class=\"turntools\">" + getAlsoTools(player, planned).map(name => {
        const tool = turnTools[name];
        return "<button type=\"button\" class=\"btn btn-outline-secondary\" id=\"turnTool_" + name + "\" onclick=\"useTurnTool('" + name + "')\"><i class=\"bi " + tool.icon + "\"></i>" + tool.name + "</button>";
    }).join("") + "</div>");

    const header = document.querySelector("#turnModal .modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    header.classList.add("playerbanner" + getPlayerColour(player));
    document.getElementById("turnTitle").innerHTML = "Player " + player.number + "'s turn";
    document.getElementById("turnBody").innerHTML = html;

    const next = getNextPlayerToPlay(player);
    document.getElementById("turnDone").innerHTML = (next == null) ? "Done: end of turn" : "Done &rarr; Player " + next.number;

    updateTurnDock();
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
    const bar = document.getElementById("turnBar");
    if (player != null) {
        bar.className = "turnbar playerbanner" + getPlayerColour(player);
        bar.innerHTML = "<div class=\"turnbarplan\"><b>Player " + player.number + "'s turn</b>" + getBarPlan(player) + "</div>"
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
