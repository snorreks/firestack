#!/usr/bin/env bun

import { cp, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const rootDir = import.meta.dir;

async function main() {
  console.log("Building...");
  execSync("bun run build", { cwd: rootDir, stdio: "inherit" });

  const pkg = JSON.parse(
    await Bun.file(join(rootDir, "package.json")).text()
  );

  const distPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    type: pkg.type,
    main: pkg.main,
    bin: pkg.bin,
    files: pkg.files,
    dependencies: pkg.dependencies,
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
  };

  const distDir = join(rootDir, "dist");
  if (!existsSync(distDir)) {
    await mkdir(distDir, { recursive: true });
  }

  console.log("Creating dist/package.json...");
  await Bun.write(
    join(distDir, "package.json"),
    JSON.stringify(distPkg, null, 2) + "\n"
  );

  console.log("Copying README.md to dist...");
  await cp(join(rootDir, "README.md"), join(distDir, "README.md"));

  console.log("Copying index.d.ts to dist...");
  await cp(join(rootDir, "src/index.d.ts"), join(distDir, "index.d.ts"));

  console.log("Publishing to npm...");
  if (process.env.NPM_TOKEN) {
    await Bun.write(
      join(distDir, ".npmrc"),
      `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`
    );
  }
  execSync("npm publish --access public", {
    cwd: distDir,
    stdio: "inherit",
  });

  console.log("Done!");
}

main();
