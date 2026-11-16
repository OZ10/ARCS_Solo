// Icons for the resources and ambitions (#132), shown with a small word under them. Our own
// drawings, after the tokens in the rulebook (not the game's artwork), in the text colour like the
// Bootstrap icons. The details (a barrel's bands, a crate's slats, a rocket's window) are cut out
// with masks, so they show on any background. The masks are defined once, in an SVG added to the page.
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

const iconMasks = {
    fuel: "<ellipse cx=\"8\" cy=\"3.2\" rx=\"4.1\" ry=\"1.1\" fill=\"#777\"/><ellipse cx=\"10\" cy=\"3\" rx=\".9\" ry=\".4\" fill=\"#fff\"/>"
        + "<path d=\"M3 6.8c1.2.6 3 .9 5 .9s3.8-.3 5-.9M3 10.6c1.2.6 3 .9 5 .9s3.8-.3 5-.9\" stroke=\"#000\" stroke-width=\".9\" fill=\"none\"/>",
    materials: "<path d=\"M2 4.75L8 8l6-3.25M8 8v6.5\" stroke=\"#000\" stroke-width=\".7\" fill=\"none\"/>"
        + "<path d=\"M2 6.92l6 3.25M2 9.08l6 3.25M8 10.17l6-3.25M8 12.33l6-3.25\" stroke=\"#000\" stroke-width=\".6\" fill=\"none\"/>",
    weapons: "<circle cx=\"8\" cy=\"6\" r=\"1.2\" fill=\"#000\"/>"
};

const iconShapes = {
    // An upright barrel with a filler cap
    fuel: "<path d=\"M3 3.2c0-1 2.2-1.8 5-1.8s5 .8 5 1.8v9.6c0 1-2.2 1.8-5 1.8s-5-.8-5-1.8z\"/>",
    // An isometric crate
    materials: "<path d=\"M8 1.5l6 3.25L8 8 2 4.75z\" opacity=\".55\"/><path d=\"M2 4.75L8 8v6.5l-6-3.25z\"/><path d=\"M8 8l6-3.25v6.5L8 14.5z\" opacity=\".8\"/>",
    // A rocket
    weapons: "<path d=\"M8 .8c2 1.7 2.6 4.2 2.6 6.7v4H5.4v-4c0-2.5.6-5 2.6-6.7z\"/><path d=\"M5.4 8.5L3 11v2.5L5.4 12zM10.6 8.5L13 11v2.5L10.6 12zM6.5 11.5h3L9 13H7z\"/>",
    // A four-pointed star
    relics: "<path d=\"M8 .8C8.6 5.4 10.6 7.4 15.2 8 10.6 8.6 8.6 10.6 8 15.2 7.4 10.6 5.4 8.6.8 8 5.4 7.4 7.4 5.4 8 .8z\"/>"
};

function getIconShape(name) {
    // The shape, through its mask if it has one
    return iconMasks[name] != null ? "<g mask=\"url(#iconmask-" + name + ")\">" + iconShapes[name] + "</g>" : iconShapes[name];
}

function getIconSvg(inner) {
    return "<svg class=\"gameicon\" viewBox=\"0 0 16 16\" width=\"1em\" height=\"1em\" fill=\"currentColor\" aria-hidden=\"true\">" + inner + "</svg>";
}

function getBootstrapIcon(name) {
    return "<i class=\"bi " + name + "\" aria-hidden=\"true\"></i>";
}

const gameIcons = {
    fuel: getIconSvg(getIconShape("fuel")),
    materials: getIconSvg(getIconShape("materials")),
    weapons: getIconSvg(getIconShape("weapons")),
    relics: getIconSvg(getIconShape("relics")),
    psionics: getBootstrapIcon("bi-eye-fill"),
    captives: getBootstrapIcon("bi-person-lock"),
    trophies: getBootstrapIcon("bi-trophy-fill"),
    power: getBootstrapIcon("bi-lightning-charge-fill"),
    // The ambitions, as on their boxes: Tycoon is a barrel and a crate
    tycoon: getIconSvg("<g transform=\"translate(-1.4 2.2) scale(.72)\">" + getIconShape("fuel") + "</g><g transform=\"translate(5.6 2.2) scale(.72)\">" + getIconShape("materials") + "</g>"),
    tyrant: getBootstrapIcon("bi-person-lock"),
    warlord: getBootstrapIcon("bi-trophy-fill"),
    keeper: getIconSvg(getIconShape("relics")),
    empath: getBootstrapIcon("bi-eye-fill")
};

function getGameIcon(name) {
    // e.g. "fuel", "citiesFuel" or "TYCOON". "" if it has none
    const key = String(name).replace(/^cities/, "").toLowerCase();
    return gameIcons[key] || "";
}

document.addEventListener("DOMContentLoaded", () => {
    // The masks, once for the whole page. Not display: none, or the browser ignores them
    const defs = Object.keys(iconMasks).map(name => "<mask id=\"iconmask-" + name + "\" maskUnits=\"userSpaceOnUse\" x=\"0\" y=\"0\" width=\"16\" height=\"16\">"
        + "<rect width=\"16\" height=\"16\" fill=\"#fff\"/>" + iconMasks[name] + "</mask>").join("");
    document.body.insertAdjacentHTML("afterbegin", "<svg class=\"iconmasks\" width=\"0\" height=\"0\" aria-hidden=\"true\"><defs>" + defs + "</defs></svg>");

    // The tiles on the panel template, before it's copied for each player: an icon above the word
    document.querySelectorAll(".resourcelabel[data-icon]").forEach(label => {
        label.insertAdjacentHTML("afterbegin", "<span class=\"tileicon\">" + getGameIcon(label.dataset.icon) + "</span>");
    });
});
