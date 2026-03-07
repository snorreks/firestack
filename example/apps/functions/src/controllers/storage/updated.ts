import { onObjectMetadataUpdated } from '@snorreks/firestack';

export default onObjectMetadataUpdated(
  ({ data }) => {
    console.log(`Object updated: ${data.name}`, data.metadata);
  },

  {}
);
