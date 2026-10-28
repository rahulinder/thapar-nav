const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const controller = require("../controllers/authController");

const PHONE = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

function createAuthRouter({ loginLimiter, writeLimiter }) {
    const router = express.Router();

    const loginRules = [
        body("username").isString().withMessage("Username is required").bail().trim().isLength({ min: 1, max: 40 }).withMessage("Username is required"),
        body("password").isString().withMessage("Password is required").bail().isLength({ min: 1, max: 200 }).withMessage("Password is required")
    ];

    const profileRules = [
        body("displayName").optional().isString().bail().trim().isLength({ max: 60 }).withMessage("Name must be at most 60 characters"),
        body("email").optional().isString().bail().trim().custom((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).withMessage("Enter a valid email address"),
        body("phone").optional().isString().bail().trim().custom((v) => v === "" || PHONE.test(v)).withMessage("Enter a valid phone number"),
        body("avatar").optional().isString().bail().custom((v) => v === "" || (v.startsWith("data:image/jpeg;base64,") && v.length <= 8000)).withMessage("Profile picture is invalid or too large")
    ];

    const passwordRules = [
        body("currentPassword").isString().withMessage("Current password is required").bail().isLength({ min: 1, max: 200 }).withMessage("Current password is required"),
        body("newPassword").isString().withMessage("New password is required").bail().isLength({ min: 1, max: 200 }).withMessage("New password is required")
    ];

    router.post("/login", loginLimiter, validate(loginRules), controller.login);
    router.get("/me", requireAdmin, controller.me);
    router.put("/me", requireAdmin, writeLimiter, validate(profileRules), controller.updateProfile);
    router.put("/password", requireAdmin, loginLimiter, validate(passwordRules), controller.changePassword);

    return router;
}

module.exports = { createAuthRouter };
