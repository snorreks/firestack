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
import { type Batch, createBatch } from '$utils/batch.ts';
import { wrapWithLogContext } from './logging.ts';

const DEFAULT_BATCH_CONCURRENCY = 5;

const wrapAlert = <T>(
  trigger: string,
  handler: (event: T & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => {
  const concurrency = options?.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

  return wrapWithLogContext(
    async (event: T) => {
      const batch = createBatch({ concurrency });
      const result = await handler({ ...event, batch });
      if (!batch.isEmpty) {
        await batch.commit();
      }
      return result;
    },
    (event) => ({
      source: 'functions' as const,
      trigger,
      requestId: (event as AlertEvent<unknown>).id,
    })
  );
};

// --- Billing ---

/** Handles a billing plan update alert. */
export const onPlanUpdatePublished = (
  handler: (event: BillingEvent<PlanUpdatePayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onPlanUpdatePublished', handler, options);

/** Handles an automated billing plan update alert. */
export const onPlanAutomatedUpdatePublished = (
  handler: (event: BillingEvent<PlanAutomatedUpdatePayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onPlanAutomatedUpdatePublished', handler, options);

// --- Crashlytics ---

/** Handles a new fatal issue alert from Crashlytics. */
export const onNewFatalIssuePublished = (
  handler: (event: CrashlyticsEvent<NewFatalIssuePayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onNewFatalIssuePublished', handler, options);

/** Handles a new non-fatal issue alert from Crashlytics. */
export const onNewNonfatalIssuePublished = (
  handler: (event: CrashlyticsEvent<NewNonfatalIssuePayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onNewNonfatalIssuePublished', handler, options);

/** Handles a regression alert from Crashlytics. */
export const onRegressionAlertPublished = (
  handler: (event: CrashlyticsEvent<RegressionAlertPayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onRegressionAlertPublished', handler, options);

/** Handles a stability digest alert from Crashlytics. */
export const onStabilityDigestPublished = (
  handler: (event: CrashlyticsEvent<StabilityDigestPayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onStabilityDigestPublished', handler, options);

/** Handles a velocity alert from Crashlytics. */
export const onVelocityAlertPublished = (
  handler: (event: CrashlyticsEvent<VelocityAlertPayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onVelocityAlertPublished', handler, options);

/** Handles a new ANR issue alert from Crashlytics. */
export const onNewAnrIssuePublished = (
  handler: (event: CrashlyticsEvent<NewAnrIssuePayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onNewAnrIssuePublished', handler, options);

// --- Performance ---

/** Handles a performance threshold alert. */
export const onThresholdAlertPublished = (
  handler: (event: PerformanceEvent<ThresholdAlertPayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onThresholdAlertPublished', handler, options);

// --- App Distribution ---

/** Handles a new tester iOS device alert from App Distribution. */
export const onNewTesterIosDevicePublished = (
  handler: (event: AppDistributionEvent<NewTesterDevicePayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onNewTesterIosDevicePublished', handler, options);

/** Handles an in-app feedback alert from App Distribution. */
export const onInAppFeedbackPublished = (
  handler: (event: AppDistributionEvent<InAppFeedbackPayload> & { batch: Batch }) => unknown,
  options?: AlertsTriggerOptions
) => wrapAlert('alerts.onInAppFeedbackPublished', handler, options);
