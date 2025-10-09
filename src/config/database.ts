import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
    try {
        // use Mongodb CI for staging environment
        const DB_URI = ['development', 'production'].includes(env.NODE_ENV) ? env.MONGO_URI : env.MONGO_URI_CI;
        await mongoose.connect(DB_URI);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
});
