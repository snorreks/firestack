export type ChecksumData = {
  functionName: string;
  outputRoot: string;
  mode: string;
  force?: boolean;
  outputDirectory: string;
  checksum?: string;
  environment?: Record<string, string>;
  cachedChecksums?: Record<string, string>;
};
