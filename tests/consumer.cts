import retention = require('@lp-labs/retention-policy');

const policy = retention.createRetentionPolicy(
  [{ category: 'exports', maxAgeMs: 86_400_000, maxRetained: 50 }],
  { now: Date.now() },
);
const plan = policy.plan([{ id: 'export-1', category: 'exports', createdAt: Date.now() }]);
console.log(plan.decisions[0].action);
