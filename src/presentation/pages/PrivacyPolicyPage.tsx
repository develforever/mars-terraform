import { useTranslation } from "react-i18next";
import { getPolicyContent } from "./privacyPolicyContent";

/** Polityka prywatności (T12, RODO art. 13). Treść: `privacyPolicyContent.ts`. */
export default function PrivacyPolicyPage() {
  const { i18n } = useTranslation();
  const content = getPolicyContent(i18n.language);

  return (
    <main className="w-full h-full overflow-y-auto bg-[#050308] text-gray-200">
      <article className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">{content.title}</h1>
        <p className="text-sm text-gray-400 mb-2">{content.updated}</p>
        <p className="text-sm text-[#ec7063] mb-8" role="note">{content.draftNotice}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mb-2 leading-relaxed">{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
