import { useEffect, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRetroLcdController } from "../core/terminal/controller";
import type { RetroLcdGeometry } from "../core/types";
import { RetroLcd } from "../react/RetroLcd";

const STORY_COLOR = "#97ff9b";

type StoryShellProps = {
  kicker: string;
  title: string;
  copy: string;
  children: ReactNode;
  footer?: ReactNode;
};

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

function StoryShell({ kicker, title, copy, children, footer }: StoryShellProps) {
  return (
    <div className="sb-retro-page">
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

function Stage({ children, maxWidth = 860 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <div className="sb-retro-stage">
      <div className="sb-retro-frame" style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}

function EditableNotebookStory() {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState("Nothing committed yet.");

  return (
    <StoryShell
      kicker="Value Mode"
      title="A calm drafting surface."
      copy="Use the component as a controlled text area when you want the retro treatment without building a terminal protocol around it."
      footer={
        <div className="sb-retro-status">
          Last Enter press: {submitted} Shift+Enter keeps writing on the next line.
        </div>
      }
    >
      <Stage>
        <RetroLcd
          mode="value"
          value={value}
          editable
          autoFocus
          color={STORY_COLOR}
          placeholder="Write a line, breathe, then press Enter."
          onChange={setValue}
          onSubmit={(nextValue) => {
            setSubmitted(nextValue.length > 0 ? nextValue : "(empty)");
          }}
        />
      </Stage>
    </StoryShell>
  );
}

function TerminalStreamStory() {
  const [controller] = useState(() =>
    createRetroLcdController({
      rows: 9,
      cols: 46,
      cursorMode: "hollow"
    })
  );

  useEffect(() => {
    controller.reset();
    controller.setCursorMode("hollow");
    controller.setCursorVisible(true);

    const schedule = [
      window.setTimeout(() => {
        controller.writeln("BOOT   react-retro-display-tty-ansi");
      }, 400),
      window.setTimeout(() => {
        controller.writeln("CHECK  measuring rows and columns");
      }, 1050),
      window.setTimeout(() => {
        controller.write("\u001b[1mREADY\u001b[0m  controller attached");
        controller.writeln("");
      }, 1850),
      window.setTimeout(() => {
        controller.write("\u001b[2msoft state preserved for quiet hints\u001b[0m");
        controller.writeln("");
      }, 2800),
      window.setTimeout(() => {
        controller.write("\u001b[7mLIVE\u001b[0m feed bound to external events");
        controller.writeln("");
      }, 3800),
      window.setTimeout(() => {
        controller.write("\u001b[5mBLINK\u001b[0m cursor waiting for the next write");
      }, 4900)
    ];

    return () => {
      for (const timer of schedule) {
        window.clearTimeout(timer);
      }
    };
  }, [controller]);

  return (
    <StoryShell
      kicker="Terminal Mode"
      title="Drive it from outside your React tree."
      copy="Attach a controller when the display should follow logs, shell output, status feeds, or any stream of writes that already speaks terminal."
      footer={
        <ul className="sb-retro-note-list">
          <li>Useful for streaming output, simulated shells, or telemetry panes.</li>
          <li>The story writes over time so the controller path is visible, not just implied.</li>
        </ul>
      }
    >
      <Stage>
        <RetroLcd mode="terminal" controller={controller} color={STORY_COLOR} />
      </Stage>
    </StoryShell>
  );
}

function PromptConsoleStory() {
  return (
    <StoryShell
      kicker="Prompt Mode"
      title="Keep the interaction loop small."
      copy="When the UI needs a command line instead of a free-form editor, prompt mode handles the transcript, cursor, and response protocol for you."
      footer={
        <ul className="sb-retro-note-list">
          <li>Click the display and try: `status`, `scan`, `sync`, or `wipe`.</li>
          <li>Accepted commands answer with READY. Unsupported ones return DENIED.</li>
        </ul>
      }
    >
      <Stage>
        <RetroLcd
          mode="prompt"
          autoFocus
          color={STORY_COLOR}
          promptChar="$"
          acceptanceText="READY"
          rejectionText="DENIED"
          onCommand={async (command) => {
            await wait(520);

            switch (command.trim()) {
              case "status":
                return {
                  accepted: true,
                  response: ["grid synced", "cursor stable", "story ready"]
                };
              case "scan":
                return {
                  accepted: true,
                  response: ["signal sweep", "north: clear", "south: clear", "depth: nominal"]
                };
              case "sync":
                return {
                  accepted: true,
                  response: "storybook and readme now agree"
                };
              default:
                return {
                  accepted: false,
                  response: "unknown command"
                };
            }
          }}
        />
      </Stage>
    </StoryShell>
  );
}

function ResponsivePanelStory() {
  const widths = [
    { label: "Compact", value: 420 },
    { label: "Balanced", value: 620 },
    { label: "Wide", value: 840 }
  ];
  const [width, setWidth] = useState(widths[1].value);
  const [geometry, setGeometry] = useState<RetroLcdGeometry | null>(null);

  return (
    <StoryShell
      kicker="Responsive Geometry"
      title="Let the grid find its own measure."
      copy="The display sizes itself from the available space, then reports rows and columns back out when you need to align content or external state."
      footer={
        <div className="sb-retro-status">
          <span className="sb-retro-measure">
            {geometry ? `${geometry.rows} rows` : "measuring"}
          </span>
          <span className="sb-retro-measure">
            {geometry ? `${geometry.cols} cols` : "measuring"}
          </span>
          <span className="sb-retro-measure">
            {geometry ? `${Math.round(geometry.cellWidth)}px cells` : "measuring"}
          </span>
        </div>
      }
    >
      <div className="sb-retro-toolbar">
        {widths.map((entry) => (
          <button
            className="sb-retro-button"
            type="button"
            key={entry.label}
            data-active={entry.value === width}
            onClick={() => setWidth(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Stage maxWidth={width}>
        <RetroLcd
          mode="value"
          color={STORY_COLOR}
          value="A single component can live in a hero panel, a narrow card, or a command rail without losing the grid."
          onGeometryChange={setGeometry}
        />
      </Stage>
    </StoryShell>
  );
}

function FeatureTourStory() {
  const [tick, setTick] = useState(0);
  const cycleMs = 30000;
  const now = tick % cycleMs;

  useEffect(() => {
    const startedAt = window.performance.now();
    const timer = window.setInterval(() => {
      setTick(window.performance.now() - startedAt);
    }, 80);

    return () => window.clearInterval(timer);
  }, []);

  const clampProgress = (start: number, end: number) =>
    Math.max(0, Math.min(1, (now - start) / (end - start)));
  const take = (text: string, progress: number) =>
    text.slice(0, Math.max(1, Math.round(text.length * progress)));

  let phase: {
    badge: string;
    title: string;
    copy: string;
    badges: string[];
    node: ReactNode;
  };

  if (now < 7200) {
    const message = "WAKE THE GRID.\nLET THE FIRST IMPRESSION FEEL LIT FROM WITHIN.";
    phase = {
      badge: "Passive display",
      title: "Start with pure output.",
      copy: "Value mode is the quietest path in. Hand it a string and it becomes a terminal-like display with wrapping, glow, and geometry baked in.",
      badges: ["value mode", "controlled text", "zero controller"],
      node: (
        <RetroLcd
          key="feature-tour-display"
          mode="value"
          color={STORY_COLOR}
          value={take(message, clampProgress(0, 5800))}
        />
      )
    };
  } else if (now < 14800) {
    const draft = "Compose inline.\nPress Enter when the thought lands.";
    phase = {
      badge: "Editable mode",
      title: "Promote it into a drafting surface.",
      copy: "Turn on `editable` and the same component becomes an input with cursor handling, placeholders, submission hooks, and multi-line support.",
      badges: ["editable", "cursor aware", "submit hooks"],
      node: (
        <RetroLcd
          key="feature-tour-editable"
          mode="value"
          editable
          autoFocus
          color={STORY_COLOR}
          value={take(draft, clampProgress(7200, 14000))}
          placeholder="Wait for the cursor..."
        />
      )
    };
  } else if (now < 22600) {
    const frames = [
      "BOOT  react-retro-display-tty-ansi",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online\n\u001b[2msoft notes stay readable without stealing focus\u001b[0m",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online\n\u001b[2msoft notes stay readable without stealing focus\u001b[0m\n\u001b[7mLIVE\u001b[0m controller-friendly output",
      "BOOT  react-retro-display-tty-ansi\nCHECK geometry measured\n\u001b[1mREADY\u001b[0m ansi parser online\n\u001b[2msoft notes stay readable without stealing focus\u001b[0m\n\u001b[7mLIVE\u001b[0m controller-friendly output\n\u001b[5mPULSE\u001b[0m waiting for next command"
    ];
    const progress = clampProgress(14800, 22000);
    const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));

    phase = {
      badge: "Terminal stream",
      title: "Feed it real terminal output.",
      copy: "Terminal mode renders ANSI styling, scroll behavior, and cursor state, so logs and pseudo-TTYs can stay visually expressive without extra mapping.",
      badges: ["ansi", "scrolling buffer", "controller ready"],
      node: (
        <RetroLcd
          key="feature-tour-terminal"
          mode="terminal"
          color={STORY_COLOR}
          cursorMode="solid"
          value={frames[frameIndex]}
        />
      )
    };
  } else {
    const command = "status --calm";
    phase = {
      badge: "Prompt loop",
      title: "Close with a focused command line.",
      copy: "Prompt mode keeps the transcript shape tight. It is a small but expressive layer for command palettes, maintenance shells, and guided interactions.",
      badges: ["prompt session", "accept or reject", "guided commands"],
      node: (
        <RetroLcd
          key="feature-tour-prompt"
          mode="prompt"
          autoFocus
          color={STORY_COLOR}
          promptChar="$"
          value={command.slice(0, Math.max(1, Math.round(command.length * clampProgress(22600, 29400))))}
        />
      )
    };
  }

  return (
    <div className="sb-retro-page">
      <div className="sb-retro-feature-shell" data-feature-tour-root="true">
        <div className="sb-retro-feature-copy">
          <span className="sb-retro-kicker">Feature Tour</span>
          <span className="sb-retro-badge">{phase.badge}</span>
          <h1 className="sb-retro-title">{phase.title}</h1>
          <p className="sb-retro-copy">{phase.copy}</p>
          <div className="sb-retro-feature-badges">
            {phase.badges.map((badge) => (
              <span className="sb-retro-badge" key={badge}>
                {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="sb-retro-feature-stage">{phase.node}</div>
      </div>
    </div>
  );
}

const meta = {
  title: "RetroLcd",
  component: RetroLcd,
  tags: ["autodocs"],
  args: {
    color: STORY_COLOR
  }
} satisfies Meta<typeof RetroLcd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CalmReadout: Story = {
  args: {
    mode: "value",
    value:
      "A small retro surface for status, prompts, notes, and ANSI-flavored terminal output.",
    color: STORY_COLOR
  },
  render: (args) => (
    <StoryShell
      kicker="Read-Only Display"
      title="Show a message without ceremony."
      copy="The simplest user story is still worth making beautiful: drop in a value, keep the surface quiet, and let the component own wrapping, spacing, and the retro glow."
      footer={<div className="sb-retro-status">Best when the display is pure output.</div>}
    >
      <Stage>
        <RetroLcd {...args} />
      </Stage>
    </StoryShell>
  )
};

export const EditableNotebook: Story = {
  render: () => <EditableNotebookStory />
};

export const TerminalStream: Story = {
  render: () => <TerminalStreamStory />
};

export const AnsiSurface: Story = {
  render: () => (
    <StoryShell
      kicker="ANSI Styling"
      title="Use terminal emphasis without a browser theme system."
      copy="The terminal renderer already understands bold, faint, inverse, conceal, and blink sequences, so existing ANSI-flavored strings can stay intact."
      footer={
        <ul className="sb-retro-note-list">
          <li>Useful when your source text already contains terminal styling codes.</li>
          <li>Inverse and faint states map cleanly onto the LCD-inspired palette.</li>
        </ul>
      }
    >
      <Stage>
        <RetroLcd
          mode="terminal"
          color={STORY_COLOR}
          cursorMode="hollow"
          value={[
            "\u001b[1mBOLD\u001b[0m emphasis for positive signals",
            "\u001b[2mFAINT\u001b[0m context that should recede",
            "\u001b[7mINVERSE\u001b[0m state changes that need contrast",
            "conceal -> [\u001b[8mhidden payload\u001b[0m]",
            "\u001b[5mBLINK\u001b[0m for urgent but sparing motion"
          ].join("\n")}
        />
      </Stage>
    </StoryShell>
  )
};

export const PromptLoop: Story = {
  render: () => <PromptConsoleStory />
};

export const ResponsivePanel: Story = {
  render: () => <ResponsivePanelStory />
};

export const FeatureTour: Story = {
  parameters: {
    controls: {
      disable: true
    }
  },
  render: () => <FeatureTourStory />
};
