const Wifi = require("../controllers/WifiUpdateController.js");
const router = require("express").Router();

router.post("/", Wifi.WifiUpdateCommand);
router.post("/fanSet", Wifi.fanRangeSet);
router.put("/", Wifi.updateWifi);

module.exports = router;