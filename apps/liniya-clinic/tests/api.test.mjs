import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "liniya-api-"));
process.env.SQLITE_PATH = join(directory, "test.sqlite");
process.env.ADMIN_EMAIL = "admin@example.test";
process.env.ADMIN_PASSWORD = "Unique-Admin-Test-2026";
const { default: api } = await import("../server/api.mjs");
const { database, closeDatabase } = await import("../server/db.mjs");
const { dayAfter } = await import("../server/catalog.mjs");
const server = http.createServer(api);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
function client() {
  let cookie = "";
  return {
    async request(path, { method = "GET", body, headers = {} } = {}) {
      const res = await fetch(origin + "/api/" + path, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      for (const item of res.headers.getSetCookie()) {
        if (item.startsWith("clinic_session=")) cookie = item.split(";")[0];
      }
      return {
        status: res.status,
        body: await res.json(),
        headers: res.headers,
      };
    },
    cookie: () => cookie,
  };
}
const alice = client(),
  bob = client(),
  guest = client(),
  admin = client();
let day = dayAfter(1);
for (
  let i = 1;
  i < 8 && new Date(day + "T12:00:00+03:00").getUTCDay() === 0;
  i++
)
  day = dayAfter(i + 1);
let starts = [],
  winner,
  other,
  appointment;
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  await rm(directory, { recursive: true, force: true });
});

test("catalog, persistent storage health and Vercel rewrite route", async () => {
  const c = await guest.request("catalog");
  assert.equal(c.status, 200);
  assert.equal(c.body.doctors.length, 5);
  assert.equal(c.body.services.length, 6);
  assert.equal((await guest.request("health")).body.storage, "sqlite");
  assert.equal((await guest.request("index?route=catalog")).status, 200);
});
test("registration validation, consent, password hashing and private cookies", async () => {
  assert.equal(
    (
      await guest.request("auth/register", {
        method: "POST",
        body: { email: "wrong" },
      })
    ).status,
    400,
  );
  const a = await alice.request("auth/register", {
    method: "POST",
    body: {
      name: "Анна Тестовая",
      email: "anna@example.test",
      phone: "+7 999 123 45 67",
      password: "PatientPassword-2026",
      consent: true,
    },
  });
  assert.equal(a.status, 201);
  assert.equal(a.body.user.email, "anna@example.test");
  assert.equal(a.body.user.password_hash, undefined);
  assert.match(a.headers.get("set-cookie"), /HttpOnly/);
  assert.match(a.headers.get("set-cookie"), /SameSite=Lax/);
  assert.equal(
    (
      await bob.request("auth/register", {
        method: "POST",
        body: {
          name: "Борис Тестовый",
          email: "boris@example.test",
          password: "AnotherPassword-2026",
          consent: true,
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await guest.request("auth/register", {
        method: "POST",
        body: {
          name: "Дубликат",
          email: "anna@example.test",
          password: "AnotherPassword-2026",
          consent: true,
        },
      })
    ).status,
    409,
  );
  const db = await database();
  const [row] = await db.query(
    "SELECT password_hash FROM users WHERE email=$1",
    ["anna@example.test"],
  );
  assert.notEqual(row.password_hash, "PatientPassword-2026");
  assert.match(row.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  const [s] = await db.query(
    "SELECT token_hash FROM sessions WHERE user_id=$1",
    [a.body.user.id],
  );
  assert.notEqual(s.token_hash, alice.cookie().split("=")[1]);
});
test("authentication, wrong password and request origin protection", async () => {
  assert.equal((await guest.request("appointments")).status, 401);
  assert.equal(
    (
      await guest.request("auth/login", {
        method: "POST",
        body: { email: "anna@example.test", password: "wrong-password" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await guest.request("auth/login", {
        method: "POST",
        body: { email: "anna@example.test", password: "PatientPassword-2026" },
        headers: { Origin: "https://another-site.test" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await alice.request("auth/me")).body.user.name,
    "Анна Тестовая",
  );
});
test("availability, wrong doctor/service and dates", async () => {
  const result = await guest.request("slots?doctorId=anna&date=" + day);
  assert.equal(result.status, 200);
  assert(result.body.slots.length > 2);
  starts = result.body.slots.map((x) => x.startsAt);
  assert.equal(
    (await guest.request("slots?doctorId=anna&date=2020-01-01")).body.slots
      .length,
    0,
  );
  assert.equal(
    (
      await alice.request("appointments", {
        method: "POST",
        body: {
          doctorId: "anna",
          serviceId: "cardiology",
          startsAt: starts[0],
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await alice.request("appointments", {
        method: "POST",
        body: {
          doctorId: "anna",
          serviceId: "therapy",
          startsAt: "2020-01-01T10:00:00+03:00",
        },
      })
    ).status,
    400,
  );
});
test("concurrent patients cannot book one doctor at the same time", async () => {
  const payload = {
    doctorId: "anna",
    serviceId: "therapy",
    startsAt: starts[0],
  };
  const [a, b] = await Promise.all([
    alice.request("appointments", { method: "POST", body: payload }),
    bob.request("appointments", { method: "POST", body: payload }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  winner = a.status === 201 ? alice : bob;
  other = winner === alice ? bob : alice;
  appointment = (a.status === 201 ? a : b).body.appointment;
  const availability = await guest.request("slots?doctorId=anna&date=" + day);
  assert.equal(
    availability.body.slots.find((x) => x.startsAt === starts[0]).available,
    false,
  );
  assert.equal(availability.body.slots[0].user_id, undefined);
});
test("appointment ownership, rescheduling and cancellation release the slot", async () => {
  assert.equal(
    (
      await other.request("appointments/" + appointment.id, {
        method: "PATCH",
        body: { action: "cancel" },
      })
    ).status,
    404,
  );
  assert.equal(
    (await other.request("appointments")).body.appointments.length,
    0,
  );
  assert.equal(
    (
      await winner.request("appointments/" + appointment.id, {
        method: "PATCH",
        body: { action: "reschedule", startsAt: starts[1] },
      })
    ).status,
    200,
  );
  const updated = (await winner.request("appointments")).body.appointments[0];
  assert.equal(updated.starts_at, starts[1]);
  assert.equal(
    (
      await winner.request("appointments/" + appointment.id, {
        method: "PATCH",
        body: { action: "cancel" },
      })
    ).status,
    200,
  );
  const released = await other.request("appointments", {
    method: "POST",
    body: { doctorId: "anna", serviceId: "therapy", startsAt: starts[1] },
  });
  assert.equal(released.status, 201);
  assert.equal(
    (await winner.request("appointments")).body.appointments[0].status,
    "cancelled",
  );
  appointment = released.body.appointment;
});
test("profile validation and SQL values remain parameterized", async () => {
  const value = "Ольга'); DROP TABLE users; --";
  const profile = await alice.request("profile", {
    method: "PATCH",
    body: { name: value, phone: "+7 999 000 00 01" },
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.name, value);
  assert.equal(
    (
      await alice.request("profile", {
        method: "PATCH",
        body: { name: "Ольга", phone: "not-a-number" },
      })
    ).status,
    400,
  );
  assert.equal((await bob.request("auth/me")).status, 200);
});
test("admin authorization and saved callback requests", async () => {
  assert.equal((await alice.request("admin/appointments")).status, 403);
  assert.equal(
    (
      await admin.request("auth/login", {
        method: "POST",
        body: {
          email: "admin@example.test",
          password: "Unique-Admin-Test-2026",
        },
      })
    ).body.user.role,
    "admin",
  );
  assert.equal(
    (
      await guest.request("callbacks", {
        method: "POST",
        body: {
          name: "Ирина",
          phone: "+7 999 111 22 33",
          message: "Хочу уточнить подготовку",
          consent: true,
        },
      })
    ).status,
    201,
  );
  const callbacks = await admin.request("admin/callbacks");
  assert.equal(callbacks.body.callbacks.length, 1);
  assert.equal(callbacks.body.callbacks[0].name, "Ирина");
  const list = await admin.request("admin/appointments");
  assert(list.body.appointments.length >= 2);
  assert(list.body.appointments.some((x) => x.patient_email));
  assert.equal(
    (
      await admin.request("admin/appointments/" + appointment.id, {
        method: "PATCH",
        body: { action: "cancel" },
      })
    ).status,
    200,
  );
});
test("logout invalidates server session", async () => {
  assert.equal(
    (await alice.request("auth/logout", { method: "POST", body: {} })).status,
    200,
  );
  assert.equal((await alice.request("auth/me")).body.user, null);
  assert.equal((await alice.request("appointments")).status, 401);
});
test("auth attempts are limited and return retry information", async () => {
  let last;
  for (let i = 0; i < 15; i++)
    last = await guest.request("auth/login", {
      method: "POST",
      body: { email: "none@example.test", password: "not-valid" },
    });
  assert.equal(last.status, 429);
  assert.equal(last.headers.get("retry-after"), "900");
});
