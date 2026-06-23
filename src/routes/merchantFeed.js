const express = require("express");
const { generateMerchantFeed } = require("../services/merchantFeedService");

const router = express.Router();

router.get("/merchant-feed.xml", async (req, res) => {
  try {
    const xml = await generateMerchantFeed();

    res.setHeader("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (err) {
    console.error("Merchant Feed Error:", err);
    res.status(500).send("Failed to generate Merchant Feed");
  }
});

module.exports = router;