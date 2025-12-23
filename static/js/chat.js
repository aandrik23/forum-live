const mockUsers = [
  { id: 1, username: "alice", online: true, lastMessageAt: "2025-01-10T14:30:00" },
  { id: 2, username: "bob", online: false, lastMessageAt: null },
  { id: 3, username: "charlie", online: true, lastMessageAt: "2025-01-11T09:10:00" },
  { id: 4, username: "david", online: false, lastMessageAt: null }
];

let activeChatUser = null;

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
      <p style="opacity:.6">No messages yet</p>
    </div>

    <div id="chat-input-area">
      <input type="text" placeholder="Type a message..." disabled />
      <button disabled>Send</button>
    </div>
  `;

  document.body.appendChild(panel);
}

// Init 
document.addEventListener("DOMContentLoaded", () => {
  createChatSidebar();
  renderUsers(sortUsers(mockUsers));
});