/* ============================================
   LOSTLINK — Main JS
   Shared logic: header, dark mode, toasts,
   mobile menu, smooth interactions.
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initAuthHeader();
  initDarkMode();
  initMobileMenu();
  initToastSystem();
  initShowMore();
  initSearchClear();
});

/* ============================================
   AUTH HEADER STATE
   Dynamically renders login/signup vs avatar/logout
   ============================================ */
function initAuthHeader() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;

  const currentUser = (typeof LostLinkAPI !== 'undefined') ? LostLinkAPI.getCurrentUser() : null;

  // 1. Ensure Inbox link is in navbar
  const nav = document.querySelector('.nav');
  if (nav && !nav.querySelector('a[href="inbox.html"]')) {
    const isCurrentInbox = window.location.pathname.endsWith('inbox.html');
    const inboxLink = document.createElement('a');
    inboxLink.href = 'inbox.html';
    inboxLink.className = `nav-link ${isCurrentInbox ? 'active' : ''}`;
    inboxLink.innerHTML = `<i data-lucide="message-square" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Inbox <span class="badge badge-error header-inbox-badge" id="nav-inbox-badge" style="display:none; font-size:10px; padding:1px 5px; margin-left:3px;"></span>`;

    const browseLink = nav.querySelector('a[href="browse.html"]');
    if (browseLink && browseLink.nextSibling) {
      nav.insertBefore(inboxLink, browseLink.nextSibling);
    } else {
      nav.appendChild(inboxLink);
    }

    // Check unread count
    if (currentUser && typeof LostLinkAPI !== 'undefined') {
      LostLinkAPI.getConversations(currentUser.email).then(convos => {
        const totalUnread = (convos || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
        const badge = document.getElementById('nav-inbox-badge');
        if (badge && totalUnread > 0) {
          badge.textContent = totalUnread;
          badge.style.display = 'inline-block';
        }
      }).catch(() => {});
    }
  }

  // 2. Demo Account Quick Switcher (Tab-isolated)
  let switchContainer = headerActions.querySelector('.account-switcher');
  if (!switchContainer) {
    switchContainer = document.createElement('div');
    switchContainer.className = 'account-switcher';
    switchContainer.style.position = 'relative';
    switchContainer.style.display = 'inline-block';

    const activeLabel = currentUser ? currentUser.name.split(' ')[0] : 'Demo User';
    const isRahul = currentUser && currentUser.email === 'rahul.sharma@srmist.edu.in';
    const isRishi = currentUser && currentUser.email === 'rishi.v@srmist.edu.in';

    switchContainer.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" id="btn-account-switch" style="border:1.5px solid var(--border); font-size:12px; gap:6px; padding:5px 10px; border-radius:var(--radius-full); background:var(--bg-card);" title="Switch account in this tab">
        <i data-lucide="users" style="width:13px;height:13px; color:var(--primary);"></i>
        <strong style="color:var(--text);">${activeLabel}</strong>
        <i data-lucide="chevron-down" style="width:11px;height:11px;"></i>
      </button>
      <div class="account-switch-menu" id="account-switch-menu" style="display:none; position:absolute; right:0; top:calc(100% + 6px); background:var(--bg-card); border:1.5px solid var(--border); border-radius:var(--radius-lg); padding:var(--space-3); min-width:270px; box-shadow:var(--shadow-xl); z-index:99999;">
        <div style="font-size:10px; text-transform:uppercase; color:var(--text-secondary); padding:2px 4px 6px 4px; font-weight:700; letter-spacing:0.04em;">Switch Active Demo Account:</div>
        
        <!-- Rahul Sharma (Owner) -->
        <button type="button" class="btn btn-ghost btn-block btn-sm" style="justify-content:flex-start; text-align:left; padding:8px 10px; margin-bottom:4px; border-radius:var(--radius-md); ${isRahul ? 'background:var(--primary-50); border:1px solid var(--primary-300);' : ''}" onclick="LostLinkAPI.switchAccountInThisTab({ id: 1, name: 'Rahul Sharma', email: 'rahul.sharma@srmist.edu.in', regNo: 'RA2211003010189', avatar: 'RS' })">
          <span class="avatar avatar-xs" style="margin-right:10px; width:28px; height:28px; font-size:11px; background:var(--primary-100); color:var(--primary); font-weight:700;">RS</span>
          <div style="flex:1;">
            <div style="font-weight:700; font-size:13px; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
              <span>Rahul Sharma</span>
              ${isRahul ? '<span class="badge badge-primary" style="font-size:9px; padding:1px 5px;">Active</span>' : ''}
            </div>
            <div class="text-xs text-secondary" style="font-size:11px;">Backpack Owner (Lost)</div>
          </div>
        </button>

        <!-- Rishi Verma (Finder) -->
        <button type="button" class="btn btn-ghost btn-block btn-sm" style="justify-content:flex-start; text-align:left; padding:8px 10px; margin-bottom:6px; border-radius:var(--radius-md); ${isRishi ? 'background:var(--primary-50); border:1px solid var(--primary-300);' : ''}" onclick="LostLinkAPI.switchAccountInThisTab({ id: 2, name: 'Rishi Verma', email: 'rishi.v@srmist.edu.in', regNo: 'RA2211003010312', avatar: 'RV' })">
          <span class="avatar avatar-xs" style="margin-right:10px; width:28px; height:28px; font-size:11px; background:#dcfce7; color:#15803d; font-weight:700;">RV</span>
          <div style="flex:1;">
            <div style="font-weight:700; font-size:13px; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
              <span>Rishi Verma</span>
              ${isRishi ? '<span class="badge badge-accent" style="font-size:9px; padding:1px 5px;">Active</span>' : ''}
            </div>
            <div class="text-xs text-secondary" style="font-size:11px;">Finder (Reported Blue Bag)</div>
          </div>
        </button>

        <div style="border-top:1px solid var(--border); margin-top:4px; padding-top:6px;">
          <a href="db-admin.html" target="_blank" class="btn btn-ghost btn-block btn-sm" style="justify-content:flex-start; text-align:left; padding:6px 8px; font-size:12px; color:var(--primary); text-decoration:none;">
            <i data-lucide="database" style="width:13px;height:13px;margin-right:6px;"></i>
            <span>Inspect SQLite Database</span>
          </a>
        </div>
      </div>
    `;

    const mobileBtn = headerActions.querySelector('.mobile-menu-btn');
    if (mobileBtn) {
      headerActions.insertBefore(switchContainer, mobileBtn);
    } else {
      headerActions.appendChild(switchContainer);
    }

    const switchBtn = switchContainer.querySelector('#btn-account-switch');
    const switchMenu = switchContainer.querySelector('#account-switch-menu');
    if (switchBtn && switchMenu) {
      switchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = switchMenu.style.display === 'block';
        switchMenu.style.display = isOpen ? 'none' : 'block';
      });
      document.addEventListener('click', () => {
        switchMenu.style.display = 'none';
      });
    }
  }

  const loginBtn = headerActions.querySelector('a[href="login.html"]');
  const signupBtn = headerActions.querySelector('a[href="signup.html"]');
  let userAvatar = headerActions.querySelector('.header-user-avatar');
  let logoutBtn = headerActions.querySelector('.header-logout-btn');

  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';

    if (!userAvatar) {
      userAvatar = document.createElement('a');
      userAvatar.href = 'dashboard.html';
      userAvatar.className = 'avatar avatar-sm header-user-avatar';
      userAvatar.style.textDecoration = 'none';
      if (switchContainer) {
        headerActions.insertBefore(userAvatar, switchContainer);
      } else {
        headerActions.appendChild(userAvatar);
      }
    }
    userAvatar.textContent = currentUser.avatar || 'ST';
    userAvatar.title = `${currentUser.name} (${currentUser.email}) — View Dashboard`;
    userAvatar.style.display = 'inline-flex';

    if (!logoutBtn) {
      logoutBtn = document.createElement('button');
      logoutBtn.type = 'button';
      logoutBtn.className = 'btn btn-ghost btn-sm header-logout-btn';
      logoutBtn.title = 'Sign out of LostLink';
      logoutBtn.innerHTML = '<i data-lucide="log-out" style="width:14px;height:14px;"></i>';
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof LostLinkAPI !== 'undefined') LostLinkAPI.logout();
        showToast('info', 'Logged Out', 'You have been signed out.');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 500);
      });

      if (switchContainer) {
        headerActions.insertBefore(logoutBtn, switchContainer);
      } else {
        headerActions.appendChild(logoutBtn);
      }
    }
    logoutBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (signupBtn) signupBtn.style.display = 'inline-flex';
    if (userAvatar) userAvatar.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';

    if (!loginBtn && !signupBtn) {
      const loginA = document.createElement('a');
      loginA.href = 'login.html';
      loginA.className = 'btn btn-secondary btn-sm';
      loginA.textContent = 'Log in';

      const signupA = document.createElement('a');
      signupA.href = 'signup.html';
      signupA.className = 'btn btn-primary btn-sm';
      signupA.textContent = 'Sign up';

      const mobileBtn = headerActions.querySelector('.mobile-menu-btn');
      if (mobileBtn) {
        headerActions.insertBefore(loginA, mobileBtn);
        headerActions.insertBefore(signupA, mobileBtn);
      } else {
        headerActions.appendChild(loginA);
        headerActions.appendChild(signupA);
      }
    }
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* ============================================
   HEADER — Sticky shadow on scroll
   ============================================ */
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}


/* ============================================
   DARK MODE
   ============================================ */
function initDarkMode() {
  const toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;

  // Load saved preference
  const saved = localStorage.getItem('lostlink-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('lostlink-theme', next);
    updateThemeIcon(next);

    // Re-render lucide icons after theme change
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  });
}

function updateThemeIcon(theme) {
  const toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;

  const sunIcon = toggle.querySelector('.icon-sun');
  const moonIcon = toggle.querySelector('.icon-moon');
  if (sunIcon && moonIcon) {
    sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
    moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
  }
}


/* ============================================
   MOBILE MENU
   ============================================ */
function initMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    nav.classList.toggle('open');
    const isOpen = nav.classList.contains('open');
    btn.setAttribute('aria-expanded', isOpen);

    // Update icon
    const menuIcon = btn.querySelector('[data-lucide="menu"]') || btn.querySelector('.lucide-menu');
    const closeIcon = btn.querySelector('[data-lucide="x"]') || btn.querySelector('.lucide-x');
    if (menuIcon && closeIcon) {
      menuIcon.style.display = isOpen ? 'none' : 'block';
      closeIcon.style.display = isOpen ? 'block' : 'none';
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
}


/* ============================================
   TOAST SYSTEM
   ============================================ */
let toastContainer = null;

function initToastSystem() {
  toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('role', 'status');
    document.body.appendChild(toastContainer);
  }
}

function showToast(type, title, message, duration = 4000) {
  if (!toastContainer) initToastSystem();

  const icons = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon"><i data-lucide="${icons[type] || 'info'}"></i></span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss notification">
      <i data-lucide="x" style="width:16px;height:16px;"></i>
    </button>
  `;

  toastContainer.appendChild(toast);

  // Init lucide icons for this toast
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ nodes: [toast] });
  }

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast) {
  toast.classList.add('toast-leaving');
  setTimeout(() => toast.remove(), 200);
}


/* ============================================
   SHOW MORE / LESS (Categories, etc.)
   ============================================ */
function initShowMore() {
  document.querySelectorAll('[data-show-more]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.dataset.showMore);
      if (!target) return;

      const hidden = target.querySelectorAll('.hidden-item');
      const isShowing = btn.dataset.expanded === 'true';

      hidden.forEach(el => {
        el.style.display = isShowing ? 'none' : '';
      });

      btn.dataset.expanded = isShowing ? 'false' : 'true';
      btn.innerHTML = isShowing
        ? '<i data-lucide="chevron-down"></i> Show more categories'
        : '<i data-lucide="chevron-up"></i> Show fewer categories';

      if (typeof lucide !== 'undefined') {
        lucide.createIcons({ nodes: [btn] });
      }
    });
  });
}


/* ============================================
   SEARCH CLEAR BUTTON
   ============================================ */
function initSearchClear() {
  document.querySelectorAll('.search-bar').forEach(bar => {
    const input = bar.querySelector('.input');
    const clear = bar.querySelector('.search-clear');
    if (!input || !clear) return;

    input.addEventListener('input', () => {
      clear.classList.toggle('visible', input.value.length > 0);
    });

    clear.addEventListener('click', () => {
      input.value = '';
      clear.classList.remove('visible');
      input.focus();
      // Trigger input event for any listeners
      input.dispatchEvent(new Event('input'));
    });
  });
}


/* ============================================
   UTILITY: Format date & time
   ============================================ */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Parse as LOCAL date to avoid UTC-offset day shift (e.g. 2026-10-20 → Oct 19)
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const date = new Date(y, m, d);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return timeStr;
  const minutes = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}


/* ============================================
   UTILITY: Category Icons & Item Cards
   Strictly display user-uploaded photos only;
   Never fallback to random confusing illustrations.
   ============================================ */
function getCategoryIcon(cat) {
  const map = {
    'keys': 'key-round',
    'bags': 'briefcase',
    'electronics': 'laptop',
    'cards': 'credit-card',
    'books': 'book-open',
    'clothing': 'shirt',
    'jewelry': 'gem',
    'pets': 'paw-print'
  };
  return map[cat] || 'package';
}

function renderItemCard(item) {
  const hasUploadedPhoto = item.image && item.image.trim() !== '' && !item.image.includes('assets/images/items/item');
  const imageMarkup = hasUploadedPhoto
    ? `<img src="${item.image}" alt="${item.title}" loading="lazy">`
    : `<div class="no-photo-placeholder"><i data-lucide="${getCategoryIcon(item.category)}"></i><span>No Photo Provided</span></div>`;

  return `
    <a href="item-detail.html?id=${item.id}" class="card item-card">
      <div class="item-card-image">
        ${imageMarkup}
        <span class="badge badge-${item.type}">${item.type === 'lost' ? 'Lost' : 'Found'}</span>
      </div>
      <div class="card-body">
        <h4 class="item-title">${item.title}</h4>
        <div class="item-meta">
          <span><i data-lucide="map-pin"></i> ${item.location}</span>
          <span><i data-lucide="calendar"></i> ${formatDate(item.date)}</span>
        </div>
      </div>
    </a>
  `;
}


/* ============================================
   UTILITY: Get URL parameter
   ============================================ */
function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}


/* ============================================
   UTILITY: Skeleton loaders
   ============================================ */
function renderSkeletonCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card skeleton">
        <div class="skeleton-image skeleton" style="aspect-ratio:4/3;"></div>
        <div style="padding: var(--space-5);">
          <div class="skeleton-heading skeleton"></div>
          <div class="skeleton-text skeleton short"></div>
        </div>
      </div>
    `;
  }
  return html;
}
