import { afterEach, describe, expect, it, vi } from "vitest";

const patConfig = {
  url: "https://confluence.example.com",
  apiBaseUrl: "https://confluence.example.com/rest/api",
  authType: "pat" as const,
  personalToken: "pat-token",
  source: "test",
};

const basicConfig = {
  url: "https://confluence.example.com",
  apiBaseUrl: "https://confluence.example.com/rest/api",
  authType: "basic" as const,
  username: "alice",
  password: "secret",
  source: "test",
};

function mockAxios() {
  const client = {
    get: vi.fn(async () => ({ data: { ok: true }, headers: { "content-type": "application/json" } })),
    post: vi.fn(async () => ({ data: { ok: true } })),
    put: vi.fn(async () => ({ data: { ok: true } })),
    delete: vi.fn(async () => ({ data: { ok: true } })),
    request: vi.fn(async () => ({ data: { ok: true } })),
  };
  const axiosMock = {
    create: vi.fn(() => client),
    isAxiosError: vi.fn((error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError)),
  };
  vi.doMock("axios", () => ({ default: axiosMock }));
  return { axiosMock, client };
}

function axiosError(status: number, data: unknown) {
  return { isAxiosError: true, message: "boom", response: { status, data } };
}

describe("ConfluenceHttpClient", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates PAT and Basic axios clients with expected auth config", async () => {
    const { axiosMock } = mockAxios();
    const { ConfluenceHttpClient } = await import("../../src/core/http.js");

    new ConfluenceHttpClient(patConfig);
    new ConfluenceHttpClient(basicConfig);

    expect(axiosMock.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      baseURL: patConfig.apiBaseUrl,
      timeout: 30_000,
      auth: undefined,
      headers: expect.objectContaining({ Accept: "application/json", Authorization: "Bearer pat-token" }),
    }));
    expect(axiosMock.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      auth: { username: "alice", password: "secret" },
      headers: { Accept: "application/json" },
    }));
  });

  it("sends JSON requests and normalizes axios errors", async () => {
    const { client } = mockAxios();
    client.request.mockRejectedValueOnce(axiosError(500, { message: "server" }));
    const { ConfluenceHttpClient } = await import("../../src/core/http.js");
    const http = new ConfluenceHttpClient(patConfig);

    await expect(http.post("/content", { title: "T" })).resolves.toEqual({ ok: true });
    await expect(http.request("POST", "/bad", {}, { ok: false })).rejects.toThrow("Confluence request failed (500)");

    expect(client.post).toHaveBeenCalledWith("/content", { title: "T" }, { headers: { "Content-Type": "application/json" } });
    expect(client.request).toHaveBeenCalledWith({ method: "POST", url: "/bad", params: {}, data: { ok: false }, headers: { "Content-Type": "application/json" } });
  });

  it("builds multipart requests with Atlassian no-check header", async () => {
    const { client } = mockAxios();
    const { ConfluenceHttpClient } = await import("../../src/core/http.js");
    const http = new ConfluenceHttpClient(patConfig);

    await http.postMultipart("/content/1/child/attachment", { minorEdit: true }, [{ fieldName: "file", filename: "a\"b.png", contentType: "image/png", data: Buffer.from("png") }]);

    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "/content/1/child/attachment",
      headers: expect.objectContaining({ "X-Atlassian-Token": "no-check" }),
    }));
    const requestCalls = client.request.mock.calls as unknown as Array<[{ data: Buffer }]>;
    const multipartCall = requestCalls[0]![0];
    const data = String(multipartCall.data);
    expect(data).toContain('name="file"; filename="a_b.png"');
    expect(data).toContain("Content-Type: image/png");
  });
});
