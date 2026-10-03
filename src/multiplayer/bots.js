/**
 * Computer partners, reproducing the rules of Cut's bots
 * (social.cut.legacy, app/models/games; see cut-port-spec.md):
 *
 * | strategy      | offers when proposing        | accepts when responding        |
 * |---------------|------------------------------|--------------------------------|
 * | fair          | floor(T/2) (0 if T <= 1)     | only if |mine - theirs| <= 1   |
 * | rational      | same as fair                 | any offer > 0                  |
 * | hyperRational | 1 token                      | any offer > 0                  |
 * | simple        | (never proposes)             | ultimatum: any offer > 0;      |
 * |               |                              | dictator: always accepts       |
 *
 * In the dictator game the responder can't veto; the bot's accept/reject is
 * recorded as its reaction, using the same rule as in the ultimatum game
 * (Cut only defined this for "simple", which always accepts).
 */

/** What a bot offers the other player when it proposes, out of `tokens`. */
export function botOffer(strategy, tokens) {
  switch (strategy) {
    case 'fair':
    case 'rational':
      return tokens <= 1 ? 0 : Math.floor(tokens / 2);
    case 'hyperRational':
      return Math.min(1, tokens);
    default:
      throw new Error(`the "${strategy}" bot doesn't propose`);
  }
}

/** Whether a bot accepts a split where it gets `mine` and the proposer `theirs`. */
export function botAccepts(strategy, game, mine, theirs) {
  switch (strategy) {
    case 'fair':
      return Math.abs(mine - theirs) <= 1;
    case 'rational':
    case 'hyperRational':
      return mine > 0;
    case 'simple':
      return game === 'dictator' ? true : mine > 0;
    default:
      throw new Error(`unknown bot strategy "${strategy}"`);
  }
}

/**
 * The bot's next move in `state`, or null when it isn't the bot's turn.
 * Returns a move ready for `applyMove` (timing is added by the caller,
 * which also waits `bot.initialDelay` / `bot.reactionDelay` first).
 */
export function botMove(state, playerIndex) {
  const player = state.players[playerIndex];
  if (player.kind !== 'bot' || state.phase === 'finished' || state.phase === 'abandoned') return null;
  const strategy = player.strategy;
  if (state.phase === 'propose' && state.proposer === playerIndex) {
    const offer = botOffer(strategy, state.tokens);
    return { type: 'propose', player: playerIndex, proposerShare: state.tokens - offer, responderShare: offer };
  }
  if (state.phase === 'respond' && state.proposer !== playerIndex) {
    const { proposerShare, responderShare } = state.offer;
    const accept = botAccepts(strategy, state.game, responderShare, proposerShare);
    return { type: 'respond', player: playerIndex, response: accept ? 'accept' : 'reject' };
  }
  return null;
}
