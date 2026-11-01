export const API_PREFIX = "/api";
export const LOCAL_API_PORT = 5000;
export const PRODUCTION_API_URL = "https://developing-thapar-nav.onrender.com";

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;

export const API_BASE_URL = PRIVATE_HOST.test(window.location.hostname)
    ? `http://${window.location.hostname}:${LOCAL_API_PORT}`
    : PRODUCTION_API_URL;

export const CAMPUS_CENTER = { lat: 30.3547, lng: 76.3621 };
export const CAMPUS_RADIUS_METERS = 3000;
export const NEAR_PLACE_METERS = 200;
export const DEFAULT_ZOOM = 16;
export const FOCUS_ZOOM = 18;
export const FALLBACK_LOCATION_NAME = "Main Gate";
export const OFF_CAMPUS_LOCATION_NAME = "Thapar campus";

export const REQUEST_TIMEOUT_MS = 25000;
export const MAX_ATTEMPTS = 3;
export const SLOW_NOTICE_MS = 4000;
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const HOME_CARDS_PER_SECTION = 8;
export const SUGGESTION_LIMIT = 6;

export const STORAGE_KEYS = {
    role: "thaparNav.role",
    name: "thaparNav.name",
    places: "thaparNav.places.v1"
};

export const ROLES = {
    student: {
        label: "Student",
        plural: "students",
        order: ["hostel", "food", "academic", "library", "sports", "medical", "gate", "parking", "admin", "other"]
    },
    staff: {
        label: "Teacher",
        plural: "staff",
        order: ["academic", "admin", "library", "food", "parking", "gate", "medical", "sports", "hostel", "other"]
    },
    visitor: {
        label: "Visitor",
        plural: "visitors",
        order: ["gate", "parking", "admin", "food", "medical", "library", "academic", "sports", "hostel", "other"]
    }
};

export const ROLE_SHORTCUTS = {
    student: [
        { label: "Hostel", category: "hostel" },
        { label: "Food", category: "food" },
        { label: "Library", category: "library" },
        { label: "Academic block", category: "academic" }
    ],
    staff: [
        { label: "Academic block", category: "academic" },
        { label: "Parking", category: "parking" },
        { label: "Admin office", category: "admin" },
        { label: "Food", category: "food" }
    ],
    visitor: [
        { label: "Gate", category: "gate" },
        { label: "Parking", category: "parking" },
        { label: "Admin office", category: "admin" },
        { label: "Medical", category: "medical" }
    ]
};

export const CATEGORIES = {
    academic: { label: "Academic Blocks", color: "#7C3AED" },
    hostel: { label: "Hostels", color: "#E53030" },
    food: { label: "Food & Cafés", color: "#F59E0B" },
    admin: { label: "Administration", color: "#0071E3" },
    library: { label: "Library", color: "#0D9488" },
    sports: { label: "Sports & Grounds", color: "#15803D" },
    medical: { label: "Medical", color: "#E62589" },
    gate: { label: "Gates", color: "#0D1117" },
    parking: { label: "Parking", color: "#475569" },
    other: { label: "Other Places", color: "#6B7280" }
};

export const DEFAULT_CATEGORY_COLOR = "#6B7280";
