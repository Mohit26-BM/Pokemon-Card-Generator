// ── Type colours (matches script.js) ─────────────────────────────────────────
const TYPE_COLORS = {
  bug: "#8cb230", dark: "#58575f", dragon: "#0f6ac0",
  electric: "#eed535", fairy: "#ed6ec7", fighting: "#d04164",
  fire: "#fd7d24", flying: "#748fc9", ghost: "#556aae",
  grass: "#62b957", ground: "#dd7748", ice: "#61cec0",
  normal: "#9da0aa", poison: "#a552cc", psychic: "#ea5d60",
  rock: "#baab82", steel: "#417d9a", water: "#4a90da",
};

const RARITY_COLORS = {
  legendary: "#f9a825",
  mythic:    "#f9a825",
  epic:      "#ab47bc",
  rare:      "#26a69a",
  uncommon:  "#4a90da",
  common:    "#78909c",
};

// ── State ─────────────────────────────────────────────────────────────────────
let allCards = [];         // full fetched list
let filteredCards = [];    // after search/sort/filter
let currentCardData = null; // for the open modal
let currentCardId   = null; // DB row id for the open modal

// ── DOM refs ──────────────────────────────────────────────────────────────────
const grid            = document.getElementById("collection-grid");
const emptyState      = document.getElementById("empty-state");
const emptyMsg        = document.getElementById("empty-message");
const subtitle        = document.getElementById("collection-subtitle");
const searchInput     = document.getElementById("search-input");
const sortSelect      = document.getElementById("sort-select");
const typeFilter      = document.getElementById("type-filter");
const overlay         = document.getElementById("card-modal-overlay");
const modalFlip       = document.getElementById("modal-card-flip");
const modalFront      = document.getElementById("modal-front");
const modalBack       = document.getElementById("modal-back");
const modalFavBtn     = document.getElementById("modal-fav-btn");
const modalDeleteBtn  = document.getElementById("modal-delete-btn");
const modalCloseBtn   = document.getElementById("modal-close-btn");
const toast           = document.getElementById("toast");
const confirmOverlay  = document.getElementById("confirm-overlay");
const confirmMessage  = document.getElementById("confirm-message");
const confirmOkBtn    = document.getElementById("confirm-ok-btn");
const confirmCancelBtn= document.getElementById("confirm-cancel-btn");

const moveDetailsCache = new Map();
const moveSetCache = new Map();
const pokemonApiCache = new Map();

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

function formatMoveName(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeMoveList(...sources) {
  const out = [];

  const pushMove = (value) => {
    const normalized = formatMoveName(value);
    if (!normalized) return;
    if (!out.some((m) => m.toLowerCase() === normalized.toLowerCase())) {
      out.push(normalized);
    }
  };

  sources.forEach((source) => {
    if (!source) return;
    if (Array.isArray(source)) {
      source.forEach((entry) => {
        if (typeof entry === "string") {
          pushMove(entry);
        } else if (entry?.name) {
          pushMove(entry.name);
        }
      });
      return;
    }

    if (typeof source === "string") {
      source.split(",").forEach((part) => pushMove(part));
    }
  });

  return out;
}

function toMoveSlug(moveName) {
  return String(moveName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

async function fetchMoveDetailsByName(moveName) {
  const slug = toMoveSlug(moveName);
  if (!slug) return null;
  if (moveDetailsCache.has(slug)) return moveDetailsCache.get(slug);

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
    if (!res.ok) return null;
    const data = await res.json();
    const categoryRaw = data.damage_class?.name || "physical";
    const category = categoryRaw === "special" || categoryRaw === "physical" ? categoryRaw : "status";

    const details = {
      name: formatMoveName(data.name || moveName),
      power: Number(data.power || 0),
      type: data.type?.name || "normal",
      accuracy: Number(data.accuracy || 100),
      category,
    };

    moveDetailsCache.set(slug, details);
    return details;
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

function fallbackMoveSet(monTypes) {
  const primary = monTypes[0] || "normal";
  return [
    { name: "Tackle", power: 40, type: "normal", accuracy: 100, category: "physical" },
    { name: "Swift", power: 60, type: "normal", accuracy: 100, category: "special" },
    { name: "Quick Attack", power: 40, type: "normal", accuracy: 100, category: "physical" },
    { name: formatMoveName(primary), power: 70, type: primary, accuracy: 100, category: "special" },
  ];
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

async function selectBestMovesForPokemon(id, monTypes, stats, fallbackMoves = []) {
  const apiData = await getPokemonApiDataById(id);
  const fallback = fallbackMoves.length > 0 ? fallbackMoves : fallbackMoveSet(monTypes);
  if (!apiData) return fallback.slice(0, 4).map((m) => m.name);

  const learned = (apiData.moves || [])
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

    if (details.power <= 0) continue;
    if (details.accuracy < 75) continue;
    if (details.category !== "physical" && details.category !== "special") continue;
    strongMoves.push(details);
  }

  if (strongMoves.length === 0) return fallback.slice(0, 4).map((m) => m.name);

  const typedBest = new Map();
  strongMoves.forEach((mv) => {
    const prev = typedBest.get(mv.type);
    if (!prev || moveBattleScore(mv, monTypes, stats) > moveBattleScore(prev, monTypes, stats)) {
      typedBest.set(mv.type, mv);
    }
  });

  const selected = [];
  const pickedNames = new Set();

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

  return selected.slice(0, 4).map((m) => m.name);
}

async function fetchStrongMovesForPokemon(pokemonId) {
  const key = Number(pokemonId);
  if (!key) return [];
  if (moveSetCache.has(key)) return moveSetCache.get(key);

  const apiData = await getPokemonApiDataById(key);
  if (!apiData) return [];

  const monTypes = (apiData.types || []).map((t) => t.type?.name).filter(Boolean);
  const stats = {
    attack: Number(apiData.stats?.find((s) => s.stat?.name === "attack")?.base_stat || 50),
    spAttack: Number(apiData.stats?.find((s) => s.stat?.name === "special-attack")?.base_stat || 50),
  };

  const moves = await selectBestMovesForPokemon(key, monTypes, stats);
  moveSetCache.set(key, moves);
  return moves;
}

function getStaticSpriteUrl(pokemonId, isShiny) {
  const base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
  const shinyBase = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/";
  return isShiny ? `${shinyBase}${pokemonId}.png` : `${base}${pokemonId}.png`;
}

function getAnimatedSpriteUrlFromApiData(apiData, isShiny) {
  const animated = apiData?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated;
  return isShiny ? (animated?.front_shiny || "") : (animated?.front_default || "");
}

function toShowdownId(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getShowdownSpriteUrlFromApiData(apiData, isShiny) {
  const id = toShowdownId(apiData?.name || apiData?.species?.name);
  if (!id) return "";
  const folder = isShiny ? "ani-shiny" : "ani";
  return `https://play.pokemonshowdown.com/sprites/${folder}/${id}.gif`;
}

function animationsEnabled() {
  if (typeof window.isAnimationsEnabled === "function") {
    return window.isAnimationsEnabled();
  }
  try {
    const raw = localStorage.getItem("pcgAnimationsEnabled");
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

async function resolveCardSpriteUrl(pokemonId, isShiny) {
  const fallback = getStaticSpriteUrl(pokemonId, isShiny);
  if (!animationsEnabled()) return fallback;

  const apiData = await getPokemonApiDataById(pokemonId);
  if (!apiData) return fallback;

  return (
    getAnimatedSpriteUrlFromApiData(apiData, isShiny) ||
    getShowdownSpriteUrlFromApiData(apiData, isShiny) ||
    fallback
  );
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  spawnParticles();
  await loadCollection();

  searchInput.addEventListener("input",  applyFilters);
  sortSelect.addEventListener("change",  applyFilters);
  typeFilter.addEventListener("change",  applyFilters);

  modalCloseBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

  modalFlip.addEventListener("click", () => modalFlip.classList.toggle("flipped"));

  modalFavBtn.addEventListener("click", handleFavourite);
  modalDeleteBtn.addEventListener("click", handleDelete);
});

// ── Fetch from Supabase ───────────────────────────────────────────────────────
async function loadCollection() {
  const user = await getCurrentUser();

  if (!user) {
    emptyMsg.textContent = "Please sign in to view your collection.";
    showEmpty();
    return;
  }

  const result = await getTrainerPokemon(user.id);

  if (!result.success || !result.data || result.data.length === 0) {
    emptyMsg.textContent = "No Pokémon in your collection yet. Generate and save some!";
    showEmpty();
    return;
  }

  allCards = result.data;
  applyFilters();
}

// ── Filter / Sort / Render ────────────────────────────────────────────────────
function applyFilters() {
  const query   = searchInput.value.trim().toLowerCase();
  const type    = typeFilter.value;
  const sortBy  = sortSelect.value;

  filteredCards = allCards.filter((card) => {
    const name  = (card.pokemon_name || "").toLowerCase();
    const types = card.card_data?.types || [];

    const matchesName = name.includes(query);
    const matchesType = type === "all" || types.includes(type);
    return matchesName && matchesType;
  });

  // Sort
  filteredCards.sort((a, b) => {
    if (sortBy === "date_desc") return new Date(b.date_captured) - new Date(a.date_captured);
    if (sortBy === "date_asc")  return new Date(a.date_captured) - new Date(b.date_captured);
    if (sortBy === "name_asc")  return a.pokemon_name.localeCompare(b.pokemon_name);
    if (sortBy === "rarity") {
      const order = ["legendary","mythic","epic","rare","uncommon","common"];
      return order.indexOf(a.rarity) - order.indexOf(b.rarity);
    }
    return 0;
  });

  updateStatBar();
  renderGrid();
}

function updateStatBar() {
  document.getElementById("stat-total").textContent = allCards.length;
  document.getElementById("stat-legendary").textContent =
    allCards.filter(c => c.rarity === "legendary" || c.rarity === "mythic").length;
  document.getElementById("stat-epic").textContent =
    allCards.filter(c => c.rarity === "epic").length;
  document.getElementById("stat-rare").textContent =
    allCards.filter(c => c.rarity === "rare").length;
  document.getElementById("stat-common").textContent =
    allCards.filter(c => c.rarity === "common" || c.rarity === "uncommon").length;

  subtitle.textContent = `${allCards.length} Pokémon captured`;
}

function renderGrid() {
  grid.innerHTML = "";

  if (filteredCards.length === 0) {
    showEmpty();
    return;
  }

  emptyState.style.display = "none";
  grid.style.display = "grid";

  filteredCards.forEach((card, i) => renderCard(card, i));
}

function renderCard(card, index) {
  const cd        = card.card_data || {};
  const rarity    = card.rarity || "common";
  const rarityCol = RARITY_COLORS[rarity] || "#78909c";
  const types     = cd.types || [];
  const isShiny   = cd.isShiny || cd.is_shiny || false;
  const isFav     = card.is_favorite || false;
  const pokemonId = cd.id || card.pokemon_id;

  const imgSrc = getStaticSpriteUrl(pokemonId, isShiny);

  const typesBadges = types.map(t =>
    `<span class="type-badge" style="background:${TYPE_COLORS[t] || "#555"}">${t}</span>`
  ).join("");

  const el = document.createElement("div");
  el.className = "col-card";
  el.style.animationDelay = `${index * 0.06}s`;
  el.innerHTML = `
    <div class="col-card-inner" style="--rarity-color:${rarityCol}">
      ${isFav ? '<span class="fav-star"><i class="fas fa-star"></i></span>' : ""}
      ${isShiny ? '<span class="shiny-badge">✨</span>' : ""}
      <img class="col-card-sprite" src="${imgSrc}" alt="${card.pokemon_name}" loading="lazy" />
      <div class="col-card-name">${card.pokemon_name}</div>
      <div class="col-card-id">#${String(pokemonId).padStart(3, "0")}</div>
      <div class="col-card-types">${typesBadges}</div>
      <div class="col-card-rarity" style="color:${rarityCol}">${rarity}</div>
    </div>
  `;

  // 3D tilt on mouse move
  el.addEventListener("mousemove", (e) => {
    const rect = el.getBoundingClientRect();
    const x    = ((e.clientX - rect.left) / rect.width  - 0.5) * 20;
    const y    = ((e.clientY - rect.top)  / rect.height - 0.5) * -20;
    el.style.transform = `perspective(600px) rotateX(${y}deg) rotateY(${x}deg) scale(1.04)`;
  });
  el.addEventListener("mouseleave", () => {
    el.style.transform = "perspective(600px) rotateX(0) rotateY(0) scale(1)";
    el.style.transition = "transform 0.5s ease";
  });
  el.addEventListener("mouseenter", () => {
    el.style.transition = "transform 0.1s ease";
  });

  el.addEventListener("click", () => openModal(card));
  grid.appendChild(el);

  const spriteEl = el.querySelector(".col-card-sprite");
  if (spriteEl) {
    spriteEl.addEventListener("error", () => {
      spriteEl.src = getStaticSpriteUrl(pokemonId, isShiny);
    }, { once: true });

    void resolveCardSpriteUrl(pokemonId, isShiny).then((url) => {
      if (url) spriteEl.src = url;
    });
  }
}

async function enrichCardDataIfNeeded(cd, pokemonId) {
  const existingMoves = normalizeMoveList(cd.moves, cd.top_moves);

  try {
    const apiData = await getPokemonApiDataById(pokemonId);
    if (!apiData) return cd;

    const merged = { ...cd };
    const mergedStats = { ...(merged.stats || {}) };

    mergedStats.hp = apiData.stats?.[0]?.base_stat ?? (mergedStats.hp || 0);
    mergedStats.attack = apiData.stats?.[1]?.base_stat ?? (mergedStats.attack || 0);
    mergedStats.defense = apiData.stats?.[2]?.base_stat ?? (mergedStats.defense || 0);
    mergedStats["special-attack"] = apiData.stats?.[3]?.base_stat ?? (mergedStats["special-attack"] || mergedStats.sp_attack || 0);
    mergedStats.sp_attack = mergedStats["special-attack"];
    mergedStats["special-defense"] = apiData.stats?.[4]?.base_stat ?? (mergedStats["special-defense"] || mergedStats.sp_defense || 0);
    mergedStats.sp_defense = mergedStats["special-defense"];
    mergedStats.speed = apiData.stats?.[5]?.base_stat ?? (mergedStats.speed || 0);
    merged.stats = mergedStats;

    const strongMoves = await fetchStrongMovesForPokemon(pokemonId);
    merged.moves = strongMoves.length > 0
      ? strongMoves
      : (existingMoves.length > 0
        ? existingMoves.slice(0, 4)
        : (apiData.moves || []).slice(0, 4).map((m) => formatMoveName(m.move.name)));

    return merged;
  } catch {
    return cd;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
async function openModal(card) {
  currentCardData = card;
  currentCardId   = card.id;
  modalFlip.classList.remove("flipped");

  const baseCd    = card.card_data || {};
  const rarity    = card.rarity || "common";
  const rarityCol = RARITY_COLORS[rarity] || "#78909c";
  const pokemonId = baseCd.id || card.pokemon_id;
  const cd        = await enrichCardDataIfNeeded(baseCd, pokemonId);
  const types     = cd.types || [];
  const isShiny   = cd.isShiny || cd.is_shiny || false;
  const isFav     = card.is_favorite || false;

  const imgSrc = await resolveCardSpriteUrl(pokemonId, isShiny);

  const typesBadges = types.map(t =>
    `<span class="type-badge" style="background:${TYPE_COLORS[t] || "#555"}">${t}</span>`
  ).join("");

  // Front face
  modalFront.innerHTML = `
    <div class="col-card-types">${typesBadges}</div>
    <img src="${imgSrc}" alt="${card.pokemon_name}" style="width:130px;filter:drop-shadow(0 6px 18px rgba(0,0,0,0.6))" onerror="this.onerror=null;this.src='${getStaticSpriteUrl(pokemonId, isShiny)}'" />
    <div class="modal-name" style="color:${rarityCol}">${card.pokemon_name}</div>
    <div class="col-card-id">#${String(pokemonId).padStart(3, "0")} · ${rarity}</div>
    <div class="flip-hint"><i class="fas fa-sync-alt"></i> Click card to see stats</div>
  `;

  // Back face — stat bars
  const stats = cd.stats || {};
  const statKeys = ["hp","attack","defense","special-attack","special-defense","speed"];
  const statBars = statKeys.map(k => {
    const legacyMap = {
      "special-attack": "sp_attack",
      "special-defense": "sp_defense",
    };
    const val = stats[k] || stats[legacyMap[k]] || 0;
    const pct = Math.min(Math.round((val / 255) * 100), 100);
    return `<div class="stat-row">
      <span class="stat-label">${k.replace("special-","sp.")}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      <span class="stat-value">${val}</span>
    </div>`;
  }).join("");

  const canonicalMoves = (await fetchStrongMovesForPokemon(pokemonId)).slice(0, 4);
  let moveNames = canonicalMoves.length > 0
    ? canonicalMoves
    : normalizeMoveList(cd.moves, cd.top_moves).slice(0, 4);
  const movesList = moveNames.join(", ") || "—";
  const abilitiesList = Array.isArray(cd.abilities) ? cd.abilities.join(", ") : (cd.abilities || "—");
  const capturedDate  = card.date_captured
    ? new Date(card.date_captured).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })
    : "—";

  document.getElementById("modal-stats").innerHTML = statBars;
  document.getElementById("modal-moves").textContent = movesList;
  document.getElementById("modal-abilities").textContent = abilitiesList;

  // Add captured date line
  let dateEl = document.getElementById("modal-date");
  if (!dateEl) {
    dateEl = document.createElement("p");
    dateEl.id = "modal-date";
    modalBack.appendChild(dateEl);
  }
  dateEl.innerHTML = `<strong style="color:#4a90da">Captured:</strong> ${capturedDate}`;

  // Favourite button state
  if (isFav) {
    modalFavBtn.classList.add("active");
    modalFavBtn.innerHTML = '<i class="fas fa-star"></i> Favourited';
  } else {
    modalFavBtn.classList.remove("active");
    modalFavBtn.innerHTML = '<i class="fas fa-heart"></i> Favourite';
  }

  overlay.classList.add("open");
}

function closeModal() {
  overlay.classList.remove("open");
  setTimeout(() => {
    modalFront.innerHTML = "";
    currentCardData = null;
    currentCardId   = null;
  }, 350);
}

// ── Favourite ─────────────────────────────────────────────────────────────────
async function handleFavourite() {
  if (!currentCardData) return;
  const newFav = !currentCardData.is_favorite;

  const res = await toggleFavoritePokemon(currentCardId, newFav);
  if (res.success) {
    currentCardData.is_favorite = newFav;
    // sync in allCards array
    const idx = allCards.findIndex(c => c.id === currentCardId);
    if (idx !== -1) allCards[idx].is_favorite = newFav;

    if (newFav) {
      modalFavBtn.classList.add("active");
      modalFavBtn.innerHTML = '<i class="fas fa-star"></i> Favourited';
      showToast("Added to favourites ⭐", "success");
    } else {
      modalFavBtn.classList.remove("active");
      modalFavBtn.innerHTML = '<i class="fas fa-heart"></i> Favourite';
      showToast("Removed from favourites", "");
    }
    applyFilters(); // re-render cards to update star badge
  } else {
    showToast("Failed to update favourite", "error");
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function handleDelete() {
  if (!currentCardData) return;
  const name = currentCardData.pokemon_name;

  const shouldDelete = await showConfirm(`Remove ${name} from your collection?`);
  if (!shouldDelete) return;

  const res = await deleteTrainerPokemon(currentCardId);
  if (res.success) {
    allCards = allCards.filter(c => c.id !== currentCardId);
    closeModal();
    showToast(`${name} removed from collection`, "");
    applyFilters();
    if (allCards.length === 0) showEmpty();
  } else {
    showToast("Failed to remove Pokémon", "error");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showEmpty() {
  grid.style.display = "none";
  emptyState.style.display = "flex";
}

function showToast(msg, type = "") {
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  // force reflow
  void toast.offsetWidth;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    if (!confirmOverlay || !confirmMessage || !confirmOkBtn || !confirmCancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    const cleanup = () => {
      confirmOverlay.classList.remove("open");
      confirmOverlay.setAttribute("aria-hidden", "true");
      confirmOkBtn.removeEventListener("click", onConfirm);
      confirmCancelBtn.removeEventListener("click", onCancel);
      confirmOverlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onBackdrop = (e) => {
      if (e.target === confirmOverlay) onCancel();
    };

    const onKeydown = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };

    confirmMessage.textContent = message;
    confirmOverlay.classList.add("open");
    confirmOverlay.setAttribute("aria-hidden", "false");
    confirmOkBtn.addEventListener("click", onConfirm);
    confirmCancelBtn.addEventListener("click", onCancel);
    confirmOverlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
    confirmCancelBtn.focus();
  });
}

function spawnParticles() {
  const container = document.getElementById("bg-particles");
  for (let i = 0; i < 22; i++) {
    const s    = document.createElement("span");
    const size = Math.random() * 60 + 20;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      animation-duration:${Math.random() * 18 + 12}s;
      animation-delay:${Math.random() * -20}s;
    `;
    container.appendChild(s);
  }
}
