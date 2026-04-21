import { logIn } from "@/app/actions";

export function MarketingPage() {
  return (
    <div className="space-y-20 py-8">
      {/* Hero */}
      <section className="text-center space-y-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl tracking-tight">
          Everything a personal chef needs.
          <br />
          <span className="bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text text-transparent">
            In one beautiful place.
          </span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          From recipe discovery to client approval to branded PDFs and emails —
          Meal Planner Pro handles the business side so you can focus on the food.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <form action={logIn}>
            <button className="button-primary text-base px-6 py-3">
              Sign in
            </button>
          </form>
          <a
            href="#features"
            className="button-secondary text-base px-6 py-3"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[
          {
            color: "from-teal-500 to-teal-600",
            title: "Client Management",
            desc: "Track every household — dietary notes, preferences, addresses, phone numbers. Each client is a complete profile with their full service history.",
            icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
          },
          {
            color: "from-blue-500 to-blue-600",
            title: "Cook Date Calendar",
            desc: "Beautiful month view with status-colored indicators. Click any day to schedule. Filter dashboard metrics by the selected month.",
            icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5",
          },
          {
            color: "from-purple-500 to-purple-600",
            title: "Meal Plan Builder",
            desc: "Two-column drag-and-drop editor. Search 2,500+ recipes, group by category (Entrees, Salads, Breakfast, A Gift from Beth), and build menus in minutes.",
            icon: "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z",
          },
          {
            color: "from-amber-500 to-orange-500",
            title: "Branded Bon Appetit PDFs",
            desc: "One click generates a beautifully designed menu card — custom fonts, two-column balanced layout, your brand colors. Ready to deliver to clients.",
            icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
          },
          {
            color: "from-rose-500 to-pink-600",
            title: "Smart Recipe Library",
            desc: "Import from URL (auto-extracts title, image, ingredients, instructions), AI-generate with Gemini, search Edamam with health filters, or paste freeform text — we&apos;ll split it into clean recipes.",
            icon: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
          },
          {
            color: "from-indigo-500 to-indigo-600",
            title: "Invoices & Email",
            desc: "Auto-numbered MM-#### invoices, negative line items for credits, quick-fill from freeform text. Send PDFs to clients via Resend or download as .eml files.",
            icon: "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
          },
        ].map((f) => (
          <div
            key={f.title}
            className={`rounded-2xl bg-gradient-to-br ${f.color} p-6 text-white shadow-lg hover:shadow-xl transition-shadow`}
          >
            <svg className="h-10 w-10 mb-4 opacity-90" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
            </svg>
            <h3 className="text-xl font-bold mb-2">{f.title}</h3>
            <p className="text-sm opacity-90 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Workflow */}
      <section className="panel p-8 sm:p-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            From idea to invoice in minutes
          </h2>
          <p className="text-slate-500">A visual workflow that mirrors how you actually work.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 relative">
          {[
            { n: 1, t: "Pick a date", d: "Click a day on the calendar from any client's profile. Cook date created, ready to build." },
            { n: 2, t: "Build the menu", d: "Search your library, drag recipes onto the meal plan, organize by category. Send to the client for approval." },
            { n: 3, t: "Deliver", d: "Client approves → Bon Appetit PDF auto-generated. Download, email, or send directly to Beth." },
          ].map((s) => (
            <div key={s.n} className="text-center relative">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-2xl font-bold text-white shadow-lg mb-4">
                {s.n}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{s.t}</h3>
              <p className="text-sm text-slate-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
        {[
          { v: "2,500+", l: "Recipes in library" },
          { v: "1-click", l: "PDF & email delivery" },
          { v: "3 steps", l: "Meal plan to approved menu" },
        ].map((s) => (
          <div key={s.l} className="panel p-6 text-center">
            <p className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text text-transparent">
              {s.v}
            </p>
            <p className="mt-2 text-sm text-slate-500">{s.l}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-10 sm:p-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-3">
          Ready to get started?
        </h2>
        <p className="text-slate-300 mb-6 max-w-xl mx-auto">
          Stop juggling spreadsheets, Word docs, and email drafts. Run your entire personal chef business from one place.
        </p>
        <form action={logIn} className="inline">
          <button className="button-primary text-base px-8 py-3">
            Sign in to get started
          </button>
        </form>
      </section>
    </div>
  );
}
