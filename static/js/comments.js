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
  
        const targetId = button.dataset.postId;
        const targetType = button.dataset.targetType; // <-- new
        const action = button.classList.contains('like-btn') ? 'like' : 'dislike';
        const csrfToken = getCookie('csrf_token');
  
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
           const data = await res.json(); // expect JSON with updated counts and user reaction
  
          // Find buttons by postId and targetType
          const likeBtn = document.querySelector(`button.like-btn[data-post-id="${targetId}"][data-target-type="${targetType}"]`);
          const dislikeBtn = document.querySelector(`button.dislike-btn[data-post-id="${targetId}"][data-target-type="${targetType}"]`);
          const commentBtn = document.querySelector(`button.comment-toggle-btn[data-post-id="${targetId}"]`);
  
          // Update counts
          likeBtn.querySelector('.count').textContent = data.likes;
          dislikeBtn.querySelector('.count').textContent = data.dislikes;
          commentBtn.querySelector('.count').textContent = data.numcomments;
  
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
  