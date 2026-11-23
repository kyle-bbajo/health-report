"""시연판용 기상청 · 특일정보 받기 (GitHub Actions에서 매시간 실행).

인증키는 저장소 Secrets(KMA_SERVICE_KEY)에만 두고, 받은 결과만 static/live/*.json 으로 남긴다.
시설 위치는 static/live-config.js 의 facility(lat, lon)를 읽는다. 표준 라이브러리만 쓴다.
"""
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "static", "live")
VILAGE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
HOLIDAY = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"


def facility():
    txt = open(os.path.join(ROOT, "static", "live-config.js"), encoding="utf-8").read()
    lat = float(re.search(r"lat:\s*([0-9.]+)", txt).group(1))
    lon = float(re.search(r"lon:\s*([0-9.]+)", txt).group(1))
    return lat, lon


def to_grid(lat, lon):
    """기상청 격자 (Lambert 정각원추). 설치판 core/weather.py 와 같은 식."""
    re_, grid, slat1, slat2, olon, olat, xo, yo = 6371.00877, 5.0, 30.0, 60.0, 126.0, 38.0, 43, 136
    rad = math.pi / 180.0
    re_ = re_ / grid
    slat1, slat2, olon, olat = slat1 * rad, slat2 * rad, olon * rad, olat * rad
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(
        math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5))
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5) ** sn * math.cos(slat1) / sn
    ro = re_ * sf / math.tan(math.pi * 0.25 + olat * 0.5) ** sn
    ra = re_ * sf / math.tan(math.pi * 0.25 + lat * rad * 0.5) ** sn
    theta = lon * rad - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn
    return int(ra * math.sin(theta) + xo + 0.5), int(ro - ra * math.cos(theta) + yo + 0.5)


def call(url, params):
    q = urllib.parse.urlencode(params)
    with urllib.request.urlopen(url + "?" + q, timeout=15) as r:
        body = r.read().decode("utf-8")
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise RuntimeError("응답이 JSON이 아닙니다: " + body[:200])
    head = (data.get("response") or {}).get("header") or {}
    if str(head.get("resultCode", "00")) not in ("00", "0"):
        raise RuntimeError(f"{head.get('resultCode')} {head.get('resultMsg')}")
    items = (((data.get("response") or {}).get("body") or {}).get("items") or {})
    items = items.get("item") if isinstance(items, dict) else items
    if isinstance(items, dict):
        items = [items]
    return items or []


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def amount(v):
    """강수량 · 적설 문자열('1mm 미만', '강수없음', '30.0~50.0mm' 등) → 숫자."""
    if v is None:
        return None
    s = str(v)
    if "없음" in s:
        return 0.0
    if "미만" in s:
        return 0.5
    m = re.findall(r"[0-9.]+", s)
    return float(m[0]) if m else None


def vilage_base(now, first_of_day=False):
    t = now - timedelta(minutes=15)
    for h in ([2] if first_of_day else [23, 20, 17, 14, 11, 8, 5, 2]):
        if t.hour >= h:
            return t.strftime("%Y%m%d"), f"{h:02d}00"
    y = t - timedelta(days=1)
    return y.strftime("%Y%m%d"), "2300"


def fetch_weather(key, lat, lon, now):
    nx, ny = to_grid(lat, lon)
    day = now.strftime("%Y%m%d")
    base = {"serviceKey": key, "pageNo": 1, "numOfRows": 1000, "dataType": "JSON", "nx": nx, "ny": ny}
    hours, tmin, tmax, seen = {}, None, None, set()
    for first in (True, False):
        bd, bt = vilage_base(now, first)
        if (bd, bt) in seen:
            continue
        seen.add((bd, bt))
        for it in call(VILAGE + "/getVilageFcst", {**base, "base_date": bd, "base_time": bt}):
            if str(it.get("fcstDate")) != day:
                continue
            h = str(int(str(it.get("fcstTime", "0000"))[:2]))
            cat, val = it.get("category"), it.get("fcstValue")
            row = hours.setdefault(h, {})
            if cat == "TMP":
                row["temp"] = num(val)
            elif cat == "PCP":
                row["rain_mm"] = amount(val)
            elif cat == "SNO":
                row["snow_cm"] = amount(val)
            elif cat == "POP":
                row["pop"] = num(val)
            elif cat == "TMN":
                tmin = num(val)
            elif cat == "TMX":
                tmax = num(val)
    t = now - timedelta(minutes=45)
    v = {it.get("category"): it.get("obsrValue")
         for it in call(VILAGE + "/getUltraSrtNcst", {**base, "base_date": t.strftime("%Y%m%d"), "base_time": t.strftime("%H00")})}
    obs = {"time": t.strftime("%H:00"), "temp": num(v.get("T1H")), "rain_mm": amount(v.get("RN1")) or 0.0,
           "pty": int(num(v.get("PTY")) or 0), "humidity": num(v.get("REH")), "wind": num(v.get("WSD"))}
    temps = [r["temp"] for r in hours.values() if r.get("temp") is not None]
    return {"ok": True, "source": "기상청 단기예보 · 초단기실황", "fetched_at": now.strftime("%Y-%m-%d %H:%M"),
            "date": now.strftime("%Y-%m-%d"), "lat": lat, "lon": lon, "nx": nx, "ny": ny, "now": obs,
            "tmin": tmin if tmin is not None else (min(temps) if temps else None),
            "tmax": tmax if tmax is not None else (max(temps) if temps else None),
            "hours": dict(sorted(hours.items(), key=lambda kv: int(kv[0])))}


def fetch_holidays(key, now):
    days = []
    for year in (now.year, now.year + 1):
        for it in call(HOLIDAY, {"serviceKey": key, "solYear": year, "numOfRows": 100, "_type": "json"}):
            if str(it.get("isHoliday", "Y")) == "Y":
                d = str(it.get("locdate"))
                days.append({"date": f"{d[:4]}-{d[4:6]}-{d[6:]}", "name": it.get("dateName")})
    return {"ok": True, "source": "한국천문연구원 특일 정보", "fetched_at": now.strftime("%Y-%m-%d %H:%M"),
            "days": sorted(days, key=lambda x: x["date"])}


def save(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def main():
    key = os.environ.get("KMA_SERVICE_KEY", "").strip()
    if not key:
        print("KMA_SERVICE_KEY 가 없습니다. 저장소 Settings → Secrets 에 넣어 주세요.")
        return 0
    if "%" in key:  # 인코딩 키를 넣어도 동작하게
        key = urllib.parse.unquote(key)
    now = datetime.now(KST)
    lat, lon = facility()
    failed = 0
    for name, job in (("weather.json", lambda: fetch_weather(key, lat, lon, now)),
                      ("holidays.json", lambda: fetch_holidays(key, now))):
        try:
            save(name, job())
            print(name, "갱신")
        except Exception as e:  # 실패하면 이전 파일을 그대로 둔다
            failed += 1
            print(name, "실패:", e)
    return 1 if failed == 2 else 0


if __name__ == "__main__":
    sys.exit(main())
