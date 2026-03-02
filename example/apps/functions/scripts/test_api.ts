import type { ScriptFunction } from '@snorreks/firestack';

export default (async () => {
  const url = 'https://test-api-cnvwdepuza-ew.a.run.app';

  // 1. Define the data you want to send
  const postData = {
    prompt: 'Tell me a short pirate fact.',
  };

  console.log(`Sending POST request to ${url} with data:`, postData);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Set the content type to JSON
        'Content-Type': 'application/json',
      },
      // 3. Stringify your data object for the body
      body: JSON.stringify(postData),
    });

    // 4. Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // 5. Parse the response (as JSON in this example)
    // Use response.text() if you expect plain text
    const responseData = await response.json();

    console.log('Success! Response received:');
    console.log(responseData);

    console.log('genkit', responseData.genkit);
  } catch (error) {
    console.error(error);
  }
}) satisfies ScriptFunction;
