"use client";

import { useState } from "react";
import { Bookmark, BookmarkSimple, SpeakerHigh } from "@phosphor-icons/react";

interface WordOfTheDayProps {
  word?: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
}

export function WordOfTheDay({
  word = "Equanimity",
  phonetic = "/ˌɛkwəˈnɪmɪti/",
  partOfSpeech = "noun",
  definition = "Mental calmness, composure, and evenness of temper, especially in a difficult situation.",
  example = "She accepted both the praise and the criticism with quiet equanimity.",
}: WordOfTheDayProps) {
  const [saved, setSaved] = useState(false);

  const speak = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
        WORD OF THE DAY
      </h3>

      {/* Main Card */}
      <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {word}
              </h4>
              <button
                type="button"
                onClick={speak}
                title="Pronounce word"
                className="flex size-7 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/40 text-[#3168FF] hover:bg-[#3168FF] hover:text-white transition-colors"
              >
                <SpeakerHigh size={15} weight="bold" />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span className="font-mono">{phonetic}</span>
              <span>•</span>
              <span className="italic font-medium">{partOfSpeech}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSaved(!saved)}
            title={saved ? "Remove bookmark" : "Save word"}
            className="flex size-9 items-center justify-center rounded-xl bg-[#F4F5F7] dark:bg-gray-800 text-gray-500 hover:text-gray-900 transition-colors"
          >
            {saved ? (
              <Bookmark size={18} weight="fill" className="text-[#FF7527]" />
            ) : (
              <BookmarkSimple size={18} weight="bold" />
            )}
          </button>
        </div>

        {/* Definition & Example */}
        <div className="mt-5 space-y-2.5 rounded-2xl bg-[#F8F9FB] dark:bg-[#20232C] p-4.5 text-sm">
          <p className="text-gray-700 dark:text-gray-200">
            <span className="font-bold text-[#FF7527] mr-1">Def:</span>
            {definition}
          </p>
          <p className="text-gray-600 dark:text-gray-400 italic">
            <span className="font-bold not-italic text-gray-800 dark:text-gray-300 mr-1">Ex:</span>
            &quot;{example}&quot;
          </p>
        </div>
      </div>
    </section>
  );
}
