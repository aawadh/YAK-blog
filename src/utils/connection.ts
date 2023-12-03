import { connect } from "mongoose";

export const connectToDatabase = async() => {
    try{
        await connect(`mongodb+srv://admin:${process.env.MONGODB_PASSWORD}@clusterb.mzvqb1o.mongodb.net/?retryWrites=true&w=majority`)
    } catch (err) {
        console.log(err);
        throw new Error(err);
    }
};