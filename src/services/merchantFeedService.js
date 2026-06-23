const { create } = require("xmlbuilder2");
const supabase = require("../config/supabase");
const getGoogleCategory = require("../utils/googleCategory");
const optimizeCloudinary = require("../utils/cloudinary");

async function generateMerchantFeed() {
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      *,
      product_sizes(*),
      product_colors(*)
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const root = create({ version: "1.0", encoding: "UTF-8" })
    .ele("rss", {
      version: "2.0",
      "xmlns:g": "http://base.google.com/ns/1.0",
    });

  const channel = root.ele("channel");

  channel.ele("title").txt("Eurasian House");
  channel.ele("link").txt("https://www.eurasianrugs.com");
  channel
    .ele("description")
    .txt("Premium Handmade Rugs & Carpets");

  for (const product of products) {
    const sizes =
      product.product_sizes?.length
        ? product.product_sizes
        : [null];

    for (const size of sizes) {
      const item = channel.ele("item");

      item.ele("g:id").txt(size?.sku || product.id);

      item
        .ele("g:item_group_id")
        .txt(String(product.id));

      item.ele("title").txt(product.title);

      item
        .ele("description")
        .txt(product.description || "");

      item
        .ele("link")
        .txt(
          `https://www.eurasianrugs.com/products/${product.slug}`
        );

      item
        .ele("g:image_link")
        .txt(
          optimizeCloudinary(product.thumbnail)
        );

      if (Array.isArray(product.images)) {
        product.images.forEach((img) => {
          item
            .ele("g:additional_image_link")
            .txt(optimizeCloudinary(img));
        });
      }

      item
        .ele("g:availability")
        .txt(
          size
            ? size.stock > 0
              ? "in stock"
              : "out of stock"
            : "in stock"
        );

      item.ele("g:condition").txt("new");

      item.ele("g:brand").txt("Eurasian House");

      const mrp = Number(size?.mrp_variation || 0);
      const discount = Number(size?.discount_variation || 0);

      const sellingPrice =
        mrp > 0
          ? (mrp - (mrp * discount) / 100).toFixed(2)
          : Number(size?.selling_price || 0).toFixed(2);

      if (mrp > 0 && discount > 0) {
        item.ele("g:price").txt(`${mrp.toFixed(2)} USD`);
        item.ele("g:sale_price").txt(`${sellingPrice} USD`);
      } else {
        item.ele("g:price").txt(`${sellingPrice} USD`);
      }

      item
        .ele("g:google_product_category")
        .txt(
          getGoogleCategory(product.main_category)
        );

      item
        .ele("g:product_type")
        .txt(product.main_category);

      if (product.primary_color) {
        item
          .ele("g:color")
          .txt(product.primary_color);
      }

      if (product.materials) {
        item
          .ele("g:material")
          .txt(product.materials);
      }

      if (size?.size) {
        item.ele("g:size").txt(size.size);
      }

      if (size?.sku) {
        item.ele("g:mpn").txt(size.sku);
      }

      item
        .ele("g:identifier_exists")
        .txt("false");

      item
        .ele("g:custom_label_0")
        .txt(product.main_category || "");

      item
        .ele("g:custom_label_1")
        .txt(product.quality || "");

      item
        .ele("g:custom_label_2")
        .txt(product.shape || "");

      item
        .ele("g:custom_label_3")
        .txt(product.primary_color || "");

      item
        .ele("g:custom_label_4")
        .txt(product.sub_category || "");
    }
  }

  return root.end({
    prettyPrint: true,
  });
}

module.exports = {
  generateMerchantFeed,
};