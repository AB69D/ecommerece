"use client";
import { useId } from "react";

// Lightweight, dependency-free SVG charts. All scale to their container width
// (viewBox + w-full h-auto), so they're fully responsive on every screen size.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Area + line chart for time series (revenue / orders over time).
export function AreaLineChart({
    data = [],
    valueKey = "value",
    color = "#6366f1",
    height = 220,
    formatValue = (v) => v,
}) {
    const gid = useId().replace(/:/g, "");
    const W = 720;
    const H = height;
    const padX = 10;
    const padTop = 16;
    const padBottom = 10;
    const innerW = W - padX * 2;
    const innerH = H - padTop - padBottom;

    const vals = data.map((d) => num(d[valueKey]));
    const max = Math.max(1, ...vals);
    const n = data.length;

    const x = (i) => (n <= 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW);
    const y = (v) => padTop + innerH - (v / max) * innerH;

    const linePts = data.map((d, i) => `${x(i).toFixed(1)},${y(num(d[valueKey])).toFixed(1)}`).join(" ");
    const areaPts = `${padX},${padTop + innerH} ${linePts} ${padX + innerW},${padTop + innerH}`;

    if (n === 0) {
        return <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data yet</div>;
    }

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" role="img">
            <defs>
                <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.30" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {[0, 0.5, 1].map((t) => (
                <line
                    key={t}
                    x1={padX}
                    x2={padX + innerW}
                    y1={padTop + innerH * t}
                    y2={padTop + innerH * t}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    strokeDasharray={t === 1 ? "0" : "4 4"}
                />
            ))}
            <polygon points={areaPts} fill={`url(#grad-${gid})`} />
            <polyline points={linePts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(num(d[valueKey]))} r="2.5" fill={color}>
                    <title>{`${d.date || i}: ${formatValue(num(d[valueKey]))}`}</title>
                </circle>
            ))}
        </svg>
    );
}

// Vertical bars (e.g. orders per day).
export function BarChart({ data = [], valueKey = "value", color = "#10b981", height = 200, formatValue = (v) => v }) {
    const W = 720;
    const H = height;
    const padX = 10;
    const padTop = 12;
    const padBottom = 10;
    const innerW = W - padX * 2;
    const innerH = H - padTop - padBottom;
    const vals = data.map((d) => num(d[valueKey]));
    const max = Math.max(1, ...vals);
    const n = data.length || 1;
    const gap = n > 40 ? 1 : 3;
    const bw = Math.max(1, innerW / n - gap);

    if (data.length === 0) {
        return <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data yet</div>;
    }

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" role="img">
            <line x1={padX} x2={padX + innerW} y1={padTop + innerH} y2={padTop + innerH} stroke="#e5e7eb" strokeWidth="1" />
            {data.map((d, i) => {
                const v = num(d[valueKey]);
                const h = (v / max) * innerH;
                const bx = padX + i * (innerW / n) + gap / 2;
                return (
                    <rect key={i} x={bx} y={padTop + innerH - h} width={bw} height={h} rx={bw > 4 ? 2 : 0} fill={color} opacity="0.9">
                        <title>{`${d.date || i}: ${formatValue(v)}`}</title>
                    </rect>
                );
            })}
        </svg>
    );
}

// Donut for category breakdowns (order status).
export function DonutChart({ data = [], size = 200, thickness = 26 }) {
    const total = data.reduce((s, d) => s + num(d.value), 0);
    const r = (size - thickness) / 2;
    const c = size / 2;
    const circ = 2 * Math.PI * r;
    let acc = 0;

    if (total === 0) {
        return <div className="h-44 flex items-center justify-center text-sm text-gray-400">No data yet</div>;
    }

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[220px] mx-auto" role="img">
            <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
            {data.map((d, i) => {
                const v = num(d.value);
                if (v <= 0) return null;
                const dash = (v / total) * circ;
                const seg = (
                    <circle
                        key={i}
                        cx={c}
                        cy={c}
                        r={r}
                        fill="none"
                        stroke={d.color || "#6366f1"}
                        strokeWidth={thickness}
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-acc}
                        transform={`rotate(-90 ${c} ${c})`}
                        strokeLinecap="butt"
                    >
                        <title>{`${d.label}: ${v}`}</title>
                    </circle>
                );
                acc += dash;
                return seg;
            })}
            <text x={c} y={c - 4} textAnchor="middle" className="fill-gray-800" style={{ fontSize: 28, fontWeight: 700 }}>
                {total}
            </text>
            <text x={c} y={c + 18} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 12 }}>
                total
            </text>
        </svg>
    );
}

// Horizontal bar list (top products, etc.).
export function HBarList({ data = [], color = "#6366f1", formatValue = (v) => v, emptyText = "No data yet" }) {
    const max = Math.max(1, ...data.map((d) => num(d.value)));
    if (data.length === 0) {
        return <div className="py-8 text-center text-sm text-gray-400">{emptyText}</div>;
    }
    return (
        <div className="space-y-3">
            {data.map((d, i) => (
                <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1 gap-2">
                        <span className="text-gray-700 truncate">{d.label}</span>
                        <span className="text-gray-500 font-medium shrink-0">{formatValue(num(d.value))}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(num(d.value) / max) * 100}%`, background: color }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
