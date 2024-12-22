const alert = require('../controllers/ChallangeController');
const router = require("express").Router();

router.post("/showData", alert.showData);
router.post("/showData2", alert.showData2);

module.exports = router;