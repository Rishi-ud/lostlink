/* ============================================
   LOSTLINK — LinkBot AI Campus Assistant
   Interactive floating chat widget, real-time
   item search, suggestion chips, and offline support.
   ============================================ */

(function () {
  'use strict';

  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatBot);
  } else {
    initChatBot();
  }

  function initChatBot() {
    // Avoid double injection
    if (document.getElementById('lostlink-chat-launcher')) return;

    injectChatbotStyles();
    injectChatbotDOM();
    bindChatEvents();
    renderInitialMessage();
  }

  function injectChatbotStyles() {
    // Check if stylesheet is already linked
    if (!document.querySelector('link[href*="chatbot.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/chatbot.css';
      document.head.appendChild(link);
    }
  }

  function injectChatbotDOM() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'lostlink-chatbot-root';
    chatContainer.innerHTML = `
      <!-- Launcher Button -->
      <button class="chat-launcher" id="lostlink-chat-launcher" aria-label="Open LinkBot AI Assistant" title="Need help? Ask LinkBot!">
        <span class="chat-launcher-badge" id="chat-launcher-badge"></span>
        <i data-lucide="message-square" class="icon-chat"></i>
        <i data-lucide="x" class="icon-close"></i>
      </button>

      <!-- Chat Window Modal -->
      <div class="chat-window" id="lostlink-chat-window" role="dialog" aria-labelledby="chat-window-title" aria-modal="true">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar">
              <i data-lucide="bot" style="width:20px;height:20px;"></i>
              <span class="chat-avatar-dot" title="Online"></span>
            </div>
            <div>
              <div class="chat-title" id="chat-window-title">LinkBot AI</div>
              <div class="chat-subtitle">SRMIST Lost &amp; Found Assistant</div>
            </div>
          </div>
          <div class="chat-header-actions">
            <button class="chat-btn-icon" id="chat-close-btn" aria-label="Close chat">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
        </div>

        <!-- Messages Stream -->
        <div class="chat-messages" id="chat-messages-stream" aria-live="polite"></div>

        <!-- Footer / Input Form -->
        <div class="chat-footer">
          <form class="chat-input-form" id="chat-input-form" novalidate>
            <input 
              type="text" 
              class="chat-input" 
              id="chat-user-input" 
              placeholder="Ask about lost items, locations, reports..." 
              autocomplete="off"
              aria-label="Message LinkBot"
            />
            <button type="submit" class="chat-send-btn" id="chat-send-btn" aria-label="Send message">
              <i data-lucide="send"></i>
            </button>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(chatContainer);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function bindChatEvents() {
    const launcher = document.getElementById('lostlink-chat-launcher');
    const windowEl = document.getElementById('lostlink-chat-window');
    const closeBtn = document.getElementById('chat-close-btn');
    const badge = document.getElementById('chat-launcher-badge');
    const form = document.getElementById('chat-input-form');
    const input = document.getElementById('chat-user-input');

    function toggleChat(open) {
      const isOpen = typeof open === 'boolean' ? open : !windowEl.classList.contains('open');
      windowEl.classList.toggle('open', isOpen);
      launcher.classList.toggle('open', isOpen);
      if (badge && isOpen) badge.style.display = 'none';

      if (isOpen) {
        setTimeout(() => input.focus(), 150);
      }
    }

    launcher.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && windowEl.classList.contains('open')) {
        toggleChat(false);
      }
    });

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendMessage(text);
    });
  }

  function renderInitialMessage() {
    const stream = document.getElementById('chat-messages-stream');
    if (!stream) return;

    // Check if we have session history
    const saved = sessionStorage.getItem('lostlink_chat_history');
    if (saved) {
      try {
        stream.innerHTML = saved;
        reattachChipListeners();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        scrollToBottom();
        return;
      } catch (e) {}
    }

    // Default Welcome Message
    appendBotMessage({
      reply: "Hi there! 👋 I'm **LinkBot**, your SRMIST campus Lost & Found assistant.\n\nLooking for a misplaced item or want to report something you found?",
      chips: ["🔍 I lost an item", "📦 How do I claim?", "📍 Central Library items", "🔐 How does verification work?"]
    });
  }

  function formatTimeNow() {
    const now = new Date();
    let hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ap = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${mins} ${ap}`;
  }

  function appendUserMessage(text) {
    const stream = document.getElementById('chat-messages-stream');
    if (!stream) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user';
    msgDiv.innerHTML = `
      <div class="chat-bubble">${escapeHtml(text)}</div>
      <span class="chat-time">${formatTimeNow()}</span>
    `;
    stream.appendChild(msgDiv);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const stream = document.getElementById('chat-messages-stream');
    if (!stream) return null;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-msg bot chat-typing-wrapper';
    typingDiv.innerHTML = `
      <div class="chat-typing">
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-dot"></span>
        <span class="chat-typing-dot"></span>
      </div>
    `;
    stream.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
  }

  function appendBotMessage(data) {
    const stream = document.getElementById('chat-messages-stream');
    if (!stream) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg bot';

    // Format Markdown-like text (bold, line breaks)
    let formattedText = escapeHtml(data.reply || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    let contentHtml = `<div class="chat-bubble">${formattedText}`;

    // Item cards
    if (data.items && data.items.length > 0) {
      contentHtml += '<div style="margin-top:var(--space-2);">';
      data.items.forEach(item => {
        const hasPhoto = item.image && item.image.trim() !== '' && !item.image.includes('assets/images/items/item');
        const thumbHtml = hasPhoto
          ? `<img src="${item.image}" alt="${escapeHtml(item.title)}" class="chat-item-thumb">`
          : `<div class="item-thumb-no-photo" style="width:36px; height:36px; border-radius:var(--radius-sm);"><i data-lucide="${typeof getCategoryIcon !== 'undefined' ? getCategoryIcon(item.category) : 'package'}" style="width:16px;height:16px;"></i></div>`;

        contentHtml += `
          <a href="item-detail.html?id=${item.id}" class="chat-item-card">
            ${thumbHtml}
            <div class="chat-item-details">
              <div class="chat-item-title">${escapeHtml(item.title)}</div>
              <div class="chat-item-meta">
                <span>📍 ${escapeHtml(item.location)}</span>
                <span class="badge badge-${item.type}" style="padding:1px 6px; font-size:10px;">${item.type.toUpperCase()}</span>
              </div>
            </div>
          </a>
        `;
      });
      contentHtml += '</div>';
    }

    // Action button
    if (data.action) {
      contentHtml += `
        <a href="${data.action.url}" class="chat-action-btn">
          ${escapeHtml(data.action.text)} <i data-lucide="arrow-right" style="width:12px;height:12px;"></i>
        </a>
      `;
    }

    // Chips
    if (data.chips && data.chips.length > 0) {
      contentHtml += '<div class="chat-chips">';
      data.chips.forEach(chip => {
        contentHtml += `<button type="button" class="chat-chip">${escapeHtml(chip)}</button>`;
      });
      contentHtml += '</div>';
    }

    contentHtml += `</div><span class="chat-time">${formatTimeNow()}</span>`;
    msgDiv.innerHTML = contentHtml;

    stream.appendChild(msgDiv);
    reattachChipListeners();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    scrollToBottom();
    saveHistory();
  }

  function reattachChipListeners() {
    document.querySelectorAll('.chat-chip').forEach(chip => {
      // Remove old listeners by cloning
      const clone = chip.cloneNode(true);
      chip.parentNode.replaceChild(clone, chip);

      clone.addEventListener('click', (e) => {
        e.preventDefault();
        const text = clone.textContent.replace(/^[🔍📝🔐📍📦]\s*/, '').trim();
        sendMessage(text);
      });
    });
  }

  async function sendMessage(text) {
    appendUserMessage(text);
    const typingIndicator = showTypingIndicator();

    try {
      // Attempt API call to /api/chat
      const isPort5000 = window.location.port === '5000';
      const endpoint = isPort5000 ? '/api/chat' : 'http://localhost:5000/api/chat';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (res.ok) {
        const data = await res.json();
        if (typingIndicator) typingIndicator.remove();
        appendBotMessage(data);
        return;
      }
    } catch (e) {
      // Offline fallback intent matching
    }

    // Offline / Mock fallback response
    setTimeout(() => {
      if (typingIndicator) typingIndicator.remove();
      const fallbackReply = generateOfflineBotReply(text);
      appendBotMessage(fallbackReply);
    }, 500);
  }

  function generateOfflineBotReply(text) {
    const q = text.toLowerCase();
    const items = typeof ITEMS !== 'undefined' ? ITEMS : [];

    // Greetings
    if (/^(hi|hello|hey|help|who are you)\b/i.test(q)) {
      return {
        reply: "Hello! 👋 I'm **LinkBot**, the official SRMIST Lost & Found AI Assistant.\n\nHow can I help you today?",
        chips: ["🔍 Search lost items", "📝 How do I report?", "🔐 How to claim?", "📍 Collection locations"]
      };
    }

    // Report
    if (/how\s+(do\s+i\s+|can\s+i\s+|to\s+)?(report|file)/i.test(q) || q.includes('report') || q.includes('lost an item') || q.includes('found an item') || q.includes('i lost') || q.includes('i found')) {
      return {
        reply: "Filing a report takes **less than 2 minutes** ⏱️:\n\n1. Go to the **Report** wizard.\n2. Choose **Lost** or **Found**.\n3. Add item photo, details, and campus block.\n4. Submit and our matching algorithm starts comparing immediately!",
        action: { text: "Report an Item Now", url: "report.html" },
        chips: ["Browse current listings", "How to claim?"]
      };
    }

    // Claim
    if (q.includes('claim') || q.includes('verify') || q.includes('verification') || q.includes('ownership')) {
      return {
        reply: "To safeguard student belongings, LostLink requires **ownership verification** 🔐:\n\n1. Locate your item in Browse.\n2. Click **'This is mine (Claim)'**.\n3. Answer identifying quiz questions (e.g. serial numbers, scratches, contents).\n4. Download your official **Collection Pass**.",
        action: { text: "Browse Found Items", url: "browse.html?type=found" },
        chips: ["Campus collection desks", "Report an item"]
      };
    }

    // Locations
    if (q.includes('where') || q.includes('location') || q.includes('desk') || q.includes('timing') || q.includes('contact')) {
      return {
        reply: "🏛️ **SRMIST Lost Property Desks**:\n\n• **Central Library**: Helpdesk Counter 2 (Ground Floor)\n• **Tech Park**: Main Security Reception\n• **Admin Block**: Campus Security & Safety Office\n\n⏰ **Hours**: Mon – Sat, 8:30 AM – 5:30 PM\n📞 **Helpline**: +91 44 2741 7000 (Ext. 204)",
        chips: ["Search items", "Report an item"]
      };
    }

    // Keywords search
    const words = q.split(' ').filter(w => w.length > 2);
    const matches = items.filter(i => {
      return words.some(w => 
        i.title.toLowerCase().includes(w) ||
        i.description.toLowerCase().includes(w) ||
        i.location.toLowerCase().includes(w) ||
        i.category.toLowerCase().includes(w)
      );
    });

    if (matches.length > 0) {
      return {
        reply: `I found **${matches.length} item(s)** on campus matching your request:`,
        items: matches.slice(0, 3).map(m => ({
          id: m.id,
          title: m.title,
          location: m.location,
          type: m.type,
          image: m.image
        })),
        action: { text: `View matching items in Browse`, url: `browse.html?q=${encodeURIComponent(text)}` },
        chips: ["How to claim?", "Report another item"]
      };
    }

    // Fallthrough
    return {
      reply: "I couldn't locate an exact match on campus for that right now. 🔍\n\nFiling a quick report ensures you'll get an alert the moment a student or faculty member finds it!",
      action: { text: "File Lost Report", url: "report.html" },
      chips: ["Browse all items", "Campus desk locations"]
    };
  }

  function scrollToBottom() {
    const stream = document.getElementById('chat-messages-stream');
    if (stream) {
      stream.scrollTop = stream.scrollHeight;
    }
  }

  function saveHistory() {
    const stream = document.getElementById('chat-messages-stream');
    if (stream) {
      sessionStorage.setItem('lostlink_chat_history', stream.innerHTML);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();

