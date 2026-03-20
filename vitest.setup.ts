import "@testing-library/jest-dom/vitest";
import "./src/styles/retro-screen.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
