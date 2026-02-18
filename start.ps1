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
    Write-Host "  -WebGpu    WebGPU mode only (frontend, no backend) [DEFAULT]"
    Write-Host "  -Ollama    Full stack with Ollama"
    Write-Host "  -Vllm      Full stack with vLLM (requires NVIDIA GPU)"
    Write-Host "  -Gpu       Enable GPU for Ollama (optional)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\start.ps1                # WebGPU mode (default)"
    Write-Host "  .\start.ps1 -Ollama        # Ollama mode"
    Write-Host "  .\start.ps1 -Ollama -Gpu   # Ollama with GPU"
    Write-Host "  .\start.ps1 -Vllm          # vLLM (requires GPU)"
    exit 0
}

# Determine mode (default to WebGPU)
$Mode = "webgpu"
if ($Ollama) { $Mode = "ollama" }
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
        Write-Host "Starting WebGPU mode (frontend only)..."
        Write-Host "AI will run in users' browsers!"
        Write-Host "No backend, Ollama, or vLLM services will start."
        Write-Host ""
        # Just start frontend, no profiles
        docker compose up --build frontend
    }

    "ollama" {
        Write-Host "Starting Ollama mode (full stack)..."
        Write-Host "This includes: frontend + backend + Ollama"
        if ($Gpu) {
            Write-Host "GPU support enabled for Ollama"
        }
        Write-Host ""
        # Start with ollama profile
        docker compose --profile ollama up --build
    }

    "vllm" {
        Write-Host "Starting vLLM mode (full stack with GPU)..."
        Write-Host "This includes: frontend + backend + vLLM"
        Write-Host ""
        # Check if nvidia-smi exists
        if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
            Write-Host "Error: nvidia-smi not found. vLLM requires NVIDIA GPU."
            exit 1
        }
        # Start with vllm profile
        docker compose --profile vllm up --build
    }
}
