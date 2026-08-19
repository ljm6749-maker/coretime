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
      'brand.sub': '글로벌 코어타임',
      'lang.ko': 'Korean',
      'lang.en': 'English',

      'board.eyebrow': 'MEETING PLANNER',
      'board.title': '우리 몇 시에 만날까요?',
      'board.lead1': '회의 희망 날짜와 관련 정보를 선택하면 각 법인의 현지 시각을 한 눈에 볼 수 있습니다.',
      'board.lead2a': '붉은 음영의 글로벌 코어타임',
      'board.lead2b': '을 참고하여 가장 적합한 회의시간을 찾는 데 활용해보세요.',

      'field.date': '회의 개최일자',
      'field.home': '나의 소속(홈)',
      'field.duration': '회의 소요시간',
      'field.participants': '참여 법인',
      'action.selectAll': '전체 선택',
      'action.clearAll': '전체 해제',
      'hint.quarter': '{year}년 {q}분기 코어타임 기준',

      'duration.30': '30분',
      'duration.60': '1시간',
      'duration.90': '1시간 30분',
      'duration.120': '2시간',

      'tt.title': '시간표',
      'tt.legendCore': '글로벌 코어타임',
      'tt.legendOff': '휴무 · 공휴일',
      'tt.home': '홈',
      'tt.foot': '칸을 클릭하면 회의 시각이 설정되고, 아래 메일 초안에 자동 반영됩니다. 좌우 화살표로 날짜를 넘길 수 있습니다.',
      'tt.prevDay': '전날 보기',
      'tt.nextDay': '다음날 보기',

      'empty.title': '참여 법인을 선택해 주세요',
      'empty.text': '선택한 법인들의 시간이 한 줄로 정렬되고, 글로벌 코어타임이 붉게 표시됩니다.',

      'mail.title': '회의 소집 메일 템플릿',
      'mail.note': '‘본문 복사하기’ 버튼을 누르면 메일 본문에 붙여넣을 수 있습니다. 본문 창에서 내용을 바로 고쳐 쓸 수도 있습니다.',
      'mail.subject': '제목',
      'mail.body': '본문',
      'mail.copy': '본문 복사하기',
      'mail.copied': '복사 완료',
      'mail.pick': '시간표에서 회의 시각을 선택하세요',
      'mail.empty': '참여 법인과 회의 시각을 선택하면 메일 초안이 만들어집니다.',
      'mail.langKo': '국문',
      'mail.langEn': '영문',
      'mail.basis': '{name} 기준',

      'policy.title': '글로벌 코어타임 기준표',
      'policy.entity': '법인',
      'policy.current': '적용 중',
      'policy.koreaTime': '한국',
      'policy.trilateral': '3자 회의 예외 적용 중',
      'policy.note1': '한국 · HVA · HVE(또는 HVME) 3자 회의는 교대 운영에서 제외하고 Q1·Q3 시간대로 고정합니다.',
      'policy.note2': '코어타임이 현지 새벽에 해당되는 경우 당사자 간 협의를 통해 다른 회의 시간으로 편성할 수 있습니다.',

      'status.core': '코어타임',
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
      'footer.copy': '© 2026 Hanwha Vision Co., Ltd. All rights reserved.'
    },

    en: {
      'brand.sub': 'Global Core Time',
      'lang.ko': 'Korean',
      'lang.en': 'English',

      'board.eyebrow': 'MEETING PLANNER',
      'board.title': 'What time works for all of us?',
      'board.lead1': 'Choose a date and the entities joining, and you will see every office’s local time at a glance.',
      'board.lead2a': 'The red band is Global Core Time',
      'board.lead2b': ' — use it to find the slot that suits everyone best.',

      'field.date': 'Meeting date',
      'field.home': 'My entity (home)',
      'field.duration': 'Duration',
      'field.participants': 'Participating entities',
      'action.selectAll': 'Select all',
      'action.clearAll': 'Clear all',
      'hint.quarter': '{year} Q{q} core hours apply',

      'duration.30': '30 min',
      'duration.60': '1 hour',
      'duration.90': '1 hour 30 min',
      'duration.120': '2 hours',

      'tt.title': 'Timetable',
      'tt.legendCore': 'Global Core Time',
      'tt.legendOff': 'Holiday · weekend',
      'tt.home': 'Home',
      'tt.foot': 'Click a cell to set the meeting time — it flows straight into the email draft below. Use the arrows to move between days.',
      'tt.prevDay': 'Previous day',
      'tt.nextDay': 'Next day',

      'empty.title': 'Select the entities joining',
      'empty.text': 'Their local times line up in one row, with Global Core Time shaded in red.',

      'mail.title': 'Meeting invitation template',
      'mail.note': 'Press “Copy body” and paste it straight into your email. You can also edit the text right here.',
      'mail.subject': 'Subject',
      'mail.body': 'Body',
      'mail.copy': 'Copy body',
      'mail.copied': 'Copied',
      'mail.pick': 'Select a time in the timetable',
      'mail.empty': 'Choose the entities and a meeting time to generate the draft.',
      'mail.langKo': 'Korean',
      'mail.langEn': 'English',
      'mail.basis': '{name} time',

      'policy.title': 'Global Core Time reference',
      'policy.entity': 'Entity',
      'policy.current': 'Current',
      'policy.koreaTime': 'Korea',
      'policy.trilateral': 'Three-way meeting exception applied',
      'policy.note1': 'Three-way meetings between Korea, HVA and HVE (or HVME) are exempt from the rotation and follow the Q1·Q3 schedule.',
      'policy.note2': 'Where core hours fall in the middle of the night locally, the people involved may agree on a different time.',

      'status.core': 'Core time',
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
      'footer.copy': '© 2026 Hanwha Vision Co., Ltd. All rights reserved.'
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
