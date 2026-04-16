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

    chatSnapshot.forEach((messageSnapshot) => {
      const value = messageSnapshot.val() || {};
      const nextTime = value.time || 0;

      if (nextTime >= lastTime) {
        lastTime = nextTime;
        lastText = value.text || "";
      }
    });

    users.push({
      name: chatSnapshot.key,
      lastTime,
      lastText
    });
  });

  users.sort((a, b) => b.lastTime - a.lastTime);

  users.forEach((user) => {
    userListEl.appendChild(createUserItem(user));
  });

  if (!users.length) {
    currentUser = "";
    detachMessagesListener();
    currentRef = null;
    messagesEl.innerHTML = "";
    messageInput.value = "";
    setComposerState(false);
    setReplyState("Reply panel", "No chats");
    return;
  }

  const currentStillExists = users.some((user) => user.name === currentUser);

  if (!currentStillExists) {
    openChat(users[0].name);
  } else {
    highlightActiveUser();
  }
});

function createUserItem({ name, lastText }) {
  const div = document.createElement("div");
  div.classList.add("user-item");
  div.dataset.user = name;
  div.onclick = () => openChat(name);

  const textWrap = document.createElement("div");
  textWrap.className = "user-text";

  const nameEl = document.createElement("span");
  nameEl.className = "user-name";
  nameEl.textContent = name;

  const previewEl = document.createElement("small");
  previewEl.className = "user-preview";
  previewEl.textContent = summarizeText(lastText);

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "X";
  deleteButton.className = "delete-btn";
  deleteButton.onclick = (event) => {
    event.stopPropagation();
    deleteUser(name);
  };

  textWrap.appendChild(nameEl);
  textWrap.appendChild(previewEl);
  div.appendChild(textWrap);
  div.appendChild(deleteButton);

  return div;
}

function openChat(user) {
  currentUser = user;
  detachMessagesListener();
  currentRef = ref(db, `chats/${user}`);

  setComposerState(true);
  setReplyState(user, "Live thread");
  messagesEl.innerHTML = "";

  messagesListener = onValue(currentRef, (snapshot) => {
    messagesEl.innerHTML = "";

    snapshot.forEach((childSnapshot) => {
      renderMessage(childSnapshot.val() || {});
    });

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
      text,
      time: serverTimestamp()
    });

    messageInput.value = "";
    messageInput.focus();
  } finally {
    sendButton.disabled = false;
  }
};

function deleteUser(name) {
  if (!confirm(`Delete ${name}?`)) return;
  remove(ref(db, `chats/${name}`));
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
  meta.textContent = `${isAdmin ? "Admin" : "Customer"}${msg.time ? ` - ${formatTime(msg.time)}` : ""}`;

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = msg.text || "";

  div.appendChild(meta);
  div.appendChild(body);
  messagesEl.appendChild(div);
}
