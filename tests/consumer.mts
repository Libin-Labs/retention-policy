import { createRetentionPolicy, type RetentionItem } from '@lp-labs/retention-policy';

const items: RetentionItem[] = [{ id: 'log-1', category: 'logs', createdAt: 0 }];
const policy = createRetentionPolicy([{ category: 'logs', maxAgeMs: 60_000 }], { now: 100_000 });
const plan = policy.plan(items);
console.log(plan.reviewIds);
