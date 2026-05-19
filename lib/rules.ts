import { getBaseSequence, LayoutJson, roundCoord, WallCabinet } from "./layout";

export type RuleResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const EPSILON = 0.001;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

function rangeEnd(item: { x: number; width: number }): number {
  return roundCoord(item.x + item.width);
}

function validateNumber(label: string, value: number, errors: string[]): void {
  if (!Number.isFinite(value)) {
    errors.push(`${label} must be a valid number.`);
  }
}

function validateRanges(
  rowName: string,
  items: Array<{ item: string; label: string; x: number; width: number }>,
  wallWidth: number,
  errors: string[],
): void {
  const sorted = [...items].sort((a, b) => a.x - b.x);

  sorted.forEach((cabinet) => {
    if (cabinet.width <= 0) {
      errors.push(`${rowName} ${cabinet.item || cabinet.label} width must be positive.`);
    }
    if (cabinet.x < 0) {
      errors.push(`${rowName} ${cabinet.item || cabinet.label} has negative x position.`);
    }
    if (rangeEnd(cabinet) > wallWidth + EPSILON) {
      errors.push(`${rowName} ${cabinet.item || cabinet.label} extends past wall width ${wallWidth}".`);
    }
  });

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.x < rangeEnd(previous) - EPSILON) {
      errors.push(
        `${rowName} ${previous.item || previous.label} overlaps ${current.item || current.label}.`,
      );
    }
  }
}

function validateWallCabinetHeights(
  cabinets: WallCabinet[],
  wallHeight: number,
  errors: string[],
): void {
  cabinets.forEach((cabinet) => {
    const bottom = roundCoord(cabinet.top - cabinet.height);
    if (cabinet.top > wallHeight + EPSILON) {
      errors.push(`${cabinet.item || cabinet.label} top height exceeds wall height ${wallHeight}".`);
    }
    if (bottom < -EPSILON) {
      errors.push(`${cabinet.item || cabinet.label} bottom height is below 0".`);
    }
    if (!nearlyEqual(bottom, roundCoord(cabinet.top - cabinet.height))) {
      errors.push(`${cabinet.item || cabinet.label} bottom height calculation is inconsistent.`);
    }
  });
}

export function runRuleCheck(layout: LayoutJson): RuleResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const baseSequence = getBaseSequence(layout);

  validateNumber("Wall width", layout.wall.width, errors);
  validateNumber("Wall height", layout.wall.height, errors);

  if (layout.wall.width <= 0) errors.push("Wall width must be positive.");
  if (layout.wall.height <= 0) errors.push("Wall height must be positive.");

  [...baseSequence, ...layout.wall_cabinets].forEach((cabinet) => {
    validateNumber(`${cabinet.item || cabinet.label} x`, cabinet.x, errors);
    validateNumber(`${cabinet.item || cabinet.label} width`, cabinet.width, errors);
    validateNumber(`${cabinet.item || cabinet.label} height`, cabinet.height, errors);
  });

  layout.wall_cabinets.forEach((cabinet) => {
    validateNumber(`${cabinet.item || cabinet.label} top height`, cabinet.top, errors);
  });

  const baseTotal = roundCoord(baseSequence.reduce((sum, cabinet) => sum + cabinet.width, 0));
  if (!nearlyEqual(baseTotal, layout.wall.width)) {
    errors.push(`Base cabinet total width is ${baseTotal}", but wall width is ${layout.wall.width}".`);
  }

  validateRanges("Base row", baseSequence, layout.wall.width, errors);
  validateRanges("Wall row", layout.wall_cabinets, layout.wall.width, errors);
  validateWallCabinetHeights(layout.wall_cabinets, layout.wall.height, errors);

  const sinkBases = baseSequence.filter((cabinet) => cabinet.type === "sink_base");
  if (sinkBases.length === 0) {
    warnings.push("No sink base found, so no sink symbol will be drawn.");
  }

  sinkBases.forEach((cabinet) => {
    if (cabinet.width <= 0 || cabinet.height <= 0) {
      errors.push(`${cabinet.item || cabinet.label} cannot receive a centered sink symbol.`);
    }
  });

  if (!nearlyEqual(layout.wall.width, layout.wall.width)) {
    errors.push("Overall wall dimension does not match wall width.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
