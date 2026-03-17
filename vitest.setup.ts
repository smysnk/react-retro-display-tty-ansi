import "@testing-library/jest-dom/vitest";
import "./src/styles/retro-lcd.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
