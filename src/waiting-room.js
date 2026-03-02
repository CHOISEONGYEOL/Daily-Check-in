import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';
import { Inventory } from './inventory.js';
import { WrBall } from './wr-ball.js';
import { WrGimmicks } from './wr-gimmicks.js';
import { WrRender } from './wr-render.js';
import { WrRealtime } from './wr-realtime.js';
import { Vote } from './vote.js';
import { DB } from './db.js';
import { isClean } from './chat-filter.js';
import { GameKeyboard } from './game-keyboard.js';

// Forward references (set after modules are created)
let Game = null;
export function setGame(g) { Game = g; }
let Shop = null;
export function setShop(s) { Shop = s; }
let Editor = null;
export function setEditor(ed) { Editor = ed; }

// =========================================================
// WAITING ROOM – MapleStory-style platformer lobby
// Core: state, map, start/stop, physics, overlay
// Ball logic: wr-ball.js | Gimmicks: wr-gimmicks.js | Rendering: wr-render.js
// =========================================================
export const WaitingRoom = {
    cvs:null, ctx:null, W:2000, H:900, VW:800, VH:450, cameraZoom:1.8,
    running:false, animRef:null,
    godMode:false, // 교사 전지전능 모드
    godCamSpeed:8,
    player:null, npcs:[], chatBubbles:[], particles:[],
    readyCount:0, totalStudents:25,
    countdownTimer:null, countdown:0,
    chatting:false,
    GRAVITY: 0.55, JUMP_FORCE: -10, MOVE_SPD: 3.5,
    BALL_R: 45, BALL_BOUNCE: 0.6, BALL_FRICTION: 0.985, BALL_GRAVITY: 0.45, BALL_MAX_VY: 10,
    EMOTE_DURATION: 180, EMOTE_COOLDOWN: 120,
    ball: null, score:{left:0,right:0}, ballResetTimer:0, goalFlash:0, goalFlashSide:null, ballAngle:0, goalLog:[],
    camera:{x:0, y:0},
    platforms:[],
    decorations:[],
    bgLayers:[],
    ballGameStarted: false,
    ballSpawnTimer: 0,
    ballSpawnZones: [],
    ballLastContactFrame: 0,
    frameCount: 0,
    obstacles: [],
    obstacleSpawnTimer: 0,
    obstacleSpawnInterval: 300,
    MAX_OBSTACLES: 10,
    activeWind: null,
    screenShake: 0,
    reversedControls: false,
    screenFlip: null,
    blackout: false,
    blackoutRadius: 120,
    gravityReversed: false,
    sizeChange: null,
    originalPlayerSize: {w:26, h:30},
    blackHole: null,
    ghostPlatforms: [],
    ghostLightningTimer: 0,
    ghostLightningVisible: false,
    redLightGreenLight: null,
    gimmickDeck: [],
    overlayActive: false,
    overlayScreen: null,
    showSpectatorBtns: false,
    voteStarted: false,
    selectedGameId: null,

    buildMap(){
        const W=this.W, H=this.H;
        this.platforms=[
            {x:0, y:H-15, w:W, h:15, color:'#4a7c59', top:'#6ab04c', type:'ground'},
            {x:30, y:H-90, w:120, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:10, y:H-155, w:100, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:50, y:H-220, w:130, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:200, y:H-110, w:160, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:280, y:H-200, w:180, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:150, y:H-310, w:110, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:400, y:H-140, w:90, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:530, y:H-90, w:140, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:620, y:H-170, w:160, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:700, y:H-260, w:130, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:820, y:H-110, w:120, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:880, y:H-200, w:100, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:780, y:H-330, w:120, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:550, y:H-250, w:80, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1020, y:H-80, w:130, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1100, y:H-160, w:150, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:1180, y:H-250, w:120, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:1050, y:H-200, w:90, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1280, y:H-120, w:110, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1300, y:H-300, w:100, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:1150, y:H-340, w:90, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:1520, y:H-100, w:140, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1600, y:H-180, w:130, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1680, y:H-260, w:120, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:1750, y:H-340, w:110, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:1850, y:H-90, w:130, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1900, y:H-180, w:90, h:12, color:'#00897b', top:'#00B894', type:'nature'},
            {x:1450, y:H-220, w:80, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:80, y:H-400, w:140, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:300, y:H-470, w:120, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:500, y:H-420, w:150, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:700, y:H-500, w:130, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:900, y:H-450, w:140, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1100, y:H-480, w:120, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:1300, y:H-430, w:150, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:1500, y:H-500, w:110, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:1700, y:H-460, w:130, h:14, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1900, y:H-420, w:100, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:200, y:H-580, w:160, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:550, y:H-620, w:140, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:850, y:H-650, w:180, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:1200, y:H-600, w:130, h:14, color:'#e84393', top:'#FD79A8', type:'magic'},
            {x:1550, y:H-640, w:150, h:14, color:'#5f3dc4', top:'#6C5CE7', type:'magic'},
            {x:1800, y:H-570, w:120, h:14, color:'#00897b', top:'#00B894', type:'nature'},
            {x:180, y:H-530, w:100, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:420, y:H-550, w:90, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:650, y:H-570, w:80, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1000, y:H-560, w:100, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1400, y:H-550, w:90, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:1650, y:H-530, w:100, h:12, color:'#795548', top:'#8D6E63', type:'wood'},
            {x:100,  y:20, w:140, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            {x:350,  y:40, w:120, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            {x:600,  y:15, w:130, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            {x:900,  y:35, w:150, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            {x:1200, y:20, w:120, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            {x:1500, y:40, w:140, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            {x:1750, y:18, w:130, h:12, color:'#546E7A', top:'#78909C', type:'wood'},
            // ── 관람석: 3구간 (구멍 2개로 내려갈 수 있음) ──
            {x:0,        y:250, w:W*0.3,      h:14, color:'#8B6914', top:'#FFD700', type:'spectator'},
            {x:W*0.37,   y:250, w:W*0.26,     h:14, color:'#8B6914', top:'#FFD700', type:'spectator'},
            {x:W*0.7,    y:250, w:W*0.3,      h:14, color:'#8B6914', top:'#FFD700', type:'spectator'},
        ];
        const goalTop = H-15-120; // 골대 꼭대기 y (765)
        this.goals = [
            // 바닥 골대
            {x:0, y:goalTop, w:40, h:120, side:'left'},
            {x:W-40, y:goalTop, w:40, h:120, side:'right'},
            // 위쪽 골대 — 관람석 바로 아래
            {x:0, y:270, w:40, h:90, side:'left'},
            {x:W-40, y:270, w:40, h:90, side:'right'},
        ];
        // 골대 꼭대기 발판 (엘리베이터 접근용, 더블점프로 도달)
        this.platforms.push(
            {x:0, y:goalTop, w:55, h:8, color:'#555', top:'#888', type:'wood'},
            {x:W-55, y:goalTop, w:55, h:8, color:'#555', top:'#888', type:'wood'},
        );
        // 엘리베이터 — 올라가기: 골대 위 + 중앙 / 내려가기: 관람석 내부
        this.elevators = [
            // 올라가기: 골대 꼭대기 (양쪽) + 중앙 바닥
            {x:0,        y:goalTop-70, w:55, h:70, targetX:W*0.15,  targetY:250, dir:'up'},
            {x:W*0.5-25, y:H-15-70,   w:50, h:70, targetX:W*0.5,   targetY:250, dir:'up'},
            {x:W-55,     y:goalTop-70, w:55, h:70, targetX:W*0.85,  targetY:250, dir:'up'},
            // 내려가기: 관람석 내부
            {x:W*0.25-25,  y:250-70,  w:50, h:70, targetX:W*0.25,  targetY:H-15, dir:'down'},
            {x:W*0.60-25,  y:250-70,  w:50, h:70, targetX:W*0.60,  targetY:H-15, dir:'down'},
            {x:W*0.95-25,  y:250-70,  w:50, h:70, targetX:W*0.95,  targetY:H-15, dir:'down'},
        ];
        // 관람석 박스 (완전 밀폐 사각형 — 침투 감지 + 강제 밀어내기)
        this.spectatorBoxes = [
            {x:0,       y:250-120, w:W*0.3,  h:120+14},   // 왼쪽 (y=130~264)
            {x:W*0.37,  y:250-120, w:W*0.26, h:120+14},   // 가운데
            {x:W*0.7,   y:250-120, w:W*0.3,  h:120+14},   // 오른쪽
        ];
        this.decorations=[
            {type:'tree', x:60, y:H-15},{type:'tree', x:350, y:H-15},{type:'lamp', x:250, y:H-15},{type:'sign', x:180, y:H-30, text:'대기실'},
            {type:'tree', x:580, y:H-15},{type:'tree', x:900, y:H-15},{type:'lamp', x:700, y:H-15},{type:'lamp', x:850, y:H-15},{type:'lamp', x:750, y:H-15},
            {type:'tree', x:1050, y:H-15},{type:'tree', x:1200, y:H-15},{type:'tree', x:1350, y:H-15},{type:'lamp', x:1150, y:H-15},{type:'lamp', x:1250, y:H-15},
            {type:'tree', x:1550, y:H-15},{type:'tree', x:1800, y:H-15},{type:'lamp', x:1650, y:H-15},{type:'lamp', x:1900, y:H-15},{type:'lamp', x:1700, y:H-15},
            {type:'star', x:100, y:30},{type:'star', x:350, y:50},{type:'star', x:600, y:40},{type:'star', x:800, y:70},
            {type:'star', x:1000, y:35},{type:'star', x:1250, y:60},{type:'star', x:1500, y:45},{type:'star', x:1750, y:30},
            {type:'star', x:1950, y:55},{type:'star', x:200, y:20},{type:'star', x:500, y:15},{type:'star', x:900, y:25},
            {type:'star', x:1350, y:18},{type:'star', x:1650, y:22},
            {type:'cloud', x:120, y:40},{type:'cloud', x:450, y:70},{type:'cloud', x:750, y:35},{type:'cloud', x:1100, y:55},
            {type:'cloud', x:1400, y:45},{type:'cloud', x:1700, y:60},{type:'cloud', x:1950, y:38},{type:'cloud', x:300, y:90},
            {type:'cloud', x:850, y:80},{type:'cloud', x:1550, y:75},
        ];
        this.bgLayers=[
            {x:0, w:600, h:120, color:'rgba(20,20,60,.3)', speed:0.15},{x:300, w:500, h:90, color:'rgba(25,25,70,.25)', speed:0.15},
            {x:700, w:650, h:130, color:'rgba(20,20,60,.3)', speed:0.15},{x:1200, w:550, h:100, color:'rgba(25,25,70,.25)', speed:0.15},
            {x:1600, w:500, h:110, color:'rgba(20,20,60,.3)', speed:0.15},
            {x:100, w:400, h:70, color:'rgba(30,40,60,.2)', speed:0.3},{x:600, w:350, h:60, color:'rgba(30,40,60,.2)', speed:0.3},
            {x:1050, w:450, h:75, color:'rgba(30,40,60,.2)', speed:0.3},{x:1500, w:380, h:65, color:'rgba(30,40,60,.2)', speed:0.3},
        ];
    },

    async start(){
        // 교사가 설정한 참여 인원 가져오기
        try {
            const pCount = await DB.getParticipantCount(Player.className);
            this.totalStudents = pCount > 0 ? pCount : (parseInt(document.getElementById('s-total').value)||25);
        } catch(e) {
            this.totalStudents = parseInt(document.getElementById('s-total').value)||25;
        }
        this.running = true; this.readyCount = 0; this.countdown = 0; this.chatting = false;
        // 대기실 입장 = 출석 체크 (교사/테스트 제외)
        if(Player.studentId !== '77777') {
            DB.checkIn().catch(e => console.warn('Check-in failed:', e));
            // 교사 출석부에 자동 출석 기록
            DB.saveTeacherAttendance(Player.studentId, Player.className || '', 'present').catch(()=>{});
        }
        this.chatBubbles = []; this.particles = []; this._elevatorCooldown = 0; this._inSpectator = false;
        this.cvs = document.getElementById('waiting-canvas');
        this.ctx = this.cvs.getContext('2d');
        this._needsCameraSnap = true;
        this._onresize = null; // 리스너 재등록 허용
        this._resizeCanvas();
        this.buildMap();
        // 카메라를 플레이어 스폰 위치에 중심 맞춤 (모바일에서 초기 프레임부터 보이도록)
        const spawnX = this.W * 0.25, spawnY = this.H - 47;
        this.camera = {
            x: Math.max(0, Math.min(spawnX - this.VW / 2, this.W - this.VW)),
            y: Math.max(0, Math.min(spawnY - this.VH / 2, this.H - this.VH))
        };
        const pxData = Player.pixels || parseTemplate(Templates[0]);
        this.player = {
            x:this.W*0.25, y:this.H-47, vx:0, vy:0, w:26, h:30,
            onGround:false, dir:1, jumpCount:0, maxJumps:2,
            sprite:CharRender.toOffscreen(pxData,64),
            emote:null, emoteTimer:0, emoteCooldown:0, explodeTimer:0, stunTimer:0,
            team:'left'
        };
        this.ball = null; this.score = {left:0, right:0}; this.goalLog = [];
        this.ballResetTimer = 0; this.goalFlash = 0; this.ballAngle = 0;
        this.ballGameStarted = false; this.ballSpawnTimer = 0;
        this.frameCount = 0; this.ballLastContactFrame = 0;
        this.obstacles = []; this.obstacleSpawnTimer = 0;
        this.obstacleSpawnInterval = 300;
        this.activeWind = null; this.screenShake = 0;
        this.overlayActive = false; this.overlayScreen = null; this.showSpectatorBtns = false;
        this.voteStarted = false; this.selectedGameId = null;
        this.initBallSpawnZones();
        this.npcs = [];
        this.remotePlayers = new Map();
        this.rtInit();
        this.keys = {};
        if(document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
        this._enterReady = false;
        setTimeout(() => { this._enterReady = true; }, 500);
        this._onkeydown = e => {
            if(this.overlayActive) return;
            const tag = document.activeElement?.tagName;
            if(tag === 'INPUT' || tag === 'TEXTAREA') return;
            if(e.key==='Enter'){
                if(!this._enterReady) return;
                e.preventDefault();
                const ci = document.getElementById('wr-chat-input');
                if(ci) ci.focus();
                return;
            }
            this.keys[e.key]=true;
            if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W'||e.key==='ArrowDown'||e.key==='s'||e.key==='S'){
                e.preventDefault();
                if(this.reversedControls && !this._inSpectator){
                    if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') this.playerJump();
                } else {
                    if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W') this.playerJump();
                }
            }
            if(e.key==='1') this.triggerEmote('flat');
            if(e.key==='2') this.triggerEmote('inflate');
            if(e.key==='3') this.triggerEmote('explode');
        };
        this._onkeyup = e => { this.keys[e.key]=false; };
        window.addEventListener('keydown', this._onkeydown);
        window.addEventListener('keyup', this._onkeyup);
        const chatInput = document.getElementById('wr-chat-input');
        if(chatInput){
            chatInput.value = '';
            chatInput.onkeydown = e=>{
                if(e.key==='Enter'){ e.preventDefault(); this.sendChat(chatInput.value.trim()); chatInput.value=''; chatInput.blur(); }
                if(e.key==='Escape'){ chatInput.blur(); }
                e.stopPropagation();
            };
        }
        document.querySelectorAll('.wr-ctrl-btn').forEach(btn=>{
            const k=btn.dataset.key;
            const down=e=>{
                e.preventDefault(); if(this.overlayActive) return; btn.classList.add('pressed');
                if(k==='left'){this.keys['ArrowLeft']=true;this.keys['_mobileLeft']=true;}
                if(k==='right'){this.keys['ArrowRight']=true;this.keys['_mobileRight']=true;}
                if(k==='jump'){this.keys['_mobileJump']=true;this.playerJump();}
            };
            const up=e=>{
                btn.classList.remove('pressed');
                if(k==='left'){this.keys['ArrowLeft']=false;this.keys['_mobileLeft']=false;}
                if(k==='right'){this.keys['ArrowRight']=false;this.keys['_mobileRight']=false;}
                if(k==='jump'){this.keys['_mobileJump']=false;}
            };
            btn.onpointerdown=down;btn.onpointerup=up;btn.onpointerleave=up;btn.onpointercancel=up;
        });
        if(screen.orientation&&screen.orientation.lock){try{screen.orientation.lock('landscape').catch(()=>{});}catch(e){}}
        this.cvs.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
        // 풀스크린 변경 시 RT 연결 재확인
        if(!this._onFullscreenChange){
            this._onFullscreenChange = () => {
                if(this.running && this._rtStatus !== 'connected'){
                    console.log('[RT] fullscreen change — reconnecting');
                    this.rtInit();
                }
            };
            document.addEventListener('fullscreenchange', this._onFullscreenChange);
            document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
        }
        cancelAnimationFrame(this.animRef);
        this._lastFrameTime = 0;
        const FRAME_MIN = 1000/61;
        const loop=(ts)=>{
            if(!this.running) return;
            if(ts - this._lastFrameTime < FRAME_MIN){ this.animRef=requestAnimationFrame(loop); return; }
            this._lastFrameTime = ts;
            try{ this.update(); this.render(); }catch(e){ console.error('WR loop error:',e); }
            this.animRef=requestAnimationFrame(loop);
        };
        this.animRef=requestAnimationFrame(loop);
        this.updateReadyUI();
        // 테스트 계정(99999)만 테스트 시작 버튼 표시
        const testBtn = document.getElementById('wr-test-start');
        if(testBtn) testBtn.classList.toggle('hidden', Player.studentId !== '99999');
        // ── 학생: 교사의 game_started 신호 폴링 ──
        this._startGameStartPoll();
    },

    _gameStartPollId: null,
    _startGameStartPoll(){
        clearInterval(this._gameStartPollId);
        // 테스트 계정은 수동 시작 가능하므로 폴링 불필요
        if(Player.studentId === '99999') return;
        this._gameStartPollId = setInterval(async ()=>{
            if(!this.running || this.voteStarted || this.countdown) return;
            try {
                const started = await DB.checkGameStarted(Player.className);
                if(started && !this.voteStarted){
                    clearInterval(this._gameStartPollId);
                    this._gameStartPollId = null;
                    this.voteStarted = true;
                    Vote.start(this.totalStudents, () => {
                        this.selectedGameId = Vote.selectedGame.id;
                        this.startCountdown();
                    });
                }
            } catch(e){ /* ignore polling errors */ }
        }, 3000);
    },

    stop(){
        this.rtDestroy();
        if(this._onFullscreenChange){
            document.removeEventListener('fullscreenchange', this._onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
            this._onFullscreenChange = null;
        }
        Vote.stop();
        GameKeyboard.hide(); // 키보드 닫기
        clearInterval(this._gameStartPollId); this._gameStartPollId = null;
        if(this.overlayActive) this.closeOverlay();
        this.overlayActive = false; this.overlayScreen = null;
        this.showSpectatorBtns = false; this._hideSpectatorButtons();
        this.running = false;
        cancelAnimationFrame(this.animRef);
        clearInterval(this.countdownTimer);
        if(this._onkeydown) { window.removeEventListener('keydown',this._onkeydown); window.removeEventListener('keyup',this._onkeyup); }
        if(this._onresize) window.removeEventListener('resize', this._onresize);
        this.obstacles = []; this.gimmickDeck = []; this.petTrail = [];
        this.activeWind = null; this.reversedControls = false; this.screenFlip = null;
        this.blackout = false; this.gravityReversed = false; this.sizeChange = null;
        this.blackHole = null; this.ghostPlatforms = [];
        if(this._hiddenPlatforms){this._hiddenPlatforms.forEach(p=>{ delete p._ghostHidden; });this._hiddenPlatforms=null;}
        this.ghostLightningTimer = 0; this.ghostLightningVisible = false;
        this.redLightGreenLight = null;
        if(this.player){ this.player.w = 26; this.player.h = 30; }
        this.godMode = false;
        clearInterval(this._gameStartPollId); this._gameStartPollId = null;
        const backBtn = document.getElementById('wr-back-dashboard');
        if(backBtn) backBtn.classList.add('hidden');
        const startBtn = document.getElementById('wr-start-game');
        if(startBtn){ startBtn.classList.add('hidden'); startBtn.disabled = false; startBtn.textContent = '▶ 게임 시작'; }
        // 관전 폴링 정리
        clearInterval(this._teacherSpectatorPollId); this._teacherSpectatorPollId = null;
        clearInterval(this._teacherVoteTimerRef); this._teacherVoteTimerRef = null;
        const statusEl = document.getElementById('teacher-spectator-status');
        if(statusEl) statusEl.classList.add('hidden');
    },

    // ── 교사 전지전능 모드: 캐릭터 없이 자유 카메라 ──
    startGodMode(){
        const isResume = this.running && this.godMode;

        if(!isResume) {
            // 출석 체크 인원 사용 (출석 + 지각 = 참여 인원)
            const Teacher = window.Teacher;
            if(Teacher && Teacher.getParticipantCount){
                const participants = Teacher.getParticipantCount();
                this.totalStudents = participants > 0 ? participants : (parseInt(document.getElementById('s-total').value)||25);
            } else {
                this.totalStudents = parseInt(document.getElementById('s-total').value)||25;
            }
            this.running = true; this.readyCount = 0; this.countdown = 0; this.chatting = false;
            this.godMode = true;
            this.chatBubbles = []; this.particles = []; this._elevatorCooldown = 0; this._inSpectator = false;
            this.cvs = document.getElementById('waiting-canvas');
            this.ctx = this.cvs.getContext('2d');
            // 교사 모드: 인게임과 동일한 줌 (자유 카메라)
            this._savedZoom = this.cameraZoom;
            this.cameraZoom = 1.8;
            this._resizeCanvas();
            this.buildMap();
            // 카메라 시작점: 맵 하단 중앙 (학생들이 스폰되는 근처)
            this.camera = {x: Math.max(0, this.W/2 - this.VW/2), y: Math.max(0, this.H - this.VH)};
            // 플레이어 없음 — null
            this.player = null;
            this.ball = null; this.score = {left:0, right:0}; this.goalLog = [];
            this.ballResetTimer = 0; this.goalFlash = 0; this.ballAngle = 0;
            this.ballGameStarted = false; this.ballSpawnTimer = 0;
            this.frameCount = 0; this.ballLastContactFrame = 0;
            this.obstacles = []; this.obstacleSpawnTimer = 0;
            this.obstacleSpawnInterval = 300;
            this.activeWind = null; this.screenShake = 0;
            this.overlayActive = false; this.overlayScreen = null; this.showSpectatorBtns = false;
            this.voteStarted = false; this.selectedGameId = null;
            this.initBallSpawnZones();
            this.npcs = [];
            this.remotePlayers = new Map();
            this.rtInit();
        } else {
            // 재진입: 캔버스/ctx 재바인딩 (화면 전환 후 필요)
            this.cvs = document.getElementById('waiting-canvas');
            this.ctx = this.cvs.getContext('2d');
            this._resizeCanvas();
        }

        this.keys = {};

        // 대시보드 복귀 버튼 + 게임 시작 버튼 표시
        const backBtn = document.getElementById('wr-back-dashboard');
        if(backBtn) backBtn.classList.remove('hidden');
        const startBtn = document.getElementById('wr-start-game');
        if(startBtn) startBtn.classList.remove('hidden');

        // 채팅바, 모바일컨트롤 숨기기
        const chatBar = document.querySelector('.wr-chat-bar');
        if(chatBar) chatBar.style.display = 'none';
        const mobileCtrl = document.querySelector('.wr-mobile-controls');
        if(mobileCtrl) mobileCtrl.style.display = 'none';

        // 관전 시스템 초기화
        this._followTarget = null;
        this._spectatorCamMode = 'free';

        // 키보드: 자유 카메라 이동 (WASD/화살표), +/- 줌, Tab/ESC/F
        if(this._onkeydown){ window.removeEventListener('keydown', this._onkeydown); window.removeEventListener('keyup', this._onkeyup); }
        this._onkeydown = e => {
            this.keys[e.key] = true;
            if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
            // 줌 조절
            if(e.key === '=' || e.key === '+') { this.cameraZoom = Math.min(3, this.cameraZoom + 0.2); this._resizeCanvas(); }
            if(e.key === '-') { this.cameraZoom = Math.max(0.4, this.cameraZoom - 0.2); this._resizeCanvas(); }
            // ESC: 전지적 시점 복귀
            if(e.key === 'Escape') { this._setWrSpectatorMode('free', null); }
            // Tab: 다음 학생 POV
            if(e.key === 'Tab') { e.preventDefault(); this._cycleWrFollowTarget(e.shiftKey ? -1 : 1); }
            // F: 모드 전환
            if((e.key === 'f' || e.key === 'F') && this._followTarget){
                this._spectatorCamMode = this._spectatorCamMode === 'pov' ? 'free' : 'pov';
                this._updateWrSpectatorUI();
            }
        };
        this._onkeyup = e => { this.keys[e.key] = false; };
        window.addEventListener('keydown', this._onkeydown);
        window.addEventListener('keyup', this._onkeyup);

        // 캔버스 클릭 → 학생 POV
        if(this._wrSpecClick && this.cvs) this.cvs.removeEventListener('click', this._wrSpecClick);
        this._wrSpecClick = e => {
            if(!this.cvs) return;
            const rect = this.cvs.getBoundingClientRect();
            const z = this.cameraZoom || 1;
            const dpr = this.dpr || 1;
            const mx = (e.clientX - rect.left) / (rect.width / (this.cvs.width / dpr)) / z + this.camera.x;
            const my = (e.clientY - rect.top) / (rect.height / (this.cvs.height / dpr)) / z + this.camera.y;
            let best = null, bestDist = 50;
            for(const n of this._rtGetRemoteArray()){
                const d = Math.hypot(n.x - mx, n.y - my);
                if(d < bestDist){ bestDist = d; best = n; }
            }
            if(best) this._setWrSpectatorMode('pov', best);
        };
        this.cvs.addEventListener('click', this._wrSpecClick);

        // 학생 목록 패널 표시
        this._showWrStudentList();

        if(!isResume) {
            cancelAnimationFrame(this.animRef);
            this._lastFrameTime = 0;
            const FRAME_MIN = 1000/61;
            const loop = (ts) => {
                if(!this.running) return;
                if(ts - this._lastFrameTime < FRAME_MIN){ this.animRef=requestAnimationFrame(loop); return; }
                this._lastFrameTime = ts;
                try { this.updateGodMode(); this.render(); } catch(e) { console.error('WR god loop error:', e); }
                this.animRef = requestAnimationFrame(loop);
            };
            this.animRef=requestAnimationFrame(loop);
        }
    },

    // ── 교사: 게임 시작 버튼 클릭 ──
    async teacherStartGame(){
        const btn = document.getElementById('wr-start-game');
        if(btn){ btn.disabled = true; btn.textContent = '전송 중...'; }
        try {
            const Teacher = window.Teacher;
            const classes = Teacher?._openClasses || [];
            // 신호 전송 + phase 초기화
            await Promise.all(classes.map(c =>
                Promise.all([
                    DB.startGameSession(c),
                    DB.setGamePhase(c, 'waiting', { vote_data: null, selected_game: null })
                ])
            ));
            if(btn){ btn.textContent = '✅ 전송 완료'; btn.style.borderColor = 'rgba(0,184,148,1)'; }
            // 즉시 투표 오버레이 표시 (읽기전용) + 폴링 시작
            this._showTeacherVoteOverlay(null);
            this._startTeacherSpectatorPoll();
        } catch(e) {
            console.error('teacherStartGame error:', e);
            if(btn){ btn.textContent = '❌ 실패 — 재시도'; btn.disabled = false; }
        }
    },

    // ── 교사 관전 모드 ──
    _teacherSpectatorPollId: null,
    _teacherPhase: 'waiting',
    _teacherVoteTimerRef: null,
    _spectateClass: '',

    _startTeacherSpectatorPoll(){
        clearInterval(this._teacherSpectatorPollId);
        this._teacherPhase = 'voting'; // 이미 투표 오버레이 표시 중
        const Teacher = window.Teacher;
        this._spectateClass = Teacher?._openClasses?.[0] || '';

        this._teacherSpectatorPollId = setInterval(async ()=>{
            try {
                const data = await DB.getSpectatorData(this._spectateClass);
                if(data.phase !== this._teacherPhase){
                    this._teacherPhase = data.phase;

                    switch(data.phase){
                        case 'voting':
                            // 이미 오버레이 표시 중 — 바만 업데이트
                            if(data.voteData) this._updateTeacherVoteBars(data.voteData);
                            break;
                        case 'tiebreak':
                            this._showTeacherTiebreak(data.voteData);
                            break;
                        case 'countdown':
                            this._showTeacherCountdown(data.selectedGame, data.voteData);
                            break;
                        case 'playing':
                            clearInterval(this._teacherSpectatorPollId);
                            this._teacherSpectatorPollId = null;
                            this._enterTeacherGameSpectator(data.selectedGame);
                            break;
                        case 'done':
                            clearInterval(this._teacherSpectatorPollId);
                            this._teacherSpectatorPollId = null;
                            break;
                    }
                } else if((data.phase === 'voting' || data.phase === 'waiting') && data.voteData){
                    this._updateTeacherVoteBars(data.voteData);
                }
            } catch(e){ /* ignore polling errors */ }
        }, 1000);
    },

    _showTeacherVoteOverlay(voteData){
        const overlay = document.getElementById('wr-vote-overlay');
        if(overlay) overlay.classList.remove('hidden');
        // 헤더 변경
        const header = overlay?.querySelector('.vote-header h2');
        if(header) header.textContent = '📺 실시간 투표 중계';
        const hint = overlay?.querySelector('.vote-hint');
        if(hint) hint.textContent = '학생들의 투표를 기다리는 중... (읽기전용)';
        // 타이머 시작
        this._teacherVoteTimer = 20;
        clearInterval(this._teacherVoteTimerRef);
        this._teacherVoteTimerRef = setInterval(()=>{
            this._teacherVoteTimer--;
            const numEl = document.getElementById('vote-timer-num');
            const fillEl = document.getElementById('vote-timer-fill');
            if(numEl) numEl.textContent = this._teacherVoteTimer;
            if(fillEl) fillEl.style.width = (this._teacherVoteTimer / 20 * 100) + '%';
            if(this._teacherVoteTimer <= 0) {
                clearInterval(this._teacherVoteTimerRef);
                // 타이머 종료 즉시 교사에게 선택권
                if(this._teacherPhase === 'voting' || this._teacherPhase === 'waiting') {
                    const openIds = Vote.GAMES.filter(g => g.status === 'open').map(g => g.id);
                    this._showTeacherTiebreak({ tiedGames: openIds, votes: {} });
                }
            }
        }, 1000);
        // 초기: 모든 오픈 게임 0표로 표시 (학생 화면처럼, 클릭 불가)
        this._renderTeacherVoteGrid(voteData);
    },

    _renderTeacherVoteGrid(voteData){
        const grid = document.getElementById('vote-grid');
        if(!grid) return;
        const votes = voteData?.votes || {};
        const totalVotes = Object.values(votes).reduce((a,b) => a+b, 0);

        // open 게임만 표시 (준비중 게임은 숨김), onclick 없음 (읽기전용)
        grid.innerHTML = Vote.GAMES.filter(g => g.status === 'open').map(g => {
            const count = votes[g.id] || 0;
            const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;

            return `<div class="vote-card" style="cursor:default;">
                <div class="vote-card-top">
                    <span class="vote-game-name">${g.name}</span>
                    <span class="vote-badge bounty-badge">🪙 ${g.bounty} 현상금!</span>
                </div>
                <div class="vote-desc">${g.desc}</div>
                <div class="vote-bar-wrap">
                    <div class="vote-bar-fill" style="width:${pct}%"></div>
                    <span class="vote-bar-text">${count}표 (${pct}%)</span>
                </div>
            </div>`;
        }).join('');
    },

    _updateTeacherVoteBars(voteData){
        if(!voteData) return;
        this._renderTeacherVoteGrid(voteData);
    },

    _showTeacherTiebreak(voteData){
        clearInterval(this._teacherVoteTimerRef);
        const grid = document.getElementById('vote-grid');
        const hint = document.querySelector('.vote-hint');
        const header = document.querySelector('.vote-header h2');
        if(header) header.textContent = '⚖️ 동표! 선생님이 선택하세요';
        if(hint) hint.textContent = '아래 게임 중 하나를 클릭하면 학생들에게 전달됩니다';

        const parsed = voteData || {};
        const tiedIds = parsed.tiedGames || [];
        const votes = parsed.votes || {};

        if(grid) {
            grid.innerHTML = tiedIds.map(id => {
                const g = Vote.GAMES.find(x => x.id === id);
                if(!g) return '';
                const count = votes[id] || 0;
                return `<div class="vote-card vote-tiebreak-pick" data-game-id="${g.id}" style="cursor:pointer;">
                    <div class="vote-card-top">
                        <span class="vote-game-name">${g.name}</span>
                        <span class="vote-badge bounty-badge">🪙 ${g.bounty} 현상금!</span>
                    </div>
                    <div class="vote-desc">${g.desc}</div>
                    <div class="vote-bar-wrap">
                        <div class="vote-bar-fill" style="width:100%"></div>
                        <span class="vote-bar-text">${count}표 (동표)</span>
                    </div>
                </div>`;
            }).join('');

            // 클릭 이벤트 — 교사 선택
            grid.querySelectorAll('.vote-tiebreak-pick').forEach(el => {
                el.addEventListener('click', () => {
                    const gameId = el.dataset.gameId;
                    this._teacherPickTiebreak(gameId);
                });
            });
        }

        // 타이머 숨기기
        const numEl = document.getElementById('vote-timer-num');
        const fillEl = document.getElementById('vote-timer-fill');
        if(numEl) numEl.textContent = '⚖️';
        if(fillEl) fillEl.style.width = '100%';
    },

    async _teacherPickTiebreak(gameId){
        const cls = this._spectateClass;
        if(!cls) return;
        try {
            // DB에 선택 결과 + phase를 countdown으로 동시 업데이트
            await DB.setSelectedGame(cls, gameId);
            await DB.setGamePhase(cls, 'countdown', { selected_game: gameId });
            // 교사 화면도 카운트다운으로 전환
            this._teacherPhase = 'countdown';
            this._showTeacherCountdown(gameId);
        } catch(e) { console.error('tiebreak pick error:', e); }
    },

    _showTeacherCountdown(selectedGame, voteData){
        clearInterval(this._teacherVoteTimerRef);
        // 최종 결과 표시
        if(voteData) this._updateTeacherVoteBars(voteData);
        const grid = document.getElementById('vote-grid');
        const gameInfo = Vote.GAMES.find(g => g.id === selectedGame);
        if(grid && gameInfo){
            grid.innerHTML = `<div class="vote-result">
                <div class="vote-result-emoji">${gameInfo.name.split(' ')[0]}</div>
                <div class="vote-result-name">${gameInfo.name}</div>
                <div class="vote-result-bounty">🪙 ${gameInfo.bounty} 코인 현상금!</div>
                <div class="vote-result-sub">학생들이 곧 게임을 시작합니다...</div>
            </div>`;
        }
        // 카운트다운
        const self = this;
        setTimeout(()=>{
            const overlay = document.getElementById('wr-vote-overlay');
            if(overlay) overlay.classList.add('hidden');
            const cdEl = document.getElementById('wr-countdown');
            if(cdEl) cdEl.classList.remove('hidden');
            let count = 5;
            const cdNum = document.getElementById('wr-countdown-num');
            if(cdNum) cdNum.textContent = count;
            const cdTimer = setInterval(()=>{
                count--;
                if(cdNum) cdNum.textContent = count;
                if(count <= 0){
                    clearInterval(cdTimer);
                    if(cdEl) cdEl.classList.add('hidden');
                    // 카운트다운 끝 → DB phase를 playing으로 + 게임 관전 모드 진입
                    clearInterval(self._teacherSpectatorPollId);
                    self._teacherSpectatorPollId = null;
                    self._teacherPhase = 'playing';
                    const cls = self._spectateClass;
                    if(cls) DB.setGamePhase(cls, 'playing').catch(()=>{});
                    self._enterTeacherGameSpectator(selectedGame);
                }
            }, 1000);
        }, 3000);
    },

    _enterTeacherGameSpectator(gameId){
        this.stop();
        Game.enterAsSpectator(gameId || 'picopark');
    },

    updateGodMode(){
        if(this._spectatorCamMode === 'pov' && this._followTarget){
            // ★ POV 모드: 학생 시점 추적
            const tx = this._followTarget.x - this.VW/2;
            const ty = this._followTarget.y - this.VH/2;
            const cx = Math.max(0, Math.min(tx, this.W - this.VW));
            const cy = Math.max(0, Math.min(ty, this.H - this.VH));
            this.camera.x += (cx - this.camera.x) * 0.18;
            this.camera.y += (cy - this.camera.y) * 0.18;
        } else {
            // ★ 전지적 시점: 자유 카메라
            const spd = this.godCamSpeed / (this.cameraZoom || 1);
            if(this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) this.camera.x -= spd;
            if(this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) this.camera.x += spd;
            if(this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) this.camera.y -= spd;
            if(this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) this.camera.y += spd;
            this.camera.x = Math.max(0, Math.min(this.camera.x, this.W - this.VW));
            this.camera.y = Math.max(0, Math.min(this.camera.y, this.H - this.VH));
        }

        // 원격 플레이어 보간
        this.frameCount++;
        this._rtInterpolateRemotePlayers();
        // 기믹/장애물/공 업데이트 (교사도 시각적 효과 표시)
        this.updateObstacles();
        if(this._isHost) this.updateBall();
        // 채팅 버블 인플레이스 업데이트
        { let w=0; const arr=this.chatBubbles;
        for(let i=0;i<arr.length;i++){ const b=arr[i]; b.timer--; if(b.follow){b.x=b.follow.x;b.y=b.follow.y-10;} if(b.timer>0) arr[w++]=b; }
        arr.length=w; }
        // 파티클 인플레이스 업데이트
        { let w=0; const arr=this.particles;
        for(let i=0;i<arr.length;i++){ const p=arr[i]; p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life--; if(p.life>0) arr[w++]=p; }
        arr.length=w; }
        // 학생 목록 자동 갱신 (접속자 수 변화 감지)
        const rpCount = this.remotePlayers ? this.remotePlayers.size : 0;
        if(this._lastNpcCount !== rpCount){
            this._lastNpcCount = rpCount;
            this._updateWrStudentList();
        }
    },

    // ── 대기실 관전 시스템 (전지적/POV) ──
    _setWrSpectatorMode(mode, target){
        if(mode === 'free'){
            this._spectatorCamMode = 'free';
            this._followTarget = null;
        } else {
            this._spectatorCamMode = 'pov';
            this._followTarget = target;
        }
        this._updateWrSpectatorUI();
    },

    _cycleWrFollowTarget(dir){
        const list = this._rtGetRemoteArray();
        if(!list.length) return;
        if(!this._followTarget){
            this._followTarget = dir > 0 ? list[0] : list[list.length-1];
        } else {
            const idx = list.indexOf(this._followTarget);
            const next = (idx + dir + list.length) % list.length;
            this._followTarget = list[next];
        }
        this._spectatorCamMode = 'pov';
        this._updateWrSpectatorUI();
    },

    _showWrStudentList(){
        let panel = document.getElementById('wr-spectator-student-list');
        if(!panel){
            panel = document.createElement('div');
            panel.id = 'wr-spectator-student-list';
            panel.className = 'spectator-student-list';
            document.getElementById('waiting-room').appendChild(panel);
        }
        panel.classList.remove('hidden');
        this._updateWrStudentList();
    },

    _updateWrSpectatorUI(){
        this._updateWrStudentList();
        // HUD 배지는 wr-render.js에서 그림
    },

    _updateWrStudentList(){
        const panel = document.getElementById('wr-spectator-student-list');
        if(!panel) return;
        const list = this._rtGetRemoteArray();
        const isFree = this._spectatorCamMode === 'free';
        const html = [`<div class="ssl-header">📺 관전 모드</div>`];
        html.push(`<div class="ssl-item ssl-mode${isFree ? ' ssl-active' : ''}" data-idx="-1">🌐 전지적 시점</div>`);
        html.push(`<div class="ssl-divider"></div>`);
        html.push(`<div class="ssl-sub">👥 학생 (${list.length}명) — 클릭: POV</div>`);
        list.forEach((n, i) => {
            const name = n.displayName || `학생${i+1}`;
            const active = this._followTarget === n;
            html.push(`<div class="ssl-item${active ? ' ssl-active' : ''}" data-idx="${i}">🟢 ${name}</div>`);
        });
        panel.innerHTML = html.join('');
        panel.querySelectorAll('.ssl-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                if(idx < 0) this._setWrSpectatorMode('free', null);
                else this._setWrSpectatorMode('pov', list[idx] || null);
            });
        });
    },

    backToDashboard(){
        // 관전 시스템 정리 (게임은 멈추지 않음!)
        this._followTarget = null;
        this._spectatorCamMode = 'free';
        if(this._wrSpecClick && this.cvs){ this.cvs.removeEventListener('click', this._wrSpecClick); this._wrSpecClick = null; }
        const slist = document.getElementById('wr-spectator-student-list');
        if(slist) slist.classList.add('hidden');
        // 키보드 리스너 해제 (대시보드에서 WASD 등 막기)
        if(this._onkeydown){ window.removeEventListener('keydown', this._onkeydown); window.removeEventListener('keyup', this._onkeyup); }
        this._onkeydown = null; this._onkeyup = null;
        this.keys = {};
        // 화면 전환 → 교사 대시보드 (게임 루프는 계속 돌아감)
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('teacher').classList.add('active');
        // Teacher 재시작 (폴링 재개)
        if(window.Teacher) window.Teacher.init();
    },

    _resizeCanvas(){
        // resize 리스너 항상 등록 (첫 호출에서 w/h=0이어도 이후 재시도 가능)
        if(!this._onresize){
            this._onresize = () => { if(this.running) this._resizeCanvas(); };
            window.addEventListener('resize', this._onresize);
        }
        const wrap = this.cvs.parentElement;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        // CSS 회전 후 레이아웃이 아직 안 잡힌 경우 방어
        const w = wrap.clientWidth || wrap.offsetWidth;
        const h = wrap.clientHeight || wrap.offsetHeight;
        if(w === 0 || h === 0) return; // 레이아웃 미완성 — 다음 resize에서 재시도
        const zoom = this.cameraZoom;
        const prevVW = this.VW, prevVH = this.VH;
        this.VW = w / zoom; this.VH = h / zoom;
        this.cvs.width = w * dpr; this.cvs.height = h * dpr;
        this.ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
        this.dpr = dpr;
        // 캔버스가 처음 유효해진 순간만 카메라 즉시 맞춤 (게임 중 리사이즈는 smooth follow에 맡김)
        if(this._needsCameraSnap && this.player){
            this._needsCameraSnap = false;
            this.camera.x = Math.max(0, Math.min(this.player.x - this.VW/2, this.W - this.VW));
            this.camera.y = Math.max(0, Math.min(this.player.y - this.VH/2, this.H - this.VH));
        }
    },

    playerJump(){
        if(!this.player) return;
        if(this.overlayActive) return;
        if(this.player.explodeTimer > 0) return;
        if(this.player.jumpCount < this.player.maxJumps){
            const jumpReversed = this.gravityReversed && !this._inSpectator;
            this.player.vy = jumpReversed ? -this.JUMP_FORCE : this.JUMP_FORCE;
            this.player.jumpCount++; this.player.onGround = false;
        }
    },

    sendChat(text){
        if(!this.player) return;
        if(!text || text.length > 30) return;
        if(!isClean(text)) return; // 욕설 → 조용히 무시
        this.chatBubbles.push({x:this.player.x, y:this.player.y-20, text:text, timer:180, follow:this.player, isPlayer:true});
        this._rtBroadcastChat(text);
    },

    // ── 모바일 전용: 커스텀 키보드로 채팅 ──
    openMobileChat(){
        GameKeyboard.show((text) => {
            this.sendChat(text);
        });
    },

    // spawnNPCsGradually 삭제됨 — 실시간 멀티플레이어로 대체 (wr-realtime.js)

    // 테스트 버튼: 투표부터 시작
    testStartVote(){
        if(this.voteStarted) return;
        this.voteStarted = true;
        Vote.start(this.totalStudents, () => {
            this.selectedGameId = Vote.selectedGame.id;
            this.startCountdown();
        });
    },

    startCountdown(){
        this.countdown = 5;
        const cdEl = document.getElementById('wr-countdown');
        if(cdEl) cdEl.classList.remove('hidden');
        this.countdownTimer = setInterval(()=>{
            this.countdown--;
            const cdEl2 = document.getElementById('wr-countdown-num');
            if(cdEl2) cdEl2.textContent = this.countdown;
            if(this.countdown <= 0){
                clearInterval(this.countdownTimer);
                // 교사에게 게임 시작 알림
                if(Player.className && Player.studentId !== '99999') {
                    DB.setGamePhase(Player.className, 'playing').catch(()=>{});
                }
                this.stop();
                Game.enterFromWaitingRoom(this.selectedGameId || 'picopark');
            }
        },1000);
    },

    updateReadyUI(){
        const el = document.getElementById('wr-ready-count');
        if(el) el.textContent = this.readyCount + ' / ' + this.totalStudents;
    },

    resolveEntityCollisions(){
        const remotes = this._rtGetRemoteArray();
        const all = (this.player.explodeTimer > 0 || this.overlayActive) ? [...remotes] : [this.player, ...remotes];
        const len = all.length;
        for(let i=0;i<len;i++){
            for(let j=i+1;j<len;j++){
                const a=all[i], b=all[j];
                const aL=a.x-a.w/2, aR=a.x+a.w/2, aT=a.y, aB=a.y+a.h;
                const bL=b.x-b.w/2, bR=b.x+b.w/2, bT=b.y, bB=b.y+b.h;
                if(aR<=bL||aL>=bR||aB<=bT||aT>=bB) continue;
                const overlapX = Math.min(aR-bL, bR-aL);
                const overlapY = Math.min(aB-bT, bB-aT);
                if(overlapY < overlapX){
                    if(aB - bT < bB - aT){ if(a.vy >= 0){a.y = bT - a.h;a.vy = 0;a.onGround = true;a.jumpCount = 0;} }
                    else { if(b.vy >= 0){b.y = aT - b.h;b.vy = 0;b.onGround = true;b.jumpCount = 0;} }
                } else {
                    const half = overlapX / 2;
                    if(a.x < b.x){a.x -= half; b.x += half;} else {a.x += half; b.x -= half;}
                    a.vx = 0; b.vx = 0;
                }
            }
        }
    },

    checkPlatforms(e){
        e.onGround = false;
        const basePlats = this._hiddenPlatforms ? this.platforms.filter(p=>!p._ghostHidden) : this.platforms;
        const allPlats = this.ghostPlatforms.length > 0 ? [...basePlats, ...this.ghostPlatforms] : basePlats;
        // 관람석 플레이어는 중력 역전 무시 (정상 충돌 사용)
        const useReversed = this.gravityReversed && !(e === this.player && this._inSpectator);
        if(useReversed){
            for(const p of allPlats){
                if(e.vy <= 0 && e.x+e.w/2 > p.x && e.x-e.w/2 < p.x+p.w && e.y <= p.y+p.h && e.y >= p.y+p.h+e.vy-2){
                    e.y = p.y + p.h; e.vy = 0; e.onGround = true; e.jumpCount = 0; return;
                }
            }
            if(e.y <= 0){ e.y = 0; e.vy = 0; e.onGround = true; e.jumpCount = 0; }
        } else {
            for(const p of allPlats){
                if(e.vy >= 0 && e.x+e.w/2 > p.x && e.x-e.w/2 < p.x+p.w && e.y+e.h >= p.y && e.y+e.h <= p.y+p.h+e.vy+2){
                    e.y = p.y - e.h; e.vy = 0; e.onGround = true; e.jumpCount = 0; return;
                }
            }
        }
    },

    // ── 관람석 박스 침투 감지 + 강제 밀어내기 (빈틈 없는 완전 밀폐) ──
    checkSpectatorWalls(e){
        if(!this.spectatorBoxes) return;
        // 관람석 내부 플레이어 → 자유 이동
        const hw = e.w/2;
        // ── 관람석 내부 플레이어: 박스 안에 가둠 ──
        if(e === this.player && this._inSpectator){
            for(const box of this.spectatorBoxes){
                const eL = e.x - hw, eR = e.x + hw;
                // 이 박스 안에 있는지 확인 (대략적 x 범위)
                if(eR > box.x && eL < box.x+box.w){
                    // 천장 위로 못 나감
                    if(e.y < box.y){ e.y = box.y; if(e.vy < 0) e.vy = 0; }
                    // 좌벽 밖으로 못 나감
                    if(eL < box.x){ e.x = box.x + hw; if(e.vx < 0) e.vx = 0; }
                    // 우벽 밖으로 못 나감
                    if(eR > box.x+box.w){ e.x = box.x + box.w - hw; if(e.vx > 0) e.vx = 0; }
                    break;
                }
            }
            return;
        }
        // ── NPC: 관람석 플랫폼 위에 서있으면 무시 ──
        if(e !== this.player){
            for(const p of this.platforms){
                if(p.type !== 'spectator') continue;
                if(e.x+hw > p.x && e.x-hw < p.x+p.w && e.y+e.h >= p.y && e.y+e.h <= p.y+p.h+4)
                    return;
            }
        }
        // ── 외부 → 내부 침투 차단: 겹치면 가장 얕은 방향으로 밀어냄 ──
        for(const box of this.spectatorBoxes){
            const eL = e.x - hw, eR = e.x + hw;
            const eT = e.y, eB = e.y + e.h;
            if(eR > box.x && eL < box.x+box.w && eB > box.y && eT < box.y+box.h){
                const penL = eR - box.x;
                const penR = (box.x+box.w) - eL;
                const penT = eB - box.y;
                const penB = (box.y+box.h) - eT;
                const min = Math.min(penL, penR, penT, penB);
                if(min === penT)     { e.y = box.y - e.h; if(e.vy > 0) e.vy = 0; }
                else if(min === penB){ e.y = box.y + box.h; if(e.vy < 0) e.vy = 0; }
                else if(min === penL){ e.x = box.x - hw; if(e.vx > 0) e.vx = 0; }
                else                 { e.x = box.x + box.w + hw; if(e.vx < 0) e.vx = 0; }
                break;
            }
        }
    },

    // 엔티티가 관람석 박스 안에 있는지 체크
    _isInsideAnySpectatorBox(e){
        if(!this.spectatorBoxes) return false;
        const hw = e.w/2;
        for(const box of this.spectatorBoxes){
            if(e.x+hw > box.x && e.x-hw < box.x+box.w && e.y+e.h > box.y && e.y < box.y+box.h)
                return true;
        }
        return false;
    },
    _gimmickTargets(){
        const remotes = this._rtGetRemoteArray();
        if(this.overlayActive || !this.player) return [...remotes];
        return this._inSpectator ? [...remotes] : [this.player,...remotes];
    },
    _rebalanceTeams(){
        const remotes = this._rtGetRemoteArray();
        let leftCount=0,rightCount=0;
        if(this.player && !this._inSpectator && this.player.team===null){
            const l=remotes.filter(n=>n.team==='left').length;
            const r=remotes.filter(n=>n.team==='right').length;
            this.player.team = l<r ? 'left' : l>r ? 'right' : (Math.random()>.5?'left':'right');
        }
        if(this.player && !this._inSpectator && this.player.team){if(this.player.team==='left') leftCount++; else rightCount++;}
        remotes.forEach(n=>{if(n.team==='left')leftCount++;else if(n.team==='right')rightCount++;});
    },
    _updateSpectatorButtons(){
        const el = document.getElementById('wr-spectator-btns');
        if(!el) return;
        if(this.showSpectatorBtns) el.classList.remove('hidden'); else el.classList.add('hidden');
    },
    _hideSpectatorButtons(){
        const el = document.getElementById('wr-spectator-btns');
        if(el) el.classList.add('hidden');
    },

    openOverlay(screenId){
        if(this.overlayActive) return;
        this.overlayActive = true; this.overlayScreen = screenId;
        this.showSpectatorBtns = false; this._hideSpectatorButtons();
        this._savedPlayerPos = {x:this.player.x, y:this.player.y, onGround:this.player.onGround};
        this.player.vx = 0; this.player.vy = 0; this.keys = {};
        const el = document.getElementById(screenId);
        el.classList.add('active', 'wr-overlay-mode');
        Player.refreshUI();
        if(screenId === 'shop'){
            Shop.clearFittingItem();
            if(Shop.currentTab === 'colors'){ document.getElementById('color-editor').classList.remove('hidden'); document.getElementById('fitting-room').classList.add('hidden'); Shop.stopIdleLoop(); Shop.ceInit(); }
            Shop.render();
        }
        if(screenId === 'inventory') { Inventory.render(); Inventory.startFitting(); }
        if(screenId === 'editor'){ const title = document.getElementById('editor-title'); const hasChar = Player.pixels != null; if(title) title.textContent = hasChar ? '✏️ 캐릭터 수정하기' : '🎨 캐릭터 만들기'; Editor.init(); }
        const backBtn = el.querySelector('.btn-back');
        if(backBtn){ this._origBackOnclick = backBtn.getAttribute('onclick'); backBtn.setAttribute('onclick', 'WaitingRoom.closeOverlay()'); }
        const chatBar = document.querySelector('.wr-chat-bar');
        const mobileCtrl = document.querySelector('.wr-mobile-controls');
        if(chatBar) chatBar.style.display = 'none';
        if(mobileCtrl) mobileCtrl.style.display = 'none';
    },

    closeOverlay(){
        if(!this.overlayActive) return;
        const screenId = this.overlayScreen;
        if(screenId === 'shop') Shop.stopIdleLoop();
        if(screenId === 'inventory') Inventory.stopFitting();
        const el = document.getElementById(screenId);
        el.classList.remove('active', 'wr-overlay-mode');
        const backBtn = el.querySelector('.btn-back');
        if(backBtn && this._origBackOnclick){ backBtn.setAttribute('onclick', this._origBackOnclick); this._origBackOnclick = null; }
        const chatBar = document.querySelector('.wr-chat-bar');
        const mobileCtrl = document.querySelector('.wr-mobile-controls');
        if(chatBar) chatBar.style.display = '';
        if(mobileCtrl) mobileCtrl.style.display = '';
        if(screenId === 'editor' || screenId === 'shop'){
            const px = Player.pixels || parseTemplate(Templates[0]);
            this.player.sprite = CharRender.toOffscreen(px, 64);
        }
        this.overlayActive = false; this.overlayScreen = null;
        if(this._savedPlayerPos){ this.player.x = this._savedPlayerPos.x; this.player.y = this._savedPlayerPos.y; this.player.onGround = this._savedPlayerPos.onGround; this._savedPlayerPos = null; }
        this.player.stunTimer = 0; this.player.explodeTimer = 0; this.player.vx = 0; this.player.vy = 0; this.player.jumpCount = 0;
        this.keys = {};
        if(document.activeElement) document.activeElement.blur();
        if(this.running){
            cancelAnimationFrame(this.animRef);
            const self = this;
            self._lastFrameTime = 0;
            const FRAME_MIN = 1000/61;
            const loop=(ts)=>{ if(!self.running) return; if(ts - self._lastFrameTime < FRAME_MIN){ self.animRef=requestAnimationFrame(loop); return; } self._lastFrameTime=ts; try{ self.update(); self.render(); }catch(e){ console.error('WR loop error:',e); } self.animRef=requestAnimationFrame(loop); };
            self.animRef=requestAnimationFrame(loop);
        }
    },

    // ── Update Loop ──
    update(){
        this.frameCount++;
        const P = this.player;
        // _inSpectator: 엘리베이터로 진입 시 true, 나가면 false
        // 만약 _inSpectator인데 박스 밖으로 나갔으면 해제
        if(this._inSpectator && !this._isInsideAnySpectatorBox(P)) this._inSpectator = false;
        if(this.ballGameStarted){
            if(this._inSpectator && this.player.team !== null){ this.player.team = null; this._rebalanceTeams(); }
            else if(!this._inSpectator && this.player.team === null){ this._rebalanceTeams(); }
        }
        this.showSpectatorBtns = this._inSpectator && !this.overlayActive;
        this._updateSpectatorButtons();
        if(this.overlayActive){
            P.vx = 0; P.vy = 0;
            if(P.stunTimer > 0) P.stunTimer--;
            if(P.explodeTimer > 0) P.explodeTimer--;
        } else {
        if(P.stunTimer > 0) P.stunTimer--;
        if(P.explodeTimer > 0){ P.vx = 0; P.vy = 0; }
        else if(P.stunTimer > 0){
            P.vx *= 0.85;
            const sGR = this.gravityReversed && !this._inSpectator;
            P.vy += sGR ? -this.GRAVITY : this.GRAVITY;
            if(sGR ? P.vy < -12 : P.vy > 12) P.vy = sGR ? -12 : 12;
            P.x += P.vx; P.y += P.vy;
            if(P.x < -10) P.x = this.W + 10; if(P.x > this.W + 10) P.x = -10;
            if(sGR){ if(P.y < -50){P.y=this.H;P.vy=0;} } else { if(P.y > this.H+50){P.y=0;P.vy=0;} }
            this.checkPlatforms(P);
        } else {
            const focused = document.activeElement?.tagName;
            const useReversed = this.reversedControls && !this._inSpectator;
            if(focused !== 'INPUT' && focused !== 'TEXTAREA'){
                const leftKey = useReversed ? (this.keys['ArrowRight']||this.keys['d']||this.keys['D']) : (this.keys['ArrowLeft']||this.keys['a']||this.keys['A']);
                const rightKey = useReversed ? (this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) : (this.keys['ArrowRight']||this.keys['d']||this.keys['D']);
                const windSlow = (this.activeWind && !this._inSpectator && this.obstacles.some(o=>o.type==='windGust')) ? 0.5 : 1;
                if(leftKey){P.vx=-this.MOVE_SPD*windSlow;P.dir=-1;}
                else if(rightKey){P.vx=this.MOVE_SPD*windSlow;P.dir=1;}
                else P.vx*=0.7;
            } else { P.vx*=0.7; }
            if(Math.abs(P.vx)<0.2) P.vx=0;
            const useGravReverse = this.gravityReversed && !this._inSpectator;
            P.vy += useGravReverse ? -this.GRAVITY : this.GRAVITY;
            if(useGravReverse ? P.vy < -12 : P.vy > 12) P.vy = useGravReverse ? -12 : 12;
            if(this.activeWind && !this._inSpectator) P.vx += this.activeWind.force * this.activeWind.direction;
            P.x += P.vx; P.y += P.vy;
            if(P.x < -10) P.x = this.W + 10; if(P.x > this.W + 10) P.x = -10;
            if(useGravReverse){ if(P.y < -50){P.y=this.H;P.vy=0;} } else { if(P.y > this.H+50){P.y=0;P.vy=0;} }
            this.checkPlatforms(P);
            this.checkSpectatorWalls(P);
            if(!this._inSpectator) this.applyBouncyZone(P);
            // ── 엘리베이터: 올라가기/내려가기 (쿨다운 30프레임) ──
            if(this._elevatorCooldown > 0) this._elevatorCooldown--;
            else for(const ev of this.elevators){
                if(P.x+P.w > ev.x && P.x < ev.x+ev.w && P.y+P.h > ev.y && P.y < ev.y+ev.h){
                    if(ev.dir === 'up' && !this._inSpectator){
                        P.x = ev.targetX; P.y = ev.targetY - P.h;
                        P.vy = 0; P.vx = 0; P.onGround = true; P.jumpCount = 0;
                        this._elevatorCooldown = 30;
                        this._inSpectator = true;
                    } else if(ev.dir === 'down' && this._inSpectator){
                        P.x = ev.targetX; P.y = ev.targetY - P.h;
                        P.vy = 0; P.vx = 0; P.onGround = true; P.jumpCount = 0;
                        this._elevatorCooldown = 30;
                        this._inSpectator = false;
                    }
                    break;
                }
            }
        }
        }
        if(!this.petTrail) this.petTrail = [];
        this.petTrail.push({x:P.x, y:P.y+P.h, dir:P.dir});
        if(this.petTrail.length > 30) this.petTrail.shift();
        const targetCamX = P.x - this.VW / 2;
        const clampedCamX = Math.max(0, Math.min(targetCamX, this.W - this.VW));
        this.camera.x += (clampedCamX - this.camera.x) * 0.15;
        const targetCamY = P.y - this.VH / 2;
        const clampedCamY = Math.max(0, Math.min(targetCamY, this.H - this.VH));
        this.camera.y += (clampedCamY - this.camera.y) * 0.15;
        // 원격 플레이어 보간 (AI 봇 대신 실제 플레이어)
        this._rtInterpolateRemotePlayers();
        // chatBubbles 인플레이스 업데이트 (새 배열 생성 안 함)
        { let w=0; const arr=this.chatBubbles;
        for(let i=0;i<arr.length;i++){ const b=arr[i]; b.timer--; if(b.follow){b.x=b.follow.x;b.y=b.follow.y-10;} if(b.timer>0) arr[w++]=b; }
        arr.length=w; }
        this.resolveEntityCollisions();
        if(this._isHost) this.updateBall();
        this.updateObstacles();
        this.updateEmote();
        this._spawnEffectTrail();
        if(this.screenShake > 0) this.screenShake *= 0.85;
        if(this.screenShake < 0.5) this.screenShake = 0;
        // particles 인플레이스 업데이트 (새 배열 생성 안 함)
        { let w=0; const arr=this.particles;
        for(let i=0;i<arr.length;i++){ const p=arr[i]; p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.life--; if(p.life>0) arr[w++]=p; }
        arr.length=w; }
    },
};

// ── Mixin: merge ball, gimmick, render, and realtime methods into WaitingRoom ──
Object.assign(WaitingRoom, WrBall, WrGimmicks, WrRender, WrRealtime);
