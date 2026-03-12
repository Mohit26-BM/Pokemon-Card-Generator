(function () {
  const STORAGE_KEY = "pcgAnimationsEnabled";

  function isAnimationsEnabled() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  }

  function setAnimationsEnabled(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
      // Ignore storage failures and keep default behavior.
    }
  }

  function renderToggleButton(btn) {
    if (!btn) return;
    const enabled = isAnimationsEnabled();
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.setAttribute("title", enabled ? "Turn animations off" : "Turn animations on");
    btn.innerHTML = enabled
      ? '<i class="fas fa-film"></i> Animations: On'
      : '<i class="fas fa-stop-circle"></i> Animations: Off';
  }

  function initAnimationToggleButton() {
    const btn = document.getElementById("anim-toggle-btn");
    if (!btn) return;

    renderToggleButton(btn);
    btn.addEventListener("click", () => {
      const next = !isAnimationsEnabled();
      setAnimationsEnabled(next);
      renderToggleButton(btn);
      window.dispatchEvent(new CustomEvent("pcg-animations-changed", { detail: { enabled: next } }));
      window.location.reload();
    });
  }

  window.isAnimationsEnabled = isAnimationsEnabled;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAnimationToggleButton);
  } else {
    initAnimationToggleButton();
  }
})();
