import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
    try {
        // use Mongodb CI for staging environment
        const DB_URI = ['development', 'production'].includes(env.NODE_ENV) ? env.MONGO_URI : env.MONGO_URI_CI;
        await mongoose.connect(DB_URI);
        console.log('✅ MongoDB connected successfully');

        // Enable query logging in development
        if (env.NODE_ENV === 'development') {
            mongoose.set('debug', (collectionName, method, query, doc) => {
                console.log('🔍 MongoDB Query:', {
                    collection: collectionName,
                    method: method,
                    query: JSON.stringify(query),
                    doc: doc ? JSON.stringify(doc).substring(0, 200) : undefined,
                });
            });
            console.log('🔍 MongoDB query logging enabled');
        }
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
