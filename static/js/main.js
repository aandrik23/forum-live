import {initLoginForm, initRegisterForm, initAuthModals} from "./auth.js";
import {initDeletePostModal, initPostPreviewModal} from "./posts.js";
import {initCommentForm, initLikeButtons} from "./comments.js";
import {initProfileModal} from "./profile.js";
import {openModal, closeModal, getCookie} from "./utils.js";

// DOM Elements
const sidebar = document.querySelector(".sidebar");
const toggleBtn = document.getElementById("sidebar-toggle");
const contentWrapper = document.querySelector(".container.content");
const navHomeBtn = document.querySelector(".navbar .home-btn");
const sidebarHomeBtns = document.querySelectorAll(".sidebar-btn.home-btn");
const profileBtn = document.querySelector(".sidebar-btn.profile-btn");

// ------------------ FILTER MODAL (updated for SPA) ------------------
function initFilterModal() {
  const filterModal = document.getElementById('filterModal');
  const filterBtn = document.querySelector('.filter-btn');
  const filterForm = document.getElementById('filterForm');

  if (!filterBtn || !filterModal || !filterForm) return;

  filterBtn.addEventListener('click', () => {
    console.log("Filter button clicked!");
    openModal(filterModal);
  });

  filterModal.addEventListener('click', e => {
    if (e.target === filterModal) closeModal(filterModal);
  });

  filterModal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(filterModal));
  });

  filterForm.addEventListener('submit', e => {
    e.preventDefault();

    const isAnon = document.body.dataset.showLogin === "1";

    const sortValue = filterForm.sort ? filterForm.sort.value : "";
    const selectedCategories = [...filterForm.querySelectorAll('input[name="category"]:checked')]
      .map(cb => cb.value);

    const url = new URL(window.location.href);

    // Keep your existing names
    url.searchParams.set('sort', sortValue);
    url.searchParams.set('categories', selectedCategories.join(','));

    // Also set backend-compatible params used in HomeHandler:
    if (sortValue) {
      url.searchParams.set('filter', sortValue); // HomeHandler expects "filter"
    }
    if (selectedCategories.length === 1) {
      url.searchParams.set('category', selectedCategories[0]); // HomeHandler expects single "category"
    } else {
      url.searchParams.delete('category');
    }

    const path = url.pathname + url.search;

    closeModal(filterModal);

    if (isAnon) {
      // anonymous: full reload
      window.location.href = path;
    } else {
      // logged-in: SPA navigation
      loadPage(path);
      history.pushState({ path }, '', path);
    }
  });
}

// ------------------ THEME TOGGLE ------------------
function initThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark-mode');
    themeToggle.checked = true;
  }

  themeToggle.addEventListener('change', () => {
    const isDark = themeToggle.checked;
    document.documentElement.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

// ------------------ SIDEBAR TOGGLE ------------------
function initSidebarToggle() {
  const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  sidebar?.classList.toggle('collapsed', collapsed);
  contentWrapper?.classList.toggle('collapsed', collapsed);

  toggleBtn?.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    contentWrapper.classList.toggle('collapsed', isCollapsed);
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  });
}

// ------------------ NAVIGATION (updated for SPA) ------------------
function initNavLinks() {
  const isAnon = document.body.dataset.showLogin === "1";

  const logoLink = document.querySelector(".navbar .logo");
  if (logoLink) {
    logoLink.addEventListener("click", (e) => {
      e.preventDefault();
      const path = "/";
      loadPage(path);
      if (!isAnon) history.pushState({ path }, "", path);
    });
  }

  navHomeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const path = '/';
    loadPage(path);
    if (!isAnon) history.pushState({ path }, '', path);
  });

  sidebarHomeBtns.forEach(btn =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const path = '/';
      loadPage(path);
      if (!isAnon) history.pushState({ path }, '', path);
    })
  );

  // profile button already uses SPA
  profileBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const path = '/profile';
    loadPage(path);
    if (!isAnon) history.pushState({ path }, '', path);
  });

  // Categories dropdown links -> SPA
  const categoryLinks = document.querySelectorAll('.nav-categories a[href^="/?category="]');
  categoryLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href'); // e.g. "/?category=1"
      const path = href;
      loadPage(path);
      if (!isAnon) history.pushState({ path }, '', path);
    });
  });

  // (Optional) footer "Home" link SPA-ified for logged-in users
  const footerHome = document.querySelector('.footer a[href="/"]');
  if (footerHome) {
    footerHome.addEventListener('click', (e) => {
      e.preventDefault();
      const path = '/';
      loadPage(path);
      if (!isAnon) history.pushState({ path }, '', path);
    });
  }
}

// ------------------ CORE SPA LOADER ------------------
async function loadPage(path) {
  const isAnon = document.body.dataset.showLogin === "1";
  if (isAnon) {
    // anonymous: we keep full reload behaviour
    location.href = path;
    return;
  }

  try {
    const url = path.includes('?')
      ? `${path}&partial=1`
      : `${path}?partial=1`;

    const res = await fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (!res.ok) {
      // fallback – maybe 403 or whatever
      location.href = path;
      return;
    }

    const html = await res.text();
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
      location.href = path;
      return;
    }

    appRoot.innerHTML = html;

    // re-init all post/comment-related JS
    initPageContent();

  } catch (err) {
    console.error('SPA navigation failed:', err);
    location.href = path; // fallback
  }
}

// ------------------ POPSTATE (Back/Forward) ------------------
window.addEventListener('popstate', () => {
  const path = window.location.pathname + window.location.search;
  loadPage(path);
});

function initProfilePostsRedirect() {
  const btn = document.querySelector('.user-posts-link');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isAnon = document.body.dataset.showLogin === "1";
    const path = '/?filter=created';

    if (isAnon) {
      window.location.href = path;
    } else {
      loadPage(path);
      history.pushState({ path }, '', path);
    }
  });
}

function initProfileLikesRedirect() {
  const btn = document.querySelector('.user-likes-link');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isAnon = document.body.dataset.showLogin === "1";
    const path = '/?filter=liked';

    if (isAnon) {
      window.location.href = path;
    } else {
      loadPage(path);
      history.pushState({ path }, '', path);
    }
  });
}

function initProfileDislikesRedirect() {
  const btn = document.querySelector('.user-dislikes-link');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isAnon = document.body.dataset.showLogin === "1";
    const path = '/?filter=disliked';

    if (isAnon) {
      window.location.href = path;
    } else {
      loadPage(path);
      history.pushState({ path }, '', path);
    }
  });
}

// ------------------ INITIALIZATION ------------------
document.addEventListener('DOMContentLoaded', () => {
  const savedSeed = localStorage.getItem('avatarSeed');
  if (savedSeed) {
    const img = document.querySelector('.profile-avatar img');
    if (img) {
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(savedSeed)}`;
    }
  }

  const csrfTokenInput = document.getElementById('csrf_token_input');
  if (csrfTokenInput) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) csrfTokenInput.value = csrfToken;
  }

  initThemeToggle();
  initSidebarToggle();
  initAuthModals();
  initLoginForm();
  initRegisterForm();
  initNavLinks();
  initProfilePostsRedirect();
  initProfileLikesRedirect();
  initProfileDislikesRedirect();

  initPageContent(); // run once for initial content
});

// ------------------ PER-PAGE CONTENT INIT ------------------
function initPageContent() {
  initLikeButtons();
  initCommentForm();
  initFilterModal();
  initProfileModal();
  initPostPreviewModal();
  initDeletePostModal();

  // comment toggle buttons 
  document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.postId;
      const section = document.getElementById(`comments-${postId}`);

      if (!section) return;

      if (section.classList.contains('show')) {
        section.classList.remove('show');
        section.classList.add('hidden');
      } else {
        section.classList.remove('hidden');
        section.classList.add('show');
      }
    });
  });
}


//     // ——— new category–injection code ———
//     const rawCats = link.dataset.categories || '';
//     const cats    = rawCats ? rawCats.split(',') : [];
//     const catContainer = modal.querySelector('.modal-categories');

// // clear old ones
//     catContainer.innerHTML = '';

// // append only this post’s badges
//     cats.forEach(name => {
//         const span = document.createElement('span');
//         span.className   = 'badge';
//         span.textContent = name;
//         catContainer.appendChild(span);
//     });
// // ————————————————————————————————
