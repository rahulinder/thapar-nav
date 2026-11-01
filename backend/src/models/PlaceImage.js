const mongoose = require("mongoose");

const placeImageSchema = new mongoose.Schema(
    {
        place: { type: mongoose.Schema.Types.ObjectId, ref: "Place", required: true, index: true },
        data: { type: Buffer, required: true },
        contentType: { type: String, required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.models.PlaceImage || mongoose.model("PlaceImage", placeImageSchema);
