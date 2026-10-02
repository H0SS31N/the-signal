const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over");
const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");
const finalScore = document.getElementById("final-score");
const finalHighScore = document.getElementById("final-high-score");
const bgMusic = document.getElementById("bg-music");
const bossMusic = document.getElementById("boss-music");

bgMusic.volume = 0.35;
bossMusic.volume = 0.42;

const loadFill = document.getElementById("load-fill");
const loadStatus = document.getElementById("load-status");
const loadTracks = [bgMusic, bossMusic];
const loadProgress = new Map(loadTracks.map(track => [track, 0]));
const LOAD_TIMEOUT_MS = 15000;
let assetsReady = false;
let failedTracks = 0;
let loadTimeout = null;

function updateLoading() {
    let total = 0;
    for (const value of loadProgress.values()) total += value;
    const percent = Math.round((total / loadTracks.length) * 100);

    loadFill.style.width = percent + "%";
    if (!assetsReady) startButton.textContent = `LOADING ${percent}%`;
    if (percent >= 100) finishLoading();
}

function finishLoading(timedOut = false) {
    if (assetsReady) return;
    assetsReady = true;
    clearTimeout(loadTimeout);

    loadFill.style.width = "100%";
    startButton.disabled = false;
    startButton.textContent = "PLAY";

    if (failedTracks > 0) {
        loadStatus.textContent = "AUDIO FAILED TO LOAD - PLAYING WITHOUT SOUND";
        loadStatus.classList.add("warn");
    } else if (timedOut) {
        loadStatus.textContent = "SLOW CONNECTION - MUSIC MAY LAG";
        loadStatus.classList.add("warn");
    } else {
        loadStatus.textContent = "SIGNAL READY";
        loadStatus.classList.add("ready");
    }
}

function trackDone(track, ok) {
    if (loadProgress.get(track) === 1) return;
    if (!ok) failedTracks++;
    loadProgress.set(track, 1);
    updateLoading();
}

loadTracks.forEach(track => {
    track.addEventListener("canplaythrough", () => trackDone(track, true));
    track.addEventListener("error", () => trackDone(track, false));

    const source = track.querySelector("source");
    if (source) source.addEventListener("error", () => trackDone(track, false));

    track.addEventListener("progress", () => {
        if (loadProgress.get(track) === 1) return;
        if (!track.duration || !track.buffered.length) return;
        const buffered = track.buffered.end(track.buffered.length - 1) / track.duration;
        loadProgress.set(track, Math.min(0.99, buffered));
        updateLoading();
    });

    if (track.readyState >= 4) trackDone(track, true);
    else track.load();
});

loadTimeout = setTimeout(() => finishLoading(true), LOAD_TIMEOUT_MS);
updateLoading();

const W = canvas.width;
const H = canvas.height;

const keys = {};
const bullets = [];
const enemies = [];
const particles = [];
const stars = [];
const shockwaves = [];
const powerups = [];
const enemyBullets = [];

let boss = null;
let bossActive = false;
let bossDialogue = "";
let bossDialogueTimer = 0;

const BOSS_TYPES = [
    { name: "THE WATCHER", face: "eye", hp: 70, shotInterval: 1.15, spawnInterval: 3.4, color: "#19e6ff", lines: ["I SEE YOU.", "DO NOT LOOK AWAY.", "F*** YOU.", "YOU'RE DEAD!"] },
    { name: "THE MOUTH", face: "mouth", hp: 95, shotInterval: .9, spawnInterval: 2.8, color: "#ff2b9d", lines: ["WOOOOO...", "TASTY...", "YUMMY...", "HUNGRY...", "GET OVER HERE..."] },
    { name: "THE DIAL", face: "dial", hp: 120, shotInterval: .72, spawnInterval: 2.4, color: "#fff", lines: ["TIME TO DIE.", "YOU CAN'T SURVIVE THIS.", "CAN YOU HEAR ME?"] },
    { name: "THE BROADCASTER", face: "broadcast", hp: 150, shotInterval: .62, spawnInterval: 2.0, color: "#7cff8a", lines: ["THIS TRANSMISSION NEVER ENDS.", "STAY TUNED.", "THE SIGNAL REMEMBERS."] }
];

let running = false;
let paused = false;
let animationId = null;
let lastTime = 0;
let score = 0;
let health = 3;
let highScore = Number(localStorage.getItem("theSignalHighScore") || 0);

let spawnTimer = 0;
let shootCooldown = 0;
let damageCooldown = 0;
let flash = 0;
let shake = 0;
let waveTextTimer = 0;
let currentWave = 1;
let waveTimer = 0;
let waveFlash = 0;
let deathAnimation = 0;
let deathTimer = 0;
let cameraShake = 0;
let armor = 0;
let doubleShotTimer = 0;
let altCharge = 0;
let altCooldown = 0;
const MAX_HEALTH = 5;
const MAX_ARMOR = 3;
const ALT_MAX_CHARGE = 100;
const WAVE_DURATION = 64;
const DEATH_DURATION = 2.2;
const ENVIRONMENT_EVERY_WAVES = 2;

const player = {
    x: W / 2,
    y: H - 75,
    width: 46,
    height: 50,
    speed: 360
};

for (let i = 0; i < 150; i++) {
    stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 25 + Math.random() * 110,
        size: .5 + Math.random() * 2
    });
}

window.addEventListener("keydown", e => {
    keys[e.code] = true;

    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === "KeyP" && running) {
        paused = !paused;

        if (paused) {
            bgMusic.pause();
        } else {
            bgMusic.play().catch(() => {});
        }
    }

    if (e.code === "KeyM") {
        bgMusic.muted = !bgMusic.muted;
        bossMusic.muted = bgMusic.muted;
    }

    if (e.code === "KeyE" && running && !paused && altCharge >= ALT_MAX_CHARGE && altCooldown <= 0) {
        activateAltMove();
    }
});

window.addEventListener("keyup", e => {
    keys[e.code] = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

function startGame() {
    if (!assetsReady) return;
    score = 0;
    health = 3;
    armor = 0;
    doubleShotTimer = 0;
    altCharge = 0;
    altCooldown = 0;
    spawnTimer = 0;
    shootCooldown = 0;
    damageCooldown = 0;
    flash = 0;
    shake = 0;
    currentWave = 1;
    waveTimer = 0;
    deathAnimation = 0;
    deathTimer = 0;
    cameraShake = 0;
    waveFlash = 0;
    waveTextTimer = 2;

    bullets.length = 0;
    enemies.length = 0;
    particles.length = 0;
    shockwaves.length = 0;
    powerups.length = 0;
    enemyBullets.length = 0;
    boss = null;
    bossActive = false;
    bossDialogue = "";
    bossDialogueTimer = 0;

    player.x = W / 2;
    player.y = H - 75;

    paused = false;
    running = true;

    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");

    lastTime = performance.now();

    bgMusic.currentTime = 0;
    bossMusic.pause();
    bossMusic.currentTime = 0;
    bgMusic.play().catch(() => {});

    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
}

function endGame() {
    if (!running || deathTimer > 0) return;

    running = false;
    deathTimer = DEATH_DURATION;
    deathAnimation = DEATH_DURATION;
    shake = Math.max(shake, 2.4);
    cameraShake = Math.max(cameraShake, 2.4);
    flash = .35;
    createPlayerDeathExplosion();
    bgMusic.pause();
    bgMusic.currentTime = 0;
    bossMusic.pause();
    bossMusic.currentTime = 0;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("theSignalHighScore", highScore);
    }

    finalScore.textContent = score;
    finalHighScore.textContent = highScore;

    if (animationId) cancelAnimationFrame(animationId);
    lastTime = performance.now();
    animationId = requestAnimationFrame(deathLoop);
}

function deathLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, .033);
    lastTime = time;

    deathTimer -= dt;
    deathAnimation = Math.max(0, deathTimer);
    updateParticles(dt);
    updateShockwaves(dt);
    cameraShake = Math.max(0, cameraShake - dt * 2.4);
    flash = Math.max(0, flash - dt * 1.5);
    draw();

    if (deathTimer > 0) {
        animationId = requestAnimationFrame(deathLoop);
    } else {
        gameOverScreen.classList.remove("hidden");
    }
}

function loop(time) {
    if (!running) return;

    const dt = Math.min((time - lastTime) / 1000, .033);
    lastTime = time;

    if (!paused) update(dt);

    draw();
    animationId = requestAnimationFrame(loop);
}

function update(dt) {
    waveTimer += dt;
    waveFlash = Math.max(0, waveFlash - dt);
    doubleShotTimer = Math.max(0, doubleShotTimer - dt);
    altCooldown = Math.max(0, altCooldown - dt);
    damageCooldown = Math.max(0, damageCooldown - dt);

    if (!bossActive && waveTimer >= WAVE_DURATION) {
        waveTimer -= WAVE_DURATION;

        if (currentWave % 3 === 0) {
            waveTimer = 0;
            startBossFight(currentWave);
        } else {
            currentWave++;
            const environmentChanged = currentWave > 1 && currentWave % ENVIRONMENT_EVERY_WAVES === 1;
            waveTextTimer = 2.5;
            waveFlash = 2.5;
            flash = Math.max(flash, .18);
            shake = Math.max(shake, 5);
            cameraShake = Math.max(cameraShake, 5);
            createWaveBurst();
            if (environmentChanged) {
                waveTextTimer = 3.2;
                waveFlash = 3.2;
                flash = Math.max(flash, .28);
                shake = Math.max(shake, 1.2);
                cameraShake = Math.max(cameraShake, 1.2);
                createEnvironmentTransitionBurst();
            }
        }
    }

    updateStars(dt);
    updatePlayer(dt);
    updateShooting(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateEnemyBullets(dt);
    updateParticles(dt);
    updateShockwaves(dt);
    updatePowerups(dt);
    handleBulletCollisions();
    handleBossBulletCollisions();
    handlePlayerCollision();
    handlePowerupCollection();
    spawnEnemies(dt);

    flash = Math.max(0, flash - dt);
    shake = Math.max(0, shake - dt * 2);
    cameraShake = Math.max(0, cameraShake - dt * 2);
    waveTextTimer = Math.max(0, waveTextTimer - dt);

}

function updateStars(dt) {
    for (const s of stars) {
        s.y += s.speed * dt * (1 + currentWave * .04);

        if (s.y > H) {
            s.y = 0;
            s.x = Math.random() * W;
        }
    }
}

function updatePlayer(dt) {
    let dx = 0;
    let dy = 0;

    if (keys.ArrowLeft || keys.KeyA) dx--;
    if (keys.ArrowRight || keys.KeyD) dx++;
    if (keys.ArrowUp || keys.KeyW) dy--;
    if (keys.ArrowDown || keys.KeyS) dy++;

    if (dx || dy) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    player.x = Math.max(25, Math.min(W - 25, player.x));
    player.y = Math.max(30, Math.min(H - 30, player.y));
}

function updateShooting(dt) {
    shootCooldown -= dt;

    if (keys.Space && shootCooldown <= 0) {
        const spread = doubleShotTimer > 0 ? 11 : 0;
        const damage = doubleShotTimer > 0 ? 2 : 1;

        bullets.push({
            x: player.x - spread,
            y: player.y - 27,
            width: 5,
            height: 17,
            speed: 720,
            damage
        });

        if (doubleShotTimer > 0) {
            bullets.push({
                x: player.x + spread,
                y: player.y - 27,
                width: 5,
                height: 17,
                speed: 720,
                damage
            });
        }

        createMuzzleFlash();
        shootCooldown = .14;
    }
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed * dt;

        if (bullets[i].y < -30) bullets.splice(i, 1);
    }
}

function spawnEnemies(dt) {
    if (bossActive) return;
    spawnTimer -= dt;

    const difficulty = Math.min(1, score / 2200);
    const delay = Math.max(.23, .78 - currentWave * .045 - difficulty * .15);

    if (spawnTimer <= 0) {
        createEnemy();
        spawnTimer = delay;
    }
}

function createEnemy(forcedType = null) {
    const eliteChance = Math.min(.42, .08 + currentWave * .018);
    const roll = Math.random();

    let type;

    if (forcedType === "elite") type = "elite";
    else if (forcedType === "asteroid") type = "asteroid";
    else if (roll < eliteChance) type = "elite";
    else type = "asteroid";

    const sizes = {
        asteroid: 20 + Math.random() * 25,
        elite: 34 + Math.random() * 12,
    };

    const size = sizes[type];

    const hp = {
        asteroid: 1 + Math.floor(currentWave / 6),
        elite: 4 + Math.floor(currentWave * .8),
    };

    enemies.push({
        type,
        x: size + Math.random() * (W - size * 2),
        y: -size,
        size,
        hp: hp[type],
        maxHp: hp[type],
        speed:
            type === "elite"
                    ? 95 + currentWave * 6
                    : 125 + Math.random() * 145 + currentWave * 5,
        vx: -45 + Math.random() * 90,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -2 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        shape: Array.from({ length: 9 }, () => .82 + Math.random() * .28)
    });
}

function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        e.y += e.speed * dt;
        e.x += e.vx * dt;
        e.rotation += e.rotationSpeed * dt;
        e.phase += dt * 2;

        if (e.type === "elite") {
            e.x += Math.sin(e.phase) * 25 * dt;
        }

        if (e.x < -e.size) e.x = W + e.size;
        if (e.x > W + e.size) e.x = -e.size;

        if (e.y > H + e.size) {
            enemies.splice(i, 1);
        }
    }
}

function handleBulletCollisions() {
    for (let b = bullets.length - 1; b >= 0; b--) {
        const bullet = bullets[b];

        if (boss && circleRectCollision(boss.x, boss.y, 62, bullet)) {
            bullets.splice(b, 1);
            boss.hp -= bullet.damage || 1;
            createHitParticles(boss.x, boss.y, "boss");
            shake = Math.max(shake, .16);
            cameraShake = Math.max(cameraShake, .16);

            if (boss.hp <= 0) {
                const defeatedBoss = boss;
                score += 300 + currentWave * 25;
                altCharge = Math.min(ALT_MAX_CHARGE, altCharge + 35);
                createPowerup(defeatedBoss.x, defeatedBoss.y, ["health", "armor", "double"][Math.floor(Math.random()*3)]);
                createExplosion(defeatedBoss.x, defeatedBoss.y, "boss");
                for (let i = 0; i < 4; i++) {
                    shockwaves.push({ x: defeatedBoss.x, y: defeatedBoss.y, radius: 8 + i * 10, maxRadius: 170 + i * 55, life: .65 + i * .08 });
                }
                flash = Math.max(flash, .3);
                shake = Math.max(shake, 0.8);
                cameraShake = Math.max(cameraShake, 0.8);
                shake = Math.max(shake, 0.8);
                cameraShake = Math.max(cameraShake, 0.8);
                bossDialogue = "SIGNAL TERMINATED.";
                bossDialogueTimer = 2.2;
                finishBossFight();
            }
            continue;
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];

            if (!circleRectCollision(e.x, e.y, e.size * .7, bullet)) continue;

            bullets.splice(b, 1);
            e.hp -= bullet.damage || 1;

            createHitParticles(e.x, e.y, e.type);
            shake = Math.max(shake, .12);
            cameraShake = Math.max(cameraShake, .12);

            if (e.hp <= 0) {
                const points = e.type === "elite" ? 50 : 10;
                score += points;
                addAltCharge(e.type);
                maybeDropPowerup(e);

                createExplosion(e.x, e.y, e.type);
                shockwaves.push({
                    x: e.x, y: e.y, radius: 2, maxRadius: e.size * 2, life: .35
                });
                enemies.splice(i, 1);
            }
            break;
        }
    }
}

function startBossFight(wave) {
    bossActive = true;
    waveTimer = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    bullets.length = 0;

    const typeIndex = (Math.floor(wave / 3) - 1) % BOSS_TYPES.length;
    const type = BOSS_TYPES[typeIndex];
    boss = {
        typeIndex,
        x: W / 2,
        y: 82,
        hp: type.hp + Math.max(0, wave - 3) * 10,
        maxHp: type.hp + Math.max(0, wave - 3) * 10,
        phase: Math.random() * Math.PI * 2,
        shotTimer: 1.2,
        spawnTimer: 2.0,
        dialogueIndex: 0
    };
    bossDialogue = type.lines[0];
    bossDialogueTimer = 3.5;

    bgMusic.pause();
    bossMusic.currentTime = 0;
    bossMusic.muted = bgMusic.muted;
    bossMusic.play().catch(() => {});

    waveTextTimer = 3.5;
    waveFlash = 3.5;
    flash = Math.max(flash, .25);
    shake = Math.max(shake, 0.65);
    cameraShake = Math.max(cameraShake, 0.65);
    createEnvironmentTransitionBurst();
}

function finishBossFight() {
    bossActive = false;
    boss = null;
    enemyBullets.length = 0;
    bullets.length = 0;

    bossMusic.pause();
    bossMusic.currentTime = 0;
    bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {});

    currentWave++;
    waveTimer = 0;
    waveTextTimer = 2.8;
    waveFlash = 2.8;
    flash = Math.max(flash, .2);
    shake = Math.max(shake, .35);
    cameraShake = Math.max(cameraShake, .35);
    createWaveBurst();

    const environmentChanged = currentWave > 1 && currentWave % ENVIRONMENT_EVERY_WAVES === 1;
    if (environmentChanged) {
        waveTextTimer = 3.2;
        waveFlash = 3.2;
        flash = Math.max(flash, .28);
        createEnvironmentTransitionBurst();
    }
}

function updateBoss(dt) {
    if (!boss) return;
    const type = BOSS_TYPES[boss.typeIndex];
    boss.phase += dt;
    boss.x = W / 2 + Math.sin(boss.phase * .72) * (W * .34);
    boss.x = Math.max(110, Math.min(W - 110, boss.x));
    boss.y = 82 + Math.sin(boss.phase * 1.4) * 5;

    bossDialogueTimer -= dt;
    if (bossDialogueTimer <= 0) {
        boss.dialogueIndex = (boss.dialogueIndex + 1) % type.lines.length;
        bossDialogue = type.lines[boss.dialogueIndex];
        bossDialogueTimer = 3.5 + Math.random() * 2;
    }

    boss.shotTimer -= dt;
    if (boss.shotTimer <= 0) {
        fireBossAttack();
        boss.shotTimer = type.shotInterval;
    }

    boss.spawnTimer -= dt;
    if (boss.spawnTimer <= 0) {
        const count = boss.typeIndex >= 2 ? 2 : 1;
        for (let i = 0; i < count; i++) createEnemy(Math.random() < .28 ? "elite" : "asteroid");
        boss.spawnTimer = type.spawnInterval;
        bossDialogue = "MORE SIGNAL.";
        bossDialogueTimer = 1.6;
        shake = Math.max(shake, .35);
        cameraShake = Math.max(cameraShake, .35);
    }
}

function fireBossAttack() {
    if (!boss) return;
    const typeIndex = boss.typeIndex;
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    const count = typeIndex === 0 ? 1 : typeIndex === 1 ? 3 : 5;
    const spread = typeIndex === 0 ? 0 : .18;
    for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
        const angle = base + offset;
        enemyBullets.push({
            x: boss.x, y: boss.y + 24,
            vx: Math.cos(angle) * (typeIndex >= 2 ? 260 : 220),
            vy: Math.sin(angle) * (typeIndex >= 2 ? 260 : 220),
            radius: 4 + typeIndex * .5,
            life: 5
        });
    }
}

function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
            enemyBullets.splice(i, 1);
        }
    }
}

function handleBossBulletCollisions() {
    if (damageCooldown > 0) return;
    const box = { x: player.x - 15, y: player.y - 17, width: 30, height: 34 };
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        if (dx * dx + dy * dy > (b.radius + 16) ** 2) continue;
        enemyBullets.splice(i, 1);
        if (armor > 0) { armor--; damageCooldown = .9; }
        else { health--; damageCooldown = 1.2; }
        flash = .18;
        shake = Math.max(shake, .5);
        cameraShake = Math.max(cameraShake, .5);
        createExplosion(player.x, player.y, "hit");
        if (health <= 0) endGame();
        break;
    }
}

function handlePlayerCollision() {
    if (damageCooldown > 0) return;

    const box = {
        x: player.x - 15,
        y: player.y - 17,
        width: 30,
        height: 34
    };

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        if (circleRectCollision(e.x, e.y, e.size * .62, box)) {
            enemies.splice(i, 1);

            if (armor > 0) {
                armor--;
                damageCooldown = .9;
            } else {
                health--;
                damageCooldown = 1.2;
            }
            flash = .18;
            shake = .45;
            cameraShake = .45;

            createExplosion(player.x, player.y, "hit");

            if (health <= 0) endGame();
            break;
        }
    }
}

function circleRectCollision(cx, cy, radius, rect) {
    const x = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const y = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - x;
    const dy = cy - y;

    return dx * dx + dy * dy < radius * radius;
}

function createMuzzleFlash() {
    for (let i = 0; i < 3; i++) {
        particles.push({
            x: player.x + (Math.random() - .5) * 7,
            y: player.y - 28,
            vx: (Math.random() - .5) * 50,
            vy: -80 - Math.random() * 80,
            life: .12,
            maxLife: .12,
            size: 2 + Math.random() * 3
        });
    }
}

function createPlayerDeathExplosion() {
    createExplosion(player.x, player.y, "boss");
    for (let i = 0; i < 3; i++) {
        shockwaves.push({
            x: player.x,
            y: player.y,
            radius: 8 + i * 10,
            maxRadius: 170 + i * 90,
            life: .8 + i * .15
        });
    }
}

function createHitParticles(x, y, type) {
    const count = type === "boss" ? 10 : 6;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 160;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: .3 + Math.random() * .25,
            maxLife: .55,
            size: 1 + Math.random() * 3
        });
    }
}

function createExplosion(x, y, type) {
    const count = type === "boss" ? 42 : type === "elite" ? 22 : 13;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 260;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: .35 + Math.random() * .65,
            maxLife: 1,
            size: 1 + Math.random() * 4
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= .985;
        p.vy *= .985;
        p.life -= dt;

        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const s = shockwaves[i];

        s.radius += (s.maxRadius / s.life) * dt;
        s.life -= dt;

        if (s.life <= 0) shockwaves.splice(i, 1);
    }
}

function maybeDropPowerup(enemy) {
    let chance = enemy.type === "boss" ? 1 : enemy.type === "elite" ? .22 : .035;
    if (Math.random() > chance) return;

    const roll = Math.random();
    const type = roll < .34 ? "health" : roll < .67 ? "armor" : "double";
    createPowerup(enemy.x, enemy.y, type);
}

function createPowerup(x, y, type) {
    powerups.push({
        x,
        y,
        type,
        size: 13,
        speed: 70,
        life: 12,
        pulse: Math.random() * Math.PI * 2
    });
}

function updatePowerups(dt) {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.y += p.speed * dt;
        p.pulse += dt * 5;
        p.life -= dt;

        if (p.y > H + 30 || p.life <= 0) {
            powerups.splice(i, 1);
        }
    }
}

function handlePowerupCollection() {
    const box = {
        x: player.x - 20,
        y: player.y - 22,
        width: 40,
        height: 44
    };

    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        if (!circleRectCollision(p.x, p.y, p.size, box)) continue;

        if (p.type === "health") {
            health = Math.min(MAX_HEALTH, health + 1);
        } else if (p.type === "armor") {
            armor = Math.min(MAX_ARMOR, armor + 1);
        } else if (p.type === "double") {
            doubleShotTimer = 12;
        }

        score += 25;
        flash = Math.max(flash, .12);
        createHitParticles(p.x, p.y, "powerup");
        powerups.splice(i, 1);
    }
}

function addAltCharge(type) {
    const gain = type === "boss" ? 35 : type === "elite" ? 18 : 7;
    altCharge = Math.min(ALT_MAX_CHARGE, altCharge + gain);
}

function activateAltMove() {
    altCharge = 0;
    altCooldown = 1.5;
    flash = Math.max(flash, .3);
    shake = Math.max(shake, 1.5);
    cameraShake = Math.max(cameraShake, 1.5);

    shockwaves.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: Math.max(W, H) * 1.15,
        life: .65
    });

    if (boss) {
        const dx = boss.x - player.x;
        const dy = boss.y - player.y;
        if (Math.hypot(dx, dy) < Math.max(W, H) * .95) {
            boss.hp -= 12;
            createHitParticles(boss.x, boss.y, "boss");
            if (boss.hp <= 0) {
                score += 300 + currentWave * 25;
                altCharge = Math.min(ALT_MAX_CHARGE, altCharge + 35);
                createPowerup(boss.x, boss.y, "double");
                createExplosion(boss.x, boss.y, "boss");
                shake = Math.max(shake, 0.8);
                cameraShake = Math.max(cameraShake, 0.8);
                bossDialogue = "SIGNAL TERMINATED.";
                bossDialogueTimer = 2.2;
                finishBossFight();
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const distance = Math.hypot(dx, dy);
        const damage = e.type === "boss" ? 8 : e.type === "elite" ? 10 : 999;

        if (distance < Math.max(W, H) * .9) {
            e.hp -= damage;
            createHitParticles(e.x, e.y, e.type);

            if (e.hp <= 0) {
                const points = e.type === "boss" ? 150 : e.type === "elite" ? 50 : 10;
                score += points;
                addAltCharge(e.type);
                maybeDropPowerup(e);
                createExplosion(e.x, e.y, e.type);
                enemies.splice(i, 1);
            }
        }
    }
}

function createEnvironmentTransitionBurst() {
    for (let i = 0; i < 90; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 420;
        particles.push({
            x: W / 2,
            y: H / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: .7 + Math.random() * .8,
            maxLife: 1.5,
            size: 1 + Math.random() * 4
        });
    }
}

function drawPowerups() {
    for (const p of powerups) {
        const pulse = 1 + Math.sin(p.pulse) * .12;
        const label = p.type === "health" ? "+" : p.type === "armor" ? "A" : "2X";
        const color = p.type === "health" ? "#7cff8a" : p.type === "armor" ? "#19e6ff" : "#ff2b9d";

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(pulse, pulse);
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-p.size, -p.size, p.size * 2, p.size * 2);
        ctx.fillStyle = color;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 0, 0);
        ctx.restore();
    }
}

function createWaveBurst() {
    for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 260;

        particles.push({
            x: W / 2,
            y: H / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: .5 + Math.random() * .5,
            maxLife: 1,
            size: 1 + Math.random() * 3
        });
    }
}

function draw() {
    ctx.save();

    const now = performance.now() * 0.001;
    const ambientShake = currentWave >= 3
        ? 0.22 + Math.sin(now * 4.7) * 0.055 + Math.sin(now * 8.9) * 0.025
        : 0;
    const amount = Math.max(shake, cameraShake, ambientShake);
    const shakePixels = Math.min(8, amount * 5.2);
    const driftX = Math.sin(now * 7.1) * shakePixels * .34;
    const driftY = Math.cos(now * 6.3) * shakePixels * .28;
    ctx.translate(
        driftX + (Math.random() - .5) * shakePixels * .58,
        driftY + (Math.random() - .5) * shakePixels * .58
    );

    drawEnvironment();
    drawStars();
    drawEnemies();
    drawBoss();
    drawEnemyBullets();
    drawPowerups();
    drawBullets();
    drawParticles();
    drawShockwaves();
    if (deathTimer <= 0) drawPlayer();
    drawDeathAnimation();
    drawHud();

    if (waveTextTimer > 0) {
        drawWave();
    }

    if (waveFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, waveFlash);
        ctx.textAlign = "center";
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = currentWave % 2 ? "#19e6ff" : "#ff2b9d";
        ctx.fillText(`SIGNAL SHIFT // WAVE ${currentWave}`, W / 2, 42);
        ctx.restore();
    }

    if (paused && running) {
        drawPause();
    }

    ctx.restore();
    drawTVEffects();

    if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 2})`;
        ctx.fillRect(0, 0, W, H);
    }
}

function drawDeathAnimation() {
    if (deathTimer <= 0) return;

    const progress = 1 - deathTimer / DEATH_DURATION;
    const radius = 20 + progress * 145;
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = Math.max(0, .8 - progress * .8);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 30px Arial";
    ctx.fillText("SIGNAL LOST", player.x, player.y - radius - 18);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#aaa";
    ctx.fillText("TRANSMISSION TERMINATED", player.x, player.y + radius + 20);
    ctx.restore();
}

function drawTVEffects() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    ctx.globalAlpha = .055;
    ctx.fillStyle = "#19e6ff";
    ctx.fillRect(-2, 0, 1, H);
    ctx.fillStyle = "#ff2b9d";
    ctx.fillRect(W + 1, 0, 1, H);

    ctx.globalAlpha = .035;
    ctx.fillStyle = "#fff";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

    if (Math.random() < .035) {
        const y = Math.random() * H;
        const h = 2 + Math.random() * 12;
        ctx.globalAlpha = .10;
        ctx.fillStyle = Math.random() < .5 ? "#19e6ff" : "#ff2b9d";
        ctx.fillRect(-20, y, W + 40, h);
        ctx.globalAlpha = .08;
        ctx.fillStyle = "#fff";
        ctx.fillRect(-20, y + h * .45, W + 40, 1);
    }

    if (Math.random() < .012) {
        ctx.globalAlpha = .06;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, Math.random() * H, W, 3 + Math.random() * 8);
    }

    ctx.restore();
}

function drawEnvironment() {
    const environment = Math.floor((currentWave - 1) / ENVIRONMENT_EVERY_WAVES);
    const phase = environment % 4;

    const backgrounds = [
        ["#050608", "#0b1118"],
        ["#080508", "#180b18"],
        ["#05090a", "#081b1c"],
        ["#090706", "#1a1209"]
    ];

    const [top, bottom] = backgrounds[phase];
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(-30, -30, W + 60, H + 60);

    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = phase === 1 ? "#ff2b9d" : phase === 2 ? "#19e6ff" : "#fff";
    ctx.lineWidth = 1;

    if (phase % 2 === 0) {
        for (let y = 80; y < H; y += 55) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    } else {
        for (let x = -H; x < W + H; x += 90) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + H, H);
            ctx.stroke();
        }
    }

    ctx.globalAlpha = .06;
    for (let i = 0; i < 5; i++) {
        const y = 120 + i * 125 + Math.sin(performance.now() * .0006 + i) * 18;
        ctx.fillRect(-20, y, W + 40, 2 + phase);
    }
    ctx.restore();
}

function drawStars() {
    for (const s of stars) {
        ctx.fillStyle = `rgba(255,255,255,${.25 + s.size / 3})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    }
}

function drawPlayer() {
    ctx.save();

    if (damageCooldown > 0) {
        ctx.globalAlpha = Math.floor(damageCooldown * 12) % 2 === 0 ? 0.45 : 1;
    }
    ctx.translate(player.x, player.y);

    ctx.shadowBlur = 18;
    ctx.shadowColor = "#fff";

    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(-23, 25);
    ctx.lineTo(0, 14);
    ctx.lineTo(23, 25);
    ctx.closePath();

    ctx.fillStyle = "#aaa";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(0, -6, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#eee";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-7, 20);
    ctx.lineTo(7, 20);
    ctx.lineTo(0, 34 + Math.random() * 10);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.restore();
}

function drawBullets() {
    for (const b of bullets) {
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#fff";
        ctx.fillStyle = "#fff";
        ctx.fillRect(b.x - 2.5, b.y, 5, b.height);
        ctx.shadowBlur = 0;
    }
}

function drawEnemyBullets() {
    for (const b of enemyBullets) {
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ff2b9d";
        ctx.fillStyle = "#ff2b9d";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawBoss() {
    if (!boss) return;
    const type = BOSS_TYPES[boss.typeIndex];
    const t = performance.now() * .001;

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.shadowBlur = 24;
    ctx.shadowColor = type.color;
    ctx.strokeStyle = type.color;
    ctx.fillStyle = "#0b0b0d";
    ctx.lineWidth = 3;

    if (boss.typeIndex === 0) {
        ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = type.color; ctx.beginPath(); ctx.ellipse(0, 0, 28, 16, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.arc(Math.sin(t)*7, 0, 7, 0, Math.PI*2); ctx.fill();
    } else if (boss.typeIndex === 1) {
        ctx.beginPath(); ctx.rect(-72, -42, 144, 84); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = type.color; ctx.beginPath(); ctx.ellipse(0, 8, 46, 22, 0, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-30, 8); ctx.quadraticCurveTo(0, 30 + Math.sin(t)*5, 30, 8); ctx.stroke();
    } else if (boss.typeIndex === 2) {
        ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0,0,36,0,Math.PI*1.6); ctx.stroke();
        ctx.lineWidth = 3;
        for (let i=0;i<12;i++){ const a=i*Math.PI/6; ctx.beginPath(); ctx.moveTo(Math.cos(a)*44,Math.sin(a)*44); ctx.lineTo(Math.cos(a)*54,Math.sin(a)*54); ctx.stroke(); }
        ctx.fillStyle = type.color; ctx.beginPath(); ctx.arc(Math.cos(t)*22, Math.sin(t)*22, 6, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.beginPath(); ctx.rect(-78,-45,156,90); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-48,-45); ctx.lineTo(-48,-72); ctx.lineTo(48,-72); ctx.lineTo(48,-45); ctx.stroke();
        ctx.fillStyle = type.color; ctx.fillRect(-36,-8,24,5); ctx.fillRect(12,-8,24,5);
        ctx.strokeStyle = type.color; ctx.beginPath(); ctx.arc(0,12,22,0,Math.PI); ctx.stroke();
    }

    ctx.restore();

    if (bossDialogueTimer > 0) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.font = "bold 13px monospace";
        ctx.fillStyle = type.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = type.color;
        ctx.fillText(`> ${bossDialogue}`, boss.x, boss.y + 88);
        ctx.restore();
    }
}

function drawEnemies() {
    for (const e of enemies) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rotation);

        if (e.type === "boss") {
            ctx.shadowBlur = 25;
            ctx.shadowColor = "rgba(255,255,255,.5)";
        } else if (e.type === "elite") {
            ctx.shadowBlur = 15;
            ctx.shadowColor = "rgba(255,255,255,.35)";
        }

        ctx.beginPath();

        for (let i = 0; i < e.shape.length; i++) {
            const angle = Math.PI * 2 * i / e.shape.length;
            const radius = e.size * e.shape[i];
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();

        ctx.fillStyle = e.type === "boss" ? "#181818" : e.type === "elite" ? "#252525" : "#333";
        ctx.fill();
        ctx.strokeStyle = e.type === "boss" ? "#fff" : "#aaa";
        ctx.lineWidth = e.type === "boss" ? 3 : 2;
        ctx.stroke();

        if (e.type !== "asteroid") {
            ctx.rotate(-e.rotation);

            const barWidth = e.size * 1.45;
            const hpRatio = e.hp / e.maxHp;

            ctx.fillStyle = "rgba(255,255,255,.18)";
            ctx.fillRect(-barWidth / 2, -e.size - 13, barWidth, 4);

            ctx.fillStyle = "#fff";
            ctx.fillRect(-barWidth / 2, -e.size - 13, barWidth * hpRatio, 4);
        }

        ctx.restore();
    }
}

function drawParticles() {
    for (const p of particles) {
        const alpha = Math.max(0, p.life / p.maxLife);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.globalAlpha = 1;
}

function drawShockwaves() {
    for (const s of shockwaves) {
        ctx.globalAlpha = Math.max(0, s.life / .35);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawHud() {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`SCORE ${score}`, 20, 32);

    ctx.font = "18px Arial";
    ctx.fillText(`SIGNAL ${"■".repeat(health)}${"□".repeat(Math.max(0, MAX_HEALTH - health))}`, 20, 60);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#888";
    ctx.fillText(`ARMOR ${"◆".repeat(armor)}${"◇".repeat(MAX_ARMOR - armor)}`, 20, 78);
    if (doubleShotTimer > 0) {
        ctx.fillStyle = "#ff2b9d";
        ctx.fillText(`DOUBLE FIRE ${Math.ceil(doubleShotTimer)}s`, 20, 94);
    }
    ctx.fillStyle = altCharge >= ALT_MAX_CHARGE ? "#fff" : "#888";
    ctx.fillText(`ALT [E] ${Math.floor(altCharge)}%`, 20, 94 + (doubleShotTimer > 0 ? 16 : 0));

    ctx.textAlign = "right";
    ctx.font = "bold 15px Arial";
    ctx.fillStyle = "#aaa";
    ctx.fillStyle = currentWave % 2 ? "#19e6ff" : "#ff2b9d";
    ctx.fillText(`WAVE ${currentWave}`, W - 20, 30);

    ctx.font = "11px Arial";
    ctx.fillStyle = bossActive ? "#ff2b9d" : "#666";
    ctx.fillText(bossActive ? `${boss ? BOSS_TYPES[boss.typeIndex].name : "SIGNAL LOCKED"}` : `NEXT WAVE ${Math.max(0, Math.ceil(WAVE_DURATION - waveTimer))}s`, W - 20, 66);

    ctx.font = "11px Arial";
    ctx.fillStyle = "#666";
    ctx.fillText("The Signal", W - 20, 50);

    if (boss) {
        const type = BOSS_TYPES[boss.typeIndex];
        const barW = 330;
        const ratio = Math.max(0, boss.hp / boss.maxHp);
        ctx.textAlign = "center";
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = type.color;
        ctx.fillText(type.name, W / 2, 29);
        ctx.fillStyle = "rgba(255,255,255,.15)";
        ctx.fillRect(W / 2 - barW / 2, 38, barW, 6);
        ctx.fillStyle = type.color;
        ctx.fillRect(W / 2 - barW / 2, 38, barW * ratio, 6);
    }

    ctx.textAlign = "left";
}

function drawWave() {
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, waveTextTimer);

    ctx.fillStyle = currentWave % 2 ? "#19e6ff" : "#ff2b9d";
    ctx.font = "bold 48px Arial";
    ctx.shadowBlur = 18;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillText(bossActive ? (boss ? BOSS_TYPES[boss.typeIndex].name : "SIGNAL LOCKED") : `WAVE ${currentWave}`, W / 2, H / 2 - 15);
    ctx.shadowBlur = 0;

    ctx.font = "13px Arial";
    ctx.fillStyle = "#aaa";
    ctx.fillText(
        bossActive ? `SIGNAL LOCKED // ${boss ? BOSS_TYPES[boss.typeIndex].name : "INCOMING"}` : currentWave > 1 && currentWave % ENVIRONMENT_EVERY_WAVES === 1 ? "ENVIRONMENT SHIFT // NEW FREQUENCY" : "SIGNAL INTENSITY INCREASING",
        W / 2,
        H / 2 + 18
    );

    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
}

function drawPause() {
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 58px Arial";
    ctx.fillText("PAUSED", W / 2, H / 2);

    ctx.font = "15px Arial";
    ctx.fillStyle = "#aaa";
    ctx.fillText("PRESS P TO CONTINUE", W / 2, H / 2 + 35);

    ctx.textAlign = "left";
}
