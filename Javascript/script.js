/*=======================================================================================================================================================================

                                                                   Pokemon Card Generator: 

==========================================================================================================================================================================*/

/*=======================================================================================================================================================================
  1. Global Declarations and Variables:
==========================================================================================================================================================================*/

let filteredList = [];

const megaBtn = document.getElementById("mega-btn");
let isMega = false;

// Initialize navbar toggle functionality
function initNavbarToggle() {
   const toggleBtn = document.getElementById('navbar-toggle');
   const navbarMenu = document.getElementById('navbar-menu');
   const NAV_MENU_STATE_KEY = 'pcgNavbarMenuOpen';

   if (!toggleBtn || !navbarMenu) return; // Exit if elements don't exist

   // Always use collapsed chevron menu (desktop + mobile)
   navbarMenu.classList.add('collapsed');
   toggleBtn.style.display = 'block';

   // Restore previous user choice
   const wasOpen = localStorage.getItem(NAV_MENU_STATE_KEY) === 'true';
   navbarMenu.classList.toggle('open', wasOpen);
   toggleBtn.setAttribute('aria-expanded', String(wasOpen));

   // Toggle menu on button click
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
      animToggleOption.innerHTML = enabled ?
         '<i class="fas fa-film"></i> Animations: On' :
         '<i class="fas fa-film"></i> Animations: Off';
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

      const trainerName = trainerRes?.success && trainerRes?.data?.trainer_name ?
         trainerRes.data.trainer_name :
         (user.user_metadata?.trainer_name || user.email?.split("@")[0] || "Trainer");

      const avatarUrl = profileRes?.success && profileRes?.data?.avatar_url ?
         profileRes.data.avatar_url :
         defaultAvatar;

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

// Initialize on page load
if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', initNavbarToggle);
   document.addEventListener('DOMContentLoaded', initProfileMenu);
} else {
   initNavbarToggle();
   initProfileMenu();
}

/*=======================================================================================================================================================================
  2. Constants and Configuration: 
==========================================================================================================================================================================*/

// 2.1 Type-to-Color Mapping

const typeColor = {
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

// Initialize generator colors early so the first loading alert is themed (not default blue).
initializeGeneratorThemeFromRecent();

// 2.2 Generation to Region Mapping

const generationRegionMap = {
   "generation-i": "Kanto",
   "generation-ii": "Johto",
   "generation-iii": "Hoenn",
   "generation-iv": "Sinnoh",
   "generation-v": "Unova",
   "generation-vi": "Kalos",
   "generation-vii": "Alola",
   "generation-viii": "Galar",
   "generation-ix": "Paldea",
};

/*=========================================================================================================================================================================
  5. DOM Elements and State Variables:
===========================================================================================================================================================================*/

// 5.1 Buttons and Containers

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

// 5.2 State Flags

let currentData = null;
let isShiny = false;
let shinyForced = false; // For shortcut fallback
let activeDisplayData = null;
let activeDisplaySpeciesData = null;
let statsRadarChart = null;
let radarCompareSnapshots = [];
let pokemonOfDayState = null;
let guessPokemonState = null;
let allPokemonCompareOptions = [];
let allPokemonComparePromise = null;
let topMovesCache = {};
const moveMetaCache = {};

const ALL_POKEMON_LIST_STORAGE_KEY = "allPokemonCompareOptions";
const ALL_POKEMON_LIST_URL = "https://pokeapi.co/api/v2/pokemon?limit=2000&offset=0";

/*=======================================================================================================================================================================
  6. Utility Functions:
=============================================================================================================================================================================*/

// 6.1 Text Contrast based on Background

function getContrastYIQ(hex) {
   hex = hex.replace("#", "");
   const r = parseInt(hex.substr(0, 2), 16);
   const g = parseInt(hex.substr(2, 2), 16);
   const b = parseInt(hex.substr(4, 2), 16);
   const yiq = (r * 299 + g * 587 + b * 114) / 1000;
   return yiq >= 128 ? "#000" : "#fff";
}

// 6.2 Color Lightener

function lighten(color, percent) {
   const num = parseInt(color.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = ((num >> 8) & 0x00ff) + amt,
      B = (num & 0x0000ff) + amt;
   return (
      "#" +
      (
         0x1000000 +
         (R < 255 ? Math.max(0, R) : 255) * 0x10000 +
         (G < 255 ? Math.max(0, G) : 255) * 0x100 +
         (B < 255 ? Math.max(0, B) : 255)
      )
      .toString(16)
      .slice(1)
   );
}

function hexToRgba(hex, alpha) {
   const safe = (hex || "#4a90da").replace("#", "");
   const normalized = safe.length === 3 ?
      safe.split("").map((c) => c + c).join("") :
      safe;
   const r = parseInt(normalized.slice(0, 2), 16);
   const g = parseInt(normalized.slice(2, 4), 16);
   const b = parseInt(normalized.slice(4, 6), 16);
   return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRadarStatValues(data) {
   const statMap = new Map(data.stats.map((s) => [s.stat.name, s.base_stat]));
   return [
      statMap.get("hp") || 0,
      statMap.get("attack") || 0,
      statMap.get("defense") || 0,
      statMap.get("special-attack") || 0,
      statMap.get("special-defense") || 0,
      statMap.get("speed") || 0,
   ];
}

function capitalizeWords(value) {
   return value
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatFromPokemonData(data, key) {
   const found = (data?.stats || []).find((s) => s?.stat?.name === key);
   return Number(found?.base_stat || 0);
}

function getFallbackMovesFromPokemonData(data, limit = 4) {
   return (data?.moves || [])
      .slice(0, limit)
      .map((m) => capitalizeWords(m.move?.name || ""))
      .filter(Boolean);
}

function formatTopMovesForDisplay(topMoves, data, limit = 3) {
   const moves = Array.isArray(topMoves) ? topMoves.slice(0, limit) : [];
   if (moves.length > 0) {
      return moves.join(", ");
   }
   return getFallbackMovesFromPokemonData(data, limit).join(", ");
}

function getPreferredCardImage(data, shiny) {
   // Try Gen V animated first (Gen 1-5 Pokémon)
   const animated = shiny ?
      data?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_shiny :
      data?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;

   const showdownId = String(data?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, ""); // Keep hyphens for names like nidoran-m, mr-mime, type-null, ho-oh

   // Try Pokémon Showdown sprites (works best for Gen 1-5)
   const showdown = showdownId ?
      `https://play.pokemonshowdown.com/sprites/${shiny ? "ani-shiny" : "ani"}/${showdownId}.gif` :
      "";

   // For Gen 6+ without Gen V animations, try PokeAPI's other animated sources
   const homeAnimated = shiny ?
      data?.sprites?.other?.["official-artwork"]?.front_shiny :
      data?.sprites?.other?.["official-artwork"]?.front_default;

   const artwork = shiny ?
      data?.sprites?.other?.["official-artwork"]?.front_shiny :
      data?.sprites?.other?.["official-artwork"]?.front_default;

   const basic = shiny ? data?.sprites?.front_shiny : data?.sprites?.front_default;

   const enabled = typeof window.isAnimationsEnabled === "function" ?
      window.isAnimationsEnabled() :
      (localStorage.getItem("pcgAnimationsEnabled") ?? "true") === "true";

   if (!enabled) return artwork || basic || "";

   // Fallback chain: Gen V animated → Showdown → Official artwork → Basic
   // Note: Animated GIFs are mainly available for Gen 1-5 in PokeAPI & Showdown
   // Gen 6+ will fall back to static official artwork or basic sprite
   return animated || showdown || homeAnimated || artwork || basic || "";
}

function getCurrentPokemonLabel(data, speciesData) {
   const base = capitalizeWords(data.name || speciesData?.name || "Pokemon");
   return isMega ? `${base} (Mega)` : base;
}

function buildRadarDataset(label, values, colorHex, fillAlpha = 0.16, lineAlpha = 0.92) {
   const rgbaFill = colorHex
      .replace("#", "")
      .match(/.{1,2}/g)
      .map((h) => parseInt(h, 16));

   const fill = `rgba(${rgbaFill[0]}, ${rgbaFill[1]}, ${rgbaFill[2]}, ${fillAlpha})`;
   const stroke = `rgba(${rgbaFill[0]}, ${rgbaFill[1]}, ${rgbaFill[2]}, ${lineAlpha})`;

   return {
      label,
      data: values,
      fill: true,
      backgroundColor: fill,
      borderColor: stroke,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: stroke,
      pointBorderColor: "#fff",
      pointBorderWidth: 1,
   };
}

function readStoredJson(key, fallback) {
   try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
   } catch (err) {
      console.warn(`Failed to parse ${key} from localStorage:`, err);
      return fallback;
   }
}

function applyGeneratorTheme(color1, color2) {
   const c1 = color1 || "#4a90da";
   const c2 = color2 || lighten(c1, 25);

   document.body.style.background = `
    radial-gradient(circle at 14% 20%, ${hexToRgba(c1, 0.42)}, transparent 38%),
    radial-gradient(circle at 86% 14%, ${hexToRgba(c2, 0.38)}, transparent 34%),
    linear-gradient(145deg, ${hexToRgba(c1, 0.64)}, ${hexToRgba(c2, 0.58)})
  `;

   const navGradient = `
    radial-gradient(circle at 14% 20%, ${hexToRgba(c1, 0.34)}, transparent 38%),
    radial-gradient(circle at 86% 14%, ${hexToRgba(c2, 0.3)}, transparent 34%),
    linear-gradient(145deg, ${hexToRgba(c1, 0.78)}, ${hexToRgba(c2, 0.72)}),
    linear-gradient(145deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.16))
  `;
   document.documentElement.style.setProperty("--nav-bg", navGradient);

   const alertGradient = `
    radial-gradient(circle at 12% 24%, ${hexToRgba(c1, 0.28)}, transparent 40%),
    radial-gradient(circle at 82% 16%, ${hexToRgba(c2, 0.24)}, transparent 36%),
    linear-gradient(160deg, ${hexToRgba(c1, 0.7)}, ${hexToRgba(c2, 0.64)}),
    linear-gradient(160deg, rgba(6, 12, 22, 0.34), rgba(8, 16, 28, 0.28))
  `;
   document.documentElement.style.setProperty("--alert-bg", alertGradient);
   document.documentElement.style.setProperty("--alert-border", hexToRgba(c1, 0.5));
   document.documentElement.style.setProperty("--alert-accent", c1);

   const profileDropdownGradient = `
    radial-gradient(circle at 14% 20%, ${hexToRgba(c1, 0.26)}, transparent 40%),
    radial-gradient(circle at 84% 14%, ${hexToRgba(c2, 0.24)}, transparent 36%),
    linear-gradient(160deg, ${hexToRgba(c1, 0.82)}, ${hexToRgba(c2, 0.72)}),
    linear-gradient(160deg, rgba(8, 16, 30, 0.28), rgba(8, 16, 30, 0.2))
  `;
   document.documentElement.style.setProperty("--profile-dropdown-bg", profileDropdownGradient);
   document.documentElement.style.setProperty("--profile-dropdown-border", hexToRgba(c1, 0.46));
   document.documentElement.style.setProperty("--profile-dropdown-hover", hexToRgba(c1, 0.24));
}

function initializeGeneratorThemeFromRecent() {
   const recent = readStoredJson("recentPokemon", []);
   const first = Array.isArray(recent) && recent.length > 0 ? recent[0] : null;
   const t1 = first?.types?.[0] || null;
   const t2 = first?.types?.[1] || null;

   if (t1 && typeColor[t1]) {
      const c1 = typeColor[t1];
      const c2 = t2 && typeColor[t2] ? typeColor[t2] : lighten(c1, 25);
      applyGeneratorTheme(c1, c2);
      return;
   }

   // Neutral startup fallback (avoids fixed dark-blue default before first generated card)
   applyGeneratorTheme("#3f6b8f", "#5f7a8f");
}

function createRadarCompareSnapshot(data, speciesData) {
   return {
      key: `${data.id}-${data.name}-base`,
      label: capitalizeWords(data.name || speciesData?.name || "Pokemon"),
      color: typeColor[data.types?.[0]?.type?.name] || "#4a90da",
      values: getRadarStatValues(data),
   };
}

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
   placeholder.textContent = options.length ?
      "Select Pokemon to compare" :
      "No Pokemon available";
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
         cachedEntry.speciesData || {
            name: cachedEntry.data.name
         }
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
      data: {
         labels,
         datasets
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         animation: {
            duration: 300
         },
         plugins: {
            legend: {
               display: true,
               labels: {
                  boxWidth: 10,
                  boxHeight: 10,
                  font: {
                     size: 10
                  },
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
                  font: {
                     size: 10
                  },
               },
               pointLabels: {
                  color: "#16233a",
                  font: {
                     size: 11,
                     weight: "600"
                  },
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

/*========================================================================================================================================================================
  7. Main UI Update Handler
==========================================================================================================================================================================*/

// 7.1 Basic Details and Stats Update

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

   // 7.2 Rarity Determination & Styling

   const card = document.getElementById("card");
   const rarityEl = document.getElementById("rarity");

   const ultraBeasts = [
      "nihilego",
      "buzzwole",
      "pheromosa",
      "xurkitree",
      "celesteela",
      "kartana",
      "guzzlord",
      "poipole",
      "naganadel",
      "stakataka",
      "blacephalon",
   ];

   // 7.3 Function to Add to Recent (Local Storage)

   function addToRecentList(data, speciesData, isShiny) {
      const types = data.types.map((t) => t.type.name);
      const rarity = speciesData.is_legendary ?
         "Legendary" :
         speciesData.is_mythical ?
         "Mythical" :
         ultraBeasts.includes(speciesData.name) ?
         "Ultra Beast" :
         "Common";

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
         (p) => !(p.id === recentEntry.id && p.isShiny === recentEntry.isShiny) // Prevent duplicates of same ID and shiny status
      );
      recents.unshift(recentEntry); // Add to beginning
      if (recents.length > 20) recents = recents.slice(0, 20); // Limit to last 20
      localStorage.setItem("recentPokemon", JSON.stringify(recents));
   }
   addToRecentList(data, speciesData, isShiny);

   // 7.4 Determining a Pokemon Rarity

   const isUltraBeast = ultraBeasts.includes(speciesData.name);
   if (isUltraBeast) {
      card.classList.add("ultra");
      card.classList.remove("legendary", "mythical");
      rarityEl.textContent = "Ultra Beast";
      rarityEl.style.background = "#00e5ff"; // Cyan-ish
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

   // 7.5 Region mapping
   const rawGen = speciesData.generation.name;
   document.getElementById("region").textContent =
      generationRegionMap[rawGen] || rawGen;

   // 7.6 Front: Top Moves
   const moves = formatTopMovesForDisplay(topMoves, data, 3);
   document.getElementById("moves").textContent = `${moves || "--"}`;

   // 7.11 Theme Colors Based on Pokemon Types

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

   // 7.12 Pokémon Image (Shiny and Normal)

   const img = document.getElementById("poke-img");

   const staticFallback = isShiny ?
      data?.sprites?.other?.["official-artwork"]?.front_shiny || data?.sprites?.front_shiny :
      data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;

   img.onerror = () => {
      img.onerror = null;
      img.src = staticFallback || "";
   };
   img.src = getPreferredCardImage(data, isShiny);

   card.classList.remove("slide-in");
   void card.offsetWidth;
   card.classList.add("slide-in");
};

/*========================================================================================================================================================================
  7.13 Update Analysis Panel (Right Sidebar)
==========================================================================================================================================================================*/

const updateAnalysisPanel = (data, speciesData, evolutions, topMoves = []) => {
   activeDisplayData = data;
   activeDisplaySpeciesData = speciesData;
   refreshRadarCompareOptions();

   const name = data.name[0].toUpperCase() + data.name.slice(1);

   // Hero section
   document.getElementById("analysis-name").textContent = name;
   document.getElementById("analysis-summary").textContent = speciesData.flavor_text_entries.find(
      (entry) => entry.language.name === "en"
   )?.flavor_text?.replace(/\n|\f/g, " ") || "No description available.";

   // Types 
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

   // Evolution Chain
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

   // Type Effectiveness (Weak/Strong)
   Promise.all(
      data.types.map((t) =>
         fetch(`https://pokeapi.co/api/v2/type/${t.type.name}`).then((res) =>
            res.json()
         )
      )
   ).then((typeDataArray) => {
      const allTypes = [
         "normal",
         "fire",
         "water",
         "electric",
         "grass",
         "ice",
         "fighting",
         "poison",
         "ground",
         "flying",
         "psychic",
         "bug",
         "rock",
         "ghost",
         "dragon",
         "dark",
         "steel",
         "fairy",
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
            if (
               typeData.damage_relations.double_damage_to.some(
                  (t) => t.name === targetType
               )
            ) {
               multiplier = 2;
            } else if (
               typeData.damage_relations.half_damage_to.some(
                  (t) => t.name === targetType
               )
            ) {
               multiplier = 0.5;
            } else if (
               typeData.damage_relations.no_damage_to.some(
                  (t) => t.name === targetType
               )
            ) {
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

   // Region and Habitat
   const rawGen = speciesData.generation.name;
   document.getElementById("analysis-region").textContent =
      generationRegionMap[rawGen] || rawGen;
   document.getElementById("analysis-habitat").textContent = speciesData.habitat ?
      speciesData.habitat.name[0].toUpperCase() + speciesData.habitat.name.slice(1) :
      "Unknown";

   // Catch Rate and Base Happiness
   document.getElementById("analysis-catch-rate").textContent =
      `${speciesData.capture_rate}%`;
   document.getElementById("analysis-happiness").textContent =
      speciesData.base_happiness;

   // Top 3 Moves
   const moves = formatTopMovesForDisplay(topMoves, data, 3);
   document.getElementById("analysis-moves").textContent = moves || "None";

   renderRadarChart(data, speciesData);
};

// Helper to determine shiny odds
function shouldBeShiny(speciesData) {
   // Ultra Beasts list (same as above)
   const ultraBeasts = [
      "nihilego",
      "buzzwole",
      "pheromosa",
      "xurkitree",
      "celesteela",
      "kartana",
      "guzzlord",
      "poipole",
      "naganadel",
      "stakataka",
      "blacephalon",
   ];
   if (shinyForced) return true;
   if (
      speciesData.is_legendary ||
      speciesData.is_mythical ||
      ultraBeasts.includes(speciesData.name)
   ) {
      return Math.floor(Math.random() * 20) === 0; // 1/20
   }
   return Math.floor(Math.random() * 512) === 0; // 1/512
}

/*============================================================================================================================================================================
  8. Extract Evolution Names from Chain:
==========================================================================================================================================================================*/

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

/*========================================================================================================================================================================
  9. Fetching and Displaying Pokémon Data
============================================================================================================================================================================*/

// Helper Function for Mega Evolutions:

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJsonOrThrow = async (url, label, options = {}) => {
   const timeoutMs = options.timeoutMs || 12000;
   const maxRetries = options.maxRetries ?? 4;
   let lastError = null;

   for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
         const res = await fetch(url, {
            signal: controller.signal,
            cache: "no-store",
         });

         clearTimeout(timeoutId);

         if (!res.ok) {
            const transientHttp = res.status === 429 || (res.status >= 500 && res.status <= 599);
            if (attempt < maxRetries && transientHttp) {
               const retryAfterHeader = res.headers.get("retry-after");
               const retryAfterMs = Number(retryAfterHeader) * 1000;
               const backoffMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ?
                  retryAfterMs :
                  400 * (attempt + 1);
               await delay(backoffMs);
               continue;
            }
            throw new Error(`${label} request failed (${res.status})`);
         }

         return await res.json();
      } catch (err) {
         clearTimeout(timeoutId);
         lastError = err;

         const isAbort = err?.name === "AbortError";
         const isNetwork = err instanceof TypeError;
         const shouldRetry = attempt < maxRetries && (isAbort || isNetwork);

         if (!shouldRetry) {
            throw err;
         }

         await delay(350 * (attempt + 1));
      }
   }

   throw lastError || new Error(`${label} request failed`);
};

// 9.0 Game-like top move selection logic:
// Prefer moves from modern games, keep damaging moves, score with STAB + stat fit,
// and ensure at least one STAB move where possible.
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

// 9.1 Fetching a Random Pokémon

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

// 9.2 Fetching a Pokémon by Name

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

      handleMegaButton(speciesData); // ✅ use helper
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

/*========================================================================================================================================================================
  10. Event Handlers: Start, Generate, and Filter Pokémon
==========================================================================================================================================================================*/

// 10.2 Generate Button: Always Random Pokémon (clears filters)

generateBtn.addEventListener("click", async () => {
   // Check if user is logged in
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
   // Clear any active filters to ensure truly random generation
   if (filteredList && filteredList.length > 0) {
      filteredList = [];
      document.getElementById("filter-type1").value = "";
      document.getElementById("filter-type2").value = "";
      document.getElementById("filter-region").value = "";
      document.getElementById("filter-rarity").value = "";
   }

   // Generate completely random Pokémon
   getPokemon();
});

/*========================================================================================================================================================================
  10.3 Filter Button: Apply Type, Region & Rarity Filters
==========================================================================================================================================================================*/

// Initialize cache from localStorage or empty object
// Maximum cache size to prevent quota errors (limit to 100 Pokemon)
const MAX_CACHE_SIZE = 100;
let pokemonCache = JSON.parse(localStorage.getItem("pokemonCache")) || {};
refreshRadarCompareOptions();

// Helper function to limit cache size
function limitCacheSize(cache, maxSize) {
   const keys = Object.keys(cache);
   if (keys.length > maxSize) {
      // Remove oldest entries (simple FIFO approach)
      const keysToRemove = keys.slice(0, keys.length - maxSize);
      keysToRemove.forEach(key => delete cache[key]);
   }
   return cache;
}

function getPokemonRarity(speciesData) {
   const ultraBeasts = [
      "nihilego",
      "buzzwole",
      "pheromosa",
      "xurkitree",
      "celesteela",
      "kartana",
      "guzzlord",
      "poipole",
      "naganadel",
      "stakataka",
      "blacephalon",
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
      moves: topMoves.length > 0 ?
         topMoves.slice(0, 4).map((name) => String(name || "").toLowerCase()) :
         data.moves
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

function getPokemonOfDayDateKey() {
   const now = new Date();
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, "0");
   const day = String(now.getDate()).padStart(2, "0");
   return `${year}-${month}-${day}`;
}

function getPokemonOfDayFormattedDate(dateKey) {
   const parsed = new Date(`${dateKey}T00:00:00`);
   return parsed.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
   });
}

function hashStringToPositiveInt(value) {
   let hash = 0;
   for (const char of String(value)) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
   }
   return hash;
}

function getPokemonOfDayId(dateKey) {
   return (hashStringToPositiveInt(`pcg-pokemon-day:${dateKey}`) % 1025) + 1;
}

function getPrimaryEnglishFlavor(speciesData) {
   return speciesData?.flavor_text_entries
      ?.find((entry) => entry.language?.name === "en")
      ?.flavor_text?.replace(/\n|\f/g, " ") || "No description available.";
}

function getPokemonOfDayAlternateFormName(speciesData, defaultFormName) {
   return speciesData?.varieties?.find(
      (variety) => !variety.is_default && variety?.pokemon?.name !== defaultFormName
   )?.pokemon?.name || "";
}

function getPokemonOfDayVariantLabel(speciesData, formName, defaultFormName) {
   if (!formName || formName === defaultFormName) return "Base";

   const speciesName = speciesData?.name || "";
   const trimmed = speciesName && formName.startsWith(`${speciesName}-`) ?
      formName.slice(speciesName.length + 1) :
      formName;
   return capitalizeWords(trimmed);
}

function formatEvolutionLine(evolutions) {
   return (evolutions || [])
      .map((stage) => stage.map((name) => capitalizeWords(name)).join(" / "))
      .join(" -> ");
}

function setPokemonOfDayLoadingState() {
   const nameEl = document.getElementById("pokemon-day-name");
   const dateEl = document.getElementById("pokemon-day-date");
   const flavorEl = document.getElementById("pokemon-day-flavor");
   const movesEl = document.getElementById("pokemon-day-moves");
   const imageEl = document.getElementById("pokemon-day-image");
   const typesEl = document.getElementById("pokemon-day-types");

   if (nameEl) nameEl.textContent = "Loading...";
   if (dateEl) dateEl.textContent = "Fetching today’s featured Pokemon";
   if (flavorEl) flavorEl.textContent = "Pulling dex details and best moves...";
   if (movesEl) movesEl.textContent = "--";
   if (imageEl) imageEl.removeAttribute("src");
   if (typesEl) typesEl.innerHTML = "";
}

function showPokemonOfDayModal() {
   const modal = document.getElementById("pokemon-day-modal");
   if (!modal) return;
   modal.classList.remove("hidden");
   modal.setAttribute("aria-hidden", "false");
}

function hidePokemonOfDayModal() {
   const modal = document.getElementById("pokemon-day-modal");
   if (!modal) return;
   modal.classList.add("hidden");
   modal.setAttribute("aria-hidden", "true");
}

async function ensurePokemonOfDayFormLoaded(formName) {
   if (!pokemonOfDayState || !formName) return;

   const cached = pokemonOfDayState.formCache?.[formName];
   if (cached) {
      pokemonOfDayState.activeFormName = formName;
      pokemonOfDayState.data = cached.data;
      pokemonOfDayState.topMoves = cached.topMoves;
      return;
   }

   const data = await fetchJsonOrThrow(
      `https://pokeapi.co/api/v2/pokemon/${formName}`,
      "Pokemon of the day form", {
         timeoutMs: 12000,
         maxRetries: 2
      }
   );
   const topMoves = await getTopMovesForPokemonData(data, 4);

   pokemonOfDayState.formCache[formName] = {
      data,
      topMoves
   };
   pokemonOfDayState.activeFormName = formName;
   pokemonOfDayState.data = data;
   pokemonOfDayState.topMoves = topMoves;
}

async function ensurePokemonOfDayLoaded() {
   const dateKey = getPokemonOfDayDateKey();
   if (pokemonOfDayState?.dateKey === dateKey) {
      return pokemonOfDayState;
   }

   const speciesId = getPokemonOfDayId(dateKey);
   const speciesData = await fetchJsonOrThrow(
      `https://pokeapi.co/api/v2/pokemon-species/${speciesId}`,
      "Pokemon of the day species", {
         timeoutMs: 12000,
         maxRetries: 2
      }
   );
   const defaultFormName = speciesData.varieties.find((variety) => variety.is_default)?.pokemon?.name || speciesData.name;
   const data = await fetchJsonOrThrow(
      `https://pokeapi.co/api/v2/pokemon/${defaultFormName}`,
      "Pokemon of the day", {
         timeoutMs: 12000,
         maxRetries: 2
      }
   );
   const evoData = await fetchJsonOrThrow(
      speciesData.evolution_chain.url,
      "Pokemon of the day evolution chain", {
         timeoutMs: 12000,
         maxRetries: 2
      }
   );
   const evolutions = extractEvolutionNames(evoData.chain);
   const topMoves = await getTopMovesForPokemonData(data, 4);

   pokemonOfDayState = {
      dateKey,
      speciesId,
      speciesData,
      evolutions,
      defaultFormName,
      alternateFormName: getPokemonOfDayAlternateFormName(speciesData, defaultFormName),
      activeFormName: defaultFormName,
      formCache: {
         [defaultFormName]: {
            data,
            topMoves
         },
      },
      data,
      topMoves,
      shinyEnabled: false,
   };

   return pokemonOfDayState;
}

function renderPokemonOfDayModal() {
   if (!pokemonOfDayState?.data || !pokemonOfDayState?.speciesData) return;

   const {
      data,
      speciesData,
      evolutions,
      topMoves,
      shinyEnabled,
      defaultFormName,
      alternateFormName,
      activeFormName,
      dateKey
   } = pokemonOfDayState;
   const primaryType = data.types?.[0]?.type?.name || "water";
   const secondaryType = data.types?.[1]?.type?.name || null;
   const color1 = typeColor[primaryType] || "#4a90da";
   const color2 = secondaryType && typeColor[secondaryType] ? typeColor[secondaryType] : lighten(color1, 18);
   const rarity = getPokemonRarity(speciesData);
   const rarityLabel = formatRarityLabel(rarity);
   const rarityEl = document.getElementById("pokemon-day-rarity");
   const dialogEl = document.querySelector("#pokemon-day-modal .pokemon-day-dialog");
   const typesEl = document.getElementById("pokemon-day-types");
   const imageEl = document.getElementById("pokemon-day-image");
   const artShell = document.getElementById("pokemon-day-art-shell");
   const variantToggleBtn = document.getElementById("pokemon-day-variant-toggle");
   const shinyToggleBtn = document.getElementById("pokemon-day-shiny-toggle");

   document.getElementById("pokemon-day-name").textContent = `${capitalizeWords(data.name)} #${String(data.id).padStart(3, "0")}`;
   document.getElementById("pokemon-day-date").textContent = getPokemonOfDayFormattedDate(dateKey);
   document.getElementById("pokemon-day-flavor").textContent = getPrimaryEnglishFlavor(speciesData);
   document.getElementById("pokemon-day-hp").textContent = getStatFromPokemonData(data, "hp");
   document.getElementById("pokemon-day-attack").textContent = getStatFromPokemonData(data, "attack");
   document.getElementById("pokemon-day-defense").textContent = getStatFromPokemonData(data, "defense");
   document.getElementById("pokemon-day-speed").textContent = getStatFromPokemonData(data, "speed");
   document.getElementById("pokemon-day-height").textContent = `${(data.height / 10).toFixed(1)} m`;
   document.getElementById("pokemon-day-weight").textContent = `${(data.weight / 10).toFixed(1)} kg`;
   document.getElementById("pokemon-day-region").textContent = generationRegionMap[speciesData.generation.name] || "Unknown";
   document.getElementById("pokemon-day-habitat").textContent = speciesData.habitat ? capitalizeWords(speciesData.habitat.name) : "Unknown";
   document.getElementById("pokemon-day-abilities").textContent = data.abilities.map((ability) => capitalizeWords(ability.ability.name)).join(", ") || "--";
   document.getElementById("pokemon-day-evolution").textContent = formatEvolutionLine(evolutions) || "No evolution data";
   document.getElementById("pokemon-day-moves").textContent = formatTopMovesForDisplay(topMoves, data, 4) || "--";

   if (rarityEl) {
      rarityEl.textContent = rarityLabel;
      rarityEl.style.background = `linear-gradient(135deg, ${hexToRgba(color1, 0.92)}, ${hexToRgba(color2, 0.82)})`;
      rarityEl.style.color = getContrastYIQ(color1);
   }

   if (dialogEl) {
      dialogEl.style.background = `
      radial-gradient(circle at 16% 18%, ${hexToRgba(color1, 0.22)}, transparent 34%),
      radial-gradient(circle at 82% 14%, ${hexToRgba(color2, 0.18)}, transparent 28%),
      linear-gradient(145deg, ${hexToRgba(color1, 0.56)}, ${hexToRgba(color2, 0.5)}),
      linear-gradient(145deg, rgba(11, 22, 40, 0.66), rgba(19, 39, 66, 0.62))
    `;
   }

   if (artShell) {
      artShell.style.background = `radial-gradient(circle at 26% 20%, ${hexToRgba(color1, 0.28)}, transparent 42%), linear-gradient(155deg, ${hexToRgba(color1, 0.22)}, ${hexToRgba(color2, 0.14)})`;
      artShell.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,0.06), 0 18px 36px ${hexToRgba(color1, 0.26)}`;
   }

   if (imageEl) {
      const staticFallback = shinyEnabled ?
         data?.sprites?.other?.["official-artwork"]?.front_shiny || data?.sprites?.front_shiny :
         data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;
      imageEl.onerror = () => {
         imageEl.onerror = null;
         imageEl.src = staticFallback || "";
      };
      imageEl.src = getPreferredCardImage(data, shinyEnabled);
      imageEl.alt = `${capitalizeWords(data.name)} spotlight art`;
   }

   if (typesEl) {
      typesEl.innerHTML = "";
      data.types.forEach((entry) => {
         const chip = document.createElement("span");
         const typeName = entry.type.name;
         chip.className = "pokemon-day-type";
         chip.textContent = typeName;
         chip.style.backgroundColor = typeColor[typeName] || "#ccc";
         chip.style.color = getContrastYIQ(typeColor[typeName] || "#ccc");
         typesEl.appendChild(chip);
      });
   }

   if (shinyToggleBtn) {
      shinyToggleBtn.innerHTML = shinyEnabled ?
         '<i class="fas fa-star"></i> Shiny: On' :
         '<i class="fas fa-star-half-alt"></i> Shiny: Off';
   }

   if (variantToggleBtn) {
      const variantLabel = getPokemonOfDayVariantLabel(speciesData, activeFormName, defaultFormName);
      variantToggleBtn.disabled = !alternateFormName;
      variantToggleBtn.innerHTML = `<i class="fas fa-code-branch"></i> Variant: ${variantLabel}`;
   }
}

async function openPokemonOfDayModal() {
   showPokemonOfDayModal();
   setPokemonOfDayLoadingState();

   try {
      await ensurePokemonOfDayLoaded();
      renderPokemonOfDayModal();
   } catch (err) {
      console.error(err);
      hidePokemonOfDayModal();
      showCustomAlert("Could not load Pokemon of the Day.", 2600);
   }
}

async function savePokemonOfDayToCollection() {
   if (!pokemonOfDayState?.data || !pokemonOfDayState?.speciesData) return;

   const user = await getCurrentUser();
   if (!user) {
      showCustomAlert("Please sign in to save cards.", 2500);
      return;
   }

   const rarity = getPokemonRarity(pokemonOfDayState.speciesData);
   const cardSnapshot = buildCardDataSnapshotFromEntry(
      pokemonOfDayState.data,
      pokemonOfDayState.speciesData,
      pokemonOfDayState.evolutions,
      pokemonOfDayState.topMoves,
      pokemonOfDayState.shinyEnabled
   );

   const result = await capturePokemon(
      user.id,
      pokemonOfDayState.data.id,
      pokemonOfDayState.data.name,
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
}

function loadPokemonOfDayOnGenerator() {
   if (!pokemonOfDayState?.data || !pokemonOfDayState?.speciesData) return;

   isShiny = !!pokemonOfDayState.shinyEnabled;
   shinyForced = isShiny;
   currentData = {
      data: pokemonOfDayState.data,
      speciesData: pokemonOfDayState.speciesData,
      evolutions: pokemonOfDayState.evolutions,
      topMoves: pokemonOfDayState.topMoves,
   };

   handleMegaButton(pokemonOfDayState.speciesData);
   updateUI(
      pokemonOfDayState.data,
      pokemonOfDayState.speciesData,
      pokemonOfDayState.evolutions,
      pokemonOfDayState.topMoves
   );
   updateAnalysisPanel(
      pokemonOfDayState.data,
      pokemonOfDayState.speciesData,
      pokemonOfDayState.evolutions,
      pokemonOfDayState.topMoves
   );
   hidePokemonOfDayModal();
   showCustomAlert(`${capitalizeWords(pokemonOfDayState.data.name)} loaded on the generator.`, 2200);
}

function showGuessPokemonModal() {
   const modal = document.getElementById("guess-pokemon-modal");
   if (!modal) return;
   modal.classList.remove("hidden");
   modal.setAttribute("aria-hidden", "false");
}

function hideGuessPokemonModal() {
   const modal = document.getElementById("guess-pokemon-modal");
   if (!modal) return;
   modal.classList.add("hidden");
   modal.setAttribute("aria-hidden", "true");
   if (guessPokemonState?.timerId) {
      clearInterval(guessPokemonState.timerId);
   }
}

function updateGuessPokemonTimerDisplay() {
   const timerEl = document.getElementById("guess-pokemon-timer");
   if (!timerEl) return;

   const seconds = Math.max(0, Number(guessPokemonState?.timeLeft || 0));
   timerEl.textContent = `${seconds}s`;

   if (seconds <= 5) {
      timerEl.style.color = "#ffb4b4";
      timerEl.style.borderColor = "rgba(255, 120, 120, 0.6)";
   } else {
      timerEl.style.color = "#edf4ff";
      timerEl.style.borderColor = "rgba(255, 255, 255, 0.14)";
   }
}

function renderGuessPokemonReveal() {
   if (!guessPokemonState?.data) return;

   const {
      data,
      topMoves
   } = guessPokemonState;
   const reveal = document.getElementById("guess-pokemon-reveal");
   const img = document.getElementById("guess-pokemon-image");

   if (img) {
      img.classList.remove("silhouette");
   }

   document.getElementById("guess-pokemon-name").textContent = capitalizeWords(data.name);
   document.getElementById("guess-pokemon-types").textContent = data.types.map((t) => capitalizeWords(t.type.name)).join(", ");
   document.getElementById("guess-pokemon-moves").textContent = formatTopMovesForDisplay(topMoves, data, 4) || "--";

   if (reveal) {
      reveal.classList.remove("hidden");
   }
}

function markGuessOptionResult(correctName) {
   const optionButtons = Array.from(document.querySelectorAll(".guess-option-btn"));
   optionButtons.forEach((button) => {
      const optionName = normalizePokemonName(button.dataset.pokemonName || "");
      button.disabled = true;
      if (optionName === correctName) {
         button.style.background = "rgba(83, 214, 151, 0.24)";
         button.style.borderColor = "rgba(83, 214, 151, 0.72)";
         button.style.color = "#eafff2";
      }
   });
}

function completeGuessPokemonRound(success, reason = "") {
   if (!guessPokemonState || guessPokemonState.revealed) return;

   guessPokemonState.revealed = true;
   if (guessPokemonState.timerId) {
      clearInterval(guessPokemonState.timerId);
      guessPokemonState.timerId = null;
   }

   const resultEl = document.getElementById("guess-pokemon-result");
   const dialogEl = document.querySelector("#guess-pokemon-modal .guess-pokemon-dialog");
   const correctName = normalizePokemonName(guessPokemonState.correctName);

   markGuessOptionResult(correctName);
   renderGuessPokemonReveal();

   if (resultEl) {
      if (success) {
         resultEl.textContent = `Correct! It's ${capitalizeWords(guessPokemonState.correctName)}.`;
         resultEl.style.color = "#9bffd7";

         const typeA = guessPokemonState?.data?.types?.[0]?.type?.name || "water";
         const typeB = guessPokemonState?.data?.types?.[1]?.type?.name || typeA;
         const c1 = typeColor[typeA] || "#4a90da";
         const c2 = typeColor[typeB] || lighten(c1, 18);

         if (dialogEl) {
            dialogEl.style.setProperty("--guess-type-1", hexToRgba(c1, 0.64));
            dialogEl.style.setProperty("--guess-type-2", hexToRgba(c2, 0.58));
            dialogEl.classList.add("correct-gradient");
         }
      } else if (reason === "timeout") {
         resultEl.textContent = `Time's up! It was ${capitalizeWords(guessPokemonState.correctName)}.`;
         resultEl.style.color = "#ffd0d0";
      } else {
         resultEl.textContent = `Not quite. It was ${capitalizeWords(guessPokemonState.correctName)}.`;
         resultEl.style.color = "#ffd0d0";
      }
   }
}

function checkGuessPokemonGuess(rawGuess) {
   if (!guessPokemonState || guessPokemonState.revealed) return;

   const guessed = normalizePokemonName(rawGuess);
   if (!guessed) {
      showCustomAlert("Enter a Pokemon name first.", 1800);
      return;
   }

   const correct = normalizePokemonName(guessPokemonState.correctName);

   if (guessed === correct) {
      completeGuessPokemonRound(true);
      return;
   }

   const resultEl = document.getElementById("guess-pokemon-result");
   if (resultEl) {
      resultEl.textContent = "Try again!";
      resultEl.style.color = "#ffe1b0";
   }
}

function renderGuessPokemonOptions(correctName, distractors) {
   const optionsRoot = document.getElementById("guess-pokemon-options");
   if (!optionsRoot) return;

   const options = [
         correctName,
         ...distractors,
      ]
      .map((name) => normalizePokemonName(name))
      .filter(Boolean);

   const unique = Array.from(new Set(options));
   unique.sort(() => Math.random() - 0.5);

   optionsRoot.innerHTML = "";
   unique.forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "guess-option-btn";
      button.dataset.pokemonName = name;
      button.textContent = capitalizeWords(name);
      button.addEventListener("click", () => {
         checkGuessPokemonGuess(name);
      });
      optionsRoot.appendChild(button);
   });
}

async function buildGuessPokemonDistractors(correctName, count = 3) {
   const correct = normalizePokemonName(correctName);
   const picked = new Set();

   try {
      await ensureAllPokemonCompareOptionsLoaded();
      const pool = allPokemonCompareOptions
         .map((entry) => normalizePokemonName(entry.value || entry.name))
         .filter((name) => name && name !== correct);

      while (picked.size < count && pool.length > 0) {
         const idx = Math.floor(Math.random() * pool.length);
         const candidate = pool[idx];
         if (candidate && candidate !== correct) {
            picked.add(candidate);
         }
      }
   } catch {
      // Fallback below if global list fetch fails.
   }

   while (picked.size < count) {
      const fallbackId = Math.floor(Math.random() * 1025) + 1;
      try {
         const entry = await fetchJsonOrThrow(`https://pokeapi.co/api/v2/pokemon/${fallbackId}`, "Guess Pokemon fallback", {
            timeoutMs: 8000,
            maxRetries: 1,
         });
         const candidate = normalizePokemonName(entry.name);
         if (candidate && candidate !== correct) {
            picked.add(candidate);
         }
      } catch {
         break;
      }
   }

   return Array.from(picked).slice(0, count);
}

function startGuessPokemonTimer() {
   if (!guessPokemonState) return;

   if (guessPokemonState.timerId) {
      clearInterval(guessPokemonState.timerId);
   }

   updateGuessPokemonTimerDisplay();
   guessPokemonState.timerId = setInterval(() => {
      if (!guessPokemonState || guessPokemonState.revealed) return;

      guessPokemonState.timeLeft -= 1;
      updateGuessPokemonTimerDisplay();
      if (guessPokemonState.timeLeft <= 0) {
         completeGuessPokemonRound(false, "timeout");
      }
   }, 1000);
}

async function startGuessPokemonRound() {
   const resultEl = document.getElementById("guess-pokemon-result");
   const reveal = document.getElementById("guess-pokemon-reveal");
   const input = document.getElementById("guess-pokemon-input");
   const image = document.getElementById("guess-pokemon-image");
   const dialog = document.querySelector("#guess-pokemon-modal .guess-pokemon-dialog");

   if (dialog) {
      dialog.classList.remove("correct-gradient");
      dialog.style.removeProperty("--guess-type-1");
      dialog.style.removeProperty("--guess-type-2");
      dialog.style.background = "";
   }

   if (resultEl) {
      resultEl.textContent = "Loading a Pokemon...";
      resultEl.style.color = "#eaf4ff";
   }

   if (reveal) {
      reveal.classList.add("hidden");
   }

   if (input) {
      input.value = "";
   }

   try {
      const id = Math.floor(Math.random() * 1025) + 1;
      const data = await fetchJsonOrThrow(`https://pokeapi.co/api/v2/pokemon/${id}`, "Guess Pokemon", {
         timeoutMs: 12000,
         maxRetries: 2,
      });

      const topMoves = await getTopMovesForPokemonData(data, 4);
      const correctName = normalizePokemonName(data.name);
      const distractors = await buildGuessPokemonDistractors(correctName, 3);

      guessPokemonState = {
         data,
         topMoves,
         correctName,
         revealed: false,
         timeLeft: 20,
         timerId: null,
      };

      if (image) {
         const artwork = data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default || "";
         image.classList.add("silhouette");
         image.src = artwork;
         image.onerror = () => {
            image.onerror = null;
            image.src = data?.sprites?.front_default || "";
         };
      }

      renderGuessPokemonOptions(correctName, distractors);

      if (resultEl) {
         resultEl.textContent = "Make your guess!";
         resultEl.style.color = "#eaf4ff";
      }

      startGuessPokemonTimer();
   } catch (err) {
      console.error(err);
      showCustomAlert("Could not start the guessing round.", 2400);
      if (resultEl) {
         resultEl.textContent = "Round failed to load. Try again.";
         resultEl.style.color = "#ffd0d0";
      }
   }
}

async function openGuessPokemonModal() {
   showGuessPokemonModal();
   await startGuessPokemonRound();
}

// Reset button listener (always available)
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

      const {
         data,
         speciesData,
         evolutions
      } = currentData;
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

document.getElementById("pokemon-day-close")?.addEventListener("click", hidePokemonOfDayModal);
document.getElementById("pokemon-day-modal")?.addEventListener("click", (event) => {
   if (event.target.id === "pokemon-day-modal") {
      hidePokemonOfDayModal();
   }
});

document.getElementById("pokemon-day-shiny-toggle")?.addEventListener("click", () => {
   if (!pokemonOfDayState) return;
   pokemonOfDayState.shinyEnabled = !pokemonOfDayState.shinyEnabled;
   renderPokemonOfDayModal();
});

document.getElementById("pokemon-day-variant-toggle")?.addEventListener("click", async () => {
   if (!pokemonOfDayState?.alternateFormName) return;

   const targetForm = pokemonOfDayState.activeFormName === pokemonOfDayState.defaultFormName ?
      pokemonOfDayState.alternateFormName :
      pokemonOfDayState.defaultFormName;

   try {
      await ensurePokemonOfDayFormLoaded(targetForm);
      renderPokemonOfDayModal();
   } catch (err) {
      console.error(err);
      showCustomAlert("Could not load the alternate form.", 2600);
   }
});

document.getElementById("pokemon-day-save")?.addEventListener("click", savePokemonOfDayToCollection);
document.getElementById("pokemon-day-load")?.addEventListener("click", loadPokemonOfDayOnGenerator);
document.getElementById("guess-pokemon-close")?.addEventListener("click", hideGuessPokemonModal);
document.getElementById("guess-pokemon-modal")?.addEventListener("click", (event) => {
   if (event.target.id === "guess-pokemon-modal") {
      hideGuessPokemonModal();
   }
});
document.getElementById("guess-pokemon-submit")?.addEventListener("click", () => {
   const guessInputEl = document.getElementById("guess-pokemon-input");
   checkGuessPokemonGuess(guessInputEl?.value || "");
});
document.getElementById("guess-pokemon-input")?.addEventListener("keydown", (event) => {
   if (event.key === "Enter") {
      event.preventDefault();
      checkGuessPokemonGuess(event.currentTarget?.value || "");
   }
});
document.getElementById("guess-pokemon-new")?.addEventListener("click", () => {
   startGuessPokemonRound();
});
window.addEventListener("keydown", (event) => {
   if (event.key === "Escape") {
      hidePokemonOfDayModal();
      hideGuessPokemonModal();
   }
});

document.getElementById("apply-filters").addEventListener("click", async () => {
   showCustomAlert("Loading filtered Pokémon...", Infinity);

   // Get filter values (lowercased for consistency)
   const type1 = document.getElementById("filter-type1").value.toLowerCase();
   const type2 = document.getElementById("filter-type2").value.toLowerCase();
   const region = document.getElementById("filter-region").value.toLowerCase();
   const rarity = document.getElementById("filter-rarity").value.toLowerCase();

   // Get Pokémon list (region or full)
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

   // Shuffle so results feel random
   pokemonList.sort(() => Math.random() - 0.5);

   const ultraBeasts = [
      "nihilego",
      "buzzwole",
      "pheromosa",
      "xurkitree",
      "celesteela",
      "kartana",
      "guzzlord",
      "poipole",
      "naganadel",
      "stakataka",
      "blacephalon",
   ];

   // Helper: check a cached/fetched entry against active filters
   function entryMatchesFilters(entry) {
      const {
         data,
         speciesData
      } = entry;
      const typeNames = data.types.map((t) => t.type.name.toLowerCase());
      const pokeRegion = generationRegionMap[speciesData.generation.name]?.toLowerCase();
      const pokeRarity = speciesData.is_legendary ?
         "legendary" :
         speciesData.is_mythical ?
         "mythical" :
         ultraBeasts.includes(speciesData.name) ?
         "ultra" :
         "common";
      return (
         (!type1 || typeNames.includes(type1)) &&
         (!type2 || typeNames.includes(type2)) &&
         (!region || region === pokeRegion) &&
         (!rarity || rarity === pokeRarity)
      );
   }

   // Helper: fetch a single Pokémon entry (species + pokemon) and cache it
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
      const entry = {
         data,
         speciesData
      };
      pokemonCache[name] = entry;
      return entry;
   }

   let found = null;

   // Pass 1: check cached entries instantly (no network) — often finds a match immediately
   for (const name of pokemonList) {
      if (pokemonCache[name] && entryMatchesFilters(pokemonCache[name])) {
         found = pokemonCache[name];
         break;
      }
   }

   // Pass 2: if still not found, fetch uncached entries in parallel batches of 8
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

   // Save cache to localStorage with size limit
   try {
      pokemonCache = limitCacheSize(pokemonCache, MAX_CACHE_SIZE);
      localStorage.setItem("pokemonCache", JSON.stringify(pokemonCache));
   } catch (err) {
      console.warn("Failed to save cache to localStorage:", err);
      // If still failing, clear the cache and try again
      try {
         localStorage.removeItem("pokemonCache");
         pokemonCache = {};
         console.log("Cache cleared due to quota error");
      } catch (e) {
         console.error("Could not clear cache:", e);
      }
   }

   // Show result or fallback
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

         filteredList = [found]; // keep consistent with generateBtn
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

/*========================================================================================================================================================================
  11. UI Interactions: Toggle, Search, Flip, and Mega Evolutions:
==========================================================================================================================================================================*/

// 11.1 Toggle Button: Shiny Mode ON/OFF
// Removed shiny toggle button functionality
// 11.1b: Keyboard shortcut to force shiny (Ctrl+Shift+S)
document.addEventListener("keydown", (e) => {
   // Ctrl+Shift+S: Force shiny
   if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
      if (!currentData) return;
      shinyForced = true;
      isShiny = true;
      updateUI(currentData.data, currentData.speciesData, currentData.evolutions, currentData.topMoves || []);
      updateAnalysisPanel(currentData.data, currentData.speciesData, currentData.evolutions, currentData.topMoves || []);
   }
   // Ctrl+Shift+M: Toggle Mega
   if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") {
      if (!currentData) return;
      if (!megaBtn) return;
      if (megaBtn.style.display === "none") return;
      megaBtn.click();
   }

   // Ctrl+Shift+A: Toggle animations globally
   if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      const current = (localStorage.getItem("pcgAnimationsEnabled") ?? "true") === "true";
      const next = !current;
      localStorage.setItem("pcgAnimationsEnabled", next ? "true" : "false");

      const status = next ? "On" : "Off";
      showCustomAlert(`Animations: ${status} (Ctrl+Shift+A)`, 1800);

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

// 11.2 Flip Card: Click to Flip (Simple Flip)

flipContainer.addEventListener("click", () => {
   flipContainer.classList.toggle("flipped");
});

// 11.3 Search Button Click: Get Pokémon by Name

function handleSearch() {
   const name = searchInput.value.trim();
   if (name) getPokemonByName(name);
}

searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keypress", (e) => {
   if (e.key === "Enter") handleSearch();
});

/*---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  11.4 Advanced Flip Interaction: Tilt + Flip on Hover/Click
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------*/

// 11.4.1 Elements & State

const cardElement = document.getElementById("flip-container");
const flipper = cardElement.querySelector(".flipper");
let isFlipped = false;

// 11.4.2 Flip on Click

cardElement.addEventListener("click", () => {
   isFlipped = !isFlipped;
   applyCombinedTransform();
});

// 11.4.3 Tilt on Mouse Move

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

// 11.4.4 Reset Tilt on Mouse Leave

cardElement.addEventListener("mouseleave", () => {
   applyCombinedTransform(0, 0);
});

// 11.4.5 Transform Function: Combine Tilt + Flip

function applyCombinedTransform(rotateX = 0, rotateY = 0) {
   const flipY = isFlipped ? 180 : 0;
   flipper.style.transform = `
    rotateY(${flipY}deg) 
    rotateX(${rotateX}deg) 
    rotateY(${rotateY}deg)
  `;
}

// 11.5 Mega Evolution Toggle

let megaFormData = null;

document.addEventListener("keydown", async (e) => {
   // Ctrl+Shift+G: Toggle Mega
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
         // Switch to Mega
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
         // Switch back to base
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

/*=======================================================================================================================================================================
  12. Function to Show Custom Alert Box:
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
