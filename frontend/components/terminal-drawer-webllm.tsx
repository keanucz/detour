/**
 * Terminal Drawer with WebLLM Integration
 *
 * Enhanced version that supports:
 * 1. WebLLM (browser-based, WebGPU)
 * 2. Remote backends (Ollama/vLLM) as fallback
 */

"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { LLMProvider, createDefaultProvider, WEBLLM_MODELS, type AgentEvent, type LLMBackendType } from "@/lib/llm-provider"

interface AgentLog {
  id: number
  timestamp: string
  text: string
  color: string
}

interface TerminalDrawerProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
  onManeuverExecuted?: (data: { position: number[]; velocity: number[]; delta_v: number[] }) => void
}

export interface TerminalDrawerHandle {
  triggerWithPrompt(prompt: string): void
}

function formatTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
}

function eventToLog(event: AgentEvent, id: number): AgentLog {
  const ts = formatTime()
  const agent = event.agent || "system"

  switch (event.type) {
    case "pipeline_start":
      return { id, timestamp: ts, text: "pipeline started", color: "text-cyan-400" }
    case "agent_start":
      return { id, timestamp: ts, text: `${agent}: starting...`, color: "text-blue-400" }
    case "thinking":
      return {
        id,
        timestamp: ts,
        text: `${agent}: ${(event.thought as string)?.slice(0, 80) ?? "analyzing..."}`,
        color: "text-gray-400 italic",
      }
    case "tool_call":
      return { id, timestamp: ts, text: `${agent}.${event.tool}: calling...`, color: "text-yellow-300" }
    case "tool_result":
      return {
        id,
        timestamp: ts,
        text: `${agent}.${event.tool}: ${(event.summary as string)?.slice(0, 120) ?? "done"}`,
        color: "text-emerald-300",
      }
    case "agent_complete":
      return {
        id,
        timestamp: ts,
        text: `${agent}: completed (${event.elapsed_sec}s)`,
        color: "text-green-400",
      }
    case "agent_output":
      return {
        id,
        timestamp: ts,
        text: `${agent}: ${(event.content as string)?.slice(0, 150) ?? ""}`,
        color: "text-blue-300",
      }
    case "maneuver_executed":
      return { id, timestamp: ts, text: `${agent}: maneuver applied — updating globe orbit`, color: "text-emerald-400 font-bold" }
    case "pipeline_complete":
      return { id, timestamp: ts, text: "pipeline complete ✓", color: "text-green-500 font-bold" }
    case "error":
      // Handle multi-line errors
      const errorMessage = event.message as string
      if (errorMessage?.includes('\n')) {
        return { id, timestamp: ts, text: errorMessage, color: "text-red-400", multiline: true } as any
      }
      return { id, timestamp: ts, text: `ERROR: ${errorMessage}`, color: "text-red-400" }
    case "done":
      return { id, timestamp: ts, text: "stream closed", color: "text-gray-500" }
    default:
      return { id, timestamp: ts, text: JSON.stringify(event).slice(0, 120), color: "text-gray-400" }
  }
}

export const TerminalDrawerWebLLM = forwardRef<TerminalDrawerHandle, TerminalDrawerProps>(
  function TerminalDrawerWebLLM({ isOpen, onToggle, className, onManeuverExecuted }, ref) {
    const [logs, setLogs] = useState<AgentLog[]>([
      { id: 0, timestamp: formatTime(), text: "agent terminal ready — click ▶ to run pipeline", color: "text-gray-500" },
    ])
    const [running, setRunning] = useState(false)
    const [llmProvider, setLlmProvider] = useState<LLMProvider | null>(null)
    const [backend, setBackend] = useState<LLMBackendType>("webllm")
    const [selectedModel, setSelectedModel] = useState("Qwen3-1.7B")
    const [isInitialized, setIsInitialized] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)
    const idRef = useRef(1)

    // Auto-scroll to bottom
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, [logs])

    // Initialize LLM provider on mount
    useEffect(() => {
      const provider = createDefaultProvider()
      setLlmProvider(provider)
      setBackend(LLMProvider.getRecommendedBackend())

      return () => {
        provider.cleanup()
      }
    }, [])

    const initializeProvider = useCallback(async () => {
      if (!llmProvider || isInitialized) return

      setLogs([
        { id: idRef.current++, timestamp: formatTime(), text: `initializing ${backend === "webllm" ? "WebLLM" : "remote backend"}...`, color: "text-cyan-400" },
      ])

      llmProvider.setProgressCallback((progress) => {
        setLogs((prev) => [
          ...prev,
          { id: idRef.current++, timestamp: "", text: progress, color: "text-gray-400" },
        ])
      })

      try {
        await llmProvider.initialize()
        setIsInitialized(true)
        setLogs((prev) => [
          ...prev,
          { id: idRef.current++, timestamp: formatTime(), text: "✓ ready to run agent pipeline", color: "text-green-400" },
        ])
      } catch (error) {
        setLogs((prev) => [
          ...prev,
          { id: idRef.current++, timestamp: formatTime(), text: `initialization failed: ${error}`, color: "text-red-400" },
        ])
      }
    }, [llmProvider, backend, isInitialized])

    const startPipeline = useCallback(
      async (prompt?: string) => {
        if (running) return

        // Initialize if needed (for WebLLM)
        if (backend === "webllm" && !isInitialized) {
          await initializeProvider()
        }

        setRunning(true)
        const initMsg = prompt
          ? "auto-triggered by feed data — connecting to agent pipeline..."
          : "connecting to agent pipeline..."
        setLogs([{ id: 0, timestamp: formatTime(), text: initMsg, color: "text-cyan-400" }])
        idRef.current = 1

        const ctrl = new AbortController()
        abortRef.current = ctrl

        try {
          if (!llmProvider) {
            throw new Error("LLM provider not initialized")
          }

          const defaultPrompt =
            "Scan for conjunction threats against the ISS in the next 24 hours. If any are high risk, propose avoidance maneuvers and check constraints. Use the demo dataset."

          const stream = llmProvider.streamAgentEvents(prompt || defaultPrompt, "multi")

          for await (const event of stream) {
            if (ctrl.signal.aborted) break

            const log = eventToLog(event, idRef.current++)

            // Handle multi-line error messages
            if ('multiline' in log && (log as any).multiline && typeof log.text === 'string') {
              const errorLines = log.text.split('\n').filter(l => l.trim())
              setLogs((prev) => [
                ...prev,
                ...errorLines.map((errLine, idx) => ({
                  id: idRef.current++,
                  timestamp: idx === 0 ? log.timestamp : '',
                  text: errLine,
                  color: log.color,
                }))
              ])
            } else {
              setLogs((prev) => [...prev, log])
            }

            // Notify parent when the agent executes a maneuver
            if (event.type === "maneuver_executed" && onManeuverExecuted) {
              onManeuverExecuted({
                position: event.position,
                velocity: event.velocity,
                delta_v: event.delta_v ?? [0, 0, 0],
              })
            }
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            setLogs((prev) => [
              ...prev,
              { id: idRef.current++, timestamp: formatTime(), text: `error: ${e}`, color: "text-red-400" },
            ])
          }
        } finally {
          setRunning(false)
          abortRef.current = null
        }
      },
      [running, llmProvider, backend, isInitialized, initializeProvider, onManeuverExecuted]
    )

    const stopPipeline = useCallback(() => {
      abortRef.current?.abort()
      setLogs((prev) => [
        ...prev,
        { id: idRef.current++, timestamp: formatTime(), text: "pipeline aborted by user", color: "text-orange-400" },
      ])
      setRunning(false)
    }, [])

    const changeBackend = useCallback(
      (newBackend: LLMBackendType, model: string) => {
        if (running) return

        const provider = new LLMProvider({
          backend: newBackend,
          model,
          apiUrl: newBackend === "remote" ? process.env.AGENT_API_URL || "" : undefined,
        })

        llmProvider?.cleanup()
        setLlmProvider(provider)
        setBackend(newBackend)
        setSelectedModel(model)
        setIsInitialized(false)

        setLogs([
          {
            id: idRef.current++,
            timestamp: formatTime(),
            text: `switched to ${newBackend} backend (${model})`,
            color: "text-yellow-400",
          },
        ])
      },
      [llmProvider, running]
    )

    useImperativeHandle(
      ref,
      () => ({
        triggerWithPrompt(prompt: string) {
          void startPipeline(prompt)
        },
      }),
      [startPipeline]
    )

    return (
      <div className={cn("pointer-events-auto w-full", className)}>
        <div
          className={cn(
            "overflow-hidden rounded-t-xl border border-border/80 bg-black/85 shadow-2xl transition-[max-height] duration-500 ease-in-out",
            isOpen ? "max-h-96" : "max-h-11"
          )}
        >
          {/* Header */}
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between border-b border-border/50 bg-black/90 px-4 py-2 text-left hover:bg-white/5"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="font-mono text-sm font-semibold text-gray-300">
                agent terminal {backend === "webllm" ? "🧠" : "☁️"}
              </span>
              {backend === "webllm" && (
                <span className="text-xs text-gray-500">({selectedModel})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSettings(!showSettings)
                }}
                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white"
                disabled={running}
              >
                ⚙️ settings
              </button>
              <span className="text-xs text-gray-500">{isOpen ? "▼" : "▲"}</span>
            </div>
          </button>

          {/* Settings Panel */}
          {showSettings && isOpen && (
            <div className="border-b border-border/50 bg-gray-900/50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-300">LLM Backend</h3>

              <div className="space-y-2">
                {/* WebLLM Option */}
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="backend"
                    checked={backend === "webllm"}
                    onChange={() => changeBackend("webllm", "Qwen3-1.7B")}
                    disabled={running}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-gray-300">
                      WebLLM (Browser-based) {!LLMProvider.isWebGPUAvailable() && <span className="text-red-400">⚠️ WebGPU not available</span>}
                    </div>
                    {backend === "webllm" && (
                      <select
                        value={selectedModel}
                        onChange={(e) => changeBackend("webllm", e.target.value)}
                        disabled={running}
                        className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-xs text-gray-300"
                      >
                        {Object.entries(WEBLLM_MODELS).map(([key, model]) => (
                          <option key={key} value={key}>
                            {key} - {model.size} - {model.description}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>

                {/* Remote Backend Option */}
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="backend"
                    checked={backend === "remote"}
                    onChange={() => changeBackend("remote", "nemotron")}
                    disabled={running}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-gray-300">Remote Backend (Ollama/vLLM/OpenAI)</div>
                    <div className="text-xs text-gray-500">Requires backend server</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Terminal Content */}
          <div
            ref={scrollRef}
            className="h-72 overflow-y-auto bg-black/95 p-4 font-mono text-xs leading-relaxed"
          >
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2">
                {log.timestamp && (
                  <span className="text-gray-600">[{log.timestamp}]</span>
                )}
                <span className={log.color}>{log.text}</span>
              </div>
            ))}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-border/50 bg-black/90 px-4 py-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startPipeline()}
                disabled={running}
                className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:bg-gray-600"
              >
                {running ? "running..." : "▶ run"}
              </button>
              {running && (
                <button
                  type="button"
                  onClick={stopPipeline}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                >
                  ■ stop
                </button>
              )}
              {backend === "webllm" && !isInitialized && !running && (
                <button
                  type="button"
                  onClick={initializeProvider}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  ⚡ initialize
                </button>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {backend === "webllm" ? "🧠 local (WebGPU)" : "☁️ remote"}
            </div>
          </div>
        </div>
      </div>
    )
  }
)
