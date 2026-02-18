# Simple start script for Detour (PowerShell/Windows)

param(
    [switch]$WebGpu,
    [switch]$Ollama,
    [switch]$Vllm,
    [switch]$Gpu,
    [switch]$Help
)

if ($Help) {
    Write-Host "Usage: .\start.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -WebGpu    WebGPU mode only (frontend, no backend)"
    Write-Host "  -Ollama    Full stack with Ollama (default)"
    Write-Host "  -Vllm      Full stack with vLLM (requires NVIDIA GPU)"
    Write-Host "  -Gpu       Enable GPU for Ollama (optional)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\start.ps1                # Ollama mode (default)"
    Write-Host "  .\start.ps1 -WebGpu        # WebGPU only (homelab)"
    Write-Host "  .\start.ps1 -Ollama -Gpu   # Ollama with GPU"
    Write-Host "  .\start.ps1 -Vllm          # vLLM (requires GPU)"
    exit 0
}

# Determine mode
$Mode = "ollama"  # Default
if ($WebGpu) { $Mode = "webgpu" }
if ($Vllm) { $Mode = "vllm" }

Write-Host "=================================="
Write-Host "  Detour - Starting in $Mode mode"
Write-Host "=================================="
Write-Host ""

# Create .env if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item .env.example .env
}

switch ($Mode) {
    "webgpu" {
        Write-Host "Starting WebGPU-only mode (frontend only)..."
        Write-Host "AI will run in users' browsers!"
        Write-Host ""
        docker compose -f docker-compose.webgpu.yml up --build
    }

    "ollama" {
        if ($Gpu) {
            Write-Host "Starting Ollama mode with GPU support..."
        } else {
            Write-Host "Starting Ollama mode (CPU)..."
        }
        Write-Host ""
        docker compose up --build ollama frontend backend ollama-pull
    }

    "vllm" {
        Write-Host "Starting vLLM mode (GPU required)..."
        Write-Host ""
        # Check if nvidia-smi exists
        if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
            Write-Host "Error: nvidia-smi not found. vLLM requires NVIDIA GPU."
            exit 1
        }
        docker compose --profile vllm up --build vllm frontend backend
    }
}
