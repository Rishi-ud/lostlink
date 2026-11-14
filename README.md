# LostLink — Campus Lost & Found Matching System
**Course Project: User Interface Design (UID)**  
**Campus Context:** SRM Institute of Science and Technology (SRMIST KTR)  
**Product Name:** LostLink  

---

## 📌 Executive Summary

LostLink replaces fragmented WhatsApp groups, Telegram channels, and physical noticeboards across the SRMIST Kattankulathur campus with a single, high-trust digital platform. 

### Core Problems Solved
1. **Scattered Information:** Unifies all lost and found reports into a searchable, filterable repository with campus zone tagging.
2. **Prolonged Item Inactivity:** A smart matching algorithm connects lost item reports with found item reports based on category, color, location proximity, and timestamp.
3. **Lack of Ownership Verification:** A multi-tier verification quiz requires claimants to prove ownership (e.g. brand tags, serial numbers, internal contents) before custodians release collection details.

---

## 🚀 How to Run the Project

LostLink operates in **dual mode**: it works **100% offline** (client-side mock data) OR with the included **Node.js/Express REST API backend**.

### Option A — Full-Stack Node.js + Express (Recommended)
Runs both the complete front-end AND the REST API on a single port (`5000`):
```bash
npm start
# or: node server.js
```
Then open:
- 🌐 **Web App:** `http://localhost:5000`
- 📡 **REST API Health Check:** `http://localhost:5000/api/health`
- 🗄️ **Data Persistence:** Saved reports and claims persist in `data/db.json`.

### Option B — VS Code Live Server
1. Open the `lostlink/` directory in VS Code.
2. Right-click `index.html` and select **"Open with Live Server"**.
3. Opens at `http://127.0.0.1:5500/index.html`.

### Option C — Python Simple Server
```bash
python -m http.server 3000
```
Open `http://localhost:3000`.

### Option D — Direct Browser Launch
Double-click `index.html` to open directly in Chrome, Edge, Brave, or Firefox.

---

## 📡 RESTful API Documentation (`server.js`)

The project includes a lightweight, zero-configuration Express API server with persistent JSON storage (`data/db.json`):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health & uptime check for the campus service |
| `GET` | `/api/categories` | Returns all 8 item categories with counts |
| `GET` | `/api/locations` | Returns all 20 SRMIST KTR campus locations |
| `GET` | `/api/items` | Query items with `?q=`, `?type=`, `?category=`, `?location=`, `?dateFrom=`, `?dateTo=`, `?sort=` |
| `GET` | `/api/items/:id` | Returns single item report by ID |
| `POST` | `/api/items` | Creates a new report and saves to `data/db.json` |
| `GET` | `/api/items/:id/matches` | Algorithmic match engine comparing opposing reports |
| `GET` | `/api/items/:id/questions`| Retrieves anti-fraud ownership verification quiz questions |
| `POST` | `/api/claims` | Submits ownership verification & generates collection pass |
| `POST` | `/api/auth/login` | University credentials authentication |
| `POST` | `/api/auth/signup` | Student registration with `@srmist.edu.in` validation |
| `GET` | `/api/user/dashboard` | Aggregated user reports, claims, and notification counts |
| `PATCH` | `/api/notifications/read-all` | Marks all active user notifications as read |

---

## 🗺️ Sitemap & Page Directory

| File | Purpose & Features |
|---|---|
| `index.html` | **Homepage** based on paper prototype: Hero with search bar, 1 primary CTA, 8 categories chunked with "Show more", 3-step "How It Works" strip, "Recently Found" scroll, and closing CTA. |
| `browse.html` | **Browse & Search**: Filter sidebar (Category, Type, Location, Date range), sort dropdown, search debouncer, skeleton loading, empty state. |
| `item-detail.html` | **Item Details**: Photo gallery with thumbnails, claim lifecycle timeline (Reported → Matched → Verified → Collected), metadata grid, security notice, similar items. |
| `report.html` | **Multi-Step Report Wizard**: Hick's Law Lost/Found toggle, Miller's Law 4 short steps (Basics, Details, Location/Date, Review), drag & drop image upload, inline validation, success screen. |
| `matches.html` | **Smart Match Engine**: Algorithmic suggestions comparing opposing reports with match confidence percentages, match reason badges, and direct claim links. |
| `claim.html` | **Ownership Verification Quiz**: SRM Student ID check, dynamic identification questions, solemn declaration, and generated official Collection Pass. |
| `login.html` | **Authentication**: University email validation, SRM NetID Single Sign-On link, password reset simulation. |
| `signup.html` | **Registration**: SRM Webmail domain check (`@srmist.edu.in`), student registration number, terms acceptance. |
| `dashboard.html` | **User Dashboard**: Overview metrics cards, chunked tabs for My Reports, My Claims with status timelines, and Notifications feed with mark-as-read. |
| `design-system.html` | **Design System Showcase**: Complete live catalog of colors, typography, buttons, inputs, badges, cards, steppers, skeletons, and toast alerts. |
| `404.html` | **Error Page**: Branded 404 state with quick search and recovery links. |

---

## 🎨 Design Decisions & Token Architecture

### 1. Color Palette (`css/tokens.css`)
- **Primary Trust Blue (`#3B6FE8` / `500`):** Conveys institution-level security, trust, and clarity.
- **Accent Warm Amber (`#F59E0B` / `500`):** Reserved for "Found" success moments and high-confidence matches, creating an emotional positive association with reunion.
- **Semantic Status Colors:**
  - *Lost:* Crimson Red (`#DC2626`)
  - *Found / Verified / Collected:* Emerald Green (`#16A34A`)
  - *Pending Verification:* Amber (`#EAB308`)
  - *Smart Match:* Electric Blue (`#3B6FE8`)
- **Neutral Slate Scale (`#0F172A` to `#F8FAFC`):** Balanced contrast adhering to **WCAG AA (≥ 4.5:1)** across both light mode and dark mode.

### 2. Typography
- **Headings:** **Plus Jakarta Sans** (Google Fonts) — modern geometric sans with warm, distinctive personality.
- **Body & Controls:** **Inter** (Google Fonts) — tall x-height, maximum legibility across dense metadata and form controls.

### 3. Spacing & Elevation
- **4px / 8px Grid System:** Defined through `--space-1` (4px) to `--space-24` (96px).
- **Interactive Targets:** Form inputs and buttons maintain a minimum height of **48px** to satisfy **Fitts's Law**.
- **Corner Radii:** Consistent scales from `--radius-sm` (6px) up to `--radius-xl` (24px) for cards and modals.

---

## 🧠 Checklist of Applied UX Principles

| UX Principle | Concrete UI Implementation |
|---|---|
| **Hick's Law** | **Hero CTA:** Instead of presenting competing buttons ("Report Lost" vs "Report Found") which causes decision paralysis, a single primary button `"Report an item"` is displayed. The choice between Lost and Found is positioned as a frictionless pill toggle *inside* the report form. |
| **Fitts's Law** | Primary action buttons and search controls are minimum **48px–56px in height** with generous padding (`px-6 py-3`). Critical mobile actions span full width for effortless thumb targeting. |
| **Jakob's Law** | **Familiar Patterns:** Logo positioned top-left, global navigation links centered, user authentication actions top-right; sticky navigation on scroll; e-commerce style faceted filter sidebar on the browse page. |
| **Miller's Law** | **Category Chunking:** Out of 8 categories (Keys, Bags, Electronics, Cards/IDs, Books, Clothing, Jewelry, Pets), the top 4 are displayed upfront with a `"Show more categories"` progressive disclosure toggle. **Report Form:** Broken into 4 distinct, bite-sized steps (Basics → Details → Location → Review). **Dashboard:** Organized into 3 discrete tabs. |
| **Aesthetic–Usability Effect** | Consistent typography hierarchy, uniform card elevations with soft drop shadows, polished micro-interactions (hover elevations, focus rings), and unified Lucide line iconography throughout. |
| **Status Feedback & States** | Every interactive element features distinct `:hover`, `:focus-visible`, `:active`, and `:disabled` states. Data views provide skeleton pulse loaders during transitions, informative empty states with call-to-actions, and animated toast notifications. |
| **Accessibility (WCAG AA)** | Semantic HTML structure (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`), `<label>` elements linked to inputs, skip-to-content links, `aria-label` attributes on icon-only buttons, high contrast ratios, and `prefers-reduced-motion` compliance. |

---

## 🏛️ Course Project Information
- **Institution:** SRM Institute of Science and Technology, Kattankulathur (SRMIST KTR)
- **Subject:** User Interface Design (UID) Coursework
- **Target Audience:** 50,000+ students, faculty, and campus staff members
