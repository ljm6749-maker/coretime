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
    results: document.getElementById('results'),
    quarterHint: document.getElementById('quarterHint'),
    policyNote: document.getElementById('policyNote'),
    policyTable: document.getElementById('policyTable'),
    mapHint: document.getElementById('mapHint'),
    canvas: document.getElementById('mapCanvas'),
    overlay: document.getElementById('mapOverlay'),
    controls: document.getElementById('controls'),
    mapMode: document.getElementById('mapMode'),
    clockList: document.getElementById('clockList')
  };

  var STEP_MIN = 30;

  var state = {
    date: null,
    baseId: 'kr',
    durationMin: 60,
    participants: ENTITIES.map(function (e) { return e.id; }),
    selectedMinutes: null,
    plan: null,
    mapMode: 'live'   // 'live' = 실시간 시계, 'meeting' = 선택한 회의 시각
  };

  var mapView;

  /* ── 초기화 ─────────────────────────────────────────────── */

  function todayIn(tz) {
    var p = TZ.zonedParts(tz, Date.now());
    return p.year + '-' + TZ.pad(p.month) + '-' + TZ.pad(p.day);
  }

  function init() {
    state.date = todayIn(byId[state.baseId].tz);
    el.date.value = state.date;

    ENTITIES.forEach(function (e) {
      var opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.name + ' · ' + e.city;
      el.base.appendChild(opt);
    });
    el.base.value = state.baseId;

    global.DURATIONS.forEach(function (min) {
      var opt = document.createElement('option');
      opt.value = String(min);
      opt.textContent = min < 60 ? min + '분' : (min / 60) + '시간' + (min % 60 ? ' 30분' : '');
      el.duration.appendChild(opt);
    });
    el.duration.value = String(state.durationMin);

    buildChips();
    buildClockList();

    el.date.addEventListener('change', function () {
      state.date = el.date.value || state.date;
      el.date.value = state.date;
      state.selectedMinutes = null;
      update();
    });
    el.base.addEventListener('change', function () {
      state.baseId = el.base.value;
      state.selectedMinutes = null;
      update();
    });
    el.duration.addEventListener('change', function () {
      state.durationMin = +el.duration.value;
      state.selectedMinutes = null;
      update();
    });
    el.controls.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-select]');
      if (!btn) return;
      state.participants = btn.getAttribute('data-select') === 'all'
        ? ENTITIES.map(function (e) { return e.id; })
        : [];
      syncChips();
      state.selectedMinutes = null;
      update();
    });

    el.mapMode.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-mode]');
      if (!btn) return;
      setMapMode(btn.getAttribute('data-mode'));
    });

    mapView = new global.MapView(el.canvas, el.overlay);
    mapView.render();
    mapView.updateClocks();

    tickClocks();
    setInterval(tickClocks, 1000);
    setInterval(function () { mapView.render(); }, 5 * 60 * 1000);
    setInterval(function () {
      var parts = state.date.split('-');
      renderPolicy(global.Scheduler.policyFor(+parts[0], +parts[1]));
    }, 30 * 1000);

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
        state.selectedMinutes = null;
        update();
      });
      el.chips.appendChild(label);
    });
  }

  function buildClockList() {
    el.clockList.innerHTML = ENTITIES.map(function (e) {
      return '<article class="clock" data-clock="' + e.id + '">' +
        '<p class="clock__head"><span class="clock__name">' + e.name + '</span>' +
        '<span class="clock__code">' + e.code + '</span></p>' +
        '<p class="clock__time">--:--</p>' +
        '<p class="clock__meta"></p>' +
        '<p class="clock__city">' + e.city + '</p>' +
      '</article>';
    }).join('');
  }

  function updateClockList() {
    var now = Date.now();
    ENTITIES.forEach(function (e) {
      var node = el.clockList.querySelector('[data-clock="' + e.id + '"]');
      if (!node) return;
      var meetingRow = mapView.meeting && mapView.meeting.statusById[e.id];
      var p = meetingRow ? meetingRow.start : TZ.zonedParts(e.tz, now);
      node.querySelector('.clock__time').textContent = TZ.pad(p.hour) + ':' + TZ.pad(p.minute);
      node.querySelector('.clock__meta').textContent = meetingRow
        ? TZ.DAY_KO[p.weekday] + '요일 · ' + meetingRow.statusLabel
        : TZ.DAY_KO[p.weekday] + '요일 · ' + TZ.offsetLabel(e.tz, now);
      node.className = 'clock' +
        (state.participants.indexOf(e.id) === -1 ? ' is-dimmed' : '') +
        (meetingRow ? ' is-' + meetingRow.status : '');
    });
  }

  function syncChips() {
    el.chips.querySelectorAll('input').forEach(function (input) {
      input.checked = state.participants.indexOf(input.value) !== -1;
    });
  }

  function tickClocks() {
    var now = Date.now();
    var u = new Date(now);
    el.utcClock.textContent = TZ.pad(u.getUTCHours()) + ':' + TZ.pad(u.getUTCMinutes()) + ':' + TZ.pad(u.getUTCSeconds());
    if (!mapView.meeting) mapView.updateClocks();
    updateClockList();
  }

  /* ── 계산 및 렌더 ───────────────────────────────────────── */

  function orderedParticipants() {
    return ENTITIES.filter(function (e) { return state.participants.indexOf(e.id) !== -1; });
  }

  function update() {
    var participants = orderedParticipants();
    mapView.setSelection(state.participants);

    var parts = state.date.split('-');
    var policy = global.Scheduler.policyFor(+parts[0], +parts[1]);
    el.quarterHint.textContent = parts[0] + '년 ' + policy.quarter.slice(1) + '분기 — ' + policy.label.split('·')[1].trim() + ' 적용';
    renderPolicy(policy);

    if (participants.length < 2) {
      state.plan = null;
      state.mapMode = 'live';
      setMapMode('live');
      el.results.innerHTML =
        '<div class="empty"><p class="empty__title">참여 법인을 2곳 이상 선택해 주세요</p>' +
        '<p class="empty__text">선택한 법인들의 코어타임이 겹치는 구간을 찾아 회의시간을 추천합니다.</p></div>';
      return;
    }

    var plan = global.Scheduler.plan({
      date: state.date,
      baseTz: byId[state.baseId].tz,
      entities: participants,
      durationMin: state.durationMin,
      stepMin: STEP_MIN
    });
    state.plan = plan;

    if (state.selectedMinutes === null) {
      state.selectedMinutes = plan.ranked[0].baseMinutes;
    }

    renderResults(plan);
    applyMeetingToMap();
  }

  function selectedSlot() {
    if (!state.plan) return null;
    return state.plan.slots.filter(function (s) { return s.baseMinutes === state.selectedMinutes; })[0] || null;
  }

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
    el.mapHint.textContent = '선택한 회의 시각(' + byId[state.baseId].name + ' 기준 ' + baseRangeLabel(slot) + ') 기준의 각 법인 현지시각입니다.';
  }

  function baseRangeLabel(slot) {
    var start = slot.baseDecimal;
    var end = start + slot.durationMin / 60;
    return TZ.hhmm(start) + '–' + TZ.hhmm(end) + (end >= 24 ? ' (익일)' : '');
  }

  function verdict(slot) {
    if (slot.allCore) return { key: 'core', text: '전원 코어타임' };
    if (slot.feasible) return { key: 'ext', text: '전원 근무시간 내' };
    if (slot.counts.off > 0) return { key: 'off', text: '휴무 ' + slot.counts.off + '개 법인' };
    return { key: 'out', text: '시간외 ' + slot.counts.out + '개 법인' };
  }

  /**
   * 해당 날짜에 "종일" 휴무인 법인.
   * 기준 법인의 하루 전체(00:00~24:00)에서 단 한 시각도 근무일에 걸리지 않는 경우만 잡는다.
   * (예: 한국 기준 월요일 정오에 미주는 아직 일요일이지만, 같은 날 늦은 시각에는 월요일이므로 휴무가 아니다.)
   */
  function offEntityNames(plan) {
    var names = [];
    plan.slots[0].rows.forEach(function (_, rowIndex) {
      var alwaysOff = plan.slots.every(function (slot) { return slot.rows[rowIndex].status === 'off'; });
      if (alwaysOff) names.push(plan.slots[0].rows[rowIndex].entity.name);
    });
    return names;
  }

  function nextWeekday(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    do {
      d.setUTCDate(d.getUTCDate() + 1);
    } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    return d.getUTCFullYear() + '-' + TZ.pad(d.getUTCMonth() + 1) + '-' + TZ.pad(d.getUTCDate());
  }

  function formatKoDate(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return (+p[1]) + '월 ' + (+p[2]) + '일(' + TZ.DAY_KO[d.getUTCDay()] + ')';
  }

  function shortKoDate(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return (+p[1]) + '/' + (+p[2]) + '(' + TZ.DAY_KO[d.getUTCDay()] + ')';
  }

  function countsLabel(slot) {
    var parts = [];
    if (slot.counts.core) parts.push('코어 ' + slot.counts.core);
    if (slot.counts.ext) parts.push('확장 ' + slot.counts.ext);
    if (slot.counts.out) parts.push('시간외 ' + slot.counts.out);
    if (slot.counts.off) parts.push('휴무 ' + slot.counts.off);
    return parts.join(' · ');
  }

  function localRange(row) {
    var s = TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute);
    var e = TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
    return s + '–' + e;
  }

  function dayShift(row, baseParts) {
    var a = Date.UTC(row.start.year, row.start.month - 1, row.start.day);
    var b = Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day);
    var diff = Math.round((a - b) / 86400000);
    if (diff === 0) return '';
    return diff > 0 ? '+' + diff + '일' : diff + '일';
  }

  function baseParts(slot) {
    return TZ.zonedParts(byId[state.baseId].tz, slot.utcStart);
  }

  function renderResults(plan) {
    var base = byId[state.baseId];
    var spread = Number(plan.spreadHours.toFixed(1));
    var html = [];

    /* 요약 */
    var commonText = plan.commonCore.length
      ? plan.commonCore.map(function (w) {
          return TZ.hhmm(w.from) + '–' + TZ.hhmm(w.to + STEP_MIN / 60);
        }).join(', ')
      : (plan.hasFeasible ? '없음 — 확장 시간대 활용 필요' : '없음');
    html.push(
      '<div class="summary">' +
        '<div class="summary__item"><span class="summary__label">적용 기준</span>' +
          '<span class="summary__value">' + plan.policy.year + ' ' + plan.policy.quarter + ' · ' + plan.policy.label.split('·')[1].trim() + '</span></div>' +
        '<div class="summary__item"><span class="summary__label">전원 코어타임 구간 <em>' + base.name + ' 기준</em></span>' +
          '<span class="summary__value summary__value--mono">' + commonText + '</span></div>' +
        '<div class="summary__item"><span class="summary__label">참여 법인 최대 시차</span>' +
          '<span class="summary__value summary__value--mono">' + spread + '시간</span></div>' +
      '</div>'
    );

    var offNames = offEntityNames(plan);
    if (offNames.length) {
      var next = nextWeekday(state.date);
      html.push(
        '<div class="notice notice--off">' +
          '<p class="notice__title">' + formatKoDate(state.date) + '에는 ' + offNames.join(' · ') + ' 법인이 휴무입니다</p>' +
          '<p class="notice__text">해당 법인은 이 날짜의 어느 시각에도 근무일이 아니므로 추천에서 뒤로 밀립니다. ' +
          '<button type="button" class="linkbtn linkbtn--inline" data-nextday="' + next + '">가장 가까운 평일(' + formatKoDate(next) + ')로 변경</button></p>' +
        '</div>'
      );
    }

    if (!plan.hasFeasible) {
      html.push(
        '<div class="notice">' +
          '<p class="notice__title">전원이 근무시간 안에서 만날 수 있는 시간이 없습니다</p>' +
          '<p class="notice__text">최대 시차 ' + plan.spreadHours + '시간으로, 어떤 시각을 잡아도 일부 법인은 근무시간 밖이 됩니다. ' +
          '아래 추천은 <strong>부담이 가장 적은 순서</strong>이며, 필요하면 회의를 두 차례로 나누는 안을 함께 검토하세요.</p>' +
        '</div>'
      );
    }

    /* 추천 카드 */
    html.push('<h3 class="results__title">추천 회의시간 <span>' + base.name + ' ' + state.date + ' 기준</span></h3>');
    html.push('<ol class="reco">');
    plan.best.forEach(function (slot, i) {
      var v = verdict(slot);
      var bp = baseParts(slot);
      html.push(
        '<li><button type="button" class="card' + (slot.baseMinutes === state.selectedMinutes ? ' is-active' : '') +
          '" data-minutes="' + slot.baseMinutes + '">' +
          '<span class="card__rank">' + (i + 1) + '</span>' +
          '<span class="card__time">' + baseRangeLabel(slot) + '</span>' +
          '<span class="card__verdict"><span class="badge badge--' + v.key + '">' + v.text + '</span>' +
          '<span class="card__counts">' + countsLabel(slot) + '</span></span>' +
          '<span class="card__mini">' +
            slot.rows.map(function (r) {
              return '<span class="mini mini--' + r.status + '" title="' + r.entity.name + ' ' + localRange(r) + '">' +
                r.entity.code + '</span>';
            }).join('') +
          '</span>' +
        '</button></li>'
      );
      void bp;
    });
    html.push('</ol>');

    /* 선택 슬롯 상세 */
    var slot = selectedSlot() || plan.ranked[0];
    var bp = baseParts(slot);
    var v = verdict(slot);
    html.push(
      '<div class="detail">' +
        '<div class="detail__head">' +
          '<div><p class="detail__eyebrow">선택한 시간</p>' +
          '<p class="detail__time">' + TZ.dateLabel(bp) + ' ' + baseRangeLabel(slot) +
          ' <span class="detail__base">' + base.name + ' 기준 · ' + TZ.offsetLabel(base.tz, slot.utcStart) + '</span></p></div>' +
          '<div class="detail__actions"><span class="badge badge--' + v.key + '">' + v.text + '</span>' +
          '<button type="button" class="copybtn" id="copyBtn">회의 안내 복사</button></div>' +
        '</div>' +
        '<div class="tablewrap"><table class="dtable"><thead><tr>' +
          '<th>법인</th><th>현지 일시</th><th>코어타임</th><th>판정</th><th>비고</th>' +
        '</tr></thead><tbody>' +
        slot.rows.map(function (r) {
          var shift = dayShift(r, bp);
          return '<tr class="row--' + r.status + '">' +
            '<td><span class="dtable__name">' + r.entity.name + '</span><span class="dtable__code">' + r.entity.code + '</span></td>' +
            '<td class="mono">' + localRange(r) +
              (shift ? ' <span class="shift">' + shift + '</span>' : '') +
              '<span class="dtable__day">' + TZ.DAY_KO[r.start.weekday] + '요일 · ' + TZ.offsetLabel(r.entity.tz, slot.utcStart) + '</span></td>' +
            '<td class="mono muted">' + TZ.hhmm(r.window.core[0]) + '–' + TZ.hhmm(r.window.core[1]) + '</td>' +
            '<td><span class="pill pill--' + r.status + '">' + r.statusLabel + '</span></td>' +
            '<td class="muted">' + (r.notes.length ? r.notes.join(' · ') : '—') + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>' +
      '</div>'
    );

    /* 분할 회의 제안 (전원 참석이 불가능할 때만) */
    if (!plan.hasFeasible) html.push(renderSplit());

    /* 24시간 타임라인 */
    html.push(renderTimeline(plan));

    el.results.innerHTML = html.join('');

    el.results.querySelectorAll('[data-minutes]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.selectedMinutes = +node.getAttribute('data-minutes');
        renderResults(state.plan);
        setMapMode('meeting');
      });
    });
    var copyBtn = document.getElementById('copyBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyInvite);

    var nextDayBtn = el.results.querySelector('[data-nextday]');
    if (nextDayBtn) {
      nextDayBtn.addEventListener('click', function () {
        state.date = nextDayBtn.getAttribute('data-nextday');
        el.date.value = state.date;
        state.selectedMinutes = null;
        update();
      });
    }
  }

  function renderSplit() {
    var groups = global.Scheduler.splitPlan({
      date: state.date,
      baseTz: byId[state.baseId].tz,
      entities: orderedParticipants(),
      durationMin: state.durationMin,
      stepMin: STEP_MIN
    });
    if (!groups) return '';
    groups.sort(function (a, b) { return a.slot.baseMinutes - b.slot.baseMinutes; });

    var base = byId[state.baseId];
    var html = ['<div class="split">'];
    html.push('<h3 class="results__title">분할 회의 제안 <span>시차가 가장 크게 벌어지는 지점에서 두 그룹으로 나눈 안 · ' + base.name + ' 기준</span></h3>');
    html.push('<div class="split__grid">');
    groups.forEach(function (group, i) {
      var v = verdict(group.slot);
      html.push(
        '<button type="button" class="splitcard" data-minutes="' + group.slot.baseMinutes + '">' +
          '<span class="splitcard__head"><span class="splitcard__label">' + (i + 1) + '차 세션 · ' + group.entities.length + '개 법인</span>' +
          '<span class="badge badge--' + v.key + '">' + v.text + '</span></span>' +
          '<span class="splitcard__time">' + baseRangeLabel(group.slot) + '</span>' +
          '<span class="splitcard__list">' +
            group.slot.rows.map(function (r) {
              return '<span class="splitcard__row"><span>' + r.entity.name + '</span>' +
                '<span class="mono pill pill--' + r.status + '">' + localRange(r) + '</span></span>';
            }).join('') +
          '</span>' +
        '</button>'
      );
    });
    html.push('</div></div>');
    return html.join('');
  }

  function renderTimeline(plan) {
    var base = byId[state.baseId];
    var cols = plan.slots.length;
    var hours = [];
    for (var h = 0; h < 24; h += 2) hours.push(h);

    var html = ['<div class="timeline">'];
    html.push('<div class="timeline__head"><h3 class="results__title">하루 전체 시간대 <span>' + base.name + ' 기준 · 막대를 클릭하면 해당 시각으로 전환</span></h3>');
    html.push('<ul class="legend legend--flat">' +
      '<li><span class="legend__swatch legend__swatch--core"></span>코어타임</li>' +
      '<li><span class="legend__swatch legend__swatch--ext"></span>확장 가능</li>' +
      '<li><span class="legend__swatch legend__swatch--out"></span>근무시간 밖</li>' +
      '<li><span class="legend__swatch legend__swatch--off"></span>휴무</li></ul></div>');

    html.push('<div class="grid" style="--cols:' + cols + '">');
    plan.slots[0].rows.forEach(function (_, rowIndex) {
      var entity = plan.slots[0].rows[rowIndex].entity;
      html.push('<div class="grid__label"><span class="grid__name">' + entity.name + '</span><span class="grid__code">' + entity.code + '</span></div>');
      html.push('<div class="grid__track">');
      plan.slots.forEach(function (slot) {
        var r = slot.rows[rowIndex];
        html.push('<button type="button" class="cell cell--' + r.status +
          (slot.baseMinutes === state.selectedMinutes ? ' is-selected' : '') +
          '" data-minutes="' + slot.baseMinutes + '" title="' + entity.name + ' ' + localRange(r) + ' · ' + r.statusLabel +
          ' (기준 ' + TZ.hhmm(slot.baseDecimal) + ')"><span class="sr-only">' + TZ.hhmm(slot.baseDecimal) + ' ' + r.statusLabel + '</span></button>');
      });
      html.push('</div>');
    });
    html.push('<div class="grid__label"></div><div class="grid__axis">');
    hours.forEach(function (h) {
      html.push('<span class="grid__tick" style="--at:' + (h / 24 * 100) + '%">' + TZ.pad(h) + '</span>');
    });
    html.push('</div></div></div>');
    return html.join('');
  }

  function renderPolicy(policy) {
    var head = '<thead><tr><th>법인</th><th>현지 코어타임</th><th>확장 가능</th><th>현재 현지시각</th></tr></thead>';
    var now = Date.now();
    var body = ENTITIES.map(function (e) {
      var w = policy.windows[e.id] || { core: [9, 18], extended: [8, 19] };
      var p = TZ.zonedParts(e.tz, now);
      var active = p.decimal >= w.core[0] && p.decimal < w.core[1] && e.workdays.indexOf(p.weekday) !== -1;
      return '<tr>' +
        '<td><span class="dtable__name">' + e.name + '</span><span class="dtable__code">' + e.legal + '</span></td>' +
        '<td class="mono">' + TZ.hhmm(w.core[0]) + '–' + TZ.hhmm(w.core[1]) + '</td>' +
        '<td class="mono muted">' + TZ.hhmm(w.extended[0]) + '–' + TZ.hhmm(w.extended[1]) + '</td>' +
        '<td class="mono">' + TZ.pad(p.hour) + ':' + TZ.pad(p.minute) +
          ' <span class="pill pill--' + (active ? 'core' : 'idle') + '">' + (active ? '근무 중' : '업무시간 외') + '</span></td>' +
      '</tr>';
    }).join('');
    el.policyTable.innerHTML = head + '<tbody>' + body + '</tbody>';
    el.policyNote.textContent = policy.label + ' — ' + policy.note;
  }

  /* ── 회의 안내 복사 ─────────────────────────────────────── */

  function inviteText() {
    var slot = selectedSlot();
    if (!slot) return '';
    var base = byId[state.baseId];
    var bp = baseParts(slot);
    var lines = [];
    lines.push('[한화비전 글로벌 회의 안내]');
    lines.push('일시 (' + base.name + ' 기준) ' + bp.year + '-' + TZ.pad(bp.month) + '-' + TZ.pad(bp.day) +
      ' (' + TZ.DAY_KO[bp.weekday] + ') ' + baseRangeLabel(slot));
    lines.push('소요시간 ' + slot.durationMin + '분');
    lines.push('');
    slot.rows.forEach(function (r) {
      var shift = dayShift(r, bp);
      lines.push('· ' + r.entity.name + ' (' + r.entity.code + ') ' +
        TZ.pad(r.start.month) + '/' + TZ.pad(r.start.day) + ' (' + TZ.DAY_KO[r.start.weekday] + ') ' +
        localRange(r) + (shift ? ' ' + shift : '') + '  — ' + r.statusLabel);
    });
    lines.push('');
    lines.push('적용 기준: ' + state.plan.policy.year + ' ' + state.plan.policy.quarter + ' ' + state.plan.policy.label);
    return lines.join('\n');
  }

  function copyInvite() {
    var text = inviteText();
    var btn = document.getElementById('copyBtn');
    var done = function () {
      btn.textContent = '복사 완료';
      setTimeout(function () { btn.textContent = '회의 안내 복사'; }, 1800);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
