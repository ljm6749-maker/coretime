/**
 * 화면 조립 · 상태 관리
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var ENTITIES = global.ENTITIES;
  var byId = {};
  ENTITIES.forEach(function (e) { byId[e.id] = e; });

  /** 회의 소요시간은 1시간으로 고정 (선택 화면에서는 감춤) */
  var DURATION_MIN = 60;

  var el = {
    utcClock: document.getElementById('utcClock'),
    date: document.getElementById('meetingDate'),
    base: document.getElementById('baseEntity'),
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
    participants: [],          // 기본값: 아무 법인도 선택하지 않은 상태
    selectedHour: null,
    plan: null,
    mailLang: 'ko',
    mailEditing: false
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

    buildChips();

    el.date.addEventListener('change', function () {
      state.date = el.date.value || state.date;
      el.date.value = state.date;
      update();
    });
    el.base.addEventListener('change', function () {
      state.baseId = el.base.value;
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
      state.date = tab.getAttribute('data-date');
      el.date.value = state.date;
      update();
    });
    el.timetable.addEventListener('click', function (event) {
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

    tick();
    setInterval(tick, 1000);
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

  function tick() {
    var u = new Date();
    el.utcClock.textContent = TZ.pad(u.getUTCHours()) + ':' + TZ.pad(u.getUTCMinutes()) + ':' + TZ.pad(u.getUTCSeconds());
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
    el.quarterHint.textContent = p[0] + '년 ' + policy.quarter.slice(1) + '분기 · ' + policy.rotation + ' 코어타임';
    renderDayTabs();
    renderPolicyPanel(policy);

    var list = participants();
    if (!list.length) {
      state.plan = null;
      el.timetable.innerHTML = '<div class="empty"><p class="empty__title">참여 법인을 선택해 주세요</p>' +
        '<p class="empty__text">선택한 법인들의 시간이 한 줄로 정렬되고, 글로벌 코어타임이 붉게 표시됩니다.</p></div>';
      renderMail();
      return;
    }

    state.plan = global.Scheduler.planDay({
      date: state.date,
      baseTz: byId[state.baseId].tz,
      entities: list,
      durationMin: DURATION_MIN
    });

    if (state.selectedHour === null) state.selectedHour = defaultHour(state.plan);

    renderTimetable();
    renderMail();
  }

  /** 코어타임 법인 수가 가장 많은 시각을 기본 선택 */
  function defaultHour(plan) {
    var best = 0, bestScore = -1;
    plan.slots.forEach(function (slot) {
      var score = slot.counts.core * 4 + slot.counts.agree * 2 + slot.counts.work - slot.counts.off * 2;
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

    var html = ['<div class="tt">'];
    html.push('<div class="tt__head">' +
      '<h2 class="section__title">시간표 <span>' + base.name + ' ' + koDate(state.date) + ' 기준</span></h2>' +
      '<ul class="legend legend--flat">' +
        '<li><span class="legend__swatch legend__swatch--core"></span>글로벌 코어타임</li>' +
        '<li><span class="legend__swatch legend__swatch--off"></span>휴무 · 공휴일</li>' +
      '</ul></div>');

    html.push('<div class="tt__scroll"><div class="tt__grid">');

    html.push('<div class="tt__corner"><span class="tt__cornerlabel">홈 시간대</span>' +
      '<span class="tt__cornerbase">' + base.name + ' · ' + TZ.offsetLabel(base.tz, plan.slots[0].utcStart) + '</span></div>');
    for (var h = 0; h < 24; h++) {
      html.push('<div class="tt__tick' + (h === selHour ? ' is-sel' : '') + '">' + TZ.pad(h) + '</div>');
    }

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
          (newDay ? ' is-newday' : '') + (slot.hour === selHour ? ' is-sel' : '') +
          '" data-hour="' + slot.hour + '" title="' + title + '">' +
          (newDay
            ? '<span class="tt__daymark">' + r.start.month + '월<br>' + r.start.day + '</span>'
            : '<span class="tt__hour">' + r.start.hour + '</span>') +
        '</button>');
      });
    });

    html.push('<div class="tt__marker" hidden></div>');
    html.push('</div></div>');
    html.push('<p class="tt__foot">칸을 클릭하면 회의 시각이 설정되고, 아래 메일 초안에 자동 반영됩니다.</p>');
    html.push('</div>');
    el.timetable.innerHTML = html.join('');
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

    var first = selected[0];
    var last = selected[selected.length - 1];
    marker.hidden = false;
    marker.style.left = (first.offsetLeft - 2) + 'px';
    marker.style.width = (first.offsetWidth + 4) + 'px';
    marker.style.top = (ticks[0].offsetTop - 2) + 'px';
    marker.style.height = (last.offsetTop + last.offsetHeight - ticks[0].offsetTop + 4) + 'px';
  }

  /* ── 회의 소집 메일 ─────────────────────────────────────── */

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
    var lang = state.mailLang;
    var Mail = global.MailTemplate;

    var head = '<div class="panel__head">' +
      '<div><p class="panel__eyebrow">회의 소집 메일 템플릿</p>' +
      (slot
        ? '<p class="panel__when">' + koDate(state.date) + ' <span class="mono">' + baseRange(slot) + '</span> ' +
          '<span class="panel__whenbase">' + byId[state.baseId].name + ' 기준</span></p>'
        : '<p class="panel__when panel__when--empty">시간표에서 회의 시각을 선택하세요</p>') +
      '</div>' +
      '<div class="modeswitch modeswitch--sm">' +
        '<button type="button" class="modeswitch__btn' + (lang === 'ko' ? ' is-active' : '') + '" data-lang="ko">국문</button>' +
        '<button type="button" class="modeswitch__btn' + (lang === 'en' ? ' is-active' : '') + '" data-lang="en">영문</button>' +
      '</div></div>';

    if (state.mailEditing || !slot) {
      var raw = Mail.raw(lang);
      el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
        '<p class="panel__note">문구를 자유롭게 고칠 수 있습니다. 중괄호 토큰은 선택한 회의 시각으로 자동 치환됩니다.</p>' +
        '<p class="tokens">' + Mail.TOKENS.map(function (t) {
          return '<span class="token">' + t + '</span>';
        }).join('') + '</p>' +
        '<label class="mail__label" for="tplSubject">제목 템플릿</label>' +
        '<input class="mail__subject" id="tplSubject" value="' + escapeAttr(raw.subject) + '">' +
        '<label class="mail__label" for="tplBody">본문 템플릿</label>' +
        '<textarea class="mail__body" id="tplBody" rows="18">' + escapeHtml(raw.body) + '</textarea>' +
        '<div class="mail__actions">' +
          (slot ? '<button type="button" class="copybtn" id="tplSave">저장</button>' +
                  '<button type="button" class="ghostbtn" id="tplCancel">취소</button>' : '') +
          '<button type="button" class="ghostbtn" id="tplReset">기본값으로 되돌리기</button>' +
        '</div></section>';
    } else {
      var mail = Mail.render(mailContext(slot), lang);
      el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
        '<label class="mail__label" for="mailSubject">제목</label>' +
        '<input class="mail__subject" id="mailSubject" value="' + escapeAttr(mail.subject) + '">' +
        '<label class="mail__label" for="mailBody">본문</label>' +
        '<textarea class="mail__body" id="mailBody" rows="20">' + escapeHtml(mail.body) + '</textarea>' +
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

  function renderPolicyPanel(policy) {
    var year = +state.date.split('-')[0];
    var resolved = state.plan ? state.plan.policy : null;
    var groups = [
      { key: 'Q1 · Q3', win: global.CORE_TIME_POLICY.Q1.windows[0], winter: sampleDate('Q1', year), summer: sampleDate('Q3', year) },
      { key: 'Q2 · Q4', win: global.CORE_TIME_POLICY.Q2.windows[0], winter: sampleDate('Q4', year), summer: sampleDate('Q2', year) }
    ];
    var current = policy.rotation;

    var head = '<thead><tr><th>법인</th>' + groups.map(function (g) {
      return '<th' + (g.key === current ? ' class="is-current"' : '') + '>' + g.key +
        '<span class="th__win mono">한국 ' + windowLabel(g.win) + '</span>' +
        (g.key === current ? ' <span class="tag tag--now">적용 중</span>' : '') + '</th>';
    }).join('') + '</tr></thead>';

    var body = ENTITIES.map(function (e) {
      return '<tr><td><span class="dtable__name">' + e.name + ' <span class="dtable__badge">' + e.code + '</span></span>' +
        '<span class="dtable__code">' + e.city + '</span></td>' +
        groups.map(function (g) {
          var standard = windowLocal(e, g.win, g.winter);
          var summer = windowLocal(e, g.win, g.summer);
          var excluded = g.win.excluded && g.win.excluded[e.id];
          return '<td class="' + (g.key === current ? 'is-current' : '') + (excluded ? ' is-excluded' : '') + '">' +
            '<span class="mono">' + standard + '</span>' +
            (summer !== standard ? '<span class="dtable__day mono">(DST) ' + summer + '</span>' : '') +
            (excluded ? '<span class="pill pill--agree" title="' + excluded + '">코어타임 제외 · 협의</span>' : '') +
          '</td>';
        }).join('') + '</tr>';
    }).join('');

    el.panelPolicy.innerHTML = '<section class="panel panel--policy">' +
      '<div class="panel__head"><div>' +
        '<p class="panel__eyebrow">글로벌 코어타임 기준표</p>' +
        '<p class="panel__when">' + policy.year + '년 ' + policy.quarter.slice(1) + '분기 · ' +
          (resolved && resolved.trilateral ? 'Q1 · Q3 고정' : policy.rotation) + ' 적용 중</p>' +
      '</div></div>' +
      (resolved && resolved.trilateral
        ? '<p class="notice notice--rule"><strong>3자 회의 예외 적용 중</strong> ' + resolved.trilateralNote + '</p>'
        : '') +
      '<div class="tablewrap"><table class="ptable">' + head + '<tbody>' + body + '</tbody></table></div>' +
      '<p class="panel__note">글로벌 코어타임은 법인 간 정기 회의 편성의 기준 시간대이며 분기별로 교대 운영합니다. ' +
        '표의 시각은 각 법인 현지시각이고 모두 <strong>같은 절대 시각</strong>을 가리킵니다. ' +
        '회색 처리된 칸은 코어타임이 현지 새벽에 해당해 적용 대상에서 제외되며 당사자 간 협의로 정합니다. ' +
        '한국 · HVA · HVE(또는 HVME) 3자 회의는 교대 운영에서 제외하고 Q1·Q3 시간대로 고정합니다.<br>' +
        '<em>출처 — Global Collaboration Ground Rules v0.92, 1.1 Global Core Hours</em></p>' +
    '</section>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
