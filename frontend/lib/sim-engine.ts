import { geodeticToUnitVector, EARTH_RADIUS_KM } from "@/lib/geo"
import type {
  CardinalDirection,
  DebrisParticle,
  MoveDecider,
  MoveRecord,
  SimConfig,
  SimState,
} from "@/lib/simulation-types"

// --- Seeded PRNG (deterministic demo) with save/restore ---
interface SeededRng {
  (): number
  save(): number
  restore(state: number): void
}

function mulberry32(seed: number): SeededRng {
  let s = seed | 0
  const fn = (() => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as SeededRng
  fn.save = () => s
  fn.restore = (newS: number) => { s = newS }
  return fn
}

// --- Defaults ---
export const DEFAULT_SIM_CONFIG: SimConfig = {
  ticksPerSecond: 30,
  moveIntervalTicks: 15, // satellite decides every 0.5s
  maxTicks: 3600, // 120s demo at 30 tps
  startLat: 10,
  startLon: -60,
  startAltKm: 400,
  moveStepDeg: 0.2, // micro-adjustment size
  debrisCount: 0, // set from API data
  collisionThreshold: 0.035, // matches visual overlap of smaller satellite + debris meshes
  seed: 0, // 0 = random seed each run
}

// Satellite orbital parameters — realistic relative speeds
// All LEO objects orbit at ~7.5 km/s. The satellite is slightly faster than
// debris due to altitude differences, not dramatically faster.
const ORBIT_SPEED_DEG_PER_TICK = 0.05 // eastward component
const ORBIT_SPEED_LAT_DEG_PER_TICK = 0.02 // northward component — diagonal NE path

// Cardinal direction deltas (lat, lon) in degrees
const DIRECTION_DELTAS: Record<CardinalDirection, [number, number]> = {
  N: [1, 0],
  S: [-1, 0],
  E: [0, 1],
  W: [0, -1],
  NE: [0.707, 0.707],
  NW: [0.707, -0.707],
  SE: [-0.707, 0.707],
  SW: [-0.707, -0.707],
  HOLD: [0, 0],
}

function sceneDistance3D(
  lat1: number, lon1: number, alt1: number,
  lat2: number, lon2: number, alt2: number
): number {
  const p1 = geodeticToUnitVector(lat1, lon1, alt1)
  const p2 = geodeticToUnitVector(lat2, lon2, alt2)
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  const dz = p1.z - p2.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// --- Naive decider: greedy dodge away from nearest debris ---
// Reacts only to the single closest threat — can't plan ahead through a stochastic field.
export function naiveDecider(state: Readonly<SimState>): CardinalDirection {
  let nearestDist = Infinity
  let nearestIdx = -1
  let secondDist = Infinity

  for (let i = 0; i < state.debris.length; i++) {
    const d = state.debris[i]
    const dist = sceneDistance3D(
      state.satLat, state.satLon, state.satAltKm,
      d.lat, d.lon, d.altKm
    )
    if (dist < nearestDist) {
      secondDist = nearestDist
      nearestDist = dist
      nearestIdx = i
    } else if (dist < secondDist) {
      secondDist = dist
    }
  }

  // React when debris is within ~5x collision range — visible dodging window
  if (nearestIdx === -1 || nearestDist > 0.20) return "HOLD"

  const nearest = state.debris[nearestIdx]
  const dLat = state.satLat - nearest.lat
  let dLon = state.satLon - nearest.lon
  if (dLon > 180) dLon -= 360
  if (dLon < -180) dLon += 360

  const absLat = Math.abs(dLat)
  const absLon = Math.abs(dLon)

  if (absLat > absLon * 1.5) {
    return dLat > 0 ? "N" : "S"
  } else if (absLon > absLat * 1.5) {
    return dLon > 0 ? "E" : "W"
  } else {
    if (dLat > 0 && dLon > 0) return "NE"
    if (dLat > 0 && dLon < 0) return "NW"
    if (dLat < 0 && dLon > 0) return "SE"
    return "SW"
  }
}

// --- Initial debris position from API ---
export interface InitialDebrisPos {
  lat: number
  lon: number
  altKm: number
}

// --- SimEngine class ---
export class SimEngine {
  state: SimState
  config: SimConfig
  decider: MoveDecider
  private rng: SeededRng
  private initialDebris: InitialDebrisPos[] = []
  // Base orbital position (before micro-adjustments)
  private baseLat = 0
  private baseLon = 0
  // Accumulated micro-adjustment offset (position drift from burns)
  private adjustLat = 0
  private adjustLon = 0
  // Adjustment velocity — smooth drift rate from orbital burns (deg/tick)
  private vAdjustLat = 0
  private vAdjustLon = 0
  // Pre-computed safe path for the first SAFE_PATH_TICKS ticks.
  // Each entry stores [adjustLat, adjustLon, vAdjustLat, vAdjustLon] at that tick.
  private safePath: [number, number, number, number][] = []
  // ID of the planted crash debris — only this one triggers collision
  private crashDebrisId = -1

  constructor(config: SimConfig = DEFAULT_SIM_CONFIG, decider: MoveDecider = naiveDecider) {
    this.config = config
    this.decider = decider
    this.rng = mulberry32(config.seed)
    this.state = this.createInitialState()
  }

  private createInitialState(): SimState {
    return {
      satLat: this.config.startLat,
      satLon: this.config.startLon,
      satAltKm: this.config.startAltKm,
      debris: [],
      moveHistory: [],
      dangerTargetId: -1,
      dangerDistance: null,
      collided: false,
      collisionTick: null,
      tickCount: 0,
      lastDirection: "HOLD",
      finished: false,
    }
  }

  /** Initialize with real debris positions from API */
  init(debrisPositions?: InitialDebrisPos[]): void {
    // Random seed each run unless a fixed seed is specified
    const seed = this.config.seed || (Math.random() * 0xffffffff) >>> 0
    this.rng = mulberry32(seed)
    this.state = this.createInitialState()
    this.baseLat = this.config.startLat
    this.baseLon = this.config.startLon
    this.adjustLat = 0
    this.adjustLon = 0
    this.vAdjustLat = 0
    this.vAdjustLon = 0
    this.safePath = []

    if (debrisPositions && debrisPositions.length > 0) {
      this.initialDebris = debrisPositions
      this.initDebrisFromPositions(debrisPositions)
      this.preComputeSafePath()
    }
  }

  /**
   * Keep all real API debris in place. Plant one crash debris at 10s.
   * Only the crash debris triggers collision — everything else is cosmetic.
   */
  private preComputeSafePath(): void {
    const CRASH_TICK = 300 // 10s at 30 tps

    // Plant collision debris directly in the satellite's diagonal NE path at 10s.
    const crashLon = this.config.startLon + ORBIT_SPEED_DEG_PER_TICK * CRASH_TICK
    const crashLat = this.config.startLat + ORBIT_SPEED_LAT_DEG_PER_TICK * CRASH_TICK

    this.crashDebrisId = this.state.debris.length
    this.state.debris.push({
      id: this.crashDebrisId,
      lat: crashLat,
      lon: crashLon,
      altKm: this.config.startAltKm,
      vLat: 0,
      vLon: 0,
    })
    this.config.debrisCount = this.state.debris.length

    // No path adjustments — satellite flies linearly
    this.safePath = []
    for (let t = 0; t < CRASH_TICK; t++) this.safePath.push([0, 0, 0, 0])
  }

  private initDebrisFromPositions(positions: InitialDebrisPos[]): void {
    const rng = this.rng
    const debris: DebrisParticle[] = []

    // All real debris with smooth, even orbital drift.
    // Debris moves predictably without stochastic wobbling for clear visualization.
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const spawnDist = sceneDistance3D(
        this.config.startLat, this.config.startLon, this.config.startAltKm,
        p.lat, p.lon, p.altKm
      )
      if (spawnDist < this.config.collisionThreshold * 2) continue // small buffer around spawn

      // Debris orbits at similar speed to satellite with small fixed variations
      // This creates even, predictable movement in all directions
      const baseOrbitalVLon = 0.035 + (i % 5) * 0.008 // evenly distributed velocities
      const vLatWobble = ((i % 3) - 1) * 0.003 // fixed latitude drift per debris index

      debris.push({
        id: debris.length,
        lat: p.lat,
        lon: p.lon,
        altKm: p.altKm,
        vLat: vLatWobble,
        vLon: baseOrbitalVLon * (i % 2 === 0 ? 1 : -1),
      })
    }

    this.state.debris = debris
    this.config.debrisCount = debris.length
  }

  tick(): void {
    if (this.state.finished || this.state.collided) return

    const s = this.state
    const rng = this.rng

    // 1. Advance satellite along orbit — diagonal NE motion
    this.baseLon += ORBIT_SPEED_DEG_PER_TICK
    if (this.baseLon > 180) this.baseLon -= 360
    this.baseLat += ORBIT_SPEED_LAT_DEG_PER_TICK

    // Apply accumulated micro-adjustments
    s.satLat = Math.max(-85, Math.min(85, this.baseLat + this.adjustLat))
    s.satLon = this.baseLon + this.adjustLon
    // Normalize longitude
    if (s.satLon > 180) s.satLon -= 360
    if (s.satLon < -180) s.satLon += 360

    // 2. Advance debris smoothly — even orbital drift
    for (const d of s.debris) {
      d.lat += d.vLat
      d.lon += d.vLon

      // No stochastic perturbations — smooth, predictable motion
      // Velocities remain constant for even distribution

      // Clamp latitude, wrap longitude
      if (d.lat > 85 || d.lat < -85) d.vLat *= -1
      if (d.lon > 180) d.lon -= 360
      if (d.lon < -180) d.lon += 360
    }

    // 3. No avoidance — satellite flies linearly into collision

    s.lastDirection = "HOLD"

    // Apply final position
    s.satLat = Math.max(-85, Math.min(85, this.baseLat + this.adjustLat))
    s.satLon = this.baseLon + this.adjustLon
    if (s.satLon > 180) s.satLon -= 360
    if (s.satLon < -180) s.satLon += 360

    // 4. Collision check — always real, no suppression
    let nearestDist = Infinity
    let nearestId = -1

    for (const d of s.debris) {
      const dist = sceneDistance3D(s.satLat, s.satLon, s.satAltKm, d.lat, d.lon, d.altKm)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestId = d.id
      }
    }

    s.dangerTargetId = nearestId
    s.dangerDistance = nearestDist

    // Collide with any debris particle
    if (nearestDist < this.config.collisionThreshold) {
      s.collided = true
      s.collisionTick = s.tickCount
    }

    // 5. Check max ticks
    s.tickCount++
    if (s.tickCount >= this.config.maxTicks) {
      s.finished = true
    }
  }

  reset(): void {
    this.init(this.initialDebris)
  }

  /** Get satellite position as scene-space coordinates */
  getSatelliteVec3(): { x: number; y: number; z: number } {
    return geodeticToUnitVector(this.state.satLat, this.state.satLon, this.state.satAltKm)
  }

  /** Get debris position as scene-space coordinates */
  getDebrisVec3(index: number): { x: number; y: number; z: number } {
    const d = this.state.debris[index]
    return geodeticToUnitVector(d.lat, d.lon, d.altKm)
  }

  /** Get the danger target position in scene-space */
  getDangerTargetVec3(): { x: number; y: number; z: number } | null {
    const id = this.state.dangerTargetId
    if (id === null || id < 0) return null
    const d = this.state.debris[id]
    if (!d) return null
    return geodeticToUnitVector(d.lat, d.lon, d.altKm)
  }

  /** Get a move history position in scene-space */
  getMoveVec3(record: MoveRecord): { x: number; y: number; z: number } {
    return geodeticToUnitVector(record.toLat, record.toLon, this.state.satAltKm)
  }

  /** Distance to nearest debris in km (approximate) */
  getNearestDistKm(): number | null {
    if (this.state.dangerDistance === null) return null
    return this.state.dangerDistance * EARTH_RADIUS_KM
  }

  /** Elapsed real-time seconds */
  getElapsedSec(): number {
    return this.state.tickCount / this.config.ticksPerSecond
  }
}
