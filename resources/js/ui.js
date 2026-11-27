// Screen helpers: tooltips, toasts, showing/hiding elements and enabling buttons.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

function keepClearOfFooter() {
    // The fixed footer grows when the turn's played cards wrap onto more lines (on a narrow
    // phone). Keep room for it under the page, and keep scrolled-to buttons clear of it, so
    // it never covers a player's Done or Play Card button (see --footer-height in index.scss)
    const footer = document.querySelector("footer.fixed-bottom");
    if (footer == null || typeof ResizeObserver == "undefined") { return; }

    new ResizeObserver(() => {
        document.documentElement.style.setProperty("--footer-height", footer.offsetHeight + "px");
    }).observe(footer);
}

function setWindowBanner(modalId, player) {
    // A player's window in their colour; anyone else's in the Options window's (index.css)
    const header = document.querySelector("#" + modalId + " .modal-header");
    if (header == null) { return; }
    header.classList.remove("playerbanner1", "playerbanner2", "playerbanner3", "playerbanner4");
    if (player != null) { header.classList.add("playerbanner" + getPlayerColour(player)); }
}

function getPlayerTag(player) {
    // A player's name on their own colour, for use in a window's text. A campaign's Empire, Free
    // States and Blight have a label of their own
    if (player.label != null) { return "<span class=\"playertag playertag" + player.colour + "\">" + player.label + "</span>"; }
    return "<span class=\"playertag playertag" + getPlayerColour(player) + "\">Player " + player.number + "</span>";
}

function tagPlayerNames(html) {
    // Every "Player N" in a window's text on that player's colour (#106), with any "'s" inside
    // the tag so it doesn't leave a gap. Leaves alone any already tagged, and any number that
    // isn't a player in this game
    return String(html).replace(/(<span class="playertag[^>]*>)?Player ([1-4])(?!\d)('s)?/g, (match, tagged, number, possessive) => {
        const player = players.find(candidate => candidate.number == Number(number));
        if (tagged || player == null) { return match; }
        return getPlayerTag(player).replace(/<\/span>$/, (possessive || "") + "</span>");
    });
}

function replayAnimation(element, className) {
    // Play a CSS animation again on an element that may already have it
    if (element == null) { return; }
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

function animatePower(player, from) {
    // A panel's Power counts up to its new value, with a glow
    const header = document.getElementById("playerpower" + player.number);
    if (header == null) { return; }
    const to = player.powerValue;
    replayAnimation(header, "powerglow");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { header.innerHTML = getPowerBannerHtml(to); return; }
    let value = from;
    const step = () => {
        value += 1;
        header.innerHTML = getPowerBannerHtml(Math.min(value, to));
        if (value < to && player.powerValue == to) { setTimeout(step, Math.max(60, 700 / (to - from))); }
    };
    header.innerHTML = getPowerBannerHtml(from);
    setTimeout(step, 250);
}

// Round and turn announcements (#116): a card in the leading player's colour that closes by
// itself, or when tapped. The leader of the last turn announced, to tell when it was seized
const announceSeconds = 5;
let lastAnnouncedLeader = null;
let announceTimer = null;

function announceTurn(isRoundStart) {
    const leader = getPlayerWithInitiative();
    if (leader == null) { return; }
    const seized = !isRoundStart && lastAnnouncedLeader != null && lastAnnouncedLeader != leader.number;
    lastAnnouncedLeader = leader.number;

    const title = isRoundStart ? "Round " + roundNumber : "Turn " + turnNumber;
    const sub = isRoundStart ? "Turn " + turnNumber : "Round " + roundNumber;
    // With more than one human player, the leader's name, and to pass them the device (#67)
    const passPhone = (leader.isHuman && isMultiHuman()) ? "<div class=\"passphone\"><i class=\"bi bi-arrow-left-right\"></i> Pass the device to Player " + leader.number + "</div>" : "";
    const who = isYou(leader) ? "<b>You</b> " + (seized ? "seized the initiative and lead" : "lead")
        : getPlayerTag(leader) + (seized ? " seized the initiative and leads" : " has the initiative and leads");
    const note = (isRoundStart && roundNumber > 1 ? "New hands are dealt. " : "") + "Tap anywhere to carry on.";

    closeAnnouncement();
    const dim = document.createElement("div");
    dim.className = "announcedim";
    dim.id = "announceDim";
    const card = document.createElement("div");
    card.className = "announce";
    card.id = "announce";
    card.setAttribute("role", "status");
    card.innerHTML = "<div class=\"announcehead playerbanner" + getPlayerColour(leader) + "\"><div class=\"announcetitle\">" + title + "</div>"
        + "<div class=\"announceline\"></div><div class=\"announcesub\">" + sub + "</div></div>"
        + "<div class=\"announcebody\">" + who + passPhone + "<div class=\"sub\">" + note + "</div></div>"
        + "<div class=\"announcebar\"><div style=\"animation-duration: " + announceSeconds + "s\"></div></div>";
    [dim, card].forEach(element => { element.onclick = closeAnnouncement; document.body.appendChild(element); });
    announceTimer = setTimeout(closeAnnouncement, (announceSeconds + 0.4) * 1000);
}

function closeAnnouncement() {
    clearTimeout(announceTimer);
    ["announce", "announceDim"].forEach(id => { const element = document.getElementById(id); if (element != null) { element.remove(); } });
}

// A window that has to be finished, such as the Leaders & Lore draft or setting up the players
// (#135): no X, and tapping outside it or Escape doesn't close it. Back to normal once it's closed

function setModalLocked(modal, locked) {
    // Only while it's closed: the settings are read when the window is set up
    const instance = bootstrap.Modal.getInstance(modal);
    if (instance != null) { instance.dispose(); }
    bootstrap.Modal.getOrCreateInstance(modal, locked ? { backdrop: "static", keyboard: false } : {});
    const close = modal.querySelector(".modal-header .btn-close");
    if (close != null) { close.classList.toggle("d-none", locked); }
}

function showLockedModal(modal) {
    setModalLocked(modal, true);
    modal.addEventListener('hidden.bs.modal', () => setModalLocked(modal, false), { once: true });
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

function hideIconTooltip(button, modalId) {
    // An icon that opens a window: hide its tooltip and let go of focus, or the tooltip is
    // still showing when the window closes and covers the icon, blocking the next tap.
    // The tap shows the tooltip a moment later, so hide it again once the window is open
    const hide = () => {
        const tooltip = bootstrap.Tooltip.getInstance(button);
        if (tooltip != null) { tooltip.hide(); }
    };
    hide();
    button.blur();
    document.getElementById(modalId).addEventListener('shown.bs.modal', hide, { once: true });
}

function createTooltip(elementid, title) {
    const l = document.querySelector(elementid);
    l.setAttribute('data-bs-toggle', 'tooltip');
    l.setAttribute('data-bs-html', 'true');
    l.setAttribute('data-bs-custom-class', 'custom-tooltip');
    l.setAttribute('title', title);

    refreshTooltips();
}

function refreshTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    // getOrCreateInstance so elements that already have a tooltip don't get another one
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => bootstrap.Tooltip.getOrCreateInstance(tooltipTriggerEl));
}

// Announcements stay in the "What happened" list, above the turn bar and in the turn window, until
// they're closed: a toast disappeared too quickly to read, and a second one replaced the first
let newsItems = [];
let newsExpanded = false;
let newsCount = 0;
// How many show before "earlier" ones are folded away
const newsShown = 3;
const newsKept = 40;

function showMessageToast(headerValue, bodyValue) {
    // Also written to the (hidden) toast, the last message as before
    const toast = document.getElementById("messageToast");
    toast.querySelector("#messageToastHeader").innerHTML = tagPlayerNames(headerValue);
    toast.querySelector("#messageToastBody").innerHTML = tagPlayerNames(bodyValue);
    newsCount++;
    newsItems.unshift({ id: newsCount, title: tagPlayerNames(headerValue), body: tagPlayerNames(bodyValue), when: "Round " + roundNumber + ", turn " + turnNumber });
    newsItems = newsItems.slice(0, newsKept);
    refreshNews();
}

function getNewsHtml() {
    // The newest first, with a close button each; older ones folded away
    if (newsItems.length == 0) { return ""; }
    // Only the newest on a short screen, such as a device held sideways
    const count = window.innerHeight < 500 ? 1 : newsShown;
    const shown = newsExpanded ? newsItems : newsItems.slice(0, count);
    const hidden = newsItems.length - shown.length;
    return "<div class=\"d-flex align-items-center mb-1\"><span class=\"small fw-bold flex-fill\">What happened</span>"
        + "<button type=\"button\" class=\"btn btn-sm btn-outline-secondary py-0\" onclick=\"clearNews()\">Clear all</button></div>"
        + shown.map(item => "<div class=\"slotadvice newsitem\"><div class=\"d-flex align-items-start\"><b class=\"flex-fill\">" + item.title + "</b>"
            + "<span class=\"small text-secondary me-2 text-nowrap\">" + item.when + "</span>"
            + "<button type=\"button\" class=\"btn-close btn-sm\" aria-label=\"Close\" onclick=\"closeNews(" + item.id + ")\"></button></div>"
            + "<div class=\"small\">" + item.body + "</div></div>").join("")
        + (hidden > 0 ? "<button type=\"button\" class=\"btn btn-link btn-sm p-0\" onclick=\"toggleNews()\">+" + hidden + " earlier</button>"
            : (newsExpanded && newsItems.length > count ? "<button type=\"button\" class=\"btn btn-link btn-sm p-0\" onclick=\"toggleNews()\">Show fewer</button>" : ""));
}

function refreshNews() {
    // Only the lists themselves, so nothing else is worked out at an odd moment
    const html = getNewsHtml();
    const dock = document.getElementById("turnNews");
    if (dock != null) {
        dock.innerHTML = html;
        dock.classList.toggle("d-none", html == "");
    }
    const section = document.getElementById("turnNewsSection");
    if (section != null) {
        section.innerHTML = html;
        section.classList.toggle("d-none", html == "");
    }
}

function closeNews(id) {
    newsItems = newsItems.filter(item => item.id != id);
    refreshNews();
}

function clearNews() {
    newsItems = [];
    newsExpanded = false;
    refreshNews();
}

function toggleNews() {
    newsExpanded = !newsExpanded;
    refreshNews();
}

function showToast(id, headerId, headerValue, bodyId, bodyValue) {
    const toast = document.getElementById(id);
    const header = toast.querySelector("#" + headerId);
    // Any player named, on their colour (#110)
    header.innerHTML = tagPlayerNames(headerValue);

    if (bodyId != "") {
        const body = toast.querySelector("#" + bodyId);
        body.innerHTML = tagPlayerNames(bodyValue);
    }

    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(toast);
    toastBootstrap.show();
}

function removeChildElements(id) {
    const element = document.getElementById(id);
    disposeTooltips(element);
    element.replaceChildren();
}

function disposeTooltips(container) {
    // Remove the tooltips of elements that are about to be removed. If an element is
    // removed while its tooltip is showing, the tooltip would be left on screen
    container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
        const tooltip = bootstrap.Tooltip.getInstance(element);
        if (tooltip != null) { tooltip.dispose(); }
    });
}

function showHideElement(elements, show) {
    elements.forEach(element => {
        (show) ? element.classList.remove("d-none") : element.classList.add("d-none");
    })
}

function setElementValue(elementid, value) {
    document.getElementById(elementid).innerHTML = value;
}

function enableDisableButton(buttonName, isDisabled) {
    document.getElementById(buttonName).disabled = isDisabled;
}
