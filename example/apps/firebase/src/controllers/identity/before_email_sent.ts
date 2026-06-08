import { beforeEmailSent } from '@snorreks/firestack';

/**
 * Identity v2 — blocks email delivery based on reCAPTCHA evaluation.
 *
 * Handles sign-in email and password reset email events. Can override
 * reCAPTCHA decisions to allow or block email delivery.
 */
export default beforeEmailSent(
  async (user, context) => {
    console.log('Identity: beforeEmailSent', {
      uid: user.uid,
      email: user.email,
      emailType: context.emailType,
    });

    // Allow all legitimate emails through by not throwing
    // To block: throw new Error("Email delivery blocked.");

    return {
      recaptchaActionOverride: 'ALLOW',
    };
  },
  {
    timeoutSeconds: 30,
    functionName: 'identity_before_email_sent',
  }
);
