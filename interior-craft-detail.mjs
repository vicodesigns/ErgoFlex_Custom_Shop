import * as THREE from 'three';

// Shared within one built room, never across cached library assets. Existing
// colour artwork stays intact; small relief and reflectance carry the finish.
export function interiorCraftFinishes(room, { ceramic = [], linen = [], wood = [], metal = [], rubber = [] } = {}) {
    const cache = room.root.craftMaps ||= {};
    const map = (kind, channel) => {
        const key = kind + channel;
        if (cache[key]) return cache[key];
        const side = 128, data = new Uint8Array(side * side * 4);
        for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
            const a = x / side * Math.PI * 2, b = y / side * Math.PI * 2;
            let n = Math.imul(x + 19, 374761393) ^ Math.imul(y + 71, 668265263);
            n = Math.imul(n ^ n >>> 13, 1274126177); const noise = (n >>> 0) / 4294967295;
            let value;
            if (kind === 'wood') value = 244 + 5 * Math.sin(b * 17 + .7 * Math.sin(a * 2)) + 2 * Math.sin(b * 43 + Math.sin(a)) - noise * 3;
            else if (kind === 'linen') value = channel === 'roughness' ? 224 + noise * 29 : 128 + 25 * Math.cos(a * 16) + 25 * Math.cos(b * 16) + (noise - .5) * 16;
            else if (kind === 'rubber') value = channel === 'roughness' ? 230 + noise * 25 : 85 + noise * 86;
            else value = channel === 'roughness' ? 201 + noise * 40 + 8 * Math.sin(b * 5) : 128 + (noise - .5) * 22 + 7 * Math.sin(b * 6);
            const i = (y * side + x) * 4, v = Math.max(0, Math.min(255, Math.round(value)));
            data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
        }
        const texture = new THREE.DataTexture(data, side, side);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true; texture.anisotropy = 4;
        if (kind === 'wood') texture.colorSpace = THREE.SRGBColorSpace;
        else texture.repeat.set(kind === 'linen' || kind === 'rubber' ? 8 : 3, kind === 'linen' || kind === 'rubber' ? 8 : 2);
        texture.needsUpdate = true; (room.root.ownedTextures ||= []).push(texture);
        return cache[key] = texture;
    };
    const mm = room.root.scale.x;
    for (const m of ceramic) {
        m.roughness = .31; m.metalness = 0;
        m.bumpMap ||= map('stoneware', 'height'); m.bumpScale = .055 * mm;
        m.roughnessMap ||= map('stoneware', 'roughness');
        m.userData.roomFinishLocked = true; m.userData.roomCraftFinish = 'glazed stoneware'; m.needsUpdate = true;
    }
    for (const m of linen) {
        m.roughness = .95; m.metalness = 0;
        m.bumpMap ||= map('linen', 'height'); m.bumpScale = .12 * mm;
        m.roughnessMap ||= map('linen', 'roughness');
        m.userData.roomFinishLocked = true; m.userData.roomCraftFinish = 'woven linen'; m.needsUpdate = true;
    }
    for (const m of wood) {
        m.map ||= map('wood', 'color'); m.metalness = 0;
        m.roughness = THREE.MathUtils.clamp(m.roughness, .52, .72);
        m.userData.roomFinishLocked = true; m.userData.roomCraftFinish = 'oiled timber'; m.needsUpdate = true;
    }
    for (const m of metal) {
        m.roughness = THREE.MathUtils.clamp(m.roughness, .28, .44);
        m.userData.roomFinishLocked = true; m.userData.roomCraftFinish = 'satin metal';
    }
    for (const m of rubber) {
        m.roughness = .91; m.metalness = 0;
        m.bumpMap ||= map('rubber', 'height'); m.bumpScale = .18 * mm;
        m.roughnessMap ||= map('rubber', 'roughness');
        m.userData.roomFinishLocked = true; m.userData.roomCraftFinish = 'granular rubber'; m.needsUpdate = true;
    }
}
