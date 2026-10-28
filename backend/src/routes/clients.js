const express = require("express");
const { body, query, param } = require("express-validator");
const { ROLES } = require("../config/constants");
const { validate } = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const controller = require("../controllers/clientsController");

const CONTACT = /^([^\s@]+@[^\s@]+\.[^\s@]+|\+?[0-9][0-9\s-]{6,18}[0-9])$/;

function createClientsRouter({ writeLimiter }) {
    const router = express.Router();

    const pingRules = [
        body("clientId").isString().bail().matches(/^[A-Za-z0-9-]{16,64}$/).withMessage("Invalid client id"),
        body("userType").isString().bail().isIn(ROLES).withMessage("Unknown user type"),
        body("name").optional({ values: "falsy" }).isString().bail().trim().isLength({ max: 40 }).withMessage("Name is too long"),
        body("rollNo").optional({ values: "falsy" }).isString().bail().trim().matches(/^[A-Za-z0-9]{5,15}$/).withMessage("Invalid roll number"),
        body("contact").optional({ values: "falsy" }).isString().bail().trim().matches(CONTACT).withMessage("Contact must be a phone number or email")
    ];

    const listRules = [
        query("type").optional().isIn(["all", "registered", "guest"]).withMessage("Unknown type"),
        query("userType").optional({ values: "falsy" }).isIn(ROLES).withMessage("Unknown user type"),
        query("q").optional().isString().bail().trim().isLength({ max: 80 }).withMessage("Search text is too long")
    ];

    const idRules = [param("id").isMongoId().withMessage("Invalid id")];

    router.post("/ping", writeLimiter, validate(pingRules), controller.ping);
    router.get("/", requireAdmin, validate(listRules), controller.list);
    router.delete("/:id", requireAdmin, validate(idRules), controller.remove);

    return router;
}

module.exports = { createClientsRouter };
