import { render, screen } from "@testing-library/react";
import { EventTimeline, type TimelineItem } from "../../components/ui/EventTimeline";

describe("EventTimeline", () => {
  it("renders empty state", () => {
    render(<EventTimeline events={[]} />);
    expect(screen.getByText("暂无事件")).toBeInTheDocument();
  });

  it("renders artifact and state cards", () => {
    const events: TimelineItem[] = [
      {
        id: "a1",
        kind: "artifact",
        title: "Artifact",
        content: { foo: "bar" },
        timestamp: 1,
      },
      {
        id: "s1",
        kind: "state",
        title: "State Delta",
        content: [{ op: "add", path: "/x", value: 1 }],
        timestamp: 1,
      },
    ];
    render(<EventTimeline events={events} />);
    expect(screen.getByText("Artifact")).toBeInTheDocument();
    expect(screen.getByText("State Delta")).toBeInTheDocument();
  });

  it("renders tool card with args/result", () => {
    const events: TimelineItem[] = [
      {
        id: "t1",
        kind: "tool",
        name: "doThing",
        args: "{\"x\":1}",
        result: "ok",
        status: "done",
      },
    ];
    render(<EventTimeline events={events} />);
    expect(screen.getByText("doThing")).toBeInTheDocument();
    expect(screen.getByText("{\"x\":1}")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
