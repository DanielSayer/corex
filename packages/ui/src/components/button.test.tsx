import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders accessible button content in jsdom", () => {
    render(<Button type="button">Plan next week</Button>);

    const button = screen.getByRole("button", { name: "Plan next week" });

    expect(button).toBeDefined();
    expect(button.getAttribute("disabled")).toBeNull();
  });
});
