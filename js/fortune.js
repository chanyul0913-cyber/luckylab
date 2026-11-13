// 로분소 2/5 — 사주·만세력·유명인 운세·별자리·점성술·양자·마르코프·딥러닝 가중치 계산
// 여러 파일이지만 순서대로 읽히는 한 덩어리 프로그램이다 (index.html의 <script> 순서를 바꾸지 말 것)
"use strict";
// ---------- 사주 ----------
// 사주 8글자는 lunar-javascript(6tail, MIT)로 계산. 번호 매핑은 하도(河圖) 오행 수리 + 부족 오행 보완 + 추첨일 일진.
const GAN = "甲乙丙丁戊己庚辛壬癸", GAN_K = "갑을병정무기경신임계", JI = "子丑寅卯辰巳午未申酉戌亥", JI_K = "자축인묘진사오미신유술해";
const GAN_OH = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const JI_OH = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"];
const OHS = ["목", "화", "토", "금", "수"];
const DIGIT_OH = ["토", "수", "화", "목", "금", "토", "수", "화", "목", "금"]; // 끝자리 1·6 수, 2·7 화, 3·8 목, 4·9 금, 5·0 토
const numOh = n => DIGIT_OH[n % 10];
const ohDigits = o => DIGIT_OH.map((x, d) => x === o ? d : -1).filter(d => d >= 0).join("·");
const drawDate = new Date(+LAST.ymd.slice(0, 4), +LAST.ymd.slice(4, 6) - 1, +LAST.ymd.slice(6) + NEXT_DAYS, 12);
const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
let saju = null;

function calcSaju(p) {
  if (!window.Solar || !window.Lunar) throw new Error("사주 계산 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.");
  const known = p.h !== "";
  if (!(p.y >= 1900 && p.y <= 2100)) throw new Error("1900년~2100년 사이만 계산할 수 있습니다.");
  let solar;
  try {
    solar = p.cal === "lunar"
      ? Lunar.fromYmdHms(p.y, p.leap ? -p.m : p.m, p.d, known ? +p.h : 12, known ? +p.mi : 0, 0).getSolar()
      : Solar.fromYmdHms(p.y, p.m, p.d, known ? +p.h : 12, known ? +p.mi : 0, 0);
  } catch { // 라이브러리의 영어 오류(wrong lunar year …) 대신 쉬운 안내
    throw new Error(p.cal === "lunar" && p.leap ? `${p.y}년에는 음력 ${p.m}월 윤달이 없습니다. '윤달' 체크를 확인하세요.` : "존재하지 않는 날짜입니다.");
  }
  const chk = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  if (chk.getMonth() !== solar.getMonth() - 1) throw new Error("존재하지 않는 날짜입니다.");
  if (p.cal === "solar" && (solar.getMonth() !== p.m || solar.getDay() !== p.d)) throw new Error("존재하지 않는 날짜입니다.");
  // 한국 표준시는 동경 135° 기준이고 서울은 약 127°라 실제 태양시가 약 30분 늦음 → 시주 경계(23:30, 01:30 …)에 맞춰 30분 보정
  if (known) solar = Solar.fromDate(new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute() - 30));
  const ec = solar.getLunar().getEightChar();
  const names = ["년주", "월주", "일주", "시주"];
  const raw = [ec.getYear(), ec.getMonth(), ec.getDay(), known ? ec.getTime() : null];
  const pillars = raw.map((s, i) => s && { name: names[i], gan: GAN.indexOf(s[0]), ji: JI.indexOf(s[1]), hanja: s });
  const cnt = Object.fromEntries(OHS.map(o => [o, 0]));
  pillars.forEach(x => { if (x) { cnt[GAN_OH[x.gan]]++; cnt[JI_OH[x.ji]]++; } });
  const { draw, ohW, w } = sajuWeightsAt(cnt, drawDate);
  const key = raw.join("") + drawDate.toDateString();
  return { name: p.name, pillars, cnt, draw, ohW, w, key, known, solar: solar.toYmd(), cal: p.cal };
}
// 내 사주 오행 개수 + 그 추첨일의 일진 → 번호 가중치 (백테스트에서도 과거 추첨일마다 사용)
const dayGZ = date => { const dz = Solar.fromDate(date).getLunar().getDayInGanZhi(); return { gan: GAN.indexOf(dz[0]), ji: JI.indexOf(dz[1]), hanja: dz }; };
function ohWeights(cnt, draw) {
  const mx = Math.max(...Object.values(cnt));
  const ohW = Object.fromEntries(OHS.map(o => [o, (mx - cnt[o]) + 1 + (o === GAN_OH[draw.gan] ? 2 : 0) + (o === JI_OH[draw.ji] ? 1 : 0)]));
  const w = Array(46).fill(0); NUMS.forEach(n => w[n] = ohW[numOh(n)]);
  return { ohW, w };
}
function sajuWeightsAt(cnt, date) { const draw = dayGZ(date); return { draw, ...ohWeights(cnt, draw) }; }

// ---------- 유명인사주형: SAJOO(holoolook/sajoo) 오늘의 운세 점수 방식 이식 ----------
// 점수 = 일간 기준 오늘 일진의 십신 점수(천간+지지) + 지지 관계(육합2·삼합2·충-2·형·해·원진-1·파-1)
//   + 오행 생극(±1) + 용신운(+1)/기신운(-1) + 천간합(+1). 재물운은 십신이 재성(편재·정재)일 때의 점수 + 합 + 용신운.
// 용신은 '사주에서 가장 부족한 오행'으로 근사했다 (원 사이트의 상세 알고리즘은 공개되지 않음)
const TEN_SCORE = { 정관: 2, 정재: 2, 정인: 2, 식신: 2, 편재: 1, 편인: 1, 비견: 0, 겁재: -1, 상관: -1, 편관: -1 };
const REL_SCORE = { 육합: 2, 삼합: 2, 충: -2, 형: -1, 해: -1, 원진: -1, 파: -1 };
const REL_TABLE = [
  ["육합", [["자", "축"], ["인", "해"], ["묘", "술"], ["진", "유"], ["사", "신"], ["오", "미"]]],
  ["삼합", [["신", "자"], ["자", "진"], ["신", "진"], ["인", "오"], ["오", "술"], ["인", "술"], ["사", "유"], ["유", "축"], ["사", "축"], ["해", "묘"], ["묘", "미"], ["해", "미"]]],
  ["충", [["자", "오"], ["축", "미"], ["인", "신"], ["묘", "유"], ["진", "술"], ["사", "해"]]],
  ["형", [["인", "사"], ["사", "신"], ["인", "신"], ["축", "술"], ["술", "미"], ["축", "미"], ["자", "묘"], ["진", "진"], ["오", "오"], ["유", "유"], ["해", "해"]]],
  ["해", [["자", "미"], ["축", "오"], ["인", "사"], ["묘", "진"], ["신", "해"], ["유", "술"]]],
  ["원진", [["자", "술"], ["축", "유"], ["인", "신"], ["묘", "미"], ["진", "오"], ["사", "해"]]],
  ["파", [["자", "유"], ["오", "묘"], ["진", "축"], ["술", "미"], ["인", "해"], ["신", "사"]]]];
const OH_GEN = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" }, OH_KEUK = { 목: "토", 토: "수", 수: "화", 화: "금", 금: "목" };
const CELEB_HAP = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]]; // 갑기·을경·병신·정임·무계합 (GAN 인덱스)
const zaRel = (a, b) => { for (const [k, ps] of REL_TABLE) if (ps.some(([x, y]) => x === a && y === b || x === b && y === a)) return k; return null; };
function shiShen(dOh, dYang, xOh, xYang) { // 일간 기준 십신 (오행 관계 + 음양)
  if (xOh === dOh) return dYang === xYang ? "비견" : "겁재";
  if (OH_GEN[dOh] === xOh) return dYang === xYang ? "식신" : "상관";
  if (OH_KEUK[dOh] === xOh) return dYang === xYang ? "편재" : "정재";
  if (OH_KEUK[xOh] === dOh) return dYang === xYang ? "편관" : "정관";
  return dYang === xYang ? "편인" : "정인";
}
function celebScore(c, draw) { // c: {cnt, dmGan, dmJi}, draw: dayGZ 결과 → SAJOO식 그 날짜 운세 점수
  const dmOh = GAN_OH[c.dmGan], dmYang = c.dmGan % 2 === 0, stOh = GAN_OH[draw.gan], stYang = draw.gan % 2 === 0,
    brOh = JI_OH[draw.ji], brYang = draw.ji % 2 === 0;
  const sg = shiShen(dmOh, dmYang, stOh, stYang), bg = shiShen(dmOh, dmYang, brOh, brYang), rel = zaRel(JI_K[c.dmJi], JI_K[draw.ji]);
  const d = OH_GEN[stOh] === dmOh || OH_GEN[dmOh] === stOh || OH_KEUK[dmOh] === stOh ? 1 : OH_KEUK[stOh] === dmOh ? -1 : 0;
  const yong = OHS.slice().sort((a, b) => c.cnt[a] - c.cnt[b] || OHS.indexOf(a) - OHS.indexOf(b))[0];
  const gisin = OHS.find(o => OH_KEUK[o] === dmOh);
  const yU = brOh === yong ? 1 : brOh === gisin ? -1 : 0;
  const hap = CELEB_HAP.some(([a, b]) => a === draw.gan && b === c.dmGan || a === c.dmGan && b === draw.gan);
  const g = TEN_SCORE[sg] + TEN_SCORE[bg] + (rel ? REL_SCORE[rel] : 0) + d + yU + (hap ? 1 : 0);
  const wealth = (sg === "편재" || sg === "정재" ? TEN_SCORE[sg] : 0) + (bg === "편재" || bg === "정재" ? TEN_SCORE[bg] : 0)
    + (rel === "육합" || rel === "삼합" ? REL_SCORE[rel] : 0) + Math.max(0, yU);
  return { g, wealth, grade: g >= 4 ? "대길" : g >= 2 ? "길" : g >= -1 ? "평" : g >= -3 ? "흉" : "대흉", sg, bg, rel };
}
let celebData;
function celebList() { // CELEBS(유명인·세계 부자 TOP10) 사주의 일간·일지·오행 개수를 한 번만 계산해 캐시 (이름 중복 제거)
  if (celebData !== undefined) return celebData;
  celebData = [];
  if (window.Solar && window.Lunar) {
    const seen = new Set();
    celebData = CELEBS.map(c => { try {
      const s = calcSaju(toP(c));
      return { name: c[1].replace(/^\d+\.\s*/, ""), cnt: s.cnt, dmGan: s.pillars[2].gan, dmJi: s.pillars[2].ji };
    } catch { return null; } }).filter(Boolean)
      .filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; }); // 글로벌과 세계 부자에 겹친 사람(머스크 등) 한 번만
  }
  return celebData;
}
function celebBlendAt(date) { // 유명인 전원을 그 날짜 운세 점수로 채점 → 상위 10명 순위표 (게임 순서대로 1명씩 배정)
  const list = celebList();
  if (!list.length) return null;
  const draw = dayGZ(date);
  const top = list.map(c => ({ name: c.name, c, r: celebScore(c, draw) }))
    .sort((a, b) => (b.r.g + b.r.wealth) - (a.r.g + a.r.wealth) || b.r.g - a.r.g || (a.name < b.name ? -1 : 1))
    .slice(0, 10);
  return { top, draw };
}
function celebPlan() { // 이번 추첨일(토요일) 기준 운세 순위 — 같은 주면 순위는 같고, 번호는 누를 때마다 새로 뽑음
  if (celebCache !== undefined) return celebCache;
  return celebCache = window.Solar ? celebBlendAt(drawDate) : null;
}
let celebCache;
const gzK = x => GAN_K[x.gan] + JI_K[x.ji];
function renderSaju() {
  if (!saju) { $("sajuOut").innerHTML = ""; return; }
  const s = saju, mxC = Math.max(...Object.values(s.cnt), 1), best = OHS.reduce((a, b) => s.ohW[b] > s.ohW[a] ? b : a);
  $("sajuOut").innerHTML = `<h2 style="margin-top:8px">${s.name ? s.name + "님의 " : ""}사주팔자</h2>
    <div class="pillars">${[...s.pillars].reverse().map(x => x ? `<div><small>${x.name}</small>
      <b class="o-${GAN_OH[x.gan]}">${GAN_K[x.gan]}</b><b class="o-${JI_OH[x.ji]}">${JI_K[x.ji]}</b><small>${x.hanja}</small></div>`
      : `<div><small>시주</small><b>?</b><b>?</b><small>시간 모름</small></div>`).join("")}</div>
    ${OHS.map(o => `<div class="oh"><span class="o-${o}"><b>${o}</b></span><div><div class="fill" style="width:${s.cnt[o] / mxC * 100}%"></div></div><span>${s.cnt[o]}</span></div>`).join("")}
    <p class="note">제${NEXT}회 추첨일(${drawDate.getMonth() + 1}/${drawDate.getDate()}) 일진은 <b>${gzK(s.draw)}(${s.draw.hanja})</b>입니다.
      부족한 오행일수록, 그리고 일진의 오행(${GAN_OH[s.draw.gan]}·${JI_OH[s.draw.ji]})일수록 가중치를 높였습니다.
      가장 힘을 주는 오행은 <b class="o-${best}">${best}</b>, 끝자리 ${ohDigits(best)}인 번호입니다.</p>
    <p class="note">오행 가중치: ${OHS.map(o => `${o} ${s.ohW[o]} (끝자리 ${ohDigits(o)})`).join(" · ")}</p>
    ${renderWest(s.west)}
    <div class="row" style="margin-top:12px"><button class="primary" type="button" id="sajuGo">🔮 내 사주 맞춤 번호 받기</button></div>`;
  if ($("allStrat").value === "__saju") applySajuPlan(); // 사주를 바꾸면 배분도 다시
  $("sajuGo").onclick = () => { if (applySajuPlan()) { generate(); $("planNote").scrollIntoView({ behavior: "smooth", block: "start" }); } };
}

// ---------- 별자리·점성술 ----------
// [이름, 기호, 시작월, 시작일, 원소, 지배행성 수(칼데아 수비학: 태양1 달2 목성3 수성5 금성6 토성8 화성9)]
const SIGNS = [["양자리", "♈", 3, 21, "불", 9], ["황소자리", "♉", 4, 20, "흙", 6], ["쌍둥이자리", "♊", 5, 21, "공기", 5], ["게자리", "♋", 6, 22, "물", 2],
  ["사자자리", "♌", 7, 23, "불", 1], ["처녀자리", "♍", 8, 23, "흙", 5], ["천칭자리", "♎", 9, 23, "공기", 6], ["전갈자리", "♏", 10, 23, "물", 9],
  ["사수자리", "♐", 11, 23, "불", 3], ["염소자리", "♑", 12, 22, "흙", 8], ["물병자리", "♒", 1, 20, "공기", 8], ["물고기자리", "♓", 2, 19, "물", 3]];
const PLANET = { 1: "태양", 2: "달", 3: "목성", 5: "수성", 6: "금성", 8: "토성", 9: "화성" };
const DAY_PLANET = [1, 2, 9, 5, 3, 6, 8]; // 일월화수목금토 요일의 지배행성
const dr = n => 1 + (n - 1) % 9;           // 수비학 환원 (예: 38 → 3+8=11 → 2)
function signOf(m, d) {
  const md = m * 100 + d; let s = 9;      // 1/1~1/19는 염소자리
  for (const i of [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) if (md >= SIGNS[i][2] * 100 + SIGNS[i][3]) s = i;
  return s;
}
function moonPhase(date) { // 평균 삭망월로 계산한 월령(일). 오차 ±1일 정도
  const jd = date.getTime() / 86400000 + 2440587.5, age = (((jd - 2451550.1) / 29.530588853) % 1 + 1) % 1 * 29.530588853;
  const names = ["신월", "초승달", "상현달", "차오르는 달", "보름달", "기우는 달", "하현달", "그믐달"];
  return { age, name: names[Math.floor((age / 29.530588853) * 8 + 0.5) % 8] };
}
function calcWest(solarYmd) {
  const [y, m, d] = solarYmd.split("-").map(Number), sign = signOf(m, d), S = SIGNS[sign];
  const life = dr([...solarYmd.replace(/-/g, "")].reduce((a, c) => a + +c, 0));
  const wday = DAY_PLANET[new Date(y, m - 1, d).getDay()];
  return { sign, life, wday, ...westWeightsAt(sign, life, wday, drawDate), moon: moonPhase(drawDate) };
}
function westWeightsAt(sign, life, wday, date) {
  const S = SIGNS[sign], dday = DAY_PLANET[date.getDay()], dsign = signOf(date.getMonth() + 1, date.getDate());
  const same = i => SIGNS[i][4] === S[4];
  // 별자리형: 내 별자리 번호(1~12)와 12씩 더한 수 +3, 같은 원소 별자리 번호 +1.5, 추첨일 태양 별자리 번호 +1
  const zw = Array(46).fill(0);
  NUMS.forEach(n => { const i = (n - 1) % 12; zw[n] = 1 + (i === sign ? 3 : 0) + (i !== sign && same(i) ? 1.5 : 0) + (i === dsign ? 1 : 0); });
  // 점성술형: 수비학 환원값이 지배행성 수 +3, 태어난 요일 행성 +2, 생명수 +2, 추첨일 요일 행성 +1
  const aw = Array(46).fill(0);
  NUMS.forEach(n => { const r = dr(n); aw[n] = 1 + (r === S[5] ? 3 : 0) + (r === wday ? 2 : 0) + (r === life ? 2 : 0) + (r === dday ? 1 : 0); });
  return { dday, dsign, zw, aw };
}
function renderWest(w) {
  if (!w) return "";
  const S = SIGNS[w.sign], nums = NUMS.filter(n => (n - 1) % 12 === w.sign);
  return `<h2 style="margin-top:16px">별자리·점성술</h2>
    <p class="note" style="color:var(--ink2)"><b>${S[1]} ${S[0]}</b> (${S[4]}의 원소) · 지배행성 ${PLANET[S[5]]}(${S[5]}) · 태어난 요일의 행성 ${PLANET[w.wday]}(${w.wday}) · 생명수 ${w.life}<br>
    추첨일(${drawDate.getMonth() + 1}/${drawDate.getDate()})은 ${SIGNS[w.dsign][0]} 시기, ${PLANET[w.dday]}의 날, 달은 <b>${w.moon.name}</b>(월령 ${w.moon.age.toFixed(1)}일)</p>
    <p class="note">별자리형 핵심 번호: ${nums.join(", ")} · 점성술형은 숫자를 한 자리로 줄인 값(예: 38→3+8=11→2)이 ${PLANET[S[5]]} ${S[5]}, ${PLANET[w.wday]} ${w.wday}, 생명수 ${w.life}, ${PLANET[w.dday]} ${w.dday}인 번호를 우대합니다.</p>`;
}

// ---------- 양자형·마르코프형 ----------
// 마르코프 전이: 직전 회차 번호 a가 나온 다음 회차에 b가 나온 비율의 합
const TR = Array.from({ length: 46 }, () => Array(46).fill(0)), OCC = Array(46).fill(0);
for (let i = 1; i < N; i++) for (const a of D[i - 1].n) { OCC[a]++; for (const b of D[i].n) TR[a][b]++; }
const markovWeights = (tr, occ, prev) => { const w = Array(46).fill(0); NUMS.forEach(j => w[j] = prev.reduce((s, a) => s + (occ[a] ? tr[a][j] / occ[a] : 0), 0) ** 4); return w; }; // 4제곱으로 차이를 키움
const markovW = markovWeights(TR, OCC, LAST.n);
// 양자 확률진폭형 (비유 모델): ψ = √(역대 비율) + √(최근50 비율)·e^{iφ}, φ = π·미출현/7.5 → P ∝ |ψ|² (간섭항 2ab·cosφ)
function quantumWeights(fr, c5, gp, n) {
  const w = Array(46).fill(0);
  NUMS.forEach(k => { const a = Math.sqrt(fr[k] / (n * 6)), b = Math.sqrt((c5[k] + 0.5) / (300 + 22.5)); w[k] = a * a + b * b + 2 * a * b * Math.cos(Math.PI * gp(k) / 7.5); });
  return w;
}
const qW = quantumWeights(freq, c50, gap, N);
// ---------- 딥러닝(LSTM) ----------
// 학습은 GitHub Actions에서 매주 dl_train.py(PyTorch)로 하고, 페이지는 결과(dl.js)만 읽음
const dl = window.LOTTO_DL && window.LOTTO_DL.last === N ? window.LOTTO_DL : null;
function renderDL() {
  const mean = dl.hit / dl.n, z = (mean - 0.8) / Math.sqrt(0.8 * (39 / 45) * (39 / 44) / dl.n);
  const top = NUMS.slice().sort((a, b) => dl.p[b - 1] - dl.p[a - 1]).slice(0, 10);
  $("dlEval").innerHTML = `<h2 style="margin-top:18px;font-size:15px">딥러닝(LSTM) 검증</h2>
    <p class="note">${dl.model}. 최근 100회를 학습에서 빼고, 그 100회를 한 회씩 예측해 5게임씩 맞춰 봤습니다: 평균 일치 <b>${mean.toFixed(3)}</b>
      (무작위 0.800), z = ${z >= 0 ? "+" : ""}${z.toFixed(2)} → <span class="tag ${Math.abs(z) > 1.96 ? "no" : "ok"}">${Math.abs(z) > 1.96 ? "차이 있음" : "무작위와 같음"}</span></p>
    <p class="note">제${LAST.no + 1}회 예측 확률 상위 10개 (무작위면 모두 13.3%):</p>
    <div class="balls">${top.map(k => `<span class="mini" style="margin:0 6px 0 0">${ball(k)}<span>${(dl.p[k - 1] * 100).toFixed(1)}%</span></span>`).join("")}</div>`
    + renderDLPrev();
}
// 지난 회차 예측 vs 실제: 추첨 전에 만든 예측(dl.prev)을 실제 당첨번호와 비교
function renderDLPrev() {
  const pv = dl.prev, d = pv && D[pv.no - 1];
  if (!d || d.no !== pv.no) return "";
  const order = NUMS.slice().sort((a, b) => pv.p[b - 1] - pv.p[a - 1]), rank = k => order.indexOf(k) + 1, win = new Set(d.n);
  const top6 = order.slice(0, 6).filter(k => win.has(k)).length;
  const games = [0, 1, 2, 3, 4].map(g => [0, 1, 2, 3, 4, 5].map(j => order[g + j * 5]).filter(k => win.has(k)).length);
  return `<h2 style="margin-top:18px;font-size:15px">지난 회차 예측 vs 실제 — 제${pv.no}회</h2>
    <p class="note">추첨 전에(제${pv.no - 1}회까지 데이터로) 만든 예측입니다. 실제 당첨번호에는 테두리를 표시했습니다.</p>
    <div class="balls">${order.slice(0, 10).map(k => `<span class="mini" style="margin:0 6px 0 0"><span class="ball ${ballCls(k)}${win.has(k) ? " hitball" : ""}">${k}</span><span>${(pv.p[k - 1] * 100).toFixed(1)}%</span></span>`).join("")}</div>
    <p class="note">실제 당첨번호: ${d.n.map(ball).join(" ")} + ${ball(d.b)}</p>
    <p class="note">당첨번호의 예측 순위(45개 중): ${d.n.slice().sort((a, b) => rank(a) - rank(b)).map(k => `<b>${k}</b> ${rank(k)}위(${(pv.p[k - 1] * 100).toFixed(1)}%)`).join(" · ")} · 보너스 ${d.b} ${rank(d.b)}위</p>
    <p class="note">확률 상위 6개 중 <b>${top6}개</b> 일치 (무작위로 6개 고르면 평균 0.8개) · 백테스트 방식 5게임 일치 수: ${games.join(", ")}개</p>`;
}

const cryptoR = () => { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; }; // 운영체제 하드웨어 엔트로피 난수
