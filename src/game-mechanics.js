export const GameMechanics = {
    // ── Push Blocks ──
    updatePushBlocks(){
        this.pushBlocks.forEach(block=>{
            if(block.pushed) return;
            block.pushers.clear();
            const all = [this.player, ...this.npcs].filter(e=>!e.dead || this.ghostMode);
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
        this.plates.forEach(plate=>{
            plate.stepCount = 0;
            const all = [this.player, ...this.npcs].filter(e=>!e.dead || this.ghostMode);
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
            this.bridges.forEach(br=>{
                if(br.linkedId === plate.linkedId){
                    br.visible = plate.active;
                }
            });
            // Activate linked elevators
            this.elevators.forEach(elev=>{
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
        this.elevators.forEach(elev=>{
            // Count riders
            let riders = 0;
            const all = [this.player, ...this.npcs].filter(e=>!e.dead || this.ghostMode);
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
            this.plates.forEach(plate=>{
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
        if(!this.door) return;

        // Key collection (multiple keys) — 협동 게이트 체크 포함
        const all = [this.player, ...this.npcs].filter(e=>!e.dead);
        this.stageKeys.forEach(key=>{
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
            const all2 = [this.player, ...this.npcs].filter(e=>!e.dead);
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
            const all = [this.player, ...this.npcs].filter(e=>!e.dead);
            all.forEach(e=>{
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

    // ── Number Match: spot checking ──
    updateNumberSpots(){
        if(!this.numberSpots || !this.numberSpots.length) return;
        const all = [this.player, ...this.npcs].filter(e => !e.dead || this.ghostMode);
        let matchCount = 0;
        const aliveCount = all.filter(e => !e.enteredDoor).length;

        this.numberSpots.forEach(spot => {
            spot.occupant = null;
            spot.satisfied = false;
            for(const e of all){
                if(e.enteredDoor) continue;
                const onSpot = (
                    e.x + e.w/2 > spot.x && e.x - e.w/2 < spot.x + spot.w &&
                    Math.abs((e.y + e.h) - spot.y) < 12 && e.onGround
                );
                if(onSpot){
                    spot.occupant = e;
                    if(e.assignedNumber === spot.number){
                        spot.satisfied = true;
                        matchCount++;
                    }
                    break;
                }
            }
        });

        this.nmMatchCount = matchCount;
        const allSatisfied = matchCount >= aliveCount && aliveCount > 0;

        if(allSatisfied && !this.nmAllMatched){
            this.nmAllMatched = true;
            if(this.door) this.door.open = true;
            this.chatBubbles.push({
                x:this.VW/2, y:this.VH/4,
                text:'🎉 전원 매칭 완료! 문이 열렸어요!',
                timer:120, follow:null, screen:true, big:true
            });
            this.numberSpots.forEach(spot => {
                if(spot.satisfied) this.spawnParticles(spot.x+spot.w/2, spot.y-10, '#00B894', 6);
            });
        }

        // Door entry (reuse pattern)
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
        this.hazards.forEach(hz=>{
            const all = [this.player, ...this.npcs];
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
        const sd = this.stageData;
        e.dead = false;
        e.x = sd.spawnX + (Math.random()*100-50);
        e.y = sd.spawnY - 30;
        e.vx = 0; e.vy = 0;
        e.jumpCount = 0;
        e.atDoor = false;
        this.spawnParticles(e.x, e.y, '#54A0FF', 6);
    },
};
