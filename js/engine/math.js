/**
 * Module mathématique pour le jeu de géodésiques
 * Fonctions vectorielles et matricielles
 */

// ===== VECTEURS =====

export function vec3(x = 0, y = 0, z = 0) {
    return { x, y, z };
}

export function vec2(x = 0, y = 0) {
    return { x, y };
}

export function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

export function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

export function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length2D(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize2D(v) {
    const len = length2D(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

export function add2D(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

export function sub2D(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function scale2D(v, s) {
    return { x: v.x * s, y: v.y * s };
}

export function distance2D(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// ===== MATRICES 4x4 =====

export function mat4Identity() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

export function mat4Perspective(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ]);
}

export function mat4LookAt(eye, center, up) {
    const z = normalize([
        eye[0] - center[0],
        eye[1] - center[1],
        eye[2] - center[2]
    ]);
    const x = normalize(cross(up, z));
    const y = cross(z, x);

    return new Float32Array([
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
}

export function rotateVectorAroundAxis(vec, axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;

    const ax = axis[0], ay = axis[1], az = axis[2];
    const x = vec[0], y = vec[1], z = vec[2];

    return [
        (t * ax * ax + c) * x + (t * ax * ay - s * az) * y + (t * ax * az + s * ay) * z,
        (t * ax * ay + s * az) * x + (t * ay * ay + c) * y + (t * ay * az - s * ax) * z,
        (t * ax * az - s * ay) * x + (t * ay * az + s * ax) * y + (t * az * az + c) * z
    ];
}

// ===== UTILITAIRES =====

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

export function radToDeg(radians) {
    return radians * 180 / Math.PI;
}