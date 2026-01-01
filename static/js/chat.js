// Mock for users list
const mockUsers = [
  { id: 1, username: "alice", online: true, lastMessageAt: "2025-01-10T14:30:00" },
  { id: 2, username: "bob", online: false, lastMessageAt: null },
  { id: 3, username: "charlie", online: true, lastMessageAt: "2025-01-11T09:10:00" },
  { id: 4, username: "david", online: false, lastMessageAt: null }
];

let activeChatUser = null;


// Mock message storage: key = username, value = array of messages (oldest -> newest)
const mockMessagesByUser = {
  charlie: [
    { from: "me", to: "charlie", text: "Hey Charlie!", createdAt: "2025-01-11T09:00:00" },
    { from: "charlie", to: "me", text: "Hey! What’s up?", createdAt: "2025-01-11T09:01:00" },
    { from: "me", to: "charlie", text: "Testing the forum chat UI.", createdAt: "2025-01-11T09:02:00" },
    { from: "charlie", to: "me", text: "Looks good so far", createdAt: "2025-01-11T09:03:00" },
    { from: "me", to: "charlie", text: "Next we’ll load messages 10 by 10.", createdAt: "2025-01-11T09:04:00" },
    { from: "charlie", to: "me", text: "Nice!", createdAt: "2025-01-11T09:05:00" },
    { from: "me", to: "charlie", text: "Also need online/offline sorting.", createdAt: "2025-01-11T09:06:00" },
    { from: "charlie", to: "me", text: "We did that", createdAt: "2025-01-11T09:07:00" },
    { from: "me", to: "charlie", text: "Cool, now UI messages.", createdAt: "2025-01-11T09:08:00" },
    { from: "charlie", to: "me", text: "Let’s go!", createdAt: "2025-01-11T09:09:00" },
    { from: "me", to: "charlie", text: "This one is message 11 (to test last 10).", createdAt: "2025-01-11T09:10:00" }
  ],
  alice: [
    { from: "alice", to: "me", text: "Hi!", createdAt: "2025-01-10T14:30:00" }
  ],
  bob: [],
  david: []
};


// Create sidebar 
function createChatSidebar() {
  const root = document.getElementById("chat-root");

  root.innerHTML = `
    <div id="chat-sidebar">
      <div id="chat-header">Messages</div>
      <div id="chat-user-list"></div>
    </div>
  `;
}

// Sort users 
function sortUsers(users) {
  return users.sort((a, b) => {
    // Online users first
    if (a.online !== b.online) {
        return a.online ? -1 : 1;
    }
    // Then by last message time
    if (a.lastMessageAt && b.lastMessageAt) {
        return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    }
    
    // Users with messages before those without
    if (a.lastMessageAt && !b.lastMessageAt) return -1;
    if (!a.lastMessageAt && b.lastMessageAt) return 1;
    
    // Finally by username
    return a.username.localeCompare(b.username);
  });
}

// Render users 
function renderUsers(users) {
  const list = document.getElementById("chat-user-list");
  list.innerHTML = "";

  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "chat-user";

    div.innerHTML = `
      <span class="chat-username">${user.username}</span>
      <span class="chat-status ${user.online ? "chat-online" : "chat-offline"}"></span>
    `;

    div.addEventListener("click", () => openChat(user));
    list.appendChild(div);
  });
}


// Message helpers
function formatMessageDate(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function getLastMessages(username, limit = 10) {
  const all = mockMessagesByUser[username] || [];
  return all.slice(Math.max(0, all.length - limit)); //last messages
}

// render messages
function renderMessages(username) {
  const container = document.getElementById("chat-messages");
  const messages = getLastMessages(username, 10)

  container.innerHTML = "";

  if (messages.length === 0) {
    container.innerHTML = `<p style="opacity:.6">No messages yet</p>`;
    return;
  }

  messages.forEach(msg => {
    const row = document.createElement("div");
    row.style.marginBottom = "10px";
    
    const when = formatMessageDate(msg.createdAt);
    const sender = msg.from === "me" ? "You" : msg.from;

    row.innerHTML = `
          <div style="opacity:.7; font-size:12px; margin-bottom:2px;">
            ${when} • <strong>${sender}</strong>
          </div>
          <div style="font-size:14px;">
            ${msg.text}
          </div>
        `;

        container.appendChild(row);
      });

      container.scrollTop = container.scrollHeight;
}


// Open chat panel
function openChat(user) {
  activeChatUser = user;

  let panel = document.getElementById("chat-panel");
  if (panel) panel.remove();

  panel = document.createElement("div");
  panel.id = "chat-panel";

  panel.innerHTML = `
    <div id="chat-panel-header">
      Chat with ${user.username}
    </div>

    <div id="chat-messages">
      <p style="opacity:.6">Loading messages...</p>
    </div>

    <div id="chat-input-area">
      <input type="text" placeholder="Type a message..." disabled />
      <button disabled>Send</button>
    </div>
  `;

  document.body.appendChild(panel);

  //load last 10 messages
  renderMessages(user.username);
}

// Init 
document.addEventListener("DOMContentLoaded", () => {
  createChatSidebar();
  renderUsers(sortUsers(mockUsers));
});