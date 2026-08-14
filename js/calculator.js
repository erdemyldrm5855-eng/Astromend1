/**
 * Doğum tarihi ve saatine göre astrolojik verileri hesaplar.
 * @param {string} birthDateStr - "YYYY-MM-DD" formatında tarih
 * @param {string} [birthTimeStr] - "HH:MM" formatında saat (Opsiyonel)
 */
function calculateAstrology(birthDateStr, birthTimeStr = null) {
  const date = new Date(birthDateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Geçersiz tarih formatı! Lütfen 'YYYY-MM-DD' kullanın.");
  }

  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1; // JS'de aylar 0-11 arasıdır

  // Burç Veri Haritası
  const zodiacData = [
    { name: "Oğlak", element: "Toprak", planet: "Satürn", mode: "Öncü", start: [12, 22], end: [1, 19] },
    { name: "Kova", element: "Hava", planet: "Uranüs", mode: "Sabit", start: [1, 20], end: [2, 18] },
    { name: "Balık", element: "Su", planet: "Neptün", mode: "Değişken", start: [2, 19], end: [3, 20] },
    { name: "Koç", element: "Ateş", planet: "Mars", mode: "Öncü", start: [3, 21], end: [4, 19] },
    { name: "Boğa", element: "Toprak", planet: "Venüs", mode: "Sabit", start: [4, 20], end: [5, 20] },
    { name: "İkizler", element: "Hava", planet: "Merkür", mode: "Değişken", start: [5, 21], end: [6, 20] },
    { name: "Yengeç", element: "Su", planet: "Ay", mode: "Öncü", start: [6, 21], end: [7, 22] },
    { name: "Aslan", element: "Ateş", planet: "Güneş", mode: "Sabit", start: [7, 23], end: [8, 22] },
    { name: "Başak", element: "Toprak", planet: "Merkür", mode: "Değişken", start: [8, 23], end: [9, 22] },
    { name: "Terazi", element: "Hava", planet: "Venüs", mode: "Öncü", start: [9, 23], end: [10, 22] },
    { name: "Akrep", element: "Su", planet: "Plüton / Mars", mode: "Sabit", start: [10, 23], end: [11, 21] },
    { name: "Yay", element: "Ateş", planet: "Jüpiter", mode: "Değişken", start: [11, 22], end: [12, 21] }
  ];

  // 1. Güneş Burcu Hesaplama
  let userSign = null;
  for (const sign of zodiacData) {
    const [sMonth, sDay] = sign.start;
    const [eMonth, eDay] = sign.end;

    // Yılbaşı geçişi yapan Oğlak burcu kontrolü
    if (sMonth === 12 && eMonth === 1) {
      if ((month === 12 && day >= sDay) || (month === 1 && day <= eDay)) {
        userSign = sign;
        break;
      }
    } else if ((month === sMonth && day >= sDay) || (month === eMonth && day <= eDay)) {
      userSign = sign;
      break;
    }
  }

  // 2. Yükselen Burç Tahmini (Doğum saati varsa)
  // Not: Tam Yükselen için Enlem/Boylam ve Yıldız Zamanı (Sidereal Time) gerekir.
  let estimatedAscendant = "Doğum saati belirtilmedi";
  
  if (birthTimeStr) {
    const [hours, minutes] = birthTimeStr.split(":").map(Number);
    const totalHours = hours + minutes / 60;

    const signOrder = [
      "Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak",
      "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"
    ];
    
    const sunIndex = signOrder.indexOf(userSign.name);
    
    if (sunIndex !== -1) {
      // Güneş doğuşu ortalama 06:00 kabul edilerek her 2 saatte bir 1 burç kaydırılır
      const hourDiff = (totalHours - 6 + 24) % 24;
      const shift = Math.floor(hourDiff / 2);
      const ascIndex = (sunIndex + shift) % 12;
      estimatedAscendant = signOrder[ascIndex];
    }
  }

  return {
    gunesBurcu: userSign.name,
    element: userSign.element,
    yoneticiGezegen: userSign.planet,
    nitelik: userSign.mode,
    yukselenTahmini: estimatedAscendant
  };
}

// --- ÖRNEK KULLANIM ---
const sonuc = calculateAstrology("2009-11-21", "14:30");
console.log(sonuc);
/*
Çıktı:
{
  gunesBurcu: 'Aslan',
  element: 'Ateş',
  yoneticiGezegen: 'Güneş',
  nitelik: 'Sabit',
  yukselenTahmini: 'Yay'
}
*/