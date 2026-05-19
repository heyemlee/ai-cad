"use client";

import { useMemo, useState } from "react";
import { defaultKitchenIntake } from "../lib/kitchenPlan";
import { DrawingJob, KitchenIntakeState, WallSide } from "../lib/kitchenTypes";

type UiStatus = "idle" | "generating" | "launching_autocad" | "drawn" | "needs_revision" | "needs_autocad_action";

type DrawingResponse = DrawingJob & {
  error?: string;
  modify?: {
    request: string;
    applied: string[];
    warnings: string[];
  };
};

const wallOptions: Array<{ value: WallSide; label: string }> = [
  { value: "north", label: "North / back wall" },
  { value: "south", label: "South / front wall" },
  { value: "east", label: "East / right wall" },
  { value: "west", label: "West / left wall" },
];

const steps = ["Room", "Openings", "Needs", "Confirm"];

function updateNumber(value: string): number {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function postJson(url: string, body: unknown): Promise<DrawingResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as DrawingResponse;
  if (!response.ok && !json.ruleResult) {
    throw new Error(json.error || "Drawing request needs attention.");
  }
  return json;
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<KitchenIntakeState>(() => defaultKitchenIntake());
  const [status, setStatus] = useState<UiStatus>("idle");
  const [job, setJob] = useState<DrawingResponse | null>(null);
  const [modifyRequest, setModifyRequest] = useState("");
  const [error, setError] = useState("");
  const [questionOpen, setQuestionOpen] = useState(false);

  const canGoNext = useMemo(() => {
    if (step === 0) return form.roomWidth > 0 && form.roomDepth > 0 && form.ceilingHeight > 0;
    if (step === 1) return form.doorWidth > 0 && (!form.hasWindow || form.windowWidth > 0);
    return true;
  }, [form, step]);

  function setField<K extends keyof KitchenIntakeState>(key: K, value: KitchenIntakeState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function generateDrawing() {
    setError("");
    setStatus("generating");
    setJob(null);

    try {
      setStatus("launching_autocad");
      const nextJob = await postJson("/api/drawings", form);
      setJob(nextJob);
      setForm(nextJob.intake);
      setStatus(statusFromJob(nextJob));
      setQuestionOpen(!nextJob.ruleResult.ok || !nextJob.autocad.ok);
    } catch (requestError) {
      setStatus("needs_revision");
      setError(requestError instanceof Error ? requestError.message : String(requestError));
      setQuestionOpen(true);
    }
  }

  async function modifyDrawing() {
    if (!job || !modifyRequest.trim()) return;
    setError("");
    setStatus("generating");

    try {
      setStatus("launching_autocad");
      const nextJob = await postJson(`/api/drawings/${job.id}/modify`, {
        request: modifyRequest,
        currentIntake: form,
      });
      setJob(nextJob);
      setForm(nextJob.intake);
      setModifyRequest("");
      setStatus(statusFromJob(nextJob));
      setQuestionOpen(!nextJob.ruleResult.ok || !nextJob.autocad.ok || Boolean(nextJob.modify?.warnings.length));
    } catch (requestError) {
      setStatus("needs_revision");
      setError(requestError instanceof Error ? requestError.message : String(requestError));
      setQuestionOpen(true);
    }
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>KABI Kitchen Plan CAD MVP</h1>
          <p>Sales-style intake, generated AutoLISP, and automatic AutoCAD drawing launch.</p>
        </div>
        <div className={`status ${statusClass(status)}`}>
          {statusLabel(status)}
        </div>
      </header>

      <section className="wizardShell">
        <nav className="stepRail" aria-label="Kitchen intake steps">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              className={index === step ? "step active" : index < step ? "step done" : "step"}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="wizardPanel">
          {step === 0 && (
            <section>
              <div className="sectionHeader">
                <div>
                  <h2>Start with the room</h2>
                  <p>Only the dimensions needed for a first-pass kitchen plan.</p>
                </div>
              </div>
              <div className="grid compact">
                <label>
                  Project name
                  <input value={form.projectName} onChange={(event) => setField("projectName", event.target.value)} />
                </label>
                <label>
                  Room width
                  <input
                    type="number"
                    min="1"
                    value={form.roomWidth}
                    onChange={(event) => setField("roomWidth", updateNumber(event.target.value))}
                  />
                </label>
                <label>
                  Room depth
                  <input
                    type="number"
                    min="1"
                    value={form.roomDepth}
                    onChange={(event) => setField("roomDepth", updateNumber(event.target.value))}
                  />
                </label>
                <label>
                  Ceiling height
                  <input
                    type="number"
                    min="1"
                    value={form.ceilingHeight}
                    onChange={(event) => setField("ceilingHeight", updateNumber(event.target.value))}
                  />
                </label>
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <div className="sectionHeader">
                <div>
                  <h2>Mark fixed conditions</h2>
                  <p>Door, window, and water rough-in guide the first layout.</p>
                </div>
              </div>
              <div className="fieldGroup">
                <h3>Door</h3>
                <div className="grid three">
                  <WallSelect label="Door wall" value={form.doorWall} onChange={(value) => setField("doorWall", value)} />
                  <NumberField label="Door offset" value={form.doorOffset} onChange={(value) => setField("doorOffset", value)} />
                  <NumberField label="Door width" value={form.doorWidth} onChange={(value) => setField("doorWidth", value)} />
                </div>
              </div>

              <div className="fieldGroup">
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={form.hasWindow}
                    onChange={(event) => setField("hasWindow", event.target.checked)}
                  />
                  Window on the plan
                </label>
                {form.hasWindow && (
                  <div className="grid three">
                    <WallSelect
                      label="Window wall"
                      value={form.windowWall}
                      onChange={(value) => setField("windowWall", value)}
                    />
                    <NumberField
                      label="Window offset"
                      value={form.windowOffset}
                      onChange={(value) => setField("windowOffset", value)}
                    />
                    <NumberField
                      label="Window width"
                      value={form.windowWidth}
                      onChange={(value) => setField("windowWidth", value)}
                    />
                  </div>
                )}
              </div>

              <div className="fieldGroup">
                <h3>Water rough-in</h3>
                <div className="grid two">
                  <WallSelect label="Water wall" value={form.waterWall} onChange={(value) => setField("waterWall", value)} />
                  <NumberField
                    label="Water offset"
                    value={form.waterOffset}
                    onChange={(value) => setField("waterOffset", value)}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="sectionHeader">
                <div>
                  <h2>Choose the required pieces</h2>
                  <p>Enough detail to draw a usable first kitchen plan.</p>
                </div>
              </div>
              <div className="checkGrid">
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={form.includeFridge}
                    onChange={(event) => setField("includeFridge", event.target.checked)}
                  />
                  Refrigerator
                </label>
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={form.includeRange}
                    onChange={(event) => setField("includeRange", event.target.checked)}
                  />
                  Range / cooktop
                </label>
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={form.includeDishwasher}
                    onChange={(event) => setField("includeDishwasher", event.target.checked)}
                  />
                  Dishwasher
                </label>
              </div>

              <div className="grid two">
                <WallSelect label="Fridge wall" value={form.fridgeWall} onChange={(value) => setField("fridgeWall", value)} />
                <NumberField
                  label="Fridge offset"
                  value={form.fridgeOffset}
                  onChange={(value) => setField("fridgeOffset", value)}
                />
                <WallSelect label="Range wall" value={form.rangeWall} onChange={(value) => setField("rangeWall", value)} />
                <NumberField
                  label="Range offset"
                  value={form.rangeOffset}
                  onChange={(value) => setField("rangeOffset", value)}
                />
                <label>
                  Storage preference
                  <select
                    value={form.storagePriority}
                    onChange={(event) => setField("storagePriority", event.target.value as KitchenIntakeState["storagePriority"])}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="more_drawers">More drawers</option>
                    <option value="more_pantry">More pantry storage</option>
                  </select>
                </label>
                <label>
                  Customer notes
                  <input value={form.notes} onChange={(event) => setField("notes", event.target.value)} />
                </label>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="sectionHeader">
                <div>
                  <h2>Confirm and draw</h2>
                  <p>Generate files, then start AutoCAD 2026 with the drawing script.</p>
                </div>
                <button type="button" className="primary" disabled={isBusy(status)} onClick={generateDrawing}>
                  Generate & Draw in AutoCAD
                </button>
              </div>
              <Summary form={form} />
            </section>
          )}

          <div className="wizardActions">
            <button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              disabled={!canGoNext || step === steps.length - 1}
              onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {(job || error) && (
        <section className="band resultBand">
          <div className="sectionHeader">
            <div>
              <h2>{job?.ruleResult.ok === false || error ? "Needs customer input" : "Drawing result"}</h2>
              <p>{job ? `Drawing id: ${job.id}` : "The drawing request did not complete."}</p>
            </div>
          </div>

          {error && <p className="errorBox">{error}</p>}

          {job && (
            <>
              <div className={job.ruleResult.ok && job.autocad.ok ? "resultGrid" : "resultGrid needsInput"}>
                <ResultItem label="Status" value={resultStatusLabel(job)} />
                <ResultItem label="AutoCAD" value={job.autocad.message} />
                <ResultItem label="JSON" value={job.files.jsonPath} />
                <ResultItem label="LISP" value={job.files.lispPath} />
                <ResultItem label="Script" value={job.files.scriptPath} />
                <ResultItem label="DWG target" value={job.files.dwgPath} />
              </div>

              {!job.ruleResult.ok && (
                <ul className="questions">
                  {guidanceForJob(job).map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              )}

              {job.ruleResult.warnings.length > 0 && (
                <ul className="warnings">
                  {job.ruleResult.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              {job.modify && (
                <div className="modifyFeedback">
                  {job.modify.applied.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  {job.modify.warnings.map((item) => (
                    <p key={item} className="warningText">
                      {item}
                    </p>
                  ))}
                </div>
              )}

              <div className="modifyBox">
                <label>
                  Modify request
                  <textarea
                    value={modifyRequest}
                    onChange={(event) => setModifyRequest(event.target.value)}
                    placeholder="Example: move sink right 6 inches, put fridge on left wall, 把水槽放到窗户下面"
                  />
                </label>
                <button type="button" className="primary" disabled={!modifyRequest.trim() || isBusy(status)} onClick={modifyDrawing}>
                  Apply Modify & Redraw
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {questionOpen && (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="question-title">
          <div className="questionModal">
            <div className="sectionHeader">
              <div>
                <h2 id="question-title">Need one quick adjustment</h2>
                <p>The layout engine tried to make the most reasonable kitchen plan. These details need confirmation.</p>
              </div>
              <button type="button" onClick={() => setQuestionOpen(false)}>
                Close
              </button>
            </div>

            {job ? (
              <ul className="questions">
                {guidanceForJob(job).map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            ) : (
              <p className="errorBox">{error || "Please adjust the intake and try again."}</p>
            )}

            <div className="modifyBox modalModify">
              <label>
                Customer answer or modify request
                <textarea
                  value={modifyRequest}
                  onChange={(event) => setModifyRequest(event.target.value)}
                  placeholder="Example: move sink to north wall 48 inches from left, remove dishwasher, 把冰箱放左墙"
                />
              </label>
              <button type="button" className="primary" disabled={!job || !modifyRequest.trim() || isBusy(status)} onClick={modifyDrawing}>
                Apply & Redraw
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function isBusy(status: UiStatus): boolean {
  return status === "generating" || status === "launching_autocad";
}

function statusFromJob(job: DrawingResponse): UiStatus {
  if (!job.ruleResult.ok) return "needs_revision";
  if (!job.autocad.ok) return "needs_autocad_action";
  return "drawn";
}

function statusLabel(status: UiStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "generating":
      return "Generating";
    case "launching_autocad":
      return "Launching AutoCAD";
    case "drawn":
      return "Drawn";
    case "needs_revision":
      return "Needs input";
    case "needs_autocad_action":
      return "AutoCAD needs action";
  }
}

function statusClass(status: UiStatus): string {
  if (status === "drawn") return "ok";
  if (status === "needs_revision" || status === "needs_autocad_action") return "needs";
  return "";
}

function resultStatusLabel(job: DrawingResponse): string {
  if (!job.ruleResult.ok) return "Needs one customer answer before drawing";
  if (!job.autocad.ok) return "Files are ready; AutoCAD needs local attention";
  return "AutoCAD drawing launched";
}

function guidanceForJob(job: DrawingResponse): string[] {
  const guidance: string[] = [];

  job.ruleResult.errors.forEach((ruleError) => {
    if (ruleError.includes("overlaps")) {
      guidance.push(`${ruleError} Try moving one of them to another wall or by 12 inches.`);
    } else if (ruleError.includes("DOOR")) {
      guidance.push(`${ruleError} Please move the door opening or move the cabinet/appliance away from the door swing area.`);
    } else if (ruleError.includes("Room")) {
      guidance.push(`${ruleError} Please confirm the room dimensions.`);
    } else {
      guidance.push(`${ruleError} Please adjust this detail and redraw.`);
    }
  });

  if (!job.autocad.ok && job.ruleResult.ok) {
    guidance.push(`${job.autocad.message} If AutoCAD asks for permissions or trusted paths, allow the generated script folder.`);
  }

  if (job.modify?.warnings.length) {
    guidance.push(...job.modify.warnings);
  }

  return guidance.length > 0 ? guidance : ["The layout is ready. Review AutoCAD and request any changes here."];
}

function WallSelect({ label, value, onChange }: { label: string; value: WallSide; onChange: (value: WallSide) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as WallSide)}>
        {wallOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      {label}
      <input type="number" value={value} onChange={(event) => onChange(updateNumber(event.target.value))} />
    </label>
  );
}

function Summary({ form }: { form: KitchenIntakeState }) {
  return (
    <div className="summaryGrid">
      <ResultItem label="Room" value={`${form.roomWidth}" W x ${form.roomDepth}" D x ${form.ceilingHeight}" H`} />
      <ResultItem label="Door" value={`${form.doorWall}, ${form.doorOffset}" offset, ${form.doorWidth}" wide`} />
      <ResultItem
        label="Window"
        value={form.hasWindow ? `${form.windowWall}, ${form.windowOffset}" offset, ${form.windowWidth}" wide` : "No window"}
      />
      <ResultItem label="Sink" value={`${form.waterWall}, ${form.waterOffset}" offset`} />
      <ResultItem label="Range" value={form.includeRange ? `${form.rangeWall}, ${form.rangeOffset}" offset` : "Not included"} />
      <ResultItem
        label="Fridge"
        value={form.includeFridge ? `${form.fridgeWall}, ${form.fridgeOffset}" offset` : "Not included"}
      />
      <ResultItem label="Dishwasher" value={form.includeDishwasher ? "Included next to sink" : "Not included"} />
      <ResultItem label="Storage" value={form.storagePriority.replace("_", " ")} />
    </div>
  );
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="resultItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
