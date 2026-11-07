"""동행복권 로또6/45 전 회차 당첨정보 수집 -> lotto645.csv
사용: python fetch_lotto.py   (기존 CSV가 있으면 이어서 받음)
"""
import csv, json, os, time, urllib.request

URL = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={}"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lotto645.csv")
COLS = ["ltEpsd", "ltRflYmd", "tm1WnNo", "tm2WnNo", "tm3WnNo", "tm4WnNo", "tm5WnNo", "tm6WnNo", "bnsWnNo",
        "rnk1WnNope", "rnk1WnAmt", "rnk2WnNope", "rnk2WnAmt", "rnk3WnNope", "rnk3WnAmt",
        "rnk4WnNope", "rnk4WnAmt", "rnk5WnNope", "rnk5WnAmt", "sumWnNope", "rlvtEpsdSumNtslAmt"]
HDR = ["회차", "추첨일", "번호1", "번호2", "번호3", "번호4", "번호5", "번호6", "보너스",
       "1등당첨자수", "1등당첨금", "2등당첨자수", "2등당첨금", "3등당첨자수", "3등당첨금",
       "4등당첨자수", "4등당첨금", "5등당첨자수", "5등당첨금", "총당첨자수", "총판매액"]


def fetch(epsd):
    req = urllib.request.Request(URL.format(epsd), headers={
        "User-Agent": "Mozilla/5.0", "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.dhlottery.co.kr/lt645/result"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["data"]["list"] or []


rows = {}
if os.path.exists(OUT):
    with open(OUT, encoding="utf-8-sig") as f:
        for r in csv.reader(f):
            if r and r[0].isdigit():
                rows[int(r[0])] = r

epsd = max(rows, default=0) + 1
while True:
    got = [d for d in fetch(epsd) if int(d["ltEpsd"]) not in rows]
    if not got:
        break  # 서버가 더 이상 새 회차를 주지 않음 = 최신 회차까지 수집 완료
    for d in got:
        rows[int(d["ltEpsd"])] = [d[c] for c in COLS]
    print(f"{min(rows)}~{max(rows)}회 ({len(rows)}건)")
    epsd = max(rows) + 1
    time.sleep(0.5)  # 서버 부담 줄이기

# 추첨 직후에 받으면 당첨금 발표 전이라 판매액·당첨자 수가 0으로 옴 → 그런 회차는 다시 받아 채움
for k in [k for k in sorted(rows) if int(rows[k][20]) == 0]:
    for d in fetch(k):
        if int(d["ltEpsd"]) == k and int(d["rlvtEpsdSumNtslAmt"]) > 0:
            rows[k] = [d[c] for c in COLS]
            print(f"{k}회 당첨금 정보 채움")
    time.sleep(0.5)

with open(OUT, "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f)
    w.writerow(HDR)
    for k in sorted(rows):
        w.writerow(rows[k])

# 자체 검증: 회차 연속, 번호 범위·중복, 오름차순, 보너스 비중복
ks = sorted(rows)
assert ks == list(range(1, ks[-1] + 1)), "누락된 회차 있음"
for k in ks:
    n = [int(x) for x in rows[k][2:8]]
    b = int(rows[k][8])
    assert all(1 <= x <= 45 for x in n + [b]) and len(set(n + [b])) == 7, f"{k}회 번호 이상"
    assert n == sorted(n), f"{k}회 정렬 이상"
print(f"완료: 1~{ks[-1]}회, {len(ks)}건 -> {OUT}")

# 웹 분석소(index.html)용: file://로 열어도 되도록 JSON이 아닌 JS로 저장
# [회차, 추첨일, 번호1~6, 보너스, 1등 당첨자수, 1등 당첨금, 총판매액(0이면 당첨금 집계 전)]
data = [[int(rows[k][0]), str(rows[k][1])] + [int(x) for x in rows[k][2:11]] + [int(rows[k][20])] for k in ks]
with open(os.path.join(os.path.dirname(OUT), "data.js"), "w", encoding="utf-8") as f:
    f.write("window.LOTTO=" + json.dumps(data, separators=(",", ":")) + ";\n")
print("data.js 갱신")
