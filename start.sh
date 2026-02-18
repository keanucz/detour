#!/bin/bash
# Simple start script for Detour

set -e

MODE="webgpu"  # Default to WebGPU (frontend only)
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
      echo "  --webgpu    WebGPU mode only (frontend, no backend) [DEFAULT]"
      echo "  --ollama    Full stack with Ollama"
      echo "  --vllm      Full stack with vLLM (requires NVIDIA GPU)"
      echo "  --gpu       Enable GPU for Ollama (optional)"
      echo ""
      echo "Examples:"
      echo "  ./start.sh                 # WebGPU mode (default)"
      echo "  ./start.sh --ollama        # Ollama mode"
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
    echo "Starting WebGPU mode (frontend only)..."
    echo "AI will run in users' browsers!"
    echo "No backend, Ollama, or vLLM services will start."
    echo ""
    # Just start frontend, no profiles
    docker compose up --build frontend
    ;;

  ollama)
    echo "Starting Ollama mode (full stack)..."
    echo "This includes: frontend + backend + Ollama"
    if [ "$GPU" = true ]; then
      echo "GPU support enabled for Ollama"
    fi
    echo ""
    # Start with ollama profile
    docker compose --profile ollama up --build
    ;;

  vllm)
    echo "Starting vLLM mode (full stack with GPU)..."
    echo "This includes: frontend + backend + vLLM"
    echo ""
    # Check if nvidia-smi exists
    if ! command -v nvidia-smi &> /dev/null; then
      echo "Error: nvidia-smi not found. vLLM requires NVIDIA GPU."
      exit 1
    fi
    # Start with vllm profile
    docker compose --profile vllm up --build
    ;;
esac
