// Which tile of which hair atlas each hairstyle (people GLB material 'Human.<cut>') is on: [atlas, tile].
// Written by tools/people/bake-hair-maps.py. Atlas 0 is hair-fibres/-flow/hairline.webp (the original eight, in the
// order media-cast-finishes.mjs always used), atlas k is hair-fibres-<k+1>.webp and so on; 2048 x 1024, eight 512 px
// tiles with a 4 px guard band, tile i at column i % 4, row i >> 2.
export const HAIR_ATLASES = ['', '-2', '-3'];
export const HAIR_TILES = {
    ponytail01: [0, 0],
    afro01: [0, 1],
    short01: [0, 2],
    short04: [0, 3],
    braid01: [0, 4],
    short02: [0, 5],
    bob01: [0, 6],
    long01: [0, 7],
    cortu_short_messy_hair: [1, 0],
    rehmanpolanski_hair_bun_brown: [1, 1],
    culturalibre_hair_02: [1, 2],
    culturalibre_hair_01: [1, 3],
    toigo_curled_under_bob: [1, 4],
    toigo_blunt_bob_with_bangs: [1, 5],
    short03: [1, 6],
    elvs_double_mh_braid: [1, 7],
    cortu_strawberry_cloud_hair: [2, 0],
    elvs_french_braid_variation: [2, 1],
    elvs_unkempt_french_braid: [2, 2],
    toigo_blunt_bob: [2, 3],
    elvs_reverse_french_braid_bun: [2, 4],
    toigo_curled_under_bob_with_bangs: [2, 5],
    toigo_inverted_bob_with_bangs: [2, 6],
    toigo_inverted_bob: [2, 7],
};
