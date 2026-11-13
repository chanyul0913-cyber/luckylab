// 로분소 5/5 — 자가 점검 selfTest()와 첫 백테스트 시작
// 여러 파일이지만 순서대로 읽히는 한 덩어리 프로그램이다 (index.html의 <script> 순서를 바꾸지 말 것)
"use strict";
// ---------- 자가 점검 (어떤 AI 도구로 고쳤든 수정 후 브라우저 콘솔에서 await selfTest() 실행) ----------
// problems가 비어 있어야 정상. 화면 상태(게임 선택 등)는 건드리지 않음
window.selfTest = async function selfTest() {
  const problems = [], warnings = [], ok6 = s => Array.isArray(s) && s.length === 6 && new Set(s).size === 6
    && s.every((x, i) => Number.isInteger(x) && x >= 1 && x <= 45 && (!i || s[i - 1] < x));
  // 1) 데이터: 회차 연속, 번호 형식, 7일 간격
  D.forEach((d, i) => {
    if (d.no !== i + 1) problems.push(`데이터: ${i + 1}번째 회차 번호가 ${d.no}`);
    if (!ok6(d.n) || d.n.includes(d.b)) problems.push(`데이터: ${d.no}회 번호 이상`);
    if (i && (drawDay(d) - drawDay(D[i - 1])) / 864e5 !== 7) warnings.push(`데이터: ${d.no}회가 직전 회차와 7일 간격이 아님`);
  });
  if (!LAST.sales && !LAST.w1) warnings.push(`데이터: ${LAST.no}회 당첨금 집계 전 (다음 자동 갱신 때 채워짐)`);
  // 2) 전략 목록: 묶음에 빠짐·중복 없음, 설명 있음
  const g = GROUPS.flatMap(x => x[1]);
  if (g.length !== new Set(g).size || g.slice().sort().join() !== SKEYS.slice().sort().join()) problems.push("전략: GROUPS와 STRATS가 맞지 않음");
  SKEYS.forEach(k => { if (!STRATS[k][0] || !STRATS[k][1]) problems.push(`전략: ${k} 이름/설명 없음`); });
  // 3) 전략마다 30번씩 뽑아 6개 형식 + 제외 규칙(okShape) 통과 확인
  for (const k of SKEYS) {
    if (k === "btop") continue; // 다른 전략으로 연결될 뿐 자체 함수 없음
    if (PROFILE.includes(k) && !saju) { warnings.push(`전략: ${k}는 내 정보가 없어 건너뜀`); continue; }
    if (k === "deep" && !dl) { warnings.push("전략: deep은 dl.js가 최신 회차가 아니라 건너뜀"); continue; }
    if ((k === "manse" || k === "celeb") && !window.Solar) { warnings.push(`전략: ${k}는 만세력 라이브러리가 없어 건너뜀`); continue; }
    const R = rng(hashStr(k) + 1);
    for (let t = 0; t < 30; t++) {
      let s, tries = 0;
      try { do s = STRATS[k][2](R, LIVE, t % 10); while (++tries < 5000 && !okShape(s)); }
      catch (e) { problems.push(`전략: ${k} 실행 오류 ${e.message}`); break; }
      if (!ok6(s)) { problems.push(`전략: ${k}가 잘못된 번호 ${s}`); break; }
      if (!okShape(s)) { problems.push(`전략: ${k}가 제외 규칙을 못 통과 ${s}`); break; }
    }
  }
  // 4) 부가 데이터
  if (window.LOTTO_DL && LOTTO_DL.last !== N) warnings.push(`딥러닝: dl.js가 ${LOTTO_DL.last}회 기준 (최신 ${N}회, 다음 학습 때 갱신)`);
  if (!RICH) warnings.push("세계 부자: rich.js가 없어 2026 연간 순위로 표시 중");
  if (window.LOTTO_RICH && window.LOTTO_RICH.ver !== undefined && window.LOTTO_RICH.ver !== 1)
    problems.push(`세계 부자: rich.js 형식 버전(${window.LOTTO_RICH.ver})이 화면(1)과 다름 — 화면을 먼저 고쳐야 함`);
  // 5) 백테스트 계산 완료와 숫자 이상 여부
  for (let w = 0; btBusy && w < 100; w++) await new Promise(r => setTimeout(r, 300));
  if (btBusy) problems.push("백테스트: 30초 안에 끝나지 않음");
  Object.entries(BT).forEach(([k, r]) => { if (!r.n || !isFinite(r.hit / r.n)) problems.push(`백테스트: ${k} 결과 이상`); });
  // 6) 유닛 검사: 계산 엔진의 기본 약속들 (2026-11-12 — selfTest를 유닛 테스트로 확장)
  {
    const r1 = rng(12345), r2 = rng(12345);
    const a1 = [r1(), r1(), r1()], a2 = [r2(), r2(), r2()];
    if (a1.join() !== a2.join() || !a1.every(v => v >= 0 && v < 1)) problems.push("유닛: rng 같은 시드 → 같은 수열(0 이상 1 미만)이 아님");
    if (typeof hashStr("가") !== "number" || hashStr("가") !== hashStr("가")) problems.push("유닛: hashStr 같은 입력에 같은 숫자가 아님");
    const bad = [[1, 2, 3, 4, 5, 6], [5, 10, 15, 20, 25, 30], [1, 4, 6, 8, 9, 10]];   // 3연속 · 등차 · 구간 몰림+합성수 5개
    if (bad.some(b => okShape(b))) problems.push("유닛: okShape가 규칙 위반 조합을 통과시킴");
    let good = null;
    try { for (let t = 0; t < 500 && !good; t++) { const s = STRATS.balance[2](rng(t + 1), LIVE, t % 10); if (okShape(s)) good = s; } } catch {}
    if (!good) warnings.push("유닛: balance로 okShape 통과 조합을 못 만들어 건너뜀"); else if (!okShape(good)) problems.push("유닛: okShape가 옳은 조합을 거름");
    const qw = quantumWeights(freq, c50, gap, N);
    if (!NUMS.every(k => Number.isFinite(qw[k]) && qw[k] >= 0)) problems.push("유닛: quantumWeights에 음수·비정상 값");
    const wasFC = btFromCache; saveBTCache(); const okc = loadBTCache(); btFromCache = wasFC;   // 캐시 저장→읽기 왕복(화면 표시는 원래대로)
    if (!okc) problems.push("유닛: 백테스트 캐시 저장→읽기 실패");
  }
  const res = { ok: !problems.length, problems, warnings };
  console.log(res.ok ? "✅ selfTest 통과" : "❌ selfTest 문제 발견", res);
  return res;
};
window.btReady = true;
// 딥러닝 회차별 기록(dlhist.json): 50회마다 다시 학습한 모델이 '그 회차 전에' 낸 예측 — 딥러닝도 다른 전략처럼 백테스트하기 위함
let DLH = null;
async function loadDLH() {
  if (DLH || !dl) return DLH;
  try {
    const h = await (await fetch(`dlhist.json?n=${N}`)).json();
    if (h.last === N && h.from === BT_START && h.p.length === N - BT_START + 1) DLH = h; // 최신 회차까지 빠짐없이 있을 때만 사용
  } catch {} // 없거나 못 받으면 예전처럼 최근 100회 성적만 표시
  return DLH;
}
function runBaseBT() { // 기본 전략 백테스트 전체 다시 계산 (캐시 무시)
  Object.keys(BT).forEach(k => delete BT[k]);
  btProfileKey = null;
  btFromCache = false; btBusy = true; renderBT();
  loadDLH().then(() => startBT(DLH ? baseKeys.concat("deep") : baseKeys, res => { Object.assign(BT, res); btBusy = false; computeMeta(); saveBTCache(); renderBT(); backtestProfile(); }));
}
if (loadBTCache()) { renderBT(); backtestProfile(); } // 같은 코드·같은 회차면 지난 결과를 그대로 표시
else runBaseBT();
