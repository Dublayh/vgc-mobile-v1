import { REGULATION_M_B } from './m-b';
import { REGULATION_M_C_TEST } from './m-c';

export type RegulationSource = typeof REGULATION_M_B;

/** All known regulations. The active one is chosen by CURRENT_REG (default m-b). */
export const REGULATIONS: RegulationSource[] = [REGULATION_M_B, REGULATION_M_C_TEST];

export const DEFAULT_REGULATION = 'm-b';
