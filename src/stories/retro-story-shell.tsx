import type { ReactNode } from "react";
import { useDocsStoryPreviewMode } from "./docs-preview-mode";

export type StoryShellProps = {
  kicker: string;
  title: string;
  copy: string;
  children: ReactNode;
  footer?: ReactNode;
};

export type StageProps = {
  children: ReactNode;
  maxWidth?: number;
};

export type CaptureStageProps = {
  captureId: string;
  children: ReactNode;
  maxWidth?: number;
};

export function StoryShell({ kicker, title, copy, children, footer }: StoryShellProps) {
  const docsPreviewMode = useDocsStoryPreviewMode();

  return (
    <div className={`sb-retro-page${docsPreviewMode ? " sb-retro-page--docs-preview" : ""}`}>
      <div className="sb-retro-shell">
        <div className="sb-retro-heading">
          <span className="sb-retro-kicker">{kicker}</span>
          <h1 className="sb-retro-title">{title}</h1>
          <p className="sb-retro-copy">{copy}</p>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function Stage({ children, maxWidth = 860 }: StageProps) {
  return (
    <div className="sb-retro-stage">
      <div className="sb-retro-frame" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}

export function CaptureStage({ captureId, children, maxWidth = 860 }: CaptureStageProps) {
  return (
    <div className="sb-retro-page sb-retro-page--capture">
      <div className="sb-retro-shell sb-retro-shell--capture">
        <div className="sb-retro-stage sb-retro-stage--capture">
          <div className="sb-retro-frame" style={{ maxWidth }}>
            <div className="sb-retro-capture-root" data-demo-capture={captureId}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
