const { Router } = require('express');
const controller = require('../controllers/taskController');
const {
  validateCreateTask,
  validateUpdateTask,
  validateStatus,
  validateObjectId,
} = require('../middleware/validateTask');

const router = Router();

// keep these above /:id, otherwise "search" gets treated as an id
router.get('/search', controller.search);
router.get('/weekly', controller.weekly);

router.route('/').get(controller.list).post(validateCreateTask, controller.create);

router
  .route('/:id')
  .all(validateObjectId)
  .get(controller.getById)
  .put(validateUpdateTask, controller.update)
  .delete(controller.remove);

router.patch('/:id/status', validateObjectId, validateStatus, controller.updateStatus);

module.exports = router;
