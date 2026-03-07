import { onObjectDeleted } from '@snorreks/firestack';

export default onObjectDeleted(({ data }) => {
  console.log(`Object deleted: ${data.name}`);
});
