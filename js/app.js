// ===== STATE =====
let currentUser = null, messages = [], allChats = [], currentChatId = null;
let currentLang = 'hinglish', currentMode = 'chat';
let isTyping = false, isRecording = false, recognition = null;
let pdfText = '';

// ===== INIT =====
window.onload = () => {
  const saved = localStorage.getItem('meraai_user');
  if (saved) { currentUser = JSON.parse(saved); loadApp(); }
  else showPage('login-page');
  applyTheme(localStorage.getItem('meraai_theme') || 'dark');
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
  if (!users[email]) { toast('Account nahi mila — register karo'); return; }
  if (users[email].pass !== btoa(pass)) { toast('Password galat hai!'); return; }
  currentUser = { name: users[email].name, email, plan: users[email].plan || 'free' };
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
  if (users[email]) { toast('Is email se account pehle se hai!'); return; }
  users[email] = { name, pass: btoa(pass), plan: 'free' };
  localStorage.setItem('meraai_users', JSON.stringify(users));
  currentUser = { name, email, plan: 'free' };
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
  updatePlanBadge();
  allChats = JSON.parse(localStorage.getItem('meraai_chats_' + currentUser.email) || '[]');
  renderChatList();
  showWelcome();
  initVoice();
}

function updatePlanBadge() {
  const badge = document.getElementById('plan-badge');
  if (currentUser.plan === 'pro') { badge.textContent = '⭐ Pro Plan'; badge.className = 'plan-badge pro'; }
  else if (currentUser.plan === 'business') { badge.textContent = '💎 Business Plan'; badge.className = 'plan-badge pro'; }
  else { badge.textContent = 'Free Plan'; badge.className = 'plan-badge free'; }
}

// ===== WELCOME =====
function showWelcome() {
  document.getElementById('messages').innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">🤖</div>
      <h2>Namaskar, ${currentUser.name.split(' ')[0]}! 👋</h2>
      <p>Chat karo, images banao, code likhwao, PDF samjho — sab ek jagah!</p>
      <div class="chips">
        <button class="chip" onclick="quickSend('Mujhe ek funny joke sunao')">😂 Joke</button>
        <button class="chip" onclick="quickSend('Aaj ke liye motivational quote do')">💪 Motivation</button>
        <button class="chip" onclick="setMode(\'image\'); quickSend(\'beautiful Indian landscape, realistic, 4k\')">🎨 Image banao</button>
        <button class="chip" onclick="quickSend('Python mein hello world kaise likhte hain?')">🐍 Python</button>
        <button class="chip" onclick="quickSend('Ghar se business kaise shuru karein?')">💡 Business</button>
        <button class="chip" onclick="quickSend('English bolna sikhao — beginner level')">🗣️ English</button>
      </div>
    </div>`;
  messages = [];
  currentChatId = Date.now().toString();
}

function quickSend(text) {
  document.getElementById('msg-input').value = text;
  sendMsg();
}

// ===== MODE =====
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-' + mode).classList.add('active');

  const labels = { chat: '💬 Chat Mode', image: '🎨 Image Mode', code: '💻 Code Mode', pdf: '📄 PDF Mode' };
  const hints = { chat: '💬 Chat', image: '🎨 Image', code: '💻 Code', pdf: '📄 PDF' };
  const placeholders = {
    chat: 'Kuch bhi poochho...',
    image: '🎨 Image describe karo — jaise "sunset over mountains"',
    code: '💻 Code ke baare mein poochho...',
    pdf: '📄 PDF ke baare mein poochho...'
  };

  document.getElementById('mode-label').textContent = labels[mode];
  document.getElementById('mode-hint').textContent = hints[mode];
  document.getElementById('msg-input').placeholder = placeholders[mode];
  document.getElementById('pdf-area').style.display = mode === 'pdf' ? 'block' : 'none';
  document.getElementById('code-area').style.display = mode === 'code' ? 'block' : 'none';
  closeSidebar();
}

// ===== SEND MESSAGE =====
async function sendMsg() {
  if (isTyping) return;
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  const msgsEl = document.getElementById('messages');
  if (msgsEl.querySelector('.welcome')) msgsEl.innerHTML = '';

  if (currentMode === 'image') { await generateImage(text); return; }

  appendBubble('user', text);

  let finalPrompt = text;
  if (currentMode === 'pdf' && pdfText) finalPrompt = `PDF content:\n${pdfText.slice(0, 3000)}\n\nSawal: ${text}`;
  if (currentMode === 'code') {
    const code = document.getElementById('code-editor').value;
    const lang = document.getElementById('code-lang').value;
    if (code) finalPrompt = `${lang} code:\n\`\`\`\n${code}\n\`\`\`\n\n${text}`;
  }

  messages.push({ role: 'user', content: finalPrompt });
  if (messages.length === 1) saveChat(text);

  isTyping = true;
  document.getElementById('send-btn').disabled = true;
  const typEl = showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, userName: currentUser.name, language: currentLang })
    });
    const data = await res.json();
    typEl.remove();
    if (data.error) { appendBubble('ai', '❌ ' + data.error); }
    else {
      messages.push({ role: 'assistant', content: data.reply });
      appendBubble('ai', data.reply);
      saveChat(messages[0].content);
      if (currentUser.plan === 'pro') speakText(data.reply);
    }
  } catch (e) {
    typEl.remove();
    appendBubble('ai', '❌ Server error. Thodi der baad try karo.');
  }

  isTyping = false;
  document.getElementById('send-btn').disabled = false;
}

// ===== IMAGE GENERATION =====
async function generateImage(prompt) {
  const msgsEl = document.getElementById('messages');
  if (msgsEl.querySelector('.welcome')) msgsEl.innerHTML = '';
  appendBubble('user', '🎨 ' + prompt);

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
    if (data.error) { appendBubble('ai', '❌ ' + data.error); }
    else {
      const msgsEl = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'msg ai';
      div.innerHTML = `<div class="msg-av">AI</div><div><div class="bubble img-result"><p style="font-size:12px;color:var(--text2);margin-bottom:6px">🎨 "${escHtml(prompt)}"</p><img src="${data.image}" alt="${escHtml(prompt)}" onerror="this.parentElement.innerHTML='❌ Image load error'"/><br><a href="${data.image}" download="meraai.jpg">⬇️ Download</a></div><div class="msg-time">${new Date().toLocaleTimeString('hi-IN',{hour:'2-digit',minute:'2-digit'})}</div></div>`;
      msgsEl.appendChild(div);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  } catch (e) {
    typEl.remove();
    appendBubble('ai', '❌ Image nahi bani. Dobara try karo.');
  }

  isTyping = false;
  document.getElementById('send-btn').disabled = false;
}

// ===== CODE HELPERS =====
function explainCode() {
  const code = document.getElementById('code-editor').value;
  const lang = document.getElementById('code-lang').value;
  if (!code) { toast('Pehle code daalo!'); return; }
  document.getElementById('msg-input').value = `Ye ${lang} code explain karo simple Hindi/Hinglish mein`;
  sendMsg();
}
function fixCode() {
  const code = document.getElementById('code-editor').value;
  if (!code) { toast('Pehle code daalo!'); return; }
  document.getElementById('msg-input').value = 'Is code mein kya bugs hain? Fix karo aur explain karo';
  sendMsg();
}
function improveCode() {
  const code = document.getElementById('code-editor').value;
  if (!code) { toast('Pehle code daalo!'); return; }
  document.getElementById('msg-input').value = 'Is code ko improve karo — better, faster, cleaner banao';
  sendMsg();
}

// ===== PDF HANDLING =====
async function handlePDF(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('pdf-status');
  status.textContent = '📄 PDF read ho raha hai...';

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = await extractPDFText(e.target.result);
      pdfText = text;
      status.textContent = `✅ PDF ready! (${Math.round(text.length/100)} pages approx) — Ab sawaal poochho`;
      toast('PDF load ho gaya! Ab sawaal poochho 📄');
    } catch(err) {
      status.textContent = '❌ PDF read nahi hua — text PDF hona chahiye';
    }
  };
  reader.readAsArrayBuffer(file);
}

async function extractPDFText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let text = '';
  const str = new TextDecoder('latin1').decode(bytes);
  const matches = str.match(/BT[\s\S]*?ET/g) || [];
  matches.forEach(block => {
    const tjMatches = block.match(/\((.*?)\)\s*Tj/g) || [];
    tjMatches.forEach(m => { text += m.replace(/\((.*?)\)\s*Tj/, '$1') + ' '; });
  });
  return text || 'PDF se text extract nahi hua — please text-based PDF use karo';
}

// ===== VOICE =====
function initVoice() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = currentLang === 'hindi' ? 'hi-IN' : 'hi-IN';
    recognition.onresult = (e) => {
      document.getElementById('msg-input').value = e.results[0][0].transcript;
      stopVoice();
    };
    recognition.onerror = () => { stopVoice(); toast('Voice error — dobara try karo'); };
    recognition.onend = () => stopVoice();
  }
}

function toggleVoice() {
  if (!recognition) { toast('Tumhara browser voice support nahi karta'); return; }
  if (isRecording) stopVoice(); else startVoice();
}

function startVoice() {
  isRecording = true;
  document.getElementById('voice-btn').classList.add('recording');
  recognition.lang = currentLang === 'english' ? 'en-IN' : 'hi-IN';
  recognition.start();
  toast('🎤 Bol rahe ho...');
}

function stopVoice() {
  isRecording = false;
  document.getElementById('voice-btn').classList.remove('recording');
  try { recognition.stop(); } catch(e) {}
}

function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  const clean = text.replace(/[*_`#]/g, '').slice(0, 200);
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = currentLang === 'english' ? 'en-IN' : 'hi-IN';
  utt.rate = 0.9;
  speechSynthesis.speak(utt);
}

// ===== RAZORPAY PAYMENT =====
function buyPlan(plan, amount) {
  const options = {
    key: 'rzp_test_YOUR_KEY_HERE',
    amount: amount * 100,
    currency: 'INR',
    name: 'Mera AI',
    description: plan === 'pro' ? 'Pro Plan — 1 Mahina' : 'Business Plan — 1 Mahina',
    image: '',
    handler: function(response) {
      // Payment successful
      currentUser.plan = plan;
      localStorage.setItem('meraai_user', JSON.stringify(currentUser));
      const users = JSON.parse(localStorage.getItem('meraai_users') || '{}');
      if (users[currentUser.email]) { users[currentUser.email].plan = plan; localStorage.setItem('meraai_users', JSON.stringify(users)); }
      updatePlanBadge();
      closePlans();
      toast(`🎉 ${plan === 'pro' ? 'Pro' : 'Business'} plan active ho gaya!`);
    },
    prefill: { name: currentUser.name, email: currentUser.email },
    theme: { color: '#6c63f0' }
  };
  try {
    const rzp = new Razorpay(options);
    rzp.open();
  } catch(e) {
    toast('Payment ke liye Razorpay key add karni hogi — app.js mein YOUR_KEY_HERE replace karo');
  }
}

// ===== UI HELPERS =====
function appendBubble(role, text) {
  const msgsEl = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const av = role === 'user' ? currentUser.name[0].toUpperCase() : 'AI';
  const time = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `<div class="msg-av">${av}</div><div><div class="bubble">${escHtml(text)}</div><div class="msg-time">${time}</div></div>`;
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

function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

// ===== CHAT MANAGEMENT =====
function newChat() { showWelcome(); renderChatList(); closeSidebar(); pdfText = ''; }

function saveChat(firstMsg) {
  const title = firstMsg.slice(0, 38) + (firstMsg.length > 38 ? '...' : '');
  const idx = allChats.findIndex(c => c.id === currentChatId);
  const chat = { id: currentChatId, title, messages, updatedAt: Date.now() };
  if (idx >= 0) allChats[idx] = chat; else allChats.unshift(chat);
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
    el.onclick = () => { currentChatId = c.id; messages = c.messages || []; const msgsEl = document.getElementById('messages'); msgsEl.innerHTML = ''; messages.forEach(m => appendBubble(m.role === 'user' ? 'user' : 'ai', m.content)); msgsEl.scrollTop = msgsEl.scrollHeight; renderChatList(); closeSidebar(); };
    list.appendChild(el);
  });
}

function clearChat() { showWelcome(); pdfText = ''; toast('Chat saaf!'); }

// ===== LANGUAGE =====
function changeLang() {
  currentLang = document.getElementById('lang-select').value;
  const labels = { hinglish:'🇮🇳 Hinglish', hindi:'🇮🇳 Hindi', english:'🇬🇧 English', bengali:'Bengali', tamil:'Tamil', telugu:'Telugu', marathi:'Marathi', gujarati:'Gujarati' };
  document.getElementById('lang-hint').textContent = labels[currentLang] || currentLang;
  if (recognition) recognition.lang = currentLang === 'english' ? 'en-IN' : 'hi-IN';
}

// ===== SIDEBAR =====
function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); }

// ===== THEME =====
function toggleTheme() { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('meraai_theme', t);
  const svg = document.getElementById('theme-svg');
  if (svg) svg.innerHTML = t === 'dark' ? '<path d="M2 9a7 7 0 0 1 9.95-6.37A5 5 0 1 0 9.95 15.37 7 7 0 0 1 2 9z" fill="currentColor"/>' : '<path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.36 13.36l1.42 1.42M3.22 14.78l1.41-1.41M13.36 4.64l1.42-1.42M12 9A3 3 0 1 1 6 9a3 3 0 0 1 6 0z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
}

// ===== PLANS =====
function showPlans() { document.getElementById('plans-modal').style.display = 'flex'; }
function closePlans() { document.getElementById('plans-modal').style.display = 'none'; }

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
  toast('Profile save! ✅');
}

// ===== UTILS =====
function toast(msg) {
  const ex = document.querySelector('.toast');
  if (ex) ex.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function escHtml(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
