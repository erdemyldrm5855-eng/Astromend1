/* ── Star canvas ── */
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
let stars = [];

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
}

function initStars() {
  stars = Array.from({ length: 220 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.4 + .2,
    a: Math.random(),
    speed: Math.random() * .004 + .001,
    phase: Math.random() * Math.PI * 2
  }));
}

function drawStars(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stars.forEach(s => {
    const alpha = .3 + .7 * (.5 + .5 * Math.sin(t * s.speed * 1000 + s.phase));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  });
}

let lastShoot = 0;
function shootingStar(t) {
  if (t - lastShoot < 4000) return;
  lastShoot = t;
  const el = document.createElement('div');
  el.className = 'shoot';
  const startX = Math.random() * window.innerWidth * .6;
  const startY = Math.random() * window.innerHeight * .4;
  el.style.cssText = `left:${startX}px;top:${startY}px`;
  document.body.appendChild(el);
  const kf = [
    { transform: 'translate(0,0) scale(1)',         opacity: 1 },
    { transform: `translate(${220 + Math.random()*80}px,${100 + Math.random()*60}px) scale(0)`, opacity: 0 }
  ];
  el.animate(kf, { duration: 900, easing: 'ease-in' }).onfinish = () => el.remove();
}

function loop(t) {
  drawStars(t);
  shootingStar(t);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);

/* ── Tab switch ── */
function switchTab(tab, btn) {
  const isLogin = tab === 'login';
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const tabs = document.querySelectorAll('.tab');
    tabs[isLogin ? 0 : 1].classList.add('active');
  }
  document.querySelectorAll('.register-only').forEach(el => {
    el.style.display = isLogin ? 'none' : 'block';
  });
  document.getElementById('submitLabel').textContent = isLogin ? 'Giriş Yap' : 'Hesap Oluştur';
  document.getElementById('forgotRow').style.display = isLogin ? 'flex' : 'none';
  document.getElementById('footerNote').innerHTML = isLogin
    ? 'Hesabın yok mu? <a href="#" onclick="switchTab(\'register\',null);return false">Kayıt ol</a>'
    : 'Zaten hesabın var mı? <a href="#" onclick="switchTab(\'login\',null);return false">Giriş yap</a>';
}

/* ── Form submit (login / register) ── */
const submitBtn = document.getElementById('submitBtn');
const emailInput = document.querySelector('input[type="email"]');
const passwordInput = document.querySelector('input[type="password"]');
const nameInput = document.querySelector('#nameField input');
const birthInput = document.querySelector('#birthField input');

submitBtn.addEventListener('click', async (e) => {
  e.preventDefault();

  const isLogin = document.querySelector('.tab.active').textContent.trim() === 'Giriş Yap';
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    alert('Lütfen e-posta ve şifreni gir.');
    return;
  }

  let endpoint = '/api/login';
  let body = { email, password };

  if (!isLogin) {
    const name = nameInput.value.trim();
    const birthDate = birthInput.value;
    if (!name || !birthDate) {
      alert('Lütfen ad soyad ve doğum tarihini gir.');
      return;
    }
    endpoint = '/api/register';
    body = { name, email, password, birthDate };
  }

  submitBtn.disabled = true;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      alert(data.error || 'Bir şeyler ters gitti.');
      return;
    }
    window.location.href = 'home.html';
  } catch (err) {
    alert('Sunucuya bağlanılamadı. Sunucunun (node server.js) çalıştığından emin ol.');
  } finally {
    submitBtn.disabled = false;
  }
});
