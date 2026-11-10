import type { Request, Response } from 'express';
import { HttpError } from '../errors.js';
import { parse, parseId } from '../middleware/validate.js';
import {
  createEstablishment,
  deleteEstablishment,
  getEstablishment,
  listEstablishments,
  listNeighborhoods,
  updateEstablishment,
  updateNotes,
  updateVisit,
} from '../services/establishments.service.js';
import { addPhotos, deletePhoto, setMainPhoto, setPhotoCategory } from '../services/photos.service.js';
import {
  establishmentQuerySchema,
  establishmentSchema,
  notesSchema,
  photoCategorySchema,
  visitSchema,
} from '../validation/schemas.js';

export const establishmentsController = {
  list(req: Request, res: Response) {
    res.json(listEstablishments(parse(establishmentQuerySchema, req.query)));
  },
  neighborhoods(_req: Request, res: Response) {
    res.json(listNeighborhoods());
  },
  get(req: Request, res: Response) {
    res.json(getEstablishment(parseId(req.params.id)));
  },
  create(req: Request, res: Response) {
    res.status(201).json(createEstablishment(parse(establishmentSchema, req.body)));
  },
  update(req: Request, res: Response) {
    res.json(updateEstablishment(parseId(req.params.id), parse(establishmentSchema, req.body)));
  },
  updateVisit(req: Request, res: Response) {
    const { visitStatus, visitDate } = parse(visitSchema, req.body);
    res.json(updateVisit(parseId(req.params.id), visitStatus, visitDate));
  },
  updateNotes(req: Request, res: Response) {
    res.json(updateNotes(parseId(req.params.id), parse(notesSchema, req.body)));
  },
  remove(req: Request, res: Response) {
    deleteEstablishment(parseId(req.params.id));
    res.status(204).end();
  },
  async addPhotos(req: Request, res: Response) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw new HttpError(400, 'Selecciona al menos una fotografía.');
    const raw = req.body?.mainIndex;
    const mainIndex = raw === undefined || raw === '' ? null : Number(raw);
    if (mainIndex !== null && (!Number.isInteger(mainIndex) || mainIndex < 0 || mainIndex >= files.length)) {
      throw new HttpError(400, 'La fotografía principal indicada no es válida.');
    }
    const category = parse(photoCategorySchema.default('lugar'), req.body?.category || undefined);
    res.status(201).json(await addPhotos(parseId(req.params.id), files, mainIndex, category));
  },
  setMainPhoto(req: Request, res: Response) {
    res.json(setMainPhoto(parseId(req.params.photoId)));
  },
  setPhotoCategory(req: Request, res: Response) {
    res.json(setPhotoCategory(parseId(req.params.photoId), parse(photoCategorySchema, req.body?.category)));
  },
  deletePhoto(req: Request, res: Response) {
    res.json(deletePhoto(parseId(req.params.photoId)));
  },
};
