import request from "supertest";
import app from "../../src/app.js";
import { loginAsAdmin, signupMember } from "./helpers.js";

describe("ModerationController", () => {
  it("lists and approves pending moderation requests", async () => {
    const member = await signupMember();

    const pendingRes = await request(app)
      .post("/api/songs")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        title: "Pending song",
        languageCode: "kab",
      });

    expect(pendingRes.status).toBe(202);
    const requestId = pendingRes.body.request?.id;
    expect(requestId).toBeTruthy();

    const adminToken = await loginAsAdmin();
    const listRes = await request(app)
      .get("/api/moderation/requests")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    const approveRes = await request(app)
      .post(`/api/moderation/requests/${requestId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decisionNote: "ok" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("applied");
  });
});
