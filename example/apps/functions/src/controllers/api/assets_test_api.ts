import { onRequest } from '@snorreks/firestack';

export default onRequest(
  (_req, res) => {
    res.send({ ok: true, message: 'Assets test' });
  },
  {
    assets: ['src/assets/image.avif'],
    functionName: 'assets_test_api',
  }
);
