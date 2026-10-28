const mongoose = require("mongoose");
const { ROLES } = require("../config/constants");

const clientSchema = new mongoose.Schema(
    {
        clientId: { type: String, required: true, unique: true, index: true },
        userType: { type: String, enum: ROLES, required: true },
        name: { type: String, trim: true, maxlength: 40, default: "" },
        contact: { type: String, trim: true, maxlength: 80, default: "" },
        rollNo: { type: String, trim: true, uppercase: true, maxlength: 15, default: "" },
        isGuest: { type: Boolean, default: true },
        visitCount: { type: Number, default: 1 },
        lastSeenAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Client", clientSchema);
