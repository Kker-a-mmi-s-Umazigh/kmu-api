import request from "supertest";
import app from "../../src/app.js";
import { getAdminUser, loginAsAdmin } from "./helpers.js";

describe("AuthController", () => {
  it("logs in and returns an access token", async () => {
    const adminUser = await getAdminUser();
    const identifier = adminUser.username || adminUser.email;
    const password = process.env.SEED_ADMIN_PASSWORD || "admin123";

    const res = await request(app).post("/api/auth/login").send({
      identifier,
      password,
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user?.username).toBe(adminUser.username);
  });

  it("returns current user for /me", async () => {
    const token = await loginAsAdmin();
    const adminUser = await getAdminUser();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe(adminUser.username);
  });
});
