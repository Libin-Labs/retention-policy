# @lp-labs/retention-policy

Creates bounded, deterministic retention review plans from category-specific age and count policies.
It is advisory only: it never deletes, mutates, archives, or transmits user data.

## Install

```sh
npm install @lp-labs/retention-policy
```

## Quick start

```js
import assert from 'node:assert/strict';
import { createRetentionPolicy } from '@lp-labs/retention-policy';

const policy = createRetentionPolicy(
  [{ category: 'logs', maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxRetained: 500 }],
  { now: Date.UTC(2026, 0, 1) },
);
const plan = policy.plan([
  { id: 'old-log', category: 'logs', createdAt: Date.UTC(2025, 1, 1) },
  { id: 'current-log', category: 'logs', createdAt: Date.UTC(2025, 11, 31) },
  { id: 'invoice', category: 'billing', createdAt: Date.UTC(2024, 0, 1) },
]);
assert.deepEqual(plan.reviewIds, ['old-log']);
assert.equal(plan.decisions[2].reason, 'no-matching-rule');
```

## API and types

- `createRetentionPolicy(rules, options): { plan(items): RetentionPlan }` validates policies once and
  returns a planner. `options.now` is the required finite epoch time used for this deterministic plan;
  `options.maxItems` bounds each plan.
- `RetentionRule` requires an exact `category` and nonnegative `maxAgeMs`; optional `maxRetained`
  limits the newest retained items in that category.
- `RetentionItem` requires a unique `id`, exact `category`, and finite epoch-millisecond `createdAt`.
- `RetentionDecision` reports `id`, `category`, `action` (`retain` or advisory `review`), and reason
  (`within-policy`, `no-matching-rule`, `age-limit`, or `category-limit`).
- `RetentionPlan` contains `evaluatedAt`, immutable input-ordered `decisions`, and `reviewIds`.
- `RetentionOptions` describes the evaluation time and optional maximum item count.

## Customization and limits

Provide 1–256 rules with unique categories. The default item limit is 20,000 (configurable from 1 to
100,000); each category's `maxRetained` is from 1 to 100,000. Item and category identifiers must be
nonempty and at most 256 characters. An item strictly older than `now - maxAgeMs` is flagged for
review. Remaining items beyond `maxRetained` are selected oldest-first, with input order breaking
timestamp ties; output order always matches input order. Items without a rule are retained as
`no-matching-rule`. Evaluate a fresh plan at the desired time; the package does not read a clock.

## Errors and operational scope

Invalid shapes and timestamps throw `TypeError`; duplicate IDs/categories, unsupported limits, and
oversized inputs throw `RangeError` or `TypeError` with the failing condition. No decision is an
instruction to delete data. Applications must implement human/legal review, deletion safeguards,
holds, backups, audit trails, and storage operations separately; this library does not model legal
requirements or execute retention.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
