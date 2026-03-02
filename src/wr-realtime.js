// ── Realtime Multiplayer (Supabase Broadcast + Presence) ──
// Mixed into WaitingRoom via Object.assign
import { supabase } from './supabase.js';
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';
import { DB } from './db.js';

const SEND_INTERVAL = 100;   // 위치 전송 주기 (ms) = 10Hz
const BALL_INTERVAL = 100;   // 공 상태 전송 주기 (ms)
const INTERP_MS = SEND_INTERVAL; // 보간 시간

export const WrRealtime = {
    remotePlayers: null,   // Map<studentId, RemotePlayerEntity>
    _rtChannel: null,
    _isHost: false,
    _rtSendInterval: null,
    _rtBallInterval: null,
    _rtSpriteCache: new Map(), // 스프라이트 캐시 (재접속 시 재사용)

    // ── 채널 초기화 ──
    rtInit() {
        if (this._rtChannel) this.rtDestroy();
        this.remotePlayers = new Map();

        const className = this.godMode
            ? (this._teacherClassName || '')
            : (Player.className || '');
        const channelName = `wr:${className || 'main'}`;
        console.log('[RT] rtInit — channel:', channelName, 'studentId:', Player.studentId, 'className:', className);

        const channel = supabase.channel(channelName, {
            config: { broadcast: { self: false }, presence: { key: Player.studentId } }
        });

        // Broadcast 수신
        channel.on('broadcast', { event: 'pos' }, ({ payload }) => this._rtOnRemotePos(payload));
        channel.on('broadcast', { event: 'ball' }, ({ payload }) => this._rtOnRemoteBall(payload));
        channel.on('broadcast', { event: 'chat' }, ({ payload }) => this._rtOnRemoteChat(payload));
        channel.on('broadcast', { event: 'emote' }, ({ payload }) => this._rtOnRemoteEmote(payload));
        channel.on('broadcast', { event: 'goal' }, ({ payload }) => this._rtOnRemoteGoal(payload));

        // Presence 수신
        channel.on('presence', { event: 'sync' }, () => this._rtOnPresenceSync());
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            if (newPresences && newPresences.length > 0) {
                this._rtOnPresenceJoin(key, newPresences[0]);
            }
        });
        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            this._rtOnPresenceLeave(key);
        });

        channel.subscribe(async (status) => {
            console.log('[RT] subscribe status:', status);
            if (status === 'SUBSCRIBED') {
                // Presence에 자신을 등록
                try {
                    if (!this.godMode) {
                        const trackData = {
                            studentId: Player.studentId,
                            nickname: Player.nickname || '',
                            activeTitle: Player.activeTitle || '',
                            hat: Player.equipped?.hat || null,
                            effect: Player.equipped?.effect || null,
                            pet: Player.equipped?.pet || null,
                            team: this.player?.team || 'left',
                            isTeacher: false,
                        };
                        console.log('[RT] tracking presence:', trackData);
                        await channel.track(trackData);
                        console.log('[RT] presence tracked OK');
                    } else {
                        await channel.track({
                            studentId: Player.studentId || '77777',
                            nickname: '선생님',
                            isTeacher: true,
                        });
                    }
                } catch (e) {
                    console.error('[RT] track error:', e);
                }
            }
        });

        this._rtChannel = channel;

        // 위치 브로드캐스트 시작 (학생만)
        if (!this.godMode && this.player) {
            this._rtSendInterval = setInterval(() => this._rtBroadcastPosition(), SEND_INTERVAL);
        }
    },

    // ── 채널 해제 ──
    rtDestroy() {
        if (this._rtSendInterval) { clearInterval(this._rtSendInterval); this._rtSendInterval = null; }
        if (this._rtBallInterval) { clearInterval(this._rtBallInterval); this._rtBallInterval = null; }
        if (this._rtChannel) {
            this._rtChannel.unsubscribe();
            supabase.removeChannel(this._rtChannel);
            this._rtChannel = null;
        }
        if (this.remotePlayers) this.remotePlayers.clear();
        this._isHost = false;
    },

    // ── 위치 브로드캐스트 (10Hz) ──
    _rtBroadcastPosition() {
        if (!this._rtChannel || !this.player || this.godMode) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'pos',
            payload: {
                sid: Player.studentId,
                x: Math.round(this.player.x * 10) / 10,
                y: Math.round(this.player.y * 10) / 10,
                vx: Math.round(this.player.vx * 10) / 10,
                vy: Math.round(this.player.vy * 10) / 10,
                dir: this.player.dir,
                onGround: this.player.onGround,
                emote: this.player.emote,
                stunTimer: this.player.stunTimer > 0 ? this.player.stunTimer : 0,
                explodeTimer: this.player.explodeTimer > 0 ? this.player.explodeTimer : 0,
                team: this.player.team,
            }
        });
    },

    // ── 공 상태 브로드캐스트 (호스트만, 10Hz) ──
    _rtBroadcastBall() {
        if (!this._rtChannel || !this._isHost || !this.ball) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'ball',
            payload: {
                sid: Player.studentId,
                bx: Math.round(this.ball.x * 10) / 10,
                by: Math.round(this.ball.y * 10) / 10,
                bvx: Math.round(this.ball.vx * 100) / 100,
                bvy: Math.round(this.ball.vy * 100) / 100,
                angle: Math.round(this.ballAngle * 100) / 100,
                score: { ...this.score },
                resetTimer: this.ballResetTimer,
                started: this.ballGameStarted,
            }
        });
    },

    // ── 채팅 브로드캐스트 ──
    _rtBroadcastChat(text) {
        if (!this._rtChannel) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'chat',
            payload: { sid: Player.studentId, text }
        });
    },

    // ── 이모트 브로드캐스트 ──
    _rtBroadcastEmote(emoteType) {
        if (!this._rtChannel) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'emote',
            payload: { sid: Player.studentId, emoteType }
        });
    },

    // ── 골 이벤트 브로드캐스트 (호스트만) ──
    _rtBroadcastGoal(side, scorers, hasOG, score) {
        if (!this._rtChannel || !this._isHost) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'goal',
            payload: { sid: Player.studentId, side, scorers, hasOG, score }
        });
    },

    // ── 원격 플레이어 위치 수신 ──
    _rtOnRemotePos(data) {
        if (!data || data.sid === Player.studentId) return;
        let rp = this.remotePlayers.get(data.sid);
        if (!rp) {
            console.log('[RT] pos received but no remote player for sid:', data.sid, 'remotes:', [...this.remotePlayers.keys()]);
            return;
        }

        // 맵 경계 텔레포트 감지
        const teleport = Math.abs(data.x - rp.x) > this.W * 0.5;

        // 보간 타겟 설정
        rp._prevX = teleport ? data.x : rp.x;
        rp._prevY = teleport ? data.y : rp.y;
        rp._targetX = data.x;
        rp._targetY = data.y;
        rp._targetVx = data.vx;
        rp._targetVy = data.vy;
        rp._targetDir = data.dir;
        rp._interpT = 0;
        rp._lastUpdateTime = Date.now();

        // 즉시 업데이트 값
        rp.onGround = data.onGround;
        rp.emote = data.emote;
        rp.stunTimer = data.stunTimer;
        rp.explodeTimer = data.explodeTimer;
        rp.team = data.team;
    },

    // ── 공 상태 수신 (비호스트만) ──
    _rtOnRemoteBall(data) {
        if (this._isHost) return; // 호스트는 자체 물리 사용
        if (!data) return;

        if (data.started && !this.ballGameStarted) {
            this.ballGameStarted = true;
        }
        if (data.started) {
            if (!this.ball) {
                this.ball = { x: data.bx, y: data.by, vx: data.bvx, vy: data.bvy, r: this.BALL_R };
            } else {
                this.ball.x = data.bx;
                this.ball.y = data.by;
                this.ball.vx = data.bvx;
                this.ball.vy = data.bvy;
            }
            this.ballAngle = data.angle;
            this.score = data.score;
            this.ballResetTimer = data.resetTimer;
        }
    },

    // ── 원격 채팅 수신 ──
    _rtOnRemoteChat(data) {
        if (!data || data.sid === Player.studentId) return;
        const rp = this.remotePlayers.get(data.sid);
        if (!rp) return;
        this.chatBubbles.push({
            x: rp.x, y: rp.y - 20, text: data.text, timer: 180,
            follow: rp, isPlayer: false
        });
    },

    // ── 원격 이모트 수신 ──
    _rtOnRemoteEmote(data) {
        if (!data || data.sid === Player.studentId) return;
        const rp = this.remotePlayers.get(data.sid);
        if (!rp) return;
        rp.emote = data.emoteType;
        rp.emoteTimer = this.EMOTE_DURATION;
        if (data.emoteType === 'explode') {
            rp.explodeTimer = 30;
            // 폭발 파티클
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
        if (this._isHost) return; // 호스트는 로컬에서 처리
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

        // 골 이펙트 파티클
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
            this.chatBubbles.push({ x: this.player.x, y: this.player.y - 40, text: `🪙 +${this.GOAL_REWARD}`, timer: 90, follow: this.player });
            this._goalRewardMsg = { text: `⚽ 골! 🪙 +${this.GOAL_REWARD} 코인 획득!`, timer: 120 };
        } else if (playerTouch && playerTouch.team !== scoringTeam && this.player) {
            const penalty = Math.min(this.OG_PENALTY, Player.coins);
            if (penalty > 0) Player.addCoins(-penalty, 'own_goal');
            this.chatBubbles.push({ x: this.player.x, y: this.player.y - 40, text: `😱 -${this.OG_PENALTY}`, timer: 90, follow: this.player });
            this._goalRewardMsg = { text: `🫣 자책골! 🪙 -${this.OG_PENALTY} 코인 차감!`, timer: 120 };
        }
    },

    // ── Presence 동기화 ──
    _rtOnPresenceSync() {
        if (!this._rtChannel) return;
        const state = this._rtChannel.presenceState();
        console.log('[RT] presenceSync — state:', JSON.stringify(state));
        const presentIds = new Set();

        // 현재 접속자 파악
        for (const [key, presences] of Object.entries(state)) {
            if (!presences || presences.length === 0) continue;
            const p = presences[0];
            if (p.studentId === Player.studentId) continue; // 자신 제외
            if (p.isTeacher) continue; // 교사는 엔티티 없음
            presentIds.add(p.studentId);

            // 아직 remotePlayers에 없으면 추가
            if (!this.remotePlayers.has(p.studentId)) {
                this._rtCreateRemotePlayer(p);
            }
        }

        // 떠난 플레이어 제거
        for (const [sid] of this.remotePlayers) {
            if (!presentIds.has(sid)) {
                this.remotePlayers.delete(sid);
            }
        }

        this._rtElectHost();
        this._rtUpdateReadyCount();
    },

    // ── Presence 접속 ──
    async _rtOnPresenceJoin(key, presence) {
        console.log('[RT] presenceJoin — key:', key, 'presence:', presence);
        if (!presence || presence.studentId === Player.studentId) return;
        if (presence.isTeacher) return;

        if (!this.remotePlayers.has(presence.studentId)) {
            await this._rtCreateRemotePlayer(presence);
        }

        this._rtElectHost();
        this._rtUpdateReadyCount();
        this._rtCheckBallSpawn();
    },

    // ── Presence 퇴장 ──
    _rtOnPresenceLeave(key) {
        console.log('[RT] presenceLeave — key:', key);
        if (key === Player.studentId) return;
        this.remotePlayers.delete(key);
        this._rtElectHost();
        this._rtUpdateReadyCount();

        // 교사 학생 목록 갱신
        if (this.godMode) this._updateWrStudentList();
    },

    // ── 원격 플레이어 엔티티 생성 ──
    async _rtCreateRemotePlayer(presence) {
        const sid = presence.studentId;
        console.log('[RT] createRemotePlayer — sid:', sid, 'nickname:', presence.nickname);
        // 스폰 위치: 랜덤 플랫폼
        const plat = this.platforms[Math.floor(Math.random() * this.platforms.length)];
        const sx = plat.x + Math.random() * Math.max(plat.w - 30, 10);
        const sy = plat.y - 30;

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
            // 보간 상태
            _prevX: sx, _prevY: sy,
            _targetX: sx, _targetY: sy,
            _targetVx: 0, _targetVy: 0,
            _targetDir: 1,
            _interpT: 1,
            _lastUpdateTime: Date.now(),
        };

        this.remotePlayers.set(sid, rp);

        // 스프라이트 비동기 로드
        try {
            // 캐시 확인
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
            console.warn('Failed to load sprite for', sid, e);
        }

        // 폴백: 스프라이트 없으면 기본 템플릿
        if (!rp.sprite) {
            rp.sprite = CharRender.toOffscreen(parseTemplate(Templates[0]), 64);
        }

        // 도착 알림
        this.chatBubbles.push({
            x: rp.x, y: rp.y - 20,
            text: `${rp.displayName} 입장!`, timer: 120,
            follow: rp, isPlayer: false
        });

        // 교사 학생 목록 갱신
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
            studentIds.push(p.studentId);
        }

        if (studentIds.length === 0) {
            this._isHost = false;
            return;
        }

        // 숫자 정렬, 가장 낮은 학번 = 호스트
        studentIds.sort((a, b) => parseInt(a) - parseInt(b));
        const newHost = studentIds[0];
        const wasHost = this._isHost;
        this._isHost = (Player.studentId === newHost);

        // 호스트가 바뀌었을 때 공 브로드캐스트 시작/중지
        if (this._isHost && !wasHost) {
            if (this._rtBallInterval) clearInterval(this._rtBallInterval);
            this._rtBallInterval = setInterval(() => this._rtBroadcastBall(), BALL_INTERVAL);
        } else if (!this._isHost && wasHost) {
            if (this._rtBallInterval) { clearInterval(this._rtBallInterval); this._rtBallInterval = null; }
        }
    },

    // ── 공 스폰 조건 체크 ──
    _rtCheckBallSpawn() {
        const playerCount = this.remotePlayers.size + (this.player ? 1 : 0);
        if (playerCount >= 2 && !this.ballGameStarted) {
            this.spawnBallFirstTime();
        }
    },

    // ── 접속자 수 갱신 ──
    _rtUpdateReadyCount() {
        this.readyCount = this.remotePlayers.size + (this.player ? 1 : 0);
        this.updateReadyUI();
    },

    // ── 매 프레임 보간 ──
    _rtInterpolateRemotePlayers() {
        const now = Date.now();
        for (const rp of this.remotePlayers.values()) {
            if (rp._interpT >= 1) {
                // 보간 완료 — 외삽 (약간 예측)
                rp.dir = rp._targetDir;
                continue;
            }
            const elapsed = now - rp._lastUpdateTime;
            rp._interpT = Math.min(elapsed / INTERP_MS, 1);

            rp.x = rp._prevX + (rp._targetX - rp._prevX) * rp._interpT;
            rp.y = rp._prevY + (rp._targetY - rp._prevY) * rp._interpT;
            rp.dir = rp._targetDir;

            // 이모트 타이머 감소
            if (rp.emoteTimer > 0) {
                rp.emoteTimer--;
                if (rp.emoteTimer <= 0) rp.emote = null;
            }
        }
    },

    // ── remotePlayers 배열 변환 (this.npcs 대체) ──
    _rtGetRemoteArray() {
        return this.remotePlayers ? [...this.remotePlayers.values()] : [];
    },
};
