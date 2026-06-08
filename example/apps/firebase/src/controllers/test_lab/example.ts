import { onTestMatrixCompleted } from '@snorreks/firestack';

/**
 * Test Lab — reacts when a Firebase Test Lab test matrix completes.
 *
 * The event carries the test matrix ID, state, outcome summary, and
 * client info for post-processing or notification workflows.
 */
export default onTestMatrixCompleted(
  (event) => {
    console.log('Test matrix completed', {
      testMatrixId: event.data.testMatrixId,
      state: event.data.state,
      outcomeSummary: event.data.outcomeSummary,
      clientInfo: event.data.clientInfo,
    });

    return {
      processed: true,
      testMatrixId: event.data.testMatrixId,
      state: event.data.state,
    };
  },
  {
    timeoutSeconds: 540,
    functionName: 'test_lab_example',
  }
);
