const auth = require("../controllers/authController");
const router = require("express").Router();

router.post("/login", auth.login);
router.post("/loginWeb", auth.loginWeb);

router.post("/refreshToken", auth.refreshToken);
router.post("/token", auth.index);

module.exports = router;
