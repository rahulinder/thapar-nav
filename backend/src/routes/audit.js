const express = require("express");
const { query } = require("express-validator");
const { validate } = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const controller = require("../controllers/auditController");

function createAuditRouter() {
    const router = express.Router();

    const listRules = [
        query("entity").optional({ values: "falsy" }).isIn(["place", "junction", "walkway"]).withMessage("Unknown type"),
        query("action").optional({ values: "falsy" }).isIn(["created", "updated", "deleted"]).withMessage("Unknown action"),
        query("q").optional().isString().bail().trim().isLength({ max: 80 }).withMessage("Search text is too long"),
        query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be between 1 and 100"),
        query("page").optional().isInt({ min: 1, max: 100000 }).withMessage("page must be 1 or more")
    ];

    router.get("/", requireAdmin, validate(listRules), controller.list);

    return router;
}

module.exports = { createAuditRouter };
