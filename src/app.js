/**
 * Game Kit Demo — Playable mini-golf with aim/shoot/physics.
 * Click to aim, drag for power, release to shoot. Ball rolls with friction.
 * Uses CurveAnimator for course visualization and ScoreSystem for scoring.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ScoreSystem } from './score-system.js'
import { analyzeShotSetup, getScoreReaction, getCourseIntro, analyzeStroke } from './ai-caddy.js'

let renderer, scene, camera, controls, clock
let ball, hole, aimArrow, powerBar
let score

// Physics state
let ballVelocity = new THREE.Vector3()
let ballMoving = false
let friction = 0.985
let currentHole = 0

// Aim state
let isAiming = false
let aimStart = new THREE.Vector2()
let aimCurrent = new THREE.Vector2()
let maxPower = 8

// Course definitions
const COURSES = [
  {
    par: 3, holePos: [3, 0.01, 0], ballStart: [-3, 0.15, 0],
    walls: [
      { pos: [0, 0.15, 2.5], size: [8, 0.3, 0.2] },
      { pos: [0, 0.15, -2.5], size: [8, 0.3, 0.2] },
      { pos: [-4, 0.15, 0], size: [0.2, 0.3, 5] },
      { pos: [4, 0.15, 0], size: [0.2, 0.3, 5] },
    ],
    label: 'Straight Shot',
  },
  {
    par: 4, holePos: [3, 0.01, 3], ballStart: [-3, 0.15, -3],
    walls: [
      { pos: [0, 0.15, -4], size: [8, 0.3, 0.2] },
      { pos: [0, 0.15, 4], size: [8, 0.3, 0.2] },
      { pos: [-4, 0.15, 0], size: [0.2, 0.3, 8] },
      { pos: [4, 0.15, 0], size: [0.2, 0.3, 8] },
      { pos: [0, 0.15, 0], size: [3, 0.3, 0.2] }, // center barrier
    ],
    label: 'Corner Pocket',
  },
  {
    par: 3, holePos: [0, 0.01, 4], ballStart: [0, 0.15, -4],
    walls: [
      { pos: [0, 0.15, -5], size: [6, 0.3, 0.2] },
      { pos: [0, 0.15, 5], size: [6, 0.3, 0.2] },
      { pos: [-3, 0.15, 0], size: [0.2, 0.3, 10] },
      { pos: [3, 0.15, 0], size: [0.2, 0.3, 10] },
      { pos: [-1.2, 0.15, -1], size: [1.5, 0.3, 0.2] },
      { pos: [1.2, 0.15, 1], size: [1.5, 0.3, 0.2] },
    ],
    label: 'Snake Lane',
  },
]

let wallMeshes = []
const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4e, roughness: 0.6, metalness: 0.3 })
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a4a2a, roughness: 0.8 })

function init() {
  const container = document.getElementById('viewer')
  clock = new THREE.Clock()

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x08080f)
  scene.fog = new THREE.Fog(0x08080f, 15, 35)

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 8, 8)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  controls.maxPolarAngle = Math.PI / 2.5
  controls.minDistance = 4
  controls.maxDistance = 16

  // Lights
  scene.add(new THREE.AmbientLight(0x6688aa, 0.4))
  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(5, 10, 5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.1
  sun.shadow.camera.far = 30
  sun.shadow.camera.left = -10
  sun.shadow.camera.right = 10
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  scene.add(sun)

  const greenLight = new THREE.PointLight(0x00edaf, 1, 8)
  greenLight.position.set(0, 3, 0)
  scene.add(greenLight)

  // Floor (extends beyond course)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x111119, roughness: 0.9 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  floor.receiveShadow = true
  scene.add(floor)

  // Ball
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1, metalness: 0.3, roughness: 0.4 })
  )
  ball.castShadow = true
  scene.add(ball)

  // Aim arrow
  aimArrow = new THREE.Group()
  const arrowBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4466 })
  )
  arrowBody.rotation.z = -Math.PI / 2
  arrowBody.position.x = 0.5
  aimArrow.add(arrowBody)
  const arrowHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.1, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4466 })
  )
  arrowHead.rotation.z = -Math.PI / 2
  arrowHead.position.x = 1.05
  aimArrow.add(arrowHead)
  aimArrow.visible = false
  scene.add(aimArrow)

  // Score system
  score = new ScoreSystem()
  score.on('hole-scored', (entry) => {
    const el = document.getElementById('scorecard')
    el.innerHTML += `<div class="score-entry" style="color:${entry.diff < 0 ? '#00edaf' : entry.diff > 0 ? '#ff4466' : '#fff'}">
      Hole ${entry.hole}: ${entry.score} (${entry.term})
    </div>`
    document.getElementById('total-score').textContent = `Total: ${score.totalScore} (${score.totalDiff >= 0 ? '+' : ''}${score.totalDiff})`
  })

  // Load first course
  loadCourse(0)

  // Input handlers
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // Reset button
  document.getElementById('reset-btn').onclick = () => {
    ballVelocity.set(0, 0, 0)
    ballMoving = false
    const course = COURSES[currentHole]
    ball.position.set(...course.ballStart)
    updateStrokeDisplay()
  }

  animate()
}

// ── Course Loading ──
function loadCourse(index) {
  currentHole = index % COURSES.length
  const course = COURSES[currentHole]

  // Clear old walls
  wallMeshes.forEach((w) => scene.remove(w))
  wallMeshes = []

  // Remove old hole/green
  scene.children.filter((c) => c.userData?.courseElement).forEach((c) => scene.remove(c))

  // Green (course surface)
  const green = new THREE.Mesh(
    new THREE.PlaneGeometry(
      Math.max(...course.walls.map((w) => Math.abs(w.pos[0]) + w.size[0] / 2)) * 2 + 0.5,
      Math.max(...course.walls.map((w) => Math.abs(w.pos[2]) + w.size[2] / 2)) * 2 + 0.5
    ),
    groundMat
  )
  green.rotation.x = -Math.PI / 2
  green.position.y = 0.001
  green.receiveShadow = true
  green.userData.courseElement = true
  scene.add(green)

  // Walls
  course.walls.forEach((w) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat)
    mesh.position.set(...w.pos)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.courseElement = true
    scene.add(mesh)
    wallMeshes.push(mesh)
  })

  // Hole
  if (hole) scene.remove(hole)
  const holeGroup = new THREE.Group()
  const holeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  )
  holeMesh.rotation.x = -Math.PI / 2
  holeGroup.add(holeMesh)
  // Flag pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.8, 8),
    new THREE.MeshBasicMaterial({ color: 0xcccccc })
  )
  pole.position.set(0.15, 0.4, 0)
  holeGroup.add(pole)
  // Flag
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xff4466, side: THREE.DoubleSide })
  )
  flag.position.set(0.25, 0.75, 0)
  holeGroup.add(flag)

  holeGroup.position.set(course.holePos[0], course.holePos[1], course.holePos[2])
  holeGroup.userData.courseElement = true
  scene.add(holeGroup)
  hole = holeGroup

  // Reset ball
  ball.position.set(...course.ballStart)
  ballVelocity.set(0, 0, 0)
  ballMoving = false

  // Update UI
  document.getElementById('hole-label').textContent = `Hole ${currentHole + 1}: ${course.label}`
  document.getElementById('par-label').textContent = `Par ${course.par}`
  score.currentStrokes = 0
  updateStrokeDisplay()

  // AI caddy course intro
  const intro = getCourseIntro(course.label)
  updateCaddyTip(intro)
}

// ── Input ──
function onPointerDown(e) {
  if (ballMoving) return
  isAiming = true
  aimStart.set(e.clientX, e.clientY)
  aimCurrent.copy(aimStart)
  controls.enabled = false

  // AI caddy shot setup analysis
  const course = COURSES[currentHole]
  const tip = analyzeShotSetup(ball.position, course.holePos, course.walls)
  updateCaddyTip(tip)
}

function onPointerMove(e) {
  if (!isAiming) return
  aimCurrent.set(e.clientX, e.clientY)

  const dx = aimCurrent.x - aimStart.x
  const dy = aimCurrent.y - aimStart.y
  const drag = Math.sqrt(dx * dx + dy * dy)

  if (drag > 10) {
    // Show aim arrow
    const angle = Math.atan2(dy, dx)
    const power = Math.min(drag / 100, 1)

    aimArrow.position.copy(ball.position)
    aimArrow.position.y = 0.15
    // Arrow points opposite to drag direction (pull back to shoot forward)
    aimArrow.rotation.y = -angle + Math.PI / 2
    aimArrow.scale.setScalar(0.5 + power * 1.5)
    aimArrow.visible = true

    // Update power bar
    const powerEl = document.getElementById('power-fill')
    powerEl.style.width = `${power * 100}%`
    powerEl.style.background = power > 0.7 ? '#ff4466' : power > 0.4 ? '#ffc828' : '#00edaf'
  }
}

function onPointerUp() {
  if (!isAiming) return
  controls.enabled = true

  const dx = aimCurrent.x - aimStart.x
  const dy = aimCurrent.y - aimStart.y
  const drag = Math.sqrt(dx * dx + dy * dy)

  if (drag > 10) {
    const power = Math.min(drag / 100, 1) * maxPower
    const angle = Math.atan2(dy, dx)

    // Launch ball opposite to drag direction
    ballVelocity.x = -Math.cos(angle) * power * 0.5
    ballVelocity.z = Math.sin(angle) * power * 0.5
    ballVelocity.y = 0
    ballMoving = true

    score.addStroke()
    updateStrokeDisplay()

    // AI caddy shot tip (delayed until ball stops)
    const course = COURSES[currentHole]
    setTimeout(() => {
      if (!ballMoving) {
        const tip = analyzeStroke(ball.position, course.holePos, score.currentStrokes, course.par)
        updateCaddyTip(tip)
      }
    }, 2000)
  }

  isAiming = false
  aimArrow.visible = false
  document.getElementById('power-fill').style.width = '0%'
}

// ── Physics ──
function updatePhysics(dt) {
  if (!ballMoving) return

  const speed = ballVelocity.length()
  if (speed < 0.01) {
    ballVelocity.set(0, 0, 0)
    ballMoving = false
    checkHole()
    return
  }

  // Apply velocity
  ball.position.x += ballVelocity.x * dt
  ball.position.z += ballVelocity.z * dt
  ball.position.y = 0.12 // Keep on ground

  // Ball rotation (visual only)
  ball.rotation.x += ballVelocity.z * dt * 5
  ball.rotation.z -= ballVelocity.x * dt * 5

  // Friction
  ballVelocity.multiplyScalar(friction)

  // Wall collisions
  const course = COURSES[currentHole]
  course.walls.forEach((w) => {
    const halfX = w.size[0] / 2
    const halfZ = w.size[2] / 2
    const bx = ball.position.x
    const bz = ball.position.z
    const br = 0.12

    // Check collision
    const closestX = Math.max(w.pos[0] - halfX, Math.min(bx, w.pos[0] + halfX))
    const closestZ = Math.max(w.pos[2] - halfZ, Math.min(bz, w.pos[2] + halfZ))
    const distX = bx - closestX
    const distZ = bz - closestZ
    const dist = Math.sqrt(distX * distX + distZ * distZ)

    if (dist < br) {
      // Bounce
      if (Math.abs(distX) > Math.abs(distZ)) {
        ballVelocity.x *= -0.7
        ball.position.x = closestX + Math.sign(distX) * br
      } else {
        ballVelocity.z *= -0.7
        ball.position.z = closestZ + Math.sign(distZ) * br
      }
    }
  })
}

function checkHole() {
  const course = COURSES[currentHole]
  const hx = course.holePos[0]
  const hz = course.holePos[2]
  const dist = Math.sqrt((ball.position.x - hx) ** 2 + (ball.position.z - hz) ** 2)

  if (dist < 0.25) {
    // Ball in hole!
    ball.position.set(hx, -0.1, hz) // sink ball
    ballMoving = false

    const entry = score.scoreHole(course.par)
    const reaction = getScoreReaction(entry.term)
    showToast(reaction, 4000)

    if (navigator.vibrate) navigator.vibrate([50, 50, 100])

    // Next hole after delay
    setTimeout(() => {
      if (currentHole < COURSES.length - 1) {
        loadCourse(currentHole + 1)
      } else {
        showToast(`Game over! Total: ${score.totalScore} (${score.totalDiff >= 0 ? '+' : ''}${score.totalDiff})`, 6000)
      }
    }, 1500)
  }
}

function updateStrokeDisplay() {
  document.getElementById('stroke-count').textContent = `Strokes: ${score.currentStrokes}`
}

function updateCaddyTip(tip) {
  const el = document.getElementById('caddy-tip')
  if (el) {
    el.textContent = tip
    el.style.opacity = '1'
    clearTimeout(el._timer)
    el._timer = setTimeout(() => { el.style.opacity = '0.6' }, 5000)
  }
}

function showToast(msg, duration = 3000) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), duration)
}

function animate() {
  requestAnimationFrame(animate)
  const dt = clock.getDelta()
  controls.update()
  updatePhysics(dt)

  // Animate flag
  if (hole) {
    const flag = hole.children[2]
    if (flag) {
      flag.position.x = 0.25 + Math.sin(clock.getElapsedTime() * 3) * 0.02
    }
  }

  renderer.render(scene, camera)
}

document.addEventListener('DOMContentLoaded', init)
