/**
 * Restaurant Chat Bot — Embeddable Widget
 *
 * INTEGRATION (one line):
 * <script src="https://yourdomain.com/widget/chat.js" data-restaurant="donna-leipzig" data-lang="de" data-api="https://yourdomain.com"></script>
 *
 * Optional data attributes:
 *   data-restaurant  — restaurant slug (required)
 *   data-lang        — default language: "de", "en", "it" (default: "de")
 *   data-api         — backend API base URL (default: same origin)
 *   data-color       — primary color hex (default: #2d6a4f)
 *   data-position    — "right" or "left" (default: "right")
 *   data-greeting    — custom welcome message
 */
(function () {
  "use strict";

  // ── Read config from script tag ──────────────────────────────────
  const scriptTag = document.currentScript;
  const CONFIG = {
    restaurant: scriptTag?.getAttribute("data-restaurant") || "donna-leipzig",
    lang: scriptTag?.getAttribute("data-lang") || "de",
    api: scriptTag?.getAttribute("data-api") || window.location.origin,
    color: scriptTag?.getAttribute("data-color") || "#2d6a4f",
    position: scriptTag?.getAttribute("data-position") || "right",
    greeting: scriptTag?.getAttribute("data-greeting") || null,
  };

  const SESSION_ID =
    sessionStorage.getItem("rcb_session") ||
    "s_" + Math.random().toString(36).slice(2, 12);
  sessionStorage.setItem("rcb_session", SESSION_ID);

  let isOpen = false;
  let isLoading = false;
  let currentLang = CONFIG.lang;

  const GREETINGS = {
    de: "Hallo! 👋 Wie kann ich Ihnen helfen? Ich kann Tische reservieren, unser Menü zeigen oder Fragen zu Allergenen beantworten.",
    en: "Hello! 👋 How can I help? I can book a table, show our menu, or answer questions about allergens.",
    it: "Ciao! 👋 Come posso aiutarti? Posso prenotare un tavolo, mostrare il menù o rispondere a domande sugli allergeni.",
  };

  const CHIPS = {
    de: [
      { label: "🍕 Menü anzeigen", msg: "Zeig mir bitte das Menü" },
      { label: "📅 Tisch reservieren", msg: "Ich möchte einen Tisch reservieren" },
      { label: "⭐ Empfehlungen", msg: "Was könnt ihr empfehlen?" },
      { label: "🥜 Allergene", msg: "Ich habe Allergien, was kann ich essen?" },
    ],
    en: [
      { label: "🍕 See menu", msg: "Show me the menu" },
      { label: "📅 Book a table", msg: "I'd like to book a table" },
      { label: "⭐ Recommendations", msg: "What do you recommend?" },
      { label: "🥜 Allergens", msg: "I have allergies, what can I eat?" },
    ],
    it: [
      { label: "🍕 Menù", msg: "Fammi vedere il menù" },
      { label: "📅 Prenotare", msg: "Vorrei prenotare un tavolo" },
      { label: "⭐ Consigli", msg: "Cosa mi consigliate?" },
      { label: "🥜 Allergeni", msg: "Ho delle allergie, cosa posso mangiare?" },
    ],
  };

  // ── Inject CSS ───────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .rcb-container{--rcb-primary:${CONFIG.color};--rcb-primary-light:${lighten(CONFIG.color, 20)};--rcb-bg:#fff;--rcb-bg-chat:#f8f9fa;--rcb-text:#1a1a2e;--rcb-text-light:#6c757d;--rcb-radius:16px;--rcb-shadow:0 8px 32px rgba(0,0,0,.12);--rcb-font:'Segoe UI',system-ui,-apple-system,sans-serif;position:fixed;bottom:20px;${CONFIG.position}:20px;z-index:99999;font-family:var(--rcb-font)}
      .rcb-toggle{width:60px;height:60px;border-radius:50%;background:var(--rcb-primary);border:none;cursor:pointer;box-shadow:var(--rcb-shadow);display:flex;align-items:center;justify-content:center;transition:transform .2s,background .2s}
      .rcb-toggle:hover{transform:scale(1.08);background:var(--rcb-primary-light)}
      .rcb-toggle svg{width:28px;height:28px;fill:#fff}
      .rcb-window{display:none;width:380px;height:560px;background:var(--rcb-bg);border-radius:var(--rcb-radius);box-shadow:var(--rcb-shadow);flex-direction:column;overflow:hidden;position:absolute;bottom:72px;${CONFIG.position}:0}
      .rcb-window.open{display:flex}
      .rcb-header{background:var(--rcb-primary);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px}
      .rcb-header-avatar{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px}
      .rcb-header-info h3{margin:0;font-size:15px;font-weight:600}
      .rcb-header-info p{margin:2px 0 0;font-size:12px;opacity:.85}
      .rcb-close{margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:20px;opacity:.7;transition:opacity .2s}
      .rcb-close:hover{opacity:1}
      .rcb-messages{flex:1;overflow-y:auto;padding:16px;background:var(--rcb-bg-chat);display:flex;flex-direction:column;gap:12px}
      .rcb-msg{max-width:82%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}
      .rcb-msg.bot{background:#fff;color:var(--rcb-text);align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
      .rcb-msg.user{background:var(--rcb-primary);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
      .rcb-msg.typing{background:#fff;align-self:flex-start;border-bottom-left-radius:4px;color:var(--rcb-text-light);font-style:italic}
      .rcb-input-area{display:flex;padding:12px;gap:8px;background:var(--rcb-bg);border-top:1px solid #e9ecef}
      .rcb-input{flex:1;border:1px solid #dee2e6;border-radius:24px;padding:10px 16px;font-size:14px;font-family:var(--rcb-font);outline:none;transition:border-color .2s}
      .rcb-input:focus{border-color:var(--rcb-primary)}
      .rcb-send{width:40px;height:40px;border-radius:50%;background:var(--rcb-primary);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
      .rcb-send:hover{background:var(--rcb-primary-light)}
      .rcb-send:disabled{background:#adb5bd;cursor:not-allowed}
      .rcb-send svg{width:18px;height:18px;fill:#fff}
      .rcb-lang{display:flex;gap:4px;padding:8px 16px;background:var(--rcb-bg)}
      .rcb-lang button{padding:4px 10px;border:1px solid #dee2e6;border-radius:12px;background:#fff;font-size:12px;cursor:pointer;transition:all .2s}
      .rcb-lang button.active{background:var(--rcb-primary);color:#fff;border-color:var(--rcb-primary)}
      .rcb-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 12px}
      .rcb-chip{padding:6px 12px;border:1px solid var(--rcb-primary);border-radius:16px;background:#fff;color:var(--rcb-primary);font-size:12px;cursor:pointer;transition:all .2s;white-space:nowrap}
      .rcb-chip:hover{background:var(--rcb-primary);color:#fff}
      .rcb-powered{text-align:center;padding:4px;font-size:10px;color:var(--rcb-text-light);background:var(--rcb-bg)}
      @media(max-width:480px){.rcb-window{width:calc(100vw - 24px);height:calc(100vh - 100px);bottom:72px;${CONFIG.position}:-8px}}
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ────────────────────────────────────────────────────
  function buildWidget() {
    const container = document.createElement("div");
    container.className = "rcb-container";
    container.innerHTML = `
      <div class="rcb-window" id="rcb-window">
        <div class="rcb-header">
          <div class="rcb-header-avatar">🍕</div>
          <div class="rcb-header-info">
            <h3 id="rcb-title">Restaurant Bot</h3>
            <p id="rcb-subtitle">Online</p>
          </div>
          <button class="rcb-close" id="rcb-close">✕</button>
        </div>
        <div class="rcb-lang" id="rcb-lang">
          <button data-lang="de" class="${currentLang === "de" ? "active" : ""}">🇩🇪 DE</button>
          <button data-lang="en" class="${currentLang === "en" ? "active" : ""}">🇬🇧 EN</button>
          <button data-lang="it" class="${currentLang === "it" ? "active" : ""}">🇮🇹 IT</button>
        </div>
        <div class="rcb-messages" id="rcb-messages"></div>
        <div class="rcb-chips" id="rcb-chips"></div>
        <div class="rcb-input-area">
          <input class="rcb-input" id="rcb-input" placeholder="Nachricht eingeben..." autocomplete="off" />
          <button class="rcb-send" id="rcb-send">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="rcb-powered">Powered by RestaurantBot</div>
      </div>
      <button class="rcb-toggle" id="rcb-toggle">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
    `;
    document.body.appendChild(container);
    return container;
  }

  // ── Wire events ──────────────────────────────────────────────────
  function init() {
    injectStyles();
    const container = buildWidget();

    const win = container.querySelector("#rcb-window");
    const toggle = container.querySelector("#rcb-toggle");
    const close = container.querySelector("#rcb-close");
    const input = container.querySelector("#rcb-input");
    const sendBtn = container.querySelector("#rcb-send");
    const messagesEl = container.querySelector("#rcb-messages");
    const chipsEl = container.querySelector("#rcb-chips");
    const langBar = container.querySelector("#rcb-lang");

    // Fetch restaurant info
    fetchRestaurantInfo(container);

    // Toggle open/close
    toggle.addEventListener("click", () => {
      isOpen = !isOpen;
      win.classList.toggle("open", isOpen);
      toggle.style.display = isOpen ? "none" : "flex";
      if (isOpen && messagesEl.children.length === 0) {
        showGreeting(messagesEl, chipsEl);
      }
      if (isOpen) input.focus();
    });

    close.addEventListener("click", () => {
      isOpen = false;
      win.classList.remove("open");
      toggle.style.display = "flex";
    });

    // Send message
    function send() {
      const text = input.value.trim();
      if (!text || isLoading) return;
      input.value = "";
      chipsEl.innerHTML = ""; // hide chips after first message
      addMessage(messagesEl, text, "user");
      sendToAPI(text, messagesEl);
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    // Language switcher
    langBar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-lang]");
      if (!btn) return;
      currentLang = btn.dataset.lang;
      langBar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      updatePlaceholder(input);
      // If no messages yet, show greeting in new language
      if (messagesEl.children.length === 0) {
        showGreeting(messagesEl, chipsEl);
      }
    });

    // Chip clicks
    chipsEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".rcb-chip");
      if (!chip) return;
      const msg = chip.dataset.msg;
      chipsEl.innerHTML = "";
      addMessage(messagesEl, msg, "user");
      sendToAPI(msg, messagesEl);
    });

    updatePlaceholder(input);
  }

  // ── API calls ────────────────────────────────────────────────────
  async function fetchRestaurantInfo(container) {
    try {
      const res = await fetch(`${CONFIG.api}/api/restaurant/${CONFIG.restaurant}`);
      if (res.ok) {
        const data = await res.json();
        const title = container.querySelector("#rcb-title");
        if (title) title.textContent = data.name || "Restaurant Bot";
      }
    } catch (e) {
      console.warn("[RCB] Could not fetch restaurant info:", e);
    }
  }

  async function sendToAPI(message, messagesEl) {
    isLoading = true;
    const typingEl = addMessage(messagesEl, "...", "typing");

    try {
      const res = await fetch(`${CONFIG.api}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_slug: CONFIG.restaurant,
          session_id: SESSION_ID,
          message: message,
          language: currentLang,
        }),
      });

      typingEl.remove();

      if (!res.ok) {
        addMessage(messagesEl, "⚠️ Connection error. Please try again.", "bot");
        return;
      }

      const data = await res.json();
      addMessage(messagesEl, data.reply, "bot");
    } catch (e) {
      typingEl.remove();
      addMessage(messagesEl, "⚠️ Connection error. Please try again.", "bot");
      console.error("[RCB] API error:", e);
    } finally {
      isLoading = false;
    }
  }

  // ── DOM helpers ──────────────────────────────────────────────────
  function addMessage(container, text, type) {
    const div = document.createElement("div");
    div.className = `rcb-msg ${type}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function showGreeting(messagesEl, chipsEl) {
    const greeting = CONFIG.greeting || GREETINGS[currentLang] || GREETINGS.de;
    addMessage(messagesEl, greeting, "bot");

    const chips = CHIPS[currentLang] || CHIPS.de;
    chipsEl.innerHTML = chips
      .map((c) => `<button class="rcb-chip" data-msg="${esc(c.msg)}">${esc(c.label)}</button>`)
      .join("");
  }

  function updatePlaceholder(input) {
    const ph = {
      de: "Nachricht eingeben...",
      en: "Type a message...",
      it: "Scrivi un messaggio...",
    };
    input.placeholder = ph[currentLang] || ph.de;
  }

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function lighten(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
    const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent));
    const b = Math.min(255, (num & 0x0000ff) + Math.round(2.55 * percent));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  // ── Boot ─────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
