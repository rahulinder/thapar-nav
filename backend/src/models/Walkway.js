const mongoose = require("mongoose");

const walkwaySchema = new mongoose.Schema(
    {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Junction",
            required: [true, "Start junction is required"],
            index: true
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Junction",
            required: [true, "End junction is required"],
            index: true,
            validate: {
                validator: function differsFromStart(value) {
                    return !this.from || !value || String(this.from) !== String(value);
                },
                message: "A walkway cannot start and end at the same junction"
            }
        },
        distanceMeters: {
            type: Number,
            required: [true, "Distance is required"],
            min: [0.1, "Distance must be greater than zero"]
        },
        bidirectional: {
            type: Boolean,
            default: true
        },
        drivable: {
            type: Boolean,
            default: false
        },
        driveBidirectional: {
            type: Boolean,
            default: true
        },
        name: {
            type: String,
            trim: true,
            maxlength: [80, "Name must be at most 80 characters"],
            default: ""
        }
    },
    { timestamps: true }
);

walkwaySchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.models.Walkway || mongoose.model("Walkway", walkwaySchema);
