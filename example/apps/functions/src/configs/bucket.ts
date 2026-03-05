import type { Bucket } from '@google-cloud/storage';
import { getStorage } from 'firebase-admin/storage';

import { getApp } from './app.ts';

let _bucket: Bucket | undefined;

export const getBucket = (): Bucket => {
  if (!_bucket) {
    _bucket = getStorage(getApp()).bucket();
  }
  return _bucket;
};
