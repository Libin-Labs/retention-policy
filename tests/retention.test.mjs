import test from 'node:test';
import assert from 'node:assert/strict';
import { createRetentionPolicy } from '../dist/esm/index.js';

const rules = [{ category: 'logs', maxAgeMs: 100, maxRetained: 2 }];
const policy = (items) => createRetentionPolicy(rules, { now: 1_000 }).plan(items);

test('creates stable advisory plan for age, category capacity, and unmatched categories', () => {
  const plan = policy([
    { id: 'old', category: 'logs', createdAt: 899 },
    { id: 'a', category: 'logs', createdAt: 950 },
    { id: 'b', category: 'logs', createdAt: 975 },
    { id: 'c', category: 'logs', createdAt: 990 },
    { id: 'misc', category: 'other', createdAt: 1 },
  ]);
  assert.deepEqual(plan.reviewIds, ['old', 'a']);
  assert.deepEqual(
    plan.decisions.map(({ action, reason }) => [action, reason]),
    [
      ['review', 'age-limit'],
      ['review', 'category-limit'],
      ['retain', 'within-policy'],
      ['retain', 'within-policy'],
      ['retain', 'no-matching-rule'],
    ],
  );
  assert.equal(plan.evaluatedAt, 1_000);
});

test('keeps the exact age threshold and uses input order to break timestamp ties', () => {
  const tied = createRetentionPolicy([{ category: 'x', maxAgeMs: 20, maxRetained: 1 }], {
    now: 100,
  }).plan([
    { id: 'first', category: 'x', createdAt: 90 },
    { id: 'second', category: 'x', createdAt: 90 },
  ]);
  assert.deepEqual(tied.reviewIds, ['second']);
  const ageBoundary = createRetentionPolicy([{ category: 'x', maxAgeMs: 20 }], { now: 100 }).plan([
    { id: 'threshold', category: 'x', createdAt: 80 },
  ]);
  assert.equal(ageBoundary.decisions[0].reason, 'within-policy');
  const ageExpired = createRetentionPolicy([{ category: 'x', maxAgeMs: 20 }], { now: 100 }).plan([
    { id: 'expired', category: 'x', createdAt: 79 },
  ]);
  assert.equal(ageExpired.decisions[0].reason, 'age-limit');
});

test('plans are immutable and never execute or mutate data', () => {
  const items = [{ id: 'a', category: 'logs', createdAt: 0 }];
  const before = structuredClone(items);
  const plan = policy(items);
  assert.deepEqual(items, before);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.decisions), true);
  assert.equal(plan.decisions[0].action, 'review');
});

test('validates rule categories, age, retention counts, and duplicates', () => {
  assert.throws(() => createRetentionPolicy([], { now: 0 }), /1 to 256/);
  assert.throws(
    () => createRetentionPolicy([{ category: 'x', maxAgeMs: -1 }], { now: 0 }),
    /maxAgeMs/,
  );
  assert.throws(
    () =>
      createRetentionPolicy(
        [
          { category: 'x', maxAgeMs: 1 },
          { category: 'x', maxAgeMs: 2 },
        ],
        { now: 0 },
      ),
    /Duplicate rule category/,
  );
  assert.throws(
    () => createRetentionPolicy([{ category: 'x', maxAgeMs: 1, maxRetained: 0 }], { now: 0 }),
    /maxRetained/,
  );
  assert.throws(() => createRetentionPolicy(rules, {}), /evaluation time/);
});

test('validates bounded unique item IDs, categories, and timestamps', () => {
  const p = createRetentionPolicy(rules, { now: 1_000 });
  assert.throws(() => p.plan([{ id: '', category: 'logs', createdAt: 0 }]), /Item ID/);
  assert.throws(
    () =>
      p.plan([
        { id: 'a', category: 'logs', createdAt: 0 },
        { id: 'a', category: 'logs', createdAt: 1 },
      ]),
    /Duplicate item ID/,
  );
  assert.throws(() => p.plan([{ id: 'a', category: 'logs', createdAt: Number.NaN }]), /finite/);
  assert.throws(
    () =>
      createRetentionPolicy(rules, { now: 1_000, maxItems: 1 }).plan([
        { id: 'a', category: 'logs', createdAt: 0 },
        { id: 'b', category: 'logs', createdAt: 0 },
      ]),
    /at most 1/,
  );
});

test('rejects invalid limits instead of silently clamping them', () => {
  assert.throws(() => createRetentionPolicy(rules, { now: 1_000, maxItems: 0 }), /maxItems/);
  assert.throws(
    () => createRetentionPolicy([{ category: 'x', maxAgeMs: 1.5 }], { now: 0 }),
    /maxAgeMs/,
  );
});
