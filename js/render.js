// ===== render.js =====
// ---------- 렌더 ----------
// 각 스프라이트의 투명 여백(특히 캐릭터 발 아래쪽 여백) 비율 - 실측값 기반
// 이 값만큼 그려지는 위치를 아래로 보정해서 "이미지 바닥"이 아니라 "실제 캐릭터 발"이 지면에 닿도록 함
const SPRITE_BOTTOM_PAD = { ready: 0.024, fly: 0.238, slam: 0.267, stop: 0.143, slide: 0.16 };

function currentSpriteKey(){
  if (state === STATE.AIM || state === STATE.POWER) return 'ready';
  if (state === STATE.FLY) return isSlamming ? 'slam' : 'fly';
  if (state === STATE.GROUND) return vx < 10 ? 'slide' : 'fly';
  return 'stop';
}
function currentSprite(){
  return imgEls[currentSpriteKey()];
}

// 고도 구간 경계(200/400/600)에서 자연스럽게 배경 이미지를 크로스페이드
function zoneBlendInfo(alt){
  const BOUND = [200, 400, 600];
  const bandWidth = 70; // 경계 앞뒤로 이만큼(raw 단위)에 걸쳐 서서히 전환
  let idx = 0;
  for (let i=0;i<BOUND.length;i++){ if (alt >= BOUND[i]) idx = i+1; }
  idx = Math.min(idx, BG_ZONE_ORDER.length-1);
  let t = 0, nextIdx = idx;
  if (idx < BG_ZONE_ORDER.length-1){
    const boundary = BOUND[idx];
    const dist = boundary - alt; // 다음 경계까지 남은 거리
    if (dist < bandWidth){
      t = 1 - Math.max(0, dist)/bandWidth;
      nextIdx = idx+1;
    }
  }
  return { idx, nextIdx, t };
}

function drawCoverImage(img, alpha){
  if (!img || !img.complete || !img.naturalWidth) return;
  const scale = Math.max(W/img.naturalWidth, H/img.naturalHeight);
  const dw = img.naturalWidth*scale, dh = img.naturalHeight*scale;
  const dx = (W-dw)/2, dy = (H-dh)/2;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.globalAlpha = 1;
}

function drawZoneBackground(alt){
  const { idx, nextIdx, t } = zoneBlendInfo(alt);
  const curImg = bgEls[BG_ZONE_ORDER[idx]];
  if (curImg && curImg.complete && curImg.naturalWidth){
    drawCoverImage(curImg, 1);
  } else {
    // 이미지 로딩 전 대비 - 단색 배경으로 안전하게 대체
    const [c1,c2] = skyColors(alt);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,c2); g.addColorStop(1,c1);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
  }
  if (t > 0){
    const nextImg = bgEls[BG_ZONE_ORDER[nextIdx]];
    drawCoverImage(nextImg, t);
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);

  ctx.save();
  if (shakeTimer>0){
    const curMag = shakeMag * (shakeTimer / shakeDur);
    const dx = rand(-curMag, curMag), dy = rand(-curMag, curMag);
    ctx.translate(dx, dy);
  }

  // 배경 (고도 구간별 실제 이미지, 경계에서 자연스럽게 크로스페이드) - 줌과 무관하게 항상 화면 전체를 채움
  const alt = Math.max(0,h);
  drawZoneBackground(alt);

  // 가독성을 위한 은은한 대비 오버레이 (아이템/기믹이 배경 사진과 헷갈리지 않도록)
  const overlay = ctx.createLinearGradient(0,0,0,H);
  overlay.addColorStop(0, "rgba(5,8,20,0.16)");
  overlay.addColorStop(0.6, "rgba(5,8,20,0.10)");
  overlay.addColorStop(1, "rgba(5,8,20,0.28)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0,0,W,H);

  // 줌 (고도가 높을수록 줌아웃, 슬램 시 줌인) - 캐릭터의 고정 화면 위치를 기준으로 확대/축소
  ctx.save();
  const zoomAnchorX = W*launchOriginXFrac, zoomAnchorY = H*GROUND_Y_RATIO;
  ctx.translate(zoomAnchorX, zoomAnchorY);
  ctx.scale(zoom, zoom);
  ctx.translate(-zoomAnchorX, -zoomAnchorY);

  const baseGroundY = H*GROUND_Y_RATIO;
  const originX = W*launchOriginXFrac;

  function worldToScreenX(wx){ return originX + (wx - camX)*PX_PER_M; }
  function worldToScreenY(wh){ return baseGroundY - (wh - camY)*PX_PER_M; }
  const groundY = worldToScreenY(0); // 실제 지면

  // 지면 - 줌 아웃되어도 항상 화면 좌우/아래 끝까지 채워지도록 로컬 좌표를 역산해서 확장
  const localLeft = zoomAnchorX - zoomAnchorX/zoom;
  const localRight = zoomAnchorX + (W - zoomAnchorX)/zoom;
  const localBottom = zoomAnchorY + (H - zoomAnchorY)/zoom;
  ctx.fillStyle = alt < 8 ? "#8fce97" : "#6b9e78";
  ctx.fillRect(localLeft, groundY, localRight-localLeft, Math.max(localBottom, H) - groundY);

  // 실제 잔디 텍스처를 타일링해서 얹음 (잔디 중앙부가 groundY와 정확히 맞도록 정렬)
  // 월드 좌표(x=0)를 기준으로 타일을 앵커링해서 카메라가 움직일 때 같이 스크롤되도록 함
  // 원본이 이음새 없는(seamless) 텍스처가 아니라서, 한 칸씩 좌우 반전시켜 이어붙여 경계가 안 보이게 함
  const grassImg = assetEls.grass;
  if (grassImg && grassImg.complete && grassImg.naturalWidth){
    const textureH = 85;
    const ar = grassImg.naturalWidth/grassImg.naturalHeight;
    const tileW = textureH*ar;
    const topY = groundY - GRASS_LINE_FRAC*textureH;
    const worldZeroScreenX = worldToScreenX(0); // 월드 x=0 이 화면상 어디에 있는지
    let tileIndex = Math.floor((localLeft - worldZeroScreenX)/tileW) - 1;
    let tx = worldZeroScreenX + tileIndex*tileW;
    for (; tx < localRight; tx += tileW, tileIndex++){
      if (tileIndex % 2 !== 0){
        ctx.save();
        ctx.translate(tx+tileW/2, 0);
        ctx.scale(-1,1);
        ctx.drawImage(grassImg, -tileW/2, topY, tileW, textureH);
        ctx.restore();
      } else {
        ctx.drawImage(grassImg, tx, topY, tileW, textureH);
      }
    }
  }

  ctx.strokeStyle = "rgba(0,0,0,.15)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(localLeft,groundY); ctx.lineTo(localRight,groundY); ctx.stroke();

  // 거리 눈금
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.font = "10px sans-serif";
  for (let m = Math.floor((camX-40)/20)*20; m < camX+60; m+=20){
    const sx = worldToScreenX(m);
    if (sx<localLeft-20||sx>localRight+20) continue;
    ctx.fillRect(sx,groundY-4,1.5,8);
    if (m%100===0) ctx.fillText((m*DISPLAY_SCALE)+"m", sx-10, groundY+16);
  }

  // 발판(기믹)
  for (const p of padZones){
    const sx1 = worldToScreenX(p.x1), sx2 = worldToScreenX(p.x2);
    if (sx2 < localLeft-10 || sx1 > localRight+10) continue;
    const padW = sx2 - sx1;
    if (p.type === "boost" || p.type === "sticky"){
      const isBoost = p.type === "boost";
      ctx.fillStyle = isBoost ? "#ff8a4a" : "#6b4a2f";
      ctx.fillRect(sx1, groundY-7, padW, 7);
      // 화살표 패턴 (가속: >>>, 감속: <<<)
      ctx.strokeStyle = isBoost ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.55)";
      ctx.lineWidth = 2.5;
      const chevronW = 9, gap = 7, n = Math.max(1, Math.floor(padW/(chevronW+gap)));
      const startX = sx1 + (padW - n*(chevronW+gap) + gap)/2;
      for (let i=0;i<n;i++){
        const cx = startX + i*(chevronW+gap);
        const dir = isBoost ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx - dir*chevronW/2, groundY-11);
        ctx.lineTo(cx + dir*chevronW/2, groundY-3.5);
        ctx.lineTo(cx - dir*chevronW/2, groundY+4);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "#4ad0ff";
      ctx.fillRect(sx1, groundY-6, padW, 6);
    }
  }

  // 아이템
  for (const it of items){
    if (it.taken) continue;
    const sx = worldToScreenX(it.x), sy = worldToScreenY(it.h);
    if (sx<localLeft-20||sx>localRight+20) continue;
    drawItem(sx,sy,it);
  }

  // 고도별 기믹: 구름(상공) / 블랙홀(우주) / 메테오(성층권)
  drawClouds(worldToScreenX, worldToScreenY, localLeft, localRight);
  drawBlackholes(worldToScreenX, worldToScreenY, localLeft, localRight);
  drawMeteors(worldToScreenX, worldToScreenY);

  // 발사 스피드라인 (캐릭터 뒤)
  if (launchFxTimer>0){
    const t0 = launchFxTimer/0.45;
    const opx = worldToScreenX(x), opy = worldToScreenY(h);
    ctx.strokeStyle = `rgba(255,255,255,${0.7*t0})`;
    ctx.lineWidth = 3;
    for (let i=0;i<7;i++){
      const ang = (angleDeg*Math.PI/180) + rand(-0.5,0.5);
      const len = rand(20,60)*t0;
      ctx.beginPath();
      ctx.moveTo(opx - Math.cos(ang)*4, opy + Math.sin(ang)*4);
      ctx.lineTo(opx - Math.cos(ang)*len, opy + Math.sin(ang)*len);
      ctx.stroke();
    }
  }

  // 캐릭터
  const px = worldToScreenX(x), py = worldToScreenY(h);
  const spriteKey = currentSpriteKey();
  const img = imgEls[spriteKey];
  const sizeM = 11; // 캐릭터 표시 크기(미터 환산)
  const sizePx = sizeM*PX_PER_M;

  // 때리는 캐릭터: 조준/파워 단계에는 항상 준비 자세로 서 있다가, 발사 순간에만 타격 모션 재생
  const showPuncherIdle = (state===STATE.AIM || state===STATE.POWER);
  if (showPuncherIdle || punchTimer > 0){
    const punchImg = punchTimer > 0 ? assetEls.attackAfter : assetEls.attackReady;
    const pSize = sizePx * 1.05;
    // 준비 자세는 살짝 뒤로, 타격 순간엔 캐릭터에 바짝 붙임
    const offsetX = punchTimer > 0 ? -sizePx*0.42 : -sizePx*0.95;
    if (punchImg && punchImg.complete && punchImg.naturalWidth>0){
      ctx.save();
      ctx.translate(px + offsetX, py - sizePx*0.5);
      ctx.drawImage(punchImg, -pSize/2, -pSize/2, pSize, pSize);
      ctx.restore();
    }
  }
  // 스프라이트 원본 비율 유지 (정사각형이 아닌 이미지가 찌그러지지 않도록)
  let drawW = sizePx, drawH = sizePx;
  if (img.naturalWidth>0 && img.naturalHeight>0){
    const ar = img.naturalWidth/img.naturalHeight;
    if (ar > 1) drawH = sizePx/ar; else drawW = sizePx*ar;
  }
  const bottomPad = (SPRITE_BOTTOM_PAD[spriteKey]||0) * drawH; // 투명 여백만큼 아래로 보정 (실제 렌더 높이 기준)
  ctx.save();
  ctx.translate(px, py - drawH*0.5 + bottomPad);
  let rot = 0;
  if (state===STATE.FLY) rot = Math.atan2(-vy,vx)*0.35;
  if (spinTimer>0 || gameOverSpinning) rot += spinAngle;
  ctx.rotate(rot);
  if (starTimer>0){
    ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 20;
  }
  let stretchX = 1, stretchY = 1;
  if (isSlamming){ stretchX = 0.82; stretchY = 1.22; }
  if (gameOverSpinning){
    const shrink = Math.max(0.15, 1 - (gameOverSpinTimer/0.7));
    stretchX *= shrink; stretchY *= shrink;
  }
  ctx.scale(stretchX, stretchY);
  if (img.complete && img.naturalWidth>0){
    ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
  } else {
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(0,0,sizePx/2,0,7); ctx.fill();
  }
  ctx.restore();

  // 파티클 (먼지/충격 이펙트)
  for (const p of particles){
    const t = p.life / p.maxLife;
    const sx = worldToScreenX(p.x), sy = worldToScreenY(p.h);
    ctx.globalAlpha = Math.max(0, 1-t);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size*(1-t*0.5), 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 충격 링 이펙트
  for (const r of ringFx){
    const t = r.life / r.maxLife;
    const sx = worldToScreenX(r.x), sy = worldToScreenY(r.h);
    ctx.globalAlpha = Math.max(0, 1-t);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 4*(1-t);
    ctx.beginPath();
    ctx.arc(sx, sy, 10 + t*55, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // 줌 종료
  ctx.restore(); // 카메라 흔들림 종료

  // 조준 UI
  if (state===STATE.AIM){
    drawAimArc(px,py);
  } else if (state===STATE.POWER){
    drawPowerGauge(px,py);
  }

  // 토스트
  const toastEl = document.getElementById('toast');
  toastEl.style.opacity = toastTimer>0 ? Math.min(1,toastTimer*2) : 0;
  toastEl.textContent = toastText;

  // HUD 텍스트 업데이트
  document.getElementById('distanceReadout').innerHTML = Math.floor(Math.max(x,0)*DISPLAY_SCALE)+"<span> m</span>";
  document.getElementById('coinCount').textContent = coinsThisRun;
  document.getElementById('zoneLabel').textContent = zoneName(alt) + " · " + Math.floor(alt*DISPLAY_SCALE) + "m";
  document.getElementById('slamFill').style.height = slamGauge+"%";
  const capNow = slamChargeCap();
  const pipsEl = document.getElementById('slamCharges');
  if (pipsEl.childElementCount !== capNow){
    pipsEl.innerHTML = '';
    for (let i=0;i<capNow;i++){ const d=document.createElement('div'); d.className='pip'; pipsEl.appendChild(d); }
  }
  [...pipsEl.children].forEach((el,i)=> el.classList.toggle('filled', i < slamCharges));

  const speedPct = Math.round(Math.abs(vx)/BASE_MAX_SPEED*100);
  document.getElementById('speedNum').textContent = speedPct;
  document.getElementById('speedFill').style.width = Math.min(100, speedPct)+"%";

  // 액션 버튼 라벨
  const btn = document.getElementById('actionBtn');
  if (state===STATE.AIM) btn.textContent = "각도 고정";
  else if (state===STATE.POWER) btn.textContent = "발사!";
  else if (state===STATE.FLY) btn.textContent = "슬램!";
  else btn.textContent = "-";
  btn.style.opacity = (state===STATE.GROUND||state===STATE.STOPPED) ? 0.35 : 1;
}

function drawAimArc(px,py){
  const r = 70;
  ctx.strokeStyle="rgba(255,255,255,.35)";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(px,py,r, -Math.PI/2, 0); // 우측 상단 사분면 (0°=오른쪽, 90°=위)
  ctx.stroke();
  const rad = angleDeg*Math.PI/180;
  const ax = px + Math.cos(rad)*r;
  const ay = py - Math.sin(rad)*r;
  ctx.strokeStyle = "#ffd23f"; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(ax,ay); ctx.stroke();
  ctx.fillStyle="#ffd23f";
  ctx.beginPath(); ctx.arc(ax,ay,5,0,7); ctx.fill();
  ctx.fillStyle="#fff"; ctx.font="12px sans-serif";
  ctx.fillText(Math.round(angleDeg)+"°", ax+8, ay-4);
}

function drawPowerGauge(px,py){
  const gx = px+34, gy0 = py+20, gh=90, gw=14;
  ctx.fillStyle="rgba(255,255,255,.15)";
  ctx.fillRect(gx,gy0-gh,gw,gh);

  // 스위트 스팟 (중앙 좁은 구간) 강조
  const sweetTop = gy0 - gh*(POWER_SWEET_CENTER+POWER_SWEET_HALF)/100;
  const sweetH = gh*(POWER_SWEET_HALF*2)/100;
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(gx, sweetTop, gw, sweetH);

  ctx.strokeStyle="rgba(255,255,255,.5)"; ctx.strokeRect(gx,gy0-gh,gw,gh);

  // 움직이는 표시기
  const markerY = gy0 - gh*(power/100);
  ctx.fillStyle = "#ff6b4a";
  ctx.beginPath();
  ctx.moveTo(gx-6, markerY);
  ctx.lineTo(gx-1, markerY-5);
  ctx.lineTo(gx-1, markerY+5);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(gx-1, markerY-1.5, gw+2, 3);
}

function drawImageCentered(img, sx, sy, targetSize){
  if (!img || !img.complete || !img.naturalWidth) return false;
  const ar = img.naturalWidth / img.naturalHeight;
  let w = targetSize, h = targetSize;
  if (ar > 1) h = targetSize/ar; else w = targetSize*ar;
  ctx.drawImage(img, sx-w/2, sy-h/2, w, h);
  return true;
}

function drawItem(sx,sy,it){
  const type = it.type;
  ctx.save();
  ctx.translate(sx,sy);
  if (type==="coin"){
    ctx.fillStyle="#ffd23f"; ctx.strokeStyle="#c99a10"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,8,0,7); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#c99a10"; ctx.font="10px sans-serif"; ctx.textAlign="center";
    ctx.fillText("₩",0,3);
  } else if (type==="cake"){
    const img = assetEls[it.cakeKey || 'cake1'];
    if (!drawImageCentered(img, 0, 0, 22)){ ctx.font="18px sans-serif"; ctx.textAlign="center"; ctx.fillText("🍰",0,6); }
  } else if (type==="mango"){
    if (!drawImageCentered(assetEls.mango, 0, 0, 22)){ ctx.font="18px sans-serif"; ctx.textAlign="center"; ctx.fillText("🥭",0,6); }
  } else if (type==="star"){
    ctx.shadowColor="#ffd23f"; ctx.shadowBlur=14;
    ctx.font="20px sans-serif"; ctx.textAlign="center"; ctx.fillText("⭐",0,6);
  }
  ctx.restore();
}

// ---------- 고도별 기믹 렌더 ----------
function drawClouds(worldToScreenX, worldToScreenY, localLeft, localRight){
  for (const c of clouds){
    const sx = worldToScreenX(c.x), sy = worldToScreenY(c.h);
    if (sx < localLeft-40 || sx > localRight+40) continue;
    const targetW = c.w * PX_PER_M * 0.9;
    const img = assetEls[c.key];
    if (img && img.complete && img.naturalWidth){
      const ar = img.naturalWidth/img.naturalHeight;
      const w = targetW, hh = targetW/ar;
      // 배경 사진 속 구름과 헷갈리지 않도록 은은한 골드 글로우를 깔아줌 (상호작용 가능한 오브젝트임을 표시)
      const glow = ctx.createRadialGradient(sx,sy,0, sx,sy, w*0.65);
      glow.addColorStop(0, "rgba(255,224,140,0.4)");
      glow.addColorStop(1, "rgba(255,224,140,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx,sy,w*0.65,0,7); ctx.fill();
      ctx.drawImage(img, sx-w/2, sy-hh/2, w, hh);
    }
  }
}
function drawBlackholes(worldToScreenX, worldToScreenY, localLeft, localRight){
  for (const bh of blackholes){
    const sx = worldToScreenX(bh.x), sy = worldToScreenY(bh.h);
    if (sx < localLeft-60 || sx > localRight+60) continue;
    const targetW = bh.r * PX_PER_M * 2.3;
    const img = assetEls.blackhole;
    if (img && img.complete && img.naturalWidth){
      const ar = img.naturalWidth/img.naturalHeight;
      // 위험 경고용 붉은 글로우 (우주 배경의 성운/행성과 혼동되지 않도록)
      const glow = ctx.createRadialGradient(sx,sy,0, sx,sy, targetW*0.75);
      glow.addColorStop(0, "rgba(255,70,60,0.35)");
      glow.addColorStop(1, "rgba(255,70,60,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(sx,sy,targetW*0.75,0,7); ctx.fill();
      ctx.drawImage(img, sx-targetW/2, sy-(targetW/ar)/2, targetW, targetW/ar);
    }
  }
}
function drawMeteors(worldToScreenX, worldToScreenY){
  for (const m of meteors){
    const sx = worldToScreenX(m.x), sy = worldToScreenY(m.h);
    const img = assetEls.meteor;
    if (img && img.complete && img.naturalWidth){
      const targetW = 8 * PX_PER_M;
      const ar = img.naturalWidth/img.naturalHeight;
      ctx.save();
      ctx.translate(sx,sy);
      // 낙하 방향(자기 속도 벡터)을 향하도록 회전 - 캐릭터와 무관한 고정 궤적
      ctx.rotate(Math.atan2(-m.vh, m.vx) + Math.PI);
      ctx.drawImage(img, -targetW/2, -(targetW/ar)/2, targetW, targetW/ar);
      ctx.restore();
    }
  }
}

