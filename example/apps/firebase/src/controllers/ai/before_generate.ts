import { beforeGenerateContent } from '@snorreks/firestack';

/**
 * AI (Gemini/Vertex) — intercepts content generation before it's processed.
 *
 * Modify prompts, inject system instructions, or block requests
 * based on safety checks. Return a partial request to override parameters.
 */
export default beforeGenerateContent(
  (event) => {
    console.log('AI content generation requested', {
      model: event.data.model,
      api: event.data.api,
      authType: event.authType,
      authId: event.authId,
    });

    // Return void to allow the request as-is, or return a partial
    // request to override generation parameters.
  },
  {
    timeoutSeconds: 540,
    functionName: 'ai_before_generate',
  }
);
