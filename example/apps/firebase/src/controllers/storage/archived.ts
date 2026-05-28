import { onObjectArchived } from '@snorreks/firestack';

export default onObjectArchived(({ data }) => {
  console.log(`Object archived: ${data.name}`);
});
