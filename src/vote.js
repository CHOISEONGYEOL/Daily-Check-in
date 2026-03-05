// ── Game Vote System ──
import { DB } from './db.js';
import { Player } from './player.js';

const TEST_ACCOUNT = '99999';

export const Vote = {
    // 게임 목록 (status: 'open'=투표 가능, 'soon'=준비중)
    GAMES: [
        { id: 'picopark',      name: '🔑 피코파크',        desc: '협동 퍼즐!',         bounty: 50,  status: 'open' },
        { id: 'numbermatch',   name: '🔢 숫자를 찾아라',   desc: '자기 번호 자리에 서기!',  bounty: 50,  status: 'open' },
        { id: 'quiz',          name: '❓ 퀴즈 대회',        desc: '지식을 겨루자!',          bounty: 80,  status: 'soon' },
        { id: 'relay',         name: '🏃 릴레이 레이스',    desc: '팀 릴레이 달리기!',       bounty: 60,  status: 'soon' },
        { id: 'maze',          name: '🌀 미로 탈출',        desc: '투명한 벽 속 출구를 찾아라!', bounty: 100, status: 'open' },
        { id: 'escaperoom',    name: '🚪 방탈출',           desc: '단서를 찾고 퀴즈를 풀어 탈출하라!', bounty: 100, status: 'open' },
        { id: 'crossword',    name: '📝 가로세로 퀴즈',   desc: '낱말 퍼즐을 풀어라!', bounty: 80,  status: 'open' },
        { id: 'ollaolla',     name: '🧗 올라올라',        desc: 'OX 퀴즈로 계단을 올라가라!', bounty: 80, status: 'open' },
        { id: 'rhythm',        name: '🎵 리듬 게임',        desc: '박자에 맞춰 점프!',       bounty: 60,  status: 'soon' },
        { id: 'tower',         name: '🗼 탑 쌓기',          desc: '가장 높이 쌓아라!',       bounty: 40,  status: 'soon' },
        { id: 'fishing',       name: '🎣 낚시 대회',        desc: '물고기를 잡아라!',        bounty: 45,  status: 'soon' },
        { id: 'memory',        name: '🧠 기억력 게임',      desc: '카드를 뒤집어 짝 맞추기!', bounty: 55, status: 'soon' },
        { id: 'painting',      name: '🎨 그림 맞추기',      desc: '무엇을 그렸을까?',       bounty: 65,  status: 'soon' },
        { id: 'survival',      name: '🏝️ 서바이벌',         desc: '끝까지 살아남아라!',      bounty: 90,  status: 'soon' },
        { id: 'tictactoe',     name: '⭕ 틱택토 토너먼트',  desc: '반 대항전!',              bounty: 35,  status: 'soon' },
        { id: 'typing',        name: '⌨️ 타자 대회',        desc: '누가 가장 빠를까?',       bounty: 50,  status: 'soon' },
        { id: 'hide',          name: '👻 숨바꼭질',         desc: '술래를 피해 숨어라!',     bounty: 70,  status: 'soon' },
        { id: 'bomb',          name: '💣 폭탄 돌리기',      desc: '폭탄을 넘겨라!',          bounty: 55,  status: 'soon' },
        { id: 'race',          name: '🏎️ 레이싱',           desc: '결승선을 향해!',          bounty: 60,  status: 'soon' },
        { id: 'cook',          name: '🍳 요리 대회',        desc: '레시피대로 요리하기!',    bounty: 50,  status: 'soon' },
        { id: 'treasure',      name: '🗺️ 보물찾기',         desc: '숨겨진 보물을 찾아라!',   bounty: 75,  status: 'soon' },
        { id: 'dance',         name: '💃 댄스 배틀',        desc: '춤 동작을 따라해!',       bounty: 55,  status: 'soon' },
        { id: 'soccer',        name: '⚽ 미니 축구',        desc: '골을 넣어라!',            bounty: 65,  status: 'soon' },
        { id: 'wordchain',     name: '📝 끝말잇기',         desc: '단어를 이어가자!',        bounty: 40,  status: 'soon' },
        { id: 'archery',       name: '🏹 양궁 대회',        desc: '과녁을 맞춰라!',          bounty: 50,  status: 'soon' },
        { id: 'puzzle',        name: '🧩 퍼즐 맞추기',      desc: '조각을 맞춰 완성해!',    bounty: 45,  status: 'soon' },
        { id: 'balloon',       name: '🎈 풍선 터뜨리기',    desc: '풍선을 모두 터뜨려라!',  bounty: 35,  status: 'soon' },
        { id: 'space',         name: '🚀 우주 탐험',        desc: '행성을 탐험하라!',        bounty: 85,  status: 'soon' },
    ],

    get openGames() {
        return this.GAMES.filter(g => g.status === 'open');
    },

    votes: {},
    playerVote: null,
    timer: 20,
    timerRef: null,
    npcTimers: [],
    selectedGame: null,
    clearedGames: [],
    _onComplete: null,
    _onGameDecided: null,   // ★ 게임 결정 즉시 콜백 (브로드캐스트 동기화용)
    totalVoters: 1,   // player + npcs

    async start(totalStudents, onComplete) {
        this._onComplete = onComplete;
        // _onGameDecided는 외부에서 설정 — start()에서 초기화하지 않음
        this.votes = {};
        this.playerVote = null;
        this.selectedGame = null;
        this.timer = 20;
        this.totalVoters = totalStudents;
        // open 게임만 투표 초기화
        this.openGames.forEach(g => { this.votes[g.id] = 0; });

        // DB에서 클리어 목록 로드
        try {
            this.clearedGames = await DB.getGameClears();
        } catch(e) {
            console.warn('Failed to load game clears:', e);
            this.clearedGames = [];
        }

        // UI 표시
        const overlay = document.getElementById('wr-vote-overlay');
        if(overlay) overlay.classList.remove('hidden');
        this.render();
        this._updateTimerUI();

        // 타이머 시작
        this.timerRef = setInterval(() => {
            this.timer--;
            this._updateTimerUI();
            if(this.timer <= 0) this._finishVote();
        }, 1000);

        // NPC 투표 — 20초 동안 랜덤하게 나눠서 투표
        this._scheduleNPCVotes(totalStudents - 1);

        // 교사에게 투표 시작 알림
        if(Player.className && Player.studentId !== TEST_ACCOUNT) {
            DB.setGamePhase(Player.className, 'voting').catch(()=>{});
        }
    },

    _scheduleNPCVotes(npcCount) {
        this.npcTimers = [];
        const open = this.openGames;
        if(!open.length) return;
        for(let i = 0; i < npcCount; i++) {
            const delay = 1000 + Math.random() * 18500; // 1~19.5초 사이
            const t = setTimeout(() => {
                if(!this.timerRef) return; // 이미 종료
                // NPC는 현상금 있는 게임에 약간 더 많이 투표 (70% 확률)
                const uncleared = open.filter(g => !this.clearedGames.includes(g.id));
                let pick;
                if(uncleared.length > 0 && Math.random() < 0.7) {
                    pick = uncleared[Math.floor(Math.random() * uncleared.length)];
                } else {
                    pick = open[Math.floor(Math.random() * open.length)];
                }
                this.votes[pick.id]++;
                this.render();
            }, delay);
            this.npcTimers.push(t);
        }
    },

    castVote(gameId) {
        if(!this.timerRef) return; // 투표 종료됨
        // 준비중 게임은 투표 불가
        const game = this.GAMES.find(g => g.id === gameId);
        if(!game || game.status !== 'open') return;
        // 이전 투표 취소
        const oldVote = this.playerVote;
        if(oldVote) {
            this.votes[oldVote]--;
        }
        this.playerVote = gameId;
        this.votes[gameId]++;
        this.render();
        // 교사에게 실시간 전송
        if(Player.className && Player.studentId !== TEST_ACCOUNT) {
            this._syncVoteToSupabase(gameId, oldVote);
        }
    },

    async _syncVoteToSupabase(newVote, oldVote) {
        try {
            const current = await DB.readVoteData(Player.className);
            const votes = current?.votes || {};
            if(oldVote && votes[oldVote] > 0) votes[oldVote]--;
            votes[newVote] = (votes[newVote] || 0) + 1;
            await DB.broadcastVote(Player.className, { votes, ts: Date.now() });
        } catch(e) { /* ignore */ }
    },

    render() {
        const grid = document.getElementById('vote-grid');
        if(!grid) return;

        const totalVotes = Object.values(this.votes).reduce((a,b) => a+b, 0);

        grid.innerHTML = this.GAMES.filter(g => g.status === 'open').map(g => {
            const count = this.votes[g.id] || 0;
            const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
            const isCleared = this.clearedGames.includes(g.id);
            const isSelected = this.playerVote === g.id;

            return `<div class="vote-card${isCleared ? ' cleared' : ''}${isSelected ? ' selected' : ''}"
                         onclick="Vote.castVote('${g.id}')">
                <div class="vote-card-top">
                    <span class="vote-game-name">${g.name}</span>
                    ${isCleared
                        ? '<span class="vote-badge cleared-badge">✅ 클리어</span>'
                        : `<span class="vote-badge bounty-badge">🪙 ${g.bounty} 현상금!</span>`}
                </div>
                <div class="vote-desc">${g.desc}</div>
                <div class="vote-bar-wrap">
                    <div class="vote-bar-fill" style="width:${pct}%"></div>
                    <span class="vote-bar-text">${count}표 (${pct}%)</span>
                </div>
            </div>`;
        }).join('');
    },

    _updateTimerUI() {
        const numEl = document.getElementById('vote-timer-num');
        const fillEl = document.getElementById('vote-timer-fill');
        if(numEl) numEl.textContent = this.timer;
        if(fillEl) fillEl.style.width = (this.timer / 20 * 100) + '%';
    },

    _finishVote() {
        clearInterval(this.timerRef);
        this.timerRef = null;
        this.npcTimers.forEach(t => clearTimeout(t));
        this.npcTimers = [];

        // 테스트 계정(99999)이 투표했으면 무조건 그 게임 선택
        const open = this.openGames;
        if(Player.studentId === TEST_ACCOUNT && this.playerVote) {
            const forced = open.find(g => g.id === this.playerVote);
            if(forced) {
                this.selectedGame = forced;
            }
        }

        // 그 외: 최다 득표 선택
        if(!this.selectedGame) {
            let maxVotes = 0;
            let winners = [];
            for(const g of open) {
                const v = this.votes[g.id] || 0;
                if(v > maxVotes) { maxVotes = v; winners = [g]; }
                else if(v === maxVotes) { winners.push(g); }
            }
            // 동표 → 교사에게 선택권 위임
            if(winners.length > 1) {
                this._startTiebreak(winners);
                return;
            }
            this.selectedGame = winners[Math.floor(Math.random() * winners.length)];
        }

        this._announceResult();
    },

    async _announceResult() {
        // ★ 게임 결정 즉시 브로드캐스트 콜백 (DB 쓰기보다 먼저 — 최소 지연)
        if(this._onGameDecided) {
            try { this._onGameDecided(this.selectedGame.id); } catch(e) { console.warn('onGameDecided error:', e); }
        }

        const open = this.openGames;
        // 교사에게 결과 전송 (await로 DB 확정 보장)
        if(Player.className && Player.studentId !== TEST_ACCOUNT) {
            try {
                await DB.setSelectedGame(Player.className, this.selectedGame.id);
            } catch(e) { /* ignore */ }
            DB.setGamePhase(Player.className, 'countdown', {
                vote_data: JSON.stringify({ votes: this.votes, winner: this.selectedGame.id, ts: Date.now() })
            }).catch(()=>{});
        }

        // 결과 발표 UI
        const grid = document.getElementById('vote-grid');
        const hint = document.querySelector('.vote-hint');
        if(hint) hint.textContent = '';

        if(grid) {
            const g = this.selectedGame;
            const isCleared = this.clearedGames.includes(g.id);
            grid.innerHTML = `<div class="vote-result">
                <div class="vote-result-emoji">${g.name.split(' ')[0]}</div>
                <div class="vote-result-name">${g.name}</div>
                <div class="vote-result-bounty">${isCleared ? '클리어 완료 - 보상 없음' : `🪙 ${g.bounty} 코인 현상금!`}</div>
                <div class="vote-result-sub">곧 게임이 시작됩니다...</div>
            </div>`;
        }

        // 3초 후 오버레이 닫고 콜백
        setTimeout(() => {
            const overlay = document.getElementById('wr-vote-overlay');
            if(overlay) overlay.classList.add('hidden');
            if(this._onComplete) this._onComplete();
        }, 3000);
    },

    _tiebreakPollRef: null,

    _tiebreakTimeoutRef: null,

    _startTiebreak(winners) {
        // 교사에게 동표 알림 + 선택 요청
        const tiedIds = winners.map(g => g.id);
        if(Player.className) {
            DB.setGamePhase(Player.className, 'tiebreak', {
                vote_data: JSON.stringify({ votes: this.votes, tiedGames: tiedIds, ts: Date.now() })
            }).catch(()=>{});
        }

        // 학생 UI: 동표 대기 화면
        const grid = document.getElementById('vote-grid');
        const hint = document.querySelector('.vote-hint');
        if(hint) hint.textContent = '';

        if(grid) {
            const tiedHtml = winners.map(g =>
                `<div class="vote-tied-game">
                    <span class="vote-tied-emoji">${g.name.split(' ')[0]}</span>
                    <span class="vote-tied-name">${g.name}</span>
                    <span class="vote-tied-votes">${this.votes[g.id] || 0}표</span>
                </div>`
            ).join('');
            grid.innerHTML = `<div class="vote-result">
                <div class="vote-result-emoji">⚖️</div>
                <div class="vote-result-name">동표!</div>
                <div class="vote-result-sub" style="margin-bottom:12px">선생님이 게임을 선택하고 있습니다...</div>
                <div class="vote-tied-list">${tiedHtml}</div>
                <div class="vote-tiebreak-dots"><span>.</span><span>.</span><span>.</span></div>
            </div>`;
        }

        // 교사 선택 폴링 (1초 간격) — className 있을 때만
        if(Player.className) {
            this._tiebreakPollRef = setInterval(async () => {
                try {
                    const data = await DB.getSpectatorData(Player.className);
                    if(data.selectedGame) {
                        clearInterval(this._tiebreakPollRef);
                        this._tiebreakPollRef = null;
                        clearTimeout(this._tiebreakTimeoutRef);
                        this._tiebreakTimeoutRef = null;
                        const picked = this.openGames.find(g => g.id === data.selectedGame);
                        if(picked) {
                            this.selectedGame = picked;
                            this._announceResult();
                        }
                    }
                } catch(e) { /* ignore */ }
            }, 1000);
        }

        // 15초 타임아웃: 교사가 안 고르면 자동 랜덤 선택
        this._tiebreakTimeoutRef = setTimeout(() => {
            if(this.selectedGame) return; // 이미 선택됨
            clearInterval(this._tiebreakPollRef);
            this._tiebreakPollRef = null;
            this.selectedGame = winners[Math.floor(Math.random() * winners.length)];
            this._announceResult();
        }, 15000);
    },

    stop() {
        clearInterval(this.timerRef);
        this.timerRef = null;
        clearInterval(this._tiebreakPollRef);
        this._tiebreakPollRef = null;
        clearTimeout(this._tiebreakTimeoutRef);
        this._tiebreakTimeoutRef = null;
        this.npcTimers.forEach(t => clearTimeout(t));
        this.npcTimers = [];
        const overlay = document.getElementById('wr-vote-overlay');
        if(overlay) overlay.classList.add('hidden');
    },
};
