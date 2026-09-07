const API = "https://svhucbslincrjmmbzcep.supabase.co/functions/v1/miniapp-api/";

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
try { tg?.setHeaderColor?.("#0a0a1f"); tg?.setBackgroundColor?.("#0a0a1f"); } catch (_) {}

const initData = tg?.initData || "";

const ZODIAC_EMOJI = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍",
  Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

const state = { tab: "foryou", pool: { foryou: [], view: [] }, reacted: new Set(), me: null };

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 1800);
}

async function api(path, payload = {}) {
  // text/plain avoids a CORS preflight (some mobile networks block OPTIONS)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ initData, ...payload }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return { error: "bad_response" }; }
  } catch (err) {
    return { error: "network", message: String(err && err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function photoUrl(p) { return p.photo ? API + p.photo : null; }

function fieldsHtml(p) {
  const rows = [];
  const add = (k, v, emoji = "") => { if (v) rows.push('<div class="field"><span class="k">♡ ' + esc(k) + ' ➯</span> <b>' + emoji + esc(v) + '</b></div>'); };
  add("Name", p.name || "Unknown");
  add("Age", p.age);
  if (p.zodiac) add("Zodiac", p.zodiac, (ZODIAC_EMOJI[p.zodiac] || "") + " ");
  add("Height", p.height);
  add("Region", p.region);
  add("City", p.city);
  if (p.game) add("Game", p.game, "🎮 ");
  if (p.occupation) {
    const label = p.occupation_type === "job" ? "Job" : p.occupation_type === "university" ? "University" : "School";
    add(label, p.occupation);
  }
  add("Ethnic", p.ethnic);
  return rows.join("");
}

function cardHtml(p, idx) {
  const url = photoUrl(p);
  return '<section class="card" data-id="' + esc(p.id) + '">' +
    '<div class="card-inner">' +
      '<div class="photo-wrap">' +
        (url ? '<img loading="lazy" src="' + url + '" alt="' + esc(p.name || "Profile") + ' profile photo" />' : '<div class="noimg">♡</div>') +
        '<div class="photo-fade"></div>' +
      '</div>' +
      '<div class="info">' + (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : "") + fieldsHtml(p) + '</div>' +
      '<div class="reactions" data-key="' + esc(p.id) + '-' + idx + '">' +
        '<button class="rbtn" data-type="like">❤️ <em data-c="like">' + esc(p.counts_text.like) + '</em></button>' +
        '<button class="rbtn" data-type="haha">😂 <em data-c="haha">' + esc(p.counts_text.haha) + '</em></button>' +
        '<button class="rbtn" data-type="wow">😮 <em data-c="wow">' + esc(p.counts_text.wow) + '</em></button>' +
      '</div>' +
    '</div></section>';
}

function renderFeed(list, append = false) {
  const feed = document.getElementById("feed");
  const start = append ? feed.children.length : 0;
  const html = list.map((p, i) => cardHtml(p, start + i)).join("");
  if (append) feed.insertAdjacentHTML("beforeend", html);
  else feed.innerHTML = html;
}

async function loadFeed(mode) {
  const feed = document.getElementById("feed");
  const empty = document.getElementById("feed-empty");
  empty.classList.add("hidden");
  feed.innerHTML = '<div class="skeleton">ခဏစောင့်ပါ…</div>';
  const res = await api("feed", { mode });
  if (res.error === "network" || res.error === "bad_response") {
    feed.innerHTML = '<div class="skeleton">ကွန်ရက် အဆင်မပြေပါ။ <br/><br/><button class="save" id="retry">🔄 ပြန်ကြိုးစားမည်</button></div>';
    document.getElementById("retry").addEventListener("click", () => loadFeed(mode));
    return;
  }
  if (res.error === "unauthorized") {
    feed.innerHTML = '<div class="skeleton">Telegram Bot ထဲက Menu ကနေ ပြန်ဖွင့်ပေးပါ။</div>';
    return;
  }
  const list = res.profiles || [];
  state.pool[mode] = list;
  if (!list.length) {
    feed.innerHTML = "";
    empty.textContent = res.need_profile
      ? "Bot ထဲမှာ ကိုယ့် Profile အရင်ပြည့်စုံအောင်ဖြည့်ပေးပါ။"
      : "ပြသစရာ Profile မရှိသေးပါ။";
    empty.classList.remove("hidden");
    return;
  }
  renderFeed(list);
  feed.scrollTop = 0;
}

function onFeedScroll() {
  const feed = document.getElementById("feed");
  const list = state.pool[state.tab];
  if (!list || !list.length) return;
  if (feed.scrollTop + feed.clientHeight * 2.5 >= feed.scrollHeight) {
    const copy = [...list].sort(() => Math.random() - 0.5);
    renderFeed(copy, true);
    while (feed.children.length > list.length * 4) feed.removeChild(feed.firstElementChild);
  }
}

document.getElementById("feed").addEventListener("scroll", onFeedScroll, { passive: true });

document.getElementById("feed").addEventListener("click", async (e) => {
  const btn = e.target.closest(".rbtn");
  if (!btn) return;
  const wrap = btn.closest(".reactions");
  const card = btn.closest(".card");
  const id = card.dataset.id;
  const type = btn.dataset.type;
  const key = wrap.dataset.key + "-" + type;
  if (state.reacted.has(key)) return;
  state.reacted.add(key);
  btn.classList.add("done");
  tg?.HapticFeedback?.impactOccurred?.("light");

  const res = await api("react", { target_id: id, type });
  if (res.error) {
    toast(res.error === "no_profile" ? "Bot ထဲမှာ Profile အရင်ဖြည့်ပါ။" : "မအောင်မြင်ပါ။");
    return;
  }
  if (res.profile) {
    document.querySelectorAll('.card[data-id="' + CSS.escape(id) + '"] .reactions').forEach((r) => {
      ["like", "haha", "wow"].forEach((t) => {
        const em = r.querySelector('em[data-c="' + t + '"]');
        if (em) em.textContent = res.profile.counts_text[t];
      });
    });
  }
});

async function loadMe(force = false) {
  if (!state.me || force) {
    const res = await api("me");
    state.me = res.profile;
  }
  return state.me;
}

async function renderMy() {
  const panel = document.getElementById("my-panel");
  panel.innerHTML = '<div class="skeleton" style="padding-top:20vh">ခဏစောင့်ပါ…</div>';
  const p = await loadMe(true);
  if (!p) {
    panel.innerHTML = '<h2>My Profile</h2><p class="bio">Bot ထဲမှာ Profile အရင်ဖန်တီးပေးပါ။</p>';
    return;
  }
  const url = photoUrl(p);
  panel.innerHTML = '<h2>My Profile</h2>' +
    (url ? '<div class="avatar"><img src="' + url + '" alt="My profile photo" /></div>' : "") +
    (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : "") +
    fieldsHtml(p) +
    '<div class="stats">' +
      '<div class="stat"><b>' + esc(p.counts_text.like) + '</b><small>❤️ Like</small></div>' +
      '<div class="stat"><b>' + esc(p.counts_text.haha) + '</b><small>😂 Haha</small></div>' +
      '<div class="stat"><b>' + esc(p.counts_text.wow) + '</b><small>😮 Wow</small></div>' +
    '</div>';
}

const ZODIACS = Object.keys(ZODIAC_EMOJI);

async function renderEdit() {
  const panel = document.getElementById("edit-panel");
  panel.innerHTML = '<div class="skeleton" style="padding-top:20vh">ခဏစောင့်ပါ…</div>';
  const p = await loadMe(true);
  if (!p) {
    panel.innerHTML = '<h2>Edit Profile</h2><p class="bio">Bot ထဲမှာ Profile အရင်ဖန်တီးပေးပါ။</p>';
    return;
  }
  panel.innerHTML = '<h2>Edit Profile</h2>' +
    '<label class="f">Name</label><input class="f" id="e-name" value="' + esc(p.name || "") + '" />' +
    '<label class="f">Age</label><input class="f" id="e-age" type="number" min="13" max="99" value="' + esc(p.age || "") + '" />' +
    '<label class="f">Zodiac</label><select class="f" id="e-zodiac"><option value="">—</option>' +
      ZODIACS.map((z) => '<option value="' + z + '"' + (p.zodiac === z ? " selected" : "") + '>' + ZODIAC_EMOJI[z] + ' ' + z + '</option>').join("") +
    '</select>' +
    '<label class="f">Height</label><input class="f" id="e-height" value="' + esc(p.height || "") + '" />' +
    '<label class="f">Region</label><input class="f" id="e-region" value="' + esc(p.region || "") + '" />' +
    '<label class="f">City</label><input class="f" id="e-city" value="' + esc(p.city || "") + '" />' +
    '<label class="f">Game</label><input class="f" id="e-game" value="' + esc(p.game || "") + '" />' +
    '<label class="f">School / Job / University</label><input class="f" id="e-occ" value="' + esc(p.occupation || "") + '" />' +
    '<label class="f">Ethnic</label><input class="f" id="e-ethnic" value="' + esc(p.ethnic || "") + '" />' +
    '<label class="f">Bio</label><textarea class="f" id="e-bio">' + esc(p.bio || "") + '</textarea>' +
    '<button class="save" id="e-save">💾 Save</button>';

  document.getElementById("e-save").addEventListener("click", async () => {
    const fields = {
      name: document.getElementById("e-name").value,
      age: document.getElementById("e-age").value,
      zodiac: document.getElementById("e-zodiac").value,
      height: document.getElementById("e-height").value,
      region: document.getElementById("e-region").value,
      city: document.getElementById("e-city").value,
      game: document.getElementById("e-game").value,
      occupation: document.getElementById("e-occ").value,
      ethnic: document.getElementById("e-ethnic").value,
      bio: document.getElementById("e-bio").value,
    };
    const res = await api("update", { fields });
    if (res.ok) {
      state.me = res.profile;
      tg?.HapticFeedback?.notificationOccurred?.("success");
      toast("သိမ်းဆည်းပြီးပါပြီ ✓");
    } else {
      toast("မအောင်မြင်ပါ။");
    }
  });
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const feedScreen = document.getElementById("screen-feed");
  const myScreen = document.getElementById("screen-my");
  const editScreen = document.getElementById("screen-edit");
  [feedScreen, myScreen, editScreen].forEach((s) => s.classList.remove("active"));

  if (tab === "foryou" || tab === "view") {
    feedScreen.classList.add("active");
    document.getElementById("subtitle").textContent = tab === "foryou" ? "For You" : "View Profile";
    loadFeed(tab);
  } else if (tab === "my") {
    myScreen.classList.add("active");
    document.getElementById("subtitle").textContent = "My Profile";
    renderMy();
  } else {
    editScreen.classList.add("active");
    document.getElementById("subtitle").textContent = "Edit Profile";
    renderEdit();
  }
}

document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

if (!initData) {
  document.getElementById("feed").innerHTML =
    '<div class="skeleton">ဒီ Website ကို Telegram Bot ထဲကနေ ဖွင့်ပေးပါ။</div>';
} else {
  setTab("foryou");
}
