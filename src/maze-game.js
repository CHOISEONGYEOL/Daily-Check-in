// ── Transparent Maze Escape Game ──
// Mixin for Game object — top-down invisible maze with reveal mechanic
import { Player } from './player.js';
import { CharRender } from './char-render.js';
import { Templates, parseTemplate } from './templates.js';

export const MazeGame = {
    // ── 상수 (기본값, startMaze에서 인원 기반으로 덮어씀) ──
    MAZE_COLS: 25, MAZE_ROWS: 18, CELL: 64,
    WALL_T: 8,        // 벽 두께
    REVEAL_R: 80,     // 밝히기 반경
    MAZE_SPD: 2.5,    // 플레이어 이동속도
    NPC_SPD_MIN: 0.6, NPC_SPD_MAX: 1.4,
    MAZE_FLASH: 180,  // 시작 시 전체 미로 표시 (3초 = 180프레임)

    // ── 인원 기반 미로 파라미터 ──
    getMazeParams(n){
        if(n <= 5)  return { cols:11, rows:8,  revealR:160, flash:240 };
        if(n <= 10) return { cols:15, rows:11, revealR:130, flash:210 };
        if(n <= 15) return { cols:19, rows:14, revealR:110, flash:195 };
        if(n <= 20) return { cols:22, rows:16, revealR:95,  flash:180 };
        return { cols:25, rows:18, revealR:80, flash:180 };
    },

    // ═══════════════════════════════════════
    // 미로 생성 (Recursive Backtracker)
    // ═══════════════════════════════════════
    generateMaze(cols, rows){
        const grid = [];
        for(let r=0; r<rows; r++){
            grid[r] = [];
            for(let c=0; c<cols; c++){
                grid[r][c] = { N:false, S:false, E:false, W:false, visited:false };
            }
        }
        const stack = [];
        const start = grid[0][0];
        start.visited = true;
        stack.push({r:0, c:0});

        while(stack.length > 0){
            const {r, c} = stack[stack.length-1];
            const neighbors = [];
            if(r>0 && !grid[r-1][c].visited) neighbors.push({r:r-1, c, dir:'N', opp:'S'});
            if(r<rows-1 && !grid[r+1][c].visited) neighbors.push({r:r+1, c, dir:'S', opp:'N'});
            if(c<cols-1 && !grid[r][c+1].visited) neighbors.push({r, c:c+1, dir:'E', opp:'W'});
            if(c>0 && !grid[r][c-1].visited) neighbors.push({r, c:c-1, dir:'W', opp:'E'});

            if(neighbors.length === 0){
                stack.pop();
            } else {
                const next = neighbors[Math.floor(Math.random()*neighbors.length)];
                grid[r][c][next.dir] = true;
                grid[next.r][next.c][next.opp] = true;
                grid[next.r][next.c].visited = true;
                stack.push({r:next.r, c:next.c});
            }
        }
        return grid;
    },

    buildMazeWalls(){
        const C = this.CELL, T = this.WALL_T;
        const cols = this.MAZE_COLS, rows = this.MAZE_ROWS;
        const walls = [];

        // 외벽 (상, 하, 좌, 우)
        walls.push({x:0, y:0, w:cols*C, h:T});           // 상
        walls.push({x:0, y:rows*C-T, w:cols*C, h:T});     // 하
        walls.push({x:0, y:0, w:T, h:rows*C});             // 좌
        walls.push({x:cols*C-T, y:0, w:T, h:rows*C});      // 우

        // 내벽: 셀 사이에 벽이 없으면 통로, 있으면 벽 세그먼트
        for(let r=0; r<rows; r++){
            for(let c=0; c<cols; c++){
                const cell = this.mazeGrid[r][c];
                const x = c * C, y = r * C;
                // 남쪽 벽 (마지막 행 제외 — 외벽이 처리)
                if(r < rows-1 && !cell.S){
                    walls.push({x: x+T, y: y+C-T/2, w: C-T*2, h: T});
                }
                // 동쪽 벽 (마지막 열 제외)
                if(c < cols-1 && !cell.E){
                    walls.push({x: x+C-T/2, y: y+T, w: T, h: C-T*2});
                }
            }
        }
        // 교차점 기둥 (각 내부 교차점에 작은 기둥)
        for(let r=1; r<rows; r++){
            for(let c=1; c<cols; c++){
                walls.push({x: c*C-T/2, y: r*C-T/2, w: T, h: T});
            }
        }
        this.mazeWalls = walls;
    },

    // ═══════════════════════════════════════
    // 게임 시작
    // ═══════════════════════════════════════
    startMaze(){
        this.stage = 0;
        this.completed = false;
        this.running = true;
        this.ghostMode = false;
        this.victoryTimer = 0;
        this.particles = [];
        this.chatBubbles = [];
        this.mazeFrame = 0;

        this.cvs = document.getElementById('game-canvas');
        this.ctx = this.cvs.getContext('2d');
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        // 인원 기반 미로 파라미터 적용
        const mp = this.getMazeParams(this.totalStudents);
        this.MAZE_COLS = mp.cols;
        this.MAZE_ROWS = mp.rows;
        this.REVEAL_R = mp.revealR;
        this.MAZE_FLASH = mp.flash;

        // 미로 생성
        this.mazeGrid = this.generateMaze(this.MAZE_COLS, this.MAZE_ROWS);
        this.buildMazeWalls();

        const C = this.CELL, T = this.WALL_T;
        this.mazeW = this.MAZE_COLS * C;
        this.mazeH = this.MAZE_ROWS * C;

        // 시작/출구 위치 (셀 중심)
        this.mazeStart = { x: C*1.5, y: C*1.5 };
        this.mazeExit = { x: (this.MAZE_COLS-2)*C + C/2, y: (this.MAZE_ROWS-2)*C + C/2 };
        this.mazeExitRect = {
            x: (this.MAZE_COLS-2)*C + T, y: (this.MAZE_ROWS-2)*C + T,
            w: C - T*2, h: C - T*2
        };

        // 플레이어 (관전 모드: 더미)
        if(this.spectatorMode){
            this.player = {
                x: -1000, y: -1000, vx:0, vy:0, w:20, h:20,
                dir:1, sprite:null, dead:false, atDoor:false, _spectatorDummy:true
            };
        } else {
            const pxData = Player.pixels || parseTemplate(Templates[0]);
            this.player = {
                x: this.mazeStart.x, y: this.mazeStart.y,
                vx:0, vy:0, w:20, h:20,
                dir:1, sprite: CharRender.toOffscreen(pxData, 64),
                dead:false, atDoor:false
            };
        }

        // NPC 생성
        this.npcs = [];
        const totalNPCs = (this.spectatorMode && this.totalStudents <= 0) ? 5 : (this.totalStudents - 1);
        const npcNames = ['민수','지은','서준','하은','도윤','수빈','예준','지아','시우','하윤',
            '유준','서아','주원','채원','준서','다은','현우','소율','지호','은서',
            '건우','지유','태윤','나윤','민재','아린','성민','예나','우진','하린'];
        for(let i=0; i<totalNPCs; i++){
            this.npcs.push({
                x: this.mazeStart.x + (Math.random()-.5)*30,
                y: this.mazeStart.y + (Math.random()-.5)*30,
                vx:0, vy:0, w:18, h:18,
                dir: Math.random()>.5?1:-1,
                sprite: CharRender.toOffscreen(parseTemplate(Templates[i % Templates.length]), 64),
                color: `hsl(${(i*47)%360},60%,55%)`,
                displayName: npcNames[i % npcNames.length],
                // 미로 AI
                moveDir: ['N','S','E','W'][Math.floor(Math.random()*4)],
                speed: this.NPC_SPD_MIN + Math.random()*(this.NPC_SPD_MAX-this.NPC_SPD_MIN),
                idleTimer: 0,
                changeTimer: 60 + Math.floor(Math.random()*120),
                dead: false, atDoor: false
            });
        }

        this.totalPlayers = this.npcs.length + 1;
        this.mazeCamera = {x:0, y:0};

        // 뷰포트
        this.VW = 800; this.VH = 600;
        const rect = this.cvs.parentElement.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        this.cvs.width = w * this.dpr;
        this.cvs.height = h * this.dpr;
        this.cvs.style.width = w + 'px';
        this.cvs.style.height = h + 'px';
        this.VW = w; this.VH = h;

        // 입력
        this.keys = {};
        this._mazeKeyDown = e => {
            this.keys[e.key] = true;
            if(this.spectatorMode){
                if(e.key === '=' || e.key === '+') { this.gameZoom = Math.min(3, (this.gameZoom||1) + 0.2); }
                if(e.key === '-') { this.gameZoom = Math.max(0.3, (this.gameZoom||1) - 0.2); }
                // ESC: 전지적 시점 복귀
                if(e.key === 'Escape') { this._setSpectatorMode('free', null); }
                // Tab: 다음 학생 POV
                if(e.key === 'Tab') { e.preventDefault(); this._cycleFollowTarget(e.shiftKey ? -1 : 1); }
                // F: 현재 추적 대상의 시점 전환
                if((e.key === 'f' || e.key === 'F') && this._followTarget){
                    this._spectatorCamMode = this._spectatorCamMode === 'pov' ? 'free' : 'pov';
                    this._updateSpectatorUI();
                }
            }
        };
        this._mazeKeyUp = e => { this.keys[e.key] = false; };
        window.addEventListener('keydown', this._mazeKeyDown);
        window.addEventListener('keyup', this._mazeKeyUp);

        // 관전 모드: 클릭으로 학생 POV + 학생 목록
        if(this.spectatorMode){
            this._followTarget = null;
            this._spectatorCamMode = 'free';
            this._mazeSpecClick = e => {
                const rect = this.cvs.getBoundingClientRect();
                const z = this.gameZoom || 1;
                const dpr = this.dpr || 1;
                const mx = (e.clientX - rect.left) / (rect.width / (this.cvs.width / dpr)) / z + this.mazeCamera.x;
                const my = (e.clientY - rect.top) / (rect.height / (this.cvs.height / dpr)) / z + this.mazeCamera.y;
                let best = null, bestDist = 50;
                for(const n of this.npcs){
                    if(n._spectatorDummy) continue;
                    const d = Math.hypot(n.x - mx, n.y - my);
                    if(d < bestDist){ bestDist = d; best = n; }
                }
                if(best) this._setSpectatorMode('pov', best);
            };
            this.cvs.addEventListener('click', this._mazeSpecClick);
            this._showStudentList();
        }

        // 타이머
        this.remaining = 300;
        this.timerRef = setInterval(()=>{
            this.remaining--;
            this.updateMazeHUD();
            if(this.remaining <= 0){
                clearInterval(this.timerRef);
                this.endGame(false);
            }
        }, 1000);
        this.updateMazeHUD();

        // 게임 루프
        const loop = () => {
            if(!this.running && this.victoryTimer <= 0) return;
            this.updateMaze();
            this.renderMaze();
            this.animRef = requestAnimationFrame(loop);
        };
        loop();
    },

    // ═══════════════════════════════════════
    // 업데이트
    // ═══════════════════════════════════════
    updateMaze(){
        this.mazeFrame++;

        // 승리 연출
        if(this.victoryTimer > 0){
            this.victoryTimer--;
            this.particles = this.particles.filter(p=>{
                p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life--; return p.life>0;
            });
            this.chatBubbles = this.chatBubbles.filter(b=>{ b.timer--; return b.timer>0; });
            if(this.victoryTimer <= 0){
                this.running = false;
                this.showVictoryReward();
            }
            return;
        }
        if(!this.running) return;

        if(!this.spectatorMode) this.updateMazePlayer();
        this.updateMazeNPCs();

        // 탈출 체크: 아무나 출구에 도달하면 클리어
        const ex = this.mazeExitRect;
        const allEntities = [this.player, ...this.npcs];
        for(const e of allEntities){
            if(e.x > ex.x && e.x < ex.x+ex.w && e.y > ex.y && e.y < ex.y+ex.h){
                this.missionClear();
                // 출구에서 축하 파티클
                for(let i=0;i<50;i++){
                    this.particles.push({
                        x: ex.x+ex.w/2, y: ex.y+ex.h/2,
                        vx: (Math.random()-.5)*6, vy: -Math.random()*4-1,
                        color: ['#FFD700','#00B894','#FF6B6B','#54A0FF','#A29BFE'][Math.floor(Math.random()*5)],
                        size: 3+Math.random()*3, life: 80+Math.random()*60, maxLife:140
                    });
                }
                break;
            }
        }

        // 카메라
        if(this.spectatorMode){
            const z = this.gameZoom || 1;
            const vw = this.VW / z, vh = this.VH / z;
            if(this._spectatorCamMode === 'pov' && this._followTarget){
                // ★ POV 모드: 학생 시점 그대로 재현 (빠른 추적)
                const tx = this._followTarget.x - vw/2;
                const ty = this._followTarget.y - vh/2;
                const cx = Math.max(0, Math.min(tx, this.mazeW - vw));
                const cy = Math.max(0, Math.min(ty, this.mazeH - vh));
                this.mazeCamera.x += (cx - this.mazeCamera.x) * 0.18;
                this.mazeCamera.y += (cy - this.mazeCamera.y) * 0.18;
            } else {
                // ★ 전지적 시점: 자유 카메라 (방향키/WASD)
                const spd = 6;
                if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) this.mazeCamera.x -= spd;
                if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']) this.mazeCamera.x += spd;
                if(this.keys['ArrowUp']||this.keys['w']||this.keys['W']) this.mazeCamera.y -= spd;
                if(this.keys['ArrowDown']||this.keys['s']||this.keys['S']) this.mazeCamera.y += spd;
                this.mazeCamera.x = Math.max(0, Math.min(this.mazeCamera.x, this.mazeW - vw));
                this.mazeCamera.y = Math.max(0, Math.min(this.mazeCamera.y, this.mazeH - vh));
            }
        } else {
            const targetX = this.player.x - this.VW/2;
            const targetY = this.player.y - this.VH/2;
            const camX = Math.max(0, Math.min(targetX, this.mazeW - this.VW));
            const camY = Math.max(0, Math.min(targetY, this.mazeH - this.VH));
            this.mazeCamera.x += (camX - this.mazeCamera.x) * 0.12;
            this.mazeCamera.y += (camY - this.mazeCamera.y) * 0.12;
        }

        // 파티클/채팅
        this.particles = this.particles.filter(p=>{
            p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life--; return p.life>0;
        });
        this.chatBubbles = this.chatBubbles.filter(b=>{ b.timer--; return b.timer>0; });
    },

    updateMazePlayer(){
        const P = this.player;
        let dx=0, dy=0;
        if(this.keys['ArrowLeft']||this.keys['a']||this.keys['A']) { dx=-1; P.dir=-1; }
        if(this.keys['ArrowRight']||this.keys['d']||this.keys['D']) { dx=1; P.dir=1; }
        if(this.keys['ArrowUp']||this.keys['w']||this.keys['W']) dy=-1;
        if(this.keys['ArrowDown']||this.keys['s']||this.keys['S']) dy=1;
        // 대각선 정규화
        if(dx && dy){ dx *= 0.707; dy *= 0.707; }
        P.vx = dx * this.MAZE_SPD;
        P.vy = dy * this.MAZE_SPD;
        // X 이동 + 충돌
        P.x += P.vx;
        this.checkMazeWallCollision(P);
        // Y 이동 + 충돌
        P.y += P.vy;
        this.checkMazeWallCollision(P);
    },

    updateMazeNPCs(){
        for(const n of this.npcs){
            // 대기 타이머
            if(n.idleTimer > 0){ n.idleTimer--; continue; }

            n.changeTimer--;
            if(n.changeTimer <= 0){
                // 방향 변경 또는 잠시 멈춤
                if(Math.random() < 0.3){
                    n.idleTimer = 60 + Math.floor(Math.random()*120); // 1~3초 멈춤
                }
                const dirs = ['N','S','E','W'];
                n.moveDir = dirs[Math.floor(Math.random()*dirs.length)];
                n.changeTimer = 60 + Math.floor(Math.random()*120);
            }

            const prevX = n.x, prevY = n.y;
            switch(n.moveDir){
                case 'N': n.y -= n.speed; break;
                case 'S': n.y += n.speed; break;
                case 'E': n.x += n.speed; n.dir=1; break;
                case 'W': n.x -= n.speed; n.dir=-1; break;
            }
            this.checkMazeWallCollision(n);
            // 벽에 부딪혔으면 방향 전환
            const stuck = Math.abs(n.x-prevX)<0.1 && Math.abs(n.y-prevY)<0.1;
            if(stuck){
                const dirs = ['N','S','E','W'].filter(d=>d!==n.moveDir);
                n.moveDir = dirs[Math.floor(Math.random()*dirs.length)];
                n.changeTimer = 30 + Math.floor(Math.random()*60);
            }
        }
    },

    checkMazeWallCollision(e){
        const hw = e.w/2, hh = e.h/2;
        for(const w of this.mazeWalls){
            // AABB 겹침 체크
            if(e.x+hw > w.x && e.x-hw < w.x+w.w && e.y+hh > w.y && e.y-hh < w.y+w.h){
                // 최소 침투 방향으로 밀어내기
                const penL = (e.x+hw) - w.x;
                const penR = (w.x+w.w) - (e.x-hw);
                const penT = (e.y+hh) - w.y;
                const penB = (w.y+w.h) - (e.y-hh);
                const min = Math.min(penL, penR, penT, penB);
                if(min === penL) e.x = w.x - hw;
                else if(min === penR) e.x = w.x + w.w + hw;
                else if(min === penT) e.y = w.y - hh;
                else e.y = w.y + w.h + hh;
            }
        }
    },

    // ═══════════════════════════════════════
    // 렌더링
    // ═══════════════════════════════════════
    renderMaze(){
        const ctx = this.ctx;
        const VW = this.VW, VH = this.VH;
        const dpr = this.dpr;
        const z = (this.spectatorMode && this.gameZoom) ? this.gameZoom : 1;
        ctx.setTransform(dpr,0,0,dpr,0,0);
        const camX = this.mazeCamera.x, camY = this.mazeCamera.y;

        // 배경
        const bgGrad = ctx.createLinearGradient(0,0,0,VH);
        bgGrad.addColorStop(0,'#0a0e1a');
        bgGrad.addColorStop(1,'#151b2e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0,0,VW,VH);

        ctx.save();
        ctx.scale(z, z);
        ctx.translate(-camX, -camY);

        // 미로 바닥 (통로 영역)
        ctx.fillStyle = 'rgba(30,40,60,.4)';
        ctx.fillRect(0, 0, this.mazeW, this.mazeH);

        // 출구 (항상 보임)
        const ex = this.mazeExitRect;
        const pulse = 0.5 + 0.3*Math.sin(this.mazeFrame*0.05);
        ctx.fillStyle = `rgba(0,184,148,${pulse*0.4})`;
        ctx.fillRect(ex.x-10, ex.y-10, ex.w+20, ex.h+20);
        ctx.fillStyle = `rgba(0,184,148,${pulse})`;
        ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px "Segoe UI",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚪 출구', ex.x+ex.w/2, ex.y+ex.h/2+5);

        // 시작점 표시
        const sx = this.mazeStart;
        ctx.fillStyle = 'rgba(253,203,110,.25)';
        ctx.beginPath();
        ctx.arc(sx.x, sx.y, 30, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(253,203,110,.6)';
        ctx.font = 'bold 10px "Segoe UI",sans-serif';
        ctx.fillText('출발', sx.x, sx.y+4);

        // 벽 렌더링
        this.renderMazeWalls(ctx, camX, camY);

        // 엔티티
        this.renderMazeEntities(ctx, camX, camY);

        // 파티클
        this.particles.forEach(p=>{
            const alpha = p.life / (p.maxLife||100);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size*alpha, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // 채팅 버블
        this.chatBubbles.forEach(b=>{
            if(b.screen) return;
            const alpha = Math.min(b.timer/30, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(0,0,0,.6)';
            const tw = ctx.measureText(b.text).width + 12;
            ctx.beginPath();
            ctx.roundRect(b.x-tw/2, b.y-20, tw, 18, 6);
            ctx.fill();
            ctx.fillStyle = b.big ? '#FFD700' : '#fff';
            ctx.font = b.big ? 'bold 12px sans-serif' : '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(b.text, b.x, b.y-7);
            ctx.globalAlpha = 1;
        });

        ctx.restore();

        // HUD (화면 고정)
        this.renderMazeHUD(ctx);

        // 화면 고정 채팅
        this.chatBubbles.forEach(b=>{
            if(!b.screen) return;
            const alpha = Math.min(b.timer/30, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = b.big ? '#FFD700' : '#fff';
            ctx.font = b.big ? 'bold 20px "Segoe UI",sans-serif' : 'bold 14px "Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(b.text, VW/2, VH/3);
            ctx.globalAlpha = 1;
        });
    },

    renderMazeWalls(ctx, camX, camY){
        const flash = this.mazeFrame < this.MAZE_FLASH;
        const fadeAlpha = flash ? Math.min(1, (this.MAZE_FLASH - this.mazeFrame)/60) : 0;
        const R = this.REVEAL_R;
        const allEntities = [this.player, ...this.npcs];
        const z = (this.spectatorMode && this.gameZoom) ? this.gameZoom : 1;
        const cullW = this.VW / z, cullH = this.VH / z;
        const isPov = this.spectatorMode && this._spectatorCamMode === 'pov' && this._followTarget;

        for(const w of this.mazeWalls){
            // 화면 밖 컬링
            if(w.x+w.w < camX-20 || w.x > camX+cullW+20 ||
               w.y+w.h < camY-20 || w.y > camY+cullH+20) continue;

            if(this.spectatorMode && !isPov){
                // ★ 전지적 시점: 전체 벽 항상 보임 (안개 해제)
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = 'rgba(100,160,255,.8)';
                ctx.fillRect(w.x, w.y, w.w, w.h);
                ctx.strokeStyle = 'rgba(150,200,255,.4)';
                ctx.lineWidth = 1;
                ctx.strokeRect(w.x, w.y, w.w, w.h);
                ctx.globalAlpha = 1;
                continue;
            }

            if(isPov){
                // ★ POV 모드: 해당 학생의 시야(안개)로만 벽 표시
                const wcx = w.x + w.w/2, wcy = w.y + w.h/2;
                const dx = this._followTarget.x - wcx, dy = this._followTarget.y - wcy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if(dist < R){
                    const alpha = 1 - (dist / R);
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.fillStyle = 'rgba(100,160,255,.8)';
                    ctx.fillRect(w.x, w.y, w.w, w.h);
                    ctx.strokeStyle = 'rgba(150,200,255,.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(w.x, w.y, w.w, w.h);
                    ctx.globalAlpha = 1;
                }
                continue;
            }

            if(flash){
                // 시작 플래시: 전체 벽 표시 (페이드아웃)
                ctx.globalAlpha = fadeAlpha;
                ctx.fillStyle = 'rgba(100,130,180,.7)';
                ctx.fillRect(w.x, w.y, w.w, w.h);
                ctx.globalAlpha = 1;
            } else {
                // 투명 모드: 엔티티 근처 벽만 표시
                const wcx = w.x + w.w/2, wcy = w.y + w.h/2;
                let closestDist = Infinity;
                for(const e of allEntities){
                    const dx = e.x - wcx, dy = e.y - wcy;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if(dist < closestDist) closestDist = dist;
                    if(dist < R) break; // 이미 범위 내
                }
                if(closestDist < R){
                    const alpha = 1 - (closestDist / R);
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.fillStyle = 'rgba(100,160,255,.8)';
                    ctx.fillRect(w.x, w.y, w.w, w.h);
                    ctx.strokeStyle = 'rgba(150,200,255,.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(w.x, w.y, w.w, w.h);
                    ctx.globalAlpha = 1;
                }
            }
        }
    },

    renderMazeEntities(ctx, camX, camY){
        const allEntities = [this.player, ...this.npcs];
        allEntities.sort((a,b) => a.y - b.y);
        const z = (this.spectatorMode && this.gameZoom) ? this.gameZoom : 1;
        const cullW = this.VW / z, cullH = this.VH / z;
        const isPov = this.spectatorMode && this._spectatorCamMode === 'pov' && this._followTarget;
        const R = this.REVEAL_R;

        for(const e of allEntities){
            if(e._spectatorDummy) continue;

            // 화면 밖 컬링
            if(e.x+20 < camX || e.x-20 > camX+cullW ||
               e.y+20 < camY || e.y-20 > camY+cullH) continue;

            // POV 모드: 추적 대상의 시야 범위 밖 엔티티는 안 보임
            if(isPov && e !== this._followTarget){
                const dist = Math.hypot(e.x - this._followTarget.x, e.y - this._followTarget.y);
                if(dist > R * 1.5) continue; // 시야 밖
            }

            const isPlayer = e === this.player;
            const isFollowed = this.spectatorMode && this._followTarget === e;
            // POV 대상은 플레이어 크기로 표시
            const size = (isPlayer || isFollowed) ? 34 : 28;

            // 추적 대상: 플레이어처럼 금색 하이라이트
            if(isFollowed){
                // 밝히기 반경 (금색)
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#ffdd44';
                ctx.beginPath();
                ctx.arc(e.x, e.y, R, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
                // 화살표
                const ay = e.y - size/2 - 14 + Math.sin(Date.now()*0.005)*3;
                ctx.fillStyle='#FFD700'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
                ctx.fillText('▼', e.x, ay);
            } else if(!isPlayer){
                // 밝히기 반경 (파란색)
                ctx.globalAlpha = 0.06;
                ctx.fillStyle = '#88aaff';
                ctx.beginPath();
                ctx.arc(e.x, e.y, R, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else {
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#ffdd44';
                ctx.beginPath();
                ctx.arc(e.x, e.y, R, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // 스프라이트
            if(e.sprite){
                ctx.save();
                ctx.translate(e.x, e.y - size*0.3);
                if(e.dir < 0){ ctx.scale(-1,1); }
                ctx.drawImage(e.sprite, -size/2, -size/2, size, size);
                ctx.restore();
            } else {
                ctx.fillStyle = e.color || '#FDCB6E';
                ctx.beginPath();
                ctx.arc(e.x, e.y, size/2, 0, Math.PI*2);
                ctx.fill();
            }

            // 이름 표시
            if(isFollowed){
                // POV 대상: 플레이어처럼 금색 이름
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 11px "Segoe UI",sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(e.displayName || '학생', e.x, e.y - size/2 - 8);
            } else if(isPlayer){
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 11px "Segoe UI",sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(Player.nickname || '나', e.x, e.y - size/2 - 8);
            } else if(e.displayName){
                ctx.fillStyle = 'rgba(255,255,255,.5)';
                ctx.font = '8px "Segoe UI",sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(e.displayName, e.x, e.y - size/2 - 4);
            }
        }
    },

    renderMazeHUD(ctx){
        const VW = this.VW, VH = this.VH;

        // 시작 안내 문구
        if(this.mazeFrame < this.MAZE_FLASH){
            const sec = Math.ceil((this.MAZE_FLASH - this.mazeFrame)/60);
            ctx.fillStyle = 'rgba(0,0,0,.5)';
            ctx.beginPath();ctx.roundRect(VW/2-140, 10, 280, 36, 12);ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 16px "Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`👀 미로를 기억하세요! (${sec}초)`, VW/2, 34);
        } else if(this.mazeFrame < this.MAZE_FLASH + 180){
            ctx.fillStyle = 'rgba(0,0,0,.5)';
            ctx.beginPath();ctx.roundRect(VW/2-120, 10, 240, 30, 10);ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.font = 'bold 12px "Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🌀 벽이 사라졌습니다! 협동하세요!', VW/2, 30);
        }

        // 상시 규칙 안내 (우측 하단)
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        ctx.beginPath();ctx.roundRect(VW-200, VH-52, 195, 48, 8);ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.font = '9px "Segoe UI",sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('💡 친구 근처의 벽만 보입니다', VW-192, VH-36);
        ctx.fillText('🚪 한 명만 출구에 도착하면 전원 클리어!', VW-192, VH-22);
        ctx.fillText('🪙 현상금: 100 코인', VW-192, VH-8);

        // 미니맵 (우측 상단)
        const mmW = 120, mmH = mmW * (this.MAZE_ROWS/this.MAZE_COLS);
        const mmX = VW - mmW - 8, mmY = 8;
        const mmScale = mmW / this.mazeW;

        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.beginPath();ctx.roundRect(mmX-2, mmY-2, mmW+4, mmH+4, 4);ctx.fill();

        // 미니맵 벽 (항상 표시)
        ctx.fillStyle = 'rgba(100,160,255,.3)';
        for(const w of this.mazeWalls){
            ctx.fillRect(mmX+w.x*mmScale, mmY+w.y*mmScale,
                Math.max(w.w*mmScale,0.5), Math.max(w.h*mmScale,0.5));
        }

        // 출구
        ctx.fillStyle = '#00B894';
        const ex = this.mazeExitRect;
        ctx.fillRect(mmX+ex.x*mmScale, mmY+ex.y*mmScale, Math.max(ex.w*mmScale,3), Math.max(ex.h*mmScale,3));

        // 뷰포트
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX+this.mazeCamera.x*mmScale, mmY+this.mazeCamera.y*mmScale,
            this.VW*mmScale, this.VH*mmScale);

        // NPC 위치
        ctx.fillStyle = 'rgba(108,92,231,.6)';
        this.npcs.forEach(n=>{
            ctx.beginPath();
            ctx.arc(mmX+n.x*mmScale, mmY+n.y*mmScale, 1.5, 0, Math.PI*2);
            ctx.fill();
        });

        // 플레이어 위치
        ctx.fillStyle = '#FDCB6E';
        ctx.beginPath();
        ctx.arc(mmX+this.player.x*mmScale, mmY+this.player.y*mmScale, 2.5, 0, Math.PI*2);
        ctx.fill();
    },

    // HUD 업데이트 (기존 game.js HUD 요소 사용)
    updateMazeHUD(){
        const timerEl = document.getElementById('hud-timer');
        if(timerEl){
            const m = Math.floor(this.remaining/60);
            const s = this.remaining%60;
            timerEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
        }
        const coinsEl = document.getElementById('G-coins');
        if(coinsEl) coinsEl.textContent = Player.coins;

        const starsEl = document.getElementById('hud-stars');
        if(starsEl) starsEl.textContent = '🌀 미로 탈출 | 🪙 100 현상금';

        const fillEl = document.getElementById('hud-fill');
        if(fillEl) fillEl.style.width = '0%';
    },
};
