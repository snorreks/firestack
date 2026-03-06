const url = "http://127.0.0.1:5001/aikami-prod/europe-west1/test_api";

const postData = {
  message: "Hello from Emulator Test Script",
};

console.log(`Sending POST request to Emulator: ${url}`);

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const responseData = await response.json();
  console.log("Success! Response from Emulator:");
  console.log(JSON.stringify(responseData, null, 2));
} catch (error) {
  console.error("Error testing emulator:", error);
}
