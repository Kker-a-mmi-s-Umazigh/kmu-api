import { moderationService } from "../services/moderationService.js";
import { User } from "../models/User.js";

const attachUserRefs = async (requests) => {
  if (!requests) return requests;
  const items = Array.isArray(requests) ? requests : [requests];
  const ids = [
    ...new Set(
      items
        .flatMap((request) => [request?.createdBy, request?.reviewedBy])
        .filter((value) => typeof value === "string" && value.length > 0),
    ),
  ];

  if (ids.length === 0) {
    return requests;
  }

  const users = await User.query()
    .select("id", "username")
    .whereIn("id", ids);
  const userMap = new Map(
    users.map((user) => [user.id, { id: user.id, username: user.username }]),
  );

  const toUserObject = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    return userMap.get(value) ?? { id: value, username: null };
  };

  const withUsers = items.map((request) => ({
    ...request,
    createdBy: toUserObject(request?.createdBy),
    reviewedBy: toUserObject(request?.reviewedBy),
  }));

  return Array.isArray(requests) ? withUsers : withUsers[0];
};

export const ModerationController = {
  listRequests: async (req, res) => {
    try {
      const status = req.query.status ?? "pending";

      const requests = await moderationService.listRequests({ status });
      const enriched = await attachUserRefs(requests);

      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  getRequest: async (req, res) => {
    try {
      const request = await moderationService.getRequest(req.params.id);
      if (!request) return res.status(404).json({ error: "Not found" });
      const enriched = await attachUserRefs(request);
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  approveRequest: async (req, res) => {
    try {
      const request = await moderationService.approveRequest({
        requestId: req.params.id,
        reviewerId: req.user?.userId,
        decisionNote: req.body?.decisionNote,
      });
      const enriched = await attachUserRefs(request);
      res.json(enriched);
    } catch (err) {
      if (err.code === "REQUEST_NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      if (err.code === "REQUEST_NOT_PENDING") {
        return res.status(409).json({ error: "Request is not pending" });
      }
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  rejectRequest: async (req, res) => {
    try {
      const request = await moderationService.rejectRequest({
        requestId: req.params.id,
        reviewerId: req.user?.userId,
        decisionNote: req.body?.decisionNote,
      });
      const enriched = await attachUserRefs(request);
      res.json(enriched);
    } catch (err) {
      if (err.code === "REQUEST_NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      if (err.code === "REQUEST_NOT_PENDING") {
        return res.status(409).json({ error: "Request is not pending" });
      }
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },
};
