import { KitchenIntakeState, WallSide } from "./kitchenTypes";
import { normalizeKitchenIntake, wallLength } from "./kitchenPlan";

export type KitchenModifyResult = {
  intake: KitchenIntakeState;
  applied: string[];
  warnings: string[];
};

type Target = "sink" | "range" | "fridge" | "dishwasher" | "window" | "door";

function cloneIntake(intake: KitchenIntakeState): KitchenIntakeState {
  return { ...intake };
}

function parseWall(text: string): WallSide | undefined {
  if (/(north|top|back|上墙|北墙|后墙|上面)/i.test(text)) return "north";
  if (/(south|bottom|front|下墙|南墙|下面|前墙)/i.test(text)) return "south";
  if (/(east|right wall|right side|右墙|右侧)/i.test(text)) return "east";
  if (/(west|left wall|left side|左墙|左侧)/i.test(text)) return "west";
  return undefined;
}

function parseTarget(text: string): Target | undefined {
  if (/(sink|水槽|水池)/i.test(text)) return "sink";
  if (/(range|stove|cooktop|炉灶|灶台|炉|灶)/i.test(text)) return "range";
  if (/(fridge|refrigerator|冰箱)/i.test(text)) return "fridge";
  if (/(dishwasher|洗碗机)/i.test(text)) return "dishwasher";
  if (/(window|窗户|窗)/i.test(text)) return "window";
  if (/(door|门)/i.test(text)) return "door";
  return undefined;
}

function parseDistance(text: string, fallback: number): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in|寸|")?/i);
  return match ? Number(match[1]) : fallback;
}

function clampOffsetForTarget(intake: KitchenIntakeState, wall: WallSide, offset: number, width: number): number {
  const length = wallLength(wall, intake.roomWidth, intake.roomDepth);
  return Math.min(Math.max(0, offset), Math.max(0, length - width));
}

function getTargetPosition(intake: KitchenIntakeState, target: Target): { wall: WallSide; offset: number; width: number } {
  switch (target) {
    case "sink":
      return { wall: intake.waterWall, offset: intake.waterOffset, width: 36 };
    case "range":
      return { wall: intake.rangeWall, offset: intake.rangeOffset, width: 30 };
    case "fridge":
      return { wall: intake.fridgeWall, offset: intake.fridgeOffset, width: 36 };
    case "dishwasher":
      return { wall: intake.waterWall, offset: intake.waterOffset + 36, width: 24 };
    case "window":
      return { wall: intake.windowWall, offset: intake.windowOffset, width: intake.windowWidth };
    case "door":
      return { wall: intake.doorWall, offset: intake.doorOffset, width: intake.doorWidth };
  }
}

function setTargetPosition(intake: KitchenIntakeState, target: Target, wall: WallSide, offset: number): void {
  const current = getTargetPosition(intake, target);
  const nextOffset = clampOffsetForTarget(intake, wall, offset, current.width);

  switch (target) {
    case "sink":
      intake.waterWall = wall;
      intake.waterOffset = nextOffset;
      break;
    case "range":
      intake.includeRange = true;
      intake.rangeWall = wall;
      intake.rangeOffset = nextOffset;
      break;
    case "fridge":
      intake.includeFridge = true;
      intake.fridgeWall = wall;
      intake.fridgeOffset = nextOffset;
      break;
    case "dishwasher":
      intake.includeDishwasher = true;
      intake.waterWall = wall;
      intake.waterOffset = clampOffsetForTarget(intake, wall, nextOffset - 36, 36);
      break;
    case "window":
      intake.hasWindow = true;
      intake.windowWall = wall;
      intake.windowOffset = nextOffset;
      break;
    case "door":
      intake.doorWall = wall;
      intake.doorOffset = nextOffset;
      break;
  }
}

export function applyKitchenModifyRequest(current: unknown, request: string): KitchenModifyResult {
  const intake = cloneIntake(normalizeKitchenIntake(current));
  const text = request.trim();
  const lower = text.toLowerCase();
  const applied: string[] = [];
  const warnings: string[] = [];

  if (!text) {
    return { intake, applied, warnings: ["No modify request was provided."] };
  }

  const target = parseTarget(text);
  if (!target) {
    warnings.push("Could not find a supported target. Try naming sink, range, fridge, dishwasher, door, or window.");
    return { intake, applied, warnings };
  }

  if (/(remove|delete|without|不要|删除|去掉)/i.test(text)) {
    if (target === "range") {
      intake.includeRange = false;
      applied.push("Removed range from the plan.");
    } else if (target === "fridge") {
      intake.includeFridge = false;
      applied.push("Removed refrigerator from the plan.");
    } else if (target === "dishwasher") {
      intake.includeDishwasher = false;
      applied.push("Removed dishwasher from the plan.");
    } else if (target === "window") {
      intake.hasWindow = false;
      applied.push("Removed window from the plan.");
    } else {
      warnings.push("This MVP cannot remove the sink or primary door.");
    }
    return { intake, applied, warnings };
  }

  if (/(add|include|need|增加|添加|要)/i.test(text)) {
    if (target === "range") intake.includeRange = true;
    if (target === "fridge") intake.includeFridge = true;
    if (target === "dishwasher") intake.includeDishwasher = true;
    if (target === "window") intake.hasWindow = true;
    applied.push(`Included ${target} in the plan.`);
  }

  if (/(under window|below window|窗户下面|窗下)/i.test(text) && target === "sink") {
    intake.waterWall = intake.windowWall;
    intake.waterOffset = clampOffsetForTarget(intake, intake.windowWall, intake.windowOffset, 36);
    applied.push("Moved sink under the window.");
    return { intake, applied, warnings };
  }

  const requestedWall = parseWall(text);
  if (requestedWall) {
    const current = getTargetPosition(intake, target);
    setTargetPosition(intake, target, requestedWall, Math.min(current.offset, wallLength(requestedWall, intake.roomWidth, intake.roomDepth)));
    applied.push(`Moved ${target} to the ${requestedWall} wall.`);
  }

  const hasDirectionalMove = /(move\s+left|left\s+\d|左移|move\s+right|right\s+\d|右移|move\s+up|up\s+\d|上移|move\s+down|down\s+\d|下移)/i.test(text);
  if (hasDirectionalMove) {
    const current = getTargetPosition(intake, target);
    const distance = parseDistance(text, 6);
    const shouldIncrease =
      /(move\s+right|right\s+\d|右移|move\s+up|up\s+\d|上移)/i.test(text) ||
      (current.wall === "east" && /(move\s+down|down\s+\d|下移)/i.test(text)) ||
      (current.wall === "west" && /(move\s+up|up\s+\d|上移)/i.test(text));
    const delta = shouldIncrease ? distance : -distance;
    setTargetPosition(intake, target, current.wall, current.offset + delta);
    applied.push(`Moved ${target} ${Math.abs(delta)}" ${delta >= 0 ? "forward" : "back"} along its wall.`);
  }

  const absoluteMatch = lower.match(/(?:offset|from|距离|离)\s*(?:left|corner|角|起点)?\s*(\d+(?:\.\d+)?)/i);
  if (absoluteMatch) {
    const current = getTargetPosition(intake, target);
    setTargetPosition(intake, target, current.wall, Number(absoluteMatch[1]));
    applied.push(`Set ${target} offset to ${absoluteMatch[1]}".`);
  }

  if (/(more storage|more drawers|多收纳|多抽屉|增加.*柜)/i.test(text)) {
    intake.storagePriority = "more_drawers";
    intake.notes = `${intake.notes ? `${intake.notes}\n` : ""}${text}`;
    applied.push("Captured a stronger storage preference.");
  }

  if (applied.length === 0) {
    warnings.push("Request was understood partially, but no supported change was applied.");
  }

  return { intake, applied, warnings };
}
