# 한화비전 글로벌 코어타임

한화비전 8개 법인을 위한 **월드타임버디 방식 회의시간 도구**입니다.
세계지도에 각 법인의 실시간 현지시각과 휴무 여부를 표시하고, 날짜를 고르면 법인별 시간이 한 줄로 정렬된
시간표에서 **글로벌 코어타임이 붉은 음영**으로 보입니다. 원하는 칸을 클릭하고 복사 버튼을 누르면
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
| 멕시코 (Mex) | Hanwha Vision Mexico | Mexico City | America/Mexico_City |
| 유럽 (HVE) | Hanwha Vision Europe | Chertsey, Surrey | Europe/London |
| 중동 (HVME) | Hanwha Vision Middle East | Dubai | Asia/Dubai |
| APAC (HVAPAC) | Hanwha Vision Asia Pacific | Singapore | Asia/Singapore |
| 베트남 (HVV) | Hanwha Vision Vietnam | Bắc Ninh | Asia/Ho_Chi_Minh |

## 코어타임을 다루는 방식

글로벌 코어타임은 **같은 절대 시각을 가리키는 창(window)** 입니다. 한국 본사 시각으로 정의하고,
각 법인 행에는 같은 순간이 현지시각으로 표시됩니다.

> 한국 19:00–22:00 이 코어타임이면 → 북미 동부 06:00–09:00 이 같은 열에 똑같이 붉게 칠해집니다.

분기마다 세 개의 창을 운영합니다. (기본값 · `data.js`에서 수정)

| 창 | 대상 법인 | 3분기 (한국 기준) |
| --- | --- | --- |
| 아시아 · 중동 · 유럽 | HVV · HVAPAC · HVC · HVME · HVE | 15:00–18:00 |
| 한국 · 미주 동부 | HVC · HVA · Mex | 18:00–21:00 |
| 유럽 · 미주 | HVE · Mex · HVA · Carlsbad | 22:00–01:00 (익일) |

시간표 칸 색은 네 가지입니다.

| 색 | 의미 |
| --- | --- |
| **붉은 음영** | 글로벌 코어타임 |
| 파란 음영 | 현지 정규 근무시간 |
| 어두운 칸 | 근무시간 외 |
| 빗금 칸 | 주말 · 공휴일 |

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

## 기준값 관리

모든 기준값은 [`assets/js/data.js`](assets/js/data.js) 한 곳에 있습니다.

* `ENTITIES` — 법인 목록(이름·약칭·법인명·도시·시간대·지도 좌표·근무요일·정규 근무시간·점심시간·공휴일 표)
* `CORE_TIME_POLICY` — 분기(Q1~Q4)별 코어타임 창. `from`/`to`는 한국 본사 기준 시각(`8.5` = 08:30, 24 초과 = 익일), `entities`는 그 창이 적용되는 법인
* `HOLIDAYS` — 공휴일 표(2026년). 음력·이슬람력 기반 휴일은 `{ name, tentative: true }`로 두면 화면에 *잠정*으로 표시됩니다

분기별 코어타임 값은 각 지역 근무시간이 겹치는 구간과 분기 운영 특성(1분기 사업계획 정렬, 2분기 표준,
3분기 하계 유연근무, 4분기 결산)을 반영한 **기준안**입니다. 사내 확정 공지가 나오면 이 표만 교체하면
시간표·지도·메일 초안에 모두 반영됩니다.

## 구현 메모

* **시간대** — `Intl.DateTimeFormat`으로 각 시점의 UTC 오프셋을 계산하므로 서머타임(DST)이 자동 반영되고, 시간표 라벨에 `DST` 배지가 붙습니다. (`assets/js/tz.js`)
* **지도** — Natural Earth 기반 국가 경계를 0.75° 격자로 샘플링한 육지 비트마스크(`assets/js/world-mask.js`, 약 15KB)를 캔버스에 정방형 도법으로 도트 렌더링합니다. 외부 타일 서버·이미지 요청이 없습니다.
* **낮/밤** — 태양 직하점(적위·균시차)을 계산해 도트별 태양 고도로 낮·박명·밤을 구분합니다.
* **판정 로직** — `assets/js/scheduler.js`. 기준 법인 하루 24시간을 1시간 단위로 훑으며 법인별 상태(코어/근무/근무 외/휴무)를 계산합니다.

## 알려진 제약

* 공휴일 표는 2026년 기준 수기 입력이며, 음력·이슬람력 휴일은 확정 공고 전 잠정값입니다.
* 법인 소재지는 대표 사무소 기준이며, 같은 지역 내 복수 거점은 하나로 표시합니다.
* 개인 일정·회의실 예약과는 연동되지 않습니다.

## 파일 구조

```
index.html                 화면 마크업
assets/css/styles.css      스타일
assets/js/data.js          법인 · 분기 코어타임 창 · 공휴일     ← 기준값 수정
assets/js/mail.js          회의 소집 메일 기본 템플릿           ← 문구 수정
assets/js/tz.js            시간대 유틸리티 (DST 자동 반영)
assets/js/scheduler.js     코어타임 판정 엔진
assets/js/map.js           세계지도 렌더링 · 마커 · 실시간 시계
assets/js/app.js           화면 조립 · 상태 관리
assets/js/world-mask.js    육지 도트 비트마스크 (생성 데이터)
build.py                   단일 파일 빌드 (dist/)
```
