"""딥러닝(LSTM) 로또 예측 -> dl.js  (GitHub Actions에서 매주 실행)
직전 10회 당첨번호(45칸 0/1)를 순서대로 보고 다음 회차 45개 번호의 출현 확률을 출력한다.
1) 최근 100회를 빼고 학습 -> 그 100회를 한 회씩 예측해 성적 측정 (미래 데이터 차단)
2) 전체로 다시 학습 -> 다음 회차 확률을 dl.js에 저장
3) 회차별 기록 dlhist.json: 101회부터 매 회차를, 50회마다 '그때까지의 데이터로만' 다시 학습한 모델로 예측해 둠
   (사이트 백테스트가 딥러닝도 다른 전략과 똑같이 채점하는 데 씀. 새 회차분만 이어서 계산)
4) 보정(cal): 회차별 기록의 예측 확률을 실제 출현과 비교해, 확률을 13.3%(6/45) 쪽으로 얼마나 당겨야 실제와 맞는지(a) 계산
모델은 시작값만 다른 ENS개를 학습해 확률을 평균 (한 모델의 우연한 치우침을 줄여 매주 예측이 덜 흔들리게)
사용: python dl_train.py   (dl.js·dlhist.json이 이미 최신 회차면 건너뜀, --force로 dl.js 강제)
"""
import csv, json, math, os, sys
from datetime import date
import numpy as np
import torch
from torch import nn

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "dl.js")
HIST = os.path.join(HERE, "dlhist.json")
W, EPOCHS, HOLD, UNITS = 10, 30, 100, 32
STEP, FROM, HVER = 50, 100, 2  # 50회마다 재학습, 0부터 센 100번째 = 101회(사이트 BT_START), 기록 형식 버전(2: 5개 평균)
ENS = 5  # 평균 낼 모델 수

draws = []
with open(os.path.join(HERE, "lotto645.csv"), encoding="utf-8-sig") as f:
    for r in csv.reader(f):
        if r and r[0].isdigit():
            draws.append([int(x) for x in r[2:8]])
N = len(draws)

def load_hist():
    try:
        with open(HIST, encoding="utf-8") as f:
            h = json.load(f)
        return h if h.get("ver") == HVER and h.get("step") == STEP and h.get("from") == FROM + 1 else None
    except Exception:
        return None


dl_fresh = False
if "--force" not in sys.argv and os.path.exists(OUT):
    with open(OUT, encoding="utf-8") as f:
        dl_fresh = json.loads(f.read().split("=", 1)[1].rstrip().rstrip(";"))["last"] == N
hist0 = load_hist()
if dl_fresh and hist0 and hist0["last"] == N:
    print(f"dl.js·dlhist.json이 이미 {N}회 기준이라 건너뜀"); sys.exit(0)

hot = np.zeros((N, 45), dtype=np.float32)
for i, ns in enumerate(draws):
    hot[i, [x - 1 for x in ns]] = 1


class Net(nn.Module):
    def __init__(s):
        super().__init__()
        s.lstm = nn.LSTM(45, UNITS, batch_first=True)
        s.drop = nn.Dropout(0.2)
        s.out = nn.Linear(UNITS, 45)

    def forward(s, x):
        _, (h, _) = s.lstm(x)
        return s.out(s.drop(h[-1]))  # logit


def train(upto):
    """hot[0:upto]만으로 시작값이 다른 모델 ENS개를 학습 (upto 이후 회차는 보지 않음)."""
    return [train1(upto, upto * 10 + s) for s in range(ENS)]


def train1(upto, seed):
    torch.manual_seed(seed)  # 같은 데이터·같은 시드면 같은 결과
    X = torch.tensor(np.stack([hot[i - W:i] for i in range(W, upto)]))
    Y = torch.tensor(hot[W:upto])
    m = Net(); opt = torch.optim.Adam(m.parameters(), lr=0.005); lossf = nn.BCEWithLogitsLoss()
    g = torch.Generator().manual_seed(seed)
    for ep in range(EPOCHS):
        m.train(); tot = 0
        for idx in torch.randperm(len(X), generator=g).split(64):
            opt.zero_grad(); loss = lossf(m(X[idx]), Y[idx]); loss.backward(); opt.step(); tot += loss.item() * len(idx)
        if ep in (0, EPOCHS - 1):
            print(f"  학습 {upto}회까지 #{seed % 10 + 1} epoch {ep + 1}/{EPOCHS} loss {tot / len(X):.4f}")
    m.eval()
    return m


def predict(ms, end):
    """hot[end-W:end] -> 회차 end(0-based)의 45개 확률 (모델들의 평균)."""
    with torch.no_grad():
        x = torch.tensor(hot[None, end - W:end])
        return np.mean([torch.sigmoid(m(x)).numpy()[0] for m in ms], axis=0)


def calibrate(ps):
    """회차별 기록(천분율)과 실제 당첨번호로 보정값 계산. 보정 확률 = 6/45 + a × (모델 확률 − 6/45).
    a는 0~1에서 로그손실(예측이 빗나간 정도)이 가장 작은 값. a=0이면 '모델이 아무 정보도 못 줌'."""
    p0 = 6 / 45
    P = np.array(ps, dtype=np.float64) / 1000
    Y = np.zeros_like(P)
    for j in range(len(ps)):
        Y[j, [x - 1 for x in draws[FROM + j]]] = 1
    def ll(a):
        q = np.clip(p0 + a * (P - p0), 1e-6, 1 - 1e-6)
        return float(-(Y * np.log(q) + (1 - Y) * np.log(1 - q)).mean())
    a = min((k / 100 for k in range(101)), key=ll)
    edges = [0, .10, .12, .14, .16, 1]
    bins = []
    for lo, hi in zip(edges, edges[1:]):
        m = (P >= lo) & (P < hi)
        if m.sum():
            bins.append([lo, hi, int(m.sum()), round(float(Y[m].mean()), 4)])
    return {"a": a, "ll": round(ll(1), 5), "ll0": round(ll(0), 5), "n": len(ps), "bins": bins}


def build_hist():
    """회차별 기록: 회차 i(0부터)는 STEP의 배수 b = i//STEP*STEP 까지의 데이터로만 학습한 모델로 예측 (i 이후는 안 봄)."""
    h = load_hist()
    ps = h["p"][:N - FROM] if h else []
    mb, m = None, None
    for i in range(FROM + len(ps), N):
        b = i // STEP * STEP
        if b != mb:
            m, mb = train(b), b
        ps.append([int(round(float(v) * 1000)) for v in predict(m, i)])  # 천분율 정수로 저장 (파일 크기 절약)
    assert len(ps) == N - FROM and all(len(x) == 45 for x in ps)
    with open(HIST, "w", encoding="utf-8") as f:
        json.dump({"ver": HVER, "step": STEP, "from": FROM + 1, "last": N, "p": ps}, f, separators=(",", ":"))
    print(f"dlhist.json 저장: {FROM + 1}~{N}회 {len(ps)}회분")
    return ps


cal = calibrate(build_hist())
print(f"보정: a={cal['a']} (로그손실 모델 {cal['ll']} / 모두 13.3% {cal['ll0']})")
if dl_fresh:
    print("dl.js는 이미 최신이라 회차별 기록만 갱신"); sys.exit(0)

# 1) 홀드아웃 검증: 상위 30개를 겹치지 않게 5게임으로 나눠 실제와 비교 (백테스트 표와 같은 방식)
cut = N - HOLD
m1 = train(cut)
hit = n = h3 = h4 = 0
for i in range(cut, N):
    order = list(np.argsort(-predict(m1, i), kind="stable") + 1)
    win = set(draws[i])
    for g in range(5):
        h = sum(order[g + j * 5] in win for j in range(6))
        hit += h; n += 1; h3 += h >= 3; h4 += h >= 4
mean = hit / n
z = (mean - 0.8) / math.sqrt(0.8 * (39 / 45) * (39 / 44) / n)
print(f"홀드아웃 {cut + 1}~{N}회: 평균 일치 {mean:.3f} (무작위 0.800), z={z:+.2f}")

# 2) 전체로 학습 -> 다음 회차
p = predict(train(N), N)
# 지난 예측 보관: 기존 dl.js가 바로 이번에 들어온 회차(N)를 예측했던 것이면 '예측 vs 실제' 비교용으로 남김
prev = None
if os.path.exists(OUT):
    with open(OUT, encoding="utf-8") as f:
        old = json.loads(f.read().split("=", 1)[1].rstrip().rstrip(";"))
    prev = {"no": N, "p": old["p"]} if old["last"] + 1 == N else old.get("prev")
res = {"last": N, "p": [round(float(v), 5) for v in p], "hit": hit, "n": n, "h3": h3, "h4": h4, "prev": prev, "cal": cal,
       "model": f"LSTM({UNITS}) {ENS}개 평균, 창 {W}회, {EPOCHS} epoch, PyTorch {torch.__version__}", "trained": date.today().isoformat()}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.LOTTO_DL=" + json.dumps(res, ensure_ascii=False, separators=(",", ":")) + ";\n")
assert len(res["p"]) == 45 and all(0 < v < 1 for v in res["p"]) and 0 <= cal["a"] <= 1
print(f"dl.js 저장: {N + 1}회 예측 상위 6개 {sorted((np.argsort(-p)[:6] + 1).tolist())}")
