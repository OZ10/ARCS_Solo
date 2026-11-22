// Blighted Reach campaign (#85): the campaign frame. Choosing a campaign at New Game, each player's
// Fate, title (Regent or Outlaw), objective, Favors and the Imperial Trust, and the Acts and chapters.
// It plugs into the base game only through the hooks in campaignhooks.js, so a base game plays
// exactly as before. The rules are summarised in resources/cards/BR_rules_notes.md (kept on this PC).
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// The campaign's state, saved with the game. null outside a campaign
// act          - 1, 2 or 3
// fateMode     - how Fates are chosen: { humans: "deal" or "pick", bots: "deal" or "pick" }
// players      - by player number: { fate, title ("regent" or "outlaw"), objective (the marker's
//                space), favors: { player number: agents of theirs held } }
// firstRegent  - the player number holding the First Regent tile, or null
// trust        - the Imperial Trust's resources, on the First Regent tile
let campaign = null;

const chaptersInAct = { 1: 3, 2: 3, 3: 4 };
const actNames = { 1: "Act I", 2: "Act II", 3: "Act III" };
const trustResources = ["fuel", "materials", "weapons", "relics", "psionics"];

function getCampaignPlayer(player) {
    return campaign.players[player.number];
}

function isFirstRegent(player) {
    return campaign != null && campaign.firstRegent == player.number;
}

// New Game: the campaign switch and how Fates are chosen, under the number of players

document.addEventListener("DOMContentLoaded", () => {
    const holder = document.getElementById("campaignOptions");
    if (holder == null) { return; }
    const choice = (name, first, firstNote, second, secondNote) => "<div class=\"brseg\">"
        + "<input type=\"radio\" class=\"btn-check\" name=\"" + name + "\" id=\"" + name + "Deal\" value=\"deal\" checked><label class=\"btn btn-outline-secondary\" for=\"" + name + "Deal\">" + first + "<small>" + firstNote + "</small></label>"
        + "<input type=\"radio\" class=\"btn-check\" name=\"" + name + "\" id=\"" + name + "Pick\" value=\"pick\"><label class=\"btn btn-outline-secondary\" for=\"" + name + "Pick\">" + second + "<small>" + secondNote + "</small></label></div>";
    holder.innerHTML = "<div class=\"optrow optswitch\"><label class=\"form-check-label\" for=\"campaignSwitch\"><b>Blighted Reach campaign</b><small>Three Acts with Fates, the Empire and the Blight</small></label>"
        + "<div class=\"form-check form-switch m-0\"><input class=\"form-check-input\" type=\"checkbox\" id=\"campaignSwitch\" onchange=\"showCampaignOptions()\"></div></div>"
        + "<div class=\"optrow d-none\" id=\"campaignFateOptions\">"
        + "<div class=\"optlabel\" id=\"humanFatesLabel\">Your Fate</div>" + choice("humanFates", "Deal 2", "Choose 1 of them", "Pick", "Any \"A\" Fate")
        + "<div id=\"botFatesRow\"><div class=\"optlabel mt-3\">The bots' Fates</div>" + choice("botFates", "Deal 2", "Bot chooses 1", "Pick", "You choose for each bot") + "</div>"
        + "<div class=\"brhint\">Pick lets you try a particular Fate. The campaign uses its own Court cards and has no setup cards.</div></div>";
    document.querySelectorAll("input[name=humanCount]").forEach(input => input.addEventListener("change", showCampaignOptions));
});

function showCampaignOptions() {
    // The Fate choices while the campaign is switched on. It has no Leaders
    const on = isCampaignChosen();
    document.getElementById("campaignFateOptions").classList.toggle("d-none", !on);
    document.getElementById("leadersAndLoreSwitch").closest(".optrow").classList.toggle("d-none", on);
    // And how its rows are dealt (leaders.js)
    showLeadersRowsChoice();
    const humans = getChosenHumanCount();
    document.getElementById("humanFatesLabel").innerHTML = (humans == 1) ? "Your Fate" : "Human players' Fates";
    document.querySelector("label[for=humanFatesDeal] small").innerHTML = (humans == 1) ? "Choose 1 of them" : "Each chooses 1";
    document.getElementById("botFatesRow").classList.toggle("d-none", humans >= 4);
}

// The hooks (campaignhooks.js)

registerCampaignHook("modeChanged", () => {
    // A game has started or loaded: show the campaign, or take it off the screen
    const campaignSwitch = document.getElementById("campaignSwitch");
    if (campaignSwitch != null && players.length > 0) { campaignSwitch.checked = campaignMode; showCampaignOptions(); }
    if (!campaignMode) { campaign = null; }
    showCampaignTopBar();
});

registerCampaignHook("afterSetup", () => {
    campaign = {
        act: 1,
        fateMode: {
            humans: document.querySelector("input[name=humanFates]:checked").value,
            bots: document.querySelector("input[name=botFates]:checked").value
        },
        players: {},
        firstRegent: null,
        trust: {},
        // The Govern the Imperial Reach card on top: shuffled at setup (rulebook p.5)
        policy: ["war", "peace", "escalation"][Math.floor(Math.random() * 3)]
    };
    trustResources.forEach(resource => { campaign.trust[resource] = 0; });
    players.forEach(player => {
        campaign.players[player.number] = { fate: null, title: "regent", objective: 0, favors: {} };
    });
    players.forEach(showCampaignPanel);
    showCampaignTopBar();
});

registerCampaignHook("save", () => {
    saveSettingObject("campaignMode", true);
    saveSettingObject("campaign", campaign);
});

registerCampaignHook("load", () => {
    campaign = getSettingObject("campaign");
});

registerCampaignHook("panelBuilt", player => {
    if (campaign != null) { showCampaignPanel(player); }
});

registerCampaignHook("startSetup", carryOn => {
    // Act I: each player's Fate, then the opening Court
    chooseFates(1, carryOn);
    return true;
});

registerCampaignHook("markerRound", round => {
    // Act II starts with the lowest marker flipped, Act III with the two lowest (rulebook p.7),
    // which match the base game's rounds 2 and 3
    return Math.min(round + (campaign == null ? 1 : campaign.act) - 1, 5);
});

registerCampaignHook("roundShown", () => showCampaignTopBar());

registerCampaignHook("isGameOver", () => {
    // Acts I and II end after 3 chapters and Act III after 4, never on Power (rulebook p.8). Between
    // Acts the campaign is still going. In Act III, a "C" Fate with its final objective complete and
    // at least 1 Power wins at the end of a chapter (rulebook p.9)
    if (campaign == null) { return undefined; }
    // Between Acts (intermission.js). Setting up the next Act counts as playing it
    if (campaign.stage != null && campaign.stage != "actSetup") { return campaign.stage == "over"; }
    return roundNumber >= chaptersInAct[campaign.act] || getFinalObjectiveWinners().length > 0;
});

function getFinalObjectiveWinners() {
    if (campaign.act != 3) { return []; }
    return players.filter(player => {
        const state = getCampaignPlayer(player);
        return getFate(state.fate).set == "C" && state.objective === 0 && player.powerValue >= 1;
    });
}

registerCampaignHook("powerTarget", () => {
    // No Power wins an Act, so the bars are against the highest Power
    const highest = Math.max(...players.map(player => player.powerValue));
    return { target: Math.max(highest + 10, 20), text: actNames[campaign.act] + ", chapter " + roundNumber + " of " + chaptersInAct[campaign.act] };
});

registerCampaignHook("ambitionExtra", (player, ambition) => {
    // The Imperial Trust's resources are frozen but count for the First Regent's ambitions (rulebook p.21)
    if (!isFirstRegent(player)) { return 0; }
    const counts = { tycoon: campaign.trust.fuel + campaign.trust.materials, keeper: campaign.trust.relics, empath: campaign.trust.psionics };
    return counts[ambition] || 0;
});

// A window for the campaign's steps

function getCampaignModal() {
    let modal = document.getElementById("campaignModal");
    if (modal != null) { return modal; }
    document.body.insertAdjacentHTML("beforeend", "<div class=\"modal fade\" id=\"campaignModal\" tabindex=\"-1\" aria-labelledby=\"campaignTitle\" aria-hidden=\"true\">"
        + "<div class=\"modal-dialog modal-dialog-scrollable\"><div class=\"modal-content\"><div class=\"modal-header\"><h5 class=\"modal-title\" id=\"campaignTitle\"></h5>"
        + "<button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"modal\" aria-label=\"Close\"></button></div>"
        + "<div class=\"modal-body campaignbody\" id=\"campaignBody\"></div></div></div></div>");
    return document.getElementById("campaignModal");
}

function showCampaignWindow(title, html, player = null, locked = false, onClosed = null) {
    // One window at a time: it opens once any other has closed, or if it's already open it changes
    // what it shows. player colours the title bar. What follows a window runs once Bootstrap has
    // finished closing it, as opening it again inside its own closing breaks it
    if (onClosed != null) { const then = onClosed; onClosed = () => setTimeout(then, 0); }
    const open = getCampaignModal();
    if (open.classList.contains("show")) {
        setCampaignWindow(title, html, player);
        if (onClosed != null) { open.addEventListener('hidden.bs.modal', onClosed, { once: true }); }
        return;
    }
    whenWindowsClosed(() => {
        const modal = getCampaignModal();
        setCampaignWindow(title, html, player);
        if (onClosed != null) { modal.addEventListener('hidden.bs.modal', onClosed, { once: true }); }
        if (locked) { showLockedModal(modal); } else { setModalLocked(modal, false); bootstrap.Modal.getOrCreateInstance(modal).show(); }
    });
}

function setCampaignWindow(title, html, player = null) {
    // Change what an open window shows
    const modal = getCampaignModal();
    document.getElementById("campaignTitle").innerHTML = title;
    document.getElementById("campaignBody").innerHTML = tagPlayerNames(html);
    const header = modal.querySelector(".modal-header");
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    if (player != null) { header.classList.add("playerbanner" + getPlayerColour(player)); }
    document.getElementById("campaignBody").scrollTop = 0;
}

function closeCampaignWindow() {
    bootstrap.Modal.getOrCreateInstance(getCampaignModal()).hide();
}

// Choosing Fates (rulebook p.6): dealt 2 and choosing 1, or picked, for the human players and the bots

let fateChoice = null;

function chooseFates(act, then) {
    const set = { 1: "A", 2: "B", 3: "C" }[act];
    fateChoice = { set: set, act: act, then: then, deck: shuffleCards(getFatesInSet(set).map(fate => fate.number)), queue: [], keeping: {} };
    // Everyone is dealt at once, as at the table: 2 cards each. After an Act, a player who completed
    // their objective draws 1 and chooses between it and their own Fate (rulebook p.29)
    const dealt = {};
    players.forEach(player => {
        const mode = player.isHuman ? campaign.fateMode.humans : campaign.fateMode.bots;
        const state = getCampaignPlayer(player);
        const keeping = act > 1 && state.completed === true ? state.fate : null;
        fateChoice.keeping[player.number] = keeping;
        if (mode == "deal") { dealt[player.number] = keeping != null ? [dealFate(player), keeping] : [dealFate(player), dealFate(player)]; }
        state.previousFate = state.fate;
        state.fate = null;
    });
    fateChoice.dealt = dealt;
    // The human players first, in seat order, then any bots someone picks for. Bots dealt 2 choose now
    players.filter(player => player.isHuman).forEach(player => fateChoice.queue.push({ player: player, picker: "self" }));
    players.filter(player => !player.isHuman).forEach(player => {
        if (dealt[player.number] != null) {
            getCampaignPlayer(player).fate = dealt[player.number][Math.floor(Math.random() * 2)];
        } else {
            fateChoice.queue.push({ player: player, picker: "human" });
        }
    });
    nextFateChoice();
}

// The Fates being chosen are saved with the campaign, so reloading the app carries on with the same
// Fates dealt and those already taken (after Acts I and II; Act I's is part of starting a new game)

function saveFateChoice() {
    if (fateChoice == null || fateChoice.act < 2) { return; }
    const ref = item => item == null ? null : { player: item.player.number, picker: item.picker };
    campaign.fateChoice = { set: fateChoice.set, act: fateChoice.act, deck: fateChoice.deck, dealt: fateChoice.dealt, keeping: fateChoice.keeping,
        queue: fateChoice.queue.map(ref), current: ref(fateChoice.current), shown: fateChoice.shown === true };
    SaveAllSettings();
}

function resumeFateChoice(then) {
    // After loading: the saved choice, or a new one if it hadn't started
    const saved = campaign.fateChoice;
    if (saved == null) { chooseFates(campaign.act + 1, then); return; }
    const item = ref => ref == null ? null : { player: getPlayer(ref.player), picker: ref.picker };
    fateChoice = { set: saved.set, act: saved.act, then: then, deck: saved.deck, dealt: saved.dealt, keeping: saved.keeping,
        queue: saved.queue.map(item), current: item(saved.current), selected: null };
    if (saved.shown) { showFatesChosen(); return; }
    if (fateChoice.current != null) { fateChoice.queue.unshift(fateChoice.current); }
    nextFateChoice();
}

function dealFate(player) {
    // The top Fate of the deck. A bot isn't dealt one the bots can't play yet (fatebots.js)
    const index = fateChoice.deck.findIndex(number => player.isHuman || !botsNotDealt.includes(number));
    return fateChoice.deck.splice(index, 1)[0];
}

function getFatesLeftToPick() {
    // Picked Fates can't be anyone else's, nor can one dealt to another player
    const taken = players.map(player => getCampaignPlayer(player).fate).filter(fate => fate != null);
    const dealt = Object.values(fateChoice.dealt).flat();
    const keeping = fateChoice.keeping[fateChoice.current.player.number];
    const forBot = !fateChoice.current.player.isHuman;
    return (keeping != null ? [getFate(keeping)] : []).concat(getFatesInSet(fateChoice.set)
        .filter(fate => !taken.includes(fate.number) && !dealt.includes(fate.number) && !(forBot && botsNotDealt.includes(fate.number))));
}

function nextFateChoice() {
    const next = fateChoice.queue.shift();
    if (next == null) { showFatesChosen(); return; }
    fateChoice.current = next;
    fateChoice.selected = null;
    saveFateChoice();
    const player = next.player;
    // With more than one human player, the others mustn't see the Fates on offer (#67)
    if (next.picker == "self" && isMultiHuman()) {
        showCampaignWindow(actNames[fateChoice.act] + ": choose your Fate", "<p>Pass the device to Player " + player.number + ".</p>"
            + "<button type=\"button\" class=\"btn btn-primary w-100\" onclick=\"showFateChoice()\">I'm Player " + player.number + ": show my Fates</button>", player, true);
        return;
    }
    showFateChoice();
}

function showFateChoice() {
    const next = fateChoice.current;
    const player = next.player;
    const dealt = fateChoice.dealt[player.number];
    const options = (dealt != null) ? dealt.map(getFate) : getFatesLeftToPick();
    const forBot = next.picker == "human";
    const title = actNames[fateChoice.act] + ": " + (forBot ? "choose Player " + player.number + "'s Fate" : (dealt != null ? "choose your Fate" : "pick your Fate"));
    const keeping = fateChoice.keeping[player.number];
    const intro = forBot ? "Choose a Fate for Player " + player.number + " (bot)" + (keeping != null ? ": a \"" + fateChoice.set + "\" Fate, or keep " + getFate(keeping).name : "") + ". Tap one to read it."
        : (dealt != null
            ? (keeping != null ? "You completed your objective: you drew one \"" + fateChoice.set + "\" Fate. Choose it or keep " + getFate(keeping).name + ". Tap a Fate to read it."
                : "You drew two \"" + fateChoice.set + "\" Fates. Choose one to play. Tap a Fate to read it.")
            : "Pick any \"" + fateChoice.set + "\" Fate" + (keeping != null ? ", or keep " + getFate(keeping).name : "") + ". Tap one to read it.");
    let html = "<p class=\"mb-2\">" + intro + "</p>";
    if (dealt != null) {
        html += options.map(fate => getFateCardHtml(fate, fate.number == fateChoice.selected, fateChoice.act)).join("");
    } else {
        html += "<div class=\"fatelist\">" + options.map(fate => (fate.number == fateChoice.selected)
            ? getFateCardHtml(fate, true, fateChoice.act)
            : "<button type=\"button\" class=\"faterow\" onclick=\"selectFate(" + fate.number + ")\"><span><span class=\"fatename\">" + fate.name + "</span><small>" + fate.path[fateChoice.act - 1] + "</small></span><span class=\"fatedots\">" + getComplexityDots(fate) + "</span></button>").join("") + "</div>";
    }
    showCampaignWindow(title, html, player, true);
}

function getFateCardHtml(fate, open, act) {
    // A Fate, tapped to read it in full and take it
    // This Act's objective, or in Act III its grand ambitions or final objective (laterfates.js)
    const start = (act == 1) ? (fate.objective != null ? fate.objective.start[players.length] : null) : getLaterObjectiveStart(fate, act);
    const objectiveText = getFateObjectiveText(fate, act);
    const objective = objectiveText != "" ? "<div class=\"fateobj\"><b>" + actNames[act] + (start != null ? " objective (starts at " + start + "):" : ":") + "</b> " + objectiveText + "</div>" : "";
    const paths = fate.path.map((line, index) => line == "" ? "" : "<div class=\"fatepath\"><b>" + ["I", "II", "III"][index] + "</b>" + line + "</div>").join("");
    return "<div class=\"fatecard" + (open ? " open" : "") + "\"" + (open ? "" : " role=\"button\" onclick=\"selectFate(" + fate.number + ")\"") + ">"
        + "<div class=\"fatehead\"><span class=\"fatename\">" + fate.name + "</span><span class=\"fatedots\">Complexity " + getComplexityDots(fate) + "</span></div>"
        + (open ? paths + objective + "<button type=\"button\" class=\"btn btn-primary btn-sm w-100 mt-2\" onclick=\"takeFate(" + fate.number + ")\">Take " + fate.name + "</button>"
            : "<div class=\"fatesub\">" + fate.path[act - 1] + "</div>")
        + "</div>";
}

function selectFate(number) {
    fateChoice.selected = number;
    showFateChoice();
}

function takeFate(number) {
    getCampaignPlayer(fateChoice.current.player).fate = number;
    // The other dealt card is no longer on offer to anyone picking
    delete fateChoice.dealt[fateChoice.current.player.number];
    fateChoice.current = null;
    saveFateChoice();
    SaveAllSettings();
    if (fateChoice.queue.length == 0) { showFatesChosen(); return; }
    nextFateChoice();
}

function showFatesChosen() {
    // Everyone reveals their Fate at once. Each starts as a Regent with their objective marker placed
    // (rulebook p.6). The Steward, or else the Admiral, takes the First Regent tile; if neither, the
    // player with the initiative
    const act = fateChoice.act;
    const changed = players.filter(player => getCampaignPlayer(player).previousFate != null && getCampaignPlayer(player).previousFate != getCampaignPlayer(player).fate);
    // Done once: shown again after loading, it doesn't apply the Fates a second time
    if (campaign.fatesApplied !== act) {
        players.forEach(player => {
            const state = getCampaignPlayer(player);
            const fate = getFate(state.fate);
            // A new Fate: Favors go back to their owners (rulebook p.29)
            if (changed.includes(player)) { state.favors = {}; }
            // Act I's objectives are known. Act II: every Fate's new objective. Act III: a "C" Fate's
            // final objective (laterfates.js)
            state.objective = (act == 1) ? (fate.objective != null ? fate.objective.start[players.length] : null) : getLaterObjectiveStart(fate, act);
            state.completed = null;
        });
        if (act == 1) {
            const holding = name => players.find(player => getFate(getCampaignPlayer(player).fate).name == name);
            const firstRegent = holding("Steward") || holding("Admiral") || getPlayerWithInitiative();
            campaign.firstRegent = firstRegent.number;
        }
        // Their starting cards and Edicts (fatebots.js)
        applyFateSetups(act);
        campaign.fatesApplied = act;
    }
    fateChoice.shown = true;
    saveFateChoice();
    players.forEach(showCampaignPanel);
    SaveAllSettings();

    const then = fateChoice.then;
    const rows = players.map(player => {
        const fate = getFate(getCampaignPlayer(player).fate);
        return "<div class=\"fatechosen\"><span>Player " + player.number + "</span><b>" + fate.name + "</b><small>" + getFateSetupText(fate, act) + "</small></div>";
    }).join("");
    const firstRegent = getPlayer(campaign.firstRegent);
    const intro = (act == 1)
        ? "<p class=\"mb-2\">Everyone reveals their Fate. Take the matching Fate Sets, do the Setup side of your objective card, then flip it over.</p>"
        : "<p class=\"mb-2\">Everyone reveals their Fate at once." + (changed.length > 0 ? " With a new Fate, " + changed.map(player => "Player " + player.number).join(" and ")
            + " return" + (changed.length == 1 ? "s" : "") + " their old Fate card to the box, scrap the rest of its set that isn't in play, return all Favors and take the new Fate Set." : "")
            + " Each Fate's setup is below; do them during " + actNames[act] + "'s setup.</p>";
    const regentLine = (act == 1) ? "<p class=\"mt-2 mb-2\">Everyone starts as an Imperial Regent. Player " + firstRegent.number + " takes the First Regent tile.</p>" : "";
    showCampaignWindow(actNames[act] + ": the Fates", intro + rows + regentLine
        + "<button type=\"button\" class=\"btn btn-primary w-100\" data-bs-dismiss=\"modal\">OK</button>", null, true, () => { fateChoice = null; campaign.fateChoice = null; then(); });
}

// A player's panel: Fate, title, objective, Favors and, for the First Regent, the Imperial Trust

function showCampaignPanel(player) {
    const panel = document.getElementById("playerpanel" + player.number);
    if (panel == null || campaign == null || campaign.players[player.number] == null) { return; }
    let holder = document.getElementById("campaignpanel" + player.number);
    if (holder == null) {
        holder = document.createElement("div");
        holder.id = "campaignpanel" + player.number;
        holder.classList.add("campaignpanel");
        panel.prepend(holder);
    }
    const state = getCampaignPlayer(player);
    const fate = getFate(state.fate);
    const chips = "<div class=\"brstrip\">"
        + (fate != null ? "<button type=\"button\" class=\"brchip\" onclick=\"showFateInfo(" + player.number + ")\">" + fate.name + " &middot; " + fate.set + "</button>" : "")
        + "<button type=\"button\" class=\"brchip " + state.title + "\" onclick=\"showTitleWindow(" + player.number + ")\">" + (state.title == "regent" ? "Regent" : "Outlaw") + "</button>"
        + (isFirstRegent(player) ? "<button type=\"button\" class=\"brchip first\" onclick=\"showTitleWindow(" + player.number + ")\">First Regent</button>" : "")
        + "</div>";
    const stepper = (label, value, kind, extra = "") => "<div class=\"resourcetile\"><div class=\"resourcelabel\">" + label + "</div><input type=\"text\" class=\"resourcevalue\" value=\"" + value + "\" disabled>"
        + "<div class=\"d-flex gap-1\"><button class=\"btn resourcebutton resourceminus\" type=\"button\" onclick=\"stepCampaign('" + kind + "', " + player.number + ", -1" + extra + ")\" aria-label=\"One fewer\"><i class=\"bi bi-dash-lg\"></i></button>"
        + "<button class=\"btn resourcebutton resourceplus\" type=\"button\" onclick=\"stepCampaign('" + kind + "', " + player.number + ", 1" + extra + ")\" aria-label=\"One more\"><i class=\"bi bi-plus-lg\"></i></button></div></div>";
    // The objective marker moves down the Power track towards 0. Act III "A" and "B" Fates have none
    const hasObjective = fate != null && (campaign.act < 3 || fate.set == "C");
    // Not set yet (null) in Acts II and III, until it's entered from the objective card
    const objective = hasObjective ? "<div class=\"brobj\">" + stepper(state.objective === 0 ? "Objective done" : (state.objective == null ? "Objective: set from card" : "Objective"),
        state.objective == null ? "&ndash;" : state.objective, "objective") + "</div>" : "";
    // Favors: Rivals' agents on this player's Fate card
    const favors = "<div class=\"favors\"><span class=\"lbl\">Favors</span>" + players.filter(other => other !== player).map(other =>
        "<span class=\"favorstep\"><button type=\"button\" onclick=\"stepCampaign('favor', " + player.number + ", -1, " + other.number + ")\" aria-label=\"One fewer of Player " + other.number + "'s\"><i class=\"bi bi-dash\"></i></button>"
        + "<span class=\"playertag playertag" + getPlayerColour(other) + "\">" + (state.favors[other.number] || 0) + "</span>"
        + "<button type=\"button\" onclick=\"stepCampaign('favor', " + player.number + ", 1, " + other.number + ")\" aria-label=\"One more of Player " + other.number + "'s\"><i class=\"bi bi-plus\"></i></button></span>").join("") + "</div>";
    const trust = isFirstRegent(player) ? "<div class=\"trust\"><div class=\"lbl\">Imperial Trust &middot; frozen, counts for ambitions</div><div class=\"trustres\">"
        + trustResources.map(resource => "<span class=\"truststep\">" + getGameIcon(resource)
            + "<button type=\"button\" onclick=\"stepCampaign('trust', " + player.number + ", -1, '" + resource + "')\" aria-label=\"One fewer " + resource + "\"><i class=\"bi bi-dash\"></i></button>"
            + "<b>" + campaign.trust[resource] + "</b>"
            + "<button type=\"button\" onclick=\"stepCampaign('trust', " + player.number + ", 1, '" + resource + "')\" aria-label=\"One more " + resource + "\"><i class=\"bi bi-plus\"></i></button></span>").join("")
        + "</div></div>" : "";
    holder.innerHTML = chips + objective + getFatePanelHtml(player) + favors + trust;
}

function stepCampaign(kind, playerNumber, change, extra) {
    const state = campaign.players[playerNumber];
    if (kind == "objective") { state.objective = Math.max((state.objective ?? 0) + change, 0); }
    if (kind == "favor") { state.favors[extra] = Math.max((state.favors[extra] || 0) + change, 0); }
    if (kind == "trust") { campaign.trust[extra] = Math.max(campaign.trust[extra] + change, 0); }
    // The Caretaker's Golems (fatebots.js)
    if (kind == "golems") { state.golems = Math.max((state.golems || 0) + change, 0); }
    // The Believer's Faithful stack (fatebots.js)
    if (kind == "faithful") { state.faithfulTop = Math.min(Math.max((state.faithfulTop || 0) + change, 0), 9); }
    showCampaignPanel(getPlayer(playerNumber));
    SaveAllSettings();
}

function showFateInfo(playerNumber) {
    // A player's Fate in full: its Path to Power and this Act's objective
    const fate = getFate(campaign.players[playerNumber].fate);
    showCampaignWindow("Player " + playerNumber + ": " + fate.name, "<div class=\"fatedots mb-1\">\"" + fate.set + "\" Fate &middot; Complexity " + getComplexityDots(fate) + "</div>"
        + fate.path.map((line, index) => line == "" ? "" : "<div class=\"fatepath\"><b>" + ["I", "II", "III"][index] + "</b>" + line + "</div>").join("")
        + (getFateObjectiveText(fate, campaign.act) != "" ? "<div class=\"fateobj\"><b>" + actNames[campaign.act] + ":</b> " + getFateObjectiveText(fate, campaign.act) + "</div>" : ""), getPlayer(playerNumber));
}

function showTitleWindow(playerNumber) {
    // Titles change in Summits and Edicts, at the table. Here the app is told
    const player = getPlayer(playerNumber);
    const state = getCampaignPlayer(player);
    const regents = players.filter(other => getCampaignPlayer(other).title == "regent");
    showCampaignWindow("Player " + playerNumber + ": title", "<p class=\"mb-2\">Player " + playerNumber + " is " + (state.title == "regent" ? "an Imperial Regent" : "an Outlaw")
        + (isFirstRegent(player) ? " and the First Regent" : "") + ".</p>"
        + "<div class=\"brseg\"><button type=\"button\" class=\"btn btn-outline-secondary" + (state.title == "regent" ? " active" : "") + "\" onclick=\"setTitle(" + playerNumber + ", 'regent')\">Regent</button>"
        + "<button type=\"button\" class=\"btn btn-outline-secondary" + (state.title == "outlaw" ? " active" : "") + "\" onclick=\"setTitle(" + playerNumber + ", 'outlaw')\">Outlaw</button></div>"
        + "<div class=\"optlabel mt-3\">The First Regent tile</div><div class=\"d-flex flex-wrap gap-1\">"
        + regents.map(other => "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary" + (isFirstRegent(other) ? " active" : "") + "\" onclick=\"setFirstRegent(" + other.number + ")\">Player " + other.number + "</button>").join("")
        + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary" + (campaign.firstRegent == null ? " active" : "") + "\" onclick=\"setFirstRegent(null)\">Nobody</button></div>"
        + "<div class=\"brhint\">A Regent leaves the Empire by calling a Summit. An Outlaw becomes a Regent if the First Regent invites them in a Summit.</div>", player);
}

function setTitle(playerNumber, title) {
    applyTitle(playerNumber, title);
    showTitleWindow(playerNumber);
}

function applyTitle(playerNumber, title) {
    // Change a title without a window (a bot's Parade Fleets)
    campaign.players[playerNumber].title = title;
    if (title == "outlaw") { buryOutlawCards(getPlayer(playerNumber)); }
    // An Outlaw can't be First Regent: the tile passes to the Regent with the most Power (rulebook p.16)
    if (title == "outlaw" && campaign.firstRegent == playerNumber) {
        const regents = players.filter(player => getCampaignPlayer(player).title == "regent").sort((a, b) => b.powerValue - a.powerValue);
        campaign.firstRegent = (regents.length > 0) ? regents[0].number : null;
    }
    players.forEach(showCampaignPanel);
    SaveAllSettings();
}

function setFirstRegent(playerNumber) {
    campaign.firstRegent = playerNumber;
    players.forEach(showCampaignPanel);
    SaveAllSettings();
    closeCampaignWindow();
}

// The top bar: the Act, and its chapters in place of rounds

function showCampaignTopBar() {
    const label = document.querySelector(".topcounters .topbarlabel");
    if (label == null) { return; }
    const on = campaignMode && campaign != null;
    label.innerHTML = on ? "<span class=\"actpill\">" + actNames[campaign.act] + "</span>Chapter" : "Round";
    for (let round = 1; round <= 5; round++) {
        document.getElementById("roundNumber" + round).classList.toggle("d-none", on && round > chaptersInAct[campaign.act]);
    }
}

