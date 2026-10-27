const express = require("express");
const crypto = require("crypto");
const supabase = require("../config/supabase");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

const ALLOWED_EVENTS = new Set([
    "page_view",
    "page_exit",
    "product_view",
    "add_to_cart",
    "remove_from_cart",
    "begin_checkout",
    "purchase",
    "search",
    "category_view",
    "chat_open",
    "chat_message",
    "contact",
]);

const MAX_TEXT_LENGTH = 500;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const cleanText = (value, maxLength = MAX_TEXT_LENGTH) =>
    typeof value === "string" ? value.trim().slice(0, maxLength) : null;

const validId = (value) =>
    typeof value === "string" &&
    /^[a-zA-Z0-9_-]{16,100}$/.test(value);

const getDeviceType = (userAgent = "") => {
    if (/tablet|ipad/i.test(userAgent)) return "tablet";
    if (/mobile|android|iphone|ipod/i.test(userAgent)) return "mobile";
    return "desktop";
};

const getBrowser = (userAgent = "") => {
    if (/Edg\//i.test(userAgent)) return "Edge";
    if (/OPR\//i.test(userAgent)) return "Opera";
    if (/Firefox\//i.test(userAgent)) return "Firefox";
    if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent))
        return "Chrome";
    if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent))
        return "Safari";
    return "Other";
};

router.post("/event", async (req, res) => {
    try {
        const {
            visitorId,
            sessionId,
            eventName,
            pagePath,
            eventData = {},
            referrer,
        } = req.body || {};

        if (
            !validId(visitorId) ||
            !validId(sessionId) ||
            !ALLOWED_EVENTS.has(eventName)
        ) {
            return res.status(400).json({ error: "Invalid tracking payload" });
        }

        if (
            !eventData ||
            typeof eventData !== "object" ||
            Array.isArray(eventData)
        ) {
            return res.status(400).json({ error: "Invalid event data" });
        }

        // Keep event payloads small and avoid accepting arbitrary nested data.
        if (JSON.stringify(eventData).length > 4000) {
            return res.status(400).json({ error: "Event data is too large" });
        }

        const path = cleanText(pagePath, 1000);

        if (!path || !path.startsWith("/") || path.startsWith("//")) {
            return res.status(400).json({ error: "Invalid page path" });
        }

        const userAgent = cleanText(req.get("user-agent"), 1000) || "";

        const now = new Date();
        const cutoff = new Date(now.getTime() - SESSION_TIMEOUT_MS);

        // Reuse an active session, or create a new session after inactivity.
        const { data: existing, error: lookupError } = await supabase
            .from("visitor_sessions")
            .select("session_id, last_seen_at")
            .eq("session_id", sessionId)
            .eq("visitor_id", visitorId)
            .maybeSingle();

        if (lookupError) throw lookupError;

        let activeSessionId = sessionId;

        if (
            existing &&
            new Date(existing.last_seen_at).getTime() < cutoff.getTime()
        ) {
            activeSessionId = crypto.randomBytes(24).toString("hex");
        }

        const sessionPayload = {
            visitor_id: visitorId,
            session_id: activeSessionId,
            current_page: path,
            device_type: getDeviceType(userAgent),
            browser: getBrowser(userAgent),
            last_seen_at: now.toISOString(),
            ended_at: null,
        };

        if (eventName === "page_view" && !existing) {
            sessionPayload.referrer = cleanText(referrer, 1000);
        }

        const { error: sessionError } = await supabase
            .from("visitor_sessions")
            .upsert(sessionPayload, { onConflict: "session_id" });

        if (sessionError) throw sessionError;

        const { error: eventError } = await supabase
            .from("visitor_events")
            .insert({
                visitor_id: visitorId,
                session_id: activeSessionId,
                event_name: eventName,
                page_path: path,
                event_data: eventData,
            });

        if (eventError) throw eventError;

        return res.status(200).json({
            success: true,
            sessionId: activeSessionId,
        });
    } catch (error) {
        console.error("Visitor tracking error:", error.message);
        return res.status(500).json({ error: "Unable to record visitor event" });
    }
});


/* ---------------------------------------
   ADMIN: VISITOR SESSIONS
--------------------------------------- */

router.get("/admin/sessions", requireAdmin, async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from("visitor_sessions")
            .select(`
        visitor_id,
        session_id,
        current_page,
        referrer,
        device_type,
        browser,
        country,
        city,
        started_at,
        last_seen_at,
        ended_at
      `)
            .order("last_seen_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        const sessions = (data || []).map((session) => ({
            ...session,
            is_active:
                !session.ended_at &&
                new Date(session.last_seen_at).getTime() >=
                new Date(cutoff).getTime(),
        }));

        return res.json({
            success: true,
            activeVisitors: new Set(
                sessions
                    .filter((session) => session.is_active)
                    .map((session) => session.visitor_id)
            ).size,
            sessions,
        });
    } catch (error) {
        console.error("Visitor sessions error:", error.message);

        return res.status(500).json({
            error: "Unable to load visitor sessions",
        });
    }
});


/* ---------------------------------------
   ADMIN: VISITOR EVENTS
--------------------------------------- */

router.get("/admin/events", requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("visitor_events")
            .select(`
        id,
        visitor_id,
        session_id,
        event_name,
        page_path,
        event_data,
        created_at
      `)
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        return res.json({
            success: true,
            events: data || [],
        });
    } catch (error) {
        console.error("Visitor events error:", error.message);

        return res.status(500).json({
            error: "Unable to load visitor events",
        });
    }
});


module.exports = router;