/*
  utils.js — Shared constants, color utilities, and network helpers.
  Loads before script.js, moves.js, pokemon-day.js, and guess-pokemon.js.
*/

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

function getContrastYIQ(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000" : "#fff";
}

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
  const normalized = safe.length === 3
    ? safe.split("").map((c) => c + c).join("")
    : safe;
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
  const animated = shiny
    ? data?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_shiny
    : data?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;

  const showdownId = String(data?.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "");

  const showdown = showdownId
    ? `https://play.pokemonshowdown.com/sprites/${shiny ? "ani-shiny" : "ani"}/${showdownId}.gif`
    : "";

  const homeAnimated = shiny
    ? data?.sprites?.other?.["official-artwork"]?.front_shiny
    : data?.sprites?.other?.["official-artwork"]?.front_default;

  const artwork = shiny
    ? data?.sprites?.other?.["official-artwork"]?.front_shiny
    : data?.sprites?.other?.["official-artwork"]?.front_default;

  const basic = shiny ? data?.sprites?.front_shiny : data?.sprites?.front_default;

  const enabled = typeof window.isAnimationsEnabled === "function"
    ? window.isAnimationsEnabled()
    : (localStorage.getItem("pcgAnimationsEnabled") ?? "true") === "true";

  if (!enabled) return artwork || basic || "";

  return animated || showdown || homeAnimated || artwork || basic || "";
}

function getCurrentPokemonLabel(data, speciesData) {
  const base = capitalizeWords(data.name || speciesData?.name || "Pokemon");
  // isMega is a global declared in script.js
  return (typeof isMega !== "undefined" && isMega) ? `${base} (Mega)` : base;
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

function createRadarCompareSnapshot(data, speciesData) {
  return {
    key: `${data.id}-${data.name}-base`,
    label: capitalizeWords(data.name || speciesData?.name || "Pokemon"),
    color: typeColor[data.types?.[0]?.type?.name] || "#4a90da",
    values: getRadarStatValues(data),
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

  applyGeneratorTheme("#3f6b8f", "#5f7a8f");
}

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
          const backoffMs = Number.isFinite(retryAfterMs) && retryAfterMs > 0
            ? retryAfterMs
            : 400 * (attempt + 1);
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

// Apply theme early so the first loading alert uses type-based colors instead of defaults
initializeGeneratorThemeFromRecent();
