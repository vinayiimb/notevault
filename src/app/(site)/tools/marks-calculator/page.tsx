import { Metadata } from 'next';
import MarksCalculatorClient from '@/components/marks-calculator/Index';

export const metadata: Metadata = {
  title: 'DU Marks & CGPA Calculator',
  description: 'Intelligent academic planner and CGPA calculator for Delhi University.',
};

export default function MarksCalculatorPage() {
  return <MarksCalculatorClient />;
}
