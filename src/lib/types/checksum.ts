export type ChecksumData = {
  functionName: string;
  outputRoot: string;
  flavor: string;
  force?: boolean;
  outputDirectory: string;
  checksum?: string;
  environment?: Record<string, string>;
};
