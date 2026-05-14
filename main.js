// ==========================================
// 본부대항전 2인용 달리기 게임
// ==========================================

const GRAVITY = 0.9;
const JUMP_POWER = -16;
const GROUND_Y_RATIO = 0.82;
const BASE_SPEED = 7;
const SPEED_RAMP = 0.0008;
const OBSTACLE_MIN_GAP = 320;
const OBSTACLE_MAX_GAP = 700;

const STATE = {
    READY: 'ready',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    FINISHED: 'finished',
};

// ------------------------------------------
// 플레이어 클래스
// ------------------------------------------
class Player {
    constructor(canvas, color, accentColor, name) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.color = color;
        this.accentColor = accentColor;
        this.name = name;
        this.reset();
    }

    reset() {
        const groundY = this.canvas.height * GROUND_Y_RATIO;
        this.x = 120;
        this.y = groundY;
        this.vy = 0;
        this.width = 44;
        this.height = 60;
        this.onGround = true;
        this.jumpsUsed = 0;
        this.alive = true;
        this.distance = 0;
        this.speed = BASE_SPEED;
        this.obstacles = [];
        this.bgOffset = 0;
        this.cloudOffset = 0;
        this.runFrame = 0;
        this.deathFlash = 0;
        this.nextObstacleAt = 400;
        this.particles = [];
        this.dustTimer = 0;
        this.jumpFlash = 0;
    }

    jump() {
        if (!this.alive) return;
        if (this.jumpsUsed < 2) {
            this.vy = JUMP_POWER;
            this.jumpsUsed++;
            this.onGround = false;
            this.jumpFlash = 280;
            this.spawnJumpBurst(this.jumpsUsed === 2);
        }
    }

    spawnJumpBurst(isDouble) {
        const groundY = this.canvas.height * GROUND_Y_RATIO;
        const cx = this.x + this.width / 2;
        const cy = isDouble ? this.y - this.height / 2 : groundY;
        const count = isDouble ? 14 : 8;
        const color = isDouble ? '#fde047' : '#ffffff';
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
        const groundY = this.canvas.height * GROUND_Y_RATIO;
        this.particles.push({
            x: this.x + this.width / 2 + (Math.random() - 0.5) * 6,
            y: groundY - 2,
            vx: -this.speed * 0.4 - Math.random() * 1.5,
            vy: -Math.random() * 1.2,
            life: 360, maxLife: 360,
            size: 2 + Math.random() * 3,
            color: '#ffffff',
            gravity: 0.05,
        });
    }

    spawnDeathBurst() {
        const cx = this.x + this.width / 2;
        const cy = this.y - this.height / 2;
        for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.3;
            const speed = 3 + Math.random() * 4;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 700, maxLife: 700,
                size: 4 + Math.random() * 4,
                color: i % 2 === 0 ? '#ef4444' : '#fbbf24',
                gravity: 0.2,
            });
        }
    }

    update(dt) {
        this.updateParticles(dt);

        if (!this.alive) {
            this.deathFlash = Math.max(0, this.deathFlash - dt);
            return;
        }

        // 속도 점점 증가
        this.speed += SPEED_RAMP * dt;
        this.jumpFlash = Math.max(0, this.jumpFlash - dt);

        // 점프 물리
        const wasInAir = !this.onGround;
        this.vy += GRAVITY;
        this.y += this.vy;

        const groundY = this.canvas.height * GROUND_Y_RATIO;
        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = 0;
            this.onGround = true;
            this.jumpsUsed = 0;
            if (wasInAir) {
                // 착지 먼지
                for (let i = 0; i < 6; i++) this.spawnDust();
            }
        }

        // 달리는 동안 먼지
        if (this.onGround) {
            this.dustTimer -= dt;
            if (this.dustTimer <= 0) {
                this.spawnDust();
                this.dustTimer = 90;
            }
        }

        // 거리, 배경 스크롤
        this.distance += this.speed * (dt / 16);
        this.bgOffset = (this.bgOffset + this.speed) % this.canvas.width;
        this.cloudOffset = (this.cloudOffset + this.speed * 0.3) % this.canvas.width;
        this.runFrame += this.speed * 0.05;

        // 장애물 스폰
        if (this.distance > this.nextObstacleAt) {
            this.spawnObstacle();
            const gap = OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP);
            this.nextObstacleAt = this.distance + gap;
        }

        // 장애물 이동 + 충돌
        for (const obs of this.obstacles) {
            obs.x -= this.speed;
            if (this.checkCollision(obs)) {
                this.die();
            }
        }
        this.obstacles = this.obstacles.filter(o => o.x + o.width > -20);
    }

    spawnObstacle() {
        const types = ['cactus', 'cactus', 'rock', 'bird'];
        const type = types[Math.floor(Math.random() * types.length)];
        const groundY = this.canvas.height * GROUND_Y_RATIO;

        if (type === 'cactus') {
            this.obstacles.push({
                type, x: this.canvas.width + 50,
                y: groundY - 50, width: 26, height: 50,
            });
        } else if (type === 'rock') {
            this.obstacles.push({
                type, x: this.canvas.width + 50,
                y: groundY - 28, width: 38, height: 28,
            });
        } else if (type === 'bird') {
            // 새는 공중에 위치 - 첫 점프나 슬라이드 회피 가능
            const heights = [70, 110];
            const h = heights[Math.floor(Math.random() * heights.length)];
            this.obstacles.push({
                type, x: this.canvas.width + 50,
                y: groundY - h, width: 40, height: 28,
            });
        }
    }

    checkCollision(obs) {
        // 약간의 관용 적용 (히트박스 축소)
        const pad = 6;
        const px = this.x + pad;
        const py = this.y - this.height + pad;
        const pw = this.width - pad * 2;
        const ph = this.height - pad * 2;

        return px < obs.x + obs.width &&
            px + pw > obs.x &&
            py < obs.y + obs.height &&
            py + ph > obs.y;
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.deathFlash = 400;
        this.spawnDeathBurst();
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

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const groundY = h * GROUND_Y_RATIO;

        ctx.clearRect(0, 0, w, h);

        // 구름
        this.drawClouds(ctx, w);

        // 산 (먼 배경)
        this.drawMountains(ctx, w, groundY);

        // 땅 (밝은 잔디톤)
        const grad = ctx.createLinearGradient(0, groundY, 0, h);
        grad.addColorStop(0, '#65a30d');
        grad.addColorStop(1, '#365314');
        ctx.fillStyle = grad;
        ctx.fillRect(0, groundY, w, h - groundY);

        // 땅 위쪽 강조선
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(0, groundY - 2, w, 3);

        // 잔디 마디 (스크롤)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        for (let i = 0; i < 20; i++) {
            const dx = ((i * 80) - this.bgOffset) % w;
            const x = dx < 0 ? dx + w : dx;
            ctx.fillRect(x, groundY + 10, 30, 2);
        }

        // 파티클 (장애물 뒤)
        this.drawParticles(ctx);

        // 장애물
        for (const obs of this.obstacles) {
            this.drawObstacle(ctx, obs);
        }

        // 플레이어
        this.drawPlayer(ctx);

        // 점프 플래시 링 (캐릭터 발 아래)
        if (this.jumpFlash > 0) {
            const a = this.jumpFlash / 280;
            ctx.strokeStyle = `rgba(253, 224, 71, ${a})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, groundY,
                (1 - a) * 50 + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 사망 플래시
        if (!this.alive && this.deathFlash > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.deathFlash / 800})`;
            ctx.fillRect(0, 0, w, h);
        }

        // 사망 텍스트
        if (!this.alive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, h / 2 - 44, w, 88);
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 44px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💥 탈락! 💥', w / 2, h / 2 + 14);
        }
    }

    drawClouds(ctx, w) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = 'rgba(120, 120, 140, 0.35)';
        ctx.lineWidth = 1.5;
        const clouds = [
            { x: 100, y: 40, r: 18 },
            { x: 400, y: 70, r: 22 },
            { x: 700, y: 30, r: 16 },
            { x: 1000, y: 60, r: 20 },
        ];
        for (const c of clouds) {
            const dx = (c.x - this.cloudOffset) % w;
            const x = dx < 0 ? dx + w : dx;
            ctx.beginPath();
            ctx.arc(x, c.y, c.r, 0, Math.PI * 2);
            ctx.arc(x + c.r * 0.8, c.y + 4, c.r * 0.8, 0, Math.PI * 2);
            ctx.arc(x - c.r * 0.8, c.y + 4, c.r * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    drawMountains(ctx, w, groundY) {
        // 뒷산
        ctx.fillStyle = '#a5b4fc';
        const peaks = [0, 200, 450, 700, 950, 1200];
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let i = 0; i < peaks.length; i++) {
            const dx = (peaks[i] - this.cloudOffset * 0.5) % w;
            const x = dx < 0 ? dx + w : dx;
            ctx.lineTo(x, groundY - 90 - (i % 2) * 30);
        }
        ctx.lineTo(w, groundY);
        ctx.closePath();
        ctx.fill();

        // 앞산 (조금 더 진하게)
        ctx.fillStyle = '#7c8af0';
        const peaks2 = [80, 320, 560, 820, 1080];
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let i = 0; i < peaks2.length; i++) {
            const dx = (peaks2[i] - this.cloudOffset * 0.8) % w;
            const x = dx < 0 ? dx + w : dx;
            ctx.lineTo(x, groundY - 50 - (i % 2) * 20);
        }
        ctx.lineTo(w, groundY);
        ctx.closePath();
        ctx.fill();
    }

    drawObstacle(ctx, obs) {
        // 위협 글로우 (장애물 뒤 빨간 발광)
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, obs.width);
        glow.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(obs.x - obs.width, obs.y - obs.width,
            obs.width * 3, obs.height + obs.width * 2);

        ctx.strokeStyle = '#1a1d24';
        ctx.lineWidth = 2.5;

        if (obs.type === 'cactus') {
            // 몸통
            ctx.fillStyle = '#15803d';
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
            // 가지
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(obs.x - 8, obs.y + 14, 10, 20);
            ctx.strokeRect(obs.x - 8, obs.y + 14, 10, 20);
            ctx.fillRect(obs.x + obs.width - 2, obs.y + 8, 10, 24);
            ctx.strokeRect(obs.x + obs.width - 2, obs.y + 8, 10, 24);
            // 가시
            ctx.fillStyle = '#052e16';
            ctx.fillRect(obs.x + 5, obs.y + 8, 4, 4);
            ctx.fillRect(obs.x + 17, obs.y + 22, 4, 4);
            ctx.fillRect(obs.x + 10, obs.y + 36, 4, 4);
        } else if (obs.type === 'rock') {
            ctx.fillStyle = '#404040';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2,
                obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // 하이라이트
            ctx.fillStyle = '#9ca3af';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width / 2 - 6, obs.y + obs.height / 2 - 4,
                obs.width / 3.5, obs.height / 4, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (obs.type === 'bird') {
            const flap = Math.sin(this.runFrame * 0.8) > 0;
            // 몸통
            ctx.fillStyle = '#7c2d12';
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2,
                obs.width / 2, obs.height / 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // 날개
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            if (flap) {
                ctx.moveTo(obs.x + 8, obs.y + 14);
                ctx.lineTo(obs.x + 20, obs.y - 6);
                ctx.lineTo(obs.x + 32, obs.y + 14);
            } else {
                ctx.moveTo(obs.x + 8, obs.y + 14);
                ctx.lineTo(obs.x + 20, obs.y + 28);
                ctx.lineTo(obs.x + 32, obs.y + 14);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 부리
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.width, obs.y + 14);
            ctx.lineTo(obs.x + obs.width + 10, obs.y + 16);
            ctx.lineTo(obs.x + obs.width, obs.y + 18);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 눈
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(obs.x + obs.width - 8, obs.y + 11, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1a1d24';
            ctx.beginPath();
            ctx.arc(obs.x + obs.width - 7, obs.y + 11, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawPlayer(ctx) {
        const x = this.x;
        const y = this.y - this.height;
        const w = this.width;
        const h = this.height;

        // 그림자
        const groundY = this.canvas.height * GROUND_Y_RATIO;
        const shadowAlpha = Math.max(0, 1 - (groundY - this.y) / 200);
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, groundY + 4, w / 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 캐릭터 글로우 (배경에서 잘 보이게)
        const glow = ctx.createRadialGradient(
            x + w / 2, y + h / 2, 0,
            x + w / 2, y + h / 2, w * 1.2
        );
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - w, y - h / 2, w * 3, h * 2);

        ctx.strokeStyle = '#1a1d24';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';

        // 팔 (몸 뒤쪽)
        const armSwing = this.onGround ? Math.sin(this.runFrame) * 6 : -4;
        ctx.fillStyle = this.color;
        ctx.fillRect(x - 4, y + 22 + armSwing, 8, 18);
        ctx.strokeRect(x - 4, y + 22 + armSwing, 8, 18);

        // 몸통
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y + 18, w, h - 18);
        ctx.strokeRect(x, y + 18, w, h - 18);

        // 몸통 하이라이트
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x + 4, y + 22, 6, h - 28);

        // 머리
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(x + 8, y, w - 16, 24);
        ctx.strokeRect(x + 8, y, w - 16, 24);

        // 헬멧/머리 윗부분
        ctx.fillStyle = this.accentColor;
        ctx.fillRect(x + 6, y - 4, w - 12, 12);
        ctx.strokeRect(x + 6, y - 4, w - 12, 12);

        // 눈
        ctx.fillStyle = '#1a1d24';
        ctx.fillRect(x + w - 16, y + 10, 5, 5);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + w - 15, y + 11, 2, 2);

        // 입 (살짝 웃음)
        ctx.strokeStyle = '#1a1d24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + w - 14, y + 19, 3, 0.1, Math.PI - 0.1);
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#1a1d24';

        // 앞쪽 팔
        ctx.fillStyle = this.color;
        ctx.fillRect(x + w - 4, y + 22 - armSwing, 8, 18);
        ctx.strokeRect(x + w - 4, y + 22 - armSwing, 8, 18);

        // 다리 (달리기 애니메이션)
        if (this.onGround) {
            const legPhase = Math.sin(this.runFrame);
            const leg1 = legPhase * 8;
            const leg2 = -legPhase * 8;
            ctx.fillStyle = '#1a1d24';
            ctx.fillRect(x + 6, y + h - 4, 10, 10 + Math.max(0, leg1));
            ctx.fillRect(x + w - 16, y + h - 4, 10, 10 + Math.max(0, leg2));
            // 신발
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x + 4 + leg1 * 0.3, y + h + 4, 14, 5);
            ctx.fillRect(x + w - 18 + leg2 * 0.3, y + h + 4, 14, 5);
            ctx.strokeRect(x + 4 + leg1 * 0.3, y + h + 4, 14, 5);
            ctx.strokeRect(x + w - 18 + leg2 * 0.3, y + h + 4, 14, 5);
        } else {
            // 점프 자세
            ctx.fillStyle = '#1a1d24';
            ctx.fillRect(x + 8, y + h - 4, 10, 12);
            ctx.fillRect(x + w - 18, y + h - 8, 10, 12);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x + 6, y + h + 8, 14, 5);
            ctx.fillRect(x + w - 20, y + h + 4, 14, 5);
            ctx.strokeRect(x + 6, y + h + 8, 14, 5);
            ctx.strokeRect(x + w - 20, y + h + 4, 14, 5);
        }

        // 2단점프 글로우 링
        if (this.jumpsUsed === 2 && !this.onGround) {
            ctx.save();
            const t = Math.sin(this.runFrame * 0.6) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(253, 224, 71, ${t})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h, 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(253, 224, 71, ${t * 0.5})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
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

        this.player1 = new Player(this.canvas1, '#2563eb', '#fbbf24', 'P1');
        this.player2 = new Player(this.canvas2, '#dc2626', '#fbbf24', 'P2');

        this.score1El = document.getElementById('score1');
        this.score2El = document.getElementById('score2');
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
        // 시작 오버레이만 표시한 채 대기 (버튼 클릭 시 카운트다운 시작)
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
                if (e.key === 'w' || e.key === 'W' || e.code === 'KeyW') {
                    this.player1.jump();
                }
                if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
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

        // 승부 판정
        if (!this.player1.alive || !this.player2.alive) {
            // 둘 다 죽었는지, 한 명만 죽었는지 확인 후 잠시 후 종료 화면
            if (!this.player1.alive && !this.player2.alive) {
                setTimeout(() => this.finishGame(), 400);
            } else {
                // 한 명만 죽으면 살아있는 쪽이 즉시 승리
                setTimeout(() => this.finishGame(), 600);
            }
        }
    }

    finishGame() {
        if (this.state === STATE.FINISHED) return;
        this.state = STATE.FINISHED;

        const d1 = Math.floor(this.player1.distance / 10);
        const d2 = Math.floor(this.player2.distance / 10);

        let title, detail;
        if (!this.player1.alive && !this.player2.alive) {
            if (d1 > d2) {
                title = '🏆 PLAYER 1 승리!';
                detail = `P1: ${d1}m  vs  P2: ${d2}m`;
            } else if (d2 > d1) {
                title = '🏆 PLAYER 2 승리!';
                detail = `P1: ${d1}m  vs  P2: ${d2}m`;
            } else {
                title = '🤝 무승부!';
                detail = `둘 다 ${d1}m`;
            }
        } else if (!this.player1.alive) {
            title = '🏆 PLAYER 2 승리!';
            detail = `P1 탈락 (${d1}m) / P2 생존 (${d2}m)`;
        } else {
            title = '🏆 PLAYER 1 승리!';
            detail = `P2 탈락 (${d2}m) / P1 생존 (${d1}m)`;
        }

        this.resultText.textContent = title;
        this.resultDetail.textContent = detail;
        this.overlay.classList.remove('hidden');
    }

    draw() {
        this.player1.draw();
        this.player2.draw();
    }

    loop(t) {
        const dt = Math.min(48, t - this.lastTime || 16);
        this.lastTime = t;
        this.update(dt);
        this.draw();
        requestAnimationFrame(t2 => this.loop(t2));
    }
}

window.addEventListener('load', () => {
    new Game();
});
