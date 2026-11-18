// Hook points for the Blighted Reach campaign (#85). The campaign's rules live in resources/js/campaign/
// and plug in here; the base game only ever calls runCampaignHook at a few fixed moments. Outside a
// campaign game every call does nothing and returns undefined, so the base game plays exactly as before.
//
// The hooks, where they're called and what an answer means:
//   afterSetup()                  game.js setupGame: the players are created and the cards dealt
//   buildActionDeck(cards)        game.js resetRound: change the action deck (cards) for this round
//   panelBuilt(player, panel)     panel.js clonePlayerNodeAndSetup: add to a player's panel
//   beforeScoring(carryOn)        game.js nextRound: true means the campaign will call carryOn() itself
//                                 once its end-of-round steps (Council, Events) are done
//   isGameOver()                  scoring.js isGameOver: true or false overrides the base rule
//                                 (Acts end after 3 or 4 chapters, not on Power)
//   save()                        storage.js SaveAllSettings: save the campaign's own state
//   load()                        game.js on start: load it again
//
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// True only in a campaign game. Nothing in the base game sets it
let campaignMode = false;

const campaignHooks = {};

function registerCampaignHook(name, run) {
    campaignHooks[name] = run;
}

function runCampaignHook(name, ...args) {
    if (!campaignMode || campaignHooks[name] == null) { return undefined; }
    return campaignHooks[name](...args);
}
