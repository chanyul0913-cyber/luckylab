// 로분소 3/5 — 전략 목록(STRATS·GROUPS), 제외 규칙, 번호 뽑기·복사·공유, 사주 입력·목록
// 여러 파일이지만 순서대로 읽히는 한 덩어리 프로그램이다 (index.html의 <script> 순서를 바꾸지 말 것)
"use strict";
// ---------- 전략 ----------
function pick6(R, w) { // 가중치 w로 비복원 6개 (w 없으면 균등)
  const pool = NUMS.slice(), ws = pool.map(k => w ? w[k] : 1), out = [];
  while (out.length < 6) { let t = ws.reduce((a, b) => a + b, 0) * R(), i = 0;
    while ((t -= ws[i]) > 0 && i < pool.length - 1) i++;
    out.push(pool.splice(i, 1)[0]); ws.splice(i, 1); }
  return out.sort((a, b) => a - b);
}
// 피셔-예이츠 섞기 (sort에 무작위 비교함수를 쓰면 브라우저 상태에 따라 결과가 달라질 수 있음)
const shuffle = (a, R) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 사람들이 몰리는 조합 회피 + 역대 형태 범위
function okShape(s, c = LIVE) {
  if (s.length !== 6 || new Set(s).size !== 6) return false;           // 안전장치: 서로 다른 6개
  if (s.filter(x => x >= 32).length < 2) return false;                 // 생일(1~31)만의 조합 회피
  if (s.some((x, i) => i >= 2 && x - s[i - 1] === 1 && s[i - 1] - s[i - 2] === 1)) return false; // 3연속
  const d = s[1] - s[0]; if (s.every((x, i) => !i || x - s[i - 1] === d)) return false;       // 등차수열
  if (new Set(s.map(x => Math.min(4, (x - 1) / 10 | 0))).size < 3) return false;               // 한 구간 몰림
  const sm = s.reduce((a, b) => a + b, 0); if (sm < c.qlo || sm > c.qhi) return false;
  // 사용자 지정 제외 규칙
  const pr = s.filter(x => PRIMES.has(x)).length;
  if (pr === 0 || pr >= 5) return false;                                // 소수 0개 또는 5개 이상
  if (s.filter(x => x > 1 && !PRIMES.has(x)).length >= 5) return false; // 합성수 5개 이상 (1은 제외)
  if (new Set(s.map(x => Math.min(4, (x - 1) / 10 | 0))).size === 5) return false; // 공 색상 5가지 모두
  const row = {}; s.forEach(x => row[(x - 1) / 7 | 0] = (row[(x - 1) / 7 | 0] || 0) + 1);
  const rmax = Math.max(...Object.values(row));
  if (rmax === 1 || rmax >= 4) return false;                            // 용지 가로줄(7칸) 최대 개수 1개 또는 4개 이상
  const colc = {}; s.forEach(x => colc[(x - 1) % 7] = (colc[(x - 1) % 7] || 0) + 1);
  if (Math.max(...Object.values(colc)) >= 4) return false;              // 용지 세로줄 최대 개수 4개 이상
  if (s.filter(x => x % 3 === 0).length >= 5) return false;             // 3의 배수 5개 이상
  if (s.filter(x => x % 5 === 0).length >= 4) return false;             // 5의 배수 4개 이상
  if (s.filter(x => c.prev.includes(x)).length >= 3) return false;      // 이월수(직전 회차 번호) 3개 이상
  return !c.pastSet.has(s.join(","));                                  // 역대 1등 조합 그대로 회피
}
const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);
const overdueOf = gp => [...NUMS].sort((a, b) => gp(b) - gp(a) || a - b).slice(0, 5);
const overdue = overdueOf(gap);
const STRATS = {
  balance: ["전체 통계 균형형", "역대 출현 빈도를 가중치로 사용", (R, c = LIVE) => pick6(R, c.freq)],
  recent: ["최근 50회 참고형", "최근 50회 출현 횟수 + 1을 가중치로 사용", (R, c = LIVE) => pick6(R, c.c50.map(v => v + 1))],
  overdue: ["미출현 포함형", `장기 미출현 상위 5개(${overdue.join(", ")}) 중 2개 + 나머지 무작위`, (R, c = LIVE) => {
    const o = shuffle(c.overdue, R).slice(0, 2);
    const pool = NUMS.filter(x => !c.overdue.includes(x)), a = []; // 나머지 4개는 미출현 상위 5개를 뺀 40개에서
    while (a.length < 4) a.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    return [...o, ...a].sort((x, y) => x - y); }],
  spread: ["구간 분산형", "1-10·11-20·21-30·31-40·41-45 다섯 구간 중 4곳을 골라 하나씩 + 같은 4구간에서 2개 더 (공 색상 4가지)", R => {
    const zones = shuffle([[1, 10], [11, 20], [21, 30], [31, 40], [41, 45]], R).slice(0, 4);
    const s = zones.map(([a, b]) => a + Math.floor(R() * (b - a + 1)));
    const pool = zones.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)).filter(x => !s.includes(x));
    while (s.length < 6) s.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    return s.sort((a, b) => a - b); }],
  random: ["무작위 혼합형", "완전 무작위 (형태 필터만 적용)", R => pick6(R)],
  markov: ["마르코프 전이형", `직전 회차(${LAST.n.join(", ")}) 번호 다음 회차에 자주 나온 번호에 가중치 (GitHub 예측 프로젝트들의 '이전 회차 → 다음 회차' 방식)`, (R, c = LIVE) => pick6(R, c.markovW)],
  quantum: ["양자 확률진폭형", "양자역학을 빗댄 모델: 역대 빈도와 최근 빈도를 두 경로의 진폭으로 보고, 미출현 기간을 위상차로 간섭시켜 |ψ|²에 비례해 '측정'. 측정은 운영체제 하드웨어 난수 사용 (실제 양자 난수 아님)", (R, c = LIVE) => pick6(R, c.qW)],
  deep: ["딥러닝 LSTM형", "GitHub 인기 예측 프로젝트(LotteryAi 등)와 같은 방식: 직전 10회를 보고 다음 회차를 예측하는 LSTM 신경망을 매주 GitHub 서버에서 학습해 둔 예측 확률로 가중치. 백테스트는 50회마다 그때까지의 데이터로만 다시 학습한 모델의 예측으로 계산(미래 데이터 차단)",
    (R, c = LIVE) => { const p = c.dlP, avg = p.reduce((a, b) => a + b, 0) / 45; return pick6(R, [0, ...p.map(v => (v / avg) ** 4)]); }],
  saju: ["사주 오행형", "내 사주의 부족한 오행 + 추첨일 일진 오행 번호에 가중치를 두고 누를 때마다 새로 뽑습니다", (R, c = LIVE) => pick6(R, c.sajuW)],
  zodiac: ["별자리형", "내 태양 별자리 번호(양자리 1 … 물고기자리 12)와 12씩 더한 수, 같은 원소 별자리 번호, 추첨일 별자리 번호에 가중치", (R, c = LIVE) => pick6(R, c.zw)],
  astro: ["점성술형", "번호를 한 자리로 줄인 수(수비학)가 내 별자리 지배행성·태어난 요일 행성·생명수·추첨일 행성의 수와 같으면 가중치", (R, c = LIVE) => pick6(R, c.aw)],
};
// 만세력형: 내 정보 없이, 이번 추첨 시각(토 20:35)의 사주 8글자로 번호 가중치를 정함 (그 주 기운은 같고, 번호는 누를 때마다 새로 뽑음)
let manseCache;
function manse() {
  if (manseCache !== undefined) return manseCache;
  if (!window.Solar) return null; // 라이브러리 로딩 실패 시 다음에 다시 시도
  return manseCache = manseAt(drawDate);
}
function manseAt(date) {
  // 서울 경도 보정 30분: 20:35 → 20:05 (술시)
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 5);
  const ec = Solar.fromDate(t).getLunar().getEightChar();
  const pil = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].map((s, i) => ({ name: ["년", "월", "일", "시"][i], gan: GAN.indexOf(s[0]), ji: JI.indexOf(s[1]), hanja: s }));
  const cnt = Object.fromEntries(OHS.map(o => [o, 0]));
  pil.forEach(x => { cnt[GAN_OH[x.gan]]++; cnt[JI_OH[x.ji]]++; });
  // 60갑자 순번(갑자 1 … 계해 60). 45를 넘으면 45를 뺌
  const gz = x => { for (let i = 0; i < 60; i++) if (i % 10 === x.gan && i % 12 === x.ji) return i + 1; };
  const key = pil.map(x => x.hanja).join("");
  const nums = [...new Set(pil.map(x => { const v = gz(x); return v > 45 ? v - 45 : v; }))];
  const w = Array(46).fill(0); NUMS.forEach(n => w[n] = 1 + cnt[numOh(n)] + (nums.includes(n) ? 3 : 0)); // 강한 기운을 따름
  return { pil, cnt, nums, w, key };
}
STRATS.manse = ["만세력형", "내 정보 없이, 이번 추첨 시각(토 20:35)의 년·월·일·시 4기둥을 만세력으로 뽑아, 그 시각에 강한 오행의 번호(끝자리 하도 수리)와 각 기둥의 60갑자 순번 번호에 가중치. 이번 주 기운을 반영하며 누를 때마다 새 번호가 나옵니다",
  (R, c = LIVE) => pick6(R, c.manseW)];
// 유명인사주형: 유명인 전원을 추첨일(토요일) 기준 SAJOO식 운세 점수로 채점, 게임 순서대로 상위 명 배정 (10게임 = 1~10위)
STRATS.celeb = ["유명인사주형", "아래 유명인·세계 부자 TOP10 사주를 추첨일 토요일 기준 오늘의 운세 점수로 채점합니다 (SAJOO 방식: 일간 기준 일진 십신 + 지지 육합·삼합·충 + 오행 생극 + 용신운 + 천간합). 1게임은 운세 1위, 2게임은 2위 … 10게임은 10위 — 게임 순서의 유명인 사주 오행 가중치로 뽑습니다 (반복 없음). 누를 때마다 새 번호가 나옵니다. 운세 점수는 1등 확률과 무관",
  (R, c = LIVE, gi = 0) => { const p = c.celebPlan; if (!p || !p.top.length) return pick6(R);
    const t = p.top[Math.min(gi, p.top.length - 1)]; return pick6(R, ohWeights(t.c.cnt, p.draw).w); }];
// 실시간 추천에 쓰는 기준값 (백테스트는 회차마다 그 시점까지의 값으로 같은 함수를 부름)
const LIVE = { qlo: q(0.1), qhi: q(0.9), prev: LAST.n, pastSet, freq, c50, overdue, markovW, qW,
  get sajuW() { return saju.w; }, get zw() { return saju.west.zw; }, get aw() { return saju.west.aw; }, get manseW() { return manse().w; },
  get celebPlan() { return celebPlan(); }, get dlP() { return dl.p; } };
STRATS.btop = ["백테스트형", "아래 백테스트 표에서 3개 이상 맞힌 비율(3+)이 높은 전략을 순위대로 게임에 배정: 1게임=1위, 2게임=2위 … 10게임=10위 (반복 없음, 동률이면 평균 일치가 높은 쪽). 후보 전략 수보다 게임이 많으면 남는 게임은 비워 둠. 딥러닝도 50회마다 다시 학습한 회차별 기록으로 다른 전략과 똑같이 비교. 순위 차이는 우연 범위이며, 이 방식 자체의 성적도 백테스트 표에 나옵니다", null];
const PROFILE = ["saju", "zodiac", "astro"]; // 내 정보가 필요한 전략
const SKEYS = Object.keys(STRATS);
const GROUPS = [["통계형", ["balance", "recent", "overdue", "spread"]], ["AI·모델형", ["deep", "markov", "quantum"]], ["백테스트형", ["btop"]],
  ["동양 역학형", ["manse", "saju", "celeb"]], ["서양 점성형", ["zodiac", "astro"]], ["무작위", ["random"]]];
const optLabel = k => STRATS[k][0] + (PROFILE.includes(k) ? " (내 정보 필요)" : "");
console.assert(GROUPS.flatMap(g => g[1]).sort().join() === SKEYS.slice().sort().join(), "전략 묶음 누락");
const optHtml = sel => GROUPS.map(([g, ks]) => `<optgroup label="${g}">`
  + ks.map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${optLabel(k)}</option>`).join("") + "</optgroup>").join("");
$("stratHelp").innerHTML = GROUPS.map(([g, ks]) => `<b style="color:var(--accent-text)">${g}</b><br>` + ks.map(k => `<b>${optLabel(k)}</b> — ${STRATS[k][1]}`).join("<br>")).join("<br><br>") + "<br>"
  + "<br>모든 전략에 공통으로, 1~31만으로 된 조합·세 번호 연속·등차수열·한 구간 몰림·역대 1등 조합을 거르고 게임끼리 3개 이상 겹치지 않게 합니다.<br><b>추가 제외 규칙</b> — 합성수 5개 이상 · 공 색상 5가지가 모두 들어간 조합 · 소수 0개 또는 5개 이상 · 용지 가로줄(1~7, 8~14 …) 한 줄에 4개 이상이거나 6개가 모두 다른 줄인 조합 · 용지 세로줄(1·8·15 …) 한 줄에 4개 이상 · 3의 배수 5개 이상 · 5의 배수 4개 이상 · 직전 회차 번호(이월수) 3개 이상. 이 규칙들은 취향에 따른 필터이며 1등 확률을 바꾸지 않습니다.";
$("gameCount").innerHTML = Array.from({ length: 10 }, (_, i) => `<option${i === 4 ? " selected" : ""}>${i + 1}</option>`).join("");
$("allStrat").innerHTML = `<option value="">게임별로 고르기</option><option value="__saju">🔮 내 사주 맞춤 배분</option><option value="__top3">🏆 이번 주 화제의 전략 TOP3</option>` + optHtml("");

// ---------- 사주 맞춤 배분 ----------
// 채워야 할 오행(가중치가 큰 오행)에 어울리는 전략으로 게임을 나눔. 명리 해석상 '어울림'이며 확률 차이는 없음
const OH_STRATS = { 목: ["recent", "deep"], 화: ["quantum", "random"], 토: ["balance", "spread"], 금: ["markov", "manse"], 수: ["overdue", "zodiac", "astro"] };
const OH_MEAN = { 목: "성장·새 흐름", 화: "변화·폭발력", 토: "안정·중심", 금: "규칙·결단", 수: "흐름·때를 기다림" };
function sajuPlan(n) {
  const order = OHS.slice().sort((a, b) => saju.ohW[b] - saju.ohW[a] || OHS.indexOf(a) - OHS.indexOf(b));
  const rest = n - 1, tot = order.reduce((a, o) => a + saju.ohW[o], 0);
  // 최대 잔여법: 가중치 비율대로 나누고 남는 게임은 소수점이 큰 오행부터
  const share = order.map(o => ({ o, x: rest * saju.ohW[o] / tot })), cnt = {};
  share.forEach(v => cnt[v.o] = Math.floor(v.x));
  let left = rest - Object.values(cnt).reduce((a, b) => a + b, 0);
  share.slice().sort((a, b) => (b.x % 1) - (a.x % 1) || order.indexOf(a.o) - order.indexOf(b.o)).forEach(v => { if (left > 0) { cnt[v.o]++; left--; } });
  const plan = ["saju"], why = [];
  order.forEach(o => { for (let j = 0; j < cnt[o]; j++) plan.push(OH_STRATS[o][j % OH_STRATS[o].length]);
    if (cnt[o]) why.push(`<b class="o-${o}">${o}</b>(${OH_MEAN[o]}, 가중치 ${saju.ohW[o]}) ${cnt[o]}게임`); });
  console.assert(plan.length === n, "배분 개수 오류");
  return { plan: plan.slice(0, n), why };
}
function applySajuPlan() {
  if (!saju) { $("planNote").innerHTML = `<span class="warn" style="display:block">사주 맞춤 배분은 아래 '내 정보 입력'에 사주를 먼저 저장해야 합니다.</span>`; $("allStrat").value = ""; $("sjY").focus(); return false; }
  const { plan, why } = sajuPlan(+$("gameCount").value);
  choice = plan; renderRows(); $("allStrat").value = "__saju";
  $("planNote").innerHTML = `🔮 ${saju.name ? esc(saju.name) + "님" : "내"} 사주에서 채워야 할 기운 순서대로 나눴습니다: 사주 오행형 1게임`
    + (why.length ? " · " + why.join(" · ") : "") + `. 명리 해석상 어울리는 전략일 뿐, 1등 확률은 모든 전략이 같습니다.`;
  return true;
}

// ---------- 이번 주 화제의 전략 TOP3 (재미용 큐레이션 — 확률이 높은 전략을 고르는 게 아님) ----------
function recent50(k) { // 최근 50회 성적: 백테스트 회차별 기록(g)에서 계산, 캐시로 불러왔으면 저장해 둔 rc
  const r = BT[k]; if (!r) return null;
  if (r.rc) return r.rc;
  if (!r.g) return null;
  let hit = 0, h3 = 0, n = 0;
  for (let i = Math.max(0, N - 50) * 5; i < N * 5; i++) { const h = r.g[i]; if (h < 0) continue; n++; hit += h; h3 += h >= 3; }
  return n ? { hit, h3, n } : null;
}
function top3Plan(n) {
  // 세 기준(과거 성적 · 최근 50회 · 이번 주 기운)을 1→2→3→1… 순서로 돌며 각 기준의 다음 순위를 뽑음 (이미 뽑힌 전략은 건너뜀)
  const rk = btRanking(); if (!rk.length) return null; // 백테스트 계산 전
  const lists = [
    rk.map((r, j) => ({ k: r.k, why: `과거 성적 ${j + 1}위 ${STRATS[r.k][0]}(3개+ ${(r.r3 * 100).toFixed(2)}%)` })),
    rk.map(r => ({ k: r.k, s: recent50(r.k) })).filter(r => r.s).sort((a, b) => b.s.hit / b.s.n - a.s.hit / a.s.n || b.s.h3 - a.s.h3)
      .map((r, j) => ({ k: r.k, why: `최근 50회 ${j + 1}위 ${STRATS[r.k][0]}(평균 ${(r.s.hit / r.s.n).toFixed(2)}개 일치)` })),
    [],
  ];
  const m = manse(); // 이번 추첨 시각에 강한 오행 순서대로, 그 오행에 어울리는 전략 (사주 맞춤 배분과 같은 짝)
  if (m) OHS.slice().sort((a, b) => m.cnt[b] - m.cnt[a] || OHS.indexOf(a) - OHS.indexOf(b)).forEach((o, j) =>
    OH_STRATS[o].forEach(k => { if ((saju || !PROFILE.includes(k)) && (k !== "deep" || dl))
      lists[2].push({ k, why: `이번 주 기운 ${j + 1}순위 ${STRATS[k][0]}(제${NEXT}회 추첨 시각 <b class="o-${o}">${o}</b>·${OH_MEAN[o]} 기운 ${m.cnt[o]}개)` }); }));
  else lists[2].push({ k: "random", why: `무작위 혼합형(인터넷 연결이 없어 이번 주 기운 대신)` }); // 만세력을 못 불러와도 돌릴 수 있는 전략은 다 쓰게
  const pick = [], ptr = [0, 0, 0];
  for (let g = 0; pick.length < n && g < n * 3; g++) { // 한 기준이 바닥나면 다음 기준으로
    const c = g % 3, L = lists[c];
    while (ptr[c] < L.length && pick.some(p => p.k === L[ptr[c]].k)) ptr[c]++;
    if (ptr[c] < L.length) pick.push(L[ptr[c]++]);
  }
  return pick;
}
function applyTop3() {
  const n = +$("gameCount").value, p = top3Plan(n);
  if (!p) { $("planNote").innerHTML = `<span class="warn" style="display:block">백테스트를 계산하는 중입니다. 잠시 후 다시 골라 주세요.</span>`; $("allStrat").value = ""; return false; }
  choice = Array.from({ length: n }, (_, i) => p[i] ? p[i].k : "__none"); renderRows(); $("allStrat").value = "__top3";
  $("planNote").innerHTML = `🏆 이번 주 화제의 전략 TOP3 — ` + p.map((x, i) => `<b>${i + 1}게임</b> ${x.why}`).join(" · ")
    + (p.length < n ? ` · ${p.length + 1}게임부터는 고를 전략이 없어 비워 둡니다` : "")
    + `. 세 기준을 번갈아 1위부터 고른 <b>재미용 추천</b>이며, 어떤 전략이든 1등 확률은 똑같습니다. 과거 성적이 좋은 전략을 고르는 방식 자체도 백테스트에서 무작위보다 낫지 않았습니다.`;
  return true;
}

let choice = SKEYS.slice(0, 5), current = [];
function renderRows() {
  const n = +$("gameCount").value;
  while (choice.length < n) choice.push(SKEYS[choice.length % 5]);
  choice.length = n; current = [];
  $("copy").disabled = true;
  $("sets").innerHTML = choice.map((k, i) => `<div class="set"><span class="idx">${i + 1}게임</span>
    <select data-i="${i}" aria-label="${i + 1}게임 전략">${k === "__none" ? '<option value="__none" selected disabled>— 배정할 전략 없음 —</option>' : ""}${optHtml(k)}</select>
    <div class="balls" id="res${i}" style="grid-column:2"></div><div class="why" id="why${i}"></div></div>`).join("");
  $("sets").querySelectorAll("select").forEach(el => el.onchange = () => { choice[+el.dataset.i] = el.value; $("allStrat").value = ""; $("planNote").innerHTML = ""; });
}
$("gameCount").onchange = () => {
  const v = $("allStrat").value;
  if (v === "__saju") applySajuPlan();
  else if (v === "__top3") applyTop3();
  else if (v) { choice = Array(+$("gameCount").value).fill(v); renderRows(); $("allStrat").value = v; } // 전체 전략을 고른 상태면 늘어난 게임도 같은 전략
  else renderRows();
};
$("allStrat").onchange = () => {
  const v = $("allStrat").value; $("planNote").innerHTML = "";
  if (v === "__saju") applySajuPlan();
  else if (v === "__top3") { $("gameCount").value = "3"; applyTop3(); } // TOP3는 3게임부터 (늘리면 돌아가며 배정)
  else if (v) { choice = choice.map(() => v); renderRows(); $("allStrat").value = v; }
};
renderRows();

// 백테스트 3+ 비율 상위 5개 전략 (무작위 기준·자기 자신 제외, 딥러닝은 3+ 기록이 있을 때만)
function btRanking() {
  const c = Object.keys(BT).filter(k => !["random", "btop"].includes(k) && BT[k] && BT[k].n
      && (window.Solar || !["manse", "celeb", ...PROFILE].includes(k)) && (saju || !PROFILE.includes(k)) && (k !== "deep" || dl)) // 지금 못 돌리는 전략(인터넷 끊김·내 정보 없음)은 순위에서 빼서 게임이 비지 않게
    .map(k => ({ k, r3: BT[k].h3 / BT[k].n, mean: BT[k].hit / BT[k].n }));
  if (!BT.deep && dl && dl.h3 != null) c.push({ k: "deep", r3: dl.h3 / dl.n, mean: dl.hit / dl.n, recent: true });
  return c.sort((a, b) => b.r3 - a.r3 || b.mean - a.mean).slice(0, 10); // 게임 수(최대 10)만큼 1~10위
}
function generate() {
  const seed = (Math.random() * 2 ** 31) | 0; current = [];
  const ranking = choice.includes("btop") ? btRanking() : [];
  let btIdx = 0;
  choice.forEach((k0, i) => {
    let k = k0, label = "";
    if (k0 === "__none") { $("res" + i).innerHTML = ""; $("why" + i).innerHTML = `<b>이번 주 화제의 전략</b> · ${i + 1}게임에 배정할 전략이 없습니다(지금 고를 수 있는 전략을 모두 썼어요).`; return; }
    if (k0 === "btop") {
      if (!ranking.length) { $("res" + i).innerHTML = ""; $("why" + i).innerHTML = "<b>백테스트형</b> · 백테스트를 계산 중입니다. 잠시 후 다시 누르세요."; return; }
      const j = btIdx++, r = ranking[j]; // N번째 백테스트형 게임 = N위 전략 (반복 없음)
      if (!r) { $("res" + i).innerHTML = ""; $("why" + i).innerHTML = `<b>백테스트형</b> · ${j + 1}위 전략이 없습니다. 지금 비교할 수 있는 전략은 ${ranking.length}개입니다${saju ? "" : " (내 정보를 저장하면 사주·별자리·점성술형이 후보에 추가됩니다)"}.`; return; }
      k = r.k;
      label = `백테스트형 · ${j + 1}위 ${STRATS[k][0]} (3+ ${(r.r3 * 100).toFixed(2)}%${r.recent ? ", 최근 100회" : ""})`;
    }
    const [name0, , fn] = STRATS[k], name = label || name0;
    if (k === "deep" && !dl) { $("res" + i).innerHTML = ""; $("why" + i).innerHTML = `<b>${name}</b> · 이번 회차 딥러닝 결과가 아직 없습니다. 잠시 후 다시 시도하세요.`; return; }
    const prof = PROFILE.includes(k);
    if (prof && !saju) {
      $("res" + i).innerHTML = ""; $("why" + i).innerHTML = `<b>${name}</b> · 아래 '내 정보 입력'을 먼저 저장하세요.`; return; }
    if (k === "manse" && !manse()) { $("res" + i).innerHTML = ""; $("why" + i).innerHTML = `<b>${name}</b> · 만세력 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.`; return; }
    if (k === "celeb" && !celebPlan()) { $("res" + i).innerHTML = ""; $("why" + i).innerHTML = `<b>${name}</b> · 유명인 사주를 계산하지 못했습니다. 인터넷 연결을 확인하세요.`; return; }
    const R = k === "quantum" ? cryptoR : rng(seed + i * 7919);
    let s, tries = 0;
    do s = fn(R, undefined, i); while (++tries < 5000 && (!okShape(s) || current.some(c => c.s.filter(x => s.includes(x)).length > 2)));
    current.push({ name, s });
    const odd = s.filter(x => x % 2).length;
    $("res" + i).innerHTML = s.map(ball).join("");
    $("why" + i).innerHTML = `<b>${name}</b> · 합 ${s.reduce((a, b) => a + b, 0)} · 홀짝 ${odd}:${6 - odd}`
      + (k === "saju" ? ` · 오행 ${s.map(numOh).join("")}` : "")
      + (k === "astro" ? ` · 수비 ${s.map(dr).join("")}` : "")
      + (k === "zodiac" ? ` · 별자리 ${s.map(x => SIGNS[(x - 1) % 12][1]).join("")}` : "")
      + (k === "manse" ? ` · 추첨 시각 ${manse().pil.map(x => gzK(x) + x.name).join(" ")}` : "")
      + (k === "celeb" ? (() => { const p = celebPlan(), t = p.top[Math.min(i, p.top.length - 1)];
          return ` · ${drawDate.getMonth() + 1}/${drawDate.getDate()} 토요일 운세 ${Math.min(i, p.top.length - 1) + 1}위 ${t.name}(${t.r.grade}, 재물+${t.r.wealth}) 사주로 뽑음`; })() : "");
  });
  $("copy").disabled = !current.length;
  $("share").disabled = !current.length;
  if (choice.some(k => PROFILE.includes(k)) && !saju) $("sjY").focus();
  renderCelebRank();
}
// 유명인사주형이 쓰는 이번 주 운세 순위표 (추첨일 토요일 기준 1~10위)
function renderCelebRank() {
  const cp = celebPlan();
  if (!cp) return;
  $("celebRank").hidden = false;
  $("celebRankBody").innerHTML = cp.top.map((t, j) =>
    `${j + 1}위 <b>${esc(t.name)}</b> — ${t.r.grade} · 총+${t.r.g} · 재물+${t.r.wealth} · 행운지수 ${Math.min(97, Math.max(23, 62 + t.r.g * 5))}`).join("<br>")
    + `<br>점수는 SAJOO식 오늘의 운세 계산(총점+재물운)이며, 번호 추천 시 누르는 순간마다 이 순위대로 게임에 배정됩니다.`;
}
$("again").onclick = generate;
const shareText = () => `로또 6/45 제${NEXT}회 분석 조합\n` + current.map((c, i) => `${i + 1}. ${c.s.join(" ")} (${c.name})`).join("\n");
function copyText(t) { // 클립보드 API가 막힌 환경을 위한 옛 방식 복사
  const ta = document.createElement("textarea");
  ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {}
  ta.remove(); return ok;
}
async function copyNumbers(toast) {
  let ok = false;
  try { await navigator.clipboard.writeText(shareText()); ok = true; } catch {}
  if (!ok) ok = copyText(shareText());
  toast.textContent = ok ? "복사했어요" : "복사 실패 — 직접 선택해 복사하세요";
  setTimeout(() => toast.textContent = "", 2000);
}
$("copy").onclick = () => copyNumbers($("toast"));
// 카톡 공유: 기기 공유창(모바일에서 카톡 선택 가능)을 열고, 공유창이 없는 환경은 번호+주소를 복사로 대체
async function shareNumbers(toast) {
  const url = location.origin + location.pathname;
  if (navigator.share) {
    try { await navigator.share({ title: "로분소 로또 분석", text: shareText() + "\n(재미용 분석 조합 — 당첨 확률은 어떤 번호든 똑같아요)", url }); return; }
    catch (e) { if (e && e.name === "AbortError") return; } // 사용자가 공유창을 닫은 것
  }
  let ok = false;
  try { await navigator.clipboard.writeText(shareText() + "\n" + url); ok = true; } catch {}
  if (!ok) ok = copyText(shareText() + "\n" + url);
  toast.textContent = ok ? "이 기기엔 공유창이 없어 번호+주소를 복사했어요" : "복사 실패 — 직접 선택해 복사하세요";
  setTimeout(() => toast.textContent = "", 2500);
}
$("share").onclick = () => shareNumbers($("toast"));

// 사주 입력 폼
$("sjH").innerHTML += Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}시</option>`).join("");
$("sjMi").innerHTML = Array.from({ length: 60 }, (_, m) => `<option value="${m}">${String(m).padStart(2, "0")}분</option>`).join("");
const readForm = () => ({ name: $("sjName").value.trim(), cal: document.querySelector("input[name=cal]:checked").value,
  leap: $("sjLeap").checked, y: +$("sjY").value, m: +$("sjM").value, d: +$("sjD").value, h: $("sjH").value, mi: $("sjMi").value });
function applyProfile(p, save) {
  try { saju = calcSaju(p); saju.west = calcWest(saju.solar); renderSaju(); $("sjMsg").textContent = save ? "저장했어요" : "";
    if (window.btReady) { renderBT(); backtestProfile(); } // 백테스트 준비 전(페이지 로딩 중)에는 건너뜀
    if (save) try { localStorage.setItem("lottoSaju", JSON.stringify(p)); } catch {} }
  catch (e) { saju = null; renderSaju(); $("sjMsg").textContent = e.message; }
}
$("sajuForm").onsubmit = e => { e.preventDefault(); applyProfile(readForm(), true); markChip(); };
function fillForm(p) {
  $("sjName").value = p.name || ""; document.querySelector(`input[name=cal][value=${p.cal === "lunar" ? "lunar" : "solar"}]`).checked = true;
  $("sjLeap").checked = !!p.leap; $("sjY").value = p.y; $("sjM").value = p.m; $("sjD").value = p.d; $("sjH").value = p.h ?? ""; $("sjMi").value = p.mi ?? "0";
}
try { const p = JSON.parse(localStorage.getItem("lottoSaju") || "null"); if (p) { fillForm(p); applyProfile(p, false); } } catch {}

// 유명인·내 목록: 누르면 폼에 채우고 바로 저장 (기존 입력 방식은 그대로)
const RICH = window.LOTTO_RICH && (window.LOTTO_RICH.ver === undefined || window.LOTTO_RICH.ver === 1)
  && window.LOTTO_RICH.list && window.LOTTO_RICH.list.length === 10
  ? window.LOTTO_RICH.list.map(x => ["세계 부자 TOP10", `${x.rank}. ${x.name}`, x.y, x.m, x.d, `$${x.worth}B`]) : null;
const CELEBS = [ // [분류, 이름, 양력 년, 월, 일, (재산)] — 공개된 생년월일
  ["정치", "이재명", 1963, 12, 8],
  ["기업인", "이재용", 1968, 6, 23], ["기업인", "최태원 (SK)", 1960, 12, 3],
  ["글로벌", "도널드 트럼프", 1946, 6, 14], ["글로벌", "일론 머스크", 1971, 6, 28], ["글로벌", "버락 오바마", 1961, 8, 4],
  ["글로벌", "빌 게이츠", 1955, 10, 28], ["글로벌", "스티브 잡스", 1955, 2, 24],
  ["방송인(연예인)", "유재석", 1972, 8, 14], ["방송인(연예인)", "김선태 (충주맨)", 1987, 3, 12], ["방송인(연예인)", "비 (정지훈)", 1982, 6, 25],
  // 세계 부자 TOP10: 포브스 실시간 순위(rich.js, 매일 자동 갱신). 없으면 2026 연간 순위(2026.3.1)
  ...(RICH || [
  ["세계 부자 TOP10", "1. 일론 머스크", 1971, 6, 28], ["세계 부자 TOP10", "2. 래리 페이지", 1973, 3, 26], ["세계 부자 TOP10", "3. 세르게이 브린", 1973, 8, 21],
  ["세계 부자 TOP10", "4. 제프 베이조스", 1964, 1, 12], ["세계 부자 TOP10", "5. 마크 저커버그", 1984, 5, 14], ["세계 부자 TOP10", "6. 래리 엘리슨", 1944, 8, 17],
  ["세계 부자 TOP10", "7. 베르나르 아르노", 1949, 3, 5], ["세계 부자 TOP10", "8. 젠슨 황", 1963, 2, 17], ["세계 부자 TOP10", "9. 워런 버핏", 1930, 8, 30],
  ["세계 부자 TOP10", "10. 아만시오 오르테가", 1936, 3, 28],
  ]),
  ["K-pop", "BTS RM (김남준)", 1994, 9, 12], ["K-pop", "BTS 진 (김석진)", 1992, 12, 4], ["K-pop", "BTS 슈가 (민윤기)", 1993, 3, 9],
  ["K-pop", "BTS 제이홉 (정호석)", 1994, 2, 18], ["K-pop", "BTS 지민 (박지민)", 1995, 10, 13], ["K-pop", "BTS 뷔 (김태형)", 1995, 12, 30],
  ["K-pop", "BTS 정국 (전정국)", 1997, 9, 1], ["K-pop", "BLACKPINK 지수", 1995, 1, 3], ["K-pop", "BLACKPINK 제니", 1996, 1, 16],
  ["K-pop", "아이유 (이지은)", 1993, 5, 16], ["K-pop", "임영웅", 1991, 6, 16], ["K-pop", "차은우 (이동민)", 1997, 3, 30], ["K-pop", "장원영", 2004, 8, 31],
  // 스포츠: 손흥민·김연아·메시·호날두 + 2026 KBO 연봉 상위 5명(외국인 제외, 2026.3 KBO 발표)
  ["스포츠", "손흥민", 1992, 7, 8], ["스포츠", "김연아", 1990, 9, 5], ["스포츠", "리오넬 메시", 1987, 6, 24], ["스포츠", "크리스티아누 호날두", 1985, 2, 5],
  ["스포츠", "양의지 (두산·연봉 1위)", 1987, 6, 5], ["스포츠", "고영표 (KT·2위)", 1991, 9, 16], ["스포츠", "최정 (SSG·3위)", 1987, 2, 28],
  ["스포츠", "류현진 (한화·공동 4위)", 1987, 3, 25], ["스포츠", "추신수", 1982, 7, 13],
  ["스포츠", "오타니 쇼헤이", 1994, 7, 5], ["스포츠", "카일 터커", 1997, 1, 17], ["스포츠", "후안 소토", 1998, 10, 25],
  // 배우: 부동산 자산 추정 상위 5명(2020 KBS2 연중라이브 순위, 2026.4 아주경제 재인용) 중 배우 + 기존
  ["배우", "김태희", 1980, 3, 29], ["배우", "권상우", 1976, 8, 5], ["배우", "전지현 (왕지현)", 1981, 10, 30],
  ["배우", "송승헌", 1976, 10, 5], ["배우", "장근석", 1987, 8, 4], ["배우", "송혜교", 1981, 11, 22],
];
const CELEB_CATS = ["정치", "기업인", "세계 부자 TOP10", "글로벌", "방송인(연예인)", "K-pop", "스포츠", "배우"];
console.assert(CELEBS.every(c => CELEB_CATS.includes(c[0])), "유명인 분류 누락");
const toP = c => ({ name: c[1], cal: "solar", leap: false, y: c[2], m: c[3], d: c[4], h: "", mi: "0" });
const sameP = (a, b) => a && b && a.name === b.name && a.cal === b.cal && +a.y === +b.y && +a.m === +b.m && +a.d === +b.d && String(a.h) === String(b.h);
let myList = [];
try { myList = JSON.parse(localStorage.getItem("lottoSajuList") || "[]"); } catch {}
const saveList = () => { try { localStorage.setItem("lottoSajuList", JSON.stringify(myList)); } catch {} };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function pickPreset(p) { fillForm(p); applyProfile(p, true); markChip(); showQuick(p); }
// 이름을 누른 바로 아래에서 게임 수만 고르고 [받기] → 사주 맞춤 배분 + 번호 뽑기 + 결과 표시
function showQuick(p) {
  const q = $("celebQuick");
  if (!saju) { q.hidden = true; return; }
  q.hidden = false;
  q.innerHTML = `<b>${esc(p.name || "이 사람")} 사주로 번호 받기</b>
    <div class="row" style="margin-top:8px"><select id="cqN" aria-label="게임 수">${Array.from({ length: 10 }, (_, i) =>
      `<option value="${i + 1}"${i + 1 === +$("gameCount").value ? " selected" : ""}>${i + 1}게임</option>`).join("")}</select>
    <button class="primary" id="cqGo">받기</button></div><div id="cqOut"></div>`;
  $("cqGo").onclick = () => {
    $("gameCount").value = $("cqN").value;
    if (!applySajuPlan()) return;
    generate();
    $("cqOut").innerHTML = current.map((c, i) => `<div class="balls">${c.s.map(ball).join("")}</div><div class="note" style="margin:0 0 4px">${i + 1}게임 · ${c.name}</div>`).join("")
      + `<button id="cqCopy">번호 복사</button> <button id="cqShare">카톡 공유</button> <span class="toast" id="cqToast"></span>`;
    $("cqCopy").onclick = () => copyNumbers($("cqToast"));
    $("cqShare").onclick = () => shareNumbers($("cqToast"));
  };
  q.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 맨 위 빠른 시작 버튼
$("qRandom").onclick = () => { generate(); $("sets").scrollIntoView({ behavior: "smooth", block: "start" }); };
$("qCeleb").onclick = () => { const c = $("celebs"); c.scrollIntoView({ behavior: "smooth", block: "center" }); c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash"); };

// 그림 사용법: 옆으로 밀어 넘기는 슬라이드
const slides = $("slides"), nSlides = slides.children.length;
$("picsDots").innerHTML = "<i></i>".repeat(nSlides);
const curSlide = () => Math.round(slides.scrollLeft / slides.clientWidth);
const goSlide = i => { slides.scrollTo({ left: Math.max(0, Math.min(nSlides - 1, i)) * slides.clientWidth, behavior: "smooth" }); setTimeout(syncDots, 450); };
function syncDots() {
  const i = curSlide();
  [...$("picsDots").children].forEach((d, k) => d.classList.toggle("on", k === i));
  $("picsPrev").disabled = i === 0;
  $("picsNext").textContent = i === nSlides - 1 ? "닫기" : "다음 ▶";
}
slides.addEventListener("scroll", syncDots);
$("picsPrev").onclick = () => goSlide(curSlide() - 1);
$("picsNext").onclick = () => curSlide() === nSlides - 1 ? $("pics").close() : goSlide(curSlide() + 1);
$("picsClose").onclick = () => $("pics").close();
$("qPics").onclick = () => { $("pics").showModal(); slides.scrollLeft = 0; syncDots(); };
function markChip() {
  const cur = readForm();
  document.querySelectorAll(".presets .chip").forEach(el => el.classList.toggle("on", sameP(JSON.parse(el.dataset.p), cur)));
}
function renderPresets() {
  const catTitle = cat => cat !== "세계 부자 TOP10" ? cat
    : `${cat} <small>· 포브스 ${RICH ? `실시간 ${window.LOTTO_RICH.date} 기준` : "2026 연간 순위"}</small>`;
  $("celebs").innerHTML = CELEB_CATS.map(cat => `<div class="catRow"><span class="cat">${catTitle(cat)}</span>`
    + CELEBS.filter(c => c[0] === cat).map(c => `<button type="button" class="chip" data-p='${esc(JSON.stringify(toP(c)))}'>
    ${c[1]} <small>${c[5] ? c[5] + " · " : ""}${c[2]}.${c[3]}.${c[4]}</small></button>`).join("") + "</div>").join("");
  $("myList").innerHTML = myList.length ? myList.map((p, i) => `<span class="chipWrap"><button type="button" class="chip" data-p='${esc(JSON.stringify(p))}'>
    ${esc(p.name || "이름 없음")} <small>${p.cal === "lunar" ? "음" : ""}${p.y}.${p.m}.${p.d}${p.h !== "" ? ` ${p.h}시` : ""}</small></button>
    <button type="button" class="del" data-i="${i}" aria-label="${esc(p.name || "이름 없음")} 삭제">×</button></span>`).join("")
    : `<span class="note">아직 없습니다.</span>`;
  document.querySelectorAll(".presets .chip").forEach(el => el.onclick = () => pickPreset(JSON.parse(el.dataset.p)));
  document.querySelectorAll("#myList .del").forEach(el => el.onclick = () => { myList.splice(+el.dataset.i, 1); saveList(); renderPresets(); });
  markChip();
}
$("addMine").onclick = () => {
  const p = readForm();
  if (!p.y || !p.m || !p.d) { $("sjMsg").textContent = "생년월일을 먼저 입력하세요."; return; }
  if (!p.name) { $("sjMsg").textContent = "목록에 넣으려면 이름을 입력하세요."; $("sjName").focus(); return; }
  try { calcSaju(p); } catch (e) { $("sjMsg").textContent = e.message; return; }
  myList = myList.filter(x => x.name !== p.name).concat(p); saveList(); renderPresets();
  $("sjMsg").textContent = `'${p.name}'을(를) 목록에 추가했어요`;
};
renderPresets();

// 내 목록 백업·복원: 브라우저 초기화·기기 바꾸기에 대비해 파일로 내보내고 다시 불러온다
$("backupMine").onclick = () => {
  const data = { type: "robunso-saju-list", saved: new Date().toISOString().slice(0, 10), list: myList };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
  a.download = `로분소-사주목록-${data.saved}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); // 바로 지우면 일부 브라우저(아이폰 사파리 등)에서 내려받기가 안 됨
  $("sjMsg").textContent = "목록 파일을 내려받았어요 — 잘 보관해 두세요";
};
$("importMine").onclick = () => $("restoreMine").click();
$("restoreMine").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result), items = Array.isArray(d) ? d : d.list;
      if (!Array.isArray(items)) throw new Error("로분소 목록 파일이 아닙니다");
      const key = q => (q.name || "") + "|" + q.y + "|" + q.m + "|" + q.d;
      let added = 0, skipped = 0;
      for (const p of items) {
        if (!p || !p.y || !p.m || !p.d) { skipped++; continue; }
        const q = { name: String(p.name || "").slice(0, 20), cal: p.cal === "lunar" ? "lunar" : "solar", leap: !!p.leap, y: +p.y, m: +p.m, d: +p.d, h: p.h ?? "", mi: p.mi ?? "0" };
        try { calcSaju(q); } catch { skipped++; continue; } // 존재하지 않는 날짜 등은 그 항목만 건너뜀
        if (!(q.y >= 1900 && q.y <= 2100)) { skipped++; continue; }
        if (myList.some(x => key(x) === key(q))) { skipped++; continue; }
        myList.push(q); added++;
      }
      saveList(); renderPresets();
      $("sjMsg").textContent = added ? `${added}명을 목록에 불러왔어요${skipped ? ` (건너뜀 ${skipped}명 — 날짜 오류·중복)` : ""}`
        : skipped ? `새로 추가된 사람이 없어요 (날짜 오류·중복 ${skipped}명)` : "새로 추가된 사람이 없어요";
    } catch (err) { $("sjMsg").textContent = "불러오기 실패 — " + err.message; }
    e.target.value = "";
  };
  r.readAsText(f);
};

if (dl) renderDL();
renderCelebRank(); // 열자마자 이번 주 유명인 운세 순위를 준비
