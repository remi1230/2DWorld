/**
 * Module physique pour le jeu de géodésiques
 * Calcul de la courbure gaussienne et intégration des géodésiques
 */

import { vec2, add2D, scale2D, length2D } from './math.js';

// ===== CONFIGURATION DES MASSES =====

let masses = [];

export function setMasses(newMasses) {
    masses = newMasses;
}

export function getMasses() {
    return masses;
}

// ===== CALCUL DE LA HAUTEUR GRAVITATIONNELLE =====
// Identique au shader pour cohérence

export function gravitationalHeight(x, y) {
    let height = 0;

    for (const mass of masses) {
        const dx = x - mass.x;
        const dy = y - mass.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        height -= mass.strength / (dist + 0.5);
    }

    return height;
}

// ===== CALCUL DU GRADIENT (dérivées partielles) =====

export function computeGradient(x, y, eps = 0.01) {
    const z0 = gravitationalHeight(x, y);
    const zx = gravitationalHeight(x + eps, y);
    const zy = gravitationalHeight(x, y + eps);

    return {
        dzdx: (zx - z0) / eps,
        dzdy: (zy - z0) / eps
    };
}

// ===== CALCUL DE LA MÉTRIQUE =====
// g_ij = métrique induite sur la surface z = f(x,y)
// g = [[1 + (∂z/∂x)², (∂z/∂x)(∂z/∂y)],
//      [(∂z/∂x)(∂z/∂y), 1 + (∂z/∂y)²]]

export function computeMetric(x, y) {
    const { dzdx, dzdy } = computeGradient(x, y);

    return {
        g11: 1 + dzdx * dzdx,
        g12: dzdx * dzdy,
        g21: dzdx * dzdy,
        g22: 1 + dzdy * dzdy
    };
}

// ===== CALCUL DES SYMBOLES DE CHRISTOFFEL =====
// Γⁱⱼₖ = ½ gⁱˡ (∂gₗⱼ/∂xᵏ + ∂gₗₖ/∂xʲ - ∂gⱼₖ/∂xˡ)

export function computeChristoffel(x, y, eps = 0.02) {
    // Métriques aux points voisins
    const g = computeMetric(x, y);
    const gxp = computeMetric(x + eps, y);
    const gxm = computeMetric(x - eps, y);
    const gyp = computeMetric(x, y + eps);
    const gym = computeMetric(x, y - eps);

    // Dérivées de la métrique
    const dg11dx = (gxp.g11 - gxm.g11) / (2 * eps);
    const dg11dy = (gyp.g11 - gym.g11) / (2 * eps);
    const dg12dx = (gxp.g12 - gxm.g12) / (2 * eps);
    const dg12dy = (gyp.g12 - gym.g12) / (2 * eps);
    const dg22dx = (gxp.g22 - gxm.g22) / (2 * eps);
    const dg22dy = (gyp.g22 - gym.g22) / (2 * eps);

    // Inverse de la métrique
    const det = g.g11 * g.g22 - g.g12 * g.g21;
    const gi11 = g.g22 / det;
    const gi12 = -g.g12 / det;
    const gi21 = -g.g21 / det;
    const gi22 = g.g11 / det;

    // Symboles de Christoffel complets pour surface 2D
    // Γⁱⱼₖ = ½ gⁱˡ (∂gₗⱼ/∂xᵏ + ∂gₗₖ/∂xʲ - ∂gⱼₖ/∂xˡ)
    
    // Γ¹₁₁ = ½ g¹ˡ (∂gₗ₁/∂x¹ + ∂gₗ₁/∂x¹ - ∂g₁₁/∂xˡ)
    const G111 = 0.5 * (gi11 * dg11dx + gi12 * (2 * dg12dx - dg11dy));
    
    // Γ¹₁₂ = Γ¹₂₁ = ½ g¹ˡ (∂gₗ₁/∂x² + ∂gₗ₂/∂x¹ - ∂g₁₂/∂xˡ)
    const G112 = 0.5 * (gi11 * dg11dy + gi12 * dg22dx);
    
    // Γ¹₂₂ = ½ g¹ˡ (∂gₗ₂/∂x² + ∂gₗ₂/∂x² - ∂g₂₂/∂xˡ)
    const G122 = 0.5 * (gi11 * (2 * dg12dy - dg22dx) + gi12 * dg22dy);
    
    // Γ²₁₁ = ½ g²ˡ (∂gₗ₁/∂x¹ + ∂gₗ₁/∂x¹ - ∂g₁₁/∂xˡ)
    const G211 = 0.5 * (gi21 * dg11dx + gi22 * (2 * dg12dx - dg11dy));
    
    // Γ²₁₂ = Γ²₂₁ = ½ g²ˡ (∂gₗ₁/∂x² + ∂gₗ₂/∂x¹ - ∂g₁₂/∂xˡ)
    const G212 = 0.5 * (gi21 * dg11dy + gi22 * dg22dx);
    
    // Γ²₂₂ = ½ g²ˡ (∂gₗ₂/∂x² + ∂gₗ₂/∂x² - ∂g₂₂/∂xˡ)
    const G222 = 0.5 * (gi21 * (2 * dg12dy - dg22dx) + gi22 * dg22dy);

    return { G111, G112, G122, G211, G212, G222 };
}

// ===== CALCUL DE LA COURBURE GAUSSIENNE =====

export function computeGaussianCurvature(x, y, eps = 0.05) {
    const z0 = gravitationalHeight(x, y);

    // Dérivées secondes
    const zxx = gravitationalHeight(x + eps, y) - 2 * z0 + gravitationalHeight(x - eps, y);
    const zyy = gravitationalHeight(x, y + eps) - 2 * z0 + gravitationalHeight(x, y - eps);
    const zxy = (
        gravitationalHeight(x + eps, y + eps) -
        gravitationalHeight(x + eps, y - eps) -
        gravitationalHeight(x - eps, y + eps) +
        gravitationalHeight(x - eps, y - eps)
    ) / 4;

    const { dzdx, dzdy } = computeGradient(x, y, eps);

    // Formule de la courbure gaussienne pour z = f(x,y)
    const eps2 = eps * eps;
    const fxx = zxx / eps2;
    const fyy = zyy / eps2;
    const fxy = zxy / eps2;

    const denom = (1 + dzdx * dzdx + dzdy * dzdy);
    const K = (fxx * fyy - fxy * fxy) / (denom * denom);

    return K;
}

// ===== ÉQUATION DES GÉODÉSIQUES =====
// Pour un gameplay réaliste, on intègre en temps coordonné (pas en paramètre affine)
// Ainsi une particule lente passe plus de temps dans la zone courbée

function geodesicAcceleration(pos, vel) {
    const G = computeChristoffel(pos.x, pos.y);

    const vx = vel.x;
    const vy = vel.y;
    
    // Vitesse totale
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 0.001) return { x: 0, y: 0 };

    // Accélération géodésique de base
    const ax = -(G.G111 * vx * vx + 2 * G.G112 * vx * vy + G.G122 * vy * vy);
    const ay = -(G.G211 * vx * vx + 2 * G.G212 * vx * vy + G.G222 * vy * vy);

    return { x: ax, y: ay };
}

// Force de "gravité effective" - simule l'attraction vers les puits
// C'est l'accélération que subirait une particule au repos
function computeEffectiveGravity(pos) {
    const { dzdx, dzdy } = computeGradient(pos.x, pos.y);
    
    // Le gradient pointe vers le haut de la pente
    // La gravité tire vers le bas (signe négatif)
    const gravityStrength = 2.0;
    
    return {
        x: -dzdx * gravityStrength,
        y: -dzdy * gravityStrength
    };
}

// ===== INTÉGRATION RK4 =====

function totalAcceleration(pos, vel) {
    // Combinaison : géodésique (déviation) + gravité effective (attraction)
    const geodesic = geodesicAcceleration(pos, vel);
    const gravity = computeEffectiveGravity(pos);
    
    return {
        x: geodesic.x + gravity.x,
        y: geodesic.y + gravity.y
    };
}

export function integrateRK4(pos, vel, dt) {
    // k1
    const a1 = totalAcceleration(pos, vel);
    const k1v = scale2D(a1, dt);
    const k1p = scale2D(vel, dt);

    // k2
    const pos2 = add2D(pos, scale2D(k1p, 0.5));
    const vel2 = add2D(vel, scale2D(k1v, 0.5));
    const a2 = totalAcceleration(pos2, vel2);
    const k2v = scale2D(a2, dt);
    const k2p = scale2D(vel2, dt);

    // k3
    const pos3 = add2D(pos, scale2D(k2p, 0.5));
    const vel3 = add2D(vel, scale2D(k2v, 0.5));
    const a3 = totalAcceleration(pos3, vel3);
    const k3v = scale2D(a3, dt);
    const k3p = scale2D(vel3, dt);

    // k4
    const pos4 = add2D(pos, k3p);
    const vel4 = add2D(vel, k3v);
    const a4 = totalAcceleration(pos4, vel4);
    const k4v = scale2D(a4, dt);
    const k4p = scale2D(vel4, dt);

    // Combinaison finale
    const newPos = {
        x: pos.x + (k1p.x + 2 * k2p.x + 2 * k3p.x + k4p.x) / 6,
        y: pos.y + (k1p.y + 2 * k2p.y + 2 * k3p.y + k4p.y) / 6
    };

    const newVel = {
        x: vel.x + (k1v.x + 2 * k2v.x + 2 * k3v.x + k4v.x) / 6,
        y: vel.y + (k1v.y + 2 * k2v.y + 2 * k3v.y + k4v.y) / 6
    };

    return { pos: newPos, vel: newVel };
}

// ===== CALCUL DE TRAJECTOIRE COMPLÈTE =====

export function computeTrajectory(startPos, startVel, options = {}) {
    const {
        maxSteps = 15000,
        dt = 0.01,
        bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 },
        goalPos = null,
        goalRadius = 0.3
    } = options;

    const trajectory = [];
    let pos = { ...startPos };
    let vel = { ...startVel };
    let reachedGoal = false;
    let outOfBounds = false;

    for (let i = 0; i < maxSteps; i++) {
        trajectory.push({ x: pos.x, y: pos.y, z: gravitationalHeight(pos.x, pos.y) });

        // Vérifier si on a atteint l'objectif
        if (goalPos) {
            const distToGoal = length2D({ x: pos.x - goalPos.x, y: pos.y - goalPos.y });
            if (distToGoal < goalRadius) {
                reachedGoal = true;
                break;
            }
        }

        // Vérifier les limites
        if (pos.x < bounds.minX || pos.x > bounds.maxX ||
            pos.y < bounds.minY || pos.y > bounds.maxY) {
            outOfBounds = true;
            break;
        }

        // Intégration
        const result = integrateRK4(pos, vel, dt);
        pos = result.pos;
        vel = result.vel;

        // Éviter les singularités (trop proche d'une masse)
        let tooClose = false;
        for (const mass of masses) {
            const dist = length2D({ x: pos.x - mass.x, y: pos.y - mass.y });
            if (dist < 0.3) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) break;
    }

    return {
        points: trajectory,
        reachedGoal,
        outOfBounds,
        finalPos: pos
    };
}