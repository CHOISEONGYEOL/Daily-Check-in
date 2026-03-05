// ── Battle Mode System (waiting room deathmatch) ──
// Network: shoot(1x) + hit(1x) only. No per-frame projectile sync.
// Collision: Liang-Barsky segment vs AABB (anti-tunneling).
// Performance: Object pooling for projectiles & particles.

import { Player } from './player.js';

// ── Constants ──
const BULLET_SPEED   = 18;
const BULLET_DAMAGE  = 12;
const BULLET_LIFE    = 45;   // frames
const BULLET_CD      = 30;   // 0.5s
const BOMB_DAMAGE    = 30;   // center
const BOMB_RADIUS    = 80;
const BOMB_VX        = 10;
const BOMB_VY        = -8;
const BOMB_GRAVITY   = 0.5;
const BOMB_LIFE      = 180;  // 3s max flight
const MAX_BOMBS      = 2;    // max carry
const RESPAWN_TIME   = 180;  // 3s
const INVINCIBLE_TIME = 120; // 2s
const MAX_HP         = 100;
const PROJ_POOL_SIZE = 80;
const PARTICLE_POOL_SIZE = 150;
const BOMB_PICKUP_RESPAWN = 600; // 10s
const KILLFEED_DURATION = 180;   // 3s
const MAX_DAMAGE = 50;           // 수신 데미지 상한 (치트 방지)
const MAX_KNOCK  = 15;           // 수신 넉백 상한

export const WrBattle = {

    // ── State ──
    battleMode: false,
    _battleHP: MAX_HP,
    _battleMaxHP: MAX_HP,
    _battleKills: 0,
    _battleDeaths: 0,
    _battleIsDead: false,
    _battleRespawnTimer: 0,
    _battleInvincible: 0,
    _battleBulletCD: 0,
    _battleBombCount: 0,
    _battleWeapon: 'bullet', // 'bullet' | 'bomb'
    _battleKillFeed: [],     // [{text, timer}]

    // ── Pools ──
    _projPool: null,
    _battleProjectiles: null,
    _bParticlePool: null,
    _battleParticles: null,

    // ── Bomb Pickups (host manages) ──
    _battlePickups: null,

    // ═══════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════

    _battleStart() {
        if (this.battleMode) return; // 이중 호출 방지
        this.battleMode = true;
        this._battleHP = MAX_HP;
        this._battleKills = 0;
        this._battleDeaths = 0;
        this._battleIsDead = false;
        this._battleRespawnTimer = 0;
        this._battleInvincible = 0;
        this._battleBulletCD = 0;
        this._battleBombCount = 0;
        this._battleWeapon = 'bullet';
        this._battleKillFeed = [];

        // Init pools
        this._projPool = [];
        this._battleProjectiles = [];
        for (let i = 0; i < PROJ_POOL_SIZE; i++) {
            this._projPool.push({
                active: false, x: 0, y: 0, vx: 0, vy: 0,
                type: '', damage: 0, life: 0, isOwner: false, ownerSid: ''
            });
        }
        this._bParticlePool = [];
        this._battleParticles = [];
        for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
            this._bParticlePool.push({
                active: false, x: 0, y: 0, vx: 0, vy: 0,
                color: '', size: 0, life: 0, maxLife: 0
            });
        }

        // Bomb pickups (3 locations across map)
        this._battlePickups = [
            { x: this.W * 0.25, y: 0, active: true, respawnTimer: 0 },
            { x: this.W * 0.50, y: 0, active: true, respawnTimer: 0 },
            { x: this.W * 0.75, y: 0, active: true, respawnTimer: 0 },
        ];
        // Set Y to nearest platform top
        this._battlePickups.forEach(pk => {
            let bestY = this.H - 60;
            for (const p of this.platforms) {
                if (p.type === 'ground' || p.type === 'spectator') continue;
                if (Math.abs(p.x + p.w / 2 - pk.x) < p.w / 2 + 30) {
                    bestY = Math.min(bestY, p.y - 10);
                }
            }
            pk.y = bestY;
        });

        // Show mobile attack button
        const atkBtn = document.getElementById('wr-attack-btn');
        if (atkBtn) atkBtn.style.display = '';

        // Hide ball
        this.ball = null;
        this.ballGameStarted = false;

        // Reset remote players HP
        if (this.remotePlayers) {
            for (const rp of this.remotePlayers.values()) {
                rp.hp = MAX_HP;
                rp.isDead = false;
                rp.invincible = 0;
                rp.kills = 0;
                rp.deaths = 0;
            }
        }

        // Broadcast mode switch
        if (this._rtChannel) {
            this._rtChannel.send({
                type: 'broadcast', event: 'gimmick',
                payload: { battleMode: true }
            });
        }
    },

    _battleStop() {
        this.battleMode = false;
        const atkBtn = document.getElementById('wr-attack-btn');
        if (atkBtn) atkBtn.style.display = 'none';
        this._battleProjectiles = [];
        this._battleParticles = [];
        this._projPool = null;
        this._bParticlePool = null;
        this._battlePickups = null;
        this._battleKillFeed = [];
        this._battleIsDead = false;
        this._battleHP = 0;
        this._battleBulletCD = 0;
        this._battleBombCount = 0;
        this._battleInvincible = 0;
        this._battleRespawnTimer = 0;
        // 원격 플레이어 배틀 상태 초기화
        if (this.remotePlayers) {
            for (const rp of this.remotePlayers.values()) {
                rp.hp = undefined; rp.isDead = false;
                rp.kills = 0; rp.deaths = 0; rp.invincible = 0;
            }
        }
    },

    // ═══════════════════════════════════════
    // Main Update (called every frame)
    // ═══════════════════════════════════════

    _battleUpdate() {
        if (!this.battleMode || !this.player) return;

        // Cooldowns
        if (this._battleBulletCD > 0) this._battleBulletCD--;
        if (this._battleInvincible > 0) this._battleInvincible--;

        // Dead → respawn countdown
        if (this._battleIsDead) {
            this._battleRespawnTimer--;
            if (this._battleRespawnTimer <= 0) {
                this._battleRespawn();
            }
            return; // skip input while dead
        }

        // Update projectiles
        this._battleUpdateProjectiles();

        // Update bomb pickups (host only)
        if (this._isHost) this._battleUpdatePickups();

        // Update battle particles
        this._battleUpdateParticles();

        // Killfeed timer
        this._battleKillFeed = this._battleKillFeed.filter(k => --k.timer > 0);

        // Remote player invincible timers
        if (this.remotePlayers) {
            for (const rp of this.remotePlayers.values()) {
                if (rp.invincible > 0) rp.invincible--;
                if (rp.isDead && rp._respawnTimer > 0) {
                    rp._respawnTimer--;
                    if (rp._respawnTimer <= 0) {
                        rp.isDead = false;
                        rp.hp = MAX_HP;
                        rp.invincible = INVINCIBLE_TIME;
                        const spawnX = rp.team === 'left' ? 200 : this.W - 200;
                        rp.x = spawnX;
                        rp.y = this.H - 60;
                    }
                }
            }
        }
    },

    // ═══════════════════════════════════════
    // Shooting
    // ═══════════════════════════════════════

    _battleShoot() {
        if (!this.battleMode || this._battleIsDead || this.overlayActive) return;
        if (this._inSpectator || !this.player) return;

        if (this._battleWeapon === 'bullet') {
            if (this._battleBulletCD > 0) return;
            this._battleBulletCD = BULLET_CD;

            const p = this._battleGetProjectile();
            if (!p) return; // pool exhausted

            const dir = this.player.dir || 1;
            Object.assign(p, {
                x: this.player.x + dir * 15,
                y: this.player.y + this.player.h * 0.4,
                vx: dir * BULLET_SPEED,
                vy: 0,
                type: 'bullet',
                damage: BULLET_DAMAGE,
                life: BULLET_LIFE,
                isOwner: true,
                ownerSid: String(Player.studentId)
            });
            this._battleProjectiles.push(p);

            // Broadcast shoot event (1 time)
            this._rtBroadcastShoot(p);

        } else if (this._battleWeapon === 'bomb') {
            if (this._battleBombCount <= 0) return;
            this._battleBombCount--;

            const p = this._battleGetProjectile();
            if (!p) return;

            const dir = this.player.dir || 1;
            Object.assign(p, {
                x: this.player.x + dir * 10,
                y: this.player.y,
                vx: dir * BOMB_VX,
                vy: BOMB_VY,
                type: 'bomb',
                damage: BOMB_DAMAGE,
                life: BOMB_LIFE,
                isOwner: true,
                ownerSid: String(Player.studentId)
            });
            this._battleProjectiles.push(p);

            this._rtBroadcastShoot(p);

            // Auto-switch back to bullet if no bombs left
            if (this._battleBombCount <= 0) this._battleWeapon = 'bullet';
        }
    },

    // ═══════════════════════════════════════
    // Projectile Physics + Collision
    // ═══════════════════════════════════════

    _battleUpdateProjectiles() {
        if (!this._battleProjectiles || !this._projPool) return;
        const remotes = this._rtGetRemoteArray();

        for (let i = this._battleProjectiles.length - 1; i >= 0; i--) {
            const p = this._battleProjectiles[i];
            const prevX = p.x, prevY = p.y;

            // Physics
            p.x += p.vx;
            p.y += p.vy;
            if (p.type === 'bomb') p.vy += BOMB_GRAVITY;
            p.life--;

            // Wall/floor bounds
            if (p.x < 0 || p.x > this.W || p.y < 0) {
                if (p.type === 'bomb' && p.isOwner) this._battleExplodeBomb(p);
                this._battleReturnProj(p, i);
                continue;
            }
            if (p.y > this.H - 30) {
                if (p.type === 'bomb' && p.isOwner) this._battleExplodeBomb(p);
                this._battleReturnProj(p, i);
                continue;
            }
            // Lifetime
            if (p.life <= 0) {
                if (p.type === 'bomb' && p.isOwner) this._battleExplodeBomb(p);
                this._battleReturnProj(p, i);
                continue;
            }

            // Platform collision (bombs only)
            if (p.type === 'bomb') {
                let hitPlat = false;
                for (const pl of this.platforms) {
                    if (pl.type === 'ground') continue;
                    if (p.x >= pl.x && p.x <= pl.x + pl.w &&
                        prevY <= pl.y && p.y >= pl.y && p.y <= pl.y + pl.h + 10) {
                        if (p.isOwner) this._battleExplodeBomb(p);
                        this._battleReturnProj(p, i);
                        hitPlat = true;
                        break;
                    }
                }
                if (hitPlat) continue;
            }

            // === Owner-only hit detection ===
            if (!p.isOwner) continue;

            if (p.type === 'bullet') {
                // Segment vs AABB (Liang-Barsky) for anti-tunneling
                for (const target of remotes) {
                    if (target._inSpectator || target.isDead) continue;
                    if (target.invincible > 0) continue;

                    const hit = this._battleSegmentAABB(
                        prevX, prevY, p.x, p.y,
                        target.x - target.w / 2, target.y,
                        target.w, target.h
                    );

                    if (hit) {
                        const knockDir = Math.sign(p.vx) || 1;
                        this._rtBroadcastHit(target.studentId, p.damage, knockDir * 4, -3);
                        // Local prediction
                        target.hp = (target.hp || MAX_HP) - p.damage;
                        target.stunTimer = Math.max(target.stunTimer || 0, 15);
                        this._battleSpawnHitParticles(hit.x, hit.y);
                        // Check kill
                        if (target.hp <= 0) {
                            this._battleOnKill(target);
                        }
                        this._battleReturnProj(p, i);
                        break;
                    }
                }
            }
        }
    },

    // ── Liang-Barsky segment vs AABB ──
    _battleSegmentAABB(x0, y0, x1, y1, rx, ry, rw, rh) {
        let tmin = 0, tmax = 1;
        const dx = x1 - x0, dy = y1 - y0;
        const edges = [
            { p: -dx, q: x0 - rx },
            { p:  dx, q: rx + rw - x0 },
            { p: -dy, q: y0 - ry },
            { p:  dy, q: ry + rh - y0 },
        ];
        for (const { p, q } of edges) {
            if (Math.abs(p) < 0.0001) {
                if (q < 0) return null;
            } else {
                const t = q / p;
                if (p < 0) { if (t > tmin) tmin = t; }
                else       { if (t < tmax) tmax = t; }
                if (tmin > tmax) return null;
            }
        }
        return { x: x0 + dx * tmin, y: y0 + dy * tmin, t: tmin };
    },

    // ── Bomb Explosion (area damage) ──
    _battleExplodeBomb(bomb) {
        if (!bomb.isOwner) return;
        const remotes = this._rtGetRemoteArray();

        for (const target of remotes) {
            if (target._inSpectator || target.isDead || target.invincible > 0) continue;
            const dx = target.x - bomb.x;
            const dy = (target.y + target.h / 2) - bomb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < BOMB_RADIUS) {
                const falloff = 1 - dist / BOMB_RADIUS;
                const damage = Math.round(bomb.damage * falloff);
                if (damage <= 0) continue;
                const knockF = falloff * 8;
                const kx = dist > 1 ? (dx / dist) * knockF : 0;
                const ky = dist > 1 ? (dy / dist) * knockF - 4 : -6;
                this._rtBroadcastHit(target.studentId, damage, kx, ky);
                target.hp = (target.hp || MAX_HP) - damage;
                target.stunTimer = Math.max(target.stunTimer || 0, 25);
                if (target.hp <= 0) this._battleOnKill(target);
            }
        }

        // Self-damage if too close
        if (this.player && !this._battleIsDead) {
            const dx = this.player.x - bomb.x;
            const dy = (this.player.y + this.player.h / 2) - bomb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < BOMB_RADIUS && this._battleInvincible <= 0) {
                const falloff = 1 - dist / BOMB_RADIUS;
                const selfDmg = Math.round(bomb.damage * falloff * 0.5); // 50% self damage
                this._battleTakeDamage(selfDmg,
                    dist > 1 ? (dx / dist) * falloff * 6 : 0,
                    dist > 1 ? (dy / dist) * falloff * 6 - 3 : -4,
                    bomb.ownerSid);
            }
        }

        this._battleSpawnExplosionParticles(bomb.x, bomb.y);
        this.screenShake = Math.max(this.screenShake || 0, 6);
    },

    // ═══════════════════════════════════════
    // Damage / Death / Respawn
    // ═══════════════════════════════════════

    _battleTakeDamage(damage, kx, ky, attackerSid) {
        if (this._battleIsDead || this._battleInvincible > 0) return;
        this._battleHP -= damage;
        // Knockback + stun
        if (this.player) {
            this.player.vx += kx || 0;
            this.player.vy += ky || 0;
            this.player.stunTimer = Math.max(this.player.stunTimer || 0, 15);
        }
        this._battleSpawnHitParticles(
            this.player ? this.player.x : 0,
            this.player ? this.player.y + 15 : 0
        );
        this.screenShake = Math.max(this.screenShake || 0, 4);

        if (this._battleHP <= 0) {
            this._battleHP = 0;
            this._battleDie(attackerSid);
        }
    },

    _battleDie(killerSid) {
        this._battleIsDead = true;
        this._battleDeaths++;
        this._battleRespawnTimer = RESPAWN_TIME;

        // Notify others
        if (this._rtChannel) {
            this._rtChannel.send({
                type: 'broadcast', event: 'hit',
                payload: {
                    attackerSid: killerSid || '',
                    targetSid: String(Player.studentId),
                    damage: 0, kx: 0, ky: 0,
                    isDeath: true
                }
            });
        }

        // Killfeed
        const killerName = this._battleGetName(killerSid);
        const myName = Player.nickname || Player.studentId;
        this._battleKillFeed.push({
            text: `${killerName} -> ${myName}`,
            timer: KILLFEED_DURATION
        });

        // Death particles
        if (this.player) {
            this._battleSpawnExplosionParticles(this.player.x, this.player.y);
        }
    },

    _battleRespawn() {
        this._battleIsDead = false;
        this._battleHP = MAX_HP;
        this._battleInvincible = INVINCIBLE_TIME;
        this._battleBombCount = 0;
        this._battleWeapon = 'bullet';

        if (this.player) {
            const spawnX = this.player.team === 'left' ? 200 : this.W - 200;
            let spawnY = this.H - 60;
            // 플랫폼 겹침 방지: 스폰 지점이 플랫폼 내부면 위로 밀어냄
            if (this.platforms) {
                for (const pl of this.platforms) {
                    if (pl.type === 'ground') continue;
                    if (spawnX >= pl.x && spawnX <= pl.x + pl.w &&
                        spawnY >= pl.y && spawnY <= pl.y + pl.h + 30) {
                        spawnY = pl.y - 35;
                    }
                }
            }
            this.player.x = spawnX;
            this.player.y = spawnY;
            this.player.vx = 0;
            this.player.vy = 0;
            this.player.stunTimer = 0;
        }

        this.chatBubbles.push({
            x: this.player ? this.player.x : this.W / 2,
            y: this.player ? this.player.y - 45 : this.H / 2,
            text: 'RESPAWN!', timer: 90, follow: this.player
        });
    },

    _battleOnKill(target) {
        this._battleKills++;
        target.isDead = true;
        target._respawnTimer = RESPAWN_TIME;

        const myName = Player.nickname || Player.studentId;
        const targetName = target.displayName || target.studentId;
        this._battleKillFeed.push({
            text: `${myName} -> ${targetName}`,
            timer: KILLFEED_DURATION
        });

        this.chatBubbles.push({
            x: target.x, y: target.y - 45,
            text: 'KILL!', timer: 60, follow: null
        });
    },

    // ═══════════════════════════════════════
    // Bomb Pickups
    // ═══════════════════════════════════════

    _battleUpdatePickups() {
        if (!this._battlePickups || !this._isHost) return;

        for (const pk of this._battlePickups) {
            if (!pk.active) {
                pk.respawnTimer--;
                if (pk.respawnTimer <= 0) {
                    pk.active = true;
                    // Broadcast pickup respawn
                    if (this._rtChannel) {
                        this._rtChannel.send({
                            type: 'broadcast', event: 'gimmick',
                            payload: { pickupRespawn: { x: pk.x, y: pk.y } }
                        });
                    }
                }
            }
        }
    },

    _battleCheckPickup() {
        if (!this.battleMode || !this.player || this._battleIsDead) return;
        if (!this._battlePickups) return;
        if (this._battleBombCount >= MAX_BOMBS) return;

        const P = this.player;
        for (const pk of this._battlePickups) {
            if (!pk.active) continue;
            const dx = P.x - pk.x, dy = (P.y + P.h / 2) - pk.y;
            if (Math.abs(dx) < 25 && Math.abs(dy) < 25) {
                pk.active = false;
                pk.respawnTimer = BOMB_PICKUP_RESPAWN;
                this._battleBombCount = Math.min(this._battleBombCount + 1, MAX_BOMBS);
                this.chatBubbles.push({
                    x: P.x, y: P.y - 45,
                    text: 'BOMB +1', timer: 60, follow: P
                });
                // Broadcast pickup taken
                if (this._rtChannel) {
                    this._rtChannel.send({
                        type: 'broadcast', event: 'gimmick',
                        payload: { pickupTaken: { x: pk.x, y: pk.y } }
                    });
                }
                break;
            }
        }
    },

    // ═══════════════════════════════════════
    // Network handlers
    // ═══════════════════════════════════════

    _rtBroadcastShoot(proj) {
        if (!this._rtChannel) return;
        this._rtChannel.send({
            type: 'broadcast', event: 'shoot',
            payload: {
                sid: String(Player.studentId),
                x: Math.round(proj.x),
                y: Math.round(proj.y),
                vx: Math.round(proj.vx * 10) / 10,
                vy: Math.round(proj.vy * 10) / 10,
                type: proj.type
            }
        });
    },

    _rtBroadcastHit(targetSid, damage, kx, ky) {
        if (!this._rtChannel) return;
        damage = Math.max(0, Math.min(damage || 0, MAX_DAMAGE));
        kx = Math.max(-MAX_KNOCK, Math.min(kx || 0, MAX_KNOCK));
        ky = Math.max(-MAX_KNOCK, Math.min(ky || 0, MAX_KNOCK));
        this._rtChannel.send({
            type: 'broadcast', event: 'hit',
            payload: {
                attackerSid: String(Player.studentId),
                targetSid, damage,
                kx: Math.round(kx * 10) / 10,
                ky: Math.round(ky * 10) / 10
            }
        });
    },

    _rtOnRemoteShoot(data) {
        if (!this.battleMode) return;
        if (data.sid === String(Player.studentId)) return;
        // Visual-only projectile (no hit detection)
        const p = this._battleGetProjectile();
        if (!p) return;
        Object.assign(p, {
            x: data.x, y: data.y, vx: data.vx, vy: data.vy,
            type: data.type, damage: 0, life: data.type === 'bomb' ? BOMB_LIFE : BULLET_LIFE,
            isOwner: false, ownerSid: data.sid
        });
        this._battleProjectiles.push(p);
    },

    _rtOnRemoteHit(data) {
        if (!this.battleMode) return;

        // 데미지/넉백 값 검증 (치트 방지)
        if (typeof data.damage === 'number') {
            data.damage = Math.max(0, Math.min(data.damage, MAX_DAMAGE));
        } else { data.damage = 0; }
        if (typeof data.kx === 'number') {
            data.kx = Math.max(-MAX_KNOCK, Math.min(data.kx, MAX_KNOCK));
        } else { data.kx = 0; }
        if (typeof data.ky === 'number') {
            data.ky = Math.max(-MAX_KNOCK, Math.min(data.ky, MAX_KNOCK));
        } else { data.ky = 0; }

        // Death event
        if (data.isDeath) {
            const rp = this.remotePlayers ? this.remotePlayers.get(String(data.targetSid)) : null;
            if (rp) {
                rp.isDead = true;
                rp._respawnTimer = RESPAWN_TIME;
                rp.deaths = (rp.deaths || 0) + 1;
                this._battleSpawnExplosionParticles(rp.x, rp.y);
            }
            // Update killer stats
            const killer = data.attackerSid === String(Player.studentId)
                ? null // self handled in _battleOnKill
                : this.remotePlayers?.get(String(data.attackerSid));
            if (killer) killer.kills = (killer.kills || 0) + 1;

            // Killfeed
            const killerName = this._battleGetName(data.attackerSid);
            const deadName = rp ? rp.displayName : data.targetSid;
            this._battleKillFeed.push({
                text: `${killerName} -> ${deadName}`,
                timer: KILLFEED_DURATION
            });
            return;
        }

        // I got hit
        if (data.targetSid === String(Player.studentId)) {
            this._battleTakeDamage(data.damage, data.kx, data.ky, data.attackerSid);
            return;
        }

        // Someone else got hit — show effect
        const rp = this.remotePlayers ? this.remotePlayers.get(String(data.targetSid)) : null;
        if (rp) {
            rp.hp = (rp.hp || MAX_HP) - data.damage;
            rp.stunTimer = Math.max(rp.stunTimer || 0, 15);
            this._battleSpawnHitParticles(rp.x, rp.y + 15);
            if (rp.hp <= 0) {
                rp.isDead = true;
                rp._respawnTimer = RESPAWN_TIME;
            }
        }
    },

    // ═══════════════════════════════════════
    // Object Pool Helpers
    // ═══════════════════════════════════════

    _battleGetProjectile() {
        if (!this._projPool) return null;
        for (const p of this._projPool) {
            if (!p.active) { p.active = true; return p; }
        }
        return null;
    },

    _battleReturnProj(proj, idx) {
        proj.active = false;
        if (!this._battleProjectiles) return;
        // swap-and-pop: 역순 순회 안전 + splice보다 빠름
        const last = this._battleProjectiles.length - 1;
        if (idx !== last) this._battleProjectiles[idx] = this._battleProjectiles[last];
        this._battleProjectiles.pop();
    },

    _battleGetParticle() {
        if (!this._bParticlePool) return null;
        for (const p of this._bParticlePool) {
            if (!p.active) { p.active = true; return p; }
        }
        return null;
    },

    _battleSpawnHitParticles(x, y) {
        for (let i = 0; i < 5; i++) {
            const p = this._battleGetParticle();
            if (!p) break;
            Object.assign(p, {
                x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3 - 1,
                color: '#FF6B6B', size: 2 + Math.random() * 2,
                life: 15 + Math.random() * 10, maxLife: 25
            });
            this._battleParticles.push(p);
        }
    },

    _battleSpawnExplosionParticles(x, y) {
        const cols = ['#FF6B6B', '#FFD93D', '#FF9F43'];
        for (let i = 0; i < 8; i++) {
            const p = this._battleGetParticle();
            if (!p) break;
            const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
            Object.assign(p, {
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
                color: cols[i % 3], size: 3 + Math.random() * 3,
                life: 20 + Math.random() * 15, maxLife: 35
            });
            this._battleParticles.push(p);
        }
    },

    _battleUpdateParticles() {
        if (!this._battleParticles) return;
        for (let i = this._battleParticles.length - 1; i >= 0; i--) {
            const p = this._battleParticles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
            if (p.life <= 0) {
                p.active = false;
                this._battleParticles.splice(i, 1);
            }
        }
    },

    // ═══════════════════════════════════════
    // Weapon Switch
    // ═══════════════════════════════════════

    _battleSwitchWeapon() {
        if (this._battleBombCount > 0) {
            this._battleWeapon = this._battleWeapon === 'bullet' ? 'bomb' : 'bullet';
        }
    },

    // ═══════════════════════════════════════
    // Rendering
    // ═══════════════════════════════════════

    _battleRenderProjectiles(ctx, camX, camY) {
        if (!this._battleProjectiles) return;
        for (const p of this._battleProjectiles) {
            if (!p.active) continue;
            const sx = p.x - camX, sy = p.y - camY;
            if (sx < -30 || sx > this.VW + 30 || sy < -30 || sy > this.VH + 30) continue;

            ctx.save();
            if (p.type === 'bullet') {
                ctx.fillStyle = '#4D96FF';
                ctx.shadowColor = '#4D96FF';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.ellipse(sx, sy, 6, 3, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Bomb
                ctx.fillStyle = '#FF4500';
                ctx.shadowColor = '#FF4500';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                ctx.fill();
                // Fuse spark
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(sx + (Math.random() - 0.5) * 4, sy - 8, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    },

    _battleRenderParticles(ctx, camX, camY) {
        if (!this._battleParticles) return;
        for (const p of this._battleParticles) {
            if (!p.active) continue;
            const alpha = p.life / p.maxLife;
            const sx = p.x - camX, sy = p.y - camY;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            const s = p.size * alpha;
            ctx.beginPath();
            ctx.arc(sx, sy, s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    _battleRenderHP(ctx, entity, sx, sy, isLocal) {
        const hp = isLocal ? this._battleHP : (entity.hp || MAX_HP);
        const maxHp = MAX_HP;
        const pct = Math.max(0, Math.min(1, hp / maxHp));
        const barW = 32, barH = 4;
        const bx = sx - barW / 2, by = sy - 6;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx, by, barW, barH);
        // Fill
        ctx.fillStyle = pct > 0.66 ? '#4CAF50' : pct > 0.33 ? '#FFC107' : '#F44336';
        ctx.fillRect(bx, by, barW * pct, barH);
        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);
    },

    _battleRenderHUD(ctx, VW, VH) {
        // K/D display (top right)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(VW - 130, 8, 120, 28, 10); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px "Segoe UI",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`K ${this._battleKills}  /  D ${this._battleDeaths}`, VW - 70, 27);

        // Weapon indicator (top right below K/D)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(VW - 130, 40, 120, 24, 8); ctx.fill();
        ctx.font = 'bold 11px "Segoe UI",sans-serif';
        const weaponText = this._battleWeapon === 'bullet'
            ? 'GUN [Q: switch]'
            : `BOMB x${this._battleBombCount} [Q: switch]`;
        ctx.fillStyle = this._battleWeapon === 'bullet' ? '#4D96FF' : '#FF4500';
        ctx.fillText(weaponText, VW - 70, 56);

        // Killfeed (right side)
        for (let i = 0; i < this._battleKillFeed.length && i < 5; i++) {
            const kf = this._battleKillFeed[i];
            const ky = 72 + i * 22;
            const alpha = Math.min(1, kf.timer / 30);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(180,0,0,0.6)';
            const tw = ctx.measureText(kf.text).width + 20;
            ctx.beginPath(); ctx.roundRect(VW - tw - 15, ky, tw + 10, 18, 6); ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 11px "Segoe UI",sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(kf.text, VW - 18, ky + 14);
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'left';

        // Death screen
        if (this._battleIsDead) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, VW, VH);
            ctx.fillStyle = '#FF4444';
            ctx.font = 'bold 36px "Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('YOU DIED', VW / 2, VH / 2 - 20);
            const sec = Math.ceil(this._battleRespawnTimer / 60);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px "Segoe UI",sans-serif';
            ctx.fillText(`Respawn in ${sec}...`, VW / 2, VH / 2 + 20);
            ctx.textAlign = 'left';
        }

        // Invincible indicator
        if (this._battleInvincible > 0 && !this._battleIsDead) {
            const alpha = 0.3 + 0.3 * Math.sin(this.frameCount * 0.3);
            ctx.fillStyle = `rgba(100,200,255,${alpha})`;
            ctx.fillRect(0, 0, VW, VH);
        }
    },

    _battleRenderPickups(ctx, camX, camY) {
        if (!this._battlePickups) return;
        for (const pk of this._battlePickups) {
            if (!pk.active) continue;
            const sx = pk.x - camX, sy = pk.y - camY;
            if (sx < -20 || sx > this.VW + 20) continue;

            // Floating animation
            const bobY = sy + Math.sin((this.frameCount || 0) * 0.08 + pk.x) * 4;

            ctx.save();
            // Glow
            ctx.shadowColor = '#FF4500';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#FF4500';
            ctx.beginPath();
            ctx.arc(sx, bobY, 10, 0, Math.PI * 2);
            ctx.fill();
            // Label
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('BOMB', sx, bobY - 16);
            ctx.restore();
        }
    },

    // ═══════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════

    _battleGetName(sid) {
        if (!sid) return '?';
        if (sid === String(Player.studentId)) return Player.nickname || sid;
        const rp = this.remotePlayers ? this.remotePlayers.get(String(sid)) : null;
        return rp ? (rp.displayName || sid) : sid;
    },
};
