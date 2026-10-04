/**
 * Multiplayer ultimatum and dictator games (view type "multiplayer").
 *
 * The rules, bots and data shape are in src/multiplayer/ (shared with the
 * server, which checks every move). This screen joins a match, shows it live,
 * and sends the participant's own moves. See src/multiplayer/client.js for the
 * connection and the server repo's multiplayer/ for matching.
 *
 * Flow: instructions → (practice against a computer, if practiceRounds) →
 * finding a partner (computer partner after matching.timeout unless
 * botFallback is false) → rounds → debrief (on by default) → next view.
 *
 * Each round both players see the same board. The proposer moves tokens;
 * the responder watches them move: the proposer's split arrives as it
 * changes (display only, not recorded) and is replayed one token at a time,
 * each coin flying to its pile. Accept / Reject turn on once the whole offer
 * is on the board and at least MIN_OFFER_MS after the round appeared. The
 * same replay shows a computer's offer, or one made while the responder was
 * still reading the last result, so the other player is always seen deciding.
 *
 * decisionMs: proposer from the board appearing to Send offer; responder
 * from Accept / Reject turning on to the choice.
 *
 * The partner is shown the same way whether a person or a computer; the
 * debrief afterwards says which it was (textBot / textHuman).
 *
 * Stored response: the engine's playerSummary for this participant (rounds
 * from their side, totals, bonus, partnerKind, partnerStrategy, decision
 * times) plus matchId, how long they waited for a partner, whether and when
 * the debrief was shown, why the match ended, the practice summary, and
 * taskVersion: 2.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { languages } from '../utils/i18n';
import { L2Root, Header, Text, Button, NoticeCard, potHeight } from './components';
import { normalizeConfig } from '../multiplayer/config';
import { whoseTurn, playerSummary } from '../multiplayer/engine';
import { connect } from '../multiplayer/client';
import './multiplayer.css';

const HEARTBEAT_MS = 10000;
const STALE_MS = 30000; // matches the server: a partner silent this long has gone
const DRAFT_INTERVAL_MS = 350; // at most ~3 updates a second while the proposer moves tokens
// What the responder sees: the other person's tokens move one at a time, and
// an offer can't be answered sooner than this after the round appears.
const MIN_OFFER_MS = 2500;
const EMPTY = (tokens) => ({ other: 0, pot: tokens, me: 0 });

function Coin({ small, dragging, ...rest }) {
  return <span className={`l2-coin ${small ? 'l2-coin-small' : ''} ${dragging ? 'l2-coin-dragging' : ''}`} aria-hidden="true" {...rest} />;
}

/**
 * The three piles: the other person, the middle, and the participant.
 * Controlled: `piles` = {other, pot, me}. When `onMove` is given the
 * participant can drag tokens or use + and −; otherwise it only shows.
 */
function Board({ piles, onMove, flight, onFlightDone, t }) {
  const interactive = typeof onMove === 'function';
  const rootRef = useRef(null);

  // a coin flying from one pile to another (the other person moving a token)
  useLayoutEffect(() => {
    if (!flight || !rootRef.current) return undefined;
    const root = rootRef.current;
    const area = (pile) => root.querySelector(pile === 'pot' ? '[data-pile="pot"] .l2-pile' : `[data-pile="${pile}"] .l2-pile`);
    const fromEl = area(flight.from);
    const toEl = area(flight.to);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fromEl || !toEl || reduce) { onFlightDone(); return undefined; }
    const centre = (el, end) => {
      const r = el.getBoundingClientRect();
      const coins = el.querySelectorAll('.l2-coin');
      const last = end && coins.length ? coins[coins.length - 1].getBoundingClientRect() : null;
      // land just after the last coin in the pile, or at the pile's start
      if (end) {
        const rtl = getComputedStyle(el).direction === 'rtl';
        const x = last ? (rtl ? last.left - 12 : last.right + 12) : (rtl ? r.right - 20 : r.left + 20);
        return { x, y: r.top + r.height / 2 };
      }
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const a = centre(fromEl, false);
    const b = centre(toEl, true);
    const coin = document.createElement('span');
    coin.className = 'l2-coin l2-mp-flying';
    coin.setAttribute('aria-hidden', 'true');
    coin.style.left = `${a.x - 22}px`;
    coin.style.top = `${a.y - 22}px`;
    root.appendChild(coin);
    const toPot = flight.to === 'pot';
    const anim = coin.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${(b.x - a.x) / 2}px, ${(b.y - a.y) / 2 - 18}px) scale(${toPot ? 0.9 : 0.85})`, offset: 0.5 },
      { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${toPot ? 1 : 0.68})` },
    ], { duration: 450, easing: 'ease-in-out' });
    let done = false;
    const finish = () => { if (done) return; done = true; coin.remove(); onFlightDone(); };
    anim.onfinish = finish;
    return () => { anim.cancel(); coin.remove(); };
  }, [flight && flight.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;

  const move = (from, to) => {
    if (!interactive || from === to || piles[from] <= 0) return;
    onMove(from, to);
  };

  useEffect(() => {
    if (!drag) return undefined;
    const pileAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const box = el && el.closest('[data-pile]');
      return box ? box.getAttribute('data-pile') : null;
    };
    const onPointerMove = (e) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over: pileAt(e.clientX, e.clientY) });
    const onUp = (e) => {
      const d = dragRef.current;
      const target = pileAt(e.clientX, e.clientY);
      if (d && target && target !== d.from) move(d.from, target);
      setDrag(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!interactive) setDrag(null); }, [interactive]);

  const startDrag = (from) => (e) => {
    if (!interactive) return;
    e.preventDefault();
    setDrag({ from, x: e.clientX, y: e.clientY, over: from });
  };

  const pile = (name, count) => (
    <div className="l2-pile" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Coin key={i} small onPointerDown={startDrag(name)} dragging={drag && drag.from === name && i === count - 1} />
      ))}
      {count === 0 && <span className="l2-pile-empty">{interactive ? t('lens2.tokens.drop_here') : ''}</span>}
    </div>
  );
  const pileClass = (name) => ['l2-person', drag && drag.from !== name ? 'l2-drop-ok' : '', drag && drag.over === name && drag.from !== name ? 'l2-drop-over' : ''].join(' ');
  const stepper = (name, label) => interactive && (
    <div className="l2-stepper">
      <button type="button" className="l2-step" onClick={() => move(name, 'pot')} disabled={piles[name] === 0}
        aria-label={t('lens2.tokens.take_back', { name: label })}>−</button>
      <button type="button" className="l2-step" onClick={() => move('pot', name)} disabled={piles.pot === 0}
        aria-label={t('lens2.tokens.give', { name: label })}>+</button>
    </div>
  );
  const other = t('lens2.mp.other');

  return (
    <div ref={rootRef} className={`l2-token-area l2-mp-board ${interactive ? '' : 'l2-mp-board-watch'}`}>
      <div className={pileClass('other')} data-pile="other">
        <div className="l2-person-head">
          <div className="l2-avatar l2-avatar-initials" aria-hidden="true">?</div>
          <div className="l2-person-text"><span className="l2-person-name">{other}</span></div>
          <span className="l2-count" aria-label={t('lens2.tokens.count', { count: piles.other })}>{piles.other}</span>
        </div>
        <div className="l2-tray">{pile('other', piles.other)}{stepper('other', other)}</div>
      </div>

      <div className={`l2-pot ${drag && drag.from !== 'pot' ? 'l2-drop-ok' : ''} ${drag && drag.over === 'pot' && drag.from !== 'pot' ? 'l2-drop-over' : ''}`} data-pile="pot">
        <div className="l2-pile l2-pile-large" aria-hidden="true" style={potHeight(piles.other + piles.pot + piles.me)}>
          {Array.from({ length: piles.pot }, (_, i) => (
            <Coin key={i} onPointerDown={startDrag('pot')} dragging={drag && drag.from === 'pot' && i === piles.pot - 1} />
          ))}
          {piles.pot === 0 && <span className="l2-pile-empty">{t('lens2.tokens.all_placed')}</span>}
        </div>
        {interactive && <span className="l2-hint-small">{t('lens2.tokens.drag_or_tap')}</span>}
      </div>

      <div className={pileClass('me')} data-pile="me">
        <div className="l2-person-head">
          <div className="l2-avatar l2-avatar-you" aria-hidden="true">{t('lens2.tokens.you')}</div>
          <div className="l2-person-text"><span className="l2-person-name">{t('lens2.tokens.you')}</span></div>
          <span className="l2-count" aria-label={t('lens2.tokens.count', { count: piles.me })}>{piles.me}</span>
        </div>
        <div className="l2-tray">{pile('me', piles.me)}{stepper('me', t('lens2.tokens.you'))}</div>
      </div>
      {drag && <span className="l2-coin l2-coin-ghost" aria-hidden="true" style={{ left: drag.x - 22, top: drag.y - 22 }} />}
    </div>
  );
}

function Waiting({ message, hint }) {
  return (
    <div className="l2-card l2-mp-wait" role="status">
      <span className="l2-spinner" aria-hidden="true" />
      <Text source={message} className="l2-body" />
      {hint && <p className="l2-hint">{hint}</p>}
    </div>
  );
}

export default function Multiplayer({ content, onStore, studyId, participant }) {
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';

  const config = useMemo(() => {
    try { return normalizeConfig(content); } catch (e) { return { error: e.message }; }
  }, [content]);

  // intro | connecting | finding | playing | practiceDone | ended | debrief | error
  const [stage, setStage] = useState('intro');
  const [error, setError] = useState(null);
  const [practice, setPractice] = useState(!config.error && config.practiceRounds > 0);
  const [practiceSummary, setPracticeSummary] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [me, setMe] = useState(0);
  const [match, setMatch] = useState(null);
  const [acked, setAcked] = useState(0); // rounds whose result the participant has dismissed
  const [sending, setSending] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const conn = useRef(null);
  const waitStart = useRef(null);
  const waitMs = useRef(null);
  const skew = useRef(null); // local clock minus server clock (plus latency), smallest seen
  const shownAt = useRef({ key: null, at: null });
  const debriefAt = useRef(null);
  const live = useRef({ matchId: null, status: null });
  live.current = { matchId, status: match ? match.status : null };

  // ----- joining -----
  const join = async (isPractice) => {
    setStage('connecting');
    setError(null);
    try {
      conn.current = await connect();
      const r = await conn.current.call('/join', {
        studyId, viewId: content.id, practice: isPractice,
        participant: { ...participant, lang },
      });
      setMatch(null);
      setAcked(0);
      setMe(r.player);
      setMatchId(r.matchId);
      waitStart.current = Date.now();
      setWaitedLong(false);
    } catch (e) {
      setError(e.message || 'error');
      setStage('error');
    }
  };

  // live updates of the match
  useEffect(() => {
    if (!matchId || !conn.current) return undefined;
    return conn.current.watch(matchId, (m) => {
      const s = Date.now() - m.updatedAt;
      skew.current = skew.current === null ? s : Math.min(skew.current, s);
      setMatch(m);
    }, () => {});
  }, [matchId]);

  const status = match ? match.status : null;
  const state = match ? match.state : null;

  useEffect(() => {
    if (!status) return;
    // our waiting seat was retired (e.g. the tab slept and missed heartbeats): queue again
    if (status === 'expired' && stage === 'finding') { join(false); return; }
    if (status === 'waiting') setStage('finding');
    else if (status === 'playing') {
      if (waitMs.current === null && !practice) waitMs.current = Date.now() - waitStart.current;
      setStage('playing');
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- heartbeat while waiting and playing, so a closed tab is noticed -----
  const active = status === 'waiting' || status === 'playing';
  useEffect(() => {
    if (!active) return undefined;
    const ping = setInterval(() => conn.current.call('/ping', { matchId }).catch(() => {}), HEARTBEAT_MS);
    return () => clearInterval(ping);
  }, [active, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- while waiting: a computer partner after the timeout -----
  useEffect(() => {
    if (status !== 'waiting') return undefined;
    let fallbackTimer = null;
    const askForBot = () => {
      if (!config.matching.botFallback) { setWaitedLong(true); return; }
      conn.current.call('/fallback', { matchId }).catch((e) => {
        if (e.code === 'too-early') fallbackTimer = setTimeout(askForBot, 1500);
      });
    };
    fallbackTimer = setTimeout(askForBot, Math.max(0, config.matching.timeout - (Date.now() - waitStart.current)));
    return () => clearTimeout(fallbackTimer);
  }, [status, matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- while playing: keep the partner's turn moving; end the match if they go silent -----
  // The browser can't tell a computer partner from a person while the game is
  // on (the server hides it). On the partner's turn it asks the server at
  // nextTickAt whether anything is due; a computer partner moves then.
  const turn = state ? whoseTurn(state) : null;
  const serverToLocal = (ts) => ts + (skew.current || 0);

  useEffect(() => {
    if (status !== 'playing' || turn === null || turn === me || !match.nextTickAt) return undefined;
    let timer;
    let tries = 0;
    const tick = () => conn.current.call('/tick', { matchId }).then((r) => {
      if (!r.moved && r.wait && tries++ < 10) timer = setTimeout(tick, Math.min(r.wait + 50, 5000));
    }).catch(() => { if (tries++ < 10) timer = setTimeout(tick, 1000); });
    timer = setTimeout(tick, Math.max(0, serverToLocal(match.nextTickAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [status, turn, match && match.nextTickAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'playing' || turn === null || turn === me || !match.turnStartedAt) return undefined;
    let timer;
    const claim = () => conn.current.call('/timeout', { matchId }).catch((e) => {
      if (e.code === 'too-early') timer = setTimeout(claim, 2000);
    });
    timer = setTimeout(claim, Math.max(0, serverToLocal(match.turnStartedAt) + config.turnTimeout + 500 - Date.now()));
    return () => clearTimeout(timer);
  }, [status, turn, match && match.turnStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // a person partner whose heartbeats stopped (closed tab, lost connection)
  const matchRef = useRef(null);
  matchRef.current = match;
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const check = setInterval(() => {
      const m = matchRef.current;
      const seen = m && m.lastSeen ? m.lastSeen[1 - me] : null;
      if (seen && serverToLocal(seen) + STALE_MS + 1000 < Date.now()) {
        conn.current.call('/timeout', { matchId }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(check);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // tell the server if the participant closes the page mid-game
  useEffect(() => {
    const onHide = () => {
      const { matchId: id, status: st } = live.current;
      if (id && (st === 'waiting' || st === 'playing') && conn.current) {
        conn.current.call('/leave', { matchId: id }, { keepalive: true }).catch(() => {});
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  // ----- the split on the board this round -----
  const round = state ? state.round : null;
  const iPropose = state ? state.proposer === me : false;
  const [mySplit, setMySplit] = useState(null); // proposer's own piles {other, pot, me}
  useEffect(() => {
    if (!state) return;
    setMySplit(EMPTY(state.tokens));
  }, [matchId, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // send the proposer's split as it changes (latest wins; at most one request in flight)
  const draftOut = useRef({ busy: false, pending: null, last: 0 });
  const sendDraft = (split) => {
    const q = draftOut.current;
    q.pending = { round, proposerShare: split.me, responderShare: split.other };
    const flush = () => {
      if (q.busy || !q.pending) return;
      const wait = q.last + DRAFT_INTERVAL_MS - Date.now();
      if (wait > 0) { setTimeout(flush, wait); return; }
      const body = { matchId, ...q.pending };
      q.pending = null; q.busy = true; q.last = Date.now();
      conn.current.call('/draft', body).catch(() => {}).finally(() => { q.busy = false; flush(); });
    };
    flush();
  };
  const moveToken = (from, to) => {
    setMySplit((p) => {
      if (!p || p[from] <= 0) return p;
      const next = { ...p, [from]: p[from] - 1, [to]: p[to] + 1 };
      sendDraft(next);
      return next;
    });
  };

  // ----- what the responder sees: the other person's tokens, one at a time -----
  // The board follows the proposer's split as it arrives (live while they
  // move tokens, or all at once when the offer is already in, e.g. from a
  // computer or while the responder was still reading the last result), but
  // always replays it token by token, so the other person is seen deciding.
  const history = state ? state.history : [];
  const showingResult = history.length > acked;
  const watching = status === 'playing' && !!state && !iPropose && !showingResult;
  const offer = state ? state.offer : null;
  let target = null;
  if (state) {
    if (offer) target = { other: offer.proposerShare, pot: 0, me: offer.responderShare };
    else if (match.draft && match.draft.round === state.round) {
      const d = match.draft;
      target = { other: d.proposerShare, pot: state.tokens - d.proposerShare - d.responderShare, me: d.responderShare };
    } else target = EMPTY(state.tokens);
  }
  const [shown, setShown] = useState(null);
  const [flight, setFlight] = useState(null); // {from, to, key}
  const roundSeen = useRef({ key: null, at: 0 });
  const roundKey = `${matchId}:${round}`;
  if (watching && roundSeen.current.key !== roundKey) roundSeen.current = { key: roundKey, at: Date.now() };
  useEffect(() => {
    if (!state) return;
    setShown(EMPTY(state.tokens));
    setFlight(null);
  }, [matchId, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const same = (x, y) => !!x && !!y && x.other === y.other && x.me === y.me && x.pot === y.pot;
  useEffect(() => {
    if (!watching || flight || !shown || !target || same(shown, target)) return undefined;
    // next single move: take back first, then deal into a pile still short of its target
    let from = null; let to = null;
    if (shown.other > target.other) { from = 'other'; to = 'pot'; }
    else if (shown.me > target.me) { from = 'me'; to = 'pot'; }
    else {
      const short = ['other', 'me'].flatMap((k) => Array(Math.max(0, target[k] - shown[k])).fill(k));
      if (!short.length || shown.pot <= 0) return undefined;
      from = 'pot'; to = short[Math.floor(Math.random() * short.length)];
    }
    const gap = Math.abs(shown.other - target.other) + Math.abs(shown.me - target.me);
    const first = shown.pot === state.tokens && shown.other === 0 && shown.me === 0;
    // pace of the other person's hand: a pause before the first token, then
    // roughly 0.8 s per token (a little quicker when far behind a live split)
    const wait = first ? 1200 + Math.random() * 800 : (gap > 6 ? 150 : 300) + Math.random() * 300;
    const id = setTimeout(() => setFlight({ from, to, key: Date.now() }), wait);
    return () => clearTimeout(id);
  }, [watching, flight, shown, target && target.other, target && target.me, target && target.pot]); // eslint-disable-line react-hooks/exhaustive-deps

  const landFlight = () => {
    setShown((p) => (flight && p ? { ...p, [flight.from]: p[flight.from] - 1, [flight.to]: p[flight.to] + 1 } : p));
    setFlight(null);
  };

  // the offer can be answered once it is fully on the board and MIN_OFFER_MS have passed
  const [, setTick] = useState(0);
  const offerOnBoard = watching && !!offer && !flight && same(shown, target);
  const sinceSeen = Date.now() - roundSeen.current.at;
  const offerReady = offerOnBoard && sinceSeen >= MIN_OFFER_MS;
  useEffect(() => {
    if (!offerOnBoard || offerReady) return undefined;
    const id = setTimeout(() => setTick((n) => n + 1), MIN_OFFER_MS - sinceSeen + 20);
    return () => clearTimeout(id);
  }, [offerOnBoard, offerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- moves -----
  // Decision time starts when the participant can act: the proposer when the
  // board appears, the responder when Accept / Reject turn on.
  const myDecision = status === 'playing' && !showingResult && turn === me && (iPropose || offerReady);
  const decisionKey = state ? `${state.round}-${state.phase}` : null;
  if (myDecision && shownAt.current.key !== decisionKey) shownAt.current = { key: decisionKey, at: performance.now() };

  const send = async (move) => {
    setSending(true);
    try {
      await conn.current.call('/move', { matchId, move: { ...move, decisionMs: Math.round(performance.now() - shownAt.current.at) } });
    } catch (e) {
      if (e.code !== 'over' && e.code !== 'not-playing') { setError(e.message); }
    } finally {
      setSending(false);
    }
  };

  // ----- the end -----
  const ended = status === 'finished' || status === 'abandoned';
  const afterResults = () => {
    if (practice) {
      setPracticeSummary(playerSummary(state, me));
      setPractice(false);
      setMatchId(null);
      setMatch(null);
      setStage('practiceDone');
    } else if (config.debrief.show) {
      setStage('debrief');
    } else {
      setStage('ended');
    }
  };
  useEffect(() => {
    // abandoned matches (or a finished one whose last result was already seen) move on by themselves
    if (ended && !showingResult && (stage === 'playing')) afterResults();
  }, [ended, showingResult, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage === 'debrief' && debriefAt.current === null) {
      debriefAt.current = Date.now();
      conn.current.call('/debriefed', { matchId }).catch(() => {});
    }
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (opts = {}) => {
    const summary = state ? playerSummary(state, me, { bonusPerToken: config.bonusPerToken }) : null;
    onStore({
      view: content,
      response: {
        matched: !!state,
        matchId,
        ...(summary || { partnerKind: null }),
        waitMs: waitMs.current !== null ? waitMs.current : (waitStart.current ? Date.now() - waitStart.current : null),
        endReason: opts.endReason || (match && match.endReason) || (status === 'finished' ? 'completed' : status),
        debriefShown: debriefAt.current !== null,
        debriefShownAt: debriefAt.current,
        practice: practiceSummary,
        taskVersion: 2,
      },
    }, true);
  };

  const stopWaiting = async () => {
    await conn.current.call('/leave', { matchId }).catch(() => {});
    finish({ endReason: 'no-partner' });
  };

  // ----- rendering -----
  if (config.error) {
    return <L2Root dir={dir}><NoticeCard message={`Study file error: ${config.error}`} actionLabel={t('lens2.mp.continue')} onAction={() => onStore({ view: content, response: { error: config.error } }, true)} /></L2Root>;
  }

  const myTotal = state ? state.totals[me] : 0;
  const endMessage = status === 'abandoned'
    ? t(state && state.abandonedBy === me ? 'lens2.mp.you_left' : 'lens2.mp.partner_left')
    : t('lens2.mp.game_over', { total: myTotal });
  const header = state && stage === 'playing' && (
    <Header
      start={t(practice ? 'lens2.mp.practice_round' : 'lens2.mp.round', { round: Math.min(state.round + (showingResult ? 0 : 1), state.rounds), rounds: state.rounds })}
      end={t('lens2.mp.your_tokens', { total: myTotal })}
    />
  );

  let body = null;
  if (stage === 'intro') {
    body = (
      <>
        <div className="l2-card" style={{ marginBlockStart: 'auto' }}>
          <Text source={t(content.text || 'lens2.mp.intro', { tokens: config.tokens, rounds: config.rounds })} className="l2-body" />
        </div>
        <Button onClick={() => join(practice)} style={{ marginBlockEnd: 'auto' }}>{t('lens2.mp.start')}</Button>
      </>
    );
  } else if (stage === 'connecting') {
    body = <Waiting message={t('lens2.mp.connecting')} />;
  } else if (stage === 'error') {
    body = <NoticeCard message={t('lens2.mp.error')} actionLabel={t('lens2.mp.retry')} onAction={() => join(practice)} />;
  } else if (stage === 'finding') {
    body = waitedLong ? (
      <>
        <Waiting message={t('lens2.mp.still_looking')} />
        <Button variant="secondary" onClick={stopWaiting}>{t('lens2.mp.stop_waiting')}</Button>
      </>
    ) : <Waiting message={t('lens2.mp.finding')} hint={t('lens2.mp.finding_hint')} />;
  } else if (stage === 'practiceDone') {
    body = <NoticeCard message={t('lens2.mp.practice_done')} actionLabel={t('lens2.mp.start')} onAction={() => join(false)} />;
  } else if (stage === 'debrief') {
    body = (
      <>
        <div className="l2-card l2-mp-debrief" style={{ marginBlockStart: 'auto' }}>
          <Text source={endMessage} className="l2-body" />
          <Text source={t(match && match.partnerKind === 'bot' ? config.debrief.textBot : config.debrief.textHuman)} className="l2-body l2-mp-debrief-text" />
        </div>
        <Button onClick={() => finish()} style={{ marginBlockEnd: 'auto' }}>{t('lens2.mp.continue')}</Button>
      </>
    );
  } else if (stage === 'ended') {
    body = (
      <NoticeCard
        message={endMessage}
        actionLabel={t('lens2.mp.continue')}
        onAction={() => finish()}
      />
    );
  } else if (stage === 'playing' && state) {
    if (showingResult) {
      const h = history[acked];
      const mine = h.proposer === me ? h.proposerShare : h.responderShare;
      const theirs = h.proposer === me ? h.responderShare : h.proposerShare;
      const stands = state.game === 'dictator' || h.response === 'accept';
      const last = acked + 1 >= history.length && ended;
      const titleKey = state.game === 'dictator' ? 'lens2.mp.result.dg' : (stands ? 'lens2.mp.result.accepted' : 'lens2.mp.result.rejected');
      body = (
        <div className="l2-sheet l2-mp-result" role="dialog" aria-labelledby="mp-result-title">
          <h2 id="mp-result-title" className={`l2-sheet-title ${stands ? 'l2-tone-accent' : 'l2-tone-caution'}`}>{t(titleKey)}</h2>
          <div className="l2-sheet-stats">
            <div className="l2-stat-box">
              <span className="l2-stat-label">{t('lens2.mp.result.you_get')}</span>
              <span className={`l2-stat-value ${stands ? '' : 'l2-tone-caution'}`}>{h.earned[me]}</span>
            </div>
            <div className="l2-stat-box">
              <span className="l2-stat-label">{t('lens2.mp.result.other_gets')}</span>
              <span className="l2-stat-value">{h.earned[1 - me]}</span>
            </div>
          </div>
          {!stands && <p className="l2-hint">{t('lens2.mp.result.offer_was', { mine, theirs })}</p>}
          <Button onClick={() => { setAcked(acked + 1); if (last) afterResults(); }}>
            {last ? t('lens2.mp.continue') : t('lens2.mp.next_round')}
          </Button>
        </div>
      );
    } else if (ended) {
      body = null; // moving on (see effect above)
    } else {
      const tokens = state.tokens;
      let piles;
      if (iPropose) {
        piles = offer
          ? { other: offer.responderShare, pot: 0, me: offer.proposerShare }
          : (mySplit || EMPTY(tokens));
      } else {
        // the replayed board; while a coin is in the air it has left its pile
        piles = shown || EMPTY(tokens);
        if (flight) piles = { ...piles, [flight.from]: piles[flight.from] - 1 };
      }
      const proposing = iPropose && state.phase === 'propose';
      const responding = !iPropose && offerReady;
      const done = proposing && piles.pot === 0;

      body = (
        <>
          <Text
            source={t(iPropose ? 'lens2.mp.role_proposer' : 'lens2.mp.role_responder', { tokens })}
            className="l2-rule"
          />
          <Board piles={piles} onMove={proposing && !sending ? moveToken : undefined}
            flight={iPropose ? null : flight} onFlightDone={landFlight} t={t} />
          {proposing && (
            <Button onClick={() => done && send({ type: 'propose', proposerShare: piles.me, responderShare: piles.other })}
              disabled={!done || sending} variant={done ? 'primary' : 'secondary'}>
              {done ? t('lens2.mp.propose') : t('lens2.tokens.allocate_more', { count: piles.pot })}
            </Button>
          )}
          {iPropose && !proposing && (
            <div className="l2-matching" role="status"><span className="l2-spinner" aria-hidden="true" /><span>{t('lens2.mp.wait_respond')}</span></div>
          )}
          {!iPropose && (
            <div className="l2-mp-respond" role="status" aria-live="polite">
              {responding ? (
                <>
                  <Text source={t('lens2.mp.offer', { mine: offer.responderShare, theirs: offer.proposerShare })} className="l2-body" />
                  <p className="l2-hint">{t(state.game === 'dictator' ? 'lens2.mp.dg_respond' : 'lens2.mp.ug_respond')}</p>
                </>
              ) : (
                <div className="l2-matching"><span className="l2-spinner" aria-hidden="true" /><span>{t('lens2.mp.splitting')}</span></div>
              )}
              <div className="l2-mp-choices">
                <Button onClick={() => send({ type: 'respond', response: 'accept' })} disabled={!responding || sending}
                  variant={responding ? 'primary' : 'secondary'}>{t('lens2.mp.accept')}</Button>
                <Button variant="secondary" onClick={() => send({ type: 'respond', response: 'reject' })} disabled={!responding || sending}>{t('lens2.mp.reject')}</Button>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  return (
    <L2Root dir={dir}>
      {header}
      {body}
      {error && stage === 'playing' && <p className="l2-hint l2-hint-caution" role="alert">{t('lens2.mp.error')}</p>}
    </L2Root>
  );
}
