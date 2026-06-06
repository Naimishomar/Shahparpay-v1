import mongoose from 'mongoose';

export const connectDB = async()=>{
    try {
        const connection = await mongoose.connect(process.env.MONGO_URI);
        if(connection.connection.readyState === 1){
            console.log(`MongoDB connected : ${connection.connection.host}`);
        }
        return connection;
    } catch (error) {
        console.log("Database connection failed", error.message);
        throw error;
    }
}