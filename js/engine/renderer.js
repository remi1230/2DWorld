/**
 * Module de rendu WebGL
 * Gestion des shaders et du rendu de la surface
 */

import {
    mat4Perspective,
    mat4LookAt,
    mat4Identity,
    normalize,
    rotateVectorAroundAxis,
    degToRad
} from './math.js';

// ===== SHADERS =====

const vertexShaderSource = `
    precision mediump float;
    precision mediump int;
    
    attribute vec3 aPosition;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform vec2 uMasses[8];
    uniform float uMassStrengths[8];
    uniform int uMassCount;
    
    varying vec3 vWorldPos;
    varying vec2 vGridPos;
    varying vec3 vNormal;
    varying float vCurvature;
    
    float gravitationalHeight(vec2 pos) {
        float height = 0.0;
        
        for (int i = 0; i < 8; i++) {
            if (i >= uMassCount) break;
            float dist = length(pos - uMasses[i]);
            height -= uMassStrengths[i] / (dist + 0.5);
        }
        
        return height;
    }
    
    vec3 computeNormal(vec2 pos) {
        float eps = 0.01;
        float z0 = gravitationalHeight(pos);
        float zx = gravitationalHeight(pos + vec2(eps, 0.0));
        float zy = gravitationalHeight(pos + vec2(0.0, eps));
        
        float dzdx = (zx - z0) / eps;
        float dzdy = (zy - z0) / eps;
        
        vec3 tangentX = vec3(1.0, 0.0, dzdx);
        vec3 tangentY = vec3(0.0, 1.0, dzdy);
        
        return normalize(cross(tangentX, tangentY));
    }
    
    float computeCurvature(vec2 pos) {
        float eps = 0.05;
        float z0 = gravitationalHeight(pos);
        float zxx = gravitationalHeight(pos + vec2(eps, 0.0)) 
                  - 2.0*z0 
                  + gravitationalHeight(pos - vec2(eps, 0.0));
        float zyy = gravitationalHeight(pos + vec2(0.0, eps)) 
                  - 2.0*z0 
                  + gravitationalHeight(pos - vec2(0.0, eps));
        
        return abs(zxx + zyy) / (eps * eps);
    }
    
    void main() {
        vec2 pos2D = aPosition.xy;
        vGridPos = pos2D;
        
        float z = gravitationalHeight(pos2D);
        vNormal = computeNormal(pos2D);
        vCurvature = computeCurvature(pos2D);
        
        vec3 position3D = vec3(pos2D.x, pos2D.y, z);
        
        vec4 worldPos = uModelMatrix * vec4(position3D, 1.0);
        vWorldPos = worldPos.xyz;
        
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    precision mediump int;
    
    varying vec3 vWorldPos;
    varying vec2 vGridPos;
    varying vec3 vNormal;
    varying float vCurvature;
    
    uniform float uGridSize;
    uniform vec3 uLightPos;
    uniform vec3 uCameraPos;
    uniform bool uShowNormals;
    uniform vec2 uMasses[8];
    uniform int uMassCount;
    uniform vec2 uGoalPos;
    uniform float uGoalRadius;
    uniform vec2 uStartPos;
    
    void main() {
        vec2 grid = fract(vGridPos / uGridSize);
        float gridLine = step(0.95, max(grid.x, grid.y));
        
        vec3 baseColor = vec3(0.15, 0.2, 0.35);
        
        if (uShowNormals) {
            gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
            return;
        }
        
        // Éclairage Phong
        vec3 ambient = vec3(0.15);
        
        vec3 lightDir = normalize(uLightPos - vWorldPos);
        float diffuse = max(dot(vNormal, lightDir), 0.0);
        vec3 diffuseColor = vec3(0.6, 0.7, 0.9) * diffuse;
        
        vec3 viewDir = normalize(uCameraPos - vWorldPos);
        vec3 halfDir = normalize(lightDir + viewDir);
        float specular = pow(max(dot(vNormal, halfDir), 0.0), 32.0);
        vec3 specularColor = vec3(1.0) * specular * 0.4;
        
        // Coloration selon la courbure
        float curvatureIntensity = clamp(vCurvature * 0.3, 0.0, 1.0);
        baseColor = mix(
            vec3(0.15, 0.25, 0.4),
            vec3(0.6, 0.2, 0.3),
            curvatureIntensity
        );
        
        // Marquer les masses
        for (int i = 0; i < 8; i++) {
            if (i >= uMassCount) break;
            float distToMass = length(vGridPos - uMasses[i]);
            if (distToMass < 0.2) {
                baseColor = vec3(1.0, 0.8, 0.2);
            }
        }
        
        // Zone de départ (vert)
        float distToStart = length(vGridPos - uStartPos);
        if (distToStart < 0.3) {
            baseColor = mix(baseColor, vec3(0.2, 0.8, 0.3), 0.7);
        }
        
        // Zone d'arrivée (portail bleu)
        float distToGoal = length(vGridPos - uGoalPos);
        if (distToGoal < uGoalRadius) {
            float pulse = sin(vWorldPos.x * 10.0 + vWorldPos.y * 10.0) * 0.5 + 0.5;
            baseColor = mix(vec3(0.2, 0.5, 1.0), vec3(0.5, 0.8, 1.0), pulse);
        }
        
        vec3 litColor = baseColor * (ambient + diffuseColor) + specularColor;
        vec3 gridColor = vec3(0.4, 0.5, 0.6);
        vec3 finalColor = mix(litColor, gridColor, gridLine * 0.3);
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Shader pour le projectile et la trajectoire
const lineVertexShaderSource = `
    precision mediump float;
    
    attribute vec3 aPosition;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    
    varying float vT;
    
    void main() {
        vT = aPosition.z; // On utilise z pour stocker le paramètre t
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition.xy, aPosition.z, 1.0);
        gl_PointSize = 8.0;
    }
`;

const lineFragmentShaderSource = `
    precision mediump float;
    
    uniform vec3 uColor;
    uniform float uAlpha;
    
    varying float vT;
    
    void main() {
        gl_FragColor = vec4(uColor, uAlpha);
    }
`;

// ===== CLASSE RENDERER =====

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');

        if (!this.gl) {
            throw new Error('WebGL non supporté');
        }

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        this.initShaders();
        this.initMesh();
        this.initLineBuffer();

        this.camera = {
            rotX: -33,
            rotY: 0,
            rotZ: 0,
            distance: 18
        };

        this.light = { x: 5, y: 5, z: 10 };
        this.gridSize = 0.5;
        this.showNormals = false;
    }

    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Erreur shader:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Erreur linking:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    initShaders() {
        // Programme principal pour la surface
        this.surfaceProgram = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.surfaceUniforms = this.getUniforms(this.surfaceProgram, [
            'uProjectionMatrix', 'uViewMatrix', 'uModelMatrix',
            'uGridSize', 'uLightPos', 'uCameraPos', 'uShowNormals',
            'uMassCount', 'uGoalPos', 'uGoalRadius', 'uStartPos'
        ]);
        
        // Uniforms pour les masses (tableau)
        const gl = this.gl;
        gl.useProgram(this.surfaceProgram);
        this.surfaceUniforms.uMasses = [];
        this.surfaceUniforms.uMassStrengths = [];
        for (let i = 0; i < 8; i++) {
            this.surfaceUniforms.uMasses[i] = gl.getUniformLocation(this.surfaceProgram, `uMasses[${i}]`);
            this.surfaceUniforms.uMassStrengths[i] = gl.getUniformLocation(this.surfaceProgram, `uMassStrengths[${i}]`);
        }

        // Programme pour les lignes (trajectoire)
        this.lineProgram = this.createProgram(lineVertexShaderSource, lineFragmentShaderSource);
        this.lineUniforms = this.getUniforms(this.lineProgram, [
            'uProjectionMatrix', 'uViewMatrix', 'uColor', 'uAlpha'
        ]);
    }

    getUniforms(program, names) {
        const uniforms = {};
        for (const name of names) {
            uniforms[name] = this.gl.getUniformLocation(program, name);
        }
        return uniforms;
    }

    initMesh() {
        const gl = this.gl;
        const width = 10, height = 10, resX = 100, resY = 100;

        const vertices = [];
        const indices = [];

        for (let y = 0; y <= resY; y++) {
            for (let x = 0; x <= resX; x++) {
                vertices.push((x / resX - 0.5) * width);
                vertices.push((y / resY - 0.5) * height);
                vertices.push(0);
            }
        }

        for (let y = 0; y < resY; y++) {
            for (let x = 0; x < resX; x++) {
                const tl = y * (resX + 1) + x;
                const tr = tl + 1;
                const bl = (y + 1) * (resX + 1) + x;
                const br = bl + 1;
                indices.push(tl, bl, tr, tr, bl, br);
            }
        }

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        this.indexCount = indices.length;
    }

    initLineBuffer() {
        this.lineBuffer = this.gl.createBuffer();
        this.trajectoryVertices = [];
    }

    setTrajectory(points) {
        const gl = this.gl;
        this.trajectoryVertices = [];

        for (const p of points) {
            this.trajectoryVertices.push(p.x, p.y, p.z + 0.05); // Légèrement au-dessus
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.trajectoryVertices), gl.DYNAMIC_DRAW);
        this.trajectoryPointCount = points.length;
    }

    getCameraPosition() {
        const radX = degToRad(this.camera.rotX);
        const radY = degToRad(this.camera.rotY);

        return [
            this.camera.distance * Math.sin(radY) * Math.cos(radX),
            this.camera.distance * Math.sin(radX),
            this.camera.distance * Math.cos(radY) * Math.cos(radX)
        ];
    }

    render(gameState) {
        const gl = this.gl;
        const { masses, goalPos, goalRadius, startPos, projectilePos } = gameState;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.05, 0.05, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const aspect = this.canvas.width / this.canvas.height;
        const projection = mat4Perspective(Math.PI / 4, aspect, 0.1, 100);
        
        const eye = this.getCameraPosition();
        const radZ = degToRad(this.camera.rotZ);
        let upVector = [0, 1, 0];
        
        if (radZ !== 0) {
            const viewDir = normalize([-eye[0], -eye[1], -eye[2]]);
            upVector = rotateVectorAroundAxis(upVector, viewDir, radZ);
        }
        
        const view = mat4LookAt(eye, [0, 0, 0], upVector);
        const model = mat4Identity();

        // === Rendu de la surface ===
        gl.useProgram(this.surfaceProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        const posLoc = gl.getAttribLocation(this.surfaceProgram, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        gl.uniformMatrix4fv(this.surfaceUniforms.uProjectionMatrix, false, projection);
        gl.uniformMatrix4fv(this.surfaceUniforms.uViewMatrix, false, view);
        gl.uniformMatrix4fv(this.surfaceUniforms.uModelMatrix, false, model);
        gl.uniform1f(this.surfaceUniforms.uGridSize, this.gridSize);
        gl.uniform3f(this.surfaceUniforms.uLightPos, this.light.x, this.light.y, this.light.z);
        gl.uniform3fv(this.surfaceUniforms.uCameraPos, eye);
        gl.uniform1i(this.surfaceUniforms.uShowNormals, this.showNormals ? 1 : 0);

        // Masses
        gl.uniform1i(this.surfaceUniforms.uMassCount, masses.length);
        for (let i = 0; i < masses.length && i < 8; i++) {
            gl.uniform2f(this.surfaceUniforms.uMasses[i], masses[i].x, masses[i].y);
            gl.uniform1f(this.surfaceUniforms.uMassStrengths[i], masses[i].strength);
        }

        // Objectif et départ
        gl.uniform2f(this.surfaceUniforms.uGoalPos, goalPos.x, goalPos.y);
        gl.uniform1f(this.surfaceUniforms.uGoalRadius, goalRadius);
        gl.uniform2f(this.surfaceUniforms.uStartPos, startPos.x, startPos.y);

        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

        // === Rendu de la trajectoire ===
        if (this.trajectoryPointCount > 1) {
            gl.useProgram(this.lineProgram);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
            const linePosLoc = gl.getAttribLocation(this.lineProgram, 'aPosition');
            gl.enableVertexAttribArray(linePosLoc);
            gl.vertexAttribPointer(linePosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.uniformMatrix4fv(this.lineUniforms.uProjectionMatrix, false, projection);
            gl.uniformMatrix4fv(this.lineUniforms.uViewMatrix, false, view);
            gl.uniform3f(this.lineUniforms.uColor, 1.0, 0.9, 0.3);
            gl.uniform1f(this.lineUniforms.uAlpha, 0.8);

            gl.drawArrays(gl.LINE_STRIP, 0, this.trajectoryPointCount);
        }

        // === Rendu du projectile ===
        if (projectilePos) {
            gl.useProgram(this.lineProgram);
            
            const projBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, projBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                projectilePos.x, projectilePos.y, projectilePos.z + 0.1
            ]), gl.DYNAMIC_DRAW);

            const projPosLoc = gl.getAttribLocation(this.lineProgram, 'aPosition');
            gl.enableVertexAttribArray(projPosLoc);
            gl.vertexAttribPointer(projPosLoc, 3, gl.FLOAT, false, 0, 0);

            gl.uniform3f(this.lineUniforms.uColor, 1.0, 0.4, 0.2);
            gl.uniform1f(this.lineUniforms.uAlpha, 1.0);

            gl.drawArrays(gl.POINTS, 0, 1);
            
            gl.deleteBuffer(projBuffer);
        }
    }
}