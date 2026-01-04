import { moderationService } from "../services/moderationService.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isAdmin = await moderationService.isAdmin(userId);
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin role required" });
    }

    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
};
