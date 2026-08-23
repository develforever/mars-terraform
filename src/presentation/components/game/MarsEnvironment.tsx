import { AtmosphereSky } from "./AtmosphereSky";

/**
 * MarsEnvironment component - delegates to AtmosphereSky for dynamic atmospheric evolution.
 */
export function MarsEnvironment() {
    return <AtmosphereSky />;
}
