import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import type { StorybookConfig } from "@storybook/react-vite";

const require = createRequire(import.meta.url);

const getAbsolutePath = (packageName: string) =>
  dirname(require.resolve(join(packageName, "package.json")));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {}
  },
  docs: {
    autodocs: "tag"
  }
};

export default config;
