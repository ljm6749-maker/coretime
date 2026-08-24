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
  /** 셀 메모는 '적합 / 협의 필요' 두 가지만 쓴다 */
  function statusLabel(row) { return T(row.fit ? 'status.fit' : 'status.talk'); }

  /** 코드가 표기 이름과 같으면(영문 India 등) 같은 말을 두 번 쓰지 않는다 */
  function entityCode(entity) { return entity.code === entityName(entity) ? '' : entity.code; }

  /** 도시명이 법인 표기와 같으면(영문 Singapore 등) 한 번만 쓴다 */
  function cityLine(entity) { return entityCity(entity) === entityName(entity) ? '' : entityCity(entity); }

  /** Global Meeting Window 표에서는 법인 약어로 적는다 (약어가 없는 곳은 근무지명 그대로) */
  function panelLabel(entity) {
    return !entity.code || entity.code === 'office' ? entityName(entity) : entity.code;
  }

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
    selectedMinutes: null,     // 시간표 첫 칸부터의 경과 분 (0 ~ 1440)
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
      opt.textContent = entityName(e) + (entityCode(e) ? ' (' + entityCode(e) + ')' : '');
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
      if (entity) opt.textContent = entityName(entity) +
        (entityCode(entity) ? ' (' + entityCode(entity) + ')' : '');
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
        '<span class="chip__code">' + entityCode(e) + '</span></span>';
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
    el.base.classList.toggle('is-placeholder', !state.baseId);
    el.duration.classList.toggle('is-placeholder', !state.durationMin);

    var refDate = state.date || todayIn(global.CORE_TIME_BASE_TZ);
    var p = refDate.split('-');
    var policy = global.Scheduler.policyFor(+p[0], +p[1]);
    el.quarterHint.textContent = state.date
      ? T('hint.quarter', { year: p[0], q: policy.quarter.slice(1) })
      : '';
    renderDayTabs();

    var list = participants();
    var resolved = global.Scheduler.resolvePolicy(policy, state.participants, state.date);
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

    if (state.selectedMinutes === null ||
        state.selectedMinutes < 0 || state.selectedMinutes >= 24 * 60) {
      state.selectedMinutes = defaultOffset(state.plan);
    }

    renderTimetable();
    renderMail();
  }

  /** 코어타임이 시작되는 칸을 기본 선택 (표 시작점부터의 경과 분) */
  function defaultOffset(plan) {
    var best = 0, bestScore = -1;
    plan.slots.forEach(function (slot) {
      var score = slot.counts.core * 4 + slot.counts.partial * 3 + slot.counts.agree * 2 + slot.counts.work - slot.counts.off * 2;
      if (score > bestScore) { bestScore = score; best = slot.offsetMin; }
    });
    return best;
  }

  /** 선택한 시각(30분 단위)을 그 자리에서 평가한다 */
  function selectedSlot() {
    if (!state.plan) return null;
    var minutes = state.selectedMinutes;
    var utcStart = state.plan.anchorUtc + minutes * 60000;
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
    // 시차와 DST 표시는 '선택한 회의 시각' 기준으로 계산한다.
    // 표가 서머타임 전환 시점을 걸쳐 있으면 첫 칸과 회의 시각의 시차가 다를 수 있다.
    var refUtc = plan.anchorUtc + selStart * 60000;

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
      var offsetDiff = (TZ.offsetMinutes(entity.tz, refUtc) -
                        TZ.offsetMinutes(base.tz, refUtc)) / 60;
      var diffLabel = offsetDiff === 0 ? T('tt.home') : (offsetDiff > 0 ? '+' : '') + Number(offsetDiff.toFixed(1));
      var holiday = null;
      plan.slots.forEach(function (slot) {
        if (!holiday && slot.rows[rowIndex].holiday) holiday = slot.rows[rowIndex].holiday;
      });

      html.push('<div class="tt__label">' +
        '<span class="tt__diff' + (offsetDiff === 0 ? ' is-home' : '') + '">' + diffLabel + '</span>' +
        '<span class="tt__ident">' +
          '<span class="tt__name">' + entityName(entity) + '<span class="tt__code">' + entityCode(entity) + '</span></span>' +
          '<span class="tt__city">' + cityLine(entity) +
            (TZ.isDST(entity.tz, refUtc) ? ' <span class="tag">DST</span>' : '') + '</span>' +
          (holiday ? '<span class="tag tag--off">' + holiday.name + (holiday.tentative ? T('tentative') : '') + '</span>' : '') +
        '</span>' +
      '</div>');

      // 이 법인의 시간대 오프셋이 바뀌는 칸 = 서머타임이 시작/종료되는 지점
      var prevOffset = null;

      plan.slots.forEach(function (slot) {
        var r = slot.rows[rowIndex];
        var newDay = r.start.hour === 0;
        var startMin = slot.offsetMin;
        var offsetNow = TZ.offsetMinutes(entity.tz, slot.utcStart);
        var dstShift = prevOffset !== null && offsetNow !== prevOffset;
        prevOffset = offsetNow;
        var title = entityName(entity) + ' ' + localRange(r) + ' · ' + statusLabel(r) +
          (dstShift ? ' · ' + T('tt.dstShift') : '');
        var halves = [0, 30].map(function (offset) {
          var at = startMin + offset;
          return '<button type="button" class="tt__half' +
            (at + 30 > selStart && at < selEnd ? ' is-sel' : '') +
            '" data-minutes="' + at + '" title="' + title + '"></button>';
        }).join('');
        html.push('<div class="tt__cell cell--' + r.status +
          (newDay ? ' is-newday' : '') + (dstShift ? ' is-dstshift' : '') + '">' +
          '<span class="tt__cellface">' + (newDay
            ? '<span class="tt__daymark">' + (isEn()
                ? MONTH_EN[r.start.month - 1] + '<br>' + r.start.day
                : r.start.month + '월<br>' + r.start.day) + '</span>'
            : '<span class="tt__hour">' + r.start.hour +
                // 인도(UTC+5:30)처럼 30분 단위 시차를 쓰는 지역은 분까지 보여준다
                (r.start.minute ? '<sup class="tt__min">' + TZ.pad(r.start.minute) + '</sup>' : '') +
              '</span>') + '</span>' +
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
      '<div class="mail__actions">' +
        '<button type="button" class="copybtn" id="mailCopy">' + T('mail.copy') + '</button>' +
        '<button type="button" class="copybtn copybtn--alt" id="teamsInvite"' +
          (slot ? '' : ' disabled') + '>' + T('mail.teams') + '</button>' +
      '</div>' +
      '<p class="mail__hint">' + T('mail.teamsHint') + '</p>' +
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
    var teamsBtn = document.getElementById('teamsInvite');
    if (teamsBtn) teamsBtn.addEventListener('click', openTeamsCompose);
  }

  /** '2026-09-15T16:00:00+09:00' — Teams 는 오프셋이 붙은 ISO 8601 만 정확히 해석한다 */
  function isoWithOffset(tz, utcMs) {
    var p = TZ.zonedParts(tz, utcMs);
    var off = TZ.offsetMinutes(tz, utcMs);
    var abs = Math.abs(off);
    return p.year + '-' + TZ.pad(p.month) + '-' + TZ.pad(p.day) +
      'T' + TZ.pad(p.hour) + ':' + TZ.pad(p.minute) + ':00' +
      (off < 0 ? '-' : '+') + TZ.pad(Math.floor(abs / 60)) + ':' + TZ.pad(abs % 60);
  }

  /**
   * Teams '새 모임' 창을 제목 · 시각 · 본문이 채워진 상태로 연다.
   * 참석자는 창이 열린 뒤 직접 추가한다 (딥링크는 사내 계정만 인식한다).
   */
  function openTeamsCompose() {
    var slot = selectedSlot();
    if (!slot) return;
    var tz = byId[state.baseId].tz;
    var subject = document.getElementById('mailSubject');
    var body = document.getElementById('mailBody');
    var text = body ? body.value : '';
    var url = 'https://teams.microsoft.com/l/meeting/new' +
      '?subject=' + encodeURIComponent(subject ? subject.value : '') +
      '&startTime=' + encodeURIComponent(isoWithOffset(tz, slot.utcStart)) +
      '&endTime=' + encodeURIComponent(isoWithOffset(tz, slot.utcStart + state.durationMin * 60000)) +
      '&content=' + encodeURIComponent(text);

    // 클립보드 쓰기는 창을 열기 전에 시작해야 한다 (포커스를 잃으면 거부된다)
    var btn = document.getElementById('teamsInvite');
    copyText(text, function () {
      if (!btn) return;
      btn.textContent = T('mail.teamsCopied');
      setTimeout(function () { btn.textContent = T('mail.teams'); }, 2600);
    });
    global.open(url, '_blank', 'noopener');
  }

  function copyMail() {
    var btn = document.getElementById('mailCopy');
    copyText(document.getElementById('mailBody').value, function () {
      btn.textContent = T('mail.copied');
      setTimeout(function () { btn.textContent = T('mail.copy'); }, 1800);
    });
  }

  function copyText(text, done) {
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

  /** 지금 적용 중인 편성 규칙을 한 줄로 알려준다 */
  function ruleNotice(resolved) {
    if (!resolved || !state.participants.length) return '';
    var head, body;
    if (resolved.fixedRule) {
      head = T(resolved.fixedRule.byRotation ? 'policy.rotationRule' : 'policy.fixed');
      body = isEn() ? resolved.fixedRule.noteEn : resolved.fixedRule.note;
    } else if (resolved.autoWindow) {
      head = T('policy.auto');
      body = T(resolved.autoWindow.auto === 'work' ? 'policy.autoWork' : 'policy.autoAdjacent');
    } else {
      head = T('policy.none');
      body = T('policy.noneNote');
    }
    return '<p class="notice notice--rule"><strong>' + head + '</strong> ' + body + '</p>';
  }

  /** 창의 절대 시작 시각 — 창이 자기 시간대를 가지면 그 시간대의 벽시계로 읽는다 */
  function windowStartUtc(win, dateStr) {
    var p = dateStr.split('-');
    return TZ.wallToUtc(win.tz || global.CORE_TIME_BASE_TZ, +p[0], +p[1], +p[2],
      Math.floor(win.from), Math.round((win.from % 1) * 60));
  }

  /**
   * 창을 한 법인의 현지 시각으로 환산한다.
   * 날짜는 한국 기준으로 읽어, 다른 법인은 (전일)·(익일)로 표시된다.
   */
  function localRangeOf(entity, win, dateStr) {
    var startUtc = windowStartUtc(win, dateStr);
    var endUtc = startUtc + (win.to - win.from) * 3600000;
    var base = TZ.zonedParts(global.CORE_TIME_BASE_TZ, startUtc);
    var baseDay = Date.UTC(base.year, base.month - 1, base.day);
    var s0 = TZ.zonedParts(entity.tz, startUtc);
    var e0 = TZ.zonedParts(entity.tz, endUtc);
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

  /** 한 조합의 법인별 시각을 표준시 · 서머타임 두 경우로 적어 준다 */
  function ruleCell(ids, win, standardDate, dstDate) {
    return ids.map(function (id) {
      var e = byId[id];
      if (!e) return '';
      var std = localRangeOf(e, win, standardDate);
      var dst = localRangeOf(e, win, dstDate);
      return '<span class="ptime">' +
        '<span class="ptime__who">' + panelLabel(e) + '</span>' +
        '<span class="ptime__at mono">' + std + '</span>' +
        (dst !== std ? '<span class="ptime__at ptime__at--dst mono">(' + T('policy.dst') + ') ' + dst + '</span>' : '') +
      '</span>';
    }).join('');
  }

  function whoLabel(ids) {
    return ids.map(function (id) { return byId[id] ? panelLabel(byId[id]) : id; }).join(' · ');
  }

  /** 지금 선택한 참여 법인과 정확히 같은 조합인가 (표에서 강조하기 위해) */
  function isCurrentSet(ids) {
    if (state.participants.length !== ids.length) return false;
    return ids.every(function (id) { return state.participants.indexOf(id) !== -1; });
  }

  function renderPolicyPanel(policy, resolved) {
    var year = +(state.date || todayIn(global.CORE_TIME_BASE_TZ)).split('-')[0];
    var rules = global.MEETING_RULES || [];
    var rotation = rules.filter(function (r) { return !!r.byRotation; });
    var fixed = rules.filter(function (r) { return !!r.window; });

    // 표준시 · 서머타임을 모두 보여주기 위한 표본 날짜 (분기 교대는 해당 분기 안에서 고른다)
    var D = {
      oddStd: year + '-02-15', oddDst: year + '-08-15',
      evenStd: year + '-11-15', evenDst: year + '-05-15',
      std: year + '-02-15', dst: year + '-08-15'
    };

    var sec1 = rotation.length ? (
      '<h3 class="psec__title">' + T('policy.sec1') + '</h3>' +
      '<p class="psec__desc">' + T('policy.sec1Desc') + '</p>' +
      '<div class="tablewrap"><table class="ptable ptable--rotation">' +
      '<colgroup><col class="pcol--who"><col><col></colgroup><thead><tr>' +
        '<th>' + T('policy.colWho') + '</th>' +
        '<th>' + T('policy.colQ13') + '</th><th>' + T('policy.colQ24') + '</th>' +
      '</tr></thead><tbody>' +
      rotation.map(function (r) {
        return r.sets.map(function (ids) {
          var cur = isCurrentSet(ids);
          return '<tr' + (cur ? ' class="is-current"' : '') + '>' +
            '<td class="ptable__who">' + whoLabel(ids) + '</td>' +
            '<td' + (policy.rotation === 'Q1 · Q3' ? ' class="is-current"' : '') + '>' +
              ruleCell(ids, r.byRotation['Q1 · Q3'], D.oddStd, D.oddDst) + '</td>' +
            '<td' + (policy.rotation === 'Q2 · Q4' ? ' class="is-current"' : '') + '>' +
              ruleCell(ids, r.byRotation['Q2 · Q4'], D.evenStd, D.evenDst) + '</td>' +
          '</tr>';
        }).join('');
      }).join('') +
      '</tbody></table></div>'
    ) : '';

    /** 연중 고정 규칙 하나를 표의 행들로 — 시각 칸은 조합 수만큼 병합한다 */
    function fixedRows(r) {
      var rows = r.displaySets || r.sets;
      var times = ruleCell(r.timeEntities || rows[0], r.window, D.std, D.dst);
      return rows.map(function (ids, i) {
        return '<tr' + (isCurrentSet(ids) ? ' class="is-current"' : '') + '>' +
          '<td class="ptable__who">' + whoLabel(ids) + '</td>' +
          (i === 0 ? '<td rowspan="' + rows.length + '">' + times + '</td>' : '') +
        '</tr>';
      }).join('');
    }

    function fixedTable(group) {
      var list = fixed.filter(function (r) { return r.group === group; });
      if (!list.length) return '';
      return '<div class="tablewrap"><table class="ptable ptable--fixed">' +
        '<colgroup><col class="pcol--who"><col></colgroup><thead><tr>' +
          '<th>' + T('policy.colWho') + '</th><th>' + T('policy.colWhen') + '</th>' +
        '</tr></thead><tbody>' + list.map(fixedRows).join('') + '</tbody></table></div>';
    }

    var sec2 = fixed.length ? (
      '<h3 class="psec__title">' + T('policy.sec2') + '</h3>' +
      '<p class="psec__desc">' + T('policy.sec2Desc') + '</p>' +
      '<h4 class="psec__sub">' + T('policy.sec2a') + '</h4>' + fixedTable('asia') +
      '<h4 class="psec__sub">' + T('policy.sec2b') + '</h4>' + fixedTable('america')
    ) : '';

    var sec3 =
      '<h3 class="psec__title">' + T('policy.sec3') + '</h3>' +
      '<div class="psec__desc psec__desc--list">' + T('policy.sec3Body') + '</div>';

    el.panelPolicy.innerHTML = '<section class="panel panel--policy">' +
      '<p class="panel__eyebrow panel__eyebrow--lg">' + T('policy.title') + '</p>' +
      '<p class="psec__intro">' + T('policy.intro') + '</p>' +
      ruleNotice(resolved) +
      sec1 + sec2 + sec3 +
    '</section>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
