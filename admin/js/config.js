export const API_PREFIX = "/api";
export const LOCAL_API_PORT = 5000;
export const PRODUCTION_API_URL = "https://developing-thapar-nav.onrender.com";

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;

export const API_BASE_URL = PRIVATE_HOST.test(window.location.hostname)
    ? `http://${window.location.hostname}:${LOCAL_API_PORT}`
    : PRODUCTION_API_URL;

export const REQUEST_TIMEOUT_MS = 25000;
export const SLOW_NOTICE_MS = 4000;
export const PAGE_SIZE = 200;

export const STORAGE_KEYS = {
    session: "thaparNavAdmin.session"
};

export const CATEGORIES = {
    academic: "Academic Blocks",
    hostel: "Hostels",
    food: "Food & Cafés",
    admin: "Administration",
    library: "Library",
    sports: "Sports & Grounds",
    medical: "Medical",
    gate: "Gates",
    parking: "Parking",
    other: "Other Places"
};

export const ROLES = {
    student: "Students",
    staff: "Teachers",
    visitor: "Visitors"
};

export const CAMPUS_BOUNDS = { minLat: 30.3, maxLat: 30.4, minLng: 76.3, maxLng: 76.45 };

export const CAMPUS_CENTER = { lat: 30.3547, lng: 76.3621 };
export const MAP_ZOOM = 17;
