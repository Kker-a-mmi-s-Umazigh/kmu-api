import { User } from "../models/User.js";
import { FavoriteSong } from "../models/FavoriteSong.js";
import { Annotation } from "../models/Annotation.js";
import { Translation } from "../models/Translation.js";
import { ModerationRequest } from "../models/ModerationRequest.js";
import { ModerationChange } from "../models/ModerationChange.js";
import { makeBaseController } from "./baseController.js";
import { moderationService } from "../services/moderationService.js";
import { normalizePagination, buildPagination } from "../utils/pagination.js";
import knex from "../config/knexClient.js";
import validator from "validator";

const allowedCreateFields = [
  "username",
  "displayName",
  "email",
  "avatarUrl",
  "bio",
  "badges",
  "passwordHash",
  "passwordSalt",
  "roleId",
];

const allowedUpdateFields = [
  "username",
  "email",
  "displayName",
  "avatarUrl",
  "bio",
  "badges",
  "passwordHash",
  "passwordSalt",
  "roleId",
];

const allowedSelfFields = [
  "username",
  "email",
  "displayName",
  "avatarUrl",
  "bio",
  "badges",
];

const parseCount = (value) => {
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? 0 : asNumber;
};

const baseModerationCounts = () => ({
  pending: 0,
  approved: 0,
  rejected: 0,
  applied: 0,
});

const buildCountMap = (rows) => {
  const map = new Map();
  for (const row of rows) {
    map.set(row.userId, parseCount(row.count));
  }
  return map;
};

const buildModerationMap = (rows) => {
  const map = new Map();
  for (const row of rows) {
    const userId = row.userId;
    const status = row.status;
    const count = parseCount(row.count);
    if (!map.has(userId)) {
      map.set(userId, baseModerationCounts());
    }
    if (
      status &&
      Object.prototype.hasOwnProperty.call(map.get(userId), status)
    ) {
      map.get(userId)[status] = count;
    }
  }
  return map;
};

const buildModerationActivity = (counts, includePending) => {
  const merged = { ...baseModerationCounts(), ...(counts ?? {}) };
  if (!includePending) {
    merged.pending = 0;
  }
  return {
    ...merged,
    total: merged.pending + merged.approved + merged.rejected + merged.applied,
  };
};

const buildModerationActivityItems = async ({
  userId,
  includePending,
  limit = 50,
}) => {
  const requestQuery = ModerationRequest.query()
    .select(
      "moderationRequests.id",
      "moderationRequests.status",
      "moderationRequests.createdAt",
      "moderationRequests.reviewedAt",
      "moderationRequests.appliedAt",
      "moderationRequests.decisionNote",
    )
    .where("moderationRequests.createdBy", userId)
    .orderBy("moderationRequests.createdAt", "desc")
    .limit(limit);

  if (!includePending) {
    requestQuery.whereNot("moderationRequests.status", "pending");
  }

  const requests = await requestQuery;
  if (!requests.length) return [];

  const requestIds = requests.map((request) => request.id);
  const changes = await ModerationChange.query()
    .whereIn("requestId", requestIds)
    .orderBy([
      { column: "sequence", order: "asc" },
      { column: "createdAt", order: "asc" },
    ]);

  const changesMap = new Map();
  for (const change of changes) {
    if (!changesMap.has(change.requestId)) {
      changesMap.set(change.requestId, []);
    }
    changesMap.get(change.requestId).push({
      id: change.id,
      requestId: change.requestId,
      scope: change.targetTable,
      operation: change.operation,
      targetKey: change.targetKey,
      dataNew: change.dataNew,
      dataOld: change.dataOld,
      createdAt: change.createdAt,
    });
  }

  return requests.map((request) => ({
    requestId: request.id,
    status: request.status,
    decisionNote: request.decisionNote ?? null,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    appliedAt: request.appliedAt,
    changes: changesMap.get(request.id) ?? [],
  }));
};

const buildActivityUnion = (userId) => {
  const favoritesQuery = knex("favoriteSongs")
    .select(
      knex.raw("'favorite' as type"),
      knex.raw(`concat("userId", ':', "songId") as id`),
      "songId as entityId",
      "songId",
      "createdAt",
    )
    .where("userId", userId);

  const annotationsQuery = knex("annotations")
    .select(
      knex.raw("'annotation' as type"),
      knex.raw('"id"::text as id'),
      "id as entityId",
      "songId",
      "createdAt",
    )
    .where("createdBy", userId);

  const translationsQuery = knex("translations")
    .select(
      knex.raw("'translation' as type"),
      knex.raw('"id"::text as id'),
      "id as entityId",
      "songId",
      "createdAt",
    )
    .where("createdBy", userId);

  return knex.unionAll(
    [favoritesQuery, annotationsQuery, translationsQuery],
    true,
  );
};

const fetchActivityItems = async ({ userId, limit, offset }) => {
  if (!userId) return [];
  const unionQuery = buildActivityUnion(userId).as("activity_items");
  const rows = await knex
    .select(
      "activity_items.id",
      "activity_items.type",
      "activity_items.entityId",
      "activity_items.createdAt",
      "songs.id as songId",
      "songs.title as songTitle",
      "songs.releaseYear as songReleaseYear",
      "songs.isPublished as songIsPublished",
      "songs.languageCode as songLanguageCode",
    )
    .from(unionQuery)
    .leftJoin("songs", "activity_items.songId", "songs.id")
    .orderBy("activity_items.createdAt", "desc")
    .limit(limit)
    .offset(offset);

  const annotationIds = [];
  const translationIds = [];
  for (const row of rows) {
    if (row.type === "annotation") {
      annotationIds.push(row.entityId);
    } else if (row.type === "translation") {
      translationIds.push(row.entityId);
    }
  }

  const [annotationRows, translationRows, translationLines] = await Promise.all(
    [
      annotationIds.length
        ? knex("annotations")
            .select("id", "bodyMd")
            .whereIn("id", annotationIds)
        : Promise.resolve([]),
      translationIds.length
        ? knex("translations")
            .select("id", "titleTrans", "notes", "languageCode")
            .whereIn("id", translationIds)
        : Promise.resolve([]),
      translationIds.length
        ? knex("translationLines")
            .select("translationId", "lineIndex", "text")
            .whereIn("translationId", translationIds)
            .orderBy(["translationId", { column: "lineIndex", order: "asc" }])
        : Promise.resolve([]),
    ],
  );

  const annotationMap = new Map(
    annotationRows.map((row) => [row.id, row.bodyMd ?? null]),
  );

  const translationBaseMap = new Map();
  for (const row of translationRows) {
    translationBaseMap.set(row.id, {
      titleTrans: row.titleTrans ?? null,
      notes: row.notes ?? null,
      languageCode: row.languageCode ?? null,
    });
  }

  const translationLinesMap = new Map();
  for (const row of translationLines) {
    if (!translationLinesMap.has(row.translationId)) {
      translationLinesMap.set(row.translationId, []);
    }
    translationLinesMap.get(row.translationId).push({
      lineIndex: row.lineIndex,
      text: row.text,
    });
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    entityId: row.entityId,
    createdAt: row.createdAt,
    song: row.songId
      ? {
          id: row.songId,
          title: row.songTitle,
          releaseYear: row.songReleaseYear,
          isPublished: row.songIsPublished,
          languageCode: row.songLanguageCode,
        }
      : null,
    text:
      row.type === "annotation"
        ? (annotationMap.get(row.entityId) ?? null)
        : row.type === "translation"
          ? (translationLinesMap.get(row.entityId) ?? [])
          : null,
    translation:
      row.type === "translation"
        ? {
            ...(translationBaseMap.get(row.entityId) ?? {
              titleTrans: null,
              notes: null,
              languageCode: null,
            }),
            text: translationLinesMap.get(row.entityId) ?? [],
          }
        : null,
  }));
};

const countActivityItems = async (userId) => {
  if (!userId) return 0;
  const [favoritesCount, annotationsCount, translationsCount] =
    await Promise.all([
      countRows(FavoriteSong.query().where("userId", userId)),
      countRows(Annotation.query().where("createdBy", userId)),
      countRows(Translation.query().where("createdBy", userId)),
    ]);
  return favoritesCount + annotationsCount + translationsCount;
};

const buildActivities = (userId, maps) => ({
  favorites: maps.favorites.get(userId) ?? 0,
  annotations: maps.annotations.get(userId) ?? 0,
  translations: maps.translations.get(userId) ?? 0,
});

const pickFields = (body, fields) => {
  const data = {};
  if (!body || typeof body !== "object") return data;
  for (const key of fields) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  return data;
};

const normalizeIdentityFields = (data) => {
  if (!data || typeof data !== "object") return data;
  const normalized = { ...data };

  if (Object.prototype.hasOwnProperty.call(normalized, "username")) {
    if (typeof normalized.username !== "string") {
      throw new Error("Invalid username");
    }
    const trimmed = normalized.username.trim();
    if (!trimmed) {
      throw new Error("Invalid username");
    }
    normalized.username = trimmed;
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "email")) {
    if (
      typeof normalized.email !== "string" ||
      !validator.isEmail(normalized.email)
    ) {
      throw new Error("Invalid email");
    }
    const normalizedEmail = validator.normalizeEmail(normalized.email);
    if (!normalizedEmail) {
      throw new Error("Invalid email");
    }
    normalized.email = normalizedEmail;
  }

  return normalized;
};

const ensureUniqueIdentityFields = async ({ userId, username, email }) => {
  if (username) {
    const existing = await User.query()
      .where("username", username)
      .whereNot("id", userId)
      .first();
    if (existing) return { field: "username" };
  }

  if (email) {
    const existing = await User.query()
      .where("email", email)
      .whereNot("id", userId)
      .first();
    if (existing) return { field: "email" };
  }

  return null;
};

const countRows = async (query) => {
  const row = await query.count({ count: "*" }).first();
  return parseCount(row?.count);
};

const baseController = makeBaseController(User, {
  allowedCreateFields,
  allowedUpdateFields,
});

export const UserController = {
  ...baseController,

  getAll: async (req, res) => {
    try {
      const { page, pageSize } = normalizePagination(req.query);
      const result = await User.query()
        .orderBy("createdAt", "desc")
        .page(page - 1, pageSize);
      const rows = result.results;
      const userIds = rows.map((row) => row.id).filter(Boolean);
      const currentUserId = req.user?.userId ?? null;

      const emptyMaps = {
        favorites: new Map(),
        annotations: new Map(),
        translations: new Map(),
        moderation: new Map(),
      };

      let maps = emptyMaps;
      if (userIds.length > 0) {
        const [
          favoritesRows,
          annotationsRows,
          translationsRows,
          moderationRows,
        ] = await Promise.all([
          FavoriteSong.query()
            .select("userId")
            .count({ count: "*" })
            .whereIn("userId", userIds)
            .groupBy("userId"),
          Annotation.query()
            .select({ userId: "createdBy" })
            .count({ count: "*" })
            .whereIn("createdBy", userIds)
            .groupBy("createdBy"),
          Translation.query()
            .select({ userId: "createdBy" })
            .count({ count: "*" })
            .whereIn("createdBy", userIds)
            .groupBy("createdBy"),
          ModerationRequest.query()
            .select({ userId: "createdBy", status: "status" })
            .count({ count: "*" })
            .whereIn("createdBy", userIds)
            .groupBy("createdBy", "status"),
        ]);

        maps = {
          favorites: buildCountMap(favoritesRows),
          annotations: buildCountMap(annotationsRows),
          translations: buildCountMap(translationsRows),
          moderation: buildModerationMap(moderationRows),
        };
      }

      const items = rows.map((row) => {
        const data = row.toJSON ? row.toJSON() : row;
        const includePending = currentUserId && currentUserId === data.id;
        return {
          ...data,
          activities: {
            ...buildActivities(data.id, maps),
            moderation: buildModerationActivity(
              maps.moderation.get(data.id),
              includePending,
            ),
          },
        };
      });

      res.json({
        items,
        pagination: buildPagination({
          page,
          pageSize,
          total: result.total,
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.query().findById(id);
      if (!user) return res.status(404).json({ error: "Not found" });

      const currentUserId = req.user?.userId ?? null;
      const includePending = currentUserId && currentUserId === id;

      const [
        favoritesCount,
        annotationsCount,
        translationsCount,
        moderationRows,
        moderationItems,
        activityItems,
        history,
      ] = await Promise.all([
        countRows(FavoriteSong.query().where("userId", id)),
        countRows(Annotation.query().where("createdBy", id)),
        countRows(Translation.query().where("createdBy", id)),
        ModerationRequest.query()
          .select({ userId: "createdBy", status: "status" })
          .count({ count: "*" })
          .where("createdBy", id)
          .groupBy("createdBy", "status"),
        buildModerationActivityItems({ userId: id, includePending }),
        fetchActivityItems({ userId: id, limit: 5, offset: 0 }),
        moderationService.getHistoryForTarget({
          tableName: User.tableName,
          targetKey: { id },
        }),
      ]);

      const moderationCounts =
        moderationRows.length > 0
          ? buildModerationMap(moderationRows).get(id)
          : baseModerationCounts();

      const data = user.toJSON ? user.toJSON() : user;
      res.json({
        ...data,
        activities: {
          favorites: favoritesCount,
          annotations: annotationsCount,
          translations: translationsCount,
          moderation: buildModerationActivity(moderationCounts, includePending),
          moderationItems,
          items: activityItems,
        },
        moderationHistory: history,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  getFullProfile: async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.query()
        .findById(id)
        .select(
          "users.id",
          "users.username",
          "users.displayName",
          "users.email",
          "users.avatarUrl",
          "users.bio",
          "users.reputation",
          "users.isBanned",
          "users.createdAt",
          "roles.name as roleName",
        )
        .leftJoin("roles", "users.roleId", "roles.id");

      if (!user) return res.status(404).json({ error: "Not found" });

      const currentUserId = req.user?.userId ?? null;
      const includePending = currentUserId && currentUserId === id;

      const [
        favoritesCount,
        annotationsCount,
        translationsCount,
        moderationRows,
        moderationItems,
        activityItems,
      ] = await Promise.all([
        countRows(FavoriteSong.query().where("userId", id)),
        countRows(Annotation.query().where("createdBy", id)),
        countRows(Translation.query().where("createdBy", id)),
        ModerationRequest.query()
          .select({ userId: "createdBy", status: "status" })
          .count({ count: "*" })
          .where("createdBy", id)
          .groupBy("createdBy", "status"),
        buildModerationActivityItems({ userId: id, includePending }),
        fetchActivityItems({ userId: id, limit: 5, offset: 0 }),
      ]);

      const moderationCounts =
        moderationRows.length > 0
          ? buildModerationMap(moderationRows).get(id)
          : baseModerationCounts();

      const profile = {
        id: user.id,
        username: user.username,
        displayName: user.displayName ?? user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        reputation: user.reputation,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        role: user.roleName ?? null,
        stats: {
          favorites: favoritesCount,
          annotations: annotationsCount,
          translations: translationsCount,
        },
        activities: {
          favorites: favoritesCount,
          annotations: annotationsCount,
          translations: translationsCount,
          moderation: buildModerationActivity(moderationCounts, includePending),
          moderationItems,
          items: activityItems,
        },
      };

      res.json(profile);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  getActivities: async (req, res) => {
    try {
      const { id } = req.params;
      const { page, pageSize } = normalizePagination(req.query);
      const offset = (page - 1) * pageSize;

      const [items, total] = await Promise.all([
        fetchActivityItems({ userId: id, limit: pageSize, offset }),
        countActivityItems(id),
      ]);

      res.json({
        items,
        pagination: buildPagination({ page, pageSize, total }),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal error" });
    }
  },

  update: async (req, res) => {
    const requestedId = req.params?.id;
    const currentUserId = req.user?.userId;
    const isAdmin = currentUserId
      ? await moderationService.isAdmin(currentUserId)
      : false;
    const wantsRoleChange =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "roleId");

    if (currentUserId && requestedId && currentUserId === requestedId) {
      if (wantsRoleChange) {
        return res.status(403).json({ error: "Admin role required" });
      }

      let data = pickFields(req.body, allowedSelfFields);
      try {
        data = normalizeIdentityFields(data);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      const conflict = await ensureUniqueIdentityFields({
        userId: requestedId,
        username: data.username,
        email: data.email,
      });
      if (conflict) {
        return res.status(409).json({
          error: `${conflict.field} already in use`,
        });
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No changes provided" });
      }

      try {
        const updated = await User.query()
          .patch(data)
          .where({ id: requestedId })
          .returning("*");

        if (!updated || (Array.isArray(updated) && updated.length === 0)) {
          return res.status(404).json({ error: "Not found" });
        }

        return res.json(updated[0] ?? updated);
      } catch (err) {
        console.error(err);
        return res
          .status(400)
          .json({ error: "Invalid data", details: err.message });
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ error: "Admin role required" });
    }

    try {
      const normalized = normalizeIdentityFields(
        pickFields(req.body, allowedUpdateFields),
      );
      const conflict = await ensureUniqueIdentityFields({
        userId: requestedId,
        username: normalized?.username,
        email: normalized?.email,
      });
      if (conflict) {
        return res.status(409).json({
          error: `${conflict.field} already in use`,
        });
      }
      req.body = { ...req.body, ...normalized };
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    return baseController.update(req, res);
  },
};
