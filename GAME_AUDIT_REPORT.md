# 대기실 축구 게임 & 대전 게임 종합 감사 보고서

**작성일**: 2026-03-05 (초판) / 2026-03-06 (2차 감사, 3~4차 수정)
**감사 범위**: 대기실(Waiting Room) 축구 게임, 대전(배틀) 게임, 공통 인프라
**감사 파일**: `wr-ball.js`, `wr-battle.js`, `wr-render.js`, `wr-realtime.js`, `wr-particles.js`, `wr-gimmicks.js`, `wr-emote.js`, `wr-teacher.js`, `waiting-room.js`, `game-physics.js`, `game-mechanics.js`, `game-ai.js`, `game-keyboard.js`, `game-render.js`, `game-stages.js`, `game-spectator.js`, `game.js`

---

## 요약 대시보드

| 심각도 | 축구 게임 | 대전 게임 | 공통/인프라 | 합계 | 수정됨 |
|--------|:---------:|:---------:|:-----------:|:----:|:------:|
| **Critical** | 3 | 4 | 2 | **9** | **9** |
| **High** | 4 | 5 | 1 | **10** | **5** |
| **Medium** | 6 | 6 | 5 | **17** | **5** |
| **Low** | 4 | 5 | 4 | **13** | 0 |
| **Info** | 3 | 5 | 3 | **11** | - |
| **합계** | **20** | **25** | **15** | **60** | **19** |

---

## 1. CRITICAL - 크래시 또는 게임 중단 유발

### [SC-C1] 축구: `sizeChange` 기믹에서 `this.player` null 크래시 -- ✅ 수정됨
- **파일**: `wr-gimmicks.js:470-484`
- **문제**: `spawnRandomObstacle()`에서 `sizeChange` 타입 스폰 시 `const P = this.player`를 사용하는데, `this.player`가 null이면 `P.w` 접근에서 즉시 TypeError 크래시 발생
- **수정 내용**: 스폰 함수에 `if(!this.player) return;` 가드 추가, 업데이트 루프에도 player null 체크 추가
- **커밋**: `6489de2`

### [SC-C2] 축구: `redLightGreenLight` 무궁화에서 `this.player` null 크래시 -- ✅ 수정됨
- **파일**: `wr-gimmicks.js:201, 208`
- **문제**: `rl.savedPlayerPos={x:this.player.x, y:this.player.y}` 및 red phase에서 `this.player`가 null이면 크래시
- **수정 내용**: 삼항 연산자로 fallback 추가, red phase에 `if(!this.player) continue;` 가드 추가
- **커밋**: `6489de2`
- **잔존 이슈**: `spawnRandomObstacle()` 내 `redLightGreenLight` 초기화 (라인 514)에서 `savedPlayerPos:{x:this.player.x,y:this.player.y}` 여전히 미보호 → **[SC-C3]**으로 분리

### [SC-C3] 축구: `redLightGreenLight` 스폰 시 `this.player` null 크래시 -- ✅ 수정됨
- **파일**: `wr-gimmicks.js:507`
- **문제**: `spawnRandomObstacle()`에서 `redLightGreenLight` 기믹 초기화 시 `savedPlayerPos:{x:this.player.x,y:this.player.y}`를 직접 접근. godMode 교사가 기믹을 스폰하면 `this.player`가 null이어서 즉시 크래시
- **수정 내용**: `if(!this.player) return;` 가드 추가
- **커밋**: 3차 수정

### [BT-C1] 대전: 플레이어 퇴장 시 투사체 풀 인덱스 미반환 (풀 고갈) -- ✅ 수정됨
- **파일**: `wr-realtime.js:720-727`
- **문제**: 퇴장 플레이어의 투사체를 `splice`로 제거하면서 `_projFree`에 풀 인덱스를 반환하지 않음
- **수정 내용**: `if (this._projFree) this._projFree.push(proj._poolIdx);` 추가
- **커밋**: `6489de2`

### [BT-C2] 대전: `_battleStop()`에서 `_projFree`/`_bParticleFree` 미초기화 -- ✅ 수정됨
- **파일**: `wr-battle.js:152-175`
- **문제**: `_projPool = null`, `_bParticlePool = null`로 설정하지만 `_projFree`와 `_bParticleFree`는 그대로 잔존
- **수정 내용**: `this._projFree = null; this._bParticleFree = null;` 추가
- **커밋**: `6489de2`

### [BT-C3] 대전: `_battleRespawn()`에서 `this.chatBubbles` null 미체크 -- ✅ 수정됨
- **파일**: `wr-battle.js:538-544`
- **문제**: `this.chatBubbles.push(...)` 호출 시 `chatBubbles`가 null이면 크래시
- **수정 내용**: `if (this.chatBubbles)` 가드 추가
- **커밋**: `6489de2`
- **잔존 이슈**: `_battleOnKill()` (라인 560), `_battleCheckPickup()` (라인 603)에 동일한 미보호 `chatBubbles.push` 존재 → **[BT-C4]**로 분리

### [BT-C4] 대전: `_battleOnKill`/`_battleCheckPickup`에서 `chatBubbles` null 미체크 -- ✅ 수정됨
- **파일**: `wr-battle.js:560, 605`
- **문제**: `_battleRespawn()`은 수정되었지만, `_battleOnKill()`과 `_battleCheckPickup()`에서도 동일하게 `this.chatBubbles.push()`를 null 체크 없이 호출
- **수정 내용**: 두 함수 모두 `if (this.chatBubbles)` 가드 추가
- **커밋**: 3차 수정

### [CM-C1] 공통: `_flushComposing`에서 배열 참조 파괴 -- ✅ 수정됨
- **파일**: `game-keyboard.js:335`
- **문제**: `this._composing = comp.length = 0;`에서 `comp.length = 0`이 숫자 `0`을 반환하여 `this._composing`이 숫자로 설정됨
- **수정 내용**: `comp.length = 0; this._composing = [];`로 분리
- **커밋**: `6489de2`

### [CM-C2] 공통: `_onPlayerLeave`에서 존재하지 않는 `this.entities` 참조 -- ✅ 수정됨
- **파일**: `game.js:811-815`
- **문제**: `this.entities`는 정의된 적 없는 프로퍼티. 항상 falsy여서 이탈 알림 버블이 절대 생성되지 않음
- **수정 내용**: `this.entities[0]`을 `this.player`로 교체
- **커밋**: `6489de2`

---

## 2. HIGH - 게임 플레이에 영향을 주는 중요한 버그

### [SC-H1] 축구: 비호스트 골 보상 불일치 -- ✅ 수정됨
- **파일**: `wr-realtime.js:455-457, 641`
- **문제**: 비호스트는 로컬 `_ballTouchers`로 보상을 판정하지만, 호스트와 달라 보상 불일치
- **수정 내용**: 호스트가 골 브로드캐스트 시 `touchers` 목록을 함께 전송, 비호스트가 호스트의 터치 목록 기반으로 보상 판정
- **커밋**: 3차 수정

### [SC-H2] 축구: 호스트 전환 시 공 상태 유실
- **파일**: `wr-realtime.js:838-841`
- **문제**: 새 호스트 선출 시 `_rtLastBallSendTime = 0`만 설정. 이전 호스트의 `_serverX/Y` 보정 잔량이 남아 새 호스트에서 비정상 적용
- **영향**: 호스트 전환 직후 공이 이상한 위치로 순간이동
- **수정**: 호스트 전환 시 `ball._serverX = undefined; ball._serverY = undefined;` 초기화

### [SC-H3] 축구: `_ballTouchers` 필터 60프레임(1초)으로 너무 짧음 -- ✅ 수정됨
- **파일**: `wr-ball.js:141`
- **문제**: 공을 1초 이상 전에 터치한 플레이어는 기록에서 제거됨. 롱슛으로 1초 이상 걸려 골이 되면 '???' 표시
- **수정 내용**: 필터 시간을 60→180프레임(3초)으로 확대
- **커밋**: 4차 수정

### [SC-H4] 축구: `screenFlip`/`sizeChange` 기믹이 덱에 없어 절대 스폰 안 됨 -- ✅ 수정됨
- **파일**: `wr-gimmicks.js:384-389`
- **문제**: `_shuffleDeck()`의 `allTypes`에 `'screenFlip'`과 `'sizeChange'`가 포함되지 않음
- **수정 내용**: `allTypes`에 `'screenFlip'`, `'sizeChange'` 추가
- **커밋**: 3차 수정

### [BT-H1] 대전: 폭탄 자폭 시 `_rtBroadcastHit` 미전송 -- ✅ 수정됨
- **파일**: `wr-battle.js:429-436`
- **문제**: `_battleExplodeBomb()`에서 자폭 시 `_battleTakeDamage()`만 호출하고 네트워크 히트를 브로드캐스트하지 않음
- **수정 내용**: 자폭 데미지도 `_rtBroadcastHit()` 호출 추가
- **커밋**: 4차 수정

### [BT-H2] 대전: 로컬 예측 킬과 원격 사망 이벤트 이중 처리 -- ✅ 수정됨
- **파일**: `wr-battle.js:683-691`
- **문제**: 공격자 로컬에서 `_battleOnKill(target)`로 `isDead = true` 설정 후, 피해자의 `isDeath` 이벤트가 다시 처리되어 deaths 증가 + 폭발 파티클 이중 생성
- **수정 내용**: `_rtOnRemoteHit` death 처리에서 이미 `rp.isDead`인 경우 `return`으로 중복 방지
- **커밋**: 3차 수정

### [BT-H3] 대전: `_rtOnRemoteGimmick`에서 배틀모드 처리 후 `return`으로 다른 기믹 차단
- **파일**: `wr-realtime.js:1109-1112`
- **문제**: `data.battleMode !== undefined`일 때 `return`하여 같은 payload의 다른 기믹 데이터가 무시됨
- **영향**: 현재는 잠재적 위험, 향후 확장 시 버그
- **수정**: 배틀모드 전환을 별도 이벤트로 분리하거나, return 대신 조건부 처리 후 계속

### [BT-H4] 대전: 스페이스바 점프만 차단, W/화살표 위 점프는 가능
- **파일**: `waiting-room.js:275-281`
- **문제**: 배틀 모드에서 스페이스바는 사격으로 전환되지만, `ArrowUp`/`w`/`W`로는 여전히 점프 가능
- **영향**: UX 혼란 (일부 키로 점프 불가, 다른 키로는 가능)
- **수정**: 의도적이라면 HUD에 안내 표시, 아니라면 모든 점프 키 통일

### [BT-H5] 대전: 팀 미배정 시 리스폰 위치 항상 오른쪽 편향
- **파일**: `wr-battle.js:517, 221-223`
- **문제**: `player.team === 'left'`인지 확인하지만, `team`이 `null`이면 항상 `this.W - 200`으로 고정
- **영향**: 팀 미배정 플레이어가 항상 오른쪽에 리스폰
- **수정**: team이 null일 때 랜덤 또는 중앙 스폰

### [CM-H1] 공통: 스테이지 전환 시 원격 플레이어 `enteredDoor` 미리셋
- **파일**: `game.js:611-616`
- **문제**: NPC는 `enteredDoor = false`로 리셋하지만, 원격 플레이어는 이전 값이 유지되어 새 스테이지에서 이미 문에 들어간 것으로 판정 가능
- **영향**: 멀티플레이어 스테이지 전환 후 즉시 클리어 판정 또는 원격 플레이어 미표시
- **수정**: 스테이지 전환 시 원격 플레이어의 `enteredDoor`, `completedAll` 명시적 리셋

---

## 3. MEDIUM - 기능 오동작 또는 시각적 결함

### [SC-M1] 축구: 태풍 진행률 바 분모 불일치 (480 vs 600)
- **파일**: `wr-render.js:292` vs `wr-gimmicks.js:534`
- **문제**: 렌더링은 `obs.timer/480`으로 계산하지만 실제 타이머는 `timer:600`
- **영향**: 진행률 바가 처음에 100%를 넘어서 표시
- **수정**: `obs.timer/600`으로 수정하거나 `obs.maxTimer` 저장

### [SC-M2] 축구: 비호스트 무궁화 `chars` 문자열 공백 포함 불일치 -- ✅ 수정됨
- **파일**: `wr-realtime.js:1218`
- **문제**: 호스트는 10자 배열, 비호스트는 공백 포함 11자 `split('')`
- **수정 내용**: 비호스트에서도 동일한 `['무','궁','화','꽃','이','피','었','습','니','다']` 배열 사용
- **커밋**: 4차 수정

### [SC-M3] 축구: 비호스트 무궁화 `charInterval` 불일치 (18 vs 15) -- ✅ 수정됨
- **파일**: `wr-realtime.js:1220`
- **문제**: 호스트 `charInterval: 18`, 비호스트 `charInterval: 15`
- **수정 내용**: 비호스트도 `charInterval: 18`로 통일, `greenDuration`도 `chars.length * charInterval`로 계산
- **커밋**: 4차 수정

### [SC-M4] 축구: 비호스트 무궁화 `eyeY` 값 불일치 (H/2-40 vs 120) -- ✅ 수정됨
- **파일**: `wr-realtime.js:1217`
- **문제**: 호스트 `eyeY: this.H/2 - 40`, 비호스트 `eyeY: 120`
- **수정 내용**: `eyeY: this.H / 2 - 40`으로 통일
- **커밋**: 4차 수정

### [SC-M5] 축구: 중력 역전 시 바운시존 체크 누락
- **파일**: `wr-ball.js:30`
- **문제**: 정상 중력에서는 바운시존을 체크하지만, `gravityReversed`에서는 체크하지 않음
- **영향**: 중력 역전 시 바운시존이 바닥에서 미작동
- **수정**: 중력 역전 시에도 바운시존 체크 추가

### [SC-M6] 축구: `_gimmickTargets()` 반환값 null 체크 누락 (신규)
- **파일**: `wr-gimmicks.js:128, 261, 287, 302, 330, 467`
- **문제**: `this._gimmickTargets()` 호출 후 `.forEach()`를 바로 실행하는데, 반환값이 null/undefined일 경우 크래시
- **영향**: `_gimmickTargets` 구현이 예외를 던지거나 null을 반환하면 기믹 업데이트 전체 중단
- **수정**: `const all = this._gimmickTargets() || [];` 패턴 사용

### [BT-M1] 대전: 비소유자 폭탄 폭발 시각 효과 누락
- **파일**: `wr-battle.js:327-339`
- **문제**: 플랫폼 충돌 시 `if (p.isOwner) this._battleExplodeBomb(p);`로 소유자만 폭발 이펙트 생성
- **영향**: 원격 플레이어 화면에서 폭탄이 이펙트 없이 사라짐
- **수정**: 비소유자에도 `_battleSpawnExplosionParticles()`만 호출

### [BT-M2] 대전: 파티클 렌더링에 뷰포트 컬링 누락
- **파일**: `wr-battle.js:843-857`
- **문제**: 투사체는 뷰포트 밖 체크하지만, 파티클은 모든 것을 그림
- **영향**: 화면 밖 파티클에 불필요한 드로우콜
- **수정**: 파티클에도 범위 체크 추가

### [BT-M3] 대전: 무적 상태 시각 효과가 전체 화면 덮음
- **파일**: `wr-battle.js:929-934`
- **문제**: `ctx.fillRect(0, 0, VW, VH)`로 전체 화면 반투명 파란색 오버레이. HUD/미니맵도 덮힘
- **영향**: 무적 시 UI 가독성 저하
- **수정**: 플레이어 주변 glow 효과로 대체하거나 UI 렌더링 전에 오버레이

### [BT-M4] 대전: 킬피드 배열 크기 무제한
- **파일**: `wr-battle.js:898, 207-209`
- **문제**: 렌더링은 최대 5개만 표시하지만 배열 자체는 타이머 만료까지 무제한
- **영향**: 대량 동시 킬 시 일시적 메모리 증가
- **수정**: 킬피드 추가 시 최대 10~15개 제한

### [BT-M5] 대전: `_battleStop()`에서 HP를 0으로 설정
- **파일**: `wr-battle.js:163`
- **문제**: `this._battleHP = 0` → 배틀 모드 종료 직후 HP 바가 0%로 잠깐 표시
- **영향**: 시각적 결함 (잠깐)
- **수정**: `this._battleHP = MAX_HP`로 설정

### [BT-M6] 대전: 킬피드에서 킬러 정보 누락 시 항상 자폭으로 표시
- **파일**: `wr-battle.js:494`
- **문제**: `!killerSid`가 true이면 자폭 분류 (빈 문자열 포함)
- **영향**: 킬러 미확인 사망이 모두 자폭으로 표시
- **수정**: '알 수 없는 사망' 분류 추가

### [CM-M1] 공통: 공 플랫폼 충돌 `dist=0` 시 법선 벡터 기본값 문제
- **파일**: `wr-ball.js:65`
- **문제**: 정확히 겹치면 `dist=0` → `nx=0, ny=-1` 고정. 옆 충돌도 위로 밀림
- **영향**: 플랫폼 모서리에서 공이 비정상 방향으로 튕김
- **수정**: 이전 프레임 위치 기반 법선 벡터 결정

### [CM-M2] 공통: `sizeChange` 기믹에서 관람석 전환 중 `originalPlayerSize` null 가능
- **파일**: `wr-gimmicks.js:116-119`
- **문제**: 관람석 진입/퇴장 도중 타이밍에 따라 `originalPlayerSize`가 nil
- **영향**: 관람석 전환 중 `sizeChange` 활성 시 크래시 가능
- **수정**: null 체크 추가

### [CM-M3] 공통: `window.onkeydown` 직접 덮어쓰기로 다른 리스너 제거
- **파일**: `game.js:415-422`
- **문제**: `on` 프로퍼티 사용으로 다른 모듈의 keydown 리스너 덮어쓰기
- **영향**: 게임 외부 keydown 리스너 무시
- **수정**: `addEventListener/removeEventListener` 패턴 전환

### [CM-M4] 공통: 스테이지 전환 setTimeout에서 `this.npcs` null 체크 누락 -- ✅ 수정됨
- **파일**: `game.js:642, 657`
- **문제**: `this.npcs.forEach(n=>{...})`를 null 체크 없이 호출
- **수정 내용**: `(this.npcs || []).forEach(...)` 패턴 적용 (2곳)
- **커밋**: 4차 수정

### [CM-M5] 공통: `presenceState()` 반환값 null 체크 누락 -- ✅ 수정됨
- **파일**: `wr-realtime.js:672, 836`
- **문제**: `presenceState()` 결과를 바로 `Object.entries()`에 전달. 채널 끊김 시 null 가능
- **수정 내용**: `if (!state) return;` 가드 추가 (2곳: `_rtOnPresenceSync`, `_rtElectHost`)
- **커밋**: 4차 수정

---

## 4. LOW - 코드 품질 및 최적화 기회

### [SC-L1] 축구: 파티클 배열 무제한 성장
- **파일**: 여러 파일 (`wr-ball.js`, `wr-gimmicks.js`)
- **문제**: `push()` 시 상한 체크 없음. 운석+태풍+지진 동시 시 수백 개
- **수정**: `MAX_PARTICLES` (300) 제한

### [SC-L2] 축구: `renderObstacles`에서 매 프레임 gradient 생성
- **파일**: `wr-render.js:20, 218-220`
- **수정**: 캐시하거나 단색 대체

### [SC-L3] 축구: `sort(()=>Math.random()-.5)` 비균일 셔플
- **파일**: `wr-gimmicks.js:414, 496`
- **수정**: Fisher-Yates 셔플 사용 (`_shuffleDeck` 참조)

### [SC-L4] 축구: `chatBubbles`에 `measureText` 매 프레임 호출
- **파일**: `wr-render.js:715`
- **수정**: 버블 생성 시 width 미리 계산

### [BT-L1] 대전: `_battleExplodeBomb`에서 매번 새 배열 생성
- **파일**: `wr-battle.js:412`
- **문제**: `[...remotes, selfEntity]` 매 폭발마다 spread
- **수정**: self를 별도 처리하거나 재사용 배열

### [BT-L2] 대전: 투사체마다 `ctx.save()/restore()` + `shadowBlur`
- **파일**: `wr-battle.js:817-839`
- **문제**: shadowBlur는 Canvas 2D에서 고비용 연산
- **수정**: 같은 타입 배치 처리, save/restore 최소화

### [BT-L3] 대전: `roundRect` 브라우저 호환성
- **파일**: `wr-battle.js:881`
- **문제**: Safari 15 이하, 구버전 모바일 미지원
- **수정**: polyfill 또는 `fillRect` fallback

### [BT-L4] 대전: `MAX_HP`/`INVINCIBLE_TIME` 매직 넘버 중복
- **파일**: `wr-realtime.js:762, 766` vs `wr-battle.js` 상수
- **수정**: 상수 export 공유

### [BT-L5] 대전: 폭탄 퓨즈 스파크 `Math.random()` 매 프레임
- **파일**: `wr-battle.js:836`
- **수정**: frameCount 기반 사인파 또는 현 상태 유지

### [CM-L1] 공통: `_rtGetRemoteArray()` 매 프레임 다중 호출
- **파일**: 여러 곳 (`wr-ball.js:83`, `wr-battle.js:296`)
- **수정**: 프레임당 1회 호출 후 캐시 참조 (현재 dirty 캐시가 있으나 다중 호출 구간 존재)

### [CM-L2] 공통: `[this.player, ...(this.npcs||[])]` 패턴 반복
- **파일**: `game-physics.js`, `game-mechanics.js`, `game-ai.js`
- **수정**: `update()` 시작 시 한 번 생성, 참조 공유

### [CM-L3] 공통: `_specDebugLog`가 `window` 전역 노출
- **파일**: `wr-realtime.js:28`
- **수정**: 프로덕션에서 제거 또는 `import.meta.env` 분기

### [CM-L4] 공통: 피코파크 AI 더블 점프 확률 매우 낮음 (5%)
- **파일**: `game-ai.js:311, 333`
- **수정**: 목표 높이 차이에 비례하여 확률 조정

---

## 5. INFO - 참고 사항

### [SC-I1] 축구: 호스트-비호스트 공 물리 이중 실행 (의도적 설계)
- 호스트는 `updateBall()`, 비호스트는 `_rtPredictBall()` + `checkBallEntityCollision()` 실행
- 반응성을 위한 의도적 설계이지만, 호스트/비호스트 간 공 위치 불일치 유발

### [SC-I2] 축구: 골 판정에 swept collision 적용 (잘 구현됨)
- `wr-ball.js:39-53`에서 이전/현재 위치 모두 검사하여 터널링 방지

### [SC-I3] 축구: `ball.r = 45`로 캐릭터(26x30) 대비 큼
- 좁은 플랫폼 사이에서 공이 끼일 가능성

### [BT-I1] 대전: 배틀 모드는 교사(77777) 전용 토글 (의도적 설계)
- `waiting-room.js:815` - `Player.studentId !== '77777'`이면 return

### [BT-I2] 대전: 히트 검증이 클라이언트 사이드 (서버리스 한계)
- Supabase Broadcast 특성상 서버 검증 불가. `MAX_DAMAGE`/`MAX_KNOCK` 클램핑으로 최소 치트 방지

### [BT-I3] 대전: 오브젝트 풀링 + swap-and-pop 패턴 적용 (잘 구현됨)
- 투사체(80), 파티클(150) 풀링으로 GC 부담 경감

### [BT-I4] 대전: Liang-Barsky 알고리즘으로 안티 터널링 (잘 구현됨)
- `wr-battle.js:382-402` - 빠른 투사체의 히트박스 통과 방지

### [BT-I5] 대전: 배틀 모드 전환 시 기믹/공 상태 완전 정리됨
- `wr-battle.js:122-129` - ball, wind, gravity, controls 등 모두 정리

### [CM-I1] 공통: `closeOverlay()` 루프에서 PerfMonitor 호출 누락
- `waiting-room.js:644` - 오버레이 열었다 닫으면 성능 모니터 미작동 (디버깅 전용)

### [CM-I2] 공통: 피코파크 원격 플레이어는 로컬 물리 스킵 (의도적 설계)
- `game-physics.js:10` - 네트워크에서 위치 수신

### [CM-I3] 공통: `ghostPlatforms` 비호스트 동기화 불완전
- 유령 플랫폼 목록과 `_hiddenPlatforms`가 비호스트에서 동기화되지 않음

---

## 수정 이력

### 2026-03-06 (4차 수정)
7개 추가 이슈 수정 (High 2 + Medium 5):
- **[SC-H3]** `_ballTouchers` 필터 60→180프레임 확대 (`wr-ball.js`)
- **[BT-H1]** 폭탄 자폭 시 `_rtBroadcastHit` 추가 (`wr-battle.js`)
- **[SC-M2]** 비호스트 무궁화 chars 배열 통일 (`wr-realtime.js`)
- **[SC-M3]** 비호스트 무궁화 charInterval 18로 통일 (`wr-realtime.js`)
- **[SC-M4]** 비호스트 무궁화 eyeY를 H/2-40으로 통일 (`wr-realtime.js`)
- **[CM-M4]** `npcs.forEach` → `(this.npcs || []).forEach` (`game.js`)
- **[CM-M5]** `presenceState()` null 체크 추가 (`wr-realtime.js`)

### 2026-03-06 (3차 수정)
5개 추가 이슈 수정:
- **[SC-C3]** `redLightGreenLight` 스폰 시 player null 체크 (`wr-gimmicks.js`)
- **[BT-C4]** `_battleOnKill`/`_battleCheckPickup` chatBubbles null 체크 (`wr-battle.js`)
- **[BT-H2]** 이중 킬/사망 카운트 방지 - isDead 중복 체크 (`wr-battle.js`)
- **[SC-H1]** 비호스트 골 보상 동기화 - 호스트 touchers 브로드캐스트 (`wr-realtime.js`)
- **[SC-H4]** `screenFlip`/`sizeChange` 기믹 덱에 추가 (`wr-gimmicks.js`)

### 2026-03-06 (커밋 `6489de2`)
7개 Critical 이슈 수정 완료:
- **[BT-C1]** 퇴장 시 투사체 풀 인덱스 반환 (`wr-realtime.js`)
- **[BT-C2]** `_battleStop()`에서 풀 free 배열 초기화 (`wr-battle.js`)
- **[BT-C3]** `_battleRespawn()` chatBubbles null 체크 (`wr-battle.js`)
- **[SC-C1]** `sizeChange` 기믹 player null 체크 - 스폰 및 업데이트 루프 (`wr-gimmicks.js`)
- **[SC-C2]** `redLightGreenLight` player null 체크 - phase 전환 및 red phase (`wr-gimmicks.js`)
- **[CM-C1]** `_flushComposing` 배열 할당 분리 (`game-keyboard.js`)
- **[CM-C2]** `_onPlayerLeave` entities → player 교체 (`game.js`)

---

## 우선 수정 권장 순서

### ~~즉시 수정 (게임 크래시 방지)~~ ✅ 전부 수정 완료
- ~~[SC-C3] redLightGreenLight 스폰 시 player null 체크~~
- ~~[BT-C4] _battleOnKill/_battleCheckPickup chatBubbles null 체크~~

### ~~빠른 시일 내 수정 (게임 품질)~~ ✅ 전부 수정 완료
- ~~[SC-H3] _ballTouchers 필터 시간 확대~~
- ~~[SC-M2~M4] 비호스트 무궁화 상수 통일~~
- ~~[CM-M4] npcs.forEach null 체크 추가~~
- ~~[CM-M5] presenceState() null 체크 추가~~
- ~~[BT-H1] 폭탄 자폭 시 _rtBroadcastHit 전송~~

### 여유 있을 때 수정 (개선)
6. 나머지 High/Medium 이슈들
7. Low 최적화 이슈들

---

*본 보고서는 정적 코드 분석 기반입니다. 실제 런타임 테스트로 추가 검증을 권장합니다.*
