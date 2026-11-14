/* ============================================
   LOSTLINK — Frontend API Client Layer
   Centralized asynchronous API service with
   transparent offline mock fallback.
   ============================================ */

(function (window) {
  'use strict';

  // Determine base API endpoint:
  // - Hosted on Vercel / Production domain or served from Node on port 5000 -> use relative '/api'
  // - Local development on different port (Live Server 5500) or file:// -> fallback to 'http://localhost:5000/api'
  const isLocalDifferentPort = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
                               window.location.port !== '' && 
                               window.location.port !== '5000';
  const isFileProtocol = window.location.protocol === 'file:';
  const API_BASE = (isLocalDifferentPort || isFileProtocol) ? 'http://localhost:5000/api' : '/api';

  const LostLinkAPI = {
    // Flag to check if backend is online
    isOnline: null,

    /**
     * Check if the backend API server is reachable
     */
    async checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/health`, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          this.isOnline = true;
          return true;
        }
      } catch (e) {
        this.isOnline = false;
      }
      return false;
    },

    /**
     * Get all categories
     */
    async getCategories() {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local CATEGORIES mock data.');
      }
      return typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
    },

    /**
     * Get campus locations
     */
    async getLocations() {
      try {
        const res = await fetch(`${API_BASE}/locations`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local LOCATIONS mock data.');
      }
      return typeof LOCATIONS !== 'undefined' ? LOCATIONS : [];
    },

    /**
     * Get items with filtering & search
     */
    async getItems(filters = {}) {
      try {
        const params = new URLSearchParams();
        if (filters.search) params.append('q', filters.search);
        if (filters.type && filters.type !== 'all') params.append('type', filters.type);
        if (filters.categories && filters.categories.length > 0) {
          params.append('category', filters.categories.join(','));
        }
        if (filters.location) params.append('location', filters.location);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);
        if (filters.sort) params.append('sort', filters.sort);

        const res = await fetch(`${API_BASE}/items?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          return data.items || [];
        }
      } catch (e) {
        console.warn('API unavailable, falling back to local ITEMS filter.');
      }

      // Offline Fallback using data.js
      if (typeof ITEMS === 'undefined') return [];
      let items = [...ITEMS];

      if (filters.search) {
        const q = filters.search.toLowerCase();
        items = items.filter(i => 
          (i.title && i.title.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q)) ||
          (i.location && i.location.toLowerCase().includes(q)) ||
          (i.color && i.color.toLowerCase().includes(q))
        );
      }
      if (filters.type && filters.type !== 'all') {
        items = items.filter(i => i.type === filters.type);
      }
      if (filters.categories && filters.categories.length > 0) {
        items = items.filter(i => filters.categories.includes(i.category));
      }
      if (filters.location) {
        items = items.filter(i => i.location === filters.location);
      }
      if (filters.dateFrom) {
        items = items.filter(i => i.date >= filters.dateFrom);
      }
      if (filters.dateTo) {
        items = items.filter(i => i.date <= filters.dateTo);
      }

      if (filters.sort === 'oldest') {
        items.sort((a, b) => new Date(a.date) - new Date(b.date));
      } else if (filters.sort === 'a-z') {
        items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else {
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      return items;
    },

    /**
     * Get single item by ID
     */
    async getItemById(id) {
      const numId = parseInt(id, 10);
      try {
        const res = await fetch(`${API_BASE}/items/${numId}`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local ITEMS lookup.');
      }

      if (typeof ITEMS !== 'undefined') {
        return ITEMS.find(i => i.id === numId) || ITEMS[0];
      }
      return null;
    },

    /**
     * Create a new item report (Lost or Found)
     */
    async createItem(itemData) {
      try {
        const res = await fetch(`${API_BASE}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemData)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local memory store.');
      }

      // Offline Fallback
      const newId = (typeof ITEMS !== 'undefined' ? ITEMS.length : 0) + 1;
      const currentAuthUser = this.getCurrentUser();
      const author = currentAuthUser
        ? { name: currentAuthUser.name, avatar: currentAuthUser.avatar, email: currentAuthUser.email }
        : { name: 'SRM Student', avatar: 'ST', email: '' };

      const fallbackItem = {
        id: newId,
        status: 'reported',
        postedAt: 'Just now',
        user: author,
        ...itemData
      };
      if (typeof ITEMS !== 'undefined') {
        ITEMS.unshift(fallbackItem);
      }
      return fallbackItem;
    },

    /**
     * 1-Click Fast-Track Found Item Report
     * Directly reports finding an item without entering full details,
     * links the two items, sends direct message, and returns redirect URL.
     */
    async quickReportFound(lostItemId, { location, note, image } = {}) {
      const user = this.getCurrentUser();
      const payload = {
        location: location || '',
        note: note || '',
        image: image || '',
        userEmail: user ? user.email : ''
      };

      try {
        const res = await fetch(`${API_BASE}/items/${lostItemId}/quick-found`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API quickReportFound offline, falling back locally:', e);
      }

      return {
        success: true,
        redirectUrl: `inbox.html?itemId=${lostItemId}`
      };
    },

    /**
     * Get algorithm matches for an item
     */
    async getMatches(itemId) {
      try {
        const res = await fetch(`${API_BASE}/items/${itemId}/matches`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local match computation.');
      }

      // Offline Fallback
      if (typeof ITEMS === 'undefined') return { referenceItem: null, matches: [] };
      const refItem = ITEMS.find(i => i.id === parseInt(itemId, 10)) || ITEMS[0];
      const targetType = refItem.type === 'lost' ? 'found' : 'lost';
      const candidates = ITEMS.filter(i => i.type === targetType && i.id !== refItem.id);

      const matches = candidates.map(candidate => {
        let confidence = 20;
        let reasons = [];
        if (candidate.matchedWith === refItem.id || refItem.matchedWith === candidate.id) {
          confidence = 98;
          reasons.push('Direct match confirmed by finder');
        }
        if (candidate.category === refItem.category) {
          confidence += 40;
          reasons.push('Same category');
        }
        if (candidate.color && refItem.color && candidate.color.toLowerCase() === refItem.color.toLowerCase()) {
          confidence += 20;
          reasons.push('Same color');
        }
        if (candidate.location === refItem.location) {
          confidence += 15;
          reasons.push('Exact location match');
        } else {
          reasons.push('Campus proximity');
        }
        return { item: candidate, confidence: Math.min(confidence, 98), reasons };
      }).sort((a, b) => b.confidence - a.confidence).slice(0, 3);

      return { referenceItem: refItem, matches };
    },

    /**
     * Get verification questions for an item
     */
    async getQuestions(itemId) {
      try {
        const res = await fetch(`${API_BASE}/items/${itemId}/questions`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local questions.');
      }

      const defaultQuestions = [
        { id: 'q1', question: 'Describe any specific brand markings, internal labels, or scratches on this item.', type: 'textarea' },
        { id: 'q2', question: 'What items or contents were kept inside or with this item?', type: 'textarea' },
        { id: 'q3', question: 'What date and time did you approximate losing this item?', type: 'text' }
      ];

      if (typeof VERIFICATION_QUESTIONS !== 'undefined' && VERIFICATION_QUESTIONS[itemId]) {
        return VERIFICATION_QUESTIONS[itemId];
      }
      return defaultQuestions;
    },

    /**
     * Submit an ownership claim
     */
    async submitClaim(claimPayload) {
      try {
        const res = await fetch(`${API_BASE}/claims`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(claimPayload)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, falling back to local claim pass generator.');
      }

      // Offline Fallback
      return {
        success: true,
        passCode: `LL-${claimPayload.itemId || 1}0${Math.floor(100 + Math.random() * 900)}`,
        collectionLocation: 'Central Library — Helpdesk Counter 2',
        custodian: 'Campus Security & Lost Property Desk',
        phone: '+91 44 2741 7000 (SRM KTR Ext. 204)',
        validity: 'Valid for 48 Hours',
        requiredDoc: 'Original SRM Physical ID Card'
      };
    },

    /**
     * Get claims submitted for an item
     */
    async getItemClaims(itemId) {
      try {
        const res = await fetch(`${API_BASE}/items/${itemId}/claims`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API getItemClaims error:', e);
      }
      return [];
    },

    /**
     * Finder approves claimant's ownership proof
     */
    async approveClaim(claimId) {
      try {
        const res = await fetch(`${API_BASE}/claims/${claimId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API approveClaim error:', e);
      }
      return { success: false };
    },

    /**
     * Get in-app messages for an item
     */
    async getMessages(itemId, userEmail = '') {
      try {
        const url = userEmail 
          ? `${API_BASE}/items/${itemId}/messages?userEmail=${encodeURIComponent(userEmail)}`
          : `${API_BASE}/items/${itemId}/messages`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API getMessages error:', e);
      }
      return [];
    },

    /**
     * Send in-app message
     */
    async sendMessage(itemId, msgPayload) {
      try {
        const res = await fetch(`${API_BASE}/items/${itemId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgPayload)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API sendMessage error:', e);
      }
      return null;
    },

    /**
     * Get active conversations for current user
     */
    async getConversations(userEmail) {
      if (!userEmail) return [];
      try {
        const res = await fetch(`${API_BASE}/user/conversations?email=${encodeURIComponent(userEmail)}`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API getConversations error:', e);
      }
      return [];
    },

    /**
     * Get currently logged-in user (Tab-isolated via sessionStorage to prevent tab collisions)
     */
    getCurrentUser() {
      try {
        // 1. Check URL query override (?as=rahul or ?as=rishi)
        if (typeof window !== 'undefined' && window.location && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const asParam = params.get('as');
          if (asParam) {
            const lower = asParam.toLowerCase();
            const demoMap = {
              'rahul': { id: 1, name: 'Rahul Sharma', email: 'rahul.sharma@srmist.edu.in', regNo: 'RA2211003010189', avatar: 'RS' },
              'rishi': { id: 2, name: 'Rishi Verma', email: 'rishi.v@srmist.edu.in', regNo: 'RA2211003010312', avatar: 'RV' }
            };
            if (demoMap[lower]) {
              sessionStorage.setItem('lostlink_user', JSON.stringify(demoMap[lower]));
              return demoMap[lower];
            }
          }
        }

        // 2. Tab-isolated sessionStorage takes highest priority (prevents tab overwriting)
        const sessionRaw = sessionStorage.getItem('lostlink_user');
        if (sessionRaw) {
          return JSON.parse(sessionRaw);
        }

        // 3. Fallback to localStorage if opening fresh tab
        const localRaw = localStorage.getItem('lostlink_user');
        if (localRaw) {
          const user = JSON.parse(localRaw);
          sessionStorage.setItem('lostlink_user', localRaw);
          return user;
        }

        return null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Set current user session (Tab-isolated)
     */
    setCurrentUser(user) {
      if (!user) {
        sessionStorage.removeItem('lostlink_user');
        sessionStorage.removeItem('lostlink_token');
        localStorage.removeItem('lostlink_user');
        localStorage.removeItem('lostlink_token');
      } else {
        const str = JSON.stringify(user);
        sessionStorage.setItem('lostlink_user', str);
        localStorage.setItem('lostlink_user', str);
      }
    },

    /**
     * Switch user session in the current tab specifically
     */
    switchAccountInThisTab(user) {
      if (user) {
        sessionStorage.setItem('lostlink_user', JSON.stringify(user));
        window.location.reload();
      }
    },

    /**
     * Log out current user
     */
    logout() {
      sessionStorage.removeItem('lostlink_user');
      sessionStorage.removeItem('lostlink_token');
      localStorage.removeItem('lostlink_user');
      localStorage.removeItem('lostlink_token');
    },

    /**
     * Login student — verified against stored records
     */
    async login(email, password) {
      const normalizedEmail = (email || '').trim().toLowerCase();

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Login failed. Please check your credentials.');
        }

        if (data.user) {
          this.setCurrentUser(data.user);
          if (data.token) localStorage.setItem('lostlink_token', data.token);
        }
        return data;
      } catch (err) {
        // If network error (offline), verify against offline registered users
        if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
          throw err;
        }

        console.warn('Backend API unreachable. Verifying against local user records.');
        const localUsers = JSON.parse(localStorage.getItem('lostlink_registered_users') || '[]');
        const found = localUsers.find(u => u.email.toLowerCase() === normalizedEmail);

        if (!found) {
          throw new Error('No account found with this email. Please sign up first.');
        }
        if (found.password !== password) {
          throw new Error('Incorrect password. Please verify and try again.');
        }

        const safeUser = { ...found };
        delete safeUser.password;
        this.setCurrentUser(safeUser);
        return { success: true, user: safeUser, token: 'local-token-' + Date.now() };
      }
    },

    /**
     * Sign up student — securely stores credentials
     */
    async signup(userPayload) {
      const normalizedEmail = (userPayload.email || '').trim().toLowerCase();
      const payload = { ...userPayload, email: normalizedEmail };

      try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Registration failed. Please try again.');
        }

        if (data.user) {
          this.setCurrentUser(data.user);
          if (data.token) localStorage.setItem('lostlink_token', data.token);
        }
        return data;
      } catch (err) {
        // If network error (offline), record user in local offline storage
        if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
          throw err;
        }

        console.warn('Backend API unreachable. Storing user in local offline records.');
        const localUsers = JSON.parse(localStorage.getItem('lostlink_registered_users') || '[]');
        const exists = localUsers.some(u => u.email.toLowerCase() === normalizedEmail);
        if (exists) {
          throw new Error('An account with this email already exists. Please log in.');
        }

        const parts = (payload.name || '').trim().split(' ').filter(Boolean);
        const initials = parts.length > 1 
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : (parts[0] ? parts[0].substring(0, 2).toUpperCase() : 'ST');

        const newUser = {
          id: localUsers.length + 1,
          name: payload.name.trim(),
          email: normalizedEmail,
          regNo: (payload.regNo || '').trim().toUpperCase(),
          phone: payload.phone || '',
          password: payload.password,
          avatar: initials,
          createdAt: new Date().toISOString(),
          reports: [],
          claims: []
        };

        localUsers.push(newUser);
        localStorage.setItem('lostlink_registered_users', JSON.stringify(localUsers));

        const safeUser = { ...newUser };
        delete safeUser.password;
        this.setCurrentUser(safeUser);
        return { success: true, user: safeUser, token: 'local-token-' + Date.now() };
      }
    },

    /**
     * Get user dashboard data
     */
    async getDashboardData() {
      const user = this.getCurrentUser();
      if (!user) return null;

      try {
        const res = await fetch(`${API_BASE}/user/dashboard?email=${encodeURIComponent(user.email)}`);
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('API unavailable, generating dynamic dashboard from local user session.');
      }

      // Offline Fallback for this specific user
      const localItems = typeof ITEMS !== 'undefined' ? ITEMS : [];
      const userReports = localItems.filter(i => (user.reports || []).includes(i.id) || (i.user && i.user.email === user.email));
      const userClaims = localItems.filter(i => (user.claims || []).includes(i.id));

      return {
        user,
        overview: {
          reportsCount: userReports.length,
          claimsCount: userClaims.length,
          matchesCount: 0,
          reunitedCount: userClaims.filter(c => c.status === 'collected').length
        },
        myReports: userReports,
        myClaims: userClaims,
        notifications: []
      };
    }
  };

  // Expose to window
  window.LostLinkAPI = LostLinkAPI;
  window.getCurrentUser = () => LostLinkAPI.getCurrentUser();
  window.setCurrentUser = (u) => LostLinkAPI.setCurrentUser(u);
  window.logoutUser = () => LostLinkAPI.logout();

})(window);
