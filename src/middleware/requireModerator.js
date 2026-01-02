import { moderationService } from "../services/moderationService.js";

export const requireModerator = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isModerator = await moderationService.isModerator(userId);
    if (!isModerator) {
      return res.status(403).json({ error: "Moderator role required" });
    }

    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
};
