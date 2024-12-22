const caas = require("../controllers/CaasStartStopController.js");

const router = require("express").Router();
router.post("/CaasControl", caas.CaasControl);
router.post("/checkPassword", caas.checkPassword);

module.exports = router;