const data = require('../controllers/Crons/DataPushCron');
const router = require("express").Router();

router.post("/", data.dataPush);

module.exports = router;