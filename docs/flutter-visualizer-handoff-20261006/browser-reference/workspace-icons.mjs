// Small original SVG illustrations; no image downloads or third-party artwork.
export function accessoryIllustration(type) {
    const shapes = {
        monitor: '<rect x="15" y="10" width="90" height="53" rx="4" fill="#b4bfba"/><rect x="18" y="13" width="84" height="46" rx="2" fill="#315e59"/><path d="M20 57Q46 13 101 20V57" fill="#729889"/><path d="M23 57Q75 23 102 39V57" fill="#adc1ab"/><path d="M55 64h10v11h16v4H39v-4h16z" fill="#8d9b96"/>',
        keyboard: '<path d="M12 26Q38 16 60 26Q80 16 108 26L114 66Q83 59 60 65Q35 60 6 67Z" fill="#434e4c"/><path d="M9 58Q36 50 60 57Q83 50 110 58L114 69H6Z" fill="#7d8984"/><path d="M20 31l30-3m-32 12l31-3m-33 12l31-3m22-18l28 3m-27 6l28 3m-27 6l28 3" stroke="#b5bcb7" stroke-width="5" stroke-dasharray="5 3"/>',
        mouse: '<ellipse cx="59" cy="67" rx="31" ry="9" fill="#c2cdc3"/><path d="M30 63Q24 50 45 33Q60 9 79 18Q94 33 85 64Q56 83 30 63Z" fill="#414e4b"/><path d="M30 63Q31 42 54 34Q47 48 51 66" fill="#75837b"/><path d="M61 20l-1 20" stroke="#b4bfb5" stroke-width="3"/><path d="M68 27l-1 8" stroke="#d5dcd2" stroke-width="4"/>',
        mat: '<path d="M10 34L94 21l19 38-86 16Z" fill="#819487"/><path d="M15 35l77-11 17 33-80 15Z" fill="none" stroke="#a4b5a5"/>',
        lamp: '<ellipse cx="45" cy="73" rx="25" ry="5" fill="#515e56"/><path d="M44 72l-5-35 28-23 21 15" fill="none" stroke="#46554d" stroke-width="6"/><circle cx="40" cy="36" r="5" fill="#8d9f90"/><path d="M73 24l25 10-3 7-25-10Z" fill="#56675a"/><path d="M77 36l-12 27h41L92 41" fill="#d7dbb755"/>',
        tray: '<path d="M15 42l72-15 20 14-73 18Z" fill="#64746a"/><path d="M15 42v15l20 15 72-18V41L34 59Z" fill="#3e5046"/><path d="M28 39V24m61 3V12" stroke="#8d9c93" stroke-width="5"/>',
        arm: '<path d="M53 70V20m0 22l22-20 21 16" fill="none" stroke="#63776b" stroke-width="8"/><path d="M40 72h26" stroke="#35483d" stroke-width="7"/><rect x="89" y="30" width="17" height="21" rx="2" fill="#35483d"/>',
        'dual-arm': '<path d="M59 72V19m0 25L34 22 18 36m41 8l25-22 19 15" fill="none" stroke="#63776b" stroke-width="7"/><path d="M46 74h26" stroke="#35483d" stroke-width="6"/><path d="M10 33h18v20H10zm84 0h18v20H94z" fill="#35483d"/>',
        holder: '<path d="M37 17v54h47V17M30 17h61" fill="none" stroke="#4f6356" stroke-width="8"/><path d="M45 61h31" stroke="#92a395" stroke-width="4"/>',
        led: '<path d="M13 50q40-38 94 0" fill="none" stroke="#64776a" stroke-width="9"/><path d="M13 48q40-38 94 0" fill="none" stroke="#f3d794" stroke-width="4" stroke-dasharray="4 4"/>',
        foot: '<path d="M22 51l69-18 12 25-68 17Z" fill="#b3a285"/><path d="M29 51l57-14m-53 22l57-14m-54 22l57-14" stroke="#d2c4a8" stroke-width="3"/><path d="M29 70v8m67-17v14" stroke="#596c60" stroke-width="5"/>'
    };
    return `<svg viewBox="0 0 120 90" aria-hidden="true" focusable="false">${shapes[type] || shapes.foot}</svg>`;
}
