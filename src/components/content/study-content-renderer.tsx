import type { StudyContentBlock } from "@/lib/content/content-block-schema";
import { ContentThemeProvider } from "@/components/content/notes/theme-provider";
import { ContentLightboxProvider } from "@/components/content/notes/note-image";
import { NotesMarkdown } from "@/components/content/notes/notes-markdown";
import { ContentMermaidBlock } from "@/components/content/notes/mermaid-block";
import { Math as MathBlock } from "@/components/content/math-renderer";
import { ResponsiveTable } from "@/components/content/responsive-table";
import { DataChart } from "@/components/subjects/data-chart";
import { StudyImage } from "@/components/content/study-image";
import { CalloutBox } from "@/components/content/callout-box";
import { PracticeQuiz } from "@/components/content/practice-quiz";
import { PDFViewer } from "@/components/pyq/pdf-viewer";

// The unified renderer for one ordered list of StudyContentBlocks — a
// question's contentBlocks, or a single saved block in the Content Blocks
// library preview. Wraps every block in one shared ContentThemeProvider /
// ContentLightboxProvider pair (the default "ocean" preset — this context
// has no per-subject Note Designer theme to resolve) so mermaid diagrams
// and images render correctly regardless of which block types are present.
export function StudyContentRenderer({ blocks }: { blocks: StudyContentBlock[] }) {
  return (
    <ContentThemeProvider>
      <ContentLightboxProvider>
        <div className="flex flex-col gap-5">
          {blocks.map((block) => (
            <StudyContentBlockView key={block.id} block={block} />
          ))}
        </div>
      </ContentLightboxProvider>
    </ContentThemeProvider>
  );
}

function StudyContentBlockView({ block }: { block: StudyContentBlock }) {
  switch (block.type) {
    case "markdown":
      return <NotesMarkdown content={block.content} />;
    case "latex":
      return <MathBlock expression={block.expression} displayMode={block.displayMode} />;
    case "mermaid":
      return <ContentMermaidBlock chart={block.chart} />;
    case "table":
      return (
        <ResponsiveTable
          headers={block.headers}
          rows={block.rows}
          caption={block.caption}
          highlightRows={block.highlightRows}
          stickyFirstColumn={block.stickyFirstColumn}
        />
      );
    case "chart":
      return (
        <DataChart
          source={[
            `type: ${block.chartType}`,
            `title: ${block.title}`,
            `labels: ${block.labels.join(", ")}`,
            `values: ${block.values.join(", ")}`,
          ].join("\n")}
        />
      );
    case "image":
      return <StudyImage src={block.src} alt={block.alt} caption={block.caption} source={block.source} />;
    case "pdf":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          <PDFViewer url={block.url} downloadable={block.downloadable} />
        </div>
      );
    case "callout":
      return <CalloutBox variant={block.variant} title={block.title} content={block.content} />;
    case "quiz":
      return (
        <PracticeQuiz
          question={block.question}
          options={block.options}
          correctAnswer={block.correctAnswer}
          explanation={block.explanation}
        />
      );
  }
}
