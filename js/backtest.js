// 로분소 4/5 — 백테스트(메인 스레드·웹 워커), 백테스트형 성적, 결과 표
// 여러 파일이지만 순서대로 읽히는 한 덩어리 프로그램이다 (index.html의 <script> 순서를 바꾸지 말 것)
"use strict";
// ---------- 백테스트 (각 회차는 직전 회차까지만 사용) ----------
// 실제 추천과 같은 전략 함수·같은 형태 필터를, 회차마다 그 이전 데이터로 만든 기준값으로 돌림 (미래 데이터 차단)
const BT_START = 101, BT = {};
const BT_CACHE_VER = 3;   // 전략·제외 규칙·점수 계산을 바꿀 때 1씩 올린다 (지난 백테스트 캐시 무효화)
let btFromCache = false;
function loadBTCache() { // 새 회차·같은 코드면 지난 백테스트 결과를 그대로 씀 (재방문 시 수십 초 절약)
  try {
    const c = JSON.parse(localStorage.getItem("lottoBT") || "null");
    if (!c || c.ver !== BT_CACHE_VER || c.last !== N || !c.stats) return false;
    // 인터넷이 끊겼을 때 저장한 결과엔 만세력·유명인·딥러닝 기록이 빠져 있음 → 지금 돌릴 수 있는 전략이 빠졌으면 다시 계산
    if (baseKeys.concat(dl ? ["deep"] : []).some(k => !c.stats[k])) return false;
    for (const k of Object.keys(c.stats)) BT[k] = c.stats[k];
    btFromCache = true;
    return true;
  } catch { return false; }
}
function saveBTCache() { // 기본 전략(+백테스트형)만 저장 — 사주 계열은 사람별이라 매번 계산
  try {
    const stats = {};
    for (const k of Object.keys(BT)) if (!PROFILE.includes(k) && BT[k] && BT[k].n) stats[k] = { hit: BT[k].hit, h3: BT[k].h3, h4: BT[k].h4, n: BT[k].n, rc: recent50(k) }; // rc: TOP3의 최근 50회 성적
    localStorage.setItem("lottoBT", JSON.stringify({ ver: BT_CACHE_VER, last: N, stats }));
  } catch {}
}
const drawDay = d => new Date(+d.ymd.slice(0, 4), +d.ymd.slice(4, 6) - 1, +d.ymd.slice(6), 12);
function runBacktest(keys, done) {
  const res = Object.fromEntries(keys.map(k => [k, { hit: 0, h3: 0, h4: 0, n: 0, g: new Int8Array(N * 5).fill(-1) }]));
  const fr = Array(46).fill(0), ls = Array(46).fill(0), tr = Array.from({ length: 46 }, () => Array(46).fill(0)), oc = Array(46).fill(0);
  const sumsH = [], past = new Set();
  let i = 0;
  function step() {
    // 다른 앱을 보고 있으면(화면 숨김) 브라우저가 타이머를 1초에 1번으로 늦춘다 → 그때는 덩어리를 크게 해 몇 배 빨리 끝내고, 보고 있을 때는 잘게 나눠 화면이 멈추지 않게 한다
    const hidden = document.hidden, until = Math.min(N, i + (hidden ? 400 : 60)), t0 = performance.now();
    for (; i < until; i++) {
      const d = D[i];
      if (d.no >= BT_START) {
        const no = d.no, gp = k => (no - 1) - ls[k], c50h = Array(46).fill(0);
        D.slice(Math.max(0, i - 50), i).forEach(x => x.n.forEach(v => c50h[v]++));
        const ctx = { qlo: sumsH[Math.floor(0.1 * (sumsH.length - 1))], qhi: sumsH[Math.floor(0.9 * (sumsH.length - 1))],
          prev: D[i - 1].n, pastSet: past, freq: fr, c50: c50h, overdue: overdueOf(gp),
          get markovW() { return markovWeights(tr, oc, D[i - 1].n); }, get qW() { return quantumWeights(fr, c50h, gp, i); },
          get manseW() { return manseAt(drawDay(d)).w; },
          get sajuW() { return sajuWeightsAt(saju.cnt, drawDay(d)).w; },
          get zw() { return westWeightsAt(saju.west.sign, saju.west.life, saju.west.wday, drawDay(d)).zw; },
          get aw() { return westWeightsAt(saju.west.sign, saju.west.life, saju.west.wday, drawDay(d)).aw; },
          get celebPlan() { return celebBlendAt(drawDay(d)); }, get dlP() { return DLH.p[i - (DLH.from - 1)].map(v => v / 1000); } };
        const win = new Set(d.n);
        // 비싼 가중치(markovW·qW·manseW·sajuW·zw·aw)는 회차당 한 번만 계산해 모든 전략이 공유
        for (const key of ["markovW", "qW", "manseW", "sajuW", "zw", "aw", "celebPlan"]) {
          const raw = Object.getOwnPropertyDescriptor(ctx, key).get; let v;
          Object.defineProperty(ctx, key, { get: () => v ??= raw.call(ctx) });
        }
        for (const k of keys) {
          const fn = STRATS[k][2], R = rng(no * 7919 + hashStr(k)), cx = Object.create(ctx);
          for (let g = 0; g < 5; g++) {
            let s, tries = 0;
            do s = fn(R, cx, g); while (++tries < 500 && !okShape(s, cx));
            const h = s.filter(x => win.has(x)).length, r = res[k]; r.n++; r.hit += h; r.h3 += h >= 3; r.h4 += h >= 4; r.g[i * 5 + g] = h;
          }
        }
      }
      // 예측이 끝난 뒤에야 이 회차를 학습 데이터에 넣음
      d.n.forEach(x => { fr[x]++; ls[x] = d.no; });
      if (i) for (const a of D[i - 1].n) { oc[a]++; for (const b of d.n) tr[a][b]++; }
      const sm = d.n.reduce((a, b) => a + b, 0); sumsH.splice(sumsH.findIndex(v => v > sm) >>> 0, 0, sm); past.add(d.n.join(","));
      if (performance.now() - t0 > (hidden ? 250 : 40)) { i++; break; } // 화면이 멈추지 않게 나눠서 계산
    }
    $("btProg").textContent = i < N ? `계산 중… ${Math.round(i / N * 100)}%` : "";
    if (i < N) setTimeout(step, 0); else done(res);
  }
  step();
}
// ---------- 백테스트 워커: 계산을 별도 스레드로 보내 화면이 안 멈추게 한다 ----------
// 전략 엔진 함수들을 문자열로 모아 Blob 워커를 만든다(단일 출처 유지). 실패하면 위의 메인 스레드 방식으로 되돌아감.
let btW = null;
function buildWorkerSource() {
  const consts = { NUMS, GAN, JI, JI_K, GAN_OH, JI_OH, OHS, DIGIT_OH, TEN_SCORE, REL_SCORE, REL_TABLE, OH_GEN, OH_KEUK, CELEB_HAP, SIGNS, DAY_PLANET, BT_START };
  const fns = [rng, hashStr, pick6, shuffle, okShape, overdueOf, markovWeights, quantumWeights, numOh, dayGZ, drawDay, ohWeights,
    sajuWeightsAt, manseAt, signOf, dr, westWeightsAt, shiShen, zaRel, celebScore, celebBlendAt];
  return `
try { importScripts("https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js"); } catch (e) {}
const ${Object.entries(consts).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ")};
const PRIMES = new Set(${JSON.stringify([...PRIMES])});
${fns.map(f => `const ${f.name} = ${f};`).join("\n")}
let N = 0, saju = null, DLH = null, celebData = [], KEYS = [], STRATS = {}, res = null, DONE = null;
function celebList() { return celebData; }
let fr, ls, tr, oc, sumsH, past, i;
function run(keys, done) {
  KEYS = keys; DONE = done;
  res = Object.fromEntries(keys.map(k => [k, { hit: 0, h3: 0, h4: 0, n: 0, g: new Int8Array(N * 5).fill(-1) }]));
  fr = Array(46).fill(0); ls = Array(46).fill(0); tr = Array.from({ length: 46 }, () => Array(46).fill(0)); oc = Array(46).fill(0);
  sumsH = []; past = new Set(); i = 0;
  step();
}
function step() {
  const until = Math.min(N, i + 250), t0 = Date.now();
  for (; i < until; i++) {
    const d = DATA[i];
    if (d.no >= BT_START) {
      const no = d.no, gp = k => (no - 1) - ls[k], c50h = Array(46).fill(0);
      DATA.slice(Math.max(0, i - 50), i).forEach(x => x.n.forEach(v => c50h[v]++));
      const ctx = { qlo: sumsH[Math.floor(0.1 * (sumsH.length - 1))], qhi: sumsH[Math.floor(0.9 * (sumsH.length - 1))],
        prev: DATA[i - 1].n, pastSet: past, freq: fr, c50: c50h, overdue: overdueOf(gp),
        get markovW() { return markovWeights(tr, oc, DATA[i - 1].n); }, get qW() { return quantumWeights(fr, c50h, gp, i); },
        get manseW() { return manseAt(drawDay(d)).w; },
        get sajuW() { return sajuWeightsAt(saju.cnt, drawDay(d)).w; },
        get zw() { return westWeightsAt(saju.west.sign, saju.west.life, saju.west.wday, drawDay(d)).zw; },
        get aw() { return westWeightsAt(saju.west.sign, saju.west.life, saju.west.wday, drawDay(d)).aw; },
        get celebPlan() { return celebBlendAt(drawDay(d)); }, get dlP() { return DLH.p[i - (DLH.from - 1)].map(v => v / 1000); } };
      const win = new Set(d.n);
      for (const key of ["markovW", "qW", "manseW", "sajuW", "zw", "aw", "celebPlan"]) {
        const raw = Object.getOwnPropertyDescriptor(ctx, key).get; let v;
        Object.defineProperty(ctx, key, { get: () => v ??= raw.call(ctx) });
      }
      for (const k of KEYS) {
        const fn = STRATS[k][2], R = rng(no * 7919 + hashStr(k)), cx = Object.create(ctx);
        for (let g = 0; g < 5; g++) {
          let s, tries = 0;
          do s = fn(R, cx, g); while (++tries < 500 && !okShape(s, cx));
          const h = s.filter(x => win.has(x)).length, r = res[k]; r.n++; r.hit += h; r.h3 += h >= 3; r.h4 += h >= 4; r.g[i * 5 + g] = h;
        }
      }
    }
    d.n.forEach(x => { fr[x]++; ls[x] = d.no; });
    if (i) for (const a of DATA[i - 1].n) { oc[a]++; for (const b of d.n) tr[a][b]++; }
    const sm = d.n.reduce((a, b) => a + b, 0); sumsH.splice(sumsH.findIndex(v => v > sm) >>> 0, 0, sm); past.add(d.n.join(","));
  }
  postMessage({ p: Math.round(i / N * 100) });
  if (i < N) setTimeout(step, 0); else DONE(res);
}
onmessage = e => {
  const m = e.data;
  if (m.cmd !== "run") return;
  N = m.N; saju = m.saju; DLH = m.dlh; celebData = m.celeb; DATA = m.D;
  STRATS = {};
  for (const [k, s] of m.strats) STRATS[k] = [k, "", eval("(" + s + ")")];
  run(m.keys, r => postMessage({ done: r }));
};`;
}
function startBT(keys, done) { // 워커로 백테스트(별도 스레드, 화면 안 멈춤) — 만들 수 없거나 실패하면 기존 방식으로
  const fail = () => { try { if (btW) { btW.terminate(); btW = null; } } catch {} runBacktest(keys, done); };
  try {
    if (btW === null) btW = new Worker(URL.createObjectURL(new Blob([buildWorkerSource()], { type: "text/javascript" })));
    btW.onmessage = e => {
      const m = e.data;
      if (m.p !== undefined) $("btProg").textContent = `계산 중… ${m.p}%`;
      if (m.done) { $("btProg").textContent = ""; btW.onerror = null; window.__btViaWorker = true; done(m.done); }
    };
    btW.onerror = e => { window.__btWerr = e.message || "오류"; console.warn("백테스트 워커 실패 — 기존 방식으로 계산:", e.message || e); btW = null; fail(); };
    btW.postMessage({ cmd: "run", N, keys,
      D: D.map(d => ({ no: d.no, ymd: d.ymd, n: d.n })),
      dlh: keys.includes("deep") ? DLH : null, celeb: celebList(), saju: saju ? { cnt: saju.cnt, west: { sign: saju.west.sign, life: saju.west.life, wday: saju.west.wday } } : null,
      strats: keys.map(k => [k, STRATS[k][2].toString()]) });
  } catch { fail(); }
}
// 백테스트형 검증: 회차마다 '그 이전까지의' 3+ 순위 상위 10개 전략을 골라 그 회차 결과를 씀 (미래 순위 사용 안 함)
function computeMeta() {
  const keys = Object.keys(BT).filter(k => !["random", "btop"].includes(k) && BT[k] && BT[k].g);
  if (keys.length < 5) return;   // 캐시로 불러온 백테스트형 성적을 지우지 않게 먼저 확인
  delete BT.btop;
  const cum = Object.fromEntries(keys.map(k => [k, { h3: 0, hit: 0, n: 0 }])), res = { hit: 0, h3: 0, h4: 0, n: 0 };
  const rate = k => cum[k].h3 / cum[k].n, mean = k => cum[k].hit / cum[k].n;
  for (let i = 0; i < N; i++) {
    if (D[i].no < BT_START) continue;
    if (keys.every(k => cum[k].n >= 100)) { // 전략마다 100게임(20회) 이상 쌓인 뒤부터
      keys.slice().sort((a, b) => rate(b) - rate(a) || mean(b) - mean(a)).slice(0, 10).forEach((k, j) => { // 실제 추천과 같게 1~10위로 1게임씩 (전략마다 회차당 5게임을 저장해 둠)
        const h = BT[k].g[i * 5 + j % 5]; res.n++; res.hit += h; res.h3 += h >= 3; res.h4 += h >= 4; });
    }
    for (const k of keys) for (let g = 0; g < 5; g++) { const h = BT[k].g[i * 5 + g]; if (h < 0) continue; const c = cum[k]; c.n++; c.hit += h; c.h3 += h >= 3; }
  }
  res.saju = keys.some(k => PROFILE.includes(k)); // 설명 문구용: 이번 계산에 사주 계열이 실제로 들어갔는지 (캐시에서 불러온 성적은 사주 미포함)
  BT.btop = res;
}
// 양측 유의수준 0.05를 비교 전략 수로 나눈 기준 z (본페로니)
const zCrit = m => { let lo = 1.5, hi = 5; for (let t = 0; t < 40; t++) { const mid = (lo + hi) / 2; (1 - Phi(mid)) * 2 * m > 0.05 ? lo = mid : hi = mid; } return hi; };
function renderBT() {
  const MU = 0.8, VAR = 0.8 * (39 / 45) * (39 / 44), P3 = [3, 4, 5, 6].reduce((t, k) => t + C(6, k) * C(39, 6 - k), 0) / C(45, 6);
  const order = GROUPS.flatMap(g => g[1]).filter(k => k !== "random").concat("random");
  const rows = order.filter(k => BT[k] || (k === "deep" && dl) || PROFILE.includes(k));
  const m = rows.filter(k => k !== "random" && (BT[k] || (k === "deep" && dl))).length, zc = zCrit(Math.max(1, m));
  const tag = (z, k) => k === "random" ? '<span class="tag">기준</span>'
    : `<span class="tag ${Math.abs(z) > zc ? "no" : "ok"}">${Math.abs(z) > zc ? "차이 있음" : "무작위와 같음"}</span>`;
  const zs = z => (z >= 0 ? "+" : "") + z.toFixed(2);
  $("btTxt").innerHTML = `제${BT_START}회~제${LAST.no}회 ${N - BT_START + 1}회를, 매 회차 <b>그 이전 데이터만</b> 보고 각 전략으로 5게임씩 뽑아 실제 결과와 맞춰 봤습니다.
    추천과 똑같은 전략·제외 규칙을 씁니다. 무작위 기준: 게임당 평균 0.800개 일치, 3개 이상 ${(P3 * 100).toFixed(2)}%.
    전략을 ${m}개 비교하므로 |z| &gt; ${zc.toFixed(2)}여야 유의합니다.`
    + (btFromCache ? ` <b>이전에 계산한 결과를 불러왔습니다</b>(새 회차가 나오면 자동 다시 계산)` : "")
    + ` <span id="btRecalc" role="button" style="text-decoration:underline;cursor:pointer;color:var(--ink2)">🔄 다시 계산</span>`;
  $("bt").innerHTML = "<tr><th>전략</th><th>평균 일치</th><th>3개+</th><th>4개+</th><th>z</th><th>판정</th></tr>" + rows.map(k => {
    const name = STRATS[k][0];
    if (k === "deep" && !BT.deep) { const mean = dl.hit / dl.n, z = (mean - MU) / Math.sqrt(VAR / dl.n), has3 = dl.h3 != null;
      return `<tr><td>${name} <small class="note">최근 100회만</small></td><td>${mean.toFixed(3)}</td><td>${has3 ? (dl.h3 / dl.n * 100).toFixed(2) + "%" : "-"}</td><td>${has3 ? dl.h4 : "-"}</td><td>${zs(z)}</td><td>${tag(z, k)}</td></tr>`; }
    const r = BT[k];
    if (!r) return `<tr><td>${name}</td><td colspan="5" class="note" style="text-align:left">${saju ? "계산 중…" : "내 정보 입력 후 계산됩니다"}</td></tr>`;
    const z = (r.hit / r.n - MU) / Math.sqrt(VAR / r.n);
    const who = PROFILE.includes(k) && saju ? ` <small class="note">${saju.name ? esc(saju.name) + " 기준" : "내 사주 기준"}</small>`
      : k === "deep" ? ` <small class="note">50회마다 다시 학습</small>`
      : k === "btop" ? ` <small class="note">회차마다 그때까지의 상위 10개로 1게임씩${r.saju ? ", 사주 계열 포함" : ""}</small>` : "";
    return `<tr><td>${name}${who}</td><td>${(r.hit / r.n).toFixed(3)}</td><td>${(r.h3 / r.n * 100).toFixed(2)}%</td><td>${r.h4}</td><td>${zs(z)}</td><td>${tag(z, k)}</td></tr>`;
  }).join("");
  const recalc = $("btRecalc"); if (recalc) recalc.onclick = () => { try { localStorage.removeItem("lottoBT"); } catch {} runBaseBT(); };
  updateFoldSum();
}
// 접힌 '검정 · 백테스트' 카드에 결론 한 줄 (펼치지 않아도 결과를 알 수 있게)
function updateFoldSum() {
  const tOk = tests.filter(t => t[3]).length, same = $("bt").querySelectorAll(".tag.ok").length, diff = $("bt").querySelectorAll(".tag.no").length;
  const a = tOk === tests.length ? `패턴 검사 ${tests.length}개 모두 '패턴 없음'` : `패턴 검사 ${tests.length}개 중 ${tests.length - tOk}개 '차이 있음'`;
  const b = btBusy ? "전략 성적 계산 중…" : diff ? `전략 ${same + diff}개 중 ${diff}개 '차이 있음'` : `전략 ${same}개 모두 '무작위와 같음'`;
  $("foldSum").textContent = `${tOk === tests.length && !diff ? "✅" : "⚠️"} ${a} · ${b}`;
}
let btBusy = false, btProfileKey = null;
function backtestProfile() { // 내 정보가 바뀌면 사주·별자리·점성술형만 다시 계산
  if (!saju || btBusy || btProfileKey === saju.key) return;
  const key = saju.key; btBusy = true; PROFILE.forEach(k => delete BT[k]); renderBT();
  startBT(PROFILE, res => { btBusy = false; btProfileKey = key; if (saju && saju.key === key) Object.assign(BT, res); computeMeta(); renderBT(); backtestProfile(); });
}
const baseKeys = SKEYS.filter(k => !PROFILE.includes(k) && k !== "deep" && k !== "btop" && ((k !== "manse" && k !== "celeb") || window.Solar));
