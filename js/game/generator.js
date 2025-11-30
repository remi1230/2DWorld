/**
 * Module Generator
 * Génération procédurale de niveaux
 */

import { Level } from './level.js';
import { computeTrajectory, setMasses } from '../engine/physics.js';

// ===== PARAMÈTRES DE GÉNÉRATION =====

const generationParams = {
    // Progression de la difficulté
    baseMassCount: 1,
    massCountGrowth: 0.3,      // +0.3 masse par niveau
    maxMasses: 6,

    baseStrength: 1.0,
    strengthGrowth: 0.1,       // +0.1 force par niveau
    maxStrength: 3.5,

    baseGoalRadius: 0.5,
    goalRadiusShrink: 0.02,    // -0.02 rayon par niveau
    minGoalRadius: 0.25,

    // Distance départ-arrivée
    baseDistance: 6,
    distanceGrowth: 0.2,
    maxDistance: 8,

    // Zone de jeu
    bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    margin: 0.8
};

// ===== GÉNÉRATEUR DE NOMBRES ALÉATOIRES SEEDED =====

class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }

    int(min, max) {
        return Math.floor(this.range(min, max + 1));
    }

    choice(array) {
        return array[this.int(0, array.length - 1)];
    }
}

// ===== FONCTIONS DE GÉNÉRATION =====

function generateStartAndGoal(rng, levelId, params) {
    const p = params;
    const distance = Math.min(
        p.baseDistance + p.distanceGrowth * levelId,
        p.maxDistance
    );

    // Angle aléatoire pour la direction départ -> arrivée
    const angle = rng.range(0, Math.PI * 2);
    const halfDist = distance / 2;

    // Centre légèrement décalé du milieu
    const centerX = rng.range(-1, 1);
    const centerY = rng.range(-1, 1);

    const startPos = {
        x: centerX - Math.cos(angle) * halfDist,
        y: centerY - Math.sin(angle) * halfDist
    };

    const goalPos = {
        x: centerX + Math.cos(angle) * halfDist,
        y: centerY + Math.sin(angle) * halfDist
    };

    // Clamper aux bounds avec marge
    const clamp = (pos) => ({
        x: Math.max(p.bounds.minX + p.margin, Math.min(p.bounds.maxX - p.margin, pos.x)),
        y: Math.max(p.bounds.minY + p.margin, Math.min(p.bounds.maxY - p.margin, pos.y))
    });

    return {
        startPos: clamp(startPos),
        goalPos: clamp(goalPos)
    };
}

function generateMasses(rng, levelId, startPos, goalPos, params) {
    const p = params;
    const masses = [];

    // Nombre de masses
    const massCount = Math.min(
        Math.floor(p.baseMassCount + p.massCountGrowth * levelId),
        p.maxMasses
    );

    // Force moyenne des masses
    const avgStrength = Math.min(
        p.baseStrength + p.strengthGrowth * levelId,
        p.maxStrength
    );

    // Direction départ -> arrivée
    const dx = goalPos.x - startPos.x;
    const dy = goalPos.y - startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / dist;
    const dirY = dy / dist;

    for (let i = 0; i < massCount; i++) {
        let attempts = 0;
        let mass = null;

        while (attempts < 50) {
            // Position le long du chemin avec décalage perpendiculaire
            const t = rng.range(0.2, 0.8);
            const perpOffset = rng.range(-2, 2);

            const x = startPos.x + dirX * dist * t - dirY * perpOffset;
            const y = startPos.y + dirY * dist * t + dirX * perpOffset;

            // Vérifier qu'on n'est pas trop près du départ/arrivée
            const distToStart = Math.sqrt((x - startPos.x) ** 2 + (y - startPos.y) ** 2);
            const distToGoal = Math.sqrt((x - goalPos.x) ** 2 + (y - goalPos.y) ** 2);

            if (distToStart > 1.0 && distToGoal > 1.0) {
                // Vérifier la distance aux autres masses
                let tooClose = false;
                for (const m of masses) {
                    const d = Math.sqrt((x - m.x) ** 2 + (y - m.y) ** 2);
                    if (d < 1.5) {
                        tooClose = true;
                        break;
                    }
                }

                if (!tooClose) {
                    // Variation de force
                    const strength = avgStrength * rng.range(0.7, 1.3);
                    mass = { x, y, strength };
                    break;
                }
            }

            attempts++;
        }

        if (mass) {
            masses.push(mass);
        }
    }

    return masses;
}

function validateLevel(level) {
    // Vérifier qu'il existe au moins une trajectoire possible
    setMasses(level.masses);

    // Tester plusieurs angles et puissances
    for (let angle = 0; angle < 360; angle += 15) {
        for (let power = 1; power <= 5; power += 0.5) {
            const radAngle = angle * Math.PI / 180;
            const vel = {
                x: Math.cos(radAngle) * power,
                y: Math.sin(radAngle) * power
            };

            const result = computeTrajectory(
                level.startPos,
                vel,
                {
                    maxSteps: 2000,
                    dt: 0.01,
                    bounds: level.bounds,
                    goalPos: level.goalPos,
                    goalRadius: level.goalRadius
                }
            );

            if (result.reachedGoal) {
                return true;
            }
        }
    }

    return false;
}

// ===== FONCTION PRINCIPALE DE GÉNÉRATION =====

export function generateLevel(levelId, seed = null) {
    // Utiliser levelId comme seed par défaut pour reproductibilité
    const actualSeed = seed !== null ? seed : levelId * 12345;
    const rng = new SeededRandom(actualSeed);

    const params = generationParams;

    // Rayon de l'objectif (diminue avec la difficulté)
    const goalRadius = Math.max(
        params.baseGoalRadius - params.goalRadiusShrink * levelId,
        params.minGoalRadius
    );

    let level = null;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
        const { startPos, goalPos } = generateStartAndGoal(rng, levelId, params);
        const masses = generateMasses(rng, levelId, startPos, goalPos, params);

        const candidateLevel = new Level({
            id: levelId,
            name: `Niveau ${levelId}`,
            description: generateDescription(levelId, masses.length),
            startPos,
            goalPos,
            goalRadius,
            masses,
            bounds: params.bounds,
            difficulty: levelId,
            parShots: 1
        });

        if (validateLevel(candidateLevel)) {
            level = candidateLevel;
            break;
        }

        attempts++;
        rng.seed = actualSeed + attempts * 1000; // Nouveau seed
    }

    if (!level) {
        // Fallback: niveau simple garanti jouable
        level = new Level({
            id: levelId,
            name: `Niveau ${levelId}`,
            description: "Un défi cosmique vous attend.",
            startPos: { x: -3, y: 0 },
            goalPos: { x: 3, y: 0 },
            goalRadius,
            masses: [{ x: 0, y: 0, strength: 1.5 }],
            bounds: params.bounds,
            difficulty: levelId,
            parShots: 1
        });
    }

    return level;
}

function generateDescription(levelId, massCount) {
    const descriptions = [
        `${massCount} masse${massCount > 1 ? 's' : ''} courbe${massCount > 1 ? 'nt' : ''} l'espace-temps.`,
        `Naviguez à travers ${massCount} puits gravitationnel${massCount > 1 ? 's' : ''}.`,
        `La courbure de l'espace cache le chemin.`,
        `Chaque trajectoire est une géodésique.`,
        `L'univers conspire... ou vous aide ?`
    ];

    const prefixes = [
        "Difficulté croissante.",
        "La précision est clé.",
        "Observez la courbure.",
        "Faites confiance à la physique.",
        "Einstein approuverait."
    ];

    const rng = new SeededRandom(levelId);
    return `${rng.choice(descriptions)} ${rng.choice(prefixes)}`;
}

// ===== GÉNÉRATION PAR LOT =====

export function generateLevelBatch(startId, count) {
    const levels = [];
    for (let i = 0; i < count; i++) {
        levels.push(generateLevel(startId + i));
    }
    return levels;
}