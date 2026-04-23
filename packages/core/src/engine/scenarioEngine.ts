import type { DateString, LoanFile, Scenario } from '../model/types.js';
import { applyMutations } from '../mutation/index.js';
import { computeLoan } from './loanEngine.js';
import type { ComputeOptions, LoanComputation } from './types.js';

export interface ScenarioDelta {
  interest_saved: number;
  months_sooner: number;
  payoff_date_baseline: DateString;
  payoff_date_scenario: DateString;
  balance_delta_now: number;
}

export interface ScenarioEvaluation {
  baseline: LoanComputation;
  scenario: LoanComputation;
  transformed_loan: LoanFile;
  delta: ScenarioDelta;
}

/**
 * Apply `scenario.mutations` to `loan`, compute both baseline and scenario
 * amortizations, and return a structured comparison. Pure.
 */
export function evaluateScenario(
  loan: LoanFile,
  scenario: Scenario,
  opts: ComputeOptions = {},
): ScenarioEvaluation {
  const baseline = computeLoan(loan, opts);
  const transformed = applyMutations(loan, scenario.mutations);
  const scenarioComp = computeLoan(transformed, opts);
  return {
    baseline,
    scenario: scenarioComp,
    transformed_loan: transformed,
    delta: computeDelta(baseline, scenarioComp),
  };
}

/**
 * Evaluate every scenario in the loan and return keyed results.
 * Useful for the scenarios panel, where each card needs its own delta.
 */
export function evaluateAllScenarios(
  loan: LoanFile,
  opts: ComputeOptions = {},
): Map<string, ScenarioEvaluation> {
  const out = new Map<string, ScenarioEvaluation>();
  for (const s of loan.scenarios ?? []) {
    out.set(s.id, evaluateScenario(loan, s, opts));
  }
  return out;
}

function computeDelta(baseline: LoanComputation, scenario: LoanComputation): ScenarioDelta {
  const totalInterestBaseline = sumInterest(baseline);
  const totalInterestScenario = sumInterest(scenario);
  const interest_saved = round2(totalInterestBaseline - totalInterestScenario);

  const payoffBaseline = baseline.summary.projected_payoff_date;
  const payoffScenario = scenario.summary.projected_payoff_date;
  const months_sooner = monthDiff(payoffScenario, payoffBaseline);

  const balance_delta_now = round2(
    baseline.summary.current_actual_balance - scenario.summary.current_actual_balance,
  );

  return {
    interest_saved,
    months_sooner,
    payoff_date_baseline: payoffBaseline,
    payoff_date_scenario: payoffScenario,
    balance_delta_now,
  };
}

function sumInterest(c: LoanComputation): number {
  let total = 0;
  for (const row of c.ledger) {
    total += row.actual?.interest ?? row.scheduled.interest;
  }
  return round2(total);
}

/** Signed month delta: positive if `later` is after `earlier`, negative otherwise. */
function monthDiff(earlier: DateString, later: DateString): number {
  const [ey, em] = parseYearMonth(earlier);
  const [ly, lm] = parseYearMonth(later);
  return (ly - ey) * 12 + (lm - em);
}

function parseYearMonth(d: DateString): [number, number] {
  const [y, m] = d.split('-');
  return [Number(y), Number(m)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
