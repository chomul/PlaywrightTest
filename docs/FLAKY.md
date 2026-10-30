# Flaky 테스트 점검

## 1. 개발 중 발견한 불안정 요인

### F-01 WebKit: 드래그로 그린 도형이 중간 크기로 저장됨

| 항목 | 내용 |
| --- | --- |
| 증상 | `happy-path.spec.ts` "툴바로 그리면 요소 1개가 저장된다"가 WebKit에서만 간헐적으로 실패. 기대 200x120, 실제 100x60, 125x75, 150x90, 175x105 |
| 측정 | 수정 전 WebKit `--repeat-each=10`(3개 테스트, 30회): 25회 실패. 실패 값은 모두 드래그 중간 좌표와 일치 |
| 첫 가설(틀림) | localStorage 저장(300ms 디바운스)이 드래그 중에 일어나 중간 값을 읽었다고 봄. 최종 값을 `expect.poll`로 기다리게 바꿨지만 30회 중 12회 실패가 남음. 실패 스크린샷에서 캔버스의 도형 자체가 작게 그려져 있어 앱이 실제로 중간 좌표로 확정한 것을 확인 |
| 원인 | Excalidraw `throttleRAF`(`packages/excalidraw/utils.ts:148`)는 `trailing` 옵션이 없으면 프레임마다 **첫** pointermove만 처리. Playwright의 합성 이벤트는 여러 move가 한 프레임 안에 들어가므로 마지막 좌표가 버려지고, pointerup의 `flush()`는 이미 프레임이 처리된 뒤에는 아무것도 하지 않음 |
| 조치 | `EditorPage.drag()`에서 마지막 좌표를 다음 애니메이션 프레임에 한 번 더 보냄(`requestAnimationFrame`으로 동기화, 고정 시간 대기 없음). 저장 값 검증은 `expect.poll`로 최종 값을 기다리는 방식 유지 |
| 결과 | 수정 후 Chromium, Firefox, WebKit `--repeat-each=10`(90회) 모두 통과 |
| 결함 여부 | 실제 사용자 입력에서 재현되는지 확인하지 못해서 결함으로 등록하지 않음. 실제 Safari에서 빠르게 드래그를 놓을 때 끝점이 덜 반영되는지는 수동 확인이 필요한 미확정 관찰 |

### F-02 새로고침 후 저장 데이터 비교가 간헐적으로 실패

| 항목 | 내용 |
| --- | --- |
| 증상 | `state.spec.ts` "새로고침해도 도형, 속성, 선택 상태가 그대로 남는다"가 WebKit에서 1회 실패. `boundElements`가 새로고침 전에는 `null`, 후에는 `[]` |
| 원인 | 앱이 장면을 복원할 때 `boundElements: null`을 `[]`로 바꿔 다시 저장함. 테스트가 그 재저장 전과 후 중 언제 읽느냐에 따라 결과가 달라짐. 테스트가 확인하려는 동작(그린 것이 남는다)과 상관없는 필드까지 전체 비교한 것이 문제 |
| 조치 | id, type, 위치, 크기, 선 색만 비교하고 `expect.poll`로 기다림 |
| 결과 | 수정 후 3개 브라우저 `--repeat-each=15`(45회) 모두 통과 |

## 2. `--repeat-each=10` 전체 점검

측정 안 함. 2026-10-30에 `npx playwright test --repeat-each=10`(1,860회, 워커 12개)을 실행했으나 PC 메모리 부족으로 598회 진행 시점에 실행 환경이 프로세스를 종료함. 종료 전 598회에서 실패 표시는 없었으나 완료된 결과가 아니므로 결과로 쓰지 않음.

다시 실행할 명령(워커 수를 줄여 메모리 사용을 낮춤):

```bash
npx playwright test --repeat-each=10 --workers=4
node scripts/summarize-results.js
```
