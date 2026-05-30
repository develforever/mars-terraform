import type { Resources, ResourceDelta, ResourceCapacity } from "../entities/Resources";

export interface GameHint {
  messageKey: string;
  suggestedBuildingId?: string;
  icon: string;
  critical: boolean;
}

export class HintService {
  static getSuggestion(
    resources: Resources,
    capacity: ResourceCapacity,
    lastDelta: ResourceDelta
  ): GameHint | null {
    // 1. Critical oxygen check
    if (resources.o2 < 10 || (lastDelta.o2 ?? 0) < 0) {
      return {
        messageKey: "hint.o2_low",
        suggestedBuildingId: "o2-gen",
        icon: "💨",
        critical: true
      };
    }

    // 2. Critical power check (power cannot be stored beyond capacity, but if we have deficit, it will drain and halt production)
    // In our economy, negative power delta means we don't have enough to run our buildings.
    if ((lastDelta.power ?? 0) < 0) {
      return {
        messageKey: "hint.power_deficit",
        suggestedBuildingId: "solar",
        icon: "⚡",
        critical: true
      };
    }

    // 3. Water deficit
    if ((lastDelta.water ?? 0) < 0) {
      return {
        messageKey: "hint.water_deficit",
        suggestedBuildingId: "ice",
        icon: "💧",
        critical: true
      };
    }

    // 4. Biomass deficit
    if ((lastDelta.biomass ?? 0) < 0) {
      return {
        messageKey: "hint.biomass_deficit",
        suggestedBuildingId: "greenhouse",
        icon: "🧪",
        critical: true
      };
    }

    // 5. Nearing capacity limits
    if (resources.power >= capacity.power * 0.9 && (lastDelta.power ?? 0) > 0) {
      return {
        messageKey: "hint.power_full",
        suggestedBuildingId: "battery",
        icon: "🔋",
        critical: false
      };
    }

    if (resources.water >= capacity.water * 0.9 && (lastDelta.water ?? 0) > 0) {
      return {
        messageKey: "hint.water_full",
        suggestedBuildingId: "water-tank",
        icon: "🚰",
        critical: false
      };
    }

    // Base suggestions if everything is stable
    if ((lastDelta.o2 ?? 0) > 0 && (lastDelta.power ?? 0) > 0 && resources.biomass < 50) {
      return {
        messageKey: "hint.stable_biomass_low",
        suggestedBuildingId: "greenhouse",
        icon: "🌱",
        critical: false
      };
    }

    // Default fallback - no critical issues
    return {
      messageKey: "hint.explore",
      icon: "🚀",
      critical: false
    };
  }
}
