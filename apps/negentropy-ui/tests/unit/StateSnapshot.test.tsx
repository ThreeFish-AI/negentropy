import { render, screen } from "@testing-library/react";
import { StateSnapshot } from "../../components/ui/StateSnapshot";

describe("StateSnapshot", () => {
  it("renders empty snapshot", () => {
    render(<StateSnapshot snapshot={null} />);
    expect(screen.getByText("No snapshot")).toBeInTheDocument();
  });

  it("renders snapshot json", () => {
    render(<StateSnapshot snapshot={{ a: 1 }} />);
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });
});
