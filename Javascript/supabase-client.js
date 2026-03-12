/**
 * Supabase Client Configuration
 * Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY with your actual Supabase credentials
 * Get these from your Supabase project dashboard: https://app.supabase.com
 */

const SUPABASE_URL = "https://upcxtyafiyhaccciaxji.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwY3h0eWFmaXloYWNjY2lheGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTY4NzYsImV4cCI6MjA4ODY3Mjg3Nn0.MvtjhaVJ_c6FOJUry3G7-PmTqF-pGjG99GWelCjeM_I";

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Register a new trainer
 */
async function registerUser(email, password, trainerName) {
  try {
    console.log("registerUser called with:", email, trainerName);
    // Sign up with Supabase Auth (trigger will auto-create profiles)
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          trainer_name: trainerName
        }
      }
    });

    console.log("Auth signup response:", { data, error });

    if (error) {
      console.error("Auth signup error:", error.message);
      return { success: false, message: error.message };
    }

    // If email confirmation is disabled, user is auto-signed in
    // If enabled, they need to check their email first
    return {
      success: true,
      message: data.user.identities.length > 0 
        ? "Registration successful! You can now explore." 
        : "Registration successful! Please check your email to verify.",
      user: data.user,
    };
  } catch (err) {
    console.error("registerUser exception:", err);
    return { success: false, message: err.message };
  }
}

/**
 * Sign in existing user
 */
async function signInUser(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: "Sign in successful!",
      user: data.user,
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Sign out current user
 */
async function signOutUser() {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Signed out successfully!" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Get current logged-in user
 */
async function getCurrentUser() {
  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    console.log("getCurrentUser result:", user);
    return user;
  } catch (err) {
    console.error("Error getting current user:", err);
    return null;
  }
}

/**
 * Get trainer profile from trainers table
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabaseClient
      .from("trainers")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Get trainer profile stats
 */
async function getTrainerProfile(trainerId) {
  try {
    const { data, error } = await supabaseClient
      .from("trainer_profiles")
      .select("*")
      .eq("trainer_id", trainerId)
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Capture a Pokemon (save to collection)
 */
async function capturePokemon(
  trainerId,
  pokemonId,
  pokemonName,
  cardData,
  rarity = "common"
) {
  try {
    // Check duplicate first for this trainer to avoid conflict requests
    const { data: existing, error: existingError } = await supabaseClient
      .from("captured_pokemon")
      .select("id")
      .eq("trainer_id", trainerId)
      .eq("pokemon_id", pokemonId)
      .maybeSingle();

    if (existingError) {
      return { success: false, message: existingError.message };
    }

    if (existing) {
      return {
        success: false,
        message: "This Pokemon is already in your collection.",
      };
    }

    const payload = {
      trainer_id: trainerId,
      pokemon_id: pokemonId,
      pokemon_name: pokemonName,
      card_data: cardData, // JSONB object with types, stats, moves, abilities, etc.
      rarity: rarity,
      is_favorite: false,
      date_captured: new Date(),
    };

    const { data, error } = await supabaseClient
      .from("captured_pokemon")
      .insert([payload])
      .select();

    if (error) {
      // Gracefully handle unique conflicts from DB constraints
      if (error.code === "23505") {
        return {
          success: false,
          message: "This Pokemon is already in your collection.",
        };
      }
      return { success: false, message: error.message };
    }

    return { success: true, message: "Pokemon captured!", data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Get all captured Pokemon for a trainer
 */
async function getTrainerPokemon(trainerId) {
  try {
    const { data, error } = await supabaseClient
      .from("captured_pokemon")
      .select("*")
      .eq("trainer_id", trainerId)
      .order("date_captured", { ascending: false });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Delete a captured Pokemon from collection
 */
async function deleteTrainerPokemon(capturedPokemonId) {
  try {
    const { error } = await supabaseClient
      .from("captured_pokemon")
      .delete()
      .eq("id", capturedPokemonId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Pokemon removed from collection!" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Toggle favorite status for a Pokemon
 */
async function toggleFavoritePokemon(capturedPokemonId, isFavorite) {
  try {
    const { error } = await supabaseClient
      .from("captured_pokemon")
      .update({ is_favorite: isFavorite })
      .eq("id", capturedPokemonId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Favorite status updated!" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Create a new team (6 Pokemon)
 */
async function createTeam(trainerId, teamName, teamDescription, pokemonIds) {
  try {
    // Validate 6 Pokemon
    if (pokemonIds.length !== 6) {
      return { success: false, message: "A team must have exactly 6 Pokemon!" };
    }

    const { data, error } = await supabaseClient
      .from("trainer_teams")
      .insert([
        {
          trainer_id: trainerId,
          team_name: teamName,
          team_description: teamDescription,
          pokemon_ids: pokemonIds,
        },
      ])
      .select();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Team created!", data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Get all teams for a trainer
 */
async function getTrainerTeams(trainerId) {
  try {
    const { data, error } = await supabaseClient
      .from("trainer_teams")
      .select("*")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Update a team
 */
async function updateTeam(teamId, teamName, teamDescription, pokemonIds) {
  try {
    const { error } = await supabaseClient
      .from("trainer_teams")
      .update({
        team_name: teamName,
        team_description: teamDescription,
        pokemon_ids: pokemonIds,
      })
      .eq("id", teamId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Team updated!" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Delete a team
 */
async function deleteTeam(teamId) {
  try {
    const { error } = await supabaseClient
      .from("trainer_teams")
      .delete()
      .eq("id", teamId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Team deleted!" };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Listen for auth state changes
 */
function onAuthStateChange(callback) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
