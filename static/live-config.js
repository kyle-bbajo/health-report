// 시연판(GitHub Pages)에서 실제 API를 부르기 위한 설정
// - 기상청 · 특일정보 키는 여기에 넣지 않습니다. 저장소 Settings → Secrets → KMA_SERVICE_KEY 에 넣으면
//   GitHub Actions가 매시간 static/live/weather.json · holidays.json 을 갱신합니다(키는 공개되지 않음).
// - 브이월드 · 도로명주소 키는 브라우저에서 바로 쓰는 키라 페이지에 보입니다.
//   각 사이트에서 서비스 URL을 kyle-bbajo.github.io 로 등록한 키만 넣으세요. 비워 두면 OpenStreetMap으로 동작합니다.
window.LIVE = {
  facility: { lat: 37.2411, lon: 127.1776 },  // 시설 위치(Actions가 이 위치의 날씨를 받음)
  vworldKey: "",
  jusoKey: ""
};
