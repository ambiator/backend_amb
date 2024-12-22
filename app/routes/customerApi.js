const customer = require('../controllers/CustomerController');
const router = require("express").Router();

router.get("/", customer.showData);

module.exports = router;