import { Router } from 'express';
import { backupsController } from '../controllers/backups.controller.js';
import { establishmentsController as places } from '../controllers/establishments.controller.js';
import { extrasController as extras } from '../controllers/extras.controller.js';
import { insightsController as insights } from '../controllers/insights.controller.js';
import { reviewsController as reviews } from '../controllers/reviews.controller.js';
import { authController as auth } from '../middleware/auth.js';
import { apiNotFound } from '../middleware/errors.js';
import { backupUpload, photoUpload } from '../middleware/upload.js';

export const apiRouter = Router();

apiRouter.get('/auth/status', auth.status);
apiRouter.post('/auth/login', auth.login);
apiRouter.post('/auth/logout', auth.logout);

apiRouter.post('/google-maps/resolve', extras.resolveGoogleLink);

apiRouter.get('/stats', insights.stats);
apiRouter.get('/rankings', insights.ranking);
apiRouter.get('/passport', insights.passport);

apiRouter.get('/establishments', places.list);
apiRouter.get('/establishments/neighborhoods', places.neighborhoods);
apiRouter.post('/establishments', places.create);
apiRouter.get('/establishments/:id', places.get);
apiRouter.put('/establishments/:id', places.update);
apiRouter.patch('/establishments/:id/visit', places.updateVisit);
apiRouter.patch('/establishments/:id/notes', places.updateNotes);
apiRouter.delete('/establishments/:id', places.remove);

apiRouter.post('/establishments/:id/photos', photoUpload.array('photos'), places.addPhotos);
apiRouter.patch('/photos/:photoId/main', places.setMainPhoto);
apiRouter.patch('/photos/:photoId/category', places.setPhotoCategory);
apiRouter.delete('/photos/:photoId', places.deletePhoto);

apiRouter.post('/establishments/:id/availability', extras.createAvailability);
apiRouter.put('/availability/:itemId', extras.updateAvailability);
apiRouter.delete('/availability/:itemId', extras.removeAvailability);

apiRouter.post('/establishments/:id/seasonal', photoUpload.single('photo'), extras.createSeasonal);
apiRouter.put('/seasonal/:itemId', photoUpload.single('photo'), extras.updateSeasonal);
apiRouter.delete('/seasonal/:itemId', extras.removeSeasonal);

apiRouter.post('/establishments/:id/reviews', photoUpload.single('photo'), reviews.create);
apiRouter.put('/reviews/:reviewId', photoUpload.single('photo'), reviews.update);
apiRouter.delete('/reviews/:reviewId', reviews.remove);

apiRouter.get('/friends', reviews.friends);
apiRouter.get('/friends/:friendId', reviews.friend);

apiRouter.get('/backups', backupsController.list);
apiRouter.post('/backups', backupsController.create);
apiRouter.post('/backups/restore', backupUpload.single('backup'), backupsController.restoreUpload);
apiRouter.get('/backups/:name/download', backupsController.download);
apiRouter.post('/backups/:name/restore', backupsController.restoreExisting);
apiRouter.delete('/backups/:name', backupsController.remove);

apiRouter.use(apiNotFound);
