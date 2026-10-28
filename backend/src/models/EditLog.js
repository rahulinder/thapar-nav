const mongoose = require("mongoose");

const changeSchema = new mongoose.Schema(
    {
        field: { type: String, required: true, maxlength: 40 },
        from: { type: String, default: "", maxlength: 200 },
        to: { type: String, default: "", maxlength: 200 }
    },
    { _id: false }
);

const editLogSchema = new mongoose.Schema(
    {
        admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
        adminName: { type: String, required: true, trim: true, maxlength: 80 },
        action: { type: String, enum: ["created", "updated", "deleted"], required: true, index: true },
        entity: { type: String, enum: ["place", "junction", "walkway"], required: true, index: true },
        entityId: { type: String, required: true, maxlength: 40 },
        entityName: { type: String, default: "", maxlength: 200 },
        summary: { type: String, default: "", maxlength: 300 },
        changes: { type: [changeSchema], default: [] }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

editLogSchema.index({ createdAt: -1 });

editLogSchema.set("toJSON", {
    transform(doc, ret) {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.models.EditLog || mongoose.model("EditLog", editLogSchema);
