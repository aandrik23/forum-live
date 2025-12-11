import {redirectIfError, getCookie, openModal, isAnonymous} from "./utils.js";
import { registerModal } from "./auth.js";

//NEW COMMENT
export function initCommentForm() {
    if (isAnonymous()) return;
    document.querySelectorAll('.comment-form').forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();

            const postId = form.getAttribute('data-post-id');

            const textarea = form.querySelector('textarea');
            const content = textarea.value.trim();
            const csrfToken = getCookie('csrf_token');

            if (!content) return;

            console.log('Sending comment:', { post_id: parseInt(postId), content });


            try {
                const response = await fetch('/posts/comments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ post_id: parseInt(postId), content })
                });

                redirectIfError();
                if (response.status == 403) {
                    openModal(registerModal);
                }
                if (response.ok) {
                    //  Add comment
                    const newComment = document.createElement('div');
                    newComment.classList.add('comment');
                    newComment.innerHTML = `
                        <p><strong>You</strong>: ${content}</p>
                        <p class="meta">just now</p>
                        <div class="actions">
                            <button data-post-id="new" data-target-type="comment" class="like-btn" data-clicked="false">
                                <span class="count">0</span>
                            </button>
                            <button data-post-id="new" data-target-type="comment" class="dislike-btn" data-clicked="false">
                                <span class="count">0</span>
                            </button>
                        </div>
                    `;
                    form.previousElementSibling.appendChild(newComment);
                    initLikeButtons();


                    // 2. Clear textarea
                    textarea.value = '';

                    // 3. Increment comment count in the toggle button
                    const commentBtn = document.querySelector(`.comment-toggle-btn[data-post-id="${postId}"] .count`);
                    if (commentBtn) {
                        const currentCount = parseInt(commentBtn.textContent, 10) || 0;
                        commentBtn.textContent = currentCount + 1;
                    }
                } else {
                    const err = await response.text();
                    console.error('Failed to post comment:', err);
                }
            } catch (err) {
                console.error('Network error:', err);
            }

            const previewForm = document.getElementById('previewCommentForm');
            if (previewForm) {
              previewForm.addEventListener('submit', async e => {
                e.preventDefault();

                const postId = previewForm.dataset.postId;
                const textarea = previewForm.querySelector('textarea');
                const content = textarea.value.trim();
                const csrfToken = getCookie('csrf_token');

                if (!content) return;

                try {
                  const response = await fetch('/posts/comments', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ post_id: parseInt(postId), content })
                  });

                  if (response.status === 403) {
                    openModal(registerModal);
                    return;
                  }

                  if (response.ok) {
                    const newComment = document.createElement('div');
                    newComment.classList.add('comment');
                    newComment.innerHTML = `
                      <p><strong>You</strong>: ${content}</p>
                      <p class="meta">just now</p>
                      <div class="actions">
                        <button data-post-id="new" data-target-type="comment" class="like-btn" data-clicked="false">
                          <span class="count">0</span>
                        </button>
                        <button data-post-id="new" data-target-type="comment" class="dislike-btn" data-clicked="false">
                          <span class="count">0</span>
                        </button>
                      </div>
                    `;
                    document.getElementById('previewCommentsList').appendChild(newComment);
                    textarea.value = '';
                    initLikeButtons();
                  } else {
                    console.error('Error saving comment:', await response.text());
                  }
                } catch (err) {
                  console.error('Network error:', err);
                }
              });
            }



        });
    });
}


export function initLikeButtons() {
  if (isAnonymous()) return;

  document.querySelectorAll('.like-btn, .dislike-btn').forEach(button => {
    button.addEventListener('click', async () => {

      const targetId   = button.dataset.postId;
      const targetType = button.dataset.targetType; // "post" or "comment"
      const action     = button.classList.contains('like-btn') ? 'like' : 'dislike';
      const csrfToken  = getCookie('csrf_token');

      try {
        const res = await fetch('/posts/react', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            target_type: targetType,
            target_id: parseInt(targetId),
            action
          })
        });

        redirectIfError();
        if (res.status == 403) {
          openModal(registerModal);
        }

        if (res.ok) {
          const data = await res.json(); // { likes, dislikes, numcomments, user_reaction }

          // Find buttons by postId and targetType
          const likeBtn = document.querySelector(
            `button.like-btn[data-post-id="${targetId}"][data-target-type="${targetType}"]`
          );
          const dislikeBtn = document.querySelector(
            `button.dislike-btn[data-post-id="${targetId}"][data-target-type="${targetType}"]`
          );
          const commentBtn = document.querySelector(
            `button.comment-toggle-btn[data-post-id="${targetId}"]`
          );

          // If we can't find the main buttons, just bail safely
          if (!likeBtn || !dislikeBtn) {
            console.warn('Reaction buttons not found for', { targetId, targetType });
            return;
          }

          // Update like/dislike counts
          const likeCountSpan = likeBtn.querySelector('.count');
          const dislikeCountSpan = dislikeBtn.querySelector('.count');

          if (likeCountSpan) likeCountSpan.textContent = data.likes;
          if (dislikeCountSpan) dislikeCountSpan.textContent = data.dislikes;

          // Only update comment count if a toggle exists (for posts, not comments)
          if (commentBtn) {
            const commentCountSpan = commentBtn.querySelector('.count');
            if (commentCountSpan) {
              commentCountSpan.textContent = data.numcomments;
            }
          }

          // Update clicked state
          if (data.user_reaction === 'like') {
            likeBtn.setAttribute('data-clicked', 'true');
            dislikeBtn.setAttribute('data-clicked', 'false');
          } else if (data.user_reaction === 'dislike') {
            likeBtn.setAttribute('data-clicked', 'false');
            dislikeBtn.setAttribute('data-clicked', 'true');
          } else {
            likeBtn.setAttribute('data-clicked', 'false');
            dislikeBtn.setAttribute('data-clicked', 'false');
          }
        } else {
          console.error("Reaction failed:", await res.text());
        }
      } catch (err) {
        console.error("Network error:", err);
      }
    });
  });
}
