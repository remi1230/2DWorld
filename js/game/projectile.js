/**
 * Module Projectile
 * Gestion de l'état et du comportement du projectile
 */

import { vec2, length2D, normalize2D, scale2D, add2D } from '../engine/math.js';
import { gravitationalHeight, integrateRK4, computeTrajectory, getMasses } from '../engine/physics.js';

export const ProjectileState = {
    IDLE: 'idle',
    AIMING: 'aiming',
    FLYING: 'flying',
    FINISHED: 'finished'
};

export class Projectile {
    constructor() {
        this.reset();
    }

    reset() {
        this.pos = { x: 0, y: 0 };
        this.vel = { x: 0, y: 0 };
        this.state = ProjectileState.IDLE;
        this.trajectory = [];
        this.currentTrajectoryIndex = 0;
        this.previewTrajectory = [];
    }

    setStartPosition(x, y) {
        this.pos = { x, y };
        this.startPos = { x, y };
    }

    setAimParameters(angle, power) {
        this.angle = angle;
        this.power = power;

        // Calculer la vitesse initiale
        const radAngle = angle * Math.PI / 180;
        this.vel = {
            x: Math.cos(radAngle) * power,
            y: Math.sin(radAngle) * power
        };
    }

    computePreview(goalPos, goalRadius, bounds) {
        if (this.state !== ProjectileState.AIMING) return;

        const result = computeTrajectory(
            this.pos,
            this.vel,
            {
                maxSteps: 2000,
                dt: 0.01,
                bounds,
                goalPos,
                goalRadius
            }
        );

        this.previewTrajectory = result.points;
        this.previewResult = result;
    }

    launch() {
        if (this.previewTrajectory.length === 0) return;

        this.state = ProjectileState.FLYING;
        this.trajectory = this.previewTrajectory;
        this.currentTrajectoryIndex = 0;
    }

    update(dt, speed = 1) {
        if (this.state !== ProjectileState.FLYING) return null;

        // Avancer le long de la trajectoire pré-calculée
        this.currentTrajectoryIndex += speed;

        if (this.currentTrajectoryIndex >= this.trajectory.length) {
            this.state = ProjectileState.FINISHED;
            return {
                finished: true,
                reachedGoal: this.previewResult?.reachedGoal || false
            };
        }

        const idx = Math.floor(this.currentTrajectoryIndex);
        const point = this.trajectory[idx];
        this.pos = { x: point.x, y: point.y };

        return {
            finished: false,
            position: { ...this.pos, z: point.z }
        };
    }

    getPosition3D() {
        const z = gravitationalHeight(this.pos.x, this.pos.y);
        return { x: this.pos.x, y: this.pos.y, z };
    }

    getCurrentTrajectory() {
        if (this.state === ProjectileState.AIMING) {
            return this.previewTrajectory;
        } else if (this.state === ProjectileState.FLYING) {
            // Retourner seulement la partie non parcourue
            return this.trajectory.slice(Math.floor(this.currentTrajectoryIndex));
        }
        return [];
    }
}