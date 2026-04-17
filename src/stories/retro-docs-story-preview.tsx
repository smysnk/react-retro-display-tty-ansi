import { useEffect, useRef, useState, type ComponentType } from "react";
import { DocsStoryPreviewProvider } from "./docs-preview-mode";

type RetroDocsStoryPreviewProps = {
  story: ComponentType;
  storyKey: string;
  storyTitle: string;
  eager?: boolean;
};

export function RetroDocsStoryPreview({
  story: Story,
  storyKey,
  storyTitle,
  eager = false
}: RetroDocsStoryPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(eager);

  useEffect(() => {
    if (mounted) {
      return undefined;
    }

    const hostNode = hostRef.current;

    if (!hostNode || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (!isVisible) {
          return;
        }

        setMounted(true);
        observer.disconnect();
      },
      {
        rootMargin: "400px 0px"
      }
    );

    observer.observe(hostNode);

    return () => {
      observer.disconnect();
    };
  }, [mounted]);

  return (
    <article className="sb-retro-docs-story" data-docs-story={storyKey}>
      <h3 className="sb-retro-docs-story-title">{storyTitle}</h3>
      <div
        className="sb-retro-docs-story-preview-host"
        data-docs-story-preview={storyKey}
        data-mounted={mounted ? "true" : "false"}
        ref={hostRef}
      >
        {mounted ? (
          <DocsStoryPreviewProvider value>
            <Story />
          </DocsStoryPreviewProvider>
        ) : (
          <div className="sb-retro-docs-story-placeholder">
            <span>Loading preview when visible…</span>
          </div>
        )}
      </div>
    </article>
  );
}
