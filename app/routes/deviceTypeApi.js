const DeviceType = require('../controllers/DeviceTypeController.js');
const router = require("express").Router();

router.get("/deviceTypeShow", DeviceType.deviceTypeShow);
router.get("/showData", DeviceType.showData);
router.post("/", DeviceType.store);
router.delete("/:id", DeviceType.delete);
router.put("/:id", DeviceType.update);

module.exports = router;