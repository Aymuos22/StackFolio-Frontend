import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="panel w-full max-w-lg p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">The page you are looking for does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Go home
        </Link>
      </section>
    </main>
  );
}
