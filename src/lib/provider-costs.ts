/**
 * Multi-Provider Cost Tracking
 *
 * Tracks API costs across different LLM providers with per-provider rates.
 * Supports daily budget enforcement with optional fallback/downgrade logic.
 */

export interface ProviderRate {
  inputCostPer1M: number; // Cost per 1M input tokens
  outputCostPer1M: number; // Cost per 1M output tokens
}

export interface CostRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: Date;
}

/**
 * Cost rates for major providers (as of late 2024/early 2025).
 * Update these as pricing changes.
 */
export const PROVIDER_RATES: Record<string, Record<string, ProviderRate>> = {
  anthropic: {
    "claude-haiku-4-5-20251001": {
      inputCostPer1M: 0.8,
      outputCostPer1M: 4.0,
    },
    "claude-sonnet-4-6": {
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
    },
    "claude-opus-4-7": {
      inputCostPer1M: 15.0,
      outputCostPer1M: 75.0,
    },
    // Fallback for unspecified models
    default: {
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
    },
  },
  openai: {
    "gpt-4o": {
      inputCostPer1M: 5.0,
      outputCostPer1M: 15.0,
    },
    "gpt-4-turbo": {
      inputCostPer1M: 10.0,
      outputCostPer1M: 30.0,
    },
    "gpt-3.5-turbo": {
      inputCostPer1M: 0.5,
      outputCostPer1M: 1.5,
    },
    default: {
      inputCostPer1M: 5.0,
      outputCostPer1M: 15.0,
    },
  },
  grok: {
    "grok-3": {
      inputCostPer1M: 5.0,
      outputCostPer1M: 15.0,
    },
    "grok-2": {
      inputCostPer1M: 2.0,
      outputCostPer1M: 10.0,
    },
    default: {
      inputCostPer1M: 5.0,
      outputCostPer1M: 15.0,
    },
  },
  ollama: {
    // Ollama is local, so free (no API costs)
    default: {
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
    },
  },
};

/**
 * Cost tracker with daily budget management.
 */
export class CostTracker {
  private records: CostRecord[] = [];
  private dailyBudgetUSD: number = 5.0;
  private budgetResetTime: Date;

  constructor(dailyBudgetUSD?: number) {
    this.dailyBudgetUSD = dailyBudgetUSD || 5.0;
    this.budgetResetTime = this.getNextMidnight();
  }

  /**
   * Record a cost from an API call.
   */
  recordCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Calculate cost
    const providerRates =
      PROVIDER_RATES[provider.toLowerCase()] || PROVIDER_RATES.openai;
    const modelRate = providerRates[model] || providerRates.default;

    const inputCost = (inputTokens / 1_000_000) * modelRate.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * modelRate.outputCostPer1M;
    const totalCost = inputCost + outputCost;

    this.records.push({
      provider: provider.toLowerCase(),
      model,
      inputTokens,
      outputTokens,
      costUSD: totalCost,
      timestamp: new Date(),
    });

    return totalCost;
  }

  /**
   * Get total cost spent today.
   */
  getTodayCost(): number {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return this.records
      .filter((r) => r.timestamp >= startOfDay)
      .reduce((sum, r) => sum + r.costUSD, 0);
  }

  /**
   * Get remaining budget for today.
   */
  getRemainingBudget(): number {
    return Math.max(0, this.dailyBudgetUSD - this.getTodayCost());
  }

  /**
   * Check if budget is exceeded.
   */
  isBudgetExceeded(): boolean {
    return this.getTodayCost() > this.dailyBudgetUSD;
  }

  /**
   * Get breakdown by provider today.
   */
  getCostBreakdownByProvider(): Record<string, number> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const breakdown: Record<string, number> = {};

    for (const record of this.records) {
      if (record.timestamp >= startOfDay) {
        breakdown[record.provider] =
          (breakdown[record.provider] || 0) + record.costUSD;
      }
    }

    return breakdown;
  }

  /**
   * Get all records (for logging/debugging).
   */
  getRecords(): CostRecord[] {
    return [...this.records];
  }

  /**
   * Clear old records (older than 30 days).
   */
  purgeOldRecords(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.records = this.records.filter((r) => r.timestamp > thirtyDaysAgo);
  }

  /**
   * Reset budget for new day (called automatically if needed).
   */
  resetIfNewDay(): void {
    const now = new Date();
    if (now > this.budgetResetTime) {
      this.budgetResetTime = this.getNextMidnight();
    }
  }

  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Set new daily budget.
   */
  setDailyBudget(budgetUSD: number): void {
    this.dailyBudgetUSD = budgetUSD;
  }
}

/**
 * Global cost tracker instance.
 */
export const globalCostTracker = new CostTracker(
  parseFloat(process.env.DAILY_API_BUDGET || "5")
);

/**
 * Helper to estimate cost before making a call (for pre-flight checks).
 */
export function estimateCost(
  provider: string,
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number = estimatedInputTokens // Rough estimate
): number {
  const providerRates =
    PROVIDER_RATES[provider.toLowerCase()] || PROVIDER_RATES.openai;
  const modelRate = providerRates[model] || providerRates.default;

  const inputCost = (estimatedInputTokens / 1_000_000) * modelRate.inputCostPer1M;
  const outputCost =
    (estimatedOutputTokens / 1_000_000) * modelRate.outputCostPer1M;

  return inputCost + outputCost;
}

/**
 * Determine if we should downgrade to a cheaper model due to budget constraints.
 */
export function shouldDowngradeModel(
  provider: string,
  currentModel: string,
  remainingBudget: number
): { shouldDowngrade: boolean; suggestedModel?: string } {
  // Cheap threshold: if less than $0.50 remains, downgrade
  if (remainingBudget > 0.5) {
    return { shouldDowngrade: false };
  }

  const providerModels = PROVIDER_RATES[provider.toLowerCase()];
  if (!providerModels) {
    return { shouldDowngrade: false };
  }

  // Try to find a cheaper model for this provider
  let cheapestModel: string | undefined;
  let cheapestCost = Infinity;

  for (const [model, rate] of Object.entries(providerModels)) {
    if (model === "default") continue;
    const totalCost = rate.inputCostPer1M + rate.outputCostPer1M;
    if (totalCost < cheapestCost) {
      cheapestCost = totalCost;
      cheapestModel = model;
    }
  }

  if (cheapestModel && cheapestModel !== currentModel) {
    return { shouldDowngrade: true, suggestedModel: cheapestModel };
  }

  return { shouldDowngrade: false };
}
