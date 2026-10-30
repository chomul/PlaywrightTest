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

## 2. `--repeat-each=10` 전체 점검

(전체 테스트 작성 후 실행 결과를 적습니다.)
