# 공공체육시설 출석 기반 고독사 위험 조기 발견 · 건강 리포트 (시연판)

용인도시공사 · 2026 공공 AI 대전환 챌린지 세션 1

가상 데이터(회원 60명)로 2026-10-26 낮 12시 기준 화면을 미리 그린 정적 시연판입니다. 실제 회원 정보는 없습니다.

- 처음 화면: index.html
- 관리자 화면: admin-login.html (시연이라 비밀번호 없이 들어가기)
- 회원 화면: my.html (비워 두고 내 리포트 보기, 또는 yuc / 2011 · M004 / 1974 등)

저장, 문자 발송, 음식 사진 읽기, 엑셀 내려받기는 설치판에서 동작합니다. 이 폴더는 설치판의 `python scripts/export_static.py`로 만듭니다.

## 시연판에서 실제로 부르는 API

설정 → 위치 · 날씨, 휴관일 탭은 시연판에서도 실제 자료를 불러옵니다.

| 기능 | 출처 | 시연판에서 동작 방식 |
|---|---|---|
| 지도 · 핀 옮기기 | 국토교통부 브이월드 (키 없으면 OpenStreetMap) | 브라우저에서 바로 |
| 기상청 격자 · 가까운 관측소 | 설치판과 같은 계산식 | 핀을 옮기면 바로 다시 계산 |
| 주소로 찾기 | 행정안전부 도로명주소 → 브이월드 좌표 (키 없으면 OpenStreetMap) | 브라우저에서 바로 |
| 오늘 날씨 | 기상청 단기예보 · 초단기실황 | GitHub Actions가 매시간 받아 `static/live/weather.json`에 저장 |
| 공휴일 | 한국천문연구원 특일 정보 | GitHub Actions가 매시간 받아 `static/live/holidays.json`에 저장 |
| 위치 저장 | — | 이 브라우저에만 저장 |

설정 방법
- 기상청 · 특일정보: 저장소 Settings → Secrets and variables → Actions → `KMA_SERVICE_KEY`(공공데이터포털 일반 인증키). 키는 공개되지 않습니다. 시설 위치는 `static/live-config.js`의 `facility`입니다.
- 도로명주소 · 브이월드: 서비스 URL을 `kyle-bbajo.github.io`로 등록한 키를 `static/live-config.js`에 넣습니다. 브라우저에서 쓰는 키라 페이지에 보입니다.
- 문자 발송(솔라피)은 비밀키가 필요해 공개 페이지에서는 하지 않고 설치판에서만 동작합니다.

`python scripts/export_static.py`로 시연판을 다시 만들면 두 탭의 연결(`static/live.js` 불러오기, `data-live` 표시)을 다시 넣어야 합니다.
