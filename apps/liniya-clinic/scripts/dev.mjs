import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["server/start.mjs"], { stdio: "inherit" }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
    { stdio: "inherit" },
  ),
];
const stop = () => {
  for (const child of children) child.kill();
};
process.on("SIGINT", () => {
  stop();
  process.exit();
});
process.on("SIGTERM", () => {
  stop();
  process.exit();
});
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exit(code || 0);
  });
