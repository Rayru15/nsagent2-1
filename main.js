// ==========================================
// 우당탕탕 사무실 런 - 본부대항전
// ==========================================

const GRAVITY = 0.9;
const JUMP_POWER = -17;          // 1단점프 (높)
const DOUBLE_JUMP_POWER = -13;   // 2단점프 (추가 부스트)
const GROUND_PAD = 22;
const BASE_SPEED = 7;
const MAX_SPEED = 14;
const SPEED_RAMP = 0.0008;       // 원래 곡선
const OBSTACLE_MIN_GAP = 360;
const OBSTACLE_MAX_GAP = 720;
const BG_TILE = 400;
const CEILING_PAD = 40;          // 위쪽 여유 — 공중 장애물 통과용

const STATE = {
    READY: 'ready',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    FINISHING: 'finishing',
    FINISHED: 'finished',
};

const PLAYER_PRESETS = {
    p1: {
        // 팀장님 — 사무실 사무용품 테마
        shirt: '#ffffff',
        suit: '#1f2937',
        tie: '#2980b9',
        wall: '#fafbfc',
        floor: '#e2e6ea',
        prop: '#e1e5ea',
        propShade: '#cdd3d8',
        cabinet: '#c8cdd2',
        windowSky: '#cfe6f5',
        loseLabel: '야근 확정',
        loseEmoji: '💻',
        winLabel: '칼퇴 확정',
        winEmoji: '🏃‍♂️',
        teamLabel: '팀장님 (1P)',
        // P1 장애물 세트
        obstacleSet: 'office',
    },
    p2: {
        // 사원 — 회의실 가구 테마
        shirt: '#ffffff',
        suit: '#1f2937',
        tie: '#c0392b',
        wall: '#f0f2f4',
        floor: '#cdd3d8',
        prop: '#d8dde2',
        propShade: '#bcc2c8',
        cabinet: '#b8bec5',
        windowSky: '#cfe6f5',
        loseLabel: '야근 확정',
        loseEmoji: '💻',
        winLabel: '칼퇴 확정',
        winEmoji: '🏃‍♂️',
        teamLabel: '사원 (2P)',
        // P2 장애물 세트
        obstacleSet: 'meeting',
    },
};

// ------------------------------------------
// 플레이어
// ------------------------------------------
class Player {
    constructor(canvas, preset) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.preset = preset;
        this.reset();
    }

    reset() {
        this.width = 42;
        this.height = 64;
        this.x = 90;
        this.y = this.groundY() - this.height;
        this.vy = 0;
        this.onGround = true;
        this.jumpCount = 0;
        this.alive = true;
        this.distance = 0;
        this.speed = BASE_SPEED;
        this.obstacles = [];
        this.bgOffset = 0;
        this.runFrame = 0;
        this.frame = 0;
        this.particles = [];
        this.celebParticles = [];
        this.deathFlash = 0;
        this.jumpFlash = 0;
        this.dustTimer = 0;
        this.nextObstacleAt = 380;
        this.resultText = '';
        this.resultIsWin = false;
    }

    groundY() {
        return this.canvas.height - GROUND_PAD;
    }

    jump() {
        if (!this.alive) return;
        if (this.jumpCount < 2) {
            this.jumpCount++;
            this.vy = (this.jumpCount === 1) ? JUMP_POWER : DOUBLE_JUMP_POWER;
            this.onGround = false;
            this.jumpFlash = 280;
            this.spawnJumpBurst(this.jumpCount === 2);
        }
    }

    spawnJumpBurst(isDouble) {
        const cx = this.x + this.width / 2;
        const cy = isDouble ? this.y + this.height / 2 : this.groundY();
        const count = isDouble ? 14 : 8;
        const color = isDouble ? '#f1c40f' : '#ffffff';
        for (let i = 0; i < count; i++) {
            const angle = isDouble
                ? (Math.PI * 2 * i) / count
                : Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
            const speed = isDouble ? 3 + Math.random() * 2 : 2 + Math.random() * 2;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (isDouble ? 0 : 1),
                life: 500, maxLife: 500,
                size: 3 + Math.random() * 3,
                color,
                gravity: isDouble ? 0.1 : 0.25,
            });
        }
    }

    spawnDust() {
        this.particles.push({
            x: this.x + this.width / 2 + (Math.random() - 0.5) * 6,
            y: this.groundY() - 2,
            vx: -this.speed * 0.4 - Math.random() * 1.5,
            vy: -Math.random() * 1.2,
            life: 320, maxLife: 320,
            size: 2 + Math.random() * 3,
            color: 'rgba(120, 120, 120, 0.7)',
            gravity: 0.05,
        });
    }

    spawnDeathBurst() {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        for (let i = 0; i < 22; i++) {
            const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
            const speed = 3 + Math.random() * 4;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 700, maxLife: 700,
                size: 4 + Math.random() * 4,
                color: i % 2 === 0 ? '#e74c3c' : '#f1c40f',
                gravity: 0.2,
            });
        }
    }

    spawnCelebration() {
        // 우승 색종이
        const w = this.canvas.width;
        for (let i = 0; i < 60; i++) {
            const hue = Math.random() * 360;
            this.celebParticles.push({
                x: Math.random() * w,
                y: -10 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 3,
                vy: 1 + Math.random() * 2,
                life: 3000, maxLife: 3000,
                size: 4 + Math.random() * 4,
                color: `hsl(${hue}, 85%, 60%)`,
                gravity: 0.04,
                spin: Math.random() * Math.PI * 2,
                spinSpeed: (Math.random() - 0.5) * 0.2,
            });
        }
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.deathFlash = 400;
        this.resultText = this.preset.loseLabel;
        this.spawnDeathBurst();
    }

    win() {
        this.resultIsWin = true;
        this.resultText = this.preset.winLabel;
        this.spawnCelebration();
    }

    update(dt) {
        this.updateParticles(dt);
        this.updateCelebration(dt);

        if (!this.alive) {
            this.deathFlash = Math.max(0, this.deathFlash - dt);
            // 죽어도 장애물은 마저 흘러감 (시각 효과)
            for (const obs of this.obstacles) obs.x -= this.speed * 0.3;
            this.bgOffset -= this.speed * 0.2;
            return;
        }

        if (this.resultIsWin) {
            // 칼퇴 - 계속 달리되 장애물 안 나오게
            this.distance += this.speed * (dt / 16);
            this.bgOffset = (this.bgOffset - this.speed * 0.5) % BG_TILE;
            this.runFrame += this.speed * 0.05;
            return;
        }

        this.frame++;
        // 속도 점진 증가 (원래 곡선)
        if (this.speed < MAX_SPEED) this.speed += SPEED_RAMP * dt;
        this.jumpFlash = Math.max(0, this.jumpFlash - dt);

        // 물리
        const wasInAir = !this.onGround;
        this.vy += GRAVITY;
        this.y += this.vy;

        const gy = this.groundY();
        if (this.y + this.height >= gy) {
            this.y = gy - this.height;
            this.vy = 0;
            this.onGround = true;
            this.jumpCount = 0;
            if (wasInAir) {
                for (let i = 0; i < 6; i++) this.spawnDust();
            }
        }

        if (this.onGround) {
            this.dustTimer -= dt;
            if (this.dustTimer <= 0) {
                this.spawnDust();
                this.dustTimer = 80;
            }
        }

        // 스크롤
        this.distance += this.speed;
        this.bgOffset = (this.bgOffset - this.speed * 0.5) % BG_TILE;
        this.runFrame += this.speed * 0.05;

        // 장애물 스폰 (거리 기반, 최소~최대 갭 사이)
        if (this.distance > this.nextObstacleAt) {
            this.spawnObstacle();
            const gap = OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP);
            this.nextObstacleAt = this.distance + gap;
        }

        // 장애물 이동 + 충돌
        for (const obs of this.obstacles) {
            obs.x -= this.speed;
            if (obs.bobBase != null) {
                obs.bobPhase += 0.08;
                obs.y = obs.bobBase + Math.sin(obs.bobPhase) * 5;
            }
            if (this.checkCollision(obs)) this.die();
        }
        this.obstacles = this.obstacles.filter(o => o.x + o.width > -30);
    }

    spawnObstacle() {
        // 난이도 동일, 외형만 P1/P2 다르게
        // 50% low(1단점프), 30% high(2단점프 필수), 20% air(점프하면 안 됨)
        const r = Math.random();
        const gy = this.groundY();
        const set = this.preset.obstacleSet;

        if (r < 0.5) {
            // 낮은 장애물 — 1단점프로 통과
            const variant = set === 'office' ? 'box' : 'chair';
            this.obstacles.push({
                type: 'low', variant,
                x: this.canvas.width,
                y: gy - 38, width: 36, height: 38,
            });
        } else if (r < 0.8) {
            // 높은 장애물 — 반드시 2단점프
            const variant = set === 'office' ? 'cabinet' : 'whiteboard';
            this.obstacles.push({
                type: 'high', variant,
                x: this.canvas.width,
                y: gy - 105, width: 46, height: 105,
            });
        } else {
            // 공중 장애물 — 점프하면 부딪힘 (서서 달려야 통과)
            const variant = set === 'office' ? 'fan' : 'projector';
            const obsHeight = 32;
            // 캐릭터 머리(gy - 64) 위 ~24px 지점에 하단이 오도록
            const obsY = gy - 64 - 24 - obsHeight;
            this.obstacles.push({
                type: 'air', variant,
                x: this.canvas.width,
                y: obsY, bobBase: obsY,
                width: 60, height: obsHeight,
                bobPhase: Math.random() * Math.PI * 2,
            });
        }
    }

    checkCollision(obs) {
        const pad = 5;
        return this.x + pad < obs.x + obs.width &&
            this.x + this.width - pad > obs.x &&
            this.y < obs.y + obs.height &&
            this.y + this.height > obs.y;
    }

    updateParticles(dt) {
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);
    }

    updateCelebration(dt) {
        const h = this.canvas.height;
        for (const p of this.celebParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.spin += p.spinSpeed;
            p.life -= dt;
            if (p.y > h + 20) p.life = 0;
        }
        this.celebParticles = this.celebParticles.filter(p => p.life > 0);
    }

    // -------- 그리기 --------
    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const gy = this.groundY();

        ctx.clearRect(0, 0, w, h);

        // 사무실 배경
        this.drawOfficeBackground(ctx, w, h, gy);

        // 입자 (장애물 뒤)
        this.drawParticles(ctx);

        // 장애물
        for (const obs of this.obstacles) {
            this.drawObstacle(ctx, obs);
        }

        // 플레이어
        this.drawPlayer(ctx, gy);

        // 점프 링
        if (this.jumpFlash > 0 && this.alive) {
            const a = this.jumpFlash / 280;
            ctx.strokeStyle = `rgba(241, 196, 15, ${a})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, gy,
                (1 - a) * 48 + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 우승 색종이 (제일 위)
        this.drawCelebration(ctx);

        // 사망 플래시
        if (!this.alive && this.deathFlash > 0) {
            ctx.fillStyle = `rgba(231, 76, 60, ${this.deathFlash / 1000})`;
            ctx.fillRect(0, 0, w, h);
        }

        // 결과 텍스트 (게임 종료 후)
        if (this.resultText) {
            this.drawResultBanner(ctx, w, h);
        }
    }

    drawOfficeBackground(ctx, w, h, gy) {
        const p = this.preset;

        // 벽
        ctx.fillStyle = p.wall;
        ctx.fillRect(0, 0, w, gy);

        // 바닥
        ctx.fillStyle = p.floor;
        ctx.fillRect(0, gy, w, h - gy);

        // 바닥 위 강조선
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, gy, w, 2);

        // 스크롤되는 소품들 (BG_TILE 단위로 반복)
        ctx.save();
        ctx.translate(this.bgOffset, 0);

        const tilesNeeded = Math.ceil(w / BG_TILE) + 2;
        for (let i = -1; i < tilesNeeded; i++) {
            const startX = i * BG_TILE;
            this.drawOfficeProps(ctx, startX, gy, p);
        }

        ctx.restore();

        // 천장 형광등
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(0, 0, w, 6);
        const lightOffset = ((this.bgOffset * 1.2) % 200 + 200) % 200;
        ctx.fillStyle = '#f1c40f';
        for (let i = -1; i < Math.ceil(w / 200) + 1; i++) {
            ctx.fillRect(i * 200 - lightOffset + 40, 0, 80, 4);
        }
    }

    drawOfficeProps(ctx, startX, gy, p) {
        // 배경 소품은 의도적으로 연하게 — 장애물/캐릭터가 부각되도록
        ctx.globalAlpha = 0.55;

        // 책상
        ctx.fillStyle = p.prop;
        ctx.fillRect(startX + 50, gy - 50, 110, 50);
        ctx.fillStyle = p.propShade;
        ctx.fillRect(startX + 50, gy - 50, 110, 3);
        // 책상 다리
        ctx.fillStyle = p.propShade;
        ctx.fillRect(startX + 54, gy - 10, 6, 10);
        ctx.fillRect(startX + 150, gy - 10, 6, 10);
        // 모니터 (옅은 회색 톤)
        ctx.fillStyle = '#9aa4ad';
        ctx.fillRect(startX + 80, gy - 90, 50, 38);
        ctx.fillStyle = '#cfe6f5';
        ctx.fillRect(startX + 84, gy - 86, 42, 30);
        ctx.fillStyle = '#9aa4ad';
        ctx.fillRect(startX + 100, gy - 52, 10, 6);
        ctx.fillRect(startX + 90, gy - 46, 30, 4);

        // 파티션
        ctx.fillStyle = p.prop;
        ctx.fillRect(startX + 180, 30, 8, gy - 30);
        ctx.fillStyle = p.propShade;
        ctx.fillRect(startX + 180, 30, 8, 2);

        // 창문 (옅은 하늘색)
        ctx.fillStyle = p.windowSky;
        ctx.fillRect(startX + 220, 40, 90, 90);
        // 창밖 빌딩 실루엣
        ctx.fillStyle = 'rgba(100, 116, 130, 0.3)';
        ctx.fillRect(startX + 230, 80, 18, 50);
        ctx.fillRect(startX + 252, 65, 22, 65);
        ctx.fillRect(startX + 278, 90, 20, 40);
        // 창틀
        ctx.fillStyle = '#eef0f3';
        ctx.fillRect(startX + 215, 35, 5, 100);
        ctx.fillRect(startX + 310, 35, 5, 100);
        ctx.fillRect(startX + 215, 35, 100, 5);
        ctx.fillRect(startX + 215, 130, 100, 5);
        ctx.fillRect(startX + 262, 35, 4, 100);

        // 캐비닛
        ctx.fillStyle = p.cabinet;
        ctx.fillRect(startX + 340, gy - 75, 52, 75);
        ctx.fillStyle = p.propShade;
        ctx.fillRect(startX + 346, gy - 70, 40, 5);
        ctx.fillRect(startX + 346, gy - 50, 40, 5);
        ctx.fillRect(startX + 346, gy - 30, 40, 5);

        ctx.globalAlpha = 1;
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawCelebration(ctx) {
        for (const p of this.celebParticles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.spin);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
            ctx.restore();
        }
    }

    drawObstacle(ctx, obs) {
        // 드롭 섀도우
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(obs.x + 4, obs.y + 5, obs.width, obs.height);

        // 위협 글로우 (low=빨강, high=주황, air=보라)
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        let glowColor;
        if (obs.type === 'low') glowColor = '231, 76, 60';
        else if (obs.type === 'high') glowColor = '230, 126, 34';
        else glowColor = '155, 89, 182';
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, obs.width * 1.4);
        glow.addColorStop(0, `rgba(${glowColor}, 0.5)`);
        glow.addColorStop(1, `rgba(${glowColor}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(obs.x - obs.width, obs.y - obs.width,
            obs.width * 3, obs.height + obs.width * 2);

        ctx.strokeStyle = '#0f1419';
        ctx.lineWidth = 3;

        const v = obs.variant;
        if (v === 'box') this.drawBox(ctx, obs);
        else if (v === 'chair') this.drawChair(ctx, obs);
        else if (v === 'cabinet') this.drawCabinet(ctx, obs);
        else if (v === 'whiteboard') this.drawWhiteboard(ctx, obs);
        else if (v === 'fan') this.drawFan(ctx, obs);
        else if (v === 'projector') this.drawProjector(ctx, obs);

        // 공중 장애물에 "JUMP 금지" 표시 (위쪽에 X 마크)
        if (obs.type === 'air') {
            ctx.fillStyle = '#9b59b6';
            ctx.fillRect(cx - 11, obs.y - 14, 22, 12);
            ctx.strokeStyle = '#0f1419';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(cx - 11, obs.y - 14, 22, 12);
            // X
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - 6, obs.y - 11);
            ctx.lineTo(cx + 6, obs.y - 5);
            ctx.moveTo(cx + 6, obs.y - 11);
            ctx.lineTo(cx - 6, obs.y - 5);
            ctx.stroke();
        }

        // 높은 장애물에 "↑↑" (2단점프) 표시
        if (obs.type === 'high') {
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(cx - 10, obs.y - 14, 20, 12);
            ctx.strokeStyle = '#0f1419';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(cx - 10, obs.y - 14, 20, 12);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Segoe UI';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('↑↑', cx, obs.y - 7);
            ctx.textBaseline = 'alphabetic';
        }
    }

    // -------- 장애물 종류별 그리기 --------
    drawBox(ctx, obs) {
        // P1 낮음 — 종이박스
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = '#c97a4a';
        ctx.fillRect(obs.x, obs.y, obs.width, 6);
        ctx.strokeRect(obs.x, obs.y, obs.width, 6);
        // 테이프 십자
        ctx.fillStyle = '#f5deb3';
        ctx.fillRect(obs.x, obs.y + obs.height / 2 - 4, obs.width, 8);
        ctx.strokeStyle = '#7c4a1f';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obs.x, obs.y + obs.height / 2 - 4, obs.width, 8);
        ctx.fillStyle = '#f5deb3';
        ctx.fillRect(obs.x + obs.width / 2 - 4, obs.y, 8, obs.height);
        ctx.strokeRect(obs.x + obs.width / 2 - 4, obs.y, 8, obs.height);
        // 빨간 ! 라벨
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(obs.x + obs.width / 2 - 7, obs.y + 12, 14, 12);
        ctx.strokeStyle = '#0f1419';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x + obs.width / 2 - 7, obs.y + 12, 14, 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(obs.x + obs.width / 2 - 1, obs.y + 14, 2, 6);
        ctx.fillRect(obs.x + obs.width / 2 - 1, obs.y + 21, 2, 2);
    }

    drawChair(ctx, obs) {
        // P2 낮음 — 회의실 의자 (뒤집힌)
        // 다리들
        ctx.fillStyle = '#34495e';
        ctx.fillRect(obs.x + 4, obs.y + obs.height - 18, 5, 18);
        ctx.fillRect(obs.x + obs.width - 9, obs.y + obs.height - 18, 5, 18);
        ctx.fillRect(obs.x + obs.width / 2 - 2, obs.y + obs.height - 22, 4, 22);
        ctx.strokeRect(obs.x + 4, obs.y + obs.height - 18, 5, 18);
        ctx.strokeRect(obs.x + obs.width - 9, obs.y + obs.height - 18, 5, 18);
        ctx.strokeRect(obs.x + obs.width / 2 - 2, obs.y + obs.height - 22, 4, 22);
        // 좌석
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(obs.x, obs.y, obs.width, 14);
        ctx.strokeRect(obs.x, obs.y, obs.width, 14);
        // 등받이
        ctx.fillStyle = '#a93226';
        ctx.fillRect(obs.x + 6, obs.y + 14, obs.width - 12, 14);
        ctx.strokeRect(obs.x + 6, obs.y + 14, obs.width - 12, 14);
        // 좌석 광택
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(obs.x + 3, obs.y + 3, obs.width - 6, 3);
    }

    drawCabinet(ctx, obs) {
        // P1 높음 — 캐비닛 (서랍장)
        ctx.fillStyle = '#1f3a5f';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(obs.x + 3, obs.y + 3, 4, obs.height - 6);
        // 서랍 3단
        const drawerCount = 3;
        const drawerH = (obs.height - 10) / drawerCount;
        for (let i = 0; i < drawerCount; i++) {
            const dy = obs.y + 5 + i * drawerH;
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(obs.x + 5, dy, obs.width - 10, drawerH - 3);
            ctx.strokeStyle = '#0f1419';
            ctx.lineWidth = 2;
            ctx.strokeRect(obs.x + 5, dy, obs.width - 10, drawerH - 3);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(obs.x + obs.width / 2 - 7, dy + drawerH / 2 - 3, 14, 4);
            ctx.strokeRect(obs.x + obs.width / 2 - 7, dy + drawerH / 2 - 3, 14, 4);
        }
    }

    drawWhiteboard(ctx, obs) {
        // P2 높음 — 화이트보드 (이동식 스탠드)
        // 다리 (X자)
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(obs.x + 4, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width - 4, obs.y + obs.height - 16);
        ctx.moveTo(obs.x + obs.width - 4, obs.y + obs.height);
        ctx.lineTo(obs.x + 4, obs.y + obs.height - 16);
        ctx.stroke();
        // 보드 본체
        const boardH = obs.height - 20;
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(obs.x, obs.y, obs.width, boardH);
        ctx.strokeStyle = '#0f1419';
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, obs.y, obs.width, boardH);
        // 프레임
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 4;
        ctx.strokeRect(obs.x + 2, obs.y + 2, obs.width - 4, boardH - 4);
        // 그래프/글씨
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + 6, obs.y + 30);
        ctx.lineTo(obs.x + 16, obs.y + 18);
        ctx.lineTo(obs.x + 26, obs.y + 25);
        ctx.lineTo(obs.x + 38, obs.y + 12);
        ctx.stroke();
        // 파란 줄
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + 6, obs.y + 50);
        ctx.lineTo(obs.x + obs.width - 6, obs.y + 60);
        ctx.stroke();
    }

    drawFan(ctx, obs) {
        // P1 공중 — 천장 선풍기 (점프 금지)
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        // 천장에서 내려오는 줄
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, obs.y);
        ctx.stroke();
        // 모터 본체
        ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f1419';
        ctx.lineWidth = 2;
        ctx.stroke();
        // 회전하는 날개 (4장, 빠르게 회전)
        const spin = this.runFrame * 3;
        ctx.fillStyle = 'rgba(52, 73, 94, 0.85)';
        ctx.strokeStyle = '#0f1419';
        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(spin + (Math.PI / 2) * i);
            ctx.beginPath();
            ctx.ellipse(obs.width / 2 - 8, 0, obs.width / 2 - 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        // 회전 모션 블러
        ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, obs.width / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawProjector(ctx, obs) {
        // P2 공중 — 천장 프로젝터 (점프 금지)
        const cx = obs.x + obs.width / 2;
        // 천장 마운트
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(cx - 3, 0, 6, obs.y);
        // 본체
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(obs.x + 4, obs.y, obs.width - 8, obs.height);
        ctx.strokeStyle = '#0f1419';
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x + 4, obs.y, obs.width - 8, obs.height);
        // 렌즈
        ctx.fillStyle = '#1a252f';
        ctx.beginPath();
        ctx.arc(obs.x + obs.width - 14, obs.y + obs.height / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5dade2';
        ctx.beginPath();
        ctx.arc(obs.x + obs.width - 14, obs.y + obs.height / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        // 빔
        const gradient = ctx.createLinearGradient(obs.x + obs.width, obs.y, obs.x + obs.width + 30, obs.y + 40);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.55)');
        gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width - 8, obs.y + obs.height / 2);
        ctx.lineTo(obs.x + obs.width + 30, obs.y - 4);
        ctx.lineTo(obs.x + obs.width + 30, obs.y + obs.height + 4);
        ctx.closePath();
        ctx.fill();
        // 작동 LED
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(obs.x + 8, obs.y + 4, 4, 4);
    }

    drawPlayer(ctx, gy) {
        const x = this.x;
        const y = this.y;
        const w = this.width;
        const h = this.height;
        const p = this.preset;

        // 그림자
        const shadowAlpha = Math.max(0, 1 - (gy - (y + h)) / 200);
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha * 0.45})`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, gy + 4, w / 1.8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 캐릭터 글로우 (배경에서 부각)
        const glow = ctx.createRadialGradient(
            x + w / 2, y + h / 2, 0,
            x + w / 2, y + h / 2, w * 1.4
        );
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - w, y - h / 2, w * 3, h * 2);

        ctx.strokeStyle = '#0f1419';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';

        // 셔츠 (상체)
        const shirtH = h * 0.55;
        ctx.fillStyle = p.shirt;
        ctx.fillRect(x, y, w, shirtH);
        ctx.strokeRect(x, y, w, shirtH);

        // 바지 (하체)
        ctx.fillStyle = p.suit;
        ctx.fillRect(x, y + shirtH, w, h - shirtH);
        ctx.strokeRect(x, y + shirtH, w, h - shirtH);

        // 넥타이 (점프 시 휘날림)
        ctx.fillStyle = p.tie;
        const tieSwingX = !this.onGround ? -this.vy * 0.6 : 0;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 4, y + 4);
        ctx.lineTo(x + w / 2 + 4, y + 4);
        ctx.lineTo(x + w / 2 + 6 + tieSwingX, y + shirtH - 6);
        ctx.lineTo(x + w / 2 - 6 + tieSwingX, y + shirtH - 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 넥타이 매듭
        ctx.fillStyle = p.tie;
        ctx.fillRect(x + w / 2 - 5, y - 2, 10, 6);
        ctx.strokeRect(x + w / 2 - 5, y - 2, 10, 6);

        // 머리 (셔츠 위)
        const headW = 26;
        const headH = 22;
        const headX = x + (w - headW) / 2;
        const headY = y - headH;
        ctx.fillStyle = '#ffe0b2';
        ctx.fillRect(headX, headY, headW, headH);
        ctx.strokeRect(headX, headY, headW, headH);

        // 머리카락
        ctx.fillStyle = '#3c2414';
        ctx.fillRect(headX - 1, headY - 4, headW + 2, 8);
        ctx.strokeRect(headX - 1, headY - 4, headW + 2, 8);

        // 눈
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(headX + 6, headY + 9, 4, 4);
        ctx.fillRect(headX + headW - 10, headY + 9, 4, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(headX + 7, headY + 10, 1.5, 1.5);
        ctx.fillRect(headX + headW - 9, headY + 10, 1.5, 1.5);

        // 입 (긴장하면 살짝 벌어짐)
        ctx.strokeStyle = '#1a252f';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        if (this.onGround) {
            ctx.moveTo(headX + headW / 2 - 3, headY + 17);
            ctx.lineTo(headX + headW / 2 + 3, headY + 17);
        } else {
            ctx.arc(headX + headW / 2, headY + 17, 2, 0, Math.PI);
        }
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1a252f';

        // 팔 (달리기 스윙)
        const armSwing = this.onGround ? Math.sin(this.runFrame) * 7 : -5;
        ctx.fillStyle = p.shirt;
        // 뒤쪽 팔
        ctx.fillRect(x - 6, y + 12 + armSwing, 8, shirtH - 14);
        ctx.strokeRect(x - 6, y + 12 + armSwing, 8, shirtH - 14);
        // 앞쪽 팔
        ctx.fillRect(x + w - 2, y + 12 - armSwing, 8, shirtH - 14);
        ctx.strokeRect(x + w - 2, y + 12 - armSwing, 8, shirtH - 14);
        // 손
        ctx.fillStyle = '#ffe0b2';
        ctx.fillRect(x - 6, y + 12 + armSwing + shirtH - 14, 8, 6);
        ctx.fillRect(x + w - 2, y + 12 - armSwing + shirtH - 14, 8, 6);

        // 다리 / 신발
        if (this.onGround) {
            const legPhase = Math.sin(this.runFrame);
            const legOffset1 = legPhase * 6;
            const legOffset2 = -legPhase * 6;
            // 신발
            ctx.fillStyle = '#1a252f';
            ctx.fillRect(x + 2 + legOffset1, y + h - 4, 16, 6);
            ctx.fillRect(x + w - 18 + legOffset2, y + h - 4, 16, 6);
            ctx.strokeRect(x + 2 + legOffset1, y + h - 4, 16, 6);
            ctx.strokeRect(x + w - 18 + legOffset2, y + h - 4, 16, 6);
        } else {
            // 점프 자세 (다리 모음)
            ctx.fillStyle = '#1a252f';
            ctx.fillRect(x + 4, y + h - 4, 14, 6);
            ctx.fillRect(x + w - 18, y + h - 4, 14, 6);
            ctx.strokeRect(x + 4, y + h - 4, 14, 6);
            ctx.strokeRect(x + w - 18, y + h - 4, 14, 6);
        }

        // 2단점프 글로우 링
        if (this.jumpCount === 2 && !this.onGround) {
            ctx.save();
            const t = Math.sin(this.runFrame * 0.6) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(241, 196, 15, ${t})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h, 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(241, 196, 15, ${t * 0.5})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    drawResultBanner(ctx, w, h) {
        const isWin = this.resultIsWin;
        const color = isWin ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)';
        const textColor = isWin ? '#2ecc71' : '#e74c3c';
        const emoji = isWin ? this.preset.winEmoji : this.preset.loseEmoji;

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(26, 37, 47, 0.6)';
        ctx.fillRect(0, h / 2 - 50, w, 100);

        ctx.fillStyle = textColor;
        ctx.font = 'bold 52px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${emoji} ${this.resultText}`, w / 2, h / 2);
        ctx.textBaseline = 'alphabetic';
    }
}

// ------------------------------------------
// 게임 매니저
// ------------------------------------------
class Game {
    constructor() {
        this.canvas1 = document.getElementById('canvas1');
        this.canvas2 = document.getElementById('canvas2');
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());

        this.player1 = new Player(this.canvas1, PLAYER_PRESETS.p1);
        this.player2 = new Player(this.canvas2, PLAYER_PRESETS.p2);

        this.score1El = document.getElementById('score1');
        this.score2El = document.getElementById('score2');
        this.speedEl = document.getElementById('speed-display');
        this.overlay = document.getElementById('overlay');
        this.startOverlay = document.getElementById('start-overlay');
        this.resultText = document.getElementById('result-text');
        this.resultDetail = document.getElementById('result-detail');
        this.countdownEl = document.getElementById('countdown');
        this.restartBtn = document.getElementById('restart-btn');
        this.startBtn = document.getElementById('start-btn');

        this.state = STATE.READY;
        this.lastTime = 0;

        this.bindInputs();
        requestAnimationFrame(t => this.loop(t));
    }

    resizeCanvases() {
        for (const c of [this.canvas1, this.canvas2]) {
            const rect = c.getBoundingClientRect();
            c.width = rect.width;
            c.height = rect.height;
        }
    }

    bindInputs() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;

            if (this.state === STATE.PLAYING) {
                if (e.code === 'KeyW') {
                    this.player1.jump();
                }
                if (e.code === 'ArrowUp') {
                    this.player2.jump();
                    e.preventDefault();
                }
            }

            if (this.state === STATE.FINISHED && (e.code === 'Space' || e.key === ' ')) {
                this.restart();
                e.preventDefault();
            }
        });

        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restart());
    }

    startGame() {
        this.startOverlay.classList.add('hidden');
        this.startCountdown();
    }

    startCountdown() {
        this.state = STATE.COUNTDOWN;
        this.countdownEl.classList.remove('hidden');
        let n = 3;
        this.countdownEl.textContent = n;
        const tick = () => {
            n--;
            if (n > 0) {
                this.countdownEl.textContent = n;
                setTimeout(tick, 800);
            } else if (n === 0) {
                this.countdownEl.textContent = 'GO!';
                this.state = STATE.PLAYING;
                this.speedEl.textContent = '🏃 출발! 칼퇴를 향해!';
                setTimeout(() => {
                    this.countdownEl.classList.add('hidden');
                }, 600);
            }
        };
        setTimeout(tick, 800);
    }

    restart() {
        this.player1.reset();
        this.player2.reset();
        this.overlay.classList.add('hidden');
        this.startCountdown();
    }

    update(dt) {
        if (this.state !== STATE.PLAYING) return;

        this.player1.update(dt);
        this.player2.update(dt);

        this.score1El.textContent = Math.floor(this.player1.distance / 10) + ' m';
        this.score2El.textContent = Math.floor(this.player2.distance / 10) + ' m';

        // 속도 표시
        const avgSpeed = (this.player1.speed + this.player2.speed) / 2;
        const pct = Math.floor((avgSpeed / BASE_SPEED) * 100);
        this.speedEl.textContent = `🏃 현재 속도: ${pct}%`;

        // 승부 판정
        if (!this.player1.alive && !this.player2.resultIsWin) {
            this.player2.win();
            this.state = STATE.FINISHING;
            setTimeout(() => this.finishGame('p2'), 1600);
        } else if (!this.player2.alive && !this.player1.resultIsWin) {
            this.player1.win();
            this.state = STATE.FINISHING;
            setTimeout(() => this.finishGame('p1'), 1600);
        }
    }

    finishGame(winnerKey) {
        if (this.state === STATE.FINISHED) return;
        this.state = STATE.FINISHED;

        const d1 = Math.floor(this.player1.distance / 10);
        const d2 = Math.floor(this.player2.distance / 10);

        let title, detail;
        if (winnerKey === 'p1') {
            title = '🏆 팀장님 칼퇴 성공!';
            detail = `사원(2P)은 야근 확정 — 기록: 팀장 ${d1}m / 사원 ${d2}m`;
        } else {
            title = '🏆 사원 칼퇴 성공!';
            detail = `팀장(1P)은 야근 확정 — 기록: 팀장 ${d1}m / 사원 ${d2}m`;
        }

        this.resultText.textContent = title;
        this.resultDetail.textContent = detail;
        this.overlay.classList.remove('hidden');
        this.speedEl.textContent = '🏁 경기 종료';
    }

    draw() {
        this.player1.draw();
        this.player2.draw();
    }

    loop(t) {
        const dt = Math.min(48, t - this.lastTime || 16);
        this.lastTime = t;
        if (this.state === STATE.PLAYING) {
            this.update(dt);
        } else if (this.state === STATE.FINISHING || this.state === STATE.FINISHED) {
            // 우승자 칼퇴 애니메이션 + 색종이 계속 흐름
            this.player1.update(dt);
            this.player2.update(dt);
        }
        this.draw();
        requestAnimationFrame(t2 => this.loop(t2));
    }
}

window.addEventListener('load', () => {
    new Game();
});
