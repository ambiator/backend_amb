const Ota = require("../controllers/OtaController.js");
const router = require("express").Router();

router.post("/", Ota.OtaCommand);

module.exports = router;