// ===== physics.js =====
// ---------- 발사 ----------
function resetRun(){
  x=0; h=0; vx=0; vy=0;
  camX=0; camY=0; zoom=1;
  angleDeg=45; angleDir=1; power=0; powerDir=1;
  slamGauge=100; slamCount=0; isSlamming=false; slamCharges=slamChargeCap();
  coinsThisRun=0; maxDistanceThisRun=0;
  items=[]; padZones=[]; nextItemSpawnX=20; nextArcSpawnX=150; nextPadSpawnX=60;
  blackholes=[]; clouds=[]; meteors=[]; nextCloudSpawnX=320; nextBlackholeSpawnX=500;
  forcedFall=false; gameOverSpinning=false; gameOverSpinTimer=0; prevH=0;
  reviveUsedThisRun=false; reviveAvailableThisRun = upgrades.revive.level>=1;
  spinTimer=0; spinAngle=0; starTimer=0;
  state = STATE.AIM;
}

const POWER_SWEET_CENTER = 50, POWER_SWEET_HALF = 6, POWER_MIN_EFFECTIVE = 30;
function effectivePower(pos){
  const dist = Math.abs(pos - POWER_SWEET_CENTER);
  if (dist <= POWER_SWEET_HALF) return 100;
  const t = Math.min(1, (dist-POWER_SWEET_HALF)/(POWER_SWEET_CENTER-POWER_SWEET_HALF));
  return 100 - t*(100-POWER_MIN_EFFECTIVE);
}

function launch(){
  const basePower = 96 + upgrades.power.level*7;
  const p = 0.55 + (effectivePower(power)/100)*0.5; // 게이지 중앙 좁은 구간을 맞춰야 풀파워 (언더테일 스타일)
  const speed = basePower * p;
  const rad = angleDeg * Math.PI/180;
  vx = Math.cos(rad)*speed;
  vy = Math.sin(rad)*speed;
  facing = 1;
  state = STATE.FLY;

  // 발사 연출: 화면 흔들림 + 먼지 폭발 + 스피드라인
  launchFxTimer = 0.45;
  screenShake(9, 0.28);
  spawnParticles(x, h, 22, { color:"#ffffff", minSpd:14, maxSpd:34, minLife:.3, maxLife:.6, upBias:4, minSize:2, maxSize:5 });
  spawnRing(x, h, "rgba(255,255,255,.8)");
  playSfx('launch');
  punchTimer = PUNCH_AFTER_DUR;
}

// ---------- 슬램 (게이지가 100% 가득 찼을 때만 사용 가능) ----------
function trySlam(){
  if (state !== STATE.FLY) return;
  if (forcedFall){ showToast("메테오에 맞아 슬램 불가!"); return; }
  if (slamCharges < 1){ showToast("게이지 충전 중..."); return; }
  slamCharges--;
  slamGauge = 0; // 충전을 소모했으니 게이지도 다시 0부터 채워야 함 (이게 빠져있어서 다음 프레임에 바로 재충전되는 버그가 있었음)
  slamCount++;
  isSlamming = true;
  // 순수 수직 강하: 수평 속도(vx)는 절대 건드리지 않고, 수직 속도만 수평 속도보다 확실히 커지도록 만들어
  // 항상 가파르게(거의 수직으로) 내려찍히도록 함
  vy = -Math.max(70, Math.abs(vy)*1.6 + 40, Math.abs(vx)*1.8);
  screenShake(4, 0.15);
  spawnParticles(x, h, 8, { color:"#ffd23f", minSpd:4, maxSpd:12, minLife:.2, maxLife:.4, minSize:1.5, maxSize:3 });
  startSlamWhoosh();
}

// ---------- 아이템 효과 ----------
const CAKE_SPEED_BOOST = 16;  // 케이크: 수평 속도에 고정 수치 추가
const MANGO_SPEED_PENALTY = 14; // 망고: 수평 속도에서 고정 수치 차감

function applyItemEffect(type){
  if (type === "coin"){ coinsThisRun++; showToast("+코인"); playSfx('coin'); }
  else if (type === "cake"){ vx += CAKE_SPEED_BOOST; vy += 5; showToast("케이크! 속도 +"+CAKE_SPEED_BOOST); playSfx('cake'); }
  else if (type === "mango"){
    if (starTimer > 0){ showToast("무적! 망고 무효"); }
    else { vx = Math.max(2, vx - MANGO_SPEED_PENALTY); spinTimer = 0.9; showToast("망고... 속도 -"+MANGO_SPEED_PENALTY); playSfx('mango'); }
  }
  else if (type === "star"){
    starTimer = 5;
    // 속도 게이지 기준 100에 해당하는 속도로 즉시 맞추고 45도로 재발사
    const rad = 45*Math.PI/180;
    const targetSpeed = BASE_MAX_SPEED;
    vx = Math.cos(rad)*targetSpeed;
    vy = Math.abs(Math.sin(rad)*targetSpeed);
    if (state !== STATE.FLY) state = STATE.FLY;
    isSlamming = false;
    stopSlamWhoosh();
    showToast("★ 무적 & 45도로 재발사!");
    for (const it of items){
      if (!it.taken && Math.abs(it.x - x) < 30) { it.taken = true; coinsThisRun++; }
    }
  }
}

const ITEM_FX_COLOR = { coin:"#ffd23f", cake:"#ff9ec4", mango:"#8a6b2f", star:"#fff2a0" };
function checkItemCollisions(){
  for (const it of items){
    if (it.taken) continue;
    if (Math.abs(it.x - x) < 4 && Math.abs(it.h - h) < 9){
      it.taken = true;
      applyItemEffect(it.type);
      spawnParticles(it.x, it.h, it.type==="star"?24:10, {
        color: ITEM_FX_COLOR[it.type], minSpd:5, maxSpd: it.type==="star"?26:14,
        minLife:.25, maxLife:.5, minSize:1.5, maxSize:3.5
      });
    }
  }
}

function checkPadCollision(){
  const PAD_MARGIN = 2.5; // 이미지 끝부분에 닿아도 인식되도록 여유를 둠
  for (const p of padZones){
    if (x >= p.x1-PAD_MARGIN && x <= p.x2+PAD_MARGIN && !p._hit){
      p._hit = true;
      if (p.type === "boost"){ vx = vx*2.1 + 8; showToast("가속 발판!! +"); screenShake(10,0.22); spawnParticles(x,0,22,{color:"#ff8a4a",minSpd:12,maxSpd:34,minLife:.3,maxLife:.6,dirBias:true}); }
      else if (p.type === "sticky"){ vx *= 0.3; showToast("접착 발판... 속도 급감"); screenShake(4,0.15); spawnParticles(x,0,14,{color:"#6b4a2f",minSpd:2,maxSpd:8,minLife:.3,maxLife:.5}); }
      else if (p.type === "jump"){ vy = Math.max(vy, 42); h = Math.max(h,0.1); state = STATE.FLY; showToast("점프대!! 발사!"); screenShake(10,0.22); spawnParticles(x,0,22,{color:"#4ad0ff",minSpd:10,maxSpd:30,minLife:.3,maxLife:.6,upBias:12}); }
    }
    if (x > p.x2 + 40) p._hit = false; // allow re-trigger far later if looped (not used but safe)
  }
}

// ---------- 구름 (슬램으로 위에서 찍으면 가속 발판) ----------
const CLOUD_SLAM_BOOST = 22;
function checkCloudSlam(){
  if (!isSlamming) return;
  for (const c of clouds){
    const visualHalfW = c.w * 0.45; // drawClouds의 픽셀 폭(targetW = c.w*PX_PER_M*0.9)을 다시 미터로 환산한 절반 폭
    if (Math.abs(x - c.x) > visualHalfW) continue;
    // 위에서 아래로 구름의 높이를 이번 프레임에 통과했는지 확인
    if (prevH > c.h && h <= c.h){
      vx += CLOUD_SLAM_BOOST;
      vy = Math.abs(vy) * 0.65; // 구름에서 튕겨오르며 슬램 종료 (간이 발판)
      isSlamming = false;
      stopSlamWhoosh();
      showToast("구름 발판! 가속 +"+CLOUD_SLAM_BOOST);
      screenShake(8, 0.18);
      spawnParticles(c.x, c.h, 16, { color:"#ffffff", minSpd:8, maxSpd:22, minLife:.3, maxLife:.6, upBias:3, minSize:3, maxSize:6 });
      spawnRing(c.x, c.h, "rgba(255,255,255,.8)");
      break;
    }
  }
}

// ---------- 블랙홀 (우주: 닿으면 게임오버) ----------
let deathBlackhole = null;
function checkBlackholeCollision(){
  if (starTimer > 0) return false; // 무적 상태에서는 블랙홀 면역
  for (const bh of blackholes){
    const dx = x - bh.x, dh = h - bh.h;
    const visualR = bh.r * 1.15; // drawBlackholes의 픽셀 지름(targetW = bh.r*PX_PER_M*2.3)을 다시 미터 반지름으로 환산
    if (Math.hypot(dx,dh) < visualR){
      triggerBlackholeGameOver(bh);
      return true;
    }
  }
  return false;
}
function triggerBlackholeGameOver(bh){
  gameOverSpinning = true;
  gameOverSpinTimer = 0;
  deathBlackhole = bh;
  screenShake(10, 0.6);
  showToast("블랙홀에 빨려들어간다...");
}
function updateGameOverSpin(dt){
  gameOverSpinTimer += dt;
  const SPIN_DUR = 0.7;
  const t = Math.min(1, gameOverSpinTimer/SPIN_DUR);
  if (deathBlackhole){
    x += (deathBlackhole.x - x) * Math.min(1, 6*dt);
    h += (deathBlackhole.h - h) * Math.min(1, 6*dt);
  }
  spinAngle += dt * (10 + t*40); // 점점 빠르게 회전
  spawnParticles(x, h, 2, { color:"#8a5cff", minSpd:4, maxSpd:14, minLife:.2, maxLife:.4, minSize:1.5, maxSize:3 });
  if (gameOverSpinTimer >= SPIN_DUR){
    gameOverSpinning = false;
    if (reviveAvailableThisRun && !reviveUsedThisRun){
      reviveUsedThisRun = true;
      vx = 34; vy = 26; h = Math.max(h, 6);
      state = STATE.FLY;
      isSlamming = false; forcedFall = false;
      stopSlamWhoosh();
      spinAngle = 0;
      showToast("부활! 다시 날아갑니다");
      screenShake(10, 0.25);
    } else {
      finishRun();
    }
  }
}

// ---------- 메테오 (성층권: 맞으면 강제 낙하) ----------
function updateMeteors(dt){
  for (const m of meteors){
    m.life += dt;
    m.x += m.vx*dt;
    m.h += m.vh*dt;
    const dx = x - m.x, dh = h - m.h;
    const dist = Math.hypot(dx,dh);
    if (dist < 5.5 && !forcedFall && starTimer <= 0){
      forcedFall = true;
      isSlamming = false;
      stopSlamWhoosh();
      const curSpeed = Math.hypot(vx,vy);
      vx = Math.sign(vx||1) * Math.max(Math.abs(vx), 95);
      vy = -Math.max(20, curSpeed*0.3);
      showToast("메테오 적중! 강제 낙하");
      screenShake(14, 0.3);
      spawnParticles(x, h, 24, { color:"#ff6a2f", minSpd:10, maxSpd:30, minLife:.3, maxLife:.6, minSize:2.5, maxSize:5 });
      m.dead = true;
    }
  }
  meteors = meteors.filter(m => !m.dead && m.life < 6);
}

// ---------- 메인 물리 업데이트 ----------
function updateFx(dt){
  if (shakeTimer>0){ shakeTimer -= dt; if (shakeTimer<0){shakeTimer=0; shakeMag=0;} }
  for (const p of particles){ p.life += dt; p.x += p.vx*dt; p.h += p.vh*dt; p.vh -= GRAVITY*0.6*dt; }
  particles = particles.filter(p=>p.life < p.maxLife);
  for (const r of ringFx){ r.life += dt; }
  ringFx = ringFx.filter(r=>r.life < r.maxLife);
}

function update(dt){
  if (paused) return;
  if (toastTimer>0) toastTimer -= dt;
  if (spinTimer>0){
    spinTimer -= dt;
    const spinSpeed = 22 * Math.min(1, spinTimer/0.3); // 끝날 때 서서히 느려지며 자연스럽게 멈춤
    spinAngle += spinSpeed*dt;
  }
  if (starTimer>0){
    starTimer -= dt;
    rainbowHue = (rainbowHue + dt*480) % 360;
    spawnParticles(x, h, 1, { color: `hsl(${rainbowHue},100%,62%)`, minSpd:1, maxSpd:3, minLife:.35, maxLife:.55, minSize:3.5, maxSize:6 });
  }
  if (launchFxTimer>0) launchFxTimer -= dt;
  if (punchTimer>0) punchTimer -= dt;
  updateFx(dt);

  // 카메라는 캐릭터를 부드럽게 따라감 (황소키우기 스타일)
  const camLerp = Math.min(1, CAM_FOLLOW*dt);
  camX += (x - camX) * camLerp;

  const baseGroundYNow = H*GROUND_Y_RATIO;

  // 캐릭터의 "목표 화면 위치"를 고도에 따라 하나의 연속된 곡선으로 직접 제어함
  // (예전의 camY 상한 캡 방식은 h가 계속 커지면 캐릭터가 화면 밖으로 나가버리는 버그가 있었음 - 이 방식은 항상 화면 안의 정해진 범위에만 위치하도록 보장함)
  const TRANSITION_H = 130; // 이 고도까지 서서히 "지상 뷰"에서 "상공 뷰"로 전환
  const tRaw = Math.max(0, Math.min(1, h/TRANSITION_H));
  const easeT = tRaw*tRaw*(3-2*tRaw); // smoothstep
  const FAR_CHAR_Y_RATIO = 0.40; // 상공에서는 화면 정중앙보다 살짝 위
  const FAR_ZOOM = 0.8;
  const charYRatio = GROUND_Y_RATIO + (FAR_CHAR_Y_RATIO - GROUND_Y_RATIO) * easeT;
  const baseTargetZoom = 1 + (FAR_ZOOM - 1) * easeT;
  const targetZoom = isSlamming ? Math.min(1.15, baseTargetZoom + 0.3) : baseTargetZoom;
  zoom += (targetZoom - zoom) * Math.min(1, 3.2*dt);

  const desiredCharScreenY = H * charYRatio;
  const camYTarget = h - (baseGroundYNow - desiredCharScreenY) / (PX_PER_M * Math.max(zoom, 0.3));
  camY += (camYTarget - camY) * camLerp;

  if (hitStopTimer>0){ hitStopTimer -= dt; return; } // 타격 정지 프레임 - 물리는 잠시 멈춤

  if (gameOverSpinning){ updateGameOverSpin(dt); return; }

  if (state === STATE.AIM){
    angleDeg += angleDir * 110 * dt;
    if (angleDeg > 85){ angleDeg=85; angleDir=-1; }
    if (angleDeg < 5){ angleDeg=5; angleDir=1; }
  }
  else if (state === STATE.POWER){
    power += powerDir * 230 * dt;
    if (power > 100){ power=100; powerDir=-1; }
    if (power < 0){ power=0; powerDir=1; }
  }
  else if (state === STATE.FLY){
    prevH = h;
    const drag = 1 - Math.min(0.35, (0.02 - upgrades.drag.level*0.0015) * dt * 2);
    vy -= GRAVITY*dt;
    vx *= drag;
    if (forcedFall){ vy = Math.min(vy, -42); } // 메테오 효과: 무조건 빠르게 낙하
    x += vx*dt;
    h += vy*dt;
    if (!isSlamming) slamGauge = Math.min(100, slamGauge + (50 + upgrades.slam.level*10)*dt);
    if (slamGauge >= 100 && slamCharges < slamChargeCap()){ slamGauge = 0; slamCharges++; }

    spawnItemsUpTo(x + 220);
    spawnPadsUpTo(x + 220);
    spawnHazardsUpTo(x + 260);
    maybeSpawnMeteor(dt);
    checkItemCollisions();
    checkCloudSlam();
    updateMeteors(dt);
    if (checkBlackholeCollision()) return; // 블랙홀에 닿으면 이후 로직 스킵 (연출 시작됨)

    maxDistanceThisRun = Math.max(maxDistanceThisRun, x);

    if (h <= 0){
      const impactSpeed = Math.abs(vy);
      h = 0;
      forcedFall = false;
      if (isSlamming){
        isSlamming = false;
        stopSlamWhoosh();
        // 파워 슬램 착지: 강한 충격 이펙트 (위치 조절용 - 수평 속도 손실은 일반 착지와 동일)
        hitStop(0.06);
        screenShake(16, 0.32);
        spawnParticles(x, h, 34, { color:"#ff8a4a", minSpd:16, maxSpd:46, minLife:.35, maxLife:.75, upBias:6, minSize:3, maxSize:7 });
        spawnRing(x, h, "rgba(255,138,74,.9)");
        playSfx('slamImpact');
        vy = impactSpeed * 0.55;
        vx *= (0.88 + upgrades.weight.level*0.009); // 슬램 착지는 일반 착지보다 손실이 적음 (12%)
        if (vx < 3.5 || vy < 3){ state = STATE.GROUND; }
      } else {
        // 일반 착지: 통통 튀는 바운스 - 수직 속도는 확실히 줄지만 수평 속도는 많이 유지되어
        // 바운스를 거듭하며 점점 낮고 빠르게 튀다가 구르기로 이어진다 (황소날리기류 물리)
        const bigHit = impactSpeed > 10;
        screenShake(bigHit?7:3, bigHit?0.2:0.12);
        spawnParticles(x, h, bigHit?16:8, { color:"#d8c9a8", minSpd:6, maxSpd:bigHit?22:14, minLife:.3, maxLife:.6, upBias:2, minSize:2, maxSize:4.5 });
        if (bigHit) playSfx('slamImpact', 0.5);
        vy = impactSpeed * (0.48 + upgrades.weight.level*0.015);
        vx *= (0.82 + upgrades.weight.level*0.012); // 맨땅 착지마다 확실히 감속 (약 18% 손실)
        if (vy < 2.5 || vx < 3.5){ state = STATE.GROUND; vy = 0; }
      }
    }
  }
  else if (state === STATE.GROUND){
    // 구르기: 일정한 제동력(저속에서도 꾸준히 작동) + 속도에 비례하는 공기/마찰 저항을 함께 적용
    // 임계치 없이 전 구간에서 자연스럽게 감속되고, 낮은 속도에서도 늘어지지 않고 깔끔하게 멈춘다
    const constDecel = 2.0 - upgrades.weight.level*0.15;   // 항상 작동하는 기본 제동 (저속에서 특히 체감)
    const propDecay = 0.16 - upgrades.weight.level*0.013;  // 속도 비례 저항 (고속일 때 특히 체감)
    vx = Math.max(0, vx - constDecel*dt);
    vx *= Math.max(0, 1 - propDecay*dt);
    x += vx*dt;
    checkPadCollision();
    checkItemCollisions();
    // 미끄러지는 캐릭터 앞쪽으로 흰 먼지가 흩날림 (속도에 비례)
    if (vx > 0.8 && Math.random() < Math.min(0.9, vx*0.05)){
      spawnParticles(x + 3.5, 0.5, 1, { color:"rgba(255,255,255,.85)", minSpd:3, maxSpd:7, minLife:.25, maxLife:.45, upBias:1.5, minSize:2, maxSize:4 });
    }
    maxDistanceThisRun = Math.max(maxDistanceThisRun, x);
    if (vx < 1.2){ finishRun(); }
  }
}

function finishRun(){
  // 부활 업그레이드가 있고 아직 안 썼다면, 멈춘 자리에서 한 번 더 발사할 기회를 줌
  if (reviveAvailableThisRun && !reviveUsedThisRun){
    reviveUsedThisRun = true;
    vx = 0; vy = 0; h = 0;
    angleDeg = 45; angleDir = 1; power = 0; powerDir = 1;
    isSlamming = false; forcedFall = false;
    stopSlamWhoosh();
    state = STATE.AIM;
    showToast("부활! 여기서 다시 발사할 수 있어요");
    screenShake(6, 0.2);
    return;
  }
  state = STATE.STOPPED;
  bank += coinsThisRun;
  if (maxDistanceThisRun > bestDistance) bestDistance = maxDistanceThisRun;
  showResult();
}

// ---------- 랭크 (500m 단위) ----------
function rankFor(dist){
  // dist는 원시(raw) 물리 단위. DISPLAY_SCALE(0.25)만큼 표시 수치가 줄어드니,
  // 랭크 기준도 같은 비율로 올려서(=4배) 화면에 보이는 "m" 기준으로는 기존과 동일한 500/1000/... 이 되도록 함
  if (dist < 2000) return "C";
  if (dist < 4000) return "B";
  if (dist < 6000) return "A";
  if (dist < 8000) return "S";
  if (dist < 10000) return "SS";
  if (dist < 12000) return "SSS";
  return "LEGEND";
}

