import { Metadata } from "next";
import { ERDecoderClient } from "./client";

export const metadata: Metadata = {
  title: "ER & Improvement Decoder | DU Academic Intelligence",
  description: "Understand Essential Repeat (ER) and Improvement exam rules for DU students.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
          ER & Improvement Decoder
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Got an ER (Essential Repeat) or want to improve a grade? Use this tool to instantly see when you can reappear for the exam based on DU's Odd/Even semester logic.
        </p>
      </div>
      <ERDecoderClient />
    </div>
  );
}
