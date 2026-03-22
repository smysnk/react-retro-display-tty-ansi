import type { Preview } from "@storybook/react-vite";
import { RetroScreenDocsPage } from "./RetroScreenDocsPage";
import "../src/styles/retro-screen.css";
import "../src/stories/storybook.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true
    },
    backgrounds: {
      disable: true
    },
    docs: {
      page: RetroScreenDocsPage
    },
    options: {
      storySort: {
        order: ["RetroScreen"]
      }
    }
  }
};

export default preview;
