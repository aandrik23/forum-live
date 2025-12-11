import { openModal, closeModal, AVATAR_SEEDS, isAnonymous, getCookie } from "./utils.js";

// Profile modal
export function initProfileModal() {
  if (isAnonymous()) return;

  const editBtn           = document.querySelector('.profile-edit-btn');
  const editModal         = document.getElementById('editProfileModal');
  const avatarSelectModal = document.getElementById('avatarSelectModal');
  const avatarPreview     = document.querySelector('.avatar-preview');
  const avatarPreviewImg  = document.getElementById('avatarPreviewImg');
  const avatarSeedInput   = document.getElementById('edit-avatarSeed');

  // If we're not on the profile page, just bail out quietly
  if (!editBtn || !editModal || !avatarSelectModal || !avatarPreview || !avatarPreviewImg || !avatarSeedInput) {
    return;
  }

  const avatarGrid = avatarSelectModal.querySelector('.avatar-grid');
  if (!avatarGrid) return;

  let gridBuilt = false;

  // -------------------- OPEN EDIT PROFILE MODAL --------------------
  editBtn.addEventListener('click', () => {
    // pull from header
    const currentName = document.querySelector('.profile-username').textContent.trim();
    const currentBio  = document.querySelector('.profile-bio').textContent.trim();
    const avatarEl    = document.querySelector('.profile-avatar img');
    const avatarURL   = avatarEl.src;
    const seed        = new URL(avatarURL).searchParams.get('seed') || '';

    // set form fields
    document.getElementById('edit-username').value = currentName;
    document.getElementById('edit-bio').value      = currentBio;
    avatarSeedInput.value                          = seed;
    avatarPreviewImg.src                           = avatarURL;

    openModal(editModal);
  });

  // Close Edit Profile if you click the dark backdrop
  editModal.addEventListener('click', e => {
    if (e.target === editModal) {
      closeModal(editModal);
    }
  });

  // Allow any [data-modal-close] inside the edit modal to close it
  editModal.querySelectorAll('.modal-close')
    .forEach(btn => btn.addEventListener('click', () => closeModal(editModal)));

  // -------------------- BUILD AVATAR GRID ONCE --------------------
  function buildAvatarGrid() {
    avatarGrid.innerHTML = '';
    AVATAR_SEEDS.forEach(seed => {
      const img = document.createElement('img');
      img.src          = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
      img.dataset.seed = seed;
      img.className    = 'avatar-thumb';
      if (seed === avatarSeedInput.value) img.classList.add('selected');
      avatarGrid.appendChild(img);
    });
    gridBuilt = true;
  }

  // Clicking preview → open picker
  avatarPreview.addEventListener('click', () => {
    if (!gridBuilt) buildAvatarGrid();
    openModal(avatarSelectModal);
  });

  // Pick an avatar
  avatarGrid.addEventListener('click', e => {
    const thumb = e.target.closest('.avatar-thumb');
    if (!thumb) return;

    // update hidden input + preview
    avatarSeedInput.value = thumb.dataset.seed;
    avatarPreviewImg.src  = thumb.src;

    // persist selection in localStorage
    localStorage.setItem('avatarSeed', thumb.dataset.seed);

    avatarGrid.querySelectorAll('.avatar-thumb.selected')
      .forEach(el => el.classList.remove('selected'));
    thumb.classList.add('selected');

    closeModal(avatarSelectModal);
  });

  // Close picker if clicking backdrop or close-btn
  avatarSelectModal.addEventListener('click', e => {
    if (e.target === avatarSelectModal) closeModal(avatarSelectModal);
  });
  avatarSelectModal.querySelectorAll('.modal-close')
    .forEach(btn => btn.addEventListener('click', () => closeModal(avatarSelectModal)));

  // -------------------- SAVE CHANGES (SPA-style) --------------------
  document.getElementById('editProfileForm').addEventListener('submit', async e => {
    e.preventDefault();
    console.log("Submitting profile form...");

    const name       = document.getElementById('edit-username').value.trim();
    const bio        = document.getElementById('edit-bio').value.trim();
    const avatarSeed = document.getElementById('edit-avatarSeed').value.trim();

    try {
      const csrfToken = getCookie('csrf_token');
      const res = await fetch('/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ username: name, bio, avatarSeed })
      });

      if (!res.ok) {
        console.error("Update failed:", await res.text());
        return;
      }

      //  No full reload: update the page DOM directly
      const usernameEl = document.querySelector('.profile-username');
      const bioEl      = document.querySelector('.profile-bio');
      const avatarEl   = document.querySelector('.profile-avatar img');

      if (usernameEl) usernameEl.textContent = ` ${name}`; // keep spacing as in template
      if (bioEl)      bioEl.textContent      = bio || '';
      if (avatarEl) {
        avatarEl.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed || 'default')}`;
      }

      closeModal(editModal);

    } catch (err) {
      console.error("Network error:", err);
    }
  });
}
