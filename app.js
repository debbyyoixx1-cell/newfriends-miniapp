const API = "https://svhucbslincrjmmbzcep.supabase.co/functions/v1/miniapp-api";
const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
const params = new URLSearchParams(location.hash.slice(1));
const initData = tg?.initData || params.get("tgWebAppData") || new URLSearchParams(location.search).get("tgWebAppData") || "";
const $ = (id) => document.getElementById(id);
const state = { status: "idle", room: null, after: 0, busy: false, timer: null };
function status(text, mode = "") { $("status").textContent = text; $("status-dot").className = "status-dot " + mode; }
function notice(text = "") { $("notice").textContent = text; }
function render() {
  const matched = state.status === "matched";
  $("actions").hidden = matched;
  $("composer").hidden = !matched;
  $("room-actions").hidden = !matched && state.status !== "waiting";
  $("next").hidden = !matched;
  $("join").textContent = state.status === "waiting" ? "စကားပြောဖော် ရှာနေပါတယ်…" : "စကားပြောဖော် ရှာမယ် ↗";
  $("join").disabled = !initData || state.busy || state.status === "waiting";
  status(matched ? "စကားပြောဖော် တွေ့ပါပြီ · အမည်မဖော်ပြပါ" : state.status === "waiting" ? "စကားပြောဖော် ရှာနေပါတယ်…" : initData ? "အမည်မသိ စကားပြောရန် အသင့်ဖြစ်ပါပြီ" : "Telegram ထဲက Mini App မှ ဖွင့်ပါ", matched ? "active" : state.status === "waiting" ? "waiting" : "");
}
async function api(action, extra = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ initData, action, after: state.after, ...extra }), signal: controller.signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "request_failed");
    return data;
  } finally { clearTimeout(timeout); }
}
function appendMessage(message) {
  if ($("message-" + message.id)) return;
  $("empty-state")?.remove();
  const bubble = document.createElement("div"); bubble.className = "bubble" + (message.mine ? " mine" : ""); bubble.id = "message-" + message.id;
  bubble.textContent = message.body;
  const time = document.createElement("small"); time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); bubble.append(time);
  $("messages").append(bubble);
  $("conversation").scrollTop = $("conversation").scrollHeight;
  state.after = Math.max(state.after, Number(message.id));
}
function clearMessages() {
  $("messages").replaceChildren();
  const empty = document.createElement("div"); empty.id = "empty-state"; empty.className = "empty-state";
  empty.innerHTML = '<div class="chat-symbol">✳</div><p>မိတ်ဆွေသစ်တစ်ယောက်နဲ့<br>စကားစမြည်ပြောကြည့်ပါ။</p>';
  $("messages").append(empty);
  state.after = 0;
}
function apply(data) {
  if (data.status === "matched") {
    if (state.room !== data.room_id) { clearMessages(); state.room = data.room_id; notice(""); }
    state.status = "matched";
    (data.messages || []).forEach(appendMessage);
  } else if (state.status === "matched") {
    state.room = null; state.status = "idle"; clearMessages(); notice("တစ်ဖက်လူ ထွက်သွားပါပြီ။ နောက်တစ်ယောက် ရှာနိုင်ပါတယ်။");
  } else { state.status = data.status === "waiting" ? "waiting" : "idle"; }
  render();
}
async function act(action, extra = {}) {
  if (state.busy || !initData) return;
  state.busy = true; render(); notice("");
  try { apply(await api(action, extra)); }
  catch (err) { notice(err.message === "unauthorized" ? "Telegram မှ ပြန်ဖွင့်ပါ။" : "ချိတ်ဆက်မှု မအောင်မြင်ပါ။ ထပ်ကြိုးစားပါ။"); }
  finally { state.busy = false; render(); }
}
$("join").onclick = () => act("join");
$("leave").onclick = async () => { await act("leave"); if (state.status === "idle") { state.room = null; clearMessages(); } };
$("next").onclick = () => act("next");
$("composer").onsubmit = async (event) => {
  event.preventDefault();
  const input = $("message"); const text = input.value.trim();
  if (!text || state.busy || !state.room) return;
  input.value = "";
  await act("send", { text, room_id: state.room });
  if ($("notice").textContent) input.value = text;
};
if (initData) {
  render();
  act("status");
  state.timer = setInterval(() => { if (!state.busy && (state.status === "waiting" || state.status === "matched")) act("status"); }, 2200);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !state.busy) act("status"); });
} else { render(); notice("Telegram Bot ရဲ့ Mini App လင့်ခ်မှ ဖွင့်ပါ။"); }
