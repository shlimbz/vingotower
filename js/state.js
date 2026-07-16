// ===== state.js =====
// ---------- 게임 상태 ----------
const STATE = { AIM:'AIM', POWER:'POWER', FLY:'FLY', GROUND:'GROUND', STOPPED:'STOPPED' };
let state = STATE.AIM;

let angleDeg = 45;
let angleDir = 1;
let power = 0;
let powerDir = 1;

let x = 0;      // 이동 거리 (m)
let h = 0;      // 고도 (m), 0 = 지면
let vx = 0, vy = 0;
let facing = 1;
let spinTimer = 0; // 망고 효과 지속시간
let spinAngle = 0;  // 망고 효과: 실제로 누적되는 회전각 (부드러운 스핀)

let slamGauge = 100;
let slamCount = 0;
let isSlamming = false;

let coinsThisRun = 0;
let maxDistanceThisRun = 0;

let items = []; // {x, h, type, taken}
let padZones = []; // {x1,x2,type} ground gimmicks
let nextItemSpawnX = 20;
let nextArcSpawnX = 150;
let nextPadSpawnX = 60;

// ---------- 고도별 기믹 ----------
let blackholes = []; // {x,h,r} 우주: 닿으면 게임오버
let clouds = [];     // {x,h,w,hit} 상공: 슬램으로 찍으면 가속
let meteors = [];    // {x,h,vx,vh,life} 성층권: 맞으면 강제 낙하
let nextCloudSpawnX = 320;
let nextBlackholeSpawnX = 500;
let nextSkyItemX = 250, nextStratoItemX = 450, nextSpaceItemX = 700;
let forcedFall = false;   // 메테오 효과: 슬램 불가, 땅에 닿을 때까지 강제 낙하
let gameOverSpinning = false; // 블랙홀에 빨려들어가는 연출 중
let gameOverSpinTimer = 0;
let prevH = 0; // 구름 슬램 통과 판정을 위한 직전 프레임 높이

let slamCharges = 1;
let reviveUsedThisRun = false;
let reviveAvailableThisRun = true;

let toastTimer = 0, toastText = "";
let starTimer = 0; // 무적 시간
let rainbowHue = 0; // 별 효과 중 무지개 잔상 색상

// ---------- 카메라 (캐릭터를 계속 따라감) ----------
let camX = 0, camY = 0;

let zoom = 1; // 고도가 높아질수록 줌아웃, 슬램 시 줌인

// ---------- 연출(이펙트) 상태 ----------
let particles = []; // {x,h,vx,vh,life,maxLife,color,size,kind}
let shakeTimer = 0, shakeMag = 0, shakeDur = 0.001;
let hitStopTimer = 0;
let launchFxTimer = 0;
let punchTimer = 0; // 발사 순간의 타격 모션(캐릭터에 붙어서 움직이는 구간) 지속시간
const PUNCH_AFTER_DUR = 0.16;
let punchLingerTimer = 0; // 타격 모션 이후에도 발사 지점에 그대로 남아있는 시간
let punchWorldX = 0; // 때리는 캐릭터가 고정되어 남는 월드 x좌표(발사 지점)
let trailHistory = []; // 비행 중 잔상 효과용 최근 위치 기록
let lastTrailX = 0, lastTrailH = 0;
let ringFx = []; // {x,h,life,maxLife,color}

function screenShake(mag, dur){
  if (mag >= shakeMag){ shakeMag = mag; shakeDur = dur; shakeTimer = dur; }
  else { shakeTimer = Math.max(shakeTimer, dur); }
}
function hitStop(dur){ hitStopTimer = Math.max(hitStopTimer, dur); }

function spawnParticles(wx, wh, count, opts){
  opts = opts || {};
  for (let i=0;i<count;i++){
    const ang = rand(0, Math.PI*2);
    const spd = rand(opts.minSpd||6, opts.maxSpd||22);
    particles.push({
      x: wx + rand(-1,1), h: wh + rand(0,1),
      vx: Math.cos(ang)*spd*(opts.dirBias?Math.abs(Math.cos(ang)):1),
      vh: Math.abs(Math.sin(ang))*spd*0.7 + (opts.upBias||0),
      life: 0, maxLife: rand(opts.minLife||0.3, opts.maxLife||0.7),
      color: opts.color || "#ffffff",
      size: rand(opts.minSize||2, opts.maxSize||5),
    });
  }
}
function spawnRing(wx, wh, color){
  ringFx.push({ x:wx, h:wh, life:0, maxLife:0.45, color: color||"#ffffff" });
}

const launchOriginXFrac = 0.28; // 캔버스 내 캐릭터의 대략적 고정 x 위치 비율

// ---------- 유틸 ----------
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(weights){
  const total = weights.reduce((s,w)=>s+w[1],0);
  let r = Math.random()*total;
  for (const [v,w] of weights){ if (r<w) return v; r-=w; }
  return weights[0][0];
}
function showToast(text){ toastText = text; toastTimer = 1.1; }

function zoneName(alt){
  if (alt < 110) return "지상";
  if (alt < 350) return "상공";
  if (alt < 600) return "성층권";
  return "우주";
}
function skyColors(alt){
  if (alt < 110) return [ "#bfe6c9", "#7ec8e3" ];
  if (alt < 350) return [ "#7ec8e3", "#3f7fc9" ];
  if (alt < 600) return [ "#2b3d8f", "#141a4a" ];
  return [ "#0a0a1f", "#000000" ];
}

