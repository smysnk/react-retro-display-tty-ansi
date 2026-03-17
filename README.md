<video src="https://github.com/user-attachments/assets/6d8ca42a-2721-42cd-8344-e57a751ef595" autoplay controls loop muted playsinline title="Feature Tour Demo">
  Your browser does not support the video tag.
</video>

# react-retro-display-tty-ansi

[![npm version](https://img.shields.io/npm/v/react-retro-display-tty-ansi.svg)](https://www.npmjs.com/package/react-retro-display-tty-ansi)
[![test-station](https://github.com/smysnk/react-retro-display-tty-ansi/actions/workflows/test.yml/badge.svg?branch=main&label=test-station)](https://test-station.smysnk.com/projects/react-retro-display-tty-ansi)

`react-retro-display-tty-ansi` is a React component for calm, terminal-flavored interfaces.
It can be a read-only display, a controlled editable surface, a controller-driven terminal,
or a small command prompt without changing visual language. It also understands ANSI styling,
semantic display color modes, and an xterm-checked terminal behavior surface for real control
character playback. It can also project itself onto either dark or light LCD glass without
asking the whole app shell to follow.

Latest test report: [test-station.smysnk.com/projects/react-retro-display-tty-ansi](https://test-station.smysnk.com/projects/react-retro-display-tty-ansi)

## Getting Started

Install the package, bring in the shared stylesheet, and start with the simplest thing:

```bash
npm install react-retro-display-tty-ansi
```

```tsx
import { RetroLcd } from "react-retro-display-tty-ansi";
import "react-retro-display-tty-ansi/styles.css";

export function StatusCard() {
  return (
    <RetroLcd
      mode="value"
      value="SYSTEM READY"
      color="#97ff9b"
    />
  );
}
```

That is the whole entry point.
You hand the component a mode, a value or controller when needed, and let it handle the grid,
wrapping, cursor rendering, and terminal feel.

## Display Padding

Use `displayPadding` when the screen content should sit tighter to the glass or breathe a little
more. The prop accepts:

- a number for uniform pixel padding
- a CSS length string for uniform padding
- an object with `block` and `inline`
- an object with per-side `top`, `right`, `bottom`, and `left`

```tsx
<RetroLcd mode="value" value="Tight framing" displayPadding={8} />

<RetroLcd mode="value" value="Room to breathe" displayPadding="1.25rem" />

<RetroLcd
  mode="terminal"
  displayPadding={{ block: 10, inline: 14 }}
  value="measured from the padded screen area"
/>

<RetroLcd
  mode="prompt"
  displayPadding={{ top: 6, right: 10, bottom: 12, left: 10 }}
/>
```

Because rows and columns are measured from the visible screen area, tighter padding yields a
denser grid and looser padding yields fewer cells.

## Light And Dark Surface Modes

Use `displaySurfaceMode` when the LCD itself should read like a light instrument panel or a
dark night-ops surface. This is separate from the host page theme, so the same component can
sit inside bright docs, dark dashboards, or a side-by-side comparison view.

<video src="https://github.com/user-attachments/assets/5dd0a2ec-acea-4e8c-a988-e3a8ce42362e" autoplay controls loop muted playsinline title="Light And Dark Hosts Demo">
  Your browser does not support the video tag.
</video>

```tsx
<RetroLcd
  mode="value"
  value="LIGHT SHELL\nWarm notes for bright workspaces."
  displaySurfaceMode="light"
  displayColorMode="phosphor-amber"
  displayPadding={{ block: 12, inline: 14 }}
/>

<RetroLcd
  mode="value"
  value="DARK SHELL\nNight-shift console stays grounded."
  displaySurfaceMode="dark"
  displayColorMode="phosphor-green"
  displayPadding={{ block: 12, inline: 14 }}
/>
```

Reach for `displaySurfaceMode="light"` when the LCD should feel like paper, enamel, or a sunlit
instrument panel. Keep `displaySurfaceMode="dark"` for the classic terminal-glass look.

## Modes Of Use

### 1. Quiet output

Use `mode="value"` when the display is just there to speak.

<video src="https://github.com/user-attachments/assets/df1d92f1-3ce4-48b8-aecb-23732d01bb5b" autoplay controls loop muted playsinline title="Quiet Output Demo">
  Your browser does not support the video tag.
</video>

```tsx
<RetroLcd
  mode="value"
  value="LINK STABLE\nAwaiting operator input."
/>
```

### 2. Editable drafting

Turn on `editable` when you want the same surface to behave like a controlled input.

<video src="https://github.com/user-attachments/assets/128ae33f-6dc7-467f-8ebc-bb09759d4341" autoplay controls loop muted playsinline title="Editable Drafting Demo">
  Your browser does not support the video tag.
</video>

```tsx
import { useState } from "react";

export function DraftPad() {
  const [value, setValue] = useState("");

  return (
    <RetroLcd
      mode="value"
      value={value}
      editable
      autoFocus
      placeholder="Write a line, then press Enter."
      onChange={setValue}
      onSubmit={(submitted) => {
        console.log("submitted:", submitted);
      }}
    />
  );
}
```

### 3. Terminal output from a controller

Use a controller when the display should follow external writes over time.

<video src="https://github.com/user-attachments/assets/e422599f-f233-4f24-9b2f-44912eb69944" autoplay controls loop muted playsinline title="Terminal Output Demo">
  Your browser does not support the video tag.
</video>

```tsx
import { useEffect } from "react";
import {
  RetroLcd,
  createRetroLcdController
} from "react-retro-display-tty-ansi";

const controller = createRetroLcdController({
  rows: 9,
  cols: 46,
  cursorMode: "hollow"
});

export function StreamedTerminal() {
  useEffect(() => {
    controller.reset();
    controller.writeln("BOOT  react-retro-display-tty-ansi");
    controller.write("\u001b[1mREADY\u001b[0m ansi parser online");
  }, []);

  return <RetroLcd mode="terminal" controller={controller} />;
}
```

If you already have a terminal-like buffer as a string, `mode="terminal"` also accepts `value`
or `initialBuffer`.

### 4. Prompt-first interaction

Use `mode="prompt"` when the interface should feel like a guided shell.

<video src="https://github.com/user-attachments/assets/701eb6a5-8c0f-4537-b9d9-f6f1ee9125b4" autoplay controls loop muted playsinline title="Prompt Interaction Demo">
  Your browser does not support the video tag.
</video>

```tsx
<RetroLcd
  mode="prompt"
  autoFocus
  promptChar="$"
  acceptanceText="READY"
  rejectionText="DENIED"
  onCommand={async (command) => {
    if (command === "status") {
      return {
        accepted: true,
        response: ["grid synced", "cursor stable"]
      };
    }

    return {
      accepted: false,
      response: "unknown command"
    };
  }}
/>
```

## Display Buffer And Follow Mode

Terminal and prompt surfaces now expose a real display buffer instead of only showing the live
viewport. That means you can scroll back through recent output, inspect older lines, then return
to the live tail when you are ready to follow the stream again.

Built-in behavior:

- `PageUp` and `PageDown` move through the display buffer
- mouse wheel scrolling moves through the same history
- `End` returns terminal mode to the live tail
- auto-follow starts enabled, turns off when you scroll back, and turns back on when you return to the bottom

Use `bufferSize` to control how many rows of history the component-managed terminal or prompt
surface keeps, and `defaultAutoFollow` if you want the view to start detached from the tail.

```tsx
<RetroLcd
  mode="terminal"
  bufferSize={400}
  defaultAutoFollow
  value={[
    "line-01  warm boot",
    "line-02  telemetry stable",
    "line-03  waiting for operator"
  ].join("\n")}
/>
```

If you are driving the component with your own controller, configure the underlying buffer size on
the controller itself:

```tsx
const controller = createRetroLcdController({
  rows: 9,
  cols: 46,
  scrollback: 400
});

<RetroLcd mode="terminal" controller={controller} />
```

The browser suite now covers this path directly, including paging, wheel scrolling, anchored
scrollback while new lines arrive, and auto-follow recovery back to the live tail.

## Auto Resize And Geometry Probing

When rows and columns matter to the program inside the display, listen to `onGeometryChange`,
turn that measurement into a terminal-style reply, and redraw from the reported size. The demo
below simulates a terminal app issuing `CSI 18 t`, receiving `CSI 8;<rows>;<cols>t`, then
repainting a full border and centered dimensions every time the DOM element resizes. The current
demo also cycles through tight screen padding, multiple border alphabets, oversized glyph styles,
and every monochrome plus ANSI display mode so the same terminal program can be watched under
different visual projections.

<video src="https://github.com/user-attachments/assets/f1b457ad-e086-4e34-b6a2-c11bf1986298" autoplay controls loop muted playsinline title="Auto Resize Probe Demo">
  Your browser does not support the video tag.
</video>

```tsx
import {
  RetroLcd,
  createRetroLcdController
} from "react-retro-display-tty-ansi";

const controller = createRetroLcdController({
  rows: 9,
  cols: 34,
  cursorMode: "solid"
});

export function ResizingTerminalProbe() {
  return (
    <RetroLcd
      mode="terminal"
      controller={controller}
      displayPadding={{ block: 8, inline: 10 }}
      onGeometryChange={(geometry) => {
        const nextReply = `\u001b[8;${geometry.rows};${geometry.cols}t`;

        console.log("terminal reply:", nextReply);
        controller.reset();
        controller.resize(geometry.rows, geometry.cols);
        redrawBorderAndMetrics(controller, geometry.rows, geometry.cols);
      }}
    />
  );
}
```

This is useful for terminal-style dashboards, resize-aware prompts, or retro UIs that need to
center content, draw frames, or adapt layouts from the actual LCD grid instead of from CSS alone.
It is also a good place to project `displayColorMode` changes when you want the terminal behavior
to stay fixed while the display mood shifts around it.

## Terminal Color Modes

Use `displayColorMode` to decide how semantic terminal color should be projected onto the screen.
The phosphor modes keep the retro LCD personality even when the source emits ANSI color. The ANSI
modes preserve more of the source terminal palette.

<video src="https://github.com/user-attachments/assets/9e3f99a4-512c-4dc6-a962-9bc3fb6c6eb1" autoplay controls loop muted playsinline title="Display Color Modes Demo">
  Your browser does not support the video tag.
</video>

Available modes:

- `phosphor-green`
- `phosphor-amber`
- `phosphor-ice`
- `ansi-classic`
- `ansi-extended`

```tsx
<RetroLcd
  mode="terminal"
  displayColorMode="ansi-extended"
  value={[
    "\u001b[31mALERT\u001b[0m \u001b[32mlink stable\u001b[0m",
    "\u001b[38;5;196mindexed 196\u001b[0m from the 256-color palette",
    "\u001b[38;2;255;180;120mtruecolor 255,180,120\u001b[0m"
  ].join("\n")}
/>
```

Reach for `ansi-classic` when you want the familiar 16-color terminal profile, or
`ansi-extended` when 256-color and truecolor cells should survive all the way to the display.

## Control-Character Playback

The terminal path is now tested against an xterm oracle and can faithfully replay real control
character effects like carriage return rewrites, erase-in-line, scroll regions, insert-line
updates, ANSI 16-color, indexed 256-color, and truecolor output.

<video src="https://github.com/user-attachments/assets/b022b96b-6f16-4181-9721-f822f8f97da9" autoplay controls loop muted playsinline title="Control Character Replay Demo">
  Your browser does not support the video tag.
</video>

```tsx
import {
  RetroLcd,
  createRetroLcdController
} from "react-retro-display-tty-ansi";

const controller = createRetroLcdController({ rows: 6, cols: 34 });

controller.write("Downloading fixtures... 12%");
controller.write("\rDownloading fixtures... 73%");
controller.write("\r\u001b[32mDownloaded fixtures.\u001b[0m\u001b[K\r\n");
controller.write("\u001b[2;6r");
controller.write(
  "\u001b[6;1H\u001b[L\u001b[38;2;255;180;120mrecorded regression fixture\u001b[0m"
);

<RetroLcd
  mode="terminal"
  controller={controller}
  displayColorMode="ansi-extended"
/>
```

The same trace fixtures used in Storybook are also exercised in the terminal verification layers:

```bash
yarn test:conformance
yarn test:e2e
```

## Ease Of Integration

The component is intentionally small at the edge:

- Start with `mode="value"` when all you need is a beautiful terminal-like readout.
- Add `editable` if the content should be controlled by React state.
- Switch to `mode="terminal"` when output is driven by a stream or controller.
- Switch to `mode="prompt"` when commands and responses should live in one transcript.
- Listen to `onGeometryChange` if rows and columns matter to the rest of your app.

## Storybook

Storybook now acts as the living demo surface for the package.
It includes stories for the main user journeys:

- read-only display
- editable drafting
- controller-fed terminal output
- display buffer paging and follow mode
- auto-resize geometry probing
- ANSI styling
- display color mode projection
- light and dark surface modes
- control-character replay fixtures
- prompt interaction
- responsive geometry
- a capture-ready feature tour

Run it locally with:

```bash
npm install
npm run storybook
```

## Development

```bash
npm install
npm run build
npm run test
npm run test:unit
npm run storybook
```
