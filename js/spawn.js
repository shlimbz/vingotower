// ===== spawn.js =====
// ---------- 스폰 ----------
function spawnItemsUpTo(targetX){
  while (nextItemSpawnX < targetX){
    // 초반엔 케이크 위주(쉬움) → 갈수록 케이크는 줄고 망고가 늘어나는 완만한 곡선 (구간이 아니라 연속적으로 변화)
    // 코인/별은 항상 희귀하게 유지 (코인은 업그레이드 자원이라 쉽게 안 줌)
    const px = nextItemSpawnX;
    const dispX = px * DISPLAY_SCALE; // 표시 기준 거리(m)로 환산해서 진행도 계산
    const t = Math.min(1, dispX / 1200); // 0(초반) → 1(약 1200m 표시 기준부터는 고정)

    const cakeWeight = 32 - 22*t;   // 초반 32 → 후반 10
    const mangoWeight = 5 + 17*t;   // 초반 5  → 후반 22
    const coinWeight = 8;
    const starWeight = 3;
    const spacingMin = 28 + 40*t;
    const spacingMax = 45 + 55*t;

    const type = pick([["coin",coinWeight],["cake",cakeWeight],["mango",mangoWeight],["star",starWeight]]);
    // 지표면 위주로 낮게 배치 (가끔만 살짝 높은 곳)
    const hh = Math.random() < 0.8 ? rand(1.5, 10) : rand(10, 26);
    const cakeKey = type==="cake" ? CAKE_KEYS[Math.floor(Math.random()*CAKE_KEYS.length)] : null;
    items.push({ x: nextItemSpawnX + rand(-3,3), h: hh, type, taken:false, cakeKey });
    nextItemSpawnX += rand(spacingMin, spacingMax);
  }
  spawnSkyArcsUpTo(targetX);
}

// 하늘에 올라가는/내려가는 포물선 형태로 아이템을 배치해서 연속으로 먹기 좋게 함
function spawnSkyArcsUpTo(targetX){
  while (nextArcSpawnX < targetX){
    if (Math.random() < 0.55){
      const ascending = Math.random() < 0.5;
      const n = 5 + Math.floor(Math.random()*3); // 5~7개
      const dx = rand(9, 13);
      const baseH = rand(20, 45);
      const peakDelta = rand(35, 65);
      const arcType = pick([["cake",55],["star",12],["mango",18],["coin",15]]);
      for (let i=0;i<n;i++){
        const tt = i/(n-1);
        const ease = tt*tt; // 부드러운 곡선(가속) 형태
        const hh = ascending ? baseH + peakDelta*ease : baseH + peakDelta*(1-ease);
        const type = arcType;
        const cakeKey = type==="cake" ? CAKE_KEYS[Math.floor(Math.random()*CAKE_KEYS.length)] : null;
        items.push({ x: nextArcSpawnX + i*dx, h: hh, type, taken:false, cakeKey });
      }
      nextArcSpawnX += n*dx + rand(60,110);
    } else {
      nextArcSpawnX += rand(120,200);
    }
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
    clouds.push({ x: nextCloudSpawnX + rand(-8,8), h: rand(210,390), w: rand(24,36), key: CLOUD_KEYS[Math.floor(Math.random()*CLOUD_KEYS.length)], hit:false });
    nextCloudSpawnX += rand(55,100);
  }
  // 블랙홀 (우주, 320~480): 뜨문뜨문 희귀하게 배치, 닿으면 게임오버
  while (nextBlackholeSpawnX < targetX){
    blackholes.push({ x: nextBlackholeSpawnX + rand(-15,15), h: rand(620,900), r: rand(11,15) });
    nextBlackholeSpawnX += rand(320,520);
  }
}

// 메테오 (성층권에만 존재): 캐릭터를 추적하지 않고, 그냥 대각선으로 떨어지는 고정 궤적
function maybeSpawnMeteor(dt){
  if (meteors.length > 0) return;
  if (h < 400 || h >= 600) return;
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

