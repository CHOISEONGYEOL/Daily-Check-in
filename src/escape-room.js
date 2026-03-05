// ── 단체 방탈출 게임 ──
// Mixin for Game object — 포켓몬스터 스타일 방 이동 + 단서 기반 퀴즈
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';

export const EscapeRoom = {

    // ── 인원 기반 퀴즈 수 ──
    getEscapeQuizCount(n){
        if(n <= 3)  return 2;
        if(n <= 10) return 3;
        if(n <= 20) return 4;
        return 5;
    },

    // ── 퀴즈 테마 풀 ──
    _quizThemes: [
        { labels:['빨','파','초','노'], colors:['#FF6B6B','#54A0FF','#00B894','#FDCB6E'], name:'색깔' },
        { labels:['1','2','3','4'],     colors:['#E17055','#0984E3','#00B894','#FDCB6E'], name:'숫자' },
        { labels:['★','●','▲','■'],   colors:['#FFD700','#FF6B6B','#54A0FF','#00B894'], name:'도형' },
        { labels:['🐱','🐶','🐰','🐻'], colors:['#FDCB6E','#A29BFE','#FF6B6B','#74B9FF'], name:'동물' },
        { labels:['♥','♦','♣','♠'],   colors:['#FF6B6B','#E17055','#2D3436','#2D3436'], name:'카드' },
        { labels:['봄','여름','가을','겨울'], colors:['#00B894','#FDCB6E','#E17055','#74B9FF'], name:'계절' },
    ],

    // ═══════════════════════════════════════
    // 방 데이터 (2개)
    // ═══════════════════════════════════════
    escapeRooms: [
        // ── 방 1: 비밀의 방 ──
        {
            name:'🔐 비밀의 방',
            desc:'단서를 찾아 퀴즈 발판을 순서대로 밟아라!',
            w:2000, h:800,
            spawnX:100, spawnY:700,
            platforms:[
                // Ground
                {x:0, y:770, w:2000, h:30, color:'#4a7c59', type:'ground'},
                // 1단 플랫폼 (중간 높이)
                {x:250, y:620, w:120, h:16, color:'#636E72'},
                {x:500, y:640, w:100, h:16, color:'#636E72'},
                {x:750, y:600, w:140, h:16, color:'#636E72'},
                {x:1050, y:630, w:120, h:16, color:'#636E72'},
                {x:1350, y:610, w:130, h:16, color:'#636E72'},
                {x:1650, y:640, w:100, h:16, color:'#636E72'},
                // 2단 플랫폼 (높은 곳)
                {x:150, y:470, w:100, h:16, color:'#636E72'},
                {x:400, y:450, w:110, h:16, color:'#636E72'},
                {x:700, y:430, w:120, h:16, color:'#636E72'},
                {x:1000, y:460, w:100, h:16, color:'#636E72'},
                {x:1300, y:440, w:130, h:16, color:'#636E72'},
                {x:1600, y:460, w:110, h:16, color:'#636E72'},
                // 3단 (최고 높이 - 단서 숨기기용)
                {x:300, y:310, w:80, h:16, color:'#636E72'},
                {x:650, y:280, w:90, h:16, color:'#636E72'},
                {x:1100, y:300, w:80, h:16, color:'#636E72'},
                {x:1500, y:290, w:90, h:16, color:'#636E72'},
                {x:1850, y:320, w:80, h:16, color:'#636E72'},
                // 벽 (구역 분리)
                {x:600, y:650, w:16, h:120, color:'#455A64', type:'wall'},
                {x:1200, y:620, w:16, h:150, color:'#455A64', type:'wall'},
            ],
            door:{x:1920, y:710, w:40, h:60},
            hazards:[],
            // 퀴즈/단서 슬롯 (최대 5개, getEscapeQuizCount로 잘라 사용)
            quizSlots:[
                {stationX:350, stationY:755, padY:755, padStartX:300},
                {stationX:800, stationY:585, padY:585, padStartX:740},
                {stationX:1150, stationY:755, padY:755, padStartX:1100},
                {stationX:1500, stationY:595, padY:595, padStartX:1440},
                {stationX:1800, stationY:755, padY:755, padStartX:1750},
            ],
            clueSlots:[
                {x:330, y:295, w:20, h:20},
                {x:690, y:265, w:20, h:20},
                {x:1130, y:285, w:20, h:20},
                {x:1540, y:275, w:20, h:20},
                {x:1880, y:305, w:20, h:20},
            ],
        },
        // ── 방 2: 최종 탈출 ──
        {
            name:'🏆 최종 탈출',
            desc:'마지막 방! 모든 퀴즈를 풀고 탈출하라!',
            w:2400, h:900,
            spawnX:100, spawnY:800,
            platforms:[
                // Ground
                {x:0, y:870, w:2400, h:30, color:'#4a3c5c', type:'ground'},
                // 1단
                {x:200, y:720, w:120, h:16, color:'#636E72'},
                {x:500, y:740, w:100, h:16, color:'#636E72'},
                {x:800, y:700, w:140, h:16, color:'#636E72'},
                {x:1100, y:730, w:120, h:16, color:'#636E72'},
                {x:1400, y:710, w:130, h:16, color:'#636E72'},
                {x:1700, y:740, w:110, h:16, color:'#636E72'},
                {x:2000, y:720, w:120, h:16, color:'#636E72'},
                // 2단
                {x:150, y:550, w:100, h:16, color:'#636E72'},
                {x:450, y:530, w:110, h:16, color:'#636E72'},
                {x:750, y:510, w:120, h:16, color:'#636E72'},
                {x:1050, y:540, w:100, h:16, color:'#636E72'},
                {x:1350, y:520, w:130, h:16, color:'#636E72'},
                {x:1650, y:540, w:110, h:16, color:'#636E72'},
                {x:1950, y:530, w:100, h:16, color:'#636E72'},
                // 3단 (단서 숨김)
                {x:300, y:380, w:80, h:16, color:'#636E72'},
                {x:600, y:350, w:90, h:16, color:'#636E72'},
                {x:950, y:370, w:80, h:16, color:'#636E72'},
                {x:1250, y:340, w:90, h:16, color:'#636E72'},
                {x:1550, y:360, w:80, h:16, color:'#636E72'},
                {x:1850, y:350, w:90, h:16, color:'#636E72'},
                {x:2200, y:380, w:80, h:16, color:'#636E72'},
                // 벽
                {x:700, y:720, w:16, h:150, color:'#455A64', type:'wall'},
                {x:1300, y:700, w:16, h:170, color:'#455A64', type:'wall'},
                {x:1900, y:720, w:16, h:150, color:'#455A64', type:'wall'},
            ],
            door:{x:2320, y:810, w:40, h:60},
            hazards:[
                {x:400, y:856, w:80, h:14, type:'spike'},
                {x:1000, y:856, w:80, h:14, type:'spike'},
                {x:1600, y:856, w:80, h:14, type:'lava'},
                {x:2100, y:856, w:80, h:14, type:'spike'},
            ],
            quizSlots:[
                {stationX:350, stationY:855, padY:855, padStartX:300},
                {stationX:900, stationY:685, padY:685, padStartX:840},
                {stationX:1250, stationY:855, padY:855, padStartX:1200},
                {stationX:1600, stationY:695, padY:695, padStartX:1540},
                {stationX:2100, stationY:855, padY:855, padStartX:2050},
            ],
            clueSlots:[
                {x:340, y:365, w:20, h:20},
                {x:640, y:335, w:20, h:20},
                {x:990, y:355, w:20, h:20},
                {x:1290, y:325, w:20, h:20},
                {x:1590, y:345, w:20, h:20},
            ],
        },
    ],

    // ═══════════════════════════════════════
    // 방 로드
    // ═══════════════════════════════════════
    loadEscapeRoom(idx){
        const room = this.escapeRooms[idx % this.escapeRooms.length];
        this.stageData = room;
        this.W = room.w;
        this.H = room.h;
        this.platforms = room.platforms.map(p=>({...p}));
        this.door = room.door ? {...room.door, open:false} : null;
        this.hazards = (room.hazards||[]).map(h=>({...h}));
        // 피코파크 기믹 비활성
        this.pushBlocks = [];
        this.plates = [];
        this.bridges = [];
        this.elevators = [];
        this.stageKeys = [];
        this.numberSpots = [];

        // 퀴즈 수 결정
        const quizCount = this.getEscapeQuizCount(this.totalPlayers || 25);
        const slots = room.quizSlots.slice(0, quizCount);
        const clueSlotPool = room.clueSlots.slice(0, quizCount);

        // 테마 셔플
        const themes = [...this._quizThemes].sort(()=>Math.random()-.5);

        // 퀴즈 생성
        this.escapeQuizzes = [];
        this.escapeClues = [];

        for(let i=0; i<quizCount; i++){
            const slot = slots[i];
            const theme = themes[i % themes.length];
            const padCount = theme.labels.length;

            // 정답 순서 랜덤 (3개만 사용)
            const indices = [];
            for(let j=0; j<padCount; j++) indices.push(j);
            // Fisher-Yates
            for(let j=indices.length-1; j>0; j--){
                const k = Math.floor(Math.random()*(j+1));
                [indices[j], indices[k]] = [indices[k], indices[j]];
            }
            const correctOrder = indices.slice(0, 3);

            // 발판 생성
            const pads = [];
            for(let j=0; j<padCount; j++){
                pads.push({
                    x: slot.padStartX + j*42,
                    y: slot.padY,
                    w:34, h:14,
                    label: theme.labels[j],
                    color: theme.colors[j],
                    idx: j,
                    stepped: false,
                });
            }

            const quiz = {
                id: `q${idx}_${i}`,
                stationX: slot.stationX,
                stationY: slot.stationY - 30,
                theme: theme,
                pads: pads,
                correctOrder: correctOrder,
                currentStep: 0,
                solved: false,
                clueFound: false,
                errorTimer: 0,
            };
            this.escapeQuizzes.push(quiz);

            // 단서 생성 (정답 순서를 텍스트로)
            const orderText = correctOrder.map(ci => theme.labels[ci]).join(' → ');
            const clueSlot = clueSlotPool[i];
            this.escapeClues.push({
                id: `c${idx}_${i}`,
                x: clueSlot.x, y: clueSlot.y,
                w: clueSlot.w, h: clueSlot.h,
                quizIdx: i,
                text: orderText,
                themeName: theme.name,
                found: false,
            });
        }

        this.escapeAllSolved = false;

        // 방 소개 메시지
        this.chatBubbles.push({
            x:this.VW/2, y:this.VH/3,
            text:`${room.name} — ${room.desc}`, timer:180, follow:null, screen:true, big:true
        });
    },

    // ═══════════════════════════════════════
    // 게임 시작
    // ═══════════════════════════════════════
    startEscapeRoom(){
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
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        this.loadEscapeRoom(this.stage);
        this.createNPCs();

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

        clearInterval(this.timerRef);
        this.timerRef = setInterval(()=>{
            if(!this.running) return;
            this.remaining--;
            if(this.remaining <= 60 && !this.ghostMode){
                this.ghostMode = true;
                this.chatBubbles.push({x:this.VW/2,y:100,
                    text:'👻 유령 모드! 죽은 플레이어도 발판을 밟을 수 있어요!',
                    timer:150,follow:null,screen:true});
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

    // ═══════════════════════════════════════
    // 프레임 업데이트 (game.js update()에서 호출)
    // ═══════════════════════════════════════
    updateEscapeRoom(){
        if(!this.escapeQuizzes) return;
        const all = [this.player, ...this.npcs].filter(e => !e.dead || this.ghostMode);

        // ── 1. 단서 접촉 판정 ──
        this.escapeClues.forEach(clue => {
            if(clue.found) return;
            for(const e of all){
                if(e.enteredDoor || e._spectatorDummy) continue;
                if(e.x+e.w/2 > clue.x && e.x-e.w/2 < clue.x+clue.w &&
                   e.y+e.h > clue.y && e.y < clue.y+clue.h){
                    clue.found = true;
                    const quiz = this.escapeQuizzes[clue.quizIdx];
                    if(quiz) quiz.clueFound = true;
                    this.spawnParticles(clue.x+clue.w/2, clue.y, '#FFD700', 12);
                    this.chatBubbles.push({
                        x:this.VW/2, y:this.VH/4,
                        text:`🔍 단서 발견! [${clue.themeName}] ${clue.text}`,
                        timer:150, follow:null, screen:true, big:true
                    });
                    break;
                }
            }
        });

        // ── 2. 퀴즈 발판 순서 판정 ──
        this.escapeQuizzes.forEach(quiz => {
            if(quiz.solved) return;
            if(quiz.errorTimer > 0){ quiz.errorTimer--; return; }

            for(const pad of quiz.pads){
                let stepped = false;
                for(const e of all){
                    if(e.enteredDoor || e._spectatorDummy) continue;
                    if(e.onGround &&
                       e.x+e.w/2 > pad.x && e.x-e.w/2 < pad.x+pad.w &&
                       Math.abs((e.y+e.h) - pad.y) < 10){
                        stepped = true;
                        break;
                    }
                }

                if(stepped && !pad.stepped){
                    pad.stepped = true;
                    const expectedIdx = quiz.correctOrder[quiz.currentStep];

                    if(pad.idx === expectedIdx){
                        // 정답!
                        quiz.currentStep++;
                        this.spawnParticles(pad.x+pad.w/2, pad.y-5, '#00B894', 6);

                        if(quiz.currentStep >= quiz.correctOrder.length){
                            // 퀴즈 해결!
                            quiz.solved = true;
                            this.spawnParticles(quiz.stationX, quiz.stationY, '#FFD700', 20);
                            this.chatBubbles.push({
                                x:this.VW/2, y:this.VH/4,
                                text:`✅ 퀴즈 해결! (${this.escapeQuizzes.filter(q=>q.solved).length}/${this.escapeQuizzes.length})`,
                                timer:100, follow:null, screen:true, big:true
                            });
                        }
                    } else {
                        // 오답! 리셋
                        quiz.currentStep = 0;
                        quiz.pads.forEach(p => { p.stepped = false; });
                        quiz.errorTimer = 30;
                        this.spawnParticles(pad.x+pad.w/2, pad.y-5, '#FF6B6B', 8);
                        this.chatBubbles.push({
                            x: pad.x+pad.w/2, y: pad.y-30,
                            text:'❌ 순서가 틀렸어요!', timer:60, follow:null
                        });
                    }
                }

                if(!stepped) pad.stepped = false;
            }
        });

        // ── 3. 전체 퀴즈 해결 → 문 열림 ──
        const allSolved = this.escapeQuizzes.every(q => q.solved);
        if(allSolved && !this.escapeAllSolved){
            this.escapeAllSolved = true;
            if(this.door) this.door.open = true;
            this.chatBubbles.push({
                x:this.VW/2, y:this.VH/4,
                text: this.stage >= 1
                    ? '🎉 모든 퀴즈 해결! 탈출문이 열렸어요!'
                    : '🎉 모든 퀴즈 해결! 다음 방으로!',
                timer:120, follow:null, screen:true, big:true
            });
            this.spawnParticles(this.door.x+this.door.w/2, this.door.y, '#00B894', 20);
        }

        // ── 4. 문 진입 처리 ──
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

        // 잠긴 문 푸시백
        if(this.door && !this.door.open){
            this.doorLockCooldown = Math.max(0, this.doorLockCooldown-1);
            all.forEach(e => {
                if(e.enteredDoor || e._spectatorDummy) return;
                const atDoor = (e.x+e.w/2 > this.door.x && e.x-e.w/2 < this.door.x+this.door.w &&
                                e.y+e.h > this.door.y && e.y < this.door.y+this.door.h+20);
                if(atDoor){
                    e.vx = e.x < this.door.x+this.door.w/2 ? -2 : 2;
                    if(this.doorLockCooldown <= 0){
                        const remaining = this.escapeQuizzes.filter(q=>!q.solved).length;
                        this.chatBubbles.push({
                            x:this.VW/2, y:this.VH/4,
                            text:`🔒 퀴즈 ${remaining}개를 더 풀어야 합니다!`,
                            timer:90, follow:null, screen:true, big:true
                        });
                        this.doorLockCooldown = 120;
                    }
                }
            });
        }
    },

    // ═══════════════════════════════════════
    // 렌더링 (game-render.js render()에서 호출)
    // ═══════════════════════════════════════
    renderEscapeQuizzes(ctx){
        if(!this.escapeQuizzes) return;
        const cam = this.camera;
        const t = Date.now() * 0.003;

        // ── 단서 렌더링 ──
        this.escapeClues.forEach(clue => {
            if(clue.x+clue.w < cam.x-50 || clue.x > cam.x+this.VW+50) return;
            const cx = clue.x + clue.w/2;
            const cy = clue.y + clue.h/2;

            if(clue.found){
                // 발견된 단서: 밝은 금색
                ctx.fillStyle = 'rgba(255,215,0,0.3)';
                ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('📜', cx, cy);
                // 단서 텍스트
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                const tw = ctx.measureText(clue.text).width + 12;
                ctx.beginPath(); ctx.roundRect(cx-tw/2, cy-28, tw, 16, 4); ctx.fill();
                ctx.fillStyle = '#FFD700'; ctx.font = 'bold 9px sans-serif';
                ctx.fillText(clue.text, cx, cy-20);
            } else {
                // 미발견: 흐릿한 펄스
                const pulse = 0.4 + Math.sin(t + clue.x) * 0.3;
                ctx.fillStyle = `rgba(255,215,0,${0.15*pulse})`;
                ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = `rgba(255,255,255,${0.4*pulse})`;
                ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('?', cx, cy);
            }
            ctx.textBaseline = 'alphabetic';
        });

        // ── 퀴즈 스테이션 + 발판 렌더링 ──
        this.escapeQuizzes.forEach((quiz, qi) => {
            if(quiz.stationX < cam.x-100 || quiz.stationX > cam.x+this.VW+100) return;

            // 스테이션 마커
            const sx = quiz.stationX, sy = quiz.stationY;
            if(quiz.solved){
                ctx.fillStyle = 'rgba(0,184,148,0.3)';
                ctx.beginPath(); ctx.arc(sx, sy-10, 22, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#00B894';
                ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('✅', sx, sy-10);
            } else {
                const pulse = 0.6 + Math.sin(t + qi*2) * 0.4;
                ctx.fillStyle = `rgba(108,92,231,${0.2*pulse})`;
                ctx.beginPath(); ctx.arc(sx, sy-10, 22, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = quiz.clueFound ? '#FDCB6E' : '#6C5CE7';
                ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(quiz.clueFound ? '❓' : '🔒', sx, sy-10);
                // 진행도 표시
                if(quiz.currentStep > 0){
                    ctx.fillStyle = '#00B894'; ctx.font = 'bold 10px sans-serif';
                    ctx.fillText(`${quiz.currentStep}/${quiz.correctOrder.length}`, sx, sy-30);
                }
            }

            // 답 발판 렌더링
            quiz.pads.forEach((pad, pi) => {
                if(pad.x+pad.w < cam.x-50 || pad.x > cam.x+this.VW+50) return;

                const isNextTarget = !quiz.solved && pi === quiz.correctOrder[quiz.currentStep];
                const isCompleted = !quiz.solved && quiz.correctOrder.indexOf(pi) < quiz.currentStep
                    && quiz.correctOrder.indexOf(pi) >= 0;

                // 발판 배경
                if(quiz.solved){
                    ctx.fillStyle = 'rgba(0,184,148,0.3)';
                } else if(quiz.errorTimer > 0){
                    ctx.fillStyle = 'rgba(255,107,107,0.4)';
                } else if(isCompleted){
                    ctx.fillStyle = 'rgba(0,184,148,0.4)';
                } else {
                    ctx.fillStyle = pad.color + '44';
                }
                ctx.fillRect(pad.x, pad.y - pad.h, pad.w, pad.h);

                // 발판 테두리
                ctx.strokeStyle = quiz.solved ? '#00B894'
                    : (quiz.errorTimer > 0 ? '#FF6B6B' : pad.color);
                ctx.lineWidth = isNextTarget && quiz.clueFound ? 2.5 : 1.5;
                ctx.strokeRect(pad.x, pad.y - pad.h, pad.w, pad.h);

                // 라벨
                ctx.fillStyle = quiz.solved ? '#00B894' : '#fff';
                ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(pad.label, pad.x+pad.w/2, pad.y - pad.h/2);

                // 완료 체크
                if(isCompleted){
                    ctx.fillStyle = '#00B894'; ctx.font = 'bold 10px sans-serif';
                    ctx.fillText('✓', pad.x+pad.w-4, pad.y-pad.h+4);
                }
            });
            ctx.textBaseline = 'alphabetic';
        });
    },

    // ═══════════════════════════════════════
    // 미니맵 렌더링 (game-render.js에서 호출)
    // ═══════════════════════════════════════
    renderEscapeMinimap(ctx, mx, my, scaleX, scaleY){
        // 퀴즈 위치
        this.escapeQuizzes.forEach(quiz => {
            ctx.fillStyle = quiz.solved ? '#00B894' : '#6C5CE7';
            ctx.beginPath();
            ctx.arc(mx+quiz.stationX*scaleX, my+quiz.stationY*scaleY, quiz.solved?1.5:2, 0, Math.PI*2);
            ctx.fill();
        });
        // 단서 위치
        this.escapeClues.forEach(clue => {
            if(clue.found) return;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(mx+(clue.x+clue.w/2)*scaleX, my+(clue.y+clue.h/2)*scaleY, 1.5, 0, Math.PI*2);
            ctx.fill();
        });
    },
};
