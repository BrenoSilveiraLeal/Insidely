import { execFile, spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = process.argv[2] ?? "3110";
const nextBin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "--port", port], {
  cwd: process.cwd(),
  env: { ...process.env, E2E_SERVER: "true" },
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  if (process.platform === "win32" && child.pid) {
    execFile("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
  } else {
    child.kill("SIGTERM");
  }
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
