import { moderationService } from "../services/moderationService.js";

export const ModerationController = {
  listRequests: async (req, res) => {
    try {
      const status = req.query.status ?? "pending";

      const requests = await moderationService.listRequests({ status });

      res.json(requests);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  getRequest: async (req, res) => {
    try {
      const request = await moderationService.getRequest(req.params.id);
      if (!request) return res.status(404).json({ error: "Not found" });
      res.json(request);
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
      res.json(request);
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
      res.json(request);
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
