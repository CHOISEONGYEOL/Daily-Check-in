// ── Ball Physics & Spawn (extracted from waiting-room.js) ──
import { Player } from './player.js';
import { Inventory } from './inventory.js';

export const WrBall = {
    updateBall(){
        const b = this.ball;
        if(!b) return;
        if(this.goalFlash > 0) this.goalFlash--;
        if(this.ballResetTimer > 0){
            this.ballResetTimer--;
            if(this.ballResetTimer <= 0){ b.x=this.W/2; b.y=this.H/2; b.vx=0; b.vy=0; }
            return;
        }
        b.vy += this.gravityReversed ? -this.BALL_GRAVITY : this.BALL_GRAVITY;
        if(this.gravityReversed ? b.vy < -this.BALL_MAX_VY : b.vy > this.BALL_MAX_VY) b.vy = this.gravityReversed ? -this.BALL_MAX_VY : this.BALL_MAX_VY;
        b.vx *= this.BALL_FRICTION;
        if(Math.abs(b.vx) < 0.1) b.vx = 0;
        const prevX = b.x, prevY = b.y;
        b.x += b.vx; b.y += b.vy;
        this.ballAngle += b.vx * 0.03;
        // Ground
        const gY = this.H - 30 - b.r;
        if(!this.gravityReversed && b.y >= gY){
            b.y=gY;
            let bounce=this.BALL_BOUNCE;
            for(const obs of this.obstacles){if(obs.type==='bouncyZone'&&b.x>=obs.x&&b.x<=obs.x+obs.w){bounce*=2;break;}}
            b.vy=-b.vy*bounce; if(Math.abs(b.vy)<1)b.vy=0; b.vx*=0.97;
        }
        if(this.gravityReversed && b.y >= gY){ b.y=gY; b.vy=-Math.abs(b.vy)*this.BALL_BOUNCE; }
        // Ceiling
        if(!this.gravityReversed && b.y <= b.r){ b.y=b.r; b.vy=Math.abs(b.vy)*this.BALL_BOUNCE; }
        if(this.gravityReversed && b.y <= b.r){
            b.y=b.r;
            let bounce=this.BALL_BOUNCE;
            for(const obs of this.obstacles){if(obs.type==='bouncyZone'&&b.x>=obs.x&&b.x<=obs.x+obs.w){bounce*=2;break;}}
            b.vy=Math.abs(b.vy)*bounce; if(Math.abs(b.vy)<1)b.vy=0; b.vx*=0.97;
        }
        // Walls & goals — swept collision: 이전/현재 위치 모두 검사하여 터널링 방지
        const ballYmin = Math.min(prevY, b.y);
        const ballYmax = Math.max(prevY, b.y);
        if(b.x-b.r<=0 || (prevX-b.r>0 && b.x-b.r<=0)){
            let scored=false;
            for(const g of this.goals){if(g.side==='left'&&ballYmax>g.y&&ballYmin<g.y+g.h){scored=true;break;}}
            if(scored){this.onGoal('left');return;}
            b.x=b.r; b.vx=Math.abs(b.vx)*this.BALL_BOUNCE;
        }
        if(b.x+b.r>=this.W || (prevX+b.r<this.W && b.x+b.r>=this.W)){
            let scored=false;
            for(const g of this.goals){if(g.side==='right'&&ballYmax>g.y&&ballYmin<g.y+g.h){scored=true;break;}}
            if(scored){this.onGoal('right');return;}
            b.x=this.W-b.r; b.vx=-Math.abs(b.vx)*this.BALL_BOUNCE;
        }
        // Platform collision (including ghost platforms, excluding hidden)
        const ballBasePlats = this._hiddenPlatforms ? this.platforms.filter(p=>!p._ghostHidden) : this.platforms;
        const ballPlats = this.ghostPlatforms.length>0
            ? [...ballBasePlats,...this.ghostPlatforms]
            : ballBasePlats;
        for(const p of ballPlats){
            if(p.type==='ground') continue;
            const cx=Math.max(p.x,Math.min(b.x,p.x+p.w));
            const cy=Math.max(p.y,Math.min(b.y,p.y+p.h));
            const dx=b.x-cx, dy=b.y-cy, dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<b.r){
                const ov=b.r-dist, nx=dist>0?dx/dist:0, ny=dist>0?dy/dist:-1;
                b.x+=nx*ov; b.y+=ny*ov;
                if(Math.abs(ny)>Math.abs(nx)) b.vy=-b.vy*this.BALL_BOUNCE;
                else b.vx=-b.vx*this.BALL_BOUNCE;
            }
        }
        // Stuck detection - no contact for 10 seconds → respawn
        if(this.ballGameStarted && this.frameCount - this.ballLastContactFrame > 600){
            b.x=this.W/2; b.y=this.H/2; b.vx=0; b.vy=0;
            this.ballLastContactFrame = this.frameCount;
        }
        this.checkBallEntityCollision();
    },

    checkBallEntityCollision(){
        const b=this.ball;
        if(!b||this.ballResetTimer>0) return;
        if(!this._ballTouchers) this._ballTouchers = [];
        const remotes = this._rtGetRemoteArray();
        const all = (this.overlayActive || !this.player) ? [...remotes] : [this.player,...remotes];
        for(const e of all){
            if(e.explodeTimer>0) continue;
            // ── Circle-vs-Circle collision (Pikachu Volleyball style) ──
            // Character as circle: center slightly above midpoint, generous radius
            const eCx = e.x;
            const eCy = e.y + e.h * 0.4;
            const eR = Math.max(e.w, e.h) * 0.65;
            const dx = b.x - eCx;
            const dy = b.y - eCy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const minDist = b.r + eR;
            if(dist < minDist){
                // Collision normal (entity center → ball center)
                const nx = dist > 0.01 ? dx/dist : 0;
                const ny = dist > 0.01 ? dy/dist : -1;
                // 1. Full separation — push ball completely outside
                b.x = eCx + nx * (minDist + 2);
                b.y = eCy + ny * (minDist + 2);
                // Record toucher
                this.ballLastContactFrame = this.frameCount;
                const name = e===this.player ? (Player.nickname||'나') : (e.displayName||'?');
                const team = e===this.player ? this.player.team : e.team;
                const existing = this._ballTouchers.find(t=>t.name===name);
                if(existing){ existing.frame=this.frameCount; existing.team=team; }
                else this._ballTouchers.push({name, frame:this.frameCount, team});
                // 2. Reflect velocity off collision normal
                const dot = b.vx*nx + b.vy*ny;
                if(dot < 0){
                    b.vx -= 2 * dot * nx;
                    b.vy -= 2 * dot * ny;
                }
                // Bounce damping
                b.vx *= 0.8;
                b.vy *= 0.8;
                // 3. Kick from character velocity
                let kick = e===this.player ? 1.8 : 1.0;
                if(e===this.player && this.sizeChange==='giant') kick = 2.5;
                if(e===this.player && this.sizeChange==='tiny') kick = 0.7;
                const boost = e.emote==='inflate' ? 1.5 : 1.0;
                b.vx += e.vx * kick * boost;
                b.vy += e.vy * kick * boost;
                // 4. Push force along normal (ensures ball always flies away)
                b.vx += nx * 5;
                b.vy += ny * 4;
                // 5. Minimum bounce speed for satisfying impact
                const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
                if(spd < 4 && spd > 0.01){ b.vx = b.vx/spd*4; b.vy = b.vy/spd*4; }
                // Cap max speed
                if(spd > 22){ b.vx *= 22/spd; b.vy *= 22/spd; }
                // Juggle: player under ball + jumping → bounce player
                if(e===this.player && ny < -0.5 && e.vy > 0){
                    e.vy = this.JUMP_FORCE * 0.6; e.jumpCount = 1;
                }
            }
        }
        // Clean old toucher records (60 frames = ~1 second)
        this._ballTouchers = this._ballTouchers.filter(t=>this.frameCount - t.frame < 60);
    },

    GOAL_REWARD: 3,    // 골당 코인 보상
    OG_PENALTY: 3,     // 자책골 코인 차감

    onGoal(side){
        // 골 판정은 호스트만 실행 (비호스트는 브로드캐스트로 수신)
        if(!this._isHost) return;
        if(side==='left') this.score.left++; else this.score.right++;
        this.goalFlash=90; this.goalFlashSide=side;
        this.ballResetTimer=120;
        // 골 넣은 사람 기록 + 자책골 판정
        // 왼쪽 골대에 들어감 → 오른쪽팀 득점, 터치한 사람이 왼쪽팀이면 자책골
        const scoringTeam = side==='left' ? 'right' : 'left';
        const touchers = (this._ballTouchers||[]);
        const scorers = touchers.map(t=>{
            const isOG = t.team && t.team !== scoringTeam;
            return isOG ? `${t.name}(OG)` : t.name;
        });
        const hasOG = touchers.some(t=>t.team && t.team !== scoringTeam);
        // 플레이어 골 보상: 터치 기록에 플레이어가 있고, 자책골이 아닐 때만
        const playerName = Player.nickname || '나';
        const playerTouch = touchers.find(t => t.name === playerName);
        if (playerTouch && playerTouch.team === scoringTeam && this.player) {
            Player.addCoins(this.GOAL_REWARD, 'goal');
            this.chatBubbles.push({x:this.player.x, y:this.player.y-55, text:`🪙 +${this.GOAL_REWARD}`, timer:90, follow:this.player});
            this._goalRewardMsg = {text:`⚽ 골! 🪙 +${this.GOAL_REWARD} 코인 획득!`, timer:120};
        } else if (playerTouch && playerTouch.team !== scoringTeam && this.player) {
            // 자책골: 코인 차감 (0 이하로 안 내려감)
            const penalty = Math.min(this.OG_PENALTY, Player.coins);
            if(penalty > 0) Player.addCoins(-penalty, 'own_goal');
            this.chatBubbles.push({x:this.player.x, y:this.player.y-55, text:`😱 -${this.OG_PENALTY}`, timer:90, follow:this.player});
            this._goalRewardMsg = {text:`🫣 자책골! 🪙 -${this.OG_PENALTY} 코인 차감!`, timer:120};
        }
        const now = new Date();
        const timeStr = now.getFullYear()+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+String(now.getDate()).padStart(2,'0')+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
        const teamColor = side==='left'?'#FF6B6B':'#4ECDC4';
        this.goalLog.push({scorers: scorers.length>0?scorers:['???'], time:timeStr, side, teamColor, hasOG});
        this._rtBroadcastGoal(side, scorers.length>0?scorers:['???'], hasOG, {...this.score});
        this._ballTouchers = [];
        // 골 채팅 버블
        const scorerText = scorers.length>0 ? scorers.join(', ') : '???';
        const goalLabel = hasOG ? '⚽ OG! 자책골!' : '⚽ GOAL!';
        this.chatBubbles.push({x:this.W/2,y:this.H/2-80,text:`${goalLabel} ${scorerText}`,timer:150,follow:null});
        const bx=side==='left'?20:this.W-20, by=this.H-90;
        for(let i=0;i<25;i++){
            this.particles.push({x:bx,y:by,vx:(Math.random()-.5)*8,vy:-Math.random()*6-2,
                color:['#FFD700','#FF6B6B','#4ECDC4','#A29BFE','#FF9FF3'][Math.floor(Math.random()*5)],
                size:3+Math.random()*3,life:40+Math.random()*30,maxLife:70,type:'fire'});
        }
    },

    // ── Ball Spawn Zone System ──
    initBallSpawnZones(){
        const H = this.H;
        this.ballSpawnZones = [
            {x:200, y:H-95, w:300, h:80, side:'left'},
            {x:1500, y:H-95, w:300, h:80, side:'right'}
        ];
    },

    isEntityInZone(e, zone){
        const eL=e.x-e.w/2, eR=e.x+e.w/2, eT=e.y, eB=e.y+e.h;
        return eR>zone.x && eL<zone.x+zone.w && eB>zone.y && eT<zone.y+zone.h;
    },

    updateBallSpawnCondition(){
        // Ball now starts automatically when first NPC arrives
    },

    spawnBallFirstTime(){
        if (this.battleMode) return; // 배틀 모드 중 공 스폰 차단
        this.ballGameStarted = true;
        this.ball = {x:this.W/2, y:this.H/2, vx:0, vy:0, r:this.BALL_R};
        this.ballLastContactFrame = this.frameCount;
        this.ballSpawnTimer = 0;
        this.chatBubbles.push({x:this.W/2, y:this.H/2-60, text:'⚽ 경기 시작!', timer:180, follow:null, isPlayer:false});
        for(let i=0;i<30;i++){
            this.particles.push({x:this.W/2,y:this.H/2,
                vx:(Math.random()-.5)*10,vy:-Math.random()*8-2,
                color:['#FFD700','#FF6B6B','#4ECDC4','#A29BFE'][Math.floor(Math.random()*4)],
                size:3+Math.random()*3,life:40+Math.random()*30,maxLife:70,type:'fire'});
        }
    },
};
