import congestionJson from "../congestion.json";

export const CONGESTION_THRESHOLD = congestionJson.threshold as number;
export const DETECTION_WINDOW_SECONDS = congestionJson.detectionWindowSeconds as number;
export const REVALIDATION_WINDOW_SECONDS = congestionJson.revalidationWindowSeconds as number;

export { congestionJson };
