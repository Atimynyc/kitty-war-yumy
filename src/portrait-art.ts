import type { Side } from './game/content.ts';
import { baseShellSVG } from './game/base-art.ts';

/** Compatibility entry point for the portrait battlefield artwork. */
export function portraitBaseSVG(side: Side, tier = 1) { return baseShellSVG(side, tier); }
