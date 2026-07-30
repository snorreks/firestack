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

/**
 * Handles a billing plan update alert event.
 * Triggered when a Firebase billing plan is updated.
 *
 * @param handler - Handler that receives the billing event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onPlanUpdatePublished = createAlertHandler<BillingEvent<PlanUpdatePayload>>(
  'alerts.onPlanUpdatePublished'
);

/**
 * Handles a billing plan automated update alert event.
 * Triggered when a Firebase billing plan is automatically updated.
 *
 * @param handler - Handler that receives the billing event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onPlanAutomatedUpdatePublished = createAlertHandler<
  BillingEvent<PlanAutomatedUpdatePayload>
>('alerts.onPlanAutomatedUpdatePublished');

// --- Crashlytics ---

/**
 * Handles a new fatal issue alert from Crashlytics.
 *
 * @param handler - Handler that receives the crashlytics event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onNewFatalIssuePublished = createAlertHandler<CrashlyticsEvent<NewFatalIssuePayload>>(
  'alerts.onNewFatalIssuePublished'
);

/**
 * Handles a new non-fatal issue alert from Crashlytics.
 *
 * @param handler - Handler that receives the crashlytics event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onNewNonfatalIssuePublished = createAlertHandler<
  CrashlyticsEvent<NewNonfatalIssuePayload>
>('alerts.onNewNonfatalIssuePublished');

/**
 * Handles a regression alert from Crashlytics.
 * Triggered when a previously closed issue regresses.
 *
 * @param handler - Handler that receives the crashlytics event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onRegressionAlertPublished = createAlertHandler<
  CrashlyticsEvent<RegressionAlertPayload>
>('alerts.onRegressionAlertPublished');

/**
 * Handles a stability digest alert from Crashlytics.
 * Provides a summary of the app's stability metrics.
 *
 * @param handler - Handler that receives the crashlytics event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onStabilityDigestPublished = createAlertHandler<
  CrashlyticsEvent<StabilityDigestPayload>
>('alerts.onStabilityDigestPublished');

/**
 * Handles a velocity alert from Crashlytics.
 * Triggered when there's a significant change in the rate of new issues.
 *
 * @param handler - Handler that receives the crashlytics event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onVelocityAlertPublished = createAlertHandler<CrashlyticsEvent<VelocityAlertPayload>>(
  'alerts.onVelocityAlertPublished'
);

/**
 * Handles a new ANR issue alert from Crashlytics.
 *
 * @param handler - Handler that receives the crashlytics event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onNewAnrIssuePublished = createAlertHandler<CrashlyticsEvent<NewAnrIssuePayload>>(
  'alerts.onNewAnrIssuePublished'
);

// --- Performance ---

/**
 * Handles a threshold alert from Firebase Performance Monitoring.
 * Triggered when a performance metric exceeds its configured threshold.
 *
 * @param handler - Handler that receives the performance event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onThresholdAlertPublished = createAlertHandler<
  PerformanceEvent<ThresholdAlertPayload>
>('alerts.onThresholdAlertPublished');

// --- App Distribution ---

/**
 * Handles a new tester iOS device alert from App Distribution.
 * Triggered when a new tester registers an iOS device.
 *
 * @param handler - Handler that receives the app distribution event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onNewTesterIosDevicePublished = createAlertHandler<
  AppDistributionEvent<NewTesterDevicePayload>
>('alerts.onNewTesterIosDevicePublished');

/**
 * Handles an in-app feedback alert from App Distribution.
 * Triggered when a tester submits in-app feedback.
 *
 * @param handler - Handler that receives the app distribution event with a {@link Batch} for queuing async work.
 * @param options - Optional configuration for the function.
 */
export const onInAppFeedbackPublished = createAlertHandler<
  AppDistributionEvent<InAppFeedbackPayload>
>('alerts.onInAppFeedbackPublished');
