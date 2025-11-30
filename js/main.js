/**
 * Module principal du jeu
 * Orchestre tous les composants
 */

import { Renderer } from './engine/renderer.js';
import { setMasses, gravitationalHeight } from './engine/physics.js';
import { Projectile, ProjectileState } from './game/projectile.js';
import { predefinedLevels, getLevelById } from './game/level.js';
import { generateLevel } from './game/generator.js';

// ===== ÉTAT DU JEU =====

const GamePhase = {
    MENU: 'menu',
    AIMING: 'aiming',
    FLYING: 'flying',
    SUCCESS: 'success',
    FAILED: 'failed'
};

class Game {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.renderer = new Renderer(this.canvas);
        this.projectile = new Projectile();

        this.currentLevel = null;
        this.currentLevelId = 1;
        this.phase = GamePhase.MENU;
        this.attempts = 0;
        this.totalShots = 0;

        // Paramètres de visée
        this.aimAngle = 45;
        this.aimPower = 2;

        // Animation
        this.lastTime = 0;
        this.animationSpeed = 2;

        this.setupUI();
        this.loadLevel(1);
        this.startRenderLoop();
    }

    setupUI() {
        // Contrôles de visée
        const angleSlider = document.getElementById('angle');
        const powerSlider = document.getElementById('power');
        const launchBtn = document.getElementById('launchBtn');
        const resetBtn = document.getElementById('resetBtn');
        const nextBtn = document.getElementById('nextBtn');

        angleSlider?.addEventListener('input', (e) => {
            this.aimAngle = parseFloat(e.target.value);
            document.getElementById('angleVal').textContent = `${this.aimAngle}°`;
            this.updateAim();
        });

        powerSlider?.addEventListener('input', (e) => {
            this.aimPower = parseFloat(e.target.value);
            document.getElementById('powerVal').textContent = this.aimPower.toFixed(1);
            this.updateAim();
        });

        launchBtn?.addEventListener('click', () => this.launch());
        resetBtn?.addEventListener('click', () => this.resetLevel());
        nextBtn?.addEventListener('click', () => this.nextLevel());

        // Contrôles de caméra
        this.setupCameraControls();

        // Sélection de niveau
        this.setupLevelSelect();
    }

    setupCameraControls() {
        const controls = ['rotX', 'rotY', 'rotZ', 'distance'];
        const suffixes = { rotX: '°', rotY: '°', rotZ: '°', distance: '' };

        for (const id of controls) {
            const slider = document.getElementById(id);
            slider?.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.renderer.camera[id] = value;
                document.getElementById(`${id}Val`).textContent =
                    value.toFixed(id === 'distance' ? 1 : 0) + suffixes[id];
            });
        }
    }

    setupLevelSelect() {
        const select = document.getElementById('levelSelect');
        if (!select) return;

        // Ajouter les niveaux prédéfinis
        for (const level of predefinedLevels) {
            const option = document.createElement('option');
            option.value = level.id;
            option.textContent = `${level.id}. ${level.name}`;
            select.appendChild(option);
        }

        // Option pour les niveaux générés
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '── Niveaux générés ──';
        select.appendChild(separator);

        for (let i = 6; i <= 20; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}. Niveau généré`;
            select.appendChild(option);
        }

        select.addEventListener('change', (e) => {
            this.loadLevel(parseInt(e.target.value));
        });
    }

    loadLevel(levelId) {
        this.currentLevelId = levelId;

        // Charger niveau prédéfini ou générer
        if (levelId <= predefinedLevels.length) {
            this.currentLevel = getLevelById(levelId);
        } else {
            this.currentLevel = generateLevel(levelId);
        }

        // Configurer la physique
        setMasses(this.currentLevel.masses);

        // Réinitialiser le projectile
        this.projectile.reset();
        this.projectile.setStartPosition(
            this.currentLevel.startPos.x,
            this.currentLevel.startPos.y
        );

        // État du jeu
        this.phase = GamePhase.AIMING;
        this.attempts = 0;

        // Mettre à jour l'UI
        this.updateLevelInfo();
        this.updateAim();

        // Activer les boutons
        document.getElementById('launchBtn')?.removeAttribute('disabled');
        document.getElementById('nextBtn')?.setAttribute('disabled', 'true');
    }

    updateLevelInfo() {
        const levelInfo = document.getElementById('levelInfo');
        if (levelInfo && this.currentLevel) {
            levelInfo.innerHTML = `
                <strong>${this.currentLevel.name}</strong><br>
                <span style="color: #888">${this.currentLevel.description}</span>
            `;
        }

        const attemptsDisplay = document.getElementById('attempts');
        if (attemptsDisplay) {
            attemptsDisplay.textContent = this.attempts;
        }
    }

    updateAim() {
        if (this.phase !== GamePhase.AIMING) return;

        this.projectile.state = ProjectileState.AIMING;
        this.projectile.setAimParameters(this.aimAngle, this.aimPower);

        this.projectile.computePreview(
            this.currentLevel.goalPos,
            this.currentLevel.goalRadius,
            this.currentLevel.bounds
        );

        // Mettre à jour la trajectoire dans le renderer
        this.renderer.setTrajectory(this.projectile.previewTrajectory);
    }

    launch() {
        if (this.phase !== GamePhase.AIMING) return;

        this.phase = GamePhase.FLYING;
        this.attempts++;
        this.totalShots++;

        this.projectile.launch();

        document.getElementById('launchBtn')?.setAttribute('disabled', 'true');
        this.updateLevelInfo();
    }

    resetLevel() {
        this.projectile.reset();
        this.projectile.setStartPosition(
            this.currentLevel.startPos.x,
            this.currentLevel.startPos.y
        );

        this.phase = GamePhase.AIMING;
        this.renderer.setTrajectory([]);

        document.getElementById('launchBtn')?.removeAttribute('disabled');
        document.getElementById('nextBtn')?.setAttribute('disabled', 'true');

        this.updateAim();
    }

    nextLevel() {
        this.loadLevel(this.currentLevelId + 1);

        // Mettre à jour le sélecteur
        const select = document.getElementById('levelSelect');
        if (select) {
            select.value = this.currentLevelId;
        }
    }

    update(deltaTime) {
        if (this.phase === GamePhase.FLYING) {
            const result = this.projectile.update(deltaTime, this.animationSpeed);

            if (result?.finished) {
                if (result.reachedGoal) {
                    this.phase = GamePhase.SUCCESS;
                    this.showMessage('🎉 Victoire !', 'success');
                    document.getElementById('nextBtn')?.removeAttribute('disabled');
                } else {
                    this.phase = GamePhase.FAILED;
                    this.showMessage('Raté ! Réessayez.', 'failed');
                    document.getElementById('launchBtn')?.removeAttribute('disabled');
                }
            }

            // Mettre à jour la trajectoire restante
            this.renderer.setTrajectory(this.projectile.getCurrentTrajectory());
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            messageEl.style.display = 'block';

            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 2000);
        }
    }

    getGameState() {
        return {
            masses: this.currentLevel?.masses || [],
            startPos: this.currentLevel?.startPos || { x: 0, y: 0 },
            goalPos: this.currentLevel?.goalPos || { x: 0, y: 0 },
            goalRadius: this.currentLevel?.goalRadius || 0.5,
            projectilePos: this.phase === GamePhase.FLYING ?
                this.projectile.getPosition3D() : null
        };
    }

    startRenderLoop() {
        const loop = (timestamp) => {
            const deltaTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            this.update(deltaTime);
            this.renderer.render(this.getGameState());

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }
}

// ===== INITIALISATION =====

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});