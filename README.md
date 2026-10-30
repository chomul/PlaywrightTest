# Excalidraw E2E (Playwright)

오픈소스 웹 화이트보드 [Excalidraw](https://github.com/excalidraw/excalidraw)를 대상으로 만든 Playwright E2E 테스트 저장소입니다.

## 테스트 대상

| 항목 | 값 |
| --- | --- |
| 저장소 | https://github.com/excalidraw/excalidraw |
| 고정 태그 | `v0.18.1` (커밋 `a2ec2889babf7d2295469c6d90ebe77fae57df84`, `APP_VERSION` 파일) |
| 실행 방식 | `app/`에 클론 → `vite build` → `vite preview` (포트 4173) |

`app/`은 이 저장소에 커밋하지 않습니다. `npm run setup:app`이 고정 태그로 클론하고 설치와 빌드까지 합니다.

## 실행 방법

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run setup:app        # Excalidraw 클론, 설치, 프로덕션 빌드
npm test                 # webServer가 vite preview를 자동으로 띄웁니다
npm run report           # HTML 리포트 열기
```

Node 22를 기준으로 합니다(Excalidraw `engines`가 18~22). 로컬에서 Node 24로도 `--ignore-engines`로 설치와 빌드가 됐습니다.

## 구조

```
tests/
  e2e/                 분류별 spec (정상 흐름, 경계값, 오류 경로, 상태, 시각 회귀, 접근성, 모바일)
  pages/               Page Object (EditorPage, MainMenu, PropertiesPanel)
  support/             fixture(외부 요청 가드, 파일 대화상자 우회), 파일 저장/열기 헬퍼
  data/                .excalidraw 테스트 데이터(정상, 깨진 JSON, 0바이트, 형식이 다른 JSON)
  __screenshots__/     시각 회귀 기준 이미지(Windows)
docs/
  TEST_PLAN.md         시나리오, 우선순위, 기법, 제외 범위
  bugs/                결함 보고(BUG-001~004), 재현 스크린샷, 수정 제안 패치
  FLAKY.md             불안정 요인과 조치, --repeat-each=10 결과
scripts/
  setup-app.sh         Excalidraw 고정 태그 클론, 설치, 빌드
  summarize-results.js JSON 리포트 집계
```

## 설계 원칙

- **외부 요청 없음**: 모든 외부 요청을 fixture에서 가로챕니다. 폰트 CDN은 빌드에 들어 있는 같은 woff2로 응답하고, 분석 스크립트는 차단하며, 공유 링크 API는 테스트마다 `page.route`로 500, 지연, 끊김, 정상 응답을 만듭니다.
- **테스트 격리**: 테스트마다 새 브라우저 컨텍스트(빈 localStorage)에서 시작하고, 서비스 워커를 차단합니다.
- **로케이터**: `getByRole`, `getByTitle`, `getByText`를 먼저 쓰고, 접근 가능한 이름이 없는 컨트롤(메뉴 버튼 등)만 앱에 이미 있는 `data-testid`를 씁니다. 캔버스는 `<canvas>` 하나라 CSS 로케이터를 씁니다.
- **캔버스 검증**: localStorage에 저장된 요소 JSON, 내보낸 파일(.excalidraw, PNG, SVG) 내용, `toHaveScreenshot`으로 확인합니다.
- **대기**: `waitForTimeout`을 쓰지 않습니다. web-first assertion과 `expect.poll`, 애니메이션 프레임과 `document.getAnimations()` 같은 동기화 지점만 씁니다.
- **알려진 결함**: `test.fail`로 고정해서 CI는 녹색을 유지하고, 앱이 고쳐지면 "Expected to fail, but passed"로 알려 줍니다.

## QA 결과

실행 로그(`logs/`, 커밋 안 함)에서 확인한 값만 적었습니다. 측정하지 않은 항목은 "측정 안 함"으로 표시했습니다.

| 항목 | 값 |
| --- | --- |
| 테스트 수 | 65개(정상 흐름 12, 경계값과 입력 검증 15, 오류 경로 12, 상태 9, 시각 회귀 3, 접근성 7, 모바일 7) |
| 실행 수 | 186회(데스크톱 3개 브라우저 x 58 + 모바일 12) |
| 브라우저별 통과 | Chromium 58/58, Firefox 58/58, WebKit 58/58, Pixel 7(Chromium) 12/12. 알려진 결함 고정 테스트의 기대된 실패 12회 포함 |
| 전체 실행 시간(로컬) | 75.9초(Windows 11, 2026-10-30) |
| CI 실행 시간 | 측정 안 함 |
| 찾은 결함 | 4건(Major 2, Minor 2). [docs/bugs](docs/bugs/README.md) |
| flaky | 개발 중 2건 발견, 원인 수정. `--repeat-each=10` 전체 점검은 측정 안 함(실행이 중간에 중단됨). [docs/FLAKY.md](docs/FLAKY.md) |
