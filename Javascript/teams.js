const state = {
  user: null,
  captured: [],
  teams: [],
  selectedPokemonIds: [],
  battleMode: "1v1",
  battleTimer: null,
  battleActive: false,
  battle: null,
  modalBattle: null,
  modalLoadingTimer: null,
};

const moveDetailsCache = new Map();
const pokemonBattleCache = new Map();
const pokemonApiCache = new Map();
const POKEAPI_RANDOM_MAX_ID = 1025;
const BATTLE_PRELOAD_MS = 4500;
const BATTLE_STEP_MISS_MS = 1500;
const BATTLE_STEP_STATUS_MS = 1600;
const BATTLE_STEP_HIT_MS = 2100;
const BATTLE_FAINT_PAUSE_MS = 1200;
const BATTLE_NEXT_TURN_MS = 1700;
const MODAL_CPU_RESPONSE_MS = 2300;
const MODAL_PLAYER_PROMPT_MS = 1800;
const MODAL_FAINT_PAUSE_MS = 1600;
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmMessage = document.getElementById("confirm-message");
const confirmOkBtn = document.getElementById("confirm-ok-btn");
const confirmCancelBtn = document.getElementById("confirm-cancel-btn");

const TYPE_EFFECTIVENESS = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

document.addEventListener("DOMContentLoaded", async () => {
  wireEvents();
  await initializeTeamsPage();
});

function wireEvents() {
  document.getElementById("save-team-btn").addEventListener("click", onSaveTeam);
  document.getElementById("clear-team-btn").addEventListener("click", () => {
    state.selectedPokemonIds = [];
    renderBuilder();
    renderPool();
  });
  document.getElementById("pool-search").addEventListener("input", renderPool);

  document.getElementById("mode-1v1").addEventListener("click", () => setBattleMode("1v1"));
  document.getElementById("mode-6v6").addEventListener("click", () => setBattleMode("6v6"));
  document.getElementById("random-setup-btn").addEventListener("click", randomizeBattleSetup);
  document.getElementById("start-interactive-battle-btn").addEventListener("click", startModalBattleFromSelection);

  document.getElementById("arena-modal-close-x").addEventListener("click", closeArenaModal);
  document.getElementById("arena-modal-close-btn").addEventListener("click", closeArenaModal);

  document.getElementById("player-team-select").addEventListener("change", () => {
    refreshDuelSlotSelectors();
  });
  document.getElementById("opponent-team-select").addEventListener("change", () => {
    refreshDuelSlotSelectors();
  });
  document.getElementById("modal-opponent-source").addEventListener("change", () => {
    refreshDuelSlotSelectors();
  });

  const modal = document.getElementById("battle-modal");
  document.getElementById("battle-modal-close").addEventListener("click", closeBattleModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeBattleModal();
  });
}

async function initializeTeamsPage() {
  const user = await getCurrentUser();
  if (!user) {
    disablePage("Please sign in first to access My Teams.");
    return;
  }

  state.user = user;

  const [capturedRes, teamsRes] = await Promise.all([
    getTrainerPokemon(user.id),
    getTrainerTeams(user.id),
  ]);

  if (!capturedRes.success) {
    disablePage(`Could not load captured Pokemon: ${capturedRes.message}`);
    return;
  }

  state.captured = capturedRes.data || [];

  if (teamsRes.success) {
    state.teams = teamsRes.data || [];
  } else {
    toast(`Could not load teams: ${teamsRes.message}`);
  }

  renderBuilder();
  renderPool();
  renderSavedTeams();
  renderTeamSelectors();
}

function disablePage(message) {
  document.querySelector(".teams-layout").innerHTML = `
    <section class="panel">
      <h2>Access Required</h2>
      <p>${escapeHtml(message)}</p>
      <p><a href="index.html" style="color:#9ad8ff">Back to Generator</a></p>
    </section>
  `;
}

function getCapturedByPokemonId(pokemonId) {
  return state.captured.find((card) => Number(card.pokemon_id) === Number(pokemonId));
}

function normalizeStats(stats) {
  const safe = stats || {};
  return {
    hp: Number(safe.hp || 50),
    attack: Number(safe.attack || 50),
    defense: Number(safe.defense || 50),
    spAttack: Number(safe["special-attack"] || safe.sp_attack || 50),
    spDefense: Number(safe["special-defense"] || safe.sp_defense || 50),
    speed: Number(safe.speed || 50),
  };
}

function normalizeRarityTag(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("legend")) return "legendary";
  if (raw.includes("myth")) return "mythical";
  return raw;
}

function computePowerRating(stats, rarityTag = "") {
  const base = Number(stats.hp || 0)
    + Number(stats.attack || 0)
    + Number(stats.defense || 0)
    + Number(stats.spAttack || 0)
    + Number(stats.spDefense || 0)
    + Number(stats.speed || 0);

  const rarity = normalizeRarityTag(rarityTag);
  let bonus = 0;
  if (rarity === "legendary") bonus = 240;
  if (rarity === "mythical") bonus = 220;

  return base + bonus;
}

function normalizeMoves(cardData, fallbackType) {
  const raw = cardData?.moves || cardData?.top_moves || [];
  let list = [];

  if (Array.isArray(raw)) {
    list = raw.map((name) => String(name || "").trim()).filter(Boolean);
  } else if (typeof raw === "string") {
    list = raw.split(",").map((name) => name.trim()).filter(Boolean);
  }

  if (list.length === 0) {
    list = ["tackle", "swift", "quick attack", "bite"];
  }

  return list.slice(0, 4).map((name, idx) => {
    const basePower = 45 + idx * 12;
    return {
      name,
      power: basePower,
      type: fallbackType || "normal",
      accuracy: 100,
      category: idx % 2 === 0 ? "physical" : "special",
    };
  });
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
    return {
      name: "Tackle",
      power: 40,
      type: "normal",
      accuracy: 100,
      category: "physical",
    };
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

    const details = {
      name: titleCase(data.name || moveName),
      power: powerRaw > 0 ? powerRaw : 0,
      type: data.type?.name || "normal",
      accuracy: Number(data.accuracy || 100),
      category,
    };

    moveDetailsCache.set(slug, details);
    return details;
  } catch (err) {
    const fallback = {
      name: titleCase(moveName),
      power: 40,
      type: "normal",
      accuracy: 100,
      category: "physical",
    };
    moveDetailsCache.set(slug, fallback);
    return fallback;
  }
}

function getUniqueRandomIds(count, maxId) {
  const ids = new Set();
  while (ids.size < count) {
    ids.add(Math.floor(Math.random() * maxId) + 1);
  }
  return Array.from(ids);
}

async function fetchPokemonBattleMonById(id) {
  const numericId = Number(id);
  if (!numericId) return null;

  if (pokemonBattleCache.has(numericId)) {
    return cloneMon(pokemonBattleCache.get(numericId));
  }

  try {
    const data = await getPokemonApiDataById(numericId);
    if (!data) {
      return null;
    }
    const statsMap = new Map((data.stats || []).map((s) => [s.stat?.name, Number(s.base_stat || 0)]));
    const types = (data.types || []).map((t) => t.type?.name).filter(Boolean);
    const normalizedStats = {
      hp: statsMap.get("hp") || 50,
      attack: statsMap.get("attack") || 50,
      defense: statsMap.get("defense") || 50,
      spAttack: statsMap.get("special-attack") || 50,
      spDefense: statsMap.get("special-defense") || 50,
      speed: statsMap.get("speed") || 50,
    };
    const detailedMoves = await selectBestMovesForPokemon(numericId, types, normalizedStats);

    const baseStatTotal = Array.isArray(data?.stats)
      ? data.stats.reduce((sum, s) => sum + Number(s?.base_stat || 0), 0)
      : 0;
    const inferredRarity = baseStatTotal >= 640 ? "legendary" : baseStatTotal >= 600 ? "mythical" : "";
    const mon = {
      id: numericId,
      name: data.name || `pokemon-${numericId}`,
      types: types.length > 0 ? types : ["normal"],
      rarityTag: inferredRarity,
      stats: normalizedStats,
      maxHp: statsMap.get("hp") || 50,
      currentHp: statsMap.get("hp") || 50,
      powerRating: computePowerRating(normalizedStats, inferredRarity),
      moves: detailedMoves.slice(0, 4),
    };

    pokemonBattleCache.set(numericId, mon);
    return cloneMon(mon);
  } catch {
    return null;
  }
}

async function getRandomApiBattleMons(count) {
  const mons = [];
  const triedIds = new Set();
  let safety = 0;

  while (mons.length < count && safety < 20) {
    safety += 1;
    const needed = count - mons.length;
    const ids = getUniqueRandomIds(Math.min(needed * 2, 18), POKEAPI_RANDOM_MAX_ID)
      .filter((id) => !triedIds.has(id));
    ids.forEach((id) => triedIds.add(id));

    const settled = await Promise.all(ids.map((id) => fetchPokemonBattleMonById(id)));
    settled.filter(Boolean).forEach((mon) => {
      if (mons.length < count) mons.push(mon);
    });
  }

  return mons.slice(0, count);
}

function buildBattleMon(card) {
  const cardData = card.card_data || {};
  const name = String(card.pokemon_name || cardData.name || "Unknown");
  const id = Number(card.pokemon_id || cardData.id || 0);
  const types = Array.isArray(cardData.types) ? cardData.types : ["normal"];
  const stats = normalizeStats(cardData.stats);
  const rarityTag = normalizeRarityTag(card.rarity || cardData.rarity || "");

  return {
    id,
    name,
    types,
    rarityTag,
    stats,
    maxHp: stats.hp,
    currentHp: stats.hp,
    powerRating: computePowerRating(stats, rarityTag),
    moves: normalizeMoves(cardData, types[0]),
  };
}

async function buildBattleMonAsync(card) {
  const mon = buildBattleMon(card);
  const moveBase = (mon.moves || []).slice(0, 4);
  mon.moves = await selectBestMovesForPokemon(mon.id, mon.types, mon.stats, moveBase);
  return mon;
}

function renderBuilder() {
  const counter = document.getElementById("team-counter");
  counter.textContent = `${state.selectedPokemonIds.length} / 6`;

  const slotGrid = document.getElementById("slot-grid");
  slotGrid.innerHTML = "";

  for (let i = 0; i < 6; i += 1) {
    const pokemonId = state.selectedPokemonIds[i];
    const card = pokemonId ? getCapturedByPokemonId(pokemonId) : null;

    const slot = document.createElement("article");
    slot.className = "slot-card";

    if (!card) {
      slot.innerHTML = `
        <div class="slot-meta">
          <h4>Slot ${i + 1}</h4>
          <p>Empty</p>
        </div>
      `;
      slotGrid.appendChild(slot);
      continue;
    }

    slot.innerHTML = `
      <img src="${spriteFront(Number(card.pokemon_id))}" alt="${escapeHtml(card.pokemon_name)}" />
      <div class="slot-meta">
        <h4>${escapeHtml(titleCase(card.pokemon_name))}</h4>
        <p>#${Number(card.pokemon_id).toString().padStart(3, "0")}</p>
      </div>
      <button class="remove-slot" data-remove-id="${Number(card.pokemon_id)}" title="Remove">
        <i class="fas fa-times"></i>
      </button>
    `;
    slotGrid.appendChild(slot);
  }

  slotGrid.querySelectorAll(".remove-slot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-remove-id"));
      state.selectedPokemonIds = state.selectedPokemonIds.filter((pid) => Number(pid) !== id);
      renderBuilder();
      renderPool();
    });
  });
}

function renderPool() {
  const query = document.getElementById("pool-search").value.trim().toLowerCase();
  const pool = document.getElementById("pool-list");
  pool.innerHTML = "";

  const sorted = [...state.captured].sort((a, b) =>
    String(a.pokemon_name || "").localeCompare(String(b.pokemon_name || ""))
  );

  const filtered = sorted.filter((card) =>
    String(card.pokemon_name || "").toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    pool.innerHTML = `<p style="margin:6px 0;color:#b8c0e5">No Pokemon found.</p>`;
    return;
  }

  filtered.forEach((card) => {
    const pokemonId = Number(card.pokemon_id);
    const isSelected = state.selectedPokemonIds.includes(pokemonId);
    const isFull = state.selectedPokemonIds.length >= 6;

    const row = document.createElement("article");
    row.className = "pool-item";
    row.innerHTML = `
      <img src="${spriteFront(pokemonId)}" alt="${escapeHtml(card.pokemon_name)}" />
      <div class="meta">
        <h4>${escapeHtml(titleCase(card.pokemon_name))}</h4>
        <p>#${pokemonId.toString().padStart(3, "0")}</p>
      </div>
      <button data-add-id="${pokemonId}" ${isSelected || isFull ? "disabled" : ""}>
        ${isSelected ? "Added" : "Add"}
      </button>
    `;

    pool.appendChild(row);
  });

  pool.querySelectorAll("button[data-add-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-add-id"));
      if (state.selectedPokemonIds.includes(id) || state.selectedPokemonIds.length >= 6) return;
      state.selectedPokemonIds.push(id);
      renderBuilder();
      renderPool();
    });
  });
}

async function onSaveTeam() {
  if (!state.user) return;

  const nameInput = document.getElementById("team-name");
  const descInput = document.getElementById("team-description");
  const teamName = nameInput.value.trim();
  const teamDescription = descInput.value.trim();

  if (!teamName) {
    toast("Please enter a team name.");
    return;
  }

  if (state.selectedPokemonIds.length !== 6) {
    toast("A team must have exactly 6 Pokemon.");
    return;
  }

  const res = await createTeam(
    state.user.id,
    teamName,
    teamDescription,
    state.selectedPokemonIds
  );

  if (!res.success) {
    toast(`Could not save team: ${res.message}`);
    return;
  }

  toast("Team saved.");
  nameInput.value = "";
  descInput.value = "";
  state.selectedPokemonIds = [];

  const teamsRes = await getTrainerTeams(state.user.id);
  if (teamsRes.success) {
    state.teams = teamsRes.data || [];
    renderSavedTeams();
    renderTeamSelectors();
  }

  renderBuilder();
  renderPool();
}

function renderSavedTeams() {
  const wrap = document.getElementById("saved-teams-list");
  const count = document.getElementById("saved-count");
  wrap.innerHTML = "";
  count.textContent = String(state.teams.length);

  if (state.teams.length === 0) {
    wrap.innerHTML = `<p style="margin:6px 0;color:#b8c0e5">No saved teams yet.</p>`;
    return;
  }

  state.teams.forEach((team) => {
    const ids = Array.isArray(team.pokemon_ids) ? team.pokemon_ids : [];
    const spriteHtml = ids
      .map((id) => `<img src="${spriteFront(Number(id))}" alt="Pokemon ${Number(id)}" />`)
      .join("");

    const card = document.createElement("article");
    card.className = "team-card";
    card.innerHTML = `
      <h4>${escapeHtml(team.team_name || "Untitled Team")}</h4>
      <p>${escapeHtml(team.team_description || "No description")}</p>
      <div class="team-sprites">${spriteHtml}</div>
      <div class="team-actions">
        <button class="use" data-use-team="${team.id}"><i class="fas fa-wand-magic-sparkles"></i> Load</button>
        <button class="use" data-battle-team="${team.id}"><i class="fas fa-gamepad"></i> Set For Battle</button>
        <button class="del" data-del-team="${team.id}"><i class="fas fa-trash"></i> Delete</button>
      </div>
    `;

    wrap.appendChild(card);
  });

  wrap.querySelectorAll("button[data-use-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-use-team"));
      const team = state.teams.find((t) => Number(t.id) === id);
      if (!team) return;
      state.selectedPokemonIds = Array.isArray(team.pokemon_ids)
        ? team.pokemon_ids.map((pid) => Number(pid)).slice(0, 6)
        : [];
      document.getElementById("team-name").value = team.team_name || "";
      document.getElementById("team-description").value = team.team_description || "";
      renderBuilder();
      renderPool();
      toast("Loaded team into builder.");
    });
  });

  wrap.querySelectorAll("button[data-battle-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = String(btn.getAttribute("data-battle-team"));
      const playerSelect = document.getElementById("player-team-select");
      const opponentSelect = document.getElementById("opponent-team-select");

      if (!playerSelect.value) {
        playerSelect.value = id;
      } else {
        opponentSelect.value = id;
      }

      refreshDuelSlotSelectors();
      toast("Team assigned to battle selector.");
    });
  });

  wrap.querySelectorAll("button[data-del-team]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-del-team"));
      const team = state.teams.find((t) => Number(t.id) === id);
      if (!team) return;

      const ok = await showConfirm(`Delete team \"${team.team_name}\"?`, "Yes, Delete");
      if (!ok) return;

      const res = await deleteTeam(id);
      if (!res.success) {
        toast(`Delete failed: ${res.message}`);
        return;
      }

      state.teams = state.teams.filter((t) => Number(t.id) !== id);
      renderSavedTeams();
      renderTeamSelectors();
      toast("Team deleted.");
    });
  });
}

function renderTeamSelectors() {
  const playerSelect = document.getElementById("player-team-select");
  const opponentSelect = document.getElementById("opponent-team-select");

  const options = ['<option value="">Select a team</option>'];
  state.teams.forEach((team) => {
    options.push(`<option value="${team.id}">${escapeHtml(team.team_name || `Team ${team.id}`)}</option>`);
  });

  playerSelect.innerHTML = options.join("");
  opponentSelect.innerHTML = options.join("");

  if (state.teams.length >= 1) {
    playerSelect.value = String(state.teams[0].id);
  }
  if (state.teams.length >= 2) {
    opponentSelect.value = String(state.teams[1].id);
  }

  refreshDuelSlotSelectors();
}

function getTeamById(teamId) {
  return state.teams.find((t) => String(t.id) === String(teamId));
}

function refreshDuelSlotSelectors() {
  const playerTeam = getTeamById(document.getElementById("player-team-select").value);
  const opponentTeam = getTeamById(document.getElementById("opponent-team-select").value);
  const source = document.getElementById("modal-opponent-source")?.value || "selected-team";

  fillDuelSlotSelect(document.getElementById("player-slot-select"), playerTeam, "Your slot");
  fillDuelSlotSelect(
    document.getElementById("opponent-slot-select"),
    source === "selected-team" ? opponentTeam : null,
    source === "selected-team" ? "Opponent slot" : "Auto pick"
  );

  const opponentSelectLabel = document.getElementById("opponent-team-select")?.closest("label");
  if (opponentSelectLabel) {
    opponentSelectLabel.style.display = source === "selected-team" ? "grid" : "none";
  }

  document.getElementById("duel-slot-pickers").style.display = state.battleMode === "1v1" ? "grid" : "none";
}

function fillDuelSlotSelect(selectEl, team, labelPrefix) {
  const options = [`<option value="">${labelPrefix}</option>`];
  const ids = Array.isArray(team?.pokemon_ids) ? team.pokemon_ids : [];

  ids.forEach((pid, idx) => {
    const card = getCapturedByPokemonId(pid);
    const text = card ? titleCase(card.pokemon_name) : `Pokemon ${pid}`;
    options.push(`<option value="${Number(pid)}">${idx + 1}. ${escapeHtml(text)}</option>`);
  });

  selectEl.innerHTML = options.join("");
  if (ids.length > 0) {
    selectEl.value = String(Number(ids[0]));
  }
}

function setBattleMode(mode) {
  state.battleMode = mode;
  document.getElementById("mode-1v1").classList.toggle("active", mode === "1v1");
  document.getElementById("mode-6v6").classList.toggle("active", mode === "6v6");
  refreshDuelSlotSelectors();
  setBattleStatus(
    mode === "1v1"
      ? "1v1 mode: choose one Pokemon slot for each side."
      : "6v6 mode: teams battle in full and you choose moves each turn."
  );
}

function pickRandomOptionValue(selectEl) {
  const candidates = Array.from(selectEl.options || []).filter((opt) => opt.value);
  if (candidates.length === 0) return "";
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  return choice.value;
}

function randomizeBattleTeams() {
  const playerSelect = document.getElementById("player-team-select");
  const opponentSelect = document.getElementById("opponent-team-select");

  if (state.teams.length < 2) {
    toast("Create at least 2 teams to randomize team battles.");
    return;
  }

  const indices = state.teams.map((_, idx) => idx);
  const leftIdx = indices[Math.floor(Math.random() * indices.length)];
  let rightIdx = leftIdx;
  while (rightIdx === leftIdx) {
    rightIdx = indices[Math.floor(Math.random() * indices.length)];
  }

  playerSelect.value = String(state.teams[leftIdx].id);
  opponentSelect.value = String(state.teams[rightIdx].id);
  refreshDuelSlotSelectors();
  toast("Random teams selected.");
}

function randomizeDuelSlots() {
  if (state.battleMode !== "1v1") {
    toast("Switch to 1v1 mode to randomize duel picks.");
    return;
  }

  const playerSlot = document.getElementById("player-slot-select");
  const opponentSlot = document.getElementById("opponent-slot-select");

  const leftVal = pickRandomOptionValue(playerSlot);
  const rightVal = pickRandomOptionValue(opponentSlot);

  if (!leftVal || !rightVal) {
    toast("Select valid teams first, then randomize 1v1 picks.");
    return;
  }

  playerSlot.value = leftVal;
  opponentSlot.value = rightVal;
  toast("Random 1v1 Pokemon selected.");
}

function randomizeBattleSetup() {
  randomizeBattleTeams();
  if (state.battleMode === "1v1") {
    randomizeDuelSlots();
  }
}

async function startRandomApiBattleByMode() {
  if (state.battleMode === "6v6") {
    await startRandomSixVsSixFight();
    return;
  }
  await startRandomPokemonFight();
}

async function startRandomPokemonFight() {
  setBattleStatus("Loading random Pokemon from PokeAPI...");
  const mons = await getRandomApiBattleMons(2);
  if (mons.length < 2) {
    toast("Could not load random Pokemon right now. Please try again.");
    return;
  }
  const [leftMon, rightMon] = mons;

  setBattleMode("1v1");
  beginBattle([leftMon], [rightMon], "Random Left", "Random Right");
}

function pickRandomUnique(source, count) {
  const pool = [...source];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

async function startRandomSixVsSixFight() {
  setBattleStatus("Loading random 6v6 squads from PokeAPI...");
  const mons = await getRandomApiBattleMons(12);
  if (mons.length < 12) {
    toast("Could not load full random 6v6 from PokeAPI. Please try again.");
    return;
  }

  const leftMons = mons.slice(0, 6);
  const rightMons = mons.slice(6, 12);

  beginBattle(
    leftMons.map(cloneMon),
    rightMons.map(cloneMon),
    "Random Squad A",
    "Random Squad B"
  );
  setBattleMode("6v6");
}

function cloneMon(mon) {
  return {
    ...mon,
    types: [...mon.types],
    stats: { ...mon.stats },
    moves: mon.moves.map((m) => ({ ...m })),
    maxHp: mon.maxHp,
    currentHp: mon.currentHp,
  };
}

async function buildTeamForBattle(team, singlePokemonId = null) {
  const ids = Array.isArray(team?.pokemon_ids) ? team.pokemon_ids : [];
  const selectedIds = singlePokemonId ? [singlePokemonId] : ids;
  const cards = selectedIds
    .map((pid) => getCapturedByPokemonId(pid))
    .filter(Boolean);

  return Promise.all(cards.map((card) => buildBattleMonAsync(card)));
}

async function startBattle() {
  stopBattle();

  const playerTeam = getTeamById(document.getElementById("player-team-select").value);
  const opponentTeam = getTeamById(document.getElementById("opponent-team-select").value);

  if (!playerTeam || !opponentTeam) {
    toast("Select both teams first.");
    return;
  }

  const playerSingleId = Number(document.getElementById("player-slot-select").value || 0);
  const opponentSingleId = Number(document.getElementById("opponent-slot-select").value || 0);

  setBattleStatus("Loading move data for battle...");
  const playerMons = (await buildTeamForBattle(playerTeam, state.battleMode === "1v1" ? playerSingleId : null)).map(cloneMon);
  const opponentMons = (await buildTeamForBattle(opponentTeam, state.battleMode === "1v1" ? opponentSingleId : null)).map(cloneMon);

  if (state.battleMode === "1v1" && (!playerSingleId || !opponentSingleId)) {
    toast("Select one Pokemon for each side in 1v1 mode.");
    return;
  }

  if (playerMons.length === 0 || opponentMons.length === 0) {
    toast("Selected teams are missing Pokemon from your collection.");
    return;
  }

  beginBattle(
    playerMons,
    opponentMons,
    playerTeam.team_name || "Player Team",
    opponentTeam.team_name || "Opponent Team"
  );
}

function beginBattle(playerMons, opponentMons, leftTeamName, rightTeamName) {
  state.battle = {
    leftTeamName,
    rightTeamName,
    leftMons: playerMons,
    rightMons: opponentMons,
    leftIndex: 0,
    rightIndex: 0,
    turn: 1,
  };

  state.battleActive = true;
  document.getElementById("battle-log").innerHTML = "";
  setBattleStatus(`Battle started: ${state.battle.leftTeamName} vs ${state.battle.rightTeamName}`);

  openArenaModal(leftTeamName, rightTeamName);
  renderArena();
  playArenaIntro();

  state.battleTimer = setTimeout(() => {
    if (!state.battleActive) return;
    runTurn();
  }, BATTLE_PRELOAD_MS);
}

function playArenaIntro() {
  const leftSprite = document.getElementById("left-sprite");
  const rightSprite = document.getElementById("right-sprite");
  const leftBall = document.getElementById("arena-player-pokeball");
  const rightBall = document.getElementById("arena-opponent-pokeball");
  const battle = state.battle;

  if (!leftSprite || !rightSprite || !leftBall || !rightBall || !battle) return;

  leftSprite.classList.remove("intro-active");
  rightSprite.classList.remove("intro-active");
  leftSprite.classList.add("intro-hidden");
  rightSprite.classList.add("intro-hidden");

  leftBall.classList.remove("throw-player");
  rightBall.classList.remove("throw-opponent");
  void leftBall.offsetWidth;
  void rightBall.offsetWidth;
  leftBall.classList.add("throw-player");
  rightBall.classList.add("throw-opponent");

  setBattleStatus("Trainers send out their Pokemon...");

  setTimeout(() => {
    if (!state.battleActive) return;
    leftBall.classList.remove("throw-player");
    rightBall.classList.remove("throw-opponent");
    leftBall.style.opacity = "0";
    rightBall.style.opacity = "0";

    leftSprite.classList.remove("intro-hidden");
    rightSprite.classList.remove("intro-hidden");
    leftSprite.classList.add("intro-active");
    rightSprite.classList.add("intro-active");
  }, 1300);
}

function stopBattle() {
  state.battleActive = false;
  if (state.battleTimer) {
    clearInterval(state.battleTimer);
    clearTimeout(state.battleTimer);
    state.battleTimer = null;
  }
  closeArenaModal();
}

function runTurn() {
  if (!state.battleActive) return;

  const battle = state.battle;
  if (!battle) return;

  const left = battle.leftMons[battle.leftIndex];
  const right = battle.rightMons[battle.rightIndex];

  if (!left || !right) {
    finishBattle();
    return;
  }

  const leftFirst = left.stats.speed >= right.stats.speed;
  const first = leftFirst ? { side: "left", attacker: left, defender: right } : { side: "right", attacker: right, defender: left };
  const second = leftFirst ? { side: "right", attacker: right, defender: left } : { side: "left", attacker: left, defender: right };

  runAttackStep(first.side, first.attacker, first.defender, () => {
    if (!state.battleActive) return;

    if (isBattleOver()) {
      finishBattle();
      return;
    }

    if (first.defender.currentHp <= 0) {
      finalizeTurn();
      return;
    }

    runAttackStep(second.side, second.attacker, second.defender, () => {
      if (!state.battleActive) return;
      finalizeTurn();
    });
  });
}

function runAttackStep(attackerSide, attacker, defender, done) {
  const outcome = processAttack(attackerSide, attacker, defender);
  renderArena();

  const wait = (outcome?.delayMs || BATTLE_STEP_HIT_MS) + (outcome?.fainted ? BATTLE_FAINT_PAUSE_MS : 0);
  setTimeout(() => {
    if (!state.battleActive) return;
    done();
  }, wait);
}

function finalizeTurn() {
  handleFaints();
  renderArena();

  const battle = state.battle;
  if (!battle) return;

  battle.turn += 1;

  if (isBattleOver()) {
    finishBattle();
    return;
  }

  state.battleTimer = setTimeout(() => {
    if (!state.battleActive) return;
    runTurn();
  }, BATTLE_NEXT_TURN_MS);
}

function processAttack(attackerSide, attacker, defender) {
  const move = attacker.moves[Math.floor(Math.random() * attacker.moves.length)] || {
    name: "struggle",
    power: 50,
    type: attacker.types[0] || "normal",
    category: "physical",
  };

  const result = attackWithMove(attacker, defender, move);

  if (!result.hit) {
    triggerBattleFx(attackerSide, false);
    showDialogue(attackerSide, `${titleCase(attacker.name)} missed ${titleCase(move.name)}!`);
    appendLog(`${titleCase(attacker.name)} used ${titleCase(move.name)}, but it missed.`);
    const actingMiss = attackerSide === "left" ? "Your" : "Opponent";
    setBattleStatus(`${actingMiss} ${titleCase(attacker.name)} missed ${titleCase(move.name)}.`);
    return { fainted: false, delayMs: BATTLE_STEP_MISS_MS };
  }

  if (result.statusOnly) {
    triggerBattleFx(attackerSide, false);
    showDialogue(attackerSide, `${titleCase(attacker.name)} used ${titleCase(move.name)}!`);
    appendLog(`${titleCase(attacker.name)} used ${titleCase(move.name)}. It dealt no direct damage.`);
    const actingStatus = attackerSide === "left" ? "Your" : "Opponent";
    setBattleStatus(`${actingStatus} ${titleCase(attacker.name)} used ${titleCase(move.name)}.`);
    return { fainted: false, delayMs: BATTLE_STEP_STATUS_MS };
  }

  triggerBattleFx(attackerSide, true);
  showDialogue(attackerSide, `${titleCase(attacker.name)} used ${titleCase(move.name)}!`);
  triggerHpDamage(attackerSide === "left" ? "right" : "left");
  const effectiveText = result.typeMult > 1 ? " It's super effective." : result.typeMult < 1 ? " It's not very effective." : "";
  appendLog(`${titleCase(attacker.name)} used ${titleCase(move.name)} and dealt ${result.damage} damage.${effectiveText}`);

  const defenderFainted = defender.currentHp <= 0;
  if (defenderFainted) {
    setTimeout(() => {
      appendLog(`${titleCase(defender.name)} fainted.`);
    }, BATTLE_STEP_HIT_MS - 500);
  }

  const acting = attackerSide === "left" ? "Your" : "Opponent";
  setBattleStatus(`${acting} ${titleCase(attacker.name)} attacked with ${titleCase(move.name)}.`);
  return { fainted: defenderFainted, delayMs: BATTLE_STEP_HIT_MS };
}

function triggerHpDamage(defenderSide) {
  const prefix = defenderSide === "left" ? "left" : "right";
  const fill = document.getElementById(`${prefix}-hp-fill`);
  const wrap = fill?.parentElement;
  if (!wrap) return;

  wrap.classList.remove("damage");
  void wrap.offsetWidth;
  wrap.classList.add("damage");

  setTimeout(() => {
    wrap.classList.remove("damage");
  }, 360);
}

function attackWithMove(attacker, defender, move) {
  const attackerPower = Number(attacker.powerRating || computePowerRating(attacker.stats || {}, attacker.rarityTag || "") || 300);
  const defenderPower = Number(defender.powerRating || computePowerRating(defender.stats || {}, defender.rarityTag || "") || 300);
  const powerRatio = attackerPower / Math.max(1, defenderPower);

  const accuracy = Math.max(1, Math.min(100, Number(move.accuracy || 100)));
  const accuracyRoll = Math.random() * 100;
  const strongerByTier = powerRatio >= 1.35;

  if (!strongerByTier && accuracyRoll > accuracy) {
    return { hit: false, damage: 0, typeMult: 1, statusOnly: false };
  }

  if (move.category === "status" || Number(move.power || 0) <= 0) {
    return { hit: true, damage: 0, typeMult: 1, statusOnly: true };
  }

  const attackStat = move.category === "special" ? attacker.stats.spAttack : attacker.stats.attack;
  const defenseStat = move.category === "special" ? defender.stats.spDefense : defender.stats.defense;

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const typeMult = getTypeMultiplier(move.type, defender.types);
  const randomFactor = 0.92 + Math.random() * 0.08;

  // Power protection: heavily favor stronger Pokemon to prevent low-tier upset wins.
  const dominanceBoost = Math.min(2.6, Math.max(0.42, Math.pow(powerRatio, 1.35)));
  const guaranteedEdge = strongerByTier ? 1.22 : 1;

  const scaled = ((attackStat / Math.max(1, defenseStat)) * move.power * stab * typeMult * randomFactor * dominanceBoost * guaranteedEdge) / 2.4;
  let damage = Math.max(1, Math.floor(scaled));

  if (powerRatio >= 1.55) {
    const minimumDamage = Math.ceil((defender.maxHp || 1) * 0.32);
    damage = Math.max(damage, minimumDamage);
  }

  if (powerRatio <= 0.7) {
    const maximumDamage = Math.max(1, Math.floor((defender.maxHp || 1) * 0.16));
    damage = Math.min(damage, maximumDamage);
  }

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  return { hit: true, damage, typeMult, statusOnly: false };
}

function getFallbackMove(mon) {
  return {
    name: "struggle",
    power: 50,
    type: mon.types[0] || "normal",
    category: "physical",
  };
}

async function startModalBattleFromSelection() {
  const playerTeam = getTeamById(document.getElementById("player-team-select").value);
  if (!playerTeam) {
    toast("Select your team first.");
    return;
  }

  const mode = state.battleMode;
  const playerSingleId = Number(document.getElementById("player-slot-select").value || 0);
  const opponentSingleId = Number(document.getElementById("opponent-slot-select").value || 0);
  const source = document.getElementById("modal-opponent-source")?.value || "selected-team";

  let playerMons = [];
  let cpuMons = [];
  let cpuLabel = "CPU";

  setBattleStatus("Preparing User vs CPU battle...");

  if (mode === "1v1") {
    if (!playerSingleId) {
      toast("Pick your 1v1 slot first.");
      return;
    }
    playerMons = await buildTeamForBattle(playerTeam, playerSingleId);
  } else {
    playerMons = await buildTeamForBattle(playerTeam);
  }

  if (source === "selected-team") {
    const opponentTeam = getTeamById(document.getElementById("opponent-team-select").value);
    if (!opponentTeam) {
      toast("Select an opponent team or change CPU source.");
      return;
    }
    cpuLabel = opponentTeam.team_name || "CPU Team";
    if (mode === "1v1") {
      if (!opponentSingleId) {
        toast("Pick opponent 1v1 slot first.");
        return;
      }
      cpuMons = await buildTeamForBattle(opponentTeam, opponentSingleId);
    } else {
      cpuMons = await buildTeamForBattle(opponentTeam);
    }
  } else if (source === "cpu-random-team") {
    const teamPool = state.teams.filter((t) => String(t.id) !== String(playerTeam.id));
    if (teamPool.length === 0) {
      toast("No other saved team available for CPU random pick.");
      return;
    }
    const randomTeam = teamPool[Math.floor(Math.random() * teamPool.length)];
    cpuLabel = `${randomTeam.team_name || "CPU Team"} (Random)`;
    if (mode === "1v1") {
      const ids = Array.isArray(randomTeam.pokemon_ids) ? randomTeam.pokemon_ids : [];
      const randomId = Number(ids[Math.floor(Math.random() * ids.length)] || 0);
      if (!randomId) {
        toast("Random CPU team has no valid Pokemon.");
        return;
      }
      cpuMons = await buildTeamForBattle(randomTeam, randomId);
    } else {
      cpuMons = await buildTeamForBattle(randomTeam);
    }
  } else {
    cpuLabel = "CPU Random (PokeAPI)";
    const needed = mode === "1v1" ? 1 : 6;
    setBattleStatus(`Loading ${needed} random Pokemon from PokeAPI...`);
    cpuMons = await getRandomApiBattleMons(needed);
  }

  playerMons = playerMons.map(cloneMon).filter(Boolean);
  cpuMons = cpuMons.map(cloneMon).filter(Boolean);

  if (playerMons.length === 0 || cpuMons.length === 0) {
    toast("Could not prepare modal battle. Check team selections and try again.");
    return;
  }

  openBattleModal(playerMons, cpuMons, cpuLabel, mode);
}

function openBattleModal(playerMons, cpuMons, cpuLabel, mode) {
  closeBattleModal();

  const modal = document.getElementById("battle-modal");
  const loading = document.getElementById("battle-modal-loading");
  const text = document.getElementById("battle-modal-text");

  state.modalBattle = {
    mode,
    playerTeamName: "You",
    cpuTeamName: cpuLabel || "CPU",
    playerTeam: playerMons,
    cpuTeam: cpuMons,
    playerIndex: 0,
    cpuIndex: 0,
    busy: true,
    over: false,
  };

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  loading.textContent = "Loading battle arena...";
  loading.style.display = "block";
  text.textContent = "Loading battle...";
  hideModalBattleResult();

  renderModalBattle();
  renderModalMoveButtons(true);

  state.modalLoadingTimer = setTimeout(() => {
    if (!state.modalBattle) return;
    state.modalBattle.busy = false;
    loading.style.display = "none";
    const active = getActiveModalMon("player");
    text.textContent = `What will ${titleCase(active?.name || "your Pokemon")} do?`;
    renderModalMoveButtons(false);
  }, 900);
}

function closeBattleModal() {
  const modal = document.getElementById("battle-modal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (state.modalLoadingTimer) {
    clearTimeout(state.modalLoadingTimer);
    state.modalLoadingTimer = null;
  }
  hideModalBattleResult();
  state.modalBattle = null;
}

function showModalBattleResult(title, message) {
  const result = document.getElementById("battle-modal-result");
  if (!result) return;
  result.textContent = `${title} ${message}`;
  result.classList.add("show");
}

function hideModalBattleResult() {
  const result = document.getElementById("battle-modal-result");
  if (!result) return;
  result.textContent = "";
  result.classList.remove("show");
}

function renderModalBattle() {
  const battle = state.modalBattle;
  if (!battle) return;

  const player = getActiveModalMon("player");
  const cpu = getActiveModalMon("cpu");

  if (!player || !cpu) return;

  document.getElementById("modal-player-sprite").src = spriteBack(player.id);
  document.getElementById("modal-cpu-sprite").src = spriteFront(cpu.id);
  document.getElementById("modal-player-name").textContent = titleCase(player.name);
  document.getElementById("modal-cpu-name").textContent = titleCase(cpu.name);
  paintModalHp("player", player.currentHp, player.maxHp);
  paintModalHp("cpu", cpu.currentHp, cpu.maxHp);
}

function paintModalHp(side, hp, maxHp) {
  const ratio = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));
  const fill = document.getElementById(`modal-${side}-hp-fill`);
  const text = document.getElementById(`modal-${side}-hp-text`);
  fill.style.width = `${ratio}%`;
  if (ratio > 50) {
    fill.style.background = "linear-gradient(90deg, #5af08c, #35c96b)";
  } else if (ratio > 20) {
    fill.style.background = "linear-gradient(90deg, #ffd66b, #ffb84c)";
  } else {
    fill.style.background = "linear-gradient(90deg, #ff7a7a, #ff4f66)";
  }
  text.textContent = `HP: ${Math.max(0, hp)} / ${maxHp}`;
}

function renderModalMoveButtons(disabled) {
  const wrap = document.getElementById("battle-modal-moves");
  wrap.innerHTML = "";
  const battle = state.modalBattle;
  if (!battle) return;

  const activePlayer = getActiveModalMon("player");
  const moves = ((activePlayer?.moves || []).slice(0, 4));
  moves.forEach((move, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "move-action-btn";
    btn.textContent = `${idx + 1}. ${titleCase(move.name)}`;
    btn.disabled = disabled || battle.busy || battle.over;
    btn.addEventListener("click", () => playerMoveTurn(move));
    wrap.appendChild(btn);
  });
}

function setModalText(message) {
  document.getElementById("battle-modal-text").textContent = message;
}

function showDialogue(side, message) {
  const id = side === "left" ? "left-dialogue" : "right-dialogue";
  const bubble = document.getElementById(id);
  if (!bubble) return;

  bubble.textContent = message;
  bubble.classList.add("show");
  clearTimeout(bubble._hideTimer);
  bubble._hideTimer = setTimeout(() => {
    bubble.classList.remove("show");
  }, 1900);
}

function showModalDialogue(side, message) {
  const id = side === "left" ? "modal-player-dialogue" : "modal-cpu-dialogue";
  const bubble = document.getElementById(id);
  if (!bubble) return;

  bubble.textContent = message;
  bubble.classList.add("show");
  clearTimeout(bubble._hideTimer);
  bubble._hideTimer = setTimeout(() => {
    bubble.classList.remove("show");
  }, 900);
}

function triggerBattleFx(attackerSide, didDamage) {
  const stage = document.getElementById("arena-stage");
  if (!stage) return;

  stage.classList.remove("attack-left", "attack-right", "damage-left", "damage-right");
  const attackClass = attackerSide === "left" ? "attack-left" : "attack-right";
  const damageClass = attackerSide === "left" ? "damage-right" : "damage-left";
  stage.classList.add(attackClass);
  if (didDamage) stage.classList.add(damageClass);

  setTimeout(() => {
    stage.classList.remove(attackClass);
    stage.classList.remove(damageClass);
  }, 260);
}

function triggerModalFx(attackerSide, didDamage) {
  const stage = document.getElementById("battle-modal-stage");
  if (!stage) return;

  stage.classList.remove("attack-left", "attack-right", "damage-left", "damage-right");
  const attackClass = attackerSide === "left" ? "attack-left" : "attack-right";
  const damageClass = attackerSide === "left" ? "damage-right" : "damage-left";
  stage.classList.add(attackClass);
  if (didDamage) stage.classList.add(damageClass);

  setTimeout(() => {
    stage.classList.remove(attackClass);
    stage.classList.remove(damageClass);
  }, 260);
}

function getActiveModalMon(side) {
  const battle = state.modalBattle;
  if (!battle) return null;
  if (side === "player") {
    return battle.playerTeam[battle.playerIndex] || null;
  }
  return battle.cpuTeam[battle.cpuIndex] || null;
}

function advanceModalMon(side) {
  const battle = state.modalBattle;
  if (!battle) return false;

  if (side === "player") {
    battle.playerIndex += 1;
    return battle.playerIndex < battle.playerTeam.length;
  }

  battle.cpuIndex += 1;
  return battle.cpuIndex < battle.cpuTeam.length;
}

function playerMoveTurn(move) {
  const battle = state.modalBattle;
  if (!battle || battle.busy || battle.over) return;

  battle.busy = true;
  renderModalMoveButtons(true);

  const player = getActiveModalMon("player");
  const cpu = getActiveModalMon("cpu");
  if (!player || !cpu) return;

  const usedMove = move || getFallbackMove(player);
  const playerResult = attackWithMove(player, cpu, usedMove);

  if (!playerResult.hit) {
    triggerModalFx("left", false);
    showModalDialogue("left", `${titleCase(player.name)} missed!`);
    setModalText(`${titleCase(player.name)} used ${titleCase(usedMove.name)}, but it missed.`);
    setTimeout(() => {
      cpuMoveTurn();
    }, MODAL_CPU_RESPONSE_MS);
    return;
  }

  if (playerResult.statusOnly) {
    triggerModalFx("left", false);
    showModalDialogue("left", `${titleCase(player.name)} used ${titleCase(usedMove.name)}.`);
    setModalText(`${titleCase(player.name)} used ${titleCase(usedMove.name)}. It dealt no direct damage.`);
    setTimeout(() => {
      cpuMoveTurn();
    }, MODAL_CPU_RESPONSE_MS);
    return;
  }

  triggerModalFx("left", true);
  showModalDialogue("left", `${titleCase(player.name)} used ${titleCase(usedMove.name)}!`);
  renderModalBattle();

  const playerEffect = playerResult.typeMult > 1 ? " It's super effective." : playerResult.typeMult < 1 ? " It's not very effective." : "";
  setModalText(`${titleCase(player.name)} used ${titleCase(usedMove.name)} and dealt ${playerResult.damage} damage.${playerEffect}`);

  if (cpu.currentHp <= 0) {
    const cpuHasNext = advanceModalMon("cpu");
    if (!cpuHasNext) {
      battle.over = true;
      setTimeout(() => {
        renderModalBattle();
        const finalMsg = `${titleCase(cpu.name)} fainted. You win!`;
        setModalText(finalMsg);
        showModalBattleResult("Victory!", `${titleCase(player.name)} defeated ${titleCase(cpu.name)}.`);
        renderModalMoveButtons(true);
      }, MODAL_FAINT_PAUSE_MS);
      return;
    }

    renderModalBattle();
    setTimeout(() => {
      setModalText(`${titleCase(cpu.name)} fainted. ${titleCase(getActiveModalMon("cpu")?.name || "CPU")} enters the battle.`);
      setTimeout(() => {
        cpuMoveTurn();
      }, MODAL_CPU_RESPONSE_MS);
    }, MODAL_FAINT_PAUSE_MS);
    return;
  }

  setTimeout(() => {
    cpuMoveTurn();
  }, MODAL_CPU_RESPONSE_MS);
}

function cpuMoveTurn() {
  const battle = state.modalBattle;
  if (!battle || battle.over) return;

  const cpu = getActiveModalMon("cpu");
  const player = getActiveModalMon("player");
  if (!cpu || !player) return;

  const cpuMove = cpu.moves[Math.floor(Math.random() * cpu.moves.length)] || getFallbackMove(cpu);
  const cpuResult = attackWithMove(cpu, player, cpuMove);

  if (!cpuResult.hit) {
    triggerModalFx("right", false);
    showModalDialogue("right", `${titleCase(cpu.name)} missed!`);
    setModalText(`${titleCase(cpu.name)} used ${titleCase(cpuMove.name)}, but it missed.`);
    battle.busy = false;
    setTimeout(() => {
      setModalText(`What will ${titleCase(player.name)} do?`);
      renderModalMoveButtons(false);
    }, MODAL_PLAYER_PROMPT_MS);
    return;
  }

  if (cpuResult.statusOnly) {
    triggerModalFx("right", false);
    showModalDialogue("right", `${titleCase(cpu.name)} used ${titleCase(cpuMove.name)}.`);
    setModalText(`${titleCase(cpu.name)} used ${titleCase(cpuMove.name)}. It dealt no direct damage.`);
    battle.busy = false;
    setTimeout(() => {
      setModalText(`What will ${titleCase(player.name)} do?`);
      renderModalMoveButtons(false);
    }, MODAL_PLAYER_PROMPT_MS);
    return;
  }

  triggerModalFx("right", true);
  showModalDialogue("right", `${titleCase(cpu.name)} used ${titleCase(cpuMove.name)}!`);
  renderModalBattle();

  const cpuEffect = cpuResult.typeMult > 1 ? " It's super effective." : cpuResult.typeMult < 1 ? " It's not very effective." : "";
  setModalText(`${titleCase(cpu.name)} used ${titleCase(cpuMove.name)} and dealt ${cpuResult.damage} damage.${cpuEffect}`);

  if (player.currentHp <= 0) {
    const playerHasNext = advanceModalMon("player");
    if (!playerHasNext) {
      battle.over = true;
      setTimeout(() => {
        renderModalBattle();
        const finalMsg = `${titleCase(player.name)} fainted. CPU wins.`;
        setModalText(finalMsg);
        showModalBattleResult("Defeat!", `${titleCase(cpu.name)} defeated ${titleCase(player.name)}.`);
        renderModalMoveButtons(true);
      }, MODAL_FAINT_PAUSE_MS);
      return;
    }

    renderModalBattle();
    setTimeout(() => {
      setModalText(`${titleCase(player.name)} fainted. Go, ${titleCase(getActiveModalMon("player")?.name || "next Pokemon")}!`);
      battle.busy = false;
      renderModalMoveButtons(false);
    }, MODAL_FAINT_PAUSE_MS);
    return;
  }

  battle.busy = false;
  setTimeout(() => {
    setModalText(`What will ${titleCase(player.name)} do?`);
    renderModalMoveButtons(false);
  }, MODAL_PLAYER_PROMPT_MS);
}

function handleFaints() {
  const battle = state.battle;

  if (battle.leftMons[battle.leftIndex] && battle.leftMons[battle.leftIndex].currentHp <= 0) {
    battle.leftIndex += 1;
  }

  if (battle.rightMons[battle.rightIndex] && battle.rightMons[battle.rightIndex].currentHp <= 0) {
    battle.rightIndex += 1;
  }
}

function isBattleOver() {
  const battle = state.battle;
  return battle.leftIndex >= battle.leftMons.length || battle.rightIndex >= battle.rightMons.length;
}

function finishBattle() {
  state.battleActive = false;
  if (state.battleTimer) {
    clearInterval(state.battleTimer);
    state.battleTimer = null;
  }

  const battle = state.battle;
  if (!battle) return;

  const leftLost = battle.leftIndex >= battle.leftMons.length;
  const rightLost = battle.rightIndex >= battle.rightMons.length;

  let title = "Battle Over";
  let message = "Draw!";

  const leftMon = battle.leftMons[Math.max(0, battle.leftIndex - 1)] || battle.leftMons[0];
  const rightMon = battle.rightMons[Math.max(0, battle.rightIndex - 1)] || battle.rightMons[0];
  const leftName = titleCase(leftMon?.name || "Pokemon");
  const rightName = titleCase(rightMon?.name || "Pokemon");

  if (leftLost && rightLost) {
    message = `${leftName} and ${rightName} both fainted. It's a draw!`;
  } else if (leftLost) {
    title = "Defeated!";
    message = `${rightName} defeated ${leftName}!`;
  } else if (rightLost) {
    title = "Victory!";
    message = `${leftName} defeated ${rightName}!`;
  }

  showBattleResult(title, message);
}

function renderArena() {
  const battle = state.battle;
  if (!battle) {
    paintFighter("left", null);
    paintFighter("right", null);
    return;
  }

  paintFighter("left", battle.leftMons[battle.leftIndex] || null);
  paintFighter("right", battle.rightMons[battle.rightIndex] || null);
}

function paintFighter(side, mon) {
  const prefix = side === "left" ? "left" : "right";
  const img = document.getElementById(`${prefix}-sprite`);
  const name = document.getElementById(`${prefix}-name`);
  const hpFill = document.getElementById(`${prefix}-hp-fill`);
  const hpText = document.getElementById(`${prefix}-hp-text`);

  if (!mon) {
    img.src = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
    name.textContent = "-";
    hpFill.style.width = "0%";
    hpText.textContent = "HP: -";
    return;
  }

  img.src = side === "left" ? spriteBack(mon.id) : spriteFront(mon.id);
  name.textContent = titleCase(mon.name);

  const ratio = Math.max(0, Math.min(100, Math.round((mon.currentHp / mon.maxHp) * 100)));
  hpFill.style.width = `${ratio}%`;

  if (ratio > 50) {
    hpFill.style.background = "linear-gradient(90deg, #5af08c, #35c96b)";
  } else if (ratio > 20) {
    hpFill.style.background = "linear-gradient(90deg, #ffd66b, #ffb84c)";
  } else {
    hpFill.style.background = "linear-gradient(90deg, #ff7a7a, #ff4f66)";
  }

  hpText.textContent = `HP: ${Math.max(0, mon.currentHp)} / ${mon.maxHp}`;
}

function getTypeMultiplier(moveType, defenderTypes) {
  const chart = TYPE_EFFECTIVENESS[moveType] || {};
  return defenderTypes.reduce((mult, type) => mult * (chart[type] ?? 1), 1);
}

function setBattleStatus(text) {
  const status = document.getElementById("battle-status");
  if (!status) return;
  status.textContent = text;

  const arenaStatus = document.getElementById("arena-battle-status");
  if (arenaStatus) {
    arenaStatus.textContent = text;
  }
}

function appendLog(text) {
  const log = document.getElementById("battle-log");
  if (!log) return;
  const li = document.createElement("li");
  li.textContent = text
    .replace("used", "")
    .replace("and dealt", "-")
    .replace("damage.", "dmg")
    .trim();
  log.appendChild(li);
  while (log.children.length > 6) {
    log.removeChild(log.firstChild);
  }
  log.scrollTop = log.scrollHeight;
}

function openArenaModal(leftTeamName, rightTeamName) {
  const modal = document.getElementById("arena-modal");
  if (!modal) return;
  document.getElementById("arena-title").textContent = `${leftTeamName} vs ${rightTeamName}`;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeArenaModal() {
  stopBattle();
  const modal = document.getElementById("arena-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  const resultOverlay = document.getElementById("battle-result-overlay");
  if (resultOverlay) {
    resultOverlay.style.display = "none";
  }
}

function showBattleResult(title, message) {
  const overlay = document.getElementById("battle-result-overlay");
  if (!overlay) return;
  document.getElementById("result-title").textContent = title;
  document.getElementById("result-message").textContent = message;
  overlay.style.display = "flex";
}

function spriteFront(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${Number(id)}.png`;
}

function spriteBack(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${Number(id)}.png`;
}

function titleCase(value) {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let toastTimer = null;
function toast(message) {
  const el = document.getElementById("teams-toast");
  el.textContent = message;
  el.classList.add("show");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2500);
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

// Game-like move ranking:
// Prefer modern version groups + practical learn methods, then rank by
// damage potential (power, accuracy, STAB and Atk/Sp.Atk fit).
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
    { name: titleCase(primary), power: 70, type: primary, accuracy: 100, category: "special" },
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
  if (!apiData) return fallback.slice(0, 4);

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

    const normalized = {
      name: details.name || titleCase(candidateNames[i]),
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

  const typedBest = new Map();
  strongMoves.forEach((mv) => {
    const prev = typedBest.get(mv.type);
    if (!prev || moveBattleScore(mv, monTypes, stats) > moveBattleScore(prev, monTypes, stats)) {
      typedBest.set(mv.type, mv);
    }
  });

  const selected = [];
  const pickedNames = new Set();

  // Prefer at least one damaging move per Pokemon type when available.
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
