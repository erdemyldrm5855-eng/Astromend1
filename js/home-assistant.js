/* ══════════════════════════════════════════════════════════
   home-assistant.js — AI Asistan sohbet paneli.
   ══════════════════════════════════════════════════════════ */

function addChatBubble(text, who) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const div = document.createElement('div');
  div.className = `chat-bubble ${who}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

document.getElementById('chatForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  addChatBubble(msg, 'user');
  input.value = '';
  try {
    const res = await fetch('/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    addChatBubble(data.ok ? data.reply : 'Bir sorun oluştu, tekrar dener misin?', 'bot');
  } catch {
    addChatBubble('Sunucuya ulaşılamadı.', 'bot');
  }
});
