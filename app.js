const SUPA_URL = "https://offhwpihpkhqxonztdri.supabase.co";
const SUPA_KEY = "sb_publishable_AGoKBdL0VAvTWCNRrLEWIg_Ax5xGBTx";
const sb = window.supabase ? window.supabase.createClient(SUPA_URL, SUPA_KEY) : null;

const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (tg) { try { tg.ready(); tg.expand(); } catch(e){} }

function vib(t = 'light') {
  try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(t); } catch(e){}
}

// Определяем реального пользователя Telegram
const tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
const USER_ID = tgUser ? Number(tgUser.id) : Number(localStorage.getItem('pk_uid') || Math.floor(100000 + Math.random()*900000));
const USER_NAME = tgUser ? (tgUser.username ? '@'+tgUser.username : tgUser.first_name) : ('Игрок #' + USER_ID);
try { localStorage.setItem('pk_uid', USER_ID); } catch(e){}

let state = {
  id: USER_ID, name: USER_NAME,
  rub: 150000, stars: 50, tix: 40, lvl: 1, xp: 0, luck: 2,
  vip: false, clan: '', garage: [],
  country: 'RU', bet: 1, fast5: false, bonusDone: false, spins: 0
};

try {
  const saved = localStorage.getItem('pk_state_' + USER_ID);
  if (saved) state = { ...state, ...JSON.parse(saved) };
} catch(e){}

const COUNTRIES = {
  RU: { name: "Россия • Обычный", short: "🇷🇺 Россия", flag: "🇷🇺 RUS", regs: ["777","97","196","125","116","05"], mult: 1 },
  AE: { name: "ОАЭ • Дубай Люкс", short: "🇦🇪 Дубай", flag: "🇦🇪 UAE", regs: ["DXB","SHJ","ABU","7"], mult: 2.8 },
  JP: { name: "Япония • Токио JDM", short: "🇯🇵 Япония", flag: "🇯🇵 JPN", regs: ["99","01","88","TKY"], mult: 1.8 },
  US: { name: "США • Майами Аукцион", short: "🇺🇸 США", flag: "🇺🇸 USA", regs: ["MIA","CA","NY","TX"], mult: 2.2 },
  KZ: { name: "Казахстан • Спецсерия", short: "🇰🇿 Казахстан", flag: "🇰🇿 KZ", regs: ["01","02","07","13"], mult: 1.6 },
  DE: { name: "Германия • Автобан", short: "🇩🇪 Германия", flag: "🇩🇪 DE", regs: ["B","M","HH","F"], mult: 2.0 }
};

const CARS = [
  { name: "ВАЗ-2107 Боевая", emoji: "🚗", base: 50000 },
  { name: "Lada Priora Black", emoji: "🚘", base: 120000 },
  { name: "Toyota Mark II", emoji: "🚙", base: 260000 },
  { name: "BMW M5 E60", emoji: "🏎️", base: 720000 },
  { name: "Toyota Supra A80", emoji: "🏎️", base: 1500000 },
  { name: "Nissan GT-R R34", emoji: "🏁", base: 3100000 },
  { name: "Mercedes G63 AMG", emoji: "🚓", base: 6800000 },
  { name: "Porsche 911 GT3 RS", emoji: "🏎️", base: 12500000 },
  { name: "Rolls-Royce Cullinan", emoji: "💎", base: 25000000 },
  { name: "Bugatti Chiron", emoji: "🚀", base: 55000000 }
];

const CONDS = [
  { name: "После ДТП", mult: 0.6 },
  { name: "Рабочая лошадка", mult: 1.0 },
  { name: "Гаражная находка", mult: 1.6 },
  { name: "Музейный идеал", mult: 2.8 },
  { name: "Капсула времени", mult: 5.5 }
];

const LET = ["А","В","Е","К","М","Н","О","Р","С","Т","У","Х"];
let curDrop = null, vinFrozen = false, gloveUsed = false, garFilter = 'ALL', mktFilter = 'ALL', mktCache = [], sortAsc = false;

const fmt = n => Math.round(Number(n)||0).toLocaleString('ru-RU');

function toast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg; t.style.display = 'block';
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.style.display = 'none', 2200);
}

// Синхронизация с облаком Supabase
async function syncFromCloud() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('players').select('*').eq('id', USER_ID).maybeSingle();
    if (data) {
      state.rub = Number(data.rub); state.stars = Number(data.stars); state.tix = Number(data.tix);
      state.lvl = Number(data.lvl); state.xp = Number(data.xp); state.luck = Number(data.luck);
      state.vip = Boolean(data.vip); state.clan = data.clan || '';
      if (Array.isArray(data.garage)) state.garage = data.garage;
    } else if (!error) {
      await saveState();
    }
    document.getElementById('cloud-dot').classList.add('online');
    updateUI();
  } catch(e){}
}

let saveTimer = null;
async function saveState() {
  try { localStorage.setItem('pk_state_' + USER_ID, JSON.stringify(state)); } catch(e){}
  updateUI();
  if (!sb) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await sb.from('players').upsert({
        id: USER_ID, name: USER_NAME, rub: Math.round(state.rub), stars: state.stars,
        tix: state.tix, lvl: state.lvl, xp: state.xp, luck: state.luck,
        vip: state.vip, clan: state.clan, garage: state.garage, updated_at: new Date().toISOString()
      });
      document.getElementById('cloud-dot').classList.add('online');
    } catch(e){}
  }, 400);
}

function updateUI() {
  document.getElementById('ui-username').innerText = USER_NAME;
  document.getElementById('ui-rub').innerText = fmt(state.rub);
  document.getElementById('ui-stars').innerText = state.stars;
  document.getElementById('ui-tix').innerText = state.tix;
  document.getElementById('ui-lvl').innerText = state.lvl;
  document.getElementById('ui-luck').innerText = state.luck;
  const c = COUNTRIES[state.country] || COUNTRIES.RU;
  document.getElementById('ui-country-btn').innerText = `${c.short} • ×${c.mult}`;
  document.getElementById('ui-bet-btn').innerText = `Ставка ×${state.bet}`;
  const cnt = state.fast5 ? 5 : 1;
  document.getElementById('ui-spin-cost').innerText = state.bet * cnt;
  document.getElementById('ui-spin-txt').innerText = state.fast5 ? "Крутить пачкой ×5" : "Вскрыть контейнер";
  document.getElementById('btn-fast5').classList.toggle('on', state.fast5);
}

function genPlate(cKey) {
  const l1 = LET[Math.floor(Math.random()*12)], l2 = LET[Math.floor(Math.random()*12)], l3 = LET[Math.floor(Math.random()*12)];
  const boost = Math.min(0.45, 0.04 * state.luck);
  let d = String(100 + Math.floor(Math.random()*900)), lets = l1+l2+l3;
  if (Math.random() < boost) d = ["777","001","888","007","666","999"][Math.floor(Math.random()*6)];
  if (Math.random() < boost*0.8) lets = ["АМР","ЕКХ","ВОР","ХХХ","ООО"][Math.floor(Math.random()*5)];
  if (cKey === 'AE') {
    const dub = Math.random() < boost ? ["1","7","8","77"][Math.floor(Math.random()*4)] : d;
    return { code: `${l1}${l2} ${dub}`, d: dub, lets };
  }
  return { code: `${lets[0]} ${d} ${lets[1]}${lets[2]}`, d, lets };
}

function spinContainer() {
  vib('medium');
  const cnt = state.fast5 ? 5 : 1, cost = state.bet * cnt;
  if (state.tix < cost) { toast("❌ Не хватает отмычек 🎫!"); return openShopModal(); }
  if (vinFrozen) {
    if (state.stars < 10) { vinFrozen = false; document.getElementById('btn-freeze').classList.remove('on'); return toast("❌ Нужно 10 ⭐ для заморозки!"); }
    state.stars -= 10;
  }
  state.tix -= cost; state.spins += cnt; state.xp += 15 * cost;
  if (state.xp >= state.lvl * 100) { state.lvl++; state.tix += 10; toast(`🎉 Уровень ${state.lvl}! +10 отмычек`); }

  const cObj = COUNTRIES[state.country] || COUNTRIES.RU;
  let best = null;
  for (let i=0; i<cnt; i++) {
    const pwr = Math.max(0.25, 1.8 / Math.pow(state.luck, 0.35));
    const car = CARS[Math.min(CARS.length-1, Math.floor(Math.pow(Math.random(), pwr)*CARS.length))];
    const cond = CONDS[Math.floor(Math.random()*CONDS.length)];
    const pl = (vinFrozen && curDrop) ? curDrop.pl : genPlate(state.country);
    const reg = (vinFrozen && curDrop) ? curDrop.reg : cObj.regs[Math.floor(Math.random()*cObj.regs.length)];
    let m = cObj.mult * cond.mult;
    let r = [`🍀 Удача ×${state.luck} • ${cObj.short} <b>×${cObj.mult}</b>`, `${cond.name} <b>×${cond.mult}</b>`];
    if (["1","7","8","77"].includes(pl.d)) { m *= 10; r.push(`Королевский номер ОАЭ (${pl.d}) <b>×10</b>`); }
    else if (["777","001","888","007","666","999"].includes(pl.d)) { m *= 5; r.push(`Блатные цифры ${pl.d} <b>×5</b>`); }
    if (["АМР","ЕКХ","ВОР","ХХХ","ООО"].includes(pl.lets)) { m *= 4; r.push(`Спецсерия «${pl.lets}» <b>×4</b>`); }
    const prc = Math.round(car.base * m * state.bet * (state.vip ? 1.5 : 1));
    if (!best || prc > best.price) best = { car, cond, pl, reg, price: prc, reasons: r, country: state.country, flag: cObj.flag };
  }

  let rar = "Обычный", col = "#9ca3af", seg = 2;
  if (best.price >= 20000000) { rar = "Мифический"; col = "#ef4444"; seg = 9; vib('heavy'); }
  else if (best.price >= 4500000) { rar = "Легендарный"; col = "#f59e0b"; seg = 7; vib('heavy'); }
  else if (best.price >= 1000000) { rar = "Эпический"; col = "#a855f7"; seg = 5; }
  else if (best.price >= 220000) { rar = "Необычный"; col = "#22c55e"; seg = 3; }

  curDrop = { ...best, rarity: rar, color: col, seg };
  gloveUsed = false;
  document.getElementById('btn-glove').innerText = "🧤 Бардачок";
  renderDrop();
  saveState();
}

function renderDrop() {
  if (!curDrop) return;
  const rEl = document.getElementById('ui-rarity');
  rEl.innerText = curDrop.rarity; rEl.style.color = curDrop.color;
  let sh = '';
  for (let i=1; i<=9; i++) sh += `<div class="seg" style="${i<=curDrop.seg?'background:'+curDrop.color:''}"></div>`;
  document.getElementById('ui-segs').innerHTML = sh;
  const ps = fmt(curDrop.price) + " ₽";
  document.getElementById('ui-price').innerText = ps;
  document.getElementById('ui-sell-val').innerText = ps;
  const ic = document.getElementById('ui-emoji');
  ic.innerText = curDrop.car.emoji; ic.classList.remove('pop'); void ic.offsetWidth; ic.classList.add('pop');
  document.getElementById('ui-car-name').innerText = curDrop.car.name;
  document.getElementById('ui-car-cond').innerText = "Состояние: " + curDrop.cond.name;
  document.getElementById('ui-vin').innerText = curDrop.pl.code;
  document.getElementById('ui-reg').innerText = curDrop.reg;
  document.getElementById('ui-flag').innerText = curDrop.flag;
  document.getElementById('ui-reasons').innerHTML = curDrop.reasons.join('<br>');
}

function searchGlovebox() {
  vib('light');
  if (!curDrop || gloveUsed) return toast("🧤 Бардачок уже проверен!");
  gloveUsed = true; document.getElementById('btn-glove').innerText = "🧤 Проверено";
  const r = Math.random();
  if (r < 0.45) { const b = Math.round(curDrop.price*0.25); state.rub += b; toast(`💵 Заначка: +${fmt(b)} ₽!`); }
  else if (r < 0.8) { state.tix += 4; toast("🎫 Найдены ключи: +4 отмычки!"); }
  else { state.stars += 5; toast("⭐ Найдены часы: +5 Звёзд!"); }
  saveState();
}

function toggleFreeze() {
  vib('light'); vinFrozen = !vinFrozen;
  document.getElementById('btn-freeze').classList.toggle('on', vinFrozen);
  toast(vinFrozen ? "❄️ Номер заморожен (10 ⭐)" : "Заморозка снята");
}

function saveToGarage() {
  if (!curDrop) return; vib('light');
  state.garage.unshift({
    id: Date.now(), name: curDrop.car.name, emoji: curDrop.car.emoji,
    vin: curDrop.pl.code, reg: curDrop.reg, country: curDrop.country,
    price: curDrop.price, rarity: curDrop.rarity, color: curDrop.color
  });
  toast(`📥 ${curDrop.car.name} в Гараже!`);
  spinContainer();
}

function sellCurrent() {
  if (!curDrop) return; vib('light');
  state.rub += curDrop.price;
  toast(`💸 Продано за ${fmt(curDrop.price)} ₽`);
  spinContainer();
}

function toggleFast5() { vib('light'); state.fast5 = !state.fast5; saveState(); }

function openSheet(title, html) {
  document.getElementById('sheet-title').innerText = title;
  document.getElementById('sheet-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function openCountrySheet() {
  const html = Object.keys(COUNTRIES).map(k => `
    <div class="opt-row ${state.country===k?'selected':''}" onclick="state.country='${k}';saveState();closeModal()">
      <span>${COUNTRIES[k].name}</span><b class="green-sum">×${COUNTRIES[k].mult}</b>
    </div>`).join('');
  openSheet("Выбери порт и страну", html);
}

function openBetSheet() {
  const html = [1,2,5,10,25].map(b => `
    <div class="opt-row ${state.bet===b?'selected':''}" onclick="state.bet=${b};saveState();closeModal()">
      <span>Ставка ×${b}</span><b class="gold-sum">Цена ×${b}</b>
    </div>`).join('');
  openSheet("Выбери множитель ставки", html);
}

function navTo(p) {
  vib('light');
  document.querySelectorAll('.tab-page').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.querySelectorAll('.b-nav').forEach(x => x.classList.remove('active'));
  const nb = document.getElementById('nav-' + p); if (nb) nb.classList.add('active');
  if (p === 'garage') renderGarage();
  if (p === 'market') loadMarket();
}

function setGarageFilter(f, el) {
  garFilter = f;
  el.parentElement.querySelectorAll('.f-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); renderGarage();
}
function sortGarage() {
  sortAsc = !sortAsc;
  state.garage.sort((a,b) => sortAsc ? a.price - b.price : b.price - a.price);
  renderGarage();
}

function renderGarage() {
  const list = garFilter === 'ALL' ? state.garage : state.garage.filter(x => x.country === garFilter);
  document.getElementById('g-count').innerText = state.garage.length;
  document.getElementById('g-sum').innerText = fmt(state.garage.reduce((a,b)=>a+b.price,0)) + " ₽";
  const box = document.getElementById('garage-list');
  if (!list.length) { box.innerHTML = `<div class="car-sub">Гараж пуст. Сохраняй тачки на вкладке «Играть»!</div>`; return; }
  box.innerHTML = list.map(it => `
    <div class="item-row">
      <div>
        <div><b>${it.emoji} ${it.name}</b></div>
        <div class="mini-plate">${it.vin} | ${it.reg}</div>
        <div style="font-size:12px;font-weight:800;color:${it.color};margin-top:4px">${it.rarity} • ${fmt(it.price)} ₽</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px">
        <button class="act-btn" onclick="sellGarItem(${it.id})">Продать</button>
        <button class="act-btn dark-btn" onclick="listOnMarket(${it.id})">На рынок</button>
      </div>
    </div>`).join('');
}

function sellGarItem(id) {
  const idx = state.garage.findIndex(x => x.id === id); if (idx === -1) return;
  const it = state.garage.splice(idx, 1)[0]; state.rub += it.price;
  toast(`💸 +${fmt(it.price)} ₽`); saveState(); renderGarage();
}

function sellAllGarage() {
  if (!state.garage.length) return toast("Гараж пуст!");
  const s = state.garage.reduce((a,b)=>a+b.price,0); state.garage = []; state.rub += s;
  toast(`💸 Продано всё за ${fmt(s)} ₽!`); saveState(); renderGarage();
}

function craftFiveToOne() {
  if (state.garage.length < 5) return toast("❌ Нужно минимум 5 машин в гараже!");
  const five = state.garage.splice(0, 5);
  const s = five.reduce((a,b)=>a+b.price,0);
  state.garage.unshift({ ...five[0], id: Date.now(), name: "Эксклюзив " + five[0].name, price: Math.round(s*1.5), rarity: "Мифический", color: "#ef4444" });
  toast("🔥 Скрафчен эксклюзив!"); saveState(); renderGarage();
}

// Онлайн Рынок через таблицу market в Supabase
async function listOnMarket(id) {
  const idx = state.garage.findIndex(x => x.id === id); if (idx === -1) return;
  const it = state.garage.splice(idx, 1)[0];
  const lot = {
    seller_id: USER_ID, seller_name: USER_NAME, car_name: it.name, emoji: it.emoji,
    vin: it.vin, reg: it.reg, price: Math.round(it.price * 1.25), currency: '₽',
    rarity: it.rarity, color: it.color
  };
  if (sb) { try { await sb.from('market').insert([lot]); } catch(e){} }
  saveState(); toast("🏪 Выставлено на онлайн Рынок (+25%)!"); navTo('market');
}

async function loadMarket() {
  const box = document.getElementById('market-list');
  box.innerHTML = `<div class="car-sub">Загрузка лотов из облака...</div>`;
  if (sb) {
    try {
      const { data } = await sb.from('market').select('*').order('id', { ascending: false }).limit(30);
      if (data) mktCache = data;
    } catch(e){}
  }
  renderMarketList();
}

function filterMarket(f, el) {
  mktFilter = f;
  el.parentElement.querySelectorAll('.f-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active'); renderMarketList();
}

function renderMarketList() {
  const box = document.getElementById('market-list');
  let list = mktCache;
  if (mktFilter === 'STARS') list = list.filter(x => x.currency === '⭐');
  if (mktFilter === 'MY') list = list.filter(x => Number(x.seller_id) === USER_ID);
  if (!list.length) {
    box.innerHTML = `<div class="car-sub">Лотов пока нет. Выстави первую тачку из своего Гаража!</div>`;
    return;
  }
  box.innerHTML = list.map(l => `
    <div class="item-row">
      <div>
        <div class="mini-plate">${l.vin} | ${l.reg}</div>
        <div style="font-weight:900;margin-top:4px">${l.emoji} ${l.car_name}</div>
        <div style="font-size:11px;color:${l.color||'var(--gold)'}">${l.rarity||'Редкий'} • Продавец: ${l.seller_name}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:900;margin-bottom:5px">${fmt(l.price)} ${l.currency||'₽'}</div>
        <button class="act-btn" onclick="buyMarketLot(${l.id})">Купить</button>
      </div>
    </div>`).join('');
}

async function buyMarketLot(lotId) {
  const lot = mktCache.find(x => x.id === lotId); if (!lot) return;
  if (state.rub < lot.price) return toast("❌ Не хватает рублей на балансе!");
  state.rub -= Number(lot.price);
  state.garage.unshift({
    id: Date.now(), name: lot.car_name, emoji: lot.emoji, vin: lot.vin, reg: lot.reg,
    country: 'RU', price: Number(lot.price), rarity: lot.rarity, color: lot.color
  });
  if (sb) { try { await sb.from('market').delete().eq('id', lotId); } catch(e){} }
  mktCache = mktCache.filter(x => x.id !== lotId);
  saveState(); renderMarketList(); toast(`🎉 Куплено: ${lot.car_name}!`);
}

// Онлайн ТОП игроков из Supabase
async function openLeaderboard() {
  openSheet("🏆 ТОП-10 Перекупов Онлайн", `<div class="car-sub">Загрузка рейтинга...</div>`);
  if (!sb) return;
  try {
    const { data } = await sb.from('players').select('name,rub,lvl,vip').order('rub', { ascending: false }).limit(10);
    if (data && data.length) {
      document.getElementById('sheet-body').innerHTML = data.map((p, i) => `
        <div class="opt-row">
          <span>#${i+1} ${p.vip?'👑':''} ${p.name} (Ур.${p.lvl})</span>
          <b class="green-sum">${fmt(p.rub)} ₽</b>
        </div>`).join('');
    }
  } catch(e){}
}

// Магазин и мини-игры
function openShopModal() {
  openSheet("⭐ Магазин Синдиката", `
    <div class="opt-row" onclick="buyShop('vip',50)"><span>👑 VIP-статус (Цены ×1.5)</span><span class="act-btn">50 ⭐</span></div>
    <div class="opt-row" onclick="buyShop('luck',25)"><span>🍀 Удача +5 навсегда</span><span class="act-btn">25 ⭐</span></div>
    <div class="opt-row" onclick="buyShop('pack',45)"><span>📦 Набор (+100 🎫 и +5 Удачи)</span><span class="act-btn">45 ⭐</span></div>
    <div class="opt-row" onclick="buyShop('rub',30)"><span>💰 +5 000 000 ₽ на баланс</span><span class="act-btn">30 ⭐</span></div>
    <div class="opt-row selected" onclick="buyShop('free',0)"><span>💎 Тест разработчика (+200 ⭐)</span><span class="act-btn">0 ⭐</span></div>
  `);
}

function buyShop(t, cost) {
  vib('medium');
  if (t === 'free') { state.stars += 200; saveState(); return toast("💎 +200 Звёзд начислено!"); }
  if (state.stars < cost) return toast("❌ Мало Звёзд! Нажми нижнюю кнопку для теста");
  state.stars -= cost;
  if (t === 'vip') state.vip = true;
  if (t === 'luck') state.luck += 5;
  if (t === 'pack') { state.tix += 100; state.luck += 5; }
  if (t === 'rub') state.rub += 5000000;
  saveState(); closeModal(); toast("✅ Покупка успешна!");
}

function openUpgraderModal() {
  if (!state.garage.length) return toast("❌ Добавь хотя бы 1 машину в Гараж!");
  const c = state.garage[0];
  openSheet("🚗 Апгрейдер тачек", `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:44px">${c.emoji}</div><b>${c.name} (${c.vin})</b><br>
      <span class="green-sum">${fmt(c.price)} ₽</span>
      <div style="margin-top:8px"><label><input type="checkbox" id="ins-chk"> 🛡️ Страховка от сгорания (15 ⭐)<
