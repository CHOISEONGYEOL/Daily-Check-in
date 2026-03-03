// ── Teacher Vote Overlay, Countdown, God Mode & Game Entry (extracted from waiting-room.js) ──
import { Player } from './player.js';
import { Vote } from './vote.js';
import { DB } from './db.js';
import { PerfMonitor } from './perf-monitor.js';

// Forward reference — set by main.js via waiting-room.js re-export
let Game = null;
export function setGame(g) { Game = g; }

export const WrTeacher = {

    // ── 학생: 교사의 game_started 신호 폴링 ──
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
                    Vote.start(this.totalStudents, async () => {
                        // DB에서 확정된 게임 ID 읽기 (중앙 동기화 — 모든 학생이 같은 게임)
                        try {
                            const data = await DB.getSpectatorData(Player.className);
                            this.selectedGameId = data.selectedGame || Vote.selectedGame.id;
                        } catch(e) {
                            this.selectedGameId = Vote.selectedGame.id;
                        }
                        this.startCountdown();
                    });
                }
            } catch(e){ /* ignore polling errors */ }
        }, 3000);
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
            PerfMonitor.enabled = true;
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
                try { PerfMonitor.startFrame(); this.updateGodMode(); PerfMonitor.endUpdate(); this.render(); PerfMonitor.endFrame(); } catch(e) { PerfMonitor.logError(e.message); console.error('WR god loop error:', e); }
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
        this._rtPredictRemotePlayers();
        // 기믹/장애물/공 업데이트 (교사도 시각적 효과 표시)
        this.updateObstacles();
        if(this._isHost) this._rtCheckAndSendGimmick();
        if(this._isHost) this.updateBall(); else this._rtPredictBall();
        // 채팅 버블 인플레이스 업데이트
        { let w=0; const arr=this.chatBubbles;
        for(let i=0;i<arr.length;i++){ const b=arr[i]; b.timer--; if(b.follow){b.x=b.follow.x;b.y=b.follow.y-45;} if(b.timer>0) arr[w++]=b; }
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
};
