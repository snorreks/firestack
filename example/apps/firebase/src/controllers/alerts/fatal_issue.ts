import { onNewFatalIssuePublished } from '@snorreks/firestack';

/**
 * Alerts (Crashlytics) — reacts when a new fatal issue is published.
 *
 * The payload includes issue details (id, title, subtitle, appVersion)
 * and the event carries the appId and alertType for routing. Use to
 * trigger Slack/email alerts or create Jira tickets.
 */
export default onNewFatalIssuePublished(
  (event) => {
    console.log('Crashlytics fatal issue alert', {
      issueId: event.data.payload.issue.id,
      issueTitle: event.data.payload.issue.title,
      appVersion: event.data.payload.issue.appVersion,
      appId: event.appId,
      alertType: event.alertType,
    });

    return {
      acknowledged: true,
      issueId: event.data.payload.issue.id,
    };
  },
  {
    timeoutSeconds: 540,
    functionName: 'alerts_fatal_issue',
  }
);
