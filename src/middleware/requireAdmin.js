const supabase = require("../config/supabase");

const ADMIN_EMAIL = "contacteurasianhouse@gmail.com";

async function requireAdmin(req, res, next) {
    try {
        const authorization = req.headers.authorization || "";

        if (!authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Authentication required",
            });
        }

        const accessToken = authorization.slice(7).trim();

        if (!accessToken) {
            return res.status(401).json({
                error: "Authentication required",
            });
        }

        // Verify the token with Supabase Auth.
        const { data, error } = await supabase.auth.getUser(accessToken);

        if (error || !data?.user) {
            return res.status(401).json({
                error: "Invalid or expired session",
            });
        }

        if (
            data.user.email?.toLowerCase() !==
            ADMIN_EMAIL.toLowerCase()
        ) {
            return res.status(403).json({
                error: "Administrator access required",
            });
        }

        req.adminUser = {
            id: data.user.id,
            email: data.user.email,
        };

        next();
    } catch (error) {
        console.error("Admin authentication error:", error.message);

        return res.status(500).json({
            error: "Unable to verify administrator",
        });
    }
}

module.exports = requireAdmin;