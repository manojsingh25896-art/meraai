// ===== STATE =====
let currentUser = null;
let anthropicKey = '';
let groqKey = '';
let messages = [];
let allChats = [];
let currentChatId = null;
let selectedModel = 'claude-sonnet-4-20250514';
let isTyping = false;
let msgCount = 0;
const FREE_LIMIT = 20;

// ===== INIT =====
window.onload = () => {
  const saved = localStorage.getItem('meraai_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    anthropicKey = localStorage.getItem('meraai_anthropic_key') || '';
    groqKey = localStorage.getItem('meraai_groq_key') || '';
    loadApp();
  } else {
    showPage('login-page');
  }
  const theme = localStorage.getItem('meraai_theme') || 'light';
  setTheme(theme);
};

// ===== PAGES =====
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function showSignup() { showPage('signup-page'); }
function showLogin() { showPage('login-page'); }

// ===== AUTH =====
function googleLogin() { createSession('Google User', 'user@gmail.com'); }

function emailLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Email aur password dono daalo!'); return; }
  const users = JSON.parse(localStorage.getItem('meraai_users') || '{}');
  if (!users[email]) { showToast('Account nahi mila. Pehle register karo.'); return; }
  if (users[email].pass !== btoa(pass)) { showToast('Password galat hai!'); return; }
  createSession(users[email].name, email);
}

function doSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass = document.getElementById('signup-pass').value;
  if (!name || !email || !pass) { showToast('Sab fields bharo!'); return; }
  if (pass.length < 6) { showToast('Password 6+ characters ka hona chahiye'); return; }
  const users = JSON.parse(localStorage.getItem('meraai_users') || '{}');
  if (users[email]) { showToast('Is email se already account hai!'); return; }
  users[email] = { name, pass: btoa(pass) };
  localStorage.setItem('meraai_users', JSON.stringify(users));
  createSession(name, email);
}

function createSession(name, email) {
  currentUser = { name, email, plan: 'free', joinDate: new Date().toISOString() };
  localStorage.setItem('meraai_user', JSON.stringify(currentUser));
  loadApp();
}

function logout() {
  localStorage.removeItem('meraai_user');
  currentUser = null; messages = []; allChats = [];
  showPage('login-page');
  showToast('Logout ho gaye!');
}

// ===== LOAD APP =====
function loadApp() {
  showPage('main-app');
  document.getElementById('user-name-display').textContent = currentUser.name;
  document.getElementById('user-email-display').textContent = currentUser.email;
  document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('plan-text').textContent = 'Free Plan';

  allChats = JSON.parse(localStorage.getItem(`meraai_chats_${currentUser.email}`) || '[]');
  renderChatList();
  msgCount = parseInt(localStorage.getItem(`meraai_msgcount_${today()}`) || '0');

  if (anthropicKey || groqKey) {
    showChatUI();
    startNewChat();
  } else {
    showApiSetup();
  }
}

// ===== API SETUP =====
function showApiSetup() {
  document.getElementById('api-setup').style.display = 'flex';
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('input-area').style.display = 'none';
}

function showChatUI() {
  document.getElementById('api-setup').style.display = 'none';
  document.getElementById('welcome-screen').style.display = 'flex';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('input-area').style.display = 'block';
  document.getElementById('welcome-name').textContent = `Namaskar, ${currentUser.name.split(' ')[0]}! 👋`;
  updateMsgCountDisplay();
  updateApiStatus();
}

function saveApiKey() {
  const aKey = document.getElementById('api-key-field').value.trim();
  const gKey = document.getElementById('groq-key-field').value.trim();

  if (!aKey && !gKey) { showToast('Kam se kam ek key daalo!'); return; }

  if (aKey) {
    if (!aKey.startsWith('sk-')) { showToast('Anthropic key galat hai! sk- se shuroo hoti hai'); return; }
    anthropicKey = aKey;
    localStorage.setItem('meraai_anthropic_key', aKey);
  }
  if (gKey) {
    if (!gKey.startsWith('gsk_')) { showToast('Groq key galat hai! gsk_ se shuroo hoti hai'); return; }
    groqKey = gKey;
    localStorage.setItem('meraai_groq_key', gKey);
  }

  showToast('Key save ho gayi! 🎉');
  showChatUI();
  startNewChat();
}

function updateApiStatus() {
  const statusEl = document.getElementById('api-status');
  if (!statusEl) return;
  if (anthropicKey && groqKey) {
    statusEl.textContent = '✅ Anthropic + Groq dono active (Anthropic priority)';
    statusEl.style.color = 'var(--accent)';
  } else if (anthropicKey) {
    statusEl.textContent = '✅ Anthropic API active';
    statusEl.style.color = 'var(--accent)';
  } else if (groqKey) {
    statusEl.textContent = '✅ Groq API active (Free)';
    statusEl.style.color = '#16a34a';
  }
}

// ===== WHICH API TO USE =====
function getActiveApi() {
  if (anthropicKey) return 'anthropic';
  if (groqKey) return 'groq';
  return null;
}

// ===== SEND MESSAGE =====
async function sendMsg() {
  const activeApi = getActiveApi();
  if (!activeApi) { showToast('Pehle API key daalo!'); showApiSetup(); return; }
  if (isTyping) return;

  const plan = currentUser.plan || 'free';
  if (plan === 'free' && msgCount >= FREE_LIMIT) {
    showToast('Free limit khatam! Pro plan lo unlimited ke liye.');
    showUpgrade(); return;
  }

  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('char-count').textContent = '';

  document.getElementById('welcome-screen').style.display = 'none';
  const msgsEl = document.getElementById('messages');
  msgsEl.style.display = 'flex';

  appendBubble('user', text);
  messages.push({ role: 'user', content: text });
  if (messages.length === 1) saveCurrentChat(text);

  isTyping = true;
  document.getElementById('send-btn').disabled = true;
  const typingEl = showTyping();

  try {
    let reply = '';
    if (activeApi === 'anthropic') {
      reply = await callAnthropic();
    } else {
      reply = await callGroq();
    }
    typingEl.remove();
    messages.push({ role: 'assistant', content: reply });
    appendBubble('ai', reply);
    saveCurrentChat(messages[0].content);
    msgCount++;
    localStorage.setItem(`meraai_msgcount_${today()}`, msgCount);
    updateMsgCountDisplay();
  } catch (e) {
    typingEl.remove();
    // Anthropic fail hua to Groq try karo
    if (activeApi === 'anthropic' && groqKey) {
      showToast('Anthropic error! Groq se try kar raha hoon...');
      try {
        const reply = await callGroq();
        messages.push({ role: 'assistant', content: reply });
        appendBubble('ai', reply + '\n\n_(Groq AI ne jawab diya)_');
        saveCurrentChat(messages[0].content);
      } catch (e2) {
        appendBubble('ai', '❌ Dono APIs mein error! Keys check karo.');
      }
    } else {
      appendBubble('ai', '❌ Error aaya! API key aur internet check karo.');
    }
  }

  isTyping = false;
  document.getElementById('send-btn').disabled = false;
}

// ===== ANTHROPIC API =====
async function callAnthropic() {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 1000,
      system: `Tum ek helpful AI assistant ho jiska naam "Mera AI" hai. User ka naam ${currentUser.name} hai. Hinglish mein baat karo. Friendly aur helpful raho.`,
      messages
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || 'Kuch galat hua.';
}

// ===== GROQ API =====
async function callGroq() {
  const groqMessages = [
    { role: 'system', content: `Tum ek helpful AI assistant ho jiska naam "Mera AI" hai. User ka naam ${currentUser.name} hai. Hinglish mein baat karo. Friendly aur helpful raho.` },
    ...messages
  ];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: groqMessages
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || 'Kuch galat hua.';
}

// ===== CHAT MANAGEMENT =====
function startNewChat() {
  currentChatId = Date.now().toString();
  messages = [];
  document.getElementById('messages').innerHTML = '';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('welcome-screen').style.display = 'flex';
  document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
}

function newChat() {
  startNewChat();
  if (window.innerWidth <= 768) closeMobileSidebar();
}

function saveCurrentChat(firstMsg) {
  if (!currentChatId) return;
  const existing = allChats.findIndex(c => c.id === currentChatId);
  const chatData = { id: currentChatId, title: firstMsg.slice(0, 40) + (firstMsg.length > 40 ? '...' : ''), messages, updatedAt: Date.now() };
  if (existing >= 0) allChats[existing] = chatData;
  else allChats.unshift(chatData);
  localStorage.setItem(`meraai_chats_${currentUser.email}`, JSON.stringify(allChats.slice(0, 50)));
  renderChatList();
}

function renderChatList() {
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  allChats.slice(0, 20).forEach(chat => {
    const el = document.createElement('div');
    el.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
    el.innerHTML = `<span class="chat-item-icon">💬</span><span style="overflow:hidden;text-overflow:ellipsis">${chat.title}</span>`;
    el.onclick = () => loadChat(chat.id);
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
  document.getElementById('welcome-screen').style.display = 'none';
  msgsEl.style.display = 'flex';
  messages.forEach(m => appendBubble(m.role === 'user' ? 'user' : 'ai', m.content, false));
  msgsEl.scrollTop = msgsEl.scrollHeight;
  renderChatList();
  if (window.innerWidth <= 768) closeMobileSidebar();
}

// ===== UI HELPERS =====
function appendBubble(role, text, animate = true) {
  const msgsEl = document.getElementById('messages');
  const row = document.createElement('div');
  row.className = 'msg ' + role;
  if (!animate) row.style.animation = 'none';
  const initials = role === 'user' ? currentUser.name[0].toUpperCase() : 'AI';
  const time = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  row.innerHTML = `<div class="msg-avatar">${initials}</div><div class="msg-content"><div class="msg-bubble">${escapeHtml(text)}</div><div class="msg-time">${time}</div></div>`;
  msgsEl.appendChild(row);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function showTyping() {
  const msgsEl = document.getElementById('messages');
  const row = document.createElement('div');
  row.className = 'typing-row';
  row.innerHTML = `<div class="msg-avatar" style="background:var(--accent-light);color:var(--accent);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0">AI</div><div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgsEl.appendChild(row);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return row;
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  const len = el.value.length;
  document.getElementById('char-count').textContent = len > 100 ? len : '';
}

function useSuggestion(text) {
  document.getElementById('msg-input').value = text;
  sendMsg();
}

function clearChat() {
  if (!confirm('Chat saaf karein?')) return;
  messages = [];
  document.getElementById('messages').innerHTML = '';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('welcome-screen').style.display = 'flex';
}

function changeModel() {
  selectedModel = document.getElementById('model-select').value;
  showToast(`Model: ${selectedModel.includes('haiku') ? 'Claude Haiku' : 'Claude Sonnet 4'}`);
}

// ===== SIDEBAR =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sidebar.classList.toggle('mobile-open');
  else sidebar.classList.toggle('collapsed');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
}

// ===== THEME =====
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('meraai_theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.innerHTML = theme === 'dark'
      ? '<path d="M2 9a7 7 0 0 1 9.95-6.37A5 5 0 1 0 9.95 15.37 7 7 0 0 1 2 9z" fill="currentColor"/>'
      : '<path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.36 13.36l1.42 1.42M3.22 14.78l1.41-1.41M13.36 4.64l1.42-1.42M12 9A3 3 0 1 1 6 9a3 3 0 0 1 6 0z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
  }
}

// ===== MODALS =====
function showUpgrade() { document.getElementById('upgrade-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('upgrade-modal').style.display = 'none'; }
function selectPlan(plan) {
  showToast(`${plan.toUpperCase()} ke liye Razorpay integrate karo!`);
  closeModal();
}

function showProfile() {
  document.getElementById('profile-name').value = currentUser.name;
  document.getElementById('profile-email').value = currentUser.email;
  document.getElementById('profile-api-key').value = anthropicKey;
  document.getElementById('profile-groq-key').value = groqKey;
  document.getElementById('profile-avatar-big').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('profile-modal').style.display = 'flex';
}
function closeProfileModal() { document.getElementById('profile-modal').style.display = 'none'; }
function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const aKey = document.getElementById('profile-api-key').value.trim();
  const gKey = document.getElementById('profile-groq-key').value.trim();
  if (!name) { showToast('Naam daalo!'); return; }
  currentUser.name = name;
  localStorage.setItem('meraai_user', JSON.stringify(currentUser));
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  if (aKey.startsWith('sk-')) { anthropicKey = aKey; localStorage.setItem('meraai_anthropic_key', aKey); }
  if (gKey.startsWith('gsk_')) { groqKey = gKey; localStorage.setItem('meraai_groq_key', gKey); }
  closeProfileModal();
  showToast('Profile save ho gayi! ✅');
  updateApiStatus();
}

// ===== UTILS =====
function showToast(msg, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function today() { return new Date().toISOString().split('T')[0]; }

function updateMsgCountDisplay() {
  const el = document.getElementById('msg-count-display');
  if (el) el.textContent = `${msgCount}/${FREE_LIMIT} messages aaj`;
}
