import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BUILDING_SEED, BUILDING_DEFINITIONS } from "../../../domain/config/buildings";
import type { BuildingDefinition } from "../../../domain/entities/Building";
import type { PlacedBuilding } from "../../../domain/entities/Building";

interface NodePos {
    id: string;
    x: number;
    y: number;
    def: BuildingDefinition;
}

interface PopoverState {
    nodeId: string;
    x: number;
    y: number;
}

const NODE_W  = 120;
const NODE_H  = 48;
const COL_GAP = 180;
const ROW_GAP = 72;

const RESOURCE_LABELS: Record<string, string> = {
    o2:      "💨 O₂",
    power:   "⚡",
    water:   "💧",
    biomass: "🧪",
};

const CATEGORY_COLORS: Record<string, string> = {
    living:         "#3b82f6",
    production:     "#f59e0b",
    storage:        "#8b5cf6",
    infrastructure: "#06b6d4",
    defense:        "#ef4444",
};

function computeRanks(defs: BuildingDefinition[]): Map<string, number> {
    const ranks = new Map<string, number>();
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const def of defs) {
        indegree.set(def.id, def.dependsOn?.length ?? 0);
        dependents.set(def.id, []);
    }
    for (const def of defs) {
        for (const dep of def.dependsOn ?? []) {
            dependents.get(dep)?.push(def.id);
        }
    }

    const queue: string[] = [];
    for (const def of defs) {
        if ((indegree.get(def.id) ?? 0) === 0) queue.push(def.id);
    }

    while (queue.length > 0) {
        const id = queue.shift()!;
        const rank = ranks.get(id) ?? 0;
        for (const child of dependents.get(id) ?? []) {
            const newRank = rank + 1;
            if (newRank > (ranks.get(child) ?? 0)) {
                ranks.set(child, newRank);
            }
            const remaining = (indegree.get(child) ?? 1) - 1;
            indegree.set(child, remaining);
            if (remaining === 0) queue.push(child);
        }
    }

    return ranks;
}

function buildLayout(defs: BuildingDefinition[]): NodePos[] {
    const ranks = computeRanks(defs);
    const byRank = new Map<number, string[]>();

    for (const def of defs) {
        const r = ranks.get(def.id) ?? 0;
        if (!byRank.has(r)) byRank.set(r, []);
        byRank.get(r)!.push(def.id);
    }

    const positions: NodePos[] = [];
    const sorted = [...byRank.entries()].sort((a, b) => a[0] - b[0]);

    for (const [col, ids] of sorted) {
        const colH = ids.length * ROW_GAP;
        const startY = -colH / 2 + ROW_GAP / 2;
        ids.forEach((id, rowIdx) => {
            const def = BUILDING_DEFINITIONS[id];
            if (!def) return;
            positions.push({
                id,
                x: col * COL_GAP + 8,
                y: startY + rowIdx * ROW_GAP,
                def,
            });
        });
    }

    return positions;
}

interface BuildingDependencyModalProps {
    placedBuildings: PlacedBuilding[];
    onClose: () => void;
}

export function BuildingDependencyModal({ placedBuildings, onClose }: BuildingDependencyModalProps) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [popover, setPopover] = useState<PopoverState | null>(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

    const placedIds = useMemo(
        () => new Set(placedBuildings.map((b) => b.definitionId)),
        [placedBuildings],
    );

    const nodes = useMemo(() => buildLayout(BUILDING_SEED), []);

    const nodeMap = useMemo(() => {
        const m = new Map<string, NodePos>();
        nodes.forEach((n) => m.set(n.id, n));
        return m;
    }, [nodes]);

    const edges = useMemo(() => {
        const result: { from: string; to: string }[] = [];
        for (const def of BUILDING_SEED) {
            for (const dep of def.dependsOn ?? []) {
                result.push({ from: dep, to: def.id });
            }
        }
        return result;
    }, []);

    const minX = useMemo(() => Math.min(...nodes.map((n) => n.x)) - 20, [nodes]);
    const maxX = useMemo(() => Math.max(...nodes.map((n) => n.x)) + NODE_W + 20, [nodes]);
    const minY = useMemo(() => Math.min(...nodes.map((n) => n.y)) - 20, [nodes]);
    const maxY = useMemo(() => Math.max(...nodes.map((n) => n.y)) + NODE_H + 20, [nodes]);
    const svgW = maxX - minX;
    const svgH = maxY - minY;

    const isPlaced = (id: string) => placedIds.has(id);

    const isAvailable = useCallback((def: BuildingDefinition) => {
        if (!def.dependsOn || def.dependsOn.length === 0) return true;
        return def.dependsOn.every((d) => placedIds.has(d));
    }, [placedIds]);

    const handleNodeClick = (node: NodePos, e: React.MouseEvent) => {
        e.stopPropagation();
        if (popover?.nodeId === node.id) {
            setPopover(null);
            return;
        }
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPopover({
            nodeId: node.id,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    const handleBackdropClick = () => {
        if (popover) { setPopover(null); return; }
        onClose();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest(".dep-node")) return;
        setIsDragging(false);
        dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragStart.current) return;
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setIsDragging(true);
        setPan({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
    };

    const handleMouseUp = () => {
        dragStart.current = null;
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const popoverDef = popover ? BUILDING_DEFINITIONS[popover.nodeId] : null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(4px)",
                pointerEvents: "auto",
            }}
            onClick={handleBackdropClick}
        >
            <div
                style={{
                    position: "relative",
                    width: "min(92vw, 960px)",
                    height: "min(88vh, 620px)",
                    background: "rgba(8, 12, 22, 0.98)",
                    border: "1px solid rgba(231,76,60,0.35)",
                    borderRadius: "16px",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    flexShrink: 0,
                }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "15px", letterSpacing: "0.5px" }}>
                        {t("hud.depTreeTitle")}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Legend />
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#9ca3af",
                                fontSize: "20px",
                                cursor: "pointer",
                                lineHeight: 1,
                                padding: "2px 6px",
                            }}
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Graph area */}
                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        position: "relative",
                        overflow: "hidden",
                        cursor: isDragging ? "grabbing" : "grab",
                        userSelect: "none",
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onClick={() => { if (!isDragging) setPopover(null); }}
                >
                    <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, position: "absolute", inset: 0 }}>
                        {/* SVG edges */}
                        <svg
                            style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
                            width={svgW}
                            height={svgH}
                            viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
                        >
                            <defs>
                                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="rgba(156,163,175,0.6)" />
                                </marker>
                                <marker id="arrowhead-placed" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                                    <polygon points="0 0, 8 3, 0 6" fill="rgba(74,222,128,0.8)" />
                                </marker>
                            </defs>
                            {edges.map(({ from, to }) => {
                                const fn = nodeMap.get(from);
                                const tn = nodeMap.get(to);
                                if (!fn || !tn) return null;
                                const x1 = fn.x + NODE_W;
                                const y1 = fn.y + NODE_H / 2;
                                const x2 = tn.x;
                                const y2 = tn.y + NODE_H / 2;
                                const cx1 = x1 + (x2 - x1) * 0.5;
                                const cy1 = y1;
                                const cx2 = x1 + (x2 - x1) * 0.5;
                                const cy2 = y2;
                                const bothPlaced = isPlaced(from) && isPlaced(to);
                                return (
                                    <path
                                        key={`${from}-${to}`}
                                        d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                                        fill="none"
                                        stroke={bothPlaced ? "rgba(74,222,128,0.7)" : "rgba(156,163,175,0.35)"}
                                        strokeWidth={bothPlaced ? 2 : 1.5}
                                        strokeDasharray={bothPlaced ? undefined : "4 3"}
                                        markerEnd={bothPlaced ? "url(#arrowhead-placed)" : "url(#arrowhead)"}
                                    />
                                );
                            })}
                        </svg>

                        {/* Nodes */}
                        {nodes.map((node) => {
                            const placed = isPlaced(node.id);
                            const available = isAvailable(node.def);
                            const locked = !placed && !available;
                            const catColor = CATEGORY_COLORS[node.def.category] ?? "#6b7280";

                            let border = `1.5px solid ${catColor}44`;
                            let boxShadow = "none";
                            let opacity = 1;

                            if (placed) {
                                border = `2px solid #4ade80`;
                                boxShadow = "0 0 12px rgba(74,222,128,0.45), 0 0 4px rgba(74,222,128,0.3)";
                            } else if (locked) {
                                opacity = 0.45;
                            }

                            return (
                                <div
                                    key={node.id}
                                    className="dep-node"
                                    onClick={(e) => { if (!isDragging) handleNodeClick(node, e); }}
                                    style={{
                                        position: "absolute",
                                        left: node.x - minX,
                                        top: node.y - minY,
                                        width: NODE_W,
                                        height: NODE_H,
                                        background: placed
                                            ? "rgba(74,222,128,0.10)"
                                            : locked
                                                ? "rgba(20,24,36,0.8)"
                                                : `${catColor}18`,
                                        border,
                                        borderRadius: "8px",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        opacity,
                                        boxShadow,
                                        transition: "box-shadow 0.2s, opacity 0.2s",
                                        zIndex: 2,
                                        padding: "4px 6px",
                                    }}
                                >
                                    <span style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: catColor,
                                        marginBottom: 3,
                                        flexShrink: 0,
                                        boxShadow: placed ? `0 0 6px ${catColor}` : "none",
                                    }} />
                                    <span style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        color: placed ? "#86efac" : locked ? "#6b7280" : "#e5e7eb",
                                        textAlign: "center",
                                        lineHeight: 1.3,
                                        maxWidth: "100%",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}>
                                        {node.def.name}
                                    </span>
                                    {placed && (
                                        <span style={{ fontSize: "9px", color: "#4ade80", marginTop: 2 }}>
                                            ✓ {t("hud.depTreePlaced")}
                                        </span>
                                    )}
                                    {locked && (
                                        <span style={{ fontSize: "9px", color: "#6b7280", marginTop: 2 }}>
                                            🔒 {t("hud.depTreeLocked")}
                                        </span>
                                    )}
                                    {!placed && !locked && (
                                        <span style={{ fontSize: "9px", color: "#fbbf24", marginTop: 2 }}>
                                            ◎ {t("hud.depTreeAvailable")}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Popover */}
                    {popover && popoverDef && (
                        <NodePopover
                            def={popoverDef}
                            x={popover.x}
                            y={popover.y}
                            placed={isPlaced(popoverDef.id)}
                            available={isAvailable(popoverDef)}
                            onClose={() => setPopover(null)}
                        />
                    )}
                </div>

                {/* Footer hint */}
                <div style={{
                    padding: "8px 20px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    fontSize: "11px",
                    color: "#4b5563",
                    flexShrink: 0,
                }}>
                    Kliknij węzeł aby zobaczyć szczegóły · Przeciągnij aby przesunąć · Esc aby zamknąć
                </div>
            </div>
        </div>
    );
}

function Legend() {
    const items = [
        { color: "#4ade80", label: "Postawiony", border: "2px solid #4ade80" },
        { color: "#fbbf24", label: "Dostępny", border: "1.5px solid #fbbf2444" },
        { color: "#6b7280", label: "Zablokowany", border: "1.5px solid #6b728044", opacity: 0.45 },
    ];
    return (
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {items.map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px", opacity: item.opacity }}>
                    <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "3px",
                        background: `${item.color}18`,
                        border: item.border,
                    }} />
                    <span style={{ fontSize: "10px", color: "#9ca3af" }}>{item.label}</span>
                </div>
            ))}
        </div>
    );
}

interface NodePopoverProps {
    def: BuildingDefinition;
    x: number;
    y: number;
    placed: boolean;
    available: boolean;
    onClose: () => void;
}

function NodePopover({ def, x, y, placed, available }: NodePopoverProps) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x, y });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const parent = el.parentElement;
        if (!parent) return;
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        let nx = x + 12;
        let ny = y + 12;
        if (nx + w > pw - 8) nx = x - w - 12;
        if (ny + h > ph - 8) ny = y - h - 12;
        if (nx < 8) nx = 8;
        if (ny < 8) ny = 8;
        setPos({ x: nx, y: ny });
    }, [x, y]);

    const catColor = CATEGORY_COLORS[def.category] ?? "#6b7280";
    const costEntries = Object.entries(def.cost ?? {}).filter(([, v]) => v && (v as number) > 0) as [string, number][];
    const prodEntries = Object.entries(def.production ?? {}).filter(([, v]) => v && (v as number) !== 0) as [string, number][];
    const capEntries = Object.entries(def.capacity ?? {}).filter(([, v]) => v && (v as number) > 0) as [string, number][];

    const unlockedBy = BUILDING_SEED.filter((b) => b.dependsOn?.includes(def.id));

    const statusColor = placed ? "#4ade80" : available ? "#fbbf24" : "#6b7280";
    const statusLabel = placed ? t("hud.depTreePlaced") : available ? t("hud.depTreeAvailable") : t("hud.depTreeLocked");

    return (
        <div
            ref={ref}
            onClick={(e) => e.stopPropagation()}
            style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                zIndex: 100,
                background: "rgba(8,12,24,0.98)",
                border: `1px solid ${catColor}66`,
                borderRadius: "10px",
                padding: "12px 14px",
                minWidth: "200px",
                maxWidth: "260px",
                boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px ${catColor}22`,
                color: "#e5e7eb",
                fontSize: "12px",
                pointerEvents: "auto",
            }}
        >
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{def.name}</span>
                <span style={{ fontSize: "10px", color: statusColor, fontWeight: 600 }}>● {statusLabel}</span>
            </div>

            {def.dependsOn && def.dependsOn.length > 0 && (
                <Section label={t("hud.depTreeDependsOn")}>
                    {def.dependsOn.map((id) => (
                        <Row key={id} label={BUILDING_DEFINITIONS[id]?.name ?? id} value="" />
                    ))}
                </Section>
            )}

            {costEntries.length > 0 && (
                <Section label={t("hud.cost")}>
                    {costEntries.map(([key, val]) => (
                        <Row key={key} label={RESOURCE_LABELS[key] ?? key} value={String(val)} />
                    ))}
                </Section>
            )}

            {prodEntries.length > 0 && (
                <Section label={t("hud.production")}>
                    {prodEntries.map(([key, val]) => (
                        <Row
                            key={key}
                            label={RESOURCE_LABELS[key] ?? key}
                            value={`${val > 0 ? "+" : ""}${val}`}
                            valueColor={val > 0 ? "#4ade80" : "#f87171"}
                        />
                    ))}
                </Section>
            )}

            {capEntries.length > 0 && (
                <Section label={t("hud.capacity")}>
                    {capEntries.map(([key, val]) => (
                        <Row key={key} label={RESOURCE_LABELS[key] ?? key} value={`+${val}`} valueColor="#60a5fa" />
                    ))}
                </Section>
            )}

            {unlockedBy.length > 0 && (
                <Section label={t("hud.depTreeUnlocksLabel")}>
                    {unlockedBy.map((b) => (
                        <Row key={b.id} label={b.name} value="" />
                    ))}
                </Section>
            )}
        </div>
    );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginTop: "8px" }}>
            <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>
                {label}
            </div>
            {children}
        </div>
    );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "2px" }}>
            <span style={{ color: "#9ca3af" }}>{label}</span>
            {value && <span style={{ color: valueColor ?? "#e5e7eb", fontWeight: 600 }}>{value}</span>}
        </div>
    );
}
