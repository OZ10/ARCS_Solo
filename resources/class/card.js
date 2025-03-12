class Card {
  constructor(name, number, pips, played, ambition, actions) {
      this.name = name;
      this.number = number;
      this.pips = pips;
      this.played = played;
      this.ambition = ambition;
      this.actions = actions;
  }

  cardAction = '';
  playedAction = '';
  playedByPlayerNumber = 0;
}

  export { Card };