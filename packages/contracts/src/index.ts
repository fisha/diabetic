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
export type RecordIn = S['RecordIn'];
export type RecordOut = S['RecordOut'];
export type RecordPatch = S['RecordPatch'];
export type RecordRevisionOut = S['RecordRevisionOut'];
export type InsulinData = S['InsulinData'];
export type ActivityData = S['ActivityData'];
export type NoteData = S['NoteData'];
export type MealData = S['MealData'];
export type MealItemData = S['MealItemData'];
export type SendIn = S['SendIn'];
export type SendOut = S['SendOut'];
export type MessageOut = S['MessageOut'];
export type ThreadOut = S['ThreadOut'];
export type ConversationOut = S['ConversationOut'];
export type TranscriptOut = S['TranscriptOut'];
export type HealthSampleIn = S['HealthSampleIn'];
export type HealthImportOut = S['HealthImportOut'];
export type HealthRemovedOut = S['HealthRemovedOut'];
export type MembershipOut = S['MembershipOut'];
export type VoiceStatusOut = S['VoiceStatusOut'];
export type InsightsOut = S['InsightsOut'];
export type InsightOut = S['InsightOut'];
export type ExportIn = S['ExportIn'];
export type ExportOut = S['ExportOut'];
export type FollowUpIn = S['FollowUpIn'];
export type FollowUpOut = S['FollowUpOut'];
export type MemoryOut = S['MemoryOut'];
export type SettingsOut = S['SettingsOut'];
export type FoodItem = S['FoodItem'];
export type FoodResult = S['FoodResult'];
export type FoodMatch = S['FoodMatch'];
export type PhotoOut = S['PhotoOut'];
