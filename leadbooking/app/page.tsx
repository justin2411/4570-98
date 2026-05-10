import Link from 'next/link'
import { CalendarCheck, Shield, Zap, Users, CheckCircle, ArrowRight, Star } from 'lucide-react'
import { Logo } from '@/components/layout/logo'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-[#1E3A5F] transition-colors"
            >
              Anmelden
            </Link>
            <Link
              href="/registrieren"
              className="bg-[#1E3A5F] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#162d4a] transition-colors"
            >
              Jetzt registrieren
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-[#1E3A5F] via-[#2E75B6] to-[#1E3A5F] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-sm mb-8">
            <Star className="w-4 h-4 text-yellow-300" />
            Deutschlands führender Marktplatz für Beratungstermine
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Qualifizierte Termine mit<br />
            <span className="text-yellow-300">Heilberuflern kaufen</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
            Sparen Sie Zeit bei der Kundenakquise. Kaufen Sie direkt vorqualifizierte
            Beratungstermine mit Ärzten, Heilpraktikern, Physiotherapeuten und mehr –
            für nur <strong className="text-white">100 € pro Termin</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/registrieren"
              className="inline-flex items-center gap-2 bg-white text-[#1E3A5F] font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors text-lg"
            >
              Jetzt starten <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 transition-colors text-lg border border-white/20"
            >
              Bereits Mitglied? Anmelden
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            {[
              { value: '100 €', label: 'Pro Termin' },
              { value: '2 Typen', label: 'Geplant & Stattgefunden' },
              { value: '100%', label: 'Qualifiziert' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-bold text-white">{value}</div>
                <div className="text-sm text-white/70 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Termin-Typen */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1E3A5F] mb-4">
              Zwei Arten von Terminen
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Wählen Sie den Termin-Typ, der am besten zu Ihrer Arbeitsweise passt.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 border-2 border-yellow-200 shadow-sm">
              <div className="text-4xl mb-4">🟡</div>
              <h3 className="text-xl font-bold text-[#1E3A5F] mb-3">Geplanter Termin</h3>
              <p className="text-gray-600 mb-6">
                Der Heilberufler hat zugestimmt und wartet auf Ihren Anruf.
                Sie kontaktieren ihn zum vereinbarten Termin direkt.
              </p>
              <ul className="space-y-2">
                {['Fester Terminvorschlag', 'Heilberufler ist informiert', 'Direktkontakt nach Kauf'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-2xl font-bold text-[#1E3A5F]">100 €</div>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-green-200 shadow-sm">
              <div className="text-4xl mb-4">🟢</div>
              <h3 className="text-xl font-bold text-[#1E3A5F] mb-3">Stattgefundener Termin</h3>
              <p className="text-gray-600 mb-6">
                Das Erstgespräch hat bereits stattgefunden. Der Heilberufler hat
                Interesse bestätigt – ideal für die Nachfassung.
              </p>
              <ul className="space-y-2">
                {['Interesse bereits bestätigt', 'Gesprächszusammenfassung inklusive', 'Höherer Vertrauenswert'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-2xl font-bold text-[#1E3A5F]">100 €</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1E3A5F] mb-4">
              Alles, was Sie brauchen
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: CalendarCheck,
                title: 'Sofort verfügbar',
                desc: 'Kaufen Sie Termine und erhalten Sie die Kontaktdaten sofort – ohne Wartezeit.',
              },
              {
                icon: Shield,
                title: 'Sicher bezahlen',
                desc: 'Stripe Kreditkarte oder PayPal. Alle Zahlungen sind verschlüsselt und sicher.',
              },
              {
                icon: Zap,
                title: 'Push-Benachrichtigungen',
                desc: 'Neue Termine verfügbar? Sie werden sofort benachrichtigt – nie wieder etwas verpassen.',
              },
              {
                icon: Users,
                title: 'Alle Heilberufsgruppen',
                desc: 'Ärzte, Zahnärzte, Physiotherapeuten, Heilpraktiker, Hebammen und mehr.',
              },
              {
                icon: CheckCircle,
                title: 'Qualitätskontrolle',
                desc: 'Alle Termine werden von unserem Team geprüft, bevor sie im Marktplatz erscheinen.',
              },
              {
                icon: Star,
                title: 'No-Show-Schutz',
                desc: 'Geplanter Termin nicht eingehalten? Melden Sie No-Shows einfach im Dashboard.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-[#1E3A5F]/10 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-[#1E3A5F]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Bereit, mehr Kunden zu gewinnen?
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Registrieren Sie sich kostenlos und kaufen Sie Ihren ersten Termin für nur 100 €.
          </p>
          <Link
            href="/registrieren"
            className="inline-flex items-center gap-2 bg-white text-[#1E3A5F] font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors text-lg"
          >
            Jetzt kostenlos registrieren <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <CalendarCheck className="w-5 h-5" />
            Leadbooking
          </div>
          <p className="text-sm">© 2024 Leadbooking. Alle Rechte vorbehalten.</p>
        </div>
      </footer>
    </div>
  )
}
