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
 * The partner is shown the same way whether a person or a computer; the
 * debrief afterwards says which it was (textBot / textHuman).
 *
 * Stored response: the engine's playerSummary for this participant (rounds
 * from their side, totals, bonus, partnerKind, partnerStrategy, decision
 * times) plus matchId, how long they waited for a partner, whether and when
 * the debrief was shown, why the match ended, the practice summary, and
 * taskVersion: 2.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { languages } from '../utils/i18n';
import { L2Root, Header, Text, Button, NoticeCard } from './components';
import { normalizeConfig } from '../multiplayer/config';
import { whoseTurn, playerSummary } from '../multiplayer/engine';
import { connect } from '../multiplayer/client';
import './multiplayer.css';

const HEARTBEAT_MS = 10000;
const STALE_MS = 30000; // matches the server: a partner silent this long has gone

function Coin({ small, dragging, ...rest }) {
  return <span className={`l2-coin ${small ? 'l2-coin-small' : ''} ${dragging ? 'l2-coin-dragging' : ''}`} aria-hidden="true" {...rest} />;
}

/** Splitting tokens between the participant and the other person: drag, or + and −. */
function TokenSplit({ tokens, disabled, onSubmit, t }) {
  const [piles, setPiles] = useState({ other: 0, pot: tokens, me: 0 });
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  dragRef.current = drag;

  const move = (from, to) => {
    if (disabled || from === to) return;
    setPiles((p) => (p[from] > 0 ? { ...p, [from]: p[from] - 1, [to]: p[to] + 1 } : p));
  };

  useEffect(() => {
    if (!drag) return undefined;
    const pileAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const box = el && el.closest('[data-pile]');
      return box ? box.getAttribute('data-pile') : null;
    };
    const onMove = (e) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over: pileAt(e.clientX, e.clientY) });
    const onUp = (e) => {
      const d = dragRef.current;
      const target = pileAt(e.clientX, e.clientY);
      if (d && target && target !== d.from) move(d.from, target);
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (from) => (e) => {
    if (disabled) return;
    e.preventDefault();
    setDrag({ from, x: e.clientX, y: e.clientY, over: from });
  };

  const pile = (name, count) => (
    <div className="l2-pile" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Coin key={i} small onPointerDown={startDrag(name)} dragging={drag && drag.from === name && i === count - 1} />
      ))}
      {count === 0 && <span className="l2-pile-empty">{t('lens2.tokens.drop_here')}</span>}
    </div>
  );
  const pileClass = (name) => ['l2-person', drag && drag.from !== name ? 'l2-drop-ok' : '', drag && drag.over === name && drag.from !== name ? 'l2-drop-over' : ''].join(' ');
  const stepper = (name, label) => (
    <div className="l2-stepper">
      <button type="button" className="l2-step" onClick={() => move(name, 'pot')} disabled={disabled || piles[name] === 0}
        aria-label={t('lens2.tokens.take_back', { name: label })}>−</button>
      <button type="button" className="l2-step" onClick={() => move('pot', name)} disabled={disabled || piles.pot === 0}
        aria-label={t('lens2.tokens.give', { name: label })}>+</button>
    </div>
  );
  const other = t('lens2.mp.other');
  const done = piles.pot === 0;

  return (
    <>
      <div className="l2-token-area">
        <div className={pileClass('other')} data-pile="other">
          <div className="l2-person-head">
            <div className="l2-avatar l2-avatar-initials" aria-hidden="true">?</div>
            <div className="l2-person-text"><span className="l2-person-name">{other}</span></div>
            <span className="l2-count" aria-label={t('lens2.tokens.count', { count: piles.other })}>{piles.other}</span>
          </div>
          <div className="l2-tray">{pile('other', piles.other)}{stepper('other', other)}</div>
        </div>

        <div className={`l2-pot ${drag && drag.from !== 'pot' ? 'l2-drop-ok' : ''} ${drag && drag.over === 'pot' && drag.from !== 'pot' ? 'l2-drop-over' : ''}`} data-pile="pot">
          <div className="l2-pile l2-pile-large" aria-hidden="true">
            {Array.from({ length: piles.pot }, (_, i) => (
              <Coin key={i} onPointerDown={startDrag('pot')} dragging={drag && drag.from === 'pot' && i === piles.pot - 1} />
            ))}
            {piles.pot === 0 && <span className="l2-pile-empty">{t('lens2.tokens.all_placed')}</span>}
          </div>
          <span className="l2-hint-small">{t('lens2.tokens.drag_or_tap')}</span>
        </div>

        <div className={pileClass('me')} data-pile="me">
          <div className="l2-person-head">
            <div className="l2-avatar l2-avatar-you" aria-hidden="true">{t('lens2.tokens.you')}</div>
            <div className="l2-person-text"><span className="l2-person-name">{t('lens2.tokens.you')}</span></div>
            <span className="l2-count" aria-label={t('lens2.tokens.count', { count: piles.me })}>{piles.me}</span>
          </div>
          <div className="l2-tray">{pile('me', piles.me)}{stepper('me', t('lens2.tokens.you'))}</div>
        </div>
      </div>
      <Button onClick={() => done && onSubmit(piles.me, piles.other)} disabled={!done || disabled}
        variant={done ? 'primary' : 'secondary'}>
        {done ? t('lens2.mp.propose') : t('lens2.tokens.allocate_more', { count: piles.pot })}
      </Button>
      {drag && <span className="l2-coin l2-coin-ghost" aria-hidden="true" style={{ left: drag.x - 22, top: drag.y - 22 }} />}
    </>
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

  // ----- while playing: let a computer partner move; end the match if a person goes silent -----
  const turn = state ? whoseTurn(state) : null;
  const partnerIsBot = state ? state.players[1 - me].kind === 'bot' : false;
  const serverToLocal = (ts) => ts + (skew.current || 0);

  useEffect(() => {
    if (status !== 'playing' || !match.botDueAt) return undefined;
    let timer;
    let tries = 0;
    const tick = () => conn.current.call('/tick', { matchId }).then((r) => {
      if (!r.moved && tries++ < 20) timer = setTimeout(tick, 400);
    }).catch(() => { if (tries++ < 20) timer = setTimeout(tick, 1000); });
    timer = setTimeout(tick, Math.max(0, serverToLocal(match.botDueAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [status, match && match.botDueAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'playing' || turn === null || turn === me || partnerIsBot || !match.turnStartedAt) return undefined;
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
    if (status !== 'playing' || partnerIsBot) return undefined;
    const check = setInterval(() => {
      const m = matchRef.current;
      const seen = m && m.lastSeen ? m.lastSeen[1 - me] : null;
      if (seen && serverToLocal(seen) + STALE_MS + 1000 < Date.now()) {
        conn.current.call('/timeout', { matchId }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(check);
  }, [status, partnerIsBot]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ----- moves -----
  const history = state ? state.history : [];
  const showingResult = history.length > acked;
  const myDecision = status === 'playing' && !showingResult && turn === me;
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
    } else if (turn === me && state.phase === 'propose') {
      body = (
        <>
          <Text source={t('lens2.mp.propose_title', { tokens: state.tokens })} className="l2-rule" />
          <TokenSplit key={state.round} tokens={state.tokens} disabled={sending}
            onSubmit={(mine, theirs) => send({ type: 'propose', proposerShare: mine, responderShare: theirs })} t={t} />
        </>
      );
    } else if (turn === me) {
      const { proposerShare, responderShare } = state.offer;
      body = (
        <>
          <div className="l2-card l2-mp-offer">
            <Text source={t('lens2.mp.offer', { mine: responderShare, theirs: proposerShare })} className="l2-body" />
            <p className="l2-hint">{t(state.game === 'dictator' ? 'lens2.mp.dg_respond' : 'lens2.mp.ug_respond')}</p>
          </div>
          <div className="l2-mp-choices">
            <Button onClick={() => send({ type: 'respond', response: 'accept' })} disabled={sending}>{t('lens2.mp.accept')}</Button>
            <Button variant="secondary" onClick={() => send({ type: 'respond', response: 'reject' })} disabled={sending}>{t('lens2.mp.reject')}</Button>
          </div>
        </>
      );
    } else {
      body = <Waiting message={t(state.phase === 'propose' ? 'lens2.mp.wait_propose' : 'lens2.mp.wait_respond')} />;
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
