import { initLikeButtons } from "./comments.js";
import { openModal, closeModal, getCookie, isAnonymous } from "./utils.js";

export function initDeletePostModal() {
    if (isAnonymous()) return;

    let currentDeleteForm = null;
    const deleteModal = document.getElementById('postDeleteModal');
    const cancelBtn = document.getElementById('cancelPostDelete');
    const confirmBtn = document.getElementById('confirmPostDelete');
    const csrfToken = getCookie('csrf_token'); // Make sure this function is defined

    if (!deleteModal || !cancelBtn || !confirmBtn) return;

    // Attach listener to all delete forms
    document.querySelectorAll('.delete-form').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
            currentDeleteForm = form;
            deleteModal.classList.remove('hidden');
        });
    });

    cancelBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        currentDeleteForm = null;
    });

    confirmBtn.addEventListener('click', () => {
        if (currentDeleteForm) {
            const csrfInput = currentDeleteForm.querySelector('input[name="csrf_token"]');
            if (csrfInput && csrfToken) {
                csrfInput.value = csrfToken;
            }
            currentDeleteForm.submit();
        }
    });

    // Optional: close modal when clicking outside modal content
    deleteModal.addEventListener('click', e => {
        if (e.target === deleteModal) {
            deleteModal.classList.add('hidden');
            currentDeleteForm = null;
        }
    });
}

export function initPostPreviewModal() {
  const modal = document.getElementById('postPreviewModal');
  if (!modal) return; // not on profile page / modal not rendered

  const titleEl      = document.getElementById('previewTitle');
  const contentEl    = document.getElementById('previewContent');
  const dateEl       = document.getElementById('previewDate');
  const likeBtn      = modal.querySelector('.like-btn');
  const dislikeBtn   = modal.querySelector('.dislike-btn');
  const commentBtn   = modal.querySelector('.comment-toggle-btn');
  const commentsSection = document.getElementById('previewCommentsSection');
  const commentsList    = document.getElementById('previewCommentsList');
  const commentForm     = document.getElementById('previewCommentForm');

  const links = document.querySelectorAll('.profile-post-title');

  // if any critical element is missing, just bail
  if (!titleEl || !contentEl || !dateEl || !likeBtn || !dislikeBtn || !commentBtn || !commentsSection || !commentsList || !commentForm || links.length === 0) {
    return;
  }

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();

      const postId   = link.dataset.id;
      const title    = link.dataset.title;
      const content  = link.dataset.content;
      const date     = link.dataset.date;
      const likes    = link.dataset.likes || 0;
      const dislikes = link.dataset.dislikes || 0;
      const comments = link.dataset.comments || 0;

      // Fill modal
      titleEl.textContent = title;
      dateEl.textContent = date;
      contentEl.textContent = content;
      document.getElementById('previewLikes').textContent = likes;
      document.getElementById('previewDislikes').textContent = dislikes;
      document.getElementById('previewComments').textContent = comments;

      // Button bindings
      likeBtn.dataset.postId = postId;
      likeBtn.dataset.targetType = 'post';
      dislikeBtn.dataset.postId = postId;
      dislikeBtn.dataset.targetType = 'post';
      commentBtn.dataset.postId = postId;

      likeBtn.setAttribute('data-clicked', 'false');
      dislikeBtn.setAttribute('data-clicked', 'false');

      // Reset section
      commentsList.innerHTML = '';
      commentForm.dataset.postId = postId;

      // Load comments dynamically
      fetch(`/posts/${postId}/comments`)
        .then(res => res.json())
        .then(comments => {
          comments.forEach(c => {
            const commentEl = document.createElement('div');
            commentEl.classList.add('comment');
            commentEl.innerHTML = `
              <p><strong>${c.author}</strong>: ${c.content}</p>
              <p class="meta">${c.created_at}</p>
              <div class="actions">
                <button data-post-id="${c.id}" data-target-type="comment" class="like-btn" data-clicked="false">
                    <span class="count">${c.likes}</span>
                </button>
                <button data-post-id="${c.id}" data-target-type="comment" class="dislike-btn" data-clicked="false">
                    <span class="count">${c.dislikes}</span>
                </button>
              </div>
            `;
            commentsList.appendChild(commentEl);
          });
          commentsSection.classList.remove('hidden');
          initLikeButtons(); // rebind likes for comments
        })
        .catch(err => {
          console.error('Error loading comments:', err);
        });

      openModal(modal);
      initLikeButtons(); // ensure new buttons work
    });
  });

  // Close modal on background click
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });

  // Close on × button
  modal.querySelector('.modal-close')?.addEventListener('click', () => {
    closeModal(modal);
  });
}

export function initProfilePostsButton() {
    const postsBtn = document.querySelector(".user-posts-link");
    if (postsBtn) {
      postsBtn.addEventListener("click", () => {
        window.location.href = "/?filter=created";
      });
    }
  }

