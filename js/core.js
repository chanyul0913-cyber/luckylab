// 로분소 1/5 — 데이터 읽기, 기본 통계, 빈도 차트, 구조 검정 (화면 위쪽)
// 여러 파일이지만 순서대로 읽히는 한 덩어리 프로그램이다 (index.html의 <script> 순서를 바꾸지 말 것)
"use strict";
const $ = id => document.getElementById(id);
if (!window.LOTTO) { $("meta").textContent = "data.js가 없습니다. fetch_lotto.py를 먼저 실행하세요."; throw new Error("no data"); }

// ---------- 데이터 ----------
const D = LOTTO.map(r => ({ no: r[0], ymd: r[1], n: r.slice(2, 8), b: r[8], w1: r[9], a1: r[10], sales: r[11] }));
const N = D.length, LAST = D[N - 1];
const NUMS = Array.from({ length: 45 }, (_, i) => i + 1);
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
const fmtDate = s => `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6)}`;
const ballCls = x => "b" + (x <= 10 ? 1 : x <= 20 ? 2 : x <= 30 ? 3 : x <= 40 ? 4 : 5);
const ball = x => `<span class="ball ${ballCls(x)}">${x}</span>`;
const won = v => v >= 1e8 ? (v / 1e8).toFixed(1) + "억원" : v.toLocaleString() + "원";

// 표준정규 누적분포 (Abramowitz-Stegun 7.1.26)
function Phi(z) { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + e) / 2 : (1 - e) / 2; }
// 카이제곱 상단 p값 (Wilson-Hilferty 근사, df가 클 때 충분히 정확)
const chiP = (x, k) => 1 - Phi((Math.cbrt(x / k) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k)));
// 재현 가능한 난수
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- 기본 통계 ----------
const freq = Array(46).fill(0), last = Array(46).fill(0);
D.forEach(d => d.n.forEach(x => { freq[x]++; last[x] = d.no; }));
const EXP = N * 6 / 45;
const chi = NUMS.reduce((s, k) => s + (freq[k] - EXP) ** 2 / EXP, 0), chiPv = chiP(chi, 44);
const c50 = Array(46).fill(0); D.slice(-50).forEach(d => d.n.forEach(x => c50[x]++));
const gap = k => LAST.no - last[k];
const sums = D.map(d => d.n.reduce((a, b) => a + b, 0)).sort((a, b) => a - b);
const q = p => sums[Math.floor(p * (N - 1))];
const pastSet = new Set(D.map(d => d.n.join(",")));

$("meta").textContent = `동행복권 제1회(${fmtDate(D[0].ymd)}) ~ 제${LAST.no}회(${fmtDate(LAST.ymd)}) 실제 당첨번호 ${N}회 분석`;
// 토요일 20:00(한국 시각) 판매 마감 뒤 ~ 새 당첨번호 반영 전에는 그 회차를 더 살 수 없으므로 그다음 회차를 대상으로 삼는다
const SALE_CLOSED = Date.now() >= Date.UTC(+LAST.ymd.slice(0, 4), +LAST.ymd.slice(4, 6) - 1, +LAST.ymd.slice(6) + 7, 11, 0); // 11:00 UTC = 20:00 KST
const NEXT = LAST.no + (SALE_CLOSED ? 2 : 1), NEXT_DAYS = SALE_CLOSED ? 14 : 7;
$("target").textContent = `제${NEXT}회 대상`;
if (SALE_CLOSED) { $("closedNote").hidden = false; $("closedNote").innerHTML = `⏰ 제${LAST.no + 1}회는 <b>판매가 마감</b>됐어요(토요일 저녁 8시). 지금 뽑는 번호는 <b>다음 회차(제${NEXT}회)</b> 기준입니다. 제${LAST.no + 1}회 당첨번호는 늦어도 일요일 오전에 자동 반영됩니다.`; }
$("footData").textContent = `마지막 반영: 제${LAST.no}회 (${fmtDate(LAST.ymd)})`;
// 메뉴에서 '검정·백테스트'를 누르면 접힌 카드를 펼쳐서 보여 줌
document.querySelector('.top nav a[href="#statsFold"]').addEventListener("click", () => { $("statsFold").open = true; });
const drawDateTxt = (() => { const d = new Date(+LAST.ymd.slice(0, 4), +LAST.ymd.slice(4, 6) - 1, +LAST.ymd.slice(6) + NEXT_DAYS);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 토요일 20:35`; })();
$("latest").innerHTML = `<h2>지난 회차 실제 당첨번호 — 제${LAST.no}회 <span class="tag">${fmtDate(LAST.ymd)} 추첨 완료</span></h2>
  <p class="warn">⚠️ 이미 끝난 추첨의 결과입니다. <b>추천 번호가 아닙니다.</b> 추천 번호는 아래 '번호 뽑기'에서 버튼을 눌러야 나옵니다.</p>
  <div class="balls" style="margin:10px 0">${LAST.n.map(ball).join("")}<span class="plus">+</span>${ball(LAST.b)}</div>
  <p class="note">${!LAST.sales && !LAST.w1 ? "1등 당첨금 집계 중 (발표되면 자동 반영)" : LAST.w1 ? `1등 ${LAST.w1}명 · 1인당 ${won(LAST.a1)}` : "1등 당첨자 없음"} · ${SALE_CLOSED ? `제${LAST.no + 1}회 판매 마감 · ` : ""}다음 추첨은 제${NEXT}회 (${drawDateTxt})</p>`;

// ---------- 빈도 차트 ----------
const tip = $("tip");
const showTip = (e, html) => { tip.innerHTML = html; tip.style.display = "block";
  tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = (e.clientY - 34) + "px"; };
const hideTip = () => tip.style.display = "none";
const fmax = Math.max(...freq), fmin = Math.min(...freq.slice(1)), lo = Math.floor(fmin * 0.8);
$("freqBars").innerHTML = NUMS.map(k => `<div data-k="${k}" style="height:${(freq[k] - lo) / (fmax - lo) * 100}%"></div>`).join("")
  + `<span class="expline" style="bottom:${(EXP - lo) / (fmax - lo) * 100}%"></span>`;
$("freqAxis").innerHTML = NUMS.map(k => `<span>${k % 5 === 0 || k === 1 ? k : ""}</span>`).join("");
$("freqBars").querySelectorAll("div").forEach(el => {
  const k = +el.dataset.k;
  el.addEventListener("mousemove", e => showTip(e, `${k}번 — ${freq[k]}회 (기대 ${EXP.toFixed(0)}회)`));
  el.addEventListener("mouseleave", hideTip);
});
$("chiTxt").innerHTML = `45개 번호 출현 횟수를 '모두 같은 확률' 가정과 비교: χ² = ${chi.toFixed(1)}, 자유도 44, p = ${chiPv.toFixed(2)} → `
  + (chiPv > 0.05 ? `<b>무작위 범위 안</b>. 많이 나온 번호와 적게 나온 번호의 차이는 우연으로 설명됩니다.` : `<b>균일하지 않을 가능성</b>이 있습니다.`)
  + ` 세로축은 ${lo}회부터 시작합니다.`;
$("freqTable").innerHTML = "<tr><th>번호</th><th>출현</th><th>최근50</th><th>미출현</th></tr>"
  + NUMS.map(k => `<tr><td>${k}</td><td>${freq[k]}</td><td>${c50[k]}</td><td>${gap(k)}회</td></tr>`).join("");

const mini = (k, txt) => `<div class="mini">${ball(k)}<span>${txt}</span></div>`;
$("hot").innerHTML = [...NUMS].sort((a, b) => c50[b] - c50[a] || a - b).slice(0, 6).map(k => mini(k, `${c50[k]}회`)).join("");
$("cold").innerHTML = [...NUMS].sort((a, b) => gap(b) - gap(a) || a - b).slice(0, 6).map(k => mini(k, `${gap(k)}회째`)).join("");

// ---------- 구조 검정 ----------
const tests = [];
// 이월수: 직전 회차 번호가 다시 나온 개수. 무기억이면 기대 0.8
let carry = 0; for (let i = 1; i < N; i++) carry += D[i].n.filter(x => D[i - 1].n.includes(x)).length;
tests.push(["이월수 (직전 회차 번호 재출현)", `평균 ${(carry / (N - 1)).toFixed(3)}개`, "기대 0.800", Math.abs(carry / (N - 1) - 0.8) < 3 * Math.sqrt(0.8 * 0.53 / (N - 1))]);
// 균등 6개 빠른 뽑기 (부분 Fisher-예이츠): 무작위 시뮬 등 가중치 없는 대량 추출용
function quick6(R) { const a = NUMS.slice(); for (let i = 0; i < 6; i++) { const j = i + Math.floor(R() * (45 - i)); const t = a[i]; a[i] = a[j]; a[j] = t; } return [a[0], a[1], a[2], a[3], a[4], a[5]].sort((x, y) => x - y); }
// 쌍 동시출현: 최다 쌍이 무작위 시뮬레이션 범위 안인가
const pair = new Map(); D.forEach(d => { for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const key = d.n[i] * 46 + d.n[j]; pair.set(key, (pair.get(key) || 0) + 1); } });
let pmax = 0, pkey = 0; pair.forEach((v, k) => { if (v > pmax) { pmax = v; pkey = k; } });
const simMax = []; const R0 = rng(7);
for (let s = 0; s < 40; s++) { const m = new Int16Array(46 * 46); let mx = 0;
  for (let i = 0; i < N; i++) { const t = quick6(R0); for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) { const v = ++m[t[a] * 46 + t[b]]; if (v > mx) mx = v; } }
  simMax.push(mx); }
simMax.sort((a, b) => a - b);
tests.push([`쌍 동시출현 (최다 ${Math.floor(pkey / 46)}-${pkey % 46})`, `${pmax}회`, `무작위 최다 ${simMax[1]}~${simMax[38]}회`, pmax >= simMax[1] && pmax <= simMax[38]]);
// 합계
const mean = sums.reduce((a, b) => a + b, 0) / N;
tests.push(["번호 합계 평균", mean.toFixed(1), "이론 138.0", Math.abs(mean - 138) < 3 * 29.9 / Math.sqrt(N)]);
// 연속번호
const cons = D.filter(d => d.n.some((x, i) => i && x - d.n[i - 1] === 1)).length / N, consT = 1 - C(40, 6) / C(45, 6);
tests.push(["연속번호 포함 회차", (cons * 100).toFixed(1) + "%", "이론 " + (consT * 100).toFixed(1) + "%", Math.abs(cons - consT) < 3 * Math.sqrt(consT * (1 - consT) / N)]);
tests.push(["번호별 출현 균일성", `χ² ${chi.toFixed(1)}`, `p = ${chiPv.toFixed(2)}`, chiPv > 0.05]);
$("tests").innerHTML = "<tr><th>검정</th><th>실제</th><th>무작위 기준</th><th>판정</th></tr>"
  + tests.map(([a, b, c, ok]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td><span class="tag ${ok ? "ok" : "no"}">${ok ? "패턴 없음" : "차이 있음"}</span></td></tr>`).join("");

const odd = Array(7).fill(0); D.forEach(d => odd[d.n.filter(x => x % 2).length]++);
const oddT = k => N * C(23, k) * C(22, 6 - k) / C(45, 6), omax = Math.max(...odd, ...[0,1,2,3,4,5,6].map(oddT));
$("oddChart").innerHTML = odd.map((v, k) => `<div class="hbar" data-k="${k}"><span>홀 ${k}개</span>
  <div class="track"><div class="fill" style="width:${v / omax * 100}%"></div><div class="theo" style="left:${oddT(k) / omax * 100}%"></div></div>
  <span style="text-align:right">${v} / ${oddT(k).toFixed(0)}</span></div>`).join("");
document.querySelectorAll("#oddChart .hbar").forEach(el => { const k = +el.dataset.k;
  el.addEventListener("mousemove", e => showTip(e, `홀수 ${k}개: 실제 ${odd[k]}회 · 이론 ${oddT(k).toFixed(1)}회`)); el.addEventListener("mouseleave", hideTip); });
