import request from "supertest";
import app from "../../src/app.js";
import { loginAsAdmin } from "./helpers.js";

describe("AuthController", () => {
  it("logs in and returns an access token", async () => {
    const res = await request(app).post("/api/auth/login").send({
      identifier: "admin",
      password: "admin123",
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user?.username).toBe("admin");
  });

  it("returns current user for /me", async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("admin");
  });
});
