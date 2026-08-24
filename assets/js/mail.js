/**
 * 회의 소집 메일 템플릿 (영문 단일본)
 *
 * 아래 TEMPLATE 의 문구가 화면에 그대로 나오고,
 * 중괄호 토큰은 선택한 회의 시각으로 자동 치환됩니다.
 * 화면의 본문 창에서 바로 고쳐 쓴 뒤 복사할 수 있습니다.
 *
 *   {{일시}}     2026-08-20 (Thu) 19:00–20:00 Korea time
 *   {{일시표}}   법인별 현지시각 목록 (여러 줄)
 *   {{소요시간}} 60 min
 *   {{참여법인}} Hanwha Vision Co., Ltd. (HQ), …
 *   {{코어타임}} 적용된 코어타임 창 이름
 *   {{분기}}     2026 Q3
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var TEMPLATE = {
    subject: '[invitation] [ Meeting Name ] – {{일시}}',
    body: [
      'Dear colleagues,',
      '',
      'I hope this email finds you well.',
      'You are invited to the [ Meeting Title ] below.',
      'In this session, we will discuss [ brief summary of key discussion points ].',
      '',
      '1. Meeting Overview',
      '- Date & Time: {{일시}}',
      '- Location: Teams Meeting (Meeting link attached)',
      '- Attendees:',
      '- Purpose:',
      '',
      '2. Key Agenda',
      '(1)',
      '(2)',
      '',
      '3. Reference Link',
      '- [ Materials or links to review ]',
      '',
      'Best regards,'
    ].join('\n')
  };

  /** 법인명 뒤를 공백으로 채워 시각 열을 맞춘다 */
  function padRight(text, width) {
    return text + new Array(Math.max(1, width - text.length + 1)).join(' ');
  }

  function timeRange(row) {
    return TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute) + '–' +
           TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
  }

  function rowLine(row) {
    var s = row.start;
    var date = s.month + '/' + s.day + ' ' + EN_DAY[s.weekday];
    var tail = '';
    if (row.status === 'off') tail = '  * local holiday';
    else if (row.status === 'out') tail = '  * outside business hours';
    else if (row.status === 'agree') tail = '  * outside core hours - by agreement';
    return '   · ' + padRight(row.entity.legal, 34) + date + ' ' + timeRange(row) + tail;
  }

  /** 화면 언어와 무관하게 메일은 영문 문구로 채운다 */
  function EN(key) { return global.I18N.STRINGS.en[key]; }

  function tokens(ctx) {
    var quarter = ctx.policy.year + ' ' + ctx.policy.quarter;
    if (!ctx.rows || !ctx.rows.length || !ctx.baseParts) {
      return {
        '{{일시}}': EN('mail.phTime'),
        '{{소요시간}}': ctx.durationMin ? durationText(ctx.durationMin) : EN('mail.phDuration'),
        '{{참여법인}}': EN('mail.phEntities'),
        '{{일시표}}': '   ' + EN('mail.phEntities'),
        '{{코어타임}}': 'the designated Global Core Hours',
        '{{분기}}': quarter
      };
    }
    var b = ctx.baseParts;
    return {
      '{{일시}}': b.year + '-' + TZ.pad(b.month) + '-' + TZ.pad(b.day) + ' (' + EN_DAY[b.weekday] + ') ' +
        ctx.baseRange + ' ' + (ctx.base.nameEn || ctx.base.legal) + ' time',
      '{{소요시간}}': ctx.durationMin ? durationText(ctx.durationMin) : EN('mail.phDuration'),
      '{{참여법인}}': ctx.rows.map(function (r) { return r.entity.legal; }).join(', '),
      '{{일시표}}': ctx.rows.map(rowLine).join('\n'),
      '{{코어타임}}': 'the designated Global Core Hours',
      '{{분기}}': quarter
    };
  }

  /** 60 → '1 hour' */
  function durationText(min) {
    var h = Math.floor(min / 60);
    var half = min % 60 >= 30;
    if (!h) return '30 min';
    return h + ' hour' + (h > 1 ? 's' : '') + (half ? ' 30 min' : '');
  }

  function fill(text, map) {
    return Object.keys(map).reduce(function (acc, token) {
      return acc.split(token).join(map[token]);
    }, text);
  }

  global.MailTemplate = {
    DEFAULT: TEMPLATE,
    /** 저장된 문구에 회의 시각을 채워 완성본을 만든다 */
    render: function (ctx) {
      var map = tokens(ctx);
      return { subject: fill(TEMPLATE.subject, map), body: fill(TEMPLATE.body, map) };
    }
  };
})(window);
