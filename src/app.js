/**
 * Game Kit Demo — CurveAnimator visualization + ScoreSystem demo.
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CurveAnimator } from './curve-animator.js'
import { ScoreSystem } from './score-system.js'

let renderer, scene, camera, controls, animator, ball, clock

function init() {
  const container = document.getElementById('viewer')
  clock = new THREE.Clock()

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x08080f)
  scene.fog = new THREE.Fog(0x08080f, 10, 30)

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(5, 4, 8)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)

  // Lights
  scene.add(new THREE.AmbientLight(0x8888ff, 0.3))
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.position.set(5, 8, 3)
  scene.add(sun)

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x111119, roughness: 0.9 })
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const grid = new THREE.GridHelper(20, 40, 0x222244, 0x151528)
  grid.material.opacity = 0.3
  grid.material.transparent = true
  scene.add(grid)

  // Define a demo curve (figure-8 shape)
  const curvePoints = []
  for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * Math.PI * 2
    curvePoints.push(new THREE.Vector3(
      Math.sin(t) * 3,
      0.5 + Math.sin(t * 2) * 0.5,
      Math.sin(t * 2) * 2
    ))
  }

  // Create animator
  animator = new CurveAnimator(curvePoints, {
    speed: 2.0,
    mode: 'train',
    loop: true,
    orientToDirection: true,
  })

  // Debug visualization
  animator.createDebugVisualization(scene, { color: 0x7611b7, count: 100, size: 0.03 })

  // Ball
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0x00edaf,
      emissive: 0x00edaf,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    })
  )
  scene.add(ball)
  animator.attachTo(ball).play()

  // Trail effect
  const trailGeo = new THREE.BufferGeometry()
  const trailPositions = new Float32Array(300 * 3)
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
  const trailMat = new THREE.PointsMaterial({ color: 0x00edaf, size: 0.04, transparent: true, opacity: 0.5 })
  const trail = new THREE.Points(trailGeo, trailMat)
  scene.add(trail)
  let trailIdx = 0

  // Score system demo
  const score = new ScoreSystem()
  score.on('hole-scored', (entry) => {
    const el = document.getElementById('scorecard')
    el.innerHTML += `<div class="score-entry" style="color:${entry.diff < 0 ? '#00edaf' : entry.diff > 0 ? '#ff4466' : '#fff'}">
      Hole ${entry.hole}: ${entry.score} (${entry.term})
    </div>`
  })

  // Auto-score demo holes
  const pars = [3, 4, 3, 5, 4]
  let demoHole = 0
  setInterval(() => {
    if (demoHole < pars.length) {
      const strokes = pars[demoHole] + Math.floor(Math.random() * 3) - 1
      for (let i = 0; i < strokes; i++) score.addStroke()
      score.scoreHole(pars[demoHole])
      document.getElementById('total-score').textContent = `Total: ${score.totalScore} (${score.totalDiff >= 0 ? '+' : ''}${score.totalDiff})`
      demoHole++
    }
  }, 2000)

  // Controls
  document.getElementById('speed-slider').oninput = (e) => {
    animator.speed = parseFloat(e.target.value)
    document.getElementById('speed-val').textContent = `${animator.speed.toFixed(1)}x`
  }

  document.getElementById('pause-btn').onclick = () => {
    if (animator.isPlaying) {
      animator.pause()
      document.getElementById('pause-btn').textContent = '▶ Resume'
    } else {
      animator.resume()
      document.getElementById('pause-btn').textContent = '⏸ Pause'
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  function animate() {
    requestAnimationFrame(animate)
    const dt = clock.getDelta()
    controls.update()
    animator.update(dt)

    // Update trail
    if (ball) {
      const pos = trailGeo.attributes.position
      pos.array[trailIdx * 3] = ball.position.x
      pos.array[trailIdx * 3 + 1] = ball.position.y
      pos.array[trailIdx * 3 + 2] = ball.position.z
      pos.needsUpdate = true
      trailIdx = (trailIdx + 1) % 300
    }

    renderer.render(scene, camera)
  }
  animate()
}

document.addEventListener('DOMContentLoaded', init)
