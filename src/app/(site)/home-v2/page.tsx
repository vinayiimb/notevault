import { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import FloatingStudyObjects from '@/components/landing/FloatingStudyObjects';
import HeroContent from '@/components/landing/HeroContent';
import HeroCards from '@/components/landing/HeroCards';

export const metadata: Metadata = {
  title: 'DU PYQ Online | Delhi University Question Papers & Notes',
  description: 'Access Delhi University previous year question papers, notes, and exam resources in one place. Study smarter with quick search, subject-wise browsing, and free access.',
};

export default function HomeV2() {
  return (
    <div className="relative min-h-[150vh] bg-white overflow-hidden selection:bg-blue-100 selection:text-blue-900 font-sans">
      <Navbar />
      
      <main className="relative pt-24 md:pt-32 pb-40 min-h-screen flex flex-col items-center">
        {/* The floating objects component handles all the parallax imagery */}
        <FloatingStudyObjects />
        
        {/* Main textual content in the hero */}
        <HeroContent />
        
        {/* The floating interface cards at the bottom of the hero */}
        <HeroCards />
      </main>

      {/* Decorative gradient blur at the bottom for smooth transition to next section if added later */}
      <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />
    </div>
  );
}
