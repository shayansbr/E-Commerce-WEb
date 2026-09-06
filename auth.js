// ============================================================
// AUTH LOGIC — shared across login.html / signup.html / index.html
// Depends on firebase-config.js being loaded first.
// ============================================================

const googleProvider = new firebase.auth.GoogleAuthProvider();

function showError(el, message) {
  el.textContent = message;
  el.classList.add("is-visible");
}

function clearError(el) {
  el.textContent = "";
  el.classList.remove("is-visible");
}

function setLoading(button, isLoading) {
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
}

// -------------------- SIGN UP --------------------
function initSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const errorEl = document.getElementById("form-error");
  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(errorEl);

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const role = form.querySelector("input[name='role']:checked")?.value || "user";

    if (password.length < 6) {
      showError(errorEl, "Password needs at least 6 characters.");
      return;
    }

    setLoading(submitBtn, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });

      await db.collection("users").doc(cred.user.uid).set({
        name,
        email,
        role, // "user" or "vendor"
        status: role === "vendor" ? "pending" : "active", // vendors need admin approval
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      window.location.href = role === "vendor" ? "vendor-pending.html" : "dashboard.html";
    } catch (err) {
      showError(errorEl, humanizeAuthError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });

  const googleBtn = document.getElementById("google-btn");
  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleGoogleAuth(errorEl));
  }
}

// -------------------- LOG IN --------------------
function initLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const errorEl = document.getElementById("form-error");
  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(errorEl);

    const email = form.email.value.trim();
    const password = form.password.value;

    setLoading(submitBtn, true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(errorEl, humanizeAuthError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });

  const googleBtn = document.getElementById("google-btn");
  if (googleBtn) {
    googleBtn.addEventListener("click", () => handleGoogleAuth(errorEl));
  }
}

async function handleGoogleAuth(errorEl) {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const userRef = db.collection("users").doc(result.user.uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        name: result.user.displayName || "",
        email: result.user.email,
        role: "user",
        status: "active",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    window.location.href = "dashboard.html";
  } catch (err) {
    if (errorEl) showError(errorEl, humanizeAuthError(err));
  }
}

// -------------------- LOG OUT --------------------
function initLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return;
  logoutBtn.addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "index.html";
  });
}

// -------------------- NAV STATE (logged in vs logged out) --------------------
function initAuthAwareNav() {
  const guestLinks = document.querySelectorAll("[data-guest-only]");
  const userLinks = document.querySelectorAll("[data-user-only]");

  auth.onAuthStateChanged((user) => {
    guestLinks.forEach((el) => (el.style.display = user ? "none" : ""));
    userLinks.forEach((el) => (el.style.display = user ? "" : "none"));
  });
}

function humanizeAuthError(err) {
  const map = {
    "auth/email-already-in-use": "That email is already registered — try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password needs at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Try again.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing."
  };
  return map[err.code] || "Something went wrong. Please try again.";
}

document.addEventListener("DOMContentLoaded", () => {
  initSignupForm();
  initLoginForm();
  initLogout();
  initAuthAwareNav();
});
