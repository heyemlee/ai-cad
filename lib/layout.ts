export type BaseCabinetType = "base" | "appliance" | "filler" | "sink_base";
export type WallCabinetType = "wall" | "filler" | "open_space";

export type CatalogItem = {
  sku: string;
  width: number;
  height: number;
  depth: number;
  drawer_qty?: number;
  description?: string;
  type?: string;
};

export type BaseInputRow = {
  id: string;
  item: string;
  label: string;
  type: BaseCabinetType;
  width: number | string;
  height: number | string;
  depth?: number | string;
  description?: string;
  x?: number | string;
};

export type WallInputRow = {
  id: string;
  item: string;
  label: string;
  type: WallCabinetType;
  width: number | string;
  height: number | string;
  depth?: number | string;
  description?: string;
  top: number | string;
  x?: number | string;
};

export type FormState = {
  project_name: string;
  wall: {
    width: number | string;
    height: number | string;
  };
  baseRows: BaseInputRow[];
  wallRows: WallInputRow[];
};

export type BaseCabinet = {
  item: string;
  label: string;
  type: BaseCabinetType;
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  description?: string;
};

export type WallCabinet = {
  item: string;
  label: string;
  type: WallCabinetType;
  x: number;
  top: number;
  width: number;
  height: number;
  depth?: number;
  description?: string;
};

export type LayoutJson = {
  project_name: string;
  unit: "inch";
  wall: {
    width: number;
    height: number;
  };
  base_cabinets: BaseCabinet[];
  wall_cabinets: WallCabinet[];
  appliances: BaseCabinet[];
  notes: string[];
};

export const defaultFormState: FormState = {
  project_name: "KABI MVP Test",
  wall: {
    width: 133,
    height: 96,
  },
  baseRows: [
    {
      id: "base-11",
      item: "#11",
      label: "FILLER",
      type: "filler",
      width: 24,
      height: 34.5,
    },
    {
      id: "base-12",
      item: "#12",
      label: "B31",
      type: "base",
      width: 31,
      height: 34.5,
    },
    {
      id: "base-13",
      item: "#13",
      label: "SB36",
      type: "sink_base",
      width: 36,
      height: 34.5,
    },
    {
      id: "base-14",
      item: "#14",
      label: "B31",
      type: "base",
      width: 31,
      height: 34.5,
    },
    {
      id: "base-15",
      item: "#15",
      label: "FILLER",
      type: "filler",
      width: 11,
      height: 34.5,
    },
  ],
  wallRows: [
    {
      id: "wall-6",
      item: "#6",
      label: "W24",
      type: "wall",
      x: 0,
      width: 24,
      height: 40,
      top: 96,
    },
    {
      id: "wall-7",
      item: "#7",
      label: "W37.5",
      type: "wall",
      x: 27,
      width: 37.5,
      height: 22,
      top: 96,
    },
    {
      id: "wall-8",
      item: "#8",
      label: "W33",
      type: "wall",
      x: 67.5,
      width: 33,
      height: 40,
      top: 96,
    },
    {
      id: "wall-9",
      item: "#9",
      label: "W15",
      type: "wall",
      x: 100.5,
      width: 15,
      height: 40,
      top: 96,
    },
    {
      id: "wall-10",
      item: "#10",
      label: "W17.5",
      type: "wall",
      x: 115.5,
      width: 17.5,
      height: 40,
      top: 96,
    },
  ],
};

export function toNumber(value: number | string | undefined): number {
  if (value === undefined || value === "") {
    return Number.NaN;
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(value);
}

export function roundCoord(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function formatItem(item: string): string {
  const trimmed = item.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function nextX(current: number, suppliedX: number): number {
  return Number.isFinite(suppliedX) ? suppliedX : current;
}

export function buildLayout(form: FormState): LayoutJson {
  const wallWidth = toNumber(form.wall.width);
  const wallHeight = toNumber(form.wall.height);
  let baseCursor = 0;
  let wallCursor = 0;
  const appliances: BaseCabinet[] = [];

  const baseSequence = form.baseRows.map((row) => {
    const width = toNumber(row.width);
    const x = roundCoord(nextX(baseCursor, toNumber(row.x)));
    const cabinet: BaseCabinet = {
      item: formatItem(row.item),
      label: row.label.trim(),
      type: row.type,
      x,
      y: 0,
      width,
      height: toNumber(row.height),
    };

    const depth = toNumber(row.depth);
    if (Number.isFinite(depth)) cabinet.depth = depth;
    if (row.description?.trim()) cabinet.description = row.description.trim();

    baseCursor = roundCoord(x + (Number.isFinite(width) ? width : 0));
    return cabinet;
  });

  const base_cabinets = baseSequence.filter((cabinet) => {
    if (cabinet.type === "appliance") {
      appliances.push(cabinet);
      return false;
    }
    return true;
  });

  const wall_cabinets = form.wallRows.map((row) => {
    const width = toNumber(row.width);
    const x = roundCoord(nextX(wallCursor, toNumber(row.x)));
    const cabinet: WallCabinet = {
      item: formatItem(row.item),
      label: row.label.trim(),
      type: row.type,
      x,
      top: toNumber(row.top),
      width,
      height: toNumber(row.height),
    };

    const depth = toNumber(row.depth);
    if (Number.isFinite(depth)) cabinet.depth = depth;
    if (row.description?.trim()) cabinet.description = row.description.trim();

    wallCursor = roundCoord(x + (Number.isFinite(width) ? width : 0));
    return cabinet;
  });

  return {
    project_name: form.project_name.trim() || "KABI MVP Test",
    unit: "inch",
    wall: {
      width: wallWidth,
      height: wallHeight,
    },
    base_cabinets,
    wall_cabinets,
    appliances,
    notes: [],
  };
}

export function getBaseSequence(layout: LayoutJson): BaseCabinet[] {
  return [...layout.base_cabinets, ...layout.appliances].sort((a, b) => a.x - b.x);
}

export function cloneDefaultForm(): FormState {
  return JSON.parse(JSON.stringify(defaultFormState)) as FormState;
}
