import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Inventory } from './inventory.js';
import { Vote } from './vote.js';

export const GameRender = {

    updateProgress(){
        // 올라올라/크로스워드 등 자체 HUD 사용 게임은 스킵
        if(this.gameMode === 'ollaolla') return;
        let stageCount;
        if(this.gameMode === 'escaperoom'){
            stageCount = this.escapeRooms ? this.escapeRooms.length : 2;
        } else {
            const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
            stageCount = stageList?.length || 1;
        }
        let stageProgress;
        if(this.gameMode === 'escaperoom'){
            const totalQ = this.escapeQuizzes ? this.escapeQuizzes.length : 1;
            const solved = this.escapeQuizzes ? this.escapeQuizzes.filter(q=>q.solved).length : 0;
            stageProgress = this.door && this.door.open
                ? 0.5 + 0.5 * (this.playersAtDoor / this.totalPlayers)
                : (solved / totalQ) * 0.5;
        } else if(this.gameMode === 'numbermatch'){
            stageProgress = this.nmAllMatched
                ? 0.5 + 0.5 * (this.playersAtDoor / this.totalPlayers)
                : (this.nmMatchCount / Math.max(this.totalPlayers,1)) * 0.5;
        } else {
            const keysCollected = (this.stageKeys || []).filter(k=>k.collected).length;
            const keysTotal = (this.stageKeys || []).length || 1;
            stageProgress = this.door && this.door.open
                ? 0.5 + 0.5 * (this.playersAtDoor / this.totalPlayers)
                : (keysCollected / keysTotal) * 0.5;
        }
        const totalProgress = (this.stage + stageProgress) / stageCount;
        document.getElementById('hud-fill').style.width = (totalProgress*100)+'%';
    },

    updateHUD(){
        this.updateProgress();
        let stageCount;
        if(this.gameMode === 'escaperoom'){
            stageCount = this.escapeRooms ? this.escapeRooms.length : 2;
        } else {
            const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
            stageCount = stageList?.length || 1;
        }
        const m=Math.floor(this.remaining/60), s=this.remaining%60;
        document.getElementById('hud-timer').textContent = `⏱️ ${m}:${String(s).padStart(2,'0')} / 5:00`;
        document.getElementById('G-coins').textContent = Player.coins;
        const isCleared = Player.clearedGames.includes(this.gameMode);
        const gameInfo = Vote.GAMES.find(g => g.id === this.gameMode);
        const rewardText = isCleared ? '✅ 클리어 완료' : `🪙 현상금: ${gameInfo?.bounty || this.CLEAR_REWARD}코인`;
        if(this.gameMode === 'escaperoom'){
            const totalQ = this.escapeQuizzes ? this.escapeQuizzes.length : 0;
            const solved = this.escapeQuizzes ? this.escapeQuizzes.filter(q=>q.solved).length : 0;
            const clueTotal = this.escapeClues ? this.escapeClues.length : 0;
            const clueFound = this.escapeClues ? this.escapeClues.filter(c=>c.found).length : 0;
            document.getElementById('hud-stars').textContent = `Room ${this.stage+1}/${stageCount}  🔍 단서: ${clueFound}/${clueTotal}  ❓ 퀴즈: ${solved}/${totalQ}  ${rewardText}`;
            const el = document.getElementById('hud-mode');
            if(el && !el.textContent.startsWith('🚪')) el.textContent = '🚪 방탈출!';
        } else if(this.gameMode === 'numbermatch'){
            const cpCount = this.player.checkpoints ? this.player.checkpoints.length : 0;
            const myCP = this.player.currentCP || 0;
            document.getElementById('hud-stars').textContent = `Stage ${this.stage+1}/${stageCount}  완료: ${this.nmMatchCount}/${this.totalPlayers}  내 진행: ${myCP}/${cpCount}  ${rewardText}`;
            const el = document.getElementById('hud-mode');
            if(el && !el.textContent.startsWith('🔢')) el.textContent = '🔢 체크포인트 레이스!';
        } else {
            const keysCollected = (this.stageKeys || []).filter(k=>k.collected).length;
            const keysTotal = (this.stageKeys || []).length;
            document.getElementById('hud-stars').textContent = `Stage ${this.stage+1}/${stageCount}  🔑 ${keysCollected}/${keysTotal}  ${rewardText}`;
        }
        if(this.ghostMode){
            const el = document.getElementById('hud-mode');
            if(el && !el.textContent.includes('👻')) el.textContent += ' 👻';
        }
    },

    // ═══════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════
    render(){
        if(!this.ctx || !this.camera) return;
        const ctx = this.ctx;
        const cam = this.camera;
        const z = this.gameZoom || 1;
        const sw = this.screenW, sh = this.screenH;

        // Sky (화면 전체, 줌 전)
        const grad = ctx.createLinearGradient(0,0,0,sh);
        grad.addColorStop(0,'#0c0c24');
        grad.addColorStop(0.5,'#1a1a3e');
        grad.addColorStop(1,'#16213e');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,sw,sh);

        // === Zoom + Camera transform ===
        ctx.save();
        ctx.scale(z, z);

        // Grid pattern background
        ctx.strokeStyle='rgba(255,255,255,.02)';ctx.lineWidth=1;
        for(let x=(-cam.x%40);x<this.VW;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,this.VH);ctx.stroke();}
        for(let y=(-cam.y%40);y<this.VH;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.VW,y);ctx.stroke();}

        // Camera translate (within zoom)
        ctx.save();
        ctx.translate(-cam.x, -cam.y);

        // Platforms
        (this.platforms || []).forEach(p=>{
            if(p.x+p.w < cam.x-50 || p.x > cam.x+this.VW+50) return;
            if(p.type==='wall'){
                ctx.fillStyle='#636E72';
                ctx.fillRect(p.x, p.y, p.w, p.h);
                ctx.fillStyle='#74828A';
                ctx.fillRect(p.x, p.y, p.w, 3);
                return;
            }
            // Shadow
            ctx.fillStyle='rgba(0,0,0,.15)';
            ctx.fillRect(p.x+2,p.y+2,p.w,p.h);
            ctx.fillStyle=p.color;
            if(p.type==='ground'){
                ctx.fillRect(p.x,p.y,p.w,p.h);
                ctx.fillStyle='#6ab04c';
                ctx.fillRect(p.x,p.y,p.w,4);
                // Grass
                ctx.fillStyle='#81C784';
                for(let gx=10;gx<p.w;gx+=25+Math.sin(gx)*5){
                    ctx.fillRect(p.x+gx,p.y-2,2,3);
                }
            } else {
                ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,4);ctx.fill();
                if(p.type==='magic'){
                    ctx.fillStyle='rgba(108,92,231,.08)';
                    ctx.fillRect(p.x-5,p.y-5,p.w+10,p.h+10);
                }
            }
        });

        // ── Number Match: number spots ──
        if(this.gameMode === 'numbermatch'){
            this._renderNumberSpots(ctx);
        }

        // ── Escape Room: quizzes, clues, pads ──
        if(this.gameMode === 'escaperoom'){
            this.renderEscapeQuizzes(ctx);
        }

        // ── Pico Park gimmicks ──
        if(this.gameMode !== 'numbermatch' && this.gameMode !== 'escaperoom'){
        // Bridges (visible ones)
        (this.bridges || []).forEach(br=>{
            if(!br.visible) return;
            ctx.fillStyle='rgba(0,184,148,.6)';
            ctx.fillRect(br.x, br.y, br.w, br.h);
            ctx.strokeStyle='#00B894';ctx.lineWidth=2;
            ctx.strokeRect(br.x, br.y, br.w, br.h);
            // Glow
            ctx.fillStyle='rgba(0,184,148,.1)';
            ctx.fillRect(br.x-5, br.y-5, br.w+10, br.h+10);
        });

        // Elevators
        (this.elevators || []).forEach(elev=>{
            ctx.fillStyle = elev.riders >= elev.required ? '#00B894' : '#636E72';
            ctx.fillRect(elev.x, elev.y, elev.w, elev.h);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`${elev.riders}/${elev.required}`, elev.x+elev.w/2, elev.y-4);
            // Rails
            ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(elev.x,elev.minY);ctx.lineTo(elev.x,elev.maxY+elev.h);ctx.stroke();
            ctx.beginPath();ctx.moveTo(elev.x+elev.w,elev.minY);ctx.lineTo(elev.x+elev.w,elev.maxY+elev.h);ctx.stroke();
        });

        // Push Blocks
        (this.pushBlocks || []).forEach(block=>{
            if(block.pushed) return;
            const shaking = block.pushers.size > 0 && block.pushers.size < block.required;
            const sx = shaking ? (Math.random()-0.5)*3 : 0;
            ctx.fillStyle = block.pushing ? '#FDCB6E' : '#8D6E63';
            ctx.fillRect(block.x+sx, block.y, block.w, block.h);
            ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 2;
            ctx.strokeRect(block.x+sx, block.y, block.w, block.h);
            // Number label
            ctx.fillStyle='#fff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';
            ctx.fillText(`${block.pushers.size}/${block.required}`, block.x+block.w/2+sx, block.y+block.h/2+5);
        });

        // Pressure Plates + visual connection to linked keys
        (this.plates || []).forEach(plate=>{
            ctx.fillStyle = plate.active ? '#00B894' : '#E17055';
            ctx.fillRect(plate.x, plate.y, plate.w, plate.active?6:10);

            // Draw connection line from plate to linked key(s)
            const plateCX = plate.x + plate.w/2;
            const plateCY = plate.y;
            (this.stageKeys || []).forEach(key=>{
                if(key.collected) return;
                if(key.gateType !== 'plate' || key.gateId !== plate.linkedId) return;
                const kt = Date.now()*0.004;
                const keyCX = key.x + key.w/2;
                const keyCY = key.y + Math.sin(kt)*5 + key.h/2;
                ctx.save();
                if(plate.active){
                    // Active: bright green chain with particles
                    ctx.strokeStyle='rgba(0,184,148,.6)';
                    ctx.lineWidth=2;
                    ctx.setLineDash([6,4]);
                    ctx.lineDashOffset = -Date.now()*0.05; // animate dash flow
                    ctx.beginPath();ctx.moveTo(plateCX,plateCY);ctx.lineTo(keyCX,keyCY);ctx.stroke();
                    ctx.setLineDash([]);
                    // "Unlocked" burst near key
                    ctx.fillStyle='rgba(0,184,148,.25)';
                    const r = 16 + Math.sin(Date.now()*0.006)*4;
                    ctx.beginPath();ctx.arc(keyCX, keyCY, r, 0, Math.PI*2);ctx.fill();
                    // 🔓 icon near key
                    ctx.globalAlpha=0.9;ctx.font='12px sans-serif';ctx.textAlign='center';
                    ctx.fillText('🔓', keyCX+16, keyCY-8);
                } else {
                    // Inactive: dim dotted line with lock
                    ctx.strokeStyle='rgba(225,112,85,.25)';
                    ctx.lineWidth=1;
                    ctx.setLineDash([3,6]);
                    ctx.beginPath();ctx.moveTo(plateCX,plateCY);ctx.lineTo(keyCX,keyCY);ctx.stroke();
                    ctx.setLineDash([]);
                }
                ctx.restore();
            });

            if(!plate.active){
                ctx.fillStyle='rgba(225,112,85,.2)';
                ctx.fillRect(plate.x-5, plate.y-15, plate.w+10, 20);
                ctx.fillStyle='#E17055';ctx.font='10px sans-serif';ctx.textAlign='center';
                ctx.fillText('▼밟아!', plate.x+plate.w/2, plate.y-5);
            } else {
                // Glow when active
                ctx.fillStyle='rgba(0,184,148,.15)';
                ctx.beginPath();ctx.arc(plate.x+plate.w/2,plate.y,25,0,Math.PI*2);ctx.fill();
            }
        });
        } // end picopark/escaperoom gimmicks

        // Hazards
        (this.hazards || []).forEach(hz=>{
            if(hz.type==='spike'){
                ctx.fillStyle='#636E72';
                for(let sx=hz.x;sx<hz.x+hz.w;sx+=12){
                    ctx.beginPath();
                    ctx.moveTo(sx, hz.y+hz.h);
                    ctx.lineTo(sx+6, hz.y);
                    ctx.lineTo(sx+12, hz.y+hz.h);
                    ctx.closePath(); ctx.fill();
                }
            } else if(hz.type==='lava'){
                ctx.fillStyle='#FF4500';
                ctx.fillRect(hz.x,hz.y,hz.w,hz.h);
                // Bubbles
                const t = Date.now()*0.003;
                ctx.fillStyle='#FF8C00';
                for(let i=0;i<3;i++){
                    const bx = hz.x + hz.w*(0.2+0.3*i) + Math.sin(t+i)*5;
                    const by = hz.y + Math.sin(t*2+i*2)*3;
                    ctx.beginPath();ctx.arc(bx,by,3+Math.sin(t+i),0,Math.PI*2);ctx.fill();
                }
            }
        });

        // Keys (multiple) - picopark only — 잠금/해제 시각 피드백
        if(this.gameMode !== 'numbermatch' && this.gameMode !== 'escaperoom'){
        (this.stageKeys || []).forEach((key,ki)=>{
            if(key.collected) return;
            const t=Date.now()*0.004 + ki*1.5;
            const ky = key.y + Math.sin(t)*5;
            const unlocked = key._unlocked !== undefined ? key._unlocked : this.isKeyUnlocked(key);
            const cx = key.x+key.w/2, cy = ky+key.h/2;
            ctx.save();
            if(!unlocked){
                // 잠긴 열쇠: 반투명 + 회색 톤
                ctx.globalAlpha = 0.4;
                ctx.font='24px sans-serif';ctx.textAlign='center';
                ctx.fillText('🔑', cx, cy+8);
                // 자물쇠 아이콘
                ctx.globalAlpha = 0.8;
                ctx.font='14px sans-serif';
                ctx.fillText('🔒', cx+14, cy-6);
                // 어두운 글로우
                ctx.globalAlpha = 0.1;
                ctx.fillStyle='rgba(100,100,100,.3)';
                ctx.beginPath();ctx.arc(cx, cy, 18, 0, Math.PI*2);ctx.fill();
            } else {
                // 해제된 열쇠: 밝은 금색 + 반짝 이펙트
                ctx.font='24px sans-serif';ctx.textAlign='center';
                ctx.fillText('🔑', cx, cy+8);
                // 밝은 글로우
                ctx.fillStyle='rgba(255,215,0,.2)';
                ctx.beginPath();ctx.arc(cx, cy, 22+Math.sin(t*2)*6, 0, Math.PI*2);ctx.fill();
                // 반짝 효과
                ctx.fillStyle='rgba(255,255,200,.3)';
                ctx.beginPath();ctx.arc(cx+Math.cos(t*3)*8, cy+Math.sin(t*3)*8, 3, 0, Math.PI*2);ctx.fill();
                // 쌓기 힌트: gateType 없는 높은 열쇠
                if(!key.gateType){
                    ctx.globalAlpha = 0.7 + Math.sin(t*2)*0.3;
                    ctx.font='bold 11px sans-serif';ctx.textAlign='center';
                    ctx.fillStyle='#FDCB6E';
                    ctx.fillText('↑쌓아!', cx, cy+28);
                    // 쌓기 실루엣 힌트 (아래에 작은 사람 아이콘들)
                    ctx.globalAlpha = 0.3;
                    ctx.font='14px sans-serif';
                    ctx.fillText('🧍', cx-6, cy+50);
                    ctx.fillText('🧍', cx+6, cy+50);
                    ctx.fillText('🧍', cx, cy+36);
                }
            }
            ctx.restore();
        });
        }

        // Door
        if(this.door){
            ctx.fillStyle = this.door.open ? '#00B894' : '#636E72';
            ctx.fillRect(this.door.x, this.door.y, this.door.w, this.door.h);
            ctx.strokeStyle = this.door.open ? '#00E5A0' : '#455A64';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.door.x, this.door.y, this.door.w, this.door.h);
            // Door icon
            ctx.font='20px sans-serif';ctx.textAlign='center';
            ctx.fillText(this.door.open?'🚪':'🔒', this.door.x+this.door.w/2, this.door.y+this.door.h/2+7);
            // Player count at door
            if(this.door.open){
                ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';
                ctx.fillText(`${this.playersAtDoor}/${this.totalPlayers}`, this.door.x+this.door.w/2, this.door.y-8);
                // Waiting indicator when player inside
                if(this.player.enteredDoor && this.playersAtDoor < this.totalPlayers){
                    const remaining = this.totalPlayers - this.playersAtDoor;
                    ctx.fillStyle='rgba(0,0,0,.7)';ctx.font='bold 12px sans-serif';
                    const wtxt = `⏳ ${remaining}명 대기 중...`;
                    const wtw = ctx.measureText(wtxt).width+16;
                    ctx.beginPath();ctx.roundRect(this.door.x+this.door.w/2-wtw/2, this.door.y-35, wtw, 20, 6);ctx.fill();
                    ctx.fillStyle='#FDCB6E';
                    ctx.fillText(wtxt, this.door.x+this.door.w/2, this.door.y-22);
                }
            }
        }

        // ── Entities (sorted by y for depth) ──
        const entities = [];
        if(this.player && !this.player.enteredDoor && (!this.player.dead || this.ghostMode)){
            entities.push({...this.player, isPlayer:true, ref:this.player});
        }
        (this.npcs || []).forEach(n=>{
            if(!n.enteredDoor && (!n.dead || this.ghostMode)){
                entities.push({...n, isNpc:true, ref:n});
            }
        });
        entities.sort((a,b)=>a.y-b.y);

        entities.forEach(e=>{
            if(!e.sprite) return; // 관전 더미 플레이어 스킵
            if(e.x < cam.x-60 || e.x > cam.x+this.VW+60) return;
            const ghost = e.ref.dead && this.ghostMode;
            if(ghost) ctx.globalAlpha = 0.4;

            // 추적 중인 NPC 하이라이트
            const isFollowed = this.spectatorMode && this._followTarget === e.ref;
            if(isFollowed){
                ctx.save();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 0;
                ctx.beginPath(); ctx.arc(e.x, e.y-4, 24, 0, Math.PI*2); ctx.stroke();
                ctx.restore();
                // 추적 화살표
                const ay = e.y - 38 + Math.sin(Date.now()*0.005)*3;
                ctx.fillStyle='#FFD700'; ctx.font='14px sans-serif'; ctx.textAlign='center';
                ctx.fillText('▼', e.x, ay);
            }

            const flip = e.dir===-1;
            const S = 40; // 캐릭터 스프라이트 크기
            ctx.save();
            if(flip){ctx.translate(e.x,0);ctx.scale(-1,1);ctx.drawImage(e.sprite,-S/2,e.y-S/2-2,S,S);}
            else ctx.drawImage(e.sprite,e.x-S/2,e.y-S/2-2,S,S);
            ctx.restore();

            if(ghost){
                ctx.font='14px sans-serif';ctx.textAlign='center';
                ctx.fillText('👻',e.x,e.y-12);
            }

            // Player indicator
            if(e.isPlayer && !ghost){
                CharRender.renderHat(ctx, Player.equipped.hat, e.x, e.y-18, 16);
                const ay = e.y-32+Math.sin(Date.now()*0.005)*3;
                ctx.fillStyle='#FDCB6E';ctx.font='14px sans-serif';ctx.textAlign='center';
                ctx.fillText('▼',e.x,ay);
                if(Player.nickname){
                    ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='bold 10px sans-serif';
                    ctx.fillText(Player.nickname,e.x,e.y-22);
                }
            }

            // Checkpoint badge (number match mode)
            if(this.gameMode === 'numbermatch' && !ghost && e.ref.checkpoints){
                const badgeY = e.isPlayer ? e.y - 38 : e.y - 24;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.beginPath(); ctx.arc(e.x, badgeY, 10, 0, Math.PI*2); ctx.fill();
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if(e.ref.completedAll){
                    ctx.fillStyle = '#00B894';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText('\u2713', e.x, badgeY);
                } else {
                    const targetNum = e.ref.checkpoints[e.ref.currentCP];
                    ctx.fillStyle = '#FFD700';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.fillText(targetNum, e.x, badgeY);
                }
                ctx.textBaseline = 'alphabetic';
            }

            if(ghost) ctx.globalAlpha = 1;
        });

        // Chat bubbles (world space)
        this.chatBubbles.forEach(b=>{
            if(b.screen) return; // screen-space bubbles drawn later
            if(b.x < cam.x-100 || b.x > cam.x+this.VW+100) return;
            ctx.globalAlpha = Math.min(1, b.timer/20);
            ctx.font='bold 10px sans-serif';ctx.textAlign='center';
            const tw = ctx.measureText(b.text).width+12;
            ctx.fillStyle='rgba(0,0,0,.6)';
            ctx.beginPath();ctx.roundRect(b.x-tw/2,b.y-12,tw,17,6);ctx.fill();
            ctx.fillStyle='#fff';
            ctx.fillText(b.text,b.x,b.y);
        });
        ctx.globalAlpha=1;

        // Particles (world space)
        this.particles.forEach(p=>{
            const alpha = p.life/p.maxLife;
            ctx.globalAlpha = alpha;
            if(p.type==='heart'){
                ctx.font=`${10+alpha*4}px sans-serif`;ctx.textAlign='center';ctx.fillText('💖',p.x,p.y);
            } else if(p.type==='sparkle'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()*0.005+p.x);
                ctx.fillRect(-s/2,-0.5,s,1);ctx.fillRect(-0.5,-s/2,1,s);ctx.restore();
            } else if(p.type==='fire'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else if(p.type==='bubble'){
                ctx.strokeStyle=p.color;ctx.lineWidth=1;ctx.globalAlpha=alpha*0.7;
                ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);ctx.stroke();
                ctx.globalAlpha=alpha*0.15;ctx.fillStyle=p.color;ctx.fill();
            } else if(p.type==='leaf'){
                ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()*0.003+p.x);
                ctx.beginPath();ctx.ellipse(0,0,p.size*alpha,p.size*alpha*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(p.type==='petal'){
                ctx.fillStyle=p.color;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Date.now()*0.002+p.y);
                ctx.beginPath();ctx.ellipse(0,0,p.size*alpha*0.4,p.size*alpha,0,0,Math.PI*2);ctx.fill();ctx.restore();
            } else if(p.type==='snow'){
                ctx.fillStyle=p.color;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else if(p.type==='music'){
                ctx.font=`${8+alpha*5}px sans-serif`;ctx.textAlign='center';
                const notes=['♪','♫','♩'];ctx.fillText(notes[Math.floor(p.x)%3],p.x,p.y);
            } else if(p.type==='lightning'){
                ctx.strokeStyle=p.color;ctx.lineWidth=1.5;ctx.globalAlpha=alpha;
                ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+(Math.random()-.5)*8,p.y+(Math.random()-.5)*8);ctx.stroke();
                ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();
            } else if(p.type==='rainbow'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.6;const s=p.size*alpha;
                ctx.fillRect(p.x-s/2,p.y-1,s,2);
            } else if(p.type==='aurora'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.35;const s=p.size*alpha;
                ctx.beginPath();ctx.ellipse(p.x,p.y,s*1.5,s*0.6,0,0,Math.PI*2);ctx.fill();
            } else if(p.type==='pixel'){
                ctx.fillStyle=p.color;const s=Math.ceil(p.size*alpha);
                ctx.fillRect(Math.floor(p.x),Math.floor(p.y),s,s);
            } else if(p.type==='ghost'){
                ctx.fillStyle=p.color;ctx.globalAlpha=alpha*0.3;const s=p.size*alpha;
                ctx.beginPath();ctx.arc(p.x,p.y,s,0,Math.PI*2);ctx.fill();
            } else {
                ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);
            }
        });
        ctx.globalAlpha=1;

        ctx.restore(); // === End camera transform ===
        ctx.restore(); // === End zoom transform ===

        // === Screen-space HUD elements (화면 좌표, 줌 없음) ===

        // Screen-space chat (stage announcements)
        this.chatBubbles.forEach(b=>{
            if(!b.screen) return;
            ctx.globalAlpha = Math.min(1, b.timer/30);
            if(b.big){
                ctx.font='bold 18px sans-serif';ctx.textAlign='center';
                const tw = ctx.measureText(b.text).width+30;
                ctx.fillStyle='rgba(0,0,0,.7)';
                ctx.beginPath();ctx.roundRect(sw/2-tw/2,sh/3-15,tw,36,10);ctx.fill();
                ctx.fillStyle='#FDCB6E';
                ctx.fillText(b.text,sw/2,sh/3+8);
            } else {
                ctx.font='bold 13px sans-serif';ctx.textAlign='center';
                const tw = ctx.measureText(b.text).width+16;
                ctx.fillStyle='rgba(0,0,0,.65)';
                ctx.beginPath();ctx.roundRect(sw/2-tw/2,sh/4-10,tw,24,8);ctx.fill();
                ctx.fillStyle='#fff';
                ctx.fillText(b.text,sw/2,sh/4+5);
            }
        });
        ctx.globalAlpha=1;

        // 플레이어 이탈 알림
        if(this._leaveBubbles && this._leaveBubbles.length>0){
            this._leaveBubbles = this._leaveBubbles.filter(b=>b.timer-->0);
            this._leaveBubbles.forEach((b,i)=>{
                ctx.globalAlpha=Math.min(1,b.timer/30);
                ctx.font='bold 14px "Segoe UI",sans-serif';ctx.textAlign='center';
                const tw=ctx.measureText(b.text).width+20;
                ctx.fillStyle='rgba(180,0,0,.7)';
                ctx.beginPath();ctx.roundRect(sw/2-tw/2,60+i*30,tw,26,8);ctx.fill();
                ctx.fillStyle='#FFD700';
                ctx.fillText(b.text,sw/2,60+i*30+18);
            });
            ctx.globalAlpha=1;
        }

        // Escape room quiz/clue HUD
        if(this.gameMode === 'escaperoom' && this.escapeQuizzes){
            const quizzes = this.escapeQuizzes;
            const clues = this.escapeClues || [];
            const boxW = Math.max(180, quizzes.length * 40 + 20);
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath(); ctx.roundRect(10, 50, boxW, 56, 8); ctx.fill();
            // 단서 상태
            ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
            ctx.fillStyle = '#aaa';
            ctx.fillText(`단서: ${clues.filter(c=>c.found).length}/${clues.length}`, 16, 63);
            // 퀴즈 상태
            let xOff = 16;
            ctx.fillStyle = '#aaa';
            ctx.fillText('퀴즈:', 16, 78);
            xOff = 52;
            quizzes.forEach((q, i) => {
                if(q.solved){
                    ctx.fillStyle = 'rgba(0,184,148,0.3)';
                    ctx.beginPath(); ctx.roundRect(xOff, 70, 30, 22, 4); ctx.fill();
                    ctx.fillStyle = '#00B894';
                    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText('\u2713', xOff+15, 85);
                } else {
                    const progress = q.currentStep || 0;
                    const total = q.correctOrder ? q.correctOrder.length : 0;
                    ctx.fillStyle = progress > 0 ? 'rgba(255,215,0,0.2)' : 'rgba(108,92,231,0.2)';
                    ctx.beginPath(); ctx.roundRect(xOff, 70, 30, 22, 4); ctx.fill();
                    ctx.strokeStyle = progress > 0 ? '#FFD700' : '#6C5CE7'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.roundRect(xOff, 70, 30, 22, 4); ctx.stroke();
                    ctx.fillStyle = progress > 0 ? '#FFD700' : '#8e82d4';
                    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(`${progress}/${total}`, xOff+15, 85);
                }
                xOff += 36;
            });
            ctx.textAlign = 'left';
        }

        // Checkpoint sequence HUD
        if(this.gameMode === 'numbermatch' && this.player.checkpoints){
            const cps = this.player.checkpoints;
            const cur = this.player.currentCP || 0;
            const boxW = Math.max(120, cps.length * 32 + 20);
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath(); ctx.roundRect(10, 50, boxW, 42, 8); ctx.fill();
            ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
            ctx.fillStyle = '#aaa';
            ctx.fillText(this.player.completedAll ? '미션 완료!' : '체크포인트:', 16, 63);
            let xOff = 16;
            cps.forEach((num, i) => {
                if(i < cur){
                    // 완료
                    ctx.fillStyle = 'rgba(0,184,148,0.3)';
                    ctx.beginPath(); ctx.roundRect(xOff, 68, 26, 20, 4); ctx.fill();
                    ctx.fillStyle = '#00B894';
                    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText('\u2713', xOff+13, 82);
                } else if(i === cur){
                    // 현재 타겟
                    ctx.fillStyle = 'rgba(255,215,0,0.3)';
                    ctx.beginPath(); ctx.roundRect(xOff, 68, 26, 20, 4); ctx.fill();
                    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.roundRect(xOff, 68, 26, 20, 4); ctx.stroke();
                    ctx.fillStyle = '#FFD700';
                    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(num, xOff+13, 82);
                } else {
                    // 미진행
                    ctx.fillStyle = 'rgba(108,92,231,0.2)';
                    ctx.beginPath(); ctx.roundRect(xOff, 68, 26, 20, 4); ctx.fill();
                    ctx.fillStyle = '#8e82d4';
                    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(num, xOff+13, 82);
                }
                xOff += 30;
            });
            ctx.textAlign = 'left';
        }

        // Victory celebration overlay
        if(this.victoryTimer > 0){
            const vAlpha = Math.min(1, (180 - this.victoryTimer) / 30); // fade in
            ctx.fillStyle=`rgba(0,0,0,${vAlpha*0.3})`;
            ctx.fillRect(0,0,sw,sh);
            ctx.globalAlpha = vAlpha;
            ctx.font='bold 28px sans-serif';ctx.textAlign='center';
            ctx.fillStyle='#FFD700';
            ctx.fillText('🎉 축하합니다! 🎉',sw/2,sh/2-20);
            ctx.font='bold 16px sans-serif';
            ctx.fillStyle='#fff';
            const vCleared = Player.clearedGames.includes(this.gameMode);
            const vInfo = Vote.GAMES.find(g => g.id === this.gameMode);
            const vBounty = vCleared ? 0 : (vInfo?.bounty || this.CLEAR_REWARD);
            ctx.fillText(vBounty > 0 ? `전원 클리어! 🪙 +${vBounty} 현상금!` : '전원 클리어! (보상 없음)',sw/2,sh/2+15);
            ctx.globalAlpha=1;
        }

        // Ghost mode overlay
        if(this.ghostMode){
            ctx.fillStyle='rgba(84,160,255,.04)';ctx.fillRect(0,0,sw,sh);
            ctx.fillStyle='rgba(84,160,255,.5)';ctx.font='bold 12px sans-serif';ctx.textAlign='center';
            ctx.fillText('👻 유령 모드 – 죽어도 발판을 밟을 수 있어요!',sw/2,sh-12);
        }

        // ── Ball off-screen indicator arrow ──
        this._renderBallIndicator(ctx);

        // Minimap
        this._renderMinimap(ctx);
    },

    _renderBallIndicator(ctx){
        const b = this.ball;
        if(!b || this.ballResetTimer > 0) return;
        const cam = this.camera;
        const z = this.gameZoom || 1;
        const vw = this.VW, vh = this.VH;

        // Ball position in screen space (before zoom)
        const bsx = (b.x - cam.x) * z;
        const bsy = (b.y - cam.y) * z;
        const sw = this.screenW, sh = this.screenH;
        const margin = 40; // arrow distance from edge

        // Check if ball is within the visible screen
        if(bsx >= -20 && bsx <= sw + 20 && bsy >= -20 && bsy <= sh + 20) return;

        // Center of screen
        const cx = sw / 2, cy = sh / 2;
        // Angle from center to ball
        const angle = Math.atan2(bsy - cy, bsx - cx);

        // Clamp to screen edge with margin
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const maxX = (sw / 2) - margin, maxY = (sh / 2) - margin;
        let scale = Math.min(
            Math.abs(cosA) > 0.001 ? maxX / Math.abs(cosA) : 1e9,
            Math.abs(sinA) > 0.001 ? maxY / Math.abs(sinA) : 1e9
        );
        const ax = cx + cosA * scale;
        const ay = cy + sinA * scale;

        // Distance for opacity (farther = more opaque)
        const dist = Math.sqrt((bsx - cx) ** 2 + (bsy - cy) ** 2);
        const alpha = Math.min(1, 0.5 + dist / 2000);

        // Pulsing effect
        const pulse = 0.85 + Math.sin(Date.now() * 0.006) * 0.15;

        ctx.save();
        ctx.globalAlpha = alpha * pulse;
        ctx.translate(ax, ay);
        ctx.rotate(angle);

        // Arrow triangle
        const arrowSize = 14;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(arrowSize, 0);
        ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.6);
        ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.6);
        ctx.closePath();
        ctx.fill();

        // Glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Small ball icon behind arrow
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-arrowSize * 1.2, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Pentagon pattern on mini ball
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-arrowSize * 1.2, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    _renderMinimap(ctx){
        if(!this.screenW || !this.W || !this.H) return;
        const mw=140, mh=30, mx=this.screenW-mw-10, my=8;
        const scaleX=mw/this.W, scaleY=mh/this.H;
        ctx.fillStyle='rgba(0,0,0,.5)';
        ctx.beginPath();ctx.roundRect(mx,my,mw,mh,4);ctx.fill();
        // Platforms
        ctx.fillStyle='rgba(255,255,255,.15)';
        (this.platforms || []).forEach(p=>{
            if(p.type==='ground') return;
            ctx.fillRect(mx+p.x*scaleX, my+p.y*scaleY, Math.max(p.w*scaleX,1), Math.max(p.h*scaleY,1));
        });
        // Keys / Number spots / Escape room on minimap
        if(this.gameMode === 'escaperoom'){
            // 단서 (미발견=회색 점멸, 발견=금색)
            if(this.escapeClues) this.escapeClues.forEach(c=>{
                ctx.fillStyle = c.found ? '#FFD700' : '#888';
                ctx.beginPath();ctx.arc(mx+(c.x+10)*scaleX, my+c.y*scaleY, 1.5, 0, Math.PI*2);ctx.fill();
            });
            // 퀴즈 (미해결=보라, 해결=초록)
            if(this.escapeQuizzes) this.escapeQuizzes.forEach(q=>{
                ctx.fillStyle = q.solved ? '#00B894' : '#6C5CE7';
                ctx.beginPath();ctx.arc(mx+(q.x+q.w/2)*scaleX, my+q.y*scaleY, 2, 0, Math.PI*2);ctx.fill();
            });
        } else if(this.gameMode === 'numbermatch'){
            (this.numberSpots || []).forEach(spot=>{
                ctx.fillStyle = spot.isPlayerTarget ? '#FFD700' : (spot.isPlayerDone ? '#555' : '#6C5CE7');
                ctx.beginPath();ctx.arc(mx+(spot.x+spot.w/2)*scaleX, my+spot.y*scaleY, spot.isPlayerTarget ? 2.5 : 1.5, 0, Math.PI*2);ctx.fill();
            });
        } else {
            (this.stageKeys || []).forEach(key=>{
                if(key.collected) return;
                const unlocked = key._unlocked !== undefined ? key._unlocked : this.isKeyUnlocked?.(key);
                ctx.fillStyle = unlocked ? '#FFD700' : '#888';
                ctx.beginPath();ctx.arc(mx+key.x*scaleX, my+key.y*scaleY, 2, 0, Math.PI*2);ctx.fill();
            });
        }
        // Door
        if(this.door){
            ctx.fillStyle=this.door.open?'#00B894':'#636E72';
            ctx.fillRect(mx+this.door.x*scaleX, my+this.door.y*scaleY, 3, 4);
        }
        // Viewport
        ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;
        ctx.strokeRect(mx+this.camera.x*scaleX, my+this.camera.y*scaleY, this.VW*scaleX, this.VH*scaleY);
        // Player
        if(this.player){
            ctx.fillStyle='#FDCB6E';
            ctx.beginPath();ctx.arc(mx+this.player.x*scaleX, my+this.player.y*scaleY, 2.5, 0, Math.PI*2);ctx.fill();
        }
        // NPCs
        ctx.fillStyle='rgba(108,92,231,.6)';
        (this.npcs || []).forEach(n=>{
            if(n.dead && !this.ghostMode) return;
            ctx.beginPath();ctx.arc(mx+n.x*scaleX, my+n.y*scaleY, 1.2, 0, Math.PI*2);ctx.fill();
        });
    },

    _renderNumberSpots(ctx){
        if(!this.numberSpots) return;
        const cam = this.camera;
        const t = Date.now() * 0.003;
        this.numberSpots.forEach(spot => {
            if(spot.x+spot.w < cam.x-50 || spot.x > cam.x+this.VW+50) return;
            const cx = spot.x + spot.w/2;
            const pulse = 0.7 + Math.sin(t + spot.number) * 0.3;

            if(spot.isPlayerTarget){
                // ★ 현재 타겟: 금색 강조 펄스
                ctx.fillStyle = `rgba(255,215,0,${0.3*pulse})`;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 30, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(255,215,0,0.6)';
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 18, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 18, 0, Math.PI*2); ctx.stroke();
                // NEXT 표시
                ctx.fillStyle = '#FFD700'; ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('NEXT', cx, spot.y - 26);
            } else if(spot.isPlayerDone){
                // ★ 이미 완료: 회색 + 체크마크
                ctx.fillStyle = 'rgba(100,100,100,0.15)';
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 22, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(100,100,100,0.4)';
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 16, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#666'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 16, 0, Math.PI*2); ctx.stroke();
            } else {
                // ★ 중립: 보라색
                ctx.fillStyle = `rgba(108,92,231,${0.12*pulse})`;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 24, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = 'rgba(108,92,231,0.45)';
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 16, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#6C5CE7'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, spot.y-5, 16, 0, Math.PI*2); ctx.stroke();
            }

            // 번호 텍스트
            ctx.fillStyle = spot.isPlayerDone ? '#888' : '#fff';
            ctx.font = spot.isPlayerTarget ? 'bold 17px sans-serif' : 'bold 14px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(spot.number, cx, spot.y-4);

            if(spot.isPlayerDone){
                ctx.fillStyle = '#00B894'; ctx.font = 'bold 14px sans-serif';
                ctx.fillText('\u2713', cx+20, spot.y-14);
            }
            ctx.textBaseline = 'alphabetic';
        });
    },

    _spawnEffectTrail(){
        if(this.spectatorMode || !this.player) return;
        const effId = Player.equipped?.effect;
        if(!effId || !Inventory.EFFECT_COLORS[effId]) return;
        const P = this.player;
        if(P.dead && !this.ghostMode) return;
        const isMoving = Math.abs(P.vx) > 0.5 || Math.abs(P.vy) > 1;
        const chance = isMoving ? 0.4 : 0.06;
        if(Math.random() > chance) return;
        const colors = Inventory.EFFECT_COLORS[effId];
        const c = colors[Math.floor(Math.random()*colors.length)];
        const base = {x:P.x+(Math.random()-.5)*16, y:P.y+Math.random()*20};
        if(effId==='e_sparkle'){
            this.particles.push({...base,vx:-P.vx*0.2+(Math.random()-.5)*1.5,vy:-Math.random()*1.5-.5,color:c,size:2+Math.random()*3,life:25+Math.random()*20,maxLife:45,type:'sparkle'});
        } else if(effId==='e_heart'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y+Math.random()*10,vx:(Math.random()-.5)*1,vy:-Math.random()*2-.8,color:c,size:0,life:35+Math.random()*25,maxLife:60,type:'heart'});
        } else if(effId==='e_fire'||effId==='e_dragon'){
            for(let i=0;i<2;i++) this.particles.push({x:P.x+(Math.random()-.5)*14,y:P.y+15+Math.random()*10,vx:(Math.random()-.5)*1.2,vy:-Math.random()*2.5-1,color:c,size:3+Math.random()*3,life:18+Math.random()*15,maxLife:33,type:'fire'});
        } else if(effId==='e_bubble'){
            this.particles.push({...base,vx:(Math.random()-.5)*.8,vy:-Math.random()*1.5-.3,color:c,size:3+Math.random()*4,life:40+Math.random()*30,maxLife:70,type:'bubble'});
        } else if(effId==='e_leaf'||effId==='e_petal'){
            this.particles.push({...base,vx:(Math.random()-.5)*2,vy:-Math.random()*.5+.5,color:c,size:3+Math.random()*3,life:35+Math.random()*25,maxLife:60,type:effId==='e_petal'?'petal':'leaf'});
        } else if(effId==='e_snow'){
            this.particles.push({x:P.x+(Math.random()-.5)*30,y:P.y-5,vx:(Math.random()-.5)*.6,vy:Math.random()*.8+.3,color:c,size:2+Math.random()*3,life:40+Math.random()*30,maxLife:70,type:'snow'});
        } else if(effId==='e_star'){
            this.particles.push({...base,vx:(Math.random()-.5)*2.5,vy:-Math.random()*3-1,color:c,size:2+Math.random()*3,life:20+Math.random()*20,maxLife:40,type:'sparkle'});
        } else if(effId==='e_music'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y,vx:(Math.random()-.5)*1.5,vy:-Math.random()*2-1,color:c,size:0,life:30+Math.random()*20,maxLife:50,type:'music'});
        } else if(effId==='e_lightning'){
            for(let i=0;i<2;i++) this.particles.push({x:P.x+(Math.random()-.5)*10,y:P.y+Math.random()*20,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,color:c,size:2+Math.random()*2,life:8+Math.random()*10,maxLife:18,type:'lightning'});
        } else if(effId==='e_rainbow'){
            this.particles.push({x:P.x-P.vx*2+(Math.random()-.5)*6,y:P.y+10+Math.random()*10,vx:(Math.random()-.5)*.5,vy:-Math.random()*.3,color:c,size:3+Math.random()*3,life:25+Math.random()*15,maxLife:40,type:'rainbow'});
        } else if(effId==='e_aurora'){
            this.particles.push({x:P.x+(Math.random()-.5)*24,y:P.y-5+Math.random()*25,vx:(Math.random()-.5)*.4,vy:-Math.random()*.6-.2,color:c,size:4+Math.random()*4,life:30+Math.random()*25,maxLife:55,type:'aurora'});
        } else if(effId==='e_galaxy'){
            this.particles.push({...base,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,color:c,size:1.5+Math.random()*2.5,life:25+Math.random()*25,maxLife:50,type:'sparkle'});
        } else if(effId==='e_pixel'){
            this.particles.push({...base,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,color:c,size:3+Math.random()*2,life:15+Math.random()*15,maxLife:30,type:'pixel'});
        } else if(effId==='e_ghost'){
            this.particles.push({x:P.x+(Math.random()-.5)*20,y:P.y+Math.random()*15,vx:(Math.random()-.5)*.8,vy:-Math.random()*1-.3,color:c,size:4+Math.random()*4,life:30+Math.random()*20,maxLife:50,type:'ghost'});
        }
    },

    spawnParticles(x,y,color,n){
        for(let i=0;i<n;i++){
            this.particles.push({x,y,vx:(Math.random()-.5)*4,vy:-Math.random()*4-1,color,size:2+Math.random()*3,life:30+Math.random()*20,maxLife:50});
        }
    },

};
