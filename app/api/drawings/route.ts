import { NextResponse } from "next/server";
import { createKitchenDrawing } from "../../../lib/drawingService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const job = await createKitchenDrawing(body, { launchAutoCAD: true });
    const status = job.status === "drawn" ? 200 : 422;
    return NextResponse.json(job, { status });
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
