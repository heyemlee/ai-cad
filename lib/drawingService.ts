import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { launchAutoCADScript } from "./autocad";
import { generateKitchenCommand, generateKitchenPlanLisp, generateKitchenScript } from "./generateKitchenPlanLisp";
import { buildKitchenPlan, normalizeKitchenIntake } from "./kitchenPlan";
import { runKitchenRuleCheck } from "./kitchenRules";
import { DrawingJob, KitchenIntakeState } from "./kitchenTypes";

function makeDrawingId(prefix = "kitchen"): string {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
}

export function drawingOutputDir(id: string): string {
  return resolve("output", id);
}

export async function readDrawingIntake(id: string): Promise<KitchenIntakeState> {
  const inputPath = resolve(drawingOutputDir(id), "kitchen_intake.json");
  const text = await readFile(inputPath, "utf8");
  return normalizeKitchenIntake(JSON.parse(text));
}

export async function createKitchenDrawing(
  intakeInput: unknown,
  options: { id?: string; launchAutoCAD?: boolean } = {},
): Promise<DrawingJob> {
  const id = options.id ?? makeDrawingId();
  const intake = normalizeKitchenIntake(intakeInput);
  const plan = buildKitchenPlan(intake, id);
  const ruleResult = runKitchenRuleCheck(plan);
  const outputDir = drawingOutputDir(id);
  const intakePath = resolve(outputDir, "kitchen_intake.json");
  const jsonPath = resolve(outputDir, "kitchen_plan.json");
  const lispPath = resolve(outputDir, "kitchen_plan.lsp");
  const scriptPath = resolve(outputDir, "draw_kitchen_plan.scr");
  const dwgPath = options.launchAutoCAD !== false
    ? resolve("output", "latest_kitchen_plan.dwg")
    : resolve(outputDir, "kitchen_plan.dwg");

  await mkdir(outputDir, { recursive: true });
  await writeFile(intakePath, `${JSON.stringify(intake, null, 2)}\n`);
  await writeFile(jsonPath, `${JSON.stringify(plan, null, 2)}\n`);

  if (!ruleResult.ok) {
    const autocad = await launchAutoCADScript(scriptPath, false);
    return {
      id,
      status: "failed",
      intake,
      plan,
      ruleResult,
      files: { outputDir, intakePath, jsonPath, lispPath, scriptPath, dwgPath },
      autocad,
    };
  }

  await writeFile(lispPath, generateKitchenPlanLisp(plan));
  await writeFile(scriptPath, generateKitchenScript(lispPath, dwgPath));

  const autocad = await launchAutoCADScript(
    scriptPath,
    options.launchAutoCAD ?? true,
    generateKitchenCommand(lispPath, dwgPath),
    dwgPath,
  );

  return {
    id,
    status: autocad.ok ? "drawn" : "failed",
    intake,
    plan,
    ruleResult,
    files: { outputDir, intakePath, jsonPath, lispPath, scriptPath, dwgPath },
    autocad,
  };
}
