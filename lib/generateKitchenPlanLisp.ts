import { KitchenOpening, KitchenPlan, KitchenPlanItem, WallSide } from "./kitchenTypes";

function n(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${Math.round((value + Number.EPSILON) * 1000) / 1000}`;
}

function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function s(value: string): string {
  return `"${q(value)}"`;
}

function centerOf(item: KitchenPlanItem): { x: number; y: number } {
  return {
    x: item.x + item.rectWidth / 2,
    y: item.y + item.rectDepth / 2,
  };
}

function openingLine(opening: KitchenOpening, roomWidth: number, roomDepth: number): string {
  const start = opening.offset;
  const end = opening.offset + opening.width;

  switch (opening.wall) {
    case "north":
      return `(kabi:draw-opening ${n(start)} ${n(roomDepth)} ${n(end)} ${n(roomDepth)} ${s(opening.label)})`;
    case "south":
      return `(kabi:draw-opening ${n(start)} 0.0 ${n(end)} 0.0 ${s(opening.label)})`;
    case "east":
      return `(kabi:draw-opening ${n(roomWidth)} ${n(start)} ${n(roomWidth)} ${n(end)} ${s(opening.label)})`;
    case "west":
      return `(kabi:draw-opening 0.0 ${n(start)} 0.0 ${n(end)} ${s(opening.label)})`;
  }
}

function itemColor(item: KitchenPlanItem): number {
  switch (item.type) {
    case "base_cabinet":
      return 8;
    case "sink":
      return 5;
    case "range":
      return 1;
    case "refrigerator":
      return 4;
    case "dishwasher":
      return 3;
  }
}

function itemLayer(item: KitchenPlanItem): string {
  return item.type === "base_cabinet" ? "CABINET" : "APPLIANCE";
}

function itemDrawCall(item: KitchenPlanItem): string {
  const center = centerOf(item);
  return [
    `(kabi:make-rect ${n(item.x)} ${n(item.y)} ${n(item.rectWidth)} ${n(item.rectDepth)} ${s(itemLayer(item))} ${itemColor(
      item,
    )})`,
    `(kabi:make-text (kabi:pt ${n(center.x)} ${n(center.y)}) 2.8 ${s(item.label)} "TEXT" 8)`,
    item.type === "sink"
      ? `(kabi:draw-sink-symbol ${n(item.x)} ${n(item.y)} ${n(item.rectWidth)} ${n(item.rectDepth)})`
      : "",
    item.type === "range"
      ? `(kabi:draw-range-symbol ${n(item.x)} ${n(item.y)} ${n(item.rectWidth)} ${n(item.rectDepth)})`
      : "",
  ]
    .filter(Boolean)
    .join("\n  ");
}

function wallDimensionLabel(wall: WallSide): string {
  switch (wall) {
    case "north":
      return "NORTH";
    case "south":
      return "SOUTH";
    case "east":
      return "EAST";
    case "west":
      return "WEST";
  }
}

export function generateKitchenPlanLisp(plan: KitchenPlan): string {
  const openings = plan.openings.map((opening) => openingLine(opening, plan.room.width, plan.room.depth)).join("\n  ");
  const items = plan.items.map(itemDrawCall).join("\n  ");
  const notes = plan.notes
    .map((note, index) => `(kabi:make-text (kabi:pt 0.0 ${n(-34 - index * 5)}) 2.4 ${s(note)} "TEXT" 8)`)
    .join("\n  ");

  return `;;; KABI generated kitchen plan AutoLISP
;;; Project: ${q(plan.projectName)}
;;; Units: inches

(defun kabi:pt (x y)
  (list x y 0.0)
)

(defun kabi:ensure-layer (name color /)
  (if (not (tblsearch "LAYER" name))
    (entmakex
      (list
        '(0 . "LAYER")
        '(100 . "AcDbSymbolTableRecord")
        '(100 . "AcDbLayerTableRecord")
        (cons 2 name)
        '(70 . 0)
        (cons 62 color)
      )
    )
  )
  (command "_.-LAYER" "_Color" color name "")
)

(defun kabi:delete-layer-entities (layer / ss i ent)
  (setq ss (ssget "_X" (list (cons 8 layer))))
  (if ss
    (progn
      (setq i 0)
      (while (< i (sslength ss))
        (setq ent (ssname ss i))
        (entdel ent)
        (setq i (1+ i))
      )
    )
  )
)

(defun kabi:make-line (p1 p2 layer color / data)
  (setq data
    (list
      '(0 . "LINE")
      '(100 . "AcDbEntity")
      (cons 8 layer)
      (cons 10 p1)
      (cons 11 p2)
    )
  )
  (if color (setq data (append data (list (cons 62 color)))))
  (entmakex data)
)

(defun kabi:make-rect (x y w h layer color /)
  (entmakex
    (list
      '(0 . "LWPOLYLINE")
      '(100 . "AcDbEntity")
      (cons 8 layer)
      (cons 62 color)
      '(100 . "AcDbPolyline")
      '(90 . 4)
      '(70 . 1)
      (cons 10 (list x y))
      (cons 10 (list (+ x w) y))
      (cons 10 (list (+ x w) (+ y h)))
      (cons 10 (list x (+ y h)))
    )
  )
)

(defun kabi:make-text (pt height label layer color / data)
  (setq data
    (list
      '(0 . "TEXT")
      '(100 . "AcDbEntity")
      (cons 8 layer)
      '(100 . "AcDbText")
      (cons 10 pt)
      (cons 40 height)
      (cons 1 label)
      '(50 . 0.0)
      '(72 . 1)
      '(73 . 2)
      (cons 11 pt)
    )
  )
  (if color (setq data (append data (list (cons 62 color)))))
  (entmakex data)
)

(defun kabi:draw-dim (x1 y1 x2 y2 label textX textY /)
  (kabi:make-line (kabi:pt x1 y1) (kabi:pt x2 y2) "DIM" nil)
  (kabi:make-text (kabi:pt textX textY) 2.6 label "DIM" nil)
)

(defun kabi:draw-opening (x1 y1 x2 y2 label / midX midY)
  (setq midX (/ (+ x1 x2) 2.0))
  (setq midY (/ (+ y1 y2) 2.0))
  (kabi:make-line (kabi:pt x1 y1) (kabi:pt x2 y2) "OPENING" 2)
  (kabi:make-text (kabi:pt midX midY) 2.6 label "TEXT" 2)
)

(defun kabi:draw-sink-symbol (x y w h / cx cy bowlW bowlH)
  (setq cx (+ x (/ w 2.0)))
  (setq cy (+ y (/ h 2.0)))
  (setq bowlW (min 18.0 (- w 4.0)))
  (setq bowlH (min 12.0 (- h 4.0)))
  (kabi:make-rect (- cx (/ bowlW 2.0)) (- cy (/ bowlH 2.0)) bowlW bowlH "SYMBOL" 5)
  (kabi:make-line (kabi:pt (- cx 4.0) (+ cy 2.0)) (kabi:pt cx (- cy 2.0)) "SYMBOL" 5)
  (kabi:make-line (kabi:pt cx (- cy 2.0)) (kabi:pt (+ cx 4.0) (+ cy 2.0)) "SYMBOL" 5)
)

(defun kabi:draw-range-symbol (x y w h / cx cy r)
  (setq cx (+ x (/ w 2.0)))
  (setq cy (+ y (/ h 2.0)))
  (setq r 3.0)
  (kabi:make-rect (+ x 4.0) (+ y 4.0) (- w 8.0) (- h 8.0) "SYMBOL" 1)
  (kabi:make-text (kabi:pt (- cx 5.0) (+ cy 3.0)) 2.2 "O O" "SYMBOL" 1)
  (kabi:make-text (kabi:pt (- cx 5.0) (- cy 3.0)) 2.2 "O O" "SYMBOL" 1)
)

(defun c:KABI_KITCHEN_PLAN (/ wallWidth roomDepth layerName)
  (setq wallWidth ${n(plan.room.width)})
  (setq roomDepth ${n(plan.room.depth)})

  (foreach layerName '("WALL" "CABINET" "APPLIANCE" "OPENING" "TEXT" "DIM" "SYMBOL")
    (kabi:ensure-layer layerName 7)
  )
  (kabi:ensure-layer "CABINET" 8)
  (kabi:ensure-layer "APPLIANCE" 4)
  (kabi:ensure-layer "OPENING" 2)
  (kabi:ensure-layer "DIM" 3)
  (kabi:ensure-layer "SYMBOL" 5)

  (foreach layerName '("WALL" "CABINET" "APPLIANCE" "OPENING" "TEXT" "DIM" "SYMBOL")
    (kabi:delete-layer-entities layerName)
  )

  (kabi:make-rect 0.0 0.0 wallWidth roomDepth "WALL" 7)
  (kabi:make-text (kabi:pt (/ wallWidth 2.0) (+ roomDepth 20.0)) 4.0 ${s(plan.projectName)} "TEXT" 8)
  (kabi:make-text (kabi:pt (/ wallWidth 2.0) (+ roomDepth 14.0)) 2.6 "KABI KITCHEN PLAN - TOP VIEW" "TEXT" 8)

  ${openings}

  ${items}

  (kabi:draw-dim 0.0 -10.0 wallWidth -10.0 ${s(`${plan.room.width}"`)} (/ wallWidth 2.0) -14.0)
  (kabi:draw-dim -10.0 0.0 -10.0 roomDepth ${s(`${plan.room.depth}"`)} -18.0 (/ roomDepth 2.0))
  (kabi:make-text (kabi:pt 0.0 -25.0) 2.4 ${s(`Walls: ${wallDimensionLabel("north")} top, ${wallDimensionLabel("south")} bottom`)} "TEXT" 8)
  ${notes}

  (command "_.ZOOM" "_EXTENTS")
  (princ "\\nKABI_KITCHEN_PLAN complete. Kitchen plan generated from intake data.")
  (princ)
)

(defun c:KABIKITCHENPLAN ()
  (c:KABI_KITCHEN_PLAN)
)

(princ "\\nLoaded kabi_kitchen_plan.lsp. Run KABI_KITCHEN_PLAN to draw the kitchen plan.")
(princ)
`;
}

export function generateKitchenScript(lispPath: string, dwgPath?: string): string {
  return `${generateKitchenCommand(lispPath, dwgPath)}\n_.QUIT\n`;
}

export function generateKitchenCommand(lispPath: string, dwgPath?: string): string {
  const normalizedPath = lispPath.replace(/\\/g, "/");
  const normalizedDwgPath = dwgPath?.replace(/\\/g, "/");
  const saveCommand = normalizedDwgPath
    ? `(if (= (strcase (strcat (getvar "DWGPREFIX") (getvar "DWGNAME"))) (strcase ${s(normalizedDwgPath)})) (command "_.QSAVE") (if (findfile ${s(normalizedDwgPath)}) (command "_.SAVEAS" "2018" ${s(normalizedDwgPath)} "_Y") (command "_.SAVEAS" "2018" ${s(normalizedDwgPath)})))`
    : "";
  return `(progn (setq kabi:previous-secureload (getvar "SECURELOAD")) (setvar "SECURELOAD" 0) (load ${s(
    normalizedPath,
  )}) (c:KABI_KITCHEN_PLAN) ${saveCommand} (setvar "SECURELOAD" kabi:previous-secureload) (princ))`;
}
