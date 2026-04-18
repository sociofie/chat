import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  off,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCar5tl_EGeRHhvQke8IJITDi_zAArlN8c",
  databaseURL: "https://chat-project-c5409-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = "";
let currentChatName = "";
let currentRef = null;
let messagesListener = null;
let listeningRef = null;

const userListEl = document.getElementById("userList");
const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const replyTitle = document.getElementById("replyTitle");
const replyStatus = document.getElementById("replyStatus");

setComposerState(false);
setReplyState("Reply panel", "Select a chat");

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    window.sendMessage();
  }
});

window.toggleUsers = () => {
  userListEl.classList.toggle("active");
};

function setComposerState(enabled) {
  messageInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

function setReplyState(title, status) {
  replyTitle.textContent = title;
  replyStatus.innerHTML = `<span class="status-dot"></span>${status}`;
}

function formatTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function summarizeText(text) {
  return (text || "No messages yet").replace(/\s+/g, " ").trim().slice(0, 42) || "No messages yet";
}

function detachMessagesListener() {
  if (listeningRef && messagesListener) {
    off(listeningRef, "value", messagesListener);
  }

  messagesListener = null;
  listeningRef = null;
}

const usersRef = ref(db, "chats");

onValue(usersRef, (snapshot) => {
  const users = [];
  userListEl.innerHTML = "";

  snapshot.forEach((chatSnapshot) => {
    let lastTime = 0;
    let lastText = "";
    let fullName = "";

    chatSnapshot.forEach((messageSnapshot) => {
      const value = messageSnapshot.val() || {};
      const nextTime = value.time || 0;

      if (!fullName && value.name) {
        fullName = value.name;
      }

      if (nextTime >= lastTime) {
        lastTime = nextTime;
        lastText = value.text || "";
        fullName = value.name || fullName;
      }
    });

    users.push({
      id: chatSnapshot.key,
      name: fullName || "Unknown",
      lastText,
      lastTime
    });
  });

  users.sort((a, b) => b.lastTime - a.lastTime);

  users.forEach((user) => {
    userListEl.appendChild(createUserItem(user));
  });

  if (!users.length) {
    currentUser = "";
    currentChatName = "";
    detachMessagesListener();
    currentRef = null;
    messagesEl.innerHTML = "";
    messageInput.value = "";
    setComposerState(false);
    setReplyState("Reply panel", "No chats");
    return;
  }

  const currentStillExists = users.some((user) => user.id === currentUser);

  if (!currentStillExists) {
    openChat(users[0].id, users[0].name);
  } else {
    const activeUser = users.find((user) => user.id === currentUser);
    if (activeUser) {
      currentChatName = activeUser.name || "Unknown";
      setReplyState(currentChatName, "Live thread");
    }
    highlightActiveUser();
  }
});

function createUserItem({ id, name, lastText }) {
  const div = document.createElement("div");
  div.classList.add("user-item");
  div.dataset.user = id;
  div.onclick = () => openChat(id, name);

  const textWrap = document.createElement("div");
  textWrap.className = "user-text";

  const nameEl = document.createElement("span");
  nameEl.className = "user-name";
  nameEl.textContent = name || "Unknown";

  const previewEl = document.createElement("small");
  previewEl.className = "user-preview";
  previewEl.textContent = summarizeText(lastText);

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "X";
  deleteButton.className = "delete-btn";
  deleteButton.onclick = (event) => {
    event.stopPropagation();
    deleteUser(id, name || "Unknown");
  };

  textWrap.appendChild(nameEl);
  textWrap.appendChild(previewEl);
  div.appendChild(textWrap);
  div.appendChild(deleteButton);

  return div;
}

function openChat(userId, displayName = "Unknown") {
  currentUser = userId;
  currentChatName = displayName || "Unknown";

  detachMessagesListener();
  currentRef = ref(db, `chats/${userId}`);

  setComposerState(true);
  setReplyState(currentChatName, "Live thread");
  messagesEl.innerHTML = "";

  messagesListener = onValue(currentRef, (snapshot) => {
    messagesEl.innerHTML = "";
    let headerName = currentChatName;

    snapshot.forEach((childSnapshot) => {
      const msg = childSnapshot.val() || {};
      if (msg.name) {
        headerName = msg.name;
      }
      renderMessage(msg);
    });

    currentChatName = headerName || currentChatName || "Unknown";
    setReplyState(currentChatName, "Live thread");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  listeningRef = currentRef;
  highlightActiveUser();
  userListEl.classList.remove("active");
}

window.sendMessage = async () => {
  if (!currentUser) return;

  const text = messageInput.value.trim();
  if (!text) return;

  sendButton.disabled = true;

  try {
    await push(ref(db, `chats/${currentUser}`), {
      user: "ADMIN",
      name: "Admin",
      text,
      time: serverTimestamp()
    });

    messageInput.value = "";
    messageInput.focus();
  } finally {
    sendButton.disabled = false;
  }
};

function deleteUser(userId, name) {
  if (!confirm(`Delete ${name}?`)) return;
  remove(ref(db, `chats/${userId}`));
}

function highlightActiveUser() {
  document.querySelectorAll(".user-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.user === currentUser);
  });
}

function renderMessage(msg) {
  const div = document.createElement("div");
  const isAdmin = msg.user === "ADMIN";

  div.classList.add("message", isAdmin ? "user" : "admin");

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `${isAdmin ? "Admin" : currentChatName || "Customer"}${msg.time ? ` - ${formatTime(msg.time)}` : ""}`;

  const body = document.createElement("div");
  body.className = "message-body";
  const text = msg.text || "";

const urlRegex = /(https?:\/\/[^\s]+)/g;

const formattedText = text.replace(urlRegex, (url) => {
  return `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:underline;">${url}</a>`;
});

body.innerHTML = formattedText;

  div.appendChild(meta);
  div.appendChild(body);
  messagesEl.appendChild(div);
}
