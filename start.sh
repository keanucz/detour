#!/bin/bash
# Simple start script for Detour

set -e

MODE="ollama"  # Default mode
GPU=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --webgpu)
      MODE="webgpu"
      ;;
    --ollama)
      MODE="ollama"
      ;;
    --vllm)
      MODE="vllm"
      ;;
    --gpu)
      GPU=true
      ;;
    --help)
      echo "Usage: ./start.sh [options]"
      echo ""
      echo "Options:"
      echo "  --webgpu    WebGPU mode only (frontend, no backend)"
      echo "  --ollama    Full stack with Ollama (default)"
      echo "  --vllm      Full stack with vLLM (requires NVIDIA GPU)"
      echo "  --gpu       Enable GPU for Ollama (optional)"
      echo ""
      echo "Examples:"
      echo "  ./start.sh                 # Ollama mode (default)"
      echo "  ./start.sh --webgpu        # WebGPU only (homelab)"
      echo "  ./start.sh --ollama --gpu  # Ollama with GPU"
      echo "  ./start.sh --vllm          # vLLM (requires GPU)"
      exit 0
      ;;
  esac
done

echo "=================================="
echo "  Detour - Starting in ${MODE} mode"
echo "=================================="
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

case $MODE in
  webgpu)
    echo "Starting WebGPU-only mode (frontend only)..."
    echo "AI will run in users' browsers!"
    echo ""
    docker compose -f docker-compose.webgpu.yml up --build
    ;;

  ollama)
    if [ "$GPU" = true ]; then
      echo "Starting Ollama mode with GPU support..."
      echo ""
      # Start with GPU for Ollama
      docker compose up --build ollama frontend backend ollama-pull
    else
      echo "Starting Ollama mode (CPU)..."
      echo ""
      docker compose up --build ollama frontend backend ollama-pull
    fi
    ;;

  vllm)
    echo "Starting vLLM mode (GPU required)..."
    echo ""
    # Check if nvidia-smi exists
    if ! command -v nvidia-smi &> /dev/null; then
      echo "Error: nvidia-smi not found. vLLM requires NVIDIA GPU."
      exit 1
    fi
    docker compose --profile vllm up --build vllm frontend backend
    ;;
esac
