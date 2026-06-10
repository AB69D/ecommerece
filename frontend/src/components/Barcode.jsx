"use client";
import React, { useMemo } from "react";

// Zero-dependency CODE128-B barcode renderer (SVG). We hand-roll the encoder
// instead of pulling in jsbarcode so the build stays dependency-free and the
// output works identically on-screen and inside the print iframe.
//
// CODE128 has 107 symbols; each is 6 bar/space modules summing to 11, except
// the stop symbol (index 106) which carries the 2-module termination bar.
const PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

// Encode an ASCII string into a flat string of module widths ("21222...").
function encode128B(input) {
    const data = String(input || "");
    const values = [];
    for (let i = 0; i < data.length; i++) {
        const c = data.charCodeAt(i);
        if (c >= 32 && c <= 126) values.push(c - 32); // printable ASCII → value
    }
    let checksum = START_B;
    values.forEach((v, i) => { checksum += v * (i + 1); });
    checksum %= 103;
    const codes = [START_B, ...values, checksum, STOP];
    return codes.map((c) => PATTERNS[c]).join("");
}

// Renders a scannable CODE128 barcode. The SVG scales to fill its container
// width (preserveAspectRatio="none"), which is what we want for fixed-size
// labels — relative bar widths inside the symbol are preserved so it still scans.
export default function Barcode({
    value,
    height = 50,
    quietZone = 10,
    className = "",
    color = "#000",
    background = "#fff",
}) {
    const { bars, totalWidth } = useMemo(() => {
        const widths = encode128B(value);
        const out = [];
        let x = quietZone;
        let isBar = true;
        for (let i = 0; i < widths.length; i++) {
            const w = parseInt(widths[i], 10) || 0;
            if (isBar && w > 0) out.push({ x, w });
            x += w;
            isBar = !isBar;
        }
        return { bars: out, totalWidth: x + quietZone };
    }, [value, quietZone]);

    if (!value) return null;

    return (
        <svg
            className={className}
            viewBox={`0 0 ${totalWidth} ${height}`}
            width="100%"
            height={height}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect x="0" y="0" width={totalWidth} height={height} fill={background} />
            {bars.map((b, i) => (
                <rect key={i} x={b.x} y="0" width={b.w} height={height} fill={color} />
            ))}
        </svg>
    );
}
