const supabase = require("../config/supabase");

const adminNewOrder = require("../emails/templates/adminNewOrder");
const sendEmail = require("../emails/sendEmail");
const orderConfirmation = require("../emails/templates/orderConfirmation");
const orderStatus = require("../emails/templates/orderStatus");

const optimizeCloudinary = require("../utils/cloudinary");

async function getOrderEmailData(orderId) {
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }

  // Fetch order items
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (itemsError) throw itemsError;

  if (!orderItems.length) {
    throw new Error("No order items found.");
  }

  // Fetch products
  const productIds = [...new Set(orderItems.map((i) => i.product_id))];

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id,title,thumbnail")
    .in("id", productIds);

  if (productsError) throw productsError;

  const productMap = new Map(
    products.map((product) => [product.id, product])
  );

  const items = orderItems.map((item) => {
    const product = productMap.get(item.product_id);

    return {
      image: optimizeCloudinary(product?.thumbnail),
      name: product?.title || "Product",
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    };
  });

  const maxProductionDays = Math.max(
    ...orderItems.map((item) => item.production_days || 0)
  );

  const estimatedDelivery = new Date(order.created_at);

  estimatedDelivery.setDate(
    estimatedDelivery.getDate() + maxProductionDays + 7
  );

  return {
    order,
    customerEmail: orderItems[0].email,
    customerName: orderItems[0].customer_name,
    paymentMethod: order.paypal_payment_id ? "PayPal" : "Razorpay",
    orderDate: new Date(order.created_at).toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    deliveryDate: estimatedDelivery.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    items,
    orderUrl: `https://eurasianrugs.com/account/orders/${order.id}`,
  };
}

async function sendOrderConfirmationEmail(orderId) {
  const data = await getOrderEmailData(orderId);

  await sendEmail({
    to: data.customerEmail,
    subject: `Order Confirmation • ${data.order.id}`,
    html: orderConfirmation({
      customerName: data.customerName,
      orderNumber: data.order.id,
      paymentMethod: data.paymentMethod,
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate,
      items: data.items,
      orderUrl: data.orderUrl,
    }),
  });
}

async function sendOrderStatusEmail(orderId, status) {
  const data = await getOrderEmailData(orderId);

  await sendEmail({
    to: data.customerEmail,
    subject: `Order Update • ${data.order.id}`,
    html: orderStatus({
      customerName: data.customerName,
      orderNumber: data.order.id,
      paymentMethod: data.paymentMethod,
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate,
      status,
      items: data.items,
      orderUrl: data.orderUrl,
    }),
  });
}


async function sendAdminNewOrderEmail(orderId) {
  const data = await getOrderEmailData(orderId);

  const firstItem = data.order;

  await sendEmail({
    to: "contacteurasianhouse@gmail.com",

    subject: `🛒 New Paid Order • ${data.order.id}`,

    html: adminNewOrder({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      phone: firstItem.phone,
      address: [
        firstItem.address,
        firstItem.city,
        firstItem.state,
        firstItem.country,
        firstItem.pincode,
      ]
        .filter(Boolean)
        .join(", "),

      orderNumber: data.order.id,
      paymentMethod: data.paymentMethod,
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate,
      items: data.items,
      adminUrl: "https://eurasianrugs.com/admin/orders",
    }),
  });
}

module.exports = {
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendAdminNewOrderEmail,
};