// ── Realtime Multiplayer (Supabase Broadcast + Presence) ──
// Mixed into WaitingRoom via Object.assign
import { supabase } from './supabase.js';
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';
import { DB } from './db.js';
import { PerfMonitor } from './perf-monitor.js';

const POS_HEARTBEAT = 1000;   // 위치 heartbeat 주기 (1초) — 안전망
const BALL_HEARTBEAT = 1000;  // 공 heartbeat 주기 (1초)

export const WrRealtime = {
    remotePlayers: null,   // Map<studentId, RemotePlayerEntity>
    _rtChannel: null,
    _isHost: false,
    _rtSpriteCache: new Map(),
    _rtStatus: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
    _rtRemoteArrayCache: null, // 캐시된 배열 (매 프레임 1회 갱신)
    _rtRemoteArrayDirty: true, // 캐시 무효화 플래그
    _rtLastSentBall: null,     // delta check: 마지막 전송 공 상태
    // Event-driven 전송 상태
    _rtLastSendTime: 0,        // 마지막 위치 전송 시각
    _rtLastMoveDir: 0,         // 마지막 전송한 moveDir
    _rtLastOnGround: true,     // 마지막 전송한 onGround
    _rtLastEmote: null,        // 마지막 전송한 emote
    _rtLastExplode: false,     // 마지막 전송한 explode 상태
    _rtCurrentMoveDir: 0,      // 현재 프레임 이동 방향
    _rtLastBallSendTime: 0,    // 마지막 공 전송 시각
    _rtLastBallVxSign: 0,      // 마지막 전송한 공 vx 부호
    _rtLastBallVySign: 0,      // 마지막 전송한 공 vy 부호

    // ── 채널 초기화 ──
    rtInit() {
        if (this._rtChannel) this.rtDestroy();
        this.remotePlayers = new Map();
        this._rtStatus = 'connecting';

        const className = this.godMode
            ? (this._teacherClassName || '')
            : (Player.className || '');
        const channelName = `wr:${className || 'main'}`;
        console.log('[RT] init channel=' + channelName + ' sid=' + Player.studentId);

        const channel = supabase.channel(channelName, {
            config: { broadcast: { self: false }, presence: { key: String(Player.studentId) } }
        });

        // Broadcast 수신
        channel.on('broadcast', { event: 'pos' }, ({ payload }) => { PerfMonitor.logRecv(150); this._rtOnRemotePos(payload); });
        channel.on('broadcast', { event: 'ball' }, ({ payload }) => { PerfMonitor.logRecv(200); this._rtOnRemoteBall(payload); });
        channel.on('broadcast', { event: 'chat' }, ({ payload }) => { PerfMonitor.logRecv(80); this._rtOnRemoteChat(payload); });
        channel.on('broadcast', { event: 'emote' }, ({ payload }) => { PerfMonitor.logRecv(60); this._rtOnRemoteEmote(payload); });
        channel.on('broadcast', { event: 'goal' }, ({ payload }) => { PerfMonitor.logRecv(120); this._rtOnRemoteGoal(payload); });
        channel.on('broadcast', { event: 'shutdown' }, () => { PerfMonitor.logRecv(20); this._rtOnShutdown(); });
        channel.on('broadcast', { event: 'gimmick' }, ({ payload }) => { PerfMonitor.logRecv(300); this._rtOnRemoteGimmick(payload); });

        // Presence 수신
        channel.on('presence', { event: 'sync' }, () => this._rtOnPresenceSync());
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            if (newPresences && newPresences.length > 0) {
                this._rtOnPresenceJoin(key, newPresences[0]);
            }
        });
        channel.on('presence', { event: 'leave' }, ({ key }) => {
            this._rtOnPresenceLeave(key);
        });

        channel.subscribe(async (status) => {
            console.log('[RT] subscribe:', status);
            if (status === 'SUBSCRIBED') {
                this._rtStatus = 'connected';
                try {
                    if (!this.godMode) {
                        await channel.track({
                            studentId: String(Player.studentId),
                            nickname: Player.nickname || '',
                            activeTitle: Player.activeTitle || '',
                            hat: Player.equipped?.hat || null,
                            effect: Player.equipped?.effect || null,
                            pet: Player.equipped?.pet || null,
                            team: this.player?.team || 'left',
                            isTeacher: false,
                        });
                        console.log('[RT] tracked OK');
                    } else {
                        await channel.track({
                            studentId: String(Player.studentId || '77777'),
                            nickname: '선생님',
                            isTeacher: true,
                        });
                    }
                } catch (e) {
                    console.error('[RT] track error:', e);
                    this._rtStatus = 'error';
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                this._rtStatus = 'error';
                console.error('[RT] channel error:', status);
            }
        });

        this._rtChannel = channel;
        // Event-driven: setInterval 없음 — 상태 변화 시 _rtCheckAndSendPos()에서 전송
    },

    // ── 채널 해제 ──
    rtDestroy() {
        if (this._rtChannel) {
            this._rtChannel.unsubscribe();
            supabase.removeChannel(this._rtChannel);
            this._rtChannel = null;
        }
        if (this.remotePlayers) this.remotePlayers.clear();
        this._rtRemoteArrayCache = null;
        this._rtRemoteArrayDirty = true;
        this._isHost = false;
        this._rtStatus = 'disconnected';
    },

    // ── 위치 브로드캐스트 (Event-Driven: 상태 변화 시에만) ──
    _rtBroadcastPosition() {
        if (!this._rtChannel || !this.player || this.godMode) return;
        const p = this.player;
        const x = Math.round(p.x), y = Math.round(p.y);
        const vx = Math.round(p.vx * 10) / 10, vy = Math.round(p.vy * 10) / 10;
        const moveDir = this._rtCurrentMoveDir || 0;
        this._rtChannel.send({
            type: 'broadcast', event: 'pos',
            payload: {
                sid: String(Player.studentId),
                x, y, vx, vy,
                dir: p.dir,
                moveDir,
                onGround: p.onGround,
                emote: p.emote,
                stunTimer: p.stunTimer > 0 ? p.stunTimer : 0,
                explodeTimer: p.explodeTimer > 0 ? p.explodeTimer : 0,
                team: p.team,
                spec: this._inSpectator ? 1 : 0,
            }
        });
        PerfMonitor.logSend(150);
    },

    // ── 상태 변화 감지 → 위치 전송 (매 프레임 update() 끝에서 호출) ──
    _rtCheckAndSendPos() {
        if (!this._rtChannel || !this.player || this.godMode) return;
        const P = this.player;
        const now = Date.now();

        // moveDir 계산: 현재 누르고 있는 이동 키 방향
        const focused = document.activeElement?.tagName;
        let moveDir = 0;
        if (focused !== 'INPUT' && focused !== 'TEXTAREA') {
            const useReversed = this.reversedControls && !this._inSpectator;
            const leftKey = useReversed ? (this.keys['ArrowRight']||this.keys['d']||this.keys['D']) : (this.keys['ArrowLeft']||this.keys['a']||this.keys['A']);
            const rightKey = useReversed ? (this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) : (this.keys['ArrowRight']||this.keys['d']||this.keys['D']);
            if (leftKey) moveDir = -1;
            else if (rightKey) moveDir = 1;
        }
        this._rtCurrentMoveDir = moveDir;

        // 상태 변화 감지
        const changed =
            moveDir !== this._rtLastMoveDir ||
            P.onGround !== this._rtLastOnGround ||
            P.emote !== this._rtLastEmote ||
            (P.explodeTimer > 0) !== this._rtLastExplode;

        // heartbeat 안전망 (3초)
        const heartbeat = (now - this._rtLastSendTime) >= POS_HEARTBEAT;

        if (changed || heartbeat) {
            this._rtLastMoveDir = moveDir;
            this._rtLastOnGround = P.onGround;
            this._rtLastEmote = P.emote;
            this._rtLastExplode = P.explodeTimer > 0;
            this._rtLastSendTime = now;
            this._rtBroadcastPosition();
        }
    },

    // ── 공 상태 변화 감지 → 전송 (호스트만, 매 프레임 updateBall() 후 호출) ──
    _rtCheckAndSendBall() {
        if (!this._rtChannel || !this._isHost || !this.ball) return;
        const b = this.ball;
        const now = Date.now();

        const vxSign = Math.sign(b.vx);
        const vySign = Math.sign(b.vy);
        // 속도 방향 전환 감지 (바운스/킥)
        const changed =
            vxSign !== this._rtLastBallVxSign ||
            vySign !== this._rtLastBallVySign;
        // heartbeat 안전망 (1초)
        const heartbeat = (now - this._rtLastBallSendTime) >= BALL_HEARTBEAT;

        if (changed || heartbeat) {
            this._rtLastBallVxSign = vxSign;
            this._rtLastBallVySign = vySign;
            this._rtLastBallSendTime = now;
            this._rtBroadcastBall();
        }
    },

    // ── 공 상태 브로드캐스트 (호스트만, Event-Driven + delta check) ──
    _rtBroadcastBall() {
        if (!this._rtChannel || !this._isHost || !this.ball) return;
        const b = this.ball;
        const bx = Math.round(b.x), by = Math.round(b.y);
        const bvx = Math.round(b.vx * 100) / 100, bvy = Math.round(b.vy * 100) / 100;
        // Delta check: 위치·속도 동일하면 전송 스킵
        const last = this._rtLastSentBall;
        if (last && last.bx === bx && last.by === by && last.bvx === bvx && last.bvy === bvy) return;
        this._rtLastSentBall = { bx, by, bvx, bvy };
        this._rtChannel.send({
            type: 'broadcast', event: 'ball',
            payload: {
                sid: String(Player.studentId),
                bx, by, bvx, bvy,
                angle: Math.round(this.ballAngle * 100) / 100,
                score: { ...this.score },
                resetTimer: this.ballResetTimer,
                started: this.ballGameStarted,
            }
        });
        PerfMonitor.logSend(200);
    },

    // ── 채팅 브로드캐스트 ──
    _rtBroadcastChat(text) {
        if (!this._rtChannel) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'chat',
            payload: { sid: String(Player.studentId), text }
        });
        PerfMonitor.logSend(80);
    },

    // ── 이모트 브로드캐스트 ──
    _rtBroadcastEmote(emoteType) {
        if (!this._rtChannel) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'emote',
            payload: { sid: String(Player.studentId), emoteType }
        });
        PerfMonitor.logSend(60);
    },

    // ── 골 이벤트 브로드캐스트 (호스트만) ──
    _rtBroadcastGoal(side, scorers, hasOG, score) {
        if (!this._rtChannel || !this._isHost) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'goal',
            payload: { sid: String(Player.studentId), side, scorers, hasOG, score }
        });
        PerfMonitor.logSend(120);
    },

    // ── 원격 플레이어 위치 수신 (Client Prediction + Lerp 보정) ──
    _rtOnRemotePos(data) {
        if (!data || data.sid === String(Player.studentId)) return;
        const rp = this.remotePlayers.get(data.sid);
        if (!rp) return;

        // 맵 경계 텔레포트 감지
        const teleport = Math.abs(data.x - rp.x) > this.W * 0.4;

        if (teleport) {
            // 즉시 스냅 (맵 래핑 등)
            rp.x = data.x;
            rp.y = data.y;
            rp._corrX = 0;
            rp._corrY = 0;
        } else {
            // 오차를 보정 잔량에 설정 → 매 프레임 15%씩 감소
            rp._corrX = data.x - rp.x;
            rp._corrY = data.y - rp.y;
        }

        // 상태 동기화
        rp.vx = data.vx;
        rp.vy = data.vy;
        rp._moveDir = data.moveDir || 0;
        rp.dir = data.dir;
        rp.onGround = data.onGround;
        rp.emote = data.emote;
        rp.stunTimer = data.stunTimer;
        rp.explodeTimer = data.explodeTimer;
        rp.team = data.team;
        const wasSpec = rp._inSpectator;
        rp._inSpectator = !!data.spec;
        // 관람석 진입/퇴장 시 팀 재배정
        if (wasSpec !== rp._inSpectator && this.ballGameStarted) this._rtAssignTeams();
    },

    // ── 공 상태 수신 (비호스트: 로컬 물리 예측 + 서버 보정) ──
    _rtOnRemoteBall(data) {
        if (this._isHost) return;
        if (!data) return;

        if (data.started && !this.ballGameStarted) {
            this.ballGameStarted = true;
        }
        if (data.started) {
            if (!this.ball) {
                this.ball = { x: data.bx, y: data.by, vx: data.bvx, vy: data.bvy, r: this.BALL_R };
            } else {
                // Smooth correction: position via interpolation, velocity via blending
                this.ball._serverX = data.bx;
                this.ball._serverY = data.by;
                this.ball._serverVx = data.bvx;
                this.ball._serverVy = data.bvy;
            }
            this.ballAngle = data.angle;
            this.score = data.score;
            this.ballResetTimer = data.resetTimer;
        }
    },

    // Non-host local ball physics prediction (called every frame)
    _rtPredictBall() {
        const b = this.ball;
        if (!b || this._isHost || this.ballResetTimer > 0) return;
        // Local physics simulation
        b.vy += this.gravityReversed ? -this.BALL_GRAVITY : this.BALL_GRAVITY;
        if (this.gravityReversed ? b.vy < -this.BALL_MAX_VY : b.vy > this.BALL_MAX_VY)
            b.vy = this.gravityReversed ? -this.BALL_MAX_VY : this.BALL_MAX_VY;
        b.vx *= this.BALL_FRICTION;
        if (Math.abs(b.vx) < 0.1) b.vx = 0;
        b.x += b.vx; b.y += b.vy;
        this.ballAngle += b.vx * 0.03;
        // Ground/ceiling/wall collision
        const gY = this.H - 30 - b.r;
        if (!this.gravityReversed && b.y >= gY) { b.y = gY; b.vy = -b.vy * this.BALL_BOUNCE; if (Math.abs(b.vy) < 1) b.vy = 0; b.vx *= 0.97; }
        if (this.gravityReversed && b.y <= b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * this.BALL_BOUNCE; if (Math.abs(b.vy) < 1) b.vy = 0; b.vx *= 0.97; }
        if (!this.gravityReversed && b.y <= b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * this.BALL_BOUNCE; }
        if (this.gravityReversed && b.y >= gY) { b.y = gY; b.vy = -Math.abs(b.vy) * this.BALL_BOUNCE; }
        if (b.x - b.r <= 0) { b.x = b.r; b.vx = Math.abs(b.vx) * this.BALL_BOUNCE; }
        if (b.x + b.r >= this.W) { b.x = this.W - b.r; b.vx = -Math.abs(b.vx) * this.BALL_BOUNCE; }
        // Entity collision (local prediction — guarded to prevent game loop crash)
        if (this.ballGameStarted) { try { this.checkBallEntityCollision(); } catch(e) {} }
        // Smooth server correction (200ms 간격에 맞춰 완만하게 보정)
        if (b._serverX !== undefined) {
            b.x += (b._serverX - b.x) * 0.05;
            b.y += (b._serverY - b.y) * 0.05;
            const dx = b._serverX - b.x, dy = b._serverY - b.y;
            if (dx*dx + dy*dy < 4) { b._serverX = undefined; b._serverY = undefined; }
        }
        if (b._serverVx !== undefined) {
            b.vx += (b._serverVx - b.vx) * 0.12;
            b.vy += (b._serverVy - b.vy) * 0.12;
            const dvx = b._serverVx - b.vx, dvy = b._serverVy - b.vy;
            if (dvx*dvx + dvy*dvy < 1) { b._serverVx = undefined; b._serverVy = undefined; }
        }
    },

    // ── 원격 채팅 수신 ──
    _rtOnRemoteChat(data) {
        if (!data || data.sid === String(Player.studentId)) return;
        const rp = this.remotePlayers.get(data.sid);
        if (!rp) return;
        this.chatBubbles.push({
            x: rp.x, y: rp.y - 20, text: data.text, timer: 180,
            follow: rp, isPlayer: false
        });
    },

    // ── 원격 이모트 수신 ──
    _rtOnRemoteEmote(data) {
        if (!data || data.sid === String(Player.studentId)) return;
        const rp = this.remotePlayers.get(data.sid);
        if (!rp) return;
        rp.emote = data.emoteType;
        rp.emoteTimer = this.EMOTE_DURATION;
        if (data.emoteType === 'explode') {
            rp.explodeTimer = 30;
            for (let i = 0; i < 15; i++) {
                this.particles.push({
                    x: rp.x, y: rp.y + rp.h / 2,
                    vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6 - 2,
                    color: ['#FF6B6B', '#FFD700', '#4ECDC4', '#A29BFE'][Math.floor(Math.random() * 4)],
                    size: 2 + Math.random() * 3, life: 30 + Math.random() * 20, maxLife: 50, type: 'fire'
                });
            }
        }
    },

    // ── 원격 골 이벤트 수신 ──
    _rtOnRemoteGoal(data) {
        if (this._isHost) return;
        if (!data) return;
        this.score = data.score;
        this.goalFlash = 90;
        this.goalFlashSide = data.side;
        this.ballResetTimer = 120;

        const now = new Date();
        const timeStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
        const teamColor = data.side === 'left' ? '#FF6B6B' : '#4ECDC4';
        this.goalLog.push({ scorers: data.scorers || ['???'], time: timeStr, side: data.side, teamColor, hasOG: data.hasOG });

        const scorerText = (data.scorers || []).join(', ') || '???';
        const goalLabel = data.hasOG ? '⚽ OG! 자책골!' : '⚽ GOAL!';
        this.chatBubbles.push({ x: this.W / 2, y: this.H / 2 - 80, text: `${goalLabel} ${scorerText}`, timer: 150, follow: null });

        const bx = data.side === 'left' ? 20 : this.W - 20, by = this.H - 90;
        for (let i = 0; i < 25; i++) {
            this.particles.push({
                x: bx, y: by, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6 - 2,
                color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A29BFE', '#FF9FF3'][Math.floor(Math.random() * 5)],
                size: 3 + Math.random() * 3, life: 40 + Math.random() * 30, maxLife: 70, type: 'fire'
            });
        }

        // 플레이어 보상/패널티 (비호스트도 로컬에서 판정)
        const playerName = Player.nickname || '나';
        const scoringTeam = data.side === 'left' ? 'right' : 'left';
        const playerTouch = (this._ballTouchers || []).find(t => t.name === playerName);
        if (playerTouch && playerTouch.team === scoringTeam && this.player) {
            Player.addCoins(this.GOAL_REWARD, 'goal');
            this.chatBubbles.push({ x: this.player.x, y: this.player.y - 55, text: `🪙 +${this.GOAL_REWARD}`, timer: 90, follow: this.player });
            this._goalRewardMsg = { text: `⚽ 골! 🪙 +${this.GOAL_REWARD} 코인 획득!`, timer: 120 };
        } else if (playerTouch && playerTouch.team !== scoringTeam && this.player) {
            const penalty = Math.min(this.OG_PENALTY, Player.coins);
            if (penalty > 0) Player.addCoins(-penalty, 'own_goal');
            this.chatBubbles.push({ x: this.player.x, y: this.player.y - 55, text: `😱 -${this.OG_PENALTY}`, timer: 90, follow: this.player });
            this._goalRewardMsg = { text: `🫣 자책골! 🪙 -${this.OG_PENALTY} 코인 차감!`, timer: 120 };
        }
    },

    // ── 교사 shutdown 수신 → 로비로 강제 이동 ──
    _rtOnShutdown() {
        if (this.godMode) return; // 교사 자신은 무시
        this.stop();
        if (typeof Nav !== 'undefined') Nav.go('lobby');
    },

    // ── Presence 동기화 ──
    _rtOnPresenceSync() {
        if (!this._rtChannel) return;
        const state = this._rtChannel.presenceState();
        const presentIds = new Set();

        for (const [key, presences] of Object.entries(state)) {
            if (!presences || presences.length === 0) continue;
            const p = presences[0];
            if (String(p.studentId) === String(Player.studentId)) continue;
            if (p.isTeacher) continue;
            presentIds.add(String(p.studentId));

            if (!this.remotePlayers.has(String(p.studentId))) {
                this._rtCreateRemotePlayer(p);
            }
        }

        // 떠난 플레이어 제거
        for (const [sid] of this.remotePlayers) {
            if (!presentIds.has(sid)) {
                this.remotePlayers.delete(sid);
                this._rtRemoteArrayDirty = true;
            }
        }

        this._rtElectHost();
        this._rtAssignTeams();
        this._rtUpdateReadyCount();
    },

    // ── Presence 접속 ──
    async _rtOnPresenceJoin(key, presence) {
        console.log('[RT] join:', key, presence?.nickname);
        if (!presence || String(presence.studentId) === String(Player.studentId)) return;
        if (presence.isTeacher) return;

        if (!this.remotePlayers.has(String(presence.studentId))) {
            await this._rtCreateRemotePlayer(presence);
        }

        this._rtElectHost();
        this._rtAssignTeams();
        this._rtUpdateReadyCount();
        this._rtCheckBallSpawn();
    },

    // ── Presence 퇴장 ──
    _rtOnPresenceLeave(key) {
        console.log('[RT] leave:', key);
        if (String(key) === String(Player.studentId)) return;
        this.remotePlayers.delete(String(key));
        this._rtRemoteArrayDirty = true;
        this._rtElectHost();
        this._rtUpdateReadyCount();

        if (this.godMode) this._updateWrStudentList();
    },

    // ── 원격 플레이어 엔티티 생성 ──
    async _rtCreateRemotePlayer(presence) {
        const sid = String(presence.studentId);
        console.log('[RT] create player:', sid, presence.nickname);

        // 스폰 위치: 맵 하단 중앙 근처
        const sx = this.W * 0.4 + Math.random() * this.W * 0.2;
        const sy = this.H - 47;

        const rp = {
            studentId: sid,
            x: sx, y: sy, vx: 0, vy: 0,
            w: 26, h: 30,
            dir: 1, onGround: true,
            jumpCount: 0, maxJumps: 2,
            emote: null, emoteTimer: 0,
            stunTimer: 0, explodeTimer: 0,
            team: presence.team || (this.remotePlayers.size % 2 === 0 ? 'right' : 'left'),
            sprite: null,
            hat: presence.hat || null,
            effect: presence.effect || null,
            pet: presence.pet || null,
            displayName: presence.nickname || sid,
            activeTitle: presence.activeTitle || '',
            // 클라이언트 예측 상태
            _moveDir: 0,    // 입력 방향 (-1/0/1)
            _corrX: 0,      // lerp 보정 잔량 X
            _corrY: 0,      // lerp 보정 잔량 Y
        };

        this.remotePlayers.set(sid, rp);
        this._rtRemoteArrayDirty = true;

        // 스프라이트 비동기 로드 (폴백 먼저 설정)
        rp.sprite = CharRender.toOffscreen(parseTemplate(Templates[0]), 64);

        try {
            if (this._rtSpriteCache.has(sid)) {
                rp.sprite = this._rtSpriteCache.get(sid);
            } else {
                const charData = await DB.getPlayerCharacterByStudentId(sid);
                if (charData && charData.pixels) {
                    rp.sprite = CharRender.toOffscreen(charData.pixels, 64);
                    rp.hat = charData.hat;
                    rp.effect = charData.effect;
                    rp.pet = charData.pet;
                    rp.displayName = charData.nickname || sid;
                    rp.activeTitle = charData.activeTitle || '';
                    this._rtSpriteCache.set(sid, rp.sprite);
                }
            }
        } catch (e) {
            console.warn('[RT] sprite load fail:', sid, e);
        }

        // 도착 알림
        this.chatBubbles.push({
            x: rp.x, y: rp.y - 20,
            text: `${rp.displayName} 입장!`, timer: 120,
            follow: rp, isPlayer: false
        });

        if (this.godMode) this._updateWrStudentList();
    },

    // ── 호스트 선출 ──
    _rtElectHost() {
        if (!this._rtChannel) return;
        const state = this._rtChannel.presenceState();
        const studentIds = [];

        for (const [key, presences] of Object.entries(state)) {
            if (!presences || presences.length === 0) continue;
            const p = presences[0];
            if (p.isTeacher) continue;
            studentIds.push(String(p.studentId));
        }

        if (studentIds.length === 0) {
            this._isHost = false;
            return;
        }

        studentIds.sort((a, b) => parseInt(a) - parseInt(b));
        const newHost = studentIds[0];
        const wasHost = this._isHost;
        this._isHost = (String(Player.studentId) === newHost);

        if (this._isHost && !wasHost) {
            console.log('[RT] I am now HOST');
            // Event-driven: ball은 _rtCheckAndSendBall()로 상태 변화 시 전송
            this._rtLastBallSendTime = 0; // 즉시 첫 전송
        }
    },

    // ── 팀 자동 배정 (studentId 정렬 → 교대 배정) ──
    _rtAssignTeams() {
        if (!this._rtChannel || this.godMode) return;
        // 관람석에 있는 플레이어 제외하고 활성 플레이어만 팀 배정
        const spectatorIds = new Set();
        for (const rp of this.remotePlayers.values()) {
            if (rp._inSpectator) spectatorIds.add(rp.studentId);
        }
        const activeIds = [];
        const state = this._rtChannel.presenceState();
        for (const [key, presences] of Object.entries(state)) {
            if (!presences || presences.length === 0) continue;
            const p = presences[0];
            if (p.isTeacher) continue;
            const sid = String(p.studentId);
            // 관람석 플레이어 또는 로컬 관람석 제외
            if (spectatorIds.has(sid)) continue;
            if (sid === String(Player.studentId) && this._inSpectator) continue;
            activeIds.push(sid);
        }
        activeIds.sort((a, b) => parseInt(a) - parseInt(b));
        // 짝수 인덱스 = left, 홀수 인덱스 = right
        const myIdx = activeIds.indexOf(String(Player.studentId));
        if (this._inSpectator && this.player) {
            this.player.team = null;
        } else if (myIdx >= 0 && this.player) {
            this.player.team = myIdx % 2 === 0 ? 'left' : 'right';
        }
        // 원격 플레이어 팀도 갱신
        for (const rp of this.remotePlayers.values()) {
            if (rp._inSpectator) { rp.team = null; continue; }
            const idx = activeIds.indexOf(rp.studentId);
            if (idx >= 0) {
                rp.team = idx % 2 === 0 ? 'left' : 'right';
            }
        }
    },

    // ── 공 스폰 조건 체크 ──
    _rtCheckBallSpawn() {
        const playerCount = this.remotePlayers.size + (this.player ? 1 : 0);
        if (playerCount >= 2 && !this.ballGameStarted && this._isHost) {
            this.spawnBallFirstTime();
        }
    },

    // ── 접속자 수 갱신 ──
    _rtUpdateReadyCount() {
        this.readyCount = this.remotePlayers.size + (this.player ? 1 : 0);
        this.updateReadyUI();
    },

    // ── 매 프레임 클라이언트 예측 (Client-Side Prediction + Lerp 보정) ──
    _rtPredictRemotePlayers() {
        for (const rp of this.remotePlayers.values()) {
            // ★ 관람석(SafeZone) 플레이어: 기믹 물리 완전 차단
            if (rp._inSpectator) {
                // 이동/마찰만 적용
                if (rp._moveDir === -1)      rp.vx = -this.MOVE_SPD;
                else if (rp._moveDir === 1)  rp.vx = this.MOVE_SPD;
                else                         rp.vx *= 0.7;
                if (Math.abs(rp.vx) < 0.2) rp.vx = 0;
                // 기본 중력만 (역전 없음)
                rp.vy += this.GRAVITY;
                if (rp.vy > 12) rp.vy = 12;
                rp.x += rp.vx; rp.y += rp.vy;
                this.checkPlatforms(rp);
                this.checkSpectatorWalls(rp);
                // Lerp 보정
                if (rp._corrX || rp._corrY) {
                    const f = 0.25;
                    rp.x += rp._corrX * f; rp.y += rp._corrY * f;
                    rp._corrX *= (1 - f); rp._corrY *= (1 - f);
                    if (Math.abs(rp._corrX) < 0.5) rp._corrX = 0;
                    if (Math.abs(rp._corrY) < 0.5) rp._corrY = 0;
                }
                if (rp._moveDir !== 0) rp.dir = rp._moveDir;
                if (rp.emoteTimer > 0) { rp.emoteTimer--; if (rp.emoteTimer <= 0) rp.emote = null; }
                if (rp.explodeTimer > 0) rp.explodeTimer--;
                continue;  // 아래 일반 물리 건너뜀
            }

            // ── 일반 플레이어 물리 ──
            // 1) 입력 기반 속도 적용
            if (rp.stunTimer > 0) {
                rp.stunTimer--;
                rp.vx *= 0.85;
            } else if (rp.explodeTimer > 0) {
                rp.vx = 0; rp.vy = 0;
            } else {
                if (rp._moveDir === -1)      rp.vx = -this.MOVE_SPD;
                else if (rp._moveDir === 1)  rp.vx = this.MOVE_SPD;
                else                         rp.vx *= 0.7;  // 마찰
                if (Math.abs(rp.vx) < 0.2) rp.vx = 0;
            }

            // 2) 중력
            const useGravReverse = this.gravityReversed;
            rp.vy += useGravReverse ? -this.GRAVITY : this.GRAVITY;
            if (useGravReverse ? rp.vy < -12 : rp.vy > 12)
                rp.vy = useGravReverse ? -12 : 12;

            // 3) 위치 업데이트
            rp.x += rp.vx;
            rp.y += rp.vy;

            // 4) 플랫폼 충돌
            this.checkPlatforms(rp);

            // 5) 맵 래핑
            if (rp.x < -10) rp.x = this.W + 10;
            if (rp.x > this.W + 10) rp.x = -10;
            if (useGravReverse) { if (rp.y < -50) { rp.y = this.H; rp.vy = 0; } }
            else { if (rp.y > this.H + 50) { rp.y = 0; rp.vy = 0; } }

            // 6) Lerp 오차 보정 (프레임당 25%씩 감소)
            if (rp._corrX || rp._corrY) {
                const f = 0.25;
                rp.x += rp._corrX * f;
                rp.y += rp._corrY * f;
                rp._corrX *= (1 - f);
                rp._corrY *= (1 - f);
                if (Math.abs(rp._corrX) < 0.5) rp._corrX = 0;
                if (Math.abs(rp._corrY) < 0.5) rp._corrY = 0;
            }

            // 7) 방향 + 이모트
            if (rp._moveDir !== 0) rp.dir = rp._moveDir;
            if (rp.emoteTimer > 0) {
                rp.emoteTimer--;
                if (rp.emoteTimer <= 0) rp.emote = null;
            }
            if (rp.explodeTimer > 0) rp.explodeTimer--;
        }
    },

    // ── remotePlayers 배열 변환 (this.npcs 대체, 캐시 사용) ──
    _rtGetRemoteArray() {
        if (this._rtRemoteArrayDirty || !this._rtRemoteArrayCache) {
            this._rtRemoteArrayCache = this.remotePlayers ? [...this.remotePlayers.values()] : [];
            this._rtRemoteArrayDirty = false;
        }
        return this._rtRemoteArrayCache;
    },

    // ── 기믹 브로드캐스트 (호스트 → 전체) ──
    _rtBroadcastGimmick() {
        if (!this._rtChannel || !this._isHost) return;
        // obstacles 직렬화 (함수·DOM 참조 제외)
        const obsList = this.obstacles.map(o => {
            const s = { type: o.type, timer: o.timer };
            if (o.x !== undefined) s.x = Math.round(o.x);
            if (o.y !== undefined) s.y = Math.round(o.y);
            if (o.w !== undefined) s.w = o.w;
            if (o.h !== undefined) s.h = o.h;
            if (o.direction !== undefined) s.direction = o.direction;
            if (o.speed !== undefined) s.speed = o.speed;
            if (o.force !== undefined) s.force = o.force;
            if (o.radius !== undefined) s.radius = o.radius;
            if (o.strength !== undefined) s.strength = Math.round(o.strength * 100) / 100;
            if (o.angle !== undefined) s.angle = Math.round(o.angle * 100) / 100;
            if (o.spinSpeed !== undefined) s.spinSpeed = o.spinSpeed;
            if (o.mode !== undefined) s.mode = o.mode;
            if (o.flipType !== undefined) s.flipType = o.flipType;
            if (o.waveHeight !== undefined) s.waveHeight = o.waveHeight;
            if (o.warningTimer !== undefined) s.warningTimer = o.warningTimer;
            if (o.impacted !== undefined) s.impacted = o.impacted;
            if (o.active !== undefined) s.active = o.active;
            if (o.moveAngle !== undefined) s.moveAngle = Math.round(o.moveAngle * 100) / 100;
            if (o.rumblePhase !== undefined) s.rumblePhase = Math.round(o.rumblePhase * 100) / 100;
            // rotatingPlatform: 플랫폼 인덱스로 참조
            if (o.type === 'rotatingPlatform' && o.platform) {
                s.platIdx = this.platforms.indexOf(o.platform);
            }
            // redLightGreenLight 상태
            if (o.type === 'redLightGreenLight' && this.redLightGreenLight) {
                s.rlgl = {
                    phase: this.redLightGreenLight.phase,
                    timer: this.redLightGreenLight.timer,
                    displayedChars: this.redLightGreenLight.displayedChars || 0,
                };
            }
            return s;
        });
        const payload = {
            obs: obsList,
            wind: this.activeWind ? { d: this.activeWind.direction, f: this.activeWind.force } : null,
            grav: this.gravityReversed ? 1 : 0,
            rev: this.reversedControls ? 1 : 0,
            bh: this.blackHole ? { x: Math.round(this.blackHole.x), y: Math.round(this.blackHole.y), r: this.blackHole.radius, s: Math.round(this.blackHole.strength * 100) / 100 } : null,
            sf: this.screenFlip || null,
            sc: this.sizeChange || null,
        };
        this._rtChannel.send({ type: 'broadcast', event: 'gimmick', payload });
        PerfMonitor.logSend(300);
    },

    // ── 기믹 수신 (비호스트: 호스트 상태로 교체) ──
    _rtOnRemoteGimmick(data) {
        if (this._isHost || !data) return;
        // 전역 기믹 상태 동기화
        this.activeWind = data.wind ? { direction: data.wind.d, force: data.wind.f } : null;
        this.gravityReversed = !!data.grav;
        this.reversedControls = !!data.rev;
        this.blackHole = data.bh ? { x: data.bh.x, y: data.bh.y, radius: data.bh.r, strength: data.bh.s } : null;
        this.screenFlip = data.sf || null;
        this.sizeChange = data.sc || null;

        // ★ 기존 시각효과 데이터 보존용 맵 (type → 기존 obstacle)
        const oldVFX = new Map();
        this.obstacles.forEach(o => oldVFX.set(o.type, o));

        // obstacles 재구성 — 호스트 상태 + 기존 VFX 병합
        const newObs = [];
        if (data.obs) {
            for (const s of data.obs) {
                const o = { type: s.type, timer: s.timer };
                if (s.x !== undefined) o.x = s.x;
                if (s.y !== undefined) o.y = s.y;
                if (s.w !== undefined) o.w = s.w;
                if (s.h !== undefined) o.h = s.h;
                if (s.direction !== undefined) o.direction = s.direction;
                if (s.speed !== undefined) o.speed = s.speed;
                if (s.force !== undefined) o.force = s.force;
                if (s.radius !== undefined) o.radius = s.radius;
                if (s.strength !== undefined) o.strength = s.strength;
                if (s.angle !== undefined) o.angle = s.angle;
                if (s.spinSpeed !== undefined) o.spinSpeed = s.spinSpeed;
                if (s.mode !== undefined) o.mode = s.mode;
                if (s.flipType !== undefined) o.flipType = s.flipType;
                if (s.waveHeight !== undefined) o.waveHeight = s.waveHeight;
                if (s.warningTimer !== undefined) o.warningTimer = s.warningTimer;
                if (s.impacted !== undefined) o.impacted = s.impacted;
                if (s.active !== undefined) o.active = s.active;
                if (s.moveAngle !== undefined) o.moveAngle = s.moveAngle;
                if (s.rumblePhase !== undefined) o.rumblePhase = s.rumblePhase;
                // rotatingPlatform: 플랫폼 인덱스로 참조 복원
                if (s.type === 'rotatingPlatform' && s.platIdx !== undefined && this.platforms[s.platIdx]) {
                    o.platform = this.platforms[s.platIdx];
                    o.originalX = o.platform.x;
                    o.originalY = o.platform.y;
                }
                // ★ 시각효과: 기존 로컬 데이터가 있으면 살려냄 (VFX 병합)
                const oldObj = oldVFX.get(s.type);
                if (s.type === 'windGust') o.streaks = oldObj ? oldObj.streaks : [];
                if (s.type === 'typhoon') o.spiralStreaks = oldObj ? oldObj.spiralStreaks : [];
                if (s.type === 'meteor') {
                    o.craterTimer = oldObj ? oldObj.craterTimer : (s.impacted ? 300 : 0);
                    o.shockwaveRadius = oldObj ? oldObj.shockwaveRadius : 0;
                }
                if (s.type === 'earthquake') o.debris = oldObj ? oldObj.debris : [];
                // redLightGreenLight 상태 복원
                if (s.type === 'redLightGreenLight' && s.rlgl) {
                    if (!this.redLightGreenLight) {
                        this.redLightGreenLight = {
                            phase: s.rlgl.phase, timer: s.rlgl.timer,
                            displayedChars: s.rlgl.displayedChars,
                            eyeX: this.W / 2, eyeY: 120,
                            chars: '무궁화 꽃이 피었습니다'.split(''),
                            greenDuration: 180, redDuration: 120,
                            charInterval: 15, caughtTimer: 0,
                        };
                    } else {
                        this.redLightGreenLight.phase = s.rlgl.phase;
                        this.redLightGreenLight.timer = s.rlgl.timer;
                        this.redLightGreenLight.displayedChars = s.rlgl.displayedChars;
                    }
                }
                newObs.push(o);
            }
        }
        this.obstacles = newObs;

        // ghostPlatforms 동기화: ghostPlatforms obstacle이 없으면 복원
        if (!newObs.some(o => o.type === 'ghostPlatforms')) {
            if (this._hiddenPlatforms) {
                this._hiddenPlatforms.forEach(p => { delete p._ghostHidden; });
                this._hiddenPlatforms = null;
            }
            this.ghostPlatforms = [];
            this.ghostLightningVisible = false;
        }
        // redLightGreenLight가 없으면 해제
        if (!newObs.some(o => o.type === 'redLightGreenLight')) {
            this.redLightGreenLight = null;
        }
    },

    // ── 기믹 heartbeat (호스트: 1초마다 안전망 전송) ──
    _rtCheckAndSendGimmick() {
        if (!this._isHost || !this._rtChannel) return;
        const now = Date.now();
        if (!this._rtLastGimmickSendTime) this._rtLastGimmickSendTime = 0;
        if (now - this._rtLastGimmickSendTime >= 1000) {
            this._rtLastGimmickSendTime = now;
            this._rtBroadcastGimmick();
        }
    },
};
