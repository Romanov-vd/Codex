export const services = [
  {
    id: "therapy",
    name: "Приём терапевта",
    category: "Терапия",
    price: 2400,
    duration: 30,
    description:
      "Обсудим самочувствие, разберём симптомы и определим следующие шаги.",
    icon: "Stethoscope",
  },
  {
    id: "cardiology",
    name: "Приём кардиолога",
    category: "Кардиология",
    price: 3200,
    duration: 45,
    description: "Консультация по вопросам здоровья сердца и сосудов.",
    icon: "HeartPulse",
  },
  {
    id: "neurology",
    name: "Приём невролога",
    category: "Неврология",
    price: 3000,
    duration: 45,
    description:
      "Головная боль, сон, боли в спине и другие вопросы к неврологу.",
    icon: "Brain",
  },
  {
    id: "dermatology",
    name: "Приём дерматолога",
    category: "Дерматология",
    price: 2800,
    duration: 30,
    description:
      "Внимательный осмотр и индивидуальные рекомендации по здоровью кожи.",
    icon: "Sparkles",
  },
  {
    id: "ultrasound",
    name: "УЗИ органов брюшной полости",
    category: "Диагностика",
    price: 2900,
    duration: 30,
    description:
      "Исследование органов брюшной полости с заключением специалиста.",
    icon: "ScanLine",
  },
  {
    id: "checkup",
    name: "Профилактическая консультация",
    category: "Профилактика",
    price: 2600,
    duration: 45,
    description:
      "Составим персональный план профилактики с учётом возраста и истории здоровья.",
    icon: "ShieldCheck",
  },
];
export const doctors = [
  {
    id: "anna",
    name: "Анна Михайлова",
    specialty: "Терапевт",
    serviceIds: ["therapy", "checkup"],
    experience: 12,
    education: "Лечебное дело, терапия",
    description:
      "Помогает разобраться в симптомах и выстроить понятный план обследования.",
    color: "#e5ece5",
    portrait: "anna",
  },
  {
    id: "mikhail",
    name: "Михаил Орлов",
    specialty: "Кардиолог",
    serviceIds: ["cardiology"],
    experience: 16,
    education: "Лечебное дело, кардиология",
    description:
      "Объясняет сложное простыми словами и внимательно относится к вашим вопросам.",
    color: "#efe4da",
    portrait: "mikhail",
  },
  {
    id: "elena",
    name: "Елена Соколова",
    specialty: "Невролог",
    serviceIds: ["neurology"],
    experience: 10,
    education: "Лечебное дело, неврология",
    description: "Работает с головной болью, нарушениями сна и болями в спине.",
    color: "#e5e8ed",
    portrait: "elena",
  },
  {
    id: "daria",
    name: "Дарья Белова",
    specialty: "Дерматолог",
    serviceIds: ["dermatology"],
    experience: 9,
    education: "Лечебное дело, дерматовенерология",
    description: "Помогает подобрать последовательный подход к здоровью кожи.",
    color: "#f0e5df",
    portrait: "daria",
  },
  {
    id: "pavel",
    name: "Павел Лебедев",
    specialty: "Врач ультразвуковой диагностики",
    serviceIds: ["ultrasound"],
    experience: 14,
    education: "Лечебное дело, ультразвуковая диагностика",
    description:
      "Проводит исследования и подробно объясняет, как подготовиться к процедуре.",
    color: "#e5eae2",
    portrait: "pavel",
  },
];
export function moscowDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function dayAfter(offset) {
  return moscowDate(new Date(Date.now() + offset * 86400000));
}
export function slotsFor(doctorId, date) {
  if (
    !doctors.some((d) => d.id === doctorId) ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return [];
  const stamp = new Date(date + "T12:00:00+03:00");
  if (
    Number.isNaN(stamp.valueOf()) ||
    moscowDate(stamp) !== date ||
    date < dayAfter(0) ||
    date > dayAfter(30) ||
    stamp.getUTCDay() === 0
  )
    return [];
  return [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ]
    .map((time) => `${date}T${time}:00+03:00`)
    .filter((time) => Date.parse(time) > Date.now() + 3600000);
}
