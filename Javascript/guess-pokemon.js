/*
  guess-pokemon.js — "Who's That Pokemon?" guessing game modal.
  Depends on: utils.js, moves.js, script.js (globals: guessPokemonState, normalizePokemonName,
    allPokemonCompareOptions, ensureAllPokemonCompareOptionsLoaded, showCustomAlert,
    typeColor, hexToRgba, lighten, capitalizeWords, formatTopMovesForDisplay,
    fetchJsonOrThrow, getTopMovesForPokemonData)
  Loads after script.js.
*/

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

  const { data, topMoves } = guessPokemonState;
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
    // fall through to API fallback below
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

// ── Event listeners ──────────────────────────────────────────────────────────

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
