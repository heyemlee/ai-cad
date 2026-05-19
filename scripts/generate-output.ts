import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateLisp } from "../lib/generateLisp";
import { buildLayout, defaultFormState } from "../lib/layout";
import { runRuleCheck } from "../lib/rules";

async function main() {
  const layout = buildLayout(defaultFormState);
  const result = runRuleCheck(layout);

  if (!result.ok) {
    throw new Error(`Rule check failed:\n${result.errors.join("\n")}`);
  }

  const outputDir = resolve("output");
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, "kabi_mvp_layout.json"), `${JSON.stringify(layout, null, 2)}\n`);
  await writeFile(resolve(outputDir, "kabi_mvp_layout.lsp"), generateLisp(layout));

  console.log("Generated output/kabi_mvp_layout.json");
  console.log("Generated output/kabi_mvp_layout.lsp");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
