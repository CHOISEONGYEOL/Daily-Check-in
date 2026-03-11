# 피코파크 단체 협동 게임 기술 보고서

## 1. 개요

| 항목 | 내용 |
|------|------|
| 게임 ID | `picopark` |
| 게임 이름 | 피코파크 |
| 장르 | 30인 협동 플랫포머/퍼즐 |
| 제한 시간 | 5분 (300초) |
| 스테이지 수 | 3개 |
| 클리어 보상 | 50 코인 (최초 클리어 시) |
| 연속 출석 보너스 | 3일 이상 +10, 7일 이상 +20 |
| 최대 동시 접속 | 30명+ (인원 제한 없음) |

---

## 2. 파일 구조

| 파일 | 역할 |
|------|------|
| `src/game.js` | 게임 코어 (초기화, 루프, 입력, 진행, 종료, 네트워킹) |
| `src/game-stages.js` | 스테이지 정의 + 인원 스케일링 + NPC 생성 |
| `src/game-mechanics.js` | 협동 장치 (블록, 발판, 엘리베이터, 열쇠, 문, 장애물) |
| `src/game-physics.js` | 물리 엔진 (중력, 충돌, 스태킹) |
| `src/game-ai.js` | NPC AI (작업 분배, 이동, 채팅) |
| `src/game-render.js` | 캔버스 렌더링 (HUD, 미니맵, 파티클) |
| `src/game-spectator.js` | 교사 관전 모드 |
| `src/constants.js` | 블롭 색상(20가지), NPC 채팅 상수 |
| `src/vote.js` | 게임 선택 투표 시스템 |

모든 모듈은 `game.js:945`에서 `Object.assign(Game, GameStages, GameAI, GamePhysics, GameMechanics, GameRender, GameSpectator)`로 Game 객체에 병합된다.

---

## 3. 물리 엔진

**파일: `src/game-physics.js`**

### 3.1 기본 상수 (`game.js:86`)

| 상수 | 값 | 설명 |
|------|----|------|
| `GRAVITY` | 0.5 | 프레임당 중력 가속도 |
| `JUMP_FORCE` | -10 | 점프 시 수직 속도 |
| `MOVE_SPD` | 3.2 | 플레이어 이동 속도 |
| 최대 낙하 속도 | 14 | `e.vy > 14`일 때 클램핑 |
| 더블 점프 | `maxJumps: 2` | 공중에서 1회 추가 점프 가능 |

### 3.2 물리 적용 흐름 (`applyPhysics`, 2~47행)

1. 원격 플레이어(`isRemote`)는 물리 스킵 (10행)
2. 문에 들어간 엔티티, 사망 엔티티(유령 모드 아닐 때)는 스킵
3. 중력 적용: `e.vy += GRAVITY`
4. 위치 갱신: `e.x += e.vx`, `e.y += e.vy`
5. 월드 경계 제한: `e.x`를 `[e.w/2, W - e.w/2]` 범위로 클램핑
6. 바닥 추락 판정: `e.y > H + 50`이면 `killEntity(e)` 호출
7. 플랫폼 충돌 검사 (`checkPlatforms`)
8. 브릿지 충돌 검사 (visible인 것만)
9. 엘리베이터 충돌 검사

### 3.3 플랫폼 충돌 (`checkPlatforms`, 50~80행)

- **벽(`type: 'wall'`)**: 수평 충돌 처리. 좌/우 중 겹침이 작은 방향으로 밀어냄. `e.vx = 0`
- **일반 플랫폼**: 상단 충돌만 처리. 아래로 내려오면서 플랫폼 상단에 닿으면 착지
  - 조건: `e.vy >= 0` (하강 중) + AABB 겹침 + `e.y+e.h` 범위 확인
  - 착지 시: `e.y = p.y - e.h`, `e.vy = 0`, `onGround = true`, `jumpCount = 0`

### 3.4 엔티티 간 충돌 - 스태킹 (`resolveEntityCollisions`, 82~133행)

피코파크의 핵심 메카닉. 플레이어끼리 머리 위에 올라탈 수 있다. 30명 밀집 최적화 적용.

**반복 상한 (무한 루프 방지):**
- 최대 2패스(`MAX_PASSES = 2`)만 실행
- 패스 중 수직 충돌 해소가 0건이면 즉시 탈출 (`if(resolved === 0) break`)
- 30명 기준 최악: `2 x 30 x 29 / 2 = 870`번 비교로 제한

**수직 충돌 (스태킹):**
- `overlapY < overlapX`이면 수직 충돌로 판정
- 위의 엔티티가 `vy >= 0`(하강 중)이면 단순 Y 고정: `a.y = b.y - a.h`
- `vy = 0`, `onGround = true`, `jumpCount = 0`으로 안정 안착
- `resolved++`로 해소 카운트 증가

**수평 충돌 (밀집 대응):**
- `overlapX <= 4px`: **완전 무시** (겹침 허용, 튕김 방지)
- `overlapX > 4px`: 초과분만 25%씩 부드럽게 밀어냄
  - `push = (overlapX - 4) * 0.25`
  - 속도 감속도 `0.7`로 완화 (기존 `0.3`에서 상향)

---

## 4. 협동 장치 (Game Mechanics)

**파일: `src/game-mechanics.js`**

### 4.1 푸시 블록 (`updatePushBlocks`, 3~31행)

| 속성 | 설명 |
|------|------|
| `required` | 필요한 미는 인원 수 (인원 스케일링 적용) |
| `pushers` | 현재 블록을 밀고 있는 엔티티 Set |
| `pushed` | 맵 밖으로 완전히 밀려났는지 여부 |
| `pushing` | 현재 밀리고 있는 중인지 |

**동작 흐름:**
1. 매 프레임 `pushers.clear()` 후 재계산
2. 터치 판정 (30명 밀집 대응 확장):
   - 좌측 범위: `block.x - pushZone` (`pushZone = max(40, required * 8)`)
     - 예: required=12 -> 96px 범위
   - 우측 범위: `block.x + 15`
   - 수직 범위: `block.y - 10` ~ `block.y + block.h + 10` (상하 10px 여유)
   - 추가 조건: `e.vx > 0` (오른쪽으로 이동 중)
3. `pushers.size >= required`이면:
   - `block.x += 1.5` (오른쪽으로 이동)
   - `block.x > W + 50`이면 `block.pushed = true` (완료)
   - 30% 확률로 황금색 파티클 생성
4. 미달이면 `pushing = false`

### 4.2 발판/압력판 (`updatePlates`, 34~67행)

| 속성 | 설명 |
|------|------|
| `linkedId` | 연결된 브릿지/엘리베이터의 ID |
| `active` | 현재 누군가 밟고 있는지 |
| `stepCount` | 현재 밟고 있는 엔티티 수 |

**동작 흐름:**
1. 매 프레임 `stepCount = 0` 초기화
2. **발판 판정 여유 (30명 밀집 대응):**
   - 좌우 마진 20px 추가: `plate.x - 20` ~ `plate.x + plate.w + 20`
   - 수직 거리 12px 이내 (기존 8px에서 확장)
   - `onGround` 상태 필수
3. `stepCount > 0`이면 `active = true`
4. 연결된 브릿지의 `visible`을 `plate.active`로 설정
5. 활성화 전환 시 초록색 파티클 6개 생성

### 4.3 엘리베이터 (`updateElevators`, 70~108행)

| 속성 | 설명 |
|------|------|
| `required` | 필요한 탑승 인원 수 (인원 스케일링 적용) |
| `riders` | 현재 탑승 인원 |
| `minY` | 최상단 위치 |
| `maxY` | 최하단 위치 (시작 위치) |
| `dir` | 이동 방향 (-1=상승, 0=정지) |
| `w` | 폭 (required에 비례하여 동적 확장) |

**탑승 판정 (밀집 대응):**
- 좌우 마진 15px 추가: `elev.x - 15` ~ `elev.x + elev.w + 15`
- 수직 거리 10px 이내 (기존 6px에서 확장)
- `onGround` 상태 필수

**동작 흐름:**
1. 매 프레임 탑승자 수 계산
2. 연결된 발판(`elev1`, `elev2` 등 linkedId)이 활성화되었는지 확인
3. `riders >= required` 또는 연결 발판이 활성이면:
   - `dir = -1` (상승)
   - `y += dir * 1.5` (프레임당 1.5px 상승)
   - `y <= minY`이면 정지
4. 조건 미달이면:
   - `y += 0.5`로 천천히 하강
   - `y > maxY`이면 `maxY`에 고정

### 4.4 열쇠 & 문 (`updateKeyDoor`, 112~201행)

**열쇠 수집 조건:**
1. AABB 충돌로 엔티티가 열쇠에 닿았는지 확인
2. `isKeyUnlocked(key)` 호출로 게이트 조건 확인:
   - `gateType: null` -> 항상 수집 가능 (스태킹으로 접근)
   - `gateType: 'plate'` -> 연결된 발판이 `active`인지
   - `gateType: 'elevator'` -> 해당 엘리베이터가 `y <= minY + 5`인지
   - `gateType: 'pushBlock'` -> 해당 블록이 `pushed === true`인지
3. 게이트 잠김 시: "협동 장치를 먼저 작동시켜야 열쇠를 얻을 수 있어요!" 메시지 (120프레임 쿨다운)
4. 수집 시: 금색 파티클 15개 생성 + "X/Y 열쇠 획득!" 메시지
5. 전부 수집 시: `door.open = true` + "열쇠 전부 획득! 전원 문으로!" 메시지

**잠긴 문 피드백 (163~183행):**
- 잠긴 문에 접근하면 엔티티를 `vx = +/-2`로 밀어냄
- "열쇠 X개를 더 모아야 합니다!" 메시지 (120프레임 쿨다운)

**열린 문 진입 (186~201행):**
- 열린 문 범위에 들어오면: `e.enteredDoor = true`, `e.vx = 0, e.vy = 0`
- 초록색 파티클 6개 생성
- `playersAtDoor` 카운터 증가

### 4.5 장애물 (`updateHazards`, 302~315행)

- **가시(spike)**: 삼각형 패턴, 접촉 시 `killEntity(e)` 호출
- **용암(lava)**: 주황색 + 기포 애니메이션, 접촉 시 `killEntity(e)` 호출
- 판정: AABB + 수직 5px 여유

### 4.6 사망 & 부활 (`killEntity`, `respawnEntity`, 317~335행)

**사망:**
- `e.dead = true`, `e.ghostTimer = 60` (1초 후 부활)
- 빨간색 파티클 8개 생성

**부활:**
- `e.dead = false`
- 스테이지 스폰 지점 근처 랜덤 위치로 이동 (`spawnX +/- 50`, `spawnY - 30`)
- 파란색 파티클 6개 생성

---

## 5. 스테이지 설계

**파일: `src/game-stages.js`**

### 5.1 Stage 1: "열쇠를 모아라!" (9~66행)

| 속성 | 값 |
|------|----|
| 월드 크기 | 1600 x 600 |
| 스폰 위치 | (100, 500) |
| 기본 열쇠 수 | 2개 |
| 플랫폼 수 | 16개 |

**열쇠 배치:**
- Key 1 (680, 230): `gateType: 'plate'`, `gateId: 'bridge1'` -> 발판을 밟아 브릿지를 활성화해야 접근 가능
- Key 2 (1220, 100): `gateType: 'elevator'`, `gateId: 0` -> 엘리베이터를 타고 올라가야 접근 가능

**협동 장치:**
- 발판 1개: (360, 556), linkedId `bridge1`
- 브릿지 1개: (230, 260), 120px 폭, linkedId `bridge1`
- 엘리베이터 1개: (1110, 440->130), 기본 required 4명, 폭 70px (동적 확장 대상)

**장애물:**
- 용암 1개: (450, 556), 110px 폭
- 가시 3개: (860, 556) 110px, (750, 556) 60px, (1250, 556) 50px

**문:** (1450, 440), 40x60

### 5.2 Stage 2: "분업과 협동!" (67~136행)

| 속성 | 값 |
|------|----|
| 월드 크기 | 2000 x 600 |
| 스폰 위치 | (80, 500) |
| 기본 열쇠 수 | 4개 |
| 플랫폼 수 | 18개 |

**열쇠 배치:**
- Key 1 (592, 280): `gateType: null` -> 게이트 없음. 스태킹(쌓기)으로만 접근 가능
- Key 2 (800, 360): `gateType: 'pushBlock'`, `gateId: 0` -> 블록을 밀어야 접근 가능
- Key 3 (1200, 180): `gateType: 'plate'`, `gateId: 'bridge2a'` -> 발판을 밟아야 접근 가능
- Key 4 (1720, 60): `gateType: 'elevator'`, `gateId: 0` -> 엘리베이터를 타야 접근 가능

**협동 장치:**
- 발판 3개: (900, 556) `bridge2a`, (1100, 556) `bridge2b`, (1450, 556) `elev1`
- 브릿지 2개: (990, 300) 70px `bridge2a`, (1110, 210) 55px `bridge2b`
- 푸시 블록 1개: (350, 536), 50x34, 기본 required 6명
- 엘리베이터 1개: (1540, 450->170), 기본 required 4명, 폭 65px (동적 확장 대상)

**특수 구조 - 스태킹 우물 (83~86행):**
- 바닥: (525, 570) 170px wood
- 좌벽: (525, 80) 12x490 wall
- 우벽: (683, 80) 12x490 wall
- Key 1이 우물 내부 상단에 위치 -> 벽에 막혀 플레이어가 서로 위에 올라타야만 도달 가능

**장애물:** 용암 2개 + 가시 3개

**문:** (1850, 440), 40x60

### 5.3 Stage 3: "최종 관문!" (137~225행)

| 속성 | 값 |
|------|----|
| 월드 크기 | 2400 x 700 |
| 스폰 위치 | (100, 600) |
| 기본 열쇠 수 | 4개 |
| 플랫폼 수 | 24개 |

**열쇠 배치:**
- Key 1 (500, 280): `gateType: 'plate'`, `gateId: 'bridge3a'`
- Key 2 (1100, 460): `gateType: 'pushBlock'`, `gateId: 0`
- Key 3 (1560, 130): `gateType: 'elevator'`, `gateId: 0`
- Key 4 (2060, 40): `gateType: 'elevator'`, `gateId: 1`

**4개 구역:**

| 구역 | 장치 | 핵심 메카닉 |
|------|------|-------------|
| Zone A | 발판 3개 + 브릿지 3개 | 3개 발판을 각각 다른 플레이어가 동시에 밟아 3단 브릿지 활성화 |
| Zone B | 푸시 블록 1개 (기본 required 10) + 벽 | 다수가 블록을 밀어 벽 너머로 진행 |
| Zone C | 엘리베이터 2개 (기본 required 6/4) + 발판 1개 | 순차적 엘리베이터 탑승 |
| Zone D | 5단 타워 | Key 4 최상단 (2060, 40)에서 하강하여 문으로 |

**장애물:** 용암 4개 + 가시 3개

**문:** (2260, 520), 40x60

---

## 6. 인원 기반 스케일링

**파일: `src/game-stages.js` (488~581행)**

### 6.1 열쇠 수 스케일링 (`getKeyCount`, 489~497행)

| 인원 | 열쇠 수 |
|------|---------|
| 1명 | 1 |
| 2~3명 | 1 |
| 4~5명 | 2 |
| 6~10명 | 3 |
| 11~15명 | 4 |
| 16~20명 | 5 |
| 21~25명 | 6 |
| 26~30명 | 7 |
| 31~35명 | 8 (최대) |

25명 초과 시: `Math.min(8, 6 + Math.floor((n - 25) / 5))`

### 6.2 협동 요구 인원 스케일링 (`getCoopRequired`, 499~502행)

```
1명 이하: 1
2~3명: 1
4명 이상: Math.max(2, Math.round(base * n / Math.max(n, 25)))
```

`Math.max(n, 25)` 분모를 사용하여 25명 초과 시에도 비율이 1을 넘지 않도록 보정.

예시 (Stage 3 푸시 블록, base=10):
- 5명: `Math.round(10 * 5 / 25)` = 2
- 15명: `Math.round(10 * 15 / 25)` = 6
- 25명: `Math.round(10 * 25 / 25)` = 10
- 30명: `Math.round(10 * 30 / 30)` = 10 (비율 1 초과 방지)

### 6.3 소규모 게이트 제거 (578~580행)

3명 이하일 때 모든 열쇠의 `gateType`과 `gateId`를 `null`로 설정하여 협동 장치 없이 바로 수집 가능하게 만든다.

### 6.4 엘리베이터 폭 동적 확장 (566~575행)

`loadStage`에서 required 스케일링 직후:
1. `needW = required * 20`으로 필요 폭 계산 (1인당 20px)
2. `needW > 원본 폭`이면:
   - `expand = needW - 원본 폭`
   - `e.x -= Math.floor(expand / 2)` (중심 유지하며 좌우 확장)
   - `e.w = needW`

예시:
- required=4, 원본 70px -> `4*20=80px` > 70 -> 80px로 확장
- required=6, 원본 65px -> `6*20=120px` > 65 -> 120px로 확장
- required=10, 원본 65px -> `10*20=200px` > 65 -> 200px로 확장

### 6.5 추가 열쇠 자동 배치 (538~559행)

스테이지에 정의된 기본 열쇠 수보다 인원 기반 필요 열쇠가 많을 경우:
1. 기존 열쇠 X 좌표와 겹치지 않는 magic/wood 플랫폼 후보 선정
2. 후보를 셔플 후 필요한 만큼 추가 열쇠 배치
3. 각 추가 열쇠에 `plate`, `elevator`, `pushBlock` 게이트를 순환 배정

---

## 7. NPC AI 시스템

**파일: `src/game-ai.js`**

### 7.1 AI 업데이트 루프 (`updateNPCs`, 4~111행)

매 프레임 모든 NPC에 대해:
1. `aiTimer++`, `chatTimer--`, `aiJumpCooldown--`
2. 원격 플레이어(`isRemote`)는 스킵 (21행)
3. 문에 들어간 NPC는 스킵
4. 사망 NPC: `ghostTimer--` -> 0이면 부활
5. 막힘 감지: 60프레임마다 위치 변화 < 5px이면 `stuckTimer++`
6. AI 의사결정 -> 목표(goal)와 목표 좌표(tx, ty) 설정
7. `_moveNPC(n, goal, tx, ty)` 호출
8. 채팅: `chatTimer <= 0`이면 목표별 대사 출력 후 쿨다운 300~900프레임

### 7.2 작업 목록 생성 (`_buildPicoJobs`, 117~184행)

**문 열림 또는 열쇠 전부 수집 시:**
- `[{type:'door', weight:1}]` 반환

**일반 상황 - 수집되지 않은 각 열쇠에 대해:**

| 게이트 상태 | 생성되는 작업 | 가중치 |
|-------------|--------------|--------|
| 게이트 없음 (`gateType: null`) | `stack` | 8 |
| 게이트 해제됨 | `collectKey` | 4 |
| 게이트 해제됨 + plate 연결 | `plate` (유지용) | 3 |
| 게이트 해제됨 + elevator 연결 | `elevator` (유지용) | `max(required, 3)` |
| 게이트 잠김 + plate | `plate` (활성화용) | 5 |
| 게이트 잠김 + elevator | `elevator` (탑승용) | `required + 3` |
| 게이트 잠김 + pushBlock | `push` (밀기용) | `required + 3` |
| 게이트 잠김 (공통) | `collectKey` (대기용) | 1 |

추가로 열쇠 게이트에 직접 연결되지 않은 발판도 `plate` 작업(가중치 2)으로 추가.

### 7.3 작업 배정 (`_assignPicoJob`, 189~260행)

가중치 기반 누적 분배:
- `ratio = idx / npcs.length` (NPC 인덱스 비율)
- 작업 가중치를 정규화하여 누적합 계산
- `ratio < cum`인 첫 번째 작업에 배정

**작업별 목표 좌표:**

| 작업 | tx | ty |
|------|----|----|
| `plate` | 발판 중심 X | 발판 Y - 10 |
| `elevator` | 엘리베이터 중심 X | 엘리베이터 Y - 10 |
| `push` | 블록 X - 10 | 블록 Y |
| `collectKey` | 열쇠 중심 X | 열쇠 Y |
| `stack` (base 60%) | 열쇠 X + 오프셋 | 열쇠 Y + 60 |
| `stack` (top 40%) | 열쇠 중심 X | 열쇠 Y |
| `door` | 문 중심 X | 문 Y |
| `wander` | 현재 X +/- 50 | 현재 Y |

### 7.4 NPC 이동 처리 (`_moveNPC`, 265~346행)

| 목표 | 이동 방식 |
|------|-----------|
| `stack_base` | 열쇠 아래 10px 이내면 정지(`vx *= 0.3`), 그 외 `vx = 1.2` 접근 |
| `push` | 60px 밖: `vx = 2.0`으로 접근. 60px 이내: `vx = 1.8`로 지속 밀기 |
| `plate` / `elevator` | 15px 밖: `vx = 1.5~2.0`으로 접근 + 점프. 15px 이내: 정지 |
| 일반 (key, door 등) | 20px 밖: `vx = 1.5~2.3`으로 접근 + 점프. 20px 이내: 감속 |

**점프 로직:**
- 조건: 목표가 30px 이상 위에 있거나 `stuckTimer > 2`
- 점프력: `JUMP_FORCE * 0.85~1.15` (랜덤)
- 쿨다운: 30~60프레임
- 더블 점프: 공중에서 `jumpCount === 1` + 목표가 60px 이상 위 + 5% 확률

### 7.5 맥락 기반 채팅 (`getContextChat`, 349~364행)

| 목표 | 대사 |
|------|------|
| `key` | "열쇠 어딨지?", "열쇠 찾자!", "위로 가야해!", "거기다!", "올라가자!" |
| `stack_base` | "올라타!", "내 위로!", "쌓자!", "계단 만들자!", "여기 서있을게!" |
| `door` | "문으로 가자!", "빨리빨리!", "거의 다 왔어!", "이쪽이야!", "고고!" |
| `plate` | "여기 밟아!", "내가 밟을게!", "발판!", "누르고 있을게!", "올라타!" |
| `push` | "같이 밀자!", "밀어!", "으쌰!", "힘내!", "가즈아!" |
| `elevator` | "엘리베이터 타!", "같이 올라가자!", "위로!", "더 타야 해!", "여기 올라와!" |
| `wander` | "ㅋㅋ", "심심해~", "뭐하지", "여기야!", "안녕~" |

---

## 8. 플레이어 입력

**파일: `src/game.js` (413~449행)**

### 8.1 키보드 조작

| 키 | 동작 |
|----|------|
| `ArrowLeft`, `a`, `A` | 왼쪽 이동 (`vx = -3.2`) |
| `ArrowRight`, `d`, `D` | 오른쪽 이동 (`vx = 3.2`) |
| `Space`, `ArrowUp`, `w`, `W` | 점프 (`playerJump()`) |

- 아무 방향키도 안 누르면 `vx *= 0.75` 감속
- `|vx| < 0.15`이면 `vx = 0`

### 8.2 모바일 조작

HTML의 `.ctrl-btn` 요소에 `pointerdown`/`pointerup`/`pointerleave` 이벤트:
- `data-key="left"`: 왼쪽 이동
- `data-key="right"`: 오른쪽 이동
- `data-key="action"`: 점프

### 8.3 점프 처리 (`playerJump`, 441~449행)

- 사망 + 유령 모드 아님 -> 점프 불가
- `jumpCount < maxJumps(2)` -> `vy = -10`, `jumpCount++`, `onGround = false`

---

## 9. 멀티플레이어 네트워킹

**파일: `src/game.js` (752~805행)**

### 9.1 위치 브로드캐스트 (`_gameBroadcastPos`, 755~781행)

**고정 100ms(초당 10회) tick-rate 방식:**
- 조건: `_rtChannel` 존재 + 관전 모드 아님 + 더미 플레이어 아님
- 전송 주기: **100ms 고정 간격** (상태 변화 여부 무관)
- `now - _gameLastBroadcast < 100`이면 즉시 리턴
- 30명 동시 접속 시에도 각 클라이언트가 초당 10회만 전송하여 트래픽 안정

**전송 페이로드:**
```javascript
{
    sid: String(Player.studentId),
    x: Math.round(p.x),
    y: Math.round(p.y),
    vx: Math.round(p.vx * 10) / 10,
    vy: Math.round(p.vy * 10) / 10,
    dir: p.dir,             // 1 또는 -1
    onGround: p.onGround,
    dead: p.dead,
    enteredDoor: p.enteredDoor,  // 문 진입 동기화용
    currentCP: p.currentCP,
    completedAll: p.completedAll
}
```

### 9.2 원격 위치 수신 (`_onGameRemotePos`, 783~805행)

1. 자기 자신의 SID는 무시
2. `npcs` 배열에서 `isRemote && studentId === sid`인 엔티티 검색
3. 위치/속도/방향/상태 직접 덮어쓰기
4. **문 진입 동기화:** `data.enteredDoor === true`이고 로컬에서 아직 `false`일 때만 `entity.enteredDoor = true` + `vx/vy = 0`으로 강제 적용 (단방향 전환만 허용 -> stale 데이터 리셋 버그 방지)
5. `currentCP`, `completedAll` 동기화

### 9.3 플레이어 모드별 동작

| 모드 | 플레이어 | NPC | 인원 제한 |
|------|----------|-----|-----------|
| 솔로/테스트 | 로컬 1명 | AI NPC `totalStudents - 1`명 | 없음 |
| 멀티플레이어 | 로컬 1명 | 원격 플레이어만 (`isRemote: true`, AI 없음) | **없음 (30명+ 지원)** |
| 관전 (교사) | 더미 `(-1000, -1000)` | 원격 플레이어 전원 | 없음 |

### 9.4 멀티플레이어 진입 (`enterFromWaitingRoom`, 131~189행)

1. `isMultiplayer = true`
2. 대기실의 실시간 채널(`_rtChannel`)과 원격 플레이어 데이터 인계
3. `totalStudents = remoteCount + 1` (실제 접속 인원 기반, **인원 상한 없음**)
4. 1.8초 출석 이펙트 후 `startPicoPark()` 호출

### 9.5 플레이어 이탈 처리 (`_onPlayerLeave`, 807~830행)

1. "플레이어가 나갔습니다!" 경고 표시 (180프레임)
2. 남은 인원이 1명 이하이면 10초 후 `forceCleanup()` 자동 호출

---

## 10. 게임 진행 & 승리/패배

### 10.1 스테이지 완료 판정 (`checkStageComplete`, 610~668행)

**조건:** `door.open === true` + `playersAtDoor >= aliveCount` + `aliveCount > 0`

**다음 스테이지 이동:**
1. `stage++`
2. 3 미만이면:
   - 초록 파티클 20개 + "스테이지 클리어! 다음으로!" 메시지
   - 1.5초 후 `loadStage(stage)` 호출
   - 전체 엔티티 스폰 위치 리셋
3. 3 이상이면: `missionClear()` 호출

### 10.2 미션 클리어 (`missionClear`, 673~700행)

1. `completed = true`, 타이머 정지
2. `victoryTimer = 180` (3초 축하 애니메이션)
3. "전원 클리어! 축하합니다!" 메시지 (200프레임)
4. 문 위치에서 폭죽 파티클 50개 생성 (6색)

### 10.3 승리 보상 (`showVictoryReward`, 702~731행)

**관전 모드:** "학생들이 클리어했습니다!" -> 5초 후 `quit()`

**플레이어 모드:**
1. 최초 클리어 여부 확인 (`Player.clearedGames`)
2. 보상 계산:
   - 최초: 50코인 (bounty)
   - 재클리어: 0코인
   - 연속 출석 보너스: 3일+ -> +10, 7일+ -> +20
3. 최초 클리어 시 `Player.clearedGames`에 추가 + DB 저장
4. 코인 지급 + Confetti 애니메이션

### 10.4 시간 초과 (`endGame`, 733~750행)

- "시간 초과!" 오버레이
- "아쉽다! 내일은 꼭 성공하자! (출석은 완료!)"
- 코인 보상 없음, 출석은 유지

### 10.5 유령 모드 (`game.js:299~303행`)

- 잔여 시간 60초 이하에서 자동 활성화
- `ghostMode = true`
- 효과: 사망 엔티티도 발판/엘리베이터/블록 상호작용 가능
- 소프트락 방지 메카닉

---

## 11. 렌더링

**파일: `src/game-render.js`**

### 11.1 캔버스 설정

| 속성 | 값 |
|------|----|
| `gameZoom` | 1.6 (확대) |
| `VW` | `screenW / gameZoom` |
| `VH` | `screenH / gameZoom` |
| HiDPI 지원 | `devicePixelRatio` 최대 3배 |

### 11.2 렌더링 순서 (`render`, 83~647행)

1. **하늘 배경**: 선형 그라데이션 (`#0c0c24` -> `#1a1a3e` -> `#16213e`)
2. **줌 + 카메라 변환**: `ctx.scale(z, z)` -> `ctx.translate(-cam.x, -cam.y)`
3. **격자 패턴**: 40px 간격, 2% 불투명도 흰색 선
4. **플랫폼**: 타입별 (ground=녹색+잔디, wood=갈색, magic=보라+글로우, wall=회색, nature=청록)
5. **브릿지**: 반투명 초록(0.6) + 테두리 + 글로우
6. **엘리베이터**: 상태 색상(초록/회색) + `X/Y` 텍스트 + 레일
7. **푸시 블록**: 갈색(밀리는 중이면 황금색) + `X/Y` + 흔들림 효과
8. **발판**: 활성(초록, 6px) / 비활성(빨강, 10px) + 연결선(발판<->열쇠) + 힌트 텍스트
9. **장애물**: 가시(삼각형) / 용암(빨강+기포)
10. **열쇠**: 잠김(40% 불투명+자물쇠) / 해제(금색 글로우+반짝) / 게이트없는 열쇠("쌓아!" 힌트)
11. **문**: 열림(초록) / 잠김(회색) + 아이콘 + `X/Y` 인원 + 대기 텍스트
12. **엔티티** (Y축 정렬): 40x40 스프라이트, 방향 반전, 유령(40% 불투명), 플레이어(모자+닉네임)
13. **채팅 버블** (월드 공간): 검정 라운드 + 흰색 텍스트, 페이드아웃
14. **파티클** (월드 공간): 13가지 타입별 렌더링
15. **화면 공간**: 스테이지 공지, 이탈 알림, 승리 오버레이, 유령 모드 오버레이

### 11.3 미니맵 (`_renderMinimap`, 725~781행)

| 속성 | 값 |
|------|----|
| 크기 | 140 x 30px |
| 위치 | 화면 우상단 |

표시 요소: 플랫폼(흰색), 열쇠(금색/회색), 문(초록/회색), 뷰포트(흰색 테두리), 플레이어(황금 점), NPC(보라 점)

### 11.4 HUD

| 요소 | 내용 |
|------|------|
| 타이머 | `"M:SS / 5:00"` |
| 코인 | 현재 보유 코인 |
| 스테이지 | `"Stage X/3  열쇠 수집/총"` |
| 보상 | 미클리어: "현상금: 50코인" / 클리어 완료 |
| 유령 모드 | 모드명 뒤에 유령 아이콘 추가 |

### 11.5 진행률 바

```
totalProgress = (stage + stageProgress) / 3

stageProgress:
  문 열림 전: (수집한 열쇠 / 전체 열쇠) * 0.5
  문 열림 후: 0.5 + 0.5 * (문 진입 인원 / 전체 인원)
```

### 11.6 파티클 시스템

타입: sparkle, heart, fire, bubble, leaf, petal, snow, music, lightning, rainbow, aurora, pixel, ghost + 기본(사각형)

물리: `x += vx`, `y += vy`, 중력 `vy += 0.1` (fire는 0.03), 생명 감소, 불투명도 페이드아웃

---

## 12. 카메라 시스템

**파일: `src/game.js` (567~608행)**

### 12.1 일반 모드

- 플레이어 중심 추적: `targetX = player.x - VW/2`
- 문에 들어간 후: 문 중심으로 고정
- 부드러운 추적: `camera += (target - camera) * 0.08`
- 경계 클램핑: `[0, W - VW]` 범위

### 12.2 관전 모드 (교사)

**전지적 시점 (`free`):** 방향키/WASD로 자유 이동 (속도 6px/프레임)
**POV 모드:** 선택한 학생을 빠르게 추적 (`* 0.18` 보간), 문 진입 시 자동 복귀

---

## 13. NPC 생성

**파일: `src/game-stages.js` (610~657행)**

### 13.1 멀티플레이어 모드 (615~637행)

- `_remotePlayerData` Map에서 원격 플레이어 데이터 추출
- **인원 제한 없음** (30명+ 지원)
- 각 원격 플레이어:
  - `isRemote: true` -> AI 스킵, 물리 스킵
  - 대기실에서 가져온 스프라이트 사용
  - `chatTimer: 99999` -> 채팅 안 함
- **AI NPC 절대 없음** (실제 플레이어만)

### 13.2 솔로/테스트 모드 (640~656행)

- 관전 + 학생 0명: NPC 5명 (테스트용)
- 일반: `Math.max(0, totalStudents - 1)`명 (**상한 없음**)
- 각 NPC:
  - `BLOB_COLORS`에서 셔플된 색상 할당 (20가지, 인덱스 모듈로)
  - `isRemote: false` -> AI 활성화
  - `group: Math.floor(i/5)` (5명 단위 그룹)

### 13.3 블롭 스프라이트 (`makeBlobSprite`, `game.js:24~36행`)

오프스크린 캔버스에 생성: 타원형 몸체 + 흰색 눈 2개 + 검정 동공 2개

---

## 14. 게임 루프

**파일: `src/game.js` (309~321행, 454~549행)**

### 14.1 루프 구조

```
requestAnimationFrame(loop)
  -> 프레임 간격 검사 (최소 1000/61ms = ~61fps 상한)
      -> update()
      -> render()
```

### 14.2 update() 순서

1. 승리 타이머 처리 (파티클/채팅만 갱신, 0이면 보상 표시)
2. `updatePlayer()` -- 키보드 입력 -> 속도 반영
3. `updateNPCs()` -- AI 의사결정 + 이동
4. `applyPhysics()` -- 중력/플랫폼/브릿지/엘리베이터 충돌
5. `_gameBroadcastPos()` -- 멀티플레이어 위치 전송 (100ms tick)
6. `resolveEntityCollisions()` -- 엔티티 간 스태킹 충돌 (2패스 상한)
7. 피코파크 업데이트: `updatePushBlocks()` -> `updatePlates()` -> `updateElevators()` -> `updateKeyDoor()`
8. `updateHazards()` -- 장애물 접촉 판정
9. `updateCamera()` -- 카메라 추적
10. `_spawnEffectTrail()` -- 플레이어 이펙트 파티클
11. 파티클/채팅 물리 갱신 + 수명 관리
12. `checkStageComplete()` -- 스테이지 완료 판정
13. `updateProgress()` -- HUD 진행률 갱신

---

## 15. 교사 관전 모드

### 15.1 진입 (`enterAsSpectator`, 193~227행)

- `spectatorMode = true`
- 관전 배지: "전지적 시점 . 방향키: 카메라 . 클릭/Tab: 학생 시점 . +/-: 줌"

### 15.2 더미 플레이어

`player = { x: -1000, y: -1000, _spectatorDummy: true }` -- 물리/AI/입력 모두 무시

### 15.3 줌 제어

- `+` / `=`: `gameZoom += 0.2` (최대 3.0)
- `-` / `_`: `gameZoom -= 0.2` (최소 0.4)

---

## 16. 게임 종료 & 클린업

### 16.1 정상 종료 (`quit`, 884~941행)

1. 이탈 타이머 정리
2. 실시간 채널 해제 (`WaitingRoom.rtDestroy()`)
3. 타이머/애니메이션 정지
4. 키 입력 리스너 해제
5. 모든 게임별 리스너 정리
6. UI 복원
7. 교사면 대시보드, 학생이면 로비 복귀 + `DB.closeGameSession()`

### 16.2 강제 클린업 (`forceCleanup`, 833~882행)

교사 종료 신호 또는 플레이어 전원 이탈 시:
1. `running = false`, `completed = true`
2. 모든 루프/타이머/리스너 즉시 정지
3. 멀티플레이어 상태 초기화
4. UI 오버레이 숨김 -> 로비 이동

---

## 17. 투표 시스템과의 연동

**파일: `src/vote.js`**

```javascript
{ id: 'picopark', name: '피코파크', desc: '협동 퍼즐!', bounty: 50, status: 'open' }
```

- `status: 'open'` -> 투표 가능 상태
- 투표 20초 -> NPC는 70% 확률로 미클리어 게임 선호
- 동점 시 교사 선택 (15초 타임아웃 후 랜덤)
- 선택된 게임 ID가 `enterFromWaitingRoom(gameId)`의 인자로 전달

---

## 18. 엔티티 데이터 구조

### 18.1 플레이어/NPC 공통

```javascript
{
    x, y,                    // 위치 (중심 X, 상단 Y)
    vx, vy,                  // 속도
    w: 24, h: 28,            // 크기
    dir: 1 | -1,             // 바라보는 방향
    onGround: boolean,       // 착지 상태
    jumpCount: 0~2,          // 현재 점프 횟수
    maxJumps: 2,             // 최대 점프 횟수
    dead: boolean,           // 사망 상태
    ghostTimer: 0~60,        // 부활 카운트다운
    atDoor: boolean,         // 문 근처
    enteredDoor: boolean,    // 문 진입 완료
    sprite: OffscreenCanvas, // 캐릭터 이미지
}
```

### 18.2 NPC 전용 추가 속성

```javascript
{
    color: '#FF6B6B',        // 블롭 색상
    isRemote: boolean,       // 원격 플레이어 여부
    studentId: string,       // 원격 식별자
    displayName: string,     // 표시 이름
    aiTimer: number,         // AI 결정 타이머
    chatTimer: number,       // 채팅 쿨다운
    aiJumpCooldown: number,  // 점프 쿨다운
    stuckTimer: number,      // 막힘 감지 카운터
    lastX: number,           // 막힘 감지용 이전 X
    group: number,           // 그룹 번호 (5명 단위)
}
```

### 18.3 Game 상태 객체

```javascript
Game = {
    // 월드
    W, H,                    // 월드 크기
    VW, VH,                  // 뷰포트 크기
    camera: {x, y},          // 카메라 위치
    gameZoom: 1.6,           // 줌 배율

    // 게임 상태
    stage: 0,                // 현재 스테이지 인덱스 (0~2)
    stageData: {},           // 현재 스테이지 설정
    running: boolean,
    completed: boolean,
    ghostMode: boolean,
    remaining: 300,          // 남은 시간(초)

    // 엔티티
    player: {},
    npcs: [],                // 인원 제한 없음
    particles: [],
    chatBubbles: [],

    // 레벨 요소
    stageKeys: [],
    door: {},
    platforms: [],
    plates: [],              // 판정 좌우 20px 마진 적용
    bridges: [],
    elevators: [],           // 폭 동적 확장 (required * 20px)
    hazards: [],
    pushBlocks: [],          // 판정 범위 max(40, required*8)px

    // 진행
    playersAtDoor: 0,
    totalPlayers: 0,
    totalStudents: 0,        // 인원 상한 없음
    deadPlayers: Set,
    doorLockCooldown: 0,
    victoryTimer: 0,

    // 네트워킹
    isMultiplayer: boolean,
    spectatorMode: boolean,
    _rtChannel: null,
    _remotePlayerData: Map,
    _gameLastBroadcast: 0,   // 100ms tick 타이머

    // 상수
    GRAVITY: 0.5,
    JUMP_FORCE: -10,
    MOVE_SPD: 3.2,
    CLEAR_REWARD: 50,
}
```

---

## 19. 성능 최적화 (30명 대응)

| 영역 | 기법 |
|------|------|
| 네트워크 | 고정 100ms tick-rate (초당 10회), 상태 변화 감지 제거 |
| 엔티티 충돌 | 2패스 상한, 4px 이하 수평 겹침 허용, 25% 연성 밀어냄 |
| 물리 | 원격 플레이어 물리 스킵 (`isRemote`) |
| AI | 작업 목록 프레임당 1회 생성 (NPC 간 공유) |
| 렌더링 | 뷰포트 컬링 (화면 밖 요소 스킵) |
| 파티클 | 컴팩트 배열 (쓰기 인덱스로 제거) |
| 프레임 | 61fps 상한 (`FRAME_MIN = 1000/61`) |
| 캔버스 | HiDPI 스케일링 (최대 3x) |
| 협동 장치 | 발판 +/-20px, 엘리베이터 +/-15px, 블록 동적 pushZone |
| 엘리베이터 | required 기반 폭 동적 확장 (1인당 20px) |
| 문 진입 | 네트워크 동기화 (`enteredDoor` 단방향 강제 적용) |
| 인원 제한 | 하드코딩 24명 상한 제거, 30명+ 유연 배열 |

---

## 20. Confetti 시스템

**파일: `src/game.js` (951행)**

승리 시 화면 전체에 발사:
- 120개 파티클, 7가지 색상
- 중력 0.06, 회전 애니메이션
- 150프레임 후 페이드아웃
