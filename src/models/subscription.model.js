import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // one who is subscribing
        ref: "User",
        required: true
    },
    channel: {
        type: Schema.Types.ObjectId, // one who is being subscribed by subscriber
        ref: "User",
        required: true
    },
}, { timestamps: true })

export default mongoose.model("Subscription", subscriptionSchema);