/**
 * LLM Provider Abstraction
 *
 * Unified interface for multiple LLM providers (Anthropic, OpenAI, Grok, Ollama).
 * Allows seamless swapping between providers without changing core logic.
 */

export interface LLMProviderConfig {
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface LLMInvokeOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LLMInvokeResult {
  text: string;
  isError: boolean;
  timedOut?: boolean;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Base interface for LLM providers.
 */
export interface LLMProvider {
  name: string;
  invoke(options: LLMInvokeOptions): Promise<LLMInvokeResult>;
  isHealthy(): Promise<boolean>;
}

/**
 * Anthropic Claude provider (uses direct API for server-side use).
 */
export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private config: LLMProviderConfig;

  constructor(config?: LLMProviderConfig) {
    this.config = config || {};
  }

  async invoke(options: LLMInvokeOptions): Promise<LLMInvokeResult> {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        text: "Anthropic API key not configured",
        isError: true,
      };
    }

    const timeoutMs = options.timeoutMs || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: options.model,
          max_tokens: options.maxTokens || 2048,
          temperature: options.temperature ?? 0.2,
          messages: [
            ...(options.systemPrompt
              ? [{ role: "user", content: options.systemPrompt }]
              : []),
            { role: "user", content: options.prompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          text: `Anthropic API error: ${response.status} - ${error}`,
          isError: true,
        };
      }

      const data = (await response.json()) as any;
      const text = data.content?.[0]?.text ?? "";
      const usage = data.usage;

      return {
        text,
        isError: !text,
        tokenUsage: usage
          ? { input: usage.input_tokens, output: usage.output_tokens }
          : undefined,
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { text: "", isError: true, timedOut: true };
      }
      return {
        text: error.message || "Anthropic request failed",
        isError: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return false;

      const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * OpenAI provider (uses OpenAI API).
 */
export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private config: LLMProviderConfig;
  private apiUrl: string;

  constructor(config?: LLMProviderConfig) {
    this.config = config || {};
    this.apiUrl = config?.apiUrl || "https://api.openai.com/v1";
  }

  async invoke(options: LLMInvokeOptions): Promise<LLMInvokeResult> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        text: "OpenAI API key not configured",
        isError: true,
      };
    }

    const timeoutMs = options.timeoutMs || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            ...(options.systemPrompt
              ? [{ role: "system", content: options.systemPrompt }]
              : []),
            { role: "user", content: options.prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          text: `OpenAI API error: ${response.status} - ${error}`,
          isError: true,
        };
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content || "";
      const usage = data.usage;

      return {
        text,
        isError: !text,
        tokenUsage: usage
          ? { input: usage.prompt_tokens, output: usage.completion_tokens }
          : undefined,
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { text: "", isError: true, timedOut: true };
      }
      return {
        text: error.message || "OpenAI request failed",
        isError: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) return false;

      const response = await fetch(`${this.apiUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Grok provider (uses xAI Grok API).
 */
export class GrokProvider implements LLMProvider {
  name = "grok";
  private config: LLMProviderConfig;
  private apiUrl: string;

  constructor(config?: LLMProviderConfig) {
    this.config = config || {};
    this.apiUrl = config?.apiUrl || "https://api.x.ai/v1";
  }

  async invoke(options: LLMInvokeOptions): Promise<LLMInvokeResult> {
    const apiKey = this.config.apiKey || process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        text: "Grok API key not configured",
        isError: true,
      };
    }

    const timeoutMs = options.timeoutMs || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            ...(options.systemPrompt
              ? [{ role: "system", content: options.systemPrompt }]
              : []),
            { role: "user", content: options.prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          text: `Grok API error: ${response.status} - ${error}`,
          isError: true,
        };
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content || "";
      const usage = data.usage;

      return {
        text,
        isError: !text,
        tokenUsage: usage
          ? { input: usage.prompt_tokens, output: usage.completion_tokens }
          : undefined,
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { text: "", isError: true, timedOut: true };
      }
      return {
        text: error.message || "Grok request failed",
        isError: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const apiKey = this.config.apiKey || process.env.XAI_API_KEY;
      if (!apiKey) return false;

      const response = await fetch(`${this.apiUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Ollama provider (uses local Ollama instance).
 */
export class OllamaProvider implements LLMProvider {
  name = "ollama";
  private config: LLMProviderConfig;
  private apiUrl: string;

  constructor(config?: LLMProviderConfig) {
    this.config = config || {};
    this.apiUrl = config?.apiUrl || "http://localhost:11434/api";
  }

  async invoke(options: LLMInvokeOptions): Promise<LLMInvokeResult> {
    const timeoutMs = options.timeoutMs || 60000; // Ollama can be slow locally
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          messages: [
            ...(options.systemPrompt
              ? [{ role: "system", content: options.systemPrompt }]
              : []),
            { role: "user", content: options.prompt },
          ],
          temperature: options.temperature ?? 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          text: `Ollama API error: ${response.status} - ${error}`,
          isError: true,
        };
      }

      const data = (await response.json()) as any;
      const text = data.message?.content || "";

      return {
        text,
        isError: !text,
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { text: "", isError: true, timedOut: true };
      }
      return {
        text: error.message || "Ollama request failed",
        isError: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Provider factory: creates appropriate provider instance based on name.
 */
export function createProvider(
  providerName: string,
  config?: LLMProviderConfig
): LLMProvider {
  switch (providerName.toLowerCase()) {
    case "anthropic":
    case "claude":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "grok":
    case "xai":
      return new GrokProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${providerName}`);
  }
}

/**
 * Registry for managing multiple providers (with fallback chain support).
 */
export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private primaryProvider: string = "anthropic";

  register(name: string, provider: LLMProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }

  setPrimary(name: string): void {
    if (!this.providers.has(name.toLowerCase())) {
      throw new Error(`Provider ${name} not registered`);
    }
    this.primaryProvider = name.toLowerCase();
  }

  getPrimary(): LLMProvider {
    const provider = this.providers.get(this.primaryProvider);
    if (!provider) {
      throw new Error(`Primary provider ${this.primaryProvider} not found`);
    }
    return provider;
  }

  get(name: string): LLMProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Find the first healthy provider in the list, falling back to others.
   * Useful for failover scenarios.
   */
  async findHealthy(
    preferredOrder?: string[]
  ): Promise<LLMProvider | null> {
    const order = preferredOrder?.map((p) => p.toLowerCase()) ||
      [this.primaryProvider, ...Array.from(this.providers.keys()).filter(
        (p) => p !== this.primaryProvider
      )];

    for (const name of order) {
      const provider = this.providers.get(name);
      if (provider && (await provider.isHealthy())) {
        return provider;
      }
    }

    return null;
  }
}

/**
 * Global provider registry instance.
 */
export const globalRegistry = new ProviderRegistry();
