import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CalendarCheck,
  CreditCard,
  Sparkles,
  MessageSquare,
  FileText,
  Receipt,
  Building2,
  UserRound,
  Users,
  ChevronDown,
  ArrowRight,
  Check,
  Wifi,
  Battery,
  Signal,
  QrCode,
  Plus,
  Apple,
  Play,
} from "lucide-react";
import logoFull from "@/assets/fitengine-logo-full.png";
import logoIso from "@/assets/fitengine-iso.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitEngine — Todo tu gym en una sola app" },
      {
        name: "description",
        content:
          "Reservas con cupo, planes y abonos, rutinas, chat con coaches y cobros automáticos sin fricción. Para gimnasios, coaches y atletas. Hecho desde LATAM, con vista global.",
      },
      { property: "og:title", content: "FitEngine — Todo tu gym en una sola app" },
      {
        property: "og:description",
        content:
          "Plataforma all-in-one para gimnasios y coaches: reservas, cobros, rutinas y chat.",
      },
    ],
  }),
  component: Landing,
});

/* ---------- Constants ---------- */
const SIGNUP_URL = "https://app.fitengine.app/signup?trial=14d";

/* ---------- i18n ---------- */
type Locale = "es" | "en" | "pt";

type Dict = {
  nav: { problema: string; solucion: string; paraQuien: string; como: string; faq: string; cta: string };
  hero: {
    badge: string;
    title1: string;
    title2: string;
    subtitle: string;
    storeNote: string;
    cta1: string;
    cta2: string;
    bullets: [string, string, string];
    storeApple: { line1: string; line2: string };
    storeGoogle: { line1: string; line2: string };
  };
  strip: string;
  problema: { title: string; subtitle: string; cards: { t: string; d: string }[] };
  solucion: { title: string; subtitle: string; features: { t: string; d: string }[] };
  paraQuien: {
    title: string;
    subtitle: string;
    roles: { t: string; items: string[] }[];
  };
  como: {
    title: string;
    subtitle: string;
    steps: { t: string; d: string }[];
    stepLabel: string;
    cta: string;
  };
  faq: { title: string; subtitle: string; qa: { q: string; a: string }[] };
  footer: {
    tagline: string;
    cols: { h: string; links: string[] }[];
    contact: string;
    city: string;
    copyright: string;
    end: string;
  };
};

const dicts: Record<Locale, Dict> = {
  es: {
    nav: { problema: "Problema", solucion: "Solución", paraQuien: "Para quién", como: "Cómo empezás", faq: "FAQ", cta: "Probar gratis" },
    hero: {
      badge: "En piloto en LATAM",
      title1: "Todo tu gym",
      title2: "en una sola app.",
      subtitle:
        "Reservas con cupo, planes y abonos, rutinas, chat con coaches y cobros automáticos sin fricción. Para gimnasios, coaches y atletas. Hecho desde LATAM, con vista global.",
      storeNote: "Compatible con Mercado Pago y Stripe.",
      cta1: "Probar gratis",
      cta2: "Ver cómo funciona",
      bullets: ["Sin tarjeta para empezar", "Tu marca, no la nuestra", "Soporte humano"],
      storeApple: { line1: "Próximamente en", line2: "App Store" },
      storeGoogle: { line1: "Próximamente en", line2: "Google Play" },
    },
    strip: "EN PILOTO CON GIMNASIOS Y COACHES DE LATAM",
    problema: {
      title: "Llevar un gym hoy es más complicado de lo que tendría que ser.",
      subtitle: "Si sos dueño de un gym o coach, esto te va a sonar familiar.",
      cards: [
        { t: "WhatsApp y planillas", d: "Reservas por chat, listas en papel y Excels que nadie actualiza. Cada clase es un dolor de cabeza." },
        { t: "Cobros desordenados", d: "Transferencias sueltas, recordatorios manuales y clientes que se atrasan sin que te enteres a tiempo." },
        { t: "Rutinas en PDFs sueltos", d: "Planes que se pierden en Drive, sin progresión clara y sin manera fácil de hacer seguimiento." },
      ],
    },
    solucion: {
      title: "FitEngine pone todo en su lugar.",
      subtitle: "Una sola plataforma que reemplaza cinco herramientas distintas.",
      features: [
        { t: "Reservas con cupo y waitlist", d: "Tus clientes reservan desde el celu. Cupo, lista de espera y check-in automáticos." },
        { t: "Cobros automáticos", d: "Abonos automáticos, recordatorios y comprobantes. La plata cae directo a tu cuenta." },
        { t: "IA que te ayuda a operar", d: "Sugiere horarios, detecta morosos y arma resúmenes para que decidas más rápido." },
        { t: "Chat por plan", d: "Conversación 1 a 1 entre coach y cliente, integrada al plan y a las rutinas." },
      ],
    },
    paraQuien: {
      title: "Pensado para los tres lados del gym.",
      subtitle: "Una herramienta distinta para cada rol, pero en el mismo lugar.",
      roles: [
        { t: "Para gimnasios", items: ["Reservas con cupo y waitlist por clase", "Cobro de abonos con Mercado Pago o Stripe", "Panel de morosidad y proyección de ingresos", "Branding propio: logo, colores y dominio", "Roles para staff, coaches y recepción", "Reportes de ocupación y retención"] },
        { t: "Para coaches", items: ["Asignás rutinas y planes en pocos clics", "Chat por plan con cada atleta", "Seguimiento de progreso y asistencia", "Cobrás abonos sin pasar por terceros", "Funciona también si entrenás online", "IA que te ayuda a armar progresiones"] },
        { t: "Para clientes", items: ["Reservás clases desde el celular", "Ves tu rutina y la marcás al toque", "Chateás con tu coach cuando lo necesitás", "Pagás tu abono sin vueltas", "Recibís recordatorios automáticos", "Una sola app, no cinco grupos de WhatsApp"] },
      ],
    },
    como: {
      title: "Empezar es simple.",
      subtitle: "Tres pasos. Sin instalación, sin contratos.",
      stepLabel: "PASO",
      steps: [
        { t: "Creá tu espacio", d: "Te registrás como gym o coach. Cargás tu logo, color de acento y nombre. Tu app va a tener tu identidad visual." },
        { t: "Cargás tus planes", d: "Definís qué actividades ofrecés (cross, funcional, yoga, lo que sea), con cupos, horarios y precios. La IA te ayuda a configurarlo." },
        { t: "Invitás a tus clientes", d: "Generás un código de invitación o un link. Tus clientes entran a tu gym desde la app y empiezan a usarlo." },
      ],
      cta: "Probar gratis",
    },
    faq: {
      title: "Preguntas frecuentes",
      subtitle: "Lo que más nos preguntan dueños de gym y coaches.",
      qa: [
        { q: "¿Cómo funciona el cobro?", a: "Conectás tu cuenta de Mercado Pago o Stripe en un par de clics y los abonos de tus clientes se cobran automáticamente, con comprobante y recordatorio si algo falla. La plata cae directo a tu cuenta — FitEngine no toca el dinero." },
        { q: "¿En qué dispositivos puedo usar FitEngine?", a: "Tus clientes lo usan desde el celular (iOS y Android vía web) y vos administrás desde la compu o tu teléfono. Próximamente vamos a estar en App Store y Google Play." },
        { q: "¿Cómo funciona la prueba gratis?", a: "Tenés 14 días gratis para probar FitEngine con todas las funciones. No pedimos tarjeta de crédito para empezar. A los 14 días te avisamos por email y decidís si seguís con el plan pago o das de baja. Podés exportar tus datos o borrarlos en cualquier momento." },
        { q: "¿Puedo poner mi marca y los colores de mi gym?", a: "Sí. Cada espacio en FitEngine tiene su nombre, logo y branding propio. Tus clientes ven tu marca, no la nuestra." },
        { q: "¿Sirve para coaches que entrenan online?", a: "Totalmente. Coaches independientes usan FitEngine para mandar rutinas, chatear con sus atletas, cobrar abonos y llevar el seguimiento, sin necesidad de tener un local." },
        { q: "¿Qué pasa con la seguridad de los datos de mis clientes?", a: "Tus datos y los de tus clientes son tuyos. Usamos infraestructura cifrada, accesos por rol y nunca compartimos información con terceros. Podés exportar todo cuando quieras." },
        
      ],
    },
    footer: {
      tagline: "La plataforma all-in-one para gimnasios y coaches. Hecha con vista global.",
      cols: [
        { h: "Producto", links: ["Reservas", "Cobros", "Rutinas", "Chat"] },
        { h: "Empresa", links: ["Nosotros", "Blog", "Piloto"] },
        { h: "Legal", links: ["Términos", "Privacidad", "Cookies"] },
      ],
      contact: "Contacto",
      city: "Buenos Aires, Argentina",
      copyright: "© 2026 FitEngine. Hecho en Argentina.",
      end: "Hecho con cariño desde Argentina, para gyms del mundo.",
    },
  },
  en: {
    nav: { problema: "Problem", solucion: "Solution", paraQuien: "Who it's for", como: "Getting started", faq: "FAQ", cta: "Try it free" },
    hero: {
      badge: "In pilot in LATAM",
      title1: "Your whole gym",
      title2: "in a single app.",
      subtitle:
        "Bookings with capacity, plans and memberships, workouts, coach chat and automatic payments without friction. For gyms, coaches and athletes. Built in LATAM, with a global view.",
      storeNote: "Works with Mercado Pago and Stripe.",
      cta1: "Try it free",
      cta2: "See how it works",
      bullets: ["No card to start", "Your brand, not ours", "Human support"],
      storeApple: { line1: "Coming soon to", line2: "App Store" },
      storeGoogle: { line1: "Coming soon to", line2: "Google Play" },
    },
    strip: "IN PILOT WITH GYMS AND COACHES ACROSS LATAM",
    problema: {
      title: "Running a gym today is harder than it should be.",
      subtitle: "If you own a gym or work as a coach, this will sound familiar.",
      cards: [
        { t: "WhatsApp and spreadsheets", d: "Bookings by chat, paper lists and Excel sheets no one updates. Every class is a headache." },
        { t: "Messy payments", d: "Random transfers, manual reminders, and clients falling behind without you noticing in time." },
        { t: "Workouts in scattered PDFs", d: "Plans lost in Drive, without clear progression and no easy way to track progress." },
      ],
    },
    solucion: {
      title: "FitEngine puts everything in one place.",
      subtitle: "A single platform that replaces five different tools.",
      features: [
        { t: "Bookings with capacity and waitlist", d: "Clients book from their phone. Capacity, waitlist and check-in are automatic." },
        { t: "Automatic payments", d: "Recurring dues, reminders and receipts. Money lands directly in your account." },
        { t: "AI that helps you operate", d: "Suggests schedules, flags late payers and builds summaries so you decide faster." },
        { t: "Chat per plan", d: "1-to-1 chat between coach and client, tied to the plan and workouts." },
      ],
    },
    paraQuien: {
      title: "Built for the three sides of the gym.",
      subtitle: "A different tool for each role, all in one place.",
      roles: [
        { t: "For gyms", items: ["Bookings with capacity and waitlist per class", "Collect dues with Mercado Pago or Stripe", "Late-payment panel and revenue forecast", "Own branding: logo, colors and domain", "Roles for staff, coaches and front desk", "Occupancy and retention reports"] },
        { t: "For coaches", items: ["Assign workouts and plans in a few clicks", "Chat per plan with each athlete", "Track progress and attendance", "Charge dues without third parties", "Works if you coach online too", "AI that helps build progressions"] },
        { t: "For clients", items: ["Book classes from your phone", "See your workout and mark it off instantly", "Chat with your coach when you need to", "Pay your dues with no back and forth", "Get automatic reminders", "One app, not five WhatsApp groups"] },
      ],
    },
    como: {
      title: "Getting started is simple.",
      subtitle: "Three steps. No install, no contracts.",
      stepLabel: "STEP",
      steps: [
        { t: "Create your space", d: "Sign up as a gym or coach. Upload your logo, accent color and name. Your app will have your identity." },
        { t: "Load your plans", d: "Define what you offer (cross, functional, yoga, whatever it is), with capacity, schedules and prices. The AI helps you set it up." },
        { t: "Invite your clients", d: "Generate an invite code or a link. Your clients join your gym from the app and start using it." },
      ],
      cta: "Try it free",
    },
    faq: {
      title: "Frequently asked questions",
      subtitle: "The questions gym owners and coaches ask us the most.",
      qa: [
        { q: "How do payments work?", a: "You connect your Mercado Pago or Stripe account in a couple of clicks and your clients' dues are charged automatically, with receipts and reminders if something fails. Money lands directly in your account — FitEngine never touches it." },
        { q: "What devices can I use FitEngine on?", a: "Your clients use it on their phone (iOS and Android via web) and you manage it from your computer or phone. Coming soon to App Store and Google Play." },
        { q: "How does the free trial work?", a: "You get 14 days free to try FitEngine with all features. No credit card required to start. After 14 days we email you and you decide whether to continue with a paid plan or cancel. You can export or delete your data any time." },
        { q: "Can I use my gym's branding and colors?", a: "Yes. Every space in FitEngine has its own name, logo and branding. Your clients see your brand, not ours." },
        { q: "Does it work for online coaches?", a: "Absolutely. Independent coaches use FitEngine to send workouts, chat with their athletes, charge dues and track progress, without needing a physical location." },
        { q: "What about the security of my clients' data?", a: "Your data and your clients' data belong to you. We use encrypted infrastructure, role-based access and never share information with third parties. You can export everything whenever you want." },
        
      ],
    },
    footer: {
      tagline: "The all-in-one platform for gyms and coaches. Built with a global view.",
      cols: [
        { h: "Product", links: ["Bookings", "Payments", "Workouts", "Chat"] },
        { h: "Company", links: ["About", "Blog", "Pilot"] },
        { h: "Legal", links: ["Terms", "Privacy", "Cookies"] },
      ],
      contact: "Contact",
      city: "Buenos Aires, Argentina",
      copyright: "© 2026 FitEngine. Made in Argentina.",
      end: "Made with care from Argentina, for gyms around the world.",
    },
  },
  pt: {
    nav: { problema: "Problema", solucion: "Solução", paraQuien: "Para quem", como: "Como começar", faq: "FAQ", cta: "Testar grátis" },
    hero: {
      badge: "Em piloto na LATAM",
      title1: "Toda a sua academia",
      title2: "em um só app.",
      subtitle:
        "Reservas com vagas, planos e mensalidades, treinos, chat com coaches e cobranças automáticas sem fricção. Para academias, coaches e atletas. Feito na LATAM, com visão global.",
      storeNote: "Compatível com Mercado Pago e Stripe.",
      cta1: "Testar grátis",
      cta2: "Ver como funciona",
      bullets: ["Sem cartão para começar", "Sua marca, não a nossa", "Suporte humano"],
      storeApple: { line1: "Em breve na", line2: "App Store" },
      storeGoogle: { line1: "Em breve no", line2: "Google Play" },
    },
    strip: "EM PILOTO COM ACADEMIAS E COACHES DA LATAM",
    problema: {
      title: "Gerir uma academia hoje é mais complicado do que deveria.",
      subtitle: "Se você tem uma academia ou é coach, isto vai soar familiar.",
      cards: [
        { t: "WhatsApp e planilhas", d: "Reservas por chat, listas no papel e Excels que ninguém atualiza. Cada aula é uma dor de cabeça." },
        { t: "Cobranças desorganizadas", d: "Transferências avulsas, lembretes manuais e clientes atrasados sem você perceber a tempo." },
        { t: "Treinos em PDFs soltos", d: "Planos perdidos no Drive, sem progressão clara e sem como acompanhar direito." },
      ],
    },
    solucion: {
      title: "O FitEngine coloca tudo no lugar.",
      subtitle: "Uma única plataforma que substitui cinco ferramentas.",
      features: [
        { t: "Reservas com vagas e lista de espera", d: "Seus clientes reservam do celular. Vagas, lista de espera e check-in automáticos." },
        { t: "Cobranças automáticas", d: "Mensalidades automáticas, lembretes e comprovantes. O dinheiro cai direto na sua conta." },
        { t: "IA que ajuda a operar", d: "Sugere horários, detecta inadimplentes e monta resumos para você decidir mais rápido." },
        { t: "Chat por plano", d: "Conversa 1 a 1 entre coach e cliente, integrada ao plano e aos treinos." },
      ],
    },
    paraQuien: {
      title: "Pensado para os três lados da academia.",
      subtitle: "Uma ferramenta diferente para cada papel, no mesmo lugar.",
      roles: [
        { t: "Para academias", items: ["Reservas com vagas e lista de espera por aula", "Cobrança de mensalidades com Mercado Pago ou Stripe", "Painel de inadimplência e projeção de receita", "Branding próprio: logo, cores e domínio", "Papéis para equipe, coaches e recepção", "Relatórios de ocupação e retenção"] },
        { t: "Para coaches", items: ["Você atribui treinos e planos em poucos cliques", "Chat por plano com cada atleta", "Acompanhamento de progresso e frequência", "Você cobra mensalidades sem intermediários", "Funciona também se você treina online", "IA que ajuda a montar progressões"] },
        { t: "Para clientes", items: ["Reserva aulas pelo celular", "Vê seu treino e marca na hora", "Fala com seu coach quando precisa", "Paga sua mensalidade sem enrolação", "Recebe lembretes automáticos", "Um só app, não cinco grupos de WhatsApp"] },
      ],
    },
    como: {
      title: "Começar é simples.",
      subtitle: "Três passos. Sem instalação, sem contratos.",
      stepLabel: "PASSO",
      steps: [
        { t: "Crie seu espaço", d: "Você se cadastra como academia ou coach. Sobe seu logo, cor de destaque e nome. Seu app fica com a sua identidade." },
        { t: "Carrega seus planos", d: "Define o que oferece (cross, funcional, yoga, o que for), com vagas, horários e preços. A IA te ajuda a configurar." },
        { t: "Convida seus clientes", d: "Gera um código de convite ou um link. Seus clientes entram na sua academia pelo app e começam a usar." },
      ],
      cta: "Testar grátis",
    },
    faq: {
      title: "Perguntas frequentes",
      subtitle: "O que donos de academia e coaches mais nos perguntam.",
      qa: [
        { q: "Como funciona a cobrança?", a: "Você conecta sua conta do Mercado Pago ou Stripe em alguns cliques e as mensalidades dos seus clientes são cobradas automaticamente, com comprovante e lembrete se algo falhar. O dinheiro cai direto na sua conta — o FitEngine não toca no valor." },
        { q: "Em quais dispositivos posso usar o FitEngine?", a: "Seus clientes usam pelo celular (iOS e Android via web) e você administra pelo computador ou celular. Em breve na App Store e Google Play." },
        { q: "Como funciona o teste grátis?", a: "Você tem 14 dias grátis para testar o FitEngine com todas as funções. Não pedimos cartão de crédito para começar. Ao final dos 14 dias avisamos por e-mail e você decide se segue no plano pago ou cancela. Pode exportar ou apagar seus dados quando quiser." },
        { q: "Posso colocar a marca e as cores da minha academia?", a: "Sim. Cada espaço no FitEngine tem seu nome, logo e branding próprios. Seus clientes veem a sua marca, não a nossa." },
        { q: "Serve para coaches que treinam online?", a: "Totalmente. Coaches independentes usam o FitEngine para enviar treinos, conversar com seus atletas, cobrar mensalidades e acompanhar tudo, sem precisar de um local físico." },
        { q: "E a segurança dos dados dos meus clientes?", a: "Seus dados e os dos seus clientes são seus. Usamos infraestrutura criptografada, acesso por papel e nunca compartilhamos informação com terceiros. Você exporta tudo quando quiser." },
        
      ],
    },
    footer: {
      tagline: "A plataforma all-in-one para academias e coaches. Feita com visão global.",
      cols: [
        { h: "Produto", links: ["Reservas", "Cobranças", "Treinos", "Chat"] },
        { h: "Empresa", links: ["Sobre nós", "Blog", "Piloto"] },
        { h: "Legal", links: ["Termos", "Privacidade", "Cookies"] },
      ],
      contact: "Contato",
      city: "Buenos Aires, Argentina",
      copyright: "© 2026 FitEngine. Feito na Argentina.",
      end: "Feito com carinho na Argentina, para academias do mundo todo.",
    },
  },
};

const LocaleCtx = createContext<{ locale: Locale; t: Dict }>({ locale: "es", t: dicts.es });
const useT = () => useContext(LocaleCtx).t;

/* ---------- Reveal on scroll ---------- */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 700ms ease-out ${delay}ms, transform 700ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Building blocks ---------- */
function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-6 transition-colors hover:border-[rgba(134,196,199,0.32)] ${className}`}
      style={{
        background: "rgba(134,196,199,0.06)",
        border: "1px solid rgba(134,196,199,0.16)",
      }}
    >
      {children}
    </div>
  );
}

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px]"
      style={{
        background: "rgba(134,196,199,0.12)",
        border: "1px solid rgba(134,196,199,0.22)",
        color: "#86C4C7",
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  href = SIGNUP_URL,
  external = true,
}: {
  children: ReactNode;
  href?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold transition-all hover:brightness-110"
      style={{
        background: "#86C4C7",
        color: "#050a0d",
        boxShadow: "0 0 0 1px rgba(134,196,199,0.4), 0 10px 30px -12px rgba(134,196,199,0.45)",
      }}
    >
      {children}
    </a>
  );
}

function GhostButton({ children, href = "#como" }: { children: ReactNode; href?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold transition-colors hover:bg-[rgba(134,196,199,0.08)]"
      style={{
        color: "#f4f8f9",
        border: "1px solid rgba(134,196,199,0.25)",
      }}
    >
      {children}
    </a>
  );
}

/* ---------- Store badges ---------- */
function StoreButton({
  icon,
  line1,
  line2,
  href = "#",
}: {
  icon: ReactNode;
  line1: string;
  line2: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 transition-colors hover:bg-black"
      style={{
        background: "#000",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#fff",
      }}
    >
      <span style={{ color: "#fff" }}>{icon}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[9px] opacity-80">{line1}</span>
        <span className="text-[14px] font-semibold tracking-tight">{line2}</span>
      </span>
    </a>
  );
}

/* ---------- Language selector ---------- */
function LanguageSwitcher({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
}) {
  const langs: Locale[] = ["es", "en", "pt"];
  return (
    <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wider">
      {langs.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          <button
            onClick={() => setLocale(l)}
            className="uppercase transition-colors"
            style={{
              color: l === locale ? "#86C4C7" : "#9A9D9F",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (l !== locale) (e.currentTarget as HTMLButtonElement).style.color = "#86C4C7";
            }}
            onMouseLeave={(e) => {
              if (l !== locale) (e.currentTarget as HTMLButtonElement).style.color = "#9A9D9F";
            }}
          >
            {l}
          </button>
          {i < langs.length - 1 && <span style={{ color: "rgba(154,157,159,0.4)" }}>|</span>}
        </span>
      ))}
    </div>
  );
}

/* ---------- Subtle dotted background pattern ---------- */
function DotPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "radial-gradient(rgba(134,196,199,0.09) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
        maskImage:
          "radial-gradient(ellipse at center, black 35%, transparent 80%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, black 35%, transparent 80%)",
      }}
    />
  );
}

/* ---------- Real FitEngine isotype (decorative) ---------- */
function BrandIsotype({
  size = 80,
  opacity = 0.3,
  className = "",
  style = {},
}: {
  size?: number;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      aria-hidden
      src={logoIso}
      alt=""
      className={className}
      style={{ width: size, height: "auto", opacity, ...style }}
    />
  );
}

function TriangleDivider() {
  return (
    <div aria-hidden className="flex justify-center py-1">
      <BrandIsotype size={24} opacity={0.42} />
    </div>
  );
}

/* ---------- Phone frame ---------- */
function PhoneFrame({ children, rotate = 0 }: { children: ReactNode; rotate?: number }) {
  return (
    <div
      className="relative mx-auto w-[280px] rounded-[42px] p-2.5"
      style={{
        background: "linear-gradient(180deg,#0c1418 0%,#070d10 100%)",
        border: "1px solid rgba(134,196,199,0.22)",
        boxShadow:
          "0 50px 120px -20px rgba(0,0,0,0.75), 0 0 0 8px #0a1115, 0 0 60px -10px rgba(134,196,199,0.15)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        className="overflow-hidden rounded-[32px]"
        style={{ background: "#050a0d", border: "1px solid rgba(134,196,199,0.12)" }}
      >
        <div className="flex justify-center pt-2">
          <div className="h-4 w-20 rounded-full" style={{ background: "#000" }} />
        </div>
        <div className="flex items-center justify-between px-5 pt-1 text-[10px]" style={{ color: "#9A9D9F" }}>
          <span className="font-semibold">9:41</span>
          <div className="flex items-center gap-1">
            <Signal size={10} />
            <Wifi size={10} />
            <Battery size={12} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function HeroPhoneMockup() {
  return (
    <PhoneFrame rotate={8}>
      <div className="px-5 pt-4 pb-5">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>
          Buenas tardes,
        </p>
        <h4 className="mt-0.5 text-[20px] font-semibold text-[#f4f8f9]">Rodrigo</h4>

        <div
          className="mt-4 rounded-[12px] p-3"
          style={{ background: "rgba(134,196,199,0.10)", border: "1px solid rgba(134,196,199,0.24)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Plan activo</p>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "rgba(134,196,199,0.22)", color: "#86C4C7" }}>OLY</span>
          </div>
          <p className="mt-1 text-[15px] font-bold text-[#f4f8f9]">Olympic Lifting</p>
          <p className="mt-0.5 text-[11px]" style={{ color: "#9A9D9F" }}>Vence el 30/07</p>
        </div>

        <div
          className="mt-3 rounded-[12px] p-3"
          style={{ background: "rgba(134,196,199,0.06)", border: "1px solid rgba(134,196,199,0.16)" }}
        >
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Próxima reserva</p>
          <div className="mt-1 flex items-end justify-between">
            <p className="text-[16px] font-bold text-[#f4f8f9]">18:30</p>
            <span className="text-[12px]" style={{ color: "#86C4C7" }}>Cross Training</span>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "#9A9D9F" }}>Coach Tomás · Box principal</p>
        </div>

        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] py-2.5 text-[13px] font-semibold"
          style={{ background: "#86C4C7", color: "#050a0d" }}
        >
          Trabajo de hoy <ArrowRight size={14} />
        </button>
      </div>
    </PhoneFrame>
  );
}

function AdminMockup() {
  return (
    <div
      className="w-full overflow-hidden rounded-[14px]"
      style={{
        background: "linear-gradient(180deg,#0c1418 0%,#070d10 100%)",
        border: "1px solid rgba(134,196,199,0.22)",
        boxShadow: "0 40px 100px -30px rgba(0,0,0,0.7)",
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(134,196,199,0.12)" }}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2a3438" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2a3438" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2a3438" }} />
        <span className="ml-3 text-[11px]" style={{ color: "#9A9D9F" }}>fitengine.app / panel</span>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px]" style={{ color: "#9A9D9F" }}>Martes, 30 de junio</p>
            <h4 className="text-[16px] font-semibold text-[#f4f8f9]">Resumen del día</h4>
          </div>
          <div className="rounded-[8px] px-3 py-1.5 text-[11px] font-semibold" style={{ background: "#86C4C7", color: "#050a0d" }}>
            Ver detalle
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { l: "Reservas", v: "18" },
            { l: "Cobrado hoy", v: "$ 45.000" },
            { l: "Cobros pendientes", v: "3" },
            { l: "Asistencia", v: "92%" },
          ].map((s) => (
            <div key={s.l} className="rounded-[10px] px-3 py-2.5" style={{ background: "rgba(134,196,199,0.06)", border: "1px solid rgba(134,196,199,0.14)" }}>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>{s.l}</p>
              <p className="mt-1 text-[18px] font-semibold text-[#f4f8f9]">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Próximas clases</p>
          <div className="mt-2 overflow-hidden rounded-[10px]" style={{ border: "1px solid rgba(134,196,199,0.14)" }}>
            {[
              { t: "17:00", n: "Funcional", c: "Coach Lu", k: "9/12" },
              { t: "18:30", n: "Cross Training", c: "Coach Tomás", k: "11/12" },
              { t: "20:00", n: "Mobility", c: "Coach Sofi", k: "5/8" },
            ].map((r, i) => (
              <div key={r.t} className="grid grid-cols-[60px_1fr_1fr_60px] items-center px-3 py-2.5 text-[12px]" style={{ borderTop: i === 0 ? "none" : "1px solid rgba(134,196,199,0.10)", color: "#f4f8f9" }}>
                <span style={{ color: "#86C4C7" }}>{r.t}</span>
                <span>{r.n}</span>
                <span style={{ color: "#9A9D9F" }}>{r.c}</span>
                <span className="text-right" style={{ color: "#9A9D9F" }}>{r.k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMockup({ role }: { role: "admin" | "coach" | "client" }) {
  if (role === "admin") {
    return (
      <div className="rounded-[10px] p-3" style={{ background: "#070d10", border: "1px solid rgba(134,196,199,0.14)" }}>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Panel admin</p>
        <p className="mt-0.5 text-[12px] font-semibold text-[#f4f8f9]">Resumen del día</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[{ l: "Reservas", v: "18" }, { l: "Cobrado", v: "$45k" }, { l: "Ocup.", v: "92%" }].map((s) => (
            <div key={s.l} className="rounded-[6px] px-2 py-1.5" style={{ background: "rgba(134,196,199,0.08)" }}>
              <p className="text-[8px]" style={{ color: "#9A9D9F" }}>{s.l}</p>
              <p className="text-[11px] font-semibold" style={{ color: "#86C4C7" }}>{s.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          {[["17:00", "Funcional", "9/12"], ["18:30", "Cross", "11/12"]].map(([t, n, k]) => (
            <div key={t} className="flex items-center justify-between rounded-[6px] px-2 py-1 text-[10px]" style={{ background: "rgba(134,196,199,0.05)" }}>
              <span style={{ color: "#86C4C7" }}>{t}</span>
              <span style={{ color: "#f4f8f9" }}>{n}</span>
              <span style={{ color: "#9A9D9F" }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (role === "coach") {
    return (
      <div className="rounded-[10px] p-3" style={{ background: "#070d10", border: "1px solid rgba(134,196,199,0.14)" }}>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Coach · Plan OLY</p>
        <p className="mt-0.5 text-[12px] font-semibold text-[#f4f8f9]">Semana 3 — Fuerza</p>
        <div className="mt-2 space-y-1.5">
          {[["A1", "Sentadilla 5x3"], ["A2", "Pausa 3s"], ["B1", "Tirón 4x2"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-[10px]" style={{ background: "rgba(134,196,199,0.06)" }}>
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "rgba(134,196,199,0.18)", color: "#86C4C7" }}>{k}</span>
              <span style={{ color: "#f4f8f9" }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-[6px] px-2 py-1.5 text-[10px]" style={{ background: "rgba(134,196,199,0.08)", color: "#9A9D9F" }}>
          Asignado a <span style={{ color: "#86C4C7" }}>14 alumnos</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[10px] p-3" style={{ background: "#070d10", border: "1px solid rgba(134,196,199,0.14)" }}>
      <p className="text-[9px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Mi semana</p>
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-[5px] text-[9px] font-semibold" style={{ background: i === 1 ? "#86C4C7" : "rgba(134,196,199,0.06)", color: i === 1 ? "#050a0d" : "#9A9D9F" }}>
            {d}
          </div>
        ))}
      </div>
      <div className="mt-2.5 rounded-[6px] p-2" style={{ background: "rgba(134,196,199,0.08)", border: "1px solid rgba(134,196,199,0.18)" }}>
        <p className="text-[9px]" style={{ color: "#9A9D9F" }}>Trabajo de hoy</p>
        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "#86C4C7" }}>Cross Training · 18:30</p>
      </div>
      <button className="mt-2 w-full rounded-[6px] py-1.5 text-[10px] font-semibold" style={{ background: "#86C4C7", color: "#050a0d" }}>
        Ver rutina
      </button>
    </div>
  );
}

function StepFormMockup() {
  return (
    <div className="rounded-[10px] p-3" style={{ background: "#070d10", border: "1px solid rgba(134,196,199,0.14)" }}>
      <p className="text-[9px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Creá tu espacio</p>
      <div className="mt-2 space-y-2">
        {[["Nombre", "Mi Box CrossFit"], ["Tipo", "Gimnasio"], ["Color acento", ""]].map(([l, v], i) => (
          <div key={l}>
            <p className="text-[9px]" style={{ color: "#9A9D9F" }}>{l}</p>
            <div className="mt-0.5 flex items-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[10px]" style={{ background: "rgba(134,196,199,0.05)", border: "1px solid rgba(134,196,199,0.14)", color: "#f4f8f9" }}>
              {i === 2 ? (<><span className="h-3 w-3 rounded-full" style={{ background: "#86C4C7" }} /><span style={{ color: "#9A9D9F" }}>#86C4C7</span></>) : (v)}
            </div>
          </div>
        ))}
      </div>
      <button className="mt-3 w-full rounded-[6px] py-1.5 text-[10px] font-semibold" style={{ background: "#86C4C7", color: "#050a0d" }}>Crear espacio</button>
    </div>
  );
}

function StepPlansMockup() {
  return (
    <div className="rounded-[10px] p-3" style={{ background: "#070d10", border: "1px solid rgba(134,196,199,0.14)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Planes</p>
        <Plus size={11} style={{ color: "#86C4C7" }} />
      </div>
      <div className="mt-2 space-y-1.5">
        {[["Cross Training", "12 cupos", "$ 28.000"], ["Funcional", "10 cupos", "$ 22.000"], ["Yoga", "8 cupos", "$ 18.000"]].map(([n, c, p]) => (
          <div key={n} className="rounded-[6px] px-2 py-1.5" style={{ background: "rgba(134,196,199,0.06)", border: "1px solid rgba(134,196,199,0.12)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#f4f8f9]">{n}</p>
              <p className="text-[10px] font-semibold" style={{ color: "#86C4C7" }}>{p}</p>
            </div>
            <p className="text-[9px]" style={{ color: "#9A9D9F" }}>{c}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[9px]" style={{ background: "rgba(134,196,199,0.08)", color: "#86C4C7" }}>
        <Sparkles size={10} /> Sugerencias IA
      </div>
    </div>
  );
}

function StepInviteMockup() {
  return (
    <div className="rounded-[10px] p-3 text-center" style={{ background: "#070d10", border: "1px solid rgba(134,196,199,0.14)" }}>
      <p className="text-[9px] uppercase tracking-widest" style={{ color: "#9A9D9F" }}>Invitá a tus clientes</p>
      <div className="mx-auto mt-2 flex aspect-square w-24 items-center justify-center rounded-[8px]" style={{ background: "rgba(134,196,199,0.10)", border: "1px solid rgba(134,196,199,0.22)" }}>
        <QrCode size={56} style={{ color: "#86C4C7" }} />
      </div>
      <p className="mt-2 text-[10px]" style={{ color: "#9A9D9F" }}>Código</p>
      <p className="text-[13px] font-bold tracking-widest" style={{ color: "#86C4C7" }}>BOX-7K2</p>
      <button className="mt-2 w-full rounded-[6px] py-1.5 text-[10px] font-semibold" style={{ background: "rgba(134,196,199,0.08)", border: "1px solid rgba(134,196,199,0.22)", color: "#f4f8f9" }}>Copiar link</button>
    </div>
  );
}

/* ---------- FAQ ---------- */
function Faq() {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {t.faq.qa.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="rounded-[12px]" style={{ background: "rgba(134,196,199,0.05)", border: "1px solid rgba(134,196,199,0.14)" }}>
            <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
              <span className="text-[15px] font-semibold text-[#f4f8f9]">{f.q}</span>
              <ChevronDown size={18} style={{ color: "#86C4C7", transition: "transform 250ms ease", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            <div style={{ maxHeight: isOpen ? 320 : 0, opacity: isOpen ? 1 : 0, transition: "max-height 350ms ease, opacity 250ms ease", overflow: "hidden" }}>
              <p className="px-5 pb-5 text-[14px] leading-relaxed" style={{ color: "#9A9D9F" }}>{f.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Page ---------- */
function Landing() {
  const [locale, setLocale] = useState<Locale>("es");
  const t = dicts[locale];
  return (
    <LocaleCtx.Provider value={{ locale, t }}>
      <main className="min-h-screen" style={{ background: "#050a0d", color: "#f4f8f9" }}>
        {/* NAV */}
        <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: "rgba(5,10,13,0.78)", borderBottom: "1px solid rgba(134,196,199,0.10)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <a href="#top" className="flex items-center">
              <img src={logoFull} alt="FitEngine" style={{ height: 50, width: "auto", display: "block" }} />
            </a>
            <nav className="hidden items-center gap-7 text-[13px] md:flex" style={{ color: "#9A9D9F" }}>
              <a href="#problema" className="hover:text-[#f4f8f9]">{t.nav.problema}</a>
              <a href="#solucion" className="hover:text-[#f4f8f9]">{t.nav.solucion}</a>
              <a href="#para-quien" className="hover:text-[#f4f8f9]">{t.nav.paraQuien}</a>
              <a href="#como" className="hover:text-[#f4f8f9]">{t.nav.como}</a>
              <a href="#faq" className="hover:text-[#f4f8f9]">{t.nav.faq}</a>
            </nav>
            <div className="flex items-center gap-4">
              <LanguageSwitcher locale={locale} setLocale={setLocale} />
              <PrimaryButton>{t.nav.cta}</PrimaryButton>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section id="top" className="relative overflow-hidden">
          <DotPattern />
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-200px] h-[500px] w-[800px] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(134,196,199,0.18), transparent)" }} />
          {/* Decorative watermark isotype — visible in full */}
          <BrandIsotype
            size={360}
            opacity={0.18}
            className="pointer-events-none absolute right-8 top-16 hidden lg:block"
          />
          <BrandIsotype
            size={200}
            opacity={0.12}
            className="pointer-events-none absolute right-4 top-24 lg:hidden"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-6 pb-6 pt-6 md:grid-cols-[1.05fr_1fr] md:pt-8">
            <Reveal>
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px]" style={{ background: "rgba(134,196,199,0.08)", border: "1px solid rgba(134,196,199,0.22)", color: "#86C4C7" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#86C4C7" }} />
                  {t.hero.badge}
                </div>
                <h1 className="text-5xl leading-[1.05] sm:text-6xl">
                  {t.hero.title1}
                  <br />
                  {t.hero.title2}
                </h1>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed" style={{ color: "#9A9D9F" }}>
                  {t.hero.subtitle}
                </p>
                <p className="mt-3 text-[13px]" style={{ color: "rgba(154,157,159,0.7)" }}>
                  {t.hero.storeNote}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <PrimaryButton>
                    {t.hero.cta1} <ArrowRight size={16} />
                  </PrimaryButton>
                  <GhostButton>{t.hero.cta2}</GhostButton>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <StoreButton icon={<Apple size={22} />} line1={t.hero.storeApple.line1} line2={t.hero.storeApple.line2} href="#" />
                  <StoreButton icon={<Play size={22} />} line1={t.hero.storeGoogle.line1} line2={t.hero.storeGoogle.line2} href="#" />
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px]" style={{ color: "#9A9D9F" }}>
                  {t.hero.bullets.map((b) => (
                    <span key={b} className="flex items-center gap-2"><Check size={14} style={{ color: "#86C4C7" }} /> {b}</span>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="relative flex items-center justify-center py-2 md:justify-end">
                <HeroPhoneMockup />
              </div>
            </Reveal>
          </div>
        </section>

        {/* SOCIAL PROOF STRIP */}
        <section className="relative border-y" style={{ borderColor: "rgba(134,196,199,0.10)" }}>
          <div className="mx-auto max-w-6xl px-6 py-4">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "rgba(154,157,159,0.7)" }}>
              {t.strip}
            </p>
          </div>
        </section>

        {/* PROBLEMA */}
        <section id="problema" className="relative">
          <DotPattern />
          <div className="relative mx-auto max-w-6xl px-6 py-6">
            <Reveal>
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-3xl sm:text-4xl">{t.problema.title}</h2>
                <p className="mt-4 text-[16px]" style={{ color: "#9A9D9F" }}>{t.problema.subtitle}</p>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {t.problema.cards.map((c, idx) => {
                const icons = [<MessageSquare size={20} />, <Receipt size={20} />, <FileText size={20} />];
                return (
                  <Reveal key={c.t} delay={idx * 100}>
                    <Card>
                      <IconBadge>{icons[idx]}</IconBadge>
                      <h3 className="text-[18px] text-[#f4f8f9]">{c.t}</h3>
                      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#9A9D9F" }}>{c.d}</p>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <TriangleDivider />
        {/* SOLUCIÓN */}
        <section id="solucion" className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(134,196,199,0.25),transparent)" }} />
          <div className="mx-auto max-w-6xl px-6 py-6">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl sm:text-4xl">{t.solucion.title}</h2>
                <p className="mt-4 text-[16px]" style={{ color: "#9A9D9F" }}>{t.solucion.subtitle}</p>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-8">
                <AdminMockup />
              </div>
            </Reveal>

            <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {t.solucion.features.map((c, idx) => {
                const icons = [<CalendarCheck size={20} />, <CreditCard size={20} />, <Sparkles size={20} />, <MessageSquare size={20} />];
                return (
                  <Reveal key={c.t} delay={idx * 90}>
                    <Card>
                      <IconBadge>{icons[idx]}</IconBadge>
                      <h3 className="text-[16px] text-[#f4f8f9]">{c.t}</h3>
                      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "#9A9D9F" }}>{c.d}</p>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <TriangleDivider />
        {/* PARA QUIÉN */}
        <section id="para-quien" className="relative">
          <DotPattern />
          <div className="relative mx-auto max-w-6xl px-6 py-6">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl sm:text-4xl">{t.paraQuien.title}</h2>
                <p className="mt-4 text-[16px]" style={{ color: "#9A9D9F" }}>{t.paraQuien.subtitle}</p>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {t.paraQuien.roles.map((c, idx) => {
                const icons = [<Building2 size={20} />, <UserRound size={20} />, <Users size={20} />];
                const roles = ["admin", "coach", "client"] as const;
                return (
                  <Reveal key={c.t} delay={idx * 100}>
                    <Card className="h-full">
                      <IconBadge>{icons[idx]}</IconBadge>
                      <h3 className="text-[18px] text-[#f4f8f9]">{c.t}</h3>
                      <div className="mt-4">
                        <MiniMockup role={roles[idx]} />
                      </div>
                      <ul className="mt-4 space-y-2.5">
                        {c.items.map((it) => (
                          <li key={it} className="flex gap-2.5 text-[13.5px] leading-snug" style={{ color: "#9A9D9F" }}>
                            <Check size={16} style={{ color: "#86C4C7", marginTop: 2, flexShrink: 0 }} />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <TriangleDivider />
        {/* CÓMO EMPEZÁS */}
        <section id="como" className="relative">
          <div className="mx-auto max-w-6xl px-6 py-6">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl sm:text-4xl">{t.como.title}</h2>
                <p className="mt-4 text-[16px]" style={{ color: "#9A9D9F" }}>{t.como.subtitle}</p>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {t.como.steps.map((s, idx) => {
                const mocks = [<StepFormMockup />, <StepPlansMockup />, <StepInviteMockup />];
                const n = ["01", "02", "03"][idx];
                return (
                  <Reveal key={n} delay={idx * 120}>
                    <Card>
                      <p className="text-[12px] font-semibold tracking-widest" style={{ color: "#86C4C7" }}>
                        {t.como.stepLabel} {n}
                      </p>
                      <h3 className="mt-3 text-[18px] text-[#f4f8f9]">{s.t}</h3>
                      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#9A9D9F" }}>{s.d}</p>
                      <div className="mt-5">{mocks[idx]}</div>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
            <Reveal>
              <div id="cta" className="mt-8 flex justify-center">
                <PrimaryButton>
                  {t.como.cta} <ArrowRight size={16} />
                </PrimaryButton>
              </div>
            </Reveal>
          </div>
        </section>

        <TriangleDivider />
        {/* FAQ */}
        <section id="faq" className="relative">
          <DotPattern />
          <div className="relative mx-auto max-w-6xl px-6 py-6">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl sm:text-4xl">{t.faq.title}</h2>
                <p className="mt-4 text-[16px]" style={{ color: "#9A9D9F" }}>{t.faq.subtitle}</p>
              </div>
            </Reveal>
            <div className="mt-7">
              <Faq />
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid rgba(134,196,199,0.12)", background: "rgba(134,196,199,0.03)" }}>
          <div className="relative mx-auto max-w-6xl overflow-hidden px-6 py-7">
            {/* Decorative isotype — intentionally bleeds off the right edge as a watermark */}
            <BrandIsotype
              size={520}
              opacity={0.12}
              className="pointer-events-none absolute -right-40 -top-24 hidden md:block"
              style={{ filter: "blur(0.3px)" }}
            />
            <div className="relative grid gap-10 md:grid-cols-4">
              <div>
                <img src={logoIso} alt="FitEngine" style={{ height: 96, width: "auto", display: "block" }} />
                <p className="mt-4 max-w-[220px] text-[13px] leading-relaxed" style={{ color: "#9A9D9F" }}>
                  {t.footer.tagline}
                </p>
              </div>

              {t.footer.cols.map((col) => (
                <div key={col.h}>
                  <p className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "#f4f8f9" }}>{col.h}</p>
                  <ul className="mt-4 space-y-2.5">
                    {col.links.map((l) => (
                      <li key={l}>
                        <a href="#" className="text-[13.5px] hover:text-[#86C4C7]" style={{ color: "#9A9D9F" }}>{l}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-widest text-[#f4f8f9]">{t.footer.contact}</p>
                <ul className="mt-4 space-y-2.5 text-[13.5px]" style={{ color: "#9A9D9F" }}>
                  <li><a href="mailto:ventas@fitengine.app" className="hover:text-[#86C4C7]">ventas@fitengine.app</a></li>
                  <li><a href="mailto:soporte@fitengine.app" className="hover:text-[#86C4C7]">soporte@fitengine.app</a></li>
                  <li>{t.footer.city}</li>
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-3 pt-6 text-[12px] md:flex-row md:items-center" style={{ borderTop: "1px solid rgba(134,196,199,0.10)", color: "#9A9D9F" }}>
              <p>{t.footer.copyright}</p>
              <p>{t.footer.end}</p>
            </div>
          </div>
        </footer>
      </main>
    </LocaleCtx.Provider>
  );
}
