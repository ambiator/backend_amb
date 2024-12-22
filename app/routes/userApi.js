const Users = require("../controllers/userController.js");
const router = require("express").Router();

router.post("/", Users.store);
router.post("/register", Users.register);
router.put("/:id", Users.update);
router.delete("/:id", Users.delete);
router.get("/", Users.show);
router.post("/resetPassword", Users.resetPassword);
router.get("/showAll", Users.showAll);

module.exports = router;