const AllDevice = require("../controllers/AllDevicesController.js");

const router = require("express").Router();
router.post("/", AllDevice.AllDeviceCommand);

module.exports = router;