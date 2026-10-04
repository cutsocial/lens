/**
 * Rules of the multiplayer ultimatum and dictator games, as Cut ran them
 * (see cut-port-spec.md), with every move logged.
 *
 * - Two players. players[0] is the participant who arrived first (the host),
 *   or the only human when the partner is a bot; players[1] is the partner.
 * - Each round the proposer splits `tokens` whole tokens between the two.
 *   Ultimatum: the responder accepts (both get the split) or rejects (both
 *   get 0). Dictator: the split always stands; the responder's accept/reject
 *   is recorded as a reaction only, as in Cut.
 * - Roles swap every round ("alternate", as Cut) or stay ("fixed").
 * - The match ends after the last round's response, or when a player leaves.
 *
 * The state is a plain object and every function returns a new one, so the
 * same code can check moves in the browser and on a server, and a match can
 * be replayed from its move log.
 */
import { normalizeConfig } from './config.js';

export const ENGINE_VERSION = 1;

export class MoveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MoveError';
    this.code = code;
  }
}

const KINDS = ['human', 'bot'];

/**
 * @param {object} p
 * @param {object} p.view      the study-file view (normalized here)
 * @param {string} p.matchId
 * @param {Array<{id: string, kind: 'human'|'bot', strategy?: string}>} p.players
 *        players[0] = host / the only human; a bot's strategy defaults to view.bot.strategy
 * @param {boolean} [p.practice]
 * @param {() => number} [p.rng]  random number in [0, 1), for "random" first proposer
 * @param {number} [p.at]         start time, ms since epoch
 */
export function createMatch({ view, matchId, players, practice = false, rng = Math.random, at = Date.now() }) {
  const config = normalizeConfig(view);
  if (!Array.isArray(players) || players.length !== 2) throw new MoveError('players', 'a match needs exactly two players');
  if (players[0].kind !== 'human') throw new MoveError('players', 'players[0] must be a human participant');
  const ps = players.map((p) => {
    if (!KINDS.includes(p.kind)) throw new MoveError('players', `player kind must be "human" or "bot"`);
    return p.kind === 'bot'
      ? { id: p.id, kind: 'bot', strategy: p.strategy || config.bot.strategy }
      : { id: p.id, kind: 'human' };
  });
  if (ps[1].kind === 'bot' && ps[1].strategy === 'simple' && config.firstProposer !== 'participant') {
    throw new MoveError('players', 'the "simple" bot only responds, so the participant must propose');
  }

  if (practice && config.practiceRounds < 1) throw new MoveError('practice', 'this game has no practice rounds ("practiceRounds" is 0)');

  const first = config.firstProposer === 'participant' ? 0
    : config.firstProposer === 'partner' ? 1
    : (rng() < 0.5 ? 0 : 1);

  return {
    engineVersion: ENGINE_VERSION,
    matchId,
    game: config.game,
    tokens: config.tokens,
    rounds: practice ? config.practiceRounds : config.rounds,
    roles: config.roles,
    practice,
    players: ps,
    firstProposer: first,
    round: 0,
    proposer: first,
    phase: 'propose',
    offer: null,
    history: [],
    moves: [],
    totals: [0, 0],
    startedAt: at,
    finishedAt: null,
    abandonedBy: null,
  };
}

const done = (s) => s.phase === 'finished' || s.phase === 'abandoned';

/**
 * Applies one move and returns the new state; throws MoveError if the move
 * isn't allowed.
 *
 * Moves:
 *   {type: 'propose', player, proposerShare, responderShare}
 *   {type: 'respond', player, response: 'accept'|'reject'}
 *   {type: 'leave', player}
 * Each may carry `at` (ms since epoch; defaults to now) and `decisionMs`
 * (time from the decision screen appearing to the choice, measured by the
 * participant's browser; null for bots).
 */
export function applyMove(state, move) {
  if (done(state)) throw new MoveError('over', 'the match is over');
  const p = move.player;
  if (p !== 0 && p !== 1) throw new MoveError('player', 'player must be 0 or 1');
  const at = move.at ?? Date.now();
  const decisionMs = move.decisionMs ?? null;
  const s = { ...state, moves: [...state.moves], history: [...state.history], totals: [...state.totals] };
  const log = (extra) => s.moves.push({
    round: state.round, type: move.type, player: p,
    role: p === state.proposer ? 'proposer' : 'responder',
    at, decisionMs, ...extra,
  });

  switch (move.type) {
    case 'leave':
      log({});
      s.phase = 'abandoned';
      s.abandonedBy = p;
      s.finishedAt = at;
      return s;

    case 'propose': {
      if (state.phase !== 'propose') throw new MoveError('phase', 'waiting for a response, not a proposal');
      if (p !== state.proposer) throw new MoveError('turn', 'only the proposer can propose');
      const { proposerShare: a, responderShare: b } = move;
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) throw new MoveError('split', 'shares must be whole numbers of 0 or more');
      if (a + b !== state.tokens) throw new MoveError('split', `shares must add up to ${state.tokens}`);
      log({ proposerShare: a, responderShare: b });
      s.phase = 'respond';
      s.offer = { proposerShare: a, responderShare: b, at, decisionMs };
      return s;
    }

    case 'respond': {
      if (state.phase !== 'respond') throw new MoveError('phase', 'waiting for a proposal, not a response');
      if (p === state.proposer) throw new MoveError('turn', 'only the responder can respond');
      if (move.response !== 'accept' && move.response !== 'reject') throw new MoveError('response', 'response must be "accept" or "reject"');
      log({ response: move.response });

      const { proposerShare, responderShare } = state.offer;
      const stands = state.game === 'dictator' || move.response === 'accept';
      const earned = [0, 0];
      if (stands) {
        earned[state.proposer] = proposerShare;
        earned[1 - state.proposer] = responderShare;
      }
      s.totals = [s.totals[0] + earned[0], s.totals[1] + earned[1]];
      s.history.push({
        round: state.round,
        proposer: state.proposer,
        proposerShare,
        responderShare,
        response: move.response,
        earned,
        proposedAt: state.offer.at,
        proposeDecisionMs: state.offer.decisionMs,
        respondedAt: at,
        respondDecisionMs: decisionMs,
      });

      s.offer = null;
      s.round = state.round + 1;
      if (s.round >= state.rounds) {
        s.phase = 'finished';
        s.finishedAt = at;
      } else {
        s.phase = 'propose';
        s.proposer = state.roles === 'alternate' ? 1 - state.proposer : state.proposer;
      }
      return s;
    }

    default:
      throw new MoveError('type', `unknown move type "${move.type}"`);
  }
}

/** Index of the player whose turn it is, or null when the match is over. */
export function whoseTurn(state) {
  if (done(state)) return null;
  return state.phase === 'propose' ? state.proposer : 1 - state.proposer;
}

/**
 * One row per move (long format, ready for R). `round` is 1-based here.
 * Respond rows repeat the offer they answered, so each row stands alone.
 * Each row says whether the player's partner was a bot, and which strategy.
 */
export function moveRows(state) {
  // a "respond" row also carries the offer it answered (the round's proposal)
  const offers = {};
  for (const m of state.moves) {
    if (m.type === 'propose') offers[m.round] = m;
  }
  return state.moves.map((m) => {
    const me = state.players[m.player];
    const offer = m.type === 'respond' ? offers[m.round] : m;
    const partner = state.players[1 - m.player];
    return {
      matchId: state.matchId,
      game: state.game,
      practice: state.practice,
      round: m.round + 1,
      move: m.type,
      playerId: me.id,
      playerKind: me.kind,
      role: m.role,
      partnerId: partner.id,
      partnerKind: partner.kind,
      partnerStrategy: partner.kind === 'bot' ? partner.strategy : null,
      proposerShare: offer && offer.proposerShare !== undefined ? offer.proposerShare : null,
      responderShare: offer && offer.responderShare !== undefined ? offer.responderShare : null,
      response: m.response ?? null,
      at: m.at,
      decisionMs: m.decisionMs,
    };
  });
}

/**
 * What one participant's study data records for the match: their rounds from
 * their own point of view, totals, the bonus, and who the partner was.
 */
export function playerSummary(state, playerIndex, { bonusPerToken = null } = {}) {
  const me = playerIndex;
  const partner = state.players[1 - me];
  const rounds = state.history.map((h) => ({
    round: h.round + 1,
    role: h.proposer === me ? 'proposer' : 'responder',
    myShare: h.proposer === me ? h.proposerShare : h.responderShare,
    partnerShare: h.proposer === me ? h.responderShare : h.proposerShare,
    response: h.response,
    myEarned: h.earned[me],
    partnerEarned: h.earned[1 - me],
    proposedAt: h.proposedAt,
    respondedAt: h.respondedAt,
    myDecisionMs: h.proposer === me ? h.proposeDecisionMs : h.respondDecisionMs,
  }));
  const total = state.totals[me];
  return {
    matchId: state.matchId,
    game: state.game,
    practice: state.practice,
    engineVersion: state.engineVersion,
    playerId: state.players[me].id,
    partnerId: partner.id,
    partnerKind: partner.kind,
    partnerStrategy: partner.kind === 'bot' ? partner.strategy : null,
    firstProposer: state.firstProposer === me ? 'me' : 'partner',
    roundsPlanned: state.rounds,
    roundsPlayed: rounds.length,
    completed: state.phase === 'finished',
    abandonedBy: state.abandonedBy === null ? null : (state.abandonedBy === me ? 'me' : 'partner'),
    rounds,
    totalTokens: total,
    bonus: bonusPerToken === null ? null : Math.round(total * bonusPerToken * 100) / 100,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  };
}
