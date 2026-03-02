export const GameSpectator = {
    setupSpectatorInput(){
        this.keys = {};
        this._followTarget = null;
        this._spectatorCamMode = 'free';
        this._specKeyDown = e => {
            this.keys[e.key] = true;
            if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
            if(e.key === '=' || e.key === '+') { this.gameZoom = Math.min(3, this.gameZoom + 0.2); this.resize(); }
            if(e.key === '-') { this.gameZoom = Math.max(0.5, this.gameZoom - 0.2); this.resize(); }
            // ESC: 전지적 시점(자유 카메라)으로 복귀
            if(e.key === 'Escape') { this._setSpectatorMode('free', null); }
            // Tab: 다음 학생 POV
            if(e.key === 'Tab') { e.preventDefault(); this._cycleFollowTarget(e.shiftKey ? -1 : 1); }
            // F: 현재 추적 대상의 시점 전환 (전지적 ↔ POV)
            if(e.key === 'f' || e.key === 'F') {
                if(this._followTarget){
                    this._spectatorCamMode = this._spectatorCamMode === 'pov' ? 'free' : 'pov';
                    this._updateSpectatorUI();
                }
            }
        };
        this._specKeyUp = e => { this.keys[e.key] = false; };
        // 캔버스 클릭 → 학생 POV 진입
        this._specClick = e => {
            const cvs = this.cvs;
            if(!cvs) return;
            const rect = cvs.getBoundingClientRect();
            const z = this.gameZoom || 1;
            const dpr = this.dpr || 1;
            const mx = (e.clientX - rect.left) / (rect.width / (cvs.width / dpr)) / z + this.camera.x;
            const my = (e.clientY - rect.top) / (rect.height / (cvs.height / dpr)) / z + this.camera.y;
            let best = null, bestDist = 50;
            for(const n of this.npcs){
                if(n._spectatorDummy || n.enteredDoor) continue;
                const d = Math.hypot(n.x - mx, n.y - my);
                if(d < bestDist){ bestDist = d; best = n; }
            }
            if(best) this._setSpectatorMode('pov', best);
        };
        window.addEventListener('keydown', this._specKeyDown);
        window.addEventListener('keyup', this._specKeyUp);
        if(this.cvs) this.cvs.addEventListener('click', this._specClick);
        this._showStudentList();
    },

    _setSpectatorMode(mode, target){
        if(mode === 'free'){
            this._spectatorCamMode = 'free';
            this._followTarget = null;
        } else {
            this._spectatorCamMode = 'pov';
            this._followTarget = target;
        }
        this._updateSpectatorUI();
    },

    _cycleFollowTarget(dir){
        const alive = this.npcs.filter(n => !n._spectatorDummy && !n.enteredDoor);
        if(!alive.length) return;
        if(!this._followTarget){
            this._followTarget = dir > 0 ? alive[0] : alive[alive.length-1];
        } else {
            const idx = alive.indexOf(this._followTarget);
            const next = (idx + dir + alive.length) % alive.length;
            this._followTarget = alive[next];
        }
        this._spectatorCamMode = 'pov';
        this._updateSpectatorUI();
    },

    _showStudentList(){
        let panel = document.getElementById('spectator-student-list');
        if(!panel){
            panel = document.createElement('div');
            panel.id = 'spectator-student-list';
            panel.className = 'spectator-student-list';
            document.getElementById('game').appendChild(panel);
        }
        panel.classList.remove('hidden');
        this._updateStudentList();
    },

    _updateSpectatorUI(){
        this._updateSpectatorBadge();
        this._updateStudentList();
    },

    _updateStudentList(){
        const panel = document.getElementById('spectator-student-list');
        if(!panel) return;
        const alive = this.npcs.filter(n => !n._spectatorDummy);
        const isFree = this._spectatorCamMode === 'free';
        const html = [`<div class="ssl-header">📺 관전 모드</div>`];
        html.push(`<div class="ssl-item ssl-mode${isFree ? ' ssl-active' : ''}" data-idx="-1">🌐 전지적 시점</div>`);
        html.push(`<div class="ssl-divider"></div>`);
        html.push(`<div class="ssl-sub">👥 학생 (${alive.length}명) — 클릭: POV</div>`);
        alive.forEach((n, i) => {
            const name = n.displayName || n.name || `학생${i+1}`;
            const active = this._followTarget === n;
            const status = n.enteredDoor ? '🚪' : n.dead ? '💀' : '🟢';
            html.push(`<div class="ssl-item${active ? ' ssl-active' : ''}" data-idx="${i}">${status} ${name}</div>`);
        });
        panel.innerHTML = html.join('');
        panel.querySelectorAll('.ssl-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                if(idx < 0) this._setSpectatorMode('free', null);
                else this._setSpectatorMode('pov', alive[idx] || null);
            });
        });
    },

    _updateSpectatorBadge(){
        const badge = document.getElementById('spectator-badge');
        if(!badge) return;
        if(this._spectatorCamMode === 'pov' && this._followTarget){
            const name = this._followTarget.displayName || this._followTarget.name || '학생';
            badge.textContent = `👁️ ${name} 시점 · ESC: 전지적 시점 · Tab: 다음 학생 · F: 모드 전환`;
        } else {
            badge.textContent = '🌐 전지적 시점 · 방향키: 카메라 · 클릭/Tab: 학생 시점 · +/-: 줌';
        }
    },
};
