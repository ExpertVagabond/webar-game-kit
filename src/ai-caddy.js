/**
 * AI Caddy — intelligent shot analysis and course commentary.
 * Provides tips based on ball position, hole position, walls, and stroke count.
 */

const SHOT_TIPS = {
  straight: [
    'Nice clean line to the hole — just control your power.',
    'Straight shot available. Keep it smooth.',
    'The fairway is open. Send it!',
  ],
  blocked: [
    'Wall in the way — try banking off the side.',
    'You\'ll need to curve around that barrier.',
    'Can\'t go direct. Consider an angle shot.',
  ],
  close: [
    'Tap it gently — you\'re right there.',
    'Easy putt. Don\'t overthink it.',
    'Feather touch needed — you\'re so close.',
  ],
  far: [
    'Long shot! Max power might be needed.',
    'It\'s far — aim carefully and commit.',
    'Big drive coming up. Line it up.',
  ],
}

const SCORE_REACTIONS = {
  'Hole in One': ['INCREDIBLE! Hole in one! 🏆', 'LEGENDARY shot! Ace! ⭐'],
  Eagle: ['Eagle! That\'s championship play! 🦅', 'Two under par — amazing! 🦅'],
  Birdie: ['Birdie! Beautiful golf! 🐦', 'One under — solid play! 🐦'],
  Par: ['Par — steady and reliable. ⛳', 'Right on par. Consistent! ⛳'],
  Bogey: ['One over par. Shake it off. 💪', 'Bogey — you\'ll get the next one. 💪'],
  'Double Bogey': ['Two over. Tough hole. Keep going. 🎯', 'Don\'t worry, pros have bad holes too. 🎯'],
  'Triple Bogey': ['Rough hole. Reset and focus. 🔄', 'Everyone has those holes. Move on! 🔄'],
}

const COURSE_INTROS = {
  'Straight Shot': 'Simple opener — a straight path to the pin. Find your rhythm here.',
  'Corner Pocket': 'Trickier now — a center barrier forces you to go around. Two-shot strategy works well.',
  'Snake Lane': 'The serpentine lane! Two diagonal barriers create an S-curve. Precision over power.',
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Analyze the current shot and provide a tip.
 */
export function analyzeShotSetup(ballPos, holePos, walls) {
  const dx = holePos[0] - ballPos.x
  const dz = holePos[2] - ballPos.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  // Check if path is blocked
  let blocked = false
  const steps = 20
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const px = ballPos.x + dx * t
    const pz = ballPos.z + dz * t
    for (const w of walls) {
      if (w.size[0] > 0.3 || w.size[2] > 0.3) { // Skip boundary walls
        const halfX = w.size[0] / 2
        const halfZ = w.size[2] / 2
        if (px > w.pos[0] - halfX && px < w.pos[0] + halfX &&
            pz > w.pos[2] - halfZ && pz < w.pos[2] + halfZ) {
          blocked = true
          break
        }
      }
    }
    if (blocked) break
  }

  if (dist < 0.8) return pickRandom(SHOT_TIPS.close)
  if (blocked) return pickRandom(SHOT_TIPS.blocked)
  if (dist > 5) return pickRandom(SHOT_TIPS.far)
  return pickRandom(SHOT_TIPS.straight)
}

/**
 * React to a scored hole.
 */
export function getScoreReaction(term) {
  const reactions = SCORE_REACTIONS[term] || SCORE_REACTIONS['Par']
  return pickRandom(reactions)
}

/**
 * Get course intro text.
 */
export function getCourseIntro(label) {
  return COURSE_INTROS[label] || `Hole ${label} — find your line and commit to the shot.`
}

/**
 * Analyze a completed stroke and suggest improvement.
 */
export function analyzeStroke(ballPos, holePos, strokeCount, par) {
  const dx = holePos[0] - ballPos.x
  const dz = holePos[2] - ballPos.z
  const dist = Math.sqrt(dx * dx + dz * dz)
  const remaining = par - strokeCount

  if (dist < 0.5 && remaining >= 0) {
    return 'Great position! Easy finish from here.'
  }
  if (remaining <= 0) {
    return `Over par — focus on accuracy over power. ${dist.toFixed(1)}m to go.`
  }
  if (dist > 4 && remaining <= 1) {
    return `Long way to go with ${remaining} stroke left. Need a big shot!`
  }
  if (dist < 2) {
    return `Close! ${dist.toFixed(1)}m — a gentle tap should do it.`
  }
  return `${dist.toFixed(1)}m to the hole. ${remaining} strokes to make par.`
}
