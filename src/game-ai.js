import { NPC_CHATS } from './constants.js';

export const GameAI = {
    updateNPCs(){
        const allKeysCollected = this.stageKeys.length > 0 && this.stageKeys.every(k=>k.collected);
        const doorOpen = this.door && this.door.open;

        this.npcs.forEach((n,idx)=>{
            n.aiTimer++;
            n.chatTimer--;
            if(n.aiJumpCooldown > 0) n.aiJumpCooldown--;

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

            if(this.gameMode === 'numbermatch'){
                // NUMBER MATCH AI
                if(doorOpen && !n.atDoor){
                    goal = 'door';
                    tx = this.door.x + this.door.w/2;
                    ty = this.door.y;
                } else if(!this.nmAllMatched){
                    const mySpot = this.numberSpots.find(s => s.number === n.assignedNumber);
                    if(mySpot){
                        goal = 'spot';
                        tx = mySpot.x + mySpot.w/2;
                        ty = mySpot.y - 20;
                        // Intelligence varies by group: group0=smart, higher=more confused
                        const intelligence = 1.0 - (n.group * 0.12);
                        if(Math.random() > intelligence && n.aiTimer % 200 < 60){
                            goal = 'wander';
                            tx = n.x + (Math.random()-0.5)*200;
                            ty = n.y;
                        }
                    }
                } else {
                    // Stay on spot
                    const mySpot = this.numberSpots.find(s => s.number === n.assignedNumber);
                    if(mySpot){ tx = mySpot.x + mySpot.w/2; ty = mySpot.y - 20; goal = 'spot'; }
                }
            } else {
            // PICO PARK AI
            // Priority: plates > push blocks > key > door

            // 1. If door is open, go to door
            if(doorOpen && !n.atDoor){
                goal = 'door';
                tx = this.door.x + this.door.w/2;
                ty = this.door.y;
            }
            // 2. If uncollected keys remain, distribute groups to them
            else if(!allKeysCollected){
                const uncollected = this.stageKeys.filter(k=>!k.collected);
                if(uncollected.length > 0 && n.group < uncollected.length){
                    const targetKey = uncollected[n.group % uncollected.length];
                    // Stacking key: no gateType → some NPCs act as "base", others climb
                    if(!targetKey.gateType){
                        const keyGroupNpcs = this.npcs.filter(e=>!e.dead && !e.enteredDoor && (e.group % uncollected.length)===(n.group % uncollected.length));
                        const myIdx = keyGroupNpcs.indexOf(n);
                        if(myIdx >= 0 && myIdx < Math.ceil(keyGroupNpcs.length * 0.6)){
                            // Base NPCs: stand under the key as a "stair"
                            goal = 'stack_base';
                            tx = targetKey.x + targetKey.w/2 + (myIdx - 1) * 8;
                            ty = targetKey.y + 60;
                        } else {
                            // Climber NPCs: try to climb on top of base NPCs
                            goal = 'key';
                            tx = targetKey.x + targetKey.w/2;
                            ty = targetKey.y;
                        }
                    } else {
                        goal = 'key';
                        tx = targetKey.x + targetKey.w/2;
                        ty = targetKey.y;
                    }
                }
            }
            // 3. Assign groups to plates
            else if(!doorOpen){
                const plateIdx = n.group % (this.plates.length || 1);
                if(plateIdx < this.plates.length){
                    const plate = this.plates[plateIdx];
                    if(!plate.active || plate.stepCount < 3){
                        goal = 'plate';
                        tx = plate.x + plate.w/2;
                        ty = plate.y - 10;
                    }
                }
                if(goal === 'wander' && this.pushBlocks.length > 0){
                    const block = this.pushBlocks[0];
                    if(!block.pushed){
                        goal = 'push';
                        tx = block.x - 10;
                        ty = block.y;
                    }
                }
                if(goal === 'wander'){
                    goal = 'follow';
                    tx = this.player.x + (Math.random()-0.5)*60;
                    ty = this.player.y;
                }
            }
            } // end picopark AI

            // ── AI Movement ──
            const dx = tx - n.x;
            const dy = ty - n.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if(goal === 'stack_base'){
                // Stand still under the key as a base for stacking
                if(Math.abs(dx) > 10){
                    n.vx = Math.sign(dx) * 1.2;
                    n.dir = dx > 0 ? 1 : -1;
                } else {
                    n.vx *= 0.3; // stay still
                }
            } else if(dist > 20){
                const speed = 1.5 + Math.random()*0.8;
                n.vx = Math.sign(dx) * speed;
                n.dir = dx > 0 ? 1 : -1;

                // Jump if target is above or stuck
                if((dy < -30 || n.stuckTimer > 2) && n.onGround && n.aiJumpCooldown <= 0){
                    n.vy = this.JUMP_FORCE * (0.85+Math.random()*0.3);
                    n.jumpCount = 1;
                    n.onGround = false;
                    n.aiJumpCooldown = 30 + Math.random()*30|0;
                    n.stuckTimer = 0;
                }
                // Double jump sometimes
                if(!n.onGround && n.jumpCount===1 && dy < -60 && Math.random()<0.05 && n.aiJumpCooldown<=0){
                    n.vy = this.JUMP_FORCE * 0.8;
                    n.jumpCount = 2;
                    n.aiJumpCooldown = 40;
                }
            } else {
                n.vx *= 0.7;
                // Random idle jump
                if(n.onGround && Math.random()<0.01){
                    n.vy = this.JUMP_FORCE * 0.7;
                    n.jumpCount = 1;
                    n.onGround = false;
                }
            }

            // Chat
            if(n.chatTimer <= 0){
                n.chatTimer = 300+Math.random()*600|0;
                const msgs = this.getContextChat(goal);
                this.chatBubbles.push({x:n.x,y:n.y-20,text:msgs[Math.floor(Math.random()*msgs.length)],timer:100,follow:n});
            }
        });
    },

    getContextChat(goal){
        const chats = {
            key:['열쇠 어딨지?','열쇠 찾자!','위로 가야해!','거기다!','올라가자!'],
            stack_base:['올라타!','내 위로!','쌓자!','계단 만들자!','여기 서있을게!'],
            door:['문으로 가자!','빨리빨리!','거의 다 왔어!','이쪽이야!','고고!'],
            plate:['여기 밟아!','내가 밟을게!','발판!','누르고 있을게!','올라타!'],
            push:['같이 밀자!','밀어!','으쌰!','힘내!','가즈아!'],
            follow:['따라와~','같이 가자!','기다려~','ㅋㅋ','어디야?'],
            spot:['내 번호 어디지?','찾았다!','여기인가?','이 번호 맞나?','올라가자!','내 자리!'],
            wander:['ㅋㅋ','심심해~','뭐하지','여기야!','안녕~'],
        };
        return chats[goal] || chats.wander;
    },
};
