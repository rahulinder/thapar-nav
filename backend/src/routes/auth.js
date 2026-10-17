const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const controller = require("../controllers/authController");

function createAuthRouter({ loginLimiter }) {
    const router = express.Router();

    const loginRules = [
        body("username").isString().withMessage("Username is required").bail().trim().isLength({ min: 1, max: 40 }).withMessage("Username is required"),
        body("password").isString().withMessage("Password is required").bail().isLength({ min: 1, max: 200 }).withMessage("Password is required")
    ];

    router.post("/login", loginLimiter, validate(loginRules), controller.login);
    router.get("/me", requireAdmin, controller.me);

    return router;
}

module.exports = { createAuthRouter };
