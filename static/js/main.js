import {initLoginForm, initRegisterForm, initAuthModals} from "./auth.js";
import {initDeletePostModal, initPostPreviewModal} from "./posts.js";
import {initCommentForm, initLikeButtons} from "./comments.js";
import {initProfileModal} from "./profile.js";
import {openModal, closeModal, getCookie} from "./utils.js"
// DOM Elements
const sidebar = document.querySelector(".sidebar");
const toggleBtn = document.getElementById("sidebar-toggle");
const contentWrapper = document.querySelector(".container.content");
const navHomeBtn = document.querySelector(".navbar .home-btn");
const sidebarHomeBtns = document.querySelectorAll(".sidebar-btn.home-btn");
const profileBtn = document.querySelector(".sidebar-btn.profile-btn");


function initFilterModal() {
    const filterModal = document.getElementById('filterModal');
    const filterBtn = document.querySelector('.filter-btn');
    const filterForm = document.getElementById('filterForm');

    if (!filterBtn || !filterModal || !filterForm) return;

    filterBtn.addEventListener('click', () => {
        console.log("Filter button clicked!");
        openModal(filterModal)
    });

    filterModal.addEventListener('click', e => {
      if (e.target === filterModal) closeModal(filterModal);
    });

    filterModal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => closeModal(filterModal));
    });

    filterForm.addEventListener('submit', e => {
      e.preventDefault();
      const sortValue = filterForm.sort.value;
      const selectedCategories = [...filterForm.querySelectorAll('input[name="category"]:checked')]
        .map(cb => cb.value);

      const url = new URL(window.location.href);
      url.searchParams.set('sort', sortValue);
      url.searchParams.set('categories', selectedCategories.join(','));

      window.location.href = url.toString();
    });
  }



// Theme toggle (light/dark)
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

// Sidebar collapse/expand
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

// Navigation links
function initNavLinks() {
    navHomeBtn?.addEventListener('click', () => location.href = '/');
    sidebarHomeBtns.forEach(btn => btn.addEventListener('click', () => location.href = '/'));
    profileBtn?.addEventListener('click', () => location.href = '/profile');
}


// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // on page load, restore saved avatar
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
        if (csrfToken) {
            csrfTokenInput.value = csrfToken;
        } else {
            console.warn("CSRF token missing in cookies.");
        }
    }

    function initProfilePostsRedirect() {
        const postStat = document.querySelector('.user-posts-link');
        if (postStat) {
          postStat.addEventListener('click', () => {
            window.location.href = '/?filter=created';
          });
        }
      }

      function initProfileLikesRedirect() {
        const likesStat = document.querySelector('.user-likes-link');
        if (likesStat) {
          likesStat.addEventListener('click', () => {
            window.location.href = '/?filter=liked';
          });
        }
      }
      function initProfileDislikesRedirect() {
        const dislikesStat = document.querySelector('.user-dislikes-link');
        if (dislikesStat) {
          dislikesStat.addEventListener('click', () => {
            window.location.href = '/?filter=disliked';
          });
        }
      }
      

    initLikeButtons();
    initCommentForm();
    initThemeToggle();
    initSidebarToggle();
    initAuthModals();
    initLoginForm();
    initRegisterForm(); // NEW
    initFilterModal(); // ?????????
    initProfileModal();
    initPostPreviewModal();
    initProfilePostsRedirect();
    initProfileLikesRedirect();
    initProfileDislikesRedirect();
    initNavLinks();
    initDeletePostModal();
});


    // Show/Hide Comments
document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const postId = btn.dataset.postId;
        const section = document.getElementById(`comments-${postId}`);

        // Toggle both visibility and CSS classes
        if (section.classList.contains('show')) {
            section.classList.remove('show');
            section.classList.add('hidden');
        } else {
            section.classList.remove('hidden');
            section.classList.add('show');
        }
    });
});


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
