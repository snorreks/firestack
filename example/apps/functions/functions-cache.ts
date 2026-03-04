import type { FunctionsCacheFetch, FunctionsCacheUpdate } from '@snorreks/firestack';

const baseURL = 'https://api.jsonbin.io/v3/b';

const getBinId = (flavor: string): string => {
  switch (flavor) {
    case 'development':
      return '6331878ea1610e63863950af';
    case 'production':
      return '635841e60e6a79321e345e8c';
    case 'staging':
      return '64312542ebd26539d0a6c9ee';
    default:
      throw new Error(`Unknown flavor: ${flavor}`);
  }
};

const masterKey = '$2b$10$aKk5wBPTio4d6rkJ9g397OBD3DYZRTTzh/MyQ5f8JTDeGuiCR6MyO';

export const get: FunctionsCacheFetch = async ({ flavor }) => {
  const binId = getBinId(flavor);
  const response = await fetch(`${baseURL}/${binId}/latest`, {
    method: 'GET',
    headers: {
      'X-Bin-Meta': 'false',
      'X-Master-Key': masterKey,
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

  const response = await window.fetch(`${baseURL}/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': masterKey,
    },
    body: JSON.stringify(mergedFunctionsCache),
  });

  if (!response.ok) {
    throw new Error(`Failed to update cache: ${response.statusText}`);
  }
};
