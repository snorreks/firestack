const url = 'https://test-api-cnvwdepuza-ew.a.run.app';

const postData = {
  message: 'Hello from Production Test Script',
};

console.log(`Sending POST request to Production (aikami-prod): ${url}`);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const responseData = await response.json();
  console.log('Success! Response from Production:');
  console.log(JSON.stringify(responseData, null, 2));
} catch (error) {
  console.error('Error testing production:', error);
}
