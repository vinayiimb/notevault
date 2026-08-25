'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl rounded-full transition-all duration-300 flex items-center justify-between px-6 py-4 ${
          isScrolled
            ? 'bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100'
            : 'bg-white shadow-[0_4px_20px_rgb(0,0,0,0.02)] border border-gray-50'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 z-50">
          <span className="font-extrabold text-xl tracking-tight text-gray-900">
            DU PYQ <span className="font-medium text-gray-500">Online</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <Link href="/pyp" className="hover:text-gray-900 transition-colors">PYQs</Link>
          <Link href="/notes" className="hover:text-gray-900 transition-colors">Notes</Link>
          <Link href="/subjects" className="hover:text-gray-900 transition-colors">Subjects</Link>
          <Link href="/solutions" className="hover:text-gray-900 transition-colors">Solutions</Link>
          <Link href="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
            Log in
          </Link>
          <Link href="/browse" className="text-sm font-bold bg-[#0A1128] text-white px-5 py-2.5 rounded-full hover:bg-gray-800 transition-colors">
            Browse free
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden z-50 p-2 text-gray-600"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden">
          <div className="flex flex-col gap-6 text-lg font-medium text-gray-800">
            <Link href="/pyp" onClick={() => setMobileMenuOpen(false)}>PYQs</Link>
            <Link href="/notes" onClick={() => setMobileMenuOpen(false)}>Notes</Link>
            <Link href="/subjects" onClick={() => setMobileMenuOpen(false)}>Subjects</Link>
            <Link href="/solutions" onClick={() => setMobileMenuOpen(false)}>Solutions</Link>
            <Link href="/blog" onClick={() => setMobileMenuOpen(false)}>Blog</Link>
            <hr className="border-gray-100 my-2" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
            <Link href="/browse" className="text-center font-bold bg-[#0A1128] text-white px-5 py-3 rounded-full" onClick={() => setMobileMenuOpen(false)}>
              Browse free
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
