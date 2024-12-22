const router = require("express").Router();
const validateToken = require("../config/validateToken");
const { scheduleDeviceJobs } = require("../controllers/DeviceScheduleCron.js");
const { SelfHealScheduleCron } = require("../controllers/SelfHealScheduleCron.js");
const { DeviceActiveCron } = require("../controllers/Crons/DeviceActiveCron.js");
const { dataPush } = require("../controllers/Crons/DataPushCron.js");
const { alertLog } = require("../controllers/Crons/AlertLogCron.js");

module.exports = app => {
    router.use("/", require("../routes/authApi"));
    router.use("/user", require("../routes/userApi"));
    router.use("/machine", require("../routes/machineControlApi"));
    router.use("/device", require("../routes/deviceApi"));
    router.use("/allDevice", require("../routes/allDevicesControlApi.js"));
    router.use("/schedule", require("../routes/ScheduleApi.js"));
    router.use("/infoDevice", require("../routes/infoDeviceApi.js"));
    router.use("/selfHeal", require("../routes/SelfHealScheduleApi.js"));
    router.use("/mode", require("../routes/modeSettingsApi.js"));
    router.use("/deviceType", require("../routes/deviceTypeApi"));
    router.use("/rpmValue", require("../routes/RpmValueApi.js"));

    router.use("/EnergyGhg", require("../routes/EnergyGhgCalculationApi.js"));
    router.use("/selDeviceControl", require("../routes/selectedDeviceControlApi.js"));
    router.use("/otaUpgrade", require("../routes/OtaControlApi.js"));
    router.use("/WifiUpdate", require("../routes/WifiControlApi.js"));
    router.use("/AssignDevice", require("../routes/AssignDeviceControlApi.js"));
    router.use("/chart", require("../routes/chartApi.js"));
    router.use("/customer", require("../routes/customerApi.js"));
    router.use("/challenge", require("../routes/challengeApi.js"));
    router.use("/caas", require("../routes/CaasControlApi.js"));
    // router.use("/dataPush", require("../routes/DataPushApi.js"));
    // Import DeviceScheduleCron and initiate the cron job
    scheduleDeviceJobs();
    // initiate the Self heal cron job
    SelfHealScheduleCron();
    // router.use("/status", require("../routes/statusApi"));
    DeviceActiveCron();
    dataPush();
    alertLog();

    // Global token validation middleware 

    // app.use((req, res, next) => {
    //     if (req.path !== '/' && req.path !== '/api/loginWeb' && req.path !== '/api/login' && req.path !== '/api/user/register') {  // Exclude default and login route
    //         validateToken(req, res, next);
    //     } else {
    //         next();
    //     }
    // });

    app.use('/api', router);
}