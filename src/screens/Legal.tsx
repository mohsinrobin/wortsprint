// Privacy policy. Plain text, kept short and specific to what the
// app really does: no accounts, no tracking, progress stays on the device.
import type { ReactNode } from 'react';
import { navigate } from '../lib/router';
import { PageHeader } from '../components/ui';
import { OPERATOR, PRIVACY_UPDATED, operatorComplete } from '../lib/legal';

function Operator() {
  if (!operatorComplete) return <p className="rounded-sheet border border-pen/40 bg-pen-soft p-3 text-pen">Operator details are being added.</p>;
  return (
    <address className="not-italic">
      {OPERATOR.name}
      <br />
      Email: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
    </address>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const linkCls = 'text-blue underline underline-offset-2';

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Privacy" subtitle={`Last updated ${PRIVACY_UPDATED}`} back={() => navigate('/settings')} />
      <div className="card space-y-6 p-5 text-[15px] leading-relaxed sm:p-7 [&_a]:text-blue [&_a]:underline [&_a]:underline-offset-2">
        <Section title="In short">
          <ul className="list-disc space-y-1 pl-5">
            <li>No account, no sign-up, no ads.</li>
            <li>No tracking, no analytics, no cookies.</li>
            <li>Your learning progress stays on your device. We never receive it.</li>
          </ul>
        </Section>

        <Section title="Who is responsible">
          <p>The controller under the EU General Data Protection Regulation (GDPR) is:</p>
          <Operator />
        </Section>

        <Section title="What is stored on your device">
          <p>
            Your progress, settings and theme choice are saved in your browser's own storage (IndexedDB and localStorage) so you can continue where you left off. This data never leaves your device and we cannot see it.{' '}
            <button onClick={() => navigate('/settings')} className={linkCls}>
              Settings → Your progress
            </button>{' '}
            clears your learning progress. To delete everything, clear this site's data in your browser.
          </p>
        </Section>

        <Section title="Hosting">
          <p>
            The app is served by GitHub Pages, a service of GitHub, Inc., USA. When you open it, your browser sends the technical data every website receives, such as your IP address, browser type and the time of the request. GitHub processes this to deliver the site and keep it secure. Legal basis: Art. 6(1)(f) GDPR, our legitimate interest in providing the app. Transfers to the USA are covered by the EU–US Data Privacy Framework or standard contractual clauses. Details:{' '}
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">
              GitHub Privacy Statement
            </a>
            .
          </p>
        </Section>

        <Section title="Fonts">
          <p>All fonts are delivered with the app from the same server. Your browser does not connect to Google Fonts or any other font service.</p>
        </Section>

        <Section title="Pronunciation">
          <p>The speaker button uses your browser's built-in speech feature. The app prefers voices that run on your device. If your browser only offers an online voice, the browser may send the German word to its maker (for example Google, Apple or Microsoft) under their privacy terms. The app adds nothing else.</p>
        </Section>

        <Section title="Sharing">
          <p>“Challenge a friend” opens your device's own share menu, or copies a short text. Nothing is sent unless you choose where to share it.</p>
        </Section>

        <Section title="Your rights">
          <p>
            You have the right to access, correct and delete your personal data, to restrict or object to its processing, and to data portability (Art. 15–21 GDPR). You can also complain to a data protection supervisory authority. Since we keep no personal data on our own servers, a request would concern only the hosting data described above. Contact us using the details above.
          </p>
        </Section>
      </div>
    </div>
  );
}
