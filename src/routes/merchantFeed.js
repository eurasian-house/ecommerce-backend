const express = require("express");
const { streamMerchantFeed } = require("../services/merchantFeedService");

const router = express.Router();

router.get("/merchant-feed.xml", async (req, res) => {
  try {
    await streamMerchantFeed(res);
  } catch (err) {
    console.error("Merchant Feed Error:", err);

    // Only send an error if the response has not already started.
    if (!res.headersSent) {
      res.status(500).send("Failed to generate Merchant Feed");
    } else {
      res.end();
    }
  }
});

module.exports = router;