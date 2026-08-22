---
description: index.html 을 다시 빌드하고 GitHub 에 커밋·푸시합니다 (Cloudflare 자동 배포)
---

수정한 소스를 배포 가능한 형태로 만들고 GitHub 에 올린다.

## 순서

1. `python3 build.py` 를 실행해 `assets/` 의 CSS·JS 를 `index.html` 한 파일로 합친다.
   - `dist/index.html` 이 만들어지면 저장소 루트의 `index.html` 로 복사한다.
   - 빌드가 실패하면 여기서 멈추고 오류를 보고한다.

2. 바뀐 내용을 확인한다.
   - `git status --short` 와 `git diff --stat` 으로 무엇이 달라졌는지 본다.
   - 소스(`assets/`, `index.html` 원본)를 고치지 않았는데 `index.html` 만 바뀌었다면
     빌드 결과만 갱신된 것이니 그대로 진행한다.

3. 커밋한다.
   - 커밋 메시지는 **무엇을 왜 바꿨는지** 한국어 한 줄로 쓴다.
     (예: `회의 추천시간 기준표를 세 갈래로 재구성`)
   - 사용자가 `$ARGUMENTS` 로 메시지를 주면 그것을 그대로 쓴다.

4. `git push -u origin main` 으로 푸시한다.
   - 네트워크 오류면 2초 → 4초 → 8초 → 16초 간격으로 최대 4회까지 재시도한다.
   - `403` 이 나면 권한 문제이므로 재시도하지 말고, 저장소 쓰기 권한이 필요하다고 알린다.

5. 결과를 보고한다.
   - 커밋 해시와 메시지
   - GitHub Actions 가 Cloudflare Pages 로 배포를 시작한다는 안내
   - 확인 주소: https://coretime.pages.dev

## 주의

- `index.html` 을 직접 손대지 않는다. 항상 `assets/` 안의 원본을 고치고 다시 빌드한다.
- 빌드 결과와 소스가 어긋난 채로 커밋하지 않는다.
