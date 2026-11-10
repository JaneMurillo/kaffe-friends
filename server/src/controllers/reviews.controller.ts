import type { Request, Response } from 'express';
import { parse, parseId } from '../middleware/validate.js';
import {
  createReview,
  deleteReview,
  getFriend,
  listFriends,
  updateReview,
} from '../services/reviews.service.js';
import { reviewSchema } from '../validation/schemas.js';

export const reviewsController = {
  async create(req: Request, res: Response) {
    const input = parse(reviewSchema, req.body);
    res.status(201).json(await createReview(parseId(req.params.id), input, req.file));
  },
  async update(req: Request, res: Response) {
    const input = parse(reviewSchema, req.body);
    res.json(await updateReview(parseId(req.params.reviewId), input, req.file));
  },
  remove(req: Request, res: Response) {
    deleteReview(parseId(req.params.reviewId));
    res.status(204).end();
  },
  friends(_req: Request, res: Response) {
    res.json(listFriends());
  },
  friend(req: Request, res: Response) {
    res.json(getFriend(parseId(req.params.friendId)));
  },
};
