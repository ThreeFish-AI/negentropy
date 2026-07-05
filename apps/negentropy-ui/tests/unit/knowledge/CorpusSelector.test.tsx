import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CorpusRecord } from "@/features/knowledge";

// 仅 mock 组件运行时实际用到的 fetchCorpora；CorpusRecord 为类型,运行时无需导出。
const fetchCorporaMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/knowledge", () => ({
  fetchCorpora: fetchCorporaMock,
}));

import { CorpusSelector } from "@/app/knowledge/graph/_components/CorpusSelector";

const mkCorpus = (id: string, name: string): CorpusRecord => ({
  id,
  name,
  app_name: "negentropy",
  knowledge_count: 0,
});

describe("CorpusSelector 默认选中逻辑", () => {
  beforeEach(() => {
    fetchCorporaMock.mockReset();
  });

  it("提供 defaultCorpusName 且列表命中时,默认选中该语料库(即便不在首位)", async () => {
    fetchCorporaMock.mockResolvedValue([
      mkCorpus("a", "Other Corpus"),
      mkCorpus("b", "Harness Engineering"),
    ]);
    const onChange = vi.fn();

    render(
      <CorpusSelector
        value={null}
        onChange={onChange}
        defaultCorpusName="Harness Engineering"
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("b"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("列表未命中 defaultCorpusName 时,回退到列表第一个", async () => {
    fetchCorporaMock.mockResolvedValue([
      mkCorpus("a", "Other Corpus"),
      mkCorpus("c", "Another Corpus"),
    ]);
    const onChange = vi.fn();

    render(
      <CorpusSelector
        value={null}
        onChange={onChange}
        defaultCorpusName="Harness Engineering"
      />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("a"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("未提供 defaultCorpusName 时,保持旧行为:选中列表第一个", async () => {
    fetchCorporaMock.mockResolvedValue([
      mkCorpus("a", "Other Corpus"),
      mkCorpus("b", "Harness Engineering"),
    ]);
    const onChange = vi.fn();

    render(<CorpusSelector value={null} onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("a"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("已有选中值(value 非空)时不触发自动选中", async () => {
    fetchCorporaMock.mockResolvedValue([
      mkCorpus("a", "Other Corpus"),
      mkCorpus("b", "Harness Engineering"),
    ]);
    const onChange = vi.fn();

    render(
      <CorpusSelector
        value="a"
        onChange={onChange}
        defaultCorpusName="Harness Engineering"
      />,
    );

    // 等待 fetchCorpora 解析完成后,onChange 仍不应被自动调用。
    await waitFor(() => expect(fetchCorporaMock).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
  });
});
