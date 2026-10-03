/**
 * Study-file options for the multiplayer ultimatum and dictator games, with
 * their defaults. `normalizeConfig(view)` fills in defaults and rejects
 * settings that can't work, so the engine and the screen never have to guess.
 *
 * The same options are described for study authors in
 * schema/study.schema.json ($defs/multiplayer).
 *
 * Plain JavaScript with no React or browser APIs, so the same code can run
 * in the participant's browser and on a server that checks moves.
 */

export const GAMES = ['ultimatum', 'dictator'];
export const STRATEGIES = ['fair', 'rational', 'hyperRational', 'simple'];

export const DEFAULTS = {
  rounds: 1,
  // Who proposes first: "random" (as Cut), "participant" or "partner".
  // With two humans, "participant" means the first to arrive (the host).
  firstProposer: 'random',
  // "alternate": proposer and responder swap every round (as Cut).
  // "fixed": the first proposer proposes in every round.
  roles: 'alternate',
  practiceRounds: 0,
  matching: {
    // How long to wait for another participant before falling back to a bot (ms).
    timeout: 30000,
    // false: never use a bot; the participant keeps waiting.
    botFallback: true,
  },
  bot: {
    strategy: 'fair',
    // Bots wait before each move so the pace feels like a person's (ms).
    initialDelay: 1000,
    reactionDelay: 1000,
  },
  debrief: {
    show: true,
    textBot: 'multiplayer.debrief.bot',
    textHuman: 'multiplayer.debrief.human',
  },
  // Optional: money per token, for computing Prolific bonuses.
  bonusPerToken: null,
};

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

const isInt = (n) => Number.isInteger(n);

/** Returns a complete config, or throws ConfigError explaining what's wrong. */
export function normalizeConfig(view) {
  const v = view || {};
  if (!GAMES.includes(v.game)) throw new ConfigError(`"game" must be one of ${GAMES.join(', ')}`);
  if (!isInt(v.tokens) || v.tokens < 1) throw new ConfigError('"tokens" must be a whole number of at least 1');

  const config = {
    game: v.game,
    tokens: v.tokens,
    rounds: v.rounds ?? DEFAULTS.rounds,
    firstProposer: v.firstProposer ?? DEFAULTS.firstProposer,
    roles: v.roles ?? DEFAULTS.roles,
    practiceRounds: v.practiceRounds ?? DEFAULTS.practiceRounds,
    matching: { ...DEFAULTS.matching, ...(v.matching || {}) },
    bot: { ...DEFAULTS.bot, ...(v.bot || {}) },
    debrief: { ...DEFAULTS.debrief, ...(v.debrief || {}) },
    bonusPerToken: v.bonusPerToken ?? DEFAULTS.bonusPerToken,
  };

  if (!isInt(config.rounds) || config.rounds < 1) throw new ConfigError('"rounds" must be a whole number of at least 1');
  if (!isInt(config.practiceRounds) || config.practiceRounds < 0) throw new ConfigError('"practiceRounds" must be 0 or more');
  if (!['random', 'participant', 'partner'].includes(config.firstProposer)) {
    throw new ConfigError('"firstProposer" must be "random", "participant" or "partner"');
  }
  if (!['alternate', 'fixed'].includes(config.roles)) throw new ConfigError('"roles" must be "alternate" or "fixed"');
  if (!STRATEGIES.includes(config.bot.strategy)) throw new ConfigError(`"bot.strategy" must be one of ${STRATEGIES.join(', ')}`);
  for (const k of ['initialDelay', 'reactionDelay']) {
    if (!isInt(config.bot[k]) || config.bot[k] < 0) throw new ConfigError(`"bot.${k}" must be 0 or more milliseconds`);
  }
  if (!isInt(config.matching.timeout) || config.matching.timeout < 0) throw new ConfigError('"matching.timeout" must be 0 or more milliseconds');
  if (config.bonusPerToken !== null && !(typeof config.bonusPerToken === 'number' && config.bonusPerToken >= 0)) {
    throw new ConfigError('"bonusPerToken" must be a number of 0 or more');
  }

  // The "simple" bot only knows how to respond (as in Cut), so it must never
  // be the proposer: the participant proposes first and roles stay fixed.
  if (config.bot.strategy === 'simple' && (config.firstProposer !== 'participant' || (config.roles === 'alternate' && config.rounds > 1))) {
    throw new ConfigError('the "simple" bot only responds: set "firstProposer": "participant", and "roles": "fixed" if there is more than one round');
  }
  return config;
}
