import { onRequestZod } from '@snorreks/firestack';
import { z } from 'zod';

const TestSchema = z.object({
  id: z.string(),
});

export default onRequestZod(
  TestSchema,
  (req, res) => {
    const body = req.body;
    console.log('body', body.id);

    res.send({ ok: true, message: 'Assets test' });
  },
  {
    assets: ['src/assets/image.avif'],
    functionName: 'assets_test_api',
  }
);
