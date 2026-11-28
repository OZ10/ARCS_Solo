// Blighted Reach campaign (#85): the Pirate's Rumors of the Haven in Act III (the user's mock-ups,
// 2026-11-28). 4 Rumor tokens, 2 True (one marks the Haven's cluster, one its planet symbol). With a
// bot Pirate the app keeps the secret: the tokens on the table only mark the places, and the app says
// what each is when peeked at or flipped. With a human Pirate the real tokens are used, and when a bot
// peeks the Pirate tells the app True or False. At the end of Act III each Rival may guess the Haven's
// planet, if they control it: a right guess is +10 Power for them and -10 for the Pirate; no right
// guess is +10 for the Pirate.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// campaign.rumors = { mode: "app" | "table", pirate, haven, tokens: [{ system, truth, agents, up }],
// known: { playerNumber: [{ system, truth }] } }. truth: "cluster", "symbol" or false

function getPirate() {
    return players.find(player => hasFate(player, 12)) || null;
}

function getPlanetSymbol(id) {
    return id.slice(-1);
}

function getRumorPlanets() {
    return getSystemIds().filter(id => isPlanet(id) && isSystemInPlay(id));
}

function setUpRumors() {
    // Act III. Returns the setup line, or null with no Pirate
    const pirate = getPirate();
    if (pirate == null) { return null; }
    const pick = list => list[Math.floor(Math.random() * list.length)];
    if (pirate.isHuman) {
        campaign.rumors = { mode: "table", pirate: pirate.number, haven: null, tokens: [], known: {} };
        campaign.setupSteps = (campaign.setupSteps || []).concat({ kind: "rumors", player: pirate.number });
        return "Player " + pirate.number + " places the 4 Rumor tokens after this window";
    }
    // A bot Pirate: the app chooses the Haven, and where the True and False Rumors go
    const planets = getRumorPlanets();
    const haven = pick(planets);
    const used = [haven];
    const take = list => { const choice = pick(list.filter(id => !used.includes(id))); if (choice != null) { used.push(choice); } return choice; };
    const tokens = [];
    const inCluster = take(planets.filter(id => getCluster(id) == getCluster(haven)));
    if (inCluster != null) { tokens.push({ system: inCluster, truth: "cluster" }); }
    const sameSymbol = take(planets.filter(id => getPlanetSymbol(id) == getPlanetSymbol(haven) && getCluster(id) != getCluster(haven)));
    if (sameSymbol != null) { tokens.push({ system: sameSymbol, truth: "symbol" }); }
    while (tokens.length < 4) {
        const other = take(planets.filter(id => getCluster(id) != getCluster(haven) && getPlanetSymbol(id) != getPlanetSymbol(haven)));
        if (other == null) { break; }
        tokens.push({ system: other, truth: false });
    }
    // Shuffled, so their order says nothing
    tokens.sort(() => Math.random() - 0.5).forEach(token => { token.agents = []; token.up = false; addToken(token.system, "rumor", null, 0); });
    campaign.rumors = { mode: "app", pirate: pirate.number, haven: haven, tokens: tokens, known: {} };
    return "4 Rumor tokens face down at " + tokens.map(token => getSystemShortName(token.system)).join(", ") + " (any 4 tokens: the app keeps which are True)";
}

// A human Pirate places the real tokens: where?

let rumorPlacing = [];

function showRumorSetupWindow(player) {
    rumorPlacing = [];
    renderRumorSetup(player);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

function renderRumorSetup(player) {
    document.getElementById("guildTitle").innerHTML = "Rumors of the Haven";
    const chip = id => "<button type=\"button\" class=\"btn btn-sm " + (rumorPlacing.includes(id) ? "btn-secondary" : "btn-outline-secondary") + " text-start movechip " + getSystemBarClass(id) + "\" style=\"min-width:96px\" onclick=\"toggleRumorPlace('" + id + "')\">" + getSystemShortName(id) + "</button>";
    document.getElementById("guildBody").innerHTML = "<p class=\"small mb-2\">Choose your Haven's planet and write it down. Place 2 True Rumors (one in its cluster, one on a planet of its symbol) and 2 False ones, face down. Then tap the 4 planets you put them on.</p>"
        + getMoveChipRows(getRumorPlanets(), chip)
        + "<button type=\"button\" class=\"btn btn-primary w-100\" id=\"rumorsPlaced\" onclick=\"confirmRumorSetup(" + player.number + ")\"" + (rumorPlacing.length == 4 ? "" : " disabled") + ">" + (rumorPlacing.length == 4 ? "They're placed" : rumorPlacing.length + " of 4 chosen") + "</button>";
}

function toggleRumorPlace(id) {
    rumorPlacing = rumorPlacing.includes(id) ? rumorPlacing.filter(other => other != id) : rumorPlacing.length < 4 ? rumorPlacing.concat(id) : rumorPlacing;
    renderRumorSetup(getPlayer(campaign.rumors.pirate));
}

function confirmRumorSetup(playerNumber) {
    if (rumorPlacing.length != 4) { return; }
    campaign.rumors.tokens = rumorPlacing.map(id => { addToken(id, "rumor", null, 0); return { system: id, truth: null, agents: [], up: false }; });
    SaveAllSettings();
    finishSetupStep();
}

// What a Rumor says, once known

function getRumorTruthText(token, truth) {
    if (truth === false) { return "<b>False</b>"; }
    if (truth == "cluster") { return "<b>True</b>: the Haven is in Cluster " + getCluster(token.system); }
    if (truth == "symbol") { return "<b>True</b>: the Haven's planet has this one's symbol (" + getSystemShortName(token.system).replace(/^\d+\s*/, "") + ")"; }
    return "<b>True</b>: the Haven is in this cluster or has this planet's symbol";
}

function learnRumor(playerNumber, index, truth) {
    const state = campaign.rumors;
    state.known[playerNumber] = (state.known[playerNumber] || []).filter(item => item.index != index).concat({ index: index, system: state.tokens[index].system, truth: truth });
}

// The Rumors window, from the Pirate's panel: agents on Rumors, peeks and flips

let rumorPeek = null;

function getRumorPanelHtml(player) {
    if (campaign == null || campaign.rumors == null || campaign.rumors.pirate != player.number) { return ""; }
    return "<div class=\"brstrip\"><button type=\"button\" class=\"brchip\" onclick=\"showRumorsWindow()\">Rumors of the Haven</button></div>";
}

function showRumorsWindow() {
    rumorPeek = null;
    renderRumorsWindow();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("guildModal")).show();
}

function renderRumorsWindow() {
    const state = campaign.rumors;
    const pirate = getPlayer(state.pirate);
    const rivals = players.filter(player => player !== pirate);
    document.getElementById("guildTitle").innerHTML = "Rumors of the Haven";
    const rows = state.tokens.map((token, index) => {
        const agents = rivals.map(rival => "<button type=\"button\" class=\"btn btn-sm " + (token.agents.includes(rival.number) ? "btn-dark" : "btn-outline-secondary") + "\" onclick=\"toggleRumorAgent(" + index + ", " + rival.number + ")\">"
            + (token.agents.includes(rival.number) ? "<i class=\"bi bi-check-lg\"></i> " : "") + getPlayerTag(rival) + "</button>").join("");
        const status = token.up ? getRumorTruthText(token, token.truth) : "Face down";
        const peekers = rivals.filter(rival => rival.isHuman && token.agents.includes(rival.number) && state.mode == "app");
        const peek = peekers.map(rival => "<button type=\"button\" class=\"btn btn-sm btn-outline-primary\" onclick=\"peekRumor(" + index + ", " + rival.number + ")\">Peek (" + getPlayerTag(rival) + ")</button>").join("");
        const shown = rumorPeek != null && rumorPeek.index == index ? "<div class=\"slotadvice small mt-1\">For " + getPlayerTag(getPlayer(rumorPeek.player)) + " only: " + getRumorTruthText(token, token.truth) + " <a href=\"#\" onclick=\"rumorPeek = null; renderRumorsWindow(); return false;\">Hide</a></div>" : "";
        // With the real tokens: the Pirate answers for a bot's peek
        const asks = state.mode == "table" ? rivals.filter(rival => !rival.isHuman && token.agents.includes(rival.number) && !(state.known[rival.number] || []).some(item => item.index == index)) : [];
        const ask = asks.map(rival => "<div class=\"small mt-1\">" + getPlayerTag(rival) + " peeks. Pirate, is it True? "
            + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"answerRumor(" + index + ", " + rival.number + ", true)\">True</button> "
            + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"answerRumor(" + index + ", " + rival.number + ", false)\">False</button></div>").join("");
        // With the real tokens, what it says once flipped
        const flip = token.up ? "" : state.mode == "app" ? "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"flipRumor(" + index + ")\">Flip face up</button>"
            : "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"flipRumor(" + index + ", true)\">Flipped: True</button><button type=\"button\" class=\"btn btn-sm btn-outline-secondary\" onclick=\"flipRumor(" + index + ", false)\">Flipped: False</button>";
        return "<div class=\"py-2 border-bottom " + getSystemBarClass(token.system) + "\" style=\"padding-left:8px;border-left:4px solid\"><div class=\"d-flex align-items-center gap-2\"><span class=\"flex-fill\">" + getSystemName(token.system) + "</span><span class=\"small text-secondary\">" + status + "</span></div>"
            + "<div class=\"d-flex flex-wrap gap-1 mt-1 align-items-center\"><span class=\"small text-secondary\">Agents</span>" + agents + peek + flip + "</div>" + ask + shown + "</div>";
    }).join("");
    document.getElementById("guildBody").innerHTML = tagPlayerNames("<p class=\"small mb-2\">" + (state.mode == "app" ? "The app keeps the Haven secret for " + getPlayerTag(pirate) + ". " : "") + "Mark the agents on each Rumor (Rumors Spread, Sharing Rumors, or stealing from the Pirate); a Rival with an agent there may peek. A Crisis flips them face up and returns the agents.</p>" + rows)
        + "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" data-bs-dismiss=\"modal\">Done</button>";
}

function toggleRumorAgent(index, playerNumber) {
    const state = campaign.rumors;
    const token = state.tokens[index];
    token.agents = token.agents.includes(playerNumber) ? token.agents.filter(number => number != playerNumber) : token.agents.concat(playerNumber);
    // A bot peeks at once: the app knows what it says (with the real tokens, the Pirate answers)
    if (token.agents.includes(playerNumber) && !getPlayer(playerNumber).isHuman && state.mode == "app") { learnRumor(playerNumber, index, token.truth); }
    SaveAllSettings();
    renderRumorsWindow();
}

function peekRumor(index, playerNumber) {
    rumorPeek = { index: index, player: playerNumber };
    renderRumorsWindow();
}

function answerRumor(index, playerNumber, isTrue) {
    // The human Pirate's answer for a bot: True ones count for either the cluster or the symbol
    learnRumor(playerNumber, index, isTrue ? "either" : false);
    SaveAllSettings();
    renderRumorsWindow();
}

function flipRumor(index, isTrue = null) {
    const state = campaign.rumors;
    const token = state.tokens[index];
    // The real token: what it says, from the button tapped
    if (state.mode == "table" && token.truth === null) { token.truth = isTrue ? "either" : false; }
    token.up = true;
    token.agents = [];
    players.forEach(player => learnRumor(player.number, index, token.truth));
    const placed = getTokens(token.system).find(item => item.kind == "rumor");
    if (placed != null) { placed.side = 1; }
    SaveAllSettings();
    renderRumorsWindow();
}

// The end of Act III: the guesses (mock-up R3)

let havenGuesses = null;

function needsHavenGuesses() {
    return typeof campaign != "undefined" && campaign != null && campaign.act == 3 && campaign.rumors != null && !campaign.rumors.done;
}

function getBotHavenGuess(player) {
    // A planet it controls that fits what it knows; null for none
    const known = (campaign.rumors.known[player.number] || []);
    const fits = id => known.every(item => {
        const sameCluster = getCluster(id) == getCluster(item.system), sameSymbol = getPlanetSymbol(id) == getPlanetSymbol(item.system);
        if (item.truth === false) { return !sameCluster && !sameSymbol; }
        if (item.truth == "cluster") { return sameCluster; }
        if (item.truth == "symbol") { return sameSymbol; }
        return sameCluster || sameSymbol;
    });
    const candidates = getRumorPlanets().filter(id => getControllerFor(id, player.number) == player.number && fits(id));
    return known.some(item => item.truth !== false) ? candidates[0] || null : null;
}

function showHavenGuesses(then) {
    const pirate = getPlayer(campaign.rumors.pirate);
    havenGuesses = { then: then, guesses: {}, haven: campaign.rumors.haven };
    players.filter(player => player !== pirate && !player.isHuman).forEach(player => { havenGuesses.guesses[player.number] = getBotHavenGuess(player); });
    renderHavenGuesses();
}

function renderHavenGuesses() {
    const state = campaign.rumors;
    const pirate = getPlayer(state.pirate);
    const humans = players.filter(player => player !== pirate && player.isHuman);
    const bots = players.filter(player => player !== pirate && !player.isHuman);
    const choice = (onclick, text, chosen) => "<button type=\"button\" class=\"btn btn-sm " + (chosen ? "btn-secondary" : "btn-outline-secondary") + "\" onclick=\"" + onclick + "\">" + text + "</button>";
    let html = "<p class=\"small mb-2\">End of Act III: each Rival may guess the Haven's planet, if they control a planet they think it is. A right guess is +10 Power for them and &minus;10 for " + getPlayerTag(pirate) + "; no right guess is +10 for " + getPlayerTag(pirate) + ".</p>";
    humans.forEach(player => {
        const controlled = getRumorPlanets().filter(id => getControllerFor(id, player.number) == player.number);
        html += "<div class=\"turnlabel\">" + getPlayerTag(player) + "'s guess</div><div class=\"d-flex flex-wrap gap-1 mb-2\">"
            + controlled.map(id => choice("setHavenGuess(" + player.number + ", '" + id + "')", getSystemShortName(id), havenGuesses.guesses[player.number] == id)).join("")
            + choice("setHavenGuess(" + player.number + ", null)", "No guess", havenGuesses.guesses[player.number] == null && (player.number in havenGuesses.guesses)) + "</div>";
    });
    bots.forEach(player => { const guess = havenGuesses.guesses[player.number]; html += "<div class=\"small mb-1\">" + getPlayerTag(player) + (guess != null ? " guesses " + getSystemName(guess) + ", from the Rumors it peeked at." : " makes no guess.") + "</div>"; });
    // With the real tokens, the Pirate says where the Haven is
    if (state.mode == "table") {
        html += "<div class=\"turnlabel mt-2\">" + getPlayerTag(pirate) + ": where is the Haven?</div><div class=\"d-flex flex-wrap gap-1 mb-2\">"
            + getRumorPlanets().map(id => choice("setHavenPlanet('" + id + "')", getSystemShortName(id), havenGuesses.haven == id)).join("") + "</div>";
    }
    const ready = humans.every(player => player.number in havenGuesses.guesses) && havenGuesses.haven != null;
    html += "<button type=\"button\" class=\"btn btn-primary w-100 mt-2\" onclick=\"revealHaven()\"" + (ready ? "" : " disabled") + ">Reveal the Haven</button>";
    showCampaignWindow("Find the Haven", tagPlayerNames(html), pirate, true);
}

function setHavenGuess(playerNumber, id) {
    havenGuesses.guesses[playerNumber] = id;
    renderHavenGuesses();
}

function setHavenPlanet(id) {
    havenGuesses.haven = id;
    renderHavenGuesses();
}

function revealHaven() {
    const state = campaign.rumors;
    const pirate = getPlayer(state.pirate);
    const haven = havenGuesses.haven;
    const right = Object.entries(havenGuesses.guesses).filter(([, id]) => id == haven).map(([number]) => getPlayer(Number(number)));
    right.forEach(player => { setPlayerPower(player, player.powerValue + 10); setPlayerPower(pirate, pirate.powerValue - 10); });
    if (right.length == 0) { setPlayerPower(pirate, pirate.powerValue + 10); }
    state.done = true;
    state.haven = haven;
    SaveAllSettings();
    showMessageToast("The Haven", "The Haven was " + getSystemName(haven) + ". " + (right.length > 0 ? right.map(player => "Player " + player.number).join(" and ") + " guessed it: +10 Power each, Player " + pirate.number + " &minus;" + (10 * right.length) + "." : "No one guessed it: Player " + pirate.number + " +10 Power."));
    const then = havenGuesses.then;
    havenGuesses = null;
    then();
}
