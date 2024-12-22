const selfHeal = require('../controllers/SelfHealController.js');
const router = require("express").Router();

router.post("/", selfHeal.ScheduleSelfHeal);
router.post("/test", selfHeal.ScheduleSelfHealTest);
router.post("/dayTimeShow", selfHeal.SelfHealDateTimeShow);

module.exports = router;