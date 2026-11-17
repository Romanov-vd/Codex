import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("Vercel refuses ephemeral SQLite and reports unavailable booking honestly", async () => {
  const folder = await mkdtemp(join(tmpdir(), "liniya-production-"));
  const file = join(folder, "must-not-exist.sqlite");
  const script = `import http from 'node:http';import api from './server/api.mjs';const server=http.createServer(api);server.listen(0,'127.0.0.1',()=>console.log(server.address().port));`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, VERCEL: "1", DATABASE_URL: "", SQLITE_PATH: file },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(Error("Server startup timeout")),
        5000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/\b(\d{4,5})\b/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Server exited early"));
      });
    });
    const root = "http://127.0.0.1:" + port + "/api/";
    assert.equal((await fetch(root + "catalog")).status, 200);
    const response = await fetch(root + "auth/me");
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "DATABASE_NOT_CONFIGURED");
    assert(!body.error.includes("DATABASE_URL"));
    await assert.rejects(access(file));
  } finally {
    child.kill();
    await new Promise((resolve) =>
      child.exitCode !== null ? resolve() : child.once("exit", resolve),
    );
    await rm(folder, { recursive: true, force: true });
  }
});
