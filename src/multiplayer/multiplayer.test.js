// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, ConfigError, DEFAULTS } from './config.js';
import { botOffer, botAccepts, botMove } from './bots.js';
import { createMatch, applyMove, whoseTurn, moveRows, playerSummary, MoveError } from './engine.js';

const human = (id = 'P1') => ({ id, kind: 'human' });
const bot = (strategy) => ({ id: 'bot', kind: 'bot', strategy });
const ug = (extra = {}) => ({ game: 'ultimatum', tokens: 10, rounds: 4, firstProposer: 'participant', ...extra });

// Plays a whole match where every human proposes `offer` to the other and
// accepts everything, and bots follow their strategy.
function play(state, { offer = 3, accept = () => 'accept' } = {}) {
  let s = state;
  let t = 1000;
  while (whoseTurn(s) !== null) {
    const p = whoseTurn(s);
    const m = botMove(s, p) || (s.phase === 'propose'
      ? { type: 'propose', player: p, proposerShare: s.tokens - offer, responderShare: offer, decisionMs: 500 }
      : { type: 'respond', player: p, response: accept(s), decisionMs: 400 });
    s = applyMove(s, { ...m, at: (t += 1000) });
  }
  return s;
}

// ---- config ---------------------------------------------------------------

test('config: defaults fill in', () => {
  const c = normalizeConfig({ game: 'dictator', tokens: 6 });
  assert.equal(c.rounds, 1);
  assert.equal(c.firstProposer, 'random');
  assert.equal(c.roles, 'alternate');
  assert.deepEqual(c.matching, DEFAULTS.matching);
  assert.deepEqual(c.bot, DEFAULTS.bot);
  assert.equal(c.debrief.show, true);
  assert.equal(c.bonusPerToken, null);
});

test('config: partial nested settings keep the other defaults', () => {
  const c = normalizeConfig({ game: 'ultimatum', tokens: 6, bot: { strategy: 'rational' }, debrief: { show: false } });
  assert.equal(c.bot.strategy, 'rational');
  assert.equal(c.bot.reactionDelay, 1000);
  assert.equal(c.debrief.show, false);
  assert.equal(c.debrief.textBot, 'multiplayer.debrief.bot');
});

test('config: rejects settings that cannot work', () => {
  const bad = [
    {}, { game: 'chess', tokens: 5 }, { game: 'ultimatum', tokens: 0 }, { game: 'ultimatum', tokens: 2.5 },
    { game: 'ultimatum', tokens: 5, rounds: 0 }, { game: 'ultimatum', tokens: 5, roles: 'swap' },
    { game: 'ultimatum', tokens: 5, bot: { strategy: 'greedy' } },
    { game: 'ultimatum', tokens: 5, bot: { reactionDelay: -1 } },
    { game: 'ultimatum', tokens: 5, bonusPerToken: -0.1 },
    // the simple bot never proposes
    { game: 'ultimatum', tokens: 5, bot: { strategy: 'simple' } },
    { game: 'ultimatum', tokens: 5, rounds: 3, firstProposer: 'participant', bot: { strategy: 'simple' } },
  ];
  for (const v of bad) assert.throws(() => normalizeConfig(v), ConfigError, JSON.stringify(v));
  assert.doesNotThrow(() => normalizeConfig({ game: 'ultimatum', tokens: 5, rounds: 3, firstProposer: 'participant', roles: 'fixed', bot: { strategy: 'simple' } }));
});

// ---- bots: exact Cut rules ------------------------------------------------

test('bots: offers', () => {
  for (const s of ['fair', 'rational']) {
    assert.equal(botOffer(s, 10), 5);
    assert.equal(botOffer(s, 7), 3);
    assert.equal(botOffer(s, 1), 0);
  }
  assert.equal(botOffer('hyperRational', 10), 1);
  assert.equal(botOffer('hyperRational', 1), 1);
  assert.throws(() => botOffer('simple', 10));
});

test('bots: acceptance (mine, theirs)', () => {
  // fair: near-equal only
  assert.equal(botAccepts('fair', 'ultimatum', 5, 5), true);
  assert.equal(botAccepts('fair', 'ultimatum', 4, 5), true);
  assert.equal(botAccepts('fair', 'ultimatum', 6, 5), true);
  assert.equal(botAccepts('fair', 'ultimatum', 3, 7), false);
  assert.equal(botAccepts('fair', 'ultimatum', 9, 1), false);
  // rational / hyperRational: anything above 0
  for (const s of ['rational', 'hyperRational']) {
    assert.equal(botAccepts(s, 'ultimatum', 1, 9), true);
    assert.equal(botAccepts(s, 'ultimatum', 0, 10), false);
  }
  // simple
  assert.equal(botAccepts('simple', 'ultimatum', 1, 9), true);
  assert.equal(botAccepts('simple', 'ultimatum', 0, 10), false);
  assert.equal(botAccepts('simple', 'dictator', 0, 10), true);
});

// ---- engine ---------------------------------------------------------------

test('ultimatum: roles alternate, accept pays the split, reject pays nothing', () => {
  let s = createMatch({ view: ug(), matchId: 'm1', players: [human('A'), human('B')], at: 0 });
  assert.equal(whoseTurn(s), 0);
  s = applyMove(s, { type: 'propose', player: 0, proposerShare: 7, responderShare: 3, at: 1 });
  assert.equal(whoseTurn(s), 1);
  s = applyMove(s, { type: 'respond', player: 1, response: 'accept', at: 2 });
  assert.deepEqual(s.totals, [7, 3]);
  assert.equal(whoseTurn(s), 1, 'round 2: B proposes');
  s = applyMove(s, { type: 'propose', player: 1, proposerShare: 9, responderShare: 1, at: 3 });
  s = applyMove(s, { type: 'respond', player: 0, response: 'reject', at: 4 });
  assert.deepEqual(s.totals, [7, 3], 'rejection pays nothing');
  assert.equal(s.round, 2);
  assert.equal(s.phase, 'propose');
});

test('dictator: the split stands even when the responder "rejects"', () => {
  let s = createMatch({ view: ug({ game: 'dictator', rounds: 1 }), matchId: 'm', players: [human('A'), human('B')], at: 0 });
  s = applyMove(s, { type: 'propose', player: 0, proposerShare: 8, responderShare: 2, at: 1 });
  s = applyMove(s, { type: 'respond', player: 1, response: 'reject', at: 2 });
  assert.deepEqual(s.totals, [8, 2]);
  assert.equal(s.phase, 'finished');
  assert.equal(s.history[0].response, 'reject', 'reaction is still recorded');
});

test('fixed roles keep the same proposer', () => {
  const s = play(createMatch({ view: ug({ roles: 'fixed', rounds: 3 }), matchId: 'm', players: [human('A'), human('B')], at: 0 }));
  assert.deepEqual(s.history.map((h) => h.proposer), [0, 0, 0]);
});

test('first proposer: partner, and random uses the injected rng', () => {
  assert.equal(createMatch({ view: ug({ firstProposer: 'partner' }), matchId: 'm', players: [human(), human('B')] }).proposer, 1);
  assert.equal(createMatch({ view: ug({ firstProposer: 'random' }), matchId: 'm', players: [human(), human('B')], rng: () => 0.2 }).proposer, 0);
  assert.equal(createMatch({ view: ug({ firstProposer: 'random' }), matchId: 'm', players: [human(), human('B')], rng: () => 0.7 }).proposer, 1);
});

test('illegal moves are refused and leave the state unchanged', () => {
  const s0 = createMatch({ view: ug(), matchId: 'm', players: [human('A'), human('B')], at: 0 });
  const code = (fn) => { try { fn(); return null; } catch (e) { assert.ok(e instanceof MoveError); return e.code; } };
  assert.equal(code(() => applyMove(s0, { type: 'propose', player: 1, proposerShare: 5, responderShare: 5 })), 'turn');
  assert.equal(code(() => applyMove(s0, { type: 'propose', player: 0, proposerShare: 6, responderShare: 5 })), 'split');
  assert.equal(code(() => applyMove(s0, { type: 'propose', player: 0, proposerShare: 5.5, responderShare: 4.5 })), 'split');
  assert.equal(code(() => applyMove(s0, { type: 'propose', player: 0, proposerShare: 11, responderShare: -1 })), 'split');
  assert.equal(code(() => applyMove(s0, { type: 'respond', player: 1, response: 'accept' })), 'phase');
  assert.equal(code(() => applyMove(s0, { type: 'bid', player: 0 })), 'type');
  assert.equal(code(() => applyMove(s0, { type: 'propose', player: 2, proposerShare: 5, responderShare: 5 })), 'player');
  const s1 = applyMove(s0, { type: 'propose', player: 0, proposerShare: 5, responderShare: 5 });
  assert.equal(code(() => applyMove(s1, { type: 'respond', player: 0, response: 'accept' })), 'turn');
  assert.equal(code(() => applyMove(s1, { type: 'respond', player: 1, response: 'maybe' })), 'response');
  assert.equal(s0.phase, 'propose', 'original state untouched');
  assert.equal(s0.moves.length, 0);
});

test('leaving ends the match and blocks further moves', () => {
  let s = createMatch({ view: ug(), matchId: 'm', players: [human('A'), human('B')], at: 0 });
  s = applyMove(s, { type: 'leave', player: 1, at: 5 });
  assert.equal(s.phase, 'abandoned');
  assert.equal(whoseTurn(s), null);
  assert.throws(() => applyMove(s, { type: 'propose', player: 0, proposerShare: 5, responderShare: 5 }), MoveError);
  const sum = playerSummary(s, 0);
  assert.equal(sum.completed, false);
  assert.equal(sum.abandonedBy, 'partner');
});

test('a full match against each bot follows the Cut rules', () => {
  // Participant offers 3 of 10 and accepts everything; bot moves itself.
  const expect = {
    // bot accepts 3? fair: |3-7| > 1 → reject; rational/hyper: 3 > 0 → accept
    fair: { botAcceptsParticipant: 'reject', botOffer: 5 },
    rational: { botAcceptsParticipant: 'accept', botOffer: 5 },
    hyperRational: { botAcceptsParticipant: 'accept', botOffer: 1 },
  };
  for (const [strategy, e] of Object.entries(expect)) {
    const s = play(createMatch({ view: ug(), matchId: strategy, players: [human('A'), bot(strategy)], at: 0 }));
    assert.equal(s.phase, 'finished');
    const participantRounds = s.history.filter((h) => h.proposer === 0);
    const botRounds = s.history.filter((h) => h.proposer === 1);
    assert.equal(participantRounds.length, 2);
    assert.ok(participantRounds.every((h) => h.response === e.botAcceptsParticipant), strategy);
    assert.ok(botRounds.every((h) => h.responderShare === e.botOffer), strategy);
  }
});

test('simple bot responds only; dictator version always accepts', () => {
  const view = ug({ game: 'dictator', rounds: 3, roles: 'fixed', bot: { strategy: 'simple' } });
  const s = play(createMatch({ view, matchId: 'm', players: [human('A'), bot('simple')], at: 0 }), { offer: 0 });
  assert.deepEqual(s.history.map((h) => h.response), ['accept', 'accept', 'accept']);
  assert.deepEqual(s.totals, [30, 0]);
});

test('practice matches use practiceRounds and are marked', () => {
  const view = ug({ practiceRounds: 2 });
  const s = play(createMatch({ view, matchId: 'p', players: [human('A'), bot('fair')], practice: true, at: 0 }));
  assert.equal(s.history.length, 2);
  assert.equal(playerSummary(s, 0).practice, true);
  assert.throws(() => createMatch({ view: ug(), matchId: 'p', players: [human('A'), bot('fair')], practice: true }), MoveError);
});

test('records: long-format rows say who the partner was', () => {
  const s = play(createMatch({ view: ug({ rounds: 2 }), matchId: 'm9', players: [human('A'), bot('rational')], at: 0 }));
  const rows = moveRows(s);
  assert.equal(rows.length, 4, 'propose + respond per round');
  const r0 = rows[0];
  assert.deepEqual(
    { round: r0.round, move: r0.move, playerId: r0.playerId, role: r0.role, partnerKind: r0.partnerKind, partnerStrategy: r0.partnerStrategy, decisionMs: r0.decisionMs },
    { round: 1, move: 'propose', playerId: 'A', role: 'proposer', partnerKind: 'bot', partnerStrategy: 'rational', decisionMs: 500 },
  );
  const botRow = rows.find((r) => r.playerKind === 'bot');
  assert.equal(botRow.partnerKind, 'human');
  assert.equal(botRow.partnerStrategy, null);
});

test('records: player summary is from that player\'s point of view, with bonus', () => {
  let s = createMatch({ view: ug({ rounds: 2, bonusPerToken: 0.05 }), matchId: 'm', players: [human('A'), human('B')], at: 0 });
  s = applyMove(s, { type: 'propose', player: 0, proposerShare: 6, responderShare: 4, at: 1, decisionMs: 2100 });
  s = applyMove(s, { type: 'respond', player: 1, response: 'accept', at: 2, decisionMs: 900 });
  s = applyMove(s, { type: 'propose', player: 1, proposerShare: 7, responderShare: 3, at: 3, decisionMs: 1500 });
  s = applyMove(s, { type: 'respond', player: 0, response: 'accept', at: 4, decisionMs: 800 });
  const a = playerSummary(s, 0, { bonusPerToken: 0.05 });
  const b = playerSummary(s, 1, { bonusPerToken: 0.05 });
  assert.equal(a.totalTokens, 9);
  assert.equal(b.totalTokens, 11);
  assert.equal(a.bonus, 0.45);
  assert.equal(b.bonus, 0.55);
  assert.deepEqual(a.rounds.map((r) => [r.role, r.myShare, r.partnerShare, r.myDecisionMs]), [['proposer', 6, 4, 2100], ['responder', 3, 7, 800]]);
  assert.deepEqual(b.rounds.map((r) => [r.role, r.myShare, r.myDecisionMs]), [['responder', 4, 900], ['proposer', 7, 1500]]);
  assert.equal(a.partnerKind, 'human');
  assert.equal(a.completed, true);
  assert.equal(a.firstProposer, 'me');
  assert.equal(b.firstProposer, 'partner');
});

test('a match replays to the same state from its move log', () => {
  const start = createMatch({ view: ug({ rounds: 4 }), matchId: 'r', players: [human('A'), bot('fair')], at: 0 });
  const end = play(start);
  const replayed = end.moves.reduce((st, m) => applyMove(st, m), start);
  assert.deepEqual(replayed, end);
});
