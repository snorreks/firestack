import { beforeSmsSent } from '@snorreks/firestack';

/**
 * Identity v2 — blocks SMS delivery based on reCAPTCHA evaluation.
 *
 * Handles sign-in/sign-up SMS, multi-factor sign-in SMS, and multi-factor
 * enrollment SMS events. Can override reCAPTCHA decisions to allow or
 * block SMS delivery.
 */
export default beforeSmsSent(
  async (user, context) => {
    console.log('Identity: beforeSmsSent', {
      uid: user.uid,
      phoneNumber: user.phoneNumber,
      smsType: context.smsType,
    });

    // Allow all legitimate SMS through by not throwing
    // To block: throw new Error("SMS delivery blocked.");

    return {
      recaptchaActionOverride: 'ALLOW',
    };
  },
  {
    timeoutSeconds: 30,
    functionName: 'identity_before_sms_sent',
  }
);
