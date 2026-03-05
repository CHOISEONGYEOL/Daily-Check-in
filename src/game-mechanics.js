export const GameMechanics = {
    // ── Push Blocks ──
    updatePushBlocks(){
        if(!this.player) return;
        (this.pushBlocks || []).forEach(block=>{
            if(block.pushed) return;
            block.pushers.clear();
            const all = [this.player, ...(this.npcs || [])].filter(e=>e && (!e.dead || this.ghostMode));
            all.forEach((e,i)=>{
                // Check if entity is touching block from left side and moving right
                const touching = (e.x+e.w/2 >= block.x-5 && e.x+e.w/2 <= block.x+10 &&
                                  e.y+e.h > block.y && e.y < block.y+block.h);
                if(touching && e.vx > 0){
                    block.pushers.add(i);
                }
            });
            // Enough pushers?
            if(block.pushers.size >= block.required){
                block.pushing = true;
                block.x += 1.5;
                // Push block off edge? Mark as done
                if(block.x > this.W + 50) block.pushed = true;
                // Particles
                if(Math.random()<0.3){
                    this.spawnParticles(block.x, block.y+block.h, '#FDCB6E', 2);
                }
            } else {
                block.pushing = false;
            }
        });
    },

    // ── Pressure Plates ──
    updatePlates(){
        if(!this.player) return;
        (this.plates || []).forEach(plate=>{
            plate.stepCount = 0;
            const all = [this.player, ...(this.npcs || [])].filter(e=>e && (!e.dead || this.ghostMode));
            all.forEach(e=>{
                if(e.onGround &&
                   e.x+e.w/2 > plate.x && e.x-e.w/2 < plate.x+plate.w &&
                   Math.abs((e.y+e.h) - plate.y) < 8){
                    plate.stepCount++;
                }
            });
            const wasActive = plate.active;
            plate.active = plate.stepCount > 0;

            // Activate/deactivate linked bridges
            (this.bridges || []).forEach(br=>{
                if(br.linkedId === plate.linkedId){
                    br.visible = plate.active;
                }
            });
            // Activate linked elevators
            (this.elevators || []).forEach(elev=>{
                // Elevators handled separately
            });

            // Sound effect
            if(plate.active && !wasActive){
                this.spawnParticles(plate.x+plate.w/2, plate.y, '#00B894', 6);
            }
        });
    },

    // ── Elevators ──
    updateElevators(){
        if(!this.player) return;
        (this.elevators || []).forEach(elev=>{
            // Count riders
            let riders = 0;
            const all = [this.player, ...(this.npcs || [])].filter(e=>e && (!e.dead || this.ghostMode));
            all.forEach(e=>{
                if(e.onGround &&
                   e.x+e.w/2 > elev.x && e.x-e.w/2 < elev.x+elev.w &&
                   Math.abs((e.y+e.h) - elev.y) < 6){
                    riders++;
                }
            });
            elev.riders = riders;

            // Check if linked plate is active
            let plateActive = false;
            (this.plates || []).forEach(plate=>{
                if(plate.linkedId && plate.linkedId === 'elev' + (this.elevators.indexOf(elev)+1)){
                    plateActive = plate.active;
                }
            });

            // Move elevator
            if(riders >= elev.required || plateActive){
                elev.dir = -1; // go up
                elev.y += elev.dir * 1.5;
                if(elev.y <= elev.minY) { elev.y = elev.minY; elev.dir = 0; }
            } else {
                // Slowly return down
                if(elev.y < elev.maxY){
                    elev.y += 0.5;
                    if(elev.y > elev.maxY) elev.y = elev.maxY;
                }
            }
        });
    },

    // ── Key & Door ──
    updateKeyDoor(){
        if(!this.door || !this.player) return;

        // Key collection (multiple keys) — 협동 게이트 체크 포함
        const all = [this.player, ...(this.npcs || [])].filter(e=>e && !e.dead);
        (this.stageKeys || []).forEach(key=>{
            if(key.collected) return;
            // 게이트 잠금 상태 캐싱
            key._unlocked = this.isKeyUnlocked(key);
            for(const e of all){
                if(e.x+e.w/2 > key.x && e.x-e.w/2 < key.x+key.w &&
                   e.y+e.h > key.y && e.y < key.y+key.h){
                    // 게이트 조건 미충족 시 수집 불가
                    if(!key._unlocked){
                        // 쿨다운 기반 안내 메시지
                        if(!key._lockMsgCd || key._lockMsgCd <= 0){
                            this.chatBubbles.push({
                                x:this.VW/2, y:this.VH/4,
                                text:'🔒 협동 장치를 먼저 작동시켜야 열쇠를 얻을 수 있어요!',
                                timer:90, follow:null, screen:true
                            });
                            key._lockMsgCd = 120;
                        }
                        break;
                    }
                    key.collected = true;
                    this.spawnParticles(key.x, key.y, '#FFD700', 15);
                    const collected = this.stageKeys.filter(k=>k.collected).length;
                    const total = this.stageKeys.length;
                    if(collected >= total){
                        // All keys collected → open door!
                        this.door.open = true;
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:'🔑 열쇠 전부 획득! 전원 문으로!',
                            timer:120, follow:null, screen:true, big:true
                        });
                    } else {
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:`🔑 ${collected}/${total} 열쇠 획득!`,
                            timer:90, follow:null, screen:true, big:true
                        });
                    }
                    break;
                }
            }
            // 쿨다운 감소
            if(key._lockMsgCd > 0) key._lockMsgCd--;
        });

        // Locked door feedback (push back + message)
        if(!this.door.open){
            this.doorLockCooldown = Math.max(0, this.doorLockCooldown-1);
            const all2 = [this.player, ...(this.npcs || [])].filter(e=>e && !e.dead);
            all2.forEach(e=>{
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    // Push entity back from locked door
                    e.vx = e.x < this.door.x+this.door.w/2 ? -2 : 2;
                    if(this.doorLockCooldown <= 0){
                        const remaining = this.stageKeys.filter(k=>!k.collected).length;
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:`🔒 열쇠 ${remaining}개를 더 모아야 합니다!`,
                            timer:90, follow:null, screen:true, big:true
                        });
                        this.doorLockCooldown = 120; // 2 second cooldown
                    }
                }
            });
        }

        // Players enter door (disappear inside)
        if(this.door.open){
            this.playersAtDoor = 0;
            const allDoor = [this.player, ...(this.npcs || [])].filter(e=>e && !e.dead);
            allDoor.forEach(e=>{
                if(e.enteredDoor){ this.playersAtDoor++; return; }
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    e.enteredDoor = true;
                    e.vx = 0; e.vy = 0;
                    this.playersAtDoor++;
                    this.spawnParticles(this.door.x+this.door.w/2, this.door.y+this.door.h/2, '#00B894', 6);
                }
            });
        }
    },

    // ── 오리엔티어링 체크포인트 시스템 ──
    updateNumberSpots(){
        if(!this.numberSpots || !this.numberSpots.length || !this.player) return;
        const all = [this.player, ...(this.npcs || [])].filter(e => e && (!e.dead || this.ghostMode));
        const activeAll = all.filter(e => !e.enteredDoor && !e._spectatorDummy);

        // 스팟 렌더링 상태 초기화
        this.numberSpots.forEach(spot => {
            spot.isPlayerTarget = false;
            spot.isPlayerDone = false;
        });

        // 로컬 플레이어의 체크포인트 렌더링 마킹
        const p = this.player;
        if(p.checkpoints && !p._spectatorDummy){
            for(let i = 0; i < p.checkpoints.length; i++){
                const spot = this.numberSpots.find(s => s.number === p.checkpoints[i]);
                if(!spot) continue;
                if(i < p.currentCP) spot.isPlayerDone = true;
                else if(i === p.currentCP) spot.isPlayerTarget = true;
            }
        }

        // 각 엔티티 체크포인트 판정 (원격 플레이어는 서버에서 처리)
        let completedCount = 0;
        for(const e of activeAll){
            if(!e.checkpoints) continue;
            if(e.completedAll){ completedCount++; continue; }
            if(e.isRemote){ continue; } // 원격 플레이어는 클라이언트에서 자체 판정

            const targetNum = e.checkpoints[e.currentCP];
            const targetSpot = this.numberSpots.find(s => s.number === targetNum);
            if(!targetSpot) continue;

            // 스팟 위에 서있는지 판정
            const onSpot = (
                e.x + e.w/2 > targetSpot.x && e.x - e.w/2 < targetSpot.x + targetSpot.w &&
                Math.abs((e.y + e.h) - targetSpot.y) < 12 && e.onGround
            );
            if(onSpot){
                e.currentCP++;
                this.spawnParticles(targetSpot.x + targetSpot.w/2, targetSpot.y - 10, '#FFD700', 10);

                if(e.currentCP >= e.checkpoints.length){
                    e.completedAll = true;
                    completedCount++;
                    this.chatBubbles.push({
                        x: e.x, y: e.y - 30,
                        text: '✅ 미션 완료!', timer: 90, follow: e
                    });
                    this.spawnParticles(e.x, e.y - 10, '#00B894', 15);
                } else {
                    const nextNum = e.checkpoints[e.currentCP];
                    this.chatBubbles.push({
                        x: e.x, y: e.y - 30,
                        text: `다음: ${nextNum}번!`, timer: 60, follow: e
                    });
                }
            }
        }

        // 원격 플레이어 완료 카운트 (broadcast로 받은 상태)
        for(const e of activeAll){
            if(e.isRemote && e.completedAll) completedCount++;
        }

        this.nmMatchCount = completedCount;
        const aliveCount = activeAll.length;

        // 전원 완료 → 문 열림
        if(completedCount >= aliveCount && aliveCount > 0 && !this.nmAllMatched){
            this.nmAllMatched = true;
            if(this.door) this.door.open = true;
            this.chatBubbles.push({
                x:this.VW/2, y:this.VH/4,
                text:'🎉 전원 체크포인트 완료! 문이 열렸어요!',
                timer:120, follow:null, screen:true, big:true
            });
            this.spawnParticles(this.door.x+this.door.w/2, this.door.y, '#00B894', 20);
        }

        // 문 진입
        if(this.door && this.door.open){
            this.playersAtDoor = 0;
            all.forEach(e => {
                if(e.enteredDoor){ this.playersAtDoor++; return; }
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    e.enteredDoor = true;
                    e.vx = 0; e.vy = 0;
                    this.playersAtDoor++;
                    this.spawnParticles(this.door.x+this.door.w/2, this.door.y+this.door.h/2, '#00B894', 6);
                }
            });
        }
    },

    // ── Hazards ──
    updateHazards(){
        if(!this.player) return;
        (this.hazards || []).forEach(hz=>{
            const all = [this.player, ...(this.npcs || [])];
            all.forEach(e=>{
                if(e.dead || e.enteredDoor) return;
                if(e.x+e.w/2 > hz.x && e.x-e.w/2 < hz.x+hz.w &&
                   e.y+e.h > hz.y && e.y < hz.y+hz.h+5){
                    this.killEntity(e);
                }
            });
        });
    },

    killEntity(e){
        if(e.dead) return;
        e.dead = true;
        e.ghostTimer = 60; // 1 second respawn
        this.spawnParticles(e.x, e.y, '#FF6B6B', 8);
    },

    respawnEntity(e){
        if(!e) return;
        const sd = this.stageData;
        if(!sd) return;
        e.dead = false;
        e.x = sd.spawnX + (Math.random()*100-50);
        e.y = sd.spawnY - 30;
        e.vx = 0; e.vy = 0;
        e.jumpCount = 0;
        e.atDoor = false;
        this.spawnParticles(e.x, e.y, '#54A0FF', 6);
    },
};
