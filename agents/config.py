"""
LLM configuration for the Detour agent system.

Supports three modes:
  1. LOCAL  — Nemotron on the GX10 via NGC vLLM container (primary, for NVIDIA prize)
  2. NIM    — NVIDIA API Catalog / NIM endpoint (fallback)
  3. OPENAI — OpenAI-compatible endpoint (dev/testing)

The GX10 (Grace Blackwell, 128GB unified memory) runs:
  - nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 (~15GB, 4-bit quantized)
  - Served via bare-metal vLLM + flashinfer: ./scripts/setup_gx10.sh

Start with:
  ./scripts/setup_gx10.sh   # bare-metal with flashinfer (recommended)
  # or manually:
  pip install flashinfer vllm
  vllm serve nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4 \\
      --trust-remote-code \\
      --max-model-len 8192 \\
      --gpu-memory-utilization 0.90 \\
      --dtype auto \\
      --enforce-eager \\
      --enable-auto-tool-choice \\
      --tool-call-parser hermes \\
      --enable-chunked-prefill \\
      --port 8001
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LLMConfig:
    """Configuration for the LLM backend."""
    # Endpoint
    base_url: str = "http://localhost:11434/v1"
    api_key: str = "not-needed"
    model: str = "nemotron"

    # Generation parameters
    temperature: float = 0.3          # low for deterministic tool-calling
    max_tokens: int = 2048
    top_p: float = 0.95

    # Agent parameters
    max_iterations: int = 15          # max tool-call loops per agent
    recursion_limit: int = 50         # LangGraph recursion limit

    @classmethod
    def from_env(cls) -> "LLMConfig":
        """Build config from environment variables.

        Supports any OpenAI-compatible API server:
          - Ollama:  NEMOTRON_BASE_URL=http://localhost:11434/v1
          - vLLM:    NEMOTRON_BASE_URL=http://localhost:8001/v1
          - OpenAI:  NEMOTRON_BASE_URL=https://api.openai.com/v1
          - Remote:  NEMOTRON_BASE_URL=http://<your-host>:<port>/v1
        """
        return cls(
            base_url=os.getenv("NEMOTRON_BASE_URL", "http://localhost:11434/v1"),
            api_key=os.getenv("NEMOTRON_API_KEY", "not-needed"),
            model=os.getenv("NEMOTRON_MODEL", "nemotron"),
            temperature=float(os.getenv("NEMOTRON_TEMPERATURE", "0.3")),
            max_tokens=int(os.getenv("NEMOTRON_MAX_TOKENS", "2048")),
        )

    def to_llm_kwargs(self) -> dict:
        """Return kwargs for ChatOpenAI constructor.

        max_tokens is omitted so vLLM automatically uses whatever
        context-window space remains after the input tokens.  This
        avoids 400 errors when accumulated agent context is large.
        """
        return {
            "base_url": self.base_url,
            "api_key": self.api_key,
            "model": self.model,
            "temperature": self.temperature,
            "extra_body": {
                "chat_template_kwargs": {"enable_thinking": False},
            },
        }


# Quick presets
LOCAL_GX10 = LLMConfig(
    base_url="https://detour-ai.keanuc.net/v1",
    model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4",
)

OLLAMA_LOCAL = LLMConfig(
    base_url="http://localhost:11434/v1",
    model="nemotron",
)

VLLM_LOCAL = LLMConfig(
    base_url="http://localhost:8001/v1",
    model="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4",
)

NVIDIA_NIM = LLMConfig(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY", ""),
    model="nvidia/nvidia-nemotron-3-nano-30b-a3b-bf16",
)

# For development/testing when no GPU is available
OPENAI_FALLBACK = LLMConfig(
    base_url="https://api.openai.com/v1",
    api_key=os.getenv("OPENAI_API_KEY", ""),
    model="gpt-4o-mini",
)
