import { Schema, model } from "mongoose";

const commentSchema:Schema = new Schema({
    text: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true, 
    },
    blog: {
        type: Schema.Types.ObjectId,
        ref: "Blog",
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
});

export default model("comment", commentSchema);