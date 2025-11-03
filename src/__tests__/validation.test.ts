import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Unit Tests for Input Validation
 *
 * These tests verify our Zod schemas work correctly
 */

describe('Input Validation Schemas', () => {
    describe('User Update Schema', () => {
        const updateUserSchema = z.object({
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            displayName: z.string().optional(),
            avatar: z.string().optional(),
            phoneNumber: z.string().optional(),
        });

        it('should accept valid user update data', () => {
            const validData = {
                firstName: 'John',
                lastName: 'Doe',
                displayName: 'Johnny',
            };

            const result = updateUserSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should accept partial updates', () => {
            const partialData = { firstName: 'John' };
            const result = updateUserSchema.safeParse(partialData);
            expect(result.success).toBe(true);
        });

        it('should accept empty object', () => {
            const result = updateUserSchema.safeParse({});
            expect(result.success).toBe(true);
        });
    });

    describe('Organization Creation Schema', () => {
        const createOrgSchema = z.object({
            name: z.string().min(1),
        });

        it('should accept valid organization name', () => {
            const result = createOrgSchema.safeParse({ name: 'My Venue' });
            expect(result.success).toBe(true);
        });

        it('should reject empty name', () => {
            const result = createOrgSchema.safeParse({ name: '' });
            expect(result.success).toBe(false);
        });

        it('should reject missing name', () => {
            const result = createOrgSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    describe('Event Creation Schema', () => {
        const createEventSchema = z.object({
            name: z.string().min(1),
            date: z.string().datetime(),
            venue: z.string().optional(),
        });

        it('should accept valid event data', () => {
            const validData = {
                name: 'Friday Night Karaoke',
                date: '2024-12-20T20:00:00.000Z',
                venue: 'The Grand Stage',
            };

            const result = createEventSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should accept event without venue', () => {
            const validData = {
                name: 'Friday Night Karaoke',
                date: '2024-12-20T20:00:00.000Z',
            };

            const result = createEventSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid date format', () => {
            const invalidData = {
                name: 'Event',
                date: 'not-a-date',
            };

            const result = createEventSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('Request Creation Schema', () => {
        const createRequestSchema = z.object({
            songId: z.string(),
            coSingers: z.array(z.string()).optional().default([]),
        });

        it('should accept valid request with coSingers', () => {
            const validData = {
                songId: '507f1f77bcf86cd799439011',
                coSingers: ['user1', 'user2'],
            };

            const result = createRequestSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should accept request without coSingers', () => {
            const validData = {
                songId: '507f1f77bcf86cd799439011',
            };

            const result = createRequestSchema.safeParse(validData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.coSingers).toEqual([]);
            }
        });

        it('should reject missing songId', () => {
            const invalidData = {
                coSingers: ['user1'],
            };

            const result = createRequestSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('Broadcast Schema', () => {
        const broadcastSchema = z.object({
            eventId: z.string().optional(),
            message: z.string().min(1),
        });

        it('should accept valid broadcast message', () => {
            const validData = {
                message: 'Taking a break. Be back soon!',
            };

            const result = broadcastSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should accept broadcast with eventId', () => {
            const validData = {
                eventId: '507f1f77bcf86cd799439011',
                message: 'Starting karaoke now!',
            };

            const result = broadcastSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject empty message', () => {
            const invalidData = {
                message: '',
            };

            const result = broadcastSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });
});
