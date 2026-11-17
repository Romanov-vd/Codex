import { randomUUID } from "node:crypto";
import { database } from "./db.mjs";
import { services, doctors, slotsFor } from "./catalog.mjs";
import {
  hash,
  passwordHash,
  passwordMatches,
  publicUser,
  fail,
  string,
  email,
  phone,
  issueSession,
  currentUser,
  rateLimit,
} from "./security.mjs";
let bootstrapped = false;
async function setupAdmin(db) {
  if (bootstrapped) return;
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 12)
      throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
    const address = email(process.env.ADMIN_EMAIL);
    await db.query(
      `INSERT INTO users(id,email,name,phone,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5,'admin',$6) ON CONFLICT(email) DO NOTHING`,
      [
        randomUUID(),
        address,
        "Администратор",
        "",
        await passwordHash(process.env.ADMIN_PASSWORD),
        new Date().toISOString(),
      ],
    );
  }
  bootstrapped = true;
}
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}
function bodyObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "Ожидается объект с данными.");
  return value;
}
async function readBody(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    fail(415, "Ожидается JSON.");
  if (req.body && typeof req.body === "object") return bodyObject(req.body);
  if (typeof req.body === "string") {
    try {
      return bodyObject(JSON.parse(req.body));
    } catch {
      fail(400, "Некорректные данные.");
    }
  }
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > 16384) fail(413, "Слишком большой запрос.");
  }
  try {
    return bodyObject(value ? JSON.parse(value) : {});
  } catch {
    fail(400, "Некорректные данные.");
  }
}
const uniqueError = (e) =>
  e.code === "23505" || String(e.message).includes("UNIQUE constraint");
function decorate(a) {
  return {
    ...a,
    doctor: doctors.find((d) => d.id === a.doctor_id),
    service: services.find((s) => s.id === a.service_id),
  };
}
function bookingDetails(body) {
  const doctor = doctors.find((d) => d.id === body.doctorId),
    service = services.find((s) => s.id === body.serviceId);
  if (!doctor || !service || !doctor.serviceIds.includes(service.id))
    fail(400, "Выбранный врач не оказывает эту услугу.");
  const startsAt = string(body.startsAt, { min: 25, max: 25 });
  if (!slotsFor(doctor.id, startsAt.slice(0, 10)).includes(startsAt))
    fail(400, "Это время недоступно. Выберите другой слот.");
  return { doctor, service, startsAt };
}
export default async function api(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const url = new URL(req.url, "http://localhost");
    const route =
      url.searchParams.get("route") ||
      url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
    const method = req.method || "GET";
    if (!["GET", "HEAD"].includes(method)) {
      const origin = req.headers.origin;
      const hosts = new Set(
        [
          `https://${req.headers.host}`,
          `http://${req.headers.host}`,
          process.env.APP_ORIGIN,
          ...(process.env.NODE_ENV === "production"
            ? []
            : ["http://localhost:5173", "http://127.0.0.1:5173"]),
        ].filter(Boolean),
      );
      if (origin && !hosts.has(origin))
        fail(403, "Запрос с другого сайта запрещён.");
    }
    if (route === "catalog" && method === "GET")
      return json(res, 200, { services, doctors });
    const db = await database();
    await setupAdmin(db);
    if (route === "health" && method === "GET") {
      await db.query("SELECT 1");
      return json(res, 200, { ok: true, storage: db.kind });
    }
    if (route === "auth/register" && method === "POST") {
      await rateLimit(db, req);
      const body = await readBody(req);
      const address = email(body.email),
        name = string(body.name, { min: 2, max: 100 }),
        mobile = phone(body.phone || "");
      if (
        typeof body.password !== "string" ||
        body.password.length < 10 ||
        body.password.length > 256
      )
        fail(400, "Пароль должен содержать от 10 до 256 символов.");
      if (body.consent !== true)
        fail(400, "Нужно согласие на обработку данных.");
      const user = {
        id: randomUUID(),
        email: address,
        name,
        phone: mobile,
        role: "patient",
      };
      try {
        await db.query(
          "INSERT INTO users(id,email,name,phone,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            user.id,
            address,
            name,
            mobile,
            await passwordHash(body.password),
            user.role,
            new Date().toISOString(),
          ],
        );
      } catch (e) {
        if (uniqueError(e))
          fail(409, "Этот email уже зарегистрирован. Войдите в кабинет.");
        throw e;
      }
      await issueSession(db, user, res);
      return json(res, 201, { user: publicUser(user) });
    }
    if (route === "auth/login" && method === "POST") {
      await rateLimit(db, req);
      const body = await readBody(req);
      const address = email(body.email);
      if (typeof body.password !== "string" || body.password.length > 256)
        fail(400, "Введите пароль.");
      const user = (
        await db.query("SELECT * FROM users WHERE email=$1", [address])
      )[0];
      // Always run scrypt, including for unknown accounts.
      const encoded =
        user?.password_hash ||
        "00000000000000000000000000000000:" + "00".repeat(64);
      const matches = await passwordMatches(body.password, encoded);
      if (!user || !matches) fail(401, "Неверный email или пароль.");
      await issueSession(db, user, res);
      return json(res, 200, { user: publicUser(user) });
    }
    if (route === "auth/logout" && method === "POST") {
      const token = String(req.headers.cookie || "").match(
        /(?:^|;\s*)clinic_session=([a-f0-9]{64})/,
      )?.[1];
      if (token)
        await db.query("DELETE FROM sessions WHERE token_hash=$1", [
          hash(token),
        ]);
      res.setHeader(
        "Set-Cookie",
        `clinic_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.VERCEL || process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`,
      );
      return json(res, 200, { ok: true });
    }
    const user = await currentUser(db, req);
    if (route === "auth/me" && method === "GET")
      return json(res, 200, { user: user ? publicUser(user) : null });
    if (route === "slots" && method === "GET") {
      const doctorId = url.searchParams.get("doctorId"),
        date = url.searchParams.get("date");
      const busy = await db.query(
        "SELECT starts_at FROM appointments WHERE doctor_id=$1 AND status='confirmed' AND starts_at LIKE $2",
        [doctorId, `${date}%`],
      );
      return json(res, 200, {
        slots: slotsFor(doctorId, date).map((startsAt) => ({
          startsAt,
          available: !busy.some((x) => x.starts_at === startsAt),
        })),
      });
    }
    if (route === "callbacks" && method === "POST") {
      await rateLimit(db, req);
      const body = await readBody(req);
      const name = string(body.name, { min: 2, max: 100 }),
        mobile = phone(body.phone);
      if (!mobile || body.consent !== true)
        fail(400, "Укажите телефон и согласие на обработку данных.");
      await db.query(
        "INSERT INTO callbacks(id,name,phone,message,created_at) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          name,
          mobile,
          string(body.message || "", { max: 1000 }),
          new Date().toISOString(),
        ],
      );
      return json(res, 201, { ok: true });
    }
    if (!user) fail(401, "Войдите в личный кабинет.", "AUTH_REQUIRED");
    if (route === "profile" && method === "PATCH") {
      const body = await readBody(req);
      const name = string(body.name, { min: 2, max: 100 }),
        mobile = phone(body.phone || "");
      await db.query("UPDATE users SET name=$1,phone=$2 WHERE id=$3", [
        name,
        mobile,
        user.id,
      ]);
      return json(res, 200, {
        user: { ...publicUser(user), name, phone: mobile },
      });
    }
    if (route === "appointments" && method === "GET") {
      const rows = await db.query(
        "SELECT * FROM appointments WHERE user_id=$1 ORDER BY starts_at DESC",
        [user.id],
      );
      return json(res, 200, { appointments: rows.map(decorate) });
    }
    if (route === "appointments" && method === "POST") {
      const { doctor, service, startsAt } = bookingDetails(await readBody(req));
      const id = randomUUID();
      try {
        await db.query(
          "INSERT INTO appointments(id,user_id,doctor_id,service_id,starts_at,status,created_at) VALUES($1,$2,$3,$4,$5,'confirmed',$6)",
          [
            id,
            user.id,
            doctor.id,
            service.id,
            startsAt,
            new Date().toISOString(),
          ],
        );
      } catch (e) {
        if (uniqueError(e))
          fail(
            409,
            "Это время уже заняли. Выберите другой слот.",
            "SLOT_TAKEN",
          );
        throw e;
      }
      return json(res, 201, {
        appointment: decorate(
          (await db.query("SELECT * FROM appointments WHERE id=$1", [id]))[0],
        ),
      });
    }
    const appointmentMatch = route.match(/^appointments\/([a-f0-9-]{36})$/);
    if (appointmentMatch && method === "PATCH") {
      const appointment = (
        await db.query(
          "SELECT * FROM appointments WHERE id=$1 AND user_id=$2",
          [appointmentMatch[1], user.id],
        )
      )[0];
      if (!appointment) fail(404, "Запись не найдена.");
      if (
        appointment.status !== "confirmed" ||
        Date.parse(appointment.starts_at) <= Date.now()
      )
        fail(409, "Эту запись уже нельзя изменить.");
      const body = await readBody(req);
      if (body.action === "cancel") {
        await db.query(
          "UPDATE appointments SET status='cancelled' WHERE id=$1 AND user_id=$2",
          [appointment.id, user.id],
        );
        return json(res, 200, { ok: true });
      }
      if (body.action === "reschedule") {
        const { startsAt } = bookingDetails({
          ...body,
          doctorId: appointment.doctor_id,
          serviceId: appointment.service_id,
        });
        try {
          await db.query(
            "UPDATE appointments SET starts_at=$1 WHERE id=$2 AND user_id=$3",
            [startsAt, appointment.id, user.id],
          );
        } catch (e) {
          if (uniqueError(e))
            fail(
              409,
              "Это время уже заняли. Выберите другой слот.",
              "SLOT_TAKEN",
            );
          throw e;
        }
        return json(res, 200, { ok: true });
      }
      fail(400, "Неизвестное действие.");
    }
    if (route.startsWith("admin/")) {
      if (user.role !== "admin") fail(403, "Недостаточно прав.");
      if (route === "admin/appointments" && method === "GET") {
        const rows = await db.query(
          "SELECT a.*,u.name AS patient_name,u.phone AS patient_phone,u.email AS patient_email FROM appointments a JOIN users u ON u.id=a.user_id ORDER BY a.starts_at DESC",
        );
        return json(res, 200, { appointments: rows.map(decorate) });
      }
      if (route === "admin/callbacks" && method === "GET")
        return json(res, 200, {
          callbacks: await db.query(
            "SELECT * FROM callbacks ORDER BY created_at DESC",
          ),
        });
      const match = route.match(/^admin\/appointments\/([a-f0-9-]{36})$/);
      if (match && method === "PATCH") {
        const body = await readBody(req);
        if (body.action !== "cancel") fail(400, "Неизвестное действие.");
        const updated = await db.query(
          "UPDATE appointments SET status='cancelled' WHERE id=$1 AND status='confirmed' RETURNING id",
          [match[1]],
        );
        if (!updated.length) fail(404, "Активная запись не найдена.");
        return json(res, 200, { ok: true });
      }
    }
    fail(404, "Страница не найдена.");
  } catch (e) {
    const status = e.status || 500;
    if (status === 429) res.setHeader("Retry-After", "900");
    if (status >= 500)
      console.error("API error:", e.code || e.name || "UNKNOWN");
    json(res, status, {
      error:
        status === 500
          ? "Не удалось выполнить запрос. Попробуйте позже."
          : e.message,
      code: e.code || "REQUEST_FAILED",
    });
  }
}
