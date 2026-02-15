"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw, X } from "lucide-react"

import type { SimEngine } from "@/lib/sim-engine"
import { formatDistance, formatTime } from "@/lib/simulation-helpers"

interface SimulationControlsProps {
  engine: SimEngine
  onExit: () => void
  onReset: () => void
}

const DIRECTION_LABELS: Record<string, string> = {
  N: "\u2191 N",
  S: "\u2193 S",
  E: "\u2192 E",
  W: "\u2190 W",
  NE: "\u2197 NE",
  NW: "\u2196 NW",
  SE: "\u2198 SE",
  SW: "\u2199 SW",
  HOLD: "\u2022 HOLD",
}

export function SimulationControls({ engine, onExit, onReset }: SimulationControlsProps) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [, setDisplayTick] = useState(0)

  const lastFrameRef = useRef<number | null>(null)
  const lastDisplayUpdateRef = useRef(0)
  const speedRef = useRef(speed)
  const tickAccum = useRef(0)
  speedRef.current = speed

  // Auto-play on mount
  useEffect(() => {
    setPlaying(true)
  }, [])

  // Animation loop — drives engine.tick()
  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null
      return
    }

    let rafId: number

    function tick(now: number) {
      if (lastFrameRef.current !== null) {
        const dt = (now - lastFrameRef.current) / 1000
        // How many ticks to advance this frame
        tickAccum.current += dt * engine.config.ticksPerSecond * speedRef.current
        const ticksToRun = Math.floor(tickAccum.current)
        tickAccum.current -= ticksToRun

        for (let i = 0; i < ticksToRun; i++) {
          engine.tick()
          if (engine.state.collided || engine.state.finished) break
        }

        // Throttle display updates to every 100ms
        if (now - lastDisplayUpdateRef.current > 100) {
          lastDisplayUpdateRef.current = now
          setDisplayTick(engine.state.tickCount)
        }

        if (engine.state.collided || engine.state.finished) {
          setDisplayTick(engine.state.tickCount)
          setPlaying(false)
          lastFrameRef.current = null
          return
        }
      }
      lastFrameRef.current = now
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [playing, engine])

  const handleReset = useCallback(() => {
    setPlaying(false)
    setDisplayTick(0)
    tickAccum.current = 0
    lastFrameRef.current = null
    onReset()
    // Auto-play after reset
    setTimeout(() => setPlaying(true), 50)
  }, [onReset])

  const togglePlay = useCallback(() => {
    if (engine.state.collided || engine.state.finished) {
      handleReset()
      return
    }
    setPlaying((p) => !p)
  }, [engine, handleReset])

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      if (s === 1) return 2
      if (s === 2) return 3
      return 1
    })
  }, [])

  // Derived display values
  const elapsedSec = engine.getElapsedSec()
  const totalSec = engine.config.maxTicks / engine.config.ticksPerSecond
  const distKm = engine.getNearestDistKm()
  const isCollided = engine.state.collided
  const moveCount = engine.state.moveHistory.length
  const lastDir = engine.state.lastDirection
  const dangerDist = engine.state.dangerDistance

  // Collision imminent: danger distance < 0.05 scene units
  const isNearCollision = dangerDist !== null && dangerDist < 0.05 && !isCollided

  return (
    <>
      {/* Collision confirmed — clean mission-control overlay */}
      {isCollided && (
        <div className="pointer-events-none absolute inset-0 z-40">
          {/* Subtle vignette */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-red-950/40" />
          {/* Thin red border flash */}
          <div className="absolute inset-0 border-2 border-red-500/40" />
          {/* Centered alert card */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg border border-red-500/30 bg-black/80 px-10 py-6 backdrop-blur-sm">
              <div className="mb-1 flex items-center justify-center gap-2.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                <span className="text-2xl font-semibold tracking-wider text-red-400 sm:text-3xl">
                  COLLISION DETECTED
                </span>
              </div>
              <p className="text-center text-sm tracking-wide text-red-300/70">
                Object impact confirmed &mdash; trajectory lost
              </p>
              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-400">
                <span>T+{formatTime(elapsedSec)}</span>
                <span className="text-gray-600">|</span>
                <span>Maneuvers: {moveCount}</span>
                <span className="text-gray-600">|</span>
                <span>Distance: {distKm !== null ? formatDistance(distKm) : "---"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collision imminent warning — understated bar */}
      {isNearCollision && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 text-center">
          <span className="inline-block rounded border border-red-500/30 bg-red-950/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-red-400 backdrop-blur-sm">
            Proximity Warning &mdash; Collision Risk
          </span>
        </div>
      )}

      {/* Top-right HUD */}
      <div className="pointer-events-none absolute right-6 top-20 z-30">
        <div className="pointer-events-auto rounded-lg bg-black/70 px-4 py-2.5 backdrop-blur">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Real-Time Collision Avoidance
          </div>
          <div className="mb-1.5 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Satellite</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-[10px] uppercase tracking-wider text-gray-400">Debris Field</span>
            </div>
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Nearest Debris</div>
              <div
                className={`font-mono text-sm font-semibold ${
                  distKm !== null && distKm < 50
                    ? "text-red-400"
                    : distKm !== null && distKm < 200
                      ? "text-amber-400"
                      : "text-white"
                }`}
              >
                {distKm !== null ? formatDistance(distKm) : "---"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Maneuvers</div>
              <div className="font-mono text-sm font-semibold text-white">
                {moveCount}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Last Move</div>
              <div className={`font-mono text-sm font-semibold ${lastDir === "HOLD" ? "text-gray-400" : "text-cyan-400"}`}>
                {DIRECTION_LABELS[lastDir] ?? lastDir}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom playback bar */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 to-transparent px-6 pb-6 pt-12">
        <div className="mx-auto max-w-4xl">
          {/* Progress bar */}
          <div className="relative mb-3 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-100"
              style={{ width: `${(engine.state.tickCount / engine.config.maxTicks) * 100}%` }}
            />
            {isCollided && (
              <div
                className="absolute top-0 h-full w-1 bg-red-500"
                style={{ left: `${(engine.state.tickCount / engine.config.maxTicks) * 100}%` }}
              />
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                onClick={handleReset}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <RotateCcw size={14} />
              </button>

              {isCollided && (
                <button
                  onClick={() => {
                    setPlaying(false)
                    setDisplayTick(0)
                    tickAccum.current = 0
                    lastFrameRef.current = null
                    onReset()
                    setTimeout(() => setPlaying(true), 50)
                  }}
                  className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/30"
                >
                  Replay
                </button>
              )}

              <button
                onClick={cycleSpeed}
                className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/20"
              >
                {speed}x
              </button>

              <button
                onClick={onExit}
                className="flex items-center gap-1.5 rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-300 transition hover:bg-red-500/30"
              >
                <X size={12} />
                Exit
              </button>
            </div>

            <div className="font-mono text-sm text-white">
              <span>{formatTime(elapsedSec)}</span>
              <span className="mx-1 text-gray-500">/</span>
              <span className="text-gray-400">{formatTime(totalSec)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
