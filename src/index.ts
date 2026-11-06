export interface RetentionRule {
  readonly category: string;
  readonly maxAgeMs: number;
  readonly maxRetained?: number;
}
export interface RetentionItem {
  readonly id: string;
  readonly category: string;
  readonly createdAt: number;
}
export interface RetentionDecision {
  readonly id: string;
  readonly category: string;
  readonly action: 'retain' | 'review';
  readonly reason: 'within-policy' | 'no-matching-rule' | 'age-limit' | 'category-limit';
}
export interface RetentionPlan {
  readonly evaluatedAt: number;
  readonly decisions: readonly RetentionDecision[];
  readonly reviewIds: readonly string[];
}
export interface RetentionOptions {
  readonly now: number;
  readonly maxItems?: number;
}

const text = (value: string, name: string): void => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256)
    throw new TypeError(`${name} must be a nonempty string up to 256 characters.`);
};
const positiveInteger = (value: number, name: string, max: number): void => {
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new RangeError(`${name} must be an integer from 1 to ${max}.`);
};

export function createRetentionPolicy(
  rulesInput: readonly RetentionRule[],
  options: RetentionOptions,
): {
  plan(items: readonly RetentionItem[]): RetentionPlan;
} {
  if (!Array.isArray(rulesInput) || rulesInput.length === 0 || rulesInput.length > 256)
    throw new RangeError('Rules must contain 1 to 256 entries.');
  if (!options || typeof options !== 'object' || !Number.isFinite(options.now))
    throw new TypeError('A finite evaluation time (now) is required.');
  const maxItems = options.maxItems ?? 20_000;
  positiveInteger(maxItems, 'maxItems', 100_000);
  const rules = new Map<string, RetentionRule>();
  for (const rule of rulesInput) {
    if (!rule || typeof rule !== 'object') throw new TypeError('Each rule must be an object.');
    text(rule.category, 'Rule category');
    if (!Number.isSafeInteger(rule.maxAgeMs) || rule.maxAgeMs < 0)
      throw new RangeError('maxAgeMs must be a nonnegative safe integer.');
    if (rule.maxRetained !== undefined) positiveInteger(rule.maxRetained, 'maxRetained', 100_000);
    if (rules.has(rule.category)) throw new TypeError(`Duplicate rule category: ${rule.category}`);
    rules.set(rule.category, Object.freeze({ ...rule }));
  }
  return {
    plan(items) {
      if (!Array.isArray(items) || items.length > maxItems)
        throw new RangeError(`Items must be an array of at most ${maxItems} entries.`);
      const ids = new Set<string>();
      const normalized = items.map((item, index) => {
        if (!item || typeof item !== 'object')
          throw new TypeError(`Item ${index} must be an object.`);
        text(item.id, 'Item ID');
        text(item.category, 'Item category');
        if (!Number.isFinite(item.createdAt))
          throw new TypeError('createdAt must be finite epoch milliseconds.');
        if (ids.has(item.id)) throw new TypeError(`Duplicate item ID: ${item.id}`);
        ids.add(item.id);
        return { id: item.id, category: item.category, createdAt: item.createdAt, index };
      });
      const decisions = new Map<number, RetentionDecision>();
      for (const item of normalized) {
        const rule = rules.get(item.category);
        if (!rule)
          decisions.set(
            item.index,
            Object.freeze({
              id: item.id,
              category: item.category,
              action: 'retain',
              reason: 'no-matching-rule',
            }),
          );
        else if (item.createdAt < options.now - rule.maxAgeMs)
          decisions.set(
            item.index,
            Object.freeze({
              id: item.id,
              category: item.category,
              action: 'review',
              reason: 'age-limit',
            }),
          );
      }
      for (const [category, rule] of rules) {
        if (rule.maxRetained === undefined) continue;
        const eligible = normalized
          .filter((item) => item.category === category && !decisions.has(item.index))
          .sort((a, b) => b.createdAt - a.createdAt || a.index - b.index);
        for (const item of eligible.slice(rule.maxRetained))
          decisions.set(
            item.index,
            Object.freeze({
              id: item.id,
              category,
              action: 'review',
              reason: 'category-limit',
            }),
          );
      }
      const ordered = normalized.map(
        (item) =>
          decisions.get(item.index) ??
          Object.freeze({
            id: item.id,
            category: item.category,
            action: 'retain' as const,
            reason: 'within-policy' as const,
          }),
      );
      const frozen = Object.freeze(ordered);
      return Object.freeze({
        evaluatedAt: options.now,
        decisions: frozen,
        reviewIds: Object.freeze(
          frozen.filter((decision) => decision.action === 'review').map(({ id }) => id),
        ),
      });
    },
  };
}
