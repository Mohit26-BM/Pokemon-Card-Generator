document.addEventListener("DOMContentLoaded", async () => {
   window.initWelcomeScreen = function () {
      const title = "Welcome to the Pokémon Card Generator!";
      const subtitle = "Discover Pokémon, their types, stats, evolutions, and more.";
      const titleEl = document.getElementById("welcome-title");
      const subEl = document.getElementById("welcome-subtext");
      const registerTab = document.getElementById("tab-register");
      const signInTab = document.getElementById("tab-signin");
      const registerPanel = document.getElementById("panel-register");
      const signInPanel = document.getElementById("panel-signin");

      function switchAuthTab(mode) {
         const isRegister = mode === "register";
         registerTab.classList.toggle("active", isRegister);
         signInTab.classList.toggle("active", !isRegister);
         registerPanel.classList.toggle("active", isRegister);
         signInPanel.classList.toggle("active", !isRegister);
         registerTab.setAttribute("aria-selected", String(isRegister));
         signInTab.setAttribute("aria-selected", String(!isRegister));
         registerPanel.hidden = !isRegister;
         signInPanel.hidden = isRegister;
      }
      if (registerTab && signInTab && registerPanel && signInPanel) {
         registerTab.addEventListener("click", () => switchAuthTab("register"));
         signInTab.addEventListener("click", () => switchAuthTab("signin"));
      }

      function typeWriter(text, element, speed = 55, callback = null) {
         let i = 0;
         element.textContent = "";

         function type() {
            if (i < text.length) {
               element.textContent += text.charAt(i);
               i++;
               setTimeout(type, speed);
            } else if (callback) {
               callback();
            }
         }
         type();
      }
      if (titleEl && subEl) {
         typeWriter(title, titleEl, 55, () => {
            setTimeout(() => {
               typeWriter(subtitle, subEl, 35);
            }, 500);
         });
      }
   };
   console.log("welcome.js loaded - DOMContentLoaded fired");
   const welcomeScreenEl = document.getElementById("welcome-screen");
   const generatorContainer = document.querySelector(".container");
   const bgLayerA = document.querySelector(".welcome-bg-layer.layer-a");
   const bgLayerB = document.querySelector(".welcome-bg-layer.layer-b");
   let welcomeBackgroundStarted = false;

   function resetGeneratorVisualState() {
      document.body.style.removeProperty("background");

      const flipContainer = document.getElementById("flip-container");
      if (flipContainer) {
         flipContainer.style.removeProperty("filter");
      }
   }

   function showWelcomeScreen() {
      resetGeneratorVisualState();
      if (welcomeScreenEl) {
         welcomeScreenEl.style.display = "flex";
      }
      if (generatorContainer) {
         generatorContainer.style.display = "none";
      }
   }

   function showGeneratorScreen() {
      if (welcomeScreenEl) {
         welcomeScreenEl.style.display = "none";
      }
      if (generatorContainer) {
         generatorContainer.style.display = "flex";
      }
   }

   function startBackgroundSlideshow() {
      if (welcomeBackgroundStarted || !bgLayerA || !bgLayerB) return;
      welcomeBackgroundStarted = true;

      const backgrounds = Array.from({
            length: 31
         },
         (_, index) => `Images/backgrounds/${index + 1}.webp`
      );

      let currentIndex = Math.floor(Math.random() * backgrounds.length);
      let activeLayer = bgLayerA;
      let standbyLayer = bgLayerB;
      const motionPresets = ["motion-a", "motion-b", "motion-c", "motion-d"];
      let motionIndex = 0;

      function applyMotionPreset(layer, preset) {
         layer.classList.remove("motion-a", "motion-b", "motion-c", "motion-d");
         layer.classList.add(preset);
      }

      activeLayer.style.backgroundImage = `url('${backgrounds[currentIndex]}')`;
      applyMotionPreset(activeLayer, motionPresets[motionIndex]);
      activeLayer.classList.add("active");
      standbyLayer.classList.remove("active", "motion-a", "motion-b", "motion-c", "motion-d");

      setInterval(() => {
         currentIndex = (currentIndex + 1) % backgrounds.length;
         motionIndex = (motionIndex + 1) % motionPresets.length;

         standbyLayer.style.backgroundImage = `url('${backgrounds[currentIndex]}')`;
         applyMotionPreset(standbyLayer, motionPresets[motionIndex]);

         standbyLayer.classList.add("active");
         activeLayer.classList.remove("active");

         const previousLayer = activeLayer;
         activeLayer = standbyLayer;
         standbyLayer = previousLayer;
      }, 8200);
   }

   startBackgroundSlideshow();

   // Sign Out Button Handler (setup first, before early return)
   const signoutBtn = document.getElementById("signout-btn");
   if (signoutBtn) {
      signoutBtn.addEventListener("click", async () => {
         console.log("Sign out button clicked");
         const result = await signOutUser();

         if (result.success) {
            console.log("Sign out successful");
            // Redirect to welcome screen
            showWelcomeScreen();
            showAlert("Signed out successfully!", "success");
         } else {
            console.error("Sign out failed:", result.message);
            showAlert(result.message, "error");
         }
      });
   }

   // Check if user is already logged in
   const existingUser = await getCurrentUser();
   console.log("Checking for existing session:", existingUser);
   if (existingUser) {
      console.log("User already logged in, navigating to generator");
      showGeneratorScreen();
      getPokemon();
      return; // Skip welcome screen initialization
   }

   const title = "Welcome to the Pokémon Card Generator!";
   const subtitle =
      "Discover Pokémon, their types, stats, evolutions, and more.";
   const titleEl = document.getElementById("welcome-title");
   const subEl = document.getElementById("welcome-subtext");
   const registerTab = document.getElementById("tab-register");
   const signInTab = document.getElementById("tab-signin");
   const registerPanel = document.getElementById("panel-register");
   const signInPanel = document.getElementById("panel-signin");

   function switchAuthTab(mode) {
      const isRegister = mode === "register";

      registerTab.classList.toggle("active", isRegister);
      signInTab.classList.toggle("active", !isRegister);
      registerPanel.classList.toggle("active", isRegister);
      signInPanel.classList.toggle("active", !isRegister);

      registerTab.setAttribute("aria-selected", String(isRegister));
      signInTab.setAttribute("aria-selected", String(!isRegister));
      registerPanel.hidden = !isRegister;
      signInPanel.hidden = isRegister;
   }

   if (registerTab && signInTab && registerPanel && signInPanel) {
      registerTab.addEventListener("click", () => switchAuthTab("register"));
      signInTab.addEventListener("click", () => switchAuthTab("signin"));
   }

   function typeWriter(text, element, speed = 55, callback = null) {
      let i = 0;

      function type() {
         if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
         } else if (callback) {
            callback();
         }
      }
      type();
   }

   typeWriter(title, titleEl, 55, () => {
      setTimeout(() => {
         typeWriter(subtitle, subEl, 35);
      }, 500);
   });

   function checkPasswordStrength(password, fillId, textId) {
      const fill = document.getElementById(fillId);
      const text = document.getElementById(textId);
      if (!fill || !text) return;

      let strength = 0;
      const length = password.length;

      if (length >= 8) strength++;
      if (length >= 12) strength++;
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
      if (/\d/.test(password)) strength++;
      if (/[!@#$%^&*()_+\-=\[\]{};':",./<>?]/.test(password)) strength++;

      fill.classList.remove("weak", "fair", "good", "strong");
      text.classList.remove("text-weak", "text-fair", "text-good", "text-strong");

      if (!password) {
         fill.style.width = "0%";
         text.textContent = "";
      } else if (strength < 2) {
         fill.classList.add("weak");
         text.classList.add("text-weak");
         text.textContent = "Weak";
      } else if (strength < 3) {
         fill.classList.add("fair");
         text.classList.add("text-fair");
         text.textContent = "Fair";
      } else if (strength < 4) {
         fill.classList.add("good");
         text.classList.add("text-good");
         text.textContent = "Good";
      } else {
         fill.classList.add("strong");
         text.classList.add("text-strong");
         text.textContent = "Strong";
      }
   }

   const registerPass = document.querySelector("#panel-register input[name='password']");
   const signinPass = document.querySelector("#panel-signin input[name='signin-password']");

   if (registerPass) {
      registerPass.addEventListener("input", (e) => {
         checkPasswordStrength(e.target.value, "strength-fill-register", "strength-text-register");
      });
   }

   if (signinPass) {
      signinPass.addEventListener("input", (e) => {
         checkPasswordStrength(e.target.value, "strength-fill-signin", "strength-text-signin");
      });
   }

   // Auth Button Handlers
   const registerBtn = document.getElementById("register-btn");
   const signinBtn = document.getElementById("signin-btn");
   console.log("Register button found:", registerBtn);
   console.log("SignIn button found:", signinBtn);

   function showAlert(message, type = "success") {
      console.log("showAlert called with:", message, type);
      const alertBox = document.getElementById("custom-alert");
      const alertMsg = document.getElementById("custom-alert-message");
      console.log("Alert elements found:", {
         alertBox,
         alertMsg
      });
      if (alertBox && alertMsg) {
         alertMsg.textContent = message;
         alertBox.classList.remove("hidden");
         alertBox.style.display = "flex"; // Override display: none from .hidden
         alertBox.classList.add("show");
         setTimeout(() => {
            alertBox.classList.remove("show");
            setTimeout(() => {
               alertBox.classList.add("hidden");
               alertBox.style.display = "none";
            }, 300);
         }, 3000);
      } else {
         console.warn("Alert box or message element not found!");
      }
   }

   function navigateToGenerator() {
      console.log("navigateToGenerator called");
      showGeneratorScreen();
      getPokemon();
      console.log("Navigated to generator screen");
   }

   if (registerBtn) {
      console.log("Attaching register button listener");
      registerBtn.addEventListener("click", async (e) => {
         e.preventDefault();
         console.log("Register button clicked");
         const nameInput = document.querySelector('#panel-register input[name="name"]');
         const emailInput = document.querySelector('#panel-register input[name="email"]');
         const passInput = document.querySelector('#panel-register input[name="password"]');

         console.log("Form inputs found:", {
            nameInput,
            emailInput,
            passInput
         });

         const trainerName = nameInput?.value?.trim();
         const email = emailInput?.value?.trim();
         const password = passInput?.value;

         console.log("Form values:", {
            trainerName,
            email,
            password
         });

         if (!trainerName || !email || !password) {
            console.log("Validation failed - missing fields");
            showAlert("Please fill in all fields", "error");
            return;
         }

         if (password.length < 8) {
            console.log("Validation failed - password too short");
            showAlert("Password must be at least 8 characters", "error");
            return;
         }

         registerBtn.disabled = true;
         registerBtn.textContent = "Registering...";

         console.log("Calling registerUser with:", email, trainerName);
         const result = await registerUser(email, password, trainerName);
         console.log("registerUser result:", result);

         registerBtn.disabled = false;
         registerBtn.textContent = "Register";

         if (result.success) {
            console.log("Registration successful!");
            showAlert(result.message, "success");
            // Clear form
            nameInput.value = "";
            emailInput.value = "";
            passInput.value = "";

            // Wait for session to be fully established before navigating
            console.log("Waiting for session to establish...");
            setTimeout(async () => {
               const user = await getCurrentUser();
               console.log("Session check before navigation:", user);
               if (user) {
                  console.log("Session confirmed, navigating to generator");
                  navigateToGenerator();
               } else {
                  console.warn("Session not ready yet, waiting longer...");
                  setTimeout(async () => {
                     const retryUser = await getCurrentUser();
                     console.log("Retry session check:", retryUser);
                     if (retryUser) {
                        navigateToGenerator();
                     } else {
                        showAlert("Please sign in again", "error");
                     }
                  }, 1500);
               }
            }, 1500);
         } else {
            console.log("Registration failed:", result.message);
            showAlert(result.message, "error");
         }
      });
   }

   if (signinBtn) {
      console.log("Attaching signin button listener");
      signinBtn.addEventListener("click", async (e) => {
         e.preventDefault();
         console.log("SignIn button clicked");
         const emailInput = document.querySelector('#panel-signin input[name="signin-email"]');
         const passInput = document.querySelector('#panel-signin input[name="signin-password"]');

         const email = emailInput?.value?.trim();
         const password = passInput?.value;

         if (!email || !password) {
            showAlert("Please fill in all fields", "error");
            return;
         }

         signinBtn.disabled = true;
         signinBtn.textContent = "Signing in...";

         const result = await signInUser(email, password);

         signinBtn.disabled = false;
         signinBtn.textContent = "Sign In";

         if (result.success) {
            showAlert(result.message, "success");
            // Clear form
            emailInput.value = "";
            passInput.value = "";

            // Wait for session to be fully established
            setTimeout(async () => {
               const user = await getCurrentUser();
               if (user) {
                  navigateToGenerator();
               } else {
                  showAlert("Session error, please try again", "error");
               }
            }, 1000);
         } else {
            showAlert(result.message, "error");
         }
      });
   }

   // Check if user is already logged in
   onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session);
      if (session && event === "SIGNED_IN") {
         console.log("User signed in via auth state change, navigating...");
         navigateToGenerator();
      }
   });
});
