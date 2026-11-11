"""포브스 실시간 억만장자 순위 -> rich.js  (GitHub Actions에서 매일 실행)
1위부터 내려가며 생년월일이 공개된 사람만 골라 10명을 채운다.
shortcut: 포브스 공식 API가 아니라 실시간 순위 페이지가 쓰는 내부 주소. 막히거나 바뀌면
기존 rich.js를 그대로 두고 경고만 남긴다 (사이트는 마지막 성공 순위를 계속 보여 줌).
"""
import json, os, sys, urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "rich.js")
URL = ("https://www.forbes.com/forbesapi/person/rtb/0/position/true.json"
       "?fields=rank,personName,finalWorth,birthDate&limit=40")

KO = {  # 영문 이름 -> 한글 (없으면 영문 그대로)
    "Elon Musk": "일론 머스크", "Jeff Bezos": "제프 베이조스", "Larry Page": "래리 페이지", "Sergey Brin": "세르게이 브린",
    "Mark Zuckerberg": "마크 저커버그", "Michael Dell": "마이클 델", "Steve Ballmer": "스티브 발머", "Jensen Huang": "젠슨 황",
    "Warren Buffett": "워런 버핏", "Larry Ellison": "래리 엘리슨", "Amancio Ortega": "아만시오 오르테가",
    "Bernard Arnault": "베르나르 아르노", "Rob Walton": "롭 월턴", "Jim Walton": "짐 월턴", "Alice Walton": "앨리스 월턴",
    "Carlos Slim Helu": "카를로스 슬림", "Bill Gates": "빌 게이츠", "Mukesh Ambani": "무케시 암바니", "Gautam Adani": "가우탐 아다니",
    "Francoise Bettencourt Meyers": "프랑수아즈 베탕쿠르 메이예르", "Julia Koch": "줄리아 코크", "Charles Koch": "찰스 코크",
    "Michael Bloomberg": "마이클 블룸버그", "Changpeng Zhao": "자오창펑", "Zhong Shanshan": "중산산", "Thomas Peterffy": "토머스 피터피",
    "Jeff Yass": "제프 야스", "Zhang Yiming": "장이밍", "Ma Huateng": "마화텅", "Colin Huang": "콜린 황", "Phil Knight": "필 나이트",
    "Dieter Schwarz": "디터 슈바르츠", "Giovanni Ferrero": "조반니 페레로", "Ken Griffin": "켄 그리핀", "Lei Jun": "레이쥔",
    "Masayoshi Son": "손정의", "Tadashi Yanai": "야나이 다다시", "Alain Wertheimer": "알랭 베르트하이머",
    "Gerard Wertheimer": "제라르 베르트하이머", "Klaus-Michael Kuehne": "클라우스미하엘 퀴네", "Miriam Adelson": "미리엄 애덜슨",
    "Jacqueline Mars": "재클린 마스", "John Mars": "존 마스", "Stephen Schwarzman": "스티븐 슈워츠먼", "Len Blavatnik": "렌 블라바트닉",
    "Savitri Jindal": "사비트리 진달", "Shiv Nadar": "시브 나다르", "Jacqueline Mars & family": "재클린 마스",
}


def clean(name):
    base = name.replace(" & family", "").strip()
    base = base.replace("Françoise", "Francoise").replace("Kühne", "Kuehne")
    return base, KO.get(base, base)


try:
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        people = json.load(r)["personList"]["personsLists"]
    out = []
    for p in sorted(people, key=lambda x: x["rank"]):
        if p.get("birthDate") is None:
            continue  # 생년월일 미공개 -> 다음 순위로
        d = datetime(1970, 1, 1) + timedelta(milliseconds=p["birthDate"])
        en, ko = clean(p["personName"])
        out.append({"rank": p["rank"], "name": ko, "en": en, "worth": round(p["finalWorth"] / 1000), "y": d.year, "m": d.month, "d": d.day})
        if len(out) == 10:
            break
    assert len(out) == 10, f"생년월일 공개 인물이 {len(out)}명뿐"
    assert all(1900 < x["y"] < 2010 and 1 <= x["m"] <= 12 and 1 <= x["d"] <= 31 for x in out)
except Exception as e:  # 실패해도 사이트는 기존 rich.js로 계속 동작
    print(f"경고: 포브스 순위를 받지 못해 기존 rich.js 유지 ({e})")
    sys.exit(0)

res = {"ver": 1, "date": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d"), "list": out}  # ver: 화면이 읽는 형식 버전 — 형식을 바꿀 때 1씩 올림
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.LOTTO_RICH=" + json.dumps(res, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("rich.js 갱신:", ", ".join(f"{x['rank']}.{x['name']}" for x in out))
