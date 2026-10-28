const express = require("express");
const { body, query, param } = require("express-validator");
const { PLACE_CATEGORIES, ROLES } = require("../config/constants");
const { validate } = require("../middleware/validate");
const { requireAdmin, optionalAdmin } = require("../middleware/auth");
const controller = require("../controllers/placesController");

function createPlacesRouter({ writeLimiter }) {
    const router = express.Router();

    const idRule = param("id").isMongoId().withMessage("Invalid place id");

    const listRules = [
        query("role").optional().isString().bail().isIn(ROLES).withMessage("Unknown role"),
        query("category")
            .optional()
            .isString()
            .bail()
            .isIn(PLACE_CATEGORIES)
            .withMessage("Unknown category"),
        query("q").optional().isString().bail().trim().isLength({ max: 80 }).withMessage("Search text is too long"),
        query("limit").optional().isInt({ min: 1, max: 500 }).withMessage("limit must be between 1 and 500"),
        query("page").optional().isInt({ min: 1, max: 10000 }).withMessage("page must be 1 or more"),
        query("includeInactive").optional().isIn(["true", "false"]).withMessage("includeInactive must be true or false")
    ];

    const fieldRules = (required) => {
        const start = (chain) => (required ? chain.exists({ values: "falsy" }).withMessage((value, { path }) => path + " is required").bail() : chain.optional());
        return [
            start(body("name"))
                .isString().withMessage("Name must be text").bail()
                .trim()
                .isLength({ min: 2, max: 120 }).withMessage("Name must be 2 to 120 characters"),
            start(body("category"))
                .isString().bail()
                .isIn(PLACE_CATEGORIES).withMessage("Category must be one of: " + PLACE_CATEGORIES.join(", ")),
            start(body("lat")).isFloat({ min: -90, max: 90 }).withMessage("Latitude must be a number").toFloat(),
            start(body("lng")).isFloat({ min: -180, max: 180 }).withMessage("Longitude must be a number").toFloat(),
            body("description").optional().isString().withMessage("Description must be text").bail().trim().isLength({ max: 1000 }).withMessage("Description is too long"),
            body("aliases").optional().isArray({ max: 10 }).withMessage("aliases must be a list of at most 10 names"),
            body("aliases.*").isString().withMessage("Each alias must be text").bail().trim().isLength({ min: 1, max: 80 }).withMessage("Each alias must be 1 to 80 characters"),
            body("visibleTo").optional().isArray({ min: 1, max: 3 }).withMessage("visibleTo must be a list with at least one role"),
            body("visibleTo.*").isIn(ROLES).withMessage("Unknown role in visibleTo"),
            body("openingHours").optional().isString().withMessage("Opening hours must be text").bail().trim().isLength({ max: 120 }).withMessage("Opening hours are too long"),
            body("isEntrance").optional().isBoolean({ strict: true }).withMessage("isEntrance must be true or false"),
            body("isActive").optional().isBoolean({ strict: true }).withMessage("isActive must be true or false"),
            body("junction").optional({ values: "null" }).isMongoId().withMessage("Invalid junction id")
        ];
    };

    router.get("/", optionalAdmin, validate(listRules), controller.listPlaces);
    router.get("/:id/photo", optionalAdmin, validate([idRule]), controller.getPhoto);
    router.put(
        "/:id/photo",
        writeLimiter,
        requireAdmin,
        validate([idRule]),
        express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "450kb" }),
        controller.setPhoto
    );
    router.delete("/:id/photo", writeLimiter, requireAdmin, validate([idRule]), controller.removePhoto);
    router.get("/:id", optionalAdmin, validate([idRule]), controller.getPlace);
    const bulkRules = [
        body("mode").optional().isIn(["skip", "update"]).withMessage("mode must be skip or update"),
        body("places").isArray({ min: 1, max: 30 }).withMessage("places must be a list of 1 to 30 places")
    ];

    router.post("/bulk", writeLimiter, requireAdmin, validate(bulkRules), controller.bulkImport);
    router.post("/", writeLimiter, requireAdmin, validate(fieldRules(true)), controller.createPlace);
    router.put("/:id", writeLimiter, requireAdmin, validate([idRule, ...fieldRules(false)]), controller.updatePlace);
    router.delete("/:id", writeLimiter, requireAdmin, validate([idRule]), controller.deletePlace);

    return router;
}

module.exports = { createPlacesRouter };
