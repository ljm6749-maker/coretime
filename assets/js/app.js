/**
 * 화면 조립 · 상태 관리
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var ENTITIES = global.ENTITIES;
  var byId = {};
  ENTITIES.forEach(function (e) { byId[e.id] = e; });

  var el = {
    utcClock: document.getElementById('utcClock'),
    date: document.getElementById('meetingDate'),
    base: document.getElementById('baseEntity'),
    duration: document.getElementById('duration'),
    chips: document.getElementById('participantChips'),
    controls: document.getElementById('controls'),
    dayTabs: document.getElementById('dayTabs'),
    timetable: document.getElementById('timetable'),
    panelSelection: document.getElementById('panelSelection'),
    panelQuarter: document.getElementById('panelQuarter'),
    panelMail: document.getElementById('panelMail'),
    quarterHint: document.getElementById('quarterHint'),
    policyNote: document.getElementById('policyNote'),
    policyTable: document.getElementById('policyTable'),
    mapHint: document.getElementById('mapHint'),
    mapMode: document.getElementById('mapMode'),
    canvas: document.getElementById('mapCanvas'),
    overlay: document.getElementById('mapOverlay'),
    clockList: document.getElementById('clockList')
  };

  var state = {
    date: null,
    baseId: 'kr',
    durationMin: 60,
    participants: ENTITIES.map(function (e) { return e.id; }),
    selectedHour: null,
    plan: null,
    mapMode: 'live',
    mailLang: 'ko',
    mailEditing: false
  };

  var mapView;

  /* ── 날짜 유틸 ──────────────────────────────────────────── */

  function todayIn(tz) {
    var p = TZ.zonedParts(tz, Date.now());
    return p.year + '-' + TZ.pad(p.month) + '-' + TZ.pad(p.day);
  }

  function shiftDate(dateStr, days) {
    var p = dateStr.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.getUTCFullYear() + '-' + TZ.pad(d.getUTCMonth() + 1) + '-' + TZ.pad(d.getUTCDate());
  }

  function weekdayOf(dateStr) {
    var p = dateStr.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  }

  function koDate(dateStr) {
    var p = dateStr.split('-');
    return (+p[1]) + '월 ' + (+p[2]) + '일(' + TZ.DAY_KO[weekdayOf(dateStr)] + ')';
  }

  /* ── 초기화 ─────────────────────────────────────────────── */

  function init() {
    state.date = todayIn(byId[state.baseId].tz);
    el.date.value = state.date;

    ENTITIES.forEach(function (e) {
      var opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.name + ' (' + e.code + ')';
      el.base.appendChild(opt);
    });
    el.base.value = state.baseId;

    global.DURATIONS.forEach(function (min) {
      var opt = document.createElement('option');
      opt.value = String(min);
      opt.textContent = min < 60 ? min + '분' : Math.floor(min / 60) + '시간' + (min % 60 ? ' 30분' : '');
      el.duration.appendChild(opt);
    });
    el.duration.value = String(state.durationMin);

    buildChips();
    buildClockList();

    el.date.addEventListener('change', function () {
      state.date = el.date.value || state.date;
      el.date.value = state.date;
      update();
    });
    el.base.addEventListener('change', function () {
      state.baseId = el.base.value;
      update();
    });
    el.duration.addEventListener('change', function () {
      state.durationMin = +el.duration.value;
      update();
    });
    el.controls.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-select]');
      if (!btn) return;
      state.participants = btn.getAttribute('data-select') === 'all'
        ? ENTITIES.map(function (e) { return e.id; })
        : [];
      syncChips();
      update();
    });
    el.mapMode.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-mode]');
      if (btn) setMapMode(btn.getAttribute('data-mode'));
    });
    el.dayTabs.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-date]');
      if (!tab) return;
      state.date = tab.getAttribute('data-date');
      el.date.value = state.date;
      update();
    });
    el.timetable.addEventListener('click', function (event) {
      var cell = event.target.closest('[data-hour]');
      if (!cell) return;
      state.selectedHour = +cell.getAttribute('data-hour');
      renderTimetable();
      renderSelection();
      renderMail();
      setMapMode('meeting');
    });

    mapView = new global.MapView(el.canvas, el.overlay);
    mapView.render();
    mapView.updateClocks();

    tick();
    setInterval(tick, 1000);
    setInterval(function () { mapView.render(); }, 5 * 60 * 1000);

    var resizeTimer;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(positionMarker, 150);
    });

    update();
  }

  function buildChips() {
    ENTITIES.forEach(function (e) {
      var label = document.createElement('label');
      label.className = 'chip';
      label.innerHTML =
        '<input type="checkbox" value="' + e.id + '" checked>' +
        '<span class="chip__body"><span class="chip__name">' + e.name + '</span>' +
        '<span class="chip__code">' + e.code + '</span></span>';
      label.querySelector('input').addEventListener('change', function (ev) {
        var id = ev.target.value;
        if (ev.target.checked) {
          if (state.participants.indexOf(id) === -1) state.participants.push(id);
        } else {
          state.participants = state.participants.filter(function (x) { return x !== id; });
        }
        update();
      });
      el.chips.appendChild(label);
    });
  }

  function syncChips() {
    el.chips.querySelectorAll('input').forEach(function (input) {
      input.checked = state.participants.indexOf(input.value) !== -1;
    });
  }

  function buildClockList() {
    el.clockList.innerHTML = ENTITIES.map(function (e) {
      return '<article class="clock" data-clock="' + e.id + '">' +
        '<p class="clock__head"><span class="clock__name">' + e.name + '</span>' +
        '<span class="clock__code">' + e.code + '</span></p>' +
        '<p class="clock__time">--:--</p><p class="clock__meta"></p>' +
        '<p class="clock__city">' + e.city + '</p></article>';
    }).join('');
  }

  function tick() {
    var now = Date.now();
    var u = new Date(now);
    el.utcClock.textContent = TZ.pad(u.getUTCHours()) + ':' + TZ.pad(u.getUTCMinutes()) + ':' + TZ.pad(u.getUTCSeconds());
    if (!mapView.meeting) mapView.updateClocks();
    updateClockList();
    updateLiveClocks();
  }

  function updateClockList() {
    var now = Date.now();
    ENTITIES.forEach(function (e) {
      var node = el.clockList.querySelector('[data-clock="' + e.id + '"]');
      if (!node) return;
      var meetingRow = mapView.meeting && mapView.meeting.statusById[e.id];
      var p = meetingRow ? meetingRow.start : TZ.zonedParts(e.tz, now);
      var holiday = global.holidayOf(e, global.Scheduler.dateKey(p));
      node.querySelector('.clock__time').textContent = TZ.pad(p.hour) + ':' + TZ.pad(p.minute);
      node.querySelector('.clock__meta').innerHTML = meetingRow
        ? TZ.DAY_KO[p.weekday] + '요일 · ' + meetingRow.statusLabel
        : TZ.DAY_KO[p.weekday] + '요일 · ' + TZ.offsetLabel(e.tz, now) +
          (holiday ? ' <span class="tag tag--off">휴무</span>' : '');
      node.className = 'clock' +
        (state.participants.indexOf(e.id) === -1 ? ' is-dimmed' : '') +
        (meetingRow ? ' is-' + meetingRow.status : '');
    });
  }

  /** 시간표 왼쪽 라벨의 현재 현지시각 */
  function updateLiveClocks() {
    var now = Date.now();
    el.timetable.querySelectorAll('[data-live]').forEach(function (node) {
      var entity = byId[node.getAttribute('data-live')];
      if (!entity) return;
      var p = TZ.zonedParts(entity.tz, now);
      node.querySelector('.tt__nowtime').textContent = TZ.pad(p.hour) + ':' + TZ.pad(p.minute);
      node.querySelector('.tt__nowday').textContent = TZ.DAY_KO[p.weekday] + '요일, ' + p.month + '월 ' + p.day + '일';
    });
  }

  /* ── 계산 ───────────────────────────────────────────────── */

  function participants() {
    var list = ENTITIES.filter(function (e) { return state.participants.indexOf(e.id) !== -1; });
    var base = byId[state.baseId];
    if (list.indexOf(base) > 0) {                 // 기준 법인을 맨 위로
      list = [base].concat(list.filter(function (e) { return e !== base; }));
    }
    return list;
  }

  function update() {
    mapView.setSelection(state.participants);

    var p = state.date.split('-');
    var policy = global.Scheduler.policyFor(+p[0], +p[1]);
    el.quarterHint.textContent = p[0] + '년 ' + policy.quarter.slice(1) + '분기 코어타임 적용';
    renderDayTabs();
    renderPolicyTable(policy);
    renderQuarterPanel(policy);

    var list = participants();
    if (!list.length) {
      state.plan = null;
      setMapMode('live');
      el.timetable.innerHTML = '<div class="empty"><p class="empty__title">참여 법인을 선택해 주세요</p>' +
        '<p class="empty__text">선택한 법인들의 시간이 한 줄로 정렬되어 표시됩니다.</p></div>';
      el.panelSelection.innerHTML = '';
      el.panelMail.innerHTML = '';
      return;
    }

    state.plan = global.Scheduler.planDay({
      date: state.date,
      baseTz: byId[state.baseId].tz,
      entities: list,
      durationMin: state.durationMin
    });

    if (state.selectedHour === null) state.selectedHour = defaultHour(state.plan);

    renderTimetable();
    renderSelection();
    renderMail();
    applyMeetingToMap();
    updateLiveClocks();
  }

  /** 코어타임 법인 수가 가장 많은 시각을 기본 선택 */
  function defaultHour(plan) {
    var best = 0, bestScore = -1;
    plan.slots.forEach(function (slot) {
      var score = slot.counts.core * 3 + slot.counts.work - slot.counts.off * 2;
      if (score > bestScore) { bestScore = score; best = slot.hour; }
    });
    return best;
  }

  function selectedSlot() {
    if (!state.plan) return null;
    return state.plan.slots[Math.min(23, Math.max(0, state.selectedHour))];
  }

  function baseParts(slot) {
    return TZ.zonedParts(byId[state.baseId].tz, slot.utcStart);
  }

  function baseRange(slot) {
    var start = slot.hour;
    var end = start + slot.durationMin / 60;
    return TZ.hhmm(start) + '–' + TZ.hhmm(end % 24) + (end >= 24 ? ' (익일)' : '');
  }

  function localRange(row) {
    return TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute) + '–' +
           TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
  }

  function verdict(slot) {
    if (slot.allCore) return { key: 'core', text: '전원 코어타임' };
    if (slot.counts.off) return { key: 'off', text: '휴무 ' + slot.counts.off + '개 법인' };
    if (slot.counts.out) return { key: 'out', text: '근무시간 외 ' + slot.counts.out + '개 법인' };
    return { key: 'work', text: '전원 근무시간 내' };
  }

  /* ── 날짜 탭 ────────────────────────────────────────────── */

  function renderDayTabs() {
    var today = todayIn(byId[state.baseId].tz);
    var html = ['<button type="button" class="daytab daytab--nav" data-date="' + shiftDate(state.date, -1) + '" aria-label="이전 날">‹</button>'];
    for (var i = -2; i <= 3; i++) {
      var d = shiftDate(state.date, i);
      var wd = weekdayOf(d);
      html.push('<button type="button" class="daytab' +
        (i === 0 ? ' is-active' : '') +
        (wd === 0 || wd === 6 ? ' is-weekend' : '') +
        (d === today ? ' is-today' : '') +
        '" data-date="' + d + '" role="tab" aria-selected="' + (i === 0) + '">' +
        (i === 0 ? koDate(d) : (+d.split('-')[2]) + '<span class="daytab__dow">' + TZ.DAY_KO[wd] + '</span>') +
        '</button>');
    }
    html.push('<button type="button" class="daytab daytab--nav" data-date="' + shiftDate(state.date, 1) + '" aria-label="다음 날">›</button>');
    el.dayTabs.innerHTML = html.join('');
  }

  /* ── 시간표 ─────────────────────────────────────────────── */

  function renderTimetable() {
    var plan = state.plan;
    var base = byId[state.baseId];
    var rows = plan.slots[0].rows;
    var selHour = state.selectedHour;
    var spanCols = Math.max(1, Math.ceil(state.durationMin / 60));
    var baseOffset = TZ.offsetMinutes(base.tz, plan.slots[0].utcStart);

    var html = ['<div class="tt">'];
    html.push('<div class="tt__head">' +
      '<h3 class="section__title">시간표 <span>' + base.name + ' ' + koDate(state.date) + ' 기준</span></h3>' +
      '<ul class="legend legend--flat">' +
        '<li><span class="legend__swatch legend__swatch--core"></span>글로벌 코어타임</li>' +
        '<li><span class="legend__swatch legend__swatch--work"></span>현지 근무시간</li>' +
        '<li><span class="legend__swatch legend__swatch--out"></span>근무시간 외</li>' +
        '<li><span class="legend__swatch legend__swatch--off"></span>휴무 · 공휴일</li>' +
      '</ul></div>');

    html.push('<div class="tt__scroll"><div class="tt__grid">');

    // 헤더: 기준 법인 시각
    html.push('<div class="tt__corner"><span class="tt__cornerlabel">홈 시간대</span>' +
      '<span class="tt__cornerbase">' + base.name + ' · ' + TZ.offsetLabel(base.tz, plan.slots[0].utcStart) + '</span></div>');
    for (var h = 0; h < 24; h++) {
      html.push('<div class="tt__tick' + (h >= selHour && h < selHour + spanCols ? ' is-sel' : '') + '">' + TZ.pad(h) + '</div>');
    }

    // 법인 행
    rows.forEach(function (_, rowIndex) {
      var entity = rows[rowIndex].entity;
      var offsetDiff = (TZ.offsetMinutes(entity.tz, plan.slots[0].utcStart) - baseOffset) / 60;
      var diffLabel = offsetDiff === 0 ? '홈' : (offsetDiff > 0 ? '+' : '') + Number(offsetDiff.toFixed(1));
      var holiday = null;
      plan.slots.forEach(function (slot) {
        if (!holiday && slot.rows[rowIndex].holiday) holiday = slot.rows[rowIndex].holiday;
      });

      html.push('<div class="tt__label" data-live="' + entity.id + '">' +
        '<span class="tt__diff' + (offsetDiff === 0 ? ' is-home' : '') + '">' + diffLabel + '</span>' +
        '<span class="tt__ident">' +
          '<span class="tt__name">' + entity.name + '<span class="tt__code">' + entity.code + '</span></span>' +
          '<span class="tt__city">' + entity.city +
            (TZ.isDST(entity.tz, plan.slots[0].utcStart) ? ' <span class="tag">DST</span>' : '') + '</span>' +
          (holiday ? '<span class="tag tag--off">' + holiday.name + (holiday.tentative ? ' 잠정' : '') + '</span>' : '') +
        '</span>' +
        '<span class="tt__now"><span class="tt__nowtime">--:--</span>' +
        '<span class="tt__nowday"></span></span>' +
      '</div>');

      plan.slots.forEach(function (slot) {
        var r = slot.rows[rowIndex];
        var newDay = r.start.hour === 0;
        var title = entity.name + ' ' + localRange(r) + ' · ' + r.statusLabel +
          (r.notes.length ? ' (' + r.notes.join(', ') + ')' : '');
        html.push('<button type="button" class="tt__cell cell--' + r.status +
          (newDay ? ' is-newday' : '') +
          (slot.hour >= selHour && slot.hour < selHour + spanCols ? ' is-sel' : '') +
          '" data-hour="' + slot.hour + '" title="' + title + '">' +
          (newDay
            ? '<span class="tt__daymark">' + r.start.month + '월<br>' + r.start.day + '</span>'
            : '<span class="tt__hour">' + r.start.hour + '</span>') +
        '</button>');
      });
    });

    // 선택 구간 상자 (grid 흐름에 끼어들지 않도록 절대 배치)
    html.push('<div class="tt__marker" hidden></div>');

    html.push('</div></div>');
    html.push('<p class="tt__foot">칸을 클릭하면 회의 시각이 설정되고, 오른쪽 메일 초안에 자동 반영됩니다.</p>');
    html.push('</div>');
    el.timetable.innerHTML = html.join('');
    updateLiveClocks();
    positionMarker();
  }

  /** 선택한 시간대를 감싸는 상자를 실제 셀 위치에 맞춰 그린다 */
  function positionMarker() {
    var grid = el.timetable.querySelector('.tt__grid');
    var marker = el.timetable.querySelector('.tt__marker');
    if (!grid || !marker) return;

    var selected = grid.querySelectorAll('.tt__cell.is-sel');
    var ticks = grid.querySelectorAll('.tt__tick.is-sel');
    if (!selected.length || !ticks.length) { marker.hidden = true; return; }

    var spanCols = Math.max(1, Math.ceil(state.durationMin / 60));
    var firstCell = selected[0];
    var lastInRow = selected[Math.min(spanCols, selected.length) - 1];
    var lastCell = selected[selected.length - 1];

    var left = firstCell.offsetLeft;
    var right = lastInRow.offsetLeft + lastInRow.offsetWidth;
    var top = ticks[0].offsetTop;
    var bottom = lastCell.offsetTop + lastCell.offsetHeight;

    marker.hidden = false;
    marker.style.left = (left - 2) + 'px';
    marker.style.width = (right - left + 4) + 'px';
    marker.style.top = (top - 2) + 'px';
    marker.style.height = (bottom - top + 4) + 'px';
  }

  /* ── 선택 요약 ──────────────────────────────────────────── */

  function renderSelection() {
    var slot = selectedSlot();
    if (!slot) { el.panelSelection.innerHTML = ''; return; }
    var base = byId[state.baseId];
    var bp = baseParts(slot);
    var v = verdict(slot);

    el.panelSelection.innerHTML = '<section class="panel panel--selected">' +
      '<p class="panel__eyebrow">선택한 회의 시각</p>' +
      '<p class="panel__time">' + baseRange(slot) + '</p>' +
      '<p class="panel__sub">' + koDate(state.date) + ' · ' + base.name + ' 기준 ' + TZ.offsetLabel(base.tz, slot.utcStart) + '</p>' +
      '<p class="panel__badge"><span class="badge badge--' + v.key + '">' + v.text + '</span></p>' +
      '<ul class="minilist">' + slot.rows.map(function (r) {
        return '<li class="minilist__row">' +
          '<span class="minilist__name">' + r.entity.name +
            '<span class="minilist__code">' + r.entity.code + '</span></span>' +
          '<span class="minilist__time mono">' + localRange(r) + '</span>' +
          '<span class="pill pill--' + r.status + '">' + r.statusLabel + '</span></li>';
      }).join('') + '</ul>' +
      (bp ? '' : '') +
    '</section>';
  }

  /* ── 메일 초안 ──────────────────────────────────────────── */

  function mailContext(slot) {
    return {
      rows: slot.rows,
      durationMin: slot.durationMin,
      policy: state.plan.policy,
      base: byId[state.baseId],
      baseParts: baseParts(slot),
      baseRange: baseRange(slot)
    };
  }

  function renderMail() {
    var slot = selectedSlot();
    if (!slot) { el.panelMail.innerHTML = ''; return; }
    var lang = state.mailLang;
    var Mail = global.MailTemplate;

    var head = '<div class="panel__head"><p class="panel__eyebrow">회의 소집 메일</p>' +
      '<div class="modeswitch modeswitch--sm">' +
        '<button type="button" class="modeswitch__btn' + (lang === 'ko' ? ' is-active' : '') + '" data-lang="ko">국문</button>' +
        '<button type="button" class="modeswitch__btn' + (lang === 'en' ? ' is-active' : '') + '" data-lang="en">영문</button>' +
      '</div></div>';

    if (state.mailEditing) {
      var raw = Mail.raw(lang);
      el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
        '<p class="panel__note">아래 문구를 자유롭게 고칠 수 있습니다. 중괄호 토큰은 선택한 회의 시각으로 자동 치환됩니다.</p>' +
        '<p class="tokens">' + Mail.TOKENS.map(function (t) {
          return '<span class="token">' + t + '</span>';
        }).join('') + '</p>' +
        '<label class="mail__label" for="tplSubject">제목 템플릿</label>' +
        '<input class="mail__subject" id="tplSubject" value="' + escapeAttr(raw.subject) + '">' +
        '<label class="mail__label" for="tplBody">본문 템플릿</label>' +
        '<textarea class="mail__body" id="tplBody" rows="18">' + escapeHtml(raw.body) + '</textarea>' +
        '<div class="mail__actions">' +
          '<button type="button" class="copybtn" id="tplSave">저장</button>' +
          '<button type="button" class="ghostbtn" id="tplCancel">취소</button>' +
          '<button type="button" class="ghostbtn" id="tplReset">기본값으로 되돌리기</button>' +
        '</div></section>';
    } else {
      var mail = Mail.render(mailContext(slot), lang);
      el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
        '<label class="mail__label" for="mailSubject">제목</label>' +
        '<input class="mail__subject" id="mailSubject" value="' + escapeAttr(mail.subject) + '">' +
        '<label class="mail__label" for="mailBody">본문</label>' +
        '<textarea class="mail__body" id="mailBody" rows="18">' + escapeHtml(mail.body) + '</textarea>' +
        '<div class="mail__actions">' +
          '<button type="button" class="copybtn" id="mailCopy">제목 + 본문 복사</button>' +
          '<button type="button" class="ghostbtn" id="mailEdit">템플릿 편집' +
            (Mail.isCustomized(lang) ? ' <span class="tag tag--now">수정됨</span>' : '') + '</button>' +
        '</div>' +
        '<p class="panel__note">선택한 시각이 이미 반영되어 있습니다. 이 화면에서 고친 내용은 이번 복사에만 적용되고, 기본 문구를 바꾸려면 <strong>템플릿 편집</strong>을 눌러 저장하세요.</p>' +
      '</section>';
    }

    bindMailEvents();
  }

  function bindMailEvents() {
    el.panelMail.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.mailLang = btn.getAttribute('data-lang');
        renderMail();
      });
    });

    var copyBtn = document.getElementById('mailCopy');
    if (copyBtn) copyBtn.addEventListener('click', copyMail);

    var editBtn = document.getElementById('mailEdit');
    if (editBtn) editBtn.addEventListener('click', function () {
      state.mailEditing = true;
      renderMail();
    });

    var saveBtn = document.getElementById('tplSave');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      global.MailTemplate.save(state.mailLang, 'subject', document.getElementById('tplSubject').value);
      global.MailTemplate.save(state.mailLang, 'body', document.getElementById('tplBody').value);
      state.mailEditing = false;
      renderMail();
    });

    var cancelBtn = document.getElementById('tplCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      state.mailEditing = false;
      renderMail();
    });

    var resetBtn = document.getElementById('tplReset');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      global.MailTemplate.reset(state.mailLang);
      renderMail();
    });
  }

  function copyMail() {
    var text = document.getElementById('mailSubject').value + '\n\n' + document.getElementById('mailBody').value;
    var btn = document.getElementById('mailCopy');
    var done = function () {
      btn.textContent = '복사 완료';
      setTimeout(function () { btn.textContent = '제목 + 본문 복사'; }, 1800);
    };
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { /* 무시 */ }
    document.body.removeChild(ta);
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
  }

  /* ── 분기 패널 · 기준표 ─────────────────────────────────── */

  function windowLabel(win) {
    return TZ.hhmm(win.from) + '–' + TZ.hhmm(win.to % 24) + (win.to > 24 ? ' (익일)' : '');
  }

  function renderQuarterPanel(policy) {
    var next = global.Scheduler.nextQuarterOf(policy);
    var nextById = {};
    next.windows.forEach(function (w) { nextById[w.id] = w; });

    el.panelQuarter.innerHTML = '<section class="panel panel--policy">' +
      '<p class="panel__eyebrow">적용 중인 코어타임</p>' +
      '<p class="panel__title">' + policy.year + '년 ' + policy.quarter.slice(1) + '분기 · ' + policy.label.split('·')[1].trim() + '</p>' +
      '<p class="panel__note">' + policy.note + '</p>' +
      '<table class="qtable"><thead><tr><th>코어타임 창</th><th>' + policy.quarter + ' (한국 기준)</th><th>' + next.quarter + ' 예정</th></tr></thead><tbody>' +
      policy.windows.map(function (w) {
        var n = nextById[w.id];
        var changed = !n || n.from !== w.from || n.to !== w.to;
        return '<tr><td><span class="qtable__name">' + w.name + '</span>' +
          '<span class="qtable__ents">' + (w.entities || []).map(function (id) {
            return byId[id] ? byId[id].code : id;
          }).join(' · ') + '</span></td>' +
          '<td class="mono">' + windowLabel(w) + '</td>' +
          '<td class="mono' + (changed ? ' is-changed' : '') + '">' + (n ? windowLabel(n) : '—') +
          (changed ? '<span class="delta">변경</span>' : '') + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<p class="panel__next"><strong>' + next.year + '년 ' + next.quarter.slice(1) + '분기 예고</strong> ' + next.note + '</p>' +
    '</section>';
  }

  function renderPolicyTable(policy) {
    var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    var ids = [];
    quarters.forEach(function (q) {
      global.CORE_TIME_POLICY[q].windows.forEach(function (w) {
        if (ids.indexOf(w.id) === -1) ids.push(w.id);
      });
    });

    var head = '<thead><tr><th>코어타임 창</th>' + quarters.map(function (q) {
      return '<th' + (q === policy.quarter ? ' class="is-current"' : '') + '>' + q.slice(1) + '분기' +
        (q === policy.quarter ? ' <span class="tag tag--now">적용 중</span>' : '') + '</th>';
    }).join('') + '</tr></thead>';

    var body = ids.map(function (id) {
      var sample = null;
      quarters.forEach(function (q) {
        global.CORE_TIME_POLICY[q].windows.forEach(function (w) { if (w.id === id && !sample) sample = w; });
      });
      return '<tr><td><span class="dtable__name">' + sample.name + '</span>' +
        '<span class="dtable__code">' + (sample.entities || []).map(function (e) {
          return byId[e] ? byId[e].name : e;
        }).join(' · ') + '</span></td>' +
        quarters.map(function (q) {
          var w = null;
          global.CORE_TIME_POLICY[q].windows.forEach(function (x) { if (x.id === id) w = x; });
          return '<td class="mono' + (q === policy.quarter ? ' is-current' : '') + '">' +
            (w ? windowLabel(w) : '—') + '</td>';
        }).join('') + '</tr>';
    }).join('');

    el.policyTable.innerHTML = head + '<tbody>' + body + '</tbody>';
    el.policyNote.textContent = '모든 시각은 한국 본사(KST) 기준이며, 각 법인 시간표에는 같은 순간이 현지시각으로 표시됩니다. ' + policy.label + ' — ' + policy.note;
  }

  /* ── 지도 연동 ──────────────────────────────────────────── */

  function setMapMode(mode) {
    state.mapMode = mode;
    el.mapMode.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-mode') === mode);
    });
    applyMeetingToMap();
  }

  function applyMeetingToMap() {
    var slot = selectedSlot();
    if (!slot || state.mapMode === 'live') {
      mapView.setMeeting(null);
      updateClockList();
      el.mapHint.textContent = '각 법인의 현재 시각을 1초 단위로 표시하고 있습니다.';
      return;
    }
    var statusById = {};
    slot.rows.forEach(function (r) { statusById[r.id] = r; });
    mapView.setMeeting({ utcStart: slot.utcStart, durationMin: slot.durationMin, statusById: statusById });
    updateClockList();
    el.mapHint.textContent = '선택한 회의 시각(' + byId[state.baseId].name + ' 기준 ' + baseRange(slot) + ') 기준의 각 법인 현지시각입니다.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
