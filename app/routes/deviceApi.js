const Device = require('../controllers/deviceController.js');
const router = require("express").Router();

router.post("/", Device.store);
router.put("/:id", Device.update);
router.delete("/:id", Device.delete);
router.get("/", Device.show);
router.get("/DeviceList", Device.renderDeviceListForApp);



module.exports = router;