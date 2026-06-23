const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API running",
    version: "v1",
  });
});

module.exports = router;