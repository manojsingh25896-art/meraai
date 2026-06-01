// ===== STATE =====
let currentUser = null;
let messages = [];
let allChats = [];
let currentChatId = null;
let currentLang = 'hinglish';
let isTyping = false;

// ===== INIT =====
window.onload = () => {
  const saved = localStorage.getItem('meraai_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    loadApp();
  } else {
    showPage('login-page');
  }
  const theme = localStorage.getItem('meraai_theme') || 'dark';
  applyTheme(theme);
};

// ===== PAGES =====
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== AUTH =====
function emailLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) { toast('Email aur password daalo!'); return; }
  const users = JSON.parse(localStorage.getItem('meraai_users') || '{}');
  if (!users[email]) { toast('Account nahi mila — pehle register karo'); return; }
  if (users[email].pass !== btoa(pass)) { toast('Password galat hai!'); return; }
  currentUser = { name: users[email].name, email };
  localStorage.setItem('meraai_user', JSON.stringify(currentUser));
  loadApp();
}

function doSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass = document.getElementById('signup-pass').value;
  if (!name || !email || !pass) { toast('Sab fields bharo!'); return; }
  if (pass.length < 6) { toast('Password 6+ characters ka hona chahiye'); return; }
  const users = JSON.parse(localStorage.getItem('meraai_users') || '{}');
  if (users[email]) { toast('Is email se pehle se account hai!'); return; }
  users[email] = { name, pass: btoa(pass) };
  localStorage.setItem('meraai_users', JSON.stringify(users));
  currentUser = { name, email };
  localStorage.setItem('meraai_user', JSON.stringify(currentUser));
  loadApp();
}

function logout() {
  localStorage.removeItem('meraai_user');
  currentUser = null; messages = []; allChats = [];
  showPage('login-page');
}

// ===== LOAD APP =====
function loadApp() {
  showPage('main-app');
  document.getElementById('sidebar-av').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('sidebar-name').textContent = currentUser.name;
  document.getElementById('sidebar-email').textContent = currentUser.email;
  allChats = JSON.parse(localStorage.getItem('meraai_chats_' + currentUser.email) || '[]');
  renderChatList();
  showWelcome();
}

// ===== WELCOME =====
function showWelcome() {
  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">🤖</div>
      <h2>Namaskar, ${currentUser.name.split(' ')[0]}! 👋</h2>
      <p>Main tumhara AI assistant hoon — koi bhi sawaal poochho,<br>kisi bhi bhasha mein!</p>
      <div class="chips">
        <button class="chip" onclick="quickSend('Mujhe ek funny joke sunao')">😂 Joke sunao</button>
        <button class="chip" onclick="quickSend('Python programming sikhao mujhe')">🐍 Python sikhao</button>
        <button class="chip" onclick="quickSend('Mere liye ek motivational quote do')">💪 Motivation do</button>
        <button class="chip" onclick="quickSend('Business idea do jo ghar se shuru ho sake')">💡 Business idea</button>
        <button class="chip" onclick="quickSend('English bolna sikhao mujhe')">🗣️ English sikhao</button>
        <button class="chip" onclick="quickSend('Aaj ka mausam kaisa hoga Delhi mein?')">🌤️ Mausam</button>
      </div>
    </div>`;
  messages = [];
  currentChatId = Date.now().toString();
}

function quickSend(text) {
  document.getElementById('msg-input').value = text;
  sendMsg();
}

// ===== SEND MESSAGE =====
async function sendMsg() {
  if (isTyping) return;
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  // Image mode
  if (imageMode) {
    input.value = '';
    input.style.height = 'auto';
    const msgsEl = document.getElementById('messages');
    if (msgsEl.querySelector('.welcome')) msgsEl.innerHTML = '';
    await generateImage(text);
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  // Clear welcome if showing
  const msgsEl = document.getElementById('messages');
  if (msgsEl.querySelector('.welcome')) msgsEl.innerHTML = '';

  appendBubble('user', text);
  messages.push({ role: 'user', content: text });
  if (messages.length === 1) saveChat(text);

  isTyping = true;
  document.getElementById('send-btn').disabled = true;
  const typEl = showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        userName: currentUser.name,
        language: currentLang
      })
    });

    const data = await res.json();
    typEl.remove();

    if (data.error) {
      appendBubble('ai', '❌ Error: ' + data.error);
    } else {
      messages.push({ role: 'assistant', content: data.reply });
      appendBubble('ai', data.reply);
      saveChat(messages[0].content);
    }
  } catch (e) {
    typEl.remove();
    appendBubble('ai', '❌ Server se connect nahi hua. Thodi der baad try karo.');
  }

  isTyping = false;
  document.getElementById('send-btn').disabled = false;
}

// ===== UI HELPERS =====
function appendBubble(role, text) {
  const msgsEl = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const av = role === 'user' ? currentUser.name[0].toUpperCase() : 'AI';
  const time = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="msg-av">${av}</div>
    <div>
      <div class="bubble">${escHtml(text)}</div>
      <div class="msg-time">${time}</div>
    </div>`;
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function showTyping() {
  const msgsEl = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'typing-row';
  div.innerHTML = `<div class="msg-av" style="width:28px;height:28px;border-radius:50%;background:var(--accent-bg);color:var(--accent2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0">AI</div><div class="typing-bub"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return div;
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ===== CHAT MANAGEMENT =====
function newChat() {
  showWelcome();
  renderChatList();
  closeSidebar();
}

function saveChat(firstMsg) {
  const title = firstMsg.slice(0, 38) + (firstMsg.length > 38 ? '...' : '');
  const idx = allChats.findIndex(c => c.id === currentChatId);
  const chat = { id: currentChatId, title, messages, updatedAt: Date.now() };
  if (idx >= 0) allChats[idx] = chat;
  else allChats.unshift(chat);
  localStorage.setItem('meraai_chats_' + currentUser.email, JSON.stringify(allChats.slice(0, 40)));
  renderChatList();
}

function renderChatList() {
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  allChats.slice(0, 20).forEach(c => {
    const el = document.createElement('div');
    el.className = 'chat-item' + (c.id === currentChatId ? ' active' : '');
    el.textContent = c.title;
    el.onclick = () => loadChat(c.id);
    list.appendChild(el);
  });
}

function loadChat(id) {
  const chat = allChats.find(c => c.id === id);
  if (!chat) return;
  currentChatId = id;
  messages = chat.messages || [];
  const msgsEl = document.getElementById('messages');
  msgsEl.innerHTML = '';
  messages.forEach(m => appendBubble(m.role === 'user' ? 'user' : 'ai', m.content));
  msgsEl.scrollTop = msgsEl.scrollHeight;
  renderChatList();
  closeSidebar();
}

function clearChat() {
  showWelcome();
  toast('Chat saaf ho gaya!');
}

// ===== LANGUAGE =====
function changeLang() {
  currentLang = document.getElementById('lang-select').value;
  const labels = {
    hinglish: '🇮🇳 Hinglish', hindi: '🇮🇳 Hindi', english: '🇬🇧 English',
    bengali: '🇧🇩 Bengali', tamil: 'Tamil', telugu: 'Telugu',
    marathi: 'Marathi', gujarati: 'Gujarati'
  };
  document.getElementById('lang-hint').textContent = '🌐 ' + (labels[currentLang] || currentLang);
  toast('Bhasha: ' + (labels[currentLang] || currentLang));
}

// ===== SIDEBAR =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ===== THEME =====
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('meraai_theme', t);
  const svg = document.getElementById('theme-svg');
  if (!svg) return;
  svg.innerHTML = t === 'dark'
    ? '<path d="M2 9a7 7 0 0 1 9.95-6.37A5 5 0 1 0 9.95 15.37 7 7 0 0 1 2 9z" fill="currentColor"/>'
    : '<path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.36 13.36l1.42 1.42M3.22 14.78l1.41-1.41M13.36 4.64l1.42-1.42M12 9A3 3 0 1 1 6 9a3 3 0 0 1 6 0z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
}

// ===== PROFILE =====
function showProfile() {
  document.getElementById('p-name').value = currentUser.name;
  document.getElementById('p-email').value = currentUser.email;
  document.getElementById('profile-av-big').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('profile-modal').style.display = 'flex';
}
function closeProfile() { document.getElementById('profile-modal').style.display = 'none'; }
function saveProfile() {
  const name = document.getElementById('p-name').value.trim();
  if (!name) { toast('Naam daalo!'); return; }
  currentUser.name = name;
  localStorage.setItem('meraai_user', JSON.stringify(currentUser));
  document.getElementById('sidebar-av').textContent = name[0].toUpperCase();
  document.getElementById('sidebar-name').textContent = name;
  closeProfile();
  toast('Profile save ho gayi! ✅');
}

// ===== UTILS =====
function toast(msg) {
  const ex = document.querySelector('.toast');
  if (ex) ex.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===== IMAGE GENERATION =====
let imageMode = false;

function toggleImageMode() {
  imageMode = !imageMode;
  const btn = document.getElementById('img-mode-btn');
  const input = document.getElementById('msg-input');
  if (imageMode) {
    btn.style.background = 'var(--accent)';
    btn.style.color = 'white';
    input.placeholder = '🎨 Image describe karo — jaise "sunset over mountains"';
  } else {
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text2)';
    input.placeholder = 'Kuch bhi poochho...';
  }
}

async function generateImage(prompt) {
  const msgsEl = document.getElementById('messages');

  // User bubble
  appendBubble('user', '🎨 Image: ' + prompt);

  // Typing
  isTyping = true;
  document.getElementById('send-btn').disabled = true;
  const typEl = showTyping();

  try {
    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    typEl.remove();

    if (data.error) {
      appendBubble('ai', '❌ ' + data.error);
    } else {
      // Image bubble
      const div = document.createElement('div');
      div.className = 'msg ai';
      div.innerHTML = `
        <div class="msg-av">AI</div>
        <div>
          <div class="bubble img-bubble">
            <p style="font-size:12px;color:var(--text2);margin-bottom:8px">🎨 "${escHtml(prompt)}"</p>
            <img src="${data.image}" alt="${escHtml(prompt)}"
              style="width:100%;max-width:300px;border-radius:10px;display:block"
              onerror="this.parentElement.innerHTML='❌ Image load nahi hui'"/>
            <a href="${data.image}" download="meraai-image.jpg"
              style="display:inline-block;margin-top:8px;font-size:12px;color:var(--accent2)">
              ⬇️ Download karo
            </a>
          </div>
          <div class="msg-time">${new Date().toLocaleTimeString('hi-IN',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>`;
      msgsEl.appendChild(div);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  } catch(e) {
    typEl.remove();
    appendBubble('ai', '❌ Image nahi bani — dobara try karo');
  }

  isTyping = false;
  document.getElementById('send-btn').disabled = false;
}
