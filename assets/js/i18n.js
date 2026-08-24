/**
 * 다국어 문구 사전 (한국어 · English)
 *
 * 화면 우측 상단의 Korean / English 버튼으로 전환합니다.
 * 새 문구를 추가할 때는 ko · en 양쪽에 같은 키로 넣어 주세요.
 */
(function (global) {
  'use strict';

  var STRINGS = {
    ko: {
      'brand.sub': '회의 추천시간 조회하기',
      'lang.ko': 'Korean',
      'lang.en': 'English',

      'board.eyebrow': 'MEETING PLANNER',
      'board.title': '우리 몇 시에 만날까요?',
      'board.lead1': '관련 정보를 선택하면 각 법인의 현지 시각을 한 눈에 볼 수 있습니다.',
      'board.lead2a': '붉은 음영의 회의 추천시간',
      'board.lead2b': '을 참고하여 가장 적합한 회의시간을 찾아보세요.',

      'field.date': '회의 개최일자',
      'field.select': '선택하세요',
      'field.home': '나의 소속(홈)',
      'field.duration': '회의 소요시간',
      'field.participants': '회의 참여자 소속',
      'action.selectAll': '전체 선택',
      'action.clearAll': '전체 해제',
      'hint.quarter': '{year}년 {q}분기 코어타임 기준',

      'duration.hour': '{h}시간',
      'duration.hourHalf': '{h}시간 30분',
      'duration.half': '30분',

      'tt.title': '시간표',
      'tt.legendCore': '회의 추천시간',
      'tt.legendOff': '휴무 · 공휴일',
      'tt.home': '홈',
      'tt.dstShift': '이 칸부터 서머타임이 바뀝니다',
      'tt.foot': '칸을 클릭하면 회의 시각이 설정되고, 아래 메일 초안에 자동 반영됩니다. 좌우 화살표로 날짜를 넘길 수 있습니다.',
      'tt.prevDay': '전날 보기',
      'tt.nextDay': '다음날 보기',

      'empty.title': '회의 정보를 선택해 주세요',
      'empty.text': '개최일자 · 나의 소속 · 소요시간 · 회의 참여자 소속을 고르면 시간표가 나타납니다.',

      'mail.title': '회의 소집 메일 템플릿',
      'mail.note1': '‘본문 복사하기’ 버튼을 누르면 메일 본문에 붙여넣을 수 있습니다.',
      'mail.note2': '본문 창에서 내용을 바로 고쳐 쓸 수도 있습니다.',
      'mail.subject': '제목',
      'mail.body': '본문',
      'mail.copy': '본문 복사하기',
      'mail.teams': 'Teams 일정 만들기',
      'mail.teamsHint': "템플릿 본문을 복사하시면 'Teams 일정 만들기'창에서 붙여넣으실 수 있습니다.",
      'mail.copied': '복사 완료',
      'mail.phTime': '(회의 시각을 선택해 주세요)',
      'mail.phDuration': '(소요시간을 선택해 주세요)',
      'mail.phEntities': '(참여 법인을 선택해 주세요)',
      'mail.empty': '참여 법인과 회의 시각을 선택하면 메일 초안이 만들어집니다.',
      'mail.basis': '{name} 기준',

      'policy.title': 'Global Meeting Window',
      'policy.intro': '글로벌 코어타임은 법인 간 회의 시간 편성 시 참고하는 권고기준이며, 의무 근무시간 또는 의무 회의 시간을 의미하지 않습니다.',
      'policy.sec1': '(1) 분기 교대 시간대',
      'policy.sec1Desc': '시차가 커 야간·새벽 근무를 피할 수 없는 조합입니다. 분기별로 시간대를 교대해 부담을 나눕니다.',
      'policy.sec2': '(2) 연중 고정 시간대',
      'policy.sec2Desc': '시차가 안정적이거나 교대가 비효율적인 조합입니다. 연중 같은 시간대를 적용합니다.',
      'policy.sec2a': 'A. 아시아 · 중동 · 유럽 권역',
      'policy.sec2b': 'B. 북미 권역 및 다자회의',
      'policy.sec3': '(3) 그 외 조합',
      'policy.sec3Body':
        '<span class="pline">- (1),(2) 규칙에 해당하지 않는 경우, 공통된 근무시간 또는 근무 인접시간으로 회의를 편성합니다.</span>' +
        '<span class="pline">- 공통 시간이 없는 경우, 당사자 간 협의를 통해 정합니다.</span>',
      'policy.colWho': '참여 법인',
      'policy.colWhen': 'Time window',
      'policy.colQ13': '1st and 3rd quarters',
      'policy.colQ24': '2nd and 4th quarters',
      'policy.dst': '서머타임',
      'policy.current': '적용 중',
      'policy.koreaTime': '한국',
      'policy.fixed': '연중 고정 추천시간 적용 중',
      'policy.rotationRule': '분기 교대 운영 적용 중',
      'policy.auto': '참여 법인 기준 자동 편성',
      'policy.autoWork': '참여 법인의 근무시간이 가장 많이 겹치는 구간을 회의 추천시간으로 표시합니다.',
      'policy.autoAdjacent': '모두의 근무시간이 겹치는 구간이 없어, 근무시간에 가장 가까운 2시간으로 편성했습니다.',
      'policy.none': '추천 가능한 시간 없음',
      'policy.noneNote': '참여 법인 모두가 현지 07:00–21:00 안에 들어오는 공통 시간이 없습니다. 회의를 나누거나 당사자 간 협의로 정하세요.',

      'status.fit': '적합',
      'status.talk': '협의 필요',
      'status.core': '코어타임',
      'status.partial': '코어타임 일부 벗어남',
      'status.agree': '협의 편성',
      'status.work': '근무시간',
      'status.out': '근무시간 외',
      'status.off': '휴무',

      'shift.prev': ' (전일)',
      'shift.prevSame': ' (전일→당일)',
      'shift.sameNext': ' (당일→익일)',
      'shift.next': ' (익일)',
      'shift.nextDay': ' (익일)',
      'tentative': ' 잠정',

      'footer.feedback1': '사이트 개선을 위한 의견은 ',
      'footer.feedback2': '으로 이메일 보내주세요.',
      'footer.copy': '© 2026 Hanwha Vision Co., Ltd. All rights reserved.',
      'footer.views': '오늘 {today}회 · 누적 {total}회'
    },

    en: {
      'brand.sub': 'Find your meeting time',
      'lang.ko': 'Korean',
      'lang.en': 'English',

      'board.eyebrow': 'MEETING PLANNER',
      'board.title': "Meet O'Clock",
      'board.lead1': 'Select an option below to view each entity\'s local time at a glance.',
      'board.lead2a': 'Refer to the red-highlighted recommended meeting hours',
      'board.lead2b': ' to find the best time for everyone.',

      'field.date': 'Meeting date',
      'field.select': 'Select',
      'field.home': 'My entity (home)',
      'field.duration': 'Duration',
      'field.participants': 'Participating entities',
      'action.selectAll': 'Select all',
      'action.clearAll': 'Clear all',
      'hint.quarter': '{year} Q{q} core hours apply',

      'duration.hour': '{h} hour{s}',
      'duration.hourHalf': '{h} hour{s} 30 min',
      'duration.half': '30 min',

      'tt.title': 'Timetable',
      'tt.legendCore': 'Recommended meeting hours',
      'tt.legendOff': 'Holiday · weekend',
      'tt.home': 'Home',
      'tt.dstShift': 'Daylight saving time changes at this cell',
      'tt.foot': 'Click a cell to set the meeting time — it flows straight into the email draft below. Use the arrows to move between days.',
      'tt.prevDay': 'Previous day',
      'tt.nextDay': 'Next day',

      'empty.title': 'Select the meeting details',
      'empty.text': 'Choose a date, your entity, a duration and the attending entities to see the timetable.',

      'mail.title': 'Meeting invitation template',
      'mail.note1': 'Press “Copy body” to paste it straight into your email.',
      'mail.note2': 'You can also edit the text right here in the body box.',
      'mail.subject': 'Subject',
      'mail.body': 'Body',
      'mail.copy': 'Copy body',
      'mail.teams': 'Create Teams meeting',
      'mail.teamsHint': "Copy the template body and paste it into the 'Create Teams meeting' window.",
      'mail.copied': 'Copied',
      'mail.phTime': '(select a meeting time)',
      'mail.phDuration': '(select a duration)',
      'mail.phEntities': '(select the participating entities)',
      'mail.empty': 'Choose the entities and a meeting time to generate the draft.',
      'mail.basis': '{name} time',

      'policy.title': 'Global Meeting Window',
      'policy.intro': 'The Global Meeting Window serves as a standard scheduling guideline for cross-entity meetings across different time zones.',
      'policy.sec1': '(1) Quarterly Focus Window',
      'policy.sec1Desc': 'Time differences here make off-hours unavoidable, so the slot rotates by quarter to share the burden.',
      'policy.sec2': '(2) Fixed Annual Window',
      'policy.sec2Desc': 'Time differences are stable, or rotation would add no value, so one slot is used all year.',
      'policy.sec2a': 'A. Asia · Middle East · Europe',
      'policy.sec2b': 'B. North America and multi-party meetings',
      'policy.sec3': '(3) Everything else',
      'policy.sec3Body':
        '<span class="pline">If neither (1) nor (2) applies, please follow as below.</span>' +
        '<span class="pline pline--head">\u25aa Overlapping / Adjacent Hours First</span>' +
        '<span class="pline">- Schedule meetings during overlapping working hours\u2014or closely adjacent hours\u2014between both parties.</span>' +
        '<span class="pline pline--head">\u25aa No Overlapping Hours</span>' +
        "<span class=\"pline\">- If no common working hours exist, determine the schedule by mutual agreement, taking turns to accommodate each other's time zones.</span>",
      'policy.colWho': 'Entities',
      'policy.colWhen': 'Time window',
      'policy.colQ13': '1st and 3rd quarters',
      'policy.colQ24': '2nd and 4th quarters',
      'policy.dst': 'DST',
      'policy.current': 'Current',
      'policy.koreaTime': 'Korea',
      'policy.fixed': 'Year-round fixed hours applied',
      'policy.rotationRule': 'Quarterly rotation applied',
      'policy.auto': 'Derived from the selected entities',
      'policy.autoWork': 'The window shown is where the selected entities\' business hours overlap most.',
      'policy.autoAdjacent': 'No shared business hours exist, so the closest two-hour window was chosen instead.',
      'policy.none': 'No recommended hours',
      'policy.noneNote': 'There is no time when every selected entity falls within 07:00–21:00 locally. Split the meeting or agree a time directly.',

      'status.fit': 'Suitable',
      'status.talk': 'Needs agreement',
      'status.core': 'Core time',
      'status.partial': 'Partly outside core time',
      'status.agree': 'By agreement',
      'status.work': 'Business hours',
      'status.out': 'Outside hours',
      'status.off': 'Holiday',

      'shift.prev': ' (prev day)',
      'shift.prevSame': ' (prev → same day)',
      'shift.sameNext': ' (same → next day)',
      'shift.next': ' (next day)',
      'shift.nextDay': ' (next day)',
      'tentative': ' tentative',

      'footer.feedback1': 'Send suggestions for this site to ',
      'footer.feedback2': '.',
      'footer.copy': '© 2026 Hanwha Vision Co., Ltd. All rights reserved.',
      'footer.views': 'Today {today} · Total {total}'
    }
  };

  var current = 'ko';

  global.I18N = {
    STRINGS: STRINGS,
    setLang: function (lang) { current = STRINGS[lang] ? lang : 'ko'; },
    lang: function () { return current; },
    /** t('hint.quarter', { year: 2026, q: 3 }) */
    t: function (key, vars) {
      var text = (STRINGS[current] && STRINGS[current][key]) || STRINGS.ko[key] || key;
      if (!vars) return text;
      return Object.keys(vars).reduce(function (acc, name) {
        return acc.split('{' + name + '}').join(vars[name]);
      }, text);
    }
  };
})(window);
