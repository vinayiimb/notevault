'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';

export default function FloatingStudyObjects() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position between -1 and 1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDesktop]);

  // Scroll animations for backpack (bottom-left)
  const backpackY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const backpackX = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const backpackScale = useTransform(scrollYProgress, [0, 0.5], [0.85, 1]);
  const backpackRotate = useTransform(scrollYProgress, [0, 1], [-5, 0]);

  // Scroll animations for calculator (bottom-right)
  const calcY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const calcScale = useTransform(scrollYProgress, [0, 0.5], [0.85, 1]);
  const calcRotate = useTransform(scrollYProgress, [0, 1], [5, -2]);

  // Scroll animations for notebook (top-left)
  const notebookY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const notebookRotate = useTransform(scrollYProgress, [0, 1], [-2, -8]);

  // Scroll animations for textbook (top-right)
  const textbookY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const textbookX = useTransform(scrollYProgress, [0, 1], [0, 40]);

  // Scroll animations for highlighter (left, middle)
  const highlighterX = useTransform(scrollYProgress, [0, 1], [-40, 20]);
  const highlighterRotate = useTransform(scrollYProgress, [0, 1], [-15, -5]);

  // Scroll animations for formula sheet (right, middle)
  const formulaY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const formulaRotate = useTransform(scrollYProgress, [0, 1], [2, 10]);

  // Helper for mouse parallax (only on desktop)
  const getMouseParallax = (multiplier: number) => {
    if (!isDesktop) return { x: 0, y: 0 };
    return {
      x: mousePosition.x * multiplier,
      y: mousePosition.y * multiplier
    };
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none overflow-visible">
      {/* Notebook - Top Left */}
      <motion.div
        className="absolute top-[5%] -left-[10%] md:left-[2%] w-[250px] md:w-[320px] mix-blend-multiply opacity-90"
        style={{
          y: notebookY,
          rotate: notebookRotate,
          x: getMouseParallax(8).x,
        }}
      >
        <Image src="/images/landing/du_notebook_1787162511450.jpg" alt="Notebook" width={400} height={400} className="w-full h-auto" priority />
      </motion.div>

      {/* Highlighter - Middle Left */}
      {isDesktop && (
        <motion.div
          className="absolute top-[35%] -left-[5%] md:left-[5%] w-[150px] mix-blend-multiply opacity-95"
          style={{
            x: highlighterX,
            rotate: highlighterRotate,
            y: getMouseParallax(12).y,
          }}
        >
          <Image src="/images/landing/du_highlighter_1787163544609.jpg" alt="Highlighter" width={200} height={200} className="w-full h-auto" />
        </motion.div>
      )}

      {/* Backpack - Bottom Left */}
      <motion.div
        className="absolute bottom-[-10%] md:bottom-[-20%] -left-[15%] md:-left-[5%] w-[300px] md:w-[450px] mix-blend-multiply opacity-95"
        style={{
          y: backpackY,
          x: backpackX,
          scale: backpackScale,
          rotate: backpackRotate,
          translateX: getMouseParallax(15).x,
        }}
      >
        <Image src="/images/landing/du_backpack_1787162495452.jpg" alt="Backpack" width={600} height={600} className="w-full h-auto" priority />
      </motion.div>

      {/* Textbook - Top Right */}
      {isDesktop && (
        <motion.div
          className="absolute top-[2%] -right-[15%] md:-right-[2%] w-[220px] md:w-[350px] mix-blend-multiply opacity-90"
          style={{
            y: textbookY,
            x: textbookX,
            rotate: 15,
            translateX: getMouseParallax(10).x,
          }}
        >
          <Image src="/images/landing/du_textbook_1787163558906.jpg" alt="Textbook" width={500} height={500} className="w-full h-auto" priority />
        </motion.div>
      )}

      {/* Sticky Notes - Middle Right */}
      {isDesktop && (
        <motion.div
          className="absolute top-[35%] right-[5%] w-[120px] mix-blend-multiply opacity-90"
          style={{
            rotate: -10,
            y: useTransform(scrollYProgress, [0, 1], [0, 30]),
            x: getMouseParallax(6).x,
          }}
        >
          <Image src="/images/landing/du_sticky_notes_1787163598811.jpg" alt="Sticky Notes" width={200} height={200} className="w-full h-auto" />
        </motion.div>
      )}

      {/* Formula Sheet - Lower Right */}
      {isDesktop && (
        <motion.div
          className="absolute top-[50%] -right-[5%] md:right-[2%] w-[200px] md:w-[280px] mix-blend-multiply opacity-80"
          style={{
            y: formulaY,
            rotate: formulaRotate,
            x: getMouseParallax(8).x,
          }}
        >
          <Image src="/images/landing/du_formula_sheet_1787163611222.jpg" alt="Formula Sheet" width={400} height={400} className="w-full h-auto" />
        </motion.div>
      )}

      {/* Calculator - Bottom Right */}
      <motion.div
        className="absolute bottom-[0%] md:bottom-[-15%] -right-[5%] md:right-[5%] w-[180px] md:w-[280px] mix-blend-multiply opacity-95"
        style={{
          y: calcY,
          scale: calcScale,
          rotate: calcRotate,
          translateX: getMouseParallax(12).x,
        }}
      >
        <Image src="/images/landing/du_calculator_1787161924840.jpg" alt="Calculator" width={400} height={400} className="w-full h-auto" priority />
      </motion.div>
      
      {/* Pen - Floating near center-right */}
      {isDesktop && (
        <motion.div
          className="absolute top-[45%] right-[25%] w-[160px] mix-blend-multiply opacity-90"
          style={{
            y: useTransform(scrollYProgress, [0, 1], [-20, 20]),
            x: useTransform(scrollYProgress, [0, 1], [50, 0]),
            rotate: useTransform(scrollYProgress, [0, 1], [4, -2]),
            translateX: getMouseParallax(20).x,
            translateY: getMouseParallax(20).y,
          }}
        >
          <Image src="/images/landing/du_pen_1787163672062.jpg" alt="Pen" width={300} height={300} className="w-full h-auto" />
        </motion.div>
      )}
    </div>
  );
}
