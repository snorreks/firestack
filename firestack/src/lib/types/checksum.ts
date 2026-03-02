// bunfire/src/lib/types/checksum.ts

export interface ChecksumData {
  functionName: string;
  outputRoot: string;
  flavor: string;
  force?: boolean;
  outputDirectory: string;
  checksum?: string;
  environment?: Record<string, string>;
}
