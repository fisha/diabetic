/**
 * Request and response shapes of the Steady API. `generated.ts` comes from the API's OpenAPI schema; regenerate it
 * with `pnpm --filter @steady/contracts generate` after changing the API.
 */
import type { components, paths } from './generated.ts';

export type { components, paths };
type S = components['schemas'];
export type Tokens = S['Tokens'];
export type Me = S['Me'];
export type ProfileIn = S['ProfileIn'];
export type ProfileOut = S['ProfileOut'];
export type GlucoseIn = S['GlucoseIn'];
export type GlucoseOut = S['GlucoseOut'];
export type GlucosePatch = S['GlucosePatch'];
export type GlucoseRevisionOut = S['GlucoseRevisionOut'];
