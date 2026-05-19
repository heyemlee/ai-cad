import {
  KitchenIntakeState,
  KitchenOpening,
  KitchenPlan,
  KitchenPlanItem,
  StoragePriority,
  WallSide,
} from "./kitchenTypes";

const DEFAULT_INTAKE: KitchenIntakeState = {
  projectName: "KABI Kitchen Plan",
  roomWidth: 144,
  roomDepth: 120,
  ceilingHeight: 96,
  doorWall: "south",
  doorOffset: 42,
  doorWidth: 36,
  hasWindow: true,
  windowWall: "north",
  windowOffset: 54,
  windowWidth: 36,
  waterWall: "north",
  waterOffset: 54,
  includeRange: true,
  rangeWall: "north",
  rangeOffset: 114,
  includeFridge: true,
  fridgeWall: "north",
  fridgeOffset: 6,
  includeDishwasher: true,
  storagePriority: "balanced",
  notes: "",
};

const WALL_SIDES = new Set<WallSide>(["north", "south", "east", "west"]);
const STORAGE_PRIORITIES = new Set<StoragePriority>(["balanced", "more_drawers", "more_pantry"]);

function numberOrDefault(value: unknown, fallback: number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sideOrDefault(value: unknown, fallback: WallSide): WallSide {
  return typeof value === "string" && WALL_SIDES.has(value as WallSide) ? (value as WallSide) : fallback;
}

function storageOrDefault(value: unknown, fallback: StoragePriority): StoragePriority {
  return typeof value === "string" && STORAGE_PRIORITIES.has(value as StoragePriority)
    ? (value as StoragePriority)
    : fallback;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function normalizeKitchenIntake(input: unknown): KitchenIntakeState {
  const source = typeof input === "object" && input !== null ? (input as Partial<KitchenIntakeState>) : {};

  return {
    projectName: stringOrDefault(source.projectName, DEFAULT_INTAKE.projectName),
    roomWidth: numberOrDefault(source.roomWidth, DEFAULT_INTAKE.roomWidth),
    roomDepth: numberOrDefault(source.roomDepth, DEFAULT_INTAKE.roomDepth),
    ceilingHeight: numberOrDefault(source.ceilingHeight, DEFAULT_INTAKE.ceilingHeight),
    doorWall: sideOrDefault(source.doorWall, DEFAULT_INTAKE.doorWall),
    doorOffset: numberOrDefault(source.doorOffset, DEFAULT_INTAKE.doorOffset),
    doorWidth: numberOrDefault(source.doorWidth, DEFAULT_INTAKE.doorWidth),
    hasWindow: booleanOrDefault(source.hasWindow, DEFAULT_INTAKE.hasWindow),
    windowWall: sideOrDefault(source.windowWall, DEFAULT_INTAKE.windowWall),
    windowOffset: numberOrDefault(source.windowOffset, DEFAULT_INTAKE.windowOffset),
    windowWidth: numberOrDefault(source.windowWidth, DEFAULT_INTAKE.windowWidth),
    waterWall: sideOrDefault(source.waterWall, DEFAULT_INTAKE.waterWall),
    waterOffset: numberOrDefault(source.waterOffset, DEFAULT_INTAKE.waterOffset),
    includeRange: booleanOrDefault(source.includeRange, DEFAULT_INTAKE.includeRange),
    rangeWall: sideOrDefault(source.rangeWall, DEFAULT_INTAKE.rangeWall),
    rangeOffset: numberOrDefault(source.rangeOffset, DEFAULT_INTAKE.rangeOffset),
    includeFridge: booleanOrDefault(source.includeFridge, DEFAULT_INTAKE.includeFridge),
    fridgeWall: sideOrDefault(source.fridgeWall, DEFAULT_INTAKE.fridgeWall),
    fridgeOffset: numberOrDefault(source.fridgeOffset, DEFAULT_INTAKE.fridgeOffset),
    includeDishwasher: booleanOrDefault(source.includeDishwasher, DEFAULT_INTAKE.includeDishwasher),
    storagePriority: storageOrDefault(source.storagePriority, DEFAULT_INTAKE.storagePriority),
    notes: stringOrDefault(source.notes, ""),
  };
}

export function defaultKitchenIntake(): KitchenIntakeState {
  return { ...DEFAULT_INTAKE };
}

export function wallLength(wall: WallSide, roomWidth: number, roomDepth: number): number {
  return wall === "north" || wall === "south" ? roomWidth : roomDepth;
}

function clampOffset(offset: number, width: number, wall: WallSide, roomWidth: number, roomDepth: number): number {
  const max = Math.max(0, wallLength(wall, roomWidth, roomDepth) - width);
  return round(Math.min(Math.max(0, offset), max));
}

function itemRect(
  wall: WallSide,
  offset: number,
  width: number,
  depth: number,
  roomWidth: number,
  roomDepth: number,
): Pick<KitchenPlanItem, "x" | "y" | "rectWidth" | "rectDepth"> {
  switch (wall) {
    case "north":
      return { x: offset, y: round(roomDepth - depth), rectWidth: width, rectDepth: depth };
    case "south":
      return { x: offset, y: 0, rectWidth: width, rectDepth: depth };
    case "east":
      return { x: round(roomWidth - depth), y: offset, rectWidth: depth, rectDepth: width };
    case "west":
      return { x: 0, y: offset, rectWidth: depth, rectDepth: width };
  }
}

function makeItem(
  id: string,
  type: KitchenPlanItem["type"],
  wall: WallSide,
  rawOffset: number,
  width: number,
  depth: number,
  roomWidth: number,
  roomDepth: number,
  label: string,
): KitchenPlanItem {
  const offset = clampOffset(rawOffset, width, wall, roomWidth, roomDepth);
  return {
    id,
    type,
    wall,
    offset,
    width,
    depth,
    ...itemRect(wall, offset, width, depth, roomWidth, roomDepth),
    label,
  };
}

function makeOpening(
  id: string,
  type: KitchenOpening["type"],
  wall: WallSide,
  rawOffset: number,
  width: number,
  roomWidth: number,
  roomDepth: number,
  label: string,
): KitchenOpening {
  return {
    id,
    type,
    wall,
    offset: clampOffset(rawOffset, width, wall, roomWidth, roomDepth),
    width,
    label,
  };
}

function spansOverlap(a: { offset: number; width: number }, b: { offset: number; width: number }): boolean {
  return a.offset < b.offset + b.width && b.offset < a.offset + a.width;
}

function wallSpanFits(
  offset: number,
  width: number,
  wall: WallSide,
  roomWidth: number,
  roomDepth: number,
  reserved: Array<{ offset: number; width: number }>,
): boolean {
  if (offset < 0 || offset + width > wallLength(wall, roomWidth, roomDepth)) return false;
  return !reserved.some((span) => spansOverlap({ offset, width }, span));
}

function nearestAvailableOffset(
  desiredOffset: number,
  width: number,
  wall: WallSide,
  roomWidth: number,
  roomDepth: number,
  reserved: Array<{ offset: number; width: number }>,
): number {
  const length = wallLength(wall, roomWidth, roomDepth);
  const clamped = clampOffset(desiredOffset, width, wall, roomWidth, roomDepth);
  if (wallSpanFits(clamped, width, wall, roomWidth, roomDepth, reserved)) return clamped;

  const candidates = new Set<number>([0, Math.max(0, length - width)]);
  reserved.forEach((span) => {
    candidates.add(clampOffset(span.offset - width, width, wall, roomWidth, roomDepth));
    candidates.add(clampOffset(span.offset + span.width, width, wall, roomWidth, roomDepth));
  });

  const sorted = [...candidates]
    .filter((offset) => wallSpanFits(offset, width, wall, roomWidth, roomDepth, reserved))
    .sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped));

  return sorted[0] ?? clamped;
}

function reservedForWall(
  wall: WallSide,
  openings: KitchenOpening[],
  items: KitchenPlanItem[],
): Array<{ offset: number; width: number }> {
  return [
    ...openings.filter((opening) => opening.wall === wall && opening.type === "door"),
    ...items.filter((item) => item.wall === wall),
  ].map((item) => ({ offset: item.offset, width: item.width }));
}

function placeItem(
  items: KitchenPlanItem[],
  openings: KitchenOpening[],
  id: string,
  type: KitchenPlanItem["type"],
  wall: WallSide,
  desiredOffset: number,
  width: number,
  depth: number,
  roomWidth: number,
  roomDepth: number,
  label: string,
): KitchenPlanItem {
  const offset = nearestAvailableOffset(
    desiredOffset,
    width,
    wall,
    roomWidth,
    roomDepth,
    reservedForWall(wall, openings, items),
  );
  const item = makeItem(id, type, wall, offset, width, depth, roomWidth, roomDepth, label);
  items.push(item);
  return item;
}

function addBaseCabinets(
  items: KitchenPlanItem[],
  wall: WallSide,
  roomWidth: number,
  roomDepth: number,
  blockedSpans: Array<{ offset: number; width: number }>,
): void {
  const depth = 24;
  const length = wallLength(wall, roomWidth, roomDepth);
  const occupied = [
    ...items.filter((item) => item.wall === wall).map((item) => ({ offset: item.offset, width: item.width })),
    ...blockedSpans,
  ].sort((a, b) => a.offset - b.offset);

  let cursor = 0;
  let index = 1;
  occupied.forEach((span) => {
    const gap = round(span.offset - cursor);
    if (gap >= 6) {
      const type = gap < 12 ? "filler" : "base";
      const label = type === "filler" ? `FILLER ${gap}"` : `BASE ${gap}"`;
      items.push(makeItem(`base-${wall}-${index}`, "base_cabinet", wall, cursor, gap, depth, roomWidth, roomDepth, label));
      index += 1;
    }
    cursor = Math.max(cursor, round(span.offset + span.width));
  });

  const lastGap = round(length - cursor);
  if (lastGap >= 6) {
    const type = lastGap < 12 ? "FILLER" : "BASE";
    items.push(
      makeItem(`base-${wall}-${index}`, "base_cabinet", wall, cursor, lastGap, depth, roomWidth, roomDepth, `${type} ${lastGap}"`),
    );
  }
}

export function buildKitchenPlan(intakeInput: unknown, id = "preview"): KitchenPlan {
  const intake = normalizeKitchenIntake(intakeInput);
  const roomWidth = round(intake.roomWidth);
  const roomDepth = round(intake.roomDepth);
  const openings: KitchenOpening[] = [
    makeOpening("door-1", "door", intake.doorWall, intake.doorOffset, intake.doorWidth, roomWidth, roomDepth, "DOOR"),
  ];

  if (intake.hasWindow) {
    openings.push(
      makeOpening("window-1", "window", intake.windowWall, intake.windowOffset, intake.windowWidth, roomWidth, roomDepth, "WINDOW"),
    );
  }

  const items: KitchenPlanItem[] = [];
  const sinkOffset = intake.waterOffset;
  const sinkItem = placeItem(
    items,
    openings,
    "sink-1",
    "sink",
    intake.waterWall,
    sinkOffset,
    36,
    24,
    roomWidth,
    roomDepth,
    "SINK",
  );

  if (intake.includeDishwasher) {
    const waterWallLength = wallLength(sinkItem.wall, roomWidth, roomDepth);
    const dishwasherWidth = 24;
    const dishwasherOffset =
      sinkItem.offset + sinkItem.width + dishwasherWidth <= waterWallLength
        ? sinkItem.offset + sinkItem.width
        : Math.max(0, sinkItem.offset - dishwasherWidth);
    placeItem(
      items,
      openings,
      "dishwasher-1",
      "dishwasher",
      sinkItem.wall,
      dishwasherOffset,
      dishwasherWidth,
      24,
      roomWidth,
      roomDepth,
      "DW24",
    );
  }

  if (intake.includeRange) {
    placeItem(
      items,
      openings,
      "range-1",
      "range",
      intake.rangeWall,
      intake.rangeOffset,
      30,
      24,
      roomWidth,
      roomDepth,
      "RANGE",
    );
  }

  if (intake.includeFridge) {
    placeItem(
      items,
      openings,
      "fridge-1",
      "refrigerator",
      intake.fridgeWall,
      intake.fridgeOffset,
      36,
      30,
      roomWidth,
      roomDepth,
      "REF36",
    );
  }

  const cabinetWalls = new Set<WallSide>(items.map((item) => item.wall));
  cabinetWalls.forEach((wall) => {
    const blocked = openings
      .filter((opening) => opening.wall === wall && opening.type === "door")
      .map((opening) => ({ offset: opening.offset, width: opening.width }));
    addBaseCabinets(items, wall, roomWidth, roomDepth, blocked);
  });

  items.sort((a, b) => {
    if (a.wall === b.wall) return a.offset - b.offset;
    return a.wall.localeCompare(b.wall);
  });

  const notes = [
    `Storage priority: ${intake.storagePriority}`,
    intake.notes,
  ].filter((note) => note.trim());

  items.forEach((item, index) => {
    const sameWall = items.slice(0, index).filter((candidate) => candidate.wall === item.wall);
    const overlapping = sameWall.find((candidate) => spansOverlap(candidate, item));
    if (overlapping && item.type === "base_cabinet") {
      item.label = `${item.label} ADJ`;
    }
  });

  return {
    id,
    projectName: intake.projectName || DEFAULT_INTAKE.projectName,
    unit: "inch",
    room: {
      width: roomWidth,
      depth: roomDepth,
      ceilingHeight: round(intake.ceilingHeight),
    },
    openings,
    items,
    notes,
  };
}
