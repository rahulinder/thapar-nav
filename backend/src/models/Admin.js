const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ADMIN_ROLES } = require("../config/constants");

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 10;
const ADMIN_ID_PREFIX = "TN-";
const ADMIN_ID_PATTERN = /^TN-\d+$/;

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, "Username is required"],
            trim: true,
            lowercase: true,
            unique: true,
            minlength: [3, "Username must be at least 3 characters"],
            maxlength: [40, "Username must be at most 40 characters"],
            match: [/^[a-z0-9._-]+$/, "Username may contain only letters, numbers, dot, dash and underscore"],
            validate: {
                validator: (value) => !/^tn-\d+$/.test(value),
                message: "That username looks like an Admin ID. Choose another."
            }
        },
        adminId: {
            type: String,
            unique: true,
            sparse: true,
            uppercase: true,
            trim: true,
            match: [ADMIN_ID_PATTERN, "Admin ID must look like TN-0001"]
        },
        passwordHash: {
            type: String,
            required: [true, "Password hash is required"],
            select: false
        },
        role: {
            type: String,
            enum: ADMIN_ROLES,
            default: "admin"
        },
        displayName: { type: String, trim: true, maxlength: 60, default: "" },
        email: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
        phone: { type: String, trim: true, maxlength: 20, default: "" },
        avatar: { type: String, maxlength: 8000, default: "" },
        isActive: {
            type: Boolean,
            default: true
        },
        lastLoginAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

adminSchema.statics.nextAdminId = async function nextAdminId() {
    const last = await this.findOne({ adminId: ADMIN_ID_PATTERN })
        .collation({ locale: "en", numericOrdering: true })
        .sort({ adminId: -1 })
        .select("adminId")
        .lean();
    const number = last ? parseInt(last.adminId.slice(ADMIN_ID_PREFIX.length), 10) + 1 : 1;
    return ADMIN_ID_PREFIX + String(number).padStart(4, "0");
};

adminSchema.pre("validate", async function assignAdminId(next) {
    try {
        if (!this.adminId) {
            this.adminId = await this.constructor.nextAdminId();
        }
        next();
    } catch (error) {
        next(error);
    }
});

adminSchema.statics.hashPassword = async function hashPassword(plainPassword) {
    if (typeof plainPassword !== "string" || plainPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
};

adminSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
    if (typeof plainPassword !== "string" || !this.passwordHash) {
        return Promise.resolve(false);
    }
    return bcrypt.compare(plainPassword, this.passwordHash);
};

adminSchema.set("toJSON", {
    transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
