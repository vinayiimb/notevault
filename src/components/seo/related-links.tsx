import Link from "next/link";
import { MoveRight } from "lucide-react";

interface RelatedLink {
  title: string;
  url: string;
  type?: 'pyq' | 'notes' | 'test' | 'syllabus' | 'important';
}

interface Props {
  title?: string;
  links: RelatedLink[];
}

export function RelatedLinks({ title = "Students also study", links }: Props) {
  if (!links || links.length === 0) return null;

  return (
    <section className="mt-16 pt-8 border-t border-gray-200">
      <h3 className="text-xl font-bold text-gray-900 mb-6">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link, i) => (
          <Link 
            key={i} 
            href={link.url}
            className="group flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                {link.title}
              </span>
              {link.type && (
                <span className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">
                  {link.type.replace('-', ' ')}
                </span>
              )}
            </div>
            <MoveRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </section>
  );
}
