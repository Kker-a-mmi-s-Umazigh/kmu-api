import request from "supertest";
import app from "../../src/app.js";

describe("GlossaryController", () => {
  it("lists glossary terms", async () => {
    const res = await request(app).get("/api/glossary");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("returns 404 for missing term", async () => {
    const res = await request(app).get(
      "/api/glossary/00000000-0000-0000-0000-000000000000",
    );

    expect(res.status).toBe(404);
  });
});
