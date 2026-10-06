import * as THREE from 'three';
import { validateStripMap, visibleAddresses } from './led-strip-map.mjs';

// RGBW wire values remain in the input frame. Display mixing is an approximation:
// add white to RGB and clamp, then convert sRGB to the renderer's linear space.
export const samplingGLSL = `
uniform sampler2D efPixelTexture;
uniform float efPixelActive;
uniform float efPixelRows;
uniform float efPixelWidth;
uniform float efPixelCounts[8];
vec3 efLedLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 efLedSample(float t, float row) {
    float count = efPixelCounts[int(row)];
    float pixel = min(count - 1.0, floor(clamp(t, 0.0, 1.0) * count));
    return efLedLinear(texture2D(efPixelTexture, vec2((pixel + 0.5) / efPixelWidth, (row + 0.5) / efPixelRows)).rgb);
}
`;
const linearByteToSrgb = Uint8Array.from({length:256}, (_,v) => {
    const x=v/255; return Math.round(255*(x<=.0031308 ? 12.92*x : 1.055*x**(1/2.4)-.055));
});

export class LedPixelRenderer {
    constructor(strips) {
        validateStripMap(strips);
        this.strips = strips;
        this.addressMaps = strips.map(visibleAddresses);
        this.width = Math.max(...strips.map(strip => visibleAddresses(strip).length));
        this.data = new Uint8Array(this.width * strips.length * 4);
        this.texture = new THREE.DataTexture(this.data, this.width, strips.length, THREE.RGBAFormat);
        this.texture.magFilter = THREE.NearestFilter;
        this.texture.minFilter = THREE.NearestFilter;
        this.texture.generateMipmaps = false;
        this.texture.needsUpdate = true;
        this.uniforms = { efPixelTexture: { value: this.texture }, efPixelActive: { value: 0 },
            efPixelRows: { value: strips.length }, efPixelWidth: { value: this.width },
            efPixelCounts: { value: this.addressMaps.map(addresses => addresses.length) }, efPixelPower: { value: 0 } };
        this.materials = new Set();
        this.bindings = [];
    }
    get active() { return this.uniforms.efPixelActive.value === 1; }
    setActive(active, power) {
        this.uniforms.efPixelActive.value = active ? 1 : 0;
        this.uniforms.efPixelPower.value = power;
    }
    upload(frame, linear = false) {
        if (frame.length !== this.strips.length || frame.some((row, i) => row.length !== this.strips[i].count * 4))
            throw new Error('RGBW frame does not match strip map.');
        this.strips.forEach((strip, row) => {
            const addresses = this.addressMaps[row], source = frame[row];
            for (let x = 0; x < this.width; x++) {
                const offset = (row * this.width + x) * 4;
                if (x >= addresses.length) {
                    this.data.fill(0, offset, offset + 3); this.data[offset + 3] = 255;
                    continue;
                }
                const slot = x;
                const address = addresses[strip.reverse ? addresses.length - 1 - slot : slot];
                const p = address * 4, white = source[p + 3];
                for (let c=0;c<3;c++) {
                    const mixed=Math.min(255,source[p+c]+white);
                    this.data[offset+c]=linear ? linearByteToSrgb[mixed] : mixed;
                }
                this.data[offset + 3] = 255;
            }
        });
        this.texture.needsUpdate = true;
    }
    bindStrip(part, stripId) {
        const row = this.strips.findIndex(strip => strip.id === stripId), strip = this.strips[row];
        if (!strip) throw new Error('Unknown physical strip.');
        part.userData.ledPhysicalId = stripId;
        part.traverse(mesh => {
            if (!mesh.isMesh) return;
            mesh.userData.ledPhysicalId = stripId;
            const geometry = mesh.geometry;
            geometry.computeBoundingBox();
            const bounds = geometry.boundingBox, positions = geometry.attributes.position;
            const min = bounds.min[strip.axis], span = bounds.max[strip.axis] - min;
            if (!(span > 0)) throw new Error('LED path has zero length.');
            const uv = new Float32Array(positions.count);
            for (let i = 0; i < positions.count; i++) uv[i] = ((strip.axis === 'x' ? positions.getX(i) : positions.getZ(i)) - min) / span;
            geometry.setAttribute('efLedT', new THREE.BufferAttribute(uv, 1));
            this.bindings.push({ part, mesh, stripId, axis: strip.axis, min, max: min + span });
            const material = mesh.material;
            if (this.materials.has(material)) return;
            this.materials.add(material);
            material.userData.ledPhysicalId = stripId;
            const rowUniform = { value: row };
            material.onBeforeCompile = shader => {
                Object.assign(shader.uniforms, this.uniforms, { efPixelRow: rowUniform });
                shader.vertexShader = 'attribute float efLedT; varying float efLedPath;\n' + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nefLedPath = efLedT;');
                shader.fragmentShader = samplingGLSL + '\nuniform float efPixelRow; uniform float efPixelPower; varying float efLedPath;\n' + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                    if (efPixelActive > 0.5) {
                        vec3 pixelColor = efLedSample(efLedPath, efPixelRow);
                        diffuseColor.rgb = pixelColor;
                        totalEmissiveRadiance = pixelColor * efPixelPower;
                    }`);
            };
            material.customProgramCacheKey = () => 'ergoflex-led-pixels-v1';
            material.needsUpdate = true;
        });
    }
    bindSpill(entry, sourceIds, range, expression) {
        const material = entry.material;
        const rows = sourceIds.map(id => this.strips.findIndex(strip => strip.id === id));
        if (rows.some(row => row < 0)) throw new Error('Unknown spill source.');
        Object.assign(material.uniforms, this.uniforms, {
            efPixelRange: { value: new THREE.Vector2(range[0], range[1]) }
        });
        const local = `clamp((${expression} - efPixelRange.x) / max(0.001, efPixelRange.y - efPixelRange.x), 0.0, 1.0)`;
        const samples = rows.map(row => `efLedSample(efLocal, ${row.toFixed(1)}) + efLedSample(efLocal - 1.0 / efPixelCounts[${row}], ${row.toFixed(1)}) + efLedSample(efLocal + 1.0 / efPixelCounts[${row}], ${row.toFixed(1)})`).join(' + ');
        material.fragmentShader = samplingGLSL + '\nuniform vec2 efPixelRange;\n' + material.fragmentShader;
        material.fragmentShader = material.fragmentShader.replace('gl_FragColor = vec4(ledColor, alpha);', `
            gl_FragColor = vec4(ledColor, alpha);
            if (efPixelActive > 0.5) {
                float efLocal = ${local};
                vec3 efLocalColor = (${samples}) / ${Number(rows.length * 3).toFixed(1)};
                gl_FragColor.rgb = efLocalColor;
            }`);
        material.needsUpdate = true;
        entry.pixelSources = sourceIds.slice();
    }
    dispose() {
        this.texture.dispose();
        for (const material of this.materials) {
            material.onBeforeCompile = () => {};
            material.customProgramCacheKey = () => '';
            material.needsUpdate = true;
        }
        this.materials.clear(); this.bindings.length = 0;
    }
}
