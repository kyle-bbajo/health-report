// 시연판에서 위치 · 날씨 · 주소 · 공휴일을 실제로 불러오는 스크립트
// 설치판(core/weather.py)과 같은 격자 계산 · 관측소 목록을 쓴다.
(function () {
  var CFG = window.LIVE || {};
  var STORE = 'hr-live-facility';
  var STATIONS = [
    [90, '속초', 38.251, 128.565], [95, '철원', 38.148, 127.304], [98, '동두천', 37.902, 127.061],
    [99, '파주', 37.886, 126.767], [100, '대관령', 37.677, 128.718], [101, '춘천', 37.903, 127.736],
    [105, '강릉', 37.752, 128.891], [108, '서울', 37.571, 126.966], [112, '인천', 37.478, 126.625],
    [114, '원주', 37.338, 127.947], [119, '수원', 37.272, 126.985], [127, '충주', 36.971, 127.953],
    [129, '서산', 36.777, 126.494], [131, '청주', 36.639, 127.441], [133, '대전', 36.372, 127.372],
    [136, '안동', 36.573, 128.707], [138, '포항', 36.032, 129.380], [140, '군산', 36.005, 126.761],
    [143, '대구', 35.878, 128.653], [146, '전주', 35.841, 127.117], [152, '울산', 35.560, 129.320],
    [155, '창원', 35.170, 128.573], [156, '광주', 35.173, 126.892], [159, '부산', 35.105, 129.032],
    [162, '통영', 34.846, 128.436], [165, '목포', 34.817, 126.381], [168, '여수', 34.739, 127.741],
    [184, '제주', 33.514, 126.530], [189, '서귀포', 33.246, 126.565], [201, '강화', 37.707, 126.446],
    [202, '양평', 37.489, 127.495], [203, '이천', 37.264, 127.484], [232, '천안', 36.762, 127.293]
  ];

  function toGrid(lat, lon) {  // 기상청 격자 (Lambert 정각원추)
    var RE = 6371.00877 / 5.0, rad = Math.PI / 180, s1 = 30 * rad, s2 = 60 * rad, olon = 126 * rad, olat = 38 * rad;
    var sn = Math.log(Math.cos(s1) / Math.cos(s2)) / Math.log(Math.tan(Math.PI * 0.25 + s2 * 0.5) / Math.tan(Math.PI * 0.25 + s1 * 0.5));
    var sf = Math.pow(Math.tan(Math.PI * 0.25 + s1 * 0.5), sn) * Math.cos(s1) / sn;
    var ro = RE * sf / Math.pow(Math.tan(Math.PI * 0.25 + olat * 0.5), sn);
    var ra = RE * sf / Math.pow(Math.tan(Math.PI * 0.25 + lat * rad * 0.5), sn);
    var th = lon * rad - olon;
    if (th > Math.PI) th -= 2 * Math.PI;
    if (th < -Math.PI) th += 2 * Math.PI;
    th *= sn;
    return [Math.floor(ra * Math.sin(th) + 43 + 0.5), Math.floor(ro - ra * Math.cos(th) + 136 + 0.5)];
  }
  function km(a, b, c, d) {
    var r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    return 6371 * 2 * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y));
  }
  function nearby(lat, lon, n) {
    return STATIONS.map(function (s) { return { id: s[0], name: s[1], km: km(lat, lon, s[2], s[3]) }; })
      .sort(function (a, b) { return a.km - b.km; }).slice(0, n || 6);
  }
  function $(id) { return document.getElementById(id); }
  function msg(text, bad) {
    var m = $('live-msg'); if (!m) return;
    m.textContent = text; m.style.color = bad ? '#C0392B' : '';
  }
  function jsonp(url, params, timeout) {  // 키를 쓰는 주소 · 좌표 API는 JSONP로 부른다
    return new Promise(function (ok, fail) {
      var cb = 'livecb' + Date.now() + Math.floor(Math.random() * 1000), s = document.createElement('script');
      var t = setTimeout(function () { clean(); fail(new Error('응답 없음')); }, timeout || 8000);
      function clean() { clearTimeout(t); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
      window[cb] = function (d) { clean(); ok(d); };
      params.callback = cb;
      s.src = url + '?' + new URLSearchParams(params).toString();
      s.onerror = function () { clean(); fail(new Error('불러오지 못함')); };
      document.head.appendChild(s);
    });
  }
  // 시연판은 window.fetch 를 막아 두므로 XMLHttpRequest 로 부른다
  function getJSON(url, headers) {
    return new Promise(function (ok, fail) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true); x.timeout = 10000;
      Object.keys(headers || {}).forEach(function (k) { x.setRequestHeader(k, headers[k]); });
      x.onload = function () {
        if (x.status === 404) return fail(new Error('아직 받은 자료 없음'));
        if (x.status < 200 || x.status >= 300) return fail(new Error('HTTP ' + x.status));
        try { ok(JSON.parse(x.responseText)); } catch (e) { fail(new Error('자료 형식 오류')); }
      };
      x.onerror = function () { fail(new Error('불러오지 못함')); };
      x.ontimeout = function () { fail(new Error('응답 없음')); };
      x.send();
    });
  }
  function getLive(path) { return getJSON(path + '?t=' + Date.now()); }

  // ── 위치 · 날씨 탭 ──
  function weatherTab() {
    var lat = $('wx-lat'), lon = $('wx-lon');
    if (!lat || !lon || !window.L) return;
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved) { lat.value = saved.lat; lon.value = saved.lon; }
    } catch (e) { /* 저장소를 못 쓰면 기본 위치 */ }
    var p = [parseFloat(lat.value) || 37.2411, parseFloat(lon.value) || 127.1776];
    var map = L.map('wx-map').setView(p, 16);
    L.Icon.Default.imagePath = 'static/vendor/leaflet/images/';
    if (CFG.vworldKey) {
      L.tileLayer('https://api.vworld.kr/req/wmts/1.0.0/' + CFG.vworldKey + '/Base/{z}/{y}/{x}.png',
        { maxZoom: 19, attribution: '&copy; 국토교통부 브이월드' }).addTo(map);
    } else {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    }
    var pin = L.marker(p, { draggable: true }).addTo(map);

    function refresh() {  // 위치가 바뀌면 격자 · 관측소를 바로 다시 계산
      var a = parseFloat(lat.value), b = parseFloat(lon.value);
      if (isNaN(a) || isNaN(b)) return;
      var g = toGrid(a, b);
      if ($('wx-grid')) $('wx-grid').textContent = g[0] + ', ' + g[1];
      var sel = document.querySelector('select[name=station]');
      if (sel) sel.innerHTML = nearby(a, b).map(function (s, i) {
        return '<option value="' + s.id + '"' + (i ? '' : ' selected') + '>' + s.name + ' (' + s.id + ') · ' + s.km.toFixed(1) + 'km</option>';
      }).join('');
      showWeather();
    }
    function set(ll) { lat.value = ll.lat.toFixed(6); lon.value = ll.lng.toFixed(6); refresh(); }
    function move(a, b, zoom) { pin.setLatLng([a, b]); map.setView([a, b], zoom || map.getZoom()); lat.value = a.toFixed(6); lon.value = b.toFixed(6); refresh(); }
    pin.on('dragend', function () { set(pin.getLatLng()); });
    map.on('click', function (e) { pin.setLatLng(e.latlng); set(e.latlng); });
    function typed() {
      var a = parseFloat(lat.value), b = parseFloat(lon.value);
      if (!isNaN(a) && !isNaN(b)) { pin.setLatLng([a, b]); map.panTo([a, b]); refresh(); }
    }
    lat.addEventListener('change', typed); lon.addEventListener('change', typed);

    // 주소로 찾기: 도로명주소(키) → 브이월드 좌표(키) → 없으면 OpenStreetMap
    function geocode(q) {
      q = (q || '').trim();
      if (q.length < 2) { msg('주소를 두 글자 이상 넣어 주세요.', true); return; }
      msg('주소를 찾는 중…');
      var road = Promise.resolve({ road: q, jibun: '' });
      if (CFG.jusoKey) {
        road = jsonp('https://business.juso.go.kr/addrlink/addrLinkApiJsonp.do',
          { confmKey: CFG.jusoKey, currentPage: 1, countPerPage: 1, keyword: q, resultType: 'json' })
          .then(function (d) {
            var r = d && d.results, c = r && r.common;
            if (c && String(c.errorCode) !== '0') throw new Error('도로명주소: ' + c.errorMessage);
            var j = r && r.juso && r.juso[0];
            if (!j) throw new Error('도로명주소에서 찾지 못했습니다');
            return { road: j.roadAddrPart1 || j.roadAddr, jibun: j.jibunAddr };
          });
      }
      road.then(function (a) {
        if (CFG.vworldKey) {
          return jsonp('https://api.vworld.kr/req/address', {
            service: 'address', request: 'getcoord', version: '2.0', crs: 'epsg:4326', address: a.road,
            refine: 'true', simple: 'false', format: 'json', type: 'road', key: CFG.vworldKey, domain: location.host
          }).then(function (d) {
            var r = d && d.response;
            if (!r || r.status !== 'OK') throw new Error('브이월드에서 좌표를 찾지 못했습니다');
            return { lat: parseFloat(r.result.point.y), lon: parseFloat(r.result.point.x), label: a.road, src: '도로명주소 · 브이월드' };
          });
        }
        return getJSON('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: a.road, format: 'json', limit: 1, countrycodes: 'kr', 'accept-language': 'ko' }))
          .then(function (d) {
            if (!d || !d.length) throw new Error('주소를 찾지 못했습니다');
            return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), label: a.road, src: CFG.jusoKey ? '도로명주소 · OpenStreetMap' : 'OpenStreetMap' };
          });
      }).then(function (r) {
        move(r.lat, r.lon, 17);
        msg(r.label + ' (' + r.src + ') — 핀 위치를 확인하고 [저장]을 누르세요.');
      }).catch(function (e) { msg(e.message, true); });
    }

    var forms = document.querySelectorAll('#weather form');
    forms.forEach(function (f) {
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var act = ev.submitter && (ev.submitter.value || ev.submitter.name);
        if (act === 'geocode') geocode(f.querySelector('input[name=address]').value);
        else if (act === 'save') {
          try { localStorage.setItem(STORE, JSON.stringify({ lat: lat.value, lon: lon.value })); msg('이 브라우저에 위치를 저장했습니다. (시연판 · 설치판은 설정 파일에 저장)'); }
          catch (e) { msg('이 브라우저에서는 저장할 수 없습니다.', true); }
        } else if (act === 'today') loadWeather(true);
        else msg('과거 날씨 받기와 학습은 설치판에서 동작합니다.');
      });
    });
    refresh();
    loadWeather(false);
  }

  var WX = null;
  function describe(w) {
    var n = w.now || {}, parts = [];
    if (n.temp != null) parts.push('지금 ' + Math.round(n.temp) + '°');
    parts.push(n.pty ? (n.pty === 3 || n.pty === 7 ? '눈' : '비') + (n.rain_mm ? ' ' + n.rain_mm + 'mm' : '') : '비 없음');
    if (w.tmin != null && w.tmax != null) parts.push('최저 ' + Math.round(w.tmin) + '° · 최고 ' + Math.round(w.tmax) + '°');
    return parts.join(' · ');
  }
  function showWeather() {
    var box = $('wx-today'), sub = $('wx-today-sub');
    if (!box || !WX) return;
    box.textContent = describe(WX);
    var g = toGrid(parseFloat($('wx-lat').value), parseFloat($('wx-lon').value));
    var same = g[0] === WX.nx && g[1] === WX.ny;
    sub.textContent = WX.source + ' · ' + WX.fetched_at + ' 갱신 · 격자 ' + WX.nx + ', ' + WX.ny + (same ? '' : ' (시설 위치 기준 · 새 위치는 설치판에서 받음)');
  }
  function loadWeather(manual) {
    var box = $('wx-today'), sub = $('wx-today-sub');
    if (!box) return;
    if (manual) msg('기상청 자료를 다시 읽는 중…');
    getLive('static/live/weather.json').then(function (w) {
      WX = w; showWeather();
      if (manual) msg('기상청 날씨를 불러왔습니다 (' + w.fetched_at + ' 갱신, 매시간 자동).');
    }).catch(function (e) {
      box.textContent = '아직 없음';
      sub.textContent = '저장소 Secrets에 기상청 키(KMA_SERVICE_KEY)를 넣으면 매시간 자동 갱신';
      if (manual) msg('기상청 자료: ' + e.message, true);
    });
  }

  // ── 휴관일 탭: 공휴일 ──
  function holidayTab() {
    var box = $('hol-status');
    if (!box) return;
    function load(manual) {
      getLive('static/live/holidays.json').then(function (h) {
        var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
        var next = h.days.filter(function (d) { return d.date >= today; }).slice(0, 3)
          .map(function (d) { return d.date.slice(5).replace('-', '/') + ' ' + d.name; });
        box.textContent = h.source + ' ' + h.days.length + '일 · ' + h.fetched_at + ' 갱신' + (next.length ? ' · 다음: ' + next.join(', ') : '');
      }).catch(function (e) {
        box.textContent = manual ? '공휴일 자료: ' + e.message + ' (저장소 Secrets에 KMA_SERVICE_KEY 필요)' : '아직 받지 않았습니다 (공공데이터포털 인증키 필요)';
      });
    }
    document.querySelectorAll('form[action="/settings/closed"]').forEach(function (f) {
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (f.querySelector('input[name=action][value=fetch]')) load(true);
        else box.textContent = '휴관 방식 저장은 설치판에서 동작합니다.';
      });
    });
    load(false);
  }

  document.addEventListener('DOMContentLoaded', function () { weatherTab(); holidayTab(); });
})();
