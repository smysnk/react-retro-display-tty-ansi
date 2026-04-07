import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";

function TouchInputStory() {
  const [eventCount, setEventCount] = useState(0);
  const [lastTouch, setLastTouch] = useState<{
    row: number;
    col: number;
    rows: number;
    cols: number;
    pointerType: string;
  } | null>(null);

  const value = useMemo(
    () =>
      [
        "┌──────────────────────────────┐",
        "│                              │",
        "│         TOUCH SURFACE        │",
        "│                              │",
        "│      Tap anywhere once       │",
        "│    and release to tap again  │",
        "│                              │",
        "│   ↑ up           right →     │",
        "│                              │",
        "│   ← left        down ↓       │",
        "│                              │",
        "└──────────────────────────────┘"
      ].join("\n"),
    []
  );

  return (
    <div
      style={{
        width: "min(960px, 100%)",
        margin: "0 auto",
        display: "grid",
        gap: "20px",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "10px",
          textAlign: "center",
          color: "rgba(242, 239, 232, 0.84)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "rgba(209, 201, 189, 0.62)",
          }}
        >
          Touch Input
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(28px, 4vw, 42px)",
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            color: "#f2efe8",
          }}
        >
          One press maps to one grid hit.
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: "760px",
            marginInline: "auto",
            lineHeight: 1.6,
          }}
        >
          This story demonstrates the built-in touch overlay. The component reports a single
          `down` event per press, ignores long-press move spam, and requires release before the
          next touch is accepted.
        </p>
      </div>

      <RetroScreen
        mode="terminal"
        gridMode="static"
        rows={12}
        cols={32}
        color="#97ff9b"
        value={value}
        touchInput={{
          enabled: true,
          overlayTestId: "retro-screen-touch-demo-overlay",
          onTouchCell: ({ row, col, rows, cols, pointerType }) => {
            setEventCount((current) => current + 1);
            setLastTouch({ row, col, rows, cols, pointerType });
          },
        }}
      />

      <div
        style={{
          display: "grid",
          gap: "12px",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div
          style={{
            borderRadius: "16px",
            border: "1px solid rgba(151, 255, 155, 0.18)",
            background: "rgba(9, 13, 16, 0.72)",
            padding: "14px 16px",
            color: "#f2efe8",
          }}
        >
          <div style={{ fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.66 }}>
            Touch Count
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "6px" }}>{eventCount}</div>
        </div>

        <div
          style={{
            borderRadius: "16px",
            border: "1px solid rgba(151, 255, 155, 0.18)",
            background: "rgba(9, 13, 16, 0.72)",
            padding: "14px 16px",
            color: "#f2efe8",
          }}
        >
          <div style={{ fontSize: "12px", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.66 }}>
            Last Cell
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "6px" }}>
            {lastTouch ? `${lastTouch.row}, ${lastTouch.col}` : "Waiting"}
          </div>
          <div style={{ marginTop: "6px", opacity: 0.72 }}>
            {lastTouch ? `${lastTouch.pointerType} on ${lastTouch.rows}x${lastTouch.cols}` : "Tap or click the screen"}
          </div>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "RetroScreen/Touch Input",
  component: RetroScreen,
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SinglePressGridHit: Story = {
  render: () => <TouchInputStory />,
};
