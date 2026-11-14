/**
 * LostLink — Unified Database Layer
 * Dual-mode adapter:
 * 1. Primary: SQLite 3 via better-sqlite3 (with /tmp replication on Vercel Serverless)
 * 2. Fallback: High-performance in-memory / JSON store (if better-sqlite3 native addon is unavailable on serverless)
 * Stores users, items, claims, matches, messages, and notifications for SRMIST KTR.
 */

const path = require('path');
const fs = require('fs');

const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (e) {
  Database = null;
}

let db = null;
let useSqlite = false;

// 1. Try SQLite initialization
if (Database) {
  try {
    let dbPath = path.join(__dirname, 'data', 'lostlink.db');
    if (isVercel) {
      const tmpDbPath = path.join('/tmp', 'lostlink.db');
      if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
        try {
          fs.copyFileSync(dbPath, tmpDbPath);
        } catch (copyErr) {
          console.warn('Notice: Could not copy seed sqlite db to /tmp:', copyErr.message);
        }
      }
      dbPath = tmpDbPath;
    } else {
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    db = new Database(dbPath);
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
    } catch (pragmaErr) {
      // On some serverless filesystems WAL is not allowed, fallback to DELETE journal
      try { db.pragma('journal_mode = DELETE'); } catch (e) {}
    }

    initSchema(db);
    useSqlite = true;
    console.log(`[LostLink DB] Running in SQLite Mode (${dbPath})`);
  } catch (err) {
    console.warn('[LostLink DB] SQLite initialization warning:', err.message);
    useSqlite = false;
    db = null;
  }
}

// -------------------------------------------------------------
// IN-MEMORY / JSON STORE (Vercel Serverless Resilience Engine)
// -------------------------------------------------------------
const memoryStore = {
  users: [],
  items: [],
  claims: [],
  matches: [],
  messages: [],
  notifications: [],
  categories: [],
  locations: []
};

function initMemoryStore() {
  // Load initial dataset from data/db.json if available
  let rawSeed = null;
  let jsonPath = path.join(__dirname, 'data', 'db.json');
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join(process.cwd(), 'data', 'db.json');
  }
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join(__dirname, '..', 'data', 'db.json');
  }
  if (fs.existsSync(jsonPath)) {
    try {
      rawSeed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {}
  }

  // Categories
  memoryStore.categories = (rawSeed && rawSeed.CATEGORIES) ? [...rawSeed.CATEGORIES] : [
    { id: 'keys', name: 'Keys', icon: 'key-round', count: 1 },
    { id: 'bags', name: 'Bags', icon: 'briefcase', count: 2 },
    { id: 'electronics', name: 'Electronics', icon: 'laptop', count: 3 },
    { id: 'cards', name: 'Cards / IDs', icon: 'credit-card', count: 1 },
    { id: 'books', name: 'Books', icon: 'book-open', count: 0 },
    { id: 'clothing', name: 'Clothing', icon: 'shirt', count: 1 },
    { id: 'jewelry', name: 'Jewelry', icon: 'gem', count: 0 },
    { id: 'pets', name: 'Pets', icon: 'paw-print', count: 0 }
  ];

  // Locations (20 SRM Locations)
  memoryStore.locations = (rawSeed && rawSeed.LOCATIONS) ? [...rawSeed.LOCATIONS] : [
    'ARCH GATE', 'GENZ CAFE', 'MEENAKSHI HOSTEL', 'MEENAKSHI PRINT SHOP',
    'JAVA CANTEEN', 'UB BUILDING', 'NRI HOSTEL', 'CHEM LAB',
    'VALLIAMAI GATE', 'TRS GATE', 'HUMANITIES BLOCK', 'TP', 'TP2',
    'BIO TECH BLOCK', 'ARCHITECTURE BLOCK GROUND', 'PARKING UB',
    'PARKING AUDITORIUM', 'AUDITORIUM 1', 'MINI AUDITORIUM', 'ANY OTHER SPECIFIED'
  ];

  // Users (Defaults for Rahul, Rishi, etc.)
  memoryStore.users = (rawSeed && rawSeed.USERS) ? [...rawSeed.USERS] : [
    { id: 1, name: 'Rahul Sharma', email: 'rahul.sharma@srmist.edu.in', reg_no: 'RA2211003010189', phone: '9876543210', password: 'Password123', avatar: 'RS' },
    { id: 2, name: 'Rishi Verma', email: 'rishi.v@srmist.edu.in', reg_no: 'RA2211003010312', phone: '9876543215', password: 'Password123', avatar: 'RV' },
    { id: 3, name: 'Aditi Rao', email: 'aditi.rao@srmist.edu.in', reg_no: 'RA2211003010245', phone: '9876543211', password: 'Password123', avatar: 'AR' },
    { id: 4, name: 'Priya Sundaram', email: 'priya.s@srmist.edu.in', reg_no: 'RA2211003010555', phone: '9876543212', password: 'Password123', avatar: 'PS' },
    { id: 5, name: 'Campus Security Desk', email: 'security.desk@srmist.edu.in', reg_no: 'STAFF-SEC-01', phone: '04427417000', password: 'Password123', avatar: 'SD' }
  ];

  // Items
  if (rawSeed && rawSeed.ITEMS && rawSeed.ITEMS.length > 0) {
    memoryStore.items = rawSeed.ITEMS.map(i => ({
      id: i.id,
      type: i.type,
      status: i.status || 'reported',
      title: i.title,
      category: i.category,
      color: i.color || 'Unspecified',
      description: i.description || '',
      location: i.location,
      date: i.date,
      time: i.time || '12:00',
      image: i.image || '',
      images_json: JSON.stringify(i.images || (i.image ? [i.image] : [])),
      user_name: i.user ? i.user.name : (i.user_name || 'SRM Student'),
      user_avatar: i.user ? i.user.avatar : (i.user_avatar || 'ST'),
      user_email: i.user ? i.user.email : (i.user_email || ''),
      matched_with: i.matchedWith || i.matched_with || null,
      posted_at: i.postedAt || i.posted_at || 'Recently'
    }));
  } else {
    memoryStore.items = [
      {
        id: 1, type: 'lost', status: 'reported', title: 'Navy Blue Wildcraft Backpack', category: 'bags', color: 'Blue',
        description: 'Navy blue Wildcraft backpack with two main compartments. Contains semester notebooks, Casio calculator, and SRM student ID card.',
        location: 'TP', date: '2026-11-11', time: '14:30', image: '', images_json: '[]',
        user_name: 'Rahul Sharma', user_avatar: 'RS', user_email: 'rahul.sharma@srmist.edu.in', posted_at: 'Yesterday'
      },
      {
        id: 8, type: 'found', status: 'reported', title: 'Sky Blue Skybags College Backpack', category: 'bags', color: 'Blue',
        description: 'Sky blue backpack found on a bench near University Building 4th floor staircase. Has front zip compartments. Safe at department desk.',
        location: 'UB BUILDING', date: '2026-11-12', time: '11:00', image: '', images_json: '[]',
        user_name: 'Rishi Verma', user_avatar: 'RV', user_email: 'rishi.v@srmist.edu.in', posted_at: '2 hours ago'
      }
    ];
  }
}

if (!useSqlite) {
  initMemoryStore();
  console.log('[LostLink DB] Running in Serverless In-Memory Mode with Seed Data');
}

// Initialize SQLite Schema & Seed
function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      reg_no TEXT,
      phone TEXT,
      password TEXT NOT NULL,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'reported',
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT,
      description TEXT,
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      image TEXT,
      images_json TEXT,
      user_name TEXT,
      user_avatar TEXT,
      user_email TEXT,
      matched_with INTEGER,
      posted_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      claimant_name TEXT NOT NULL,
      claimant_email TEXT NOT NULL,
      claimant_reg_no TEXT NOT NULL,
      secret_details TEXT NOT NULL,
      answers_json TEXT,
      pass_code TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lost_item_id INTEGER NOT NULL,
      found_item_id INTEGER NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 20,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      text TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      item_id INTEGER,
      type TEXT DEFAULT 'info',
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
  `);

  seedData(database);
}

function seedData(database) {
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = database.prepare(`
      INSERT INTO users (name, email, reg_no, phone, password, avatar)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('Rahul Sharma', 'rahul.sharma@srmist.edu.in', 'RA2211003010189', '9876543210', 'Password123', 'RS');
    insertUser.run('Rishi Verma', 'rishi.v@srmist.edu.in', 'RA2211003010312', '9876543215', 'Password123', 'RV');
    insertUser.run('Aditi Rao', 'aditi.rao@srmist.edu.in', 'RA2211003010245', '9876543211', 'Password123', 'AR');
    insertUser.run('Priya Sundaram', 'priya.s@srmist.edu.in', 'RA2211003010555', '9876543212', 'Password123', 'PS');
    insertUser.run('Campus Security Desk', 'security.desk@srmist.edu.in', 'STAFF-SEC-01', '04427417000', 'Password123', 'SD');
  }

  const categoryCount = database.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (categoryCount === 0) {
    const insertCat = database.prepare('INSERT INTO categories (id, name, icon, count) VALUES (?, ?, ?, ?)');
    insertCat.run('keys', 'Keys', 'key-round', 1);
    insertCat.run('bags', 'Bags', 'briefcase', 2);
    insertCat.run('electronics', 'Electronics', 'laptop', 3);
    insertCat.run('cards', 'Cards / IDs', 'credit-card', 1);
    insertCat.run('books', 'Books', 'book-open', 0);
    insertCat.run('clothing', 'Clothing', 'shirt', 1);
    insertCat.run('jewelry', 'Jewelry', 'gem', 0);
    insertCat.run('pets', 'Pets', 'paw-print', 0);
  }

  const locationCount = database.prepare('SELECT COUNT(*) as count FROM locations').get().count;
  if (locationCount === 0) {
    const insertLoc = database.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)');
    const locs = [
      'ARCH GATE', 'GENZ CAFE', 'MEENAKSHI HOSTEL', 'MEENAKSHI PRINT SHOP',
      'JAVA CANTEEN', 'UB BUILDING', 'NRI HOSTEL', 'CHEM LAB',
      'VALLIAMAI GATE', 'TRS GATE', 'HUMANITIES BLOCK', 'TP', 'TP2',
      'BIO TECH BLOCK', 'ARCHITECTURE BLOCK GROUND', 'PARKING UB',
      'PARKING AUDITORIUM', 'AUDITORIUM 1', 'MINI AUDITORIUM', 'ANY OTHER SPECIFIED'
    ];
    locs.forEach(loc => insertLoc.run(loc));
  }

  const itemCount = database.prepare('SELECT COUNT(*) as count FROM items').get().count;
  if (itemCount === 0) {
    const insertItem = database.prepare(`
      INSERT INTO items (
        id, type, status, title, category, color, description, location,
        date, time, image, images_json, user_name, user_avatar, user_email, posted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertItem.run(
      1, 'lost', 'reported', 'Navy Blue Wildcraft Backpack', 'bags', 'Blue',
      'Navy blue Wildcraft backpack with two main compartments and an orange bottle holder. Contains semester notebooks, Casio calculator, and SRM student ID card.',
      'TP', '2026-11-11', '14:30', '', JSON.stringify([]),
      'Rahul Sharma', 'RS', 'rahul.sharma@srmist.edu.in', 'Yesterday'
    );

    insertItem.run(
      8, 'found', 'reported', 'Sky Blue Skybags College Backpack', 'bags', 'Blue',
      'Sky blue backpack found on a bench near University Building 4th floor staircase. Has front zip compartments. Safe at department desk.',
      'UB BUILDING', '2026-11-12', '11:00', '', JSON.stringify([]),
      'Rishi Verma', 'RV', 'rishi.v@srmist.edu.in', '2 hours ago'
    );
  }
}

// -------------------------------------------------------------
// UNIFIED DATA ACCESS API (Dual-Mode SQLite / In-Memory)
// -------------------------------------------------------------
const LostLinkDB = {
  get db() {
    if (useSqlite && db) return db;
    // Mock prepare for in-memory mode (supports basic SELECT queries in admin)
    return {
      prepare(sql) {
        return {
          all(...params) {
            const trimmed = sql.trim().toLowerCase();
            if (trimmed.includes('from users')) return memoryStore.users;
            if (trimmed.includes('from items')) return memoryStore.items;
            if (trimmed.includes('from claims')) return memoryStore.claims;
            if (trimmed.includes('from messages')) return memoryStore.messages;
            if (trimmed.includes('from categories')) return memoryStore.categories;
            if (trimmed.includes('from locations')) return memoryStore.locations.map(l => ({ name: l }));
            return [];
          },
          get(...params) {
            const all = this.all(...params);
            return all.length > 0 ? all[0] : null;
          },
          run(...params) {
            return { lastInsertRowid: Date.now() };
          }
        };
      }
    };
  },

  // Users
  getUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(cleanEmail);
    }
    return memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  },

  getUserById(id) {
    const numId = parseInt(id, 10);
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(numId);
    }
    return memoryStore.users.find(u => u.id === numId) || null;
  },

  createUser({ name, email, regNo, phone, password, avatar }) {
    const cleanEmail = email.trim().toLowerCase();
    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO users (name, email, reg_no, phone, password, avatar)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(name, cleanEmail, regNo, phone || '', password, avatar);
      return this.getUserById(info.lastInsertRowid);
    }
    const newUser = {
      id: memoryStore.users.length > 0 ? Math.max(...memoryStore.users.map(u => u.id)) + 1 : 1,
      name,
      email: cleanEmail,
      reg_no: regNo,
      phone: phone || '',
      password,
      avatar: avatar || 'ST',
      created_at: new Date().toISOString()
    };
    memoryStore.users.push(newUser);
    return newUser;
  },

  // Items
  getAllItems(filters = {}) {
    if (useSqlite && db) {
      let sql = 'SELECT * FROM items WHERE 1=1';
      const params = [];

      if (filters.search) {
        sql += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ? OR color LIKE ?)';
        const s = `%${filters.search}%`;
        params.push(s, s, s, s);
      }
      if (filters.type && filters.type !== 'all') {
        sql += ' AND type = ?';
        params.push(filters.type);
      }
      if (filters.category) {
        const cats = filters.category.split(',').map(c => c.trim()).filter(Boolean);
        if (cats.length > 0) {
          sql += ` AND category IN (${cats.map(() => '?').join(',')})`;
          params.push(...cats);
        }
      }
      if (filters.location) {
        sql += ' AND location = ?';
        params.push(filters.location);
      }
      if (filters.dateFrom) {
        sql += ' AND date >= ?';
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        sql += ' AND date <= ?';
        params.push(filters.dateTo);
      }

      if (filters.sort === 'oldest') {
        sql += ' ORDER BY date ASC, id ASC';
      } else if (filters.sort === 'a-z') {
        sql += ' ORDER BY title ASC';
      } else {
        sql += ' ORDER BY date DESC, id DESC';
      }

      const rows = db.prepare(sql).all(...params);
      return rows.map(this._formatItem);
    }

    // In-memory filter
    let items = [...memoryStore.items];
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
    if (filters.category) {
      const cats = filters.category.split(',').map(c => c.trim().toLowerCase());
      items = items.filter(i => cats.includes((i.category || '').toLowerCase()));
    }
    if (filters.location) {
      items = items.filter(i => (i.location || '').toLowerCase() === filters.location.toLowerCase());
    }
    if (filters.dateFrom) {
      items = items.filter(i => i.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      items = items.filter(i => i.date <= filters.dateTo);
    }

    if (filters.sort === 'oldest') {
      items.sort((a, b) => (a.date > b.date ? 1 : -1));
    } else if (filters.sort === 'a-z') {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      items.sort((a, b) => (b.date > a.date ? 1 : -1));
    }

    return items.map(this._formatItem);
  },

  getItemById(id) {
    const numId = parseInt(id, 10);
    if (useSqlite && db) {
      const row = db.prepare('SELECT * FROM items WHERE id = ?').get(numId);
      return row ? this._formatItem(row) : null;
    }
    const item = memoryStore.items.find(i => i.id === numId);
    return item ? this._formatItem(item) : null;
  },

  createItem(item) {
    const userImg = (item.image && typeof item.image === 'string' && item.image.trim()) ? item.image.trim() : '';
    const userImages = Array.isArray(item.images) && item.images.length > 0 
      ? item.images.filter(img => typeof img === 'string' && img.trim()) 
      : (userImg ? [userImg] : []);
    const imagesJson = JSON.stringify(userImages);

    const userName = item.userName || (item.user && item.user.name) || 'SRM Student';
    const userAvatar = item.userAvatar || (item.user && item.user.avatar) || 'ST';
    const userEmail = item.userEmail || (item.user && item.user.email) || '';

    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO items (
          type, status, title, category, color, description, location,
          date, time, image, images_json, user_name, user_avatar, user_email, matched_with, posted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        item.type,
        item.status || 'reported',
        item.title,
        item.category,
        item.color || 'Unspecified',
        item.description || '',
        item.location,
        item.date,
        item.time || '12:00',
        userImg,
        imagesJson,
        userName,
        userAvatar,
        userEmail,
        item.matchedWith || null,
        'Just now'
      );
      try {
        db.prepare('UPDATE categories SET count = count + 1 WHERE id = ?').run(item.category);
      } catch (e) {}
      return this.getItemById(info.lastInsertRowid);
    }

    const newItem = {
      id: memoryStore.items.length > 0 ? Math.max(...memoryStore.items.map(i => i.id)) + 1 : 1,
      type: item.type,
      status: item.status || 'reported',
      title: item.title,
      category: item.category,
      color: item.color || 'Unspecified',
      description: item.description || '',
      location: item.location,
      date: item.date,
      time: item.time || '12:00',
      image: userImg,
      images_json: imagesJson,
      user_name: userName,
      user_avatar: userAvatar,
      user_email: userEmail,
      matched_with: item.matchedWith || null,
      posted_at: 'Just now',
      created_at: new Date().toISOString()
    };
    memoryStore.items.unshift(newItem);

    const catObj = memoryStore.categories.find(c => c.id === item.category);
    if (catObj) catObj.count = (catObj.count || 0) + 1;

    return this._formatItem(newItem);
  },

  updateItemStatus(id, status, matchedWith = null) {
    const numId = parseInt(id, 10);
    if (useSqlite && db) {
      if (matchedWith) {
        db.prepare('UPDATE items SET status = ?, matched_with = ? WHERE id = ?').run(status, matchedWith, numId);
      } else {
        db.prepare('UPDATE items SET status = ? WHERE id = ?').run(status, numId);
      }
      return this.getItemById(numId);
    }
    const item = memoryStore.items.find(i => i.id === numId);
    if (item) {
      item.status = status;
      if (matchedWith) item.matched_with = matchedWith;
      return this._formatItem(item);
    }
    return null;
  },

  // Claims
  createClaim({ itemId, claimantName, claimantEmail, claimantRegNo, secretDetails, answers, passCode }) {
    const pCode = passCode || `LL-${itemId}0${Math.floor(100 + Math.random() * 900)}`;
    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO claims (item_id, claimant_name, claimant_email, claimant_reg_no, secret_details, answers_json, pass_code, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `);
      const info = stmt.run(
        itemId,
        claimantName,
        claimantEmail.toLowerCase(),
        claimantRegNo,
        secretDetails,
        JSON.stringify(answers || {}),
        pCode
      );
      this.updateItemStatus(itemId, 'claimed');
      return this.getClaimById(info.lastInsertRowid);
    }

    const newClaim = {
      id: memoryStore.claims.length > 0 ? Math.max(...memoryStore.claims.map(c => c.id)) + 1 : 1,
      item_id: itemId,
      claimant_name: claimantName,
      claimant_email: claimantEmail.toLowerCase(),
      claimant_reg_no: claimantRegNo,
      secret_details: secretDetails,
      answers_json: JSON.stringify(answers || {}),
      pass_code: pCode,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    memoryStore.claims.push(newClaim);
    this.updateItemStatus(itemId, 'claimed');
    return {
      id: newClaim.id,
      itemId: newClaim.item_id,
      claimantName: newClaim.claimant_name,
      claimantEmail: newClaim.claimant_email,
      claimantRegNo: newClaim.claimant_reg_no,
      secretDetails: newClaim.secret_details,
      answers: answers || {},
      passCode: newClaim.pass_code,
      status: newClaim.status,
      createdAt: newClaim.created_at
    };
  },

  getClaimById(id) {
    const numId = parseInt(id, 10);
    if (useSqlite && db) {
      const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(numId);
      if (!row) return null;
      return {
        id: row.id,
        itemId: row.item_id,
        claimantName: row.claimant_name,
        claimantEmail: row.claimant_email,
        claimantRegNo: row.claimant_reg_no,
        secretDetails: row.secret_details,
        answers: row.answers_json ? JSON.parse(row.answers_json) : {},
        passCode: row.pass_code,
        status: row.status,
        createdAt: row.created_at
      };
    }
    const c = memoryStore.claims.find(cl => cl.id === numId);
    if (!c) return null;
    return {
      id: c.id,
      itemId: c.item_id,
      claimantName: c.claimant_name,
      claimantEmail: c.claimant_email,
      claimantRegNo: c.claimant_reg_no,
      secretDetails: c.secret_details,
      answers: c.answers_json ? JSON.parse(c.answers_json) : {},
      passCode: c.pass_code,
      status: c.status,
      createdAt: c.created_at
    };
  },

  getClaimsForItem(itemId) {
    const numId = parseInt(itemId, 10);
    if (useSqlite && db) {
      const rows = db.prepare('SELECT * FROM claims WHERE item_id = ? ORDER BY id DESC').all(numId);
      return rows.map(r => ({
        id: r.id,
        itemId: r.item_id,
        claimantName: r.claimant_name,
        claimantEmail: r.claimant_email,
        claimantRegNo: r.claimant_reg_no,
        secretDetails: r.secret_details,
        answers: r.answers_json ? JSON.parse(r.answers_json) : {},
        passCode: r.pass_code,
        status: r.status,
        createdAt: r.created_at
      }));
    }
    return memoryStore.claims
      .filter(c => c.item_id === numId)
      .map(c => ({
        id: c.id,
        itemId: c.item_id,
        claimantName: c.claimant_name,
        claimantEmail: c.claimant_email,
        claimantRegNo: c.claimant_reg_no,
        secretDetails: c.secret_details,
        answers: c.answers_json ? JSON.parse(c.answers_json) : {},
        passCode: c.pass_code,
        status: c.status,
        createdAt: c.created_at
      }));
  },

  getClaimsForUser(userEmail) {
    if (!userEmail) return [];
    const cleanEmail = userEmail.trim().toLowerCase();
    if (useSqlite && db) {
      const rows = db.prepare('SELECT * FROM claims WHERE claimant_email = ? COLLATE NOCASE ORDER BY id DESC').all(cleanEmail);
      return rows.map(r => ({
        id: r.id,
        itemId: r.item_id,
        claimantName: r.claimant_name,
        claimantEmail: r.claimant_email,
        claimantRegNo: r.claimant_reg_no,
        secretDetails: r.secret_details,
        passCode: r.pass_code,
        status: r.status,
        createdAt: r.created_at
      }));
    }
    return memoryStore.claims
      .filter(c => (c.claimant_email || '').toLowerCase() === cleanEmail)
      .map(c => ({
        id: c.id,
        itemId: c.item_id,
        claimantName: c.claimant_name,
        claimantEmail: c.claimant_email,
        claimantRegNo: c.claimant_reg_no,
        secretDetails: c.secret_details,
        passCode: c.pass_code,
        status: c.status,
        createdAt: c.created_at
      }));
  },

  updateClaimStatus(claimId, status) {
    const numId = parseInt(claimId, 10);
    if (useSqlite && db) {
      db.prepare('UPDATE claims SET status = ? WHERE id = ?').run(status, numId);
      return this.getClaimById(numId);
    }
    const c = memoryStore.claims.find(cl => cl.id === numId);
    if (c) c.status = status;
    return this.getClaimById(numId);
  },

  // Messages
  createMessage({ itemId, senderName, senderEmail, recipientName, recipientEmail, text }) {
    const sEmail = senderEmail ? String(senderEmail).trim().toLowerCase() : '';
    const rEmail = recipientEmail ? String(recipientEmail).trim().toLowerCase() : '';
    const sName = senderName || 'SRM Student';
    const rName = recipientName || 'SRM Counterpart';
    const numId = parseInt(itemId, 10);

    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO messages (item_id, sender_name, sender_email, recipient_name, recipient_email, text, read)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `);
      const info = stmt.run(numId, sName, sEmail, rName, rEmail, text);
      return db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
    }

    const newMsg = {
      id: memoryStore.messages.length > 0 ? Math.max(...memoryStore.messages.map(m => m.id)) + 1 : 1,
      item_id: numId,
      sender_name: sName,
      sender_email: sEmail,
      recipient_name: rName,
      recipient_email: rEmail,
      text,
      read: 0,
      created_at: new Date().toISOString()
    };
    memoryStore.messages.push(newMsg);
    return newMsg;
  },

  getMessages(itemId) {
    const numId = parseInt(itemId, 10);
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM messages WHERE item_id = ? ORDER BY created_at ASC, id ASC').all(numId);
    }
    return memoryStore.messages
      .filter(m => m.item_id === numId)
      .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  },

  getConversationsForUser(userEmail) {
    if (!userEmail) return [];
    const email = userEmail.trim().toLowerCase();
    if (useSqlite && db) {
      const rows = db.prepare(`
        SELECT DISTINCT m.item_id, i.title, i.type, i.image, i.location,
          (SELECT text FROM messages WHERE item_id = m.item_id ORDER BY id DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE item_id = m.item_id ORDER BY id DESC LIMIT 1) as last_time,
          (SELECT COUNT(*) FROM messages WHERE item_id = m.item_id AND recipient_email = ? COLLATE NOCASE AND read = 0) as unread_count
        FROM messages m
        JOIN items i ON m.item_id = i.id
        WHERE m.sender_email = ? COLLATE NOCASE OR m.recipient_email = ? COLLATE NOCASE
        ORDER BY last_time DESC
      `).all(email, email, email);
      return rows;
    }

    // In-memory conversation grouping
    const itemIds = [...new Set(
      memoryStore.messages
        .filter(m => (m.sender_email || '').toLowerCase() === email || (m.recipient_email || '').toLowerCase() === email)
        .map(m => m.item_id)
    )];

    const convos = [];
    itemIds.forEach(id => {
      const item = memoryStore.items.find(i => i.id === id);
      if (!item) return;
      const itemMsgs = memoryStore.messages
        .filter(m => m.item_id === id)
        .sort((a, b) => (b.id - a.id));
      const lastMsg = itemMsgs[0] || {};
      const unreadCount = memoryStore.messages.filter(m => m.item_id === id && (m.recipient_email || '').toLowerCase() === email && !m.read).length;

      convos.push({
        item_id: id,
        title: item.title,
        type: item.type,
        image: item.image,
        location: item.location,
        last_message: lastMsg.text || '',
        last_time: lastMsg.created_at || item.created_at,
        unread_count: unreadCount
      });
    });

    convos.sort((a, b) => (b.last_time > a.last_time ? 1 : -1));
    return convos;
  },

  markMessagesAsRead(itemId, recipientEmail) {
    if (!recipientEmail) return;
    const cleanEmail = recipientEmail.trim().toLowerCase();
    const numId = parseInt(itemId, 10);
    if (useSqlite && db) {
      db.prepare('UPDATE messages SET read = 1 WHERE item_id = ? AND recipient_email = ? COLLATE NOCASE').run(numId, cleanEmail);
      return;
    }
    memoryStore.messages.forEach(m => {
      if (m.item_id === numId && (m.recipient_email || '').toLowerCase() === cleanEmail) {
        m.read = 1;
      }
    });
  },

  // Matches
  createMatch(lostItemId, foundItemId, confidence = 98) {
    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO matches (lost_item_id, found_item_id, confidence)
        VALUES (?, ?, ?)
      `);
      return stmt.run(lostItemId, foundItemId, confidence);
    }
    const match = {
      id: memoryStore.matches.length + 1,
      lost_item_id: lostItemId,
      found_item_id: foundItemId,
      confidence,
      created_at: new Date().toISOString()
    };
    memoryStore.matches.push(match);
    return match;
  },

  getMatches(itemId) {
    const numId = parseInt(itemId, 10);
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM matches WHERE lost_item_id = ? OR found_item_id = ?').all(numId, numId);
    }
    return memoryStore.matches.filter(m => m.lost_item_id === numId || m.found_item_id === numId);
  },

  // Notifications
  createNotification({ userEmail, title, message, itemId = null, type = 'info' }) {
    const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : '';
    if (useSqlite && db) {
      const stmt = db.prepare(`
        INSERT INTO notifications (user_email, title, message, item_id, type, read)
        VALUES (?, ?, ?, ?, ?, 0)
      `);
      return stmt.run(cleanEmail, title, message, itemId, type);
    }
    const notif = {
      id: memoryStore.notifications.length + 1,
      user_email: cleanEmail,
      title,
      message,
      item_id: itemId,
      type,
      read: 0,
      created_at: new Date().toISOString()
    };
    memoryStore.notifications.unshift(notif);
    return notif;
  },

  getNotifications(userEmail) {
    if (!userEmail) return [];
    const cleanEmail = userEmail.trim().toLowerCase();
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM notifications WHERE user_email = ? COLLATE NOCASE ORDER BY id DESC LIMIT 20').all(cleanEmail);
    }
    return memoryStore.notifications.filter(n => n.user_email === cleanEmail).slice(0, 20);
  },

  markNotificationsRead(userEmail) {
    if (!userEmail) return;
    const cleanEmail = userEmail.trim().toLowerCase();
    if (useSqlite && db) {
      db.prepare('UPDATE notifications SET read = 1 WHERE user_email = ? COLLATE NOCASE').run(cleanEmail);
      return;
    }
    memoryStore.notifications.forEach(n => {
      if (n.user_email === cleanEmail) n.read = 1;
    });
  },

  // Categories & Locations
  getCategories() {
    if (useSqlite && db) {
      return db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    }
    return [...memoryStore.categories].sort((a, b) => a.name.localeCompare(b.name));
  },

  getLocations() {
    if (useSqlite && db) {
      return db.prepare('SELECT name FROM locations ORDER BY name ASC').all().map(r => r.name);
    }
    return [...memoryStore.locations].sort();
  },

  // Format internal item row to API JSON schema
  _formatItem(row) {
    let images = [];
    try {
      images = row.images_json ? JSON.parse(row.images_json) : (row.image ? [row.image] : []);
    } catch (e) {
      images = row.image ? [row.image] : [];
    }

    return {
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      category: row.category,
      color: row.color,
      description: row.description,
      location: row.location,
      date: row.date,
      time: row.time,
      image: row.image,
      images: images,
      user: {
        name: row.user_name || 'SRM Student',
        avatar: row.user_avatar || 'ST',
        email: row.user_email || ''
      },
      matchedWith: row.matched_with || undefined,
      postedAt: row.posted_at || 'Recently'
    };
  },

  initSchema,
  seedData
};

module.exports = LostLinkDB;
