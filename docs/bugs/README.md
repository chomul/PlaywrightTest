# 결함 목록

대상: Excalidraw `v0.18.1`. 모두 Excalidraw 앱의 결함이며 업스트림 저장소에는 아무것도 올리지 않았습니다.

| ID | 제목 | 심각도 | 브라우저 | 업스트림 | 재검증(로컬 패치) |
| --- | --- | --- | --- | --- | --- |
| [BUG-001](BUG-001.md) | 메인 메뉴 버튼과 대화상자 입력 필드에 접근 가능한 이름이 없음 | Major | 3개 + 모바일 | 메뉴 버튼은 [#11297](https://github.com/excalidraw/excalidraw/issues/11297) 있음, 입력 필드는 초안 | 메뉴 버튼 수정 확인 |
| [BUG-002](BUG-002.md) | 메뉴의 Open으로 파일을 불러오면 메인 메뉴가 다시 열림 | Minor | 3개 | 없음, 초안 | 수정 확인 |
| [BUG-003](BUG-003.md) | 데스크톱 오류 대화상자를 Escape로 닫을 수 없음 | Major | 3개 | 없음(#1236의 회귀로 보임), 초안 | 수정 확인 |
| [BUG-004](BUG-004.md) | Save to file 버튼 글자 대비 2.43:1 | Minor | 3개 | 없음, 초안 | 수정 확인 |

- 각 결함은 `test.fail`로 테스트에 고정했습니다. 앱이 고쳐지면 "Expected to fail, but passed"로 실패해서 알려 줍니다.
- 재검증: 업스트림이 아직 고치지 않았으므로(2026-10-30 `master` 코드 확인), `patches/`의 최소 수정을 로컬 클론에 적용하고 다시 빌드한 뒤 같은 테스트로 확인했습니다. 확인 후 원본으로 되돌렸습니다.
- `evidence/`: 원본 빌드에서 Chromium으로 찍은 재현 스크린샷.

## 결함으로 등록하지 않은 관찰

| 관찰 | 판단 |
| --- | --- |
| 대화상자 `aria-labelledby`가 존재하지 않는 id를 가리켜 이름이 없음 | 이미 [#11961](https://github.com/excalidraw/excalidraw/issues/11961), PR [#12022](https://github.com/excalidraw/excalidraw/pull/12022)로 보고됨 |
| `meta viewport`의 `user-scalable=no`(axe `meta-viewport`) | 캔버스가 자체 확대/축소를 처리하는 의도된 설계로 판단 |
| WebKit에서 빠른 합성 드래그의 끝점이 버려짐 | 실제 사용자 입력으로 재현하지 못해 미확정. `docs/FLAKY.md` F-01 |
| 선 굵기 등 속성 라디오에 Playwright가 이름을 못 붙임 | 브라우저 접근성 트리에는 이름("Thin")이 있음. 결함 아님 |
