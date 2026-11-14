/* ============================================
   LOSTLINK — Master Data
   SRMIST KTR Campus master categories and locations.
   Preloaded realistic demo items for easy testing.
   ============================================ */

const CATEGORIES = [
  { id: 'keys',        name: 'Keys',        icon: 'key-round',   count: 1 },
  { id: 'bags',        name: 'Bags',        icon: 'briefcase',   count: 2 },
  { id: 'electronics', name: 'Electronics', icon: 'laptop',      count: 3 },
  { id: 'cards',       name: 'Cards / IDs', icon: 'credit-card', count: 1 },
  { id: 'books',       name: 'Books',       icon: 'book-open',   count: 0 },
  { id: 'clothing',    name: 'Clothing',    icon: 'shirt',       count: 1 },
  { id: 'jewelry',     name: 'Jewelry',     icon: 'gem',         count: 0 },
  { id: 'pets',        name: 'Pets',        icon: 'paw-print',   count: 0 },
];

const LOCATIONS = [
  'ARCH GATE',
  'GENZ CAFE',
  'MEENAKSHI HOSTEL',
  'MEENAKSHI PRINT SHOP',
  'JAVA CANTEEN',
  'UB BUILDING',
  'NRI HOSTEL',
  'CHEM LAB',
  'VALLIAMAI GATE',
  'TRS GATE',
  'HUMANITIES BLOCK',
  'TP',
  'TP2',
  'BIO TECH BLOCK',
  'ARCHITECTURE BLOCK GROUND',
  'PARKING UB',
  'PARKING AUDITORIUM',
  'AUDITORIUM 1',
  'MINI AUDITORIUM',
  'ANY OTHER SPECIFIED'
];

// Preloaded demo items for campus demonstration (No random SVGs; clean placeholders or user-uploaded photos only)
const ITEMS = [
  {
    id: 1,
    type: 'lost',
    status: 'reported',
    title: 'Navy Blue Wildcraft Backpack',
    category: 'bags',
    color: 'Blue',
    description: 'Navy blue Wildcraft backpack with two main compartments and an orange bottle holder. Contains semester notebooks, Casio calculator, and SRM student ID card.',
    location: 'TP',
    date: '2026-11-11',
    time: '14:30',
    image: '',
    images: [],
    user: {
      name: 'Rahul Sharma',
      avatar: 'RS',
      email: 'rahul.sharma@srmist.edu.in'
    },
    postedAt: 'Yesterday'
  },
  {
    id: 2,
    type: 'lost',
    status: 'reported',
    title: 'Casio fx-991EX Scientific Calculator',
    category: 'electronics',
    color: 'Black',
    description: 'Black Casio scientific calculator fx-991EX ClassWiz with silver navigation pad. Left on 3rd floor TP lab desk after end semester lab exam.',
    location: 'TP2',
    date: '2026-11-12',
    time: '10:15',
    image: '',
    images: [],
    user: {
      name: 'Aditi Rao',
      avatar: 'AR',
      email: 'aditi.rao@srmist.edu.in'
    },
    postedAt: '3 hours ago'
  },
  {
    id: 3,
    type: 'lost',
    status: 'reported',
    title: 'SRMIST Student ID Card & Metro Pass',
    category: 'cards',
    color: 'Blue',
    description: 'SRMIST student ID card in a clear card holder with navy blue SRM lanyard. Chennai Metro travel card kept in the back slot.',
    location: 'JAVA CANTEEN',
    date: '2026-11-12',
    time: '13:00',
    image: '',
    images: [],
    user: {
      name: 'Priya Sundaram',
      avatar: 'PS',
      email: 'priya.s@srmist.edu.in'
    },
    postedAt: '1 hour ago'
  },
  {
    id: 4,
    type: 'lost',
    status: 'reported',
    title: 'Hostel Room & Bike Key Ring',
    category: 'keys',
    color: 'Silver',
    description: 'Godrej brass lock key and Honda Activa bike key on a red woven Royal Enfield keychain.',
    location: 'MEENAKSHI HOSTEL',
    date: '2026-11-11',
    time: '08:45',
    image: '',
    images: [],
    user: {
      name: 'Vikram Reddy',
      avatar: 'VR',
      email: 'vikram.reddy@srmist.edu.in'
    },
    postedAt: 'Yesterday'
  },
  {
    id: 5,
    type: 'lost',
    status: 'reported',
    title: 'Apple AirPods Pro (2nd Gen) in White Case',
    category: 'electronics',
    color: 'White',
    description: 'White AirPods Pro case with small scratch near hinge. Engraved with initials \'KN\'. Left in 2nd floor reading hall.',
    location: 'UB BUILDING',
    date: '2026-11-10',
    time: '16:30',
    image: '',
    images: [],
    user: {
      name: 'Kartik Nair',
      avatar: 'KN',
      email: 'kartik.nair@srmist.edu.in'
    },
    postedAt: '2 days ago'
  },
  {
    id: 6,
    type: 'found',
    status: 'reported',
    title: 'Boat Rockerz 450 Bluetooth Headphones',
    category: 'electronics',
    color: 'Black',
    description: 'Matte black on-ear Bluetooth headphones found on wooden table #4 in the Main Canteen. Kept at security counter.',
    location: 'GENZ CAFE',
    date: '2026-11-11',
    time: '12:45',
    image: '',
    images: [],
    user: {
      name: 'Campus Security Desk',
      avatar: 'SD',
      email: 'security.desk@srmist.edu.in'
    },
    postedAt: 'Yesterday'
  },
  {
    id: 7,
    type: 'found',
    status: 'reported',
    title: 'Milton Thermosteel Water Bottle (750ml)',
    category: 'clothing',
    color: 'Silver',
    description: 'Silver 750ml stainless steel flask with black screw top and carrying loop found in Room 302 after lecture.',
    location: 'BIO TECH BLOCK',
    date: '2026-11-10',
    time: '15:20',
    image: '',
    images: [],
    user: {
      name: 'Suresh Kumar',
      avatar: 'SK',
      email: 'suresh.k@srmist.edu.in'
    },
    postedAt: '2 days ago'
  },
  {
    id: 8,
    type: 'found',
    status: 'reported',
    title: 'Sky Blue Skybags College Backpack',
    category: 'bags',
    color: 'Blue',
    description: 'Sky blue backpack found on a bench near University Building 4th floor staircase. Has front zip compartments. Safe at department desk.',
    location: 'UB BUILDING',
    date: '2026-11-12',
    time: '11:00',
    image: '',
    images: [],
    user: {
      name: 'Rishi Verma',
      avatar: 'RV',
      email: 'rishi.v@srmist.edu.in'
    },
    postedAt: '2 hours ago'
  }
];

// Dynamic matches array
const MATCHES = [];

// Active user (dynamically resolved from session/localStorage)
let CURRENT_USER = null;

// Dynamic notifications
const NOTIFICATIONS = [];

// Item-specific verification questions
const VERIFICATION_QUESTIONS = {};

// Colors for filters
const COLORS = ['Black', 'White', 'Blue', 'Red', 'Green', 'Gray', 'Silver', 'Gold', 'Brown', 'Clear'];
