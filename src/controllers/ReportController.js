import crypto from "node:crypto";
import { Report } from "../models/Report.js";
import { normalizePagination, buildPagination } from "../utils/pagination.js";

const ALLOWED_TARGET_TYPES = new Set([
  "annotation",
  "annotationComment",
  "song",
  "translation",
  "artist",
  "album",
]);

export const ReportController = {
  getAll: async (req, res) => {
    try {
      const rawTargetType = Array.isArray(req.query?.targetType)
        ? req.query.targetType[0]
        : req.query?.targetType;

      if (rawTargetType && !ALLOWED_TARGET_TYPES.has(rawTargetType)) {
        return res.status(400).json({ error: "Invalid target type" });
      }

      const { page, pageSize } = normalizePagination(req.query);
      const query = Report.query()
        .withGraphFetched("[reporter(selectUser), resolver(selectUser)]")
        .modifiers({
          selectUser(builder) {
            builder.select("id", "username");
          },
        })
        .orderBy("createdAt", "desc");

      if (rawTargetType) {
        query.where("targetType", rawTargetType);
      }

      const result = await query.page(page - 1, pageSize);

      return res.json({
        items: result.results,
        pagination: buildPagination({
          page,
          pageSize,
          total: result.total,
        }),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal error" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const report = await Report.query()
        .findById(id)
        .withGraphFetched("[reporter(selectUser), resolver(selectUser)]")
        .modifiers({
          selectUser(builder) {
            builder.select("id", "username");
          },
        });

      if (!report) {
        return res.status(404).json({ error: "Not found" });
      }

      return res.json(report);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal error" });
    }
  },

  create: async (req, res) => {
    try {
      const { targetType, targetId, reason } = req.body;
      const reporterId = req.user?.userId;

      if (!reporterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!targetType || !targetId || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!ALLOWED_TARGET_TYPES.has(targetType)) {
        return res.status(400).json({ error: "Invalid target type" });
      }

      const report = await Report.query()
        .insert({
          id: crypto.randomUUID(),
          targetType,
          targetId,
          reason,
          reporterId,
        })
        .returning("*");

      return res.status(201).json(report);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal error" });
    }
  },
};
