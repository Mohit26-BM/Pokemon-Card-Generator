/* ─────────────────────────────────────────
   profile.js  —  Trainer Profile Page Logic
   ───────────────────────────────────────── */

const BUCKET = "trainers-avatars";
const DEFAULT_AVATAR = "Images/default-avatar.png";

let currentUser = null;

// ── Particles ──────────────────────────────
(function spawnParticles() {
  const container = document.getElementById("bg-particles");
  if (!container) return;
  for (let i = 0; i < 18; i++) {
    const span = document.createElement("span");
    const size = Math.random() * 60 + 20;
    span.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 14 + 10}s;
      animation-delay:${Math.random() * 10}s;
    `;
    container.appendChild(span);
  }
})();

// ── Toast ──────────────────────────────────
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = "toast"; }, 3200);
}

// ── Load profile data ──────────────────────
async function loadProfile() {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  // Populate email (read-only)
  const emailEl = document.getElementById("trainer-email");
  if (emailEl) emailEl.value = currentUser.email || "";

  // Load from trainers table
  const trainerRes = await getUserProfile(currentUser.id);
  if (trainerRes.success && trainerRes.data) {
    const t = trainerRes.data;
    const nameEl = document.getElementById("trainer-name");
    if (nameEl) nameEl.value = t.trainer_name || "";
  }

  // Load from trainer_profiles table
  const profileRes = await getTrainerProfile(currentUser.id);
  if (profileRes.success && profileRes.data) {
    const p = profileRes.data;
    const bioEl = document.getElementById("trainer-bio");
    const publicToggle = document.getElementById("public-name-toggle");
    const avatarImg = document.getElementById("avatar-img");

    if (bioEl) bioEl.value = p.bio || "";
    if (publicToggle) publicToggle.checked = !!p.name_public;
    if (avatarImg && p.avatar_url) {
      avatarImg.src = p.avatar_url;
      avatarImg.onerror = () => { avatarImg.src = DEFAULT_AVATAR; };
    }
  }

  // Load preferences
  const { data: prefData } = await supabaseClient
    .from("trainer_preferences")
    .select("*")
    .eq("trainer_id", currentUser.id)
    .maybeSingle();

  if (prefData) {
    const favTypeEl = document.getElementById("fav-type");
    const animToggle = document.getElementById("anim-pref-toggle");
    if (favTypeEl && prefData.favorite_type) favTypeEl.value = prefData.favorite_type;
    if (animToggle) animToggle.checked = prefData.show_animations !== false;
  } else {
    // Default anim toggle to localStorage value (matches the rest of the app)
    const animToggle = document.getElementById("anim-pref-toggle");
    if (animToggle) {
      animToggle.checked = localStorage.getItem("animationsEnabled") !== "false";
    }
  }

  // Load stats
  await loadStats(currentUser.id);

  // Joined date
  const joinedEl = document.getElementById("stat-joined");
  if (joinedEl && currentUser.created_at) {
    const d = new Date(currentUser.created_at);
    joinedEl.textContent = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
}

async function loadStats(trainerId) {
  // Captured count
  const { data: captured } = await supabaseClient
    .from("captured_pokemon")
    .select("id", { count: "exact", head: true })
    .eq("trainer_id", trainerId);

  const { count: capturedCount } = await supabaseClient
    .from("captured_pokemon")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", trainerId);

  const capturedEl = document.getElementById("stat-captured");
  if (capturedEl) capturedEl.textContent = capturedCount ?? 0;

  // Teams count
  const { count: teamsCount } = await supabaseClient
    .from("trainer_teams")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", trainerId);

  const teamsEl = document.getElementById("stat-teams");
  if (teamsEl) teamsEl.textContent = teamsCount ?? 0;

  // Favourites count
  const { count: favCount } = await supabaseClient
    .from("captured_pokemon")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", trainerId)
    .eq("is_favorite", true);

  const favEl = document.getElementById("stat-favorites");
  if (favEl) favEl.textContent = favCount ?? 0;
}

// ── Avatar upload ──────────────────────────
document.getElementById("avatar-input")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file || !currentUser) return;

  // Validate file type and size (max 3 MB)
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    showToast("Only PNG, JPG, or WebP images are allowed.", "error");
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    showToast("Image must be under 3 MB.", "error");
    return;
  }

  const loader = document.getElementById("avatar-loader");
  if (loader) loader.style.display = "flex";

  const filePath = `${currentUser.id}/avatar.${file.name.split(".").pop()}`;

  // Remove old file first (upsert-style: delete then upload)
  await supabaseClient.storage.from(BUCKET).remove([filePath]);

  const { error: uploadError } = await supabaseClient.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    if (loader) loader.style.display = "none";
    showToast("Avatar upload failed: " + uploadError.message, "error");
    return;
  }

  // Get signed URL (bucket is private)
  const { data: urlData, error: urlError } = await supabaseClient.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1-year signed URL

  if (urlError || !urlData?.signedUrl) {
    if (loader) loader.style.display = "none";
    showToast("Could not retrieve avatar URL.", "error");
    return;
  }

  const avatarUrl = urlData.signedUrl;

  // Save avatar_url to trainer_profiles
  const { error: profileError } = await supabaseClient
    .from("trainer_profiles")
    .upsert(
      { trainer_id: currentUser.id, avatar_url: avatarUrl },
      { onConflict: "trainer_id" }
    );

  if (loader) loader.style.display = "none";

  if (profileError) {
    showToast("Saved image but could not update profile: " + profileError.message, "error");
    return;
  }

  // Update displayed avatar
  const avatarImg = document.getElementById("avatar-img");
  if (avatarImg) {
    avatarImg.src = avatarUrl;
    avatarImg.onerror = () => { avatarImg.src = DEFAULT_AVATAR; };
  }

  showToast("Avatar updated!", "success");
});

// ── Save profile ───────────────────────────
document.getElementById("save-profile-btn")?.addEventListener("click", async () => {
  if (!currentUser) return;

  const saveBtn = document.getElementById("save-profile-btn");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }

  const trainerName = document.getElementById("trainer-name")?.value?.trim() || "";
  const bio = document.getElementById("trainer-bio")?.value?.trim() || "";
  const namePublic = document.getElementById("public-name-toggle")?.checked ?? false;
  const favType = document.getElementById("fav-type")?.value || null;
  const showAnimations = document.getElementById("anim-pref-toggle")?.checked ?? true;

  // Validate trainer name
  if (trainerName.length < 2) {
    showToast("Trainer name must be at least 2 characters.", "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile'; }
    return;
  }

  // 1) Update trainers table (trainer_name)
  const { error: trainerErr } = await supabaseClient
    .from("trainers")
    .update({ trainer_name: trainerName })
    .eq("id", currentUser.id);

  if (trainerErr) {
    showToast("Failed to save name: " + trainerErr.message, "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile'; }
    return;
  }

  // 2) Upsert trainer_profiles (bio, name_public)
  const { error: profileErr } = await supabaseClient
    .from("trainer_profiles")
    .upsert(
      { trainer_id: currentUser.id, bio, name_public: namePublic },
      { onConflict: "trainer_id" }
    );

  if (profileErr) {
    showToast("Failed to save profile: " + profileErr.message, "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile'; }
    return;
  }

  // 3) Upsert trainer_preferences
  const { error: prefErr } = await supabaseClient
    .from("trainer_preferences")
    .upsert(
      { trainer_id: currentUser.id, favorite_type: favType, show_animations: showAnimations },
      { onConflict: "trainer_id" }
    );

  if (prefErr) {
    showToast("Failed to save preferences: " + prefErr.message, "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile'; }
    return;
  }

  // Sync animation preference to localStorage (matches rest of app)
  localStorage.setItem("animationsEnabled", showAnimations ? "true" : "false");

  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile'; }
  showToast("Profile saved successfully!", "success");
});

// ── Sign out ───────────────────────────────
document.getElementById("signout-btn")?.addEventListener("click", async () => {
  const result = await signOutUser();
  if (result.success) {
    window.location.href = "index.html";
  } else {
    showToast(result.message, "error");
  }
});

// ── Boot ───────────────────────────────────
document.addEventListener("DOMContentLoaded", loadProfile);
