import { ConfigLive } from "@/services/ConfigService"

/**
 * ConfigLayer — provides ConfigService from environment variables.
 *
 * Re-exported as a named layer so the rest of the app imports from `layers/`
 * rather than directly from `services/`, keeping the import hierarchy clear:
 *   layers/ imports from services/
 *   services/ imports from lib/
 *   app/ imports from layers/ or effects/
 */
export const ConfigLayer = ConfigLive
