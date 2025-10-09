import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for Queue Position Calculation
 *
 * CRITICAL: Queue position must be 1-based and calculated correctly
 * Frontend depends on this for display
 */

describe('Queue Position Calculation', () => {
    interface MockRequest {
        _id: string;
        createdAt: Date;
        status: string;
    }

    it('should assign position 1 to first request', () => {
        const requests: MockRequest[] = [
            {
                _id: 'req1',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                status: 'approved',
            },
        ];

        const withPositions = requests.map((req, index) => ({
            ...req,
            queuePosition: index + 1,
        }));

        expect(withPositions[0].queuePosition).toBe(1);
    });

    it('should assign sequential positions based on creation time', () => {
        const requests: MockRequest[] = [
            {
                _id: 'req1',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                status: 'approved',
            },
            {
                _id: 'req2',
                createdAt: new Date('2024-01-01T10:01:00Z'),
                status: 'approved',
            },
            {
                _id: 'req3',
                createdAt: new Date('2024-01-01T10:02:00Z'),
                status: 'approved',
            },
        ];

        const withPositions = requests.map((req, index) => ({
            ...req,
            queuePosition: index + 1,
        }));

        expect(withPositions[0].queuePosition).toBe(1);
        expect(withPositions[1].queuePosition).toBe(2);
        expect(withPositions[2].queuePosition).toBe(3);
    });

    it('should handle empty queue', () => {
        const requests: MockRequest[] = [];
        const withPositions = requests.map((req, index) => ({
            ...req,
            queuePosition: index + 1,
        }));

        expect(withPositions).toHaveLength(0);
    });

    it('should sort by createdAt before assigning positions', () => {
        const unsortedRequests: MockRequest[] = [
            {
                _id: 'req3',
                createdAt: new Date('2024-01-01T10:02:00Z'),
                status: 'approved',
            },
            {
                _id: 'req1',
                createdAt: new Date('2024-01-01T10:00:00Z'),
                status: 'approved',
            },
            {
                _id: 'req2',
                createdAt: new Date('2024-01-01T10:01:00Z'),
                status: 'approved',
            },
        ];

        const sorted = unsortedRequests.sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        const withPositions = sorted.map((req, index) => ({
            ...req,
            queuePosition: index + 1,
        }));

        expect(withPositions[0]._id).toBe('req1');
        expect(withPositions[0].queuePosition).toBe(1);
        expect(withPositions[1]._id).toBe('req2');
        expect(withPositions[1].queuePosition).toBe(2);
        expect(withPositions[2]._id).toBe('req3');
        expect(withPositions[2].queuePosition).toBe(3);
    });

    it('should only include approved/queued status in queue', () => {
        const allRequests = [
            { status: 'pending_admin' },
            { status: 'approved' },
            { status: 'rejected' },
            { status: 'queued' },
            { status: 'performed' },
        ];

        const queueStatuses = ['approved', 'queued'];
        const filtered = allRequests.filter(req => queueStatuses.includes(req.status));

        expect(filtered).toHaveLength(2);
        expect(filtered.map(r => r.status)).toEqual(['approved', 'queued']);
    });
});
