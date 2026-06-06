/*
  moves.js — Move scoring and top-move selection for the generator card display.
  Depends on: utils.js (fetchJsonOrThrow, capitalizeWords, getStatFromPokemonData,
               getFallbackMovesFromPokemonData)
  Loads after utils.js, before script.js.
*/

const MOVE_VERSION_PRIORITY = [
  "scarlet-violet",
  "sword-shield",
  "ultra-sun-ultra-moon",
  "sun-moon",
  "omega-ruby-alpha-sapphire",
  "x-y",
  "black-2-white-2",
];

const MOVE_LEARN_METHOD_PRIORITY = {
  "level-up": 0,
  machine: 1,
  tutor: 2,
};

const moveMetaCache = {};
const topMovesCache = {};

function getBestLearnDetail(versionDetails = []) {
  let best = null;

  versionDetails.forEach((detail) => {
    const method = detail?.move_learn_method?.name || "";
    if (!(method in MOVE_LEARN_METHOD_PRIORITY)) return;

    const version = detail?.version_group?.name || "";
    const versionRank = MOVE_VERSION_PRIORITY.indexOf(version);
    const safeVersionRank = versionRank === -1 ? 999 : versionRank;
    const methodRank = MOVE_LEARN_METHOD_PRIORITY[method];
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

async function fetchMoveMeta(moveName) {
  const slug = String(moveName || "").trim().toLowerCase();
  if (!slug) return null;
  if (moveMetaCache[slug]) return moveMetaCache[slug];

  try {
    const data = await fetchJsonOrThrow(`https://pokeapi.co/api/v2/move/${slug}`, "Move", {
      timeoutMs: 8000,
      maxRetries: 2,
    });

    const meta = {
      name: capitalizeWords(data.name || slug),
      power: Number(data.power || 0),
      accuracy: Number(data.accuracy || 100),
      type: data.type?.name || "normal",
      category: data.damage_class?.name || "status",
    };
    moveMetaCache[slug] = meta;
    return meta;
  } catch {
    return null;
  }
}

function scoreMoveForPokemon(meta, data) {
  const types = (data?.types || []).map((t) => t.type?.name);
  const stab = types.includes(meta.type) ? 1.35 : 1;
  const atk = getStatFromPokemonData(data, "attack");
  const spAtk = getStatFromPokemonData(data, "special-attack");

  let statFit = 1;
  if (meta.category === "special") {
    statFit = spAtk >= atk ? 1.15 : 0.95;
  } else if (meta.category === "physical") {
    statFit = atk >= spAtk ? 1.15 : 0.95;
  }

  return meta.power * (meta.accuracy / 100) * stab * statFit;
}

async function getTopMovesForPokemonData(data, limit = 4) {
  const cacheKey = `${data?.id || "unknown"}`;
  if (topMovesCache[cacheKey]?.length) {
    return topMovesCache[cacheKey].slice(0, limit);
  }

  const learned = (data?.moves || [])
    .map((entry) => {
      const bestDetail = getBestLearnDetail(entry?.version_group_details || []);
      if (!bestDetail) return null;
      return { moveName: entry?.move?.name || "", ...bestDetail };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.versionRank !== b.versionRank) return a.versionRank - b.versionRank;
      if (a.methodRank !== b.methodRank) return a.methodRank - b.methodRank;
      return b.level - a.level;
    });

  const uniqueNames = [];
  const seen = new Set();
  learned.forEach((entry) => {
    const key = entry.moveName.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniqueNames.push(entry.moveName);
  });

  const checkedNames = uniqueNames.slice(0, 90);
  const metas = (await Promise.all(checkedNames.map((name) => fetchMoveMeta(name))))
    .filter(Boolean)
    .filter((meta) => meta.power > 0)
    .filter((meta) => meta.category === "physical" || meta.category === "special")
    .filter((meta) => meta.accuracy >= 75);

  const types = (data?.types || []).map((t) => t.type?.name);
  const selected = [];
  const selectedSet = new Set();

  // Guarantee at least one STAB move per type when available
  types.forEach((typeName) => {
    const candidates = metas
      .filter((m) => m.type === typeName)
      .sort((a, b) => scoreMoveForPokemon(b, data) - scoreMoveForPokemon(a, data));
    if (candidates[0]) {
      const key = candidates[0].name.toLowerCase();
      if (!selectedSet.has(key)) {
        selected.push(candidates[0].name);
        selectedSet.add(key);
      }
    }
  });

  const ranked = [...metas].sort((a, b) => scoreMoveForPokemon(b, data) - scoreMoveForPokemon(a, data));
  ranked.forEach((meta) => {
    if (selected.length >= limit) return;
    const key = meta.name.toLowerCase();
    if (selectedSet.has(key)) return;
    selected.push(meta.name);
    selectedSet.add(key);
  });

  if (selected.length < limit) {
    const fallback = getFallbackMovesFromPokemonData(data, limit);
    fallback.forEach((name) => {
      if (selected.length >= limit) return;
      const key = name.toLowerCase();
      if (selectedSet.has(key)) return;
      selected.push(name);
      selectedSet.add(key);
    });
  }

  topMovesCache[cacheKey] = selected.slice(0, limit);
  return topMovesCache[cacheKey];
}
