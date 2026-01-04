import request from "supertest";
import app from "../../src/app.js";
import { loginAsAdmin, signupMember } from "./helpers.js";

describe("AppVersionController", () => {
  it("lists versions", async () => {
    const res = await request(app).get("/api/versions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("blocks non-admin creation", async () => {
    const member = await signupMember();

    const res = await request(app)
      .post("/api/versions")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ version: "1.0.0" });

    expect(res.status).toBe(403);
  });

  it("allows admin to create and update versions", async () => {
    const adminToken = await loginAsAdmin();

    const createRes = await request(app)
      .post("/api/versions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ version: "1.0.0", notes: "initial", isRequired: false });

    expect(createRes.status).toBe(201);
    const versionId = createRes.body.id;
    expect(versionId).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/versions/${versionId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ notes: "patched", isRequired: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.notes).toBe("patched");
    expect(updateRes.body.isRequired).toBe(true);

    const latestRes = await request(app).get("/api/versions/latest");
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.id).toBe(versionId);
  });
});
