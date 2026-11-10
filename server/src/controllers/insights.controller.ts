import type { Request, Response } from 'express';
import { parse } from '../middleware/validate.js';
import { buildRanking, getPassport, getStats } from '../services/insights.service.js';
import { rankingQuerySchema } from '../validation/schemas.js';

export const insightsController = {
  stats(_req: Request, res: Response) {
    res.json(getStats());
  },
  ranking(req: Request, res: Response) {
    const { kind, dir } = parse(rankingQuerySchema, req.query);
    res.json(buildRanking(kind, dir));
  },
  passport(_req: Request, res: Response) {
    res.json(getPassport());
  },
};
