const ROLES = Object.freeze(["student", "staff", "visitor"]);

const PLACE_CATEGORIES = Object.freeze([
    "academic",
    "hostel",
    "food",
    "admin",
    "library",
    "sports",
    "medical",
    "gate",
    "parking",
    "other"
]);

const ADMIN_ROLES = Object.freeze(["admin", "superadmin"]);

const CAMPUS_BOUNDS = Object.freeze({
    minLat: 30.3,
    maxLat: 30.4,
    minLng: 76.3,
    maxLng: 76.45
});

module.exports = { ROLES, PLACE_CATEGORIES, ADMIN_ROLES, CAMPUS_BOUNDS };
