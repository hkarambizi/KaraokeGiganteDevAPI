import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

/**
 * Fix old clerkUserId index issue
 *
 * This script drops the old clerkUserId_1 index from the users collection
 * that was used in the old architecture. The new architecture uses clerkId instead.
 *
 * Run with: npm run fix-indexes
 */

async function fixClerkUserIdIndex() {
    try {
        // Connect to MongoDB
        const DB_URI = ['development', 'production'].includes(env.NODE_ENV) ? env.MONGO_URI : env.MONGO_URI_CI;
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not available');
        }

        // Get the users collection
        const usersCollection = db.collection('users');

        // Check if collection exists
        const collections = await db.listCollections({ name: 'users' }).toArray();
        if (collections.length === 0) {
            console.log('⚠️  Users collection does not exist yet. It will be created on first use with correct indexes.');
            await mongoose.disconnect();
            return;
        }

        // List all indexes
        const indexes = await usersCollection.indexes();
        console.log('📋 Current indexes:', indexes.map(idx => idx.name));

        // Check if old clerkUserId_1 index exists
        const oldIndex = indexes.find(idx => idx.name === 'clerkUserId_1');

        if (oldIndex) {
            console.log('🔍 Found old clerkUserId_1 index, dropping it...');
            await usersCollection.dropIndex('clerkUserId_1');
            console.log('✅ Successfully dropped clerkUserId_1 index');
        } else {
            console.log('✅ No clerkUserId_1 index found (already fixed or never existed)');
        }

        // Verify current indexes after fix
        const indexesAfter = await usersCollection.indexes();
        console.log('📋 Indexes after fix:', indexesAfter.map(idx => idx.name));

        console.log('✅ Index fix complete!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error fixing indexes:', error);
        if (error.code === 27) {
            console.log('ℹ️  Collection does not exist yet. This is OK - indexes will be created correctly on first use.');
        }
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    }
}

// Run the fix
fixClerkUserIdIndex();

