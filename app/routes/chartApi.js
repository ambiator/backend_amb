const chartData = require('../controllers/ChartDataController.js');
const router = require("express").Router();

router.post("/energyConsumption", chartData.EnergyConsumptionTrend);
router.post("/waterConsumption", chartData.waterConsumptionTrend);
router.post("/machTempTrend", chartData.machTempStatusTrend);
router.post("/outSideVsSupTemp", chartData.outSideVsSupTemp);
router.post("/getStatistics", chartData.getStatistics);

module.exports = router;