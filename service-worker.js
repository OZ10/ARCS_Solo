// B4RCS as an installed app: keeps a copy of the app so it opens and plays offline.
// Online it always fetches the latest version first, so updates show straight away, and only
// uses the saved copy when there's no connection. Each file is saved again whenever it's fetched.

const cacheName = "b4rcs";

// The app itself, saved when it's installed. Anything else (such as the font files) is saved
// the first time it's used
const appFiles = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "resources/css/index.css",
    "resources/icons/icon.svg",
    "resources/icons/icon-192.png",
    "resources/icons/icon-512.png",
    "resources/icons/icon-maskable-512.png",
    "resources/icons/apple-touch-icon.png",
    ...["ui", "cards", "court", "player", "rules", "state", "storage", "scoring", "undo", "panel", "human", "bot", "slots",
        "prelude", "guildactions", "turnplan", "vox", "market", "battle", "build", "turnwindow", "farseers", "leaders", "leaderrules", "game"]
        .map(name => "resources/js/" + name + ".js"),
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
    "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
    "https://fonts.googleapis.com/css2?family=Spectral+SC:wght@700&display=swap"
];

self.addEventListener("install", event => {
    // One file that can't be fetched shouldn't stop the rest being saved
    event.waitUntil(caches.open(cacheName).then(cache => Promise.all(appFiles.map(file =>
        cache.add(new Request(file, { mode: file.startsWith("http") ? "cors" : "same-origin", cache: "reload" })).catch(() => null)))));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method != "GET" || !request.url.startsWith("http")) { return; }

    event.respondWith(fetch(request).then(response => {
        // The latest version, saved for when there's no connection
        if (response.ok || response.type == "opaque") {
            const copy = response.clone();
            caches.open(cacheName).then(cache => cache.put(request, copy));
        }
        return response;
    }).catch(() => caches.match(request, { ignoreSearch: request.mode == "navigate" })
        .then(saved => saved || (request.mode == "navigate" ? caches.match("index.html") : undefined))
        .then(saved => saved || Response.error())));
});
