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

// 모듈형 구조에서 외부 CSS/레이아웃 로딩 타이밍 이슈에 대비한 방어적 재보정
window.addEventListener('load', resize);
setTimeout(resize, 60);
setTimeout(resize, 300);
