
const express = require("express");
const crypto = require("crypto");
const supabase = require("../config/supabase");
const webpush = require("web-push");

const router = express.Router();

const ADMIN_EMAIL = "contacteurasianhouse@gmail.com";
const MAX_MESSAGE_LENGTH = 4000;

// Basic per-process rate limit.
// We'll strengthen this later if needed for multi-instance deployment.
const requestCounts = new Map();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
    process.env.VAPID_SUBJECT || "mailto:contacteurasianhouse@gmail.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

function rateLimit(key, maxRequests = 30, windowMs = 60_000) {
    const now = Date.now();
    const current = requestCounts.get(key);

    if (!current || now - current.startedAt >= windowMs) {
        requestCounts.set(key, {
            startedAt: now,
            count: 1,
        });
        return true;
    }

    if (current.count >= maxRequests) return false;

    current.count += 1;
    return true;
}

function hashVisitorToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function validVisitorToken(token) {
    return typeof token === "string" &&
        /^[a-f0-9]{64}$/i.test(token);
}

async function getUser(req) {
    const authorization = req.headers.authorization || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) return null;

    const { data, error } = await supabase.auth.getUser(match[1]);

    if (error || !data.user) return null;

    return data.user;
}

function isAdmin(user) {
    return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

async function getAuthorizedConversation(req, conversationId, user) {
    const { data: conversation, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

    if (error || !conversation) return null;

    // Only the configured admin can access all conversations.
    if (isAdmin(user)) return conversation;

    // Signed-in customer: must own the conversation.
    if (user && conversation.customer_id === user.id) {
        return conversation;
    }

    // Anonymous customer: must prove possession of the visitor token.
    const visitorToken = req.body?.visitorToken ||
        req.query?.visitorToken ||
        req.headers["x-chat-visitor-token"];

    if (
        !user &&
        validVisitorToken(visitorToken) &&
        conversation.visitor_token_hash &&
        hashVisitorToken(visitorToken) === conversation.visitor_token_hash
    ) {
        return conversation;
    }

    return null;
}

// Create a new conversation.
router.post("/api/chat/conversations", async (req, res) => {
    try {
        const user = await getUser(req);

        if (user && isAdmin(user)) {
            return res.status(403).json({
                error: "Admins cannot create customer conversations.",
            });
        }

        const visitorToken = req.body?.visitorToken;

        if (!user && !validVisitorToken(visitorToken)) {
            return res.status(400).json({
                error: "A valid anonymous visitor token is required.",
            });
        }

        const name = typeof req.body?.name === "string"
            ? req.body.name.trim().slice(0, 120)
            : "";

        const email = typeof req.body?.email === "string"
            ? req.body.email.trim().slice(0, 254)
            : "";

        const rateKey = user
            ? `user:${user.id}`
            : `visitor:${hashVisitorToken(visitorToken)}`;

        if (!rateLimit(rateKey, 5, 60_000)) {
            return res.status(429).json({
                error: "Too many conversations. Please try again shortly.",
            });
        }

        const { data, error } = await supabase
            .from("chat_conversations")
            .insert({
                customer_id: user?.id || null,
                visitor_token_hash: user
                    ? null
                    : hashVisitorToken(visitorToken),
                customer_name: name || user?.user_metadata?.full_name ||
                    user?.user_metadata?.name || null,
                customer_email: email || user?.email || null,
            })
            .select("id, customer_id, customer_name, customer_email, status, created_at, last_message_at")
            .single();

        if (error) throw error;

        return res.status(201).json({ conversation: data });
    } catch (error) {
        console.error("Create chat conversation error:", error.message);
        return res.status(500).json({
            error: "Could not create the conversation.",
        });
    }
});

// Retrieve conversations for the admin inbox.
router.get("/api/chat/admin/conversations", async (req, res) => {
    try {
        const user = await getUser(req);

        if (!isAdmin(user)) {
            return res.status(403).json({ error: "Forbidden." });
        }

        const { data, error } = await supabase
            .from("chat_conversations")
            .select("id, customer_id, customer_name, customer_email, status, created_at, last_message_at")
            .order("last_message_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        return res.json({ conversations: data || [] });
    } catch (error) {
        console.error("Admin chat inbox error:", error.message);
        return res.status(500).json({
            error: "Could not load conversations.",
        });
    }
});

// Retrieve message history for an authorized conversation.
router.get("/api/chat/conversations/:id/messages", async (req, res) => {
    try {
        const user = await getUser(req);

        const conversation = await getAuthorizedConversation(
            req,
            req.params.id,
            user
        );

        if (!conversation) {
            return res.status(404).json({
                error: "Conversation not found.",
            });
        }

        const { data, error } = await supabase
            .from("chat_messages")
            .select("id, conversation_id, sender_type, sender_user_id, message, created_at")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: true })
            .limit(500);

        if (error) throw error;

        return res.json({ messages: data || [] });
    } catch (error) {
        console.error("Load chat messages error:", error.message);
        return res.status(500).json({
            error: "Could not load messages.",
        });
    }
});

// Send a customer message or an admin reply.
router.post("/api/chat/conversations/:id/messages", async (req, res) => {
    try {
        const user = await getUser(req);
        const message = typeof req.body?.message === "string"
            ? req.body.message.trim()
            : "";

        if (!message || message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                error: `Message must contain 1-${MAX_MESSAGE_LENGTH} characters.`,
            });
        }

        const conversation = await getAuthorizedConversation(
            req,
            req.params.id,
            user
        );

        if (!conversation) {
            return res.status(404).json({
                error: "Conversation not found.",
            });
        }

        if (conversation.status === "closed") {
            return res.status(409).json({
                error: "This conversation is closed.",
            });
        }

        const senderType = isAdmin(user) ? "admin" : "customer";

        const rateKey = user
            ? `user:${user.id}`
            : `visitor:${conversation.id}`;

        if (!rateLimit(rateKey, 30, 60_000)) {
            return res.status(429).json({
                error: "You are sending messages too quickly.",
            });
        }

        const { data: newMessage, error: messageError } = await supabase
            .from("chat_messages")
            .insert({
                conversation_id: conversation.id,
                sender_type: senderType,
                sender_user_id: user?.id || null,
                message,
            })
            .select("id, conversation_id, sender_type, sender_user_id, message, created_at")
            .single();

        if (messageError) throw messageError;

        const { error: updateError } = await supabase
            .from("chat_conversations")
            .update({ last_message_at: newMessage.created_at })
            .eq("id", conversation.id);

        if (updateError) {
            console.error("Update chat timestamp error:", updateError.message);
        }

        return res.status(201).json({ message: newMessage });
    } catch (error) {
        console.error("Send chat message error:", error.message);
        return res.status(500).json({
            error: "Could not send the message.",
        });
    }
});



function getPushSubscription(body) {
    const subscription = body?.subscription;

    if (
        !subscription ||
        typeof subscription.endpoint !== "string" ||
        !subscription.endpoint.startsWith("https://") ||
        typeof subscription.keys?.p256dh !== "string" ||
        typeof subscription.keys?.auth !== "string"
    ) {
        return null;
    }

    return {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
    };
}

// Return the public key needed by the browser.
// Never expose the private VAPID key.
router.get("/api/chat/push/public-key", (req, res) => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(503).json({
            error: "Push notifications are not configured.",
        });
    }

    return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register a push subscription for the authenticated admin.
router.post("/api/chat/push/admin-subscription", async (req, res) => {
    try {
        const user = await getUser(req);

        if (!isAdmin(user)) {
            return res.status(403).json({ error: "Forbidden." });
        }

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return res.status(503).json({
                error: "Push notifications are not configured.",
            });
        }

        const subscription = getPushSubscription(req.body);

        if (!subscription) {
            return res.status(400).json({
                error: "Invalid push subscription.",
            });
        }

        const { data, error } = await supabase
            .from("chat_push_subscriptions")
            .upsert(
                {
                    ...subscription,
                    subscriber_type: "admin",
                    user_id: user.id,
                    conversation_id: null,
                    visitor_token_hash: null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "endpoint" }
            )
            .select("id")
            .single();

        if (error) throw error;

        return res.status(201).json({
            success: true,
            subscriptionId: data.id,
        });
    } catch (error) {
        console.error("Register admin push subscription:", error.message);

        return res.status(500).json({
            error: "Could not register push notifications.",
        });
    }
});

// Register a customer's subscription for one conversation.
router.post(
    "/api/chat/conversations/:id/push-subscription",
    async (req, res) => {
        try {
            const user = await getUser(req);

            if (isAdmin(user)) {
                return res.status(400).json({
                    error: "Use the admin subscription endpoint.",
                });
            }

            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                return res.status(503).json({
                    error: "Push notifications are not configured.",
                });
            }

            const conversation = await getAuthorizedConversation(
                req,
                req.params.id,
                user
            );

            if (!conversation) {
                return res.status(404).json({
                    error: "Conversation not found.",
                });
            }

            const subscription = getPushSubscription(req.body);

            if (!subscription) {
                return res.status(400).json({
                    error: "Invalid push subscription.",
                });
            }

            const visitorToken =
                req.body?.visitorToken ||
                req.headers["x-chat-visitor-token"];

            const { error } = await supabase
                .from("chat_push_subscriptions")
                .upsert(
                    {
                        ...subscription,
                        subscriber_type: "customer",
                        user_id: user?.id || null,
                        conversation_id: conversation.id,
                        visitor_token_hash: user
                            ? null
                            : hashVisitorToken(visitorToken),
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "endpoint" }
                );

            if (error) throw error;

            return res.status(201).json({ success: true });
        } catch (error) {
            console.error("Register customer push subscription:", error.message);

            return res.status(500).json({
                error: "Could not register push notifications.",
            });
        }
    }
);


module.exports = router;
