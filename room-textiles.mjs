import * as THREE from 'three';

export function roomTextiles(root, loadMap) {
    const fabricData = (name, repeat) => {
        const map = loadMap(name);
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = 4;
        map.colorSpace = THREE.NoColorSpace;
        map.flipY = false;
        map.repeat.set(repeat, repeat);
        (root.ownedTextures ||= []).push(map);
        return map;
    };
    const textiles = {};
    for (const [name, repeat] of [['stockinette', 5], ['twill', 7]]) {
        textiles[name] = {
            normal: fabricData(name + '-normal', repeat),
            orm: fabricData(name + '-orm', repeat)
        };
    }
    return textiles;
}
