"""딥러닝(LSTM) 로또 예측 -> dl.js  (GitHub Actions에서 매주 실행)
직전 10회 당첨번호(45칸 0/1)를 순서대로 보고 다음 회차 45개 번호의 출현 확률을 출력한다.
1) 최근 100회를 빼고 학습 -> 그 100회를 한 회씩 예측해 성적 측정 (미래 데이터 차단)
2) 전체로 다시 학습 -> 다음 회차 확률을 dl.js에 저장
사용: python dl_train.py   (dl.js가 이미 최신 회차면 건너뜀, --force로 강제)
"""
import csv, json, math, os, sys
from datetime import date
import numpy as np
import torch
from torch import nn

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "dl.js")
W, EPOCHS, HOLD, UNITS = 10, 30, 100, 32

draws = []
with open(os.path.join(HERE, "lotto645.csv"), encoding="utf-8-sig") as f:
    for r in csv.reader(f):
        if r and r[0].isdigit():
            draws.append([int(x) for x in r[2:8]])
N = len(draws)

if "--force" not in sys.argv and os.path.exists(OUT):
    with open(OUT, encoding="utf-8") as f:
        if json.loads(f.read().split("=", 1)[1].rstrip().rstrip(";"))["last"] == N:
            print(f"dl.js가 이미 {N}회 기준이라 건너뜀"); sys.exit(0)

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
    """hot[0:upto]만으로 학습 (upto 이후 회차는 보지 않음)."""
    torch.manual_seed(upto)  # 같은 데이터면 같은 결과
    X = torch.tensor(np.stack([hot[i - W:i] for i in range(W, upto)]))
    Y = torch.tensor(hot[W:upto])
    m = Net(); opt = torch.optim.Adam(m.parameters(), lr=0.005); lossf = nn.BCEWithLogitsLoss()
    g = torch.Generator().manual_seed(upto)
    for ep in range(EPOCHS):
        m.train(); tot = 0
        for idx in torch.randperm(len(X), generator=g).split(64):
            opt.zero_grad(); loss = lossf(m(X[idx]), Y[idx]); loss.backward(); opt.step(); tot += loss.item() * len(idx)
        if ep in (0, EPOCHS - 1):
            print(f"  학습 {upto}회까지 epoch {ep + 1}/{EPOCHS} loss {tot / len(X):.4f}")
    m.eval()
    return m


def predict(m, end):
    """hot[end-W:end] -> 회차 end(0-based)의 45개 확률."""
    with torch.no_grad():
        return torch.sigmoid(m(torch.tensor(hot[None, end - W:end]))).numpy()[0]


# 1) 홀드아웃 검증: 상위 30개를 겹치지 않게 5게임으로 나눠 실제와 비교 (백테스트 표와 같은 방식)
cut = N - HOLD
m1 = train(cut)
hit = n = 0
for i in range(cut, N):
    order = list(np.argsort(-predict(m1, i), kind="stable") + 1)
    win = set(draws[i])
    for g in range(5):
        hit += sum(order[g + j * 5] in win for j in range(6)); n += 1
mean = hit / n
z = (mean - 0.8) / math.sqrt(0.8 * (39 / 45) * (39 / 44) / n)
print(f"홀드아웃 {cut + 1}~{N}회: 평균 일치 {mean:.3f} (무작위 0.800), z={z:+.2f}")

# 2) 전체로 학습 -> 다음 회차
p = predict(train(N), N)
res = {"last": N, "p": [round(float(v), 5) for v in p], "hit": hit, "n": n,
       "model": f"LSTM({UNITS}) 창 {W}회, {EPOCHS} epoch, PyTorch {torch.__version__}", "trained": date.today().isoformat()}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.LOTTO_DL=" + json.dumps(res, ensure_ascii=False, separators=(",", ":")) + ";\n")
assert len(res["p"]) == 45 and all(0 < v < 1 for v in res["p"])
print(f"dl.js 저장: {N + 1}회 예측 상위 6개 {sorted((np.argsort(-p)[:6] + 1).tolist())}")
