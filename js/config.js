// ===== config.js =====

/* =========================================================
   날리기 — 2D 횡스크롤 발사 비행 게임 프로토타입
   ========================================================= */

// ---------- 캐릭터 스프라이트 (업로드된 참고 이미지 사용) ----------
const SPRITES = {
  slide: "assets/characters/slide.png",
  ready: "assets/characters/ready.png",   // 준비자세
  fly: "assets/characters/fly.png",      // 날아가는 도중 모션
  slam: "assets/characters/slam.png",     // 슬램사용시 모션
  stop: "assets/characters/stop.png",     // 최종 멈출때 모션
};
const imgEls = {};
for (const k in SPRITES){ const im = new Image(); im.src = SPRITES[k]; imgEls[k] = im; }

// ---------- 추가 에셋 (아이템/기믹/땅/펀치 애니메이션) ----------
const ASSETS = {
  cake1: "assets/items/cake1.png",
  cake2: "assets/items/cake2.png",
  cake3: "assets/items/cake3.png",
  cake4: "assets/items/cake4.png",
  cake5: "assets/items/cake5.png",
  cake6: "assets/items/cake6.png",
  cake7: "assets/items/cake7.png",
  cake8: "assets/items/cake8.png",
  cake9: "assets/items/cake9.png",
  mango: "assets/items/mango.png",
  cloud1: "assets/items/cloud1.png",
  cloud2: "assets/items/cloud2.png",
  cloud3: "assets/items/cloud3.png",
  blackhole: "assets/items/blackhole.png",
  meteor: "assets/items/meteor.png",
  grass: "assets/ground/grass.png",
  attackReady: "assets/ui/attack_ready.png",
  attackAfter: "assets/ui/attack_after.png",
};
const assetEls = {};
for (const k in ASSETS){ const im = new Image(); im.src = ASSETS[k]; assetEls[k] = im; }
const CAKE_KEYS = ['cake1','cake2','cake3','cake4','cake5','cake6','cake7','cake8','cake9'];
const CLOUD_KEYS = ['cloud1','cloud2','cloud3'];
// 잔디 텍스처 안에서 실제 "땅 라인"이 위치한 비율 (잔디 중앙부)
const GRASS_LINE_FRAC = 0.228; // 사용자가 제공한 히트라인(빨간 선) 기준 정확히 재측정한 값

// ---------- 고도 구간별 세로 배경 이미지 ----------
const BG_ASSETS = {
  ground: "assets/backgrounds/ground.jpg",
  sky: "assets/backgrounds/sky.jpg",
  strato: "assets/backgrounds/strato.jpg",
  space: "assets/backgrounds/space.jpg",
};
const bgEls = {};
for (const k in BG_ASSETS){ const im = new Image(); im.src = BG_ASSETS[k]; bgEls[k] = im; }
const BG_ZONE_ORDER = ['ground','sky','strato','space'];

// ---------- 캔버스 세팅 ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
function resize(){
  const stage = document.getElementById('stage');
  const r = stage.getBoundingClientRect();
  canvas.width = r.width * devicePixelRatio;
  canvas.height = r.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  W = r.width; H = r.height;
}
let W=360,H=640;
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { setTimeout(resize, 50); setTimeout(resize, 250); });

// ---------- 상수 ----------
const GROUND_Y_RATIO = 0.78; // 화면상 지면 위치 비율 (가로모드 - 하늘을 넓게)
const PX_PER_M = 5;          // 미터 -> 픽셀 스케일 (표시/카메라용)
const GRAVITY = 16;          // m/s^2 (올라갈 때 확실히 느려지고 떨어질 때 확실히 빨라지는 포물선을 위해 상향)
const CAM_FOLLOW = 5.5;      // 카메라가 캐릭터를 따라가는 속도(클수록 빠르게 붙음)
const DISPLAY_SCALE = 0.25;  // 표시 배율: 실제 물리(속도감)는 그대로 두고, 화면에 보이는 "m" 수치와 랭크 기준만 조정
const BASE_MAX_SPEED = 96 * 1.05; // 업그레이드 없는 기본 상태에서 최대 파워로 발사했을 때의 수평 속도 = 속도 게이지 100 기준

// ---------- 영구(세션) 상태 ----------
let bank = 0;
let bestDistance = 0;
const upgrades = {
  power:   { name:"발사 파워 증가",     desc:"발사 시 초기 속도가 증가합니다.", level:0, max:8, baseCost:20, costMul:1.35 },
  drag:    { name:"공기 저항 감소",     desc:"비행 중 속도가 덜 줄어듭니다.",   level:0, max:8, baseCost:20, costMul:1.35 },
  slam:    { name:"슬램 게이지 충전 속도", desc:"슬램 게이지가 더 빨리 차오릅니다.", level:0, max:6, baseCost:25, costMul:1.4 },
  weight:  { name:"무게 조절",         desc:"착지 시 감속이 줄어 더 멀리 굴러갑니다.", level:0, max:6, baseCost:25, costMul:1.4 },
  slamCombo: { name:"슬램 연속 사용", desc:"게이지가 다 차면, 다시 채우지 않고 슬램을 2연속 사용할 수 있습니다.", level:0, max:1, baseCost:80, costMul:1 },
  revive:  { name:"부활 1회",        desc:"블랙홀에 빨려들어가 게임오버 되어도, 그 자리에서 한 번 다시 날릴 수 있습니다.", level:0, max:1, baseCost:100, costMul:1 },
};

function slamChargeCap(){ return 1 + upgrades.slamCombo.level; }

function upgradeCost(u){ return Math.round(u.baseCost * Math.pow(u.costMul, u.level)); }
