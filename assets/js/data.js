/**
 * 한화비전 글로벌 법인 · 코어타임 · 공휴일 기준값
 *
 * 이 파일만 수정하면 지도 · 시간표 · 추천 · 메일 초안에 모두 반영됩니다.
 */

/* ─────────────────────────────────────────────────────────────
 * 1) 법인 (Corporations)
 *    tz       : IANA 시간대 ID (서머타임 자동 반영)
 *    work     : 현지 정규 근무시간 [시작, 종료]  (8.5 = 08:30)
 *    holidays : 공휴일 표 키 (아래 HOLIDAYS). 여러 법인이 공유 가능
 *    lat/lon  : 지도 마커 좌표, labelSide : 마커 라벨 방향
 * ───────────────────────────────────────────────────────────── */
window.ENTITIES = [
  {
    id: 'kr', name: '한국', nameEn: 'Korea', code: 'HVC',
    legal: 'Hanwha Vision Co., Ltd. (HQ)',
    city: '경기도', cityEn: 'Gyeonggi-do', country: '대한민국',
    tz: 'Asia/Seoul', lat: 37.40, lon: 127.10, labelSide: 'left',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'kr'
  },
  {
    id: 'hva', name: '북미 동부', nameEn: 'North America East', code: 'HVA',
    legal: 'Hanwha Vision America',
    city: 'Teaneck, NJ', cityEn: 'Teaneck, NJ', country: '미국',
    tz: 'America/New_York', lat: 40.89, lon: -74.01, labelSide: 'right',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'us'
  },
  {
    id: 'hvw', name: '북미 서부', nameEn: 'North America West', code: 'Carlsbad',
    legal: 'Hanwha Vision America — West',
    city: 'Carlsbad, CA', cityEn: 'Carlsbad, CA', country: '미국',
    tz: 'America/Los_Angeles', lat: 33.16, lon: -117.35, labelSide: 'left',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'us'
  },
  {
    id: 'mx', name: '멕시코', nameEn: 'Mexico', code: 'HVMX',
    legal: 'Hanwha Vision Mexico',
    city: 'Mexico City', cityEn: 'Mexico City', country: '멕시코',
    tz: 'America/Mexico_City', lat: 19.43, lon: -99.13, labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [13, 14], holidays: 'mx'
  },
  {
    id: 'eu', name: '유럽', nameEn: 'Europe', code: 'HVE',
    legal: 'Hanwha Vision Europe',
    city: 'Chertsey, UK', cityEn: 'Chertsey, UK', country: '영국',
    tz: 'Europe/London', lat: 51.39, lon: -0.51, labelSide: 'top',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'uk'
  },
  {
    id: 'me', name: '중동', nameEn: 'Middle East', code: 'HVME',
    legal: 'Hanwha Vision Middle East',
    city: 'Dubai, UAE', cityEn: 'Dubai, UAE', country: 'UAE',
    tz: 'Asia/Dubai', lat: 25.20, lon: 55.27, labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [13, 14], holidays: 'ae',
    /** 금요일 주마(합동예배) 시간은 회의 편성에서 제외 */
    shortDay: { weekday: 5, until: 12, reason: '금요일 오후 주마 예배' }
  },
  {
    id: 'in', name: '인도', nameEn: 'India', code: 'India',
    legal: 'Hanwha Vision India',
    city: 'Gurugram', cityEn: 'Gurugram', country: '인도',
    tz: 'Asia/Kolkata', lat: 28.46, lon: 77.03, labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [13, 14], holidays: 'in'
  },
  {
    id: 'apac', name: '싱가포르', nameEn: 'Singapore', code: 'HVAPAC',
    legal: 'Hanwha Vision Asia Pacific',
    city: 'Singapore', cityEn: 'Singapore', country: '싱가포르',
    tz: 'Asia/Singapore', lat: 1.35, lon: 103.82, labelSide: 'right',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'sg'
  },
  {
    id: 'vn', name: '베트남', nameEn: 'Vietnam', code: 'HVV',
    legal: 'Hanwha Vision Vietnam',
    city: 'Bắc Ninh', cityEn: 'Bac Ninh', country: '베트남',
    tz: 'Asia/Ho_Chi_Minh', lat: 21.19, lon: 106.08, labelSide: 'left',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'vn'
  }
];

/* ─────────────────────────────────────────────────────────────
 * 2) 글로벌 코어타임  (Global Collaboration Ground Rules v0.92, 1.1)
 *
 *   "글로벌 코어타임은 법인 간 정기 회의 편성의 기준 시간대를 의미하며,
 *    분기별로 교대 운영한다."
 *
 *   코어타임은 전 법인이 공유하는 하나의 절대 시간 창입니다.
 *   아래 from/to 는 한국(HVC) 기준 시각이며, 각 법인 행에는 같은 순간이
 *   현지시각으로 표시됩니다. (문서의 (DST) 표기는 IANA 시간대로 자동 반영)
 *
 *     Q1 · Q3 : 한국 19:00–23:00  (= HVA 05:00–09:00 / DST 06:00–10:00,
 *               HVE 10:00–14:00 / DST 11:00–15:00, HVME 14:00–18:00,
 *               HVAPAC 18:00–22:00, HVMX 04:00–08:00)
 *     Q2 · Q4 : 한국 06:00–10:00  (= HVA 전일 16:00–20:00 / DST 17:00–21:00,
 *               HVE 21:00–01:00 / DST 22:00–02:00, HVME 01:00–05:00,
 *               HVAPAC 05:00–09:00, HVMX 전일 15:00–19:00)
 *
 *   excluded : 문서에서 회색 음영으로 표시된 칸 — 코어타임이 현지 새벽에
 *              해당하여 적용 대상에서 제외하고 당사자 간 협의로 정한다.
 *              (문서에 없는 Carlsbad · 베트남 법인은 같은 새벽 기준으로 판단)
 * ───────────────────────────────────────────────────────────── */
window.CORE_TIME_BASE_TZ = 'Asia/Seoul';

var CORE_WINDOW_ODD = {              // Q1 · Q3
  id: 'q13', name: 'Q1 · Q3 코어타임', from: 19, to: 23,
  excluded: {
    mx: '문서 회색 음영 — 현지 새벽 04:00–08:00',
    hvw: '현지 새벽 02:00–06:00 (문서 외 법인, 새벽 기준 적용)'
  }
};

var CORE_WINDOW_EVEN = {             // Q2 · Q4
  id: 'q24', name: 'Q2 · Q4 코어타임', from: 6, to: 10,
  excluded: {
    eu: '문서 회색 음영 — 현지 21:00–01:00',
    me: '문서 회색 음영 — 현지 새벽 01:00–05:00',
    vn: '현지 새벽 04:00–08:00 (문서 외 법인, 새벽 기준 적용)',
    'in': '현지 새벽 02:30–06:30 (문서 외 법인, 새벽 기준 적용)'
  }
};

/* ─────────────────────────────────────────────────────────────
 * 2-1) 고정 회의 추천시간
 *
 *   특정 법인 조합은 시차가 극단적이라 분기 교대(코어타임)를 적용하기 어렵다.
 *   아래 조합은 참여 법인이 정확히 일치할 때 분기 교대에서 빠지고
 *   연중 같은 시간대를 회의 추천시간으로 쓴다.
 *
 *   window.tz 를 주면 그 시간대의 벽시계 기준으로 창을 고정한다.
 * ───────────────────────────────────────────────────────────── */
window.MEETING_RULES = [
  /* ── (1) 분기 교대 운영 ───────────────────────────────────── */
  {
    id: 'kr-hva',
    group: 'rotation',
    sets: [['kr', 'hva']],
    byRotation: {
      'Q1 · Q3': { id: 'kr-hva-odd',  name: '한국 · 북미 동부 (Q1·Q3)', tz: 'Asia/Seoul', from: 21, to: 23 },
      'Q2 · Q4': { id: 'kr-hva-even', name: '한국 · 북미 동부 (Q2·Q4)', tz: 'Asia/Seoul', from: 8,  to: 10 }
    },
    note: '한국 · 북미 동부는 시차가 커 야간·새벽 근무가 불가피하므로, 분기별로 교대해 부담을 나눕니다. '
        + 'Q1·Q3 한국 21:00–23:00 / Q2·Q4 한국 08:00–10:00.',
    noteEn: 'Korea and North America East rotate quarterly so the unavoidable off-hours burden is shared: '
          + 'Q1·Q3 21:00–23:00 and Q2·Q4 08:00–10:00 Korea time.'
  },

  /* ── (2) A. 아시아 · 중동 · 유럽 권역 ──────────────────────── */
  {
    id: 'kr-asia',
    group: 'asia',
    sets: [['kr', 'vn'], ['kr', 'apac'], ['kr', 'me']],
    timeEntities: ['kr', 'vn', 'apac', 'me'],
    window: { id: 'kr-asia', name: '한국 · 아시아/중동 고정 추천시간', tz: 'Asia/Seoul', from: 15, to: 17 },
    note: '시차가 작아 교대 운영이 비효율적인 권역으로, 한국 15:00–17:00 으로 연중 고정합니다.',
    noteEn: 'Time differences here are small, so the window is fixed year-round at 15:00–17:00 Korea time.'
  },
  {
    id: 'kr-eu',
    group: 'asia',
    sets: [['kr', 'eu']],
    timeEntities: ['kr', 'eu'],
    window: { id: 'kr-eu', name: '한국 · 유럽 고정 추천시간', tz: 'Asia/Seoul', from: 17, to: 20 },
    note: '한국 · 유럽 회의는 한국 17:00–20:00 으로 연중 고정합니다. (영국 표준시 08:00–11:00 / BST 09:00–12:00)',
    noteEn: 'Korea–Europe meetings are fixed year-round at 17:00–20:00 Korea time (08:00–11:00 GMT / 09:00–12:00 BST).'
  },

  /* ── (2) B. 북미 서부 권역 및 다자회의 ─────────────────────── */
  {
    id: 'fix-na',
    group: 'america',
    /* 북미 서부 · 북미 동부 · 멕시코가 섞이는 모든 조합을 같은 창으로 묶는다 */
    sets: [
      ['kr', 'hvw'], ['kr', 'hvw', 'hva'], ['kr', 'mx'],
      ['kr', 'hvw', 'mx'], ['kr', 'hva', 'mx'], ['kr', 'hvw', 'hva', 'mx']
    ],
    displaySets: [['kr', 'hvw'], ['kr', 'hvw', 'hva'], ['kr', 'mx']],
    timeEntities: ['kr', 'hvw', 'hva', 'mx'],
    window: { id: 'fix-na', name: '한국 · 북미 고정 추천시간', tz: 'Asia/Seoul', from: 8, to: 11 },
    note: '북미 서부 · 북미 동부 · 멕시코가 참여하는 회의는 한국 08:00–11:00 으로 연중 고정합니다. '
        + '(북미는 전일 오후~저녁에 해당합니다)',
    noteEn: 'Meetings involving North America West, North America East or Mexico are fixed year-round at '
          + '08:00–11:00 Korea time — the previous afternoon or evening in the Americas.'
  },
  {
    id: 'fix-india',
    group: 'america',
    sets: [['kr', 'hvw', 'in']],
    timeEntities: ['kr', 'hvw', 'in'],
    window: { id: 'fix-india', name: '한국 · 북미 서부 · 인도 고정 추천시간', tz: 'Asia/Seoul', from: 10, to: 14 },
    note: '한국 · 북미 서부 · 인도 3자 회의는 한국 10:00–14:00 으로 연중 고정합니다.',
    noteEn: 'Three-way meetings between Korea, North America West and India are fixed year-round at '
          + '10:00–14:00 Korea time.'
  },
  {
    id: 'kr-hva-eu',
    group: 'america',
    sets: [['kr', 'hva', 'eu'], ['kr', 'hva', 'me']],
    timeEntities: ['kr', 'hva', 'eu', 'me'],
    window: { id: 'kr-hva-eu', name: '한국 · 북미 동부 · 유럽(중동) 고정 추천시간', tz: 'Asia/Seoul', from: 19, to: 23 },
    note: '한국 · 북미 동부 · 유럽(또는 중동) 3자 회의는 한국 19:00–23:00 으로 연중 고정합니다.',
    noteEn: 'Three-way meetings between Korea, North America East and Europe (or the Middle East) are fixed '
          + 'year-round at 19:00–23:00 Korea time.'
  }
];



var ROTATION_NOTE = '글로벌 코어타임은 분기별로 교대 운영합니다. 정기 회의는 코어타임 안에서 편성하고, 그 외 회의는 당사자 간 협의로 정합니다. 각 법인 내부 회의는 코어타임을 피해 편성합니다.';

window.CORE_TIME_POLICY = {
  Q1: { label: '1분기 · Q1·Q3 코어타임', rotation: 'Q1 · Q3', note: ROTATION_NOTE, windows: [CORE_WINDOW_ODD] },
  Q2: { label: '2분기 · Q2·Q4 코어타임', rotation: 'Q2 · Q4', note: ROTATION_NOTE, windows: [CORE_WINDOW_EVEN] },
  Q3: { label: '3분기 · Q1·Q3 코어타임', rotation: 'Q1 · Q3', note: ROTATION_NOTE, windows: [CORE_WINDOW_ODD] },
  Q4: { label: '4분기 · Q2·Q4 코어타임', rotation: 'Q2 · Q4', note: ROTATION_NOTE, windows: [CORE_WINDOW_EVEN] }
};

/**
 * 3자 회의 예외 (문서 1.1 각주)
 * "한국·HVA·HVE(또는 HVME) 3자 회의는 교대 운영에서 제외하며, Q1/Q3 시간대로 고정한다."
 */
window.TRILATERAL_RULE = {
  /** 한국 · HVA 가 모두 있고, HVE 또는 HVME 중 하나라도 있으면 적용 */
  required: ['kr', 'hva'],
  oneOf: ['eu', 'me'],
  window: CORE_WINDOW_ODD,
  note: '한국 · HVA · HVE(또는 HVME)가 함께 참여하는 회의는 교대 운영에서 제외하고 Q1·Q3 시간대(한국 19:00–23:00)로 고정합니다.'
};

/** 회의 소요시간 선택지 (분) */
window.DURATIONS = [30, 60, 90, 120, 150, 180, 210, 240];

/* ─────────────────────────────────────────────────────────────
 * 3) 공휴일 (2026년)
 *    값은 문자열(휴일명) 또는 { name, tentative } 객체입니다.
 *    tentative: true = 음력·이슬람력 기반이라 확정 공고 전 잠정 날짜
 * ───────────────────────────────────────────────────────────── */
window.HOLIDAYS = {
  kr: {
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
    '2026-03-02': '삼일절 대체공휴일',
    '2026-05-01': '근로자의 날',
    '2026-05-05': '어린이날',
    '2026-05-25': '부처님오신날 대체공휴일',
    '2026-06-03': '전국동시지방선거',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
    '2026-10-05': '개천절 대체공휴일',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절'
  },
  us: {
    '2026-01-01': "New Year's Day",
    '2026-01-19': 'Martin Luther King Jr. Day',
    '2026-02-16': "Presidents' Day",
    '2026-05-25': 'Memorial Day',
    '2026-06-19': 'Juneteenth',
    '2026-07-03': 'Independence Day (관측)',
    '2026-09-07': 'Labor Day',
    '2026-11-26': 'Thanksgiving',
    '2026-11-27': { name: 'Day after Thanksgiving', tentative: true },
    '2026-12-25': 'Christmas Day'
  },
  mx: {
    '2026-01-01': 'Año Nuevo',
    '2026-02-02': 'Día de la Constitución',
    '2026-03-16': 'Natalicio de Benito Juárez',
    '2026-04-03': { name: 'Viernes Santo', tentative: true },
    '2026-05-01': 'Día del Trabajo',
    '2026-09-16': 'Día de la Independencia',
    '2026-11-16': 'Día de la Revolución',
    '2026-12-25': 'Navidad'
  },
  uk: {
    '2026-01-01': "New Year's Day",
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Easter Monday',
    '2026-05-04': 'Early May Bank Holiday',
    '2026-05-25': 'Spring Bank Holiday',
    '2026-08-31': 'Summer Bank Holiday',
    '2026-12-25': 'Christmas Day',
    '2026-12-28': 'Boxing Day (대체)'
  },
  ae: {
    '2026-01-01': "New Year's Day",
    '2026-03-19': { name: 'Eid al-Fitr', tentative: true },
    '2026-03-20': { name: 'Eid al-Fitr', tentative: true },
    '2026-03-21': { name: 'Eid al-Fitr', tentative: true },
    '2026-05-26': { name: 'Arafat Day', tentative: true },
    '2026-05-27': { name: 'Eid al-Adha', tentative: true },
    '2026-05-28': { name: 'Eid al-Adha', tentative: true },
    '2026-06-16': { name: 'Islamic New Year', tentative: true },
    '2026-08-25': { name: "Prophet Muhammad's Birthday", tentative: true },
    '2026-12-01': 'Commemoration Day',
    '2026-12-02': 'National Day', '2026-12-03': 'National Day'
  },
  sg: {
    '2026-01-01': "New Year's Day",
    '2026-02-17': 'Chinese New Year', '2026-02-18': 'Chinese New Year',
    '2026-03-21': { name: 'Hari Raya Puasa', tentative: true },
    '2026-04-03': 'Good Friday',
    '2026-05-01': 'Labour Day',
    '2026-05-27': { name: 'Hari Raya Haji', tentative: true },
    '2026-05-31': { name: 'Vesak Day', tentative: true },
    '2026-08-10': 'National Day (대체)',
    '2026-11-08': { name: 'Deepavali', tentative: true },
    '2026-12-25': 'Christmas Day'
  },
  'in': {
    '2026-01-26': 'Republic Day',
    '2026-03-04': { name: 'Holi', tentative: true },
    '2026-03-21': { name: 'Id-ul-Fitr', tentative: true },
    '2026-04-03': 'Good Friday',
    '2026-08-15': 'Independence Day',
    '2026-10-02': 'Gandhi Jayanti',
    '2026-10-20': { name: 'Dussehra', tentative: true },
    '2026-11-08': { name: 'Diwali', tentative: true },
    '2026-12-25': 'Christmas Day'
  },
  vn: {
    '2026-01-01': 'Tết Dương lịch',
    '2026-02-16': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-17': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-18': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-19': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-20': { name: 'Tết Nguyên đán', tentative: true },
    '2026-04-26': { name: 'Giỗ Tổ Hùng Vương', tentative: true },
    '2026-04-30': 'Ngày Giải phóng',
    '2026-05-01': 'Ngày Quốc tế Lao động',
    '2026-09-02': 'Quốc khánh'
  }
};

/** 'YYYY-MM-DD' 키로 공휴일 조회 → { name, tentative } 또는 null */
window.holidayOf = function (entityOrId, dateKey) {
  var key = typeof entityOrId === 'string' ? entityOrId : (entityOrId.holidays || entityOrId.id);
  var table = window.HOLIDAYS[key];
  if (!table || !table[dateKey]) return null;
  var value = table[dateKey];
  return typeof value === 'string' ? { name: value, tentative: false } : value;
};
