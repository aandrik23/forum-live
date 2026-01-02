// -----------------------------
// DM state
// -----------------------------
let ws = null;

let threads = [];              // left list: [{other_user_id, other_username, online, last_message_at, ...}]
let suggestedUsers = [];       // only when threads empty: [{user_id, username, online, ...}]
let activeChatUser = null;     // { id, username }
let activeMessages = [];       // current chat messages (oldest -> newest)

let paging = {
  oldestId: null,
  loading: false,
  exhausted: false
};

const CURRENT_USER_ID = Number(document.body.dataset.userId);

// -----------------------------
// Helpers
// -----------------------------
function wsURL(path) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}

function toThreadUserListItems() {
  // If threads exist, they are the list. If none, use suggested users list.
  if (threads.length > 0) {
    return threads.map(t => ({
      id: t.other_user_id,
      username: t.other_username,
      online: !!t.online,
      lastMessageAt: t.last_message_at || 0,
      lastMessageBody: t.last_message_body || ""
    }));
  }

  return suggestedUsers.map(u => ({
    id: u.user_id,
    username: u.username,
    online: !!u.online,
    lastMessageAt: 0,
    lastMessageBody: ""
  }));
}

function sortUsers(users) {
  return users.sort((a, b) => {
    // Online users first
    if (a.online !== b.online) return a.online ? -1 : 1;

    // Then by last message time (desc)
    if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt - a.lastMessageAt;

    // Users with messages before those without
    if (a.lastMessageAt && !b.lastMessageAt) return -1;
    if (!a.lastMessageAt && b.lastMessageAt) return 1;

    // Finally by username
    return a.username.localeCompare(b.username);
  });
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtTime(unixSec) {
  const d = new Date(unixSec * 1000);
  // Keep it simple; you can style later
  return d.toLocaleString();
}

// basic throttle (no spam)
function throttle(fn, waitMs) {
  let last = 0;
  let timer = null;

  return (...args) => {
    const now = Date.now();
    const remaining = waitMs - (now - last);

    if (remaining <= 0) {
      last = now;
      fn(...args);
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

// -----------------------------
// DOM creation
// -----------------------------
function createChatSidebar() {
    const root = document.getElementById("chat-root");
    root.innerHTML = `
      <div id="chat-sidebar">
        <div id="chat-header">
          <span>Messages</span>
          <button id="chat-sidebar-toggle" aria-label="Minimize chat sidebar">—</button>
        </div>
        <div id="chat-user-list"></div>
      </div>
    `;
  
    document.getElementById("chat-sidebar-toggle").addEventListener("click", () => {
      document.getElementById("chat-sidebar").classList.toggle("collapsed");
  
      // if sidebar collapses, also move panel flush right
      const panel = document.getElementById("chat-panel");
      if (panel) panel.classList.toggle("sidebar-collapsed");
    });
  }
  

function renderUsers(users) {
  const list = document.getElementById("chat-user-list");
  list.innerHTML = "";

  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "chat-user";
    div.dataset.userId = String(user.id);
    div.innerHTML = `
      <span class="chat-username">${escapeHTML(user.username)}</span>
      <span class="chat-status ${user.online ? "chat-online" : "chat-offline"}"></span>
    `;
    div.addEventListener("click", () => {
        document.querySelectorAll(".chat-user.active")
          .forEach(el => el.classList.remove("active"));
      
        div.classList.add("active");
        openChat(user);
      });
          list.appendChild(div);
  });
}

function openChat(user) {
  activeChatUser = { id: user.id, username: user.username };
  activeMessages = [];
  paging = { oldestId: null, loading: false, exhausted: false };

  let panel = document.getElementById("chat-panel");
  if (panel) panel.remove();

  panel = document.createElement("div");
  panel.id = "chat-panel";
  panel.innerHTML = `
      <div id="chat-panel-header">
        <span>Chat with ${escapeHTML(user.username)}</span>
        <div class="chat-panel-actions">
          <button id="chat-minimize" aria-label="Minimize chat">—</button>
          <button id="chat-close" aria-label="Close chat">×</button>
        </div>
      </div>
      <div id="chat-messages"></div>
      <div id="chat-input-area">
        <input id="chat-input" type="text" placeholder="Type a message..." />
        <button id="chat-send">Send</button>
      </div>
    `;

  document.body.appendChild(panel);
    // minimize chat
    document.getElementById("chat-minimize").addEventListener("click", () => {
        panel.classList.toggle("minimized");
      });
  
  // close chat
  document.getElementById("chat-close").addEventListener("click", () => {
    panel.remove();
    activeChatUser = null;
    activeMessages = [];
    paging = { oldestId: null, loading: false, exhausted: false };
  
    // clear selected highlight
    document.querySelectorAll(".chat-user.active")
      .forEach(el => el.classList.remove("active"));
  });
  
  const messagesEl = document.getElementById("chat-messages");
  messagesEl.innerHTML = `<p style="opacity:.6">Loading...</p>`;

  // Scroll handler (throttled)
  messagesEl.addEventListener(
    "scroll",
    throttle(() => {
      if (!activeChatUser) return;
      if (paging.loading || paging.exhausted) return;

      // When near top, load more
      if (messagesEl.scrollTop <= 20) {
        loadMoreMessages();
      }
    }, 250)
  );

  // Send handlers
  document.getElementById("chat-send").addEventListener("click", sendActiveMessage);
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendActiveMessage();
  });

  // Load initial 10
  loadInitialMessages();
}

function renderMessages() {
  const el = document.getElementById("chat-messages");
  if (!el) return;

  if (activeMessages.length === 0) {
    el.innerHTML = `<p style="opacity:.6">No messages yet</p>`;
    return;
  }

  el.innerHTML = activeMessages
    .map(m => {
      const who = escapeHTML(m.sender_username || String(m.sender_id));
      const when = fmtTime(m.created_at);
      const body = escapeHTML(m.body);

      const isMine = m.sender_id === CURRENT_USER_ID;

        return `
          <div class="chat-msg ${isMine ? "mine" : "theirs"}">
            <div class="chat-msg-bubble">
              <div class="chat-msg-body">${body}</div>
              <div class="chat-msg-time">${when}</div>
            </div>
          </div>
        `;
    })
    .join("");
}

function appendMessage(msgObj) {
  // msgObj: {id, sender_id, sender_username, body, created_at}
  activeMessages.push(msgObj);
  renderMessages();

  // Scroll to bottom on new message (only if this chat is active)
  const el = document.getElementById("chat-messages");
  if (el) el.scrollTop = el.scrollHeight;
}

function prependMessages(msgs) {
  // msgs are oldest->newest (your backend step 10)
  const el = document.getElementById("chat-messages");
  const prevHeight = el ? el.scrollHeight : 0;

  activeMessages = msgs.concat(activeMessages);
  renderMessages();

  // Keep scroll position stable after prepending
  if (el) {
    const newHeight = el.scrollHeight;
    el.scrollTop = newHeight - prevHeight;
  }
}

// -----------------------------
// HTTP API
// -----------------------------
async function loadThreads() {
  const res = await fetch("/api/dm/threads", { method: "GET" });
  if (!res.ok) return;

  const data = await res.json();

  threads = Array.isArray(data.threads) ? data.threads : [];
  suggestedUsers = Array.isArray(data.suggested_users) ? data.suggested_users : [];

  const listItems = sortUsers(toThreadUserListItems());
  renderUsers(listItems);
}

async function loadInitialMessages() {
  paging.loading = true;
  paging.exhausted = false;
  paging.oldestId = null;

  try {
    const res = await fetch(`/api/dm/messages?user_id=${encodeURIComponent(activeChatUser.id)}`, { method: "GET" });
    if (!res.ok) return;

    const data = await res.json();
    const msgs = Array.isArray(data.messages) ? data.messages : [];

    activeMessages = msgs;
    renderMessages();

    if (msgs.length > 0) {
      paging.oldestId = msgs[0].id; // oldest
    } else {
      paging.exhausted = true;
    }

    // Scroll to bottom after initial load
    const el = document.getElementById("chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  } finally {
    paging.loading = false;
  }
}

async function loadMoreMessages() {
  if (!activeChatUser) return;
  if (!paging.oldestId) {
    paging.exhausted = true;
    return;
  }

  paging.loading = true;
  try {
    const url = `/api/dm/messages?user_id=${encodeURIComponent(activeChatUser.id)}&before_id=${encodeURIComponent(paging.oldestId)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return;

    const data = await res.json();
    const msgs = Array.isArray(data.messages) ? data.messages : [];

    if (msgs.length === 0) {
      paging.exhausted = true;
      return;
    }

    // Update oldestId to the oldest message in the newly received batch
    paging.oldestId = msgs[0].id;

    // Prepend
    prependMessages(msgs);
  } finally {
    paging.loading = false;
  }
}

// -----------------------------
// WebSocket
// -----------------------------
function connectWS() {
  ws = new WebSocket(wsURL("/ws/dm"));

  ws.onopen = () => {
    // no-op
  };

  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    // Presence snapshot: list of online partner ids
    if (msg.type === "presence_snapshot" && Array.isArray(msg.online_ids)) {
      applyPresenceSnapshot(msg.online_ids);
      return;
    }

    // Presence single update
    if (msg.type === "presence" && typeof msg.user_id === "number") {
      applyPresenceUpdate(msg.user_id, !!msg.online);
      return;
    }

    // Thread bump (reorder left list)
    if (msg.type === "thread_bump" && typeof msg.other_user_id === "number") {
      applyThreadBump(msg);
      return;
    }

    // New DM message
    if (msg.type === "dm_new" && msg.message && typeof msg.conversation_with === "number") {
      applyIncomingDM(msg.conversation_with, msg.message);
      return;
    }

    // Error
    if (msg.type === "dm_error") {
      // For now: console. You can show toast later.
      console.warn("DM error:", msg.error);
      return;
    }
  };

  ws.onclose = () => {
    // optional reconnect later; keep minimal for now
    ws = null;
  };
}

function applyPresenceSnapshot(onlineIds) {
  // Update threads
  const set = new Set(onlineIds);
  threads = threads.map(t => ({ ...t, online: set.has(t.other_user_id) }));

  // Update suggested users
  suggestedUsers = suggestedUsers.map(u => ({ ...u, online: set.has(u.user_id) }));

  renderUsers(sortUsers(toThreadUserListItems()));
}

function applyPresenceUpdate(userId, online) {
  threads = threads.map(t => t.other_user_id === userId ? { ...t, online } : t);
  suggestedUsers = suggestedUsers.map(u => u.user_id === userId ? { ...u, online } : u);

  renderUsers(sortUsers(toThreadUserListItems()));
}

function applyThreadBump(bump) {
  const otherId = bump.other_user_id;

  // Ensure thread exists in list; if not, create minimal thread entry (new DM partner)
  let found = false;
  threads = threads.map(t => {
    if (t.other_user_id === otherId) {
      found = true;
      return {
        ...t,
        last_message_body: bump.last_message_body || "",
        last_message_at: bump.last_message_at || 0,
        last_message_sender: bump.last_message_sender || 0
      };
    }
    return t;
  });

  if (!found) {
    // If threads were empty and we were showing suggested, move to threads UX:
    // We'll add a minimal thread item; username/avatar may require refresh.
    // Minimal approach: refresh threads once.
    loadThreads();
    return;
  }

  renderUsers(sortUsers(toThreadUserListItems()));
}

function applyIncomingDM(conversationWith, message) {
  // If active chat matches, append
  if (activeChatUser && activeChatUser.id === conversationWith) {
    appendMessage(message);
  }

  // Also bump ordering via thread bump if backend didn’t (but it does).
  // We keep minimal: do nothing here.
}

// -----------------------------
// Sending
// -----------------------------
function sendActiveMessage() {
  if (!activeChatUser) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const input = document.getElementById("chat-input");
  const body = (input.value || "").trim();
  if (!body) return;

  ws.send(JSON.stringify({
    type: "dm_send",
    to_user_id: activeChatUser.id,
    body
  }));

  input.value = "";
}

// -----------------------------
// Init
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
    const loggedIn = document.body.dataset.showLogin !== "1";
    if (!loggedIn) return;
  
    createChatSidebar();
    await loadThreads();
    connectWS();
  });
  