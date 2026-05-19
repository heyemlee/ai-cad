import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { AutoCADLaunchResult } from "./kitchenTypes";

export const AUTOCAD_APP = "/Applications/Autodesk/AutoCAD 2026/AutoCAD 2026.app";
export const ACCORE_CONSOLE =
  "/Applications/Autodesk/AutoCAD 2026/AutoCAD 2026.app/Contents/Helpers/AcCoreConsole.app/Contents/MacOS/AcCoreConsole";
export const AUTOCAD_TEMPLATE =
  "/Users/abcabinet/Library/Application Support/Autodesk/AutoCAD 2026/R25.1/local/@en@/Template/acad.dwt";

function openDwg(dwgPath: string): number | undefined {
  const child = spawn("open", ["-a", AUTOCAD_APP, dwgPath], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}

function runCoreConsole(scriptPath: string, dwgPath: string): Promise<{ ok: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    if (!existsSync(ACCORE_CONSOLE) || !existsSync(AUTOCAD_TEMPLATE)) {
      resolve({
        ok: false,
        output: "",
        error: "AcCoreConsole or the default AutoCAD template was not found.",
      });
      return;
    }

    const child = spawn(ACCORE_CONSOLE, ["-i", AUTOCAD_TEMPLATE, "-s", scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    function finish(result: { ok: boolean; output: string; error?: string }) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    }
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish({
        ok: false,
        output,
        error: "AcCoreConsole timed out before finishing the drawing.",
      });
    }, 60000);

    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      finish({ ok: false, output, error: error.message });
    });
    child.on("close", (code) => {
      finish({
        ok: code === 0 && existsSync(dwgPath),
        output,
        error: code === 0 ? undefined : `AcCoreConsole exited with code ${code}.`,
      });
    });
  });
}

function queueAutoCADGuiCommand(commandText: string): { ok: boolean; pid?: number; error?: string } {
  const script = `
on run argv
  set commandText to item 1 of argv
  delay 5
  tell application id "com.autodesk.AutoCAD2026" to activate
  delay 1
  try
    set oldClipboard to the clipboard
  on error
    set oldClipboard to ""
  end try
  tell application "System Events"
    tell process "AutoCAD"
      repeat 4 times
        try
          if exists button "Cancel" of window 1 then click button "Cancel" of window 1
        end try
        key code 53
        delay 0.25
      end repeat
      set the clipboard to commandText
      keystroke "v" using command down
      key code 36
      delay 0.5
    end tell
  end tell
  try
    set the clipboard to oldClipboard
  end try
end run
`;

  try {
    const child = spawn("osascript", ["-e", script, commandText], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true, pid: child.pid };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function launchAutoCADScript(
  scriptPath: string,
  enabled: boolean,
  commandText?: string,
  dwgPath?: string,
): Promise<AutoCADLaunchResult> {
  if (!enabled) {
    return {
      attempted: false,
      ok: true,
      mode: "skipped",
      message: "AutoCAD launch skipped.",
    };
  }

  if (dwgPath) {
    const core = await runCoreConsole(scriptPath, dwgPath);
    if (core.ok) {
      const pid = openDwg(dwgPath);
      return {
        attempted: true,
        ok: true,
        mode: "core-console",
        message: "AutoCAD Core Console generated the DWG and AutoCAD opened it.",
        pid,
      };
    }
  }

  if (!existsSync(AUTOCAD_APP)) {
    return {
      attempted: true,
      ok: false,
      mode: "not-found",
      message: `AutoCAD was not found at ${AUTOCAD_APP}.`,
    };
  }

  try {
    const opened = dwgPath && existsSync(dwgPath) ? openDwg(dwgPath) : undefined;
    const gui = commandText ? queueAutoCADGuiCommand(commandText) : { ok: true };

    return {
      attempted: true,
      ok: gui.ok,
      mode: gui.ok ? "autocad-gui" : "open-app",
      message: gui.ok
        ? "AutoCAD was opened and the drawing command was queued in the command line."
        : "AutoCAD was opened, but GUI command queueing did not start.",
      pid: gui.pid ?? opened,
      error: gui.error,
    };
  } catch (error) {
    try {
      const fallback = spawn("open", [AUTOCAD_APP], {
        detached: true,
        stdio: "ignore",
      });
      fallback.unref();
      const gui = commandText ? queueAutoCADGuiCommand(commandText) : { ok: false };
      return {
        attempted: true,
        ok: gui.ok,
        mode: gui.ok ? "autocad-gui" : "open-app",
        message: gui.ok
          ? "AutoCAD was opened and the drawing command was queued in the command line."
          : "AutoCAD was opened, but the generated script could not be passed automatically.",
        pid: gui.pid ?? fallback.pid,
        error: gui.error ?? (error instanceof Error ? error.message : String(error)),
      };
    } catch (fallbackError) {
      return {
        attempted: true,
        ok: false,
        mode: "open-app",
        message: "AutoCAD launch failed.",
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      };
    }
  }
}
