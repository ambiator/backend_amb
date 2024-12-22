const EnergyGhg = require('../controllers/EnergyGhgCalculation');
const router = require("express").Router();

router.post("/", EnergyGhg.store);
router.put("/:id", EnergyGhg.update);
router.delete("/:id", EnergyGhg.delete);
router.get("/showData", EnergyGhg.EnergyGhgCalculationShow);

module.exports = router;