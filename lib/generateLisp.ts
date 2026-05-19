import { getBaseSequence, LayoutJson, roundCoord } from "./layout";
import { runRuleCheck } from "./rules";

type RangeSegment = {
  kind: "cabinet" | "gap";
  label: string;
  x: number;
  width: number;
};

function n(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${roundCoord(value)}`;
}

function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function s(value: string): string {
  return `"${q(value)}"`;
}

function widthText(width: number): string {
  return `${roundCoord(width)}"`;
}

function makeCabinetExpr(cabinet: {
  item: string;
  label: string;
  type: string;
  x: number;
  width: number;
  height: number;
  top?: number;
}): string {
  const values = [
    `(cons "item" ${s(cabinet.item)})`,
    `(cons "label" ${s(cabinet.label)})`,
    `(cons "type" ${s(cabinet.type)})`,
    `(cons "x" ${n(cabinet.x)})`,
    `(cons "width" ${n(cabinet.width)})`,
    `(cons "height" ${n(cabinet.height)})`,
  ];
  if (typeof cabinet.top === "number") {
    values.push(`(cons "top" ${n(cabinet.top)})`);
  }
  return `(list ${values.join(" ")})`;
}

function rangeSegments(
  cabinets: Array<{ item: string; label: string; x: number; width: number }>,
  wallWidth: number,
): RangeSegment[] {
  const segments: RangeSegment[] = [];
  let cursor = 0;
  [...cabinets]
    .sort((a, b) => a.x - b.x)
    .forEach((cabinet) => {
      if (cabinet.x > cursor) {
        const gap = roundCoord(cabinet.x - cursor);
        segments.push({
          kind: "gap",
          label: `GAP ${widthText(gap)}`,
          x: cursor,
          width: gap,
        });
      }
      segments.push({
        kind: "cabinet",
        label: widthText(cabinet.width),
        x: cabinet.x,
        width: cabinet.width,
      });
      cursor = roundCoord(cabinet.x + cabinet.width);
    });

  if (cursor < wallWidth) {
    const gap = roundCoord(wallWidth - cursor);
    segments.push({
      kind: "gap",
      label: `GAP ${widthText(gap)}`,
      x: cursor,
      width: gap,
    });
  }

  return segments;
}

function segmentExpr(segment: RangeSegment): string {
  return `(list (cons "kind" ${s(segment.kind)}) (cons "label" ${s(segment.label)}) (cons "x" ${n(
    segment.x,
  )}) (cons "width" ${n(segment.width)}))`;
}

export function generateLisp(layout: LayoutJson): string {
  const ruleResult = runRuleCheck(layout);
  if (!ruleResult.ok) {
    throw new Error(`Rule check failed:\n${ruleResult.errors.join("\n")}`);
  }

  const baseSequence = getBaseSequence(layout);
  const baseCabinets = baseSequence.map(makeCabinetExpr).join("\n    ");
  const wallCabinets = layout.wall_cabinets.map(makeCabinetExpr).join("\n    ");
  const baseSegments = rangeSegments(baseSequence, layout.wall.width).map(segmentExpr).join("\n    ");
  const wallSegments = rangeSegments(layout.wall_cabinets, layout.wall.width).map(segmentExpr).join("\n    ");

  return `;;; KABI MVP generated AutoLISP
;;; Project: ${q(layout.project_name)}
;;; Units: inches
;;; Generated from layout JSON. All geometry uses exact numeric JSON coordinates.

(defun kabi:assoc (key data / hit)
  (setq hit (assoc key data))
  (if hit (cdr hit) nil)
)

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
  name
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

(defun kabi:draw-dim (x1 x2 y label textY / mid tick)
  (setq mid (/ (+ x1 x2) 2.0))
  (setq tick 1.5)
  (kabi:make-line (kabi:pt x1 y) (kabi:pt x2 y) "DIM" nil)
  (kabi:make-line (kabi:pt x1 (- y tick)) (kabi:pt x1 (+ y tick)) "DIM" nil)
  (kabi:make-line (kabi:pt x2 (- y tick)) (kabi:pt x2 (+ y tick)) "DIM" nil)
  (kabi:make-text (kabi:pt mid textY) 2.4 label "DIM" nil)
)

(defun kabi:draw-vdim (x y1 y2 label / mid tick)
  (setq mid (/ (+ y1 y2) 2.0))
  (setq tick 1.5)
  (kabi:make-line (kabi:pt x y1) (kabi:pt x y2) "DIM" nil)
  (kabi:make-line (kabi:pt (- x tick) y1) (kabi:pt (+ x tick) y1) "DIM" nil)
  (kabi:make-line (kabi:pt (- x tick) y2) (kabi:pt (+ x tick) y2) "DIM" nil)
  (kabi:make-text (kabi:pt (- x 4.5) mid) 2.4 label "DIM" nil)
)

(defun kabi:draw-sink (cx cy w / half bowlW bowlH)
  (setq bowlW (min 18.0 (- w 4.0)))
  (setq bowlH 10.0)
  (setq half (/ bowlW 2.0))
  (kabi:make-rect (- cx half) (- cy (/ bowlH 2.0)) bowlW bowlH "SYMBOL" 5)
  (kabi:make-line (kabi:pt (- cx 4.0) (+ cy 1.5)) (kabi:pt cx (- cy 2.0)) "SYMBOL" 5)
  (kabi:make-line (kabi:pt cx (- cy 2.0)) (kabi:pt (+ cx 4.0) (+ cy 1.5)) "SYMBOL" 5)
)

(defun kabi:draw-base-cabinet (cab / x w h cx cy item label type)
  (setq x (kabi:assoc "x" cab))
  (setq w (kabi:assoc "width" cab))
  (setq h (kabi:assoc "height" cab))
  (setq item (kabi:assoc "item" cab))
  (setq label (kabi:assoc "label" cab))
  (setq type (kabi:assoc "type" cab))
  (setq cx (+ x (/ w 2.0)))
  (setq cy (/ h 2.0))
  (kabi:make-rect x 0.0 w h "CABINET" 8)
  (kabi:make-text (kabi:pt cx (+ h 4.0)) 3.0 item "TEXT" 1)
  (kabi:make-text (kabi:pt cx cy) 2.4 label "TEXT" 8)
  (if (= type "sink_base")
    (kabi:draw-sink cx (+ cy 3.0) w)
  )
)

(defun kabi:draw-wall-cabinet (cab / x w h top y cx item label)
  (setq x (kabi:assoc "x" cab))
  (setq w (kabi:assoc "width" cab))
  (setq h (kabi:assoc "height" cab))
  (setq top (kabi:assoc "top" cab))
  (setq item (kabi:assoc "item" cab))
  (setq label (kabi:assoc "label" cab))
  (setq y (- top h))
  (setq cx (+ x (/ w 2.0)))
  (kabi:make-rect x y w h "CABINET" 8)
  (kabi:make-text (kabi:pt cx (- y 3.0)) 3.0 item "TEXT" 1)
  (kabi:make-text (kabi:pt cx (+ y (/ h 2.0))) 2.4 label "TEXT" 8)
)

(defun kabi:draw-dim-segment (seg y textY / x w label)
  (setq x (kabi:assoc "x" seg))
  (setq w (kabi:assoc "width" seg))
  (setq label (kabi:assoc "label" seg))
  (kabi:draw-dim x (+ x w) y label textY)
)

(defun c:KABI_MVP_LAYOUT (/ wallWidth wallHeight baseCabinets wallCabinets baseDims wallDims c)
  (setq wallWidth ${n(layout.wall.width)})
  (setq wallHeight ${n(layout.wall.height)})
  (setq baseCabinets
    (list
    ${baseCabinets}
    )
  )
  (setq wallCabinets
    (list
    ${wallCabinets}
    )
  )
  (setq baseDims
    (list
    ${baseSegments}
    )
  )
  (setq wallDims
    (list
    ${wallSegments}
    )
  )

  (kabi:ensure-layer "WALL" 7)
  (kabi:ensure-layer "CABINET" 8)
  (kabi:ensure-layer "TEXT" 8)
  (kabi:ensure-layer "DIM" 3)
  (kabi:ensure-layer "SYMBOL" 5)

  (foreach c '("WALL" "CABINET" "TEXT" "DIM" "SYMBOL")
    (kabi:delete-layer-entities c)
  )

  (kabi:make-rect 0.0 0.0 wallWidth wallHeight "WALL" 7)
  (kabi:make-text (kabi:pt (/ wallWidth 2.0) (+ wallHeight 20.0)) 4.0 "KABI MVP CABINET LAYOUT" "TEXT" 8)
  (kabi:make-text (kabi:pt (/ wallWidth 2.0) (+ wallHeight 15.0)) 2.5 ${s(
    layout.project_name,
  )} "TEXT" 8)

  (foreach c baseCabinets
    (kabi:draw-base-cabinet c)
  )
  (foreach c wallCabinets
    (kabi:draw-wall-cabinet c)
  )

  (foreach c baseDims
    (kabi:draw-dim-segment c -8.0 -11.5)
  )
  (kabi:draw-dim 0.0 wallWidth -18.0 ${s(widthText(layout.wall.width))} -21.5)

  (foreach c wallDims
    (kabi:draw-dim-segment c (+ wallHeight 8.0) (+ wallHeight 11.5))
  )

  (kabi:draw-vdim -8.0 0.0 34.5 ${s('34.5"')})
  (kabi:draw-vdim -16.0 0.0 wallHeight ${s(widthText(layout.wall.height))})

  (command "_.ZOOM" "_EXTENTS")
  (princ "\\nKABI_MVP_LAYOUT complete. Geometry and dimensions were generated from JSON.")
  (princ)
)

(defun c:KABIMVPLAYOUT ()
  (c:KABI_MVP_LAYOUT)
)

(princ "\\nLoaded kabi_mvp_layout.lsp. Run KABI_MVP_LAYOUT to draw the cabinet elevation.")
(princ)
`;
}
