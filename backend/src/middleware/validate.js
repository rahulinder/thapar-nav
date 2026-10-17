const { validationResult } = require("express-validator");

function validate(rules) {
    return [
        ...rules,
        (req, res, next) => {
            const result = validationResult(req);
            if (result.isEmpty()) {
                return next();
            }
            const details = result.array({ onlyFirstError: true }).map((item) => ({
                field: item.path,
                message: item.msg
            }));
            return res.status(400).json({ error: details[0].message, details });
        }
    ];
}

module.exports = { validate };
