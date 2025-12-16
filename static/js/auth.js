import { openModal, closeModal, syncTheme } from "./utils.js";
import { loadPage } from "./loadPage.js";

const footerLoginLink = document.getElementById("footerLoginLink");
const footerRegisterLink = document.getElementById("footerRegisterLink");
const globalCloseBtns = document.querySelectorAll(".modal-close");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginModal = document.getElementById("loginModal");

export function setAuthState(isLoggedIn) {
  document.body.dataset.showLogin = isLoggedIn ? "0" : "1";

  // IMPORTANT: keep CSS-driven anon overlay in sync
  document.body.classList.toggle("force-black", !isLoggedIn);

  // Navbar buttons
  document.getElementById("loginBtn")?.classList.toggle("hidden", isLoggedIn);
  document.getElementById("registerBtn")?.classList.toggle("hidden", isLoggedIn);
  document.getElementById("logoutBtn")?.classList.toggle("hidden", !isLoggedIn);

  // Footer links
  document.getElementById("footerLoginLink")?.classList.toggle("hidden", isLoggedIn);
  document.getElementById("footerRegisterLink")?.classList.toggle("hidden", isLoggedIn);
}


export function isLoggedIn() {
  return document.body.dataset.showLogin !== "1";
}

export const registerModal = document.getElementById("registerModal");

export function initRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new URLSearchParams(new FormData(form));
    const errorEl = form.querySelector(".form-error");
    errorEl.textContent = "";

    const res = await fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
      body: data,
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      errorEl.textContent = payload.error || "Something went wrong";
      return;
    }

    await res.json().catch(() => null);

    setAuthState(true);
    syncTheme();
    closeModal(registerModal);

    const next = sessionStorage.getItem("postLoginPath") || "/home";
    sessionStorage.removeItem("postLoginPath");

    history.replaceState({}, "", next);
    await loadPage(next); // or navigate(next) if your navigate doesn't block /home
  });
}

export function initLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new URLSearchParams(new FormData(form));
    const errorEl = form.querySelector(".form-error");
    errorEl.textContent = "";

    const res = await fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
      body: data,
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      errorEl.textContent = payload.error || "Invalid credentials";
      return;
    }

    await res.json().catch(() => null);

    setAuthState(true);
    syncTheme();
    closeModal(document.getElementById("loginModal"));

    const next = sessionStorage.getItem("postLoginPath") || "/home";
    sessionStorage.removeItem("postLoginPath");

    history.replaceState({}, "", next);
    await loadPage(next);
  });
}

export function initLogout() {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;

   //  prevent attaching multiple times
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  
  btn.addEventListener("click", async () => {
    const res = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error("Logout failed:", res.status);
      return;
    }

    //  Switch to anon state immediately
    setAuthState(false);

    //  Blank app content (no anon content allowed)
    const root = document.getElementById("app-root");
    if (root) root.innerHTML = "";

    //  Reset URL
    history.replaceState({}, "", "/");

    //  Force login modal
    document.getElementById("loginModal")?.classList.add("open");
  });
}

  // Modal wiring (login/register)
export function initAuthModals() {
  loginBtn?.addEventListener('click', () => openModal(loginModal));
  registerBtn?.addEventListener('click', () => {
    // allow register even in forced-login state
    closeModal(loginModal);
    openModal(registerModal);
  });


  // Footer links
  footerLoginLink?.addEventListener('click', e => {
      e.preventDefault();
      openModal(loginModal);
  });
  footerRegisterLink?.addEventListener('click', e => {
      e.preventDefault();
      closeModal(loginModal);
      openModal(registerModal);
  });

  // In-modal switches
  document.getElementById('showRegister')?.addEventListener('click', e => {
      e.preventDefault();
      closeModal(loginModal);
      openModal(registerModal);
  });
  document.getElementById('showLogin')?.addEventListener('click', e => {
      e.preventDefault();
      closeModal(registerModal);
      openModal(loginModal);
  });

  // Global close buttons
  globalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const isAnon = document.body.dataset.showLogin === "1";
      if (isAnon) return; // 🔒 block close
  
      const modal = btn.closest('.modal-overlay');
      closeModal(modal);
    });
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.dataset.showLogin === "1") {
      e.preventDefault();
    }
  });
  

  // Click outside content to close
  [loginModal, registerModal].forEach(modal => {
    modal?.addEventListener('click', e => {
      const isLoggedInNow = document.body.dataset.showLogin !== "1";
      if (!isLoggedInNow) return; // disable backdrop close for anon users
      if (e.target === modal) closeModal(modal);
    });
  });

  const url = new URL(window.location.href);
  const show = url.searchParams.get("show");
  
  // Only open modals when URL explicitly asks for it
  if (show === "register") openModal(registerModal);
  if (show === "login") openModal(loginModal);
  
}