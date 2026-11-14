/* ============================================
   LOSTLINK — Dashboard Logic
   Tab navigation, report listings, claim timelines,
   and dynamic authenticated user data.
   ============================================ */

let dashboardState = {
  user: null,
  reports: [],
  claims: [],
  notifications: []
};

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
});

async function initDashboard() {
  const user = (typeof LostLinkAPI !== 'undefined') ? LostLinkAPI.getCurrentUser() : null;

  if (!user) {
    showToast('warning', 'Login Required', 'Please sign in to view your LostLink student dashboard.');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 700);
    return;
  }

  dashboardState.user = user;

  // Setup banner user info
  const nameEl = document.getElementById('dash-user-name');
  const emailEl = document.getElementById('dash-user-email');
  const avatarEl = document.getElementById('dash-user-avatar');
  const logoutBtn = document.getElementById('dash-logout-btn');

  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = `${user.email} · Reg: ${user.regNo || 'SRM Verified'}`;
  if (avatarEl) avatarEl.textContent = user.avatar || 'ST';

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof LostLinkAPI !== 'undefined') LostLinkAPI.logout();
      showToast('info', 'Logged Out', 'Signed out successfully.');
      setTimeout(() => { window.location.href = 'index.html'; }, 500);
    });
  }

  setupTabs();
  setupMarkAllRead();

  // Load dynamic data from API
  await loadUserData();
}

async function loadUserData() {
  let data = null;
  if (typeof LostLinkAPI !== 'undefined') {
    data = await LostLinkAPI.getDashboardData();
  }

  const reports = data ? (data.myReports || []) : [];
  const claims = data ? (data.myClaims || []) : [];
  const notifs = data ? (data.notifications || []) : [];
  const conversations = data ? (data.conversations || []) : [];

  dashboardState.reports = reports;
  dashboardState.claims = claims;
  dashboardState.notifications = notifs;
  dashboardState.conversations = conversations;

  // Update stat cards
  const statReports = document.getElementById('stat-reports');
  const statClaims = document.getElementById('stat-claims');
  const statMatches = document.getElementById('stat-matches');
  const statReunited = document.getElementById('stat-reunited');

  const matchesCount = data && data.overview ? (data.overview.matchesCount || 0) : 0;
  const reunitedCount = data && data.overview ? (data.overview.reunitedCount || 0) : 0;

  if (statReports) statReports.textContent = reports.length;
  if (statClaims) statClaims.textContent = claims.length;
  if (statMatches) statMatches.textContent = matchesCount;
  if (statReunited) statReunited.textContent = reunitedCount;

  // Render tab contents
  renderMyReports(reports);
  renderMyClaims(claims);
  renderMessages(conversations);
  renderNotifications(notifs);

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tabs .tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanelId = `panel-${tab.dataset.tab}`;

      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(p => {
        p.classList.remove('active');
        if (p.id === targetPanelId) {
          p.classList.add('active');
        }
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  });
}

function renderMyReports(reports) {
  const container = document.getElementById('reports-list-container');
  const countEl = document.getElementById('tab-count-reports');
  if (countEl) countEl.textContent = reports.length;
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8); text-align:center;">
        <div class="empty-state-icon"><i data-lucide="package-search"></i></div>
        <h3>No active reports</h3>
        <p>You haven't filed any lost or found item reports yet.</p>
        <a href="report.html" class="btn btn-primary" style="margin-top:var(--space-3);"><i data-lucide="plus"></i> File your first report</a>
      </div>
    `;
    return;
  }

  container.innerHTML = reports.map(item => {
    const hasPhoto = item.image && item.image.trim() !== '' && !item.image.includes('assets/images/items/item');
    const thumbHtml = hasPhoto
      ? `<img src="${item.image}" alt="${item.title}">`
      : `<div class="item-thumb-no-photo" style="width:100%;height:100%;"><i data-lucide="${typeof getCategoryIcon !== 'undefined' ? getCategoryIcon(item.category) : 'package'}"></i></div>`;

    return `
    <div class="report-list-item card">
      <div class="report-thumb">
        ${thumbHtml}
      </div>
      <div class="report-info">
        <div class="flex items-center gap-2" style="margin-bottom:2px;">
          <span class="badge badge-${item.type}">${item.type.toUpperCase()}</span>
          <span class="badge badge-${item.status}">${item.status.toUpperCase()}</span>
        </div>
        <div class="report-title">${item.title}</div>
        <div class="report-date"><i data-lucide="map-pin" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i> ${item.location} · ${formatDate(item.date)}</div>
      </div>
      <div class="flex gap-2" style="flex-shrink:0;">
        <a href="matches.html?reportId=${item.id}" class="btn btn-secondary btn-sm" title="View algorithm matches">
          <i data-lucide="sparkles"></i> Matches
        </a>
        <a href="item-detail.html?id=${item.id}" class="btn btn-ghost btn-sm" title="View details">
          <i data-lucide="eye"></i> View
        </a>
      </div>
    </div>
  `;
  }).join('');
}

function renderMyClaims(claims) {
  const container = document.getElementById('claims-list-container');
  const countEl = document.getElementById('tab-count-claims');
  if (countEl) countEl.textContent = claims.length;
  if (!container) return;

  if (claims.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8); text-align:center;">
        <div class="empty-state-icon"><i data-lucide="shield"></i></div>
        <h3>No claims in progress</h3>
        <p>When you spot a found item that belongs to you and complete verification, it will appear here.</p>
        <a href="browse.html" class="btn btn-secondary" style="margin-top:var(--space-3);">Browse Found Items</a>
      </div>
    `;
    return;
  }

  container.innerHTML = claims.map(item => {
    const hasPhoto = item.image && item.image.trim() !== '' && !item.image.includes('assets/images/items/item');
    const thumbHtml = hasPhoto
      ? `<img src="${item.image}" alt="${item.title}" style="width:56px;height:56px;border-radius:var(--radius-md);object-fit:cover;">`
      : `<div class="item-thumb-no-photo" style="width:56px;height:56px;"><i data-lucide="${typeof getCategoryIcon !== 'undefined' ? getCategoryIcon(item.category) : 'package'}"></i></div>`;

    return `
    <div class="card" style="padding:var(--space-6); margin-bottom:var(--space-4);">
      <div class="flex-between items-center" style="margin-bottom:var(--space-4); flex-wrap:wrap; gap:var(--space-2);">
        <div class="flex items-center gap-3">
          ${thumbHtml}
          <div>
            <h4 style="font-size:var(--text-base);">${item.title}</h4>
            <span class="text-sm text-secondary">Found at ${item.location}</span>
          </div>
        </div>
        <a href="claim.html?id=${item.id}" class="btn btn-primary btn-sm">
          <i data-lucide="ticket"></i> View Collection Pass
        </a>
      </div>

      <div class="status-timeline" style="padding:var(--space-2) 0 0;">
        <div class="timeline-step completed">
          <div class="timeline-dot"><i data-lucide="check" style="width:14px;height:14px;"></i></div>
          <span class="timeline-label">Reported</span>
          <div class="timeline-connector completed"></div>
        </div>
        <div class="timeline-step completed">
          <div class="timeline-dot"><i data-lucide="check" style="width:14px;height:14px;"></i></div>
          <span class="timeline-label">Matched</span>
          <div class="timeline-connector completed"></div>
        </div>
        <div class="timeline-step completed">
          <div class="timeline-dot"><i data-lucide="check" style="width:14px;height:14px;"></i></div>
          <span class="timeline-label">Verified</span>
          <div class="timeline-connector"></div>
        </div>
        <div class="timeline-step active">
          <div class="timeline-dot"><i data-lucide="package" style="width:14px;height:14px;display:block;color:var(--primary-500);"></i></div>
          <span class="timeline-label">Ready for Pickup</span>
        </div>
      </div>
      <div style="margin-top:var(--space-4); display:flex; gap:var(--space-3); justify-content:flex-end;">
        <a href="inbox.html?itemId=${item.id}" class="btn btn-secondary btn-sm">
          <i data-lucide="message-square"></i> Open Handover Chat
        </a>
      </div>
    </div>
  `;
  }).join('');
}

function renderMessages(conversations) {
  const container = document.getElementById('messages-list-container');
  const countEl = document.getElementById('tab-count-messages');
  if (countEl) countEl.textContent = (conversations || []).length;
  if (!container) return;

  if (!conversations || conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8); text-align:center;">
        <div class="empty-state-icon"><i data-lucide="message-square-off"></i></div>
        <h3>No active handover messages</h3>
        <p>When you match with a finder or submit a claim with private details, active handover chats will appear here.</p>
        <a href="browse.html" class="btn btn-secondary" style="margin-top:var(--space-3);">Browse Campus Directory</a>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(c => {
    const hasPhoto = c.image && c.image.trim() !== '' && !c.image.includes('assets/images/items/item');
    const thumbHtml = hasPhoto
      ? `<img src="${c.image}" alt="${c.title}" style="width:52px; height:52px; border-radius:var(--radius-md); object-fit:cover;">`
      : `<div class="item-thumb-no-photo" style="width:52px; height:52px;"><i data-lucide="${typeof getCategoryIcon !== 'undefined' ? getCategoryIcon(c.category) : 'package'}"></i></div>`;

    return `
    <div class="card" style="padding:var(--space-5); margin-bottom:var(--space-3); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-3);">
      <div class="flex items-center gap-3">
        ${thumbHtml}
        <div>
          <div class="flex items-center gap-2">
            <h4 style="font-size:var(--text-base); margin-bottom:2px;">${c.title}</h4>
            <span class="badge badge-${c.type}">${c.type.toUpperCase()}</span>
            ${c.unread_count > 0 ? `<span class="badge badge-error" style="font-size:10px;">${c.unread_count} new</span>` : ''}
          </div>
          <p class="text-xs text-secondary" style="max-width:440px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            Latest: "${c.last_message || 'Active handover thread'}"
          </p>
          <span class="text-xs text-secondary" style="font-size:11px;"><i data-lucide="map-pin" style="width:11px;height:11px;display:inline-block;vertical-align:middle;"></i> ${c.location}</span>
        </div>
      </div>
      <div class="flex gap-2">
        <a href="inbox.html?itemId=${c.item_id}" class="btn btn-primary btn-sm">
          <i data-lucide="message-square"></i> Open Chat
        </a>
      </div>
    </div>
  `;
  }).join('');
}

function renderNotifications(notifs) {
  const container = document.getElementById('notifications-list-container');
  const countEl = document.getElementById('tab-count-notifs');
  if (countEl) {
    const unreadCount = (notifs || []).filter(n => !n.read).length;
    countEl.textContent = unreadCount;
    countEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }
  if (!container) return;

  if (!notifs || notifs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8); text-align:center;">
        <div class="empty-state-icon"><i data-lucide="bell-off"></i></div>
        <h3>No new notifications</h3>
        <p>Activity on your reported items and smart matches will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notifs.map(n => `
    <div class="notification-item ${!n.read ? 'unread' : ''}" data-id="${n.id}">
      ${!n.read ? '<div class="notification-dot"></div>' : '<div style="width:8px;"></div>'}
      <div class="notification-content">
        <div style="font-size:var(--text-sm); font-weight:${!n.read ? '600' : '400'}; color:var(--text-heading);">${n.message}</div>
        <div class="notification-time">${n.time}</div>
      </div>
      <a href="${n.type === 'match' ? 'matches.html?reportId=' + n.itemId : 'item-detail.html?id=' + n.itemId}" class="btn btn-ghost btn-sm" style="flex-shrink:0;">
        View
      </a>
    </div>
  `).join('');
}

function setupMarkAllRead() {
  const btn = document.getElementById('btn-mark-read');
  if (!btn) return;

  btn.addEventListener('click', () => {
    dashboardState.notifications.forEach(n => n.read = true);
    renderNotifications(dashboardState.notifications);
    showToast('info', 'Notifications', 'All notifications marked as read.');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
}
