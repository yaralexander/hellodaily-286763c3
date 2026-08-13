import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const updated = "13 August 2026";

const privacy = {
  en: {
    title: "Privacy Policy",
    intro: "Hello Daily is a wellness and nutrition application. This policy explains what information we process and why.",
    sections: [
      ["Information we process", "Account information such as your name, email address and profile image; health and nutrition information you choose to enter; food photos, barcode data and scan results; and technical information needed to operate and secure the service."],
      ["Google sign-in", "When you sign in with Google, we receive your basic profile information (name, email address and profile image). We use it only to create and secure your Hello Daily account. We do not access your Google Drive, Gmail, contacts or calendar."],
      ["How information is used", "We use your information to provide the app, calculate nutrition insights, personalize recommendations, maintain account security and improve reliability. AI-generated information is educational and is not medical advice."],
      ["Service providers", "Authentication and application data are processed with Supabase. AI features may send the content you submit to OpenAI for analysis. Infrastructure is hosted on Hetzner. These providers process information only to deliver the requested service."],
      ["Storage and deletion", "Information is retained while your account is active or as needed to provide the service. You may request access, correction or deletion of your account and associated data by contacting us."],
      ["Your choices", "You decide what health and nutrition information to enter. You may stop using the service, sign out or request account deletion at any time."],
      ["Contact", "For privacy questions or data requests, email aleksi.smirnov@gmail.com."],
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    intro: "Hello Daily — приложение для контроля питания и здорового образа жизни. Здесь описано, какие данные мы обрабатываем и зачем.",
    sections: [
      ["Какие данные мы обрабатываем", "Данные аккаунта: имя, email и фотография профиля; сведения о здоровье и питании, которые вы вводите; фотографии еды, штрихкоды и результаты сканирования; технические данные, необходимые для работы и защиты сервиса."],
      ["Вход через Google", "При входе через Google мы получаем основные данные профиля: имя, email и фотографию. Они используются только для создания и защиты аккаунта Hello Daily. Мы не получаем доступ к Google Drive, Gmail, контактам или календарю."],
      ["Как используются данные", "Данные нужны для работы приложения, расчёта показателей питания, персонализации рекомендаций, защиты аккаунта и повышения надёжности. Результаты AI носят информационный характер и не являются медицинской рекомендацией."],
      ["Поставщики услуг", "Авторизация и данные приложения обрабатываются в Supabase. Для AI-анализа отправленные вами материалы могут передаваться OpenAI. Инфраструктура размещена в Hetzner. Эти поставщики обрабатывают данные только для оказания запрошенной услуги."],
      ["Хранение и удаление", "Данные хранятся, пока активен ваш аккаунт или пока они необходимы для работы сервиса. Вы можете запросить доступ, исправление или удаление аккаунта и связанных данных."],
      ["Ваш выбор", "Вы самостоятельно решаете, какие сведения о здоровье и питании добавлять. Можно прекратить использование сервиса, выйти или запросить удаление аккаунта в любое время."],
      ["Контакты", "По вопросам конфиденциальности и обработки данных: aleksi.smirnov@gmail.com."],
    ],
  },
};

const terms = {
  en: {
    title: "Terms of Service",
    intro: "These terms govern your use of Hello Daily. By creating an account or using the service, you agree to them.",
    sections: [
      ["The service", "Hello Daily provides tools for recording food, wellness information and AI-generated nutrition insights. Features may change as the service develops."],
      ["Not medical advice", "Hello Daily does not diagnose, treat or prevent disease. Scores, estimates and AI responses are informational only. Always consult a qualified healthcare professional about medical decisions or symptoms."],
      ["Your account", "You are responsible for keeping your account secure and for activity performed through it. Provide accurate information and notify us if you believe your account has been compromised."],
      ["Acceptable use", "Do not misuse the service, attempt unauthorized access, interfere with its operation, upload unlawful material or use it to harm others."],
      ["Your content", "You retain ownership of information and images you submit. You grant us permission to process that content solely to operate and improve the features you request."],
      ["Availability and liability", "We aim to keep the service reliable but do not guarantee uninterrupted or error-free operation. To the extent permitted by law, the service is provided as available and we are not liable for decisions made solely from its informational output."],
      ["Ending use", "You may stop using Hello Daily at any time. We may restrict access when necessary to protect users, comply with law or address serious violations of these terms."],
      ["Contact", "Questions about these terms may be sent to aleksi.smirnov@gmail.com."],
    ],
  },
  ru: {
    title: "Условия использования",
    intro: "Эти условия регулируют использование Hello Daily. Создавая аккаунт или используя сервис, вы соглашаетесь с ними.",
    sections: [
      ["Сервис", "Hello Daily предоставляет инструменты для учёта питания, данных о самочувствии и получения AI-рекомендаций. Возможности могут меняться по мере развития сервиса."],
      ["Не является медицинской рекомендацией", "Hello Daily не диагностирует, не лечит и не предотвращает заболевания. Оценки, расчёты и ответы AI предназначены только для информации. По вопросам здоровья и симптомов обращайтесь к квалифицированному специалисту."],
      ["Ваш аккаунт", "Вы отвечаете за безопасность аккаунта и действия, выполненные через него. Указывайте достоверные сведения и сообщите нам, если считаете, что аккаунт скомпрометирован."],
      ["Допустимое использование", "Запрещено злоупотреблять сервисом, пытаться получить несанкционированный доступ, мешать его работе, загружать незаконные материалы или использовать его во вред другим."],
      ["Ваши материалы", "Вы сохраняете права на добавленные сведения и изображения. Вы разрешаете нам обрабатывать их исключительно для работы и улучшения запрошенных вами функций."],
      ["Доступность и ответственность", "Мы стремимся обеспечить надёжную работу, но не гарантируем отсутствие перерывов и ошибок. В пределах, разрешённых законом, сервис предоставляется по мере доступности; решения не должны приниматься исключительно на основании его информационных результатов."],
      ["Прекращение использования", "Вы можете прекратить использование Hello Daily в любое время. Мы можем ограничить доступ для защиты пользователей, соблюдения закона или при серьёзном нарушении этих условий."],
      ["Контакты", "Вопросы об условиях использования: aleksi.smirnov@gmail.com."],
    ],
  },
};

const LegalPage = () => {
  const { pathname } = useLocation();
  const { language, setLanguage } = useLanguage();
  const content = (pathname === "/privacy" ? privacy : terms)[language];

  return (
    <main className="min-h-screen px-4 py-8 text-foreground">
      <article className="max-w-3xl mx-auto glass-card p-6 sm:p-10">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-4"><ArrowLeft className="w-4 h-4" /> {language === "ru" ? "Назад к входу" : "Back to sign in"}</Link>
            <h1 className="text-3xl font-bold">{content.title}</h1>
            <p className="text-xs text-muted-foreground mt-2">{language === "ru" ? "Обновлено" : "Last updated"}: {updated}</p>
          </div>
          <div className="flex rounded-xl bg-secondary/60 p-1 text-xs">
            <button onClick={() => setLanguage("en")} className={`px-3 py-2 rounded-lg ${language === "en" ? "bg-primary text-primary-foreground" : ""}`}>EN</button>
            <button onClick={() => setLanguage("ru")} className={`px-3 py-2 rounded-lg ${language === "ru" ? "bg-primary text-primary-foreground" : ""}`}>RU</button>
          </div>
        </header>
        <p className="text-muted-foreground leading-relaxed mb-8">{content.intro}</p>
        <div className="space-y-7">
          {content.sections.map(([heading, body]) => <section key={heading}><h2 className="text-lg font-semibold mb-2">{heading}</h2><p className="text-sm text-muted-foreground leading-relaxed">{body}</p></section>)}
        </div>
        <footer className="border-t border-border mt-10 pt-6 flex gap-5 text-sm text-primary">
          <Link to="/privacy">{language === "ru" ? "Конфиденциальность" : "Privacy"}</Link>
          <Link to="/terms">{language === "ru" ? "Условия" : "Terms"}</Link>
        </footer>
      </article>
    </main>
  );
};

export default LegalPage;
