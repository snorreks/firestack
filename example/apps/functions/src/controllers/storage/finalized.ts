import { onObjectFinalized } from '@snorreks/firestack';

export default onObjectFinalized(({ data }) => {
  console.log(`Object finalized: ${data.name}`);
});
