'use client';

import { motion } from 'framer-motion';
import { Download, Eye, FileText, Settings, Bookmark, Clock } from 'lucide-react';

export default function HeroCards() {
  return (
    <div className="relative z-20 w-full max-w-5xl mx-auto h-[450px] md:h-[350px] mt-10 md:mt-20 flex flex-col md:flex-row items-center justify-center gap-6 px-4 perspective-1000">
      {/* Left Card - Subjects */}
      <motion.div
        initial={{ opacity: 0, x: 80, y: 120, rotate: 2 }}
        whileInView={{ opacity: 1, x: 0, y: 0, rotate: -3 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex flex-col w-[280px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-gray-100 p-5 translate-x-12 translate-y-12 z-10"
      >
        <div className="flex items-center gap-2 font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">
          <BookIcon className="w-5 h-5 text-gray-500" /> Subjects
        </div>
        
        <div className="space-y-4 mb-4">
          <SubjectRow icon="bg-red-50 text-red-500" name="Political Science" count="1,245 Papers" />
          <SubjectRow icon="bg-blue-50 text-blue-500" name="Economics" count="1,102 Papers" />
          <SubjectRow icon="bg-red-50 text-red-500" name="English" count="987 Papers" />
          <SubjectRow icon="bg-green-50 text-green-500" name="History" count="876 Papers" />
          <SubjectRow icon="bg-orange-50 text-orange-500" name="Sociology" count="654 Papers" />
        </div>
        
        <button className="text-blue-600 font-bold text-sm mt-auto text-left hover:text-blue-700 transition-colors">
          Explore all subjects →
        </button>
      </motion.div>

      {/* Main Center Card - Question Paper */}
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.94 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="w-full md:w-[420px] bg-white rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-gray-100 p-6 md:p-8 z-30"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gray-100 p-2 rounded-lg">
            <FileText className="w-5 h-5 text-gray-700" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
              Question Paper
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs font-semibold">May–June 2023</span>
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-extrabold text-gray-900 leading-tight mb-1">
          B.A. (Hons.) Political Science
        </h3>
        <p className="text-gray-500 font-medium mb-6">Semester II</p>

        <div className="grid grid-cols-4 gap-4 mb-6 border-y border-gray-100 py-4">
          <div className="col-span-1">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">University</div>
            <div className="text-xs font-bold text-gray-800">Delhi University</div>
          </div>
          <div className="col-span-1">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Course</div>
            <div className="text-xs font-bold text-gray-800">B.A. (Hons.)</div>
          </div>
          <div className="col-span-1">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Semester</div>
            <div className="text-xs font-bold text-gray-800">II</div>
          </div>
          <div className="col-span-1">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Year</div>
            <div className="text-xs font-bold text-gray-800">May–June 2023</div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <button className="flex-1 bg-[#0A1128] text-white flex items-center justify-center gap-2 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors">
            <Eye className="w-4 h-4" /> View Paper
          </button>
          <button className="flex-1 bg-gray-50 text-gray-700 flex items-center justify-center gap-2 py-3 rounded-xl font-bold hover:bg-gray-100 border border-gray-200 transition-colors">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>

        <div>
          <h4 className="text-sm font-bold text-gray-800 mb-3">Paper Details</h4>
          <div className="space-y-2">
            <DetailRow icon={<Clock className="w-4 h-4" />} label="Duration" value="3 Hours" />
            <DetailRow icon={<Settings className="w-4 h-4" />} label="Maximum Marks" value="75" />
            <DetailRow icon={<FileText className="w-4 h-4" />} label="Type" value="Theory" />
          </div>
        </div>
      </motion.div>

      {/* Right Card - Notes & Resources */}
      <motion.div
        initial={{ opacity: 0, x: -80, y: 120, rotate: -2 }}
        whileInView={{ opacity: 1, x: 0, y: 0, rotate: 3 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex flex-col w-[280px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-gray-100 p-5 -translate-x-12 translate-y-12 z-10"
      >
        <div className="flex items-center gap-2 font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">
          <Bookmark className="w-5 h-5 text-gray-500" /> Notes & Resources
        </div>
        
        <div className="space-y-4 mb-4">
          <ResourceRow icon="bg-blue-50 text-blue-500" name="Handwritten Notes" desc="120+ Notes" />
          <ResourceRow icon="bg-yellow-50 text-yellow-500" name="Important Questions" desc="Subject-wise" />
          <ResourceRow icon="bg-purple-50 text-purple-500" name="Unit Summaries" desc="Quick Revision" />
          <ResourceRow icon="bg-pink-50 text-pink-500" name="Study Guides" desc="Exam Prep" />
        </div>
        
        <button className="text-blue-600 font-bold text-sm mt-auto text-left hover:text-blue-700 transition-colors">
          View all resources →
        </button>
      </motion.div>
    </div>
  );
}

function SubjectRow({ icon, name, count }: { icon: string, name: string, count: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded flex items-center justify-center ${icon}`}>
        <div className="w-3 h-3 rounded-full bg-current opacity-60"></div>
      </div>
      <div>
        <div className="text-sm font-bold text-gray-800 leading-none mb-1">{name}</div>
        <div className="text-xs font-medium text-gray-400">{count}</div>
      </div>
    </div>
  );
}

function ResourceRow({ icon, name, desc }: { icon: string, name: string, desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded flex items-center justify-center ${icon}`}>
        <FileText className="w-4 h-4" />
      </div>
      <div>
        <div className="text-sm font-bold text-gray-800 leading-none mb-1">{name}</div>
        <div className="text-xs font-medium text-gray-400">{desc}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-gray-500 font-medium">
        {icon}
        {label}
      </div>
      <div className="font-bold text-gray-800">{value}</div>
    </div>
  );
}

function BookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}
