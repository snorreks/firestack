import type { AlertEvent } from 'firebase-functions/alerts';
import type {
  AppDistributionEvent,
  InAppFeedbackPayload,
  NewTesterDevicePayload,
} from 'firebase-functions/alerts/appDistribution';
import type {
  BillingEvent,
  PlanAutomatedUpdatePayload,
  PlanUpdatePayload,
} from 'firebase-functions/alerts/billing';
import type {
  CrashlyticsEvent,
  NewAnrIssuePayload,
  NewFatalIssuePayload,
  NewNonfatalIssuePayload,
  RegressionAlertPayload,
  StabilityDigestPayload,
  VelocityAlertPayload,
} from 'firebase-functions/alerts/crashlytics';
import type {
  PerformanceEvent,
  ThresholdAlertPayload,
} from 'firebase-functions/alerts/performance';
import type { AlertsTriggerOptions } from '$types';
import type { Batch } from '$utils/batch.ts';
import { createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

const createAlertHandler = <T>(trigger: string) => {
  return (handler: (event: T & { batch: Batch }) => unknown, options?: AlertsTriggerOptions) => {
    const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

    return wrapWithLogContext(
      async (event: T) => {
        const batch = createBatch({ concurrency });
        const result = await handler({ ...event, batch });
        if (!batch.isEmpty) await batch.commit();
        return result;
      },
      (event) => ({
        source: 'functions' as const,
        trigger,
        requestId: (event as AlertEvent<unknown>).id,
      })
    );
  };
};

// --- Billing ---
export const onPlanUpdatePublished = createAlertHandler<BillingEvent<PlanUpdatePayload>>(
  'alerts.onPlanUpdatePublished'
);
export const onPlanAutomatedUpdatePublished = createAlertHandler<
  BillingEvent<PlanAutomatedUpdatePayload>
>('alerts.onPlanAutomatedUpdatePublished');

// --- Crashlytics ---
export const onNewFatalIssuePublished = createAlertHandler<CrashlyticsEvent<NewFatalIssuePayload>>(
  'alerts.onNewFatalIssuePublished'
);
export const onNewNonfatalIssuePublished = createAlertHandler<
  CrashlyticsEvent<NewNonfatalIssuePayload>
>('alerts.onNewNonfatalIssuePublished');
export const onRegressionAlertPublished = createAlertHandler<
  CrashlyticsEvent<RegressionAlertPayload>
>('alerts.onRegressionAlertPublished');
export const onStabilityDigestPublished = createAlertHandler<
  CrashlyticsEvent<StabilityDigestPayload>
>('alerts.onStabilityDigestPublished');
export const onVelocityAlertPublished = createAlertHandler<CrashlyticsEvent<VelocityAlertPayload>>(
  'alerts.onVelocityAlertPublished'
);
export const onNewAnrIssuePublished = createAlertHandler<CrashlyticsEvent<NewAnrIssuePayload>>(
  'alerts.onNewAnrIssuePublished'
);

// --- Performance ---
export const onThresholdAlertPublished = createAlertHandler<
  PerformanceEvent<ThresholdAlertPayload>
>('alerts.onThresholdAlertPublished');

// --- App Distribution ---
export const onNewTesterIosDevicePublished = createAlertHandler<
  AppDistributionEvent<NewTesterDevicePayload>
>('alerts.onNewTesterIosDevicePublished');
export const onInAppFeedbackPublished = createAlertHandler<
  AppDistributionEvent<InAppFeedbackPayload>
>('alerts.onInAppFeedbackPublished');
