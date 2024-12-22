const Device = require('../controllers/DeviceSchedulingController.js');
const router = require("express").Router();

router.post("/", Device.DeviceScheduleList);
router.post("/WebDevSchedList", Device.WebDeviceScheduleList);
router.post("/schedulerUseState", Device.controlUseSchedular);
router.post("/weekDaySchedular", Device.controlWeekDaySchedular);
router.post("/dayScheduleState", Device.updateDayScheduleState);

module.exports = router;