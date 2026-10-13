// Library dimensions are millimetres; glTF coordinates are metres. A uniform
// unit mismatch can be corrected inside the source, before any user scaling.
// Never stretch an individual axis or mistake a changed shape for a unit error.
export function propUnitCorrection(sourceMetres, expectedMm) {
    if (!expectedMm?.length || !sourceMetres?.length) return 1;
    const ratios = expectedMm.flatMap((mm, i) =>
        mm >= 5 && sourceMetres[i] > 0 && Number.isFinite(sourceMetres[i])
            ? [mm / (sourceMetres[i] * 1000)] : []);
    if (ratios.length < 2 || ratios.some(n => !Number.isFinite(n) || n <= 0)) return 1;
    const factor = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (factor >= .8 && factor <= 1.2 || ratios.some(n => Math.abs(n / factor - 1) > .02)) return 1;
    return factor;
}
