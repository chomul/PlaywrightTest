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
