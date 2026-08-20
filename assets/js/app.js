/**
 * 화면 조립 · 상태 관리
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var ENTITIES = global.ENTITIES;
  var LANG_KEY = 'hv-coretime:lang';
  var MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function T(key, vars) { return global.I18N.t(key, vars); }
  function isEn() { return global.I18N.lang() === 'en'; }
  function entityName(entity) { return isEn() ? (entity.nameEn || entity.legal) : entity.name; }
  function entityCity(entity) { return isEn() ? (entity.cityEn || entity.city) : entity.city; }
  function statusLabel(row) { return T('status.' + row.status); }

  /** 90 → '1시간 30분' / '1 hour 30 min' */
  function durationLabel(min) {
    var h = Math.floor(min / 60);
    var half = min % 60 >= 30;
    if (!h) return T('duration.half');
    var vars = { h: h, s: isEn() && h > 1 ? 's' : '' };
    return T(half ? 'duration.hourHalf' : 'duration.hour', vars);
  }
  function dayName(weekday) { return (isEn() ? TZ.DAY_EN : TZ.DAY_KO)[weekday]; }
  var byId = {};
  ENTITIES.forEach(function (e) { byId[e.id] = e; });

  /** 코어타임 기준표에서 제외할 법인 (시간표에는 그대로 표시) */
  var POLICY_TABLE_HIDDEN = ['vn', 'hvw'];

  var el = {
    langSwitch: document.getElementById('langSwitch'),
    viewCounter: document.getElementById('viewCounter'),
    date: document.getElementById('meetingDate'),
    dateWrap: document.getElementById('dateWrap'),
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
    date: '',                  // 기본값 없음 — 사용자가 고르기 전까지 비워 둔다
    baseId: '',
    durationMin: null,
    participants: [],          // 기본값: 아무 법인도 선택하지 않은 상태
    selectedMinutes: null,     // 홈 기준 절대 분 (1440 이상이면 익일)
    startHour: 0,              // 시간표 첫 칸의 시각
    plan: null,
    lang: 'ko',
    mailLang: 'ko',
    slideDir: null,            // 날짜 이동 시 시간표 슬라이드 방향
    views: null                // { today, total } — 조회수
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

  function fmtDate(dateStr) {
    var p = dateStr.split('-');
    var wd = weekdayOf(dateStr);
    if (isEn()) return MONTH_EN[+p[1] - 1] + ' ' + (+p[2]) + ' (' + TZ.DAY_EN[wd] + ')';
    return (+p[1]) + '월 ' + (+p[2]) + '일(' + TZ.DAY_KO[wd] + ')';
  }

  /* ── 초기화 ─────────────────────────────────────────────── */

  function init() {
    state.lang = detectLang();
    state.mailLang = state.lang;
    global.I18N.setLang(state.lang);
    applyStaticText();

    el.langSwitch.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-ui-lang]');
      if (!btn) return;
      setLang(btn.getAttribute('data-ui-lang'));
    });

    el.base.appendChild(placeholderOption());
    ENTITIES.forEach(function (e) {
      var opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = entityName(e) + ' (' + e.code + ')';
      el.base.appendChild(opt);
    });
    el.base.value = '';

    el.duration.appendChild(placeholderOption());
    global.DURATIONS.forEach(function (min) {
      var opt = document.createElement('option');
      opt.value = String(min);
      opt.setAttribute('data-duration', String(min));
      opt.textContent = durationLabel(min);
      el.duration.appendChild(opt);
    });
    el.duration.value = '';

    buildChips();

    el.date.addEventListener('change', function () {
      state.date = el.date.value;
      state.selectedMinutes = null;
      update();
    });
    el.base.addEventListener('change', function () {
      state.baseId = el.base.value;
      // 내 소속은 회의 참여자에 자동으로 포함시킨다 (원하면 칩에서 해제 가능)
      if (state.baseId && state.participants.indexOf(state.baseId) === -1) {
        state.participants.push(state.baseId);
        syncChips();
      }
      state.selectedMinutes = null;
      update();
    });
    el.duration.addEventListener('change', function () {
      state.durationMin = el.duration.value ? +el.duration.value : null;
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
      var half = event.target.closest('[data-minutes]');
      if (!half) return;
      state.selectedMinutes = +half.getAttribute('data-minutes');
      renderTimetable();
      renderMail();
    });

    if (global.ViewCounter) {
      global.ViewCounter.load(function (counts) {
        state.views = counts;
        renderViewCounter();
      });
    }

    var resizeTimer;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(positionMarker, 150);
    });

    update();
  }

  function detectLang() {
    try {
      var saved = global.localStorage.getItem(LANG_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (err) { /* 저장소 접근 불가 */ }
    var nav = (global.navigator.language || 'ko').toLowerCase();
    return nav.indexOf('ko') === 0 ? 'ko' : 'en';
  }

  function setLang(lang) {
    if (lang === state.lang) return;
    state.lang = lang;
    state.mailLang = lang;
    global.I18N.setLang(lang);
    try { global.localStorage.setItem(LANG_KEY, lang); } catch (err) { /* 무시 */ }
    applyStaticText();
    refreshOptionLabels();
    update();
  }

  /** 조회수 표시 (집계 실패 시 아무것도 그리지 않는다) */
  function renderViewCounter() {
    if (!el.viewCounter || !state.views) return;
    el.viewCounter.hidden = false;
    el.viewCounter.textContent = T('footer.views', {
      today: state.views.today.toLocaleString(),
      total: state.views.total.toLocaleString()
    });
  }

  /** data-i18n 이 붙은 정적 문구와 언어 버튼 상태를 갱신 */
  function applyStaticText() {
    document.documentElement.lang = state.lang;
    document.title = T('board.title');
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = T(node.getAttribute('data-i18n'));
    });
    el.langSwitch.querySelectorAll('[data-ui-lang]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-ui-lang') === state.lang);
    });
    renderViewCounter();
  }

  /** 셀렉트 박스의 옵션 문구 갱신 */
  function refreshOptionLabels() {
    el.base.querySelectorAll('option').forEach(function (opt) {
      var entity = byId[opt.value];
      if (entity) opt.textContent = entityName(entity) + ' (' + entity.code + ')';
      else if (opt.hasAttribute('data-placeholder')) opt.textContent = T('field.select');
    });
    el.duration.querySelectorAll('option').forEach(function (opt) {
      opt.textContent = opt.hasAttribute('data-placeholder')
        ? T('field.select')
        : durationLabel(+opt.getAttribute('data-duration'));
    });
    el.chips.querySelectorAll('.chip').forEach(function (chip) {
      var entity = byId[chip.querySelector('input').value];
      chip.querySelector('.chip__name').textContent = entityName(entity);
    });
  }

  function placeholderOption() {
    var opt = document.createElement('option');
    opt.value = '';
    opt.setAttribute('data-placeholder', '1');
    opt.textContent = T('field.select');
    return opt;
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
        '<span class="chip__body"><span class="chip__name">' + entityName(e) + '</span>' +
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
    if (base && list.indexOf(base) > 0) {         // 홈 법인을 맨 위로
      list = [base].concat(list.filter(function (e) { return e !== base; }));
    }
    return list;
  }

  function update() {
    el.dateWrap.classList.toggle('is-empty', !state.date);

    var refDate = state.date || todayIn(global.CORE_TIME_BASE_TZ);
    var p = refDate.split('-');
    var policy = global.Scheduler.policyFor(+p[0], +p[1]);
    el.quarterHint.textContent = state.date
      ? T('hint.quarter', { year: p[0], q: policy.quarter.slice(1) })
      : '';
    renderDayTabs();

    var list = participants();
    var resolved = global.Scheduler.resolvePolicy(policy, state.participants);
    renderPolicyPanel(policy, resolved);

    if (!state.date || !state.baseId || !state.durationMin || !list.length) {
      state.plan = null;
      el.timetable.innerHTML = '<div class="empty"><p class="empty__title">' + T('empty.title') + '</p>' +
        '<p class="empty__text">' + T('empty.text') + '</p></div>';
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

    var first = state.plan.slots[0].hour * 60;
    var last = first + 24 * 60;
    if (state.selectedMinutes === null ||
        state.selectedMinutes < first || state.selectedMinutes >= last) {
      state.selectedMinutes = defaultHour(state.plan) * 60;
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

  /** 선택한 시각(30분 단위)을 그 자리에서 평가한다 */
  function selectedSlot() {
    if (!state.plan) return null;
    var p = state.date.split('-');
    var minutes = state.selectedMinutes;
    var utcStart = TZ.wallToUtc(byId[state.baseId].tz, +p[0], +p[1], +p[2], 0, minutes);
    var slot = global.Scheduler.evaluateSlot(participants(), state.plan.policy, utcStart, state.durationMin);
    slot.minutes = minutes;
    return slot;
  }

  function baseParts(slot) {
    return TZ.zonedParts(byId[state.baseId].tz, slot.utcStart);
  }

  function baseRange(slot) {
    var p = baseParts(slot);
    var startDecimal = p.decimal;
    var end = startDecimal + slot.durationMin / 60;
    return TZ.hhmm(startDecimal) + '–' + TZ.hhmm(end % 24) + (end >= 24 ? T('shift.nextDay') : '');
  }

  function localRange(row) {
    return TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute) + '–' +
           TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
  }

  /* ── 날짜 탭 ────────────────────────────────────────────── */

  function renderDayTabs() {
    if (!state.date) { el.dayTabs.innerHTML = ''; return; }
    var today = todayIn(byId[state.baseId] ? byId[state.baseId].tz : global.CORE_TIME_BASE_TZ);
    var html = ['<button type="button" class="daytab daytab--nav" data-date="' + shiftDate(state.date, -1) + '" aria-label="' + T('tt.prevDay') + '">‹</button>'];
    for (var i = -2; i <= 3; i++) {
      var d = shiftDate(state.date, i);
      var wd = weekdayOf(d);
      html.push('<button type="button" class="daytab' +
        (i === 0 ? ' is-active' : '') +
        (wd === 0 || wd === 6 ? ' is-weekend' : '') +
        (d === today ? ' is-today' : '') +
        '" data-date="' + d + '" role="tab" aria-selected="' + (i === 0) + '">' +
        (i === 0 ? fmtDate(d) : (+d.split('-')[2]) + '<span class="daytab__dow">' + dayName(wd) + '</span>') +
        '</button>');
    }
    html.push('<button type="button" class="daytab daytab--nav" data-date="' + shiftDate(state.date, 1) + '" aria-label="' + T('tt.nextDay') + '">›</button>');
    el.dayTabs.innerHTML = html.join('');
  }

  /* ── 시간표 ─────────────────────────────────────────────── */

  function renderTimetable() {
    var plan = state.plan;
    var base = byId[state.baseId];
    var rows = plan.slots[0].rows;
    var selStart = state.selectedMinutes;
    var selEnd = selStart + state.durationMin;

    var html = ['<div class="tt">'];
    html.push('<div class="tt__head">' +
      '<h2 class="section__title">' + T('tt.title') + '</h2>' +
      '<ul class="legend legend--flat">' +
        '<li><span class="legend__swatch legend__swatch--core"></span>' + T('tt.legendCore') + '</li>' +
        '<li><span class="legend__swatch legend__swatch--off"></span>' + T('tt.legendOff') + '</li>' +
      '</ul></div>');

    // 홈 법인이 참여자에 포함돼 있으면 그 행 자체가 기준 축이므로 눈금 행은 생략한다
    var showTicks = state.participants.indexOf(state.baseId) === -1;

    html.push('<div class="tt__body">');
    html.push('<button type="button" class="tt__nav" data-shift="-1" aria-label="' + T('tt.prevDay') + '">‹</button>');
    html.push('<div class="tt__scroll"><div class="tt__grid' +
      (state.slideDir ? ' tt__grid--' + state.slideDir : '') + '">');

    // 홈 법인 행이 곧 기준 축이므로 상단 시간 눈금 행은 두지 않는다

    rows.forEach(function (_, rowIndex) {
      var entity = rows[rowIndex].entity;
      var offsetDiff = (TZ.offsetMinutes(entity.tz, plan.slots[0].utcStart) -
                        TZ.offsetMinutes(base.tz, plan.slots[0].utcStart)) / 60;
      var diffLabel = offsetDiff === 0 ? T('tt.home') : (offsetDiff > 0 ? '+' : '') + Number(offsetDiff.toFixed(1));
      var holiday = null;
      plan.slots.forEach(function (slot) {
        if (!holiday && slot.rows[rowIndex].holiday) holiday = slot.rows[rowIndex].holiday;
      });

      html.push('<div class="tt__label">' +
        '<span class="tt__diff' + (offsetDiff === 0 ? ' is-home' : '') + '">' + diffLabel + '</span>' +
        '<span class="tt__ident">' +
          '<span class="tt__name">' + entityName(entity) + '<span class="tt__code">' + entity.code + '</span></span>' +
          '<span class="tt__city">' + entityCity(entity) +
            (TZ.isDST(entity.tz, plan.slots[0].utcStart) ? ' <span class="tag">DST</span>' : '') + '</span>' +
          (holiday ? '<span class="tag tag--off">' + holiday.name + (holiday.tentative ? T('tentative') : '') + '</span>' : '') +
        '</span>' +
      '</div>');

      plan.slots.forEach(function (slot) {
        var r = slot.rows[rowIndex];
        var newDay = r.start.hour === 0;
        var startMin = slot.hour * 60;
        var title = entityName(entity) + ' ' + localRange(r) + ' · ' + statusLabel(r) +
          (r.holiday ? ' · ' + r.holiday.name : '');
        var halves = [0, 30].map(function (offset) {
          var at = startMin + offset;
          return '<button type="button" class="tt__half' +
            (at + 30 > selStart && at < selEnd ? ' is-sel' : '') +
            '" data-minutes="' + at + '" title="' + title + '"></button>';
        }).join('');
        html.push('<div class="tt__cell cell--' + r.status +
          (newDay ? ' is-newday' : '') + '">' +
          '<span class="tt__cellface">' + (newDay
            ? '<span class="tt__daymark">' + (isEn()
                ? MONTH_EN[r.start.month - 1] + '<br>' + r.start.day
                : r.start.month + '월<br>' + r.start.day) + '</span>'
            : '<span class="tt__hour">' + r.start.hour + '</span>') + '</span>' +
          halves +
        '</div>');
      });
    });

    html.push('<div class="tt__marker" hidden></div>');
    html.push('</div></div>');
    html.push('<button type="button" class="tt__nav" data-shift="1" aria-label="' + T('tt.nextDay') + '">›</button>');
    html.push('</div>');
    html.push('<p class="tt__foot">' + T('tt.foot') + '</p>');
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

    var selected = grid.querySelectorAll('.tt__half.is-sel');
    if (!selected.length) { marker.hidden = true; return; }

    var perRow = Math.max(1, Math.ceil(state.durationMin / 30));
    var first = selected[0];
    var lastInRow = selected[Math.min(perRow, selected.length) - 1];
    var last = selected[selected.length - 1];
    var firstRect = first.getBoundingClientRect();
    var lastRect = lastInRow.getBoundingClientRect();
    var gridRect = grid.getBoundingClientRect();
    var bottomRect = last.getBoundingClientRect();

    marker.hidden = false;
    marker.style.left = (firstRect.left - gridRect.left - 2) + 'px';
    marker.style.width = (lastRect.right - firstRect.left + 4) + 'px';
    var anchor = first.parentElement;              // 첫 행의 칸을 기준으로 상자를 그린다
    marker.style.top = (anchor.offsetTop - 2) + 'px';
    marker.style.height = (bottomRect.bottom - gridRect.top - anchor.offsetTop + 4) + 'px';
  }

  /* ── 회의 소집 메일 ─────────────────────────────────────── */

  function renderMail() {
    var slot = selectedSlot();
    var lang = state.mailLang;

    var head = '<div class="panel__head">' +
      '<div><p class="panel__eyebrow panel__eyebrow--lg">' + T('mail.title') + '</p>' +
      '<p class="panel__note panel__note--lead">' + T('mail.note1') + '<br>' + T('mail.note2') + '</p>' +
      (slot
        ? '<p class="panel__when">' + fmtDate(state.date) + ' <span class="mono">' + baseRange(slot) + '</span> ' +
          '<span class="panel__whenbase">' + T('mail.basis', { name: entityName(byId[state.baseId]) }) + '</span></p>'
        : '') +
      '</div>' +
      '<div class="modeswitch modeswitch--sm">' +
        '<button type="button" class="modeswitch__btn' + (lang === 'ko' ? ' is-active' : '') + '" data-lang="ko">' + T('mail.langKo') + '</button>' +
        '<button type="button" class="modeswitch__btn' + (lang === 'en' ? ' is-active' : '') + '" data-lang="en">' + T('mail.langEn') + '</button>' +
      '</div></div>';

    var dateParts = (state.date || todayIn(global.CORE_TIME_BASE_TZ)).split('-');
    var mail = global.MailTemplate.render({
      rows: slot ? slot.rows : [],
      durationMin: state.durationMin,
      policy: state.plan ? state.plan.policy : global.Scheduler.policyFor(+dateParts[0], +dateParts[1]),
      base: byId[state.baseId] || byId.kr,
      baseParts: slot ? baseParts(slot) : null,
      baseRange: slot ? baseRange(slot) : ''
    }, lang);

    el.panelMail.innerHTML = '<section class="panel panel--mail">' + head +
      '<label class="mail__label" for="mailSubject">' + T('mail.subject') + '</label>' +
      '<input class="mail__subject" id="mailSubject" value="' + escapeAttr(mail.subject) + '">' +
      '<label class="mail__label" for="mailBody">' + T('mail.body') + '</label>' +
      '<textarea class="mail__body" id="mailBody" rows="20">' + escapeHtml(mail.body) + '</textarea>' +
      '<button type="button" class="copybtn" id="mailCopy">' + T('mail.copy') + '</button>' +
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
      btn.textContent = T('mail.copied');
      setTimeout(function () { btn.textContent = T('mail.copy'); }, 1800);
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
    if (startShift === -1 && endShift === -1) suffix = T('shift.prev');
    else if (startShift === -1 && endShift === 0) suffix = T('shift.prevSame');
    else if (startShift === 0 && endShift === 1) suffix = T('shift.sameNext');
    else if (startShift === 1) suffix = T('shift.next');

    return TZ.pad(s0.hour) + ':' + TZ.pad(s0.minute) + '–' +
           TZ.pad(e0.hour) + ':' + TZ.pad(e0.minute) + suffix;
  }

  function sampleDate(quarter, year) {
    return { Q1: year + '-02-15', Q2: year + '-05-15', Q3: year + '-08-15', Q4: year + '-11-15' }[quarter];
  }

  function renderPolicyPanel(policy, resolved) {
    var year = +(state.date || todayIn(global.CORE_TIME_BASE_TZ)).split('-')[0];
    var groups = [
      { key: 'Q1 · Q3', win: global.CORE_TIME_POLICY.Q1.windows[0], winter: sampleDate('Q1', year), summer: sampleDate('Q3', year) },
      { key: 'Q2 · Q4', win: global.CORE_TIME_POLICY.Q2.windows[0], winter: sampleDate('Q4', year), summer: sampleDate('Q2', year) }
    ];
    var current = policy.rotation;
    var listed = ENTITIES.filter(function (e) { return POLICY_TABLE_HIDDEN.indexOf(e.id) === -1; });

    var head = '<thead><tr><th>' + T('policy.entity') + '</th>' + groups.map(function (g) {
      return '<th' + (g.key === current ? ' class="is-current"' : '') + '>' + g.key + '</th>';
    }).join('') + '</tr></thead>';

    var body = listed.map(function (e) {
      return '<tr><td><span class="dtable__name">' + entityName(e) + ' <span class="dtable__badge">' + e.code + '</span></span>' +
        '<span class="dtable__code">' + entityCity(e) + '</span></td>' +
        groups.map(function (g) {
          var standard = windowLocal(e, g.win, g.winter);
          var summer = windowLocal(e, g.win, g.summer);
          var excluded = g.win.excluded && g.win.excluded[e.id];
          return '<td class="' + (g.key === current ? 'is-current' : '') +
            (excluded ? ' is-excluded' : '') + '" ' +
            (excluded ? 'title="' + excluded + '"' : '') + '>' +
            '<span class="mono">' + standard + '</span>' +
            (summer !== standard ? '<span class="dtable__day mono">(DST) ' + summer + '</span>' : '') +
          '</td>';
        }).join('') + '</tr>';
    }).join('');

    el.panelPolicy.innerHTML = '<section class="panel panel--policy">' +
      '<p class="panel__eyebrow panel__eyebrow--lg">' + T('policy.title') + '</p>' +
      (resolved && resolved.trilateral
        ? '<p class="notice notice--rule"><strong>' + T('policy.trilateral') + '</strong> ' + T('policy.note1') + '</p>'
        : '') +
      '<div class="tablewrap"><table class="ptable">' + head + '<tbody>' + body + '</tbody></table></div>' +
      '<p class="panel__note">' + T('policy.note1') + '<br>' + T('policy.note2') + '</p>' +
    '</section>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
