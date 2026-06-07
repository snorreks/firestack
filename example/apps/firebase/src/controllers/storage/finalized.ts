import { onObjectFinalized } from '@snorreks/firestack';

/**
 * Storage onObjectFinalized trigger — demonstrates batch for image processing.
 *
 * When a new file is uploaded, multiple processing steps (thumbnail generation,
 * virus scan, metadata extraction) can run concurrently via batch.
 */
export default onObjectFinalized(async ({ data, batch }) => {
  console.log(`Object finalized: ${data.name}`);

  batch.push(async () => {
    console.log(`Generating thumbnail for ${data.name}`);
  });

  batch.push(async () => {
    console.log(`Extracting metadata for ${data.name}`);
  });

  batch.push(async () => {
    console.log(`Updating file registry for ${data.name}`);
  });
});
