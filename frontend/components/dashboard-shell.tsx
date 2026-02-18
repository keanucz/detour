"use client"

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Activity, SlidersHorizontal } from "lucide-react"

import {
  ConstraintsPanel,
  type ApplyConstraintsResult,
  type PlannerConstraints,
  type ManualSatelliteData,
} from "@/components/constraints-panel"
import { DashboardHeader } from "@/components/dashboard-header"
import { GlobeView } from "@/components/globe-view"
import { LeftPanelContent, type FeedEvent } from "@/components/left-panel-content"
import { SidePanel } from "@/components/side-panel"
import { SimulationControls } from "@/components/simulation-controls"
import { TerminalDrawerWebLLM, type TerminalDrawerHandle } from "@/components/terminal-drawer-webllm"
import { SimEngine, naiveDecider, DEFAULT_SIM_CONFIG, type InitialDebrisPos } from "@/lib/sim-engine"

const DEFAULT_CONSTRAINTS: PlannerConstraints = {
  maxTotalDeltaV: 0.35,
  maxBurns: 1,
  preferredAxis: "along",
  horizonHours: 24,
}

type RiskLevel = "LOW" | "MED" | "HIGH"

export function DashboardShell() {
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [activePrimaryId, setActivePrimaryId] = useState<number | null>(25544)
  const [headerRisk, setHeaderRisk] = useState<RiskLevel>("LOW")
  const [appliedConstraints, setAppliedConstraints] = useState<PlannerConstraints>(DEFAULT_CONSTRAINTS)
  const [manualSatelliteData, setManualSatelliteData] = useState<ManualSatelliteData | null>(null)
  const [maneuverEvent, setManeuverEvent] = useState<{ position: number[]; velocity: number[]; delta_v: number[] } | null>(null)

  // Auto-trigger state
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const lastAutoTriggerHash = useRef("")
  const lastAutoTriggerTime = useRef(0)
  const terminalRef = useRef<TerminalDrawerWebLLMHandle>(null)

  // Real-time simulation state
  const [simActive, setSimActive] = useState(false)
  const [simLoading, setSimLoading] = useState(false)
  const [simEngine, setSimEngine] = useState<SimEngine | null>(null)

  const panelColumns = useMemo(() => {
    const leftWidth = leftCollapsed ? "4.75rem" : "22rem"
    const rightWidth = rightCollapsed ? "4.75rem" : "22rem"
    return `${leftWidth} minmax(0, 1fr) ${rightWidth}`
  }, [leftCollapsed, rightCollapsed])

  const handleApplyConstraints = async (next: PlannerConstraints): Promise<ApplyConstraintsResult> => {
    try {
      const response = await fetch("/api/constraints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(next),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = (await response.json()) as {
        ok?: boolean
        message?: string
        constraints?: PlannerConstraints
      }
      if (result.constraints) {
        setAppliedConstraints(result.constraints)
      } else {
        setAppliedConstraints(next)
      }

      return {
        ok: result.ok ?? true,
        message: result.message ?? "Constraints applied.",
        appliedAt: new Date().toISOString(),
      }
    } catch {
      setAppliedConstraints(next)
      return {
        ok: false,
        message: "Applied locally; backend constraints service is unavailable.",
        appliedAt: new Date().toISOString(),
      }
    }
  }

  const handleManualSatelliteLoad = (data: ManualSatelliteData) => {
    setManualSatelliteData(data)
    setActivePrimaryId(-1)
  }

  const handleAgentManeuverExecuted = useCallback((data: { position: number[]; velocity: number[]; delta_v: number[] }) => {
    const dvMag = Math.sqrt(data.delta_v[0] ** 2 + data.delta_v[1] ** 2 + data.delta_v[2] ** 2)
    console.log("[DETOUR] Agent maneuver executed:", {
      position_eci_m: data.position,
      velocity_eci_ms: data.velocity,
      delta_v_ms: data.delta_v,
      delta_v_magnitude_ms: dvMag.toFixed(4),
    })
    // Pass to GlobeView — it applies a visual perturbation to the current orbit
    setManeuverEvent({ ...data })
    setTimeout(() => setManeuverEvent(null), 4000)
  }, [])

  const handleRunScenario = useCallback(async () => {
    setSimLoading(true)
    try {
      // Fetch real LEO debris positions from API
      let debrisPositions: InitialDebrisPos[] = []
      try {
        const res = await fetch("/api/debris?limit=2500&orbitClasses=LEO")
        if (res.ok) {
          const payload = await res.json() as { objects: { lat: number; lon: number; altKm: number }[] }
          debrisPositions = payload.objects
            .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon) && Number.isFinite(o.altKm))
            .map((o) => ({ lat: o.lat, lon: o.lon, altKm: o.altKm }))
        }
      } catch {
        // If API is down, engine will run with no debris
      }

      const engine = new SimEngine(DEFAULT_SIM_CONFIG, naiveDecider)
      engine.init(debrisPositions)
      setSimEngine(engine)
      setSimActive(true)
    } finally {
      setSimLoading(false)
    }
  }, [])

  const handleResetSimulation = useCallback(() => {
    if (simEngine) {
      simEngine.reset()
    }
  }, [simEngine])

  const handleExitSimulation = useCallback(() => {
    setSimActive(false)
    setSimEngine(null)
  }, [])

  // Auto-trigger agent terminal from feed data
  useEffect(() => {
    if (simActive || !feedEvents.length) return

    const medOrHigh = feedEvents.filter((e) => e.risk === "MED" || e.risk === "HIGH")
    if (!medOrHigh.length) return

    // Build fingerprint for deduplication
    const fingerprint = medOrHigh
      .map((e) => `${e.secondaryNorad}:${e.risk}:${Math.round(e.missKm)}`)
      .sort()
      .join("|")

    if (fingerprint === lastAutoTriggerHash.current) return

    // Enforce 60-second cooldown
    const now = Date.now()
    if (now - lastAutoTriggerTime.current < 60_000) return

    // Build contextual prompt
    const highCount = medOrHigh.filter((e) => e.risk === "HIGH").length
    const medCount = medOrHigh.filter((e) => e.risk === "MED").length
    const riskSummary = [
      highCount > 0 ? `${highCount} HIGH-RISK` : "",
      medCount > 0 ? `${medCount} MED-RISK` : "",
    ].filter(Boolean).join(" and ")

    const noradId = activePrimaryId ?? 25544
    const eventLines = medOrHigh
      .map((e) => `- Secondary NORAD ${e.secondaryNorad}: miss ${e.missKm.toFixed(2)} km, TCA in ${Math.round(e.tcaInMinutes)} min, risk ${e.risk}`)
      .join("\n")

    const prompt = [
      `AUTOMATED ALERT: CelestRAK conjunction feed detected ${riskSummary} conjunction event(s) for satellite NORAD ${noradId}.`,
      "",
      "Conjunction Events:",
      eventLines,
      "",
      "Analyze these threats and, if any are high risk, propose avoidance maneuvers and check constraints. Use the demo dataset for satellite state.",
    ].join("\n")

    // Update dedup state
    lastAutoTriggerHash.current = fingerprint
    lastAutoTriggerTime.current = now

    // Open drawer and trigger
    if (!terminalOpen) {
      setTerminalOpen(true)
    }
    terminalRef.current?.triggerWithPrompt(prompt)
  }, [feedEvents, simActive, activePrimaryId, terminalOpen])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <GlobeView
        compacted={terminalOpen}
        noradId={activePrimaryId}
        manualSatelliteData={manualSatelliteData}
        simEngine={simActive ? simEngine : null}
        maneuverEvent={maneuverEvent}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-6">
        <div className="pointer-events-auto mx-auto w-full max-w-[1600px]">
          <DashboardHeader
            riskLevel={headerRisk}
            onRunScenario={handleRunScenario}
            simLoading={simLoading}
            simActive={simActive}
            onExitSimulation={handleExitSimulation}
          />
        </div>
      </div>

      {/* Simulation controls overlay — shown when simulation is active */}
      {simActive && simEngine && (
        <SimulationControls
          engine={simEngine}
          onExit={handleExitSimulation}
          onReset={handleResetSimulation}
        />
      )}

      <div className="pointer-events-none absolute inset-0 z-10 p-6 pt-28 pb-6">
        <div
          className="mx-auto grid h-full w-full max-w-[1600px] grid-cols-1 gap-4 transition-[grid-template-columns] duration-500 ease-in-out lg:[grid-template-columns:var(--panel-cols)] lg:grid-rows-[minmax(0,1fr)_auto]"
          style={{ "--panel-cols": panelColumns } as CSSProperties}
        >
          <SidePanel
            className="lg:col-start-1 lg:row-span-2"
            side="left"
            collapsed={leftCollapsed}
            onToggle={() => setLeftCollapsed((value) => !value)}
            icon={Activity}
            title="Target + Live Feed"
          >
            <LeftPanelContent
              onPrimaryIdChange={setActivePrimaryId}
              activePrimaryId={activePrimaryId}
              onRiskChange={setHeaderRisk}
              onFeedUpdate={setFeedEvents}
            />
          </SidePanel>

          <div className="hidden lg:block lg:col-start-2 lg:row-start-1" />

          <SidePanel
            className="lg:col-start-3 lg:row-span-2"
            side="right"
            collapsed={rightCollapsed}
            onToggle={() => setRightCollapsed((value) => !value)}
            icon={SlidersHorizontal}
            title="Constraints"
          >
            <ConstraintsPanel
              appliedConstraints={appliedConstraints}
              onApply={handleApplyConstraints}
              onManualSatelliteLoad={handleManualSatelliteLoad}
            />
          </SidePanel>

          {!simActive && (
            <TerminalDrawerWebLLM
              ref={terminalRef}
              className="lg:col-start-2 lg:row-start-2"
              isOpen={terminalOpen}
              onToggle={() => setTerminalOpen((open) => !open)}
              onManeuverExecuted={handleAgentManeuverExecuted}
            />
          )}
        </div>
      </div>
    </main>
  )
}
