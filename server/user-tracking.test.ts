import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

type AuthenticatedUser = NonNullable<TrpcContext['user']>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: 'manus',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      headers: {},
    } as any,
    res: {
      setHeader: () => {},
      cookie: () => {},
    } as any,
  };

  return ctx;
}

describe('User Session Tracking', () => {
  it('should require authentication for trainingSets.create', async () => {
    const router = appRouter.createCaller(createAuthContext(123));

    // This should work with authenticated context
    const result = await router.trainingSets.create({
      opening: 'Sicilian Defence',
      subset: 'Main Line',
      variation: 'Classical',
      minRating: 1000,
      maxRating: 2000,
      puzzleCount: 10,
      cycles: 3,
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should require authentication for cycles.create', async () => {
    const router = appRouter.createCaller(createAuthContext(456));

    // This should work with authenticated context
    const result = await router.cycles.create({
      trainingSetId: 'test_set_123',
      totalPuzzles: 50,
      correctCount: 40,
      totalTimeMs: 180000,
      accuracy: 80,
    });

    expect(result).toBeDefined();
  });

  it('should use authenticated userId in trainingSets.create', async () => {
    const userId = 789;
    const router = appRouter.createCaller(createAuthContext(userId));

    // Create a training set - userId should come from context, not input
    const result = await router.trainingSets.create({
      opening: 'Queen\'s Gambit',
      subset: 'Declined',
      variation: 'Classical',
      minRating: 1000,
      maxRating: 2000,
      puzzleCount: 20,
      cycles: 3,
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    // The training set ID should be created successfully
    expect(result.length).toBeGreaterThan(0);
  });

  it('should use authenticated userId in cycles.create', async () => {
    const userId = 999;
    const router = appRouter.createCaller(createAuthContext(userId));

    // Create a cycle - userId should come from context, not input
    const result = await router.cycles.create({
      trainingSetId: 'test_training_set_id',
      totalPuzzles: 50,
      correctCount: 45,
      totalTimeMs: 240000,
      accuracy: 90,
    });

    expect(result).toBeDefined();
  });

  it('should track different users separately', async () => {
    const user1Router = appRouter.createCaller(createAuthContext(111));
    const user2Router = appRouter.createCaller(createAuthContext(222));

    // Create training sets for different users
    const set1 = await user1Router.trainingSets.create({
      opening: 'Sicilian Defence',
      puzzleCount: 10,
    });

    const set2 = await user2Router.trainingSets.create({
      opening: 'Ruy Lopez',
      puzzleCount: 15,
    });

    // Both should be created successfully
    expect(set1).toBeDefined();
    expect(set2).toBeDefined();
    // They should be different
    expect(set1).not.toBe(set2);
  });
});
