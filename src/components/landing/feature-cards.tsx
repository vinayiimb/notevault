"use client";

import Link from "next/link";
import { Books, Bookmark, GraduationCap } from "@phosphor-icons/react";
import { ArrowRight } from "@phosphor-icons/react";

export function FeatureCards() {
  return (
    <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 -mt-8 sm:-mt-16 mb-12">
        {/* Card 1: ALL PYQ */}
        <div className="flex flex-col justify-between rounded-3xl bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all h-full">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📚</span>
              <h2 className="font-bold text-lg text-gray-900 tracking-tight">ALL PYQ</h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Browse 29,000+ Delhi University question papers across all 118 programmes in interactive PDF.
            </p>
          </div>
          <Link
            href="/previous-year-papers"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-50/80 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors w-max"
          >
            Open All PYQs <ArrowRight size={16} weight="bold" />
          </Link>
        </div>

        {/* Card 2: Free Subject Notes */}
        <div className="flex flex-col justify-between rounded-3xl bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all h-full">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎀</span>
              <h2 className="font-bold text-lg text-gray-900 tracking-tight">Free Subject Notes</h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Request high-yield notes for your subject. We make notes according to student demand!
            </p>
          </div>
          <Link
            href="/notes"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-50/80 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors w-max"
          >
            Request Free Notes <ArrowRight size={16} weight="bold" />
          </Link>
        </div>

        {/* Card 3: Paid Notes */}
        <div className="flex flex-col justify-between rounded-3xl bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all h-full">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-bold text-xl text-gray-900 tracking-tight">Paid Notes</h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Complete notes for every subject, organised and ready to study.
            </p>
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <Link
              href="/notes/preview"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors w-full text-center"
            >
              Preview Notes
            </Link>
            <Link
              href="/notes/premium"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors w-full text-center"
            >
              Get Full Access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
