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
    boardMain: document.getElementById('boardMain'),
    boardSide: document.getElementById('boardSide'),
    quarterHint: document.getElementById('quarterHint'),
    policyNote: document.getElementById('policyNote'),
    policyTable: document.getElementById('policyTable'),
    mapHint: document.getElementById('mapHint'),
    mapMode: document.getElementById('mapMode'),
    canvas: document.getElementById('mapCanvas'),
    overlay: document.getElementById('mapOverlay'),
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
    mapMode: 'live',
    mailLang: 'ko'
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
      opt.textContent = min < 60 ? min + '분' : Math.floor(min / 60) + '시간' + (min % 60 ? ' 30분' : '');
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
      var selectBtn = event.target.closest('[data-select]');
      if (selectBtn) {
        state.participants = selectBtn.getAttribute('data-select') === 'all'
          ? ENTITIES.map(function (e) { return e.id; })
          : [];
        syncChips();
        state.selectedMinutes = null;
        update();
        return;
      }
      var stepBtn = event.target.closest('[data-step]');
      if (stepBtn) {
        state.date = shiftDate(state.date, +stepBtn.getAttribute('data-step'));
        el.date.value = state.date;
        state.selectedMinutes = null;
        update();
      }
    });
    el.mapMode.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-mode]');
      if (btn) setMapMode(btn.getAttribute('data-mode'));
    });

    mapView = new global.MapView(el.canvas, el.overlay);
    mapView.render();
    mapView.updateClocks();

    tickClocks();
    setInterval(tickClocks, 1000);
    setInterval(function () { mapView.render(); }, 5 * 60 * 1000);

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
      var holiday = global.holidayOf(e.id, global.Scheduler.dateKey(p));
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

  function tickClocks() {
    var u = new Date();
    el.utcClock.textContent = TZ.pad(u.getUTCHours()) + ':' + TZ.pad(u.getUTCMinutes()) + ':' + TZ.pad(u.getUTCSeconds());
    if (!mapView.meeting) mapView.updateClocks();
    updateClockList();
  }

  /* ── 날짜 유틸 ──────────────────────────────────────────── */

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

  function formatKoDate(dateStr) {
    var p = dateStr.split('-');
    return (+p[1]) + '월 ' + (+p[2]) + '일(' + TZ.DAY_KO[weekdayOf(dateStr)] + ')';
  }

  function shortKoDate(dateStr) {
    var p = dateStr.split('-');
    return (+p[1]) + '/' + (+p[2]) + '(' + TZ.DAY_KO[weekdayOf(dateStr)] + ')';
  }

  function nextWeekday(dateStr) {
    var next = dateStr;
    do { next = shiftDate(next, 1); } while (weekdayOf(next) === 0 || weekdayOf(next) === 6);
    return next;
  }

  /* ── 계산 ───────────────────────────────────────────────── */

  function orderedParticipants() {
    return ENTITIES.filter(function (e) { return state.participants.indexOf(e.id) !== -1; });
  }

  function update() {
    var participants = orderedParticipants();
    mapView.setSelection(state.participants);

    var parts = state.date.split('-');
    var policy = global.Scheduler.policyFor(+parts[0], +parts[1]);
    el.quarterHint.textContent = parts[0] + '년 ' + policy.quarter.slice(1) + '분기 코어타임 적용';
    renderPolicyTable(policy);

    if (participants.length < 2) {
      state.plan = null;
      setMapMode('live');
      el.boardMain.innerHTML =
        '<div class="empty"><p class="empty__title">참여 법인을 2곳 이상 선택해 주세요</p>' +
        '<p class="empty__text">선택한 법인들의 코어타임이 겹치는 구간을 찾아 회의시간을 추천합니다.</p></div>';
      el.boardSide.innerHTML = renderQuarterPanel(policy);
      return;
    }

    state.plan = global.Scheduler.plan({
      date: state.date,
      baseTz: byId[state.baseId].tz,
      entities: participants,
      durationMin: state.durationMin,
      stepMin: STEP_MIN
    });

    if (state.selectedMinutes === null) state.selectedMinutes = state.plan.ranked[0].baseMinutes;

    renderBoard();
  }

  function selectedSlot() {
    if (!state.plan) return null;
    return state.plan.slots.filter(function (s) { return s.baseMinutes === state.selectedMinutes; })[0] || null;
  }

  function baseParts(slot) {
    return TZ.zonedParts(byId[state.baseId].tz, slot.utcStart);
  }

  function baseRangeLabel(slot) {
    var start = slot.baseDecimal;
    var end = start + slot.durationMin / 60;
    return TZ.hhmm(start) + '–' + TZ.hhmm(end) + (end >= 24 ? ' (익일)' : '');
  }

  function localRange(row) {
    return TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute) + '–' +
           TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
  }

  function verdict(slot) {
    if (slot.allCore) return { key: 'core', text: '전원 코어타임' };
    if (slot.feasible) return { key: 'ext', text: '전원 근무시간 내' };
    if (slot.counts.off > 0) return { key: 'off', text: '휴무 ' + slot.counts.off + '개 법인' };
    return { key: 'out', text: '시간외 ' + slot.counts.out + '개 법인' };
  }

  function countsLabel(slot) {
    var parts = [];
    if (slot.counts.core) parts.push('코어 ' + slot.counts.core);
    if (slot.counts.ext) parts.push('확장 ' + slot.counts.ext);
    if (slot.counts.out) parts.push('시간외 ' + slot.counts.out);
    if (slot.counts.off) parts.push('휴무 ' + slot.counts.off);
    return parts.join(' · ');
  }

  function dayShift(row, bp) {
    var a = Date.UTC(row.start.year, row.start.month - 1, row.start.day);
    var b = Date.UTC(bp.year, bp.month - 1, bp.day);
    var diff = Math.round((a - b) / 86400000);
    return diff === 0 ? '' : (diff > 0 ? '+' + diff + '일' : diff + '일');
  }

  /** 선택한 날짜(달력 기준)가 공휴일인 참여 법인 */
  function holidayEntities() {
    return orderedParticipants().map(function (e) {
      return { entity: e, holiday: global.holidayOf(e.id, state.date) };
    }).filter(function (x) { return x.holiday; });
  }

  /* ── 렌더 ───────────────────────────────────────────────── */

  function renderBoard() {
    var plan = state.plan;
    el.boardMain.innerHTML = renderNotices(plan) + renderGrid(plan) + renderReco(plan) +
      (plan.hasFeasible ? '' : renderSplit());
    el.boardSide.innerHTML = renderSelection(plan) + renderMail(plan) + renderQuarterPanel(plan.policy);
    bindBoardEvents();
    applyMeetingToMap();
  }

  function bindBoardEvents() {
    el.boardMain.querySelectorAll('[data-minutes]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.selectedMinutes = +node.getAttribute('data-minutes');
        renderBoard();
        setMapMode('meeting');
      });
    });

    var nextDayBtn = el.boardMain.querySelector('[data-nextday]');
    if (nextDayBtn) {
      nextDayBtn.addEventListener('click', function () {
        state.date = nextDayBtn.getAttribute('data-nextday');
        el.date.value = state.date;
        state.selectedMinutes = null;
        update();
      });
    }

    el.boardSide.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.mailLang = btn.getAttribute('data-lang');
        el.boardSide.innerHTML = renderSelection(state.plan) + renderMail(state.plan) + renderQuarterPanel(state.plan.policy);
        bindBoardEvents();
      });
    });

    var copyBtn = el.boardSide.querySelector('#mailCopy');
    if (copyBtn) copyBtn.addEventListener('click', copyMail);
  }

  /** 안내 문구 (휴무 / 전원 참석 불가) */
  function renderNotices(plan) {
    var html = '';
    var weekday = weekdayOf(state.date);
    var holidays = holidayEntities();

    if (weekday === 0 || weekday === 6) {
      html += '<div class="notice notice--off">' +
        '<p class="notice__title">' + formatKoDate(state.date) + '은 주말입니다</p>' +
        '<p class="notice__text">대부분 법인이 휴무이므로 추천 순위가 낮아집니다. ' +
        '<button type="button" class="linkbtn linkbtn--inline" data-nextday="' + nextWeekday(state.date) + '">' +
        '가장 가까운 평일 ' + shortKoDate(nextWeekday(state.date)) + '로 변경</button></p></div>';
    }

    if (holidays.length) {
      html += '<div class="notice notice--off">' +
        '<p class="notice__title">' + formatKoDate(state.date) + '은 ' + holidays.length + '개 법인의 공휴일입니다</p>' +
        '<p class="notice__text">' + holidays.map(function (x) {
          return x.entity.name + ' — ' + x.holiday.name + (x.holiday.tentative ? ' (잠정)' : '');
        }).join(' · ') + '. 시차 때문에 일부 시간대는 현지 기준 전날/다음날이라 근무일일 수 있으며, 시간표에 빗금으로 표시됩니다.</p></div>';
    }
    if (!plan.hasFeasible) {
      html += '<div class="notice">' +
        '<p class="notice__title">전원이 근무시간 안에서 만날 수 있는 시간이 없습니다</p>' +
        '<p class="notice__text">참여 법인 최대 시차 ' + Number(plan.spreadHours.toFixed(1)) + '시간. ' +
        '아래 추천은 <strong>부담이 가장 적은 순서</strong>이며, 회의를 두 차례로 나누는 안도 함께 제시합니다.</p></div>';
    }
    return html;
  }

  /** 월드타임버디 방식 시간표 — 행: 법인, 열: 기준 법인의 0~23시 */
  function renderGrid(plan) {
    var base = byId[state.baseId];
    var rows = plan.slots[0].rows;
    var hourSlots = plan.slots.filter(function (s) { return s.baseMinutes % 60 === 0; });
    var selHour = Math.floor(state.selectedMinutes / 60);
    var spanEnd = Math.ceil((state.selectedMinutes + state.durationMin) / 60);

    var html = ['<div class="wtb">'];
    html.push('<div class="wtb__head">' +
      '<h3 class="section__title">시간표 <span>' + base.name + ' ' + formatKoDate(state.date) + ' 기준</span></h3>' +
      '<ul class="legend legend--flat">' +
        '<li><span class="legend__swatch legend__swatch--core"></span>코어타임</li>' +
        '<li><span class="legend__swatch legend__swatch--ext"></span>확장 가능</li>' +
        '<li><span class="legend__swatch legend__swatch--out"></span>근무시간 밖</li>' +
        '<li><span class="legend__swatch legend__swatch--off"></span>휴무 · 공휴일</li>' +
      '</ul></div>');

    html.push('<div class="wtb__scroll"><div class="wtb__grid">');

    // 헤더 행: 기준 법인의 시각
    html.push('<div class="wtb__corner"><span class="wtb__cornerlabel">기준</span>' +
      '<span class="wtb__cornerbase">' + base.name + ' ' + TZ.offsetLabel(base.tz, plan.slots[0].utcStart) + '</span></div>');
    for (var h = 0; h < 24; h++) {
      html.push('<div class="wtb__tick' + (h >= selHour && h < spanEnd ? ' is-sel' : '') + '">' + TZ.pad(h) + '</div>');
    }

    // 법인 행
    rows.forEach(function (_, rowIndex) {
      var entity = rows[rowIndex].entity;
      var firstRow = hourSlots[0].rows[rowIndex];
      var offsetTxt = TZ.offsetLabel(entity.tz, hourSlots[0].utcStart);
      var dayHoliday = null;
      hourSlots.forEach(function (slot) {
        var r = slot.rows[rowIndex];
        if (r.holiday && !dayHoliday) dayHoliday = r.holiday;
      });

      html.push('<div class="wtb__label">' +
        '<span class="wtb__name">' + entity.name + '<span class="wtb__code">' + entity.code + '</span></span>' +
        '<span class="wtb__meta">' + entity.city + '</span>' +
        '<span class="wtb__meta wtb__meta--mono">' + offsetTxt +
          (TZ.isDST(entity.tz, hourSlots[0].utcStart) ? ' <span class="tag">DST</span>' : '') + '</span>' +
        (dayHoliday ? '<span class="tag tag--off">' + dayHoliday.name + (dayHoliday.tentative ? ' 잠정' : '') + '</span>' : '') +
      '</div>');

      hourSlots.forEach(function (slot, h) {
        var r = slot.rows[rowIndex];
        var isNewDay = r.start.hour === 0;
        var title = entity.name + ' ' + localRange(r) + ' · ' + r.statusLabel +
          (r.notes.length ? ' (' + r.notes.join(', ') + ')' : '');
        html.push('<button type="button" class="wtb__cell cell--' + r.status +
          (h >= selHour && h < spanEnd ? ' is-sel' : '') + (isNewDay ? ' is-newday' : '') +
          '" data-minutes="' + slot.baseMinutes + '" title="' + title + '">' +
          '<span class="wtb__hour">' + TZ.pad(r.start.hour) + '</span>' +
          (isNewDay ? '<span class="wtb__daymark">' + r.start.month + '/' + r.start.day + '</span>' : '') +
        '</button>');
      });
      void firstRow;
    });

    html.push('</div></div>');
    html.push('<p class="wtb__foot">칸을 클릭하면 그 시각으로 회의가 설정됩니다. 30분 단위 후보는 아래 추천 목록에서 선택할 수 있습니다.</p>');
    html.push('</div>');
    return html.join('');
  }

  function renderReco(plan) {
    var base = byId[state.baseId];
    var commonText = plan.commonCore.length
      ? plan.commonCore.map(function (w) { return TZ.hhmm(w.from) + '–' + TZ.hhmm(w.to + STEP_MIN / 60); }).join(', ')
      : '없음';

    var html = ['<div class="reco-wrap">'];
    html.push('<div class="wtb__head"><h3 class="section__title">추천 회의시간 ' +
      '<span>' + base.name + ' 기준 · 30분 단위</span></h3>' +
      '<p class="reco__common">전원 코어타임 구간 <strong>' + commonText + '</strong></p></div>');
    html.push('<ol class="reco">');
    plan.best.slice(0, 4).forEach(function (slot, i) {
      var v = verdict(slot);
      html.push('<li><button type="button" class="card' +
        (slot.baseMinutes === state.selectedMinutes ? ' is-active' : '') +
        '" data-minutes="' + slot.baseMinutes + '">' +
        '<span class="card__rank">' + (i + 1) + '</span>' +
        '<span class="card__time">' + baseRangeLabel(slot) + '</span>' +
        '<span class="card__verdict"><span class="badge badge--' + v.key + '">' + v.text + '</span>' +
        '<span class="card__counts">' + countsLabel(slot) + '</span></span>' +
        '<span class="card__mini">' + slot.rows.map(function (r) {
          return '<span class="mini mini--' + r.status + '" title="' + r.entity.name + ' ' + localRange(r) + '">' +
            r.entity.code + '</span>';
        }).join('') + '</span></button></li>');
    });
    html.push('</ol></div>');
    return html.join('');
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

    var html = ['<div class="split">'];
    html.push('<h3 class="section__title">분할 회의 제안 <span>시차가 가장 크게 벌어지는 지점에서 두 그룹으로</span></h3>');
    html.push('<div class="split__grid">');
    groups.forEach(function (group, i) {
      var v = verdict(group.slot);
      html.push('<button type="button" class="splitcard" data-minutes="' + group.slot.baseMinutes + '">' +
        '<span class="splitcard__head"><span class="splitcard__label">' + (i + 1) + '차 세션 · ' + group.entities.length + '개 법인</span>' +
        '<span class="badge badge--' + v.key + '">' + v.text + '</span></span>' +
        '<span class="splitcard__time">' + baseRangeLabel(group.slot) + '</span>' +
        '<span class="splitcard__list">' + group.slot.rows.map(function (r) {
          return '<span class="splitcard__row"><span>' + r.entity.name + '</span>' +
            '<span class="mono pill pill--' + r.status + '">' + localRange(r) + '</span></span>';
        }).join('') + '</span></button>');
    });
    html.push('</div></div>');
    return html.join('');
  }

  /* ── 사이드 패널 ────────────────────────────────────────── */

  function renderSelection(plan) {
    var slot = selectedSlot() || plan.ranked[0];
    var bp = baseParts(slot);
    var v = verdict(slot);
    var base = byId[state.baseId];

    return '<section class="panel panel--selected">' +
      '<p class="panel__eyebrow">선택한 회의 시각</p>' +
      '<p class="panel__time">' + baseRangeLabel(slot) + '</p>' +
      '<p class="panel__sub">' + TZ.dateLabel(bp) + ' · ' + base.name + ' 기준 ' + TZ.offsetLabel(base.tz, slot.utcStart) + '</p>' +
      '<p class="panel__badge"><span class="badge badge--' + v.key + '">' + v.text + '</span></p>' +
      '<ul class="minilist">' + slot.rows.map(function (r) {
        var shift = dayShift(r, bp);
        return '<li class="minilist__row">' +
          '<span class="minilist__name">' + r.entity.name +
            (r.holiday ? '<span class="tag tag--off">' + r.holiday.name + '</span>' : '') + '</span>' +
          '<span class="minilist__time mono">' + localRange(r) +
            (shift ? ' <span class="shift">' + shift + '</span>' : '') + '</span>' +
          '<span class="pill pill--' + r.status + '">' + r.statusLabel + '</span></li>';
      }).join('') + '</ul></section>';
  }

  function renderMail(plan) {
    var slot = selectedSlot() || plan.ranked[0];
    var mail = global.MailTemplate.build({
      rows: slot.rows,
      durationMin: slot.durationMin,
      policy: plan.policy,
      base: byId[state.baseId],
      baseParts: baseParts(slot)
    }, state.mailLang);

    return '<section class="panel panel--mail">' +
      '<div class="panel__head"><p class="panel__eyebrow">회의 소집 메일</p>' +
      '<div class="modeswitch modeswitch--sm">' +
        '<button type="button" class="modeswitch__btn' + (state.mailLang === 'ko' ? ' is-active' : '') + '" data-lang="ko">국문</button>' +
        '<button type="button" class="modeswitch__btn' + (state.mailLang === 'en' ? ' is-active' : '') + '" data-lang="en">영문</button>' +
      '</div></div>' +
      '<label class="mail__label" for="mailSubject">제목</label>' +
      '<input class="mail__subject" id="mailSubject" readonly value="' + mail.subject.replace(/"/g, '&quot;') + '">' +
      '<label class="mail__label" for="mailBody">본문</label>' +
      '<textarea class="mail__body" id="mailBody" rows="16" readonly>' + mail.body + '</textarea>' +
      '<button type="button" class="copybtn copybtn--block" id="mailCopy">제목 + 본문 복사</button>' +
      '<p class="panel__note">괄호 안 항목(회의명·안건·링크 등)은 자리표시자입니다. 확정 문구는 <code>assets/js/mail.js</code>의 <code>MAIL_FIELDS</code>에서 바꿀 수 있습니다.</p>' +
    '</section>';
  }

  function nextQuarterOf(quarter, year) {
    var n = +quarter.slice(1);
    return n === 4 ? { quarter: 'Q1', year: year + 1 } : { quarter: 'Q' + (n + 1), year: year };
  }

  function changeLabel(current, next) {
    if (current[0] === next[0] && current[1] === next[1]) return { key: 'same', text: '변동 없음' };
    var lenNow = current[1] - current[0];
    var lenNext = next[1] - next[0];
    if (lenNext > lenNow) return { key: 'wider', text: '확대 +' + Number((lenNext - lenNow).toFixed(1)) + 'h' };
    if (lenNext < lenNow) return { key: 'narrow', text: '축소 −' + Number((lenNow - lenNext).toFixed(1)) + 'h' };
    return { key: 'shift', text: next[0] > current[0] ? '뒤로 이동' : '앞당김' };
  }

  function renderQuarterPanel(policy) {
    var next = nextQuarterOf(policy.quarter, policy.year);
    var nextPolicy = global.CORE_TIME_POLICY[next.quarter];
    var participants = orderedParticipants().length ? orderedParticipants() : ENTITIES;

    return '<section class="panel panel--policy">' +
      '<p class="panel__eyebrow">적용 중인 코어타임</p>' +
      '<p class="panel__title">' + policy.year + '년 ' + policy.quarter.slice(1) + '분기 · ' + policy.label.split('·')[1].trim() + '</p>' +
      '<p class="panel__note">' + policy.note + '</p>' +
      '<table class="qtable"><thead><tr><th>법인</th><th>' + policy.quarter + ' 코어타임</th>' +
      '<th>' + next.quarter + ' 예정</th><th>변경</th></tr></thead><tbody>' +
      participants.map(function (e) {
        var now = policy.windows[e.id];
        var then = nextPolicy.windows[e.id];
        var change = changeLabel(now.core, then.core);
        return '<tr><td>' + e.name + '</td>' +
          '<td class="mono">' + TZ.hhmm(now.core[0]) + '–' + TZ.hhmm(now.core[1]) + '</td>' +
          '<td class="mono">' + TZ.hhmm(then.core[0]) + '–' + TZ.hhmm(then.core[1]) + '</td>' +
          '<td><span class="delta delta--' + change.key + '">' + change.text + '</span></td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<p class="panel__next"><strong>' + next.year + '년 ' + next.quarter.slice(1) + '분기 예고</strong> ' + nextPolicy.note + '</p>' +
    '</section>';
  }

  function renderPolicyTable(policy) {
    var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    var head = '<thead><tr><th>법인</th>' + quarters.map(function (q) {
      return '<th' + (q === policy.quarter ? ' class="is-current"' : '') + '>' +
        q.slice(1) + '분기' + (q === policy.quarter ? ' <span class="tag tag--now">적용 중</span>' : '') + '</th>';
    }).join('') + '</tr></thead>';

    var body = ENTITIES.map(function (e) {
      return '<tr><td><span class="dtable__name">' + e.name + '</span>' +
        '<span class="dtable__code">' + e.legal + '</span></td>' +
        quarters.map(function (q) {
          var w = global.CORE_TIME_POLICY[q].windows[e.id];
          return '<td class="mono' + (q === policy.quarter ? ' is-current' : '') + '">' +
            TZ.hhmm(w.core[0]) + '–' + TZ.hhmm(w.core[1]) +
            '<span class="dtable__day">확장 ' + TZ.hhmm(w.extended[0]) + '–' + TZ.hhmm(w.extended[1]) + '</span></td>';
        }).join('') + '</tr>';
    }).join('');

    el.policyTable.innerHTML = head + '<tbody>' + body + '</tbody>';
    el.policyNote.textContent = policy.label + ' — ' + policy.note;
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
    el.mapHint.textContent = '선택한 회의 시각(' + byId[state.baseId].name + ' 기준 ' +
      baseRangeLabel(slot) + ') 기준의 각 법인 현지시각입니다.';
  }

  /* ── 복사 ───────────────────────────────────────────────── */

  function copyMail() {
    var subject = document.getElementById('mailSubject').value;
    var body = document.getElementById('mailBody').value;
    var text = subject + '\n\n' + body;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
