const Assign = require('../controllers/AssignDeviceController.js');
const router = require("express").Router();

router.post("/", Assign.AssignDevice);
router.get("/showNotAssignedDev", Assign.NotAssignedDeviceList);
router.get("/costumerDropDownList", Assign.costumerDropDownList);

module.exports = router;