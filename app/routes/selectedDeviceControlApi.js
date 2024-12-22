const selectedDevice = require("../controllers/SelectedDeviceStartStopController.js");
const router = require("express").Router();

router.post("/", selectedDevice.selectedDeviceCommand);

module.exports = router;