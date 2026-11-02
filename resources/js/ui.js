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

function showMessageToast(headerValue, bodyValue) {
    showToast("messageToast", "messageToastHeader", headerValue, "messageToastBody", bodyValue);
}

function showToast(id, headerId, headerValue, bodyId, bodyValue) {
    const toast = document.getElementById(id);
    const header = toast.querySelector("#" + headerId);
    header.innerHTML = headerValue;

    if (bodyId != "") {
        const body = toast.querySelector("#" + bodyId);
        body.innerHTML = bodyValue;
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
