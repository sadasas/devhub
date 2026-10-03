import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../../../../config.js";
import { ApiError } from "../../../../shared/errors.js";
import { parseOrThrow } from "../../../../shared/db.js";
import { requireAuth, getUserId } from "../../../auth/middleware/requireAuth.js";
import { searchYouTubeVideos } from "../application/search-service.js";

export const youtubeRouter = Router();

const youtubeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: { code: "RATE_LIMITED", message: "Too many YouTube requests" } },
});

youtubeRouter.use(youtubeLimiter);

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(100),
  maxResults: z.coerce.number().int().min(1).max(10).default(5),
});

/**
 * Search public embeddable YouTube videos (radio queue source).
 * 503 YOUTUBE_NOT_CONFIGURED when YOUTUBE_API_KEY is empty;
 * 429 YOUTUBE_QUOTA_EXHAUSTED on daily cap or upstream quota errors.
 */
youtubeRouter.get("/search", requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!config.YOUTUBE_API_KEY) {
    throw new ApiError(
      503,
      "YOUTUBE_NOT_CONFIGURED",
      "YouTube search is not configured (missing YOUTUBE_API_KEY)",
    );
  }
  const query = parseOrThrow(searchQuerySchema, req.query, "Invalid search query");
  const { results, cached } = await searchYouTubeVideos(userId, query.q, query.maxResults, {
    apiKey: config.YOUTUBE_API_KEY,
  });
  res.json({ results, cached });
});
