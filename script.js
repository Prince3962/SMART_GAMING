// Simple Dinosaur Jump Game with MediaPipe Hands detection.
// NOTE: This file references MediaPipe Hands via CDN. When opened in a browser it will fetch the lib online.

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const showCamCheckbox = document.getElementById('showCam');
const cam = document.getElementById('cam');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const message = document.getElementById('message');

let stream = null;
let hands = null;
let running = false;
let lastJump = 0;

// Game state
const game = {
  dino: {x:50,y:140,w:44,h:44,vy:0,ground:140,isJumping:false},
  obstacles: [],
  speed: 4,
  spawnTimer:0,
  score:0
};

// Draw a simple dino
function drawDino() {
  const d = game.dino;
  ctx.fillStyle = '#333';
  ctx.fillRect(d.x, d.y - d.h, d.w, d.h);
  // eye
  ctx.fillStyle = '#fff';
  ctx.fillRect(d.x + 28, d.y - d.h + 8, 6, 6);
}

// Spawn obstacle
function spawnObstacle() {
  game.obstacles.push({x: canvas.width + 20, y: 160, w: 20, h: 40});
}

// Update physics
function updateGame() {
  const d = game.dino;
  // gravity
  d.vy += 1.1; // gravity
  d.y += d.vy;
  if (d.y > d.ground) {
    d.y = d.ground;
    d.vy = 0;
    d.isJumping = false;
  }
  // obstacles
  for (let i = game.obstacles.length -1; i >=0; i--) {
    const o = game.obstacles[i];
    o.x -= game.speed;
    if (o.x + o.w < 0) game.obstacles.splice(i,1);
    // collision
    // Correct collision detection
function isColliding(d, o) {
  const dinoTop = d.y - d.h;
  const dinoBottom = d.y;
  const dinoLeft = d.x;
  const dinoRight = d.x + d.w;

  const obsTop = o.y - o.h;
  const obsBottom = o.y;
  const obsLeft = o.x;
  const obsRight = o.x + o.w;

  return (
    dinoRight > obsLeft &&
    dinoLeft < obsRight &&
    dinoBottom > obsTop &&
    dinoTop < obsBottom
  );
}

    if (isColliding(d, o)) {
  gameOver();
  return;
}
  }
  game.spawnTimer++;
  if (game.spawnTimer > 80) {
    spawnObstacle();
    game.spawnTimer = 0;
  }
  game.score++;
}

// Draw obstacles and ground
function drawScene() {
  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // ground line
  ctx.fillStyle = '#e4e7ee';
  ctx.fillRect(0, 170, canvas.width, 30);
  // dino
  drawDino();
  // obstacles
  ctx.fillStyle = '#2c3e50';
  game.obstacles.forEach(o => ctx.fillRect(o.x, o.y - o.h, o.w, o.h));
  // score
  ctx.fillStyle = '#111';
  ctx.font = '16px monospace';
  ctx.fillText('Score: ' + Math.floor(game.score/10), canvas.width - 140, 30);
}

// Game loop
function loop() {
  if (!running) return;
  updateGame();
  drawScene();
  requestAnimationFrame(loop);
}

// Trigger jump
function jump() {
  const d = game.dino;
  if (!d.isJumping) {
    d.vy = -18;
    d.isJumping = true;
    lastJump = Date.now();
  }
}
function gameOver() {
  running = false;

  message.textContent = "Game Over — collision. Press Start to play again.";

  startBtn.disabled = false;
  stopBtn.disabled = true;

  // Stop camera safely
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  cam.srcObject = null;
}

// Initialize MediaPipe Hands (loaded dynamically)
async function initHands() {
  message.textContent = 'Loading MediaPipe Hands...';
  // dynamically load scripts
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');

  hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }});
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
  hands.onResults(onHandsResults);

  // camera utils
  const camera = new Camera(cam, {
    onFrame: async () => {
      await hands.send({image: cam});
    },
    width: 640,
    height: 480
  });
  camera.start();
  message.textContent = '';
}

// Hand results callback
function onHandsResults(results) {
  if (!running) return;
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const lm = results.multiHandLandmarks[0];
    // use wrist (lm[0]) and middle finger tip (lm[12]) to determine raised hand
    const wristY = lm[0].y;
    const midTipY = lm[12].y;
    // MediaPipe y 0=top, 1=bottom. When midTipY < wristY - threshold => hand raised
    if (midTipY < wristY - 0.08) {
      // raised
      const now = Date.now();
      if (now - lastJump > 350) jump();
    }
  }
}

// helper: dynamically load script
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Start the app
async function start() {
  message.textContent = '';
  startBtn.disabled = true;
  stopBtn.disabled = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({video: true, audio:false});
    cam.srcObject = stream;
    cam.play();
    if (!hands) await initHands();
    running = true;
    resetGame();
    loop();
  } catch (e) {
    console.error(e);
    message.textContent = 'Camera access denied or not available. Open with HTTPS and allow camera.';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// Stop the app
function stop() {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (cam) cam.srcObject = null;
}

// Reset game state
function resetGame() {
  game.dino.y = game.dino.ground;
  game.dino.vy = 0;
  game.dino.isJumping = false;
  game.obstacles = [];
  game.spawnTimer = 0;
  game.score = 0;
  message.textContent = '';
}

// UI wiring
startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);
showCamCheckbox.addEventListener('change', () => {
  cam.style.display = showCamCheckbox.checked ? 'block' : 'none';
});

// expose a manual jump for testing (space)
window.addEventListener('keydown', (e)=>{ if (e.code === 'Space') jump(); });

// initial canvas sizing
function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.getAttribute('width');
  const h = canvas.getAttribute('height');
  canvas.width = w;
  canvas.height = h;
}
fitCanvas();
