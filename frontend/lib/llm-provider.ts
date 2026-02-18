/**
 * LLM Provider - Unified interface for browser-based and remote LLMs
 *
 * Priority:
 * 1. WebLLM (browser-based via WebGPU) - for deployment
 * 2. Remote backend (Ollama/vLLM/OpenAI) - for development/fallback
 */

import * as webllm from "@mlc-ai/web-llm";

export type LLMBackendType = "webllm" | "remote";

export interface LLMConfig {
  backend: LLMBackendType;
  model: string;
  apiUrl?: string; // For remote backends
}

export interface AgentEvent {
  type: string;
  agent?: string;
  message?: string;
  content?: string;
  tool?: string;
  summary?: string;
  elapsed_sec?: number;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Available WebLLM models
 * These run entirely in the browser using WebGPU
 */
export const WEBLLM_MODELS = {
  // Qwen3 models (newest generation - recommended)
  "Qwen3-0.6B": {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    size: "~600MB",
    speed: "Very Fast",
    quality: "Good",
    description: "Smallest Qwen3 model - great for low-end devices"
  },
  "Qwen3-1.7B": {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    size: "~1.7GB",
    speed: "Fast",
    quality: "Very Good",
    description: "Balanced Qwen3 model - recommended default"
  },
  "Qwen3-4B": {
    id: "Qwen3-4B-q4f16_1-MLC",
    size: "~4GB",
    speed: "Medium",
    quality: "Excellent",
    description: "High quality Qwen3 model"
  },
  "Qwen3-8B": {
    id: "Qwen3-8B-q4f16_1-MLC",
    size: "~8GB",
    speed: "Slower",
    quality: "Outstanding",
    description: "Best Qwen3 model (requires powerful GPU)"
  },

  // Qwen2.5 models (previous generation - still excellent)
  "Qwen2.5-0.5B": {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    size: "~500MB",
    speed: "Very Fast",
    quality: "Basic",
    description: "Smallest Qwen 2.5 model"
  },
  "Qwen2.5-1.5B": {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    size: "~1.5GB",
    speed: "Fast",
    quality: "Good",
    description: "Balanced Qwen 2.5 model"
  },
  "Qwen2.5-3B": {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    size: "~3GB",
    speed: "Medium",
    quality: "Very Good",
    description: "High quality Qwen 2.5 model"
  },
  "Qwen2.5-7B": {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    size: "~7GB",
    speed: "Slower",
    quality: "Excellent",
    description: "Best Qwen 2.5 model"
  },

  // Other fast alternatives
  "Phi-3.5-mini": {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    size: "~2GB",
    speed: "Fast",
    quality: "Good",
    description: "Microsoft's efficient model"
  },
  "Llama-3.2-1B": {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    size: "~1GB",
    speed: "Very Fast",
    quality: "Good",
    description: "Meta's small but capable model"
  },
  "Llama-3.2-3B": {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    size: "~3GB",
    speed: "Medium",
    quality: "Very Good",
    description: "Meta's balanced model"
  },
};

export class LLMProvider {
  private webllmEngine: webllm.MLCEngine | null = null;
  private config: LLMConfig;
  private isInitializing = false;
  private progressCallback?: (progress: string) => void;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Set progress callback for model loading
   */
  setProgressCallback(callback: (progress: string) => void) {
    this.progressCallback = callback;
  }

  /**
   * Initialize the LLM provider
   */
  async initialize(): Promise<void> {
    if (this.config.backend === "webllm") {
      await this.initializeWebLLM();
    }
    // Remote backend doesn't need initialization
  }

  /**
   * Initialize WebLLM engine
   */
  private async initializeWebLLM(): Promise<void> {
    if (this.webllmEngine || this.isInitializing) return;

    this.isInitializing = true;

    try {
      const modelId = WEBLLM_MODELS[this.config.model as keyof typeof WEBLLM_MODELS]?.id || this.config.model;

      this.progressCallback?.(`Initializing ${this.config.model}...`);

      this.webllmEngine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          this.progressCallback?.(progress.text);
        },
      });

      this.progressCallback?.("Model loaded and ready!");
    } catch (error) {
      this.progressCallback?.(`Error: ${error}`);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Stream agent events (main method for agent terminal)
   */
  async *streamAgentEvents(prompt: string, mode: "single" | "multi" = "multi"): AsyncGenerator<AgentEvent> {
    if (this.config.backend === "webllm") {
      yield* this.streamWithWebLLM(prompt, mode);
    } else {
      yield* this.streamWithRemote(prompt, mode);
    }
  }

  /**
   * Stream using WebLLM (browser-based)
   */
  private async *streamWithWebLLM(prompt: string, mode: string): AsyncGenerator<AgentEvent> {
    if (!this.webllmEngine) {
      yield {
        type: "error",
        message: "WebLLM engine not initialized. Please initialize first.",
      };
      return;
    }

    try {
      // Start pipeline
      yield {
        type: "pipeline_start",
        timestamp: Date.now() / 1000,
      };

      // For simplicity, we'll use a single agent mode with WebLLM
      // The backend's multi-agent pipeline is too complex for browser execution
      yield {
        type: "agent_start",
        agent: "detour",
        timestamp: Date.now() / 1000,
      };

      // Create system prompt for the agent
      const systemPrompt = `You are Detour, an AI collision avoidance copilot for satellites.
You run on an NVIDIA edge AI device providing low-latency, local collision avoidance planning.

You have access to physics tools that compute real orbital mechanics. NEVER guess numbers.

Your job is to:
1. Analyze conjunction threats from space debris or other satellites
2. Assess collision risk using probability of collision (Pc) calculations
3. Propose avoidance maneuvers with delta-V requirements
4. Verify fuel budget and safety constraints

Be concise and technical. Focus on actionable recommendations.`;

      const messages: webllm.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      // Stream response
      const stream = await this.webllmEngine.chat.completions.create({
        messages,
        temperature: 0.3,
        max_tokens: 2048,
        stream: true,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;

          // Emit thinking events periodically
          yield {
            type: "thinking",
            agent: "detour",
            thought: content.slice(0, 100),
            timestamp: Date.now() / 1000,
          };
        }
      }

      // Emit final output
      yield {
        type: "agent_output",
        agent: "detour",
        content: fullResponse,
        timestamp: Date.now() / 1000,
      };

      yield {
        type: "agent_complete",
        agent: "detour",
        elapsed_sec: 0,
        timestamp: Date.now() / 1000,
      };

      yield {
        type: "pipeline_complete",
        timestamp: Date.now() / 1000,
      };

    } catch (error) {
      yield {
        type: "error",
        message: `WebLLM Error: ${error}`,
        timestamp: Date.now() / 1000,
      };
    }
  }

  /**
   * Stream using remote backend (Ollama/vLLM/OpenAI)
   */
  private async *streamWithRemote(prompt: string, mode: string): AsyncGenerator<AgentEvent> {
    try {
      const url = this.config.apiUrl || "";
      const streamUrl = url ? `${url}/agent/stream?mode=${mode}` : `/api/agent/stream?mode=${mode}`;
      const fullUrl = `${streamUrl}&prompt=${encodeURIComponent(prompt)}`;

      const response = await fetch(fullUrl);

      if (!response.ok || !response.body) {
        yield {
          type: "error",
          message: `Backend connection failed (HTTP ${response.status})`,
        };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6));
            yield event;
          } catch {
            // Ignore malformed JSON
          }
        }
      }
    } catch (error) {
      yield {
        type: "error",
        message: `Network error: ${error}`,
      };
    }
  }

  /**
   * Check if WebGPU is available
   */
  static isWebGPUAvailable(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  /**
   * Get recommended backend based on browser capabilities
   */
  static getRecommendedBackend(): LLMBackendType {
    return this.isWebGPUAvailable() ? "webllm" : "remote";
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.webllmEngine) {
      await this.webllmEngine.unload();
      this.webllmEngine = null;
    }
  }
}

/**
 * Detect device capabilities and recommend appropriate model
 */
export function detectDeviceCapabilities() {
  const memory = (navigator as any).deviceMemory || 4; // GB (Chrome only)
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isFirefox = /Firefox/i.test(navigator.userAgent);

  return {
    memory,
    cores,
    isMobile,
    isFirefox,
    hasWebGPU: 'gpu' in navigator,
  };
}

/**
 * Get recommended model based on device capabilities
 */
export function getRecommendedWebLLMModel(): string {
  const device = detectDeviceCapabilities();

  // Mobile: use smallest model
  if (device.isMobile) {
    return "Qwen3-0.6B";
  }

  // Desktop/Laptop: scale by memory
  if (device.memory >= 8 && device.cores >= 8) {
    return "Qwen3-4B"; // High-end desktop
  } else if (device.memory >= 6) {
    return "Qwen3-1.7B"; // Standard laptop - DEFAULT
  } else {
    return "Qwen3-0.6B"; // Budget laptop
  }
}

/**
 * Create a default LLM provider with auto-detection
 */
export function createDefaultProvider(): LLMProvider {
  const backend = LLMProvider.getRecommendedBackend();
  const device = detectDeviceCapabilities();

  // Show Firefox warning if detected
  if (device.isFirefox && backend === "webllm") {
    console.warn(
      "Firefox detected: WebGPU may require manual enabling in about:config. " +
      "Set dom.webgpu.enabled=true for best experience."
    );
  }

  return new LLMProvider({
    backend,
    model: backend === "webllm" ? getRecommendedWebLLMModel() : "nemotron",
    apiUrl: backend === "remote" ? process.env.AGENT_API_URL || "" : undefined,
  });
}
