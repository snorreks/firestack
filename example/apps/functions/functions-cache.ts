import type { FunctionsCacheGet, FunctionsCacheUpdate } from '@snorreks/firestack';

const baseURL = 'https://api.jsonbin.io/v3/b';
const accessKey = '$2a$10$CQ4GBCW8od4zQ8sV7WugXucaGegle0e.kt7XiVNxtsaoJR1BFJMCC';

const getBinId = (mode: string): string => {
  switch (mode) {
    case 'example':
      return '69addb6843b1c97be9c21860';
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
};

export const get: FunctionsCacheGet = async ({ mode }) => {
  const binId = getBinId(mode);
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

export const update: FunctionsCacheUpdate = async ({ mode, newFunctionsCache }) => {
  const binId = getBinId(mode);

  const oldFunctionsCache = await get({ mode });

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
