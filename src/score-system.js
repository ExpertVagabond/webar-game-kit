/**
 * ScoreSystem — hole scoring + scorecard tracker.
 * Ported from 8thwall-archive/putt-putt ECS to standalone class.
 */

const GOLF_TERMS = {
  '-3': 'Albatross',
  '-2': 'Eagle',
  '-1': 'Birdie',
  '0': 'Par',
  '1': 'Bogey',
  '2': 'Double Bogey',
  '3': 'Triple Bogey',
}

export class ScoreSystem {
  constructor() {
    this.holes = []
    this.currentHole = 0
    this.currentStrokes = 0
    this._listeners = {}
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(fn)
    return this
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach((fn) => fn(data))
  }

  addStroke() {
    this.currentStrokes++
    this._emit('stroke', { hole: this.currentHole + 1, strokes: this.currentStrokes })
  }

  scoreHole(par) {
    const score = this.currentStrokes
    const diff = score - par
    const term = GOLF_TERMS[String(diff)] || (diff > 0 ? `+${diff}` : `${diff}`)

    const entry = {
      hole: this.currentHole + 1,
      par,
      score,
      diff,
      term,
    }

    this.holes.push(entry)
    this._emit('hole-scored', entry)

    this.currentHole++
    this.currentStrokes = 0

    return entry
  }

  get totalScore() {
    return this.holes.reduce((sum, h) => sum + h.score, 0)
  }

  get totalPar() {
    return this.holes.reduce((sum, h) => sum + h.par, 0)
  }

  get totalDiff() {
    return this.totalScore - this.totalPar
  }

  get scorecard() {
    return this.holes.map((h) => ({
      ...h,
      color: h.diff < 0 ? '#00edaf' : h.diff > 0 ? '#ff4466' : '#ffffff',
    }))
  }

  reset() {
    this.holes = []
    this.currentHole = 0
    this.currentStrokes = 0
    this._emit('reset', {})
  }

  static getGolfTerm(score, par) {
    const diff = score - par
    return GOLF_TERMS[String(diff)] || (diff > 0 ? `+${diff}` : `${diff}`)
  }
}
