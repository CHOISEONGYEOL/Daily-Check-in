import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';
import { OTP } from './otp.js';
import { Inventory } from './inventory.js';
import { Vote } from './vote.js';
import { DB } from './db.js';
import { GameStages } from './game-stages.js';
import { GameAI } from './game-ai.js';
import { GamePhysics } from './game-physics.js';
import { GameMechanics } from './game-mechanics.js';
import { GameRender } from './game-render.js';
import { GameSpectator } from './game-spectator.js';

// Forward references
let Nav = null;
export function setNav(n) { Nav = n; }
let WaitingRoom = null;
export function setWaitingRoom(w) { WaitingRoom = w; }
let setupEditorKeys = null;
export function setSetupEditorKeys(fn) { setupEditorKeys = fn; }

// ── Blob sprite generator ──
export function makeBlobSprite(color, size) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'), r = size * 0.38;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(size/2, size*0.55, r, r*0.9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(size*0.38, size*0.48, size*0.08, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(size*0.62, size*0.48, size*0.08, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2D3436';
    ctx.beginPath(); ctx.arc(size*0.40, size*0.49, size*0.04, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(size*0.64, size*0.49, size*0.04, 0, Math.PI*2); ctx.fill();
    return c;
}

// =========================================================
// PICO PARK – 25-player cooperative platformer
// =========================================================
export const Game = {
    cvs:null, ctx:null,
    // World dimensions (scrollable)
    W:1600, H:600, VW:800, VH:600,
    running:false, completed:false,
    remaining:300, totalStudents:25,
    timerRef:null, animRef:null, keys:{},
    npcs:[], player:null, particles:[], chatBubbles:[],
    camera:{x:0, y:0},

    // ── Pico Park state ──
    stage:0,        // current stage index
    stageData:null, // current stage config
    stageKeys:[],   // [{x, y, w, h, collected:bool}, ...]
    door:null,      // {x, y, w, h, open:bool}
    pushBlocks:[],  // {x, y, w, h, required, pushers:Set}
    plates:[],      // {x, y, w, h, active, linkedId, type}
    bridges:[],     // {x, y, w, h, visible, linkedId}
    elevators:[],   // {x, y, w, h, minY, maxY, required, riders, dir}
    hazards:[],     // {x, y, w, h, type:'spike'|'lava'}
    platforms:[],   // {x, y, w, h, color, type}
    playersAtDoor:0,
    totalPlayers:0,
    ghostMode:false,
    deadPlayers:new Set(), // indices of dead NPCs

    // Reward
    CLEAR_REWARD: 50,
    victoryTimer: 0,
    doorLockCooldown: 0,

    // Game mode
    spectatorMode: false,
    _followTarget: null,     // 추적 중인 NPC 참조
    _spectatorCamMode: 'free', // 'free' = 전지적 시점 | 'pov' = 플레이어 시점
    gameMode: 'picopark', // 'picopark' | 'numbermatch'
    numberSpots: [],
    nmAllMatched: false,
    nmMatchCount: 0,

    // Camera zoom (1 = no zoom, 1.6 = zoomed in)
    gameZoom: 1.6,
    screenW: 800, screenH: 600, // actual canvas size in CSS px

    // Physics
    GRAVITY: 0.5, JUMP_FORCE: -10, MOVE_SPD: 3.2,

    // ── OTP verification + enter ──
    verifyAndEnter(){
        const input = document.getElementById('otp-input').value.trim();
        const errEl = document.getElementById('otp-error');
        if(!input){
            if(errEl){ errEl.textContent='코드를 입력하세요!'; errEl.classList.remove('hidden'); }
            return;
        }
        if(!OTP.verify(input)){
            if(errEl){ errEl.textContent='코드가 틀렸습니다! 다시 확인하세요.'; errEl.classList.remove('hidden'); }
            document.getElementById('otp-input').value='';
            return;
        }
        if(errEl) errEl.classList.add('hidden');
        const otpEl = document.getElementById('otp-input');
        otpEl.value='';
        otpEl.blur();
        OTP.stop();
        this.totalStudents = parseInt(document.getElementById('s-total').value)||25;
        Player.streak++;
        Player.save();
        Nav.go('waiting-room');
    },

    // ── Spawn effect on attendance ──
    spawnAttendEffect(){
        const effId = Player.equipped.effect;
        if(!effId || !Inventory.EFFECT_COLORS[effId]) return;
        const colors = Inventory.EFFECT_COLORS[effId];
        const cx=this.VW/2, cy=this.VH/2;
        for(let wave=0;wave<3;wave++){
            setTimeout(()=>{
                for(let i=0;i<15;i++){
                    const c=colors[Math.floor(Math.random()*colors.length)];
                    this.particles.push({x:cx+Math.random()*200-100, y:cy+Math.random()*100-50,
                        vx:(Math.random()-.5)*6, vy:-Math.random()*5-2,
                        color:c, size:3+Math.random()*4, life:40+Math.random()*30, maxLife:70});
                }
            }, wave*400);
        }
    },

    // ── Enter from waiting room ──
    enterFromWaitingRoom(gameId){
        this.remaining = 300;
        this.isMultiplayer = true;
        this.totalStudents = WaitingRoom.totalStudents || parseInt(document.getElementById('s-total').value) || 25;
        this.gameMode = gameId || (Math.random() < 0.5 ? 'picopark' : 'numbermatch');
        Nav.go('game');
        // 단체 게임에서는 나가기 버튼 숨김
        const quitBtn = document.querySelector('#game .hud .btn-back');
        if(quitBtn) quitBtn.style.display = 'none';
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        // maze는 독립 루프 사용 (attend 연출 없이 바로 시작)
        if(this.gameMode === 'maze'){
            document.getElementById('attend-overlay').classList.add('hidden');
            this.startMaze();
            return;
        }
        document.getElementById('attend-overlay').classList.remove('hidden');
        this.spawnAttendEffect();
        setTimeout(()=>{
            document.getElementById('attend-overlay').classList.add('hidden');
            if(this.gameMode === 'numbermatch') this.startNumberMatch();
            else this.startPicoPark();
        }, 1800);
    },

    // ── 교사 관전 모드 진입 ──
    enterAsSpectator(gameId){
        this.remaining = 300;
        this.isMultiplayer = true;
        this.spectatorMode = true;
        this.totalStudents = WaitingRoom.totalStudents || 25;
        this.gameMode = gameId || 'picopark';
        Nav.go('game');
        const quitBtn = document.querySelector('#game .hud .btn-back');
        if(quitBtn) quitBtn.style.display = 'none';
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        document.getElementById('attend-overlay').classList.add('hidden');
        // 관전 배지 표시
        const badge = document.getElementById('spectator-badge');
        if(badge){ badge.classList.remove('hidden'); badge.textContent = '🌐 전지적 시점 · 방향키: 카메라 · 클릭/Tab: 학생 시점 · +/-: 줌'; }
        // 게임 시작
        if(this.gameMode === 'maze'){
            this.startMaze();
            return;
        }
        if(this.gameMode === 'numbermatch') this.startNumberMatch();
        else this.startPicoPark();
    },

    // ── Direct enter (testing) ──
    enter(){
        this.totalStudents = parseInt(document.getElementById('s-total').value)||25;
        this.remaining = 300;
        this.gameMode = Math.random() < 0.5 ? 'picopark' : 'numbermatch';
        Player.streak++;
        Player.save();
        OTP.stop();
        Nav.go('game');
        document.getElementById('attend-overlay').classList.remove('hidden');
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        this.spawnAttendEffect();
        setTimeout(()=>{
            document.getElementById('attend-overlay').classList.add('hidden');
            if(this.gameMode === 'numbermatch') this.startNumberMatch();
            else this.startPicoPark();
        }, 1800);
    },

    // ═══════════════════════════════════════
    // PICO PARK START
    // ═══════════════════════════════════════
    startPicoPark(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.ghostMode = false;
        this.victoryTimer = 0;
        this.doorLockCooldown = 0;
        this.deadPlayers = new Set();
        this.particles = [];
        this.chatBubbles = [];
        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        // HiDPI / Retina support
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        this.loadStage(this.stage);
        this.createNPCs();

        // Create player (관전 모드: 더미 플레이어)
        if(this.spectatorMode){
            this.player = {
                x:-1000, y:-1000, vx:0, vy:0, w:24, h:28,
                onGround:true, dir:1, jumpCount:0, maxJumps:2,
                sprite:null, dead:false, ghostTimer:0, atDoor:false,
                enteredDoor:false, _spectatorDummy:true
            };
            this.totalPlayers = this.npcs.length;
            this.setupSpectatorInput();
        } else {
            const pxData = Player.pixels || parseTemplate(Templates[0]);
            const sd = this.stageData;
            this.player = {
                x:sd.spawnX, y:sd.spawnY, vx:0, vy:0, w:24, h:28,
                onGround:false, dir:1, jumpCount:0, maxJumps:2,
                sprite:CharRender.toOffscreen(pxData,64),
                dead:false, ghostTimer:0, atDoor:false
            };
            this.totalPlayers = this.npcs.length + 1;
            this.setupInput();
        }
        this.resize();

        // Timer
        clearInterval(this.timerRef);
        this.timerRef = setInterval(()=>{
            if(!this.running) return;
            this.remaining--;
            // Ghost mode at 60s remaining
            if(this.remaining <= 60 && !this.ghostMode){
                this.ghostMode = true;
                this.chatBubbles.push({x:this.VW/2,y:100,text:'👻 유령 모드! 죽은 플레이어도 발판을 밟을 수 있어요!',timer:150,follow:null,screen:true});
            }
            this.updateHUD();
            if(this.remaining <= 0) this.endGame(false);
        },1000);
        this.updateHUD();

        // Game loop
        cancelAnimationFrame(this.animRef);
        this._lastFrameTime = 0;
        const FRAME_MIN = 1000/61;
        const loop=(ts)=>{
            if(!document.getElementById('game').classList.contains('active')) return;
            if(ts - this._lastFrameTime < FRAME_MIN){ this.animRef=requestAnimationFrame(loop); return; }
            this._lastFrameTime = ts;
            this.update();
            this.render();
            this.animRef=requestAnimationFrame(loop);
        };
        this.animRef=requestAnimationFrame(loop);
    },

    // ═══════════════════════════════════════
    // NUMBER MATCH START
    // ═══════════════════════════════════════
    startNumberMatch(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.ghostMode = false;
        this.victoryTimer = 0;
        this.doorLockCooldown = 0;
        this.deadPlayers = new Set();
        this.particles = [];
        this.chatBubbles = [];
        this.nmAllMatched = false;
        this.nmMatchCount = 0;
        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        this.loadStage(this.stage);
        this.createNPCs();

        if(this.spectatorMode){
            this.player = {
                x:-1000, y:-1000, vx:0, vy:0, w:24, h:28,
                onGround:true, dir:1, jumpCount:0, maxJumps:2,
                sprite:null, dead:false, ghostTimer:0, atDoor:false,
                enteredDoor:false, _spectatorDummy:true
            };
            this.totalPlayers = this.npcs.length;
            this.assignNumbers();
            this.setupSpectatorInput();
        } else {
            const pxData = Player.pixels || parseTemplate(Templates[0]);
            const sd = this.stageData;
            this.player = {
                x:sd.spawnX, y:sd.spawnY, vx:0, vy:0, w:24, h:28,
                onGround:false, dir:1, jumpCount:0, maxJumps:2,
                sprite:CharRender.toOffscreen(pxData,64),
                dead:false, ghostTimer:0, atDoor:false
            };
            this.totalPlayers = this.npcs.length + 1;
            this.assignNumbers();
            this.setupInput();
        }
        this.resize();

        clearInterval(this.timerRef);
        this.timerRef = setInterval(()=>{
            if(!this.running) return;
            this.remaining--;
            if(this.remaining <= 60 && !this.ghostMode){
                this.ghostMode = true;
                this.chatBubbles.push({x:this.VW/2,y:100,text:'👻 유령 모드! 죽은 플레이어도 번호판에 올라갈 수 있어요!',timer:150,follow:null,screen:true});
            }
            this.updateHUD();
            if(this.remaining <= 0) this.endGame(false);
        },1000);
        this.updateHUD();

        cancelAnimationFrame(this.animRef);
        this._lastFrameTime = 0;
        const FRAME_MIN = 1000/61;
        const loop=(ts)=>{
            if(!document.getElementById('game').classList.contains('active')) return;
            if(ts - this._lastFrameTime < FRAME_MIN){ this.animRef=requestAnimationFrame(loop); return; }
            this._lastFrameTime = ts;
            this.update();
            this.render();
            this.animRef=requestAnimationFrame(loop);
        };
        this.animRef=requestAnimationFrame(loop);
    },

    resize(){
        const wrap = this.cvs.parentElement;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.dpr = dpr;
        const w = wrap.clientWidth;
        const h = Math.max(wrap.clientHeight - 80, 300);
        this.screenW = w;
        this.screenH = h;
        // VW/VH = 카메라가 보는 월드 영역 (줌 적용)
        const z = this.gameZoom || 1;
        this.VW = w / z;
        this.VH = h / z;
        this.cvs.width = w * dpr;
        this.cvs.height = h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    setupInput(){
        this.keys = {};
        window.onkeydown = e => {
            this.keys[e.key] = true;
            if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W'){
                e.preventDefault();
                this.playerJump();
            }
        };
        window.onkeyup = e => { this.keys[e.key] = false; };
        // Mobile
        document.querySelectorAll('.ctrl-btn').forEach(btn=>{
            const k=btn.dataset.key;
            const down=e=>{
                e.preventDefault();
                if(k==='left') this.keys['ArrowLeft']=true;
                if(k==='right') this.keys['ArrowRight']=true;
                if(k==='action'){ this.keys[' ']=true; this.playerJump(); }
            };
            const up=()=>{
                if(k==='left') this.keys['ArrowLeft']=false;
                if(k==='right') this.keys['ArrowRight']=false;
                if(k==='action') this.keys[' ']=false;
            };
            btn.onpointerdown=down; btn.onpointerup=up; btn.onpointerleave=up;
        });
    },

    playerJump(){
        const p = this.player;
        if(p.dead && !this.ghostMode) return;
        if(p.jumpCount < p.maxJumps){
            p.vy = this.JUMP_FORCE;
            p.jumpCount++;
            p.onGround = false;
        }
    },

    // ═══════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════
    update(){
        // Victory celebration phase (keep rendering particles/chat)
        if(this.victoryTimer > 0){
            this.victoryTimer--;
            this.particles = this.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=(p.type==='fire'?0.03:0.05);p.life--;return p.life>0;});
            this.chatBubbles = this.chatBubbles.filter(b=>{b.timer--;return b.timer>0;});
            if(this.victoryTimer <= 0){
                this.running = false;
                this.showVictoryReward();
            }
            return;
        }
        if(!this.running) return;

        // Player movement
        this.updatePlayer();
        // NPC AI
        this.updateNPCs();
        // Physics for all entities
        this.applyPhysics();
        // Entity-to-entity collision (stacking!)
        this.resolveEntityCollisions();
        // Game mode specific updates
        if(this.gameMode === 'numbermatch'){
            this.updateNumberSpots();
        } else {
            this.updatePushBlocks();
            this.updatePlates();
            this.updateElevators();
            this.updateKeyDoor();
        }
        // Hazards
        this.updateHazards();
        // Camera
        this.updateCamera();
        // Effect trail on player
        this._spawnEffectTrail();
        // Particles & chat
        this.particles = this.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=(p.type==='fire'?0.03:0.1);p.life--;return p.life>0;});
        this.chatBubbles = this.chatBubbles.filter(b=>{b.timer--;if(b.follow){b.x=b.follow.x;b.y=b.follow.y-20;}return b.timer>0;});
        // Check win
        this.checkStageComplete();
        // HUD progress
        this.updateProgress();
    },

    updatePlayer(){
        if(this.spectatorMode) return;
        const p = this.player;
        if(p.enteredDoor) return;
        if(p.dead && !this.ghostMode) {
            p.ghostTimer--;
            if(p.ghostTimer <= 0) this.respawnEntity(p);
            return;
        }
        const spd = this.MOVE_SPD;
        if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']){p.vx=-spd;p.dir=-1;}
        else if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']){p.vx=spd;p.dir=1;}
        else p.vx*=0.75;
        if(Math.abs(p.vx)<0.15) p.vx=0;
    },

    // ── Camera follows player group ──
    updateCamera(){
        if(this.spectatorMode){
            // 추적 대상이 문에 들어갔으면 전지적 시점으로 복귀
            if(this._followTarget && this._followTarget.enteredDoor){
                this._setSpectatorMode('free', null);
            }

            if(this._spectatorCamMode === 'pov' && this._followTarget){
                // ★ POV 모드: 학생이 보는 화면 그대로 재현 (빠른 추적)
                const tx = this._followTarget.x - this.VW/2;
                const ty = this._followTarget.y - this.VH/2;
                const cx = Math.max(0, Math.min(tx, this.W - this.VW));
                const cy = Math.max(0, Math.min(ty, this.H - this.VH));
                this.camera.x += (cx - this.camera.x) * 0.18;
                this.camera.y += (cy - this.camera.y) * 0.18;
            } else {
                // ★ 전지적 시점: 자유 카메라 (방향키/WASD)
                const spd = 6;
                if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) this.camera.x -= spd;
                if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']) this.camera.x += spd;
                if(this.keys['ArrowUp']||this.keys['w']||this.keys['W']) this.camera.y -= spd;
                if(this.keys['ArrowDown']||this.keys['s']||this.keys['S']) this.camera.y += spd;
                this.camera.x = Math.max(0, Math.min(this.camera.x, this.W - this.VW));
                this.camera.y = Math.max(0, Math.min(this.camera.y, this.H - this.VH));
            }
            return;
        }
        let targetX, targetY;
        if(this.player.enteredDoor && this.door){
            // Player entered door → camera stays on door area
            targetX = this.door.x + this.door.w/2 - this.VW/2;
            targetY = this.door.y + this.door.h/2 - this.VH/2;
        } else {
            targetX = this.player.x - this.VW/2;
            targetY = this.player.y - this.VH/2;
        }
        const clampX = Math.max(0, Math.min(targetX, this.W - this.VW));
        const clampY = Math.max(0, Math.min(targetY, this.H - this.VH));
        this.camera.x += (clampX - this.camera.x) * 0.08;
        this.camera.y += (clampY - this.camera.y) * 0.08;
    },

    checkStageComplete(){
        if(!this.door || !this.door.open) return;
        const aliveCount = [this.player, ...this.npcs].filter(e=>!e.dead).length;
        const stageList = this.gameMode === 'numbermatch' ? this.nmStages : this.stages;
        if(this.playersAtDoor >= aliveCount && aliveCount > 0){
            this.stage++;
            if(this.stage >= stageList.length){
                this.missionClear();
            } else {
                this.spawnParticles(this.door.x, this.door.y, '#00B894', 20);
                this.chatBubbles.push({
                    x:this.VW/2, y:this.VH/3,
                    text:'🎉 스테이지 클리어! 다음으로!',
                    timer:120, follow:null, screen:true, big:true
                });
                setTimeout(()=>{
                    this.loadStage(this.stage);
                    if(this.gameMode === 'numbermatch') this.assignNumbers();
                    const sd = this.stageData;
                    this.player.x = sd.spawnX;
                    this.player.y = sd.spawnY;
                    this.player.vx=0; this.player.vy=0;
                    this.player.dead = false; this.player.atDoor = false; this.player.enteredDoor = false;
                    this.npcs.forEach(n=>{
                        n.x = sd.spawnX + (Math.random()*200-100);
                        n.y = sd.spawnY - Math.random()*20;
                        n.vx=0; n.vy=0;
                        n.dead=false; n.atDoor=false; n.enteredDoor=false;
                        n.stuckTimer=0;
                    });
                }, 1500);
            }
        }
    },

    // ═══════════════════════════════════════
    // GAME END
    // ═══════════════════════════════════════
    missionClear(){
        if(this.completed) return;
        this.completed = true;
        clearInterval(this.timerRef);
        // Keep game running for celebration (victoryTimer handled in update)
        this.victoryTimer = 180; // 3 seconds at 60fps
        // Big celebration message
        this.chatBubbles.push({
            x:this.VW/2, y:this.VH/3,
            text:'🎉 전원 클리어! 축하합니다!',
            timer:200, follow:null, screen:true, big:true
        });
        // Confetti particles at door
        if(this.door){
            for(let i=0;i<50;i++){
                this.particles.push({
                    x: this.door.x + this.door.w/2,
                    y: this.door.y,
                    vx: (Math.random()-.5)*8,
                    vy: -Math.random()*6-2,
                    color: ['#FFD700','#FF6B6B','#54A0FF','#00B894','#FDCB6E','#A29BFE'][Math.floor(Math.random()*6)],
                    size: 3+Math.random()*4,
                    life: 100+Math.random()*80,
                    maxLife: 180
                });
            }
        }
    },

    showVictoryReward(){
        if(this.spectatorMode){
            document.getElementById('complete-emoji').textContent = '🎉';
            document.getElementById('complete-title').textContent = '학생들이 클리어했습니다!';
            document.getElementById('complete-sub').textContent = '관전 종료 — 잠시 후 대시보드로 돌아갑니다';
            document.getElementById('complete-overlay').classList.remove('hidden');
            setTimeout(()=>{ this.quit(); }, 5000);
            return;
        }
        const gameInfo = Vote.GAMES.find(g => g.id === this.gameMode);
        const isCleared = Player.clearedGames.includes(this.gameMode);
        const bounty = isCleared ? 0 : (gameInfo?.bounty || this.CLEAR_REWARD);
        const bonus = Player.streak >= 7 ? 20 : Player.streak >= 3 ? 10 : 0;
        const total = bounty + bonus;

        if(!isCleared && gameInfo) {
            Player.clearedGames.push(this.gameMode);
            DB.saveGameClear(this.gameMode).catch(e => console.warn('Failed to save game clear:', e));
        }

        if(total > 0) { Player.addCoins(total, 'game_clear'); Player.save(); }
        document.getElementById('complete-emoji').textContent = isCleared ? '🎉' : '🏆';
        const gameName = gameInfo?.name || (this.gameMode === 'numbermatch' ? '숫자를 찾아라!' : '피코파크');
        document.getElementById('complete-title').textContent = `${gameName} 클리어!`;
        document.getElementById('complete-sub').textContent = isCleared
            ? `이미 클리어한 게임입니다! (보상 없음)${bonus ? `\n🔥 연속 출석 보너스 +${bonus} 코인` : ''}\n출석 ${Player.streak}일차 🔥`
            : `🪙 현상금 +${bounty} 코인${bonus ? ` (🔥연속 출석 보너스 +${bonus})` : ''} = 총 ${total} 코인 획득!\n출석 ${Player.streak}일차 🔥`;
        document.getElementById('complete-overlay').classList.remove('hidden');
        Confetti.fire();
    },

    endGame(success){
        this.running = false;
        clearInterval(this.timerRef);
        if(this.spectatorMode){
            document.getElementById('complete-emoji').textContent = success ? '🎉' : '⏰';
            document.getElementById('complete-title').textContent = success ? '학생들이 클리어!' : '학생들 시간 초과!';
            document.getElementById('complete-sub').textContent = '관전 종료 — 잠시 후 대시보드로 돌아갑니다';
            document.getElementById('complete-overlay').classList.remove('hidden');
            setTimeout(()=>{ this.quit(); }, 5000);
            return;
        }
        if(!success){
            document.getElementById('complete-emoji').textContent='⏰';
            document.getElementById('complete-title').textContent='시간 초과!';
            document.getElementById('complete-sub').textContent='아쉽다! 내일은 꼭 성공하자! (출석은 완료!)';
            document.getElementById('complete-overlay').classList.remove('hidden');
        }
    },

    quit(){
        const wasSpectator = this.spectatorMode;
        this.spectatorMode = false;
        this.running = false;
        this.isMultiplayer = false;
        clearInterval(this.timerRef);
        cancelAnimationFrame(this.animRef);
        window.onkeydown=null; window.onkeyup=null;
        // 미로 모드 키 리스너 + 관전 클릭 정리
        if(this._mazeKeyDown){ window.removeEventListener('keydown', this._mazeKeyDown); this._mazeKeyDown=null; }
        if(this._mazeKeyUp){ window.removeEventListener('keyup', this._mazeKeyUp); this._mazeKeyUp=null; }
        if(this._mazeSpecClick && this.cvs){ this.cvs.removeEventListener('click', this._mazeSpecClick); this._mazeSpecClick=null; }
        // 관전 모드 키 리스너 + 클릭 리스너 정리
        if(this._specKeyDown){ window.removeEventListener('keydown', this._specKeyDown); this._specKeyDown=null; }
        if(this._specKeyUp){ window.removeEventListener('keyup', this._specKeyUp); this._specKeyUp=null; }
        if(this._specClick && this.cvs){ this.cvs.removeEventListener('click', this._specClick); this._specClick=null; }
        this._followTarget = null;
        this._spectatorCamMode = 'free';
        // 관전 배지 숨기기
        const badge = document.getElementById('spectator-badge');
        if(badge) badge.classList.add('hidden');
        // 학생 목록 패널 숨기기
        const slist = document.getElementById('spectator-student-list');
        if(slist) slist.classList.add('hidden');
        // 나가기 버튼 복원
        const quitBtn = document.querySelector('#game .hud .btn-back');
        if(quitBtn) quitBtn.style.display = '';
        document.getElementById('complete-overlay').classList.add('hidden');
        document.getElementById('gacha-overlay').classList.add('hidden');
        document.getElementById('attend-overlay').classList.add('hidden');
        if(wasSpectator){
            // 교사: 대시보드로 복귀
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('teacher').classList.add('active');
            if(window.Teacher) window.Teacher.init();
            return;
        }
        // 게임 세션 자동 종료 (학생 로비 버튼 비활성화)
        if(Player.className) {
            DB.closeGameSession(Player.className).catch(e => console.warn('closeGameSession:', e));
        }
        if(setupEditorKeys) setupEditorKeys();
        Nav.go('lobby');
    }
};

// Merge all extracted modules onto Game
Object.assign(Game, GameStages, GameAI, GamePhysics, GameMechanics, GameRender, GameSpectator);

// Compatibility
export const MapGame = { start(){ Game.enter(); }, quit(){ Game.quit(); } };

// CONFETTI
export const Confetti={fire(){const c=document.getElementById('confetti'),x=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;const ps=[],cols=['#6C5CE7','#A29BFE','#FD79A8','#FDCB6E','#00CEC9','#00B894','#E17055'];for(let i=0;i<120;i++)ps.push({x:Math.random()*c.width,y:Math.random()*c.height-c.height,w:Math.random()*10+4,h:Math.random()*6+2,c:cols[Math.floor(Math.random()*cols.length)],vx:(Math.random()-.5)*5,vy:Math.random()*3+2,r:Math.random()*360,rs:(Math.random()-.5)*12,op:1});let f=0;const mx=150,go=()=>{f++;x.clearRect(0,0,c.width,c.height);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.06;p.r+=p.rs;if(f>mx*.6)p.op-=.02;x.save();x.translate(p.x,p.y);x.rotate(p.r*Math.PI/180);x.globalAlpha=Math.max(0,p.op);x.fillStyle=p.c;x.fillRect(-p.w/2,-p.h/2,p.w,p.h);x.restore();});if(f<mx)requestAnimationFrame(go);else x.clearRect(0,0,c.width,c.height);};go();}};

window.addEventListener('resize',()=>{document.getElementById('confetti').width=innerWidth;document.getElementById('confetti').height=innerHeight;if(Game.cvs&&Game.running)Game.resize();});
