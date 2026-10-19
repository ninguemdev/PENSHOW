import { approvedQuestionSchema, normalizeQuestionText } from './editorial-question.schema.js';
import type { ApprovedQuestion } from './question.js';
import { DIFFICULTIES, SelectionError, type QuestionDemand } from './selection-policy.js';

export type Stock = Record<string, Record<keyof QuestionDemand, number>>;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Canonical representatives only. Semantic equivalence is supplied by editorial review. */
export function canonicalQuestions(
  input: readonly ApprovedQuestion[],
  equivalences: readonly (readonly string[])[],
  eligible: (question: ApprovedQuestion) => boolean = () => true,
): ApprovedQuestion[] {
  const questions = input.map((raw) => {
    const parsed = approvedQuestionSchema.safeParse(raw);
    if (!parsed.success) throw new SelectionError('invalid-catalog');
    return parsed.data;
  });
  questions.sort((a, b) => compare(a.id, b.id));
  const parent = new Map(questions.map((q) => [q.id, q.id]));
  if (parent.size !== questions.length) throw new SelectionError('invalid-catalog');
  function root(id: string): string {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current)!;
    let cursor = id;
    while (cursor !== current) {
      const next = parent.get(cursor)!;
      parent.set(cursor, current);
      cursor = next;
    }
    return current;
  }
  function merge(left: string, right: string) {
    const a = root(left),
      b = root(right);
    parent.set(compare(a, b) < 0 ? b : a, compare(a, b) < 0 ? a : b);
  }
  const prompts = new Map<string, string>();
  for (const q of questions) {
    const prompt = normalizeQuestionText(q.prompt);
    const previous = prompts.get(prompt);
    if (previous) merge(previous, q.id);
    else prompts.set(prompt, q.id);
  }
  for (const group of equivalences) {
    if (
      group.length < 2 ||
      new Set(group).size !== group.length ||
      group.some((id) => !parent.has(id))
    )
      throw new SelectionError('invalid-catalog');
    for (const id of group.slice(1)) merge(group[0]!, id);
  }
  const included = new Set<string>();
  return questions.filter((q) => {
    if (!eligible(q)) return false;
    const group = root(q.id);
    if (included.has(group)) return false;
    included.add(group);
    return true;
  });
}
export function stockOf(questions: readonly ApprovedQuestion[]): Stock {
  const stock = new Map<string, Record<keyof QuestionDemand, number>>();
  for (const q of questions) {
    const counts = stock.get(q.category) ?? { easy: 0, medium: 0, hard: 0 };
    counts[q.difficulty]++;
    stock.set(q.category, counts);
  }
  return Object.fromEntries(stock);
}
export function covers(stock: QuestionDemand, demand: QuestionDemand) {
  return DIFFICULTIES.every((difficulty) => stock[difficulty] >= demand[difficulty]);
}
export function subtract(
  stock: QuestionDemand,
  demand: QuestionDemand,
): Record<keyof QuestionDemand, number> {
  return {
    easy: stock.easy - demand.easy,
    medium: stock.medium - demand.medium,
    hard: stock.hard - demand.hard,
  };
}

/** Find a feasible allocation by category, not just a misleading total question count. */
export function phaseAllocation(
  input: Stock,
  demands: readonly QuestionDemand[],
  reserve: QuestionDemand = { easy: 0, medium: 0, hard: 0 },
): string[] | null {
  const categories = Object.keys(input).sort(compare);
  const stock = categories.map((category) => ({ ...input[category]! }));
  const failed = new Set<string>();
  const assignment: string[] = [];
  function search(pending: number[]): boolean {
    const total = { easy: 0, medium: 0, hard: 0 };
    const needed = { ...reserve };
    for (const counts of stock) for (const d of DIFFICULTIES) total[d] += counts[d];
    for (const i of pending) for (const d of DIFFICULTIES) needed[d] += demands[i]![d];
    if (!covers(total, needed)) return false;
    if (!pending.length) return true;
    const key = `${pending.join(',')}:${stock.map((counts) => DIFFICULTIES.map((d) => counts[d]).join(',')).join(';')}`;
    if (failed.has(key)) return false;
    const candidates = pending
      .map((i) => ({
        i,
        categories: stock.flatMap((counts, j) => (covers(counts, demands[i]!) ? [j] : [])),
      }))
      .sort((a, b) => a.categories.length - b.categories.length);
    const next = candidates[0]!;
    const tried = new Set<string>();
    for (const j of next.categories) {
      const before = stock[j]!;
      // Equivalent bucket sizes have the same feasibility; avoid symmetric branches.
      const signature = DIFFICULTIES.map((d) => before[d]).join(',');
      if (tried.has(signature)) continue;
      tried.add(signature);
      stock[j] = subtract(before, demands[next.i]!);
      assignment[next.i] = categories[j]!;
      if (search(pending.filter((i) => i !== next.i))) return true;
      stock[j] = before;
    }
    failed.add(key);
    return false;
  }
  return search(demands.map((_, i) => i)) ? assignment : null;
}
