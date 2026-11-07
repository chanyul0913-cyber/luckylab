"""로또6/45 Claude(AI B) 독립 분석. 입력 lotto645.csv -> 출력 analysis_result.txt
과거 통계가 미래 확률을 높인다는 전제는 두지 않는다. 백테스트가 그 전제를 검증한다.
"""
import csv, os, random, math, statistics as st
from collections import Counter
from datetime import date
from itertools import combinations
from math import comb

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = []
def p(*a):
    OUT.append(" ".join(str(x) for x in a))

# ---------- PART 1. 데이터 ----------
draws = []  # (회차, date, [본번호6], 보너스)
with open(os.path.join(HERE, "lotto645.csv"), encoding="utf-8-sig") as f:
    for r in csv.reader(f):
        if r and r[0].isdigit():
            d = r[1]
            draws.append((int(r[0]), date(int(d[:4]), int(d[4:6]), int(d[6:])), [int(x) for x in r[2:8]], int(r[8])))
N = len(draws); LAST = draws[-1][0]
eps = [e for e, *_ in draws]
assert eps == list(range(1, N + 1)), "회차 누락/중복"
for e, d, ns, b in draws:
    assert len(ns) == 6 and len(set(ns)) == 6 and ns == sorted(ns), e
    assert all(1 <= x <= 45 for x in ns + [b]) and b not in ns, e
bad_dates = [(draws[i][0], (draws[i][1] - draws[i - 1][1]).days) for i in range(1, N) if (draws[i][1] - draws[i - 1][1]).days != 7]
p(f"[PART1] 출처: 동행복권 /lt645/selectPstLt645InfoNew.do, 1~{LAST}회 {N}건, {draws[0][1]}~{draws[-1][1]}")
p(f"  검증: 회차 연속·중복 없음, 번호 범위/중복/정렬/보너스 분리 통과, 7일 간격 아닌 회차: {bad_dates or '없음'}")
p(f"  모든 통계는 본번호 6개만 사용, 보너스는 백테스트에서 별도 기록")

# ---------- PART 2. 통계 ----------
def freq_of(ds):
    return Counter(n for *_, ns, _ in ds for n in ns)
fall = freq_of(draws)
exp = N * 6 / 45
chi = sum((fall[k] - exp) ** 2 / exp for k in range(1, 46))
sd = math.sqrt(N * (6 / 45) * (39 / 45))
p(f"\n[A 빈도] 번호당 기대 {exp:.1f}회, 이항 표준편차 {sd:.1f}, 카이제곱 {chi:.2f} (df44, 5%임계 60.48)")
ranked = sorted(range(1, 46), key=lambda k: -fall[k])
p("  상위10:", ", ".join(f"{k}({fall[k]},z{(fall[k]-exp)/sd:+.1f})" for k in ranked[:10]))
p("  하위10:", ", ".join(f"{k}({fall[k]},z{(fall[k]-exp)/sd:+.1f})" for k in ranked[-10:]))
p(f"  |z|>2 번호 수: {sum(abs(fall[k]-exp)/sd > 2 for k in range(1,46))}개 (우연 기대 약 {45*0.0455:.1f}개)")
for w in (10, 20, 30, 50, 100):
    fw = freq_of(draws[-w:])
    top = sorted(range(1, 46), key=lambda k: (-fw[k], k))[:8]
    zero = [k for k in range(1, 46) if fw[k] == 0]
    p(f"  최근{w:3d}회(기대 {w*6/45:.1f}): 상위 " + ", ".join(f"{k}({fw[k]})" for k in top) + f" | 0회 {len(zero)}개{zero if len(zero)<=12 else ''}")

# B 미출현
seen = {k: [] for k in range(1, 46)}
for e, _, ns, _ in draws:
    for n in ns:
        seen[n].append(e)
p(f"\n[B 미출현] 이론 평균간격 {45/6:.2f}회")
rows = []
for k in range(1, 46):
    s = seen[k]
    ints = [b - a for a, b in zip(s, s[1:])]
    cur = LAST - s[-1]
    rows.append((cur, k, s[-1], st.mean(ints), max(ints + [s[0] - 0, cur])))
rows.sort(reverse=True)
for cur, k, ls, avg, mx in rows[:10]:
    p(f"  {k:2d}: 현재 {cur}회 미출현, 마지막 {ls}회, 평균간격 {avg:.2f}, 역대최장 {mx}")
p(f"  현재 최장 {rows[0][0]}회: 한 번호가 이만큼 안 나올 확률 {(39/45)**rows[0][0]:.3f}, 45개 중 하나라도 {1-(1-(39/45)**rows[0][0])**45:.2f}")

# C 구조
odd = Counter(sum(x % 2 for x in ns) for *_, ns, _ in draws)
p("\n[C 구조] 홀수 개수 분포 (실제 / 이론):")
p("  " + "  ".join(f"{k}:{odd[k]}/{N*comb(23,k)*comb(22,6-k)/comb(45,6):.0f}" for k in range(7)))
buckets = [(1, 10), (11, 20), (21, 30), (31, 40), (41, 45)]
bc = Counter()
for *_, ns, _ in draws:
    for x in ns:
        bc[next(i for i, (a, b) in enumerate(buckets) if a <= x <= b)] += 1
p("  구간 출현 (실제/기대): " + "  ".join(f"{a}-{b}:{bc[i]}/{N*6*(b-a+1)/45:.0f}" for i, (a, b) in enumerate(buckets)))
low = Counter(sum(x <= 22 for x in ns) for *_, ns, _ in draws)
p("  저번호(1~22) 개수 분포: " + " ".join(f"{k}:{low[k]}" for k in range(7)))
sums = [sum(ns) for *_, ns, _ in draws]
q = st.quantiles(sums, n=4)
p(f"  합계: 평균 {st.mean(sums):.1f} (이론 138.0), 표준편차 {st.pstdev(sums):.1f} (이론 {math.sqrt(6*(45**2-1)/12*(39/44)):.1f}), 사분위 {q[0]:.0f}/{q[1]:.0f}/{q[2]:.0f}")
gaps = [b - a for *_, ns, _ in draws for a, b in zip(ns, ns[1:])]
p(f"  인접 번호 간격 평균 {st.mean(gaps):.2f} (이론 (45+1)/7 = {46/7:.2f})")
cons = sum(any(b - a == 1 for a, b in zip(ns, ns[1:])) for *_, ns, _ in draws)
p(f"  연속번호 포함 회차 {cons}/{N} = {cons/N:.3f} (이론 {1-comb(40,6)/comb(45,6):.3f})")
ld = Counter(x % 10 for *_, ns, _ in draws for x in ns)
p("  끝자리 (실제/기대): " + " ".join(f"{d}:{ld[d]}/{N*6*sum(1 for x in range(1,46) if x%10==d)/45:.0f}" for d in range(10)))

# D 관계
pairs = Counter(pp for *_, ns, _ in draws for pp in combinations(ns, 2))
tri = Counter(t for *_, ns, _ in draws for t in combinations(ns, 3))
pexp = N * comb(43, 4) / comb(45, 6); texp = N * comb(42, 3) / comb(45, 6)
p(f"\n[D 관계] 쌍 기대 {pexp:.2f}회, 삼중 기대 {texp:.3f}회")
p("  쌍 상위10: " + ", ".join(f"{a}-{b}({v})" for (a, b), v in pairs.most_common(10)))
p("  삼중 상위10: " + ", ".join(f"{'-'.join(map(str,t))}({v})" for t, v in tri.most_common(10)))
rng = random.Random(0)
smax_p, smax_t = [], []
for _ in range(200):
    sim = [sorted(rng.sample(range(1, 46), 6)) for _ in range(N)]
    smax_p.append(max(Counter(pp for s in sim for pp in combinations(s, 2)).values()))
    smax_t.append(max(Counter(t for s in sim for t in combinations(s, 3)).values()))
smax_p.sort(); smax_t.sort()
p(f"  무작위 시뮬 200회 최대값 95%구간: 쌍 {smax_p[5]}~{smax_p[194]} (실제 {pairs.most_common(1)[0][1]}), 삼중 {smax_t[5]}~{smax_t[194]} (실제 {tri.most_common(1)[0][1]})")
full = Counter(tuple(ns) for *_, ns, _ in draws)
p(f"  6개 조합 중복 출현: {sum(v>1 for v in full.values())}건")

# ---------- 모델 (t회차 예측에 draws[:t-1]만 사용) ----------
class State:
    """과거 회차를 하나씩 먹이면서 통계를 누적. 미래 데이터는 구조상 들어올 수 없음."""
    DECAY = 0.98  # 최근 가중: 점수_k = Σ 0.98^(경과회차) * [k 출현]
    def __init__(s):
        s.n = 0; s.freq = [0] * 46; s.last = [0] * 46; s.w = [0.0] * 46
        s.pair = [[0] * 46 for _ in range(46)]; s.hist = []; s.sums = []
    def add(s, e, ns):
        s.n += 1; s.hist.append(ns); s.sums.append(sum(ns))
        s.w = [v * s.DECAY for v in s.w]
        for x in ns:
            s.freq[x] += 1; s.last[x] = e; s.w[x] += 1
        for a, b in combinations(ns, 2):
            s.pair[a][b] += 1; s.pair[b][a] += 1

def split5(order):  # 상위 30개를 라운드로빈으로 5세트(세트 간 중복 없음)
    return [sorted(order[i:30:5]) for i in range(5)]
NUMS = list(range(1, 46))
def m_all(s, r):    return split5(sorted(NUMS, key=lambda k: (-s.freq[k], k)))
def m_wt(s, r):     return split5(sorted(NUMS, key=lambda k: (-s.w[k], k)))
def m_r50(s, r):
    c = Counter(x for ns in s.hist[-50:] for x in ns)
    return split5(sorted(NUMS, key=lambda k: (-c[k], k)))
def m_gap(s, r):    return split5(sorted(NUMS, key=lambda k: (s.last[k], k)))
def m_pair(s, r):
    used, out = set(), []
    for _ in range(5):
        cur = [max((k for k in NUMS if k not in used), key=lambda k: (s.freq[k], -k))]
        used.add(cur[0])
        while len(cur) < 6:
            k = max((k for k in NUMS if k not in used), key=lambda k: (sum(s.pair[k][c] for c in cur), -k))
            cur.append(k); used.add(k)
        out.append(sorted(cur))
    return out
def rand_sets(r, ok=lambda x: True):
    out = []
    while len(out) < 5:
        x = sorted(r.sample(NUMS, 6))
        if ok(x):
            out.append(x)
    return out
def spread_ok(x):
    return 2 <= sum(v % 2 for v in x) <= 4 and len({min(4, (v - 1) // 10) for v in x}) >= 4
def m_spread(s, r): return rand_sets(r, spread_ok)
def m_struct(s, r):
    q = st.quantiles(s.sums, n=4)
    return rand_sets(r, lambda x: q[0] <= sum(x) <= q[2] and not any(b - a == 1 and c - b == 1 for a, b, c in zip(x, x[1:], x[2:])))
def m_rand(s, r):   return rand_sets(r)
MODELS = {"1 전체빈도": m_all, "2 최근가중(0.98^age)": m_wt, "3 최근50빈도": m_r50, "4 장기미출현": m_gap,
          "5 동반출현": m_pair, "6 홀짝·구간분산": m_spread, "7 조합구조(합계IQR)": m_struct, "8 무작위": m_rand}

# ---------- PART 3. 백테스트 ----------
START = 101
state = State()
for e, _, ns, _ in draws[:START - 1]:
    state.add(e, ns)
rec = {m: [] for m in MODELS}  # (회차, 일치수, 보너스포함)
rng = random.Random(12345)
for e, _, ns, b in draws[START - 1:]:
    win = set(ns)
    for m, fn in MODELS.items():
        for x in fn(state, rng):
            rec[m].append((e, len(win & set(x)), b in x))
    state.add(e, ns)  # 예측 후에야 해당 회차를 학습

P = {k: comb(6, k) * comb(39, 6 - k) / comb(45, 6) for k in range(7)}
MU = 0.8; VAR = sum(k * k * P[k] for k in range(7)) - MU ** 2
tail = lambda t: sum(P[k] for k in range(t, 7))
ZC = 2.69  # 두 방향 5%를 비무작위 7개 모델로 본페로니 보정 (0.05/7)
p(f"\n[PART3] 백테스트: {START}~{LAST}회, 매 회차 직전까지 데이터로 5세트 생성 후 실제 결과와 비교")
p(f"  이론 무작위 기준: 평균일치 {MU:.3f}, 3+ {tail(3):.4f}, 4+ {tail(4):.5f}, 5+ {tail(5):.7f}, 보너스 포함 {6/45:.4f}")
for label, lo in (("전체", START), ("최근100", LAST - 99), ("최근50", LAST - 49)):
    p(f"  -- {label} ({lo}~{LAST}회, 회당 5게임) --")
    for m in MODELS:
        r = [(h, bb) for e, h, bb in rec[m] if e >= lo]
        n = len(r); hs = [h for h, _ in r]
        mean = sum(hs) / n
        z = (mean - MU) / math.sqrt(VAR / n)
        p(f"  {m:20s} n={n:5d} 평균 {mean:.3f}  3+ {sum(h>=3 for h in hs)/n:.4f}  4+ {sum(h>=4 for h in hs)}  5+ {sum(h>=5 for h in hs)}  "
          f"5+보너스 {sum(h==5 and bb for h,bb in r)}  보너스 {sum(bb for _,bb in r)/n:.3f}  z={z:+.2f}{' *' if abs(z)>ZC else ''}")
# 반복 무작위 시뮬: 같은 회차·같은 게임 수에서 무작위 5세트 평균일치 분포
sim_rng = random.Random(777)
wins = [set(ns) for *_, ns, _ in draws[START - 1:]]
sims = sorted(sum(len(w & set(sim_rng.sample(NUMS, 6))) for w in wins for _ in range(5)) / (len(wins) * 5) for _ in range(300))
p(f"  무작위 반복 시뮬 300회 평균일치 95%구간 (전체): {sims[7]:.3f}~{sims[292]:.3f}")
p(f"  판정 기준: |z|>{ZC} (본페로니). '*' 표시 모델이 없으면 예측력 입증되지 않음")

# ---------- PART 5. 최종 5세트 (1~LAST 전체 사용) ----------
fin = State()
for e, _, ns, _ in draws:
    fin.add(e, ns)
r = random.Random(LAST + 1)
used = set()
def pick(cands, k):  # 아직 안 쓴 번호에서 우선순위대로 k개
    out = [c for c in cands if c not in used][:k]
    used.update(out); return out
c50 = Counter(x for ns in fin.hist[-50:] for x in ns)
by_all = sorted(NUMS, key=lambda k: (-fin.freq[k], k))
# 미출현형을 먼저 뽑아야 최장 미출현 번호가 다른 세트에 선점되지 않음
s3 = sorted(pick(sorted(NUMS, key=lambda k: (fin.last[k], k)), 2) + pick(r.sample(NUMS, 45), 4))
s1 = sorted(pick(by_all[:15], 3) + pick(by_all[15:30], 3))  # 상위·중위 섞은 균형형
s2 = sorted(pick(sorted(NUMS, key=lambda k: (-c50[k], k)), 6))
s4 = []
for a, b in buckets:
    s4 += pick(r.sample(range(a, b + 1), b - a + 1), 1)
s4 = sorted(s4 + pick(r.sample(NUMS, 45), 1))
s5 = sorted(r.sample(NUMS, 6))  # 독립 무작위: 중복 허용 (다른 세트와 겹쳐도 그대로 둠)
final = [s1, s2, s3, s4, s5]
for s in final:
    assert len(s) == 6 and len(set(s)) == 6 and all(1 <= x <= 45 for x in s) and s == sorted(s)
p(f"\n[PART5] {LAST+1}회용 (데이터 1~{LAST}회, 시드 {LAST+1})")
names = ["전체 통계 균형형", "최근 50회 참고형", "미출현 포함형", "구간 분산형", "무작위 혼합형"]
for i, (s, nm) in enumerate(zip(final, names), 1):
    p(f"  {i}. {' '.join(f'{x:2d}' for x in s)}  합{sum(s)} 홀{sum(x%2 for x in s)}  {nm}  과거1등조합 {'일치' if tuple(s) in full else '없음'}")
p(f"  세트 간 겹치는 번호: {sorted(k for k, v in Counter(x for s in final for x in s).items() if v > 1)}")

txt = "\n".join(OUT)
print(txt)
with open(os.path.join(HERE, "analysis_result.txt"), "w", encoding="utf-8") as f:
    f.write(txt + "\n")
