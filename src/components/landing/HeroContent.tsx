'use client';

import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, FileText, Gift } from 'lucide-react';

export default function HeroContent() {
  return (
    <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto px-6 pt-32 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-2 bg-[#F0F5FF] text-[#1E50FF] px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border border-[#E1EAFF]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Trusted by DU students
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6"
      >
        Find DU PYQs instantly
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl leading-relaxed"
      >
        Access Delhi University previous year question papers, notes, and exam resources in one place. Study smarter with quick search, subject-wise browsing, and free access.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center w-full"
      >
        <button className="group flex items-center gap-2 bg-[#0A1128] text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-95 hover:shadow-lg mb-10">
          Browse Question Papers
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-gray-600">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            Subject-wise PYQs
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            Notes & resources
          </div>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-blue-500" />
            Free access
          </div>
        </div>
      </motion.div>
    </div>
  );
}
