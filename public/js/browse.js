/* ============================================
   LOSTLINK — Browse Page Logic
   Filtering, search, sorting, URL param sync,
   skeleton loading state, and empty states.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await initBrowsePage();
});

let currentItems = [];
let allCategories = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
let activeFilters = {
  search: '',
  type: 'all',
  categories: [],
  location: '',
  dateFrom: '',
  dateTo: '',
  sort: 'newest'
};

async function initBrowsePage() {
  // Fetch up-to-date items and categories from API if available
  if (typeof LostLinkAPI !== 'undefined') {
    currentItems = await LostLinkAPI.getItems();
    const apiCats = await LostLinkAPI.getCategories();
    if (apiCats && apiCats.length > 0) allCategories = apiCats;
  } else if (typeof ITEMS !== 'undefined') {
    currentItems = [...ITEMS];
  }

  // Populate categories checkboxes
  renderCategoryFilterOptions();

  // Populate location options
  renderLocationFilterOptions();

  // Parse initial query params from URL (e.g. ?q=wallet or ?category=keys or ?type=found)
  parseUrlParams();

  // Setup event listeners
  setupFilterListeners();

  // Initial render with brief skeleton loader for smooth feel
  applyFilters(true);
}

function renderCategoryFilterOptions() {
  const container = document.getElementById('category-filters');
  if (!container) return;

  container.innerHTML = allCategories.map(cat => `
    <label class="filter-option" style="cursor: pointer;">
      <input type="checkbox" name="category" value="${cat.id}" ${activeFilters.categories.includes(cat.id) ? 'checked' : ''}>
      <span>${cat.name}</span>
      <span class="filter-count">${cat.count || 0}</span>
    </label>
  `).join('');
}

async function renderLocationFilterOptions() {
  const select = document.getElementById('location-filter');
  if (!select) return;

  let locs = typeof LOCATIONS !== 'undefined' ? LOCATIONS : [];
  if (typeof LostLinkAPI !== 'undefined' && LostLinkAPI.getLocations) {
    try {
      const fetched = await LostLinkAPI.getLocations();
      if (fetched && fetched.length > 0) locs = fetched;
    } catch (e) {}
  }
  select.innerHTML = '<option value="">All locations</option>';
  locs.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    if (activeFilters.location === loc) opt.selected = true;
    select.appendChild(opt);
  });
}

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  
  const q = params.get('q');
  if (q) {
    activeFilters.search = q.trim();
    const searchInput = document.getElementById('browse-search');
    if (searchInput) {
      searchInput.value = activeFilters.search;
      const clearBtn = searchInput.parentElement.querySelector('.search-clear');
      if (clearBtn) clearBtn.classList.add('visible');
    }
  }

  const cat = params.get('category');
  if (cat) {
    activeFilters.categories = [cat];
    const cb = document.querySelector(`input[name="category"][value="${cat}"]`);
    if (cb) cb.checked = true;
  }

  const type = params.get('type');
  if (type && ['all', 'lost', 'found'].includes(type)) {
    activeFilters.type = type;
    const radio = document.querySelector(`input[name="type"][value="${type}"]`);
    if (radio) radio.checked = true;
  }

  // Update counts on type radios
  const lostCount = currentItems.filter(i => i.type === 'lost').length;
  const foundCount = currentItems.filter(i => i.type === 'found').length;
  const countLostEl = document.getElementById('count-lost');
  const countFoundEl = document.getElementById('count-found');
  if (countLostEl) countLostEl.textContent = lostCount;
  if (countFoundEl) countFoundEl.textContent = foundCount;
}

function setupFilterListeners() {
  // Search input with debounce
  const searchInput = document.getElementById('browse-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        activeFilters.search = e.target.value.trim().toLowerCase();
        applyFilters(false);
      }, 250);
    });
  }

  // Type radios
  document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      activeFilters.type = e.target.value;
      applyFilters(false);
    });
  });

  // Category checkboxes
  const catContainer = document.getElementById('category-filters');
  if (catContainer) {
    catContainer.addEventListener('change', () => {
      const checked = Array.from(catContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);
      activeFilters.categories = checked;
      applyFilters(false);
    });
  }

  // Location filter
  const locSelect = document.getElementById('location-filter');
  if (locSelect) {
    locSelect.addEventListener('change', (e) => {
      activeFilters.location = e.target.value;
      applyFilters(false);
    });
  }

  // Date filters
  const dateFrom = document.getElementById('date-from');
  const dateTo = document.getElementById('date-to');
  if (dateFrom) {
    dateFrom.addEventListener('change', (e) => {
      activeFilters.dateFrom = e.target.value;
      applyFilters(false);
    });
  }
  if (dateTo) {
    dateTo.addEventListener('change', (e) => {
      activeFilters.dateTo = e.target.value;
      applyFilters(false);
    });
  }

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeFilters.sort = e.target.value;
      applyFilters(false);
    });
  }

  // Clear filters
  const clearBtn = document.getElementById('clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllFilters);
  }

  // Mobile sidebar toggle
  const filterToggleBtn = document.getElementById('filter-toggle');
  const sidebar = document.getElementById('filter-sidebar');
  const applyMobileBtn = document.getElementById('apply-filters-mobile');

  if (filterToggleBtn && sidebar) {
    filterToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (applyMobileBtn) applyMobileBtn.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    });
  }

  if (applyMobileBtn && sidebar) {
    applyMobileBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      applyMobileBtn.style.display = 'none';
    });
  }
}

function clearAllFilters() {
  activeFilters = {
    search: '',
    type: 'all',
    categories: [],
    location: '',
    dateFrom: '',
    dateTo: '',
    sort: 'newest'
  };

  // Reset inputs
  const searchInput = document.getElementById('browse-search');
  if (searchInput) {
    searchInput.value = '';
    const clearBtn = searchInput.parentElement.querySelector('.search-clear');
    if (clearBtn) clearBtn.classList.remove('visible');
  }

  const allTypeRadio = document.querySelector('input[name="type"][value="all"]');
  if (allTypeRadio) allTypeRadio.checked = true;

  document.querySelectorAll('#category-filters input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  const locSelect = document.getElementById('location-filter');
  if (locSelect) locSelect.value = '';

  const dateFrom = document.getElementById('date-from');
  if (dateFrom) dateFrom.value = '';

  const dateTo = document.getElementById('date-to');
  if (dateTo) dateTo.value = '';

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'newest';

  applyFilters(false);
  showToast('info', 'Filters Cleared', 'All filters have been reset.');
}

function applyFilters(showSkeleton = false) {
  const grid = document.getElementById('items-grid');
  const emptyState = document.getElementById('empty-state');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const countEl = document.getElementById('results-count');

  if (showSkeleton && skeletonGrid && grid) {
    grid.style.display = 'none';
    skeletonGrid.style.display = 'grid';
    skeletonGrid.innerHTML = renderSkeletonCards(6);
    setTimeout(() => {
      skeletonGrid.style.display = 'none';
      grid.style.display = 'grid';
      renderFilteredItems();
    }, 280);
  } else {
    if (skeletonGrid) skeletonGrid.style.display = 'none';
    if (grid) grid.style.display = 'grid';
    renderFilteredItems();
  }
}

async function renderFilteredItems() {
  const grid = document.getElementById('items-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('results-count');

  let results = [];
  if (typeof LostLinkAPI !== 'undefined') {
    results = await LostLinkAPI.getItems(activeFilters);
  } else {
    results = ITEMS.filter(item => {
      if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchLoc = item.location.toLowerCase().includes(q);
        const matchColor = item.color.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLoc && !matchColor) return false;
      }
      if (activeFilters.type !== 'all' && item.type !== activeFilters.type) return false;
      if (activeFilters.categories.length > 0 && !activeFilters.categories.includes(item.category)) return false;
      if (activeFilters.location && item.location !== activeFilters.location) return false;
      if (activeFilters.dateFrom && item.date < activeFilters.dateFrom) return false;
      if (activeFilters.dateTo && item.date > activeFilters.dateTo) return false;
      return true;
    });

    if (activeFilters.sort === 'newest') {
      results.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (activeFilters.sort === 'oldest') {
      results.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (activeFilters.sort === 'a-z') {
      results.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  // Update counter
  if (countEl) countEl.textContent = results.length;

  // Render cards or empty state
  if (results.length === 0) {
    if (grid) grid.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = 'flex';
      const hasActiveFilters = Boolean(
        activeFilters.search ||
        (activeFilters.type && activeFilters.type !== 'all') ||
        (activeFilters.categories && activeFilters.categories.length > 0) ||
        activeFilters.location ||
        activeFilters.dateFrom ||
        activeFilters.dateTo
      );

      if (hasActiveFilters) {
        emptyState.innerHTML = `
          <div class="empty-state-icon"><i data-lucide="search-x"></i></div>
          <h3>No items match your filters</h3>
          <p>Try clearing some filters or search keywords to find what you're looking for.</p>
          <button class="btn btn-primary" onclick="clearAllFilters()" style="margin-top:var(--space-2);"><i data-lucide="rotate-ccw"></i> Clear filters</button>
        `;
      } else {
        emptyState.innerHTML = `
          <div class="empty-state-icon"><i data-lucide="package-open"></i></div>
          <h3>No items reported yet</h3>
          <p>The campus lost and found database is currently empty. Be the first to file a report!</p>
          <a href="report.html" class="btn btn-primary" style="margin-top:var(--space-2);"><i data-lucide="plus"></i> Report an Item</a>
        `;
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } else {
    if (emptyState) emptyState.style.display = 'none';
    if (grid) {
      grid.style.display = 'grid';
      grid.innerHTML = results.map(renderItemCard).join('');
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  }
}

// Expose clearAllFilters globally for inline HTML button triggers
window.clearAllFilters = clearAllFilters;
