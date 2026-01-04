import request from "supertest";
import app from "../../src/app.js";
import { getAdminUser, loginAsAdmin, signupMember } from "./helpers.js";

describe("UserController", () => {
  it("lists users", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("fetches a user by id", async () => {
    const admin = await getAdminUser();
    const res = await request(app).get(`/api/users/${admin.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(admin.id);
    expect(res.body.activities).toBeTruthy();
  });

  it("returns full profile details", async () => {
    const admin = await getAdminUser();
    const token = await loginAsAdmin();
    const res = await request(app)
      .get(`/api/users/${admin.id}/full`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(admin.id);
    expect(Array.isArray(res.body.activities.moderationItems)).toBe(true);
  });

  it("rejects duplicate email updates", async () => {
    const memberA = await signupMember();
    const memberB = await signupMember();

    const res = await request(app)
      .put(`/api/users/${memberA.user.id}`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ email: memberB.user.email });

    expect(res.status).toBe(409);
  });

  it("blocks non-admin from updating other users", async () => {
    const memberA = await signupMember();
    const memberB = await signupMember();

    const res = await request(app)
      .put(`/api/users/${memberB.user.id}`)
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ displayName: "Nope" });

    expect(res.status).toBe(403);
  });

  it("blocks role updates for non-admin self update", async () => {
    const member = await signupMember();

    const res = await request(app)
      .put(`/api/users/${member.user.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ roleId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(403);
  });
});
