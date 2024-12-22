const ModeSet = require("../controllers/ModeSetController.js");
const router = require("express").Router();

router.post("/setFanSpeed", ModeSet.setFanSpeed);
router.post("/showModeSettings", ModeSet.showModeSettings);
router.post("/setHumidity", ModeSet.setHumidity);
router.post("/autoMode", ModeSet.AutoModeSett);
router.post("/instaOveSet", ModeSet.InstallerOveModeSet);

// router.post("/manualMode", ModeSet.ManualMode);

module.exports = router;