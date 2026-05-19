import { KitchenPlan, KitchenRuleResult, WallSide } from "./kitchenTypes";
import { wallLength } from "./kitchenPlan";

const EPSILON = 0.001;

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function spanEnd(item: { offset: number; width: number }): number {
  return item.offset + item.width;
}

function overlaps(a: { offset: number; width: number }, b: { offset: number; width: number }): boolean {
  return a.offset < spanEnd(b) - EPSILON && b.offset < spanEnd(a) - EPSILON;
}

function validateWallSpan(
  label: string,
  wall: WallSide,
  offset: number,
  width: number,
  roomWidth: number,
  roomDepth: number,
  errors: string[],
): void {
  const length = wallLength(wall, roomWidth, roomDepth);
  if (!Number.isFinite(offset)) errors.push(`${label} offset must be a valid number.`);
  if (!isFinitePositive(width)) errors.push(`${label} width must be positive.`);
  if (offset < -EPSILON) errors.push(`${label} starts before the ${wall} wall.`);
  if (offset + width > length + EPSILON) errors.push(`${label} extends past the ${wall} wall length ${length}".`);
}

export function runKitchenRuleCheck(plan: KitchenPlan): KitchenRuleResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isFinitePositive(plan.room.width)) errors.push("Room width must be positive.");
  if (!isFinitePositive(plan.room.depth)) errors.push("Room depth must be positive.");
  if (!isFinitePositive(plan.room.ceilingHeight)) errors.push("Ceiling height must be positive.");

  if (plan.room.width < 60 || plan.room.depth < 60) {
    warnings.push("Room is smaller than 60\" in at least one direction; verify the customer dimensions.");
  }

  plan.openings.forEach((opening) => {
    validateWallSpan(
      opening.label,
      opening.wall,
      opening.offset,
      opening.width,
      plan.room.width,
      plan.room.depth,
      errors,
    );
  });

  plan.items.forEach((item) => {
    validateWallSpan(
      item.label,
      item.wall,
      item.offset,
      item.width,
      plan.room.width,
      plan.room.depth,
      errors,
    );
    if (!isFinitePositive(item.depth)) errors.push(`${item.label} depth must be positive.`);
    if (item.x < -EPSILON || item.y < -EPSILON) errors.push(`${item.label} is outside the room.`);
    if (item.x + item.rectWidth > plan.room.width + EPSILON || item.y + item.rectDepth > plan.room.depth + EPSILON) {
      errors.push(`${item.label} extends outside the room boundary.`);
    }
  });

  const activeItems = plan.items.filter((item) => item.type !== "base_cabinet");
  for (let index = 1; index < activeItems.length; index += 1) {
    const current = activeItems[index];
    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      const previous = activeItems[previousIndex];
      if (current.wall === previous.wall && overlaps(current, previous)) {
        errors.push(`${previous.label} overlaps ${current.label} on the ${current.wall} wall.`);
      }
    }
  }

  const doors = plan.openings.filter((opening) => opening.type === "door");
  doors.forEach((door) => {
    plan.items.forEach((item) => {
      if (item.wall === door.wall && overlaps(item, door)) {
        errors.push(`${item.label} overlaps ${door.label} on the ${door.wall} wall.`);
      }
    });
  });

  if (!plan.items.some((item) => item.type === "sink")) {
    errors.push("A first-pass kitchen plan must include a sink.");
  }

  if (!plan.items.some((item) => item.type === "refrigerator")) {
    warnings.push("No refrigerator was included in this layout.");
  }

  if (!plan.items.some((item) => item.type === "range")) {
    warnings.push("No range/cooktop was included in this layout.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
