import type { Request, Response } from 'express';
import { parse, parseId } from '../middleware/validate.js';
import {
  createAvailability,
  createSeasonal,
  deleteAvailability,
  deleteSeasonal,
  updateAvailability,
  updateSeasonal,
} from '../services/extras.service.js';
import { resolveGoogleMapsLink } from '../services/googleMaps.service.js';
import { availabilitySchema, googleLinkSchema, seasonalSchema } from '../validation/schemas.js';

export const extrasController = {
  createAvailability(req: Request, res: Response) {
    res.status(201).json(createAvailability(parseId(req.params.id), parse(availabilitySchema, req.body)));
  },
  updateAvailability(req: Request, res: Response) {
    res.json(updateAvailability(parseId(req.params.itemId), parse(availabilitySchema, req.body)));
  },
  removeAvailability(req: Request, res: Response) {
    deleteAvailability(parseId(req.params.itemId));
    res.status(204).end();
  },
  async createSeasonal(req: Request, res: Response) {
    res.status(201).json(await createSeasonal(parseId(req.params.id), parse(seasonalSchema, req.body), req.file));
  },
  async updateSeasonal(req: Request, res: Response) {
    res.json(await updateSeasonal(parseId(req.params.itemId), parse(seasonalSchema, req.body), req.file));
  },
  removeSeasonal(req: Request, res: Response) {
    deleteSeasonal(parseId(req.params.itemId));
    res.status(204).end();
  },
  async resolveGoogleLink(req: Request, res: Response) {
    res.json(await resolveGoogleMapsLink(parse(googleLinkSchema, req.body).url));
  },
};
