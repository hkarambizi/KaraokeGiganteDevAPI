#!/usr/bin/env tsx
/**
 * Database Migration: Fix User Indexes
 *
 * Problem: Old 'clerkUserId' index conflicts with new 'clerkId' field
 * Solution: Drop old index, ensure correct indexes exist
 *
 * Run: npx tsx scripts/fix-user-indexes.ts
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function fixUserIndexes() {
    try {
        console.log('🔧 Connecting to MongoDB...');
        await mongoose.connect(env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Check if collection exists
        const collections = await db.listCollections({ name: 'users' }).toArray();
        const collectionExists = collections.length > 0;

        if (!collectionExists) {
            console.log('\n📝 Users collection does not exist yet - will be created on first use');
            console.log('✅ No index migration needed for empty database');
            console.log('\n💡 When your first user signs in, Mongoose will create the collection with correct indexes');
            return;
        }

        // Get all current indexes
        console.log('\n📋 Current indexes on users collection:');
        const indexes = await usersCollection.indexes();
        indexes.forEach((index) => {
            console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        // Check for old clerkUserId index
        const hasOldIndex = indexes.some((idx) => idx.name === 'clerkUserId_1');

        if (hasOldIndex) {
            console.log('\n🗑️  Dropping old clerkUserId_1 index...');
            await usersCollection.dropIndex('clerkUserId_1');
            console.log('✅ Old index dropped');
        } else {
            console.log('\n✅ No old clerkUserId index found');
        }

        // Check for clerkId index
        const hasClerkIdIndex = indexes.some((idx) => idx.name === 'clerkId_1');

        if (!hasClerkIdIndex) {
            console.log('\n🔨 Creating clerkId index...');
            await usersCollection.createIndex({ clerkId: 1 }, { unique: true });
            console.log('✅ clerkId index created');
        } else {
            console.log('\n✅ clerkId index already exists');
        }

        // Check for username index
        const hasUsernameIndex = indexes.some((idx) => idx.name === 'username_1');

        if (!hasUsernameIndex) {
            console.log('\n🔨 Creating username index...');
            await usersCollection.createIndex({ username: 1 }, { unique: true });
            console.log('✅ username index created');
        } else {
            console.log('\n✅ username index already exists');
        }

        // Show final indexes
        console.log('\n📋 Final indexes on users collection:');
        const finalIndexes = await usersCollection.indexes();
        finalIndexes.forEach((index) => {
            console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        // Count documents with issues
        console.log('\n🔍 Checking for data issues...');

        const withoutClerkId = await usersCollection.countDocuments({ clerkId: { $exists: false } });
        const withoutUsername = await usersCollection.countDocuments({ username: { $exists: false } });
        const duplicateClerkIds = await usersCollection.aggregate([
            { $group: { _id: '$clerkId', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        console.log(`  - Documents without clerkId: ${withoutClerkId}`);
        console.log(`  - Documents without username: ${withoutUsername}`);
        console.log(`  - Duplicate clerkIds: ${duplicateClerkIds.length}`);

        if (withoutClerkId > 0 || withoutUsername > 0) {
            console.log('\n⚠️  WARNING: Some documents are missing required fields!');
            console.log('   These documents may need manual cleanup.');

            // Show sample documents with issues
            if (withoutClerkId > 0) {
                console.log('\n   Sample documents without clerkId:');
                const samples = await usersCollection.find({ clerkId: { $exists: false } }).limit(3).toArray();
                samples.forEach((doc) => {
                    console.log(`     - _id: ${doc._id}, email: ${doc.email}, username: ${doc.username}`);
                });
            }

            if (withoutUsername > 0) {
                console.log('\n   Sample documents without username:');
                const samples = await usersCollection.find({ username: { $exists: false } }).limit(3).toArray();
                samples.forEach((doc) => {
                    console.log(`     - _id: ${doc._id}, clerkId: ${doc.clerkId}, email: ${doc.email}`);
                });
            }
        } else {
            console.log('✅ All documents have required fields');
        }

        console.log('\n🎉 Migration completed successfully!');

    } catch (error: any) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run migration
fixUserIndexes();
