/*
  pokemon-day.js — Pokemon of the Day spotlight modal.
  Depends on: utils.js, moves.js, script.js (globals: pokemonOfDayState, extractEvolutionNames,
    getPokemonRarity, formatRarityLabel, buildCardDataSnapshotFromEntry, getPreferredCardImage,
    showCustomAlert, updateUI, updateAnalysisPanel, handleMegaButton,
    currentData, isShiny, shinyForced, isMega)
  Loads after script.js.
*/

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
  const trimmed = speciesName && formName.startsWith(`${speciesName}-`)
    ? formName.slice(speciesName.length + 1)
    : formName;
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
  if (dateEl) dateEl.textContent = "Fetching today's featured Pokemon";
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
    "Pokemon of the day form",
    { timeoutMs: 12000, maxRetries: 2 }
  );
  const topMoves = await getTopMovesForPokemonData(data, 4);

  pokemonOfDayState.formCache[formName] = { data, topMoves };
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
    "Pokemon of the day species",
    { timeoutMs: 12000, maxRetries: 2 }
  );
  const defaultFormName = speciesData.varieties.find((variety) => variety.is_default)?.pokemon?.name || speciesData.name;
  const data = await fetchJsonOrThrow(
    `https://pokeapi.co/api/v2/pokemon/${defaultFormName}`,
    "Pokemon of the day",
    { timeoutMs: 12000, maxRetries: 2 }
  );
  const evoData = await fetchJsonOrThrow(
    speciesData.evolution_chain.url,
    "Pokemon of the day evolution chain",
    { timeoutMs: 12000, maxRetries: 2 }
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
      [defaultFormName]: { data, topMoves },
    },
    data,
    topMoves,
    shinyEnabled: false,
  };

  return pokemonOfDayState;
}

function renderPokemonOfDayModal() {
  if (!pokemonOfDayState?.data || !pokemonOfDayState?.speciesData) return;

  const { data, speciesData, evolutions, topMoves, shinyEnabled, defaultFormName, alternateFormName, activeFormName, dateKey } = pokemonOfDayState;
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
    const staticFallback = shinyEnabled
      ? data?.sprites?.other?.["official-artwork"]?.front_shiny || data?.sprites?.front_shiny
      : data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;
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
    shinyToggleBtn.innerHTML = shinyEnabled
      ? '<i class="fas fa-star"></i> Shiny: On'
      : '<i class="fas fa-star-half-alt"></i> Shiny: Off';
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

// ── Event listeners ──────────────────────────────────────────────────────────

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

  const targetForm = pokemonOfDayState.activeFormName === pokemonOfDayState.defaultFormName
    ? pokemonOfDayState.alternateFormName
    : pokemonOfDayState.defaultFormName;

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
