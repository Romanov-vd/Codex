import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dayAfter } from "../server/catalog.mjs";
const temp = await mkdtemp(join(tmpdir(), "liniya-browser-"));
const port = Number(process.env.TEST_PORT || 3218),
  origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["server/start.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    SQLITE_PATH: join(temp, "clinic.sqlite"),
    ADMIN_EMAIL: "admin@browser.test",
    ADMIN_PASSWORD: "Browser-Admin-2026",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (d) => (logs += d));
server.stderr.on("data", (d) => (logs += d));
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(origin + "/api/health")).ok) break;
    } catch {}
    if (i === 79) throw Error("Server failed to start: " + logs);
    await new Promise((r) => setTimeout(r, 150));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const failed = [];
  async function newPage(context) {
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 500) failed.push(r.url());
    });
    return p;
  }
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await newPage(context);
  await page.goto(origin, { waitUntil: "networkidle" });
  for (const route of ["/services", "/doctors", "/contacts", "/cabinet", "/"]) {
    await page.goto(origin + route);
    await page.locator("h1").waitFor();
    assert(await page.locator("h1").innerText());
  }
  await page
    .getByRole("button", { name: "Можно ли перенести или отменить запись?" })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Можно ли перенести или отменить запись?" })
      .getAttribute("aria-expanded"),
    "true",
  );
  await page.goto(origin + "/doctors");
  await page.getByRole("textbox", { name: "Поиск врачей" }).fill("Анна");
  assert.equal(await page.locator(".doctor-card").count(), 1);
  await page
    .getByRole("button", { name: "Анна Михайлова", exact: true })
    .click();
  const details = page.getByRole("dialog", { name: "Анна Михайлова" });
  await details.getByRole("button", { name: "Выбрать время" }).click();
  let booking = page.getByRole("dialog", { name: "Найдём удобное время" });
  await booking.getByRole("button", { name: "Выбрать дату" }).click();
  let day = dayAfter(1);
  if (new Date(day + "T12:00:00+03:00").getUTCDay() === 0) day = dayAfter(2);
  await booking.getByLabel("Дата приёма", { exact: true }).fill(day);
  await booking.locator(".slot-grid button:not(:disabled)").first().click();
  await booking.getByRole("button", { name: "Продолжить" }).click();
  await booking.getByRole("button", { name: "Войти для записи" }).click();
  const login = page.getByRole("dialog", { name: "Рады видеть вас снова" });
  await login.getByRole("button", { name: "Регистрация", exact: true }).click();
  const registration = page.getByRole("dialog", {
    name: "Давайте познакомимся",
  });
  await registration
    .getByLabel("Как к вам обращаться")
    .fill("Тестовый Пациент");
  await registration
    .getByLabel("Телефон", { exact: true })
    .fill("+7 999 555 66 77");
  await registration
    .getByLabel("Email", { exact: true })
    .fill("patient@browser.test");
  await registration
    .getByLabel("Пароль", { exact: true })
    .fill("Patient-Browser-2026");
  await registration.getByRole("checkbox").check();
  await registration.getByRole("button", { name: "Создать кабинет" }).click();
  await registration.waitFor({ state: "hidden" });
  await booking.getByRole("checkbox").check();
  await booking
    .getByRole("button", { name: "Подтвердить запись", exact: true })
    .click();
  const success = page.getByRole("dialog", {
    name: "Вы записаны. До встречи!",
  });
  await success.waitFor();
  const downloadPromise = page.waitForEvent("download");
  await success.getByRole("button", { name: "В календарь" }).click();
  const download = await downloadPromise;
  assert.match(await readFile(await download.path(), "utf8"), /BEGIN:VEVENT/);
  await success.getByRole("link", { name: "Мои записи" }).click();
  await page.locator(".appointment-card").waitFor();
  assert.equal(await page.locator(".appointment-card").count(), 1);
  const before = await page.locator(".appointment-facts").innerText();
  await page.getByRole("button", { name: "Перенести", exact: true }).click();
  const reschedule = page.getByRole("dialog", { name: "Перенесём приём" });
  await reschedule.getByLabel("Дата приёма", { exact: true }).fill(day);
  await reschedule.locator(".slot-grid button:not(:disabled)").last().click();
  await reschedule.getByRole("button", { name: "Продолжить" }).click();
  await reschedule.getByRole("checkbox").check();
  await reschedule.getByRole("button", { name: "Подтвердить перенос" }).click();
  await page
    .getByRole("dialog", { name: "Вы записаны. До встречи!" })
    .getByRole("link", { name: "Мои записи" })
    .click();
  await page.locator(".appointment-card").waitFor();
  assert.notEqual(await page.locator(".appointment-facts").innerText(), before);
  await page.getByRole("button", { name: "Личные данные" }).click();
  await page.getByLabel("Имя и фамилия").fill("Пациент Обновлённый");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await page.getByRole("status").waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Здравствуйте, Пациент" }).waitFor();
  const second = await browser.newContext(),
    secondPage = await newPage(second);
  await secondPage.goto(origin + "/cabinet");
  await secondPage
    .getByRole("button", { name: "Войти или зарегистрироваться" })
    .click();
  const auth = secondPage.getByRole("dialog");
  await auth.getByLabel("Email", { exact: true }).fill("patient@browser.test");
  await auth.getByLabel("Пароль", { exact: true }).fill("Patient-Browser-2026");
  await auth.getByRole("button", { name: "Войти в кабинет" }).click();
  await secondPage.locator(".appointment-card").waitFor();
  assert.equal(await secondPage.locator(".appointment-card").count(), 1);
  await secondPage
    .getByRole("button", { name: "Отменить запись", exact: true })
    .click();
  await secondPage
    .getByRole("dialog", { name: "Отменить запись?" })
    .getByRole("button", { name: "Да, отменить" })
    .click();
  await secondPage
    .getByRole("heading", { name: "Пока нет запланированных приёмов" })
    .waitFor();
  await secondPage
    .getByRole("button", { name: "История", exact: true })
    .click();
  assert.match(
    await secondPage.locator(".appointment-card").innerText(),
    /Отменён/,
  );
  await page.goto(origin + "/contacts");
  await page.getByLabel("Ваше имя").fill("Обратный звонок");
  await page.getByLabel("Телефон", { exact: true }).fill("+7 999 555 00 00");
  await page.getByLabel("Ваш вопрос").fill("Уточнить время приёма");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await page.getByRole("heading", { name: "Заявка сохранена" }).waitFor();
  const adminContext = await browser.newContext(),
    adminPage = await newPage(adminContext);
  await adminPage.goto(origin + "/admin");
  await adminPage.getByRole("button", { name: "Войти", exact: true }).click();
  const adminAuth = adminPage.getByRole("dialog");
  await adminAuth
    .getByLabel("Email", { exact: true })
    .fill("admin@browser.test");
  await adminAuth
    .getByLabel("Пароль", { exact: true })
    .fill("Browser-Admin-2026");
  await adminAuth.getByRole("button", { name: "Войти в кабинет" }).click();
  await adminPage.getByRole("heading", { name: "Панель клиники" }).waitFor();
  await adminPage.getByRole("button", { name: /Заявки \(1\)/ }).click();
  assert.match(
    await adminPage.locator(".admin-grid").innerText(),
    /Обратный звонок/,
  );
  await secondPage.goto(origin + "/admin");
  await secondPage
    .getByRole("heading", { name: "Этот раздел доступен администратору" })
    .waitFor();
  const shots = resolve("test-artifacts");
  await mkdir(shots, { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/services",
      "/doctors",
      "/contacts",
      "/cabinet",
    ]) {
      await page.goto(origin + route, { waitUntil: "networkidle" });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Page overflows: ${route} at ${width}`,
      );
    }
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Записаться на приём", exact: true })
      .click();
    let modal = page.getByRole("dialog", { name: "Найдём удобное время" });
    await modal.waitFor();
    assert(
      await modal.evaluate((el) => el.scrollWidth <= el.clientWidth),
      "Modal overflow at " + width,
    );
    await modal.getByRole("button", { name: "Закрыть окно" }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.screenshot({
    path: join(shots, "home-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(shots, "home-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("button", { name: "Выйти из кабинета", exact: true })
    .click();
  await page.goto(origin + "/cabinet");
  await page.getByRole("heading", { name: "Всё важное — под рукой" }).waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(
    "PASS: navigation/search, doctor details, registration during booking, confirmed booking, calendar export, rescheduling, profile persistence, second-browser login, cancellation/history, callbacks/admin, role protection, mobile logout, and 320/390/768/1440 responsive layouts.",
  );
} finally {
  if (browser) await browser.close();
  server.kill();
  await new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once("exit", resolve);
  });
  await rm(temp, { recursive: true, force: true });
}
