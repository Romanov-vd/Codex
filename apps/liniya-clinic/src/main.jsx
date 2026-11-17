import React, { useEffect, useRef, useState, useId } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  HeartPulse,
  Stethoscope,
  Brain,
  Sparkles,
  ScanLine,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  UserRound,
  Menu,
  X,
  LogOut,
  LoaderCircle,
  Search,
  Leaf,
  Plus,
  Download,
  AlertCircle,
  Activity,
  ClipboardList,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import "./styles.css";
const icons = {
  Stethoscope,
  HeartPulse,
  Brain,
  Sparkles,
  ScanLine,
  ShieldCheck,
};
const localDemo = Boolean(window.CLINIC_LOCAL_DEMO);
const currentRoute = () => localDemo ? (location.hash.slice(1) || '/') : location.pathname;
const imagePath = (name) => localDemo ? window.CLINIC_LOCAL_IMAGES[name] : '/images/' + name;
const money = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const shortDate = (value) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
const fullDate = (value) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
const time = (value) =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
const dayValue = (offset) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offset * 86400000));
async function api(path, options = {}) {
  const res = localDemo ? await window.clinicLocalAPI(path, options) : await fetch("/api/" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Не удалось связаться с сервером. Попробуйте ещё раз.");
  }
  if (!res.ok) {
    const e = new Error(data.error || "Не удалось выполнить запрос.");
    e.status = res.status;
    e.code = data.code;
    throw e;
  }
  return data;
}
function Link({ to, children, className = "", onClick, ...props }) {
  return (
    <a
      href={localDemo ? "#" + to : to}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        e.preventDefault();
        if (localDemo) location.hash = to;
        else {
          history.pushState({}, "", to);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
        window.scrollTo({ top: 0 });
      }}
      {...props}
    >
      {children}
    </a>
  );
}
function useRoute() {
  const [path, setPath] = useState(currentRoute());
  useEffect(() => {
    const listener = () => setPath(currentRoute());
    window.addEventListener("popstate", listener);
    window.addEventListener("hashchange", listener);
    return () => {window.removeEventListener("popstate", listener);window.removeEventListener("hashchange", listener);};
  }, []);
  return path;
}
function Icon({ name, size = 22, ...props }) {
  const Component = icons[name] || Stethoscope;
  return <Component size={size} strokeWidth={1.6} {...props} />;
}
function ErrorBox({ children }) {
  return children ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  ) : null;
}
function Submit({ busy, children, ...props }) {
  return (
    <button className="button primary" disabled={busy} {...props}>
      {busy ? <LoaderCircle className="spin" size={18} /> : null}
      {children}
    </button>
  );
}
function Dialog({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef(null);
  const headingId = useId();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"dialog " + (wide ? "dialog-wide" : "")}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = ref.current.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-head">
        <div>
          <span className="eyebrow">КЛИНИКА ЛИНИЯ</span>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Закрыть окно"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Brand({ light = false }) {
  return (
    <Link
      to="/"
      className={"brand " + (light ? "brand-light" : "")}
      aria-label="Линия — главная"
    >
      <span className="brand-symbol">
        <Activity size={25} strokeWidth={1.6} />
      </span>
      <span>
        линия<span className="brand-sub">КЛИНИКА РЯДОМ</span>
      </span>
    </Link>
  );
}
function DoctorCard({ doctor, onBook, onDetails }) {
  return (
    <article className="doctor-card">
      <button
        className="portrait-button"
        onClick={() => onDetails(doctor)}
        aria-label={"Подробнее: " + doctor.name}
        style={{ background: doctor.color }}
      >
        <img
          src={imagePath(doctor.portrait + ".svg")}
          alt={"Иллюстрация специалиста: " + doctor.name}
          loading="lazy"
        />
        <span className="experience">{doctor.experience} лет практики</span>
        <span className="portrait-arrow">
          <ArrowUpRight size={21} />
        </span>
      </button>
      <div className="doctor-info">
        <span className="small-label">{doctor.specialty}</span>
        <button
          className="text-button doctor-name"
          onClick={() => onDetails(doctor)}
        >
          {doctor.name}
        </button>
        <div className="doctor-bottom">
          <span>
            <span className="online-dot" />
            Приём по записи
          </span>
          <button
            className="text-button green"
            onClick={() =>
              onBook({ doctorId: doctor.id, serviceId: doctor.serviceIds[0] })
            }
          >
            Записаться <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
function ServiceCard({ service, onBook }) {
  return (
    <button
      className="service-card"
      onClick={() => onBook({ serviceId: service.id })}
    >
      <div className="service-top">
        <span className="service-icon">
          <Icon name={service.icon} size={26} />
        </span>
        <ArrowUpRight size={21} />
      </div>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="service-bottom">
        <span>{money(service.price)}</span>
        <span>
          <Clock3 size={14} />
          {service.duration} мин
        </span>
      </div>
    </button>
  );
}
function Home({ catalog, onBook, onDoctor }) {
  const [question, setQuestion] = useState(null);
  const faqs = [
    [
      "Как записаться на приём?",
      "Выберите услугу, врача и удобное время. Войдите или создайте личный кабинет, затем подтвердите запись. Подтверждённый приём сразу появится в кабинете.",
    ],
    [
      "Можно ли перенести или отменить запись?",
      "Да. Откройте «Мои записи» в личном кабинете. До начала приёма доступны перенос на другое свободное время и отмена.",
    ],
    [
      "Нужно ли направление?",
      "Для первичной консультации направление не требуется. Если у вас уже есть заключения или результаты исследований, возьмите их с собой.",
    ],
    [
      "Как подготовиться к УЗИ?",
      "Подготовка зависит от исследования. Перед УЗИ органов брюшной полости уточните рекомендации у специалиста. Не меняйте назначения лечащего врача самостоятельно.",
    ],
  ];
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="hero-label">
            <span className="online-dot" />
            ВНИМАТЕЛЬНАЯ МЕДИЦИНА, БЛИЖЕ К ВАМ
          </div>
          <h1>
            Ваше здоровье.
            <br />
            <em>Наше внимание.</em>
          </h1>
          <p className="hero-description">
            Когда важно не просто назначение,
            <br className="desktop-br" />а врач, который услышит.
          </p>
          <div className="hero-actions">
            <button className="button primary large" onClick={() => onBook({})}>
              Записаться на приём <ArrowUpRight size={19} />
            </button>
            <Link to="/doctors" className="hero-doctors-link">
              Знакомьтесь с врачами <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-trust">
            <div className="mini-avatars">
              {catalog.doctors.slice(0, 3).map((d) => (
                <img key={d.id} src={imagePath(d.portrait + ".svg")} alt="" />
              ))}
            </div>
            <div>
              <strong>Помогаем разобраться.</strong>
              <span>Объясняем. Заботимся. Мы рядом.</span>
            </div>
          </div>
        </div>
        <div className="hero-art">
          <img
            className="hero-illustration"
            src={imagePath("hero.svg")}
            alt="Иллюстрация: врач на консультации в светлой клинике"
          />
          <div className="hero-float">
            <span className="float-icon">
              <HeartPulse size={24} />
            </span>
            <div>
              <strong>Время для себя</strong>
              <span>Забота начинается с первого шага</span>
            </div>
            <span className="float-check">
              <Check size={15} />
            </span>
          </div>
          <div className="hero-tag">
            <Leaf size={18} /> В вашем темпе
          </div>
          <span className="art-corner">ЗДОРОВЬЕ — ЭТО ЛИЧНОЕ</span>
        </div>
      </section>
      <div className="principles container">
        <div>
          <ShieldCheck />
          <span>Понятный план лечения</span>
        </div>
        <div>
          <Stethoscope />
          <span>Врачи разных направлений</span>
        </div>
        <div>
          <CalendarDays />
          <span>Онлайн-запись без звонков</span>
        </div>
        <div>
          <Heart />
          <span>Внимание к деталям</span>
        </div>
      </div>
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">ЗАБОТА В НУЖНОМ НАПРАВЛЕНИИ</span>
            <h2>С чего начнём?</h2>
          </div>
          <Link to="/services" className="arrow-link">
            Все услуги <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="service-grid">
          {catalog.services.slice(0, 4).map((s) => (
            <ServiceCard key={s.id} service={s} onBook={onBook} />
          ))}
        </div>
        <div className="service-note">
          <span>
            <Plus size={17} />
            Не знаете, какой специалист нужен?
          </span>
          <button
            className="text-button green"
            onClick={() => onBook({ serviceId: "therapy" })}
          >
            Начните с терапевта <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="about-band">
        <div className="container about-content">
          <div className="about-statement">
            <span className="eyebrow">МЕДИЦИНА С ЧЕЛОВЕЧЕСКИМ ЛИЦОМ</span>
            <h2>
              Не только лечить.
              <br />
              <em>Но и слышать.</em>
            </h2>
          </div>
          <div className="about-right">
            <p>
              За каждым вопросом о здоровье — своя история. Мы оставляем время,
              чтобы вы могли рассказать её, задать вопросы и уйти с пониманием,
              что делать дальше.
            </p>
            <div className="about-chips">
              <span>Без спешки</span>
              <span>На понятном языке</span>
              <span>Вместе с вами</span>
            </div>
          </div>
        </div>
      </section>
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">ВАЖНО, КТО РЯДОМ</span>
            <h2>Знакомьтесь: ваши врачи</h2>
          </div>
          <Link to="/doctors" className="arrow-link">
            Вся команда <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="doctor-grid">
          {catalog.doctors.slice(0, 4).map((d) => (
            <DoctorCard
              key={d.id}
              doctor={d}
              onBook={onBook}
              onDetails={onDoctor}
            />
          ))}
        </div>
      </section>
      <section className="journey container">
        <div>
          <span className="eyebrow">ВСЁ ПРОЩЕ, ЧЕМ КАЖЕТСЯ</span>
          <h2>
            До приёма —<br />
            три простых шага
          </h2>
        </div>
        <div className="journey-steps">
          {[
            [
              "01",
              "Выберите специалиста",
              "Найдите врача и услугу под свой запрос.",
            ],
            [
              "02",
              "Найдите удобное время",
              "Свободные слоты видны сразу, без звонков.",
            ],
            [
              "03",
              "Приходите на приём",
              "Все детали сохранятся в вашем кабинете.",
            ],
          ].map(([n, t, b]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{b}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section container faq-section">
        <div>
          <span className="eyebrow">ОТВЕЧАЕМ ЗАРАНЕЕ</span>
          <h2>
            Хорошие вопросы.
            <br />
            <em>Понятные ответы.</em>
          </h2>
          <p className="muted">
            Чтобы перед первым визитом
            <br />
            было чуть спокойнее.
          </p>
        </div>
        <div className="faqs">
          {faqs.map(([q, a], i) => (
            <div className="faq" key={q}>
              <button
                aria-expanded={question === i}
                onClick={() => setQuestion(question === i ? null : i)}
              >
                {q}
                <Plus className={question === i ? "rotated" : ""} size={21} />
              </button>
              {question === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>
      <CallToAction onBook={onBook} />
    </>
  );
}
function CallToAction({ onBook }) {
  return (
    <section className="container cta">
      <div>
        <span className="eyebrow">ПЕРВЫЙ ШАГ К ХОРОШЕМУ САМОЧУВСТВИЮ</span>
        <h2>
          Найдём время
          <br />
          <em>для вашего здоровья.</em>
        </h2>
      </div>
      <button className="button light large" onClick={() => onBook({})}>
        Выбрать время <ArrowUpRight size={20} />
      </button>
      <div className="cta-decoration" aria-hidden="true">
        <Activity size={160} strokeWidth={0.7} />
      </div>
    </section>
  );
}
function Services({ catalog, onBook }) {
  const [q, setQ] = useState("");
  const list = catalog.services.filter((s) =>
    (s.name + " " + s.category).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <main className="container page">
      <PageHeading
        eyebrow="ПОНЯТНАЯ ЗАБОТА"
        title="Услуги и направления"
        subtitle="Выберите то, что нужно сейчас. Стоимость консультации известна заранее."
      />
      <label className="search">
        <Search size={20} />
        <input
          aria-label="Поиск услуг"
          placeholder="Найти услугу или направление"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="service-grid service-grid-page">
        {list.map((s) => (
          <ServiceCard key={s.id} service={s} onBook={onBook} />
        ))}
      </div>
      {!list.length && (
        <Empty
          title="Ничего не нашли"
          text="Попробуйте другое название или выберите консультацию терапевта."
        />
      )}
      <div className="notice">
        <ShieldCheck size={22} />
        <p>
          Исследования и дополнительные процедуры назначаются по показаниям. Их
          стоимость обсуждается отдельно — до оказания услуги.
        </p>
      </div>
    </main>
  );
}
function Doctors({ catalog, onBook, onDoctor }) {
  const [q, setQ] = useState(""),
    [service, setService] = useState("");
  const list = catalog.doctors.filter(
    (d) =>
      (!service || d.serviceIds.includes(service)) &&
      (d.name + " " + d.specialty).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <main className="container page">
      <PageHeading
        eyebrow="КОМАНДА, КОТОРАЯ РЯДОМ"
        title="Врачи, которым можно задать вопросы"
        subtitle="Выберите специалиста, узнайте о его подходе и найдите удобное время."
      />
      <div className="filters">
        <label className="search">
          <Search size={20} />
          <input
            aria-label="Поиск врачей"
            placeholder="Имя врача или специальность"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="select-wrap">
          <SlidersHorizontal size={18} />
          <select
            aria-label="Направление"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="">Все направления</option>
            {catalog.services.map((s) => (
              <option value={s.id} key={s.id}>
                {s.category}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="doctor-grid doctor-grid-page">
        {list.map((d) => (
          <DoctorCard
            key={d.id}
            doctor={d}
            onBook={onBook}
            onDetails={onDoctor}
          />
        ))}
      </div>
      {!list.length && (
        <Empty
          title="Такой специалист не найден"
          text="Попробуйте изменить запрос или направление."
        />
      )}
    </main>
  );
}
function PageHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <CalendarDays size={34} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const data = await api(
        "auth/" + (mode === "login" ? "login" : "register"),
        {
          method: "POST",
          body: {
            email: f.get("email"),
            password: f.get("password"),
            name: f.get("name"),
            phone: f.get("phone"),
            consent: f.get("consent") === "on",
          },
        },
      );
      onLogin(data.user);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        mode === "login" ? "Рады видеть вас снова" : "Давайте познакомимся"
      }
      subtitle={
        mode === "login"
          ? "Войдите, чтобы управлять своими записями."
          : "Создайте кабинет — все ваши приёмы будут под рукой."
      }
      onClose={onClose}
    >
      <div className="tab-switch">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Войти
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Регистрация
        </button>
      </div>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && (
          <>
            <label>
              Как к вам обращаться
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                placeholder="Имя и фамилия"
              />
            </label>
            <label>
              Телефон
              <input
                name="phone"
                type="tel"
                maxLength={30}
                autoComplete="tel"
                placeholder="+7 (999) 123-45-67"
              />
            </label>
          </>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 10 : 1}
            maxLength={256}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            placeholder={
              mode === "register" ? "Не менее 10 символов" : "Ваш пароль"
            }
          />
        </label>
        {mode === "register" && (
          <label className="checkbox">
            <input name="consent" type="checkbox" required />
            <span>
              Согласен на обработку указанных данных для создания кабинета и
              записи на приём.
            </span>
          </label>
        )}
        <ErrorBox>{error}</ErrorBox>
        <Submit busy={busy}>
          {mode === "login" ? "Войти в кабинет" : "Создать кабинет"}
          <ArrowRight size={17} />
        </Submit>
        <p className="fine-print">
          Данные доступны вам и администратору клиники. Пароль хранится в виде
          защищённого хеша.
        </p>
      </form>
    </Dialog>
  );
}
function BookingModal({ initial, catalog, user, onAuth, onClose, onSaved }) {
  const initialDoctor = catalog.doctors.find((d) => d.id === initial.doctorId);
  const [serviceId, setService] = useState(
    initial.serviceId ||
      initialDoctor?.serviceIds[0] ||
      catalog.services[0]?.id ||
      "",
  );
  const [doctorId, setDoctor] = useState(initial.doctorId || "");
  const [date, setDate] = useState(dayValue(1));
  const [slots, setSlots] = useState([]),
    [selected, setSelected] = useState(""),
    [step, setStep] = useState(initial.reschedule ? 2 : 1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(null),
    [refresh, setRefresh] = useState(0);
  const service = catalog.services.find((s) => s.id === serviceId),
    matching = catalog.doctors.filter((d) => d.serviceIds.includes(serviceId)),
    doctor = matching.find((d) => d.id === doctorId) || matching[0];
  useEffect(() => {
    setDoctor(
      matching.some((d) => d.id === doctorId)
        ? doctorId
        : matching[0]?.id || "",
    );
    setSelected("");
  }, [serviceId]);
  useEffect(() => {
    if (step !== 2 || !doctor) return;
    const c = new AbortController();
    setLoading(true);
    setError("");
    setSelected("");
    api("slots?doctorId=" + encodeURIComponent(doctor.id) + "&date=" + date, {
      signal: c.signal,
    })
      .then((d) => setSlots(d.slots))
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setSlots([]);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [doctor?.id, date, step, refresh]);
  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let result;
      if (initial.reschedule) {
        await api("appointments/" + initial.reschedule.id, {
          method: "PATCH",
          body: { action: "reschedule", startsAt: selected },
        });
        result = {
          appointment: {
            ...initial.reschedule,
            starts_at: selected,
            doctor,
            service,
          },
        };
      } else
        result = await api("appointments", {
          method: "POST",
          body: { doctorId: doctor.id, serviceId, startsAt: selected },
        });
      setSaved(result.appointment);
      setStep(4);
      onSaved();
    } catch (e) {
      setError(e.message);
      if (e.status === 401) onAuth();
      if (e.code === "SLOT_TAKEN") {
        setStep(2);
        setRefresh((x) => x + 1);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      wide
      title={
        step === 4
          ? "Вы записаны. До встречи!"
          : initial.reschedule
            ? "Перенесём приём"
            : "Найдём удобное время"
      }
      subtitle={
        step === 4
          ? "Детали уже сохранены в вашем личном кабинете."
          : "Без звонков и ожидания. Запись займёт пару минут."
      }
      onClose={onClose}
    >
      {step < 4 && (
        <div className="booking-progress">
          {["Услуга и врач", "Дата и время", "Подтверждение"].map(
            (label, i) => (
              <span className={step >= i + 1 ? "active" : ""} key={label}>
                <b>{step > i + 1 ? <Check size={14} /> : i + 1}</b>
                {label}
              </span>
            ),
          )}
        </div>
      )}
      {step === 1 && (
        <div className="form-stack">
          <label>
            Что вас интересует?
            <select
              value={serviceId}
              onChange={(e) => setService(e.target.value)}
            >
              {catalog.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {money(s.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ваш специалист
            <select
              value={doctor?.id || ""}
              onChange={(e) => setDoctor(e.target.value)}
            >
              {matching.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.specialty}
                </option>
              ))}
            </select>
          </label>
          {doctor && (
            <div className="mini-doctor">
              <img src={imagePath(doctor.portrait + ".svg")} alt="" />
              <div>
                <strong>{doctor.name}</strong>
                <span>
                  {doctor.specialty} · {doctor.experience} лет практики
                </span>
              </div>
            </div>
          )}
          <div className="booking-price">
            <span>
              <Clock3 size={17} />
              {service?.duration} минут
            </span>
            <strong>{money(service?.price || 0)}</strong>
          </div>
          <button
            className="button primary"
            disabled={!doctor || !service}
            onClick={() => setStep(2)}
          >
            Выбрать дату <ArrowRight size={17} />
          </button>
        </div>
      )}
      {step === 2 && (
        <div>
          <div className="date-selector">
            <label className="field-label">
              Дата приёма
              <input
                aria-label="Дата приёма"
                type="date"
                min={dayValue(0)}
                max={dayValue(30)}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelected("");
                }}
              />
            </label>
            <span className="small-label">Время московское, UTC+3</span>
          </div>
          <div className="quick-dates">
            {[1, 2, 3, 4, 5].map((offset) => (
              <button
                key={offset}
                className={date === dayValue(offset) ? "active" : ""}
                onClick={() => setDate(dayValue(offset))}
              >
                {shortDate(dayValue(offset) + "T12:00:00+03:00")}
              </button>
            ))}
          </div>
          <p className="field-label">Свободное время</p>
          {loading ? (
            <div className="loading-inline">
              <LoaderCircle className="spin" />
              Загружаем расписание…
            </div>
          ) : slots.length ? (
            <div className="slot-grid">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  disabled={!slot.available}
                  aria-pressed={selected === slot.startsAt}
                  className={selected === slot.startsAt ? "selected" : ""}
                  onClick={() => setSelected(slot.startsAt)}
                >
                  {time(slot.startsAt)}
                  {!slot.available && <small>занято</small>}
                </button>
              ))}
            </div>
          ) : (
            <div className="notice">
              На эту дату приёма нет. Выберите другой день.
            </div>
          )}
          <ErrorBox>{error}</ErrorBox>
          <div className="dialog-actions">
            {!initial.reschedule && (
              <button className="button secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={16} />
                Назад
              </button>
            )}
            <button
              className="button primary"
              disabled={!selected}
              onClick={() => {
                setStep(3);
                setError("");
              }}
            >
              Продолжить <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <form className="form-stack" onSubmit={confirm}>
          <div className="booking-summary">
            <div className="summary-icon">
              <CalendarDays size={27} />
            </div>
            <div>
              <h3>{service?.name}</h3>
              <p>
                {doctor?.name} · {doctor?.specialty}
              </p>
              <strong>
                {selected && fullDate(selected)} в {selected && time(selected)}
              </strong>
              <p>
                {service?.duration} минут · {money(service?.price || 0)}
              </p>
            </div>
          </div>
          {user ? (
            <>
              <div className="patient-summary">
                <UserRound size={20} />
                <span>
                  {user.name}
                  <small>{user.email}</small>
                </span>
              </div>
              <label className="checkbox">
                <input type="checkbox" required />
                <span>Подтверждаю выбранные услугу, врача и время приёма.</span>
              </label>
              <ErrorBox>{error}</ErrorBox>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setStep(2)}
                >
                  Изменить время
                </button>
                <Submit busy={busy}>
                  {initial.reschedule
                    ? "Подтвердить перенос"
                    : "Подтвердить запись"}
                  <Check size={17} />
                </Submit>
              </div>
            </>
          ) : (
            <>
              <div className="notice">
                <LockKeyhole size={20} />
                <p>
                  Войдите или создайте кабинет, чтобы подтвердить запись и
                  управлять приёмами.
                </p>
              </div>
              <button type="button" className="button primary" onClick={onAuth}>
                Войти для записи <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setStep(2)}
              >
                Изменить время
              </button>
            </>
          )}
        </form>
      )}
      {step === 4 && saved && (
        <div className="booking-success">
          <div className="success-symbol">
            <CheckCircle2 size={43} />
          </div>
          <h3>{saved.service.name}</h3>
          <p>{saved.doctor.name}</p>
          <div className="success-date">
            <CalendarDays size={20} />
            {fullDate(saved.starts_at)} · {time(saved.starts_at)}
          </div>
          <p className="muted">
            Пожалуйста, приходите за 10 минут до начала.
            <br />
            Возьмите документ, удостоверяющий личность.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => downloadCalendar(saved)}
            >
              <Download size={17} />В календарь
            </button>
            <Link to="/cabinet" className="button primary" onClick={onClose}>
              Мои записи <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}
function downloadCalendar(appointment) {
  const stamp = (date) =>
    new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = new Date(appointment.starts_at),
    end = new Date(start.getTime() + appointment.service.duration * 60000);
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Liniya//Appointments//RU",
    "BEGIN:VEVENT",
    "UID:" + appointment.id + "@liniya",
    "DTSTAMP:" + stamp(new Date()),
    "DTSTART:" + stamp(start),
    "DTEND:" + stamp(end),
    "SUMMARY:" + appointment.service.name + " — " + appointment.doctor.name,
    "DESCRIPTION:Запись в клинику Линия. Демонстрационный проект.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/calendar;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "liniya-appointment.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Cabinet({ user, onAuth, onUser, onBook, revision, onCancel }) {
  const [tab, setTab] = useState("upcoming"),
    [appointments, setAppointments] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api("appointments")
      .then((d) => {
        if (active) {
          setAppointments(d.appointments);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id, revision]);
  async function profile(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const d = await api("profile", {
        method: "PATCH",
        body: { name: f.get("name"), phone: f.get("phone") },
      });
      onUser(d.user);
      setMessage("Изменения сохранены.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (!user)
    return (
      <main className="container page">
        <PageHeading
          eyebrow="ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО"
          title="Кабинет пациента"
          subtitle="Записи, история визитов и ваши данные — в одном месте."
        />
        <Empty
          title="Всё важное — под рукой"
          text="Войдите, чтобы записаться на приём или посмотреть свои записи."
        >
          <button className="button primary" onClick={onAuth}>
            Войти или зарегистрироваться <ArrowRight size={17} />
          </button>
        </Empty>
      </main>
    );
  const upcoming = appointments
    .filter(
      (a) => a.status === "confirmed" && Date.parse(a.starts_at) > Date.now(),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = appointments.filter(
    (a) => a.status !== "confirmed" || Date.parse(a.starts_at) <= Date.now(),
  );
  const list = tab === "upcoming" ? upcoming : history;
  return (
    <main className="container page">
      <PageHeading
        eyebrow="ЛИЧНЫЙ КАБИНЕТ"
        title={"Здравствуйте, " + user.name.split(" ")[0]}
        subtitle="Пусть забота о здоровье вписывается в ваши планы."
      />
      <div className="cabinet-layout">
        <aside className="cabinet-sidebar">
          <span className="profile-avatar">{user.name.slice(0, 1)}</span>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
          <button
            className={tab === "upcoming" ? "active" : ""}
            onClick={() => {
              setTab("upcoming");
              setError("");
            }}
          >
            <CalendarDays size={18} />
            Мои записи <span>{upcoming.length}</span>
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            <ClipboardList size={18} />
            История
          </button>
          <button
            className={tab === "profile" ? "active" : ""}
            onClick={() => setTab("profile")}
          >
            <UserRound size={18} />
            Личные данные
          </button>
          {user.role === "admin" && (
            <Link to="/admin">
              <SlidersHorizontal size={18} />
              Панель клиники
            </Link>
          )}
        </aside>
        <div className="cabinet-main">
          <ErrorBox>{error}</ErrorBox>
          {tab === "profile" ? (
            <div className="profile-panel">
              <h2>Ваши данные</h2>
              <p className="muted">Можно изменить имя и контактный телефон.</p>
              <form key={user.id} className="form-stack" onSubmit={profile}>
                <label>
                  Имя и фамилия
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={user.name}
                  />
                </label>
                <label>
                  Email
                  <input value={user.email} readOnly type="email" />
                </label>
                <label>
                  Телефон
                  <input
                    name="phone"
                    type="tel"
                    maxLength={30}
                    defaultValue={user.phone}
                    placeholder="+7 (999) 123-45-67"
                  />
                </label>
                {message && (
                  <p className="success-text" role="status">
                    <Check size={17} />
                    {message}
                  </p>
                )}
                <Submit busy={saving}>Сохранить изменения</Submit>
              </form>
            </div>
          ) : (
            <>
              <div className="section-head small">
                <h2>
                  {tab === "upcoming" ? "Ближайшие приёмы" : "История записей"}
                </h2>
                {tab === "upcoming" && (
                  <button
                    className="button primary compact"
                    onClick={() => onBook({})}
                  >
                    <Plus size={16} />
                    Новая запись
                  </button>
                )}
              </div>
              {loading ? (
                <div className="loading-inline">
                  <LoaderCircle className="spin" />
                  Загружаем записи…
                </div>
              ) : !list.length ? (
                <Empty
                  title={
                    tab === "upcoming"
                      ? "Пока нет запланированных приёмов"
                      : "История пока пуста"
                  }
                  text={
                    tab === "upcoming"
                      ? "Выберите врача и удобное время — запись появится здесь."
                      : "Прошедшие и отменённые записи появятся в этом разделе."
                  }
                >
                  {tab === "upcoming" && (
                    <button
                      className="button secondary"
                      onClick={() => onBook({})}
                    >
                      Найти специалиста <ArrowRight size={17} />
                    </button>
                  )}
                </Empty>
              ) : (
                list.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    onBook={onBook}
                    onCancel={onCancel}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
function AppointmentCard({ appointment: a, onBook, onCancel, admin = false }) {
  const upcoming =
    a.status === "confirmed" && Date.parse(a.starts_at) > Date.now();
  return (
    <article className="appointment-card">
      <div className="appointment-top">
        <span
          className={"status " + (a.status === "cancelled" ? "cancelled" : "")}
        >
          {a.status === "cancelled"
            ? "Отменён"
            : upcoming
              ? "Запись подтверждена"
              : "Время приёма прошло"}
        </span>
        <span className="small-label">{a.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <h3>{a.service?.name || "Услуга"}</h3>
      <p>
        {a.doctor?.name} · {a.doctor?.specialty}
      </p>
      <div className="appointment-facts">
        <span>
          <CalendarDays size={17} />
          {fullDate(a.starts_at)}
        </span>
        <span>
          <Clock3 size={17} />
          {time(a.starts_at)}
        </span>
        <strong>{money(a.service?.price || 0)}</strong>
      </div>
      {admin && (
        <p className="admin-patient">
          <UserRound size={16} />
          {a.patient_name} · {a.patient_phone || a.patient_email}
        </p>
      )}
      {upcoming && (
        <div className="appointment-actions">
          {!admin && (
            <>
              <button
                className="text-button green"
                onClick={() =>
                  onBook({
                    doctorId: a.doctor_id,
                    serviceId: a.service_id,
                    reschedule: a,
                  })
                }
              >
                Перенести
              </button>
              <button
                className="text-button"
                onClick={() => downloadCalendar(a)}
              >
                <Download size={15} />В календарь
              </button>
            </>
          )}
          <button
            className="text-button danger"
            onClick={() => onCancel({ ...a, admin })}
          >
            Отменить запись
          </button>
        </div>
      )}
    </article>
  );
}
function Admin({ user, onAuth, onCancel, revision }) {
  const [appointments, setAppointments] = useState([]),
    [callbacks, setCallbacks] = useState([]),
    [tab, setTab] = useState("appointments"),
    [date, setDate] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user?.role !== "admin") return;
    let active = true;
    Promise.all([api("admin/appointments"), api("admin/callbacks")])
      .then(([a, b]) => {
        if (active) {
          setAppointments(a.appointments);
          setCallbacks(b.callbacks);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id, revision]);
  if (!user)
    return (
      <main className="container page">
        <Empty
          title="Панель клиники"
          text="Войдите под учётной записью администратора."
        >
          <button className="button primary" onClick={onAuth}>
            Войти
          </button>
        </Empty>
      </main>
    );
  if (user.role !== "admin")
    return (
      <main className="container page">
        <Empty
          title="Этот раздел доступен администратору"
          text="Ваши приёмы находятся в кабинете пациента."
        >
          <Link className="button primary" to="/cabinet">
            Мой кабинет
          </Link>
        </Empty>
      </main>
    );
  const list = appointments.filter(
    (a) => !date || a.starts_at.startsWith(date),
  );
  return (
    <main className="container page">
      <PageHeading
        eyebrow="РАБОЧЕЕ ПРОСТРАНСТВО"
        title="Панель клиники"
        subtitle="Записи пациентов и заявки на обратный звонок."
      />
      <div className="admin-filters">
        <div className="tab-switch">
          <button
            className={tab === "appointments" ? "active" : ""}
            onClick={() => setTab("appointments")}
          >
            Приёмы ({appointments.length})
          </button>
          <button
            className={tab === "callbacks" ? "active" : ""}
            onClick={() => setTab("callbacks")}
          >
            Заявки ({callbacks.length})
          </button>
        </div>
        {tab === "appointments" && (
          <input
            type="date"
            aria-label="Фильтр по дате"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {loading ? (
        <div className="loading-inline">
          <LoaderCircle className="spin" />
          Загружаем…
        </div>
      ) : tab === "appointments" ? (
        <div className="admin-grid">
          {list.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              onCancel={onCancel}
              admin
            />
          ))}
          {!list.length && (
            <Empty title="Записей нет" text="Попробуйте выбрать другую дату." />
          )}
        </div>
      ) : (
        <div className="admin-grid">
          {callbacks.map((c) => (
            <article className="appointment-card" key={c.id}>
              <span className="small-label">{fullDate(c.created_at)}</span>
              <h3>{c.name}</h3>
              <a
                className="green"
                href={"tel:" + c.phone.replace(/[^+\d]/g, "")}
              >
                {c.phone}
              </a>
              <p>{c.message || "Просит связаться."}</p>
            </article>
          ))}
          {!callbacks.length && (
            <Empty
              title="Заявок пока нет"
              text="Здесь появятся запросы из формы на странице контактов."
            />
          )}
        </div>
      )}
    </main>
  );
}
function Contacts() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api("callbacks", {
        method: "POST",
        body: {
          name: f.get("name"),
          phone: f.get("phone"),
          message: f.get("message"),
          consent: f.get("consent") === "on",
        },
      });
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container page">
      <PageHeading
        eyebrow="ВСЕГДА НА СВЯЗИ"
        title="Давайте познакомимся ближе"
        subtitle="Оставьте заявку администратору или выберите удобное время онлайн."
      />
      <div className="contacts-grid">
        <section className="contact-info">
          <span className="round-icon">
            <MapPin size={26} />
          </span>
          <h2>Клиника рядом</h2>
          <p className="contact-address">
            Воронеж
            <br />
            ул. Примерная, 12
          </p>
          <p className="small-label">
            Демонстрационный адрес — не место оказания медицинской помощи.
          </p>
          <div className="contact-row">
            <Clock3 size={20} />
            <div>
              <strong>Понедельник — суббота</strong>
              <span>09:00–18:00 · воскресенье — выходной</span>
            </div>
          </div>
          <div className="contact-row">
            <CalendarDays size={20} />
            <div>
              <strong>Запись онлайн</strong>
              <span>Выбирайте время в удобный для вас момент</span>
            </div>
          </div>
          <div className="map-illustration" aria-hidden="true">
            <div className="map-road r1" />
            <div className="map-road r2" />
            <div className="map-road r3" />
            <div className="map-road r4" />
            <span className="map-marker">
              <Activity size={28} />
            </span>
            <span className="map-label">линия</span>
          </div>
        </section>
        <section className="callback-panel">
          {sent ? (
            <div className="booking-success">
              <div className="success-symbol">
                <CheckCircle2 size={40} />
              </div>
              <h2>Заявка сохранена</h2>
              <p>Она появилась в рабочем кабинете администратора.</p>
              <button
                className="button secondary"
                onClick={() => setSent(false)}
              >
                Отправить ещё одну
              </button>
            </div>
          ) : (
            <>
              <h2>Оставить заявку</h2>
              <p className="muted">Администратор увидит её в панели клиники.</p>
              <form className="form-stack" onSubmit={submit}>
                <label>
                  Ваше имя
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Как к вам обращаться?"
                  />
                </label>
                <label>
                  Телефон
                  <input
                    name="phone"
                    type="tel"
                    required
                    maxLength={30}
                    autoComplete="tel"
                    placeholder="+7 (999) 123-45-67"
                  />
                </label>
                <label>
                  Ваш вопрос
                  <textarea
                    name="message"
                    maxLength={1000}
                    rows={3}
                    placeholder="Например, хочу уточнить подготовку к исследованию"
                  />
                </label>
                <label className="checkbox">
                  <input name="consent" type="checkbox" required />
                  <span>
                    Согласен на обработку имени, телефона и сообщения для ответа
                    на заявку.
                  </span>
                </label>
                <ErrorBox>{error}</ErrorBox>
                <Submit busy={busy}>
                  Отправить заявку <ArrowRight size={17} />
                </Submit>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
function App() {
  const route = useRoute();
  const [catalog, setCatalog] = useState({ doctors: [], services: [] }),
    [catalogError, setCatalogError] = useState(""),
    [user, setUser] = useState(null),
    [auth, setAuth] = useState(false),
    [booking, setBooking] = useState(null),
    [detail, setDetail] = useState(null),
    [cancel, setCancel] = useState(null),
    [cancelError, setCancelError] = useState(""),
    [cancelBusy, setCancelBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [menu, setMenu] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [backendError, setBackendError] = useState("");
  useEffect(() => {
    api("catalog")
      .then(setCatalog)
      .catch((e) => setCatalogError(e.message));
    api("auth/me")
      .then((d) => setUser(d.user))
      .catch(() =>
        setBackendError(
          "Онлайн-запись сейчас недоступна. Попробуйте зайти позже.",
        ),
      );
  }, []);
  useEffect(() => {
    setMenu(false);
    const names = {
      "/": "Забота, которая рядом",
      "/doctors": "Врачи",
      "/services": "Услуги",
      "/contacts": "Контакты",
      "/cabinet": "Личный кабинет",
      "/admin": "Панель клиники",
    };
    document.title = (names[route] || "Страница не найдена") + " — Линия";
  }, [route]);
  function book(initial) {
    if (!catalog.services.length) return;
    setBooking(initial);
    setDetail(null);
  }
  async function logout() {
    try {
      await api("auth/logout", { method: "POST", body: {} });
      setUser(null);
      setRevision((n) => n + 1);
    } catch (e) {
      setBackendError(e.message);
    }
  }
  async function doCancel() {
    setCancelBusy(true);
    setCancelError("");
    try {
      await api((cancel.admin ? "admin/" : "") + "appointments/" + cancel.id, {
        method: "PATCH",
        body: { action: "cancel" },
      });
      setRevision((n) => n + 1);
      setCancel(null);
    } catch (e) {
      setCancelError(e.message);
    } finally {
      setCancelBusy(false);
    }
  }
  const nav = [
    ["/services", "Услуги"],
    ["/doctors", "Врачи"],
    ["/contacts", "Контакты"],
  ];
  return (
    <>
      <a className="skip-link" href="#main-content" onClick={e=>{if(localDemo){e.preventDefault();document.getElementById("main-content").scrollIntoView();}}}>
        К содержимому
      </a>
      <div className="topline">
        <div className="container">
          <span>{localDemo ? "Локальное демо · данные в этом браузере" : "Демонстрационная клиника · тестовая запись"}</span>
          {localDemo ? <button className="text-button local-help" onClick={() => setPrivacy(true)}>Как попробовать</button> : <span className="topline-hours"><Clock3 size={13}/>Пн–сб, 09:00–18:00</span>}
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav
            className={menu ? "navigation open" : "navigation"}
            aria-label="Основная навигация"
          >
            {nav.map(([to, label]) => (
              <Link to={to} className={route === to ? "active" : ""} key={to}>
                {label}
              </Link>
            ))}
            {user && (
              <button
                className="text-button nav-logout"
                onClick={() => {
                  logout();
                  setMenu(false);
                }}
              >
                <LogOut size={17} />
                Выйти из кабинета
              </button>
            )}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link to="/cabinet" className="cabinet-link">
                  <UserRound size={19} />
                  <span>{user.name.split(" ")[0]}</span>
                </Link>
                <button
                  className="icon-button logout-button"
                  aria-label="Выйти из кабинета"
                  onClick={logout}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button className="cabinet-link" onClick={() => setAuth(true)}>
                <UserRound size={19} />
                <span>Личный кабинет</span>
              </button>
            )}
            <button
              className="button primary compact header-book"
              onClick={() => book({})}
            >
              Записаться <ArrowUpRight size={17} />
            </button>
            <button
              className="icon-button menu-button"
              aria-label={menu ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {backendError && (
        <div className="container">
          <ErrorBox>{backendError}</ErrorBox>
        </div>
      )}
      <div id="main-content">
        {catalogError ? (
          <main className="container page">
            <ErrorBox>{catalogError}</ErrorBox>
            <button
              className="button secondary"
              onClick={() => location.reload()}
            >
              Попробовать ещё раз
            </button>
          </main>
        ) : !catalog.services.length ? (
          <div className="container page loading-inline">
            <LoaderCircle className="spin" />
            Готовим всё к вашему визиту…
          </div>
        ) : route === "/" ? (
          <Home catalog={catalog} onBook={book} onDoctor={setDetail} />
        ) : route === "/services" ? (
          <Services catalog={catalog} onBook={book} />
        ) : route === "/doctors" ? (
          <Doctors catalog={catalog} onBook={book} onDoctor={setDetail} />
        ) : route === "/cabinet" ? (
          <Cabinet
            user={user}
            onAuth={() => setAuth(true)}
            onUser={setUser}
            onBook={book}
            revision={revision}
            onCancel={(a) => {
              setCancel(a);
              setCancelError("");
            }}
          />
        ) : route === "/admin" ? (
          <Admin
            user={user}
            onAuth={() => setAuth(true)}
            onCancel={(a) => {
              setCancel(a);
              setCancelError("");
            }}
            revision={revision}
          />
        ) : route === "/contacts" ? (
          <Contacts />
        ) : (
          <main className="container page">
            <Empty
              title="Кажется, вы свернули не туда"
              text="Такой страницы нет. Вернёмся на главную?"
            >
              <Link to="/" className="button primary">
                На главную
              </Link>
            </Empty>
          </main>
        )}
      </div>
      <footer className="footer">
        <div className="container footer-top">
          <div>
            <Brand light />
            <p>
              Когда забота —<br />
              не просто слово.
            </p>
          </div>
          <div className="footer-links">
            <span>КЛИНИКА</span>
            {nav.map(([to, label]) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
            <Link to="/cabinet">Кабинет пациента</Link>
          </div>
          <div className="footer-links">
            <span>МЫ РЯДОМ</span>
            <p>
              Пн–сб · 09:00–18:00
              <br />
              Запись онлайн — круглосуточно
            </p>
            <button className="text-button" onClick={() => book({})}>
              Выбрать время <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="footer-remark">
            <Leaf size={25} />
            <p>
              Ваши вопросы важны.
              <br />
              Найдём на них время.
            </p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Линия</span>
          <button className="text-button" onClick={() => setPrivacy(true)}>
            Как хранятся ваши данные
          </button>
          <span>Учебный проект. Врачи и цены приведены для примера.</span>
        </div>
      </footer>
      {booking && (
        <BookingModal
          initial={booking}
          catalog={catalog}
          user={user}
          onAuth={() => setAuth(true)}
          onClose={() => setBooking(null)}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
      {detail && (
        <Dialog
          title={detail.name}
          subtitle={detail.specialty}
          onClose={() => setDetail(null)}
        >
          <div className="doctor-detail">
            <img
              src={imagePath(detail.portrait + ".svg")}
              alt="Иллюстрация специалиста"
            />
            <div>
              <span className="status">{detail.experience} лет практики</span>
              <p>{detail.description}</p>
              <h3>Направления приёма</h3>
              <ul>
                {catalog.services
                  .filter((s) => detail.serviceIds.includes(s.id))
                  .map((s) => (
                    <li key={s.id}>
                      {s.name} · {money(s.price)}
                    </li>
                  ))}
              </ul>
              <button
                className="button primary"
                onClick={() =>
                  book({ doctorId: detail.id, serviceId: detail.serviceIds[0] })
                }
              >
                Выбрать время <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {cancel && (
        <Dialog
          title="Отменить запись?"
          subtitle="Время снова станет доступно другим пациентам."
          onClose={() => !cancelBusy && setCancel(null)}
        >
          <div className="booking-summary">
            <CalendarDays size={25} />
            <div>
              <h3>{cancel.service?.name}</h3>
              <p>
                {fullDate(cancel.starts_at)} в {time(cancel.starts_at)}
              </p>
            </div>
          </div>
          <ErrorBox>{cancelError}</ErrorBox>
          <div className="dialog-actions">
            <button
              disabled={cancelBusy}
              className="button secondary"
              onClick={() => setCancel(null)}
            >
              Оставить запись
            </button>
            <Submit busy={cancelBusy} onClick={doCancel}>
              Да, отменить
            </Submit>
          </div>
        </Dialog>
      )}
      {privacy && (
        <Dialog title="О ваших данных" onClose={() => setPrivacy(false)}>
          {localDemo ? <div className="privacy-copy">
            <p><strong>Это автономная демонстрация.</strong> Сайт открывается без сервера и интернета. Аккаунты, записи и заявки хранятся в IndexedDB этого браузера и не синхронизируются с другими устройствами.</p>
            <p>Для проверки зарегистрируйтесь с тестовыми данными, выберите врача и время, подтвердите запись. В кабинете можно перенести или отменить приём и скачать событие для календаря.</p>
            <p><strong>Посмотреть панель администратора:</strong><br/>Email: admin@local.test<br/>Пароль: ClinicDemo2026!</p>
            <p>Пароли локальных аккаунтов хешируются PBKDF2. Полная серверная версия проекта использует PostgreSQL/SQLite и защищённые cookie; этот HTML предназначен только для знакомства с интерфейсом. Не вводите реальные медицинские сведения.</p>
          </div> : (
          <div className="privacy-copy">
            <p>
              Для работы кабинета сохраняются имя, email, телефон и записи на
              приём. Пароли хранятся в виде хеша scrypt, сессия — в cookie с
              ограниченным сроком действия.
            </p>
            <p>
              Ваши записи доступны вам и администратору клиники. Другие пациенты
              видят только доступное время, без ваших персональных данных.
            </p>
            <p>
              В форме обратной связи сохраняются имя, телефон и сообщение. Не
              указывайте в ней диагнозы, результаты исследований и другую
              чувствительную медицинскую информацию.
            </p>
            <p>
              Это демонстрационный проект: запись не является обращением в
              действующую медицинскую организацию.
            </p>
          </div>
          )}
        </Dialog>
      )}
      {auth && (
        <AuthModal
          onClose={() => setAuth(false)}
          onLogin={(u) => {
            setUser(u);
            setBackendError("");
            setRevision((n) => n + 1);
          }}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
