const express = require("express");
const { body, param } = require("express-validator");
const { validate } = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const controller = require("../controllers/pathsController");

function createPathsRouter({ writeLimiter }) {
    const router = express.Router();

    const idRule = param("id").isMongoId().withMessage("Invalid id");

    const junctionRules = [
        body("lat").exists({ values: "falsy" }).withMessage("lat is required").bail().isFloat({ min: -90, max: 90 }).withMessage("Latitude must be a number").toFloat(),
        body("lng").exists({ values: "falsy" }).withMessage("lng is required").bail().isFloat({ min: -180, max: 180 }).withMessage("Longitude must be a number").toFloat(),
        body("label").optional().isString().withMessage("Label must be text").bail().trim().isLength({ max: 80 }).withMessage("Label is too long")
    ];

    const walkwayExtras = [
        body("name").optional().isString().withMessage("Name must be text").bail().trim().isLength({ max: 80 }).withMessage("Name is too long"),
        body("bidirectional").optional().isBoolean({ strict: true }).withMessage("bidirectional must be true or false"),
        body("wheelchairAccessible").optional().isBoolean({ strict: true }).withMessage("wheelchairAccessible must be true or false")
    ];

    const createWalkwayRules = [
        body("from").isMongoId().withMessage("from must be a junction id"),
        body("to").isMongoId().withMessage("to must be a junction id"),
        ...walkwayExtras
    ];

    router.get("/network", controller.getNetwork);
    router.get("/junctions", controller.listJunctions);
    router.get("/walkways", controller.listWalkways);

    router.post("/junctions", writeLimiter, requireAdmin, validate(junctionRules), controller.createJunction);
    router.put("/junctions/:id", writeLimiter, requireAdmin, validate([idRule, ...junctionRules]), controller.updateJunction);
    router.delete("/junctions/:id", writeLimiter, requireAdmin, validate([idRule]), controller.deleteJunction);

    router.post("/walkways", writeLimiter, requireAdmin, validate(createWalkwayRules), controller.createWalkway);
    router.put("/walkways/:id", writeLimiter, requireAdmin, validate([idRule, ...walkwayExtras]), controller.updateWalkway);
    router.delete("/walkways/:id", writeLimiter, requireAdmin, validate([idRule]), controller.deleteWalkway);

    return router;
}

module.exports = { createPathsRouter };
