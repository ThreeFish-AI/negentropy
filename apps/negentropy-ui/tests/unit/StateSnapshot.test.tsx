import { render, screen } from "@testing-library/react";
import { StateSnapshot } from "../../components/ui/StateSnapshot";

describe("StateSnapshot", () => {
  it("renders empty snapshot", () => {
    render(<StateSnapshot snapshot={null} />);
    expect(screen.getByText("No State Available")).toBeInTheDocument();
  });

  it("renders snapshot json", () => {
    render(<StateSnapshot snapshot={{ a: 1 }} />);
    // JsonViewer renders the object with specific structure
    // Use getAllByText and verify we get the JSON key element
    const elements = screen.getAllByText((content) => content.includes('"a":'));
    expect(elements.length).toBeGreaterThan(0);
  });
});
