/**
 * WebLLM Adapter - Run LLMs directly in the browser using WebGPU
 *
 * This provides a local, no-installation-required alternative to Ollama.
 * Models are cached in browser storage and run using your GPU via WebGPU.
 *
 * Usage:
 *   const llm = await WebLLMAdapter.getInstance();
 *   const response = await llm.chat("Hello!");
 */

import * as webllm from "@mlc-ai/web-llm";

export class WebLLMAdapter {
  private static instance: WebLLMAdapter | null = null;
  private engine: webllm.MLCEngine | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  // Available models - choose based on your needs
  // Smaller models = faster download, less RAM
  private readonly MODEL_OPTIONS = {
    // Fast, small models (< 2GB download)
    "Qwen2.5-0.5B": "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    "Qwen2.5-1.5B": "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",

    // Balanced (2-4GB download)
    "Qwen2.5-3B": "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    "Phi-3.5": "Phi-3.5-mini-instruct-q4f16_1-MLC",

    // High quality (4-8GB download)
    "Qwen2.5-7B": "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    "Llama-3.2-3B": "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  };

  private constructor() {}

  static async getInstance(modelName: keyof typeof WebLLMAdapter.prototype.MODEL_OPTIONS = "Qwen2.5-1.5B"): Promise<WebLLMAdapter> {
    if (!WebLLMAdapter.instance) {
      WebLLMAdapter.instance = new WebLLMAdapter();
      await WebLLMAdapter.instance.initialize(modelName);
    }
    return WebLLMAdapter.instance;
  }

  private async initialize(modelName: keyof typeof this.MODEL_OPTIONS) {
    if (this.engine) return;
    if (this.isInitializing) {
      await this.initPromise;
      return;
    }

    this.isInitializing = true;
    this.initPromise = this._initialize(modelName);
    await this.initPromise;
  }

  private async _initialize(modelName: keyof typeof this.MODEL_OPTIONS) {
    const selectedModel = this.MODEL_OPTIONS[modelName];

    console.log(`[WebLLM] Initializing ${modelName}...`);
    console.log(`[WebLLM] Model will be cached in browser storage`);

    try {
      // Create engine with progress callback
      this.engine = await webllm.CreateMLCEngine(selectedModel, {
        initProgressCallback: (progress) => {
          console.log(`[WebLLM] ${progress.text}`);
          // You can emit events here for UI progress bars
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('webllm-progress', {
              detail: progress
            }));
          }
        },
      });

      console.log(`[WebLLM] Model ${modelName} ready!`);
    } catch (error) {
      console.error("[WebLLM] Initialization failed:", error);
      this.engine = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Chat with the model
   */
  async chat(message: string, systemPrompt?: string): Promise<string> {
    if (!this.engine) {
      throw new Error("WebLLM engine not initialized");
    }

    const messages: webllm.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push({
      role: "user",
      content: message,
    });

    const reply = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    return reply.choices[0]?.message?.content || "";
  }

  /**
   * Stream chat response (for real-time output)
   */
  async *chatStream(message: string, systemPrompt?: string): AsyncGenerator<string> {
    if (!this.engine) {
      throw new Error("WebLLM engine not initialized");
    }

    const messages: webllm.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    messages.push({
      role: "user",
      content: message,
    });

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Reset the engine (useful for switching models)
   */
  async reset() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
  }

  /**
   * Check if WebGPU is supported
   */
  static isWebGPUSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  /**
   * Get cache size (models are stored in browser cache)
   */
  static async getCacheSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }
}

// Export for convenience
export const isWebGPUAvailable = WebLLMAdapter.isWebGPUSupported();
