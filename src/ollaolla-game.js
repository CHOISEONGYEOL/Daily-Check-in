// ── 올라올라 (OllaOlla) — 큐플레이 스타일 계단 퀴즈 서바이벌 ──
// Mixin for Game object — OX 퀴즈를 맞추며 계단을 올라가는 게임
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';

export const OllaOllaGame = {

    // ═══════════════════════════════════════
    // 퀴즈 문제 뱅크
    // ═══════════════════════════════════════
    ollaQuizBank: [
        // ── 일반 상식 ──
        { q: '대한민국의 수도는 서울이다', a: true },
        { q: '지구는 태양 주위를 돈다', a: true },
        { q: '물은 섭씨 50도에서 끓는다', a: false },
        { q: '한글은 세종대왕이 만들었다', a: true },
        { q: '1년은 365일이다', a: true },
        { q: '달은 스스로 빛을 낸다', a: false },
        { q: '사람의 뼈는 약 206개이다', a: true },
        { q: '피아노는 타악기이다', a: true },
        { q: '바나나는 채소이다', a: false },
        { q: '태양계에서 가장 큰 행성은 목성이다', a: true },
        // ── 역사 ──
        { q: '임진왜란은 1592년에 일어났다', a: true },
        { q: '고려를 세운 사람은 이성계이다', a: false },
        { q: '훈민정음은 1443년에 만들어졌다', a: true },
        { q: '조선의 마지막 왕은 고종이다', a: false },
        { q: '광개토대왕은 고구려의 왕이다', a: true },
        { q: '경복궁은 조선시대에 지어졌다', a: true },
        { q: '거북선을 만든 사람은 이순신이다', a: true },
        { q: '삼국 중 가장 오래 존속한 나라는 신라이다', a: true },
        { q: '백제의 수도는 평양이었다', a: false },
        { q: '고조선의 건국 이야기에 나오는 동물은 호랑이와 곰이다', a: true },
        // ── 과학 ──
        { q: '소리는 진공에서도 전달된다', a: false },
        { q: '빛의 속도는 초속 약 30만 km이다', a: true },
        { q: '다이아몬드는 탄소로 이루어져 있다', a: true },
        { q: '식물은 이산화탄소를 마시고 산소를 내뱉는다', a: true },
        { q: '혈액형은 A, B, O, AB 네 가지이다', a: true },
        { q: '전기는 나무를 잘 통과한다', a: false },
        { q: '공기 중 가장 많은 기체는 산소이다', a: false },
        { q: '무지개는 7가지 색으로 이루어져 있다', a: true },
        { q: '화성은 태양에서 네 번째 행성이다', a: true },
        { q: '물은 수소와 산소로 이루어져 있다', a: true },
        // ── 수학 ──
        { q: '삼각형의 내각의 합은 180도이다', a: true },
        { q: '원주율(π)은 약 3.14이다', a: true },
        { q: '1+1=3이다', a: false },
        { q: '짝수와 홀수를 더하면 항상 홀수이다', a: true },
        { q: '정사각형의 네 변의 길이는 모두 같다', a: true },
        { q: '0은 짝수이다', a: true },
        { q: '100의 제곱근은 50이다', a: false },
        { q: '평행사변형의 대각은 서로 같다', a: true },
        // ── 지리 ──
        { q: '세계에서 가장 큰 대양은 태평양이다', a: true },
        { q: '이집트에는 피라미드가 있다', a: true },
        { q: '일본의 수도는 오사카이다', a: false },
        { q: '아마존 강은 아프리카에 있다', a: false },
        { q: '에베레스트산은 세계에서 가장 높은 산이다', a: true },
        { q: '호주는 섬나라이자 대륙이다', a: true },
        { q: '독도는 대한민국의 영토이다', a: true },
        { q: '한라산은 제주도에 있다', a: true },
        // ── 문화/생활 ──
        { q: '올림픽은 4년마다 열린다', a: true },
        { q: '축구는 11명이 한 팀이다', a: true },
        { q: '비타민 C가 풍부한 과일은 레몬이다', a: true },
        { q: '김치는 일본의 전통 음식이다', a: false },
        { q: '태권도는 한국에서 시작된 무술이다', a: true },
        { q: '설날에 먹는 음식은 송편이다', a: false },
        { q: '추석에는 차례를 지낸다', a: true },
        { q: '무궁화는 대한민국의 국화이다', a: true },
    ],

    // ═══════════════════════════════════════
    // 게임 설정
    // ═══════════════════════════════════════
    OLLA_TOTAL_STEPS: 10,       // 총 계단 수
    OLLA_STEP_H: 60,            // 계단 높이
    OLLA_STEP_W: 280,           // 계단 너비
    OLLA_TIME_PER_Q: 10,        // 문제당 제한 시간(초)
    OLLA_ANSWER_SHOW: 90,       // 정답 표시 프레임 수 (1.5초)

    // ═══════════════════════════════════════
    // 게임 시작
    // ═══════════════════════════════════════
    startOllaOlla(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.victoryTimer = 0;
        this.particles = [];
        this.chatBubbles = [];

        // 캔버스 설정
        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        const rect = this.cvs.parentElement.getBoundingClientRect();
        this.VW = rect.width;
        this.VH = rect.height;
        this.screenW = rect.width;
        this.screenH = rect.height;
        this.cvs.width = rect.width * this.dpr;
        this.cvs.height = rect.height * this.dpr;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // 모바일 컨트롤 숨기기
        const mc = document.getElementById('mobile-controls');
        if(mc) mc.classList.add('hidden');

        // 게임 상태 초기화
        this.ollaCurrentStep = 0;         // 현재 계단 위치 (0 = 바닥)
        this.ollaQuizIndex = 0;
        this.ollaPhase = 'ready';         // 'ready' | 'question' | 'answer' | 'result' | 'clear' | 'fail'
        this.ollaAnswer = null;           // 플레이어 선택: true=O, false=X, null=미응답
        this.ollaCorrect = null;          // 정답 맞았는지
        this.ollaQTimer = 0;              // 문제 제한시간 (초)
        this.ollaShowTimer = 0;           // 정답 표시 타이머 (프레임)
        this.ollaFallAnim = 0;            // 떨어지는 애니메이션
        this.ollaClimbAnim = 0;           // 올라가는 애니메이션
        this.ollaFrame = 0;
        this.ollaLives = 3;              // 목숨 3개
        this.ollaScore = 0;              // 점수
        this.ollaCombo = 0;              // 연속 정답 콤보
        this.ollaMaxCombo = 0;
        this.ollaShake = 0;              // 화면 흔들림
        this.ollaAnimY = 0;              // 캐릭터 Y 오프셋 애니메이션

        // 문제 셔플
        this.ollaQuizzes = this._ollaShuffleQuizzes();

        // NPC 생성 (같이 올라가는 친구들)
        this._ollaCreateNPCs();

        // 플레이어 스프라이트
        if(!this.spectatorMode){
            const pxData = Player.pixels || parseTemplate(Templates[0]);
            this.ollaPlayerSprite = CharRender.toOffscreen(pxData, 64);
        }

        // 시작 메시지
        this.chatBubbles.push({
            x: this.VW/2, y: this.VH/4,
            text: '🧗 올라올라! OX 퀴즈를 맞춰 꼭대기까지 올라가자!',
            timer: 180, follow:null, screen:true, big:true
        });

        // 1.5초 후 첫 문제 시작
        this.ollaReadyTimer = 90;

        // 입력 설정
        this._ollaSetupInput();

        // 타이머 (전체 게임 5분)
        this.remaining = 300;
        this.timerRef = setInterval(() => {
            if(!this.running) return;
            this.remaining--;
            this._ollaUpdateHUD();
            if(this.remaining <= 0){
                clearInterval(this.timerRef);
                this.endGame(false);
            }
        }, 1000);
        this._ollaUpdateHUD();

        // 게임 루프
        const loop = () => {
            if(!this.running && this.victoryTimer <= 0) return;
            this.updateOllaOlla();
            this.renderOllaOlla();
            this.animRef = requestAnimationFrame(loop);
        };
        this.animRef = requestAnimationFrame(loop);
    },

    // ═══════════════════════════════════════
    // 문제 셔플
    // ═══════════════════════════════════════
    _ollaShuffleQuizzes(){
        const arr = [...this.ollaQuizBank];
        for(let i = arr.length - 1; i > 0; i--){
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    // ═══════════════════════════════════════
    // NPC 생성
    // ═══════════════════════════════════════
    _ollaCreateNPCs(){
        this.npcs = [];
        this.ollaNPCs = [];
        const npcNames = ['민수','지은','서준','하은','도윤','수빈','예준','지아','시우','하윤',
            '유준','서아','주원','채원','준서','다은','현우','소율','지호','은서'];

        const totalNPCs = Math.min(this.totalStudents - 1, 15);

        // 멀티플레이어: 실제 접속 유저
        if(this.isMultiplayer && this._remotePlayerData && this._remotePlayerData.size > 0){
            let idx = 0;
            for(const [sid, rpData] of this._remotePlayerData){
                if(idx >= 15) break;
                this.ollaNPCs.push({
                    displayName: rpData.displayName || sid,
                    sprite: rpData.sprite || CharRender.toOffscreen(parseTemplate(Templates[idx % Templates.length]), 64),
                    step: 0,
                    lives: 3,
                    eliminated: false,
                    isRemote: true,
                    studentId: sid,
                    animY: 0,
                    fallAnim: 0,
                    climbAnim: 0,
                });
                idx++;
            }
        } else {
            // NPC AI
            for(let i = 0; i < totalNPCs; i++){
                this.ollaNPCs.push({
                    displayName: npcNames[i % npcNames.length],
                    sprite: CharRender.toOffscreen(parseTemplate(Templates[i % Templates.length]), 64),
                    step: 0,
                    lives: 3,
                    eliminated: false,
                    isRemote: false,
                    // AI 속성: 정답률
                    accuracy: 0.5 + Math.random() * 0.4, // 50~90%
                    animY: 0,
                    fallAnim: 0,
                    climbAnim: 0,
                });
            }
        }

        // 더미 플레이어 (물리 시스템 호환)
        this.player = { x:0, y:0, vx:0, vy:0, w:0, h:0, _spectatorDummy:true, dead:false, dir:1 };
    },

    // ═══════════════════════════════════════
    // 입력 설정
    // ═══════════════════════════════════════
    _ollaSetupInput(){
        this._ollaKeyDown = (e) => {
            if(this.ollaPhase !== 'question') return;
            if(this.ollaAnswer !== null) return; // 이미 답함
            if(e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft' || e.key === '1'){
                e.preventDefault();
                this._ollaSelectAnswer(true);
            }
            if(e.key === 'x' || e.key === 'X' || e.key === 'ArrowRight' || e.key === '2'){
                e.preventDefault();
                this._ollaSelectAnswer(false);
            }
        };
        window.addEventListener('keydown', this._ollaKeyDown);
    },

    _ollaCleanupInput(){
        if(this._ollaKeyDown){
            window.removeEventListener('keydown', this._ollaKeyDown);
            this._ollaKeyDown = null;
        }
    },

    // ═══════════════════════════════════════
    // 답 선택
    // ═══════════════════════════════════════
    _ollaSelectAnswer(ans){
        if(this.ollaPhase !== 'question') return;
        if(this.ollaAnswer !== null) return;
        this.ollaAnswer = ans;
    },

    // ═══════════════════════════════════════
    // 업데이트 루프
    // ═══════════════════════════════════════
    updateOllaOlla(){
        this.ollaFrame++;

        // Victory celebration
        if(this.victoryTimer > 0){
            this.victoryTimer--;
            this.particles = this.particles.filter(p => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
                return p.life > 0;
            });
            this.chatBubbles = this.chatBubbles.filter(b => { b.timer--; return b.timer > 0; });
            if(this.victoryTimer <= 0){
                this.running = false;
                this.showVictoryReward();
            }
            return;
        }
        if(!this.running) return;

        // 화면 흔들림 감쇠
        if(this.ollaShake > 0) this.ollaShake *= 0.9;
        if(this.ollaShake < 0.5) this.ollaShake = 0;

        // ── Ready 단계: 카운트다운 후 문제 출제 ──
        if(this.ollaPhase === 'ready'){
            this.ollaReadyTimer--;
            if(this.ollaReadyTimer <= 0){
                this._ollaNextQuestion();
            }
            return;
        }

        // ── Question 단계: 제한시간 카운트 ──
        if(this.ollaPhase === 'question'){
            // 매 60프레임(1초)마다 타이머 감소
            if(this.ollaFrame % 60 === 0){
                this.ollaQTimer--;
            }
            // 시간 초과 or 답 선택
            if(this.ollaQTimer <= 0 || this.ollaAnswer !== null){
                this._ollaCheckAnswer();
            }
            return;
        }

        // ── Result 단계: 올라가기/떨어지기 애니메이션 ──
        if(this.ollaPhase === 'result'){
            this.ollaShowTimer--;

            // NPC 애니메이션
            this.ollaNPCs.forEach(npc => {
                if(npc.climbAnim > 0){
                    npc.climbAnim--;
                    npc.animY = -Math.sin(npc.climbAnim / 20 * Math.PI) * 15;
                }
                if(npc.fallAnim > 0){
                    npc.fallAnim--;
                    npc.animY = Math.sin(npc.fallAnim / 30 * Math.PI) * 10;
                }
            });

            // 플레이어 애니메이션
            if(this.ollaClimbAnim > 0){
                this.ollaClimbAnim--;
                this.ollaAnimY = -Math.sin(this.ollaClimbAnim / 20 * Math.PI) * 15;
            }
            if(this.ollaFallAnim > 0){
                this.ollaFallAnim--;
                this.ollaAnimY = Math.sin(this.ollaFallAnim / 30 * Math.PI) * 10;
            }

            if(this.ollaShowTimer <= 0){
                // 탈락 체크
                if(this.ollaLives <= 0){
                    this.ollaPhase = 'fail';
                    this.chatBubbles.push({
                        x: this.VW/2, y: this.VH/3,
                        text: '💀 탈락! 다음엔 더 잘하자!',
                        timer: 180, follow:null, screen:true, big:true
                    });
                    setTimeout(() => this.endGame(false), 3000);
                    return;
                }
                // 클리어 체크
                if(this.ollaCurrentStep >= this.OLLA_TOTAL_STEPS){
                    this.ollaPhase = 'clear';
                    this.missionClear();
                    return;
                }
                // 다음 문제
                this.ollaReadyTimer = 40;
                this.ollaPhase = 'ready';
            }
            return;
        }

        // 파티클
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
            return p.life > 0;
        });
        this.chatBubbles = this.chatBubbles.filter(b => { b.timer--; return b.timer > 0; });
    },

    // ═══════════════════════════════════════
    // 다음 문제 출제
    // ═══════════════════════════════════════
    _ollaNextQuestion(){
        if(this.ollaQuizIndex >= this.ollaQuizzes.length){
            this.ollaQuizzes = this._ollaShuffleQuizzes();
            this.ollaQuizIndex = 0;
        }
        this.ollaCurrentQuiz = this.ollaQuizzes[this.ollaQuizIndex++];
        this.ollaAnswer = null;
        this.ollaCorrect = null;
        this.ollaQTimer = this.OLLA_TIME_PER_Q;
        this.ollaPhase = 'question';
    },

    // ═══════════════════════════════════════
    // 정답 체크
    // ═══════════════════════════════════════
    _ollaCheckAnswer(){
        const quiz = this.ollaCurrentQuiz;
        const playerAns = this.ollaAnswer;

        // 미응답 = 오답 처리
        if(playerAns === null){
            this.ollaCorrect = false;
        } else {
            this.ollaCorrect = (playerAns === quiz.a);
        }

        // 플레이어 결과 처리
        if(this.ollaCorrect){
            this.ollaCurrentStep++;
            this.ollaScore += 100 + this.ollaCombo * 20;
            this.ollaCombo++;
            if(this.ollaCombo > this.ollaMaxCombo) this.ollaMaxCombo = this.ollaCombo;
            this.ollaClimbAnim = 20;
            // 정답 파티클
            for(let i = 0; i < 12; i++){
                this.particles.push({
                    x: this.VW/2 + (Math.random()-0.5)*100,
                    y: this.VH * 0.6,
                    vx: (Math.random()-0.5)*4,
                    vy: -Math.random()*5-2,
                    color: ['#00B894','#00CEC9','#FDCB6E','#6C5CE7'][Math.floor(Math.random()*4)],
                    size: 3+Math.random()*3,
                    life: 40+Math.random()*30,
                    maxLife: 70
                });
            }
        } else {
            this.ollaCurrentStep = Math.max(0, this.ollaCurrentStep - 1);
            this.ollaLives--;
            this.ollaCombo = 0;
            this.ollaFallAnim = 30;
            this.ollaShake = 10;
            // 떨어지는 파티클
            for(let i = 0; i < 8; i++){
                this.particles.push({
                    x: this.VW/2 + (Math.random()-0.5)*80,
                    y: this.VH * 0.6,
                    vx: (Math.random()-0.5)*3,
                    vy: Math.random()*3+1,
                    color: ['#FF6B6B','#E17055','#D63031'][Math.floor(Math.random()*3)],
                    size: 2+Math.random()*3,
                    life: 30+Math.random()*20,
                    maxLife: 50
                });
            }
        }

        // NPC 결과 처리
        this.ollaNPCs.forEach(npc => {
            if(npc.eliminated) return;
            if(npc.isRemote) return; // 원격 플레이어는 자체 처리
            // AI: 확률적으로 정답/오답
            const correct = Math.random() < npc.accuracy;
            if(correct){
                npc.step = Math.min(npc.step + 1, this.OLLA_TOTAL_STEPS);
                npc.climbAnim = 20;
            } else {
                npc.step = Math.max(0, npc.step - 1);
                npc.lives--;
                npc.fallAnim = 30;
                if(npc.lives <= 0) npc.eliminated = true;
            }
        });

        this.ollaPhase = 'result';
        this.ollaShowTimer = this.OLLA_ANSWER_SHOW;
    },

    // ═══════════════════════════════════════
    // 실시간 동기화 (멀티플레이어)
    // ═══════════════════════════════════════
    _ollaBroadcastState(){
        if(!this._rtChannel || this.spectatorMode) return;
        try {
            this._rtChannel.send({
                type: 'broadcast', event: 'gamepos',
                payload: {
                    sid: String(Player.studentId),
                    ollaStep: this.ollaCurrentStep,
                    ollaLives: this.ollaLives,
                    ollaScore: this.ollaScore,
                    eliminated: this.ollaLives <= 0,
                }
            });
        } catch(e) { /* ignore */ }
    },

    // ═══════════════════════════════════════
    // HUD 업데이트
    // ═══════════════════════════════════════
    _ollaUpdateHUD(){
        const m = Math.floor(this.remaining/60), s = this.remaining%60;
        document.getElementById('hud-timer').textContent = `⏱️ ${m}:${String(s).padStart(2,'0')} / 5:00`;
        document.getElementById('G-coins').textContent = Player.coins;
        const el = document.getElementById('hud-mode');
        if(el) el.textContent = '🧗 올라올라!';
        document.getElementById('hud-stars').textContent =
            `🧗 ${this.ollaCurrentStep}/${this.OLLA_TOTAL_STEPS}단  ❤️ ${'♥'.repeat(Math.max(0, this.ollaLives))}${'♡'.repeat(Math.max(0, 3 - this.ollaLives))}  🔥 ${this.ollaCombo}콤보  ⭐ ${this.ollaScore}점`;
        // 진행률 바
        const progress = this.ollaCurrentStep / this.OLLA_TOTAL_STEPS;
        document.getElementById('hud-fill').style.width = (progress * 100) + '%';
    },

    // ═══════════════════════════════════════
    // 렌더링
    // ═══════════════════════════════════════
    renderOllaOlla(){
        const ctx = this.ctx;
        const W = this.VW, H = this.VH;

        // 화면 흔들림
        ctx.save();
        if(this.ollaShake > 0){
            ctx.translate(
                (Math.random()-0.5) * this.ollaShake,
                (Math.random()-0.5) * this.ollaShake
            );
        }

        // ── 배경: 하늘 그라데이션 ──
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, '#1A1A2E');
        skyGrad.addColorStop(0.3, '#16213E');
        skyGrad.addColorStop(0.6, '#0F3460');
        skyGrad.addColorStop(1, '#533483');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // ── 별 배경 ──
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for(let i = 0; i < 40; i++){
            const sx = (i * 137.5 + this.ollaFrame * 0.02) % W;
            const sy = (i * 97.3) % (H * 0.6);
            const ss = 1 + (i % 3);
            ctx.fillRect(sx, sy, ss, ss);
        }

        const stairW = this.OLLA_STEP_W;
        const stairH = this.OLLA_STEP_H;
        const totalSteps = this.OLLA_TOTAL_STEPS;
        const startX = (W - stairW) / 2;
        const bottomY = H - 80;

        // ── 계단 그리기 ──
        for(let i = 0; i <= totalSteps; i++){
            const y = bottomY - i * stairH;
            const isPlayerStep = (i === this.ollaCurrentStep);

            // 계단 색상
            if(i === totalSteps){
                // 꼭대기: 골드
                const goldGrad = ctx.createLinearGradient(startX, y, startX + stairW, y + stairH);
                goldGrad.addColorStop(0, '#FFD700');
                goldGrad.addColorStop(1, '#FFA500');
                ctx.fillStyle = goldGrad;
            } else if(i < this.ollaCurrentStep){
                // 올라온 계단: 초록 계열
                ctx.fillStyle = `hsla(${155 + i*5}, 70%, ${40 + i*2}%, 0.8)`;
            } else {
                // 아직 안 올라간 계단: 보라/파랑 계열
                ctx.fillStyle = `hsla(${240 - i*8}, 50%, ${35 + i*2}%, 0.6)`;
            }

            // 계단 본체
            ctx.beginPath();
            if(ctx.roundRect){
                ctx.roundRect(startX, y, stairW, stairH - 4, 6);
            } else {
                ctx.rect(startX, y, stairW, stairH - 4);
            }
            ctx.fill();

            // 계단 빛 효과
            if(isPlayerStep){
                ctx.strokeStyle = '#FDCB6E';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 글로우
                ctx.shadowColor = '#FDCB6E';
                ctx.shadowBlur = 15;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // 계단 번호
            ctx.fillStyle = isPlayerStep ? '#FFF' : 'rgba(255,255,255,0.5)';
            ctx.font = isPlayerStep ? 'bold 14px sans-serif' : '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${i}단`, startX + 8, y + stairH/2 + 2);

            // 꼭대기 깃발
            if(i === totalSteps){
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🏁', startX + stairW/2, y - 5);
            }
        }

        // ── NPC 캐릭터들 ──
        this.ollaNPCs.forEach((npc, idx) => {
            if(npc.eliminated) return;
            const npcY = bottomY - npc.step * stairH + npc.animY;
            const npcX = startX + 30 + (idx % 5) * 45;
            const size = 24;

            if(npc.sprite){
                ctx.globalAlpha = 0.7;
                ctx.drawImage(npc.sprite, npcX - size/2, npcY - size + 4, size, size);
                ctx.globalAlpha = 1;
            } else {
                ctx.fillStyle = `hsl(${idx * 47 % 360}, 60%, 55%)`;
                ctx.beginPath();
                ctx.arc(npcX, npcY - 8, 8, 0, Math.PI*2);
                ctx.fill();
            }

            // 이름표
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(npc.displayName, npcX, npcY + 10);
        });

        // ── 플레이어 캐릭터 ──
        if(!this.spectatorMode){
            const playerY = bottomY - this.ollaCurrentStep * stairH + this.ollaAnimY;
            const playerX = startX + stairW / 2;
            const pSize = 36;

            // 그림자
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(playerX, playerY + 4, 14, 4, 0, 0, Math.PI*2);
            ctx.fill();

            // 캐릭터
            if(this.ollaPlayerSprite){
                ctx.drawImage(this.ollaPlayerSprite, playerX - pSize/2, playerY - pSize + 8, pSize, pSize);
            }

            // 내 이름
            ctx.fillStyle = '#FDCB6E';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(Player.nickname || '나', playerX, playerY + 16);
        }

        // ── 퀴즈 UI ──
        if(this.ollaPhase === 'question' || this.ollaPhase === 'result'){
            this._ollaRenderQuiz(ctx, W, H);
        }

        // ── Ready 카운트다운 ──
        if(this.ollaPhase === 'ready' && this.ollaReadyTimer > 0 && this.ollaQuizIndex > 0){
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('다음 문제...', W/2, 60);
        }

        // ── 파티클 ──
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        });
        ctx.globalAlpha = 1;

        // ── 챗 버블 ──
        this.chatBubbles.forEach(b => {
            if(!b.screen) return;
            const alpha = Math.min(1, b.timer / 30);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#FFF';
            ctx.font = b.big ? 'bold 22px sans-serif' : '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(b.text, b.x, b.y);
        });
        ctx.globalAlpha = 1;

        // ── 탈락 화면 ──
        if(this.ollaPhase === 'fail'){
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#FF6B6B';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀 탈락!', W/2, H/2 - 20);
            ctx.fillStyle = '#FFF';
            ctx.font = '18px sans-serif';
            ctx.fillText(`최종 점수: ${this.ollaScore}점 | 최고 콤보: ${this.ollaMaxCombo}`, W/2, H/2 + 20);
        }

        ctx.restore();
    },

    // ═══════════════════════════════════════
    // 퀴즈 UI 렌더
    // ═══════════════════════════════════════
    _ollaRenderQuiz(ctx, W, H){
        const quiz = this.ollaCurrentQuiz;
        if(!quiz) return;

        const boxW = Math.min(W - 40, 500);
        const boxH = 180;
        const boxX = (W - boxW) / 2;
        const boxY = 20;

        // 퀴즈 박스 배경
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, 16);
        else ctx.rect(boxX, boxY, boxW, boxH);
        ctx.fill();

        // 테두리
        ctx.strokeStyle = this.ollaPhase === 'result'
            ? (this.ollaCorrect ? '#00B894' : '#FF6B6B')
            : '#A29BFE';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 문제 번호
        ctx.fillStyle = '#A29BFE';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Q${this.ollaQuizIndex}`, boxX + 16, boxY + 28);

        // 타이머
        if(this.ollaPhase === 'question'){
            const timerColor = this.ollaQTimer <= 3 ? '#FF6B6B' : '#FDCB6E';
            ctx.fillStyle = timerColor;
            ctx.textAlign = 'right';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(`${this.ollaQTimer}초`, boxX + boxW - 16, boxY + 28);

            // 타이머 바
            const barW = boxW - 32;
            const barH = 4;
            const barX = boxX + 16;
            const barY = boxY + 36;
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = timerColor;
            ctx.fillRect(barX, barY, barW * (this.ollaQTimer / this.OLLA_TIME_PER_Q), barH);
        }

        // 문제 텍스트
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';

        // 긴 텍스트 줄바꿈
        const maxLineW = boxW - 40;
        const words = quiz.q;
        if(ctx.measureText(words).width > maxLineW){
            const mid = Math.ceil(words.length / 2);
            let breakAt = words.lastIndexOf(' ', mid);
            if(breakAt <= 0) breakAt = mid;
            ctx.fillText(words.substring(0, breakAt), boxX + boxW/2, boxY + 70);
            ctx.fillText(words.substring(breakAt).trim(), boxX + boxW/2, boxY + 92);
        } else {
            ctx.fillText(words, boxX + boxW/2, boxY + 80);
        }

        // O X 버튼
        const btnW = 100, btnH = 50;
        const btnY = boxY + boxH - btnH - 16;
        const oX = boxX + boxW/2 - btnW - 20;
        const xX = boxX + boxW/2 + 20;

        // O 버튼
        const oSelected = this.ollaAnswer === true;
        const oCorrectReveal = this.ollaPhase === 'result' && quiz.a === true;
        if(oCorrectReveal){
            ctx.fillStyle = '#00B894';
        } else if(oSelected){
            ctx.fillStyle = this.ollaPhase === 'result' ? '#FF6B6B' : '#3498DB';
        } else {
            ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
        }
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(oX, btnY, btnW, btnH, 12);
        else ctx.rect(oX, btnY, btnW, btnH);
        ctx.fill();
        ctx.strokeStyle = oSelected ? '#FFF' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭕', oX + btnW/2, btnY + btnH/2 + 8);

        // X 버튼
        const xSelected = this.ollaAnswer === false;
        const xCorrectReveal = this.ollaPhase === 'result' && quiz.a === false;
        if(xCorrectReveal){
            ctx.fillStyle = '#00B894';
        } else if(xSelected){
            ctx.fillStyle = this.ollaPhase === 'result' ? '#FF6B6B' : '#E74C3C';
        } else {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
        }
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(xX, btnY, btnW, btnH, 12);
        else ctx.rect(xX, btnY, btnW, btnH);
        ctx.fill();
        ctx.strokeStyle = xSelected ? '#FFF' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❌', xX + btnW/2, btnY + btnH/2 + 8);

        // 결과 표시
        if(this.ollaPhase === 'result'){
            const resultText = this.ollaCorrect ? '⭕ 정답!' : '❌ 오답!';
            const resultColor = this.ollaCorrect ? '#00B894' : '#FF6B6B';
            ctx.fillStyle = resultColor;
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(resultText, boxX + boxW/2, boxY + boxH + 30);

            if(!this.ollaCorrect){
                ctx.fillStyle = '#FFF';
                ctx.font = '14px sans-serif';
                ctx.fillText(`정답: ${quiz.a ? 'O' : 'X'}`, boxX + boxW/2, boxY + boxH + 52);
            }

            if(this.ollaCorrect && this.ollaCombo >= 2){
                ctx.fillStyle = '#FDCB6E';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText(`🔥 ${this.ollaCombo}콤보!`, boxX + boxW/2, boxY + boxH + 52);
            }
        }

        // 모바일용 터치 영역 (캔버스 위에 그려진 버튼 클릭)
        if(!this._ollaCanvasClick){
            this._ollaCanvasClick = (e) => {
                if(this.ollaPhase !== 'question' || this.ollaAnswer !== null) return;
                const rect = this.cvs.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                if(my >= btnY && my <= btnY + btnH){
                    if(mx >= oX && mx <= oX + btnW){
                        this._ollaSelectAnswer(true);
                    }
                    if(mx >= xX && mx <= xX + btnW){
                        this._ollaSelectAnswer(false);
                    }
                }
            };
            this.cvs.addEventListener('click', this._ollaCanvasClick);
        }
    },

    // ═══════════════════════════════════════
    // 랭킹 보드 (게임 끝 화면에 표시)
    // ═══════════════════════════════════════
    _ollaGetRanking(){
        const ranking = [];
        // 플레이어
        if(!this.spectatorMode){
            ranking.push({
                name: Player.nickname || '나',
                step: this.ollaCurrentStep,
                score: this.ollaScore,
                eliminated: this.ollaLives <= 0,
                isPlayer: true,
            });
        }
        // NPCs
        this.ollaNPCs.forEach(npc => {
            ranking.push({
                name: npc.displayName,
                step: npc.step,
                score: npc.step * 100,
                eliminated: npc.eliminated,
                isPlayer: false,
            });
        });
        ranking.sort((a, b) => b.step - a.step || b.score - a.score);
        return ranking;
    },

    // ═══════════════════════════════════════
    // 정리
    // ═══════════════════════════════════════
    cleanupOllaOlla(){
        this._ollaCleanupInput();
        if(this._ollaCanvasClick && this.cvs){
            this.cvs.removeEventListener('click', this._ollaCanvasClick);
            this._ollaCanvasClick = null;
        }
    },
};
