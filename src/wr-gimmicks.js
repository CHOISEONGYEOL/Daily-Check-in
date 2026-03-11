// ── Gimmick System (extracted from waiting-room.js) ──
// Deck, conflicts, spawn, update loop, bouncy zone

export const WrGimmicks = {
    updateObstacles(){
        if(!this.ballGameStarted) return;
        // 기믹 스폰은 호스트만 (공과 동일한 패턴)
        if(this._isHost){
            this.obstacleSpawnTimer++;
            // 무궁화 활성화 중에는 다른 기믹 스폰 차단
            if(this.obstacleSpawnTimer >= this.obstacleSpawnInterval && this.obstacles.length < this.MAX_OBSTACLES && !this.redLightGreenLight){
                this.spawnRandomObstacle();
                this.spawnRandomObstacle(); // 2개 동시 발동
                this.obstacleSpawnTimer = 0;
                this.obstacleSpawnInterval = 360 + Math.random()*300; // 6~11 sec after first
                // 기믹 생성 시 즉시 브로드캐스트
                if(this._rtBroadcastGimmick) this._rtBroadcastGimmick();
            }
        }
        for(let i=this.obstacles.length-1;i>=0;i--){
            const obs = this.obstacles[i];
            obs.timer--;
            if(obs.type==='rotatingPlatform'){
                obs.angle += obs.spinSpeed;
                const p=obs.platform, cx=p.x+p.w/2, cy=p.y+p.h/2;
                const all= this._gimmickTargets();
                all.forEach(e=>{
                    const ex=e.x, ey=e.y+e.h;
                    if(ex>=p.x-25&&ex<=p.x+p.w+25&&ey>=p.y-15&&ey<=p.y+p.h+15){
                        const dir = obs.spinSpeed > 0 ? 1 : -1;
                        e.vx = dir * 14 + (ex-cx)*0.3;
                        e.vy = -14 - Math.random()*5;
                        e.onGround=false; e.jumpCount=2;
                        e.stunTimer = Math.max(e.stunTimer||0, 40);
                    }
                });
                if(obs.timer<=0){ this.obstacles.splice(i,1); }
            } else if(obs.type==='meteor'){
                if(obs.warningTimer>0){ obs.warningTimer--; }
                else if(!obs.impacted){
                    obs.y += 20;
                    if(this.frameCount%2===0){
                        for(let t=0;t<3;t++){
                            this.particles.push({x:obs.x+(Math.random()-.5)*20,y:obs.y-10,
                                vx:(Math.random()-.5)*3,vy:-Math.random()*3-1,
                                color:['#FF4500','#FF6347','#FFD700'][Math.floor(Math.random()*3)],
                                size:3+Math.random()*5,life:15+Math.random()*10,maxLife:25,type:'fire'});
                        }
                    }
                    if(obs.y >= this.H-30){
                        obs.impacted = true;
                        obs.craterTimer = 300;
                        obs.shockwaveRadius = 0;
                        this.screenShake = 18;
                        const all= this._gimmickTargets();
                        all.forEach(e=>{
                            const dx=e.x-obs.x, dy=(e.y+e.h/2)-(this.H-15);
                            const dist=Math.sqrt(dx*dx+dy*dy);
                            if(dist<500&&dist>0){
                                const f=(500-dist)/500*22;e.vx+=(dx/dist)*f;e.vy-=12;
                                if(dist<200) e.stunTimer = 150;
                                else if(dist<350) e.stunTimer = 90;
                                else e.stunTimer = 40;
                            }
                        });
                        for(let j=0;j<60;j++){
                            const angle=Math.random()*Math.PI*2;
                            const spd=2+Math.random()*10;
                            this.particles.push({x:obs.x+(Math.random()-.5)*30,y:this.H-15,
                                vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd-Math.random()*5,
                                color:['#FF4500','#FFD700','#FF6347','#FFA500','#8B4513','#FFFFFF'][Math.floor(Math.random()*6)],
                                size:3+Math.random()*7,life:40+Math.random()*40,maxLife:80,type:'fire'});
                        }
                        for(let j=0;j<15;j++){
                            this.particles.push({x:obs.x+(Math.random()-.5)*40,y:this.H-20,
                                vx:(Math.random()-.5)*12,vy:-Math.random()*12-3,
                                color:['#8B4513','#A0522D','#654321'][Math.floor(Math.random()*3)],
                                size:4+Math.random()*6,life:50+Math.random()*30,maxLife:80,type:'fire'});
                        }
                        this.chatBubbles.push({x:obs.x,y:this.H-85,text:'☄️ 쾅!!!',timer:90,follow:null});
                    }
                } else {
                    obs.craterTimer--;
                    if(obs.shockwaveRadius !== undefined && obs.shockwaveRadius < 450) obs.shockwaveRadius += 12;
                    if(obs.craterTimer<=0) this.obstacles.splice(i,1);
                }
            } else if(obs.type==='bouncyZone'){
                if(obs.timer<=0) this.obstacles.splice(i,1);
            } else if(obs.type==='windGust'){
                if(Math.random()<0.6){
                    obs.streaks.push({
                        x:obs.direction>0?-10:this.W+10,
                        y:30+Math.random()*(this.H-60),
                        speed:12+Math.random()*10, length:50+Math.random()*80, alpha:0.15+Math.random()*0.3,
                        thickness:1+Math.random()*2
                    });
                }
                obs.streaks=obs.streaks.filter(s=>{s.x+=obs.direction*s.speed;return s.x>-60&&s.x<this.W+60;});
                if(obs.timer > 30) this.screenShake = Math.max(this.screenShake, 2);
                if(obs.timer<=0){this.activeWind=null;this.obstacles.splice(i,1);}
            } else if(obs.type==='frogCurse'){
                if(obs.timer<=0){this.reversedControls=false;this.obstacles.splice(i,1);}
            } else if(obs.type==='screenFlip'){
                if(obs.timer<=0){this.screenFlip=null;this.obstacles.splice(i,1);}
            } else if(obs.type==='gravityReverse'){
                if(this.frameCount%4===0){
                    this.particles.push({x:Math.random()*this.W,y:this.H-20,vx:(Math.random()-.5)*1,vy:-1-Math.random()*2,
                        color:'rgba(180,160,255,0.5)',size:2+Math.random()*2,life:30+Math.random()*20,maxLife:50,type:'fire'});
                }
                if(obs.timer<=0){this.gravityReversed=false;this.obstacles.splice(i,1);this.screenShake=10;}
            } else if(obs.type==='sizeChange'){
                if(!this.player){if(obs.timer<=0){this.sizeChange=null;this.obstacles.splice(i,1);}continue;}
                if(obs.mode==='tiny'&&this.activeWind&&!this.overlayActive&&!this._inSpectator){
                    this.player.vx+=this.activeWind.force*this.activeWind.direction*1.5;
                }
                // 관람석이면 크기 변경 무시 (원본 유지)
                if(this._inSpectator && this.originalPlayerSize){
                    const P=this.player;
                    P.w=this.originalPlayerSize.w;P.h=this.originalPlayerSize.h;
                }
                if(obs.timer<=0){
                    const P=this.player,botY=P.y+P.h;
                    if(this.originalPlayerSize){P.w=this.originalPlayerSize.w;P.h=this.originalPlayerSize.h;}
                    P.y=botY-P.h;
                    this.sizeChange=null;this.obstacles.splice(i,1);
                }
            } else if(obs.type==='blackHole'){
                const all= this._gimmickTargets();
                all.forEach(e=>{
                    if(e.explodeTimer>0)return;
                    const dx=obs.x-e.x,dy=obs.y-(e.y+e.h/2);
                    const dist=Math.sqrt(dx*dx+dy*dy);
                    if(dist<obs.radius&&dist>0){
                        const proximity=(obs.radius-dist)/obs.radius;
                        // 극강 흡입: proximity³ * 12 — 거의 탈출 불가
                        const force=obs.strength*proximity*proximity*proximity*12;
                        e.vx+=(dx/dist)*force;e.vy+=(dy/dist)*force;
                        // 속도 강제 제한: 블랙홀 반대 방향 속도 거의 차단
                        const dotX=e.vx*(-dx/dist), dotY=e.vy*(-dy/dist);
                        const escapeVel=dotX+dotY;
                        if(escapeVel>0){
                            // 탈출 방향 속도를 proximity에 비례해서 제거
                            const kill=Math.min(1, proximity*proximity*0.95);
                            e.vx+=(-dx/dist)*escapeVel*kill;
                            e.vy+=(-dy/dist)*escapeVel*kill;
                        }
                        // 이동 저항: 가까울수록 거의 못 움직임
                        const drag=Math.max(0.02, 1-0.95*proximity*proximity);
                        e.vx*=drag;e.vy*=drag;
                        // 핵심부 진입 시 폭발적 방출
                        if(dist<50){
                            const angle=Math.random()*Math.PI*2;
                            e.vx=Math.cos(angle)*20;e.vy=Math.sin(angle)*18-10;
                            e.stunTimer=150;
                        }
                    }
                });
                if(this.frameCount%2===0){
                    const angle=Math.random()*Math.PI*2,r=80+Math.random()*obs.radius;
                    this.particles.push({x:obs.x+Math.cos(angle)*r,y:obs.y+Math.sin(angle)*r,
                        vx:-Math.cos(angle)*4,vy:-Math.sin(angle)*4,
                        color:['#8B5CF6','#6366F1','#A78BFA','#C4B5FD'][Math.floor(Math.random()*4)],
                        size:2+Math.random()*4,life:30+Math.random()*20,maxLife:50,type:'fire'});
                }
                obs.strength=0.7+Math.sin(this.frameCount*0.02)*0.2;
                if(this.blackHole)this.blackHole.strength=obs.strength;
                if(obs.timer<=0){
                    this.blackHole=null;
                    for(let j=0;j<40;j++){
                        const a=Math.random()*Math.PI*2,s=3+Math.random()*8;
                        this.particles.push({x:obs.x,y:obs.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
                            color:['#8B5CF6','#EC4899','#3B82F6'][Math.floor(Math.random()*3)],
                            size:3+Math.random()*5,life:30+Math.random()*30,maxLife:60,type:'fire'});
                    }
                    this.screenShake=15;this.obstacles.splice(i,1);
                }
            } else if(obs.type==='ghostPlatforms'){
                this.ghostLightningTimer++;
                if(this.ghostLightningTimer>=obs.lightningInterval){
                    this.ghostLightningVisible=true;this.ghostLightningTimer=0;this.screenShake=6;
                }
                if(this.ghostLightningVisible&&this.ghostLightningTimer>60) this.ghostLightningVisible=false;
                if(obs.timer<=0){
                    this.ghostPlatforms=[];this.ghostLightningVisible=false;
                    if(this._hiddenPlatforms){this._hiddenPlatforms.forEach(p=>{ delete p._ghostHidden; });this._hiddenPlatforms=null;}
                    this.obstacles.splice(i,1);
                }
            } else if(obs.type==='redLightGreenLight'){
                const rl=this.redLightGreenLight;
                if(rl){
                    rl.timer++;
                    if(rl.phase==='green'){
                        // 글자 하나씩 표시
                        const newCount = Math.min(rl.chars.length, Math.floor(rl.timer / rl.charInterval) + 1);
                        if(newCount > rl.displayedChars){
                            rl.displayedChars = newCount;
                            this.screenShake = 2;
                        }
                        if(rl.timer>=rl.greenDuration){
                            rl.phase='red';rl.timer=0;
                            rl.savedPlayerPos=this.player?{x:this.player.x,y:this.player.y}:{x:0,y:0};
                            rl.caught=false;
                            rl.displayedChars = 0;
                            this.chatBubbles.push({x:rl.eyeX,y:rl.eyeY+50,text:'🔴 멈춰!!!',timer:90,follow:null});
                            this.screenShake=8;
                        }
                    } else {
                        if(!this.player) continue;
                        const P=this.player;
                        // 키 입력만 판정 (바람 등 외부 힘으로 밀려난 건 무시)
                        const isMoving=!this.overlayActive&&(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']||this.keys['ArrowRight']||this.keys['d']||this.keys['D']||this.keys['ArrowUp']||this.keys['w']||this.keys['W']);
                        if(isMoving&&rl.caughtTimer<=0&&P.stunTimer<=0&&!this._inSpectator){
                            rl.caught=true;rl.caughtTimer=50;
                            // 우리편 골대로 강제 순간이동
                            const ownGoalX = P.team==='right' ? this.W-60 : 60;
                            const ownGoalY = this.H-15-60; // 골대 중앙 높이
                            P.x=ownGoalX;P.y=ownGoalY;
                            P.vx=0;P.vy=0;P.stunTimer=90;
                            this.screenShake=10;
                            this.chatBubbles.push({x:P.x,y:P.y-45,text:'🔴 걸렸다! 강제이동!',timer:90,follow:P,isPlayer:true});
                            for(let j=0;j<20;j++){
                                this.particles.push({x:P.x,y:P.y+15,vx:(Math.random()-.5)*6,vy:-Math.random()*4-1,
                                    color:'#FF0000',size:3+Math.random()*3,life:20+Math.random()*15,maxLife:35,type:'fire'});
                            }
                        }
                        this._rtGetRemoteArray().forEach(n=>{
                            if(n.stunTimer>0)return;
                            if(Math.abs(n.vx)>0.3){
                                if(Math.random()<0.08){
                                    // NPC도 우리편 골대로 순간이동
                                    const nGoalX = n.team==='right' ? this.W-60 : 60;
                                    n.x=nGoalX;n.y=this.H-15-60;
                                    n.vx=0;n.vy=0;n.stunTimer=70;
                                    this.chatBubbles.push({x:n.x,y:n.y-45,text:'🔴 걸렸다!',timer:70,follow:n});
                                    for(let j=0;j<12;j++){
                                        this.particles.push({x:n.x,y:n.y+15,vx:(Math.random()-.5)*5,vy:-Math.random()*3-1,
                                            color:'#FF0000',size:2+Math.random()*3,life:18+Math.random()*12,maxLife:30,type:'fire'});
                                    }
                                } else {
                                    n.vx*=0.1;
                                }
                            }
                        });
                        if(rl.timer>=rl.redDuration){
                            rl.phase='green';rl.timer=0;rl.displayedChars=0;
                            this.chatBubbles.push({x:rl.eyeX,y:rl.eyeY+50,text:'🟢 무궁화 꽃이 피었습니다!',timer:90,follow:null});
                        }
                    }
                    if(rl.caughtTimer>0) rl.caughtTimer--;
                }
                if(obs.timer<=0){this.redLightGreenLight=null;this.obstacles.splice(i,1);}
            } else if(obs.type==='tsunami'){
                if(obs.warningTimer>0){
                    obs.warningTimer--;
                    if(obs.warningTimer>0&&obs.warningTimer%20===0) this.screenShake=Math.max(this.screenShake,5);
                } else {
                    obs.active=true;
                    obs.x+=obs.direction*obs.speed;
                    this.screenShake=Math.max(this.screenShake,6);
                    const waveTop=this.H-obs.waveHeight-30;
                    const all=this._gimmickTargets();
                    all.forEach(e=>{
                        if(e.y+e.h<waveTop) return;
                        const distToWave=Math.abs(e.x-obs.x);
                        if(distToWave<50){
                            e.vx+=obs.direction*7;e.vy=-6;e.onGround=false;
                            if(!e.stunTimer||e.stunTimer<30)e.stunTimer=30;
                        } else if(obs.direction>0?e.x>obs.x&&e.x<obs.x+120:e.x<obs.x&&e.x>obs.x-120){
                            e.vx+=obs.direction*1.5;
                        }
                    });
                    if(this.frameCount%2===0){
                        for(let p=0;p<3;p++){
                            this.particles.push({x:obs.x+(Math.random()-.5)*30,y:this.H-Math.random()*obs.waveHeight,
                                vx:obs.direction*(2+Math.random()*4),vy:-Math.random()*5-2,
                                color:['#1E90FF','#00BFFF','#87CEEB','#E0F0FF'][Math.floor(Math.random()*4)],
                                size:3+Math.random()*5,life:25+Math.random()*20,maxLife:45,type:'fire'});
                        }
                    }
                }
                if(obs.timer<=0||(obs.active&&((obs.direction>0&&obs.x>this.W+200)||(obs.direction<0&&obs.x<-200)))){
                    this.obstacles.splice(i,1);
                }
            } else if(obs.type==='earthquake'){
                obs.rumblePhase+=0.15;
                if(this.frameCount%45===0){
                    const all=this._gimmickTargets();
                    all.forEach(e=>{
                        if(e.onGround&&Math.random()<0.35){
                            e.vx+=(Math.random()-.5)*6;e.vy=-3-Math.random()*3;
                            e.onGround=false;
                            if(!e.stunTimer||e.stunTimer<20)e.stunTimer=20;
                        }
                    });
                }
                obs.debris.forEach(d=>{
                    if(d.delay>0){d.delay--;return;}
                    if(!d.fallen){
                        d.vy+=0.4;d.y+=d.vy;
                        if(d.y>=this.H-30){
                            d.y=this.H-30;d.fallen=true;d.craterTimer=180;
                            const all=this._gimmickTargets();
                            all.forEach(e=>{
                                const dx=e.x-(d.x+d.w/2),dist=Math.abs(dx);
                                if(dist<100&&dist>0){const f=(100-dist)/100*7;e.vx+=(dx/dist)*f;e.vy=-5;if(dist<50)e.stunTimer=Math.max(e.stunTimer||0,60);}
                            });
                            for(let j=0;j<12;j++){
                                const a=Math.random()*Math.PI*2;
                                this.particles.push({x:d.x+d.w/2,y:this.H-20,vx:Math.cos(a)*(2+Math.random()*5),vy:Math.sin(a)*(-2-Math.random()*4),
                                    color:['#8B4513','#A0522D','#D2691E','#DEB887'][Math.floor(Math.random()*4)],
                                    size:2+Math.random()*4,life:25+Math.random()*20,maxLife:45,type:'fire'});
                            }
                        }
                    } else { d.craterTimer--; }
                });
                if(this.frameCount%3===0){
                    this.particles.push({x:Math.random()*this.W,y:this.H-15,vx:(Math.random()-.5)*2,vy:-1-Math.random()*2,
                        color:'rgba(180,160,120,0.5)',size:2+Math.random()*3,life:20+Math.random()*15,maxLife:35,type:'fire'});
                }
                if(obs.timer<=0)this.obstacles.splice(i,1);
            } else if(obs.type==='typhoon'){
                obs.angle+=0.05;
                obs.moveAngle=obs.moveAngle||0;
                obs.x+=Math.cos(obs.moveAngle)*1.8;
                obs.y+=Math.sin(obs.moveAngle)*1.2;
                if(obs.x<100||obs.x>this.W-100) obs.moveAngle=Math.PI-obs.moveAngle;
                if(obs.y<80||obs.y>this.H-150) obs.moveAngle=-obs.moveAngle;
                obs.x=Math.max(50,Math.min(this.W-50,obs.x));
                obs.y=Math.max(50,Math.min(this.H-80,obs.y));
                const all=this._gimmickTargets();
                all.forEach(e=>{
                    if(e.stunTimer>60)return;
                    const dx=e.x-obs.x,dy=(e.y+e.h/2)-obs.y;
                    const dist=Math.sqrt(dx*dx+dy*dy);
                    if(dist<obs.radius&&dist>0){
                        const proximity=(obs.radius-dist)/obs.radius;
                        // 밀어내는 힘: 가까울수록 강하게 튕겨냄
                        const repel=obs.strength*proximity*2.5;
                        e.vx+=(dx/dist)*repel;e.vy+=(dy/dist)*repel-1;
                        // 핵심부 진입 시 튕겨냄
                        if(dist<70){
                            e.vx=(dx/dist)*10;e.vy=(dy/dist)*8-4;
                            e.stunTimer=Math.max(e.stunTimer||0,50);
                        }
                    }
                });
                this.screenShake=Math.max(this.screenShake,4);
                if(Math.random()<0.7){
                    const a=Math.random()*Math.PI*2,r=50+Math.random()*250;
                    obs.spiralStreaks.push({angle:a,radius:r,speed:0.03+Math.random()*0.03,length:30+Math.random()*50,alpha:0.2+Math.random()*0.4,life:40+Math.random()*30});
                }
                obs.spiralStreaks=obs.spiralStreaks.filter(s=>{s.angle+=s.speed;s.radius-=1.5;s.life--;return s.life>0&&s.radius>10;});
                if(obs.timer<=0){
                    this.activeWind=null;this.obstacles.splice(i,1);this.screenShake=10;
                    for(let j=0;j<30;j++){const a=Math.random()*Math.PI*2,s=3+Math.random()*8;
                        this.particles.push({x:obs.x,y:obs.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
                            color:['#87CEEB','#B0C4DE','#DCDCDC'][Math.floor(Math.random()*3)],
                            size:2+Math.random()*4,life:25+Math.random()*25,maxLife:50,type:'fire'});}
                }
            }
        }
        // 호스트: 기믹 소멸 시 변화 감지 → 브로드캐스트
        if(this._isHost && this._rtBroadcastGimmick){
            const sig = this.obstacles.map(o=>o.type+o.timer).join(',');
            if(sig !== this._lastGimmickSig){
                this._lastGimmickSig = sig;
                this._rtBroadcastGimmick();
            }
        }
    },

    _hasConflict(type){
        const conflicts = {
            frogCurse:[],
            gravityReverse:['blackHole','earthquake'], blackHole:['gravityReverse'],
            redLightGreenLight:[],
            typhoon:['windGust'], earthquake:['gravityReverse'],
        };
        const blockers = conflicts[type]||[];
        return blockers.some(b=>this.obstacles.some(o=>o.type===b));
    },

    _shuffleDeck(){
        const allTypes = [
            'rotatingPlatform','meteor','bouncyZone','windGust',
            'frogCurse','gravityReverse','screenFlip','sizeChange',
            'blackHole','ghostPlatforms','redLightGreenLight',
            'tsunami','earthquake','typhoon',
        ];
        for(let i=allTypes.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[allTypes[i],allTypes[j]]=[allTypes[j],allTypes[i]];}
        this.gimmickDeck = allTypes;
    },

    _drawFromDeck(){
        const globalTypes = ['frogCurse','gravityReverse','redLightGreenLight','earthquake'];
        if(this.gimmickDeck.length===0) this._shuffleDeck();
        for(let i=0;i<this.gimmickDeck.length;i++){
            const t = this.gimmickDeck[i];
            if(this._hasConflict(t)) continue;
            if((t==='windGust'||t==='typhoon') && this.activeWind) continue;
            if(t==='tsunami' && this.obstacles.some(o=>o.type==='tsunami')) continue;
            if(globalTypes.includes(t) && this.obstacles.some(o=>o.type===t)) continue;
            this.gimmickDeck.splice(i,1);
            return t;
        }
        this._shuffleDeck();
        return 'meteor';
    },

    spawnRandomObstacle(){
        let type = this._drawFromDeck();

        if(type==='rotatingPlatform'){
            const cands = this.platforms.filter(p=>p.type!=='ground'&&p.type!=='spectator');
            if(cands.length===0) return;
            const shuffled = cands.sort(()=>Math.random()-.5);
            const count = 2 + Math.floor(Math.random()*2);
            let spawned = 0;
            for(let j=0;j<Math.min(count,shuffled.length);j++){
                const plat = shuffled[j];
                if(this.obstacles.some(o=>o.type==='rotatingPlatform'&&o.platform===plat)) continue;
                const dir = Math.random()>.5?1:-1;
                const speed = (0.04+Math.random()*0.03)*dir;
                this.obstacles.push({type:'rotatingPlatform',platform:plat,originalY:plat.y,originalX:plat.x,timer:420,angle:0,spinSpeed:speed});
                spawned++;
            }
            if(spawned>0){
                this.chatBubbles.push({x:this.W/2,y:this.H/2-60,text:'🌀 발판 회전!',timer:120,follow:null});
                this.screenShake = 8;
            }
        } else if(type==='meteor'){
            const meteorCount = 3 + Math.floor(Math.random()*3);
            for(let m=0;m<meteorCount;m++){
                const tx = 100+Math.random()*(this.W-200);
                const delay = m * (20+Math.floor(Math.random()*40));
                this.obstacles.push({type:'meteor',x:tx,y:-80,warningTimer:120+delay,impacted:false,craterTimer:0,shockwaveRadius:0,timer:520+delay});
            }
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'☄️ 운석 폭격!',timer:100,follow:null});
        } else if(type==='bouncyZone'){
            for(let bz=0;bz<3;bz++){
                const zx = 50+Math.random()*(this.W-200);
                const zw = 120+Math.random()*80;
                this.obstacles.push({type:'bouncyZone',x:zx,w:zw,timer:300});
                if(bz===0) this.chatBubbles.push({x:zx+zw/2,y:this.H-40,text:'🟢 바운스 x3!',timer:90,follow:null});
            }
        } else if(type==='windGust'){
            const dir = Math.random()>.5?1:-1;
            const force = 0.3+Math.random()*0.2;
            this.activeWind = {direction:dir, force};
            this.obstacles.push({type:'windGust',direction:dir,force,timer:300,streaks:[]});
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:dir>0?'🌪️ 강풍! →':'🌪️ ← 강풍!',timer:120,follow:null});
            this.screenShake = 6;
        } else if(type==='frogCurse'){
            this.reversedControls = true;
            this.obstacles.push({type:'frogCurse',timer:960});
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'🐸 청개구리 저주! 좌우상하 반전!',timer:150,follow:null});
            this.screenShake = 5;
        } else if(type==='screenFlip'){
            this.screenFlip = Math.random()>0.5?'horizontal':'vertical';
            this.obstacles.push({type:'screenFlip',timer:420,flipType:this.screenFlip});
            const label = this.screenFlip==='horizontal'?'좌우':'상하';
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'🔄 화면 '+label+' 반전!',timer:120,follow:null});
            this.screenShake = 10;
        } else if(type==='gravityReverse'){
            this.gravityReversed = true;
            this.obstacles.push({type:'gravityReverse',timer:420});
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'🔃 중력 역전!',timer:120,follow:null});
            this.screenShake = 15;
            this._gimmickTargets().forEach(e=>{e.vy=-8;e.onGround=false;});
            // 관람석 플레이어는 역전 안 함 (이미 _gimmickTargets에서 제외되지만 안전장치)
        } else if(type==='sizeChange'){
            if(!this.player) return;
            const mode = Math.random()>0.5?'giant':'tiny';
            this.sizeChange = mode;
            const P = this.player;
            this.originalPlayerSize = {w:P.w,h:P.h};
            if(!this._inSpectator){
                const botY = P.y + P.h;
                if(mode==='giant'){P.w=52;P.h=60;P.y=botY-60;}
                else {P.w=12;P.h=14;P.y=botY-14;}
            }
            this.obstacles.push({type:'sizeChange',timer:420,mode});
            // 관람석이면 플레이어 크기 원복
            if(this._inSpectator){
                P.w=this.originalPlayerSize.w;P.h=this.originalPlayerSize.h;
            }
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:mode==='giant'?'🔴 거대화!':'🔵 소형화!',timer:120,follow:null});
            this.screenShake = 8;
        } else if(type==='blackHole'){
            const bx = 200+Math.random()*(this.W-400);
            const by = 200+Math.random()*(this.H-400);
            this.blackHole = {x:bx,y:by,strength:0.7,radius:400};
            this.obstacles.push({type:'blackHole',x:bx,y:by,timer:480,radius:400,strength:0.7});
            this.chatBubbles.push({x:bx,y:by-40,text:'🕳️ 블랙홀 생성!',timer:120,follow:null});
            this.screenShake = 12;
        } else if(type==='ghostPlatforms'){
            const removable = this.platforms.filter(p=>p.type!=='ground'&&p.type!=='spectator');
            const removeCount = Math.max(1, Math.floor(removable.length / 3));
            const shuffled = removable.sort(()=>Math.random()-.5);
            this._hiddenPlatforms = shuffled.slice(0, removeCount);
            this._hiddenPlatforms.forEach(p=>{ p._ghostHidden = true; });
            this.ghostLightningTimer = 0;
            this.ghostLightningVisible = false;
            this.obstacles.push({type:'ghostPlatforms',timer:600,lightningInterval:180});
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'👻 발판이 사라졌다!',timer:150,follow:null});
        } else if(type==='redLightGreenLight'){
            if(!this.player) return;
            const eyeX = this.W/2, eyeY = this.H/2 - 40;
            const chars = ['무','궁','화','꽃','이','피','었','습','니','다'];
            const charInterval = 18; // 글자당 18프레임 (약 0.3초)
            this.redLightGreenLight = {
                phase:'green',timer:0,
                greenDuration: chars.length * charInterval, // 글자 수 × 간격
                redDuration:180,
                eyeX,eyeY,savedPlayerPos:{x:this.player.x,y:this.player.y},
                caught:false,caughtTimer:0,
                chars, charInterval, displayedChars: 0
            };
            this.obstacles.push({type:'redLightGreenLight',timer:720});
            this.chatBubbles.push({x:eyeX,y:eyeY+50,text:'🟢 무궁화 꽃이 피었습니다!',timer:120,follow:null});
        } else if(type==='tsunami'){
            const dir = Math.random()>0.5 ? 1 : -1;
            const startX = dir > 0 ? -100 : this.W + 100;
            this.obstacles.push({type:'tsunami',direction:dir,x:startX,waveHeight:this.H*0.55,speed:2.5,timer:600,warningTimer:120,active:false});
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'🌊 해일이 온다! 높은 곳으로!',timer:150,follow:null});
            this.screenShake = 10;
        } else if(type==='earthquake'){
            const debris = [];
            for(let d=0;d<16;d++){
                debris.push({x:50+Math.random()*(this.W-100),y:-30-Math.random()*200,w:15+Math.random()*25,h:12+Math.random()*20,vy:0,fallen:false,craterTimer:0,delay:d*(10+Math.floor(Math.random()*20))});
            }
            this.obstacles.push({type:'earthquake',timer:480,intensity:1.0,debris:debris,rumblePhase:0});
            this.chatBubbles.push({x:this.W/2,y:this.H/2,text:'🌍 지진이다! 조심해!',timer:150,follow:null});
        } else if(type==='typhoon'){
            const tx = 150+Math.random()*(this.W-300);
            const ty = 100+Math.random()*(this.H-300);
            this.activeWind = {direction:0,force:0};
            this.obstacles.push({type:'typhoon',x:tx,y:ty,timer:600,radius:500,strength:0.3,angle:0,moveAngle:Math.random()*Math.PI*2,spiralStreaks:[]});
            this.chatBubbles.push({x:tx,y:ty-40,text:'🌪️ 태풍 발생!',timer:150,follow:null});
            this.screenShake = 15;
        }
    },

    applyBouncyZone(entity){
        if(!entity.onGround) return;
        for(const obs of this.obstacles){
            if(obs.type==='bouncyZone' && entity.x>=obs.x && entity.x<=obs.x+obs.w){
                if(entity.y+entity.h >= this.H-17){
                    entity.vy = this.JUMP_FORCE*3.5;
                    entity.onGround = false;
                    entity.jumpCount = 2;
                    for(let i=0;i<8;i++){
                        this.particles.push({x:entity.x,y:entity.y+entity.h,
                            vx:(Math.random()-.5)*6,vy:-Math.random()*5-2,
                            color:['#00FF80','#00FFAA','#80FFD0','#AAFFEE'][Math.floor(Math.random()*4)],
                            size:3+Math.random()*4,life:20+Math.random()*15,maxLife:35,type:'fire'});
                    }
                    this.screenShake = 4;
                    break;
                }
            }
        }
    },

    renderZones(ctx){
        // Ball now starts automatically - no zone rendering needed
    },
};
