import { AppVersion } from "../models/AppVersion.js";
import { makeBaseController } from "./baseController.js";

const allowedCreateFields = ["version", "notes", "isRequired"];
const allowedUpdateFields = ["version", "notes", "isRequired"];

const nowIso = () => new Date().toISOString();

const transformCreateData = (data) => ({
  ...data,
  createdAt: data.createdAt ?? nowIso(),
  updatedAt: nowIso(),
});

const transformUpdateData = (data) => ({
  ...data,
  updatedAt: nowIso(),
});

const baseController = makeBaseController(AppVersion, {
  allowedCreateFields,
  allowedUpdateFields,
  transformCreateData,
  transformUpdateData,
});

export const AppVersionController = {
  ...baseController,

  getLatest: async (req, res) => {
    try {
      const latest = await AppVersion.query()
        .orderBy("updatedAt", "desc")
        .first();
      if (!latest) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(latest);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },
};
