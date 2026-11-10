import fs from 'node:fs';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import {
  createBackup,
  deleteBackup,
  listBackups,
  resolveBackup,
  restoreFromZip,
} from '../services/backup.service.js';

const nameParam = (req: Request) => String(req.params.name);

export const backupsController = {
  list(_req: Request, res: Response) {
    res.json(listBackups());
  },
  create(_req: Request, res: Response) {
    res.status(201).json(createBackup());
  },
  download(req: Request, res: Response) {
    const name = nameParam(req);
    resolveBackup(name); // Valida el nombre y que exista.
    // Con raíz explícita, una carpeta padre que empiece con punto no bloquea la descarga.
    res.download(name, name, { root: config.paths.backups });
  },
  remove(req: Request, res: Response) {
    deleteBackup(nameParam(req));
    res.status(204).end();
  },
  restoreExisting(req: Request, res: Response) {
    res.json(restoreFromZip(resolveBackup(nameParam(req))));
  },
  restoreUpload(req: Request, res: Response) {
    if (!req.file) throw new HttpError(400, 'Selecciona un archivo de respaldo (.zip).');
    try {
      res.json(restoreFromZip(req.file.path));
    } finally {
      fs.rmSync(req.file.path, { force: true });
    }
  },
};
