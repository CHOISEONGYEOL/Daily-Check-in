import { NPC_CHATS } from './constants.js';

export const GameAI = {
    updateNPCs(){
        if(!this.npcs || !this.npcs.length) return;
        const allKeysCollected = (this.stageKeys || []).length > 0 && (this.stageKeys || []).every(k=>k.collected);
        const doorOpen = this.door && this.door.open;

        // Pre-compute job list for picopark (shared across all NPCs)
        let picoJobs = null;
        if(this.gameMode !== 'numbermatch' && this.gameMode !== 'escaperoom'){
            picoJobs = this._buildPicoJobs(allKeysCollected, doorOpen);
        }

        this.npcs.forEach((n,idx)=>{
            n.aiTimer++;
            n.chatTimer--;
            if(n.aiJumpCooldown > 0) n.aiJumpCooldown--;

            // ★ 원격 플레이어는 AI 스킵 (네트워크에서 제어됨)
            if(n.isRemote) return;
            // Already in door
            if(n.enteredDoor) return;
            // Dead NPC
            if(n.dead && !this.ghostMode){
                n.ghostTimer--;
                if(n.ghostTimer <= 0) this.respawnEntity(n);
                return;
            }

            // Stuck detection
            if(n.aiTimer % 60 === 0){
                if(Math.abs(n.x - n.lastX) < 5) n.stuckTimer++;
                else n.stuckTimer = 0;
                n.lastX = n.x;
            }

            // ── AI Decision ──
            let goal = 'wander';
            let tx = n.x, ty = n.y;

            if(this.gameMode === 'escaperoom'){
                // ── 방탈출 NPC AI: 단서 찾기 → 퀴즈 풀기 → 문 ──
                if(doorOpen && !n.atDoor){
                    goal = 'door'; tx = this.door.x+this.door.w/2; ty = this.door.y;
                } else if(this._escapeQuizzes && this._escapeQuizzes.every(q=>q.solved)){
                    if(this.door){ goal = 'door'; tx = this.door.x+this.door.w/2; ty = this.door.y; }
                } else {
                    const unfoundClue = this._escapeClues && this._escapeClues.find(c=>!c.found);
                    const unsolvedQuiz = this._escapeQuizzes && this._escapeQuizzes.find(q=>!q.solved);
                    if(unfoundClue && Math.random() < 0.6){
                        goal = 'clue'; tx = unfoundClue.x+10; ty = unfoundClue.y;
                    } else if(unsolvedQuiz && unsolvedQuiz.pads){
                        const step = unsolvedQuiz.currentStep || 0;
                        const ci = unsolvedQuiz.correctOrder ? unsolvedQuiz.correctOrder[step] : 0;
                        const pad = unsolvedQuiz.pads[ci];
                        if(pad){ goal = 'quizpad'; tx = pad.x+pad.w/2; ty = pad.y; }
                    } else { goal = 'wander'; tx = n.x+(Math.random()-.5)*200; ty = n.y; }
                    const intelligence = 1.0 - (n.group * 0.15);
                    if(Math.random() > intelligence && n.aiTimer%200<60){
                        goal = 'wander'; tx = n.x+(Math.random()-.5)*200; ty = n.y;
                    }
                }
            } else if(this.gameMode === 'numbermatch'){
                // ── 오리엔티어링 체크포인트 AI ──
                if(doorOpen && !n.atDoor){
                    goal = 'door';
                    tx = this.door.x + this.door.w/2;
                    ty = this.door.y;
                } else if(n.completedAll){
                    // 전부 완료 → 문 근처 대기
                    if(this.door){
                        goal = 'door';
                        tx = this.door.x + this.door.w/2;
                        ty = this.door.y;
                    }
                } else if(n.checkpoints && n.currentCP < n.checkpoints.length){
                    // 현재 체크포인트 스팟으로 이동
                    const targetNum = n.checkpoints[n.currentCP];
                    const mySpot = this.numberSpots.find(s => s.number === targetNum);
                    if(mySpot){
                        goal = 'spot';
                        tx = mySpot.x + mySpot.w/2;
                        ty = mySpot.y - 20;
                        // Intelligence varies by group
                        const intelligence = 1.0 - (n.group * 0.12);
                        if(Math.random() > intelligence && n.aiTimer % 200 < 60){
                            goal = 'wander';
                            tx = n.x + (Math.random()-0.5)*200;
                            ty = n.y;
                        }
                    }
                }
            } else {
                // ═══ PICO PARK AI – 작업 기반 분배 시스템 ═══
                const result = this._assignPicoJob(n, idx, picoJobs);
                goal = result.goal;
                tx = result.tx;
                ty = result.ty;
            }

            // ── AI Movement ──
            this._moveNPC(n, goal, tx, ty);

            // Chat
            if(n.chatTimer <= 0){
                n.chatTimer = 300+Math.random()*600|0;
                const msgs = this.getContextChat(goal);
                this.chatBubbles.push({x:n.x,y:n.y-20,text:msgs[Math.floor(Math.random()*msgs.length)],timer:100,follow:n});
            }
        });
    },

    // ═══════════════════════════════════════
    // 피코파크 작업 목록 생성
    // ═══════════════════════════════════════
    _buildPicoJobs(allKeysCollected, doorOpen){
        // 문 열림 or 열쇠 다 모음 → 전원 문으로
        if(doorOpen || allKeysCollected){
            return [{type:'door', weight:1}];
        }

        const jobs = [];
        const uncollected = this.stageKeys.filter(k => !k.collected);
        const coveredPlateIds = new Set();

        for(const key of uncollected){
            const unlocked = !key.gateType || this.isKeyUnlocked(key);

            if(!key.gateType){
                // ── 스태킹 열쇠 (게이트 없음) ──
                jobs.push({type:'stack', key, weight:8});
            } else if(unlocked){
                // ── 게이트 해제됨 → 열쇠 수집 + 게이트 유지 ──
                jobs.push({type:'collectKey', key, weight:4});
                // 발판: 계속 밟고 있어야 다리가 유지됨
                if(key.gateType === 'plate'){
                    const plate = this.plates.find(p => p.linkedId === key.gateId);
                    if(plate){
                        jobs.push({type:'plate', target:plate, weight:3});
                        coveredPlateIds.add(plate.linkedId);
                    }
                }
                // 엘리베이터: 계속 타고 있어야 위치 유지
                if(key.gateType === 'elevator'){
                    const elev = this.elevators[key.gateId];
                    if(elev){
                        jobs.push({type:'elevator', target:elev, weight:Math.max(elev.required, 3)});
                    }
                }
                // 블록: 한번 밀면 끝 → 유지 불필요
            } else {
                // ── 게이트 잠김 → 장치 작동 우선! ──
                if(key.gateType === 'plate'){
                    const plate = this.plates.find(p => p.linkedId === key.gateId);
                    if(plate){
                        jobs.push({type:'plate', target:plate, weight:5});
                        coveredPlateIds.add(plate.linkedId);
                    }
                } else if(key.gateType === 'elevator'){
                    const elev = this.elevators[key.gateId];
                    if(elev){
                        jobs.push({type:'elevator', target:elev, weight:elev.required + 3});
                    }
                } else if(key.gateType === 'pushBlock'){
                    const block = this.pushBlocks[key.gateId];
                    if(block && !block.pushed){
                        jobs.push({type:'push', target:block, weight:block.required + 3});
                    }
                }
                // 소수 인원 열쇠 근처 대기 (게이트 해제되면 즉시 수집)
                jobs.push({type:'collectKey', key, weight:1});
            }
        }

        // ── 보조 발판 (열쇠 게이트에 직접 연결 안 된 발판도 활성화) ──
        this.plates.forEach(plate => {
            if(!coveredPlateIds.has(plate.linkedId)){
                jobs.push({type:'plate', target:plate, weight:2});
            }
        });

        return jobs.length > 0 ? jobs : [{type:'wander', weight:1}];
    },

    // ═══════════════════════════════════════
    // NPC 작업 배정 (가중치 기반 분배)
    // ═══════════════════════════════════════
    _assignPicoJob(n, idx, jobs){
        let goal = 'wander', tx = n.x, ty = n.y;

        // 단일 작업: 문 or 배회
        if(jobs.length === 1){
            if(jobs[0].type === 'door' && this.door){
                return {goal:'door', tx:this.door.x + this.door.w/2, ty:this.door.y};
            }
            if(jobs[0].type === 'wander'){
                return {goal:'wander', tx:n.x + (Math.random()-.5)*100, ty:n.y};
            }
        }

        // 가중치 기반 NPC 분배
        const totalWeight = jobs.reduce((s,j) => s + j.weight, 0);
        const ratio = idx / Math.max(this.npcs.length, 1);
        let cum = 0;
        let assigned = jobs[0];
        for(const job of jobs){
            cum += job.weight / totalWeight;
            if(ratio < cum){ assigned = job; break; }
        }

        // 작업별 목표 좌표 설정
        switch(assigned.type){
            case 'plate':
                goal = 'plate';
                tx = assigned.target.x + assigned.target.w/2;
                ty = assigned.target.y - 10;
                break;
            case 'elevator':
                goal = 'elevator';
                tx = assigned.target.x + assigned.target.w/2;
                ty = assigned.target.y - 10;
                break;
            case 'push':
                goal = 'push';
                tx = assigned.target.x - 10;
                ty = assigned.target.y;
                break;
            case 'collectKey':
                goal = 'key';
                tx = assigned.key.x + assigned.key.w/2;
                ty = assigned.key.y;
                break;
            case 'stack': {
                const available = this.npcs.filter(e => !e.dead && !e.enteredDoor);
                const myIdx = available.indexOf(n);
                const baseCount = Math.ceil(available.length * 0.6);
                if(myIdx >= 0 && myIdx < baseCount){
                    goal = 'stack_base';
                    tx = assigned.key.x + assigned.key.w/2 + (myIdx - 1) * 8;
                    ty = assigned.key.y + 60;
                } else {
                    goal = 'key';
                    tx = assigned.key.x + assigned.key.w/2;
                    ty = assigned.key.y;
                }
                break;
            }
            case 'door':
                goal = 'door';
                if(this.door){ tx = this.door.x + this.door.w/2; ty = this.door.y; }
                break;
            default:
                goal = 'wander';
                tx = n.x + (Math.random()-.5)*100;
                ty = n.y;
        }

        return {goal, tx, ty};
    },

    // ═══════════════════════════════════════
    // NPC 이동 처리
    // ═══════════════════════════════════════
    _moveNPC(n, goal, tx, ty){
        const dx = tx - n.x;
        const dy = ty - n.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if(goal === 'stack_base'){
            // 스태킹 베이스: 열쇠 아래에서 가만히 서 있기
            if(Math.abs(dx) > 10){
                n.vx = Math.sign(dx) * 1.2;
                n.dir = dx > 0 ? 1 : -1;
            } else {
                n.vx *= 0.3;
            }
        } else if(goal === 'push'){
            // 블록 밀기: 접근 후 계속 오른쪽으로 밀기
            if(dist > 60){
                // 아직 멀리 있음 → 블록쪽으로 이동
                n.vx = Math.sign(dx) * 2.0;
                n.dir = dx > 0 ? 1 : -1;
                if((dy < -30 || n.stuckTimer > 2) && n.onGround && n.aiJumpCooldown <= 0){
                    n.vy = this.JUMP_FORCE * 0.9;
                    n.jumpCount = 1; n.onGround = false;
                    n.aiJumpCooldown = 30; n.stuckTimer = 0;
                }
            } else {
                // 블록 근처 → 오른쪽으로 밀기 (vx > 0 필수)
                n.vx = 1.8;
                n.dir = 1;
                if(n.stuckTimer > 2 && n.onGround && n.aiJumpCooldown <= 0){
                    n.vy = this.JUMP_FORCE * 0.85;
                    n.jumpCount = 1; n.onGround = false;
                    n.aiJumpCooldown = 30; n.stuckTimer = 0;
                }
            }
        } else if(goal === 'plate' || goal === 'elevator'){
            // 발판/엘리베이터: 도착하면 가만히 서 있기
            if(dist > 15){
                const speed = 1.5 + Math.random()*0.5;
                n.vx = Math.sign(dx) * speed;
                n.dir = dx > 0 ? 1 : -1;
                if((dy < -30 || n.stuckTimer > 2) && n.onGround && n.aiJumpCooldown <= 0){
                    n.vy = this.JUMP_FORCE * (0.85 + Math.random()*0.3);
                    n.jumpCount = 1; n.onGround = false;
                    n.aiJumpCooldown = 30 + Math.random()*30|0; n.stuckTimer = 0;
                }
                // 더블 점프
                if(!n.onGround && n.jumpCount===1 && dy < -60 && Math.random()<0.05 && n.aiJumpCooldown<=0){
                    n.vy = this.JUMP_FORCE * 0.8;
                    n.jumpCount = 2; n.aiJumpCooldown = 40;
                }
            } else {
                n.vx *= 0.3; // 도착 → 정지
            }
        } else if(dist > 20){
            // 일반 이동 (열쇠, 문, 번호판 등)
            const speed = 1.5 + Math.random()*0.8;
            n.vx = Math.sign(dx) * speed;
            n.dir = dx > 0 ? 1 : -1;

            // 점프 (목표가 위에 있거나 막힘)
            if((dy < -30 || n.stuckTimer > 2) && n.onGround && n.aiJumpCooldown <= 0){
                n.vy = this.JUMP_FORCE * (0.85 + Math.random()*0.3);
                n.jumpCount = 1;
                n.onGround = false;
                n.aiJumpCooldown = 30 + Math.random()*30|0;
                n.stuckTimer = 0;
            }
            // 더블 점프
            if(!n.onGround && n.jumpCount===1 && dy < -60 && Math.random()<0.05 && n.aiJumpCooldown<=0){
                n.vy = this.JUMP_FORCE * 0.8;
                n.jumpCount = 2;
                n.aiJumpCooldown = 40;
            }
        } else {
            n.vx *= 0.7;
            // 대기 중 랜덤 점프
            if(n.onGround && Math.random()<0.01){
                n.vy = this.JUMP_FORCE * 0.7;
                n.jumpCount = 1;
                n.onGround = false;
            }
        }
    },

    getContextChat(goal){
        const chats = {
            key:['열쇠 어딨지?','열쇠 찾자!','위로 가야해!','거기다!','올라가자!'],
            stack_base:['올라타!','내 위로!','쌓자!','계단 만들자!','여기 서있을게!'],
            door:['문으로 가자!','빨리빨리!','거의 다 왔어!','이쪽이야!','고고!'],
            plate:['여기 밟아!','내가 밟을게!','발판!','누르고 있을게!','올라타!'],
            push:['같이 밀자!','밀어!','으쌰!','힘내!','가즈아!'],
            elevator:['엘리베이터 타!','같이 올라가자!','위로!','더 타야 해!','여기 올라와!'],
            follow:['따라와~','같이 가자!','기다려~','ㅋㅋ','어디야?'],
            spot:['다음 체크포인트!','찾았다!','여기인가?','빨리 밟자!','올라가자!','다음 번호!'],
            clue:['단서 찾았다!','여기 뭔가 있어!','힌트다!','이거 중요해!','읽어봐!'],
            quizpad:['이거 밟아야해!','순서대로!','정답일까?','퀴즈 풀자!','여기 밟아!'],
            wander:['ㅋㅋ','심심해~','뭐하지','여기야!','안녕~'],
        };
        return chats[goal] || chats.wander;
    },
};
