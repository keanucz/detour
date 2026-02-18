// Quick test to see all available models in WebLLM
import * as webllm from "@mlc-ai/web-llm";

console.log("Available models:");
console.log(webllm.prebuiltAppConfig?.model_list || "No models found");

// Check for Nemotron
const models = webllm.prebuiltAppConfig?.model_list || [];
const nemotronModels = models.filter(m => m.model_id?.toLowerCase().includes('nemotron'));
console.log("Nemotron models:", nemotronModels);
