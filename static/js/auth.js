import {redirectIfError, openModal, closeModal} from "./utils.js";

const footerLoginLink = document.getElementById("footerLoginLink");
const footerRegisterLink = document.getElementById("footerRegisterLink");
const globalCloseBtns = document.querySelectorAll(".modal-close");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginModal = document.getElementById("loginModal");
export const registerModal = document.getElementById("registerModal");

export function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;
  
    form.addEventListener('submit', async e => {
      e.preventDefault();
  
      // package up field values
      const data = new URLSearchParams(new FormData(form));
      const errorEl = form.querySelector('.form-error');
      errorEl.textContent = '';
  
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: data
        });
  
        if (res.ok) {
          // success → go to home
          window.location.href = '/home';
        } else {
          // failure → show server‐side message in modal
          const payload = await res.json();
          console.log(payload.error);
          errorEl.textContent = payload.error || 'Something went wrong';
        }
      } catch (err) {
        console.error('Network error:', err);
        errorEl.textContent = 'Network error, please try again';
      }
    });
  }
  
export function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;
  
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = new URLSearchParams(new FormData(form));
      const errorEl = form.querySelector('.form-error');
      errorEl.textContent = '';
  
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: data
        });
  
        if (res.ok) {
          const payload = await res.json();
          window.location.href = payload.redirect || '/home';
        } else {
          const payload = await res.json();
          errorEl.textContent = payload.error || 'Invalid credentials';
        }
      } catch (err) {
        console.error('Network error:', err);
        form.querySelector('.form-error').textContent = 'Network error, please try again';
      }
    });
  }
  

  // Modal wiring (login/register)
export function initAuthModals() {
  loginBtn?.addEventListener('click', () => openModal(loginModal));
  registerBtn?.addEventListener('click', () => openModal(registerModal));

  // Footer links
  footerLoginLink?.addEventListener('click', e => {
      e.preventDefault();
      openModal(loginModal);
  });
  footerRegisterLink?.addEventListener('click', e => {
      e.preventDefault();
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
          const modal = btn.closest('.modal-overlay');
          closeModal(modal);
      });
  });

  // Click outside content to close
  const isLoggedIn = document.body.dataset.showLogin !== "1";  
  // showLogin = 1 → NOT logged in
  
  [loginModal, registerModal].forEach(modal => {
      modal?.addEventListener('click', e => {
          if (!isLoggedIn) return; // disable backdrop close for anon users
          if (e.target === modal) closeModal(modal);
      });
  });

  if (document.body.dataset.showLogin === "1" && loginModal) {
    openModal(loginModal);
  }
  
  redirectIfError();
}