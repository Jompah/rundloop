/**
 * Unified LLM Invocation
 *
 * Smart dispatcher that routes to the appropriate LLM provider:
 * - Default: uses Anthropic API (server-side only for Drift)
 * - Provider override: uses specified provider (OpenAI, Grok, Ollama)
 * - Fallback: tries alternatives if primary fails
 *
 * For Drift (Next.js app), always uses server-side API calls with API keys from env.
 */

import {
  LLMProvider,
  LLMInvokeOptions,
  LLMInvokeResult,
  createProvider,
  ProviderRegistry,
  globalRegistry,
} from "./llm-provider";
import { globalCostTracker } from "./provider-costs";

export interface UnifiedInvokeOptions extends LLMInvokeOptions {
  /**
   * LLM provider: "anthropic" (default), "openai", "grok", "ollama".
   */
  provider?: string;

  /**
   * Enable cost tracking (default: true).
   */
  trackCost?: boolean;

  /**
   * Fallback providers if primary fails (e.g., ["openai", "grok"]).
   */
  fallbackProviders?: string[];
}

/**
 * Initialize global provider registry from environment variables.
 */
export function initProviderRegistry(): void {
  // Always register Anthropic (uses API)
  globalRegistry.register("anthropic", createProvider("anthropic"));

  // Register optional providers if their API keys are set
  if (process.env.OPENAI_API_KEY) {
    globalRegistry.register("openai", createProvider("openai"));
  }

  if (process.env.XAI_API_KEY) {
    globalRegistry.register("grok", createProvider("grok"));
  }

  if (process.env.OLLAMA_URL) {
    globalRegistry.register("ollama", createProvider("ollama"));
  }

  // Set primary provider (can override with LLM_PRIMARY_PROVIDER)
  const primaryProvider = process.env.LLM_PRIMARY_PROVIDER || "anthropic";
  try {
    globalRegistry.setPrimary(primaryProvider);
  } catch {
    // If primary not available, keep default (anthropic)
    console.warn(
      `[llm-invoke] Primary provider ${primaryProvider} not registered, using anthropic`
    );
  }
}

/**
 * Unified LLM invoke function.
 * Routes to appropriate provider or falls back to alternatives.
 */
export async function invokeLLM(
  options: UnifiedInvokeOptions
): Promise<LLMInvokeResult> {
  const {
    provider: requestedProvider = "anthropic",
    trackCost = true,
    fallbackProviders = [],
  } = options;

  const providersToTry = [
    requestedProvider,
    ...fallbackProviders,
    ...(requestedProvider !== "anthropic" ? ["anthropic"] : []),
  ];

  for (const providerName of providersToTry) {
    try {
      const result = await invokeWithProvider(providerName, options);

      if (!result.isError && !result.timedOut) {
        // Track cost if requested
        if (trackCost && result.tokenUsage) {
          globalCostTracker.recordCost(
            providerName,
            options.model,
            result.tokenUsage.input,
            result.tokenUsage.output
          );

          if (globalCostTracker.isBudgetExceeded()) {
            console.warn(
              `[llm-invoke] Daily budget exceeded: $${globalCostTracker.getTodayCost().toFixed(2)} / $${process.env.DAILY_API_BUDGET || "5"}`
            );
          }
        }

        return result;
      }

      // If not the last provider, try next
      if (providerName !== providersToTry[providersToTry.length - 1]) {
        console.warn(
          `[llm-invoke] Provider ${providerName} failed, trying fallback`
        );
        continue;
      }

      // Last provider failed, return error
      return result;
    } catch (error: any) {
      console.error(
        `[llm-invoke] Error with provider ${providerName}: ${error.message}`
      );

      // Try next provider
      if (providerName !== providersToTry[providersToTry.length - 1]) {
        continue;
      }

      // No more providers to try
      return {
        text: `All LLM providers failed. Last error: ${error.message}`,
        isError: true,
      };
    }
  }

  return {
    text: "No LLM providers available",
    isError: true,
  };
}

/**
 * Internal: invoke with a specific provider.
 */
async function invokeWithProvider(
  providerName: string,
  options: UnifiedInvokeOptions
): Promise<LLMInvokeResult> {
  // Use provider from registry
  const provider = globalRegistry.get(providerName);
  return provider.invoke(options);
}

/**
 * Get the primary provider.
 */
export function getPrimaryProvider(): LLMProvider {
  return globalRegistry.getPrimary();
}

/**
 * Get list of available providers.
 */
export function getAvailableProviders(): string[] {
  return globalRegistry.listProviders();
}

/**
 * Set primary provider at runtime.
 */
export function setPrimaryProvider(name: string): void {
  globalRegistry.setPrimary(name);
}

/**
 * Check which providers are healthy.
 */
export async function checkProviderHealth(): Promise<Record<string, boolean>> {
  const providers = globalRegistry.listProviders();
  const health: Record<string, boolean> = {};

  for (const name of providers) {
    try {
      const provider = globalRegistry.get(name);
      health[name] = await provider.isHealthy();
    } catch {
      health[name] = false;
    }
  }

  return health;
}
