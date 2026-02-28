/**
 * CurveAnimator — Catmull-Rom spline animation with arc-length parametrization.
 * Ported from 8thwall-archive/putt-putt ECS to standalone Three.js class.
 *
 * Features:
 * - Catmull-Rom spline interpolation for smooth 3D curves
 * - Arc-length lookup table (binary search) for constant-speed traversal
 * - Look-ahead orientation (object faces movement direction)
 * - Time-based or distance-based (train) modes
 * - Loop support
 * - Debug visualization
 */

import * as THREE from 'three'

export class CurveAnimator {
  constructor(points, {
    speed = 1.0,
    mode = 'train', // 'train' (constant speed) | 'time' (linear interpolation)
    duration = 3.0,
    loop = false,
    orientToDirection = true,
    lookAheadDistance = 0.01,
    arcLengthSegments = 200,
  } = {}) {
    this.points = points.map((p) =>
      p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x || p[0], p.y || p[1], p.z || p[2])
    )
    this.speed = speed
    this.mode = mode
    this.duration = duration
    this.loop = loop
    this.orientToDirection = orientToDirection
    this.lookAheadDistance = lookAheadDistance

    // Build arc-length table for constant-speed traversal
    this.arcLengthTable = this._buildArcLengthTable(arcLengthSegments)
    this.totalLength = this.arcLengthTable[this.arcLengthTable.length - 1].distance

    // Animation state
    this.progress = 0
    this.distanceTraveled = 0
    this.isPlaying = false
    this.isComplete = false
    this._target = null
  }

  // Catmull-Rom interpolation between 4 points
  static catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t
    const t3 = t2 * t
    return new THREE.Vector3(
      0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
    )
  }

  // Get position on the spline at parameter t (0-1)
  getPoint(t) {
    t = Math.max(0, Math.min(1, t))
    const pts = this.points
    const n = pts.length - 1
    const segment = Math.min(Math.floor(t * n), n - 1)
    const localT = (t * n) - segment

    const p0 = pts[Math.max(0, segment - 1)]
    const p1 = pts[segment]
    const p2 = pts[Math.min(n, segment + 1)]
    const p3 = pts[Math.min(n, segment + 2)]

    return CurveAnimator.catmullRom(p0, p1, p2, p3, localT)
  }

  _buildArcLengthTable(segments) {
    const table = [{ parameter: 0, distance: 0 }]
    let totalDist = 0
    let prevPoint = this.getPoint(0)

    for (let i = 1; i <= segments; i++) {
      const t = i / segments
      const point = this.getPoint(t)
      totalDist += prevPoint.distanceTo(point)
      table.push({ parameter: t, distance: totalDist })
      prevPoint = point
    }
    return table
  }

  // Binary search: distance → parameter
  getParameterForDistance(targetDist) {
    const table = this.arcLengthTable
    if (targetDist <= 0) return 0
    if (targetDist >= this.totalLength) return 1

    let low = 0, high = table.length - 1
    while (low < high - 1) {
      const mid = (low + high) >> 1
      if (table[mid].distance < targetDist) low = mid
      else high = mid
    }

    const d0 = table[low].distance
    const d1 = table[high].distance
    const frac = (targetDist - d0) / (d1 - d0)
    return table[low].parameter + frac * (table[high].parameter - table[low].parameter)
  }

  // Attach to a Three.js Object3D
  attachTo(object3D) {
    this._target = object3D
    return this
  }

  play() {
    this.isPlaying = true
    this.isComplete = false
    this.progress = 0
    this.distanceTraveled = 0
    return this
  }

  pause() { this.isPlaying = false; return this }
  resume() { this.isPlaying = true; return this }

  reset() {
    this.progress = 0
    this.distanceTraveled = 0
    this.isPlaying = false
    this.isComplete = false
    return this
  }

  // Call in animation loop with deltaTime in seconds
  update(dt) {
    if (!this.isPlaying || this.isComplete) return

    if (this.mode === 'train') {
      this.distanceTraveled += this.speed * dt
      if (this.distanceTraveled >= this.totalLength) {
        if (this.loop) {
          this.distanceTraveled %= this.totalLength
        } else {
          this.distanceTraveled = this.totalLength
          this.isComplete = true
        }
      }
      this.progress = this.getParameterForDistance(this.distanceTraveled)
    } else {
      this.progress += dt / this.duration
      if (this.progress >= 1) {
        if (this.loop) {
          this.progress %= 1
        } else {
          this.progress = 1
          this.isComplete = true
        }
      }
    }

    const position = this.getPoint(this.progress)

    if (this._target) {
      this._target.position.copy(position)

      if (this.orientToDirection) {
        const ahead = this.getPoint(Math.min(1, this.progress + this.lookAheadDistance))
        this._target.lookAt(ahead)
      }
    }

    return position
  }

  // Generate debug spheres along the curve
  createDebugVisualization(scene, { color = 0x00ffff, count = 50, size = 0.05 } = {}) {
    const geo = new THREE.SphereGeometry(size)
    const mat = new THREE.MeshBasicMaterial({ color })
    const group = new THREE.Group()

    for (let i = 0; i <= count; i++) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(this.getPoint(i / count))
      group.add(mesh)
    }

    scene.add(group)
    return group
  }
}
