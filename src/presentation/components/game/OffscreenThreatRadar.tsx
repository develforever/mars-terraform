/**
 * OffscreenThreatRadar.tsx
 *
 * Screen-edge Threat Warning Radar Overlay.
 * Tracks alien ships, ground combat units, and incoming meteor trajectories
 * that reside outside the player's active camera frustum.
 * Renders directional indicators with distance in meters and click-to-focus camera navigation.
 */

import { useTranslation } from "react-i18next";
import { useUIStore, type OffscreenThreatItem } from "../../../application/store/useUIStore";

export function OffscreenThreatRadar() {
  const { t } = useTranslation();
  const offscreenThreats = useUIStore((s) => s.offscreenThreats);
  const requestCameraPan = useUIStore((s) => s.requestCameraPan);

  if (!offscreenThreats || offscreenThreats.length === 0) return null;

  const handleThreatClick = (threat: OffscreenThreatItem) => {
    requestCameraPan({
      x: threat.worldPosition.x,
      z: threat.worldPosition.z,
    });
  };

  const getThreatIcon = (type: OffscreenThreatItem["type"]) => {
    switch (type) {
      case "alien_ship":
        return "🛸";
      case "alien_ground":
        return "👾";
      case "meteor":
        return "☄️";
      default:
        return "⚠️";
    }
  };

  const getThreatTitle = (type: OffscreenThreatItem["type"]) => {
    switch (type) {
      case "alien_ship":
        return t("hud.threatRadar.alienShip");
      case "alien_ground":
        return t("hud.threatRadar.alienGround");
      case "meteor":
        return t("hud.threatRadar.meteor");
      default:
        return t("hud.threatRadar.incoming");
    }
  };

  return (
    <div
      className="offscreen-threat-radar-layer"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 45,
        overflow: "hidden",
      }}
    >
      {offscreenThreats.map((threat) => {
        const icon = getThreatIcon(threat.type);
        const title = getThreatTitle(threat.type);
        const arrowAngleDeg = (threat.angleRad * 180) / Math.PI;

        return (
          <button
            key={threat.id}
            type="button"
            onClick={() => handleThreatClick(threat)}
            title={`${title} (${threat.distanceMeters}m) - ${t("hud.threatRadar.clickToFocus")}`}
            style={{
              position: "absolute",
              left: `${threat.screenX}px`,
              top: `${threat.screenY}px`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "auto",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              backgroundColor: "rgba(220, 38, 38, 0.9)",
              border: "1px solid #f87171",
              borderRadius: "20px",
              color: "#ffffff",
              boxShadow: "0 0 14px rgba(239, 68, 68, 0.7), 0 4px 10px rgba(0, 0, 0, 0.5)",
              fontSize: "11px",
              fontWeight: "bold",
              userSelect: "none",
              transition: "transform 0.15s ease, background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.1)";
              e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
              e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.9)";
            }}
          >
            {/* Direction Arrow */}
            <span
              style={{
                display: "inline-block",
                transform: `rotate(${arrowAngleDeg}deg)`,
                fontSize: "12px",
                lineHeight: 1,
              }}
            >
              ➔
            </span>

            {/* Threat Type Icon */}
            <span style={{ fontSize: "13px" }}>{icon}</span>

            {/* Distance Readout */}
            <span style={{ fontFamily: "monospace", letterSpacing: "-0.5px" }}>
              {threat.distanceMeters}m
            </span>
          </button>
        );
      })}
    </div>
  );
}
