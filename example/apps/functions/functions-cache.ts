import type { FunctionsCacheGet, FunctionsCacheUpdate } from '@snorreks/firestack';

const baseURL = 'https://api.jsonbin.io/v3/b';
const accessKey = '$2a$10$CQ4GBCW8od4zQ8sV7WugXucaGegle0e.kt7XiVNxtsaoJR1BFJMCC';

const getBinId = (flavor: string): string => {
  switch (flavor) {
    case 'example':
      return '69addb6843b1c97be9c21860';
    default:
      throw new Error(`Unknown flavor: ${flavor}`);
  }
};

export const get: FunctionsCacheGet = async ({ flavor }) => {
  const binId = getBinId(flavor);
  const response = await fetch(`${baseURL}/${binId}/latest`, {
    method: 'GET',
    headers: {
      'X-Bin-Meta': 'false',
      'X-Access-Key': accessKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cache: ${response.statusText}`);
  }

  return await response.json();
};

export const update: FunctionsCacheUpdate = async ({ flavor, newFunctionsCache }) => {
  const binId = getBinId(flavor);

  const oldFunctionsCache = await get({ flavor });

  const mergedFunctionsCache = {
    ...oldFunctionsCache,
    ...newFunctionsCache,
  };

  const response = await fetch(`${baseURL}/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Key': accessKey,
    },
    body: JSON.stringify(mergedFunctionsCache),
  });

  if (!response.ok) {
    throw new Error(`Failed to update cache: ${response.statusText}`);
  }
};
