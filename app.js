import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  off,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCar5tl_EGeRHhvQke8IJITDi_zAArlN8c",
  authDomain: "chat-project-c5409.firebaseapp.com",
  databaseURL: "https://chat-project-c5409-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-project-c5409",
  storageBucket: "chat-project-c5409.firebasestorage.app",
  messagingSenderId: "81449624717",
  appId: "1:81449624717:web:86057269fd96be331aaec4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let chatRef = null;
let messagesListener = null;
let listeningRef = null;

const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authStatus = document.getElementById("authStatus");
const chatTitle = document.getElementById("chatTitle");
const chatStatus = document.getElementById("chatStatus");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const messagesEl = document.getElementById("messages");

setComposerState(false);
setChatState("Conversation", "Waiting");

emailInput.addEventListener("keydown", handleAuthEnter);
passwordInput.addEventListener("keydown", handleAuthEnter);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    window.sendMessage();
  }
});

function handleAuthEnter(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    window.login();
  }
}

function setComposerState(enabled) {
  messageInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "#dc2626" : "";
}

function setChatState(title, status) {
  chatTitle.textContent = title;
  chatStatus.innerHTML = `<span class="status-dot"></span>${status}`;
}

function formatTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDisplayName(user) {
  if (!user?.email) return "Conversation";
  return user.email;
}

window.signup = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setAuthStatus("Enter both email and password to continue.", true);
    return;
  }

  if (password.length < 6) {
    setAuthStatus("Password must be at least 6 characters long.", true);
    return;
  }

  try {
    setAuthStatus("Creating your account...");
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setAuthStatus(error.message, true);
  }
};

window.login = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setAuthStatus("Enter both email and password to continue.", true);
    return;
  }

  try {
    setAuthStatus("Signing you in...");
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    setAuthStatus(error.message, true);
  }
};

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUser = null;
    detachMessagesListener();
    chatRef = null;
    document.getElementById("login").style.display = "flex";
    document.getElementById("chat").style.display = "none";
    setComposerState(false);
    setChatState("Conversation", "Waiting");
    return;
  }

  currentUser = user;
  chatRef = ref(db, `chats/${user.uid}`);

  document.getElementById("login").style.display = "none";
  document.getElementById("chat").style.display = "block";

  setComposerState(true);
  setAuthStatus("Signed in.");
  setChatState(getDisplayName(user), "Reply in 1-2 Min");
  listenMessages();
});

window.sendMessage = async () => {
  if (!chatRef || !currentUser) return;

  const text = messageInput.value.trim();
  if (!text) return;

  sendButton.disabled = true;

  try {
    await push(chatRef, {
      user: currentUser.email,
      text,
      time: serverTimestamp()
    });

    messageInput.value = "";
    messageInput.focus();
  } finally {
    sendButton.disabled = false;
  }
};

function detachMessagesListener() {
  if (listeningRef && messagesListener) {
    off(listeningRef, "value", messagesListener);
  }

  messagesListener = null;
  listeningRef = null;
}

function listenMessages() {
  if (!chatRef) return;

  detachMessagesListener();

  messagesListener = onValue(chatRef, (snapshot) => {
    messagesEl.innerHTML = "";

    snapshot.forEach((childSnapshot) => {
      renderMessage(childSnapshot.val() || {});
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  listeningRef = chatRef;
}

function renderMessage(msg) {
  const div = document.createElement("div");
  const isOwnMessage = msg.user === currentUser?.email;

  div.classList.add("message", isOwnMessage ? "user" : "admin");

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `${isOwnMessage ? "You" : "Support"}${msg.time ? ` - ${formatTime(msg.time)}` : ""}`;

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = msg.text || "";

  div.appendChild(meta);
  div.appendChild(body);
  messagesEl.appendChild(div);
}
