export type WallSide = "north" | "south" | "east" | "west";

export type StoragePriority = "balanced" | "more_drawers" | "more_pantry";

export type KitchenIntakeState = {
  projectName: string;
  roomWidth: number;
  roomDepth: number;
  ceilingHeight: number;
  doorWall: WallSide;
  doorOffset: number;
  doorWidth: number;
  hasWindow: boolean;
  windowWall: WallSide;
  windowOffset: number;
  windowWidth: number;
  waterWall: WallSide;
  waterOffset: number;
  includeRange: boolean;
  rangeWall: WallSide;
  rangeOffset: number;
  includeFridge: boolean;
  fridgeWall: WallSide;
  fridgeOffset: number;
  includeDishwasher: boolean;
  storagePriority: StoragePriority;
  notes: string;
};

export type KitchenOpeningType = "door" | "window";

export type KitchenOpening = {
  id: string;
  type: KitchenOpeningType;
  wall: WallSide;
  offset: number;
  width: number;
  label: string;
};

export type KitchenItemType = "base_cabinet" | "sink" | "range" | "refrigerator" | "dishwasher";

export type KitchenPlanItem = {
  id: string;
  type: KitchenItemType;
  wall: WallSide;
  offset: number;
  width: number;
  depth: number;
  x: number;
  y: number;
  rectWidth: number;
  rectDepth: number;
  label: string;
};

export type KitchenPlan = {
  id: string;
  projectName: string;
  unit: "inch";
  room: {
    width: number;
    depth: number;
    ceilingHeight: number;
  };
  openings: KitchenOpening[];
  items: KitchenPlanItem[];
  notes: string[];
};

export type KitchenRuleResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type AutoCADLaunchResult = {
  attempted: boolean;
  ok: boolean;
  mode: "core-console" | "autocad-batch" | "autocad-gui" | "open-app" | "not-found" | "skipped";
  message: string;
  pid?: number;
  error?: string;
};

export type DrawingJob = {
  id: string;
  status: "drawn" | "failed";
  intake: KitchenIntakeState;
  plan: KitchenPlan;
  ruleResult: KitchenRuleResult;
  files: {
    outputDir: string;
    intakePath: string;
    jsonPath: string;
    lispPath: string;
    scriptPath: string;
    dwgPath: string;
  };
  autocad: AutoCADLaunchResult;
};
