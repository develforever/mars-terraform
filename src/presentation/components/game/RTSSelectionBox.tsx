import { useSelectionBoxStore } from "../../../application/store/useSelectionBoxStore";

export function RTSSelectionBox() {
  const rect = useSelectionBoxStore((state) => state.rect);

  if (!rect.active) return null;

  const left = Math.min(rect.startX, rect.currentX);
  const top = Math.min(rect.startY, rect.currentY);
  const width = Math.abs(rect.currentX - rect.startX);
  const height = Math.abs(rect.currentY - rect.startY);

  // Don't render tiny jitter box
  if (width < 4 && height < 4) return null;

  return (
    <div
      className="pointer-events-none fixed z-40 border border-cyan-400 bg-cyan-400/15 select-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        boxShadow: "0 0 8px rgba(0, 229, 255, 0.4)",
      }}
    />
  );
}
