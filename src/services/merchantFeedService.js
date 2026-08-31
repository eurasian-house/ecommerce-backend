// const { create } = require("xmlbuilder2");
// const supabase = require("../config/supabase");
// const getGoogleCategory = require("../utils/googleCategory");
// const optimizeCloudinary = require("../utils/cloudinary");

// async function generateMerchantFeed() {
//   const { data: products, error } = await supabase
//     .from("products")
//     .select(`
//       id,
//       title,
//       description,
//       slug,
//       thumbnail,
//       images,
//       primary_color,
//       materials,
//       main_category,
//       sub_category,
//       quality,
//       shape,
//       pattern,
//       created_at,
//       product_sizes (
//         size,
//         selling_price,
//         stock,
//         sku,
//         mrp_variation,
//         discount_variation
//       )
//     `)
//     .eq("status", "active")
//     .order("created_at", { ascending: false });

//   if (error) throw error;

//   const root = create({
//     version: "1.0",
//     encoding: "UTF-8",
//   }).ele("rss", {
//     version: "2.0",
//     "xmlns:g": "http://base.google.com/ns/1.0",
//   });

//   const channel = root.ele("channel");

//   channel.ele("title").txt("Eurasian House");

//   channel
//     .ele("link")
//     .txt("https://www.eurasianrugs.com");

//   channel
//     .ele("description")
//     .txt("Premium Handmade Rugs & Carpets");

//   for (const product of products) {
//     const sizes = product.product_sizes?.length
//       ? product.product_sizes
//       : [null];

//     /*
//      * FIND SMALLEST ADVERTISING SIZE
//      *
//      * 1. 2x2 ft
//      * 2. 2x3 ft
//      * 3. First available size
//      */

//     const smallestVariant =
//       sizes.find((size) =>
//         String(size?.size || "")
//           .toLowerCase()
//           .trim()
//           .startsWith("2x2")
//       ) ||
//       sizes.find((size) =>
//         String(size?.size || "")
//           .toLowerCase()
//           .trim()
//           .startsWith("2x3")
//       ) ||
//       sizes[0];

//     const smallestSku = smallestVariant?.sku || null;

//     /*
//      * CREATE GOOGLE ITEMS
//      */

//     for (const size of sizes) {
//       const isSmallestSize = smallestSku
//         ? size?.sku === smallestSku
//         : true;

//       const item = channel.ele("item");

//       /*
//        * BASIC PRODUCT INFORMATION
//        */

//       item
//         .ele("g:id")
//         .txt(size?.sku || product.id);

//       item
//         .ele("g:item_group_id")
//         .txt(String(product.id));

//       item
//         .ele("title")
//         .txt(product.title);

//       item
//         .ele("description")
//         .txt(product.description || "");

//       item
//         .ele("link")
//         .txt(
//           `https://www.eurasianrugs.com/products/${product.slug}`
//         );

//       /*
//        * IMAGES
//        */

//       item
//         .ele("g:image_link")
//         .txt(
//           optimizeCloudinary(product.thumbnail)
//         );

//       if (Array.isArray(product.images)) {
//         product.images.forEach((img) => {
//           item
//             .ele("g:additional_image_link")
//             .txt(
//               optimizeCloudinary(img)
//             );
//         });
//       }

//       /*
//        * AVAILABILITY
//        */

//       item
//         .ele("g:availability")
//         .txt(
//           size
//             ? size.stock > 0
//               ? "in stock"
//               : "out of stock"
//             : "in stock"
//         );

//       item
//         .ele("g:condition")
//         .txt("new");

//       item
//         .ele("g:brand")
//         .txt("Eurasian House");

//       /*
//        * PRICE / SALE PRICE
//        */

//       const mrp = Number(
//         size?.mrp_variation || 0
//       );

//       const discount = Number(
//         size?.discount_variation || 0
//       );

//       const sellingPrice =
//         mrp > 0
//           ? (
//               mrp -
//               (mrp * discount) / 100
//             ).toFixed(2)
//           : Number(
//               size?.selling_price || 0
//             ).toFixed(2);

//       if (mrp > 0 && discount > 0) {
//         item
//           .ele("g:price")
//           .txt(`${mrp.toFixed(2)} USD`);

//         item
//           .ele("g:sale_price")
//           .txt(`${sellingPrice} USD`);
//       } else {
//         item
//           .ele("g:price")
//           .txt(`${sellingPrice} USD`);
//       }

//       /*
//        * GOOGLE PRODUCT CATEGORY
//        */

//       item
//         .ele("g:google_product_category")
//         .txt(
//           getGoogleCategory(product.main_category)
//         );

//       item
//         .ele("g:product_type")
//         .txt(
//           product.main_category || ""
//         );

//       /*
//        * PRODUCT ATTRIBUTES
//        */

//       if (product.primary_color) {
//         item
//           .ele("g:color")
//           .txt(product.primary_color);
//       }

//       if (product.materials) {
//         item
//           .ele("g:material")
//           .txt(
//             Array.isArray(product.materials)
//               ? product.materials.join(", ")
//               : product.materials
//           );
//       }

//       /*
//        * PATTERN
//        */

//       if (product.pattern) {
//         item
//           .ele("g:pattern")
//           .txt(product.pattern);
//       }

//       if (size?.size) {
//         item
//           .ele("g:size")
//           .txt(size.size);
//       }

//       if (size?.sku) {
//         item
//           .ele("g:mpn")
//           .txt(size.sku);
//       }

//       item
//         .ele("g:identifier_exists")
//         .txt("false");

//       /*
//        * CUSTOM LABELS
//        */

//       item
//         .ele("g:custom_label_0")
//         .txt(product.main_category || "");

//       item
//         .ele("g:custom_label_1")
//         .txt(product.quality || "");

//       item
//         .ele("g:custom_label_2")
//         .txt(product.shape || "");

//       item
//         .ele("g:custom_label_3")
//         .txt(product.primary_color || "");

//       item
//         .ele("g:custom_label_4")
//         .txt(
//           Array.isArray(product.sub_category)
//             ? product.sub_category.join(", ")
//             : product.sub_category || ""
//         );

//       /*
//        * SHOPPING ADS DESTINATION
//        */

//       if (!isSmallestSize) {
//         item
//           .ele("g:excluded_destination")
//           .txt("Shopping_ads");
//       }
//     }
//   }

//   return root.end({
//     prettyPrint: true,
//   });
// }

// module.exports = {
//   generateMerchantFeed,
// };


const supabase = require("../config/supabase");
const getGoogleCategory = require("../utils/googleCategory");
const optimizeCloudinary = require("../utils/cloudinary");

const BATCH_SIZE = 30;


/*
 * ---------------------------------------------------------
 * XML ESCAPE
 * ---------------------------------------------------------
 */

function escapeXml(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


/*
 * ---------------------------------------------------------
 * WRITE XML TAG
 * ---------------------------------------------------------
 */

function xmlTag(tag, value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return `<${tag}>${escapeXml(value)}</${tag}>`;
}


/*
 * ---------------------------------------------------------
 * WRITE XML SAFELY
 * ---------------------------------------------------------
 */

function writeChunk(res, chunk) {
  return new Promise((resolve, reject) => {
    const canContinue = res.write(chunk);

    if (canContinue) {
      resolve();
      return;
    }

    res.once("drain", resolve);
    res.once("error", reject);
  });
}


/*
 * ---------------------------------------------------------
 * CREATE PRODUCT ITEM XML
 * ---------------------------------------------------------
 */

function createProductItem(
  product,
  size,
  isSmallestSize
) {
  const mrp = Number(
    size?.mrp_variation || 0
  );

  const discount = Number(
    size?.discount_variation || 0
  );

  const sellingPrice =
    mrp > 0
      ? (
          mrp -
          (mrp * discount) / 100
        ).toFixed(2)
      : Number(
          size?.selling_price || 0
        ).toFixed(2);

  let xml = "\n<item>";

  /*
   * ---------------------------------------------------------
   * BASIC PRODUCT INFORMATION
   * ---------------------------------------------------------
   */

  xml += xmlTag(
    "g:id",
    size?.sku || product.id
  );

  xml += xmlTag(
    "g:item_group_id",
    product.id
  );

  xml += xmlTag(
    "title",
    product.title
  );

  xml += xmlTag(
    "description",
    product.description || ""
  );

  xml += xmlTag(
    "link",
    `https://www.eurasianrugs.com/products/${product.slug}`
  );


  /*
   * ---------------------------------------------------------
   * IMAGES
   * ---------------------------------------------------------
   */

  if (product.thumbnail) {
    xml += xmlTag(
      "g:image_link",
      optimizeCloudinary(
        product.thumbnail
      )
    );
  }

  if (Array.isArray(product.images)) {
    product.images.forEach((img) => {
      if (img) {
        xml += xmlTag(
          "g:additional_image_link",
          optimizeCloudinary(img)
        );
      }
    });
  }


  /*
   * ---------------------------------------------------------
   * AVAILABILITY
   * ---------------------------------------------------------
   */

  xml += xmlTag(
    "g:availability",
    size
      ? size.stock > 0
        ? "in stock"
        : "out of stock"
      : "in stock"
  );

  xml += xmlTag(
    "g:condition",
    "new"
  );

  xml += xmlTag(
    "g:brand",
    "Eurasian House"
  );


  /*
   * ---------------------------------------------------------
   * PRICE / SALE PRICE
   * ---------------------------------------------------------
   */

  if (mrp > 0 && discount > 0) {
    xml += xmlTag(
      "g:price",
      `${mrp.toFixed(2)} USD`
    );

    xml += xmlTag(
      "g:sale_price",
      `${sellingPrice} USD`
    );
  } else {
    xml += xmlTag(
      "g:price",
      `${sellingPrice} USD`
    );
  }


  /*
   * ---------------------------------------------------------
   * GOOGLE PRODUCT CATEGORY
   * ---------------------------------------------------------
   */

  xml += xmlTag(
    "g:google_product_category",
    getGoogleCategory(
      product.main_category
    )
  );

  xml += xmlTag(
    "g:product_type",
    product.main_category || ""
  );


  /*
   * ---------------------------------------------------------
   * PRODUCT ATTRIBUTES
   * ---------------------------------------------------------
   */

  if (product.primary_color) {
    xml += xmlTag(
      "g:color",
      product.primary_color
    );
  }

  /*
   * MATERIALS ARRAY
   */

  if (
    Array.isArray(product.materials) &&
    product.materials.length > 0
  ) {
    xml += xmlTag(
      "g:material",
      product.materials.join(", ")
    );
  }


  /*
   * PATTERN
   *
   * Preserved exactly as requested.
   */

  if (product.pattern) {
    xml += xmlTag(
      "g:pattern",
      product.pattern
    );
  }


  if (size?.size) {
    xml += xmlTag(
      "g:size",
      size.size
    );
  }

  if (size?.sku) {
    xml += xmlTag(
      "g:mpn",
      size.sku
    );
  }

  xml += xmlTag(
    "g:identifier_exists",
    "false"
  );


  /*
   * ---------------------------------------------------------
   * CUSTOM LABELS
   * ---------------------------------------------------------
   */

  xml += xmlTag(
    "g:custom_label_0",
    product.main_category || ""
  );

  xml += xmlTag(
    "g:custom_label_1",
    product.quality || ""
  );

  xml += xmlTag(
    "g:custom_label_2",
    product.shape || ""
  );

  xml += xmlTag(
    "g:custom_label_3",
    product.primary_color || ""
  );

  /*
   * SUB CATEGORY IS AN ARRAY
   */

  if (
    Array.isArray(product.sub_category)
  ) {
    xml += xmlTag(
      "g:custom_label_4",
      product.sub_category.join(", ")
    );
  } else {
    xml += xmlTag(
      "g:custom_label_4",
      product.sub_category || ""
    );
  }


  /*
   * ---------------------------------------------------------
   * SHOPPING ADS DESTINATION
   * ---------------------------------------------------------
   */

  if (!isSmallestSize) {
    xml += xmlTag(
      "g:excluded_destination",
      "Shopping_ads"
    );
  }

  xml += "</item>\n";

  return xml;
}


/*
 * ---------------------------------------------------------
 * STREAM MERCHANT FEED
 * ---------------------------------------------------------
 */

async function streamMerchantFeed(res) {

  res.status(200);

  res.setHeader(
    "Content-Type",
    "application/xml; charset=UTF-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-cache"
  );


  /*
   * ---------------------------------------------------------
   * XML START
   * ---------------------------------------------------------
   */

  await writeChunk(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `<channel>\n` +
    `<title>Eurasian House</title>\n` +
    `<link>https://www.eurasianrugs.com</link>\n` +
    `<description>Premium Handmade Rugs &amp; Carpets</description>\n`
  );


  let from = 0;
  let hasMore = true;


  /*
   * ---------------------------------------------------------
   * FETCH PRODUCTS IN BATCHES
   * ---------------------------------------------------------
   */

  while (hasMore) {

    const to =
      from + BATCH_SIZE - 1;

    console.log(
      `📦 Merchant feed: fetching products ${from} to ${to}`
    );


    const {
      data: products,
      error,
    } = await supabase
      .from("products")
      .select(`
        id,
        title,
        main_category,
        sub_category,
        description,
        materials,
        primary_color,
        thumbnail,
        images,
        shape,
        quality,
        status,
        slug,
        pattern,
        product_sizes (
          size,
          selling_price,
          stock,
          sku,
          mrp_variation,
          discount_variation
        )
      `)
      .eq("status", "active")
      .order(
        "created_at",
        { ascending: false }
      )
      .range(from, to);


    if (error) {
      throw error;
    }


    /*
     * No more products
     */

    if (
      !products ||
      products.length === 0
    ) {
      hasMore = false;
      break;
    }


    /*
     * ---------------------------------------------------------
     * PROCESS CURRENT BATCH
     * ---------------------------------------------------------
     */

    for (const product of products) {

      const sizes =
        product.product_sizes?.length
          ? product.product_sizes
          : [null];


      /*
       * ---------------------------------------------------------
       * FIND SMALLEST ADVERTISING SIZE
       * ---------------------------------------------------------
       *
       * 1. 2x2
       * 2. 2x3
       * 3. First available
       */

      const smallestVariant =
        sizes.find((size) =>
          String(
            size?.size || ""
          )
            .toLowerCase()
            .trim()
            .startsWith("2x2")
        ) ||
        sizes.find((size) =>
          String(
            size?.size || ""
          )
            .toLowerCase()
            .trim()
            .startsWith("2x3")
        ) ||
        sizes[0];


      const smallestSku =
        smallestVariant?.sku || null;


      /*
       * ---------------------------------------------------------
       * CREATE ITEMS FOR ALL SIZES
       * ---------------------------------------------------------
       */

      for (const size of sizes) {

        const isSmallestSize =
          smallestSku
            ? size?.sku === smallestSku
            : true;


        const itemXml =
          createProductItem(
            product,
            size,
            isSmallestSize
          );


        /*
         * Write immediately.
         * Don't store the whole feed.
         */

        await writeChunk(
          res,
          itemXml
        );
      }
    }


    /*
     * ---------------------------------------------------------
     * NEXT BATCH
     * ---------------------------------------------------------
     */

    from += BATCH_SIZE;


    /*
     * If fewer than 30 products came back,
     * this was the final batch.
     */

    if (
      products.length < BATCH_SIZE
    ) {
      hasMore = false;
    }
  }


  /*
   * ---------------------------------------------------------
   * XML END
   * ---------------------------------------------------------
   */

  await writeChunk(
    res,
    `</channel>\n</rss>`
  );

  res.end();

  console.log(
    "✅ Merchant feed streaming completed"
  );
}


module.exports = {
  streamMerchantFeed,
};