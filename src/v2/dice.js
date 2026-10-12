/**
 * Dice allocation task, Lens 2 ("type": "dice").
 *
 * Based on the dice prototype Morteza Ansarinia built in Cut (2018), which
 * was never finished. Each round:
 *   1. The participant decides privately which die (blue or orange) is
 *      theirs and which is the other person's. The choice is not recorded.
 *   2. They roll both dice.
 *   3. They give each die to a person (drag it onto a card, or tap the die
 *      and then the card). Each person gets exactly one die, worth its face
 *      value in points.
 * Honest allocation gives the participant the higher die in about half the
 * rounds with unequal dice; a higher share suggests self-serving allocation.
 * It can only be read in aggregate, since the private choice is not known.
 *
 * Opponents are persons, as in the dictator and ultimatum games
 * (tokenGame.js): filtered by `opponentTypes` when `useOpponentTypes`,
 * shuffled once, and round r faces person r % count.
 *
 * Study-file options: trials (rounds), text (rule above the board),
 * persons/personsPrefix/useOpponentTypes/opponentTypes, bonusPerPoint
 * (optional; records the bonus), rolls (optional fixed [blue, orange] values
 * for the first rounds; later rounds are random).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { shuffle } from '../utils/random';
import { languages } from '../utils/i18n';
import { L2Root, Header, Text, Button } from './components';

export const DICE = ['blue', 'orange'];
const ROLL_MS = 900;
const other = (die) => (die === 'blue' ? 'orange' : 'blue');
const SLOT_OTHER = 'other';
const SLOT_SELF = 'self';

/** Face value for each die this round: fixed from the study file when given, otherwise random. */
export function rollFor(round, rolls, random = Math.random) {
  const fixed = Array.isArray(rolls) && rolls[round];
  if (fixed) return { values: { blue: fixed[0], orange: fixed[1] }, source: 'fixed' };
  const face = () => Math.floor(random() * 6) + 1;
  return { values: { blue: face(), orange: face() }, source: 'random' };
}

/** Totals over the recorded rounds. */
export function summarize(records, bonusPerPoint) {
  const selfTotal = records.reduce((s, r) => s + r.selfPoints, 0);
  const otherTotal = records.reduce((s, r) => s + r.otherPoints, 0);
  const unequal = records.filter((r) => r.selfPoints !== r.otherPoints);
  const selfHigherRounds = unequal.filter((r) => r.selfPoints > r.otherPoints).length;
  const out = {
    selfTotal,
    otherTotal,
    unequalRounds: unequal.length,
    selfHigherRounds,
    selfHigherShare: unequal.length ? selfHigherRounds / unequal.length : null,
  };
  if (typeof bonusPerPoint === 'number') out.bonus = Math.round(selfTotal * bonusPerPoint * 100) / 100;
  return out;
}

const PIPS = {
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
};

function DieFace({ color, value, rolling, selected, dragging, label, ...rest }) {
  return (
    <button
      type="button"
      className={`l2-die l2-die-${color} ${rolling ? 'is-rolling' : ''} ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''}`}
      aria-label={label}
      aria-pressed={selected || undefined}
      {...rest}
    >
      <span className="l2-die-grid" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={value && PIPS[value].includes(i + 1) ? 'l2-pip' : ''} />
        ))}
      </span>
    </button>
  );
}

export default function Dice({ content, onStore }) {
  const {
    trials, text, persons = [], personsPrefix = '', useOpponentTypes, opponentTypes, bonusPerPoint, rolls,
  } = content;
  const { t } = useTranslation();
  const { lang } = useParams();
  const dir = (languages[lang] && languages[lang].direction) || 'ltr';

  const [opponents] = useState(() => {
    const pool = useOpponentTypes === true
      ? persons.filter((p) => (p.tags || []).some((tag) => (opponentTypes || []).includes(tag)))
      : persons;
    return shuffle(pool);
  });
  const [taskStartedAt] = useState(() => Date.now());

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('decide'); // decide → rolling → allocate → result
  const [values, setValues] = useState({ blue: null, orange: null });
  const [rollSource, setRollSource] = useState(null);
  const [shown, setShown] = useState({ blue: 1, orange: 1 }); // faces while rolling
  const [placement, setPlacement] = useState(null); // {self: die, other: die}
  const [selected, setSelected] = useState(null); // die picked by tap
  const [changes, setChanges] = useState(0);
  const [records, setRecords] = useState([]);
  const times = useRef({ shownAt: Date.now(), rollAt: null, landedAt: null });

  const person = opponents.length ? opponents[round % opponents.length] : null;
  const personText = (field) => (person && person[field] ? t(`${personsPrefix}${person.id}.${person[field]}`) : '');
  const name = personText('field1') || t('lens2.dice.other_person');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const selfTotal = records.reduce((s, r) => s + r.selfPoints, 0);
  const last = records.length ? records[records.length - 1] : null;
  const isLastRound = round >= trials - 1;

  // ----- rolling -----
  const roll = () => {
    if (phase !== 'decide') return;
    const { values: v, source } = rollFor(round, rolls);
    times.current.rollAt = Date.now();
    setValues(v);
    setRollSource(source);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { land(); return; }
    setPhase('rolling');
  };
  const land = () => {
    times.current.landedAt = Date.now();
    setPhase('allocate');
  };
  useEffect(() => {
    if (phase !== 'rolling') return undefined;
    const tick = setInterval(() => setShown({ blue: 1 + Math.floor(Math.random() * 6), orange: 1 + Math.floor(Math.random() * 6) }), 90);
    const done = setTimeout(land, ROLL_MS);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- allocating -----
  const place = (die, slot) => {
    if (phase !== 'allocate') return;
    const next = slot === SLOT_SELF ? { self: die, other: other(die) } : { self: other(die), other: die };
    // `changes` counts how often a placement was reversed before Done
    if (placement && placement.self !== next.self) setChanges((c) => c + 1);
    setPlacement(next);
    setSelected(null);
  };
  const tapDie = (die) => {
    if (phase !== 'allocate') return;
    setSelected((s) => (s === die ? null : die));
  };
  const tapSlot = (slot) => { if (selected) place(selected, slot); };

  // drag with pointer events, as in the token games
  const [drag, setDrag] = useState(null); // {die, x, y, over, moved}
  const dragRef = useRef(null);
  dragRef.current = drag;
  useEffect(() => {
    if (!drag) return undefined;
    const slotAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const box = el && el.closest('[data-slot]');
      return box ? box.getAttribute('data-slot') : null;
    };
    const onMove = (e) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, over: slotAt(e.clientX, e.clientY), moved: d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6 });
    const onUp = (e) => {
      const d = dragRef.current;
      if (d && d.moved) {
        const target = slotAt(e.clientX, e.clientY);
        if (target) place(d.die, target);
      } else if (d) {
        tapDie(d.die);
      }
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

  const startDrag = (die) => (e) => {
    if (phase !== 'allocate') return;
    e.preventDefault();
    setDrag({ die, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, over: null, moved: false });
  };

  // ----- finishing a round -----
  const done = () => {
    if (phase !== 'allocate' || !placement) return;
    const now = Date.now();
    const record = {
      round: round + 1,
      opponent: person,
      dice: { ...values },
      selfDie: placement.self,
      otherDie: placement.other,
      selfPoints: values[placement.self],
      otherPoints: values[placement.other],
      changes,
      rollSource,
      decideMs: times.current.rollAt - times.current.shownAt,
      allocateMs: now - times.current.landedAt,
    };
    setRecords((rs) => [...rs, record]);
    setPhase('result');
  };

  const next = () => {
    if (isLastRound) {
      const now = Date.now();
      onStore({
        view: content,
        response: {
          trials: records,
          ...summarize(records, bonusPerPoint),
          taskStartedAt, taskFinishedAt: now, taskDuration: now - taskStartedAt, taskVersion: 2,
        },
      }, true);
      return;
    }
    setRound((r) => r + 1);
    setPhase('decide');
    setValues({ blue: null, orange: null });
    setPlacement(null);
    setSelected(null);
    setChanges(0);
    times.current = { shownAt: Date.now(), rollAt: null, landedAt: null };
  };

  // ----- rendering -----
  const dieLabel = (die) => {
    const v = phase === 'rolling' ? null : values[die];
    return v ? t('lens2.dice.die_value', { die: t(`lens2.dice.${die}`), value: v }) : t(`lens2.dice.${die}`);
  };
  const renderDie = (die) => (
    <DieFace
      key={die}
      color={die}
      value={phase === 'decide' ? null : (phase === 'rolling' ? shown[die] : values[die])}
      rolling={phase === 'rolling'}
      selected={selected === die}
      dragging={drag && drag.moved && drag.die === die}
      label={dieLabel(die)}
      disabled={phase !== 'allocate'}
      onPointerDown={startDrag(die)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapDie(die); } }}
    />
  );
  const slotDie = (slot) => (placement ? placement[slot] : null);
  const slotClass = (slot) => [
    'l2-person', 'l2-dice-person',
    (selected || (drag && drag.moved)) ? 'l2-drop-ok' : '',
    drag && drag.moved && drag.over === slot ? 'l2-drop-over' : '',
  ].join(' ');
  const slotProps = (slot, who) => ({
    'data-slot': slot,
    className: slotClass(slot),
    onClick: () => tapSlot(slot),
    role: selected ? 'button' : undefined,
    tabIndex: selected ? 0 : undefined,
    'aria-label': selected ? t('lens2.dice.give_to', { die: t(`lens2.dice.${selected}`), name: who }) : undefined,
    onKeyDown: selected ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapSlot(slot); } } : undefined,
  });
  const tableDice = DICE.filter((d) => !placement || (placement.self !== d && placement.other !== d));

  let status;
  if (phase === 'decide') status = t('lens2.dice.decide', { name });
  else if (phase === 'rolling') status = t('lens2.dice.rolling');
  else if (phase === 'allocate') status = placement ? t('lens2.dice.placed') : t('lens2.dice.allocate');
  else status = '';

  return (
    <L2Root dir={dir}>
      <Header
        start={t('lens2.dice.round', { round: round + 1, rounds: trials })}
        end={t('lens2.dice.your_points', { points: selfTotal })}
      />
      <Text source={t(text || 'lens2.dice.rule')} className="l2-rule" />

      <div className="l2-token-area">
        <div {...slotProps(SLOT_OTHER, name)}>
          <div className="l2-person-head">
            {person && person.avatar
              ? <img className="l2-avatar" src={`${process.env.PUBLIC_URL}/images/${person.avatar}`} alt="" />
              : <div className="l2-avatar l2-avatar-initials" aria-hidden="true">{initials}</div>}
            <div className="l2-person-text">
              <span className="l2-person-name">{name}</span>
              {personText('field2') && <span className="l2-person-sub">{personText('field2')}</span>}
              {personText('field3') && <span className="l2-person-sub">{personText('field3')}</span>}
            </div>
            <div className="l2-dice-slot">{slotDie(SLOT_OTHER) && renderDie(slotDie(SLOT_OTHER))}</div>
          </div>
        </div>

        <div className="l2-dice-table">
          <div className="l2-dice-row" dir="ltr">{tableDice.map(renderDie)}</div>
          <p className="l2-dice-status" role="status">{status}</p>
        </div>

        <div {...slotProps(SLOT_SELF, t('lens2.tokens.you'))}>
          <div className="l2-person-head">
            <div className="l2-avatar l2-avatar-you" aria-hidden="true">{t('lens2.tokens.you')}</div>
            <div className="l2-person-text"><span className="l2-person-name">{t('lens2.dice.you')}</span></div>
            <div className="l2-dice-slot">{slotDie(SLOT_SELF) && renderDie(slotDie(SLOT_SELF))}</div>
          </div>
        </div>

        {phase === 'result' && last && (
          <div className="l2-sheet" role="dialog" aria-labelledby="l2-dice-sheet-title">
            <div className="l2-sheet-grip" aria-hidden="true" />
            <h2 id="l2-dice-sheet-title" className="l2-sheet-title l2-tone-accent">
              {t('lens2.dice.result_title', { points: last.selfPoints })}
            </h2>
            <div className="l2-sheet-stats">
              <div className="l2-stat-box">
                <span className="l2-stat-label">{t('lens2.dice.they_got', { name })}</span>
                <span className="l2-stat-value">{last.otherPoints}</span>
              </div>
              <div className="l2-stat-box">
                <span className="l2-stat-label">{t('lens2.tokens.total')}</span>
                <span className="l2-stat-value">{selfTotal}</span>
              </div>
            </div>
            <Button onClick={next}>{isLastRound ? t('next') : t('lens2.dice.next_round')}</Button>
          </div>
        )}
      </div>

      {phase !== 'result' && (
        phase === 'allocate'
          ? <Button onClick={done} disabled={!placement} className={`l2-btn ${placement ? 'l2-btn-primary' : 'l2-btn-secondary'}`}>{t('lens2.dice.done')}</Button>
          : <Button onClick={roll} disabled={phase !== 'decide'}>{t('lens2.dice.roll')}</Button>
      )}

      {drag && drag.moved && (
        <span className={`l2-die l2-die-${drag.die} l2-die-ghost`} aria-hidden="true" style={{ left: drag.x - 32, top: drag.y - 32 }}>
          <span className="l2-die-grid">
            {Array.from({ length: 9 }, (_, i) => <span key={i} className={values[drag.die] && PIPS[values[drag.die]].includes(i + 1) ? 'l2-pip' : ''} />)}
          </span>
        </span>
      )}
    </L2Root>
  );
}
