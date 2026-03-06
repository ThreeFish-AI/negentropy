import { KNOWLEDGE_API_ENDPOINTS } from "@/features/knowledge/utils/api-specs";

const getEndpoint = (id: string) => {
  const endpoint = KNOWLEDGE_API_ENDPOINTS.find((item) => item.id === id);
  expect(endpoint).toBeDefined();
  return endpoint!;
};

describe("knowledge api specs", () => {
  it("ingest 类 JSON endpoint 使用 canonical chunking_config", () => {
    for (const id of ["ingest", "ingest_url", "replace_source"]) {
      const endpoint = getEndpoint(id);
      const properties = endpoint.requestBody?.schema.properties as
        | Record<string, unknown>
        | undefined;
      const example = endpoint.requestBody?.example as Record<string, unknown> | undefined;
      const advancedFields = endpoint.interactiveForm?.fields.filter(
        (field) => field.group === "advanced",
      );

      expect(properties).toHaveProperty("chunking_config");
      expect(properties).not.toHaveProperty("chunk_size");
      expect(properties).not.toHaveProperty("overlap");
      expect(example?.chunking_config).toMatchObject({
        strategy: "recursive",
        chunk_size: 800,
        overlap: 100,
      });
      expect(advancedFields).toHaveLength(2);
      expect(advancedFields?.[1]).toMatchObject({
        name: "chunking_config",
        type: "json",
      });
    }
  });

  it("create_corpus 使用 canonical config JSON 字段", () => {
    const endpoint = getEndpoint("create_corpus");
    const example = endpoint.requestBody?.example as Record<string, unknown> | undefined;
    const advancedFields = endpoint.interactiveForm?.fields.filter(
      (field) => field.group === "advanced",
    );

    expect(example?.config).toMatchObject({
      strategy: "recursive",
      chunk_size: 800,
      overlap: 100,
    });
    expect(advancedFields).toHaveLength(1);
    expect(advancedFields?.[0]).toMatchObject({
      name: "config",
      type: "json",
    });
  });
});
