import type { FunctionsCacheGet, FunctionsCacheUpdate } from '@snorreks/firestack';

const baseURL = 'https://api.jsonbin.io/v3/b';

const getAccessKey = (): string => {
  const key = process.env.CACHE_ACCESS_KEY;
  if (!key) {
    throw new Error('CACHE_ACCESS_KEY environment variable is required');
  }
  return key;
};

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
      'X-Access-Key': getAccessKey(),
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
      'X-Access-Key': getAccessKey(),
    },
    body: JSON.stringify(mergedFunctionsCache),
  });

  if (!response.ok) {
    throw new Error(`Failed to update cache: ${response.statusText}`);
  }
};
