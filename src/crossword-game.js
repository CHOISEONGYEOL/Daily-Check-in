// ── 가로세로 퀴즈 (크로스워드) 게임 ──
// Mixin for Game object — 큐플레이 스타일 한글 십자말풀이
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';
import { GameKeyboard } from './game-keyboard.js';

export const CrosswordGame = {

    // ═══════════════════════════════════════
    // 퍼즐 데이터 (스테이지별)
    // ═══════════════════════════════════════
    cwPuzzles: [
        // ── 스테이지 1: 학교생활 (6단어, gridSize 5) ──
        // 격자:
        //   0  1  2  3
        // 0 사 과
        // 1 람 학 교
        // 2       실 내
        {
            gridSize: 5, title: '🏫 학교생활',
            words: [
                { id:0, dir:'across', row:0, col:0, answer:'사과',   clue:'빨갛고 달콤한 과일' },
                { id:1, dir:'down',   row:0, col:0, answer:'사람',   clue:'호모 사피엔스' },
                { id:2, dir:'down',   row:0, col:1, answer:'과학',   clue:'실험하고 관찰하는 학문' },
                { id:3, dir:'across', row:1, col:1, answer:'학교',   clue:'학생들이 공부하러 가는 곳' },
                { id:4, dir:'down',   row:1, col:2, answer:'교실',   clue:'수업을 듣는 방' },
                { id:5, dir:'across', row:2, col:2, answer:'실내',   clue:'건물 안쪽을 뜻하는 말' },
            ]
        },
        // ── 스테이지 2: 자연 (7단어, gridSize 7) ──
        // 격자:
        //   0  1  2  3
        // 0 하 늘
        // 1 마 음
        // 2    식 물
        // 3       감 자
        {
            gridSize: 7, title: '🌿 자연과 생활',
            words: [
                { id:0, dir:'across', row:0, col:0, answer:'하늘',   clue:'머리 위에 펼쳐진 파란 공간' },
                { id:1, dir:'down',   row:0, col:0, answer:'하마',   clue:'물속에서 사는 큰 동물' },
                { id:2, dir:'across', row:1, col:0, answer:'마음',   clue:'기쁨이나 슬픔을 느끼는 곳' },
                { id:3, dir:'down',   row:1, col:1, answer:'음식',   clue:'배고플 때 먹는 것' },
                { id:4, dir:'across', row:2, col:1, answer:'식물',   clue:'뿌리와 잎이 있는 생물' },
                { id:5, dir:'down',   row:2, col:2, answer:'물감',   clue:'그림을 그릴 때 쓰는 색깔 재료' },
                { id:6, dir:'across', row:3, col:2, answer:'감자',   clue:'땅속에서 자라는 둥근 채소' },
            ]
        },
        // ── 스테이지 3: 음식 (7단어, gridSize 7) ──
        // 격자:
        //   0  1  2  3  4
        // 0 김 치 찌 개
        // 1 밥 상    미 역
        // 2    추 석
        {
            gridSize: 7, title: '🍽️ 음식과 요리',
            words: [
                { id:0, dir:'across', row:0, col:0, answer:'김치찌개', clue:'한국의 대표적인 매운 국물 요리' },
                { id:1, dir:'down',   row:0, col:0, answer:'김밥',   clue:'소풍 갈 때 꼭 싸가는 음식' },
                { id:2, dir:'across', row:1, col:0, answer:'밥상',   clue:'밥과 반찬을 차려놓는 상' },
                { id:3, dir:'down',   row:0, col:3, answer:'개미',   clue:'줄지어 다니는 아주 작은 곤충' },
                { id:4, dir:'across', row:1, col:3, answer:'미역',   clue:'국으로 끓여 먹는 바다 채소' },
                { id:5, dir:'down',   row:1, col:1, answer:'상추',   clue:'고기를 싸 먹는 초록 잎채소' },
                { id:6, dir:'across', row:2, col:1, answer:'추석',   clue:'음력 8월 15일, 한가위' },
            ]
        },
        // ── 스테이지 4: 지리 (8단어, gridSize 8) ──
        // 격자:
        //   0  1  2  3
        // 0 대 한 민 국
        // 1 문 제 속 담
        // 2    주 소 장
        // 3    도
        {
            gridSize: 8, title: '🗺️ 지리와 세계',
            words: [
                { id:0, dir:'across', row:0, col:0, answer:'대한민국', clue:'우리나라의 공식 이름' },
                { id:1, dir:'down',   row:0, col:0, answer:'대문',   clue:'집 입구에 있는 큰 문' },
                { id:2, dir:'across', row:1, col:0, answer:'문제',   clue:'시험에 나오는 것' },
                { id:3, dir:'down',   row:0, col:2, answer:'민속',   clue:'옛날부터 전해오는 풍습' },
                { id:4, dir:'across', row:1, col:2, answer:'속담',   clue:'"빈 수레가 요란하다" 같은 것' },
                { id:5, dir:'down',   row:1, col:1, answer:'제주도', clue:'한라산이 있는 섬' },
                { id:6, dir:'down',   row:1, col:3, answer:'담장',   clue:'집 주위를 둘러싼 벽' },
                { id:7, dir:'across', row:2, col:1, answer:'주소',   clue:'집이나 건물의 위치를 나타내는 것' },
            ]
        },
        // ── 스테이지 5: 문화 (9단어, gridSize 8) ──
        // 격자:
        //   0  1  2  3  4  5
        // 0 태 권 도
        // 1 양    자 연
        // 2    궁    기 적
        // 3             금 메 달
        {
            gridSize: 8, title: '🎭 문화와 예술',
            words: [
                { id:0, dir:'across', row:0, col:0, answer:'태권도',  clue:'한국의 대표적인 무술' },
                { id:1, dir:'down',   row:0, col:0, answer:'태양',   clue:'아침에 뜨는 별' },
                { id:2, dir:'down',   row:0, col:2, answer:'도자기', clue:'흙으로 빚어 구운 그릇' },
                { id:3, dir:'across', row:1, col:0, answer:'양궁',   clue:'화살로 과녁을 맞히는 운동 (올림픽 금메달!)' },
                { id:4, dir:'across', row:1, col:2, answer:'자연',   clue:'산, 강, 바다 등 자연 그대로의 것' },
                { id:5, dir:'down',   row:1, col:1, answer:'궁전',   clue:'왕이 사는 곳' },
                { id:6, dir:'across', row:2, col:3, answer:'기적',   clue:'믿기 어려운 놀라운 일' },
                { id:7, dir:'down',   row:2, col:4, answer:'적금',   clue:'돈을 꾸준히 모으는 저축 방법' },
                { id:8, dir:'across', row:3, col:4, answer:'금메달', clue:'1등에게 주는 메달' },
            ]
        },
    ],

    // ═══════════════════════════════════════
    // 인원 기반 스테이지 수
    // ═══════════════════════════════════════
    getCwStageCount(n){
        if(n <= 5)  return 3;
        if(n <= 15) return 4;
        return 5;
    },

    // ═══════════════════════════════════════
    // 게임 시작
    // ═══════════════════════════════════════
    startCrossword(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.victoryTimer = 0;
        this.particles = [];
        this.chatBubbles = [];
        this.cwFrame = 0;
        this.cwRemoteProgress = new Map();
        this.cwStageTransition = 0;

        // 캔버스 설정
        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        // 뷰포트
        const rect = this.cvs.parentElement.getBoundingClientRect();
        this.VW = rect.width;
        this.VH = rect.height;
        this.screenW = rect.width;
        this.screenH = rect.height;
        this.cvs.width = rect.width * this.dpr;
        this.cvs.height = rect.height * this.dpr;
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // 스테이지 수 결정
        this.cwStageCount = this.getCwStageCount(this.totalStudents);

        // 첫 퍼즐 로드
        this.loadCwStage(0);

        // 플레이어 더미 (크로스워드에는 캐릭터 없음)
        this.player = { x:0, y:0, vx:0, vy:0, w:0, h:0, _spectatorDummy: true, dead:false, dir:1 };
        this.npcs = [];

        // 원격 플레이어 정보 (리더보드용)
        if(this._remotePlayerData){
            for(const [sid, rpData] of this._remotePlayerData){
                this.cwRemoteProgress.set(sid, {
                    displayName: rpData.displayName || sid,
                    sprite: rpData.sprite,
                    solved: 0, total: 0, stage: 0, done: false
                });
            }
        }

        // 모바일 컨트롤 숨기기
        const mc = document.getElementById('mobile-controls');
        if(mc) mc.classList.add('hidden');

        // 크로스워드 오버레이 표시
        const cwOvl = document.getElementById('cw-overlay');
        if(cwOvl) cwOvl.classList.remove('hidden');

        // 입력 설정
        this.setupCwInput();

        // 타이머 (5분)
        this.remaining = 300;
        this.timerRef = setInterval(()=>{
            if(!this.running) return;
            this.remaining--;
            this.updateHUD();
            if(this.remaining <= 0){
                clearInterval(this.timerRef);
                this.endGame(false);
            }
        }, 1000);
        this.updateHUD();

        // 게임 루프
        const loop = () => {
            if(!this.running && this.victoryTimer <= 0) return;
            this.updateCrossword();
            this.renderCrossword();
            this.animRef = requestAnimationFrame(loop);
        };
        this.animRef = requestAnimationFrame(loop);
    },

    // ═══════════════════════════════════════
    // 스테이지 로드
    // ═══════════════════════════════════════
    loadCwStage(idx){
        const puzzle = this.cwPuzzles[idx % this.cwPuzzles.length];
        this.cwGridSize = puzzle.gridSize;
        this.cwTitle = puzzle.title;
        this.cwWords = puzzle.words.map((w, i) => ({
            ...w,
            cells: [],
            solved: false,
            clueNumber: i + 1,
        }));

        // 격자 생성
        this.buildCwGrid();

        // 선택 초기화
        this.cwSelectedWord = null;
        this.cwSelectedCell = null;
        this.cwDirection = 'across';
        this.cwWrongFlash = 0;
        this.cwCorrectFlash = 0;
        this.cwInputText = '';

        // 입력바 초기화
        const answerBar = document.getElementById('cw-answer-bar');
        if(answerBar) answerBar.classList.add('hidden');
        const input = document.getElementById('cw-input');
        if(input) input.value = '';

        // 스테이지 안내 메시지
        this.chatBubbles.push({
            x: this.VW/2, y: this.VH/4,
            text: `📝 ${this.cwTitle} (${idx+1}/${this.cwStageCount})`,
            timer: 150, follow:null, screen:true, big:true
        });
    },

    buildCwGrid(){
        const size = this.cwGridSize;
        // 빈 격자
        this.cwGrid = [];
        for(let r = 0; r < size; r++){
            this.cwGrid[r] = [];
            for(let c = 0; c < size; c++){
                this.cwGrid[r][c] = { active:false, syllable:'', filled:'', correct:false, wordIds:[], clueNumber:null };
            }
        }

        // 단어별 셀 배치
        for(const word of this.cwWords){
            const cells = [];
            const syls = [...word.answer]; // 한글 음절 분리
            for(let i = 0; i < syls.length; i++){
                const r = word.dir === 'across' ? word.row : word.row + i;
                const c = word.dir === 'across' ? word.col + i : word.col;
                if(r >= this.cwGridSize || c >= this.cwGridSize) continue;
                const cell = this.cwGrid[r][c];
                cell.active = true;
                cell.syllable = syls[i];
                cell.wordIds.push(word.id);
                if(i === 0) cell.clueNumber = word.clueNumber;
                cells.push({r, c});
            }
            word.cells = cells;
        }
    },

    // ═══════════════════════════════════════
    // 격자 좌표 계산
    // ═══════════════════════════════════════
    cwGetCellSize(){
        const maxW = this.screenW * 0.65;
        const maxH = this.screenH * 0.75;
        return Math.floor(Math.min(maxW / this.cwGridSize, maxH / this.cwGridSize, 64));
    },

    cwGetGridOffset(){
        const cellSize = this.cwGetCellSize();
        const gridW = cellSize * this.cwGridSize;
        const gridH = cellSize * this.cwGridSize;
        // 격자를 왼쪽에 배치 (오른쪽에 힌트 패널)
        const ox = Math.floor((this.screenW * 0.6 - gridW) / 2) + 10;
        const oy = Math.floor((this.screenH - gridH) / 2) + 20;
        return { x: ox, y: oy };
    },

    cwCellAt(canvasX, canvasY){
        const cellSize = this.cwGetCellSize();
        const { x: ox, y: oy } = this.cwGetGridOffset();
        const col = Math.floor((canvasX - ox) / cellSize);
        const row = Math.floor((canvasY - oy) / cellSize);
        if(row < 0 || row >= this.cwGridSize || col < 0 || col >= this.cwGridSize) return null;
        if(!this.cwGrid[row][col].active) return null;
        return { r: row, c: col };
    },

    // ═══════════════════════════════════════
    // 입력 시스템
    // ═══════════════════════════════════════
    setupCwInput(){
        // 캔버스 클릭/터치 → 셀 선택
        this._cwCanvasClick = (e) => {
            if(!this.running || this.gameMode !== 'crossword') return;
            const rect = this.cvs.getBoundingClientRect();
            const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || 0) - rect.left;
            const y = (e.clientY || (e.touches && e.touches[0]?.clientY) || 0) - rect.top;
            this.cwOnCellClick(x, y);
        };
        this.cvs.addEventListener('pointerdown', this._cwCanvasClick);

        // 데스크톱 키보드 입력
        this._cwKeydown = (e) => {
            if(!this.running || this.gameMode !== 'crossword') return;
            if(this.cwSelectedWord === null) return;
            if(e.key === 'Enter'){
                e.preventDefault();
                this.cwSubmitAnswer();
            } else if(e.key === 'Escape'){
                this.cwDeselectWord();
            }
        };
        window.addEventListener('keydown', this._cwKeydown);

        // input 이벤트 (한글 IME)
        const input = document.getElementById('cw-input');
        if(input){
            this._cwInputHandler = () => {
                this.cwInputText = input.value;
                this.cwUpdateAnswerCells();
            };
            input.addEventListener('input', this._cwInputHandler);
        }
    },

    cleanupCwInput(){
        if(this._cwCanvasClick){
            this.cvs?.removeEventListener('pointerdown', this._cwCanvasClick);
            this._cwCanvasClick = null;
        }
        if(this._cwKeydown){
            window.removeEventListener('keydown', this._cwKeydown);
            this._cwKeydown = null;
        }
        const input = document.getElementById('cw-input');
        if(input && this._cwInputHandler){
            input.removeEventListener('input', this._cwInputHandler);
            this._cwInputHandler = null;
        }
        // 모바일 키보드 숨기기
        if(GameKeyboard.isVisible()) GameKeyboard.hide();
    },

    cwOnCellClick(canvasX, canvasY){
        const pos = this.cwCellAt(canvasX, canvasY);
        if(!pos) {
            this.cwDeselectWord();
            return;
        }

        const cell = this.cwGrid[pos.r][pos.c];
        if(!cell.active) return;

        // 이미 선택된 셀을 다시 클릭하면 방향 토글
        if(this.cwSelectedCell && this.cwSelectedCell.r === pos.r && this.cwSelectedCell.c === pos.c){
            if(cell.wordIds.length > 1){
                this.cwDirection = this.cwDirection === 'across' ? 'down' : 'across';
            }
        }

        // 이 셀이 속한 단어 중 현재 방향에 맞는 것 찾기
        let wordIdx = null;
        for(const wid of cell.wordIds){
            const w = this.cwWords.find(w => w.id === wid);
            if(w && w.dir === this.cwDirection && !w.solved){
                wordIdx = this.cwWords.indexOf(w);
                break;
            }
        }
        // 현재 방향에 없으면 다른 방향
        if(wordIdx === null){
            for(const wid of cell.wordIds){
                const w = this.cwWords.find(w => w.id === wid);
                if(w && !w.solved){
                    wordIdx = this.cwWords.indexOf(w);
                    this.cwDirection = w.dir;
                    break;
                }
            }
        }

        if(wordIdx !== null){
            this.cwSelectedCell = pos;
            this.cwSelectWord(wordIdx);
        }
    },

    cwSelectWord(wordIdx){
        this.cwSelectedWord = wordIdx;
        const word = this.cwWords[wordIdx];

        // 힌트 패널 업데이트
        const dirEl = document.getElementById('cw-clue-dir');
        const textEl = document.getElementById('cw-clue-text');
        if(dirEl) dirEl.textContent = word.dir === 'across' ? `가로 ${word.clueNumber}` : `세로 ${word.clueNumber}`;
        if(textEl) textEl.textContent = word.clue;

        // 입력바 표시
        const answerBar = document.getElementById('cw-answer-bar');
        if(answerBar) answerBar.classList.remove('hidden');

        // 입력 초기화
        this.cwInputText = '';
        const input = document.getElementById('cw-input');
        if(input){
            input.value = '';
            input.maxLength = word.answer.length;
            // 데스크톱: 입력 포커스
            if(!('ontouchstart' in window)){
                input.focus();
            }
        }

        // 답칸 업데이트
        this.cwUpdateAnswerCells();

        // 모바일: GameKeyboard 표시
        if('ontouchstart' in window || navigator.maxTouchPoints > 0){
            GameKeyboard.show((text) => {
                this.cwInputText = text;
                const inp = document.getElementById('cw-input');
                if(inp) inp.value = text;
                this.cwUpdateAnswerCells();
                this.cwSubmitAnswer();
            });
        }
    },

    cwDeselectWord(){
        this.cwSelectedWord = null;
        this.cwSelectedCell = null;
        const answerBar = document.getElementById('cw-answer-bar');
        if(answerBar) answerBar.classList.add('hidden');
        const input = document.getElementById('cw-input');
        if(input) input.blur();
        if(GameKeyboard.isVisible()) GameKeyboard.hide();
    },

    cwUpdateAnswerCells(){
        const container = document.getElementById('cw-answer-cells');
        if(!container || this.cwSelectedWord === null) return;
        const word = this.cwWords[this.cwSelectedWord];
        const syls = [...(this.cwInputText || '')];

        container.innerHTML = '';
        for(let i = 0; i < word.answer.length; i++){
            const box = document.createElement('div');
            box.className = 'cw-ans-cell';
            // 이미 교차점에서 맞춰진 글자가 있으면 표시
            const cell = word.cells[i] ? this.cwGrid[word.cells[i].r][word.cells[i].c] : null;
            if(cell && cell.correct){
                box.textContent = cell.filled;
                box.classList.add('cw-ans-fixed');
            } else if(syls[i]){
                box.textContent = syls[i];
            }
            container.appendChild(box);
        }
    },

    cwSubmitAnswer(){
        if(this.cwSelectedWord === null) return;
        const word = this.cwWords[this.cwSelectedWord];
        const input = document.getElementById('cw-input');
        const answer = (input?.value || this.cwInputText || '').trim();

        if(answer.length !== word.answer.length) return; // 글자수 부족

        if(answer === word.answer){
            this.cwOnCorrect(this.cwSelectedWord);
        } else {
            this.cwOnWrong(this.cwSelectedWord);
        }
    },

    cwOnCorrect(wordIdx){
        const word = this.cwWords[wordIdx];
        word.solved = true;
        const syls = [...word.answer];

        // 격자에 채우기
        for(let i = 0; i < word.cells.length; i++){
            const { r, c } = word.cells[i];
            this.cwGrid[r][c].filled = syls[i];
            this.cwGrid[r][c].correct = true;
        }

        // 파티클
        const cellSize = this.cwGetCellSize();
        const { x: ox, y: oy } = this.cwGetGridOffset();
        const midCell = word.cells[Math.floor(word.cells.length/2)];
        const px = ox + midCell.c * cellSize + cellSize/2;
        const py = oy + midCell.r * cellSize + cellSize/2;
        for(let i = 0; i < 15; i++){
            this.particles.push({
                x: px, y: py,
                vx: (Math.random()-.5)*6,
                vy: -Math.random()*4-1,
                color: ['#FFD700','#54A0FF','#00B894','#FF6B6B','#A29BFE'][Math.floor(Math.random()*5)],
                size: 3+Math.random()*3,
                life: 60+Math.random()*40,
                maxLife: 100
            });
        }

        this.cwCorrectFlash = 20;

        // 채팅 버블
        this.chatBubbles.push({
            x: px, y: py - 30,
            text: '✅ 정답!',
            timer: 60, follow:null, screen:true, big:false
        });

        // 선택 해제
        this.cwDeselectWord();

        // 모든 단어 완료 체크
        this.cwCheckAllSolved();
    },

    cwOnWrong(wordIdx){
        this.cwWrongFlash = 20;
        const input = document.getElementById('cw-input');
        if(input){
            input.value = '';
            input.focus();
        }
        this.cwInputText = '';
        this.cwUpdateAnswerCells();

        // 틀림 버블
        this.chatBubbles.push({
            x: this.screenW/2, y: this.screenH/2,
            text: '❌ 다시 생각해봐!',
            timer: 60, follow:null, screen:true, big:false
        });
    },

    cwCheckAllSolved(){
        const allSolved = this.cwWords.every(w => w.solved);
        if(!allSolved) return;

        // 다음 스테이지 or 클리어
        if(this.stage + 1 >= this.cwStageCount){
            // 전체 클리어!
            this.missionClear();
        } else {
            // 스테이지 전환
            this.cwStageTransition = 90; // 1.5초 연출
            this.chatBubbles.push({
                x: this.screenW/2, y: this.screenH/3,
                text: '🎉 스테이지 클리어! 다음으로!',
                timer: 80, follow:null, screen:true, big:true
            });
            // 파티클 축하
            for(let i = 0; i < 30; i++){
                this.particles.push({
                    x: this.screenW/2 + (Math.random()-.5)*200,
                    y: this.screenH/2,
                    vx: (Math.random()-.5)*8,
                    vy: -Math.random()*6-2,
                    color: ['#FFD700','#FF6B6B','#54A0FF','#00B894','#FDCB6E','#A29BFE'][Math.floor(Math.random()*6)],
                    size: 3+Math.random()*4,
                    life: 80+Math.random()*60,
                    maxLife: 140
                });
            }
        }
    },

    // ═══════════════════════════════════════
    // 업데이트 루프
    // ═══════════════════════════════════════
    updateCrossword(){
        this.cwFrame++;

        // 빅토리 타이머
        if(this.victoryTimer > 0){
            this.victoryTimer--;
            // 파티클 업데이트
            {
                let w = 0;
                const arr = this.particles;
                for(let i = 0; i < arr.length; i++){
                    const p = arr[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.1;
                    p.life--;
                    if(p.life > 0) arr[w++] = p;
                }
                arr.length = w;
            }
            {
                let w = 0;
                const arr = this.chatBubbles;
                for(let i = 0; i < arr.length; i++){
                    const b = arr[i];
                    b.timer--;
                    if(b.timer > 0) arr[w++] = b;
                }
                arr.length = w;
            }
            if(this.victoryTimer <= 0){
                this.running = false;
                this.showVictoryReward();
            }
            return;
        }

        if(!this.running) return;

        // 스테이지 전환 타이머
        if(this.cwStageTransition > 0){
            this.cwStageTransition--;
            if(this.cwStageTransition <= 0){
                this.stage++;
                this.loadCwStage(this.stage);
            }
        }

        // 플래시 감소
        if(this.cwWrongFlash > 0) this.cwWrongFlash--;
        if(this.cwCorrectFlash > 0) this.cwCorrectFlash--;

        // 파티클
        {
            let w = 0;
            const arr = this.particles;
            for(let i = 0; i < arr.length; i++){
                const p = arr[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.life--;
                if(p.life > 0) arr[w++] = p;
            }
            arr.length = w;
        }

        // 채팅 버블
        {
            let w = 0;
            const arr = this.chatBubbles;
            for(let i = 0; i < arr.length; i++){
                const b = arr[i];
                b.timer--;
                if(b.timer > 0) arr[w++] = b;
            }
            arr.length = w;
        }

        // 멀티플레이어 진행상황 브로드캐스트
        this._cwBroadcastProgress();

        // HUD 업데이트
        const totalW = this.cwWords ? this.cwWords.length : 1;
        const solvedW = this.cwWords ? this.cwWords.filter(w => w.solved).length : 0;
        const fill = document.getElementById('hud-fill');
        if(fill){
            const stageProgress = solvedW / totalW;
            const overall = (this.stage + stageProgress) / this.cwStageCount;
            fill.style.width = (overall * 100) + '%';
        }
    },

    // ═══════════════════════════════════════
    // 렌더링
    // ═══════════════════════════════════════
    renderCrossword(){
        const ctx = this.ctx;
        const sw = this.screenW, sh = this.screenH;
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // 배경
        const grad = ctx.createLinearGradient(0, 0, 0, sh);
        grad.addColorStop(0, '#0a0a2e');
        grad.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, sw, sh);

        // 격자 렌더링
        this.renderCwGrid(ctx);

        // 힌트 목록 (오른쪽 패널)
        this.renderCwClues(ctx);

        // 리더보드 (멀티플레이어)
        if(this.cwRemoteProgress.size > 0){
            this.renderCwLeaderboard(ctx);
        }

        // 파티클
        for(const p of this.particles){
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        // 채팅 버블
        for(const b of this.chatBubbles){
            const alpha = Math.min(1, b.timer / 20);
            ctx.globalAlpha = alpha;
            ctx.font = b.big ? 'bold 22px "Noto Sans KR", sans-serif' : 'bold 16px "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            // 배경
            const tw = ctx.measureText(b.text).width + 20;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            const bx = b.x - tw/2, by = b.y - (b.big ? 16 : 12);
            ctx.beginPath();
            ctx.roundRect(bx, by, tw, b.big ? 36 : 28, 8);
            ctx.fill();
            // 텍스트
            ctx.fillStyle = '#fff';
            ctx.fillText(b.text, b.x, b.y + (b.big ? 8 : 4));
        }
        ctx.globalAlpha = 1;

        ctx.restore();
    },

    renderCwGrid(ctx){
        const cellSize = this.cwGetCellSize();
        const { x: ox, y: oy } = this.cwGetGridOffset();
        const size = this.cwGridSize;

        for(let r = 0; r < size; r++){
            for(let c = 0; c < size; c++){
                const cell = this.cwGrid[r][c];
                const x = ox + c * cellSize;
                const y = oy + r * cellSize;

                if(!cell.active){
                    // 비활성 셀: 어두운 색
                    ctx.fillStyle = 'rgba(255,255,255,0.03)';
                    ctx.fillRect(x, y, cellSize, cellSize);
                    continue;
                }

                // 배경색 결정
                let bgColor = 'rgba(255,255,255,0.12)';
                if(cell.correct){
                    bgColor = 'rgba(0,184,148,0.35)'; // 초록
                }
                // 선택된 단어 하이라이트
                if(this.cwSelectedWord !== null){
                    const selWord = this.cwWords[this.cwSelectedWord];
                    const isInWord = selWord.cells.some(sc => sc.r === r && sc.c === c);
                    if(isInWord && !cell.correct){
                        bgColor = 'rgba(84,160,255,0.3)'; // 파란 하이라이트
                    }
                }
                // 오답 플래시
                if(this.cwWrongFlash > 0 && this.cwSelectedWord !== null){
                    const selWord = this.cwWords[this.cwSelectedWord];
                    const isInWord = selWord.cells.some(sc => sc.r === r && sc.c === c);
                    if(isInWord){
                        bgColor = `rgba(255,107,107,${0.4 * (this.cwWrongFlash / 20)})`;
                    }
                }

                // 셀 배경
                ctx.fillStyle = bgColor;
                ctx.beginPath();
                ctx.roundRect(x+1, y+1, cellSize-2, cellSize-2, 4);
                ctx.fill();

                // 테두리
                ctx.strokeStyle = cell.correct ? 'rgba(0,184,148,0.6)' : 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // 선택된 셀 강조 테두리
                if(this.cwSelectedCell && this.cwSelectedCell.r === r && this.cwSelectedCell.c === c){
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }

                // 번호 표시
                if(cell.clueNumber){
                    ctx.font = `bold ${Math.max(9, cellSize * 0.2)}px "Noto Sans KR", sans-serif`;
                    ctx.fillStyle = 'rgba(255,255,255,0.6)';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(String(cell.clueNumber), x + 3, y + 2);
                }

                // 채워진 글자
                if(cell.filled){
                    ctx.font = `bold ${Math.max(16, cellSize * 0.5)}px "Noto Sans KR", sans-serif`;
                    ctx.fillStyle = cell.correct ? '#fff' : 'rgba(255,255,255,0.8)';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.filled, x + cellSize/2, y + cellSize/2 + 1);
                }
            }
        }

        // 스테이지 타이틀
        ctx.font = 'bold 16px "Noto Sans KR", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${this.cwTitle} — ${this.stage+1}/${this.cwStageCount}`, ox + (size*cellSize)/2, oy - 8);
    },

    renderCwClues(ctx){
        const cellSize = this.cwGetCellSize();
        const gridW = cellSize * this.cwGridSize;
        const { x: ox, y: oy } = this.cwGetGridOffset();

        // 오른쪽 힌트 패널
        const panelX = ox + gridW + 20;
        const panelW = this.screenW - panelX - 10;
        if(panelW < 80) return; // 공간 부족 시 생략

        let py = oy;

        // 가로 힌트
        ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('▶ 가로', panelX, py);
        py += 20;

        ctx.font = '11px "Noto Sans KR", sans-serif';
        for(const w of this.cwWords){
            if(w.dir !== 'across') continue;
            ctx.fillStyle = w.solved ? 'rgba(0,184,148,0.8)' : (this.cwSelectedWord !== null && this.cwWords[this.cwSelectedWord] === w ? '#fff' : 'rgba(255,255,255,0.6)');
            const prefix = w.solved ? '✅' : `${w.clueNumber}.`;
            const text = `${prefix} ${w.clue}`;
            // 텍스트 줄바꿈 (간단하게 자르기)
            const maxChars = Math.floor(panelW / 11) || 15;
            const display = text.length > maxChars ? text.slice(0, maxChars-1) + '…' : text;
            ctx.fillText(display, panelX, py);
            py += 16;
        }

        py += 10;

        // 세로 힌트
        ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#54A0FF';
        ctx.fillText('▼ 세로', panelX, py);
        py += 20;

        ctx.font = '11px "Noto Sans KR", sans-serif';
        for(const w of this.cwWords){
            if(w.dir !== 'down') continue;
            ctx.fillStyle = w.solved ? 'rgba(0,184,148,0.8)' : (this.cwSelectedWord !== null && this.cwWords[this.cwSelectedWord] === w ? '#fff' : 'rgba(255,255,255,0.6)');
            const prefix = w.solved ? '✅' : `${w.clueNumber}.`;
            const text = `${prefix} ${w.clue}`;
            const maxChars = Math.floor(panelW / 11) || 15;
            const display = text.length > maxChars ? text.slice(0, maxChars-1) + '…' : text;
            ctx.fillText(display, panelX, py);
            py += 16;
        }
    },

    renderCwLeaderboard(ctx){
        // 간단한 리더보드 (하단 우측)
        const lx = this.screenW - 140;
        const ly = this.screenH - 20 - this.cwRemoteProgress.size * 22;

        ctx.font = 'bold 11px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        let yi = 0;
        const entries = [...this.cwRemoteProgress.values()].sort((a,b) => b.solved - a.solved);
        for(const rp of entries){
            const y = ly + yi * 22;
            ctx.fillStyle = rp.done ? '#00B894' : 'rgba(255,255,255,0.5)';
            ctx.fillText(`${rp.displayName}: ${rp.solved}단어 ${rp.done ? '✅' : ''}`, lx, y);
            yi++;
        }
    },

    // ═══════════════════════════════════════
    // 멀티플레이어 동기화
    // ═══════════════════════════════════════
    _cwBroadcastProgress(){
        if(!this._rtChannel || this.spectatorMode) return;
        const now = Date.now();
        if(now - (this._cwLastBroadcast || 0) < 500) return;
        this._cwLastBroadcast = now;

        const solved = this.cwWords ? this.cwWords.filter(w => w.solved).length : 0;
        const total = this.cwWords ? this.cwWords.length : 0;

        this._rtChannel.send({
            type: 'broadcast', event: 'cwprogress',
            payload: {
                sid: String(Player.studentId),
                solved, total,
                stage: this.stage,
                done: this.completed
            }
        });
    },

    _onCwRemoteProgress(data){
        if(!data || !data.sid) return;
        const existing = this.cwRemoteProgress.get(data.sid);
        if(existing){
            existing.solved = data.solved;
            existing.total = data.total;
            existing.stage = data.stage;
            existing.done = data.done;
        }
    },
};
