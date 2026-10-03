/**
 * TokenGame: shared Lens 2 screen for the dictator and ultimatum games.
 *
 * Same study-file options, opponent selection, scoring and data as the
 * classic games (src/dictator.js, src/ultimatum.js), which differ only in
 * scoring and in what the result shows. The response adds taskVersion: 2.
 *
 * Kept identical to classic:
 *  - opponents: `persons` (filtered by `opponentTypes` when `useOpponentTypes`),
 *    shuffled once at the start; round r (0-based) faces person r % count
 *  - tokens start in the middle pile and can move between any two piles;
 *    the round can only finish once the middle pile is empty
 *  - records: dictator {trial, playerShare, opponentShare, opponent};
 *    ultimatum adds {score, result}, accepted when the opponent's share is
 *    at least their `minAcceptable`. `trial` is 0-based, as classic.
 *  - taskStartedAt at the start, taskFinishedAt when the last result is dismissed
 *  - dictator: the result shows a "matching you with another person" wait
 *    (classic: 5 s) before Next unlocks; `matchmakingDelay` (ms) changes it,
 *    0 removes it
 *
 * Changed on purpose:
 *  - each person's tokens show as a pile on their card (classic: count only)
 *  - drag works the same with mouse and touch (pointer events, no library)
 *  - results rise as a sheet inside the task instead of a dialog
 *  - classic crashed when `useOpponentTypes` was true (a typo); fixed here
 *
 * Optional: "tapControls": true adds - / + buttons on each person's card,
 * for phones and keyboard users. It is a different way to respond, so it is
 * off by default and recorded in the echoed view.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { shuffle } from '../utils/random';
import { languages } from '../utils/i18n';
import { L2Root, Header, Text, Button, potHeight } from './components';

const PILES = ['opponent', 'pot', 'player'];
const CLASSIC_MATCHMAKING_MS = 5000;

function Coin({ small, dragging, ...rest }) {
  return <span className={`l2-coin ${small ? 'l2-coin-small' : ''} ${dragging ? 'l2-coin-dragging' : ''}`} aria-hidden="true" {...rest} />;
}

/**
 * @param {object} props
 * @param {'dictator'|'ultimatum'} props.game
 */
export default function TokenGame({ game, content, onStore }) {
  const {
    tokens, trials, useOpponentTypes, opponentTypes, text, personsPrefix, persons,
    dialogOptionalText, tapControls, matchmakingDelay,
  } = content;
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';
  const prefix = game; // i18n prefix for this game's strings

  // Opponents, shuffled once at the start (classic filters by tags only when asked)
  const [opponents] = useState(() => {
    const pool = useOpponentTypes === true
      ? persons.filter((p) => (p.tags || []).some((tag) => (opponentTypes || []).includes(tag)))
      : persons;
    return shuffle(pool);
  });
  const [taskStartedAt] = useState(() => Date.now());

  const [round, setRound] = useState(0);
  const [piles, setPiles] = useState({ opponent: 0, pot: tokens, player: 0 });
  const [records, setRecords] = useState([]);
  const [sheet, setSheet] = useState(null); // last record while its result shows
  const [matched, setMatched] = useState(true);

  const person = opponents.length ? opponents[round % opponents.length] : null;
  const personText = (field) => (person && person[field] ? t(`${personsPrefix}${person.id}.${person[field]}`) : '');
  const total = records.reduce((sum, r) => sum + (game === 'ultimatum' ? r.score : r.playerShare), 0);

  const move = (from, to) => {
    if (sheet || from === to) return;
    setPiles((p) => (p[from] > 0 ? { ...p, [from]: p[from] - 1, [to]: p[to] + 1 } : p));
  };

  // ----- drag with pointer events (mouse, pen and touch alike) -----
  const [drag, setDrag] = useState(null); // {from, x, y, over}
  const dragRef = useRef(null);
  dragRef.current = drag;
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
    if (sheet) return;
    e.preventDefault();
    setDrag({ from, x: e.clientX, y: e.clientY, over: from });
  };

  // ----- finishing a round -----
  const canFinish = piles.pot === 0;
  const finishRound = () => {
    if (!canFinish || sheet) return;
    const playerShare = piles.player;
    const opponentShare = tokens - playerShare;
    let record;
    if (game === 'ultimatum') {
      const accepted = !(person && person.minAcceptable > opponentShare);
      record = { trial: round, playerShare, opponentShare, score: accepted ? playerShare : 0, opponent: person, result: accepted ? 'accepted' : 'rejected' };
    } else {
      record = { trial: round, playerShare, opponentShare, opponent: person };
    }
    setRecords((rs) => [...rs, record]);
    setSheet(record);
    setPiles({ opponent: 0, pot: tokens, player: 0 });
    setMatched(game !== 'dictator');
  };

  // Dictator's "matching you with another person" wait before Next unlocks
  useEffect(() => {
    if (!sheet || game !== 'dictator') return undefined;
    const delay = typeof matchmakingDelay === 'number' ? matchmakingDelay : CLASSIC_MATCHMAKING_MS;
    const id = setTimeout(() => setMatched(true), delay);
    return () => clearTimeout(id);
  }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLast = sheet && sheet.trial >= trials - 1;
  const next = () => {
    if (!matched) return;
    if (isLast) {
      const now = Date.now();
      onStore({ view: content, response: { trials: records, taskStartedAt, taskFinishedAt: now, taskDuration: now - taskStartedAt, taskVersion: 2 } }, true);
      return;
    }
    setSheet(null);
    setRound((r) => r + 1);
  };

  // ----- rendering -----
  const renderPile = (pile, count) => (
    <div className="l2-pile" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Coin key={i} small onPointerDown={startDrag(pile)} dragging={drag && drag.from === pile && i === count - 1} />
      ))}
      {count === 0 && <span className="l2-pile-empty">{t('lens2.tokens.drop_here')}</span>}
    </div>
  );

  const pileClass = (pile) => [
    'l2-person',
    drag && drag.from !== pile ? 'l2-drop-ok' : '',
    drag && drag.over === pile && drag.from !== pile ? 'l2-drop-over' : '',
  ].join(' ');

  const stepper = (pile, name) => tapControls === true && (
    <div className="l2-stepper">
      <button type="button" className="l2-step" onClick={() => move(pile, 'pot')} disabled={piles[pile] === 0 || !!sheet}
        aria-label={t('lens2.tokens.take_back', { name })}>−</button>
      <button type="button" className="l2-step" onClick={() => move('pot', pile)} disabled={piles.pot === 0 || !!sheet}
        aria-label={t('lens2.tokens.give', { name })}>+</button>
    </div>
  );

  const name = personText('field1');
  const initials = name ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
  const remaining = piles.pot;
  const ultimatumAccepted = sheet && sheet.result === 'accepted';

  return (
    <L2Root dir={dir}>
      <Header
        start={t(`${prefix}.trial_label`, { trial: round + 1, trials })}
        end={t(`${prefix}.total_points`, { score: total })}
      />
      <Text source={t(text)} className="l2-rule" />

      <div className="l2-token-area">
        {/* The other person */}
        <div className={pileClass('opponent')} data-pile="opponent">
          <div className="l2-person-head">
            {person && person.avatar
              ? <img className="l2-avatar" src={`${process.env.PUBLIC_URL}/images/${person.avatar}`} alt="" />
              : <div className="l2-avatar l2-avatar-initials" aria-hidden="true">{initials}</div>}
            <div className="l2-person-text">
              <span className="l2-person-name">{name}</span>
              {personText('field2') && <span className="l2-person-sub">{personText('field2')}</span>}
              {personText('field3') && <span className="l2-person-sub">{personText('field3')}</span>}
            </div>
            <span className="l2-count" aria-label={t('lens2.tokens.count', { count: piles.opponent })}>{piles.opponent}</span>
          </div>
          <div className="l2-tray">
            {renderPile('opponent', piles.opponent)}
            {stepper('opponent', name)}
          </div>
        </div>

        {/* The middle pile */}
        <div className={`l2-pot ${drag && drag.from !== 'pot' ? 'l2-drop-ok' : ''} ${drag && drag.over === 'pot' && drag.from !== 'pot' ? 'l2-drop-over' : ''}`} data-pile="pot">
          <span className="l2-pot-label">{t(`dictator.pot`)}: <strong>{remaining}</strong></span>
          <div className="l2-pile l2-pile-large" aria-hidden="true" style={potHeight(tokens)}>
            {Array.from({ length: remaining }, (_, i) => (
              <Coin key={i} onPointerDown={startDrag('pot')} dragging={drag && drag.from === 'pot' && i === remaining - 1} />
            ))}
            {remaining === 0 && <span className="l2-pile-empty">{t('lens2.tokens.all_placed')}</span>}
          </div>
          <span className="l2-hint-small">{t(tapControls === true ? 'lens2.tokens.drag_or_tap' : 'lens2.tokens.drag')}</span>
        </div>

        {/* The participant */}
        <div className={pileClass('player')} data-pile="player">
          <div className="l2-person-head">
            <div className="l2-avatar l2-avatar-you" aria-hidden="true">{t('lens2.tokens.you')}</div>
            <div className="l2-person-text"><span className="l2-person-name">{t('dictator.player')}</span></div>
            <span className="l2-count" aria-label={t('lens2.tokens.count', { count: piles.player })}>{piles.player}</span>
          </div>
          <div className="l2-tray">
            {renderPile('player', piles.player)}
            {stepper('player', t('lens2.tokens.you'))}
          </div>
        </div>

        {sheet && (
          <div className="l2-sheet" role="dialog" aria-labelledby="l2-sheet-title">
            <div className="l2-sheet-grip" aria-hidden="true" />
            {game === 'ultimatum' ? (
              <>
                <h2 id="l2-sheet-title" className={`l2-sheet-title ${ultimatumAccepted ? 'l2-tone-accent' : 'l2-tone-caution'}`}>
                  {t(ultimatumAccepted ? 'ultimatum.dialog_title.accepted' : 'ultimatum.dialog_title.rejected')}
                </h2>
                <div className="l2-sheet-stats">
                  <div className="l2-stat-box">
                    <span className="l2-stat-label">{t('lens2.tokens.this_round')}</span>
                    <span className={`l2-stat-value ${ultimatumAccepted ? '' : 'l2-tone-caution'}`}>{sheet.score}</span>
                  </div>
                  <div className="l2-stat-box">
                    <span className="l2-stat-label">{t('lens2.tokens.total')}</span>
                    <span className="l2-stat-value">{total}</span>
                  </div>
                </div>
                {!isLast && dialogOptionalText && <Text source={t(dialogOptionalText)} className="l2-body l2-sheet-note" />}
              </>
            ) : (
              <>
                <h2 id="l2-sheet-title" className="l2-sheet-title l2-tone-accent">{t('dictator.dialog_title')}</h2>
                <div className="l2-sheet-stats">
                  <div className="l2-stat-box">
                    <span className="l2-stat-label">{t('lens2.tokens.this_round')}</span>
                    <span className="l2-stat-value">{sheet.playerShare}</span>
                  </div>
                  <div className="l2-stat-box">
                    <span className="l2-stat-label">{t('lens2.tokens.total')}</span>
                    <span className="l2-stat-value">{total}</span>
                  </div>
                </div>
                <div className="l2-matching" role="status">
                  {matched
                    ? <span>{t('dictator.matchmaking_result')}</span>
                    : <><span className="l2-spinner" aria-hidden="true" /><span>{t('dictator.waiting_for_opponent')}</span></>}
                </div>
              </>
            )}
            <Button onClick={next} disabled={!matched}>
              {isLast ? t('next') : t(`${prefix}.next_trial`)}
            </Button>
          </div>
        )}
      </div>

      {!sheet && (
        <Button onClick={finishRound} disabled={!canFinish} className={`l2-btn ${canFinish ? 'l2-btn-primary' : 'l2-btn-secondary'}`}>
          {canFinish ? t(`${prefix}.finish.button`) : t('lens2.tokens.allocate_more', { count: remaining })}
        </Button>
      )}

      {drag && <span className="l2-coin l2-coin-ghost" aria-hidden="true" style={{ left: drag.x - 22, top: drag.y - 22 }} />}
    </L2Root>
  );
}
