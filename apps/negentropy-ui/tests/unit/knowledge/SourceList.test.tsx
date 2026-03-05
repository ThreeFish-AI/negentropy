import { fireEvent, render, screen } from "@testing-library/react";

import { SourceList } from "@/app/knowledge/base/_components/SourceList";

describe("SourceList display name behavior", () => {
  it("优先展示并透传 display_name，而不是 source_uri", () => {
    const onDeleteSource = vi.fn();

    render(
      <SourceList
        sources={[
          {
            source_uri: "gs://kb-bucket/knowledge/negentropy/corpus/report_v1.pdf",
            display_name: "Q1 Report 2026 final.pdf",
            count: 3,
            archived: false,
            source_type: "file",
          },
        ]}
        selectedUri={undefined}
        onSelect={vi.fn()}
        onDeleteSource={onDeleteSource}
      />,
    );

    const sourceButton = screen.getByTitle("Q1 Report 2026 final.pdf");
    expect(sourceButton).toBeInTheDocument();
    expect(screen.queryByTitle("gs://kb-bucket/knowledge/negentropy/corpus/report_v1.pdf")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Source actions"));
    fireEvent.click(screen.getByText("Delete"));

    expect(onDeleteSource).toHaveBeenCalledWith({
      uri: "gs://kb-bucket/knowledge/negentropy/corpus/report_v1.pdf",
      name: "Q1 Report 2026 final.pdf",
    });
  });
});
