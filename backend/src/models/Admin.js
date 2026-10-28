const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ADMIN_ROLES } = require("../config/constants");

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 10;

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
            match: [/^[a-z0-9._-]+$/, "Username may contain only letters, numbers, dot, dash and underscore"]
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
