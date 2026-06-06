/*
  team-moves.js — Battle move selection for the teams/battle arena.
  Picks the best damaging moves for each Pokemon using PokeAPI data,
  ensuring at least one STAB move per type.
  Depends on: supabase-client.js (none directly)
  Loads before teams.js.
  Note: titleCase and other UI helpers are defined in teams.js and available at runtime.
*/

const moveDetailsCache = new Map();
const pokemonApiCache = new Map();

// Same version/method priority as the generator (moves.js), kept local to avoid coupling.
const BATTLE_MOVE_VERSION_PRIORITY = [
  "scarlet-violet",
  "sword-shield",
  "ultra-sun-ultra-moon",
  "sun-moon",
  "omega-ruby-alpha-sapphire",
  "x-y",
  "black-2-white-2",
];

const BATTLE_MOVE_LEARN_METHOD_PRIORITY = {
  "level-up": 0,
  machine: 1,
  tutor: 2,
};

function getBattleBestLearnDetail(versionDetails = []) {
  let best = null;

  versionDetails.forEach((detail) => {
    const method = detail?.move_learn_method?.name || "";
    if (!(method in BATTLE_MOVE_LEARN_METHOD_PRIORITY)) return;

    const version = detail?.version_group?.name || "";
    const versionRank = BATTLE_MOVE_VERSION_PRIORITY.indexOf(version);
    const safeVersionRank = versionRank === -1 ? 999 : versionRank;
    const methodRank = BATTLE_MOVE_LEARN_METHOD_PRIORITY[method];
    const level = Number(detail?.level_learned_at || 0);
    const candidate = { versionRank: safeVersionRank, methodRank, level };

    if (!best) {
      best = candidate;
      return;
    }
    if (candidate.versionRank < best.versionRank) {
      best = candidate;
      return;
    }
    if (candidate.versionRank === best.versionRank && candidate.methodRank < best.methodRank) {
      best = candidate;
      return;
    }
    if (
      candidate.versionRank === best.versionRank &&
      candidate.methodRank === best.methodRank &&
      candidate.level > best.level
    ) {
      best = candidate;
    }
  });

  return best;
}

function fallbackMoveSet(monTypes) {
  const primary = monTypes[0] || "normal";
  // titleCase is defined in teams.js — available at runtime after teams.js loads
  const typeLabel = typeof titleCase === "function" ? titleCase(primary) : primary;
  return [
    { name: "Tackle", power: 40, type: "normal", accuracy: 100, category: "physical" },
    { name: "Swift", power: 60, type: "normal", accuracy: 100, category: "special" },
    { name: "Quick Attack", power: 40, type: "normal", accuracy: 100, category: "physical" },
    { name: typeLabel, power: 70, type: primary, accuracy: 100, category: "special" },
  ];
}

function toMoveSlug(moveName) {
  return String(moveName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

async function fetchMoveDetailsByName(moveName) {
  const slug = toMoveSlug(moveName);

  if (!slug) {
    return { name: "Tackle", power: 40, type: "normal", accuracy: 100, category: "physical" };
  }

  if (moveDetailsCache.has(slug)) {
    return moveDetailsCache.get(slug);
  }

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
    if (!res.ok) {
      throw new Error(`Move fetch failed (${res.status})`);
    }

    const data = await res.json();
    const powerRaw = Number(data.power || 0);
    const categoryRaw = data.damage_class?.name || "physical";
    const category = categoryRaw === "special" || categoryRaw === "physical" ? categoryRaw : "status";

    const nameLabel = typeof titleCase === "function" ? titleCase(data.name || moveName) : (data.name || moveName);
    const details = {
      name: nameLabel,
      power: powerRaw > 0 ? powerRaw : 0,
      type: data.type?.name || "normal",
      accuracy: Number(data.accuracy || 100),
      category,
    };

    moveDetailsCache.set(slug, details);
    return details;
  } catch (err) {
    const nameLabel = typeof titleCase === "function" ? titleCase(moveName) : moveName;
    const fallback = {
      name: nameLabel,
      power: 40,
      type: "normal",
      accuracy: 100,
      category: "physical",
    };
    moveDetailsCache.set(slug, fallback);
    return fallback;
  }
}

async function getPokemonApiDataById(id) {
  const numericId = Number(id);
  if (!numericId) return null;

  if (pokemonApiCache.has(numericId)) {
    return pokemonApiCache.get(numericId);
  }

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${numericId}`);
    if (!res.ok) return null;
    const data = await res.json();
    pokemonApiCache.set(numericId, data);
    return data;
  } catch {
    return null;
  }
}

function moveBattleScore(move, monTypes, stats) {
  const power = Number(move.power || 0);
  const accuracy = Math.max(1, Number(move.accuracy || 100));
  const stab = monTypes.includes(move.type) ? 1.35 : 1;

  let attackBias = 1;
  if (move.category === "special") {
    attackBias = (stats.spAttack || 1) >= (stats.attack || 1) ? 1.15 : 0.95;
  } else if (move.category === "physical") {
    attackBias = (stats.attack || 1) >= (stats.spAttack || 1) ? 1.15 : 0.95;
  }

  return (power * (accuracy / 100)) * stab * attackBias;
}

async function selectBestMovesForPokemon(id, monTypes, stats, fallbackMoves = []) {
  const apiData = await getPokemonApiDataById(id);
  const fallback = fallbackMoves.length > 0 ? fallbackMoves : fallbackMoveSet(monTypes);
  if (!apiData) return fallback.slice(0, 4);

  const learned = (apiData.moves || [])
    .map((entry) => {
      const bestDetail = getBattleBestLearnDetail(entry?.version_group_details || []);
      if (!bestDetail) return null;
      return { moveName: entry?.move?.name || "", ...bestDetail };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.versionRank !== b.versionRank) return a.versionRank - b.versionRank;
      if (a.methodRank !== b.methodRank) return a.methodRank - b.methodRank;
      return b.level - a.level;
    });

  const seen = new Set();
  const candidateNames = [];
  learned.forEach((entry) => {
    const name = entry.moveName;
    if (!name || seen.has(name)) return;
    seen.add(name);
    candidateNames.push(name);
  });

  const strongMoves = [];
  const maxChecks = Math.min(candidateNames.length, 90);
  for (let i = 0; i < maxChecks; i += 1) {
    const details = await fetchMoveDetailsByName(candidateNames[i]);
    if (!details) continue;

    const normalized = {
      name: details.name || candidateNames[i],
      power: Number(details.power || 0),
      type: details.type || "normal",
      accuracy: Number(details.accuracy || 100),
      category: details.category || "physical",
    };

    if (normalized.power <= 0) continue;
    if (normalized.accuracy < 75) continue;
    if (normalized.category !== "physical" && normalized.category !== "special") continue;
    strongMoves.push(normalized);
  }

  if (strongMoves.length === 0) return fallback.slice(0, 4);

  // Best move per type (for STAB selection)
  const typedBest = new Map();
  strongMoves.forEach((mv) => {
    const prev = typedBest.get(mv.type);
    if (!prev || moveBattleScore(mv, monTypes, stats) > moveBattleScore(prev, monTypes, stats)) {
      typedBest.set(mv.type, mv);
    }
  });

  const selected = [];
  const pickedNames = new Set();

  // Guarantee at least one STAB move per Pokemon type
  monTypes.forEach((t) => {
    const stabMove = typedBest.get(t);
    if (stabMove && !pickedNames.has(stabMove.name.toLowerCase())) {
      selected.push(stabMove);
      pickedNames.add(stabMove.name.toLowerCase());
    }
  });

  const ranked = [...strongMoves].sort((a, b) => {
    return moveBattleScore(b, monTypes, stats) - moveBattleScore(a, monTypes, stats);
  });

  for (const mv of ranked) {
    if (selected.length >= 4) break;
    const key = mv.name.toLowerCase();
    if (pickedNames.has(key)) continue;
    selected.push(mv);
    pickedNames.add(key);
  }

  while (selected.length < 4) {
    selected.push(fallback[selected.length] || fallback[0]);
  }

  return selected.slice(0, 4);
}
