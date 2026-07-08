const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

router.get("/sitemap.xml", async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const baseUrl = "https://www.eurasianrugs.com";

    const staticPages = [
      { path: "/", priority: "1.0", freq: "daily" },
      { path: "/products", priority: "0.9", freq: "daily" },
      { path: "/wholesale", priority: "0.9", freq: "weekly" },
      { path: "/wholesale-contact", priority: "0.8", freq: "monthly" },
      { path: "/us", priority: "0.8", freq: "monthly" },
      { path: "/contact", priority: "0.8", freq: "monthly" },
      { path: "/faq", priority: "0.7", freq: "monthly" },
      { path: "/privacy-policy", priority: "0.4", freq: "yearly" },
      { path: "/terms", priority: "0.4", freq: "yearly" },
      { path: "/refund-policy", priority: "0.4", freq: "yearly" },
      { path: "/shipping-policy", priority: "0.4", freq: "yearly" },
      { path: "/cancellation-policy", priority: "0.4", freq: "yearly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    staticPages.forEach((page) => {
      xml += `
<url>
  <loc>${baseUrl}${page.path}</loc>
  <changefreq>${page.freq}</changefreq>
  <priority>${page.priority}</priority>
</url>`;
    });

    products.forEach((product) => {
      xml += `
<url>
  <loc>${baseUrl}/products/${product.slug}</loc>
  <lastmod>${new Date(product.updated_at).toISOString()}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>`;
    });

    xml += `
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);

  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to generate sitemap.");
  }
});

module.exports = router;