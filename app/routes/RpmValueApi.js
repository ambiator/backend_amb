const rpmValue = require('../controllers/RpmValueController.js');
const router = require("express").Router();

router.get("/RpmValueShow", rpmValue.RpmValueShow);
router.post("/", rpmValue.store);
router.delete("/:id", rpmValue.delete);
router.put("/:id", rpmValue.update);

module.exports = router;