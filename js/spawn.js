// ===== spawn.js =====
// ---------- 스폰 ----------
function spawnItemsUpTo(targetX){
  while (nextItemSpawnX < targetX){
    // 초반엔 케이크 위주(쉬움) → 갈수록 케이크는 줄고 망고가 늘어나는 완만한 곡선
    // 코인/별은 항상 희귀한 레어템으로 유지
    const px = nextItemSpawnX;
    const dispX = px * DISPLAY_SCALE; // 표시 기준 거리(m)로 환산해서 진행도 계산
    const t = Math.min(1, dispX / 1200); // 0(초반) → 1(약 1200m 표시 기준부터는 고정)

    const cakeWeight = 22 - 13*t;   // 초반 22 → 후반 9
    const mangoWeight = 5 + 15*t;   // 초반 5  → 후반 20
    const coinWeight = 4;           // 항상 레어
    const starWeight = 0.6;         // 항상 매우 레어
    const spacingMin = 26 + 30*t;
    const spacingMax = 42 + 46*t;

    const type = pick([["coin",coinWeight],["cake",cakeWeight],["mango",mangoWeight],["star",starWeight]]);
    // 지표면 위주로 낮게 배치 (가끔만 살짝 높은 곳)
    // 지표면 위주지만, 허공에도 적당히 배치 (고도가 높아질수록 확률이 줄어듬)
    const hRoll = Math.random();
    let hh;
    if (hRoll < 0.42) hh = rand(1.5, 12);
    else if (hRoll < 0.72) hh = rand(12, 40);
    else if (hRoll < 0.90) hh = rand(40, 90);
    else hh = rand(90, 160);
    const cakeKey = type==="cake" ? CAKE_KEYS[Math.floor(Math.random()*CAKE_KEYS.length)] : null;
    items.push({ x: nextItemSpawnX + rand(-3,3), h: hh, type, taken:false, cakeKey });
    nextItemSpawnX += rand(spacingMin, spacingMax);
  }
  spawnCoinTrailsUpTo(targetX);
}

// 코인을 그냥 흩뿌리지 않고, 아치형/일직선/지그재그 모양의 "코인 트레일"로 배치해서
// 먹는 재미(디자인적인 궤적)를 살림. 꽤 자주 등장해서 맵이 휑해 보이지 않도록 함
function spawnCoinTrailsUpTo(targetX){
  while (nextCoinTrailX < targetX){
    const pattern = pick([["arc",40],["line",30],["zigzag",30]]);
    const n = 4 + Math.floor(Math.random()*4); // 4~7개
    const dx = rand(7, 10);
    const baseH = rand(6, 70);
    if (pattern === "arc"){
      const up = Math.random() < 0.5;
      const peak = rand(20, 45);
      for (let i=0;i<n;i++){
        const tt = i/(n-1);
        const curve = Math.sin(tt*Math.PI); // 0→1→0 부드러운 아치
        const hh = baseH + (up ? curve*peak : -curve*peak*0.6);
        items.push({ x: nextCoinTrailX + i*dx, h: Math.max(1.5,hh), type:"coin", taken:false, cakeKey:null });
      }
    } else if (pattern === "line"){
      for (let i=0;i<n;i++){
        items.push({ x: nextCoinTrailX + i*dx, h: baseH, type:"coin", taken:false, cakeKey:null });
      }
    } else { // zigzag
      const amp = rand(12, 24);
      for (let i=0;i<n;i++){
        const hh = baseH + (i%2===0 ? amp : -amp*0.4);
        items.push({ x: nextCoinTrailX + i*dx, h: Math.max(1.5,hh), type:"coin", taken:false, cakeKey:null });
      }
    }
    nextCoinTrailX += n*dx + rand(50, 90);
  }
}

function spawnPadsUpTo(targetX){
  while (nextPadSpawnX < targetX){
    const type = pick([["boost",1],["sticky",1],["jump",1],["none",2]]);
    const len = rand(6,12);
    if (type !== "none") padZones.push({ x1: nextPadSpawnX, x2: nextPadSpawnX+len, type });
    nextPadSpawnX += rand(35,55);
  }
}

function spawnHazardsUpTo(targetX){
  // 구름 (상공, 100~195): 비교적 자주 배치, 슬램으로 찍으면 가속 발판 역할
  while (nextCloudSpawnX < targetX){
    clouds.push({ x: nextCloudSpawnX + rand(-8,8), h: rand(130,330), w: rand(24,36), key: CLOUD_KEYS[Math.floor(Math.random()*CLOUD_KEYS.length)], hit:false });
    nextCloudSpawnX += rand(28,55);
  }
  // 블랙홀 (우주, 320~480): 뜨문뜨문 희귀하게 배치, 닿으면 게임오버
  while (nextBlackholeSpawnX < targetX){
    blackholes.push({ x: nextBlackholeSpawnX + rand(-15,15), h: rand(620,900), r: rand(11,15) });
    nextBlackholeSpawnX += rand(320,520);
  }
  spawnHighAltItemsUpTo(targetX);
}

// 상공/성층권/우주에도 드물게 아이템을 배치 (땅 위가 아니라 구간 내 고도에 자유롭게, 위로 갈수록 더 희귀하고 간격도 넓게)
function spawnHighAltItemsUpTo(targetX){
  while (nextSkyItemX < targetX){
    const type = pick([["cake",35],["mango",30],["coin",25],["star",6]]);
    const cakeKey = type==="cake" ? CAKE_KEYS[Math.floor(Math.random()*CAKE_KEYS.length)] : null;
    items.push({ x: nextSkyItemX + rand(-10,10), h: rand(120,340), type, taken:false, cakeKey });
    nextSkyItemX += rand(80,140);
  }
  while (nextStratoItemX < targetX){
    const type = pick([["cake",30],["mango",30],["coin",30],["star",8]]);
    const cakeKey = type==="cake" ? CAKE_KEYS[Math.floor(Math.random()*CAKE_KEYS.length)] : null;
    items.push({ x: nextStratoItemX + rand(-15,15), h: rand(360,590), type, taken:false, cakeKey });
    nextStratoItemX += rand(160,260);
  }
  while (nextSpaceItemX < targetX){
    const type = pick([["cake",25],["mango",25],["coin",35],["star",12]]);
    const cakeKey = type==="cake" ? CAKE_KEYS[Math.floor(Math.random()*CAKE_KEYS.length)] : null;
    items.push({ x: nextSpaceItemX + rand(-20,20), h: rand(610,850), type, taken:false, cakeKey });
    nextSpaceItemX += rand(280,420);
  }
}

// 메테오 (성층권에만 존재): 캐릭터를 추적하지 않고, 그냥 대각선으로 떨어지는 고정 궤적
function maybeSpawnMeteor(dt){
  if (meteors.length > 0) return;
  if (h < 350 || h >= 600) return;
  if (forcedFall || gameOverSpinning) return;
  if (Math.random() < 0.06*dt){ // 성층권에 머무는 동안 아주 가끔 등장
    const side = Math.random()<0.5 ? 1 : -1;
    const speed = rand(38,55);
    const fallAngle = rand(0.9, 1.3); // 대각선 낙하 각도(라디안, 아래쪽 방향 기준)
    meteors.push({
      x: x + side*rand(50,80), h: h + rand(30,55), life: 0,
      vx: -side*Math.cos(fallAngle)*speed, // 캐릭터 쪽이 아니라 그냥 아래대각선으로 고정 이동
      vh: -Math.sin(fallAngle)*speed,
    });
  }
}

