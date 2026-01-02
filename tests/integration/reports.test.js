import request from "supertest";
import app from "../../src/app.js";
import { getSeededSong, loginAsAdmin } from "./helpers.js";

describe("ReportController", () => {
  it("creates and lists reports", async () => {
    const token = await loginAsAdmin();
    const song = await getSeededSong();

    const createRes = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        targetType: "song",
        targetId: song.id,
        reason: "Test report",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();

    const listRes = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);

    const getRes = await request(app)
      .get(`/api/reports/${createRes.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
  });
});
