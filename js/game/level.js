/**
 * Module Level
 * Configuration et gestion des niveaux
 */

export class Level {
    constructor(config) {
        this.id = config.id || 1;
        this.name = config.name || `Niveau ${this.id}`;
        this.description = config.description || '';

        // Zone de jeu
        this.bounds = config.bounds || {
            minX: -5,
            maxX: 5,
            minY: -5,
            maxY: 5
        };

        // Position de départ du projectile
        this.startPos = config.startPos || { x: -3, y: -3 };

        // Position de l'objectif (portail)
        this.goalPos = config.goalPos || { x: 3, y: 3 };
        this.goalRadius = config.goalRadius || 0.4;

        // Masses qui courbent l'espace
        this.masses = config.masses || [];

        // Paramètres de difficulté
        this.difficulty = config.difficulty || 1;
        this.maxAttempts = config.maxAttempts || Infinity;
        this.parShots = config.parShots || 1; // Nombre de tirs "par" (comme au golf)
    }

    toGameState() {
        return {
            masses: this.masses,
            startPos: this.startPos,
            goalPos: this.goalPos,
            goalRadius: this.goalRadius,
            bounds: this.bounds
        };
    }
}

// ===== NIVEAU 1 : TUTORIEL =====

export const level1 = new Level({
    id: 1,
    name: "Premier Contact",
    description: "Une seule masse entre vous et la sortie. Observez comment l'espace se courbe.",
    startPos: { x: -3.5, y: 0 },
    goalPos: { x: 3.5, y: 0 },
    goalRadius: 0.5,
    masses: [
        { x: 0, y: 0, strength: 1.5 }
    ],
    difficulty: 1,
    parShots: 1
});

// ===== NIVEAU 2 : DEUX CORPS =====

export const level2 = new Level({
    id: 2,
    name: "Danse Binaire",
    description: "Deux masses créent un couloir gravitationnel. Trouvez le chemin.",
    startPos: { x: -3.5, y: -2 },
    goalPos: { x: 3.5, y: 2 },
    goalRadius: 0.45,
    masses: [
        { x: -1, y: 1, strength: 1.2 },
        { x: 1, y: -1, strength: 1.2 }
    ],
    difficulty: 2,
    parShots: 1
});

// ===== NIVEAU 3 : LA FRONDE =====

export const level3 = new Level({
    id: 3,
    name: "Assistance Gravitationnelle",
    description: "Utilisez la gravité à votre avantage pour atteindre l'objectif.",
    startPos: { x: -4, y: -3 },
    goalPos: { x: -4, y: 3 },
    goalRadius: 0.4,
    masses: [
        { x: 0, y: 0, strength: 2.0 }
    ],
    difficulty: 3,
    parShots: 1
});

// ===== NIVEAU 4 : SLALOM =====

export const level4 = new Level({
    id: 4,
    name: "Slalom Cosmique",
    description: "Naviguez entre plusieurs masses sans vous faire capturer.",
    startPos: { x: -4, y: 0 },
    goalPos: { x: 4, y: 0 },
    goalRadius: 0.4,
    masses: [
        { x: -2, y: 1.5, strength: 1.0 },
        { x: 0, y: -1.5, strength: 1.0 },
        { x: 2, y: 1.5, strength: 1.0 }
    ],
    difficulty: 4,
    parShots: 1
});

// ===== NIVEAU 5 : LE TROU NOIR =====

export const level5 = new Level({
    id: 5,
    name: "Horizon des Événements",
    description: "Une masse dominante. Ne vous approchez pas trop près.",
    startPos: { x: -4, y: -4 },
    goalPos: { x: 4, y: 4 },
    goalRadius: 0.35,
    masses: [
        { x: 0, y: 0, strength: 3.0 },
        { x: 3, y: -2, strength: 0.5 }
    ],
    difficulty: 5,
    parShots: 1
});

// Liste de tous les niveaux prédéfinis
export const predefinedLevels = [level1, level2, level3, level4, level5];

// Fonction pour obtenir un niveau par son ID
export function getLevelById(id) {
    return predefinedLevels.find(l => l.id === id) || null;
}