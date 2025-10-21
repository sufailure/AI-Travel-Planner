import type { PlannerResult } from '@/lib/types/planner';

export const PLANNER_STATE_EVENT = 'planner-state-updated';
export const PLANNER_SAVE_REQUEST_EVENT = 'planner-save-requested';

export type PlannerStateDetail = {
    hasResult: boolean;
    result: PlannerResult | null;
    rawPlan: string | null;
    isSaving: boolean;
    isSubmitting: boolean;
    saveMessage: string | null;
    saveError: string | null;
    saveButtonLabel: string;
    saveButtonDisabled: boolean;
    saveButtonTitle?: string;
    isExistingItinerary: boolean;
    isDirty: boolean;
    mapDestination: string;
};
