const mongoose = require("mongoose");
const { ROLES, PLACE_CATEGORIES, CAMPUS_BOUNDS } = require("../config/constants");

const photoSchema = new mongoose.Schema(
    {
        data: { type: Buffer, required: true },
        contentType: { type: String, required: true }
    },
    { _id: false }
);

const placeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Place name is required"],
            trim: true,
            minlength: [2, "Place name must be at least 2 characters"],
            maxlength: [120, "Place name must be at most 120 characters"]
        },
        nameKey: {
            type: String,
            select: false
        },
        category: {
            type: String,
            required: [true, "Category is required"],
            enum: {
                values: PLACE_CATEGORIES,
                message: "Category must be one of: " + PLACE_CATEGORIES.join(", ")
            },
            index: true
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, "Description must be at most 1000 characters"],
            default: ""
        },
        aliases: {
            type: [{ type: String, trim: true, maxlength: 80 }],
            default: [],
            validate: {
                validator: (list) => list.length <= 10,
                message: "A place can have at most 10 aliases"
            }
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
        },
        visibleTo: {
            type: [{ type: String, enum: ROLES }],
            default: () => [...ROLES],
            validate: {
                validator: (list) => list.length > 0,
                message: "A place must be visible to at least one role"
            }
        },
        openingHours: {
            type: String,
            trim: true,
            maxlength: [120, "Opening hours must be at most 120 characters"],
            default: ""
        },
        isEntrance: {
            type: Boolean,
            default: false
        },
        junction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Junction",
            default: null
        },
        isActive: {
            type: Boolean,
            default: true
        },
        hasPhoto: {
            type: Boolean,
            default: false
        },
        photoVersion: {
            type: Number,
            default: 0
        },
        gallery: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: "PlaceImage" }],
            default: [],
            validate: {
                validator: (list) => list.length <= 8,
                message: "A place can have at most 8 gallery images"
            }
        },
        photo: {
            type: photoSchema,
            select: false,
            default: undefined
        }
    },
    { timestamps: true }
);

placeSchema.index({ visibleTo: 1, isActive: 1 });
placeSchema.index({ nameKey: 1 }, { unique: true });

placeSchema.pre("validate", function setNameKey(next) {
    if (typeof this.name === "string") {
        this.nameKey = this.name.trim().toLowerCase();
    }
    next();
});

placeSchema.set("toJSON", {
    transform(doc, ret) {
        delete ret.nameKey;
        delete ret.photo;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.models.Place || mongoose.model("Place", placeSchema);
