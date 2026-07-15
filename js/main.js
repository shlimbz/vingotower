// ===== main.js =====
// ---------- 루프 ----------
let lastT = performance.now();
function loop(t){
  const dt = Math.min(0.033, (t-lastT)/1000);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

resize();
resetRun();
state = STATE.AIM; // resetRun already sets this, kept for clarity
requestAnimationFrame(loop);
