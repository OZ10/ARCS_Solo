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
//   load()                        game.js on start: load it again, before the players
//   startSetup(carryOn)           game.js setupGame: true means the campaign runs its own setup windows
//                                 and calls carryOn() (the opening Court) once they're done
//   markerRound(round)            rules.js getRoundMarkers: which round's ambition markers to use
//   roundShown()                  game.js updateRoundNumber: show the Act and chapters in the top bar
//   showGameOver()                scoring.js showGameOverModal: true means the campaign shows the end
//                                 of the Act itself
//   powerTarget()                 scoring.js: { target, text } in place of the Power that wins
//   ambitionExtra(player, ambition) scoring.js: more to count for an ambition (the Imperial Trust)
//
// One runs in every game, so the campaign can tidy up after itself:
//   modeChanged()                 game.js setupGame and on start: a game has started or loaded,
//                                 campaign or not
//
// Part of the ARCS bot. Every file in resources/js shares the same global names, so
// they are loaded as plain scripts, in order, by index.html

// True only in a campaign game. Set when a game starts or loads
let campaignMode = false;

function isCampaignChosen() {
    // The New Game window's campaign switch, added by resources/js/campaign/campaign.js
    const campaignSwitch = document.getElementById("campaignSwitch");
    return campaignSwitch != null && campaignSwitch.checked;
}

function notifyCampaignModeChanged() {
    // Runs in every game, campaign or not, so the campaign can take its things off the screen
    (campaignHooks.modeChanged || []).forEach(run => run());
}

// Each hook can have several handlers, from different campaign files. They run in the order they
// were registered, until one gives an answer (anything but undefined)
const campaignHooks = {};

function registerCampaignHook(name, run) {
    (campaignHooks[name] = campaignHooks[name] || []).push(run);
}

function runCampaignHook(name, ...args) {
    if (!campaignMode || campaignHooks[name] == null) { return undefined; }
    for (const run of campaignHooks[name]) {
        const answer = run(...args);
        if (answer !== undefined) { return answer; }
    }
    return undefined;
}
