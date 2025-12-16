export function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

export  function formatGoDate(dateValue) {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "";
  
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

export function renderNavbarCategories(categories) {
    const list = document.getElementById("categoriesList");
    if (!list) return;
  
    const cats = Array.isArray(categories) ? categories : [];
    list.innerHTML = cats.map(c => `
      <li>
        <a href="/home?category=${encodeURIComponent(c.ID)}">${escapeHtml(c.Name)}</a>
      </li>
    `).join("");
  }
  
export function renderHomeFromJSON(data) {
    const isUser = !!data.user;
    const username = data.username || "";
    const posts = Array.isArray(data.posts) ? data.posts : [];
    const cats = Array.isArray(data.categories) ? data.categories : [];

  
    const welcome = isUser
      ? `<p class="welcome-msg">Welcome, ${escapeHtml(username)}!</p>`
      : `<p class="welcome-msg">Welcome!</p>`;
  
    const myButtons = isUser
      ? `
        <a class="btn" href="/home?filter=created">My Posts</a>
        <a class="btn" href="/home?filter=liked">Liked Posts</a>
      `
      : "";
    
    const newPostBtn = isUser
      ? `<a class="btn new-post" href="/posts/new">+ New Post</a>`
      : "";

      const categoryOptions = `
        <option value="">All Categories</option>
        ${cats.map(c => `<option value="${c.ID}">${escapeHtml(c.Name)}</option>`).join("")}
      `;
    const filterBar = `
      <section class="filter-bar">
        <a class="btn" href="/home">All Posts</a>
        ${myButtons}
        <select id="categorySelect">
          ${categoryOptions}
        </select>
        ${newPostBtn}
      </section>
    `;
  
    const postsHtml = posts.length
      ? posts.map(p => {
          const canDelete = isUser && p.Author === username;
  
          const comments = Array.isArray(p.Comments) ? p.Comments : [];
  
          const commentsHtml = comments.length
            ? comments.map(c => `
                <div class="comment">
                  <p><strong>${escapeHtml(c.Author)}</strong>: ${escapeHtml(c.Content)}</p>
                  <p class="meta">${escapeHtml(formatGoDate(c.CreatedAt))}</p>
                  <div class="actions">
                    <button data-post-id="${c.ID}" data-target-type="comment" class="like-btn" data-clicked="false">
                      <span class="count">${c.Likes ?? 0}</span>
                    </button>
                    <button data-post-id="${c.ID}" data-target-type="comment" class="dislike-btn" data-clicked="false">
                      <span class="count">${c.Dislikes ?? 0}</span>
                    </button>
                  </div>
                </div>
              `).join("")
            : `<p>No comments yet. Be the first to comment!</p>`;
  
          return `
          <article class="post-card" data-post-id="${p.ID}">
              <div class="post-header">
                <h2>${escapeHtml(p.Title)}</h2>
  
                ${canDelete ? `
                  <button
                    type="button"
                    class="delete-btn"
                    data-delete-post-id="${p.ID}"
                    title="Delete Post"
                  >
                    <img src="/static/img/delete.png" alt="Delete" class="delete-icon">
                  </button>
                ` : ""}
              </div>
  
              <p class="meta">by ${escapeHtml(p.Author)} on ${escapeHtml(formatGoDate(p.CreatedAt))}</p>
  
              <div class="badges">
                ${(p.Categories || []).map(cat => `<span class="badge">${escapeHtml(cat.Name)}</span>`).join("")}
              </div>
  
              <p class="snippet">${escapeHtml(p.Snippet || "")}</p>
  
              <div class="actions">
                <div class="reaction-group">
                  <button data-post-id="${p.ID}" data-target-type="post" class="like-btn" data-clicked="false">
                    <span class="count">${p.Likes ?? 0}</span>
                  </button>
                </div>
                <div class="reaction-group">
                  <button data-post-id="${p.ID}" data-target-type="post" class="dislike-btn" data-clicked="false">
                    <span class="count">${p.Dislikes ?? 0}</span>
                  </button>
                </div>
                <div class="reaction-group">
                  <button data-post-id="${p.ID}" class="comment-toggle-btn">
                    <span class="count">${p.NumComments ?? 0}</span>
                  </button>
                </div>
              </div>
  
              <div class="comments-section hidden" id="comments-${p.ID}">
                <div class="comments-list" id="comments-list-${p.ID}">
                  ${commentsHtml}
                </div>
                <form class="comment-form" data-post-id="${p.ID}">
                  <textarea placeholder="Write a comment." required></textarea>
                  <button type="submit">Post</button>
                </form>
              </div>
            </article>
          `;
        }).join("")
      : `
        <p class="no-posts-msg">
          No posts yet. ${isUser ? `Why not <a href="/posts/new">create one</a>?` : ``}
        </p>
      `;
  
    const deleteModal = `
      <div id="postDeleteModal" class="post-delete-overlay hidden">
        <div class="post-delete-modal">
          <p>Are you sure you want to delete this post?</p>
          <div class="post-delete-buttons">
            <button id="cancelPostDelete" class="btn cancel">Cancel</button>
            <button id="confirmPostDelete" class="btn delete">Yes, delete</button>
          </div>
        </div>
      </div>
    `;
  
    return `
      ${welcome}
      ${filterBar}
      <section class="posts-list">
        ${postsHtml}
      </section>
      ${deleteModal}
    `;
  }
  
  export function renderCreatePostFromJSON(data) {
    const cats = Array.isArray(data.categories) ? data.categories : [];
  
    const categoryChips = cats.map(c => `
      <label class="category-chip">
        <input type="checkbox" name="categories" value="${c.ID}">
        <span>${escapeHtml(c.Name)}</span>
      </label>
    `).join("");
  
    return `
      <section class="post-form-section container">
        <h1>Create New Post</h1>
  
        <form id="createPostForm" class="post-form">
          <label for="title">Title</label>
          <input type="text" id="title" name="title" required maxlength="100" placeholder="Enter post title">
  
          <label>Categories</label>
          <div class="category-chip-group">
            ${categoryChips}
          </div>
  
          <label for="content">Content</label>
          <textarea id="content" name="content" rows="8" placeholder="Write your post here..." required></textarea>
  
          <div class="form-buttons">
            <button type="button" class="btn cancel-btn" id="cancelCreatePostBtn">Cancel</button>
            <button type="submit" class="btn primary-btn">Submit</button>
          </div>
        </form>
      </section>
    `;
  }
   
  export function renderPostFromJSON(data) {
    const p = data.post;
    if (!p) return `<p>Post not found.</p>`;
  
    const comments = Array.isArray(p.Comments) ? p.Comments : [];
    const commentsHtml = comments.length
      ? comments.map(c => `
        <div class="comment">
          <p><strong>${escapeHtml(c.Author)}</strong>: ${escapeHtml(c.Content)}</p>
          <p class="meta">${escapeHtml(formatGoDate(c.CreatedAt))}</p>
          <div class="actions">
            <button data-post-id="${c.ID}" data-target-type="comment" class="like-btn" data-clicked="false">
              <span class="count">${c.Likes ?? 0}</span>
            </button>
            <button data-post-id="${c.ID}" data-target-type="comment" class="dislike-btn" data-clicked="false">
              <span class="count">${c.Dislikes ?? 0}</span>
            </button>
          </div>
        </div>
      `).join("")
      : `<p>No comments yet.</p>`;
  
    return `
      <article class="post-card" data-post-id="${p.ID}">
        <div class="post-header">
          <h2>${escapeHtml(p.Title || "")}</h2>
        </div>
  
        <p class="meta">by ${escapeHtml(p.Author || "")} on ${escapeHtml(formatGoDate(p.CreatedAt))}</p>
  
        <div class="badges">
          ${(p.Categories || []).map(cat => `<span class="badge">${escapeHtml(cat.Name)}</span>`).join("")}
        </div>
  
        <div class="snippet" style="white-space:pre-wrap;">
          ${escapeHtml(p.Content || "")}
        </div>
  
        <div class="actions">
          <div class="reaction-group">
            <button data-post-id="${p.ID}" data-target-type="post" class="like-btn" data-clicked="false">
              <span class="count">${p.Likes ?? 0}</span>
            </button>
          </div>
          <div class="reaction-group">
            <button data-post-id="${p.ID}" data-target-type="post" class="dislike-btn" data-clicked="false">
              <span class="count">${p.Dislikes ?? 0}</span>
            </button>
          </div>
          <div class="reaction-group">
            <button data-post-id="${p.ID}" class="comment-toggle-btn">
              <span class="count">${p.NumComments ?? 0}</span>
            </button>
          </div>
        </div>
  
        <div class="comments-section show" id="comments-${p.ID}">
          <div class="comments-list" id="comments-list-${p.ID}">
            ${commentsHtml}
          </div>
          <form class="comment-form" data-post-id="${p.ID}">
            <textarea placeholder="Write a comment." required></textarea>
            <button type="submit">Post</button>
          </form>
        </div>
      </article>
    `;
  }
  