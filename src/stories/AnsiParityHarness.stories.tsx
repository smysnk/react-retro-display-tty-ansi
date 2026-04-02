import type { Meta, StoryObj } from "@storybook/react-vite";
import { RetroScreen } from "../react/RetroScreen";
import { AnsiParityHarness as AnsiParityHarnessSurface } from "./ansi-parity-harness";

const meta = {
  title: "RetroScreen/Internal",
  component: RetroScreen,
  parameters: {
    controls: {
      disable: true
    },
    docs: {
      disable: true
    }
  }
} satisfies Meta<typeof RetroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnsiParityHarness: Story = {
  name: "ANSI Parity Harness",
  render: () => <AnsiParityHarnessSurface />
};
