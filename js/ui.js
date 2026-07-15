// ===== ui.js =====
// ---------- 액션 버튼 ----------
function onAction(){
  if (state===STATE.AIM){ state=STATE.POWER; }
  else if (state===STATE.POWER){ launch(); }
  else if (state===STATE.FLY){ trySlam(); }
}
document.getElementById('actionBtn').addEventListener('click', onAction);
window.addEventListener('keydown', (e)=>{ if (e.code==='Space'){ e.preventDefault(); onAction(); } });

// ---------- 오버레이 제어 ----------
const startOverlay = document.getElementById('startOverlay');
const resultOverlay = document.getElementById('resultOverlay');
const shopOverlay = document.getElementById('shopOverlay');
const settingsOverlay = document.getElementById('settingsOverlay');

// ---------- 배경음악 (업로드한 곡을 사용) ----------
let bgmVolume = 0.4, bgmMuted = false;
const bgmAudioEl = document.getElementById('bgmAudio');
bgmAudioEl.volume = bgmVolume;

function startBGM(){
  bgmAudioEl.volume = bgmMuted ? 0 : bgmVolume;
  const p = bgmAudioEl.play();
  if (p && p.catch) p.catch(()=>{}); // 자동재생 정책으로 실패해도 무시 (사용자 제스처 이후 재시도됨)
}
function stopBGM(){
  bgmAudioEl.pause();
}
function applyBgmVolume(){
  bgmAudioEl.volume = bgmMuted ? 0 : bgmVolume;
}

// ---------- 효과음 (별도 음원 없이 코드로 생성) ----------
let audioCtx = null;
let sfxGain = null;
let noiseBufferCache = null;
function initAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function ensureSfxGain(){
  initAudio();
  if (!sfxGain){ sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(audioCtx.destination); }
}
function getNoiseBuffer(){
  if (noiseBufferCache) return noiseBufferCache;
  const len = audioCtx.sampleRate * 1.0;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
  noiseBufferCache = buf;
  return buf;
}
function playSfx(name, volMul){
  try{
    ensureSfxGain();
    const vm = volMul==null?1:volMul;
    const t0 = audioCtx.currentTime;
    if (name === 'launch'){ // "깡" - 짧고 단단한 타격음
      const osc = audioCtx.createOscillator(); osc.type='triangle';
      osc.frequency.setValueAtTime(900,t0); osc.frequency.exponentialRampToValueAtTime(220,t0+0.09);
      const g = audioCtx.createGain(); g.gain.setValueAtTime(0.6*vm,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.11);
      osc.connect(g); g.connect(sfxGain); osc.start(t0); osc.stop(t0+0.12);
      const noise = audioCtx.createBufferSource(); noise.buffer = getNoiseBuffer();
      const nf = audioCtx.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=2000;
      const ng = audioCtx.createGain(); ng.gain.setValueAtTime(0.35*vm,t0); ng.gain.exponentialRampToValueAtTime(0.001,t0+0.05);
      noise.connect(nf); nf.connect(ng); ng.connect(sfxGain); noise.start(t0); noise.stop(t0+0.06);
    }
    else if (name === 'coin'){ // "짤랑" - 밝은 벨 소리
      [1200,1600].forEach((f,i)=>{
        const osc = audioCtx.createOscillator(); osc.type='sine'; osc.frequency.value=f;
        const g = audioCtx.createGain(); const st=t0+i*0.05;
        g.gain.setValueAtTime(0,st); g.gain.linearRampToValueAtTime(0.35*vm,st+0.01); g.gain.exponentialRampToValueAtTime(0.001,st+0.22);
        osc.connect(g); g.connect(sfxGain); osc.start(st); osc.stop(st+0.24);
      });
    }
    else if (name === 'cake'){ // "와구와구" - 빠른 씹는 소리 연속
      for (let i=0;i<4;i++){
        const st = t0 + i*0.09;
        const noise = audioCtx.createBufferSource(); noise.buffer = getNoiseBuffer();
        const bf = audioCtx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=500+Math.random()*300; bf.Q.value=1.2;
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.3*vm,st); g.gain.exponentialRampToValueAtTime(0.001,st+0.07);
        noise.connect(bf); bf.connect(g); g.connect(sfxGain); noise.start(st); noise.stop(st+0.08);
      }
    }
    else if (name === 'mango'){ // "퉤" - 짧은 하강 버즈
      const osc = audioCtx.createOscillator(); osc.type='sawtooth';
      osc.frequency.setValueAtTime(300,t0); osc.frequency.exponentialRampToValueAtTime(90,t0+0.18);
      const g = audioCtx.createGain(); g.gain.setValueAtTime(0.28*vm,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.2);
      osc.connect(g); g.connect(sfxGain); osc.start(t0); osc.stop(t0+0.21);
    }
    else if (name === 'slamImpact'){ // "쾅" - 묵직한 저음 충격
      const osc = audioCtx.createOscillator(); osc.type='sine';
      osc.frequency.setValueAtTime(150,t0); osc.frequency.exponentialRampToValueAtTime(35,t0+0.22);
      const g = audioCtx.createGain(); g.gain.setValueAtTime(0.7*vm,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.28);
      osc.connect(g); g.connect(sfxGain); osc.start(t0); osc.stop(t0+0.3);
      const noise = audioCtx.createBufferSource(); noise.buffer = getNoiseBuffer();
      const nf = audioCtx.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=800;
      const ng = audioCtx.createGain(); ng.gain.setValueAtTime(0.4*vm,t0); ng.gain.exponentialRampToValueAtTime(0.001,t0+0.15);
      noise.connect(nf); nf.connect(ng); ng.connect(sfxGain); noise.start(t0); noise.stop(t0+0.16);
    }
  } catch(e){ /* 오디오 실패 시 무시 (게임 진행에 영향 없음) */ }
}

// 슬램 낙하 중 지속되는 "슈우우웅" 사운드 (시작/정지 제어 필요)
let slamWhooshNodes = null;
function startSlamWhoosh(){
  try{
    ensureSfxGain();
    stopSlamWhoosh();
    const t0 = audioCtx.currentTime;
    const noise = audioCtx.createBufferSource(); noise.buffer = getNoiseBuffer(); noise.loop = true;
    const bf = audioCtx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.setValueAtTime(1800,t0); bf.Q.value=0.8;
    bf.frequency.exponentialRampToValueAtTime(500,t0+0.8);
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(0.22,t0+0.06);
    noise.connect(bf); bf.connect(g); g.connect(sfxGain); noise.start(t0);
    slamWhooshNodes = {noise, filter:bf, gain:g};
  } catch(e){}
}
function stopSlamWhoosh(){
  if (!slamWhooshNodes) return;
  try{
    const t0 = audioCtx.currentTime;
    slamWhooshNodes.gain.gain.setValueAtTime(slamWhooshNodes.gain.gain.value, t0);
    slamWhooshNodes.gain.gain.linearRampToValueAtTime(0, t0+0.05);
    slamWhooshNodes.noise.stop(t0+0.06);
  } catch(e){}
  slamWhooshNodes = null;
}

document.getElementById('bgmVolume').addEventListener('input', (e)=>{
  bgmVolume = e.target.value/100;
  if (bgmVolume>0 && bgmMuted){ bgmMuted=false; document.getElementById('bgmMuteBtn').textContent='🔊 켜짐'; }
  applyBgmVolume();
});
document.getElementById('bgmMuteBtn').addEventListener('click', ()=>{
  bgmMuted = !bgmMuted;
  document.getElementById('bgmMuteBtn').textContent = bgmMuted ? '🔇 꺼짐' : '🔊 켜짐';
  applyBgmVolume();
});

function showResult(){
  document.getElementById('rankText').textContent = rankFor(maxDistanceThisRun);
  document.getElementById('finalDist').textContent = Math.floor(maxDistanceThisRun*DISPLAY_SCALE);
  document.getElementById('coinsGained').textContent = coinsThisRun;
  document.getElementById('bestDist').textContent = Math.floor(bestDistance*DISPLAY_SCALE)+" m";
  document.getElementById('slamCount').textContent = slamCount;
  resultOverlay.classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', ()=>{
  startOverlay.classList.add('hidden');
  resetRun();
  startBGM();
});
document.getElementById('retryBtn').addEventListener('click', ()=>{
  resultOverlay.classList.add('hidden');
  resetRun();
});
document.getElementById('shopBtnStart').addEventListener('click', ()=> openShop(startOverlay));
document.getElementById('shopBtnResult').addEventListener('click', ()=> openShop(resultOverlay));
document.getElementById('closeShopBtn').addEventListener('click', closeShop);

let shopReturnEl = null;
function openShop(returnEl){
  shopReturnEl = returnEl;
  returnEl.classList.add('hidden');
  renderShop();
  shopOverlay.classList.remove('hidden');
}
function closeShop(){
  shopOverlay.classList.add('hidden');
  if (shopReturnEl) shopReturnEl.classList.remove('hidden');
}

// ---------- 설정 ----------
let paused = false;
let settingsReturnEl = null; // 설정을 열기 전 보이고 있던 오버레이 (없으면 게임 플레이 중)
function openSettings(){
  settingsReturnEl = [startOverlay, resultOverlay, shopOverlay].find(el => !el.classList.contains('hidden')) || null;
  if (settingsReturnEl) settingsReturnEl.classList.add('hidden');
  else paused = true; // 플레이 중이었다면 설정 여는 동안 잠시 정지
  settingsOverlay.classList.remove('hidden');
}
function closeSettings(){
  settingsOverlay.classList.add('hidden');
  if (settingsReturnEl) settingsReturnEl.classList.remove('hidden');
  paused = false;
}
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
document.getElementById('settingsRetryBtn').addEventListener('click', ()=>{
  settingsOverlay.classList.add('hidden');
  [startOverlay, resultOverlay, shopOverlay].forEach(el=>el.classList.add('hidden'));
  paused = false;
  resetRun();
});
document.getElementById('settingsMenuBtn').addEventListener('click', ()=>{
  settingsOverlay.classList.add('hidden');
  [resultOverlay, shopOverlay].forEach(el=>el.classList.add('hidden'));
  paused = false;
  resetRun();
  startOverlay.classList.remove('hidden');
});

function renderShop(){
  document.getElementById('bankAmt').textContent = bank;
  const list = document.getElementById('upgradeList');
  list.innerHTML = "";
  for (const key in upgrades){
    const u = upgrades[key];
    const cost = upgradeCost(u);
    const maxed = u.level >= u.max;
    const card = document.createElement('div');
    card.className = "upgrade-card";
    card.innerHTML = `
      <div class="info">
        <div class="name">${u.name}</div>
        <div class="desc">${u.desc}</div>
        <div class="lvl">Lv. ${u.level} / ${u.max}</div>
      </div>
      <button ${maxed || bank<cost ? "disabled":""}>${maxed?"MAX":cost+" 🪙"}</button>
    `;
    card.querySelector('button').addEventListener('click', ()=>{
      if (u.level>=u.max || bank<cost) return;
      bank -= cost; u.level++;
      renderShop();
    });
    list.appendChild(card);
  }
}

