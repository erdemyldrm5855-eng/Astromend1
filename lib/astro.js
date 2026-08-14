// ── Astromend astroloji hesaplama modülü ──
// Not: Gerçek bir ephemeris (Swiss Ephemeris vb.) kullanmıyoruz. Güneş/Ay konumları
// için düşük hassasiyetli ama gerçek astronomik formüller (Meeus, "Astronomical
// Algorithms") kullanılıyor — burç seviyesinde doğru, derece bazında yaklaşık.
// Yükselen burç ise doğum saati + coğrafi konum gerektiren tam hesap yerine,
// basitleştirilmiş bir "her ~2 saatte bir burç değişir" kuralıyla tahmin ediliyor.

const SIGNS = [
  { name: 'Koç',     symbol: '♈', element: 'Ateş' },
  { name: 'Boğa',    symbol: '♉', element: 'Toprak' },
  { name: 'İkizler', symbol: '♊', element: 'Hava' },
  { name: 'Yengeç',  symbol: '♋', element: 'Su' },
  { name: 'Aslan',   symbol: '♌', element: 'Ateş' },
  { name: 'Başak',   symbol: '♍', element: 'Toprak' },
  { name: 'Terazi',  symbol: '♎', element: 'Hava' },
  { name: 'Akrep',   symbol: '♏', element: 'Su' },
  { name: 'Yay',     symbol: '♐', element: 'Ateş' },
  { name: 'Oğlak',   symbol: '♑', element: 'Toprak' },
  { name: 'Kova',    symbol: '♒', element: 'Hava' },
  { name: 'Balık',   symbol: '♓', element: 'Su' }
];

function normDeg(d) {
  d = d % 360;
  return d < 0 ? d + 360 : d;
}

function toJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function sunEclipticLongitude(date) {
  const JD = toJulianDay(date);
  const T = (JD - 2451545.0) / 36525;
  const L0 = normDeg(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = normDeg(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = M * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
          + 0.000289 * Math.sin(3 * Mrad);
  return normDeg(L0 + C);
}

function moonEclipticLongitude(date) {
  const JD = toJulianDay(date);
  const T = (JD - 2451545.0) / 36525;
  const Lp = normDeg(218.3164477 + 481267.88123421 * T);
  const D  = normDeg(297.8501921 + 445267.1114034 * T);
  const M  = normDeg(357.5291092 + 35999.0502909 * T);
  const Mp = normDeg(134.9633964 + 477198.8675055 * T);
  const F  = normDeg(93.2720950 + 483202.0175233 * T);

  const rad = Math.PI / 180;
  let dL = 0;
  dL += 6.288774 * Math.sin(Mp * rad);
  dL += 1.274027 * Math.sin((2 * D - Mp) * rad);
  dL += 0.658314 * Math.sin(2 * D * rad);
  dL += 0.213618 * Math.sin(2 * Mp * rad);
  dL -= 0.185116 * Math.sin(M * rad);
  dL -= 0.114332 * Math.sin(2 * F * rad);
  dL += 0.058793 * Math.sin((2 * D - 2 * Mp) * rad);
  dL += 0.057066 * Math.sin((2 * D - M - Mp) * rad);
  dL += 0.053322 * Math.sin((2 * D + Mp) * rad);
  dL += 0.045758 * Math.sin((2 * D - M) * rad);

  return normDeg(Lp + dL);
}

// ── Gezegenler (basitleştirilmiş Kepler yörüngesiyle yaklaşık konumlar) ──
// J2000.0 epoğu ortalama yörünge elemanları ve yüzyıllık değişim oranları
// (NASA JPL "Keplerian Elements for Approximate Positions of the Major Planets" tablosuna dayanır — yaklaşık).
const PLANET_ELEMENTS = {
  'Merkür': {
    symbol: '☿',
    a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749],
    L: [252.25032350, 149472.67411175], peri: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081],
    meaning: 'iletişim, zihin ve günlük detaylar'
  },
  'Venüs': {
    symbol: '♀',
    a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890],
    L: [181.97909950, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418],
    meaning: 'aşk, güzellik ve değerler'
  },
  'Mars': {
    symbol: '♂',
    a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343],
    meaning: 'enerji, aksiyon ve tutku'
  },
  'Jüpiter': {
    symbol: '♃',
    a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775], peri: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106],
    meaning: 'büyüme, şans ve genişleme'
  },
  'Satürn': {
    symbol: '♄',
    a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201], peri: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794],
    meaning: 'disiplin, sorumluluk ve sınırlar'
  },
  'Uranüs': {
    symbol: '⛢',
    a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939],
    L: [313.23810451, 428.48202785], peri: [170.95427630, 0.40805281], node: [74.01692503, 0.04240589],
    meaning: 'değişim, özgünlük ve sürpriz'
  },
  'Neptün': {
    symbol: '♆',
    a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372],
    L: [-55.12002969, 218.45945325], peri: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664],
    meaning: 'hayal gücü, sezgi ve sis'
  }
};

const EARTH_ELEMENTS = {
  a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
  L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0.0, 0.0]
};

function centuriesSinceJ2000(date) {
  return (toJulianDay(date) - 2451545.0) / 36525;
}

function solveKepler(Mdeg, e) {
  const M = normDeg(Mdeg) * Math.PI / 180;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E; // radyan
}

function heliocentricPosition(elements, T) {
  const a = elements.a[0] + elements.a[1] * T;
  const e = elements.e[0] + elements.e[1] * T;
  const I = (elements.I[0] + elements.I[1] * T) * Math.PI / 180;
  const L = elements.L[0] + elements.L[1] * T;
  const peri = elements.peri[0] + elements.peri[1] * T;
  const node = elements.node[0] + elements.node[1] * T;
  const w = (peri - node) * Math.PI / 180; // günberi argümanı
  const Om = node * Math.PI / 180;
  const M = L - peri;

  const E = solveKepler(M, e);
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cosOm = Math.cos(Om), sinOm = Math.sin(Om);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  const x = (cosW * cosOm - sinW * sinOm * cosI) * xOrb + (-sinW * cosOm - cosW * sinOm * cosI) * yOrb;
  const y = (cosW * sinOm + sinW * cosOm * cosI) * xOrb + (-sinW * sinOm + cosW * cosOm * cosI) * yOrb;

  return { x, y };
}

function geocentricLongitude(planetElements, date) {
  const T = centuriesSinceJ2000(date);
  const p = heliocentricPosition(planetElements, T);
  const earth = heliocentricPosition(EARTH_ELEMENTS, T);
  return normDeg(Math.atan2(p.y - earth.y, p.x - earth.x) * 180 / Math.PI);
}

function isRetrograde(planetElements, date) {
  const today = geocentricLongitude(planetElements, date);
  const yesterday = geocentricLongitude(planetElements, new Date(date.getTime() - 86400000));
  let diff = today - yesterday;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

function getPlanetPositions(date = new Date()) {
  return Object.entries(PLANET_ELEMENTS).map(([name, elements]) => {
    const sign = longitudeToSign(geocentricLongitude(elements, date));
    return {
      name,
      symbol: elements.symbol,
      sign,
      meaning: elements.meaning,
      retrograde: isRetrograde(elements, date)
    };
  });
}

function longitudeToSign(long) {
  const l = normDeg(long);
  const idx = Math.floor(l / 30);
  const degInSign = l - idx * 30;
  return {
    ...SIGNS[idx],
    index: idx,
    degree: Math.floor(degInSign),
    minute: Math.floor((degInSign % 1) * 60)
  };
}

function parseBirthDateTime(birthDate, birthTime) {
  if (!birthDate) return null;
  const time = birthTime && /^\d{2}:\d{2}$/.test(birthTime) ? birthTime : '12:00';
  const d = new Date(`${birthDate}T${time}:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

function approximateAscendant(sunSignIndex, birthTime) {
  if (!birthTime || !/^\d{2}:\d{2}$/.test(birthTime)) return null;
  const [hh, mm] = birthTime.split(':').map(Number);
  // Basitleştirilmiş kural: yükselen burç ortalama ~2 saatte bir değişir,
  // gün doğumunda (~06:00 varsayımı) Güneş burcuna yakın kabul edilir.
  const hoursFromSunrise = ((hh + mm / 60) - 6 + 24) % 24;
  const signsElapsed = Math.floor(hoursFromSunrise / 2) % 12;
  const idx = (sunSignIndex + signsElapsed) % 12;
  return { ...SIGNS[idx], index: idx };
}

function getZodiacSignFromDate(birthDate) {
  const d = parseBirthDateTime(birthDate, null);
  return d ? longitudeToSign(sunEclipticLongitude(d)) : null;
}

function getNatalChart(birthDate, birthTime) {
  const d = parseBirthDateTime(birthDate, birthTime);
  if (!d) return null;
  const sun = longitudeToSign(sunEclipticLongitude(d));
  const moon = longitudeToSign(moonEclipticLongitude(d));
  const ascendant = approximateAscendant(sun.index, birthTime);
  return { sun, moon, ascendant, approximate: true };
}

function getTransit(now = new Date()) {
  return {
    sun: longitudeToSign(sunEclipticLongitude(now)),
    moon: longitudeToSign(moonEclipticLongitude(now))
  };
}

// ── Ay evresi (Güneş-Ay açısına göre) ──
const MOON_PHASES = [
  { name: 'Yeni Ay', emoji: '🌑', max: 22.5 },
  { name: 'Büyüyen Hilal', emoji: '🌒', max: 67.5 },
  { name: 'İlk Dördün', emoji: '🌓', max: 112.5 },
  { name: 'Büyüyen Ay', emoji: '🌔', max: 157.5 },
  { name: 'Dolunay', emoji: '🌕', max: 202.5 },
  { name: 'Küçülen Ay', emoji: '🌖', max: 247.5 },
  { name: 'Son Dördün', emoji: '🌗', max: 292.5 },
  { name: 'Küçülen Hilal', emoji: '🌘', max: 337.5 },
  { name: 'Yeni Ay', emoji: '🌑', max: 360.01 }
];

function getMoonPhase(date = new Date()) {
  const angle = normDeg(moonEclipticLongitude(date) - sunEclipticLongitude(date));
  const phase = MOON_PHASES.find(p => angle < p.max);
  return { name: phase.name, emoji: phase.emoji, angle: Math.round(angle) };
}

// ── Günün anketi: o günkü Ay burcu/evresine göre otomatik oluşur ──
const POLL_TEMPLATES = [
  // index 0 = Pazar ... 6 = Cumartesi (Date.getDay() ile eşleşir)
  { q: (m, p) => `Bugün Ay ${m} burcunda — hafta sonu enerjini nasıl hissediyorsun?`, opts: ['Enerjik ve sosyal', 'Sakin ve içe dönük'] },
  { q: (m, p) => `Ay ${m} burcundayken haftaya nasıl başladın?`, opts: ['Motive hissediyorum', 'Yorgun hissediyorum'] },
  { q: (m, p) => `${p} evresindeyiz — bugün kararlarını nasıl alıyorsun?`, opts: ['Sezgilerimle', 'Mantığımla'] },
  { q: (m, p) => `Ay ${m} burcunda — bugün iletişimin nasıl?`, opts: ['Rahat ve akıcı', 'Zorlanıyorum'] },
  { q: (m, p) => `${p} evresi — bugün içindeki enerji nasıl?`, opts: ['Yükseliyor', 'Düşüyor'] },
  { q: (m, p) => `Ay ${m} burcundayken hafta sonu planların nasıl şekilleniyor?`, opts: ['Sosyal planlarım var', 'Dinlenmek istiyorum'] },
  { q: (m, p) => `${p} evresi seni nasıl etkiliyor?`, opts: ['Daha duygusalım', 'Değişiklik hissetmiyorum'] }
];

function getDailyPollContent(date = new Date()) {
  const transit = getTransit(date);
  const phase = getMoonPhase(date);
  const template = POLL_TEMPLATES[date.getDay()];
  const question = template.q(transit.moon.name, `${phase.emoji} ${phase.name}`);
  const options = template.opts.map((label, i) => ({ key: String.fromCharCode(97 + i), label }));
  return { question, options, moonSign: transit.moon, moonPhase: phase };
}

// ── Son N günün transit geçmişi (en yeni gün ilk sırada) ──
function getTransitHistory(days = 7, from = new Date()) {
  const list = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() - i);
    d.setHours(12, 0, 0, 0); // öğle vakti referans alınır
    list.push({
      date: d.toISOString().slice(0, 10),
      sun: longitudeToSign(sunEclipticLongitude(d)),
      moon: longitudeToSign(moonEclipticLongitude(d)),
      moonPhase: getMoonPhase(d)
    });
  }
  return list;
}

const ELEMENT_COMPAT = {
  'Ateş-Ateş': 82, 'Ateş-Hava': 78, 'Ateş-Toprak': 45, 'Ateş-Su': 40,
  'Hava-Hava': 80, 'Hava-Toprak': 42, 'Hava-Su': 48,
  'Toprak-Toprak': 84, 'Toprak-Su': 76,
  'Su-Su': 80
};

function elementCompatScore(el1, el2) {
  return ELEMENT_COMPAT[`${el1}-${el2}`] ?? ELEMENT_COMPAT[`${el2}-${el1}`] ?? 55;
}

const COMPAT_TEXT = {
  high: 'Doğal bir uyum var — enerjileriniz birbirini kolayca tamamlıyor.',
  mid:  'Farklılıklarınız iyi yönetilirse birbirinizi güçlü şekilde tamamlayabilirsiniz.',
  low:  'Zorlayıcı ama öğretici bir eşleşme — sabır ve iletişim şart.'
};

function synastry(sign1Name, sign2Name) {
  const s1 = SIGNS.find(s => s.name === sign1Name);
  const s2 = SIGNS.find(s => s.name === sign2Name);
  if (!s1 || !s2) return null;
  const score = elementCompatScore(s1.element, s2.element);
  const text = score >= 75 ? COMPAT_TEXT.high : score >= 55 ? COMPAT_TEXT.mid : COMPAT_TEXT.low;
  return { sign1: s1, sign2: s2, score, text };
}

// ── Bir günün Ay burcuna göre "o gün nasıldı" anlatısı ──
const DAY_MOOD_BY_SIGN = {
  'Koç':     'enerjik ve girişkendi',
  'Boğa':    'sakin ve kararlıydı',
  'İkizler': 'hareketli ve meraklıydı',
  'Yengeç':  'duygusal ve içe dönüktü',
  'Aslan':   'özgüvenli ve canlıydı',
  'Başak':   'düzenli ve dikkatliydi',
  'Terazi':  'dengeli ve sosyaldi',
  'Akrep':   'yoğun ve derindi',
  'Yay':     'özgür ve maceracıydı',
  'Oğlak':   'ciddi ve üretkendi',
  'Kova':    'özgün ve bağımsızdı',
  'Balık':   'hayalperest ve sezgiseldi'
};

function describeDayMood(moonSignName, natalSignName) {
  const mood = DAY_MOOD_BY_SIGN[moonSignName] || 'değişkendi';

  if (!natalSignName) {
    return `Bu gün genel hava ${mood}.`;
  }

  const s1 = SIGNS.find(s => s.name === natalSignName);
  const s2 = SIGNS.find(s => s.name === moonSignName);
  let tail = '';
  if (s1 && s2) {
    const score = elementCompatScore(s1.element, s2.element);
    if (score >= 75) tail = `Ay senin ${natalSignName} burcunla aynı frekanstaydı, muhtemelen kendini rahat hissettin.`;
    else if (score >= 55) tail = `Ay senin ${natalSignName} burcunla orta düzeyde uyumluydu.`;
    else tail = `Ay senin ${natalSignName} burcuna biraz ters düştü, bu da seni zorlamış olabilir.`;
  }
  return `${natalSignName} burcu olarak, bu gün senin için ${mood}. ${tail}`;
}

function daysUntilNextBirthday(birthDate) {
  const parts = birthDate.split('-').map(Number);
  const month = parts[1], day = parts[2];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day);
  const days = Math.round((next - today) / 86400000);
  return { date: next.toISOString().slice(0, 10), days };
}

const SIGN_INTERPRETATIONS = {
  'Koç':     { sun: 'Cesur, girişken ve hızlı karar alan bir yapın var.', moon: 'Duygularını doğrudan ve hızlıca ifade edersin.', asc: 'İlk izlenimin enerjik ve öncü.' },
  'Boğa':    { sun: 'Kararlı, sabırlı ve konfora değer veren bir yapın var.', moon: 'Duygusal güvenlik senin için çok önemli.', asc: 'İlk izlenimin sakin ve güven verici.' },
  'İkizler': { sun: 'Meraklı, esnek ve iletişimi güçlü bir yapın var.', moon: 'Duygularını konuşarak işlersin.', asc: 'İlk izlenimin zeki ve hareketli.' },
  'Yengeç':  { sun: 'Koruyucu, duygusal ve sadık bir yapın var.', moon: 'Ev ve aile senin duygusal çıpandır.', asc: 'İlk izlenimin sıcak ve şefkatli.' },
  'Aslan':   { sun: 'Karizmatik, cömert ve yaratıcı bir yapın var.', moon: 'Takdir edilmek duygusal ihtiyaçlarından biri.', asc: 'İlk izlenimin gösterişli ve sıcak.' },
  'Başak':   { sun: 'Analitik, titiz ve yardımsever bir yapın var.', moon: 'Düzen sana duygusal huzur verir.', asc: 'İlk izlenimin ölçülü ve dikkatli.' },
  'Terazi':  { sun: 'Uyum arayan, estetik ve adil bir yapın var.', moon: 'Duygusal dengeyi ilişkilerinde ararsın.', asc: 'İlk izlenimin zarif ve sosyal.' },
  'Akrep':   { sun: 'Yoğun, tutkulu ve dönüştürücü bir yapın var.', moon: 'Duygularını derinden ve gizli yaşarsın.', asc: 'İlk izlenimin gizemli ve güçlü.' },
  'Yay':     { sun: 'Maceracı, iyimser ve özgür ruhlu bir yapın var.', moon: 'Duygusal özgürlük senin için şart.', asc: 'İlk izlenimin neşeli ve açık sözlü.' },
  'Oğlak':   { sun: 'Disiplinli, hırslı ve sorumluluk sahibi bir yapın var.', moon: 'Duygularını kontrollü şekilde gösterirsin.', asc: 'İlk izlenimin ciddi ve güvenilir.' },
  'Kova':    { sun: 'Özgün, bağımsız ve yenilikçi bir yapın var.', moon: 'Duygusal olarak bağımsızlığa ihtiyaç duyarsın.', asc: 'İlk izlenimin farklı ve alışılmadık.' },
  'Balık':   { sun: 'Hayalperest, empatik ve sezgisel bir yapın var.', moon: 'Duygularını derin bir sezgiyle yaşarsın.', asc: 'İlk izlenimin yumuşak ve gizemli.' }
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TOPIC_WORDS = {
  greeting: ['merhaba', 'selam', 'naber', 'nasılsın', 'iyi misin', 'hey', 'gunaydin', 'günaydın'],
  thanks: ['teşekkür', 'tesekkur', 'sağol', 'sağ ol', 'sagol', 'eyvallah'],
  identity: ['sen kimsin', 'nesin', 'kimsin', 'yapay zeka mısın', 'bot musun', 'gerçek misin'],
  future: ['gelecek', 'geleceğim', 'geleceğimde', 'ileride', 'yıllar sonra', 'ne olacağım', 'kaderim'],
  moodLow: ['üzgün', 'uzgun', 'kötü hissediyorum', 'kotu hissediyorum', 'moralim bozuk', 'mutsuz', 'yorgun', 'bitkin', 'stresli', 'kaygılı', 'kaygili', 'endişeli', 'endiseli', 'kırgın', 'kirgin'],
  moodHigh: ['mutlu', 'harika hissediyorum', 'çok iyiyim', 'cok iyiyim', 'keyfim yerinde', 'heyecanlıyım'],
  love: ['aşk', 'ask', 'ilişki', 'iliski', 'sevgili', 'evlilik', 'flört', 'flort', 'aşık', 'asik'],
  career: ['kariyer', 'iş ', 'işim', 'isim', 'para', 'maaş', 'maas', 'terfi', 'okul', 'sınav', 'sinav', 'başvuru', 'basvuru'],
  health: ['sağlık', 'saglik', 'hasta', 'enerji', 'uyku', 'uyuyamıyorum'],
  family: ['aile', 'arkadaş', 'arkadas', 'dostluk', 'annem', 'babam', 'kardeş', 'kardes'],
  motivation: ['motivasyon', 'ilham', 'hedef', 'başaramıyorum', 'basaramiyorum', 'yapamıyorum', 'yapamiyorum', 'pes', 'vazgeç', 'vazgec'],
  today: ['bugün', 'bugun'],
  signQ: ['burcum', 'burç ', 'burcuma göre', 'burcuma gore']
};

function matchTopic(msg) {
  for (const [topic, words] of Object.entries(TOPIC_WORDS)) {
    if (words.some(w => msg.includes(w))) return topic;
  }
  return null;
}

function answerAssistant(message, signName, userName) {
  const msg = (message || '').toLowerCase().trim();
  const interp = signName ? SIGN_INTERPRETATIONS[signName] : null;
  const name = userName ? userName.trim().split(' ')[0] : null;
  const addr = name ? `${name}, ` : '';

  if (!msg) {
    return pick([
      'Bir şeyler sormayı dener misin? Örneğin: "geleceğim hakkında ne düşünüyorsun", "aşk hayatım nasıl gidecek", "bugün nasıl geçer".',
      'Seni dinliyorum ✦ Aklından ne geçiyor?'
    ]);
  }

  const topic = matchTopic(msg);

  if (topic === 'greeting') {
    return pick([
      `${addr}merhaba! Bugün nasıl hissediyorsun? ✦`,
      `Selam${name ? ' ' + name : ''} 🌙 İçinden geçen bir şey var mı, konuşalım.`
    ]);
  }
  if (topic === 'thanks') {
    return pick(['Rica ederim, her zaman buradayım ✦', 'Ne demek, seninle konuşmak güzel 🌙']);
  }
  if (topic === 'identity') {
    return 'Astromend\'in astroloji asistanıyım — şu an kural tabanlı, basit bir sistemim, gerçek zamanlı bir yapay zeka modeli değilim. Ama burcunla ilgili elimden geleni yapıyorum ✦';
  }

  if (!signName) {
    return 'Sana daha derin ve kişisel cevaplar verebilmem için önce Profilim sayfasından doğum tarihini eklemen gerekiyor. Yine de seni dinliyorum, ne düşünüyorsun?';
  }

  if (topic === 'future') {
    return pick([
      `${addr}geleceğin şu an attığın küçük adımlarla şekilleniyor. ${signName} burcu olarak ${interp.sun.toLowerCase()} Bu yönün, önündeki yolu senin lehine çevirecek güçte — kaygılanmak yerine bugüne odaklanırsan gelecek kendiliğinden netleşir.`,
      `Gelecek hakkında kesin bir şey söyleyemem ama şunu biliyorum: ${signName} burcu olarak ${interp.moon.toLowerCase()} Bu içgörünü kullanırsan önündeki belirsizlik daha az korkutucu gelir. Asıl hangi alanda (kariyer, aşk, kendini geliştirme) merak ediyorsun?`,
      `${signName} burcunun sana verdiği en büyük güç, ${interp.sun.toLowerCase().replace(/\.$/, '')} olman. Buna güvenirsen önündeki yıllar da bu doğrultuda şekillenir. Sen geleceğinde ne olmasını istiyorsun?`
    ]);
  }
  if (topic === 'moodLow') {
    return pick([
      `Bunu duyduğuma üzüldüm${name ? ', ' + name : ''}. ${signName} burcu olarak ${interp.moon.toLowerCase()} Kendine biraz alan ve nezaket göstermen bugün en çok ihtiyacın olan şey olabilir. Yalnız değilsin ✦`,
      `Zor hissettiğini anlıyorum. Böyle anlarda ${signName} burcunun sana verdiği en güçlü şey ${interp.sun.toLowerCase()} Bunu hatırlaman bile biraz rahatlatabilir. İstersen ne olduğunu anlat, dinliyorum.`
    ]);
  }
  if (topic === 'moodHigh') {
    return pick([
      `Bunu duymak çok güzel! ✦ ${signName} burcu olarak bu enerjini etrafına da yaymalısın — ${interp.sun.toLowerCase()}`,
      `Harika! Bu güzel enerjiyi değerlendirmek için doğru an — ${signName} burcu olarak ${interp.moon.toLowerCase()}`
    ]);
  }
  if (topic === 'love') {
    return pick([
      `${signName} burcu olarak ${interp.moon.toLowerCase()} Aşkta bu yönünü açıkça göstermekten çekinme, karşındaki de hissedecektir.`,
      `İlişkilerinde ${signName} burcunun etkisiyle ${interp.moon.toLowerCase()} Bugün kalbini biraz daha açık tutman, seni şaşırtacak bir bağlantıya kapı aralayabilir.`
    ]);
  }
  if (topic === 'career') {
    return pick([
      `${signName} burcu, ${interp.sun.toLowerCase()} Bu özelliğin iş/kariyer hayatında bugün en büyük avantajın olabilir.`,
      `Kariyerinde ilerlemek için ${signName} burcunun sana verdiği ${interp.sun.toLowerCase().replace(/\.$/, '')} yönünü kullan — küçük bir adım bile büyük bir kapı açabilir.`
    ]);
  }
  if (topic === 'health') {
    return `Bedenini dinlemek her zaman iyi bir fikir. ${signName} burcu olarak ${interp.moon.toLowerCase()} Kendine biraz zaman ayır, dinlenmek de ilerlemenin bir parçası.`;
  }
  if (topic === 'family') {
    return `${signName} burcu olarak ${interp.moon.toLowerCase()} Yakınlarınla kurduğun bağ düşündüğünden daha değerli — bugün küçük bir mesaj bile fark yaratabilir.`;
  }
  if (topic === 'motivation') {
    return pick([
      `Zor gelen anlar geçicidir. ${signName} burcu olarak ${interp.sun.toLowerCase()} Bu senin doğal gücün — pes etmeden önce bir adım daha atmayı dene.`,
      `Herkesin böyle anları olur. ${signName} burcunun sana verdiği ${interp.sun.toLowerCase().replace(/\.$/, '')} yönünü hatırla, bu seni bir önceki adımdan daha güçlü kılıyor.`
    ]);
  }
  if (topic === 'today') {
    return `Bugün ${signName} burcu için: ${interp.sun} ${interp.moon}`;
  }
  if (topic === 'signQ') {
    return `Güneş burcun ${signName}. ${interp.sun} ${interp.moon} ${interp.asc}`;
  }

  return pick([
    `${signName} burcu olarak sezgilerine güvenmen bugün sana yol gösterecek. İstersen "aşk", "kariyer", "gelecek" ya da aklından geçen başka bir şey hakkında konuşabiliriz.`,
    `Tam olarak neyi kastettiğini çözemedim ama seni dinliyorum ✦ ${signName} burcu olarak ${interp.sun.toLowerCase()} Biraz daha açar mısın?`
  ]);
}

module.exports = {
  SIGNS,
  getZodiacSignFromDate,
  getNatalChart,
  getTransit,
  synastry,
  daysUntilNextBirthday,
  SIGN_INTERPRETATIONS,
  answerAssistant,
  getMoonPhase,
  getDailyPollContent,
  getTransitHistory,
  describeDayMood,
  getPlanetPositions
};
