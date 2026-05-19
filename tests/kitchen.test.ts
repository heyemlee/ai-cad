import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { createKitchenDrawing, drawingOutputDir } from "../lib/drawingService";
import { generateKitchenScript } from "../lib/generateKitchenPlanLisp";
import { applyKitchenModifyRequest } from "../lib/kitchenModify";
import { buildKitchenPlan, defaultKitchenIntake } from "../lib/kitchenPlan";
import { runKitchenRuleCheck } from "../lib/kitchenRules";

test("default intake builds a valid kitchen plan", () => {
  const plan = buildKitchenPlan(defaultKitchenIntake(), "test-plan");
  const result = runKitchenRuleCheck(plan);

  assert.equal(result.ok, true);
  assert.equal(plan.room.width, 144);
  assert.ok(plan.items.some((item) => item.type === "sink"));
  assert.ok(plan.items.some((item) => item.type === "refrigerator"));
  assert.ok(plan.openings.some((opening) => opening.type === "door"));
});

test("rule check catches overlapping active items", () => {
  const plan = buildKitchenPlan(defaultKitchenIntake(), "overlap-plan");
  const sink = plan.items.find((item) => item.type === "sink");
  const range = plan.items.find((item) => item.type === "range");
  assert.ok(sink);
  assert.ok(range);
  range.wall = sink.wall;
  range.offset = sink.offset;
  range.x = sink.x;
  range.y = sink.y;
  const result = runKitchenRuleCheck(plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("overlaps")));
});

test("dishwasher moves before sink when sink is near the end of a wall", () => {
  const intake = {
    ...defaultKitchenIntake(),
    roomWidth: 188,
    roomDepth: 88,
    waterWall: "west" as const,
    waterOffset: 54,
  };
  const plan = buildKitchenPlan(intake, "west-sink-plan");
  const result = runKitchenRuleCheck(plan);
  const sink = plan.items.find((item) => item.type === "sink");
  const dishwasher = plan.items.find((item) => item.type === "dishwasher");

  assert.equal(result.ok, true);
  assert.equal(sink?.offset, 52);
  assert.equal(dishwasher?.offset, 28);
});

test("modify parser moves sink under the window", () => {
  const intake = {
    ...defaultKitchenIntake(),
    waterWall: "east" as const,
    waterOffset: 20,
    windowWall: "north" as const,
    windowOffset: 60,
  };

  const result = applyKitchenModifyRequest(intake, "把水槽放到窗户下面");

  assert.equal(result.intake.waterWall, "north");
  assert.equal(result.intake.waterOffset, 60);
  assert.ok(result.applied.some((item) => item.includes("under the window")));
});

test("generated script escapes paths with spaces", () => {
  const script = generateKitchenScript("/Users/example/My Project/kitchen plan.lsp");

  assert.match(script, /\(setvar "SECURELOAD" 0\)/);
  assert.match(script, /\(load "\/Users\/example\/My Project\/kitchen plan\.lsp"\)/);
  assert.match(script, /KABI_KITCHEN_PLAN/);
});

test("drawing service writes JSON, LISP, and SCR without launching AutoCAD", async () => {
  const id = `test-kitchen-${Date.now()}`;

  try {
    const job = await createKitchenDrawing(defaultKitchenIntake(), { id, launchAutoCAD: false });

    assert.equal(job.status, "drawn");
    assert.equal(job.autocad.mode, "skipped");
    await access(job.files.jsonPath);
    await access(job.files.lispPath);
    await access(job.files.scriptPath);

    const script = await readFile(job.files.scriptPath, "utf8");
    assert.match(script, /KABI_KITCHEN_PLAN/);
  } finally {
    await rm(drawingOutputDir(id), { recursive: true, force: true });
  }
});
