# Detour — Satellite Collision Avoidance AI

**TL;DR:** An AI agent that runs on satellites to dodge space debris. Works in your browser with zero installation, or deploy it on real hardware.

🏆 **TreeHacks 2026 · 4th Place NVIDIA Edge AI Track**

---

## What is this?

Detour is an autonomous collision-avoidance system for satellites. When debris is headed your way, it:

1. **Scans** orbital data for upcoming threats
2. **Calculates** collision probability using real physics
3. **Plans** avoidance maneuvers considering fuel and safety
4. **Executes** the burn autonomously (or waits for approval)

All of this runs **on-board** the satellite using local AI — no waiting for ground control.

We built this for the [NVIDIA Ascent GX10](https://www.asus.com/us/networking-iot-servers/aiot-industrial-solutions/aiot-embedded-computers-edge-ai/asus-ascent-gx10/) (Grace Blackwell edge computer), but you can run it anywhere — even in your browser.

---

## Quick Start

**Three ways to run it:**

### 1. 🌐 Browser Mode (Default - No Installation) ⭐

Just clone and run the frontend. The AI runs directly in your browser using [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API):

```bash
git clone https://github.com/keanucz/detour.git
cd detour/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're done.

**Requirements:**
- Chrome or Edge 113+ (WebGPU enabled by default)
- 4GB+ RAM
- Any GPU (Intel, NVIDIA, AMD — even integrated graphics)

**How it works:** The app auto-detects WebGPU and uses it by default. The first time you click "Run", it downloads a ~1.7GB AI model to your browser cache. After that, everything runs locally with zero latency and **no GPU server needed** — perfect for deploying alongside other services in your homelab!

---

### 2. 🖥️ Local Server Mode (Better Quality)

Run the full pipeline with Ollama serving Nemotron locally:

#### Windows
```powershell
# Install Ollama
winget install ollama

# Start Ollama
ollama serve

# In a new terminal, pull the model
ollama pull nemotron

# Start frontend
cd frontend
npm install
npm run dev

# Start backend (optional, for full agent pipeline)
pip install -r requirements.txt
python -m uvicorn api.app:app --reload --port 8000
```

#### macOS
```bash
# Install Ollama
brew install ollama
ollama serve &
ollama pull nemotron

# Start frontend
cd frontend
npm install
npm run dev

# Start backend (optional)
pip3 install -r requirements.txt
python3 -m uvicorn api.app:app --reload --port 8000
```

#### Linux
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull nemotron

# Start frontend
cd frontend
npm install
npm run dev

# Start backend (optional)
pip install -r requirements.txt
python -m uvicorn api.app:app --reload --port 8000
```

Open [http://localhost:3000](http://localhost:3000)

---

### 3. 🚀 Production Mode (Docker)

Full deployment with Docker (includes backend, frontend, and Ollama):

```bash
# Clone
git clone https://github.com/keanucz/detour.git
cd detour

# Copy environment config
cp .env.example .env

# Start everything
docker compose up --build
```

**With GPU acceleration:**
```bash
# NVIDIA GPU (Linux/Windows)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build

# Or use the helper script
./start.sh --gpu
```

**With vLLM (faster inference):**
```bash
docker compose --profile vllm up --build
```

Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Next.js + React Three)      │
│  • 3D globe with live satellite viz    │
│  • Agent terminal with streaming logs   │
│  • Collision alerts & maneuver display  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  LLM Backend (3 options)                │
│  1. WebGPU (browser, Qwen3-1.7B)        │ ← Zero installation
│  2. Ollama (local, Nemotron)            │ ← Better quality
│  3. vLLM (GPU server, Nemotron)         │ ← Production
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Agent Pipeline (LangGraph)             │
│  Scout → Analyst → Planner → Safety     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Physics Engine                         │
│  • Orbital mechanics (SGP4, RK4)        │
│  • Collision probability (Chan method)  │
│  • Clohessy-Wiltshire dynamics          │
└─────────────────────────────────────────┘
```

### The Five Agents

Each agent is a specialized AI with specific tools:

1. **Scout** — Scans space catalog for upcoming conjunctions
2. **Analyst** — Calculates collision probability and refines trajectory predictions
3. **Planner** — Designs avoidance maneuvers (considers fuel, battery, thrust limits)
4. **Safety** — Validates constraints and executes approved burns
5. **Ops Brief** — Generates human-readable summary

They work together in a [LangGraph](https://www.langchain.com/langgraph) pipeline, passing data back and forth until a safe decision is made.

---

## Three LLM Backends

You can switch between three backends depending on your needs:

### Option 1: WebGPU (Browser) — **DEFAULT** ⭐

**When to use:** Demos, development, deployment to a website, homelab deployments

**Pros:**
- **Auto-selected by default** (no configuration needed)
- Zero installation
- Runs offline after first load
- Works on any device with a modern browser
- Free (no API costs)
- **Doesn't consume GPU server resources** — perfect for homelabs running multiple services

**Cons:**
- Smaller models (Qwen3-1.7B vs Nemotron-30B)
- Slower on low-end hardware

**How to use:**
1. Open the app in Chrome/Edge
2. Click the terminal at the bottom
3. Click Run — it auto-selects WebGPU!
4. First run: model downloads (~1.7GB), then cached forever

**To manually switch:**
1. Click ⚙️ Settings → WebLLM
2. Choose a model
3. Click Initialize → Run

**Available models:**
- Qwen3-0.6B (600MB, fast)
- **Qwen3-1.7B** (1.7GB, recommended)
- Qwen3-4B (4GB, better quality)
- Qwen3-8B (8GB, best quality)

---

### Option 2: Ollama (Local Server)

**When to use:** Development, full agent pipeline, better quality

**Pros:**
- Runs the full Nemotron 30B model
- Better reasoning and tool-calling
- Complete multi-agent pipeline
- Still local and private

**Cons:**
- Requires ~20GB disk space
- Needs manual installation
- CPU inference is slower

**Setup:**

1. Install Ollama: https://ollama.com/download
2. Pull the model:
   ```bash
   ollama pull nemotron
   ```
3. It just works — the app will auto-connect to `localhost:11434`

**Switching in the UI:**
1. Click terminal → ⚙️ Settings
2. Select "Remote Backend"
3. Click Run

---

### Option 3: vLLM (GPU Server)

**When to use:** Production deployment, Ascent GX10, DGX, cloud inference

**Pros:**
- Fastest inference (GPU optimized)
- Supports 4-bit quantization (NVFP4)
- Best for real satellite hardware

**Cons:**
- Requires NVIDIA GPU
- More complex setup

**Setup:**

```bash
# Using Docker
docker compose --profile vllm up --build
```

Or configure a remote endpoint in `.env`:
```bash
NEMOTRON_BASE_URL=http://your-vllm-server:8001/v1
NEMOTRON_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4
```

---

## Configuration

All settings are in `.env`:

```bash
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend API
PORT=8000

# LLM Backend (choose one)
NEMOTRON_BASE_URL=http://localhost:11434/v1  # Ollama
# NEMOTRON_BASE_URL=http://localhost:8001/v1   # vLLM
# NEMOTRON_BASE_URL=http://192.168.1.100:11434/v1  # Remote

NEMOTRON_MODEL=nemotron  # For Ollama
# NEMOTRON_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4  # For vLLM

# Optional: API key for OpenAI/NVIDIA NIM
NEMOTRON_API_KEY=
```

**Switching between backends:**

1. **WebGPU (browser)** → No config needed, select in UI
2. **Ollama (local)** → Use defaults above
3. **vLLM (GPU server)** → Uncomment vLLM lines, restart backend

---

## Browser Requirements (WebGPU Mode)

| Browser | Status | Notes |
|---------|--------|-------|
| **Chrome 113+** | ✅ Works perfectly | Recommended |
| **Edge 113+** | ✅ Works perfectly | Windows optimized |
| **Firefox 121+** | ⚠️ Experimental | Enable `dom.webgpu.enabled` in `about:config` |
| **Safari 18+** | ⚠️ Limited | WebGPU still experimental |

**Check if your browser supports WebGPU:**
1. Open developer console (F12)
2. Type: `navigator.gpu !== undefined`
3. If it says `true`, you're good!

---

## System Requirements

### Browser Mode
- **RAM:** 4GB minimum, 8GB recommended
- **GPU:** Any (Intel HD, NVIDIA, AMD)
- **Storage:** ~2GB browser cache
- **OS:** Windows, macOS, Linux

### Ollama Mode
- **RAM:** 16GB recommended for Nemotron 30B
- **Disk:** 20GB for model storage
- **GPU:** Optional (CPU works, just slower)
- **OS:** Windows, macOS, Linux

### vLLM Mode
- **GPU:** NVIDIA with 24GB+ VRAM
- **VRAM:** 15GB for Nemotron 4-bit quantized
- **OS:** Linux (Docker required)

---

## Deployment

### Homelab Deployment (Recommended for Komodo Stack) 🏠

**Perfect for homelabs!** WebGPU mode means the AI runs in users' browsers, not on your server:

```yaml
# docker-compose.yml (Komodo stack compatible)
services:
  detour-frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    # No GPU needed! WebGPU runs in the browser

  detour-backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NEMOTRON_BASE_URL=http://ollama:11434/v1  # Optional
    # Backend only needed for physics calculations
    # LLM inference happens in the browser via WebGPU
```

**Benefits for homelab:**
- ✅ No GPU allocation needed — saves resources for other services
- ✅ Users get low-latency inference (runs on their device)
- ✅ Scales infinitely (each user uses their own browser GPU)
- ✅ Works alongside GPU-heavy services (Stable Diffusion, Ollama, etc.)

**To disable backend LLM entirely:**
Just deploy the frontend. Users will automatically use WebGPU. Set up backend only if you need the full multi-agent physics pipeline.

---

### Static Site Hosting (WebGPU Only)

Since WebGPU runs in the browser, you can deploy the frontend as a static site:

```bash
cd frontend
npm run build
npm run export  # Generates static HTML/JS
```

Deploy to:
- **Vercel:** `vercel deploy`
- **Netlify:** `netlify deploy`
- **GitHub Pages:** `npm run deploy`
- **AWS S3:** Upload `out/` folder
- **Homelab reverse proxy:** Nginx, Caddy, Traefik

No backend or GPU needed — the AI runs in the user's browser!

---

### Full Stack Deployment (with Backend)

Deploy backend + frontend + Ollama/vLLM (optional):

**Using Docker:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Manual deployment:**
1. Deploy backend (FastAPI) to any Python host (Render, Railway, Fly.io)
2. Deploy frontend to Vercel/Netlify
3. Point frontend to backend URL in `.env`
4. *Optional:* Run Ollama/vLLM on a separate GPU server (only if users want to switch from WebGPU)

---

## Project Structure

```
detour/
├── agents/           # LangGraph multi-agent pipeline
│   ├── run.py        # Main agent runner
│   ├── graph.py      # Agent workflow definition
│   └── tools.py      # Tool wrappers for physics engine
├── api/              # FastAPI backend
│   └── app.py        # API endpoints (agent, catalog, satellite)
├── engine/           # Physics & orbital mechanics
│   ├── physics.py    # RK4 solver, J2 perturbations
│   ├── screening.py  # Collision detection
│   └── models/       # Satellite simulation
├── frontend/         # Next.js dashboard
│   ├── components/   # React components
│   ├── lib/          # LLM providers (WebGPU, Ollama, vLLM)
│   └── app/          # Pages
└── scripts/          # Deployment scripts
```

---

## Troubleshooting

### "WebGPU not available"

**Solution:**
1. Update to Chrome 113+ or Edge 113+
2. Enable hardware acceleration in browser settings
3. Update GPU drivers
4. Try Firefox → `about:config` → set `dom.webgpu.enabled` to `true`
5. Fall back to Ollama mode

---

### "Cannot connect to LLM backend"

**If using Browser mode:**
- Just click "Initialize" in the terminal settings

**If using Ollama:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve

# Pull the model if needed
ollama pull nemotron
```

**If using vLLM:**
```bash
# Check vLLM logs
docker compose logs vllm

# Restart if needed
docker compose restart vllm
```

---

### Model download is slow/stuck

**Browser mode:**
- First download takes 5-10 minutes for 1.7GB
- Progress shows in the terminal
- If stuck, clear browser cache and retry

**Ollama mode:**
```bash
# Watch download progress
docker compose logs -f ollama-pull

# Or if running natively
ollama pull nemotron  # Shows progress
```

---

### Out of memory

**Browser crashes:**
- Use smaller model (Qwen3-0.6B)
- Close other tabs
- Restart browser
- Switch to Ollama mode

**Ollama runs out of RAM:**
- Reduce `num_ctx` in Ollama config
- Use a quantized model
- Switch to vLLM with GPU

---

## Development

### Running Tests

```bash
# Backend
pytest

# Frontend
cd frontend
npm test
```

### Code Style

```bash
# Python
black .
ruff check .

# TypeScript
cd frontend
npm run lint
```

### Adding New Tools

1. Add function to `engine/physics.py` or `engine/screening.py`
2. Create wrapper in `agents/tools.py`
3. Register in `agents/config.py`
4. Agents will automatically discover and use it

---

## Team

- **Keanu** — Agent system, vLLM setup, tool integration
- **Justyna** — Frontend, 3D visualization, UI/UX
- **Ethan** — Ascent GX10 setup, simulation logic
- **Adit** — Satellite data feed, collision detection

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Links

- **Devpost:** https://devpost.com/software/detour-64kpds
- **Demo:** https://detour-ai.vercel.app (coming soon)
- **Paper:** [docs/paper.pdf](docs/paper.pdf) (coming soon)

---

## Acknowledgments

Built for TreeHacks 2026 · NVIDIA Edge AI Track

Special thanks to:
- NVIDIA for the Ascent GX10 hardware and support
- ASUS for the amazing edge computing platform
- TreeHacks organizers for an incredible hackathon
