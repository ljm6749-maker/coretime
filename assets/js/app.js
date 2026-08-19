/**
 * 화면 조립 · 상태 관리
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var ENTITIES = global.ENTITIES;
  var byId = {};
  ENTITIES.forEach(function (e) { byId[e.id] = e; });

  /** 코어타임 기준표에서 제외할 법인 (시간표에는 그대로 표시) */
  var POLICY_TABLE_HIDDEN = ['vn'];

  var el = {
    date: document.getElementById('meetingDate'),
    base: document.getElementById('baseEntity'),
    duration: document.getElementById('duration'),
    chips: document.getElementById('participantChips'),
    controls: document.getElementById('controls'),
    dayTabs: document.getElementById('dayTabs'),
    timetable: document.getElementById('timetable'),
    panelMail: document.getElementById('panelMail'),
    panelPolicy: document.getElementById('panelPolicy'),
    quarterHint: document.getElementById('quarterHint')
  };

  var state = {
    date: null,
    baseId: 'kr',
    durationMin: 60,
    participants: [],          // 기본값: 아무 법인도 선택하지 않은 상태
    selectedHour: null,        // 홈 기준 절대 시각 (24 이상이면 익일)
    startHour: 0,              // 시간표 첫 칸의 시각
    plan: null,
    mailLang: 'ko',
    slideDir: null             // 날짜 이동 시 시간표 슬라이드 방향
  };

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

    el.date.addEventListener('change', function () {
      state.date = el.date.value || state.date;
      el.date.value = state.date;
      update();
    });
    el.base.addEventListener('change', function () {
      state.baseId = el.base.value;
      state.selectedHour = null;
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
    el.dayTabs.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-date]');
      if (!tab) return;
      goToDate(tab.getAttribute('data-date'));
    });
    el.timetable.addEventListener('click', function (event) {
      var nav = event.target.closest('[data-shift]');
      if (nav) { goToDate(shiftDate(state.date, +nav.getAttribute('data-shift'))); return; }
      var cell = event.target.closest('[data-hour]');
      if (!cell) return;
      state.selectedHour = +cell.getAttribute('data-hour');
      renderTimetable();
      renderMail();
    });

    var resizeTimer;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(positionMarker, 150);
    });

    update();
  }

  function goToDate(dateStr) {
    if (dateStr === state.date) return;
    state.slideDir = dateStr > state.date ? 'next' : 'prev';
    state.date = dateStr;
    el.date.value = dateStr;
    update();
  }

  function buildChips() {
    ENTITIES.forEach(function (e) {
      var label = document.createElement('label');
      label.className = 'chip';
      label.innerHTML =
        '<input type="checkbox" value="' + e.id + '">' +
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

  /* ── 계산 ───────────────────────────────────────────────── */

  function participants() {
    var list = ENTITIES.filter(function (e) { return state.participants.indexOf(e.id) !== -1; });
    var base = byId[state.baseId];
    if (list.indexOf(base) > 0) {                 // 홈 법인을 맨 위로
      list = [base].concat(list.filter(function (e) { return e !== base; }));
    }
    return list;
  }

  function update() {
    var p = state.date.split('-');
    var policy = global.Scheduler.policyFor(+p[0], +p[1]);
    el.quarterHint.textContent = p[0] + '년 ' + policy.quarter.slice(1) + '분기 코어타임 기준';
    renderDayTabs();

    var list = participants();
    var resolved = global.Scheduler.resolvePolicy(policy, state.participants);
    renderPolicyPanel(policy, resolved);

    if (!list.length) {
      state.plan = null;
      el.timetable.innerHTML = '<div class="empty"><p class="empty__title">참여 법인을 선택해 주세요</p>' +
        '<p class="empty__text">선택한 법인들의 시간이 한 줄로 정렬되고, 글로벌 코어타임이 붉게 표시됩니다.</p></div>';
      renderMail();
      return;
    }

    state.startHour = global.Scheduler.centeredStartHour(resolved, byId[state.baseId].tz, state.date);
    state.plan = global.Scheduler.planDay({
      date: state.date,
      baseTz: byId[state.baseId].tz,
      entities: list,
      durationMin: state.durationMin,
      startHour: state.startHour
    });

    if (state.selectedHour === null || !slotForHour(state.selectedHour)) {
      state.selectedHour = defaultHour(state.plan);
    }

    renderTimetable();
    renderMail();
  }

  /** 코어타임이 시작되는 시각을 기본 선택 */
  function defaultHour(plan) {
    var best = plan.slots[0].hour, bestScore = -1;
    plan.slots.forEach(function (slot) {
      var score = slot.counts.core * 4 + slot.counts.agree * 2 + slot.counts.work - slot.counts.off * 2;
      if (score > bestScore) { bestScore = score; best = slot.hour; }
    });
    return best;
  }

  function slotForHour(hour) {
    if (!state.plan) return null;
    return state.plan.slots.filter(function (s) { return s.hour === hour; })[0] || null;
  }

  function selectedSlot() {
    return slotForHour(state.selectedHour);
  }

  function baseParts(slot) {
    return TZ.zonedParts(byId[state.baseId].tz, slot.utcStart);
  }

  function baseRange(slot) {
    var p = baseParts(slot);
    var startDecimal = p.decimal;
    var end = startDecimal + slot.durationMin / 60;
    return TZ.hhmm(startDecimal) + '–' + TZ.hhmm(end % 24) + (end >= 24 ? ' (익일)' : '');
  }

  function localRange(row) {
    return TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute) + '–' +
           TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
  }

  /** 선택한 회의가 걸치는 시간 칸 수 */
  function spanCols() {
    return Math.max(1, Math.ceil(state.durationMin / 60));
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
    var span = spanCols();

    var html = ['<div class="tt">'];
    html.push('<div class="tt__head">' +
      '<h2 class="section__title">시간표</h2>' +
      '<ul class="legend legend--flat">' +
        '<li><span class="legend__swatch legend__swatch--core"></span>글로벌 코어타임</li>' +
        '<li><span class="legend__swatch legend__swatch--off"></span>휴무 · 공휴일</li>' +
      '</ul></div>');

    html.push('<div class="tt__body">');
    html.push('<button type="button" class="tt__nav" data-shift="-1" aria-label="전날 보기">‹</button>');
    html.push('<div class="tt__scroll"><div class="tt__grid' +
      (state.slideDir ? ' tt__grid--' + state.slideDir : '') + '">');

    html.push('<div class="tt__corner"></div>');
    plan.slots.forEach(function (slot) {
      html.push('<div class="tt__tick' +
        (slot.hour >= selHour && slot.hour < selHour + span ? ' is-sel' : '') + '">' +
        TZ.pad(slot.hourLabel) + '</div>');
    });

    rows.forEach(function (_, rowIndex) {
      var entity = rows[rowIndex].entity;
      var offsetDiff = (TZ.offsetMinutes(entity.tz, plan.slots[0].utcStart) -
                        TZ.offsetMinutes(base.tz, plan.slots[0].utcStart)) / 60;
      var diffLabel = offsetDiff === 0 ? '홈' : (offsetDiff > 0 ? '+' : '') + Number(offsetDiff.toFixed(1));
      var holiday = null;
      plan.slots.forEach(function (slot) {
        if (!holiday && slot.rows[rowIndex].holiday) holiday = slot.rows[rowIndex].holiday;
      });

      html.push('<div class="tt__label">' +
        '<span class="tt__diff' + (offsetDiff === 0 ? ' is-home' : '') + '">' + diffLabel + '</span>' +
        '<span class="tt__ident">' +
          '<span class="tt__name">' + entity.name + '<span class="tt__code">' + entity.code + '</span></span>' +
          '<span class="tt__city">' + entity.city +
            (TZ.isDST(entity.tz, plan.slots[0].utcStart) ? ' <span class="tag">DST</span>' : '') + '</span>' +
          (holiday ? '<span class="tag tag--off">' + holiday.name + (holiday.tentative ? ' 잠정' : '') + '</span>' : '') +
        '</span>' +
      '</div>');

      plan.slots.forEach(function (slot) {
        var r = slot.rows[rowIndex];
        var newDay = r.start.hour === 0;
        var title = entity.name + ' ' + localRange(r) + ' · ' + r.statusLabel +
          (r.notes.length ? ' (' + r.notes.join(', ') + ')' : '');
        html.push('<button type="button" class="tt__cell cell--' + r.status +
          (newDay ? ' is-newday' : '') +
          (slot.hour >= selHour && slot.hour < selHour + span ? ' is-sel' : '') +
          '" data-hour="' + slot.hour + '" title="' + title + '">' +
          (newDay
            ? '<span class="tt__daymark">' + r.start.month + '월<br>' + r.start.day + '</span>'
            : '<span class="tt__hour">' + r.start.hour + '</span>') +
        '</button>');
      });
    });

    html.push('<div class="tt__marker" hidden></div>');
    html.push('</div></div>');
    html.push('<button type="button" class="tt__nav" data-shift="1" aria-label="다음날 보기">›</button>');
    html.push('</div>');
    html.push('<p class="tt__foot">칸을 클릭하면 회의 시각이 설정되고, 아래 메일 초안에 자동 반영됩니다. 좌우 화살표로 날짜를 넘길 수 있습니다.</p>');
    html.push('</div>');
    el.timetable.innerHTML = html.join('');
    state.slideDir = null;
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

    var span = Math.min(spanCols(), selected.length);
    var first = selected[0];
    var lastInRow = selected[span - 1];
    var last = selected[selected.length - 1];

    marker.hidden = false;
    marker.style.left = (first.offsetLeft - 2) + 'px';
    marker.style.width = (lastInRow.offsetLeft + lastInRow.offsetWidth - first.offsetLeft + 4) + 'px';
    marker.style.top = (ticks[0].offsetTop - 2) + 'px';
    marker.style.height = (last.offsetTop + last.offsetHeight - ticks[0].offsetTop + 4) + 'px';
  }

  /* ── 회의 소집 메일 ─────────────────────────────────────── */

  function renderMail() {
    var slot = selectedSlot();
    var lang = state.mailLang;

    var head = '<div class="panel__head">' +
      '<div><p class="panel__eyebrow panel__eyebrow--lg">회의 소집 메일 템플릿</p>' +
      '<p class="panel__note panel__note--lead">‘본문 복사하기’ 버튼을 누르면 메일 본문에 붙여넣을 수 있습니다. 본문 창에서 내용을 바로 고쳐 쓸 수도 있습니다.</p>' +
      (slot
        ? '<p class="panel__when">' + koDate(state.date) + ' <span class="mono">' + baseRange(slot) + '</span> ' +
          '<span class="panel__whenbase">' + byId[state.baseId].name + ' 기준</span></p>'
        : '<p class="panel__when panel__when--empty">시간표에서 회의 시각을 선택하세요</p>') +
      '</div>' +
      '<div class="modeswitch modeswitch--sm">' +
        '<button type="button" class="modeswitch__btn' + (lang === 'ko' ? ' is-active' : '') + '" data-lang="ko">국문</button>' +
        '<button type="button" class="modeswitch__btn' + (lang === 'en' ? ' is-active' : '') + '" data-lang="en">영문</button>' +
      '</div></div>';

    if (!slot) {
      el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
        '<p class="panel__note">참여 법인과 회의 시각을 선택하면 메일 초안이 만들어집니다.</p></section>';
      bindMailEvents();
      return;
    }

    var mail = global.MailTemplate.render({
      rows: slot.rows,
      durationMin: slot.durationMin,
      policy: state.plan.policy,
      base: byId[state.baseId],
      baseParts: baseParts(slot),
      baseRange: baseRange(slot)
    }, lang);

    el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
      '<label class="mail__label" for="mailSubject">제목</label>' +
      '<input class="mail__subject" id="mailSubject" value="' + escapeAttr(mail.subject) + '">' +
      '<label class="mail__label" for="mailBody">본문</label>' +
      '<textarea class="mail__body" id="mailBody" rows="20">' + escapeHtml(mail.body) + '</textarea>' +
      '<button type="button" class="copybtn" id="mailCopy">본문 복사하기</button>' +
    '</section>';

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
  }

  function copyMail() {
    var text = document.getElementById('mailBody').value;
    var btn = document.getElementById('mailCopy');
    var done = function () {
      btn.textContent = '복사 완료';
      setTimeout(function () { btn.textContent = '본문 복사하기'; }, 1800);
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

  /* ── 글로벌 코어타임 기준표 ─────────────────────────────── */

  function windowLabel(win) {
    return TZ.hhmm(win.from) + '–' + TZ.hhmm(win.to % 24) + (win.to > 24 ? ' (익일)' : '');
  }

  /** 코어타임 창을 특정 법인의 현지시각으로 환산 (해당 날짜 기준, DST 반영) */
  function windowLocal(entity, win, dateStr) {
    var p = dateStr.split('-');
    var startUtc = TZ.wallToUtc(global.CORE_TIME_BASE_TZ, +p[0], +p[1], +p[2],
      Math.floor(win.from), Math.round((win.from % 1) * 60));
    var endUtc = startUtc + (win.to - win.from) * 3600000;
    var s0 = TZ.zonedParts(entity.tz, startUtc);
    var e0 = TZ.zonedParts(entity.tz, endUtc);
    var baseDay = Date.UTC(+p[0], +p[1] - 1, +p[2]);
    var startShift = Math.round((Date.UTC(s0.year, s0.month - 1, s0.day) - baseDay) / 86400000);
    var endShift = Math.round((Date.UTC(e0.year, e0.month - 1, e0.day) - baseDay) / 86400000);

    var suffix = '';
    if (startShift === -1 && endShift === -1) suffix = ' (전일)';
    else if (startShift === -1 && endShift === 0) suffix = ' (전일→당일)';
    else if (startShift === 0 && endShift === 1) suffix = ' (당일→익일)';
    else if (startShift === 1) suffix = ' (익일)';

    return TZ.pad(s0.hour) + ':' + TZ.pad(s0.minute) + '–' +
           TZ.pad(e0.hour) + ':' + TZ.pad(e0.minute) + suffix;
  }

  function sampleDate(quarter, year) {
    return { Q1: year + '-02-15', Q2: year + '-05-15', Q3: year + '-08-15', Q4: year + '-11-15' }[quarter];
  }

  function renderPolicyPanel(policy, resolved) {
    var year = +state.date.split('-')[0];
    var groups = [
      { key: 'Q1 · Q3', win: global.CORE_TIME_POLICY.Q1.windows[0], winter: sampleDate('Q1', year), summer: sampleDate('Q3', year) },
      { key: 'Q2 · Q4', win: global.CORE_TIME_POLICY.Q2.windows[0], winter: sampleDate('Q4', year), summer: sampleDate('Q2', year) }
    ];
    var current = policy.rotation;
    var listed = ENTITIES.filter(function (e) { return POLICY_TABLE_HIDDEN.indexOf(e.id) === -1; });

    var head = '<thead><tr><th>법인</th>' + groups.map(function (g) {
      return '<th' + (g.key === current ? ' class="is-current"' : '') + '>' + g.key +
        '<span class="th__win mono">한국 ' + windowLabel(g.win) + '</span>' +
        (g.key === current ? ' <span class="tag tag--now">적용 중</span>' : '') + '</th>';
    }).join('') + '</tr></thead>';

    var body = listed.map(function (e) {
      return '<tr><td><span class="dtable__name">' + e.name + ' <span class="dtable__badge">' + e.code + '</span></span>' +
        '<span class="dtable__code">' + e.city + '</span></td>' +
        groups.map(function (g) {
          var standard = windowLocal(e, g.win, g.winter);
          var summer = windowLocal(e, g.win, g.summer);
          return '<td class="' + (g.key === current ? 'is-current' : '') + '">' +
            '<span class="mono">' + standard + '</span>' +
            (summer !== standard ? '<span class="dtable__day mono">(DST) ' + summer + '</span>' : '') +
          '</td>';
        }).join('') + '</tr>';
    }).join('');

    el.panelPolicy.innerHTML = '<section class="panel panel--policy">' +
      '<p class="panel__eyebrow panel__eyebrow--lg">글로벌 코어타임 기준표</p>' +
      (resolved && resolved.trilateral
        ? '<p class="notice notice--rule"><strong>3자 회의 예외 적용 중</strong> ' + resolved.trilateralNote + '</p>'
        : '') +
      '<div class="tablewrap"><table class="ptable">' + head + '<tbody>' + body + '</tbody></table></div>' +
      '<p class="panel__note">한국 · HVA · HVE(또는 HVME) 3자 회의는 교대 운영에서 제외하고 Q1·Q3 시간대로 고정합니다.<br>' +
      '코어타임이 현지 새벽에 해당되는 경우 당사자 간 협의를 통해 다른 회의 시간으로 편성할 수 있습니다.</p>' +
    '</section>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
