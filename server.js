/**
 * LostLink — REST API Backend Server
 * Express.js server providing RESTful endpoints, SQL database storage via SQLite (better-sqlite3),
 * in-app messaging between finder and owner, claim verification with private proof,
 * and serving the static frontend for SRMIST KTR.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const LostLinkDB = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// API ROUTES
// ============================================

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LostLink API',
    database: 'SQLite 3 (lostlink.db)',
    institution: 'SRMIST KTR',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// 2. Get all categories
app.get('/api/categories', (req, res) => {
  const categories = LostLinkDB.getCategories();
  res.json(categories);
});

// 3. Get campus locations
app.get('/api/locations', (req, res) => {
  const locations = LostLinkDB.getLocations();
  res.json(locations);
});

// 4. Get items with filtering & search
app.get('/api/items', (req, res) => {
  const { q, type, category, location, dateFrom, dateTo, sort } = req.query;
  const items = LostLinkDB.getAllItems({
    search: q,
    type,
    category,
    location,
    dateFrom,
    dateTo,
    sort
  });

  res.json({
    total: items.length,
    items
  });
});

// 5. Get single item by ID
app.get('/api/items/:id', (req, res) => {
  const item = LostLinkDB.getItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// 6. Report a new item (Lost or Found)
app.post('/api/items', (req, res) => {
  const {
    type,
    title,
    category,
    color,
    description,
    location,
    date,
    time,
    image,
    images,
    userEmail,
    foundMatchFor
  } = req.body;

  // Validation
  if (!type || !['lost', 'found'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "lost" or "found"' });
  }
  if (!title || title.trim().length < 3) {
    return res.status(400).json({ error: 'Title must be at least 3 characters' });
  }
  if (!category) {
    return res.status(400).json({ error: 'Category is required' });
  }
  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }

  // Lookup reporter user if logged in
  let authorName = 'SRM Student';
  let authorAvatar = 'ST';
  let authorEmail = userEmail ? userEmail.trim().toLowerCase() : '';

  if (authorEmail) {
    const user = LostLinkDB.getUserByEmail(authorEmail);
    if (user) {
      authorName = user.name;
      authorAvatar = user.avatar;
    }
  }

  // Only use user-uploaded photos — never assign random pictures
  const primaryImage = (image && typeof image === 'string' && image.trim()) ? image.trim() : '';
  const itemImages = (images && Array.isArray(images) && images.length > 0) 
    ? images.filter(img => typeof img === 'string' && img.trim()) 
    : (primaryImage ? [primaryImage] : []);

  // Create item record in SQLite
  const newItem = LostLinkDB.createItem({
    type,
    status: foundMatchFor ? 'matched' : 'reported',
    title: title.trim(),
    category,
    color: color || 'Unspecified',
    description: description ? description.trim() : '',
    location,
    date,
    time: time || '12:00',
    image: primaryImage,
    images: itemImages,
    userName: authorName,
    userAvatar: authorAvatar,
    userEmail: authorEmail,
    matchedWith: foundMatchFor ? parseInt(foundMatchFor, 10) : null
  });

  // Handle direct found match linkage
  if (foundMatchFor) {
    const matchedRef = LostLinkDB.getItemById(foundMatchFor);
    if (matchedRef) {
      // Update both items to 'matched'
      LostLinkDB.updateItemStatus(matchedRef.id, 'matched', newItem.id);
      LostLinkDB.updateItemStatus(newItem.id, 'matched', matchedRef.id);

      // Record match
      LostLinkDB.createMatch(matchedRef.id, newItem.id, 98);

      // Notify owner of lost item
      if (matchedRef.user && matchedRef.user.email) {
        LostLinkDB.createNotification({
          userEmail: matchedRef.user.email,
          title: 'Found Match Confirmed!',
          message: `${authorName} reported finding an item matching your "${matchedRef.title}"! Open chat to coordinate safe handover.`,
          itemId: matchedRef.id,
          type: 'match'
        });
      }

      // Automatically initialize in-app chat thread between owner and finder
      LostLinkDB.createMessage({
        itemId: matchedRef.id,
        senderName: 'LostLink Smart Match',
        senderEmail: 'system@lostlink.srmist.edu.in',
        recipientName: matchedRef.user.name,
        recipientEmail: matchedRef.user.email,
        text: `🤝 Match established! ${authorName} confirmed finding this item at ${location}. Use this chat to coordinate safe handover on campus.`
      });
    }
  }

  res.status(201).json(newItem);
});

// 6b. Direct 1-Click Quick Found (Finder reports finding a lost item without entering full details)
app.post('/api/items/:id/quick-found', (req, res) => {
  const lostItemId = parseInt(req.params.id, 10);
  const lostItem = LostLinkDB.getItemById(lostItemId);
  if (!lostItem) {
    return res.status(404).json({ error: 'Lost item not found' });
  }

  const { location, note, image, userEmail } = req.body;
  const user = userEmail ? LostLinkDB.getUserByEmail(userEmail) : null;
  const finderName = user ? user.name : 'Rishi Verma (Finder)';
  const finderEmail = user ? user.email : 'rishi.v@srmist.edu.in';
  const finderAvatar = user ? user.avatar : 'RV';
  const foundLocation = location || lostItem.location || 'TP';

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const foundItem = LostLinkDB.createItem({
    type: 'found',
    status: 'matched',
    title: `Found: ${lostItem.title}`,
    category: lostItem.category,
    color: lostItem.color,
    description: note && note.trim()
      ? note.trim()
      : `Found item matching lost report #${lostItem.id} (${lostItem.title}) at ${foundLocation}. Safe in custody.`,
    location: foundLocation,
    date: today,
    time: timeStr,
    image: image || '',
    images: image ? [image] : [],
    userName: finderName,
    userAvatar: finderAvatar,
    userEmail: finderEmail,
    matchedWith: lostItem.id
  });

  // Update lost item to matched
  LostLinkDB.updateItemStatus(lostItem.id, 'matched', foundItem.id);

  // Record match score
  LostLinkDB.createMatch(lostItem.id, foundItem.id, 99);

  // Notify owner of lost item
  if (lostItem.user && lostItem.user.email) {
    LostLinkDB.createNotification({
      userEmail: lostItem.user.email,
      title: 'Item Found!',
      message: `${finderName} reported finding your "${lostItem.title}" at ${foundLocation}! Open Inbox to coordinate return.`,
      itemId: lostItem.id,
      type: 'match'
    });
  }

  // Create initial message in handover thread
  const returnMsg = note && note.trim()
    ? note.trim()
    : `Hi ${lostItem.user.name}, I found your ${lostItem.title} at ${foundLocation}! It's safe with me. Let's arrange a time to meet on campus.`;

  LostLinkDB.createMessage({
    itemId: lostItem.id,
    senderName: finderName,
    senderEmail: finderEmail,
    recipientName: lostItem.user.name,
    recipientEmail: lostItem.user.email,
    text: returnMsg
  });

  res.status(201).json({
    success: true,
    foundItem,
    lostItem,
    redirectUrl: `inbox.html?itemId=${lostItem.id}`
  });
});

// 7. Get smart matches for an item
app.get('/api/items/:id/matches', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const refItem = LostLinkDB.getItemById(id);

  if (!refItem) {
    return res.status(404).json({ error: 'Reference item not found' });
  }

  const opposingType = refItem.type === 'lost' ? 'found' : 'lost';
  const candidates = LostLinkDB.getAllItems({ type: opposingType }).filter(i => i.id !== id);

  const scoredMatches = candidates.map(candidate => {
    let confidence = 20;
    let reasons = [];

    // Direct match link from finder
    const isDirectMatch = (candidate.matchedWith === refItem.id || refItem.matchedWith === candidate.id);
    if (isDirectMatch) {
      confidence = 98;
      reasons.push('Direct match confirmed by finder');
    }

    // Category match
    if (candidate.category === refItem.category) {
      confidence += 40;
      reasons.push('Same category');
    }

    // Color match
    if (candidate.color && refItem.color && candidate.color.toLowerCase() === refItem.color.toLowerCase()) {
      confidence += 20;
      reasons.push('Same color');
    }

    // Location match
    if (candidate.location === refItem.location) {
      confidence += 15;
      reasons.push('Exact location match');
    } else {
      reasons.push('Campus proximity');
    }

    return {
      item: candidate,
      confidence: Math.min(confidence, 98),
      reasons
    };
  });

  scoredMatches.sort((a, b) => b.confidence - a.confidence);

  res.json({
    referenceItem: refItem,
    matches: scoredMatches.slice(0, 5)
  });
});

// 8. Submit an ownership claim for a found item (with private details e.g. "White keychain")
app.post('/api/claims', (req, res) => {
  const { itemId, claimantName, claimantEmail, claimantRegNo, secretDetails, answers } = req.body;

  if (!itemId) {
    return res.status(400).json({ error: 'Item ID is required' });
  }
  if (!claimantName || claimantName.trim().length < 2) {
    return res.status(400).json({ error: 'Claimant full name is required' });
  }
  if (!claimantEmail) {
    return res.status(400).json({ error: 'Claimant email is required' });
  }
  if (!claimantRegNo) {
    return res.status(400).json({ error: 'Registration number is required' });
  }
  if (!secretDetails || secretDetails.trim().length < 5) {
    return res.status(400).json({ error: 'Please provide private identifying details (at least 5 characters) to prove ownership.' });
  }

  const targetItem = LostLinkDB.getItemById(itemId);
  if (!targetItem) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const passCode = `LL-${targetItem.id}0${Math.floor(100 + Math.random() * 900)}`;

  const claim = LostLinkDB.createClaim({
    itemId: targetItem.id,
    claimantName: claimantName.trim(),
    claimantEmail: claimantEmail.trim().toLowerCase(),
    claimantRegNo: claimantRegNo.trim().toUpperCase(),
    secretDetails: secretDetails.trim(),
    answers: answers || {},
    passCode
  });

  // Notify finder (or custodian)
  if (targetItem.user && targetItem.user.email) {
    LostLinkDB.createNotification({
      userEmail: targetItem.user.email,
      title: 'New Ownership Claim Received',
      message: `${claimantName} claimed ownership of your found "${targetItem.title}" with private proof ("${secretDetails.trim().substring(0, 45)}..."). Review to approve.`,
      itemId: targetItem.id,
      type: 'claim'
    });
  }

  // Create initial message in item chat thread
  LostLinkDB.createMessage({
    itemId: targetItem.id,
    senderName: claimantName.trim(),
    senderEmail: claimantEmail.trim().toLowerCase(),
    recipientName: targetItem.user.name,
    recipientEmail: targetItem.user.email,
    text: `Hello! I have submitted an ownership claim for this item. Identifying proof: "${secretDetails.trim()}". Let's coordinate safe handover!`
  });

  res.status(201).json({
    success: true,
    claim,
    passCode,
    message: 'Claim successfully submitted. The finder has been notified to review your proof.'
  });
});

// 9. Get claims for an item
app.get('/api/items/:id/claims', (req, res) => {
  const claims = LostLinkDB.getClaimsForItem(req.params.id);
  res.json(claims);
});

// 10. Approve a claim (Finder approves Owner's claim)
app.post('/api/claims/:id/approve', (req, res) => {
  const claimId = parseInt(req.params.id, 10);
  const claim = LostLinkDB.getClaimById(claimId);
  if (!claim) {
    return res.status(404).json({ error: 'Claim record not found' });
  }

  const item = LostLinkDB.getItemById(claim.itemId);
  if (!item) {
    return res.status(404).json({ error: 'Associated item not found' });
  }

  // Update claim status to 'approved'
  LostLinkDB.updateClaimStatus(claimId, 'approved');

  // Update item status to 'verified'
  LostLinkDB.updateItemStatus(item.id, 'verified');

  // Notify claimant
  LostLinkDB.createNotification({
    userEmail: claim.claimantEmail,
    title: 'Claim Approved by Finder!',
    message: `${item.user.name} reviewed your proof for "${item.title}" and approved your claim! Open chat to arrange handover.`,
    itemId: item.id,
    type: 'match'
  });

  // Post approval confirmation in chat
  LostLinkDB.createMessage({
    itemId: item.id,
    senderName: item.user.name,
    senderEmail: item.user.email,
    recipientName: claim.claimantName,
    recipientEmail: claim.claimantEmail,
    text: `✅ Ownership proof approved! The details you provided match this item. Let's arrange a time and place to meet.`
  });

  res.json({
    success: true,
    message: 'Claim successfully approved. Handover chat is now active.',
    item: LostLinkDB.getItemById(item.id)
  });
});

// ============================================
// DIRECT IN-APP MESSAGING API
// ============================================

// 11. Get all messages for an item
app.get('/api/items/:id/messages', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { userEmail } = req.query;

  if (userEmail) {
    LostLinkDB.markMessagesAsRead(itemId, userEmail);
  }

  const messages = LostLinkDB.getMessages(itemId);
  res.json(messages);
});

// 12. Send a new message regarding an item
app.post('/api/items/:id/messages', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const { senderName, senderEmail, recipientName, recipientEmail, text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text cannot be empty' });
  }
  if (!senderEmail) {
    return res.status(400).json({ error: 'Sender email is required' });
  }

  const item = LostLinkDB.getItemById(itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Resolve recipient defaults if not explicitly provided
  let rName = recipientName;
  let rEmail = recipientEmail;

  if (!rEmail) {
    if (item.user && item.user.email && item.user.email.toLowerCase() !== senderEmail.toLowerCase()) {
      rEmail = item.user.email;
      rName = item.user.name;
    } else {
      // Find claimant
      const claims = LostLinkDB.getClaimsForItem(itemId);
      if (claims.length > 0) {
        rEmail = claims[0].claimantEmail;
        rName = claims[0].claimantName;
      }
    }
  }

  const msg = LostLinkDB.createMessage({
    itemId,
    senderName: senderName || 'SRM Student',
    senderEmail: senderEmail.trim().toLowerCase(),
    recipientName: rName || 'Recipient',
    recipientEmail: rEmail ? rEmail.trim().toLowerCase() : '',
    text: text.trim()
  });

  // Notify recipient
  if (rEmail && rEmail.toLowerCase() !== senderEmail.toLowerCase()) {
    LostLinkDB.createNotification({
      userEmail: rEmail,
      title: `New message from ${senderName || 'SRM Student'}`,
      message: `"${text.trim().substring(0, 50)}..." regarding "${item.title}"`,
      itemId,
      type: 'message'
    });
  }

  res.status(201).json(msg);
});

// 13. Get user's active conversations
app.get('/api/user/conversations', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'User email is required' });
  }
  const conversations = LostLinkDB.getConversationsForUser(email);
  res.json(conversations);
});

// ============================================
// AUTHENTICATION & USER SESSIONS (SQLite)
// ============================================

// 14. Sign Up — Store Credentials in SQLite
app.post('/api/auth/signup', (req, res) => {
  const { name, email, regNo, phone, password } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter your full name (at least 2 characters)' });
  }
  if (!email || !email.toLowerCase().endsWith('@srmist.edu.in')) {
    return res.status(400).json({ error: 'Must use an official @srmist.edu.in webmail address' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  if (!regNo || regNo.trim().length < 5) {
    return res.status(400).json({ error: 'Valid SRMIST Registration Number is required (e.g. RA...)' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check duplicate in SQLite
  const existing = LostLinkDB.getUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this SRM email already exists. Please log in.' });
  }

  // Compute initials avatar
  const parts = name.trim().split(' ').filter(Boolean);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();

  const user = LostLinkDB.createUser({
    name: name.trim(),
    email: normalizedEmail,
    regNo: regNo.trim().toUpperCase(),
    phone: phone ? phone.trim() : '',
    password,
    avatar: initials
  });

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    regNo: user.reg_no,
    phone: user.phone,
    avatar: user.avatar,
    createdAt: user.created_at
  };

  res.status(201).json({
    success: true,
    message: 'Account created successfully in database',
    token: `jwt-srmist-${user.id}-${Date.now()}`,
    user: safeUser
  });
});

// 15. Log In — Validate Credentials against SQLite
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Please enter your SRM university email' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Please enter your password' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = LostLinkDB.getUserByEmail(normalizedEmail);

  if (!user) {
    return res.status(404).json({ error: 'No account found with this email. Please sign up first.' });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: 'Incorrect password. Please verify and try again.' });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    regNo: user.reg_no,
    phone: user.phone,
    avatar: user.avatar,
    createdAt: user.created_at
  };

  res.json({
    success: true,
    message: 'Logged in successfully',
    token: `jwt-srmist-${user.id}-${Date.now()}`,
    user: safeUser
  });
});

// 16. User Dashboard Data
app.get('/api/user/dashboard', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(401).json({ error: 'Unauthorized: User email required' });
  }

  const user = LostLinkDB.getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found in database' });
  }

  const allItems = LostLinkDB.getAllItems();
  const userReports = allItems.filter(i => i.user && i.user.email.toLowerCase() === user.email.toLowerCase());
  const userClaims = LostLinkDB.getClaimsForUser(user.email);
  const notifications = LostLinkDB.getNotifications(user.email);
  const conversations = LostLinkDB.getConversationsForUser(user.email);

  // Matches involving user's reports
  const userItemIds = userReports.map(r => r.id);
  const allMatches = LostLinkDB.db.prepare('SELECT * FROM matches').all();
  const userMatches = allMatches.filter(m => userItemIds.includes(m.lost_item_id) || userItemIds.includes(m.found_item_id));

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      regNo: user.reg_no,
      phone: user.phone,
      avatar: user.avatar
    },
    overview: {
      reportsCount: userReports.length,
      claimsCount: userClaims.length,
      matchesCount: userMatches.length,
      conversationsCount: conversations.length,
      reunitedCount: userReports.filter(r => r.status === 'collected' || r.status === 'verified').length
    },
    myReports: userReports,
    myClaims: userClaims,
    notifications,
    conversations
  });
});

// 17. Mark all notifications as read
app.patch('/api/notifications/read-all', (req, res) => {
  const { userEmail } = req.body;
  if (userEmail) {
    LostLinkDB.markNotificationsRead(userEmail);
  }
  res.json({ success: true, message: 'All notifications marked as read' });
});

// 18. Intelligent Campus ChatBot Assistant
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message text required' });
  }

  const q = message.trim().toLowerCase();
  const allItems = LostLinkDB.getAllItems();

  // GREETING
  if (/^(hi|hello|hey|hola|greetings|start|help|who are you)\b/i.test(q)) {
    return res.json({
      reply: "Hello! 👋 I'm **LinkBot**, the official SRMIST Lost & Found AI Assistant.\n\nI can help you search for lost belongings across campus, guide you through filing a report, or help you claim a found item with private proof.",
      chips: ["🔍 Search lost items", "📝 How do I report?", "🔐 How to claim?", "📍 Collection locations"]
    });
  }

  // REPORTING INSTRUCTION
  if (/how\s+(do\s+i\s+|can\s+i\s+|to\s+)?(report|file)/i.test(q) || q.includes('report lost') || q.includes('report found') || q.includes('file a report') || q.includes('want to report') || q.includes('i lost an item') || q.includes('i found an item')) {
    return res.json({
      reply: "Filing a report takes **less than 2 minutes** ⏱️:\n\n1. Open the **Report** wizard.\n2. Choose **I Lost an Item** or **I Found an Item** using the top toggle.\n3. Add photos, campus block, date, and approximate time.\n4. Review and submit! Our smart matching engine starts cross-referencing immediately.",
      action: { text: "Report an Item Now", url: "report.html" },
      chips: ["Browse current listings", "How does matching work?"]
    });
  }

  // CLAIM & VERIFICATION INSTRUCTION
  if (/how\s+(do\s+i\s+|can\s+i\s+|to\s+)?(claim|verify|collect)/i.test(q) || q.includes('how to claim') || q.includes('how do i claim') || q.includes('claim') || q.includes('verify') || q.includes('verification') || q.includes('ownership') || q.includes('keychain')) {
    return res.json({
      reply: "To prevent fraudulent claims, LostLink uses a **private ownership proof system** 🔐:\n\n1. Find the item in the **Browse** directory.\n2. Click **'This is mine (Claim Item)'**.\n3. Enter private identifying details (e.g. *'White keychain attached to the bag'*, internal scratches, or receipts).\n4. The finder (e.g. Rishi) reviews your private proof and approves it.\n5. You can chat directly with the finder right inside the app to arrange a safe meetup!",
      action: { text: "Browse Found Items", url: "browse.html?type=found" },
      chips: ["Where are items collected?", "Report a lost item"]
    });
  }

  // SEARCH ITEMS
  const searchKeywords = ['wallet', 'keys', 'calculator', 'macbook', 'laptop', 'airpods', 'headphones', 'id', 'card', 'book', 'jacket', 'phone', 'bottle', 'watch', 'backpack', 'bag'];
  const matchedKeyword = searchKeywords.find(kw => q.includes(kw));

  const searchTerms = matchedKeyword ? [matchedKeyword] : q.split(' ').filter(w => w.length > 2);
  let matchedItems = allItems.filter(item => {
    return searchTerms.some(term =>
      item.title.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.location.toLowerCase().includes(term) ||
      item.color.toLowerCase().includes(term)
    );
  });

  if (matchedItems.length > 0) {
    const topMatches = matchedItems.slice(0, 3);
    return res.json({
      reply: `I found **${matchedItems.length} listing(s)** on campus matching your query:`,
      items: topMatches.map(i => ({
        id: i.id,
        title: i.title,
        location: i.location,
        type: i.type,
        date: i.date,
        image: i.image
      })),
      action: { text: `View all ${matchedItems.length} results in Browse`, url: `browse.html?q=${encodeURIComponent(matchedKeyword || q)}` },
      chips: ["Report an item", "How does claim work?"]
    });
  }

  // DEFAULT FALLTHROUGH
  return res.json({
    reply: "There are no reported items matching that description right now. 🔍\n\nFiling a **Lost Item Report** ensures our algorithm will immediately alert you when a match is submitted!",
    action: { text: "File a Lost Item Report", url: "report.html" },
    chips: ["Browse all items", "Campus desk locations", "Contact Security"]
  });
});

// 19. Admin Database Explorer Endpoints
app.get('/api/admin/tables', (req, res) => {
  try {
    const tables = LostLinkDB.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all();
    const result = tables.map(t => {
      const count = LostLinkDB.db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
      return { name: t.name, count };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/table/:name', (req, res) => {
  const tableName = req.params.name;
  const validTables = ['users', 'items', 'claims', 'matches', 'messages', 'notifications', 'categories', 'locations'];
  if (!validTables.includes(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    const columns = LostLinkDB.db.prepare(`PRAGMA table_info("${tableName}")`).all();
    const rows = LostLinkDB.db.prepare(`SELECT * FROM "${tableName}" LIMIT 200`).all();
    res.json({ tableName, columns: columns.map(c => c.name), rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/query', (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'SQL query required' });
  }

  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA') && !trimmed.startsWith('EXPLAIN')) {
    return res.status(400).json({ error: 'Only read-only queries (SELECT) are permitted in this web explorer.' });
  }

  try {
    const rows = LostLinkDB.db.prepare(sql).all();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    res.json({ sql, columns, rows, count: rows.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================
// SERVE STATIC FRONTEND
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler for unknown HTML routes
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

// Start Server only if run directly (not imported as a serverless function)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 LostLink Professional SQLite Server is LIVE`);
    console.log(`📍 Web URL: http://localhost:${PORT}`);
    console.log(`💾 Database: SQLite (data/lostlink.db)`);
    console.log(`📡 API URL: http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });
}

module.exports = app;
