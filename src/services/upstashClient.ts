import { Redis } from '@upstash/redis';
import { env } from '../config/env.js';

// Initialize Upstash Redis client (if credentials available)
let redis: Redis | null = null;

if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ Upstash Redis connected');
} else {
    console.warn('⚠️  Upstash Redis not configured - import features will be limited');
}

function ensureRedis(): Redis {
    if (!redis) {
        throw new Error('Upstash Redis not configured. Please add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env');
    }
    return redis;
}

export { redis };

/**
 * Cache helpers
 */

export async function getCache<T>(key: string): Promise<T | null> {
    try {
        const client = ensureRedis();
        const data = await client.get<T>(key);
        return data;
    } catch (error) {
        console.error(`Cache get error for key ${key}:`, error);
        return null;
    }
}

export async function setCache<T>(
    key: string,
    value: T,
    ttlSeconds?: number
): Promise<boolean> {
    try {
        const client = ensureRedis();
        if (ttlSeconds) {
            await client.set(key, value, { ex: ttlSeconds });
        } else {
            await client.set(key, value);
        }
        return true;
    } catch (error) {
        console.error(`Cache set error for key ${key}:`, error);
        return false;
    }
}

export async function delCache(key: string): Promise<boolean> {
    try {
        const client = ensureRedis();
        await client.del(key);
        return true;
    } catch (error) {
        console.error(`Cache del error for key ${key}:`, error);
        return false;
    }
}

/**
 * Import playlist management (SET operations)
 */

export async function addToPlaylist(
    userId: string,
    songId: string
): Promise<{ added: boolean; total: number }> {
    const client = ensureRedis();
    const key = `imports:playlist:${userId}`;

    try {
        const added = await client.sadd(key, songId);
        const total = await client.scard(key);

        return {
            added: added > 0,
            total: total || 0,
        };
    } catch (error) {
        console.error(`Error adding to playlist for user ${userId}:`, error);
        throw error;
    }
}

export async function removeFromPlaylist(
    userId: string,
    songId: string
): Promise<{ removed: boolean; total: number }> {
    const client = ensureRedis();
    const key = `imports:playlist:${userId}`;

    try {
        const removed = await client.srem(key, songId);
        const total = await client.scard(key);

        return {
            removed: removed > 0,
            total: total || 0,
        };
    } catch (error) {
        console.error(`Error removing from playlist for user ${userId}:`, error);
        throw error;
    }
}

export async function getPlaylist(userId: string): Promise<string[]> {
    const client = ensureRedis();
    const key = `imports:playlist:${userId}`;

    try {
        const members = await client.smembers(key);
        return members || [];
    } catch (error) {
        console.error(`Error getting playlist for user ${userId}:`, error);
        return [];
    }
}

export async function clearPlaylist(userId: string): Promise<boolean> {
    const client = ensureRedis();
    const key = `imports:playlist:${userId}`;

    try {
        await client.del(key);
        return true;
    } catch (error) {
        console.error(`Error clearing playlist for user ${userId}:`, error);
        return false;
    }
}

/**
 * Draft import management
 */

export interface ImportDraft {
    id: string;
    userId: string;
    songs: Array<{
        title: string;
        artist: string;
        album?: string;
        duration?: number;
        genre?: string;
        rowNumber: number;
        errors?: string[];
    }>;
    createdAt: number;
}

export async function saveDraft(
    userId: string,
    draftId: string,
    data: Omit<ImportDraft, 'id' | 'userId' | 'createdAt'>
): Promise<boolean> {
    const client = ensureRedis();
    const key = `imports:draft:${userId}:${draftId}`;
    const draft: ImportDraft = {
        id: draftId,
        userId,
        ...data,
        createdAt: Date.now(),
    };

    try {
        // TTL of 24 hours
        await client.set(key, JSON.stringify(draft), { ex: 86400 });
        return true;
    } catch (error) {
        console.error(`Error saving draft ${draftId}:`, error);
        return false;
    }
}

export async function getDraft(
    userId: string,
    draftId: string
): Promise<ImportDraft | null> {
    const client = ensureRedis();
    const key = `imports:draft:${userId}:${draftId}`;

    try {
        const data = await client.get<string>(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data as string) as ImportDraft;
    } catch (error) {
        console.error(`Error getting draft ${draftId}:`, error);
        return null;
    }
}

export async function deleteDraft(userId: string, draftId: string): Promise<boolean> {
    const client = ensureRedis();
    const key = `imports:draft:${userId}:${draftId}`;

    try {
        await client.del(key);
        return true;
    } catch (error) {
        console.error(`Error deleting draft ${draftId}:`, error);
        return false;
    }
}

/**
 * Search cache helpers
 */

export function getSearchCacheKey(query: string): string {
    return `search:q:${query.toLowerCase().trim()}`;
}

export async function getCachedSearch<T>(query: string): Promise<T | null> {
    const key = getSearchCacheKey(query);
    return getCache<T>(key);
}

export async function setCachedSearch<T>(
    query: string,
    results: T,
    ttlSeconds: number = 60
): Promise<boolean> {
    const key = getSearchCacheKey(query);
    return setCache(key, results, ttlSeconds);
}

