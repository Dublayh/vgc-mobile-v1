import { REGULATION_M_B } from './m-b';
import { REGULATION_M_C } from './m-c';

export type RegulationSource = typeof REGULATION_M_B;

/** All known regulations. The active one is chosen by CURRENT_REG (default m-c). */
export const REGULATIONS: RegulationSource[] = [REGULATION_M_B, REGULATION_M_C];

export const DEFAULT_REGULATION = 'm-c';
