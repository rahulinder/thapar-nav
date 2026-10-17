const express = require("express");
const { query } = require("express-validator");
const { ROLES } = require("../config/constants");
const { validate } = require("../middleware/validate");
const controller = require("../controllers/routeController");

function endpointRules(prefix, label) {
    const place = prefix + "Place";
    const lat = prefix + "Lat";
    const lng = prefix + "Lng";
    return [
        query(place).optional().isString().bail().isMongoId().withMessage(place + " must be a place id"),
        query(lat)
            .if((value, { req }) => !req.query[place])
            .exists().withMessage(label + ": give " + place + " or " + lat + " and " + lng).bail()
            .isFloat({ min: -90, max: 90 }).withMessage(lat + " must be a latitude"),
        query(lng)
            .if((value, { req }) => !req.query[place])
            .exists().withMessage(label + ": give " + place + " or " + lat + " and " + lng).bail()
            .isFloat({ min: -180, max: 180 }).withMessage(lng + " must be a longitude")
    ];
}

function createRouteRouter({ routeLimiter }) {
    const router = express.Router();

    const rules = [
        ...endpointRules("from", "Start"),
        ...endpointRules("to", "Destination"),
        query("role").optional().isString().bail().isIn(ROLES).withMessage("Unknown role"),
        query("accessible").optional().isIn(["true", "false"]).withMessage("accessible must be true or false")
    ];

    router.get("/", routeLimiter, validate(rules), controller.getRoute);
    return router;
}

module.exports = { createRouteRouter };
