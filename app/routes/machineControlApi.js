const Machine = require("../controllers/machineController.js");
const Fc = require("../controllers/FilterCleanController.js");

const router = require("express").Router();

router.post("/", Machine.sendCommand);
router.post("/setPoint", Machine.sendSetPoint);
router.post("/checkFilterClean", Fc.checkFilterClean);

module.exports = router;