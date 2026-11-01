import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calculator, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#edf1f6] px-4 py-14">
      {/* Soft red / blue ambience */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#dc4835]/10 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-[#43aad7]/10 blur-[140px]"
      />

      <div className="relative w-full max-w-xl">
        <div className="mb-7 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#dc4835]/10">
              <Image
                src="/mubxai-dark-logo.png"
                alt=""
                width={18}
                height={18}
                className="dark-logo"
              />
              <Image
                src="/mubxai-light-logo.png"
                alt=""
                width={18}
                height={18}
                className="light-logo"
              />
            </span>
            <span className="text-sm font-black uppercase italic tracking-tight text-[#222d32]">
              MUBXAI
            </span>
          </Link>

          <span className="rounded-full border border-[#dde3ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a6472]">
            Transcript · 404
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[#dde3ec] bg-white shadow-[0_24px_70px_-38px_rgba(34,45,50,0.45)]">
          <div className="flex items-center justify-between border-b border-[#dde3ec] px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5a6472]">
              Academic record
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5a6472]">
              Fall 2026
            </p>
          </div>

          {/* The failed course row */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#dde3ec] px-6 py-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#dc4835]">
                Course
              </p>
              <p className="mt-1 text-lg font-black tracking-tight text-[#222d32]">
                PAGE 404
              </p>
              <p className="text-xs font-medium text-[#5a6472]">
                Page not found · 0 credit hours
              </p>
            </div>
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl border-2 border-[#dc4835]/25 bg-[#dc4835]/5">
              <span className="text-3xl font-black leading-none text-[#dc4835]">U</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#dc4835]">
                Ungraded
              </span>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-center gap-2 text-[#43aad7]">
              <SearchX className="h-4 w-4" aria-hidden="true" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]">
                Not in the catalog
              </p>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-[#222d32]">
              You&apos;re a student and you got stuck.
            </h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#5a6472]">
              At this age? How does a student get stuck on a page that doesn&apos;t exist —
              there is nothing in this page. Even your GPA can&apos;t find it. Go search your
              doctor somewhere else.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#dc4835] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#c03d2e]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Dashboard
              </Link>
              <Link
                href="/gpa-calculator"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#dde3ec] bg-white px-5 py-3 text-sm font-bold text-[#222d32] transition-colors hover:border-[#43aad7] hover:text-[#43aad7]"
              >
                <Calculator className="h-4 w-4" aria-hidden="true" />
                GPA calculator
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-dashed border-[#dde3ec] bg-[#f8fafc] px-6 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5a6472]">
              GPA impact: none
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#43aad7]">
              HTTP 404
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] font-medium text-[#5a6472]">
          This course will not appear on your transcript. Neither will the page.
        </p>
      </div>
    </main>
  );
}
