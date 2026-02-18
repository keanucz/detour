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

### 3. 🚀 Docker Mode (Three Options)

One docker-compose.yml, three ways to run it:

#### Option A: WebGPU Only (Default, Recommended for Homelabs)

Frontend only, AI runs in browsers:

```bash
git clone https://github.com/keanucz/detour.git
cd detour

# Easy way (default)
./start.sh

# Or explicitly
./start.sh --webgpu

# Or use docker compose directly
docker compose up frontend
```

This starts ONLY the frontend. No backend, Ollama, or vLLM services will start. Users get AI in their browsers via WebGPU. Perfect for homelabs because it uses zero GPU resources on your server.

#### Option B: Full Stack with Ollama (Better Quality)

Frontend + Backend + Ollama:

```bash
git clone https://github.com/keanucz/detour.git
cd detour

# Easy way
./start.sh --ollama

# Or use docker compose with profile
docker compose --profile ollama up
```

This starts frontend, backend, and Ollama. First run downloads the Nemotron model (about 20GB, takes 5-10 minutes). After that, startups are instant because the model is cached.

**Windows users:** Use `.\start.ps1` instead of `./start.sh`

#### Option C: Full Stack with vLLM (Fastest, GPU Required)

Frontend + Backend + vLLM:

```bash
git clone https://github.com/keanucz/detour.git
cd detour

# Easy way
./start.sh --vllm

# Or use docker compose with profile
docker compose --profile vllm up
```

This starts frontend, backend, and vLLM. Requires NVIDIA GPU with 24GB+ VRAM for GPU-accelerated inference.

**All modes:** Open [http://localhost:3000](http://localhost:3000) when ready

**Key insight:** Backend, Ollama, and vLLM services use Docker profiles, so they only start when explicitly requested. Default is WebGPU mode (frontend only).

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

Settings are managed through `.env` file. Create it first:

```bash
cp .env.example .env
```

**For WebGPU mode:** No configuration needed! The app auto-detects WebGPU and uses it by default.

**For Ollama/vLLM mode:** Edit `.env` to configure the backend:

```bash
# Frontend (where the backend API is)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend API port
PORT=8000

# LLM Backend - pick one option:

# Option 1: Ollama (default)
NEMOTRON_BASE_URL=http://ollama:11434/v1
NEMOTRON_MODEL=nemotron

# Option 2: vLLM (uncomment these, comment Ollama)
# NEMOTRON_BASE_URL=http://vllm:8000/v1
# NEMOTRON_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-NVFP4

# Option 3: Remote server (uncomment these)
# NEMOTRON_BASE_URL=http://192.168.1.100:11434/v1
# NEMOTRON_MODEL=nemotron
# NEMOTRON_API_KEY=your-key-here
```

**Quick switching:**

- **WebGPU**: Just open the app, it's already the default
- **Ollama**: `./start.sh --ollama` or `docker compose up`
- **vLLM**: `./start.sh --vllm` or `docker compose --profile vllm up`

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

### Homelab Deployment (Komodo Stack Ready) 🏠

**Perfect for homelabs!** The default docker compose runs in WebGPU mode (frontend only):

```bash
# WebGPU-only mode (default, recommended for homelabs)
docker compose up -d

# Or use the helper script
./start.sh
```

This starts ONLY the frontend. Backend, Ollama, and vLLM services don't start at all (they use Docker profiles). AI runs in users' browsers, so your server stays free for other services.

**For Komodo/Portainer stacks:**

Just point to the repo and use `docker-compose.yml`. No profile needed. It defaults to frontend only.

**If you need the full agent pipeline with Ollama:**

```bash
# Use the ollama profile to start backend + Ollama
docker compose --profile ollama up -d

# Or use the helper script
./start.sh --ollama
```

This starts frontend, backend, and Ollama. The backend handles physics calculations and the full multi-agent pipeline.

**Benefits for homelab:**
- ✅ No GPU needed on server (WebGPU mode)
- ✅ Scales infinitely (each user uses their own device)
- ✅ Works alongside other services
- ✅ Simple one-command deployment

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

### Production Deployment Options

**Option 1: WebGPU-only (Easiest)**

Deploy just the frontend to any static host:

```bash
cd frontend
npm run build
# Deploy the .next folder to your host
```

Works on: Vercel, Netlify, Cloudflare Pages, or any static hosting.

**Option 2: Full Stack (Docker)**

Deploy with Docker:

```bash
# WebGPU mode (frontend only) - DEFAULT
docker compose up -d

# Full stack with Ollama
docker compose --profile ollama up -d

# Full stack with vLLM (GPU server)
docker compose --profile vllm up -d
```

**Option 3: Split Deployment**

1. Deploy frontend to Vercel/Netlify
2. Deploy backend to any Python host (Render, Railway, Fly.io)
3. Update `NEXT_PUBLIC_API_URL` in frontend to point to backend
4. Optional: Run Ollama/vLLM on a separate GPU server

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
