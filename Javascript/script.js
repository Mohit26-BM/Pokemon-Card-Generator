/*=======================================================================================================================================================================

                                                                   Pokemon Card Generator:

==========================================================================================================================================================================*/

/*=======================================================================================================================================================================
  1. Global Declarations and Variables:
==========================================================================================================================================================================*/

let filteredList = [];

const megaBtn = document.getElementById("mega-btn");
let isMega = false;

function initNavbarToggle() {
  const toggleBtn = document.getElementById('navbar-toggle');
  const navbarMenu = document.getElementById('navbar-menu');
  const NAV_MENU_STATE_KEY = 'pcgNavbarMenuOpen';

  if (!toggleBtn || !navbarMenu) return;

  navbarMenu.classList.add('collapsed');
  toggleBtn.style.display = 'block';

  const wasOpen = localStorage.getItem(NAV_MENU_STATE_KEY) === 'true';
  navbarMenu.classList.toggle('open', wasOpen);
  toggleBtn.setAttribute('aria-expanded', String(wasOpen));

  toggleBtn.addEventListener('click', () => {
    navbarMenu.classList.toggle('open');
    const isOpen = navbarMenu.classList.contains('open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    localStorage.setItem(NAV_MENU_STATE_KEY, String(isOpen));
  });
}

async function initProfileMenu() {
  const profileMenu = document.getElementById("nav-profile-menu");
  const trigger = document.getElementById("nav-profile-trigger");
  const dropdown = document.getElementById("nav-profile-dropdown");
  const nameEl = document.getElementById("nav-profile-name");
  const avatarEl = document.getElementById("nav-profile-avatar");
  const animToggleOption = document.getElementById("nav-anim-toggle-option");
  const signOutOption = document.getElementById("nav-signout-option");

  if (!profileMenu || !trigger || !dropdown) return;

  const defaultAvatar = "Images/default-avatar.png";
  const applyAnimationLabel = () => {
    if (!animToggleOption) return;
    const enabled = (localStorage.getItem("pcgAnimationsEnabled") ?? "true") === "true";
    animToggleOption.innerHTML = enabled
      ? '<i class="fas fa-film"></i> Animations: On'
      : '<i class="fas fa-film"></i> Animations: Off';
  };

  const closeProfileDropdown = () => {
    profileMenu.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  };

  const openProfileDropdown = () => {
    profileMenu.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
  };

  const toggleProfileDropdown = () => {
    if (profileMenu.classList.contains("open")) {
      closeProfileDropdown();
      return;
    }
    openProfileDropdown();
  };

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    toggleProfileDropdown();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProfileDropdown();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleProfileDropdown();
    }
  });

  document.addEventListener("click", (e) => {
    if (!profileMenu.contains(e.target)) {
      closeProfileDropdown();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProfileDropdown();
    }
  });

  applyAnimationLabel();

  if (animToggleOption) {
    animToggleOption.addEventListener("click", () => {
      const current = (localStorage.getItem("pcgAnimationsEnabled") ?? "true") === "true";
      const next = !current;
      localStorage.setItem("pcgAnimationsEnabled", next ? "true" : "false");
      applyAnimationLabel();

      showCustomAlert(`Animations: ${next ? "On" : "Off"}`, 1800);

      if (currentData?.data && currentData?.speciesData) {
        updateUI(
          currentData.data,
          currentData.speciesData,
          currentData.evolutions,
          currentData.topMoves || []
        );
        updateAnalysisPanel(
          currentData.data,
          currentData.speciesData,
          currentData.evolutions,
          currentData.topMoves || []
        );
      }

      closeProfileDropdown();
    });
  }

  if (signOutOption) {
    signOutOption.addEventListener("click", async () => {
      const result = await signOutUser();
      if (!result?.success) {
        showCustomAlert(result?.message || "Sign out failed.", 2500);
        return;
      }

      closeProfileDropdown();
      showCustomAlert("Signed out successfully!", 1700);
      document.getElementById("welcome-screen").style.display = "block";
      document.querySelector(".container").style.display = "none";
      if (window.initWelcomeScreen) {
        window.initWelcomeScreen();
      }
    });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      if (nameEl) nameEl.textContent = "Profile";
      if (avatarEl) avatarEl.src = defaultAvatar;
      return;
    }

    const [trainerRes, profileRes] = await Promise.all([
      getUserProfile(user.id),
      getTrainerProfile(user.id),
    ]);

    const trainerName = trainerRes?.success && trainerRes?.data?.trainer_name
      ? trainerRes.data.trainer_name
      : (user.user_metadata?.trainer_name || user.email?.split("@")[0] || "Trainer");

    const avatarUrl = profileRes?.success && profileRes?.data?.avatar_url
      ? profileRes.data.avatar_url
      : defaultAvatar;

    if (nameEl) nameEl.textContent = trainerName;
    if (avatarEl) {
      avatarEl.src = avatarUrl;
      avatarEl.onerror = () => {
        avatarEl.src = defaultAvatar;
      };
    }
  } catch (err) {
    console.error("Could not load navbar profile info:", err);
    if (nameEl) nameEl.textContent = "Profile";
    if (avatarEl) avatarEl.src = defaultAvatar;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNavbarToggle);
  document.addEventListener('DOMContentLoaded', initProfileMenu);
} else {
  initNavbarToggle();
  initProfileMenu();
}

/*=======================================================================================================================================================================
  2. DOM Elements and State Variables:
==========================================================================================================================================================================*/

const generateBtn = document.getElementById("generate");
const saveCurrentCardBtn = document.getElementById("save-current-card");
const pokemonOfDayBtn = document.getElementById("pokemon-day-btn");
const guessPokemonBtn = document.getElementById("guess-pokemon-btn");
const flipContainer = document.getElementById("flip-container");
const searchBtn = document.getElementById("search-btn");
const searchInput = document.getElementById("search-input");
const welcomeScreen = document.getElementById("welcome-screen");
const mainContainer = document.querySelector(".container");
const radarCompareSelect = document.getElementById("radar-compare-select");
const addCompareBtn = document.getElementById("add-radar-compare");
const clearCompareBtn = document.getElementById("clear-radar-compare");

let currentData = null;
let isShiny = false;
let shinyForced = false;
let activeDisplayData = null;
let activeDisplaySpeciesData = null;
let statsRadarChart = null;
let radarCompareSnapshots = [];
let pokemonOfDayState = null;
let guessPokemonState = null;
let allPokemonCompareOptions = [];
let allPokemonComparePromise = null;

const ALL_POKEMON_LIST_STORAGE_KEY = "allPokemonCompareOptions";
const ALL_POKEMON_LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=2000&offset=0";

/*=======================================================================================================================================================================
  3. Radar / Compare Functions:
==========================================================================================================================================================================*/

function buildAllPokemonCompareOption(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return null;

  return {
    value: normalized,
    label: capitalizeWords(normalized),
    priority: 3,
  };
}

function getStoredAllPokemonCompareOptions() {
  const stored = readStoredJson(ALL_POKEMON_LIST_STORAGE_KEY, []);
  if (!Array.isArray(stored) || stored.length === 0) {
    return [];
  }

  return stored
    .map((entry) => buildAllPokemonCompareOption(entry?.value || entry?.name || entry))
    .filter(Boolean);
}

async function ensureAllPokemonCompareOptionsLoaded() {
  if (allPokemonCompareOptions.length > 0) {
    return allPokemonCompareOptions;
  }

  const storedOptions = getStoredAllPokemonCompareOptions();
  if (storedOptions.length > 0) {
    allPokemonCompareOptions = storedOptions;
    return allPokemonCompareOptions;
  }

  if (allPokemonComparePromise) {
    return allPokemonComparePromise;
  }

  allPokemonComparePromise = (async () => {
    const response = await fetchJsonOrThrow(ALL_POKEMON_LIST_URL, "Pokemon list", {
      timeoutMs: 12000,
      maxRetries: 1,
    });

    allPokemonCompareOptions = (response.results || [])
      .map((entry) => buildAllPokemonCompareOption(entry?.name))
      .filter(Boolean)
      .sort((left, right) => left.label.localeCompare(right.label));

    try {
      localStorage.setItem(
        ALL_POKEMON_LIST_STORAGE_KEY,
        JSON.stringify(allPokemonCompareOptions)
      );
    } catch (err) {
      console.warn("Failed to persist Pokemon compare options:", err);
    }

    return allPokemonCompareOptions;
  })();

  try {
    return await allPokemonComparePromise;
  } finally {
    allPokemonComparePromise = null;
  }
}

function getRadarCompareCandidates() {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (name, tag) => {
    if (!name) return;
    const normalized = String(name).toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({
      value: normalized,
      label: tag ? `${capitalizeWords(normalized)} (${tag})` : capitalizeWords(normalized),
      priority: tag === "Current" ? 0 : tag === "Recent" ? 1 : 2,
    });
  };

  addCandidate(activeDisplayData?.name, "Current");
  addCandidate(currentData?.data?.name, "Current");

  readStoredJson("recentPokemon", [])
    .slice(0, 12)
    .forEach((entry) => addCandidate(entry?.name, "Recent"));

  Object.keys(pokemonCache || {})
    .slice(-24)
    .forEach((name) => addCandidate(name, "Cached"));

  allPokemonCompareOptions.forEach((optionData) => {
    if (seen.has(optionData.value)) return;
    seen.add(optionData.value);
    candidates.push(optionData);
  });

  return candidates.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.label.localeCompare(right.label);
  });
}

async function refreshRadarCompareOptions(preferredValue = "") {
  if (!radarCompareSelect) return;

  if (allPokemonCompareOptions.length === 0 && !allPokemonComparePromise) {
    radarCompareSelect.innerHTML = "";

    const loadingOption = document.createElement("option");
    loadingOption.value = "";
    loadingOption.textContent = "Loading Pokemon list...";
    radarCompareSelect.appendChild(loadingOption);
  }

  try {
    await ensureAllPokemonCompareOptionsLoaded();
  } catch (err) {
    console.error(err);
    showCustomAlert("Could not load the full compare list.", 2600);
  }

  const options = getRadarCompareCandidates();
  const selection = preferredValue || radarCompareSelect.value;

  radarCompareSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = options.length
    ? "Select Pokemon to compare"
    : "No Pokemon available";
  radarCompareSelect.appendChild(placeholder);

  const fragment = document.createDocumentFragment();

  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    fragment.appendChild(option);
  });

  radarCompareSelect.appendChild(fragment);

  const hasSelection = options.some((optionData) => optionData.value === selection);
  radarCompareSelect.value = hasSelection ? selection : "";
}

async function fetchCompareSnapshotByName(name) {
  const normalized = name.toLowerCase();
  const cachedEntry = pokemonCache?.[normalized];

  if (cachedEntry?.data) {
    return createRadarCompareSnapshot(
      cachedEntry.data,
      cachedEntry.speciesData || { name: cachedEntry.data.name }
    );
  }

  const data = await fetchJsonOrThrow(
    `https://pokeapi.co/api/v2/pokemon/${normalized}`,
    "Pokemon"
  );
  const speciesData = await fetchJsonOrThrow(data.species.url, "Species");

  pokemonCache[normalized] = {
    data,
    speciesData,
  };

  try {
    pokemonCache = limitCacheSize(pokemonCache, MAX_CACHE_SIZE);
    localStorage.setItem("pokemonCache", JSON.stringify(pokemonCache));
  } catch (err) {
    console.warn("Failed to persist compare cache:", err);
  }

  return createRadarCompareSnapshot(data, speciesData);
}

function renderRadarChart(activeData, activeSpeciesData) {
  const canvas = document.getElementById("stats-radar-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = ["HP", "Attack", "Defense", "Sp. Attack", "Sp. Defense", "Speed"];
  const primaryType = activeData.types?.[0]?.type?.name || "normal";
  const activeColor = typeColor[primaryType] || "#4a90da";
  const activeLabel = getCurrentPokemonLabel(activeData, activeSpeciesData);
  const activeValues = getRadarStatValues(activeData);

  const datasets = [buildRadarDataset(activeLabel, activeValues, activeColor, 0.22, 1)];

  radarCompareSnapshots
    .filter((snap) => snap.key !== `${activeData.id}-${activeData.name}-${isMega ? "mega" : "base"}`)
    .slice(0, 4)
    .forEach((snap) => {
      datasets.push(
        buildRadarDataset(snap.label, snap.values, snap.color, 0.08, 0.85)
      );
    });

  const config = {
    type: "radar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            font: { size: 10 },
            color: "#1f2d45",
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}`,
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          min: 0,
          max: 255,
          ticks: {
            stepSize: 51,
            backdropColor: "transparent",
            color: "#35445f",
            font: { size: 10 },
          },
          pointLabels: {
            color: "#16233a",
            font: { size: 11, weight: "600" },
          },
          angleLines: {
            color: "rgba(16, 24, 44, 0.28)",
            lineWidth: 1.4,
          },
          grid: {
            color: "rgba(16, 24, 44, 0.24)",
            lineWidth: 1.5,
          },
        },
      },
    },
  };

  if (statsRadarChart) {
    statsRadarChart.data = config.data;
    statsRadarChart.options = config.options;
    statsRadarChart.update();
  } else {
    statsRadarChart = new Chart(canvas, config);
  }
}

async function addSelectedPokemonToRadarCompare() {
  if (!activeDisplayData || !activeDisplaySpeciesData) {
    showCustomAlert("Generate a Pokémon first.", 2000);
    return;
  }

  const selectedName = radarCompareSelect?.value?.trim().toLowerCase();
  if (!selectedName) {
    showCustomAlert("Select a Pokémon to compare.", 2000);
    return;
  }

  if (selectedName === activeDisplayData.name?.toLowerCase()) {
    showCustomAlert("The current Pokémon is already shown on the chart.", 2200);
    return;
  }

  try {
    const snapshot = await fetchCompareSnapshotByName(selectedName);

    if (radarCompareSnapshots.some((snap) => snap.key === snapshot.key)) {
      showCustomAlert("This Pokémon is already in compare.", 2000);
      return;
    }

    radarCompareSnapshots.push(snapshot);

    if (radarCompareSnapshots.length > 4) {
      radarCompareSnapshots = radarCompareSnapshots.slice(-4);
    }

    renderRadarChart(activeDisplayData, activeDisplaySpeciesData);
    refreshRadarCompareOptions(selectedName);
  } catch (err) {
    console.error(err);
    showCustomAlert("Could not load the selected Pokémon for comparison.", 2600);
  }
}

function clearRadarCompare() {
  radarCompareSnapshots = [];
  if (radarCompareSelect) {
    radarCompareSelect.value = "";
  }
  if (activeDisplayData && activeDisplaySpeciesData) {
    renderRadarChart(activeDisplayData, activeDisplaySpeciesData);
  }
}

if (addCompareBtn) {
  addCompareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    addSelectedPokemonToRadarCompare();
  });
}

if (clearCompareBtn) {
  clearCompareBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearRadarCompare();
  });
}

if (radarCompareSelect) {
  radarCompareSelect.addEventListener("focus", () => {
    refreshRadarCompareOptions(radarCompareSelect.value);
  });
}

/*=======================================================================================================================================================================
  4. Main UI Update Handler:
==========================================================================================================================================================================*/

const updateUI = (data, speciesData, evolutions, topMoves = []) => {
  const name = data.name[0].toUpperCase() + data.name.slice(1);
  document.getElementById("poke-name").textContent = name;
  document.getElementById("poke-id").textContent = `#${data.id}`;
  document.getElementById("hp").textContent = data.stats[0].base_stat;
  document.getElementById("xp").textContent = data.base_experience;
  document.getElementById("atk").textContent = data.stats[1].base_stat;
  document.getElementById("def").textContent = data.stats[2].base_stat;
  document.getElementById("spd").textContent = data.stats[5].base_stat;
  document.getElementById("height").textContent =
    (data.height / 10).toFixed(1) + " m";
  document.getElementById("weight").textContent =
    (data.weight / 10).toFixed(1) + " kg";
  document.getElementById("abilities").textContent = data.abilities
    .map((a) => a.ability.name)
    .join(", ");

  const card = document.getElementById("card");
  const rarityEl = document.getElementById("rarity");

  const ultraBeasts = [
    "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela",
    "kartana", "guzzlord", "poipole", "naganadel", "stakataka", "blacephalon",
  ];

  function addToRecentList(data, speciesData, isShiny) {
    const types = data.types.map((t) => t.type.name);
    const rarity = speciesData.is_legendary
      ? "Legendary"
      : speciesData.is_mythical
      ? "Mythical"
      : ultraBeasts.includes(speciesData.name)
      ? "Ultra Beast"
      : "Common";

    const recentEntry = {
      id: data.id,
      name: data.name,
      types,
      rarity,
      isShiny,
      timestamp: Date.now(),
    };
    let recents = JSON.parse(localStorage.getItem("recentPokemon")) || [];
    recents = recents.filter(
      (p) => !(p.id === recentEntry.id && p.isShiny === recentEntry.isShiny)
    );
    recents.unshift(recentEntry);
    if (recents.length > 20) recents = recents.slice(0, 20);
    localStorage.setItem("recentPokemon", JSON.stringify(recents));
  }
  addToRecentList(data, speciesData, isShiny);

  const isUltraBeast = ultraBeasts.includes(speciesData.name);
  if (isUltraBeast) {
    card.classList.add("ultra");
    card.classList.remove("legendary", "mythical");
    rarityEl.textContent = "Ultra Beast";
    rarityEl.style.background = "#00e5ff";
    rarityEl.style.color = "#000";
  } else if (speciesData.is_legendary) {
    card.classList.add("legendary");
    card.classList.remove("mythical", "ultra");
    rarityEl.textContent = "Legendary";
    rarityEl.style.background = "#ffd700";
    rarityEl.style.color = "#000";
  } else if (speciesData.is_mythical) {
    card.classList.add("mythical");
    card.classList.remove("legendary", "ultra");
    rarityEl.textContent = "Mythical";
    rarityEl.style.background = "#e040fb";
    rarityEl.style.color = "#fff";
  } else {
    card.classList.remove("legendary", "mythical", "ultra");
    rarityEl.textContent = "Common";
    rarityEl.style.background = "#ccc";
    rarityEl.style.color = "#000";
  }

  const rawGen = speciesData.generation.name;
  document.getElementById("region").textContent =
    generationRegionMap[rawGen] || rawGen;

  const moves = formatTopMovesForDisplay(topMoves, data, 3);
  document.getElementById("moves").textContent = `${moves || "--"}`;

  const types = data.types.map((t) => t.type.name);
  const typesContainer = document.getElementById("types");
  typesContainer.innerHTML = "";
  types.forEach((t) => {
    const span = document.createElement("span");
    span.textContent = t;
    span.style.backgroundColor = typeColor[t] || "#ccc";
    span.style.color = getContrastYIQ(typeColor[t] || "#ccc");
    typesContainer.appendChild(span);
  });

  const color1 = typeColor[types[0]] || "#ccc";
  const color2 = types[1] ? typeColor[types[1]] : lighten(color1, 25);
  card.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
  applyGeneratorTheme(color1, color2);

  flipContainer.style.filter = `drop-shadow(0 0 18px ${hexToRgba(
    color1,
    0.45
  )}) drop-shadow(0 0 40px ${hexToRgba(color2, 0.3)})`;

  const img = document.getElementById("poke-img");

  const staticFallback = isShiny
    ? data?.sprites?.other?.["official-artwork"]?.front_shiny || data?.sprites?.front_shiny
    : data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;

  img.onerror = () => {
    img.onerror = null;
    img.src = staticFallback || "";
  };
  img.src = getPreferredCardImage(data, isShiny);

  card.classList.remove("slide-in");
  void card.offsetWidth;
  card.classList.add("slide-in");
};

/*=======================================================================================================================================================================
  5. Analysis Panel:
==========================================================================================================================================================================*/

const updateAnalysisPanel = (data, speciesData, evolutions, topMoves = []) => {
  activeDisplayData = data;
  activeDisplaySpeciesData = speciesData;
  refreshRadarCompareOptions();

  const name = data.name[0].toUpperCase() + data.name.slice(1);

  document.getElementById("analysis-name").textContent = name;
  document.getElementById("analysis-summary").textContent = speciesData.flavor_text_entries.find(
    (entry) => entry.language.name === "en"
  )?.flavor_text?.replace(/\n|\f/g, " ") || "No description available.";

  const typesContainer = document.getElementById("analysis-types");
  typesContainer.innerHTML = "";
  data.types.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "analysis-chip";
    chip.textContent = t.type.name;
    chip.style.backgroundColor = typeColor[t.type.name] || "#ccc";
    chip.style.color = getContrastYIQ(typeColor[t.type.name] || "#ccc");
    typesContainer.appendChild(chip);
  });

  const evoContainer = document.getElementById("analysis-evolution");
  evoContainer.innerHTML = "";
  if (evolutions.length === 0) {
    evoContainer.textContent = "None";
  } else {
    const evoFlex = document.createElement("div");
    evoFlex.style.display = "flex";
    evoFlex.style.flexWrap = "wrap";
    evoFlex.style.gap = "8px";

    evolutions.forEach((stage, stageIdx) => {
      stage.forEach((name, nameIdx) => {
        const evoSpan = document.createElement("span");
        evoSpan.className = "analysis-chip";
        evoSpan.textContent = name[0].toUpperCase() + name.slice(1);
        evoSpan.style.cursor = "pointer";
        evoSpan.style.opacity = "0.8";
        evoSpan.style.transition = "opacity 0.2s";
        evoSpan.addEventListener("mouseenter", (e) => e.target.style.opacity = "1");
        evoSpan.addEventListener("mouseleave", (e) => e.target.style.opacity = "0.8");
        evoSpan.addEventListener("click", () => getPokemonByName(name));
        evoFlex.appendChild(evoSpan);

        if (nameIdx < stage.length - 1) {
          const slash = document.createElement("span");
          slash.textContent = " / ";
          slash.style.opacity = "0.5";
          evoFlex.appendChild(slash);
        }
      });

      if (stageIdx < evolutions.length - 1) {
        const arrow = document.createElement("span");
        arrow.textContent = " → ";
        arrow.style.opacity = "0.7";
        evoFlex.appendChild(arrow);
      }
    });

    evoContainer.appendChild(evoFlex);
  }

  Promise.all(
    data.types.map((t) =>
      fetch(`https://pokeapi.co/api/v2/type/${t.type.name}`).then((res) =>
        res.json()
      )
    )
  ).then((typeDataArray) => {
    const allTypes = [
      "normal", "fire", "water", "electric", "grass", "ice", "fighting",
      "poison", "ground", "flying", "psychic", "bug", "rock", "ghost",
      "dragon", "dark", "steel", "fairy",
    ];

    const defensiveEffectiveness = {};
    allTypes.forEach((type) => {
      defensiveEffectiveness[type] = 1;
    });

    typeDataArray.forEach((typeData) => {
      typeData.damage_relations.double_damage_from.forEach((t) => {
        defensiveEffectiveness[t.name] *= 2;
      });
      typeData.damage_relations.half_damage_from.forEach((t) => {
        defensiveEffectiveness[t.name] *= 0.5;
      });
      typeData.damage_relations.no_damage_from.forEach((t) => {
        defensiveEffectiveness[t.name] *= 0;
      });
    });

    const offensiveEffectiveness = {};
    allTypes.forEach((type) => {
      offensiveEffectiveness[type] = 0;
    });

    typeDataArray.forEach((typeData) => {
      allTypes.forEach((targetType) => {
        let multiplier = 1;
        if (typeData.damage_relations.double_damage_to.some((t) => t.name === targetType)) {
          multiplier = 2;
        } else if (typeData.damage_relations.half_damage_to.some((t) => t.name === targetType)) {
          multiplier = 0.5;
        } else if (typeData.damage_relations.no_damage_to.some((t) => t.name === targetType)) {
          multiplier = 0;
        }
        offensiveEffectiveness[targetType] = Math.max(
          offensiveEffectiveness[targetType],
          multiplier
        );
      });
    });

    const weakAgainst = [];
    const strongAgainst = [];

    Object.entries(defensiveEffectiveness).forEach(([type, multiplier]) => {
      if (multiplier > 1) weakAgainst.push(type);
    });

    Object.entries(offensiveEffectiveness).forEach(([type, multiplier]) => {
      if (multiplier > 1) strongAgainst.push(type);
    });

    weakAgainst.sort();
    strongAgainst.sort();

    const weakContainer = document.getElementById("analysis-weak-against");
    weakContainer.innerHTML = "";
    if (weakAgainst.length === 0) {
      weakContainer.innerHTML = '<span class="analysis-placeholder">None</span>';
    } else {
      weakAgainst.forEach((type) => {
        const chip = document.createElement("span");
        chip.className = "analysis-chip";
        chip.textContent = type;
        chip.style.backgroundColor = typeColor[type] || "#ccc";
        chip.style.color = getContrastYIQ(typeColor[type] || "#ccc");
        weakContainer.appendChild(chip);
      });
    }

    const strongContainer = document.getElementById("analysis-strong-against");
    strongContainer.innerHTML = "";
    if (strongAgainst.length === 0) {
      strongContainer.innerHTML = '<span class="analysis-placeholder">None</span>';
    } else {
      strongAgainst.forEach((type) => {
        const chip = document.createElement("span");
        chip.className = "analysis-chip";
        chip.textContent = type;
        chip.style.backgroundColor = typeColor[type] || "#ccc";
        chip.style.color = getContrastYIQ(typeColor[type] || "#ccc");
        strongContainer.appendChild(chip);
      });
    }
  });

  const rawGen = speciesData.generation.name;
  document.getElementById("analysis-region").textContent =
    generationRegionMap[rawGen] || rawGen;
  document.getElementById("analysis-habitat").textContent = speciesData.habitat
    ? speciesData.habitat.name[0].toUpperCase() + speciesData.habitat.name.slice(1)
    : "Unknown";

  document.getElementById("analysis-catch-rate").textContent =
    `${speciesData.capture_rate}%`;
  document.getElementById("analysis-happiness").textContent =
    speciesData.base_happiness;

  const moves = formatTopMovesForDisplay(topMoves, data, 3);
  document.getElementById("analysis-moves").textContent = moves || "None";

  renderRadarChart(data, speciesData);
};

/*=======================================================================================================================================================================
  6. Shiny, Evolution, Mega Helpers:
==========================================================================================================================================================================*/

function shouldBeShiny(speciesData) {
  const ultraBeasts = [
    "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela",
    "kartana", "guzzlord", "poipole", "naganadel", "stakataka", "blacephalon",
  ];
  if (shinyForced) return true;
  if (speciesData.is_legendary || speciesData.is_mythical || ultraBeasts.includes(speciesData.name)) {
    return Math.floor(Math.random() * 20) === 0;
  }
  return Math.floor(Math.random() * 512) === 0;
}

const extractEvolutionNames = (chain) => {
  const stages = [];

  const traverse = (node, level = 0) => {
    if (!stages[level]) stages[level] = [];

    if (!stages[level].includes(node.species.name)) {
      stages[level].push(node.species.name);
    }

    node.evolves_to.forEach((next) => {
      traverse(next, level + 1);
    });
  };

  traverse(chain);
  return stages;
};

const handleMegaButton = (speciesData) => {
  if (!megaBtn) return;
  const megaForms = speciesData.varieties.filter((v) =>
    v.pokemon.name.includes("mega")
  );
  if (megaForms.length > 0) {
    megaBtn.style.display = "inline-block";
    megaBtn.dataset.megaName = megaForms[0].pokemon.name;
  } else {
    megaBtn.style.display = "none";
  }
};

/*=======================================================================================================================================================================
  7. Pokemon Fetching:
==========================================================================================================================================================================*/

const getPokemon = async () => {
  shinyForced = false;
  showCustomAlert("Loading Pokémon...", Infinity);
  try {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const id = Math.floor(Math.random() * 1025) + 1;
        const data = await fetchJsonOrThrow(
          `https://pokeapi.co/api/v2/pokemon/${id}`,
          "Pokemon"
        );
        const speciesData = await fetchJsonOrThrow(data.species.url, "Species");
        const evoData = await fetchJsonOrThrow(
          speciesData.evolution_chain.url,
          "Evolution chain"
        );
        const evolutions = extractEvolutionNames(evoData.chain);
        const topMoves = await getTopMovesForPokemonData(data, 4);

        isShiny = shouldBeShiny(speciesData);

        currentData = {
          data,
          speciesData,
          evolutions,
          topMoves,
        };

        handleMegaButton(speciesData);
        updateUI(data, speciesData, evolutions, topMoves);
        updateAnalysisPanel(data, speciesData, evolutions, topMoves);
        hideCustomAlert();
        return;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Unknown loading error");
  } catch (err) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showCustomAlert("You appear to be offline. Check your internet and try again.", 3000);
    } else {
      showCustomAlert("Could not load Pokémon from the API. Please try again.", 3000);
    }
    console.error(err);
  }
};

const getPokemonByName = async (name) => {
  shinyForced = false;
  showCustomAlert("Loading Pokémon...", Infinity);
  try {
    const lowerName = name.toLowerCase();
    let data = null;
    let speciesData = null;

    try {
      data = await fetchJsonOrThrow(
        `https://pokeapi.co/api/v2/pokemon/${lowerName}`,
        "Pokemon"
      );
      speciesData = await fetchJsonOrThrow(
        `https://pokeapi.co/api/v2/pokemon-species/${data.species.name}`,
        "Species"
      );
    } catch {
      const speciesName = lowerName.split("-")[0];
      speciesData = await fetchJsonOrThrow(
        `https://pokeapi.co/api/v2/pokemon-species/${speciesName}`,
        "Species"
      );
      const defaultForm = speciesData.varieties.find((v) => v.is_default)?.pokemon?.name;
      if (!defaultForm) throw new Error("Default form not found");
      data = await fetchJsonOrThrow(
        `https://pokeapi.co/api/v2/pokemon/${defaultForm}`,
        "Pokemon"
      );
    }

    const evoData = await fetchJsonOrThrow(
      speciesData.evolution_chain.url,
      "Evolution chain"
    );
    const evolutions = extractEvolutionNames(evoData.chain);
    const topMoves = await getTopMovesForPokemonData(data, 4);

    isShiny = shouldBeShiny(speciesData);

    currentData = {
      data,
      speciesData,
      evolutions,
      topMoves,
    };

    handleMegaButton(speciesData);
    updateUI(data, speciesData, evolutions, topMoves);
    updateAnalysisPanel(data, speciesData, evolutions, topMoves);
    hideCustomAlert();
  } catch (err) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showCustomAlert("You appear to be offline. Check your internet and try again.", 3000);
    } else {
      showCustomAlert("Could not load Pokémon from the API. Please try again.", 3000);
    }
    console.error(err);
  }
};

/*=======================================================================================================================================================================
  8. Cache and Card Data Helpers:
==========================================================================================================================================================================*/

const MAX_CACHE_SIZE = 100;
let pokemonCache = JSON.parse(localStorage.getItem("pokemonCache")) || {};
refreshRadarCompareOptions();

function limitCacheSize(cache, maxSize) {
  const keys = Object.keys(cache);
  if (keys.length > maxSize) {
    const keysToRemove = keys.slice(0, keys.length - maxSize);
    keysToRemove.forEach(key => delete cache[key]);
  }
  return cache;
}

function getPokemonRarity(speciesData) {
  const ultraBeasts = [
    "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela",
    "kartana", "guzzlord", "poipole", "naganadel", "stakataka", "blacephalon",
  ];

  if (speciesData.is_legendary) return "legendary";
  if (speciesData.is_mythical) return "mythical";
  if (ultraBeasts.includes(speciesData.name)) return "ultra";
  return "common";
}

function formatRarityLabel(rarity) {
  if (rarity === "legendary") return "Legendary";
  if (rarity === "mythical") return "Mythical";
  if (rarity === "ultra") return "Ultra Beast";
  return "Common";
}

function normalizePokemonName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "-");
}

function buildCardDataSnapshotFromEntry(
  data,
  speciesData,
  evolutions,
  topMoves = [],
  shinyValue = false
) {
  return {
    id: data.id,
    pokemon_id: data.id,
    name: data.name,
    display_name: data.name[0].toUpperCase() + data.name.slice(1),
    image_url: getPreferredCardImage(data, shinyValue),
    is_shiny: shinyValue,
    isShiny: shinyValue,
    types: data.types.map((t) => t.type.name),
    stats: {
      hp: data.stats[0].base_stat,
      attack: data.stats[1].base_stat,
      defense: data.stats[2].base_stat,
      "special-attack": data.stats[3].base_stat,
      "special-defense": data.stats[4].base_stat,
      sp_attack: data.stats[3].base_stat,
      sp_defense: data.stats[4].base_stat,
      speed: data.stats[5].base_stat,
      xp: data.base_experience,
    },
    region: generationRegionMap[speciesData.generation.name] || "Unknown",
    abilities: data.abilities.map((a) => a.ability.name),
    moves: topMoves.length > 0
      ? topMoves.slice(0, 4).map((name) => String(name || "").toLowerCase())
      : data.moves
          .slice(0, 4)
          .map((m) => m.move.name.replace(/-/g, " ")),
    evolutions,
    captured_at: new Date().toISOString(),
  };
}

function buildCardDataSnapshot(data, speciesData, evolutions) {
  return buildCardDataSnapshotFromEntry(
    data,
    speciesData,
    evolutions,
    currentData?.topMoves || [],
    isShiny
  );
}

/*=======================================================================================================================================================================
  9. Event Handlers:
==========================================================================================================================================================================*/

generateBtn.addEventListener("click", async () => {
  console.log("Generate button clicked, checking auth...");
  const user = await getCurrentUser();
  console.log("Current user:", user);

  if (!user) {
    console.log("No user found, redirecting to welcome screen");
    showCustomAlert("Please sign in first to generate cards", 3000);
    document.getElementById("welcome-screen").style.display = "block";
    document.querySelector(".container").style.display = "none";
    return;
  }

  console.log("User authenticated, generating card...");
  if (filteredList && filteredList.length > 0) {
    filteredList = [];
    document.getElementById("filter-type1").value = "";
    document.getElementById("filter-type2").value = "";
    document.getElementById("filter-region").value = "";
    document.getElementById("filter-rarity").value = "";
  }

  getPokemon();
});

document.getElementById("reset-filters").addEventListener("click", () => {
  document.getElementById("filter-type1").value = "";
  document.getElementById("filter-type2").value = "";
  document.getElementById("filter-region").value = "";
  document.getElementById("filter-rarity").value = "";
  filteredList = [];
  showCustomAlert("Filters cleared!", 2000);
});

if (saveCurrentCardBtn) {
  saveCurrentCardBtn.addEventListener("click", async () => {
    if (!currentData) {
      showCustomAlert("Generate a card first, then save it.", 2500);
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      showCustomAlert("Please sign in to save cards.", 2500);
      return;
    }

    const { data, speciesData, evolutions } = currentData;
    const rarity = getPokemonRarity(speciesData);
    const cardSnapshot = buildCardDataSnapshot(data, speciesData, evolutions);

    const result = await capturePokemon(
      user.id,
      data.id,
      data.name,
      cardSnapshot,
      rarity
    );

    if (result.success) {
      showCustomAlert(`${cardSnapshot.display_name} saved to your collection!`, 2500);
      return;
    }

    const errText = (result.message || "").toLowerCase();
    if (errText.includes("duplicate") || errText.includes("unique")) {
      showCustomAlert("This Pokemon is already in your collection.", 2500);
      return;
    }

    showCustomAlert(`Save failed: ${result.message}`, 3000);
  });
}

if (pokemonOfDayBtn) {
  pokemonOfDayBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openPokemonOfDayModal();
  });
}

if (guessPokemonBtn) {
  guessPokemonBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openGuessPokemonModal();
  });
}

document.getElementById("apply-filters").addEventListener("click", async () => {
  showCustomAlert("Loading filtered Pokémon...", Infinity);

  const type1 = document.getElementById("filter-type1").value.toLowerCase();
  const type2 = document.getElementById("filter-type2").value.toLowerCase();
  const region = document.getElementById("filter-region").value.toLowerCase();
  const rarity = document.getElementById("filter-rarity").value.toLowerCase();

  let pokemonList;
  if (region) {
    const generationEntry = Object.entries(generationRegionMap).find(
      ([_, value]) => value.toLowerCase() === region
    );
    if (!generationEntry) {
      showCustomAlert("Region not found.");
      return;
    }
    const generationKey = generationEntry[0];
    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/generation/${generationKey}`
      );
      const data = await res.json();
      pokemonList = data.pokemon_species.map((p) => p.name);
    } catch (err) {
      console.error("Failed to fetch region data:", err);
      showCustomAlert("Error fetching region data.");
      return;
    }
  } else {
    const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
    const data = await res.json();
    pokemonList = data.results.map((p) => p.name);
  }

  pokemonList.sort(() => Math.random() - 0.5);

  const ultraBeasts = [
    "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela",
    "kartana", "guzzlord", "poipole", "naganadel", "stakataka", "blacephalon",
  ];

  function entryMatchesFilters(entry) {
    const { data, speciesData } = entry;
    const typeNames = data.types.map((t) => t.type.name.toLowerCase());
    const pokeRegion = generationRegionMap[speciesData.generation.name]?.toLowerCase();
    const pokeRarity = speciesData.is_legendary
      ? "legendary"
      : speciesData.is_mythical
      ? "mythical"
      : ultraBeasts.includes(speciesData.name)
      ? "ultra"
      : "common";
    return (
      (!type1 || typeNames.includes(type1)) &&
      (!type2 || typeNames.includes(type2)) &&
      (!region || region === pokeRegion) &&
      (!rarity || rarity === pokeRarity)
    );
  }

  async function fetchAndCacheEntry(name) {
    if (pokemonCache[name]) return pokemonCache[name];
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${name}`);
    if (!speciesRes.ok) return null;
    const speciesData = await speciesRes.json();
    const defaultForm = speciesData.varieties.find((v) => v.is_default)?.pokemon.name;
    if (!defaultForm) return null;
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${defaultForm}`);
    if (!res.ok) return null;
    const data = await res.json();
    const entry = { data, speciesData };
    pokemonCache[name] = entry;
    return entry;
  }

  let found = null;

  for (const name of pokemonList) {
    if (pokemonCache[name] && entryMatchesFilters(pokemonCache[name])) {
      found = pokemonCache[name];
      break;
    }
  }

  if (!found) {
    const uncached = pokemonList.filter((n) => !pokemonCache[n]);
    const BATCH = 8;
    for (let i = 0; i < uncached.length && !found; i += BATCH) {
      const batch = uncached.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map((n) => fetchAndCacheEntry(n)));
      for (const result of results) {
        if (result.status === "fulfilled" && result.value && entryMatchesFilters(result.value)) {
          found = result.value;
          break;
        }
      }
    }
  }

  try {
    pokemonCache = limitCacheSize(pokemonCache, MAX_CACHE_SIZE);
    localStorage.setItem("pokemonCache", JSON.stringify(pokemonCache));
  } catch (err) {
    console.warn("Failed to save cache to localStorage:", err);
    try {
      localStorage.removeItem("pokemonCache");
      pokemonCache = {};
    } catch (e) {
      console.error("Could not clear cache:", e);
    }
  }

  if (found) {
    try {
      const evoRes = await fetch(found.speciesData.evolution_chain.url);
      const evoData = await evoRes.json();
      const evolutions = extractEvolutionNames(evoData.chain);
      const topMoves = await getTopMovesForPokemonData(found.data, 4);

      currentData = {
        data: found.data,
        speciesData: found.speciesData,
        evolutions,
        topMoves,
      };

      filteredList = [found];
      updateUI(found.data, found.speciesData, evolutions, topMoves);
      updateAnalysisPanel(found.data, found.speciesData, evolutions, topMoves);
      hideCustomAlert();
      showCustomAlert("Filter applied! Click 'Generate' for new random card.", 4000);
    } catch (err) {
      hideCustomAlert();
      showCustomAlert("Error loading evolution data.");
      console.error(err);
    }
  } else {
    hideCustomAlert();
    filteredList = [];
    showCustomAlert("No matching Pokémon found.");
  }
});

/*=======================================================================================================================================================================
  10. UI Interactions: Keyboard Shortcuts, Search, Flip, Mega:
==========================================================================================================================================================================*/

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    if (!currentData) return;
    shinyForced = true;
    isShiny = true;
    updateUI(currentData.data, currentData.speciesData, currentData.evolutions, currentData.topMoves || []);
    updateAnalysisPanel(currentData.data, currentData.speciesData, currentData.evolutions, currentData.topMoves || []);
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") {
    if (!currentData) return;
    if (!megaBtn) return;
    if (megaBtn.style.display === "none") return;
    megaBtn.click();
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
    e.preventDefault();
    const current = (localStorage.getItem("pcgAnimationsEnabled") ?? "true") === "true";
    const next = !current;
    localStorage.setItem("pcgAnimationsEnabled", next ? "true" : "false");

    showCustomAlert(`Animations: ${next ? "On" : "Off"} (Ctrl+Shift+A)`, 1800);

    if (currentData?.data && currentData?.speciesData) {
      updateUI(
        currentData.data,
        currentData.speciesData,
        currentData.evolutions,
        currentData.topMoves || []
      );
      updateAnalysisPanel(
        currentData.data,
        currentData.speciesData,
        currentData.evolutions,
        currentData.topMoves || []
      );
    }
  }
});

flipContainer.addEventListener("click", () => {
  flipContainer.classList.toggle("flipped");
});

function handleSearch() {
  const name = searchInput.value.trim();
  if (name) getPokemonByName(name);
}

searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSearch();
});

const cardElement = document.getElementById("flip-container");
const flipper = cardElement.querySelector(".flipper");
let isFlipped = false;

cardElement.addEventListener("click", () => {
  isFlipped = !isFlipped;
  applyCombinedTransform();
});

cardElement.addEventListener("mousemove", (e) => {
  const rect = cardElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const rotateX = ((y - centerY) / centerY) * -10;
  const rotateY = ((x - centerX) / centerX) * 10;

  applyCombinedTransform(rotateX, rotateY);
});

cardElement.addEventListener("mouseleave", () => {
  applyCombinedTransform(0, 0);
});

function applyCombinedTransform(rotateX = 0, rotateY = 0) {
  const flipY = isFlipped ? 180 : 0;
  flipper.style.transform = `
    rotateY(${flipY}deg)
    rotateX(${rotateX}deg)
    rotateY(${rotateY}deg)
  `;
}

let megaFormData = null;

document.addEventListener("keydown", async (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "g") {
    e.preventDefault();

    if (!currentData) {
      showCustomAlert("No Pokémon selected.");
      return;
    }

    const varieties = currentData.speciesData.varieties;
    const megaVariety = varieties.find((v) => v.pokemon.name.includes("mega"));

    if (!megaVariety) {
      showCustomAlert("No Mega Evolution available for this Pokémon.");
      return;
    }

    if (!isMega) {
      try {
        showCustomAlert("Loading Mega Evolution...", Infinity);
        const res = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${megaVariety.pokemon.name}`
        );
        megaFormData = await res.json();
        currentData.megaTopMoves = await getTopMovesForPokemonData(megaFormData, 4);
        isMega = true;
        updateUI(megaFormData, currentData.speciesData, currentData.evolutions, currentData.megaTopMoves || []);
        updateAnalysisPanel(megaFormData, currentData.speciesData, currentData.evolutions, currentData.megaTopMoves || []);
        hideCustomAlert();
        showCustomAlert("Mega Evolution activated!");
      } catch (err) {
        showCustomAlert("Failed to load Mega form.");
        console.error(err);
      }
    } else {
      isMega = false;
      updateUI(
        currentData.data,
        currentData.speciesData,
        currentData.evolutions,
        currentData.topMoves || []
      );
      updateAnalysisPanel(
        currentData.data,
        currentData.speciesData,
        currentData.evolutions,
        currentData.topMoves || []
      );
      showCustomAlert("Returned to base form!");
    }
  }
});

window.addEventListener("keydown", (event) => {
  if (event.shiftKey && event.key.toLowerCase() === "w") {
    document.getElementById("welcome-screen").style.display = "block";
    document.querySelector(".container").style.display = "none";
  }
});

/*=======================================================================================================================================================================
  11. Custom Alert:
==========================================================================================================================================================================*/

let alertTimeoutId = null;

function showCustomAlert(message, duration = 3000) {
  const alertBox = document.getElementById("custom-alert");
  const messageEl = document.getElementById("custom-alert-message");
  messageEl.textContent = message;
  alertBox.classList.add("show");
  alertBox.classList.remove("hidden");
  if (alertTimeoutId) {
    clearTimeout(alertTimeoutId);
    alertTimeoutId = null;
  }
  if (duration !== Infinity) {
    alertTimeoutId = setTimeout(() => {
      alertBox.classList.remove("show");
      setTimeout(() => alertBox.classList.add("hidden"), 300);
    }, duration);
  }
}

function hideCustomAlert() {
  const alertBox = document.getElementById("custom-alert");
  alertBox.classList.remove("show");
  setTimeout(() => alertBox.classList.add("hidden"), 300);
  if (alertTimeoutId) {
    clearTimeout(alertTimeoutId);
    alertTimeoutId = null;
  }
}
