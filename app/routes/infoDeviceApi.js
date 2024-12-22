const deviceInfo = require("../controllers/DeviceInformationController");
const router = require("express").Router();

router.get("/deviceDetails/:id", deviceInfo.custDeviceInfo);
router.post("/", deviceInfo.DeviceParameterInfo);
router.post("/deviceList", deviceInfo.DeviceListInfo);
router.post("/activeInfo", deviceInfo.activeInfo);
router.post("/alertInfo", deviceInfo.alertInfo);
router.post("/alertMapInfo", deviceInfo.alertMapInfo);
router.post("/deviceTemperature", deviceInfo.getDeviceTemperature);
router.post("/deviceStatus", deviceInfo.getDeviceStatus);
router.post("/getEnergyInfoData", deviceInfo.getEnergyInfoData);
router.post("/EnergyConsumption", deviceInfo.EnergyConsumption);

module.exports = router;