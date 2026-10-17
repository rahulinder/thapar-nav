const mongoose = require("mongoose");
const { CAMPUS_BOUNDS } = require("../config/constants");

const junctionSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            trim: true,
            maxlength: [80, "Label must be at most 80 characters"],
            default: ""
        },
        lat: {
            type: Number,
            required: [true, "Latitude is required"],
            min: [CAMPUS_BOUNDS.minLat, "Latitude is outside the campus area"],
            max: [CAMPUS_BOUNDS.maxLat, "Latitude is outside the campus area"]
        },
        lng: {
            type: Number,
            required: [true, "Longitude is required"],
            min: [CAMPUS_BOUNDS.minLng, "Longitude is outside the campus area"],
            max: [CAMPUS_BOUNDS.maxLng, "Longitude is outside the campus area"]
        }
    },
    { timestamps: true }
);

junctionSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.models.Junction || mongoose.model("Junction", junctionSchema);
