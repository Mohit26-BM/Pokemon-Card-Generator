const TYPE_COLORS = {
   bug: "#8cb230",
   dark: "#58575f",
   dragon: "#0f6ac0",
   electric: "#eed535",
   fairy: "#ed6ec7",
   fighting: "#d04164",
   fire: "#fd7d24",
   flying: "#748fc9",
   ghost: "#556aae",
   grass: "#62b957",
   ground: "#dd7748",
   ice: "#61cec0",
   normal: "#9da0aa",
   poison: "#a552cc",
   psychic: "#ea5d60",
   rock: "#baab82",
   steel: "#417d9a",
   water: "#4a90da",
};

const RARITY_COLORS = {
   legendary: "#f9a825",
   mythical: "#ab47bc",
   "ultra beast": "#26a69a",
   common: "#78909c",
};

let allCards = [];
let filteredCards = [];
let currentCardData = null;
let currentCardIndex = -1;

const grid = document.getElementById("collection-grid");
const emptyState = document.getElementById("empty-state");
const emptyMsg = document.getElementById("empty-message");
const subtitle = document.getElementById("collection-subtitle");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const typeFilter = document.getElementById("type-filter");
const resetBtn = document.getElementById("reset-recents-btn");
const overlay = document.getElementById("card-modal-overlay");
const modalFlip = document.getElementById("modal-card-flip");
const modalFront = document.getElementById("modal-front");
const modalBack = document.getElementById("modal-back");
const modalOpenBtn = document.getElementById("modal-open-btn");
const modalDeleteBtn = document.getElementById("modal-delete-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const toast = document.getElementById("toast");
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmMessage = document.getElementById("confirm-message");
const confirmOkBtn = document.getElementById("confirm-ok-btn");
const confirmCancelBtn = document.getElementById("confirm-cancel-btn");

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
      const candidate = {
         versionRank: safeVersionRank,
         methodRank,
         level
      };

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
   return [{
         name: "Tackle",
         power: 40,
         type: "normal",
         accuracy: 100,
         category: "physical"
      },
      {
         name: "Swift",
         power: 60,
         type: "normal",
         accuracy: 100,
         category: "special"
      },
      {
         name: "Quick Attack",
         power: 40,
         type: "normal",
         accuracy: 100,
         category: "physical"
      },
      {
         name: formatMoveName(primary),
         power: 70,
         type: primary,
         accuracy: 100,
         category: "special"
      },
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
         return {
            moveName: entry?.move?.name || "",
            ...bestDetail
         };
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

document.addEventListener("DOMContentLoaded", async () => {
   spawnParticles();
   await loadRecents();

   searchInput.addEventListener("input", applyFilters);
   sortSelect.addEventListener("change", applyFilters);
   typeFilter.addEventListener("change", applyFilters);
   resetBtn.addEventListener("click", clearRecents);

   modalCloseBtn.addEventListener("click", closeModal);
   overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
   });
   modalFlip.addEventListener("click", () => modalFlip.classList.toggle("flipped"));

   modalOpenBtn.addEventListener("click", () => {
      if (!currentCardData?.pokemon_name) return;
      window.open(`https://pokemondb.net/pokedex/${currentCardData.pokemon_name}`, "_blank");
   });

   modalDeleteBtn.addEventListener("click", removeCurrentFromRecents);
});

async function loadRecents() {
   const raw = JSON.parse(localStorage.getItem("recentPokemon")) || [];

   if (!Array.isArray(raw) || raw.length === 0) {
      emptyMsg.textContent = "No recent Pokémon yet. Generate cards first.";
      showEmpty();
      return;
   }

   allCards = raw.map((poke, idx) => ({
      id: idx,
      pokemon_id: poke.id,
      pokemon_name: String(poke.name || "pokemon").toLowerCase(),
      rarity: String(poke.rarity || "Common").toLowerCase(),
      is_shiny: Boolean(poke.isShiny),
      date_captured: poke.timestamp || Date.now(),
      card_data: {
         id: poke.id,
         name: poke.name,
         is_shiny: Boolean(poke.isShiny),
         types: Array.isArray(poke.types) ? poke.types : [],
      },
   }));

   applyFilters();
}

function applyFilters() {
   const query = searchInput.value.trim().toLowerCase();
   const type = typeFilter.value;
   const sortBy = sortSelect.value;

   filteredCards = allCards.filter((card) => {
      const name = (card.pokemon_name || "").toLowerCase();
      const types = card.card_data?.types || [];

      const matchesName = name.includes(query);
      const matchesType = type === "all" || types.includes(type);
      return matchesName && matchesType;
   });

   filteredCards.sort((a, b) => {
      if (sortBy === "viewed_desc") return new Date(b.date_captured) - new Date(a.date_captured);
      if (sortBy === "viewed_asc") return new Date(a.date_captured) - new Date(b.date_captured);
      if (sortBy === "name_asc") return a.pokemon_name.localeCompare(b.pokemon_name);
      if (sortBy === "rarity") {
         const order = ["legendary", "mythical", "ultra beast", "common"];
         return order.indexOf(a.rarity) - order.indexOf(b.rarity);
      }
      return 0;
   });

   updateStatBar();
   renderGrid();
}

function updateStatBar() {
   document.getElementById("stat-total").textContent = allCards.length;
   document.getElementById("stat-legendary").textContent = allCards.filter((c) => c.rarity === "legendary").length;
   document.getElementById("stat-epic").textContent = allCards.filter((c) => c.rarity === "mythical").length;
   document.getElementById("stat-rare").textContent = allCards.filter((c) => c.rarity === "ultra beast").length;
   document.getElementById("stat-common").textContent = allCards.filter((c) => !["legendary", "mythical", "ultra beast"].includes(c.rarity)).length;

   subtitle.textContent = `${allCards.length} recently viewed Pokémon`;
}

function renderGrid() {
   grid.innerHTML = "";

   if (filteredCards.length === 0) {
      showEmpty("No matches for your current filters.");
      return;
   }

   emptyState.style.display = "none";
   grid.style.display = "grid";

   filteredCards.forEach((card, index) => renderCard(card, index));
}

function renderCard(card, index) {
   const cd = card.card_data || {};
   const rarity = card.rarity || "common";
   const rarityCol = RARITY_COLORS[rarity] || "#78909c";
   const types = cd.types || [];
   const isShiny = cd.is_shiny || false;
   const pokemonId = cd.id || card.pokemon_id;

   const imgSrc = getStaticSpriteUrl(pokemonId, isShiny);

   const typesBadges = types
      .map((t) => `<span class="type-badge" style="background:${TYPE_COLORS[t] || "#555"}">${t}</span>`)
      .join("");

   const viewedAt = new Date(card.date_captured).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
   });

   const el = document.createElement("div");
   el.className = "col-card";
   el.style.animationDelay = `${index * 0.06}s`;
   el.innerHTML = `
    <div class="col-card-inner" style="--rarity-color:${rarityCol}">
      ${isShiny ? '<span class="shiny-badge">✨</span>' : ""}
      <img class="col-card-sprite" src="${imgSrc}" alt="${card.pokemon_name}" loading="lazy" />
      <div class="col-card-name">${card.pokemon_name}</div>
      <div class="col-card-id">#${String(pokemonId).padStart(3, "0")}</div>
      <div class="col-card-types">${typesBadges}</div>
      <div class="col-card-rarity" style="color:${rarityCol}">${rarity}</div>
      <div class="col-card-time">Viewed ${viewedAt}</div>
    </div>
  `;

   el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
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
      }, {
         once: true
      });

      void resolveCardSpriteUrl(pokemonId, isShiny).then((url) => {
         if (url) spriteEl.src = url;
      });
   }
}

async function enrichCardDataIfNeeded(cd, pokemonId) {
   try {
      const apiData = await getPokemonApiDataById(pokemonId);
      if (!apiData) return cd;

      const merged = {
         ...cd
      };
      merged.stats = {
         hp: apiData.stats?.[0]?.base_stat ?? 0,
         attack: apiData.stats?.[1]?.base_stat ?? 0,
         defense: apiData.stats?.[2]?.base_stat ?? 0,
         "special-attack": apiData.stats?.[3]?.base_stat ?? 0,
         "special-defense": apiData.stats?.[4]?.base_stat ?? 0,
         speed: apiData.stats?.[5]?.base_stat ?? 0,
      };
      const existingMoves = normalizeMoveList(cd.moves, cd.top_moves).slice(0, 4);
      const strongMoves = await fetchStrongMovesForPokemon(pokemonId);
      merged.moves = strongMoves.length > 0 ?
         strongMoves :
         (existingMoves.length > 0 ?
            existingMoves :
            (apiData.moves || []).slice(0, 4).map((m) => formatMoveName(m.move.name)));
      merged.abilities = (apiData.abilities || []).map((a) => formatMoveName(a.ability.name));
      return merged;
   } catch {
      return cd;
   }
}

async function openModal(card) {
   currentCardData = card;
   currentCardIndex = allCards.findIndex((c) => c.id === card.id);
   modalFlip.classList.remove("flipped");

   const baseCd = card.card_data || {};
   const rarity = card.rarity || "common";
   const rarityCol = RARITY_COLORS[rarity] || "#78909c";
   const pokemonId = baseCd.id || card.pokemon_id;
   const cd = await enrichCardDataIfNeeded(baseCd, pokemonId);
   const types = cd.types || [];
   const isShiny = cd.is_shiny || false;

   const imgSrc = await resolveCardSpriteUrl(pokemonId, isShiny);

   const typesBadges = types
      .map((t) => `<span class="type-badge" style="background:${TYPE_COLORS[t] || "#555"}">${t}</span>`)
      .join("");

   modalFront.innerHTML = `
    <div class="col-card-types">${typesBadges}</div>
    <img src="${imgSrc}" alt="${card.pokemon_name}" style="width:130px;filter:drop-shadow(0 6px 18px rgba(0,0,0,0.6))" onerror="this.onerror=null;this.src='${getStaticSpriteUrl(pokemonId, isShiny)}'" />
    <div class="modal-name" style="color:${rarityCol}">${card.pokemon_name}</div>
    <div class="col-card-id">#${String(pokemonId).padStart(3, "0")} · ${rarity}</div>
    <div class="flip-hint"><i class="fas fa-sync-alt"></i> Click card to see stats</div>
  `;

   const stats = cd.stats || {};
   const statKeys = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
   const statBars = statKeys.map((k) => {
      const val = stats[k] || 0;
      const pct = Math.min(Math.round((val / 255) * 100), 100);
      return `<div class="stat-row">
      <span class="stat-label">${k.replace("special-", "sp.")}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      <span class="stat-value">${val}</span>
    </div>`;
   }).join("");

   document.getElementById("modal-stats").innerHTML = statBars;
   let moveNames = normalizeMoveList(cd.moves, cd.top_moves).slice(0, 4);
   if (moveNames.length === 0) {
      moveNames = (await fetchStrongMovesForPokemon(pokemonId)).slice(0, 4);
   }
   document.getElementById("modal-moves").textContent = moveNames.join(", ") || "-";
   document.getElementById("modal-abilities").textContent = Array.isArray(cd.abilities) ? cd.abilities.join(", ") : "-";

   const viewedDate = new Date(card.date_captured).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
   });

   let dateEl = document.getElementById("modal-date");
   if (!dateEl) {
      dateEl = document.createElement("p");
      dateEl.id = "modal-date";
      modalBack.appendChild(dateEl);
   }
   dateEl.innerHTML = `<strong style="color:#4a90da">Viewed:</strong> ${viewedDate}`;

   overlay.classList.add("open");
}

function closeModal() {
   overlay.classList.remove("open");
   setTimeout(() => {
      modalFront.innerHTML = "";
      currentCardData = null;
      currentCardIndex = -1;
   }, 350);
}

async function removeCurrentFromRecents() {
   if (!currentCardData) return;

   const name = currentCardData.pokemon_name;
   const shouldDelete = await showConfirm(`Remove ${name} from recent history?`, "Yes, Remove");
   if (!shouldDelete) return;

   if (currentCardIndex !== -1) {
      allCards.splice(currentCardIndex, 1);
      persistRecents();
      closeModal();
      showToast(`${name} removed from recents`, "");
      applyFilters();
      if (allCards.length === 0) showEmpty();
   }
}

async function clearRecents() {
   if (!allCards.length) return;
   const shouldClear = await showConfirm("Clear all recent history?", "Yes, Clear");
   if (!shouldClear) return;

   allCards = [];
   persistRecents();
   applyFilters();
   showToast("Recent history cleared", "success");
}

function persistRecents() {
   const raw = allCards.map((card) => ({
      id: card.pokemon_id,
      name: card.pokemon_name,
      types: card.card_data?.types || [],
      rarity: card.rarity,
      isShiny: Boolean(card.card_data?.is_shiny),
      timestamp: card.date_captured,
   }));
   localStorage.setItem("recentPokemon", JSON.stringify(raw));
}

function showEmpty(message) {
   if (message) emptyMsg.textContent = message;
   grid.style.display = "none";
   emptyState.style.display = "flex";
}

function showToast(msg, type = "") {
   toast.textContent = msg;
   toast.className = `toast ${type}`;
   void toast.offsetWidth;
   toast.classList.add("show");
   setTimeout(() => toast.classList.remove("show"), 3000);
}

function showConfirm(message, okLabel = "Confirm") {
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
      confirmOkBtn.textContent = okLabel;
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
      const s = document.createElement("span");
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
