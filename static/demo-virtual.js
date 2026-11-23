// 시연판에서 저장 · 문자 · 메모 · 확인 · 엑셀 같은 버튼을 가상으로 동작시킨다.
// 실제 서버가 없으므로 결과는 이 브라우저(localStorage)에만 남고, 실제 저장 · 발송은 설치판에서 한다.
(function () {
  var LOG = 'hr-demo-log', PFX = 'hr-demo:';
  var PAGE = location.pathname.split('/').pop() || 'index.html';

  function toast(m) {
    var t = document.getElementById('demo-toast');
    if (!t) { t = document.createElement('div'); t.id = 'demo-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.style.whiteSpace = 'pre-line';
    t.textContent = m; t.className = 'show';
    clearTimeout(t._h); t._h = setTimeout(function () { t.className = ''; }, 3600);
  }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function log(text) {
    var a = load(LOG, []);
    a.unshift({ t: new Date().toLocaleString('ko-KR'), text: text, page: document.title });
    store(LOG, a.slice(0, 50));
  }
  function key(f) { return PFX + PAGE + ':' + (f.getAttribute('action') || ''); }
  function skip(el) { return !el.name || el.type === 'hidden' || el.type === 'file' || el.type === 'password' || el.tagName === 'BUTTON'; }
  function fields(f) {
    var o = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (skip(el)) return;
      if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else if (el.type === 'checkbox') o[el.name + '::' + el.value] = el.checked;
      else o[el.name] = el.value;
    });
    return o;
  }
  function restore() {  // 가상으로 저장한 값을 다시 보여 준다
    document.querySelectorAll('form[action]').forEach(function (f) {
      if (f.hasAttribute('data-live')) return;
      var s = load(key(f), null);
      if (!s) return;
      Array.prototype.forEach.call(f.elements, function (el) {
        if (skip(el)) return;
        if (el.type === 'radio') el.checked = s[el.name] === el.value;
        else if (el.type === 'checkbox') { var k = el.name + '::' + el.value; if (k in s) el.checked = s[k]; }
        else if (el.name in s) el.value = s[el.name];
      });
    });
    load(PFX + PAGE + ':notes', []).forEach(function (n) { showNote(document.querySelector('form[action="' + n.action + '"]'), n.text); });
    load(PFX + PAGE + ':done', []).forEach(function (act) { markDone(document.querySelector('form[action="' + act + '"]')); });
    var feats = load(PFX + 'features', {});
    document.querySelectorAll('form[action="/settings/features"]').forEach(function (f) {
      var k = (f.querySelector('input[name=key]') || {}).value;
      if (k in feats) featureUI(f, feats[k]);
    });
  }
  function label(f, btn) {
    var b = btn || f.querySelector('button[type=submit], button:not([type])');
    return ((b && b.textContent) || '').replace(/\s+/g, ' ').trim() || '저장';
  }
  function showNote(f, text) {
    if (!f) return;
    var box = f.closest('.todo') || f.parentNode, d = document.createElement('div');
    d.className = 'sub'; d.textContent = '통화 메모(가상) · ' + text;
    (box.querySelector(':scope > div') || box).appendChild(d);
  }
  function markDone(f) {
    if (!f) return;
    var row = f.closest('.todo, tr'); if (row) row.style.opacity = '.5';
    var b = f.querySelector('button'); if (b) { b.textContent = '확인 완료'; b.disabled = true; }
  }

  function featureUI(f, on) {  // 기능 켜기 · 끄기 표시
    var badge = f.querySelector('.badge'), b = f.querySelector('button'), h = f.querySelector('input[name=on]');
    if (badge) { badge.textContent = on ? '켜짐' : '꺼짐'; badge.classList.toggle('muted', !on); }
    if (b) b.textContent = on ? '끄기' : '켜기';
    if (h) h.value = on ? '0' : '1';
  }
  function submit(f, btn) {
    var act = f.getAttribute('action') || '', msg;
    if (act === '/settings/features') {
      var k = (f.querySelector('input[name=key]') || {}).value, on = (f.querySelector('input[name=on]') || {}).value === '1';
      var feats = load(PFX + 'features', {}); feats[k] = on; store(PFX + 'features', feats);
      featureUI(f, on);
      var title = f.querySelector('b'); msg = (title ? title.textContent.trim() : '기능') + ' — ' + (on ? '켰습니다' : '껐습니다');
    } else if (/\/delete$/.test(act)) {
      var row = f.closest('tr, li, .card, .todo'); if (row) row.style.display = 'none';
      msg = '삭제했습니다';
    } else if (/sms\/test/.test(act)) {
      var to = (f.querySelector('[name=to]') || {}).value || '';
      if (to.replace(/\D/g, '').length < 10) { toast('받을 번호를 넣어 주세요. 예: 010-1234-5678'); return; }
      msg = to + ' 로 시험 문자를 보낸 것으로 기록했습니다 (실제 문자는 나가지 않음)';
    } else if (/callnote/.test(act)) {
      var n = f.querySelector('[name=note]'), v = n && n.value.trim();
      if (!v) { toast('통화 메모를 입력해 주세요.'); return; }
      showNote(f, v); n.value = '';
      var notes = load(PFX + PAGE + ':notes', []); notes.push({ action: act, text: v }); store(PFX + PAGE + ':notes', notes);
      msg = '통화 메모를 저장했습니다: ' + v;
    } else if (/wellness-ack|decline\/ack/.test(act)) {
      markDone(f);
      var done = load(PFX + PAGE + ':done', []); if (done.indexOf(act) < 0) done.push(act); store(PFX + PAGE + ':done', done);
      msg = '확인 처리했습니다';
    } else if (/photo/.test(act)) {
      var file = f.querySelector('input[type=file]');
      if (file && !file.files.length) { toast('사진을 골라 주세요.'); return; }
      msg = '사진을 받았습니다. 설치판에서는 AI가 음식과 열량을 읽어 기록합니다';
    } else if (/reload/.test(act)) {
      msg = '자료를 다시 읽었습니다';
    } else {
      store(key(f), fields(f));
      msg = label(f, btn) + ' — 저장했습니다';
    }
    log(msg);
    toast(msg + ' (가상)\n시연판이라 이 브라우저에만 남고, 실제 저장 · 발송은 설치판에서 합니다.');
  }

  function exportList(a) {  // 주민센터 전달용 명단을 CSV(엑셀에서 열림)로 내려받기
    var panel = a.closest('.panel') || document, rows = [['이름', '결석 현황', '나이 · 강좌 · 보호자', '근거', '최근 연락']];
    panel.querySelectorAll('.todo').forEach(function (t) {
      var first = t.querySelector(':scope > div') || t, nm = first.querySelector('b');
      var subs = Array.prototype.map.call(first.querySelectorAll('.sub'), function (s) { return s.textContent.replace(/\s+/g, ' ').trim(); });
      rows.push([nm ? nm.textContent.trim() : ''].concat(subs.slice(0, 4)));
    });
    var csv = '﻿' + rows.map(function (r) { return r.map(function (c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), l = document.createElement('a');
    l.href = url; l.download = '주민센터_전달명단_시연_가상데이터.csv';
    document.body.appendChild(l); l.click();
    setTimeout(function () { URL.revokeObjectURL(url); l.remove(); }, 1000);
    log('주민센터 전달용 명단 내려받기 ' + (rows.length - 1) + '명');
    toast('주민센터 전달용 명단 ' + (rows.length - 1) + '명을 내려받았습니다 (가상 데이터 · 엑셀에서 열림)');
  }
  function link(a) {
    if (/엑셀|내려받기/.test(a.textContent)) return exportList(a);
    log((a.textContent || '').trim()); toast('처리했습니다 (가상) — 실제 동작은 설치판에서 합니다.');
  }

  window.demoVirtual = { submit: submit, link: link };
  document.addEventListener('DOMContentLoaded', restore);
})();
