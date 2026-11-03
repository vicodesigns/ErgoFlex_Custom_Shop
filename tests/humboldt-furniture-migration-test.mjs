import assert from 'node:assert/strict';
import { migrateHumboldtGroupFurniture as migrate } from '../humboldt-furniture-migration.mjs';
const obj = id => ({ userData: { propId: id } });
const transform = (x, z, turn = 0) => ({ p: { x, y: 0, z }, q: { x: 0, y: Math.sin(turn * Math.PI / 360), z: 0, w: Math.cos(turn * Math.PI / 360) }, s: { x: 1, y: 1, z: 1 } });
for (const [id, x, z, turn, nx, nz, nt] of [
    ['humboldt-table-l1', 2900, 1600, 0, 5500, 1600, 0],
    ['atelier-timber-obsidian', 7900, 100, -90, -2800, 4700, 0],
    ['atelier-timber-clay', 7900, 1750, -90, -1500, 4700, 0],
    ['monstera', 8600, 3000, 0, 8600, 4300, 0],
    ['campus-board-compact-nordic', -3950, -1700, 90, 4200, 3600, 180],
    ['humboldt-side-table', 8150, 1000, 0, -2150, 5200, 0],
    ['humboldt-cafe-0', 7450, 5100, 0, 7450, 5500, 0],
    ['humboldt-cafe-1', 7450, 7400, 0, 7450, 7800, 0],
    ['kenney-furniture-chair-modern-cushion', 6700, 5100, 90, 6700, 5500, 90],
    ['kenney-furniture-chair-modern-cushion', 7825, 5750, -150, 7825, 6150, -150],
    ['kenney-furniture-chair-modern-cushion', 7825, 4450, -30, 7825, 4850, -30],
    ['kenney-furniture-chair-modern-cushion', 6700, 7400, 90, 6700, 7800, 90],
    ['kenney-furniture-chair-modern-cushion', 7825, 8050, -150, 7825, 8450, -150],
    ['kenney-furniture-chair-modern-cushion', 7825, 6750, -30, 7825, 7150, -30],
    ['humboldt-table-s1', 3300, -1400, 0, 4100, -1400, 0],
    ['kenney-furniture-chair-modern-cushion', 3300, -2300, 0, 4100, -2300, 0],
    ['kenney-furniture-chair-modern-cushion', 3300, -500, 180, 4100, -500, 180],
    ['kenney-furniture-chair-modern-cushion', 2400, -1400, 90, 3200, -1400, 90],
    ['kenney-furniture-chair-modern-cushion', 4200, -1400, -90, 5000, -1400, -90]
]) {
    const old = transform(x, z, turn), updated = migrate(obj(id), old);
    assert.deepEqual(updated, transform(nx, nz, nt));
    assert.strictEqual(migrate(obj(id), updated), updated, 'Migration must be idempotent');
    for (const custom of [transform(x + 100, z, turn), transform(x, z, turn + 10)]) assert.strictEqual(migrate(obj(id), custom), custom, 'Keep owner position/rotation edits');
    assert.deepEqual(old, transform(x, z, turn), 'Do not mutate the source transform');
}
assert.equal(migrate(obj('humboldt-table-l1'), undefined), undefined);
console.log('PASS: old untouched defaults adopt the new group floorplan; edited furniture positions and rotations stay intact.');
