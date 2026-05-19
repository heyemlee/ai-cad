import { NextResponse } from "next/server";
import { createKitchenDrawing, readDrawingIntake } from "../../../../../lib/drawingService";
import { applyKitchenModifyRequest } from "../../../../../lib/kitchenModify";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const currentIntake = body.currentIntake ?? (await readDrawingIntake(id));
    const modifyResult = applyKitchenModifyRequest(currentIntake, String(body.request ?? ""));
    const job = await createKitchenDrawing(modifyResult.intake, {
      id: `${id}-rev-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      launchAutoCAD: true,
    });
    const status = job.status === "drawn" ? 200 : 422;

    return NextResponse.json(
      {
        ...job,
        modify: {
          request: body.request ?? "",
          applied: modifyResult.applied,
          warnings: modifyResult.warnings,
        },
      },
      { status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
