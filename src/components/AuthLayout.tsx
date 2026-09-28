import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Stackfolio
        </Link>
        <div className="max-w-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">Portfolio command center</p>
          <h1 className="mt-4 text-5xl font-bold leading-tight tracking-tight">
            Build, publish, and keep your developer story current.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-300">
            A focused editor for the sections that matter: profile, projects, experience, skills, credentials, and
            the public page clients and recruiters can actually read.
          </p>
        </div>
        <p className="text-sm text-slate-400">Connected to your Spring Boot API.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 block text-xl font-bold tracking-tight text-slate-950 lg:hidden">
            Stackfolio
          </Link>
          <div className="panel p-6 sm:p-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>
            <div className="mt-6">{children}</div>
            <div className="mt-6 text-sm text-slate-600">{footer}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
