# 한화비전 글로벌 코어타임

한화비전 8개 법인을 위한 **월드타임버디 방식 회의시간 도구**입니다.
날짜와 참여 법인을 고르면 법인별 시간이 한 줄로 정렬된 시간표가 나오고,
**글로벌 코어타임이 붉은 음영**으로 표시됩니다. 원하는 칸을 클릭하고 복사 버튼을 누르면
회의 소집 메일 초안에 그 시각이 그대로 들어갑니다.

빌드 도구·서버·외부 라이브러리 없이 동작하는 정적 사이트입니다.

## 실행

```bash
python3 -m http.server 8000     # 저장소 루트에서 실행 후 http://localhost:8000
python3 build.py                # 단일 파일 배포본 dist/index.html (+ 임베드용 dist/embed.html)
```

## 대상 법인

| 표시 | 법인 | 위치 | 시간대 |
| --- | --- | --- | --- |
| 한국 (HVC) | Hanwha Vision Co., Ltd. (본사) | 성남 판교 | Asia/Seoul |
| 북미 동부 (HVA) | Hanwha Vision America | Teaneck, NJ | America/New_York |
| 북미 서부 (Carlsbad) | Hanwha Vision America — West | Carlsbad, CA | America/Los_Angeles |
| 멕시코 (HVMX) | Hanwha Vision Mexico | Mexico City | America/Mexico_City |
| 유럽 (HVE) | Hanwha Vision Europe | Chertsey, Surrey | Europe/London |
| 중동 (HVME) | Hanwha Vision Middle East | Dubai | Asia/Dubai |
| APAC (HVAPAC) | Hanwha Vision Asia Pacific | Singapore | Asia/Singapore |
| 베트남 (HVV) | Hanwha Vision Vietnam | Bắc Ninh | Asia/Ho_Chi_Minh |

## 코어타임 — Ground Rules v0.92 기준

[`Global Collaboration Ground Rules v0.92`](#) 1.1 Global Core Hours를 그대로 반영했습니다.

> 글로벌 코어타임은 법인 간 정기 회의 편성의 기준 시간대를 의미하며, **분기별로 교대 운영**한다.
> 정기 회의는 글로벌 코어타임으로 편성하고, 그 외 회의는 당사자 간 협의를 통해 정한다.
> 각 법인 내부 회의는 글로벌 코어타임을 피해 편성한다.

코어타임은 전 법인이 공유하는 **하나의 절대 시간 창**입니다. 한국(HVC) 기준으로 정의하고,
각 법인 행에는 같은 순간이 현지시각으로 표시됩니다. 서머타임은 IANA 시간대 데이터로 자동 반영되므로
문서의 `(DST)` 행이 별도 입력 없이 그대로 나옵니다.

| 법인 | Q1 · Q3 (한국 19:00–23:00) | Q2 · Q4 (한국 06:00–10:00) |
| --- | --- | --- |
| HVC (한국) | 19:00–23:00 | 06:00–10:00 |
| HVA (북미 동부) | 05:00–09:00 · DST 06:00–10:00 | 16:00–20:00 (전일) · DST 17:00–21:00 |
| Carlsbad (북미 서부)¹ | 02:00–06:00 · DST 03:00–07:00 → **협의** | 13:00–17:00 (전일) · DST 14:00–18:00 |
| HVMX (멕시코) | 04:00–08:00 → **협의** | 15:00–19:00 (전일) |
| HVE (유럽) | 10:00–14:00 · DST 11:00–15:00 | 21:00–01:00 (전일→당일) → **협의** |
| HVME (중동) | 14:00–18:00 | 01:00–05:00 → **협의** |
| HVAPAC (APAC) | 18:00–22:00 | 05:00–09:00 |
| HVV (베트남)¹ | 17:00–21:00 | 04:00–08:00 → **협의** |

¹ 문서에 없는 법인. 같은 코어타임 창을 적용하되, 현지 새벽에 해당하는 분기는 문서의 회색 음영 규칙과
같은 기준으로 **협의 대상**으로 표시합니다.

**협의(회색 음영)** — 코어타임이 현지 새벽에 해당하는 칸은 코어타임 적용 대상에서 제외되며 당사자 간 협의로 정합니다.
시간표에서 빗금 친 붉은 칸으로 표시됩니다.

**3자 회의 예외** — 한국 · HVA · HVE(또는 HVME) 3자 회의는 교대 운영에서 제외하고 Q1·Q3 시간대로 고정됩니다.
참여 법인을 그 조합으로 고르면 분기와 무관하게 한국 19:00–23:00 창이 적용되고, 화면에 예외 적용 중임이 표시됩니다.

시간표 칸 색은 다섯 가지입니다.

| 색 | 의미 |
| --- | --- |
| **붉은 음영** | 글로벌 코어타임 |
| 붉은 빗금 | 코어타임이 현지 새벽 — 적용 제외, 당사자 협의 |
| 파란 음영 | 현지 정규 근무시간 |
| 어두운 칸 | 근무시간 외 |
| 회색 빗금 | 주말 · 공휴일 |

## 회의 소집 메일

* 시간표에서 칸을 클릭 → 오른쪽 메일 초안에 그 시각이 즉시 반영 → **제목 + 본문 복사** 버튼 하나로 붙여넣기 준비 완료
* 국문 / 영문 전환
* **템플릿 편집** 버튼으로 기본 문구를 직접 고칠 수 있고, 수정본은 브라우저에 저장되어 다음에 열 때도 유지됩니다
* 템플릿 안의 중괄호 토큰은 자동 치환됩니다

| 토큰 | 치환 결과 |
| --- | --- |
| `{{일시}}` | 2026년 8월 19일(수) 15:00–16:00 (한국 기준) |
| `{{일시표}}` | 법인별 현지시각 목록 (여러 줄, 근무시간 외·휴무 표시 포함) |
| `{{소요시간}}` | 60분 |
| `{{참여법인}}` | 한국, 북미 동부, 유럽 … |
| `{{코어타임}}` | 적용된 코어타임 창 이름 |
| `{{분기}}` | 2026년 3분기 |

기본 문구 자체를 바꾸려면 `assets/js/mail.js`의 `DEFAULT_TEMPLATES`를 수정하면 됩니다.

## 조회수 카운터

페이지 하단 우측에 **오늘 / 누적 조회수**가 표시됩니다. 같은 세션에서 새로고침해도 한 번만 집계되고,
집계 요청이 실패하면(사내망 차단·서비스 장애 등) 카운터는 그냥 표시되지 않습니다.

설정은 [`assets/js/counter.js`](assets/js/counter.js) 상단 한 곳입니다.

```js
window.VIEW_COUNTER = {
  mode: 'countapi',                    // 'countapi' | 'worker' | 'off'
  namespace: 'hanwhavision-coretime',
  workerUrl: ''
};
```

| mode | 설명 |
| --- | --- |
| `countapi` | 가입·설치 없이 바로 동작 (공개 무료 서비스 api.countapi.xyz). 서비스가 멈추면 카운터만 사라집니다 |
| `worker` | 직접 만든 Cloudflare Worker 사용 — [`worker/view-counter.js`](worker/view-counter.js) 참고. 무료 플랜으로 충분하고 안정적입니다 |
| `off` | 카운터 숨김 |

## 기준값 관리

모든 기준값은 [`assets/js/data.js`](assets/js/data.js) 한 곳에 있습니다.

* `ENTITIES` — 법인 목록(이름·약칭·법인명·도시·시간대·지도 좌표·근무요일·정규 근무시간·점심시간·공휴일 표)
* `CORE_TIME_POLICY` — 분기(Q1~Q4)별 코어타임 창. `from`/`to`는 한국(HVC) 기준 시각(`8.5` = 08:30, 24 초과 = 익일), `excluded`는 현지 새벽이라 협의 대상이 되는 법인과 그 사유
* `TRILATERAL_RULE` — 한국 · HVA · HVE(또는 HVME) 3자 회의 예외
* `HOLIDAYS` — 공휴일 표(2026년). 음력·이슬람력 기반 휴일은 `{ name, tentative: true }`로 두면 화면에 *잠정*으로 표시됩니다

코어타임 값은 Global Collaboration Ground Rules v0.92 1.1 표를 그대로 옮긴 것입니다. 문서가 개정되면
이 표만 교체하면 시간표·지도·메일 초안에 모두 반영됩니다.

## 구현 메모

* **시간대** — `Intl.DateTimeFormat`으로 각 시점의 UTC 오프셋을 계산하므로 서머타임(DST)이 자동 반영되고, 시간표 라벨에 `DST` 배지가 붙습니다. (`assets/js/tz.js`)
* **판정 로직** — `assets/js/scheduler.js`. 홈 법인 하루 24시간을 1시간 단위로 훑으며 법인별 상태(코어타임 / 협의 / 근무시간 / 근무시간 외 / 휴무)를 계산하고, 참여 법인 조합에 따라 3자 회의 예외를 적용합니다.
* **시간표 배치** — `Scheduler.centeredStartHour()`가 코어타임 창이 24칸의 가운데에 오도록 첫 칸 시각을 계산합니다.
* **기준표 노출 제외** — `assets/js/app.js`의 `POLICY_TABLE_HIDDEN` 배열로 조정합니다. (현재 베트남 · 북미 서부 — 시간표와 회의시간 계산에는 그대로 포함)
* **테마** — 밝은 회색 배경의 라이트 테마입니다. 색은 `styles.css` 최상단 `:root` 토큰에서 일괄 조정합니다.

## 알려진 제약

* 공휴일 표는 2026년 기준 수기 입력이며, 음력·이슬람력 휴일은 확정 공고 전 잠정값입니다.
* 법인 소재지는 대표 사무소 기준이며, 같은 지역 내 복수 거점은 하나로 표시합니다.
* 개인 일정·회의실 예약과는 연동되지 않습니다.

## 파일 구조

```
index.html                 화면 마크업
assets/css/styles.css      스타일
assets/js/i18n.js          한국어 · English 문구 사전           ← 문구 수정
assets/js/counter.js       조회수 카운터 (오늘 · 누적)          ← 집계 방식 설정
worker/view-counter.js     조회수 카운터용 Cloudflare Worker
assets/js/data.js          법인 · 분기 코어타임 창 · 공휴일     ← 기준값 수정
assets/js/mail.js          회의 소집 메일 기본 템플릿           ← 문구 수정
assets/js/tz.js            시간대 유틸리티 (DST 자동 반영)
assets/js/scheduler.js     코어타임 판정 엔진
assets/js/app.js           화면 조립 · 상태 관리
build.py                   단일 파일 빌드 (dist/)
```
