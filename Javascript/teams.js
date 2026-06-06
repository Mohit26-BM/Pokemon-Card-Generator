const state = {
  user: null,
  captured: [],
  teams: [],
  selectedPokemonIds: [],
  battleMode: "1v1",
  battlePath: "random",
  opponentSource: "my-team",
  battleTimer: null,
  battleActive: false,
  battle: null,
  modalBattle: null,
  modalLoadingTimer: null,
};

const pokemonBattleCache = new Map();
const POKEAPI_RANDOM_MAX_ID = 1025;

const MOVE_TYPE_COLORS = {
  normal:   { bg: "#A8A878", text: "#1a1a1a" },
  fire:     { bg: "#F08030", text: "#1a1a1a" },
  water:    { bg: "#6890F0", text: "#fff" },
  electric: { bg: "#F8D030", text: "#1a1a1a" },
  grass:    { bg: "#78C850", text: "#1a1a1a" },
  ice:      { bg: "#98D8D8", text: "#1a1a1a" },
  fighting: { bg: "#C03028", text: "#fff" },
  poison:   { bg: "#A040A0", text: "#fff" },
  ground:   { bg: "#E0C068", text: "#1a1a1a" },
  flying:   { bg: "#A890F0", text: "#1a1a1a" },
  psychic:  { bg: "#F85888", text: "#1a1a1a" },
  bug:      { bg: "#A8B820", text: "#1a1a1a" },
  rock:     { bg: "#B8A038", text: "#fff" },
  ghost:    { bg: "#705898", text: "#fff" },
  dragon:   { bg: "#7038F8", text: "#fff" },
  dark:     { bg: "#705848", text: "#fff" },
  steel:    { bg: "#B8B8D0", text: "#1a1a1a" },
  fairy:    { bg: "#EE99AC", text: "#1a1a1a" },
};
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
  document.getElementById("path-random").addEventListener("click", () => setBattlePath("random"));
  document.getElementById("path-pick").addEventListener("click", () => setBattlePath("pick"));
  document.getElementById("start-random-battle-btn").addEventListener("click", startRandomApiBattleByMode);
  document.getElementById("start-interactive-battle-btn").addEventListener("click", startModalBattleFromSelection);
  document.getElementById("opp-my-team-btn").addEventListener("click", () => setOpponentSource("my-team"));
  document.getElementById("opp-random-btn").addEventListener("click", () => setOpponentSource("random-api"));
  document.getElementById("player-team-select").addEventListener("change", refreshBattleSetupUI);
  document.getElementById("opponent-team-select").addEventListener("change", refreshBattleSetupUI);

  document.getElementById("arena-modal-close-x").addEventListener("click", closeArenaModal);
  document.getElementById("arena-modal-close-btn").addEventListener("click", closeArenaModal);

  const modal = document.getElementById("battle-modal");
  document.getElementById("battle-modal-close").addEventListener("click", closeBattleModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeBattleModal();
  });
  document.getElementById("battle-modal-new-battle-btn").addEventListener("click", closeBattleModal);
  document.getElementById("battle-modal-result-close").addEventListener("click", closeBattleModal);
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
      <p><a href="../index.html" style="color:#9ad8ff">Back to Generator</a></p>
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
    setBattleStatus(`Fetching Pokemon ${mons.length + 1} of ${count}...`);
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

      refreshBattleSetupUI();
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
  const playerTeamSelect = document.getElementById("player-team-select");
  const opponentTeamSelect = document.getElementById("opponent-team-select");

  const teamOptions = ['<option value="">Select a team</option>'];
  state.teams.forEach((team) => {
    teamOptions.push(`<option value="${team.id}">${escapeHtml(team.team_name || `Team ${team.id}`)}</option>`);
  });

  playerTeamSelect.innerHTML = teamOptions.join("");
  opponentTeamSelect.innerHTML = teamOptions.join("");

  if (state.teams.length >= 1) playerTeamSelect.value = String(state.teams[0].id);
  if (state.teams.length >= 2) opponentTeamSelect.value = String(state.teams[1].id);

  const playerPokemonSelect = document.getElementById("player-pokemon-select");
  const opponentPokemonSelect = document.getElementById("opponent-pokemon-select");
  const pokemonOptions = ['<option value="">Pick a Pokemon</option>'];
  [...state.captured]
    .sort((a, b) => String(a.pokemon_name || "").localeCompare(String(b.pokemon_name || "")))
    .forEach((card) => {
      const id = Number(card.pokemon_id);
      pokemonOptions.push(`<option value="${id}">${escapeHtml(titleCase(card.pokemon_name || `Pokemon ${id}`))}</option>`);
    });
  playerPokemonSelect.innerHTML = pokemonOptions.join("");
  opponentPokemonSelect.innerHTML = pokemonOptions.join("");

  refreshBattleSetupUI();
}

function getTeamById(teamId) {
  return state.teams.find((t) => String(t.id) === String(teamId));
}

function refreshBattleSetupUI() {
  const mode = state.battleMode;
  const path = state.battlePath;
  const source = state.opponentSource;
  const isPickPath = path === "pick";
  const is1v1 = mode === "1v1";

  document.getElementById("player-pokemon-select").classList.toggle("hidden", !isPickPath || !is1v1);
  document.getElementById("player-team-select").classList.toggle("hidden", !isPickPath || is1v1);
  document.getElementById("opponent-pokemon-select").classList.toggle("hidden", !isPickPath || !is1v1 || source === "random-api");
  document.getElementById("opponent-team-select").classList.toggle("hidden", !isPickPath || is1v1 || source === "random-api");

  const oppMyBtn = document.getElementById("opp-my-team-btn");
  if (oppMyBtn) oppMyBtn.textContent = is1v1 ? "My Collection" : "My Team";

  const desc = document.getElementById("random-path-desc");
  if (desc) {
    desc.textContent = is1v1
      ? "Two random Pokemon will be fetched from PokeAPI and battle automatically."
      : "Two random 6-Pokemon squads will be fetched from PokeAPI and battle automatically.";
  }
}


function setBattlePath(path) {
  state.battlePath = path;
  document.getElementById("path-random").classList.toggle("active", path === "random");
  document.getElementById("path-pick").classList.toggle("active", path === "pick");
  document.getElementById("battle-path-random").classList.toggle("hidden", path !== "random");
  document.getElementById("battle-path-pick").classList.toggle("hidden", path !== "pick");
  refreshBattleSetupUI();
}

function setOpponentSource(source) {
  state.opponentSource = source;
  document.getElementById("opp-my-team-btn").classList.toggle("active", source === "my-team");
  document.getElementById("opp-random-btn").classList.toggle("active", source === "random-api");
  refreshBattleSetupUI();
}

function setBattleMode(mode) {
  state.battleMode = mode;
  document.getElementById("mode-1v1").classList.toggle("active", mode === "1v1");
  document.getElementById("mode-6v6").classList.toggle("active", mode === "6v6");
  refreshBattleSetupUI();
}


async function startRandomApiBattleByMode() {
  const btn = document.getElementById("start-random-battle-btn");
  const mode = state.battleMode;
  const count = mode === "6v6" ? 12 : 2;
  const label = mode === "6v6" ? "6 Pokemon each" : "2 Pokemon";

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Fetching ${label}...`;
  }

  try {
    setBattleStatus(`Loading random Pokemon from PokeAPI...`);
    const mons = await getRandomApiBattleMons(count);

    if (mons.length < count) {
      toast("Could not load random Pokemon right now. Please try again.");
      return;
    }

    if (mode === "6v6") {
      openBattleModal(mons.slice(0, 6).map(cloneMon), mons.slice(6, 12).map(cloneMon), "Random CPU", "6v6");
    } else {
      openBattleModal([cloneMon(mons[0])], [cloneMon(mons[1])], "Random CPU", "1v1");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-bolt"></i> Start Random Battle';
    }
  }
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
  const mode = state.battleMode;
  let playerMons = [];
  let cpuMons = [];
  let cpuLabel = "CPU";

  const btn = document.getElementById("start-interactive-battle-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing Battle...';
  }

  try {
    setBattleStatus("Preparing battle...");

    if (mode === "1v1") {
      const playerPokemonId = Number(document.getElementById("player-pokemon-select").value || 0);
      if (!playerPokemonId) {
        toast("Pick your Pokemon first.");
        return;
      }
      const playerCard = getCapturedByPokemonId(playerPokemonId);
      if (!playerCard) {
        toast("Pokemon not found in collection.");
        return;
      }
      playerMons = [await buildBattleMonAsync(playerCard)];
    } else {
      const playerTeam = getTeamById(document.getElementById("player-team-select").value);
      if (!playerTeam) {
        toast("Select your team first.");
        return;
      }
      playerMons = await buildTeamForBattle(playerTeam);
    }

    if (state.opponentSource === "my-team") {
      if (mode === "1v1") {
        const opponentPokemonId = Number(document.getElementById("opponent-pokemon-select").value || 0);
        if (!opponentPokemonId) {
          toast("Pick opponent's Pokemon first.");
          return;
        }
        const opponentCard = getCapturedByPokemonId(opponentPokemonId);
        if (!opponentCard) {
          toast("Opponent Pokemon not found.");
          return;
        }
        cpuLabel = titleCase(opponentCard.pokemon_name || "Opponent");
        cpuMons = [await buildBattleMonAsync(opponentCard)];
      } else {
        const opponentTeam = getTeamById(document.getElementById("opponent-team-select").value);
        if (!opponentTeam) {
          toast("Select opponent team.");
          return;
        }
        cpuLabel = opponentTeam.team_name || "CPU Team";
        cpuMons = await buildTeamForBattle(opponentTeam);
      }
    } else {
      cpuLabel = "Random (PokeAPI)";
      const needed = mode === "1v1" ? 1 : 6;
      setBattleStatus(`Loading ${needed} random Pokemon from PokeAPI...`);
      cpuMons = await getRandomApiBattleMons(needed);
    }

    playerMons = playerMons.map(cloneMon).filter(Boolean);
    cpuMons = cpuMons.map(cloneMon).filter(Boolean);

    if (playerMons.length === 0 || cpuMons.length === 0) {
      toast("Could not prepare battle. Check selections and try again.");
      return;
    }

    openBattleModal(playerMons, cpuMons, cpuLabel, mode);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-gamepad"></i> Start Interactive Battle';
    }
  }
}

function openBattleModal(playerMons, cpuMons, cpuLabel, mode) {
  closeBattleModal();

  const modal = document.getElementById("battle-modal");
  const loading = document.getElementById("battle-modal-loading");
  const text = document.getElementById("battle-modal-text");
  const titleEl = document.getElementById("battle-modal-title");
  if (titleEl) titleEl.textContent = `You vs ${cpuLabel || "CPU"}`;

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
  const overlay = document.getElementById("battle-modal-result-overlay");
  if (!overlay) return;
  document.getElementById("modal-result-title").textContent = title;
  document.getElementById("modal-result-message").textContent = message;
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
}

function hideModalBattleResult() {
  const overlay = document.getElementById("battle-modal-result-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
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

    const typeStyle = MOVE_TYPE_COLORS[move.type] || { bg: "#8a8a9a", text: "#fff" };
    btn.style.background = typeStyle.bg;
    btn.style.color = typeStyle.text;

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

