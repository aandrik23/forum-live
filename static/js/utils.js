import { registerModal } from "./auth.js";

// A static list of 20 seed strings you want to offer
export const AVATAR_SEEDS = [
    "demo","alice","bob","carol","dave",
    "eve","frank","grace","heidi","ivan",
    "judy","mallory","nia","oscar","peggy",
    "quincy","rick","sybil","trent","victor",
];

export function redirectIfError() {

    // clicking on profile as anonymous redirect to register
    const params = new URLSearchParams(window.location.search);
    const show = params.get('show');
    if (show === 'login') {
        openModal(loginModal);
    } else if (show === 'register') {
        openModal(registerModal);
    }
}

export function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function openModal(modalEl) {
    modalEl?.classList.add('open');
}

export function closeModal(modalEl) {
    modalEl?.classList.remove('open');
}

export function isAnonymous() {
    return document.body.dataset.showLogin === "1";
  }