module.exports = function optimizeCloudinary(url) {
  if (!url) return "";

  if (!url.includes("/upload/")) return url;

  return url.replace(
    "/upload/",
    "/upload/f_auto,q_auto/"
  );
};