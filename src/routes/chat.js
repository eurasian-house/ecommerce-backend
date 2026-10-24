
const express = require("express");
const crypto = require("crypto");
const supabase = require("../config/supabase");
const webpush = require("web-push");

const router = express.Router();

const ADMIN_EMAIL = "contacteurasianhouse@gmail.com";
const MAX_MESSAGE_LENGTH = 4000;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
    process.env.VAPID_SUBJECT || "mailto:contacteurasianhouse@gmail.com";

const requestCounts = new Map();

// Configure push notifications if the keys are available.
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

// --------------------------------------------------
// RATE LIMITING
// --------------------------------------------------

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

    if (current.count >= maxRequests) {
        return false;
    }

    current.count += 1;
    return true;
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function hashVisitorToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function validVisitorToken(token) {
    return (
        typeof token === "string" &&
        /^[a-f0-9]{64}$/i.test(token)
    );
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
    return (
        user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
}

async function getAuthorizedConversation(req, conversationId, user) {
    const { data: conversation, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

    if (error || !conversation) return null;

    // The configured admin can access all conversations.
    if (isAdmin(user)) return conversation;

    // Signed-in customers can access their own conversations.
    if (user && conversation.customer_id === user.id) {
        return conversation;
    }

    // Anonymous customers must prove possession of their visitor token.
    const visitorToken =
        req.body?.visitorToken ||
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

// --------------------------------------------------
// PUSH NOTIFICATION DELIVERY
// IMPORTANT: This function must remain at file scope.
// --------------------------------------------------

async function notifyChatSubscribers(conversation, message, senderType) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return;
    }

    try {
        const isCustomerMessage = senderType === "customer";

        let query = supabase
            .from("chat_push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq(
                "subscriber_type",
                isCustomerMessage ? "admin" : "customer"
            );

        // Admin replies notify customers subscribed to this conversation.
        if (!isCustomerMessage) {
            query = query.eq("conversation_id", conversation.id);
        }

        const { data: subscriptions, error } = await query;

        if (error) {
            console.error(
                "Load push subscriptions:",
                error.message
            );
            return;
        }

        const title = isCustomerMessage
            ? "New customer message · Eurasian House"
            : "New reply · Eurasian House";

        const body = isCustomerMessage
            ? `${conversation.customer_name || "A customer"}: ${message.message}`
            : `Eurasian House replied: ${message.message}`;

        const url = isCustomerMessage
            ? "/admin/messages"
            : "/";

        await Promise.allSettled(
            (subscriptions || []).map(async (subscription) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: subscription.endpoint,
                            keys: {
                                p256dh: subscription.p256dh,
                                auth: subscription.auth,
                            },
                        },
                        JSON.stringify({
                            title,
                            body: body.slice(0, 180),
                            url,
                            tag: `chat-${conversation.id}`,
                        })
                    );
                } catch (pushError) {
                    if (
                        pushError.statusCode === 404 ||
                        pushError.statusCode === 410
                    ) {
                        const { error: deleteError } = await supabase
                            .from("chat_push_subscriptions")
                            .delete()
                            .eq("id", subscription.id);

                        if (deleteError) {
                            console.error(
                                "Remove expired push subscription:",
                                deleteError.message
                            );
                        }
                    } else {
                        console.error(
                            "Push delivery failed:",
                            pushError.statusCode || pushError.message
                        );
                    }
                }
            })
        );
    } catch (error) {
        // A push failure must never invalidate a saved chat message.
        console.error(
            "Chat notification error:",
            error.message
        );
    }
}

// --------------------------------------------------
// FIND EXISTING CUSTOMER CONVERSATION
// Does not create a conversation.
// --------------------------------------------------
router.get("/api/chat/conversations/current", async (req, res) => {
    try {
        const user = await getUser(req);

        if (user && isAdmin(user)) {
            return res.status(403).json({
                error: "Admins cannot access customer chat here.",
            });
        }

        let query = supabase
            .from("chat_conversations")
            .select(
                "id, customer_id, customer_name, customer_email, status, created_at, last_message_at"
            );

        if (user) {
            query = query
                .eq("customer_id", user.id)
                .order("last_message_at", { ascending: false })
                .limit(1);
        } else {
            const visitorToken =
                req.headers["x-chat-visitor-token"] ||
                req.query?.visitorToken;

            if (!validVisitorToken(visitorToken)) {
                return res.status(400).json({
                    error: "A valid anonymous visitor token is required.",
                });
            }

            query = query
                .eq("visitor_token_hash", hashVisitorToken(visitorToken))
                .order("last_message_at", { ascending: false })
                .limit(1);
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json({
            conversation: data?.[0] || null,
        });
    } catch (error) {
        console.error(
            "Find existing chat conversation error:",
            error.message
        );

        return res.status(500).json({
            error: "Could not check for an existing conversation.",
        });
    }
});

// --------------------------------------------------
// CREATE CONVERSATION
// --------------------------------------------------

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

        const name =
            typeof req.body?.name === "string"
                ? req.body.name.trim().slice(0, 120)
                : "";

        const email =
            typeof req.body?.email === "string"
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
                customer_name:
                    name ||
                    user?.user_metadata?.full_name ||
                    user?.user_metadata?.name ||
                    null,
                customer_email: email || user?.email || null,
            })
            .select(
                "id, customer_id, customer_name, customer_email, status, created_at, last_message_at"
            )
            .single();

        if (error) throw error;

        return res.status(201).json({
            conversation: data,
        });
    } catch (error) {
        console.error(
            "Create chat conversation error:",
            error.message
        );

        return res.status(500).json({
            error: "Could not create the conversation.",
        });
    }
});

// --------------------------------------------------
// ADMIN INBOX
// --------------------------------------------------


router.get("/api/chat/admin/conversations", async (req, res) => {
    try {
        const user = await getUser(req);

        if (!isAdmin(user)) {
            return res.status(403).json({
                error: "Forbidden.",
            });
        }

        // Fetch conversations first.
        const { data: conversations, error } = await supabase
            .from("chat_conversations")
            .select(
                "id, customer_id, customer_name, customer_email, status, created_at, last_message_at, admin_unread_count, admin_last_read_at"
            )
            .order("last_message_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        if (!conversations || conversations.length === 0) {
            return res.json({ conversations: [] });
        }

        const conversationIds = conversations.map(
            (conversation) => conversation.id
        );

        // Fetch recent messages for these conversations.
        const { data: recentMessages, error: messagesError } =
            await supabase
                .from("chat_messages")
                .select("conversation_id, message, created_at")
                .in("conversation_id", conversationIds)
                .order("created_at", { ascending: false })
                .limit(1000);

        if (messagesError) throw messagesError;

        // Messages are newest first, so keep the first message
        // encountered for each conversation.
        const latestMessageByConversation = new Map();

        for (const message of recentMessages || []) {
            if (!latestMessageByConversation.has(message.conversation_id)) {
                latestMessageByConversation.set(
                    message.conversation_id,
                    message
                );
            }
        }

        // Include the latest message text and its timestamp.
        const conversationsWithPreview = conversations.map(
            (conversation) => {
                const latestMessage =
                    latestMessageByConversation.get(conversation.id);

                return {
                    ...conversation,
                    last_message: latestMessage?.message || null,
                    last_message_at:
                        latestMessage?.created_at ||
                        conversation.last_message_at,
                };
            }
        );

        return res.json({
            conversations: conversationsWithPreview,
        });
    } catch (error) {
        console.error("Admin chat inbox error:", error.message);

        return res.status(500).json({
            error: "Could not load conversations.",
        });
    }
});


// --------------------------------------------------
// GET MESSAGE HISTORY
// --------------------------------------------------

router.get(
    "/api/chat/conversations/:id/messages",
    async (req, res) => {
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
                .select(
                    "id, conversation_id, sender_type, sender_user_id, message, created_at"
                )
                .eq("conversation_id", conversation.id)
                .order("created_at", { ascending: true })
                .limit(500);

            if (error) throw error;

            return res.json({
                messages: data || [],
            });
        } catch (error) {
            console.error(
                "Load chat messages error:",
                error.message
            );

            return res.status(500).json({
                error: "Could not load messages.",
            });
        }
    }
);

// --------------------------------------------------
// SEND CUSTOMER MESSAGE OR ADMIN REPLY
// --------------------------------------------------

router.post(
    "/api/chat/conversations/:id/messages",
    async (req, res) => {
        try {
            const user = await getUser(req);

            const message =
                typeof req.body?.message === "string"
                    ? req.body.message.trim()
                    : "";

            if (
                !message ||
                message.length > MAX_MESSAGE_LENGTH
            ) {
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

            const senderType = isAdmin(user)
                ? "admin"
                : "customer";

            const rateKey = user
                ? `user:${user.id}`
                : `visitor:${conversation.id}`;

            if (!rateLimit(rateKey, 30, 60_000)) {
                return res.status(429).json({
                    error: "You are sending messages too quickly.",
                });
            }

            // Save the message first.
            const { data: newMessage, error: messageError } =
                await supabase
                    .from("chat_messages")
                    .insert({
                        conversation_id: conversation.id,
                        sender_type: senderType,
                        sender_user_id: user?.id || null,
                        message,
                    })
                    .select(
                        "id, conversation_id, sender_type, sender_user_id, message, created_at"
                    )
                    .single();

            if (messageError) throw messageError;

            // Update conversation timestamp.
            const { error: updateError } = await supabase
                .from("chat_conversations")
                .update({
                    last_message_at: newMessage.created_at,
                })
                .eq("id", conversation.id);

            if (updateError) {
                console.error(
                    "Update chat timestamp error:",
                    updateError.message
                );
            }

            // Send notifications independently of the HTTP response.
            // Notification failure cannot make a saved message appear unsent.
            void notifyChatSubscribers(
                conversation,
                newMessage,
                senderType
            ).catch((notificationError) => {
                console.error(
                    "Chat notification failed:",
                    notificationError.message
                );
            });

            // Return success as soon as the message is saved.
            return res.status(201).json({
                message: newMessage,
            });
        } catch (error) {
            console.error(
                "Send chat message error:",
                error.message
            );

            return res.status(500).json({
                error: "Could not send the message.",
            });
        }
    }
);

// --------------------------------------------------
// PUSH SUBSCRIPTION VALIDATION
// --------------------------------------------------

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

// --------------------------------------------------
// PUBLIC VAPID KEY
// --------------------------------------------------

router.get("/api/chat/push/public-key", (req, res) => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return res.status(503).json({
            error: "Push notifications are not configured.",
        });
    }

    return res.json({
        publicKey: VAPID_PUBLIC_KEY,
    });
});

// --------------------------------------------------
// REGISTER ADMIN PUSH SUBSCRIPTION
// --------------------------------------------------

router.post(
    "/api/chat/push/admin-subscription",
    async (req, res) => {
        try {
            const user = await getUser(req);

            if (!isAdmin(user)) {
                return res.status(403).json({
                    error: "Forbidden.",
                });
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
                    {
                        onConflict: "endpoint",
                    }
                )
                .select("id")
                .single();

            if (error) throw error;

            return res.status(201).json({
                success: true,
                subscriptionId: data.id,
            });
        } catch (error) {
            console.error(
                "Register admin push subscription:",
                error.message
            );

            return res.status(500).json({
                error: "Could not register push notifications.",
            });
        }
    }
);

// --------------------------------------------------
// REGISTER CUSTOMER PUSH SUBSCRIPTION
// --------------------------------------------------

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
                    {
                        onConflict: "endpoint",
                    }
                );

            if (error) throw error;

            return res.status(201).json({
                success: true,
            });
        } catch (error) {
            console.error(
                "Register customer push subscription:",
                error.message
            );

            return res.status(500).json({
                error: "Could not register push notifications.",
            });
        }
    }
);


router.post(
    "/api/chat/admin/conversations/:id/read",
    async (req, res) => {
        try {
            const user = await getUser(req);

            if (!isAdmin(user)) {
                return res.status(403).json({
                    error: "Forbidden.",
                });
            }

            const conversationId = req.params.id;

            const { data, error } = await supabase
                .from("chat_conversations")
                .update({
                    admin_unread_count: 0,
                    admin_last_read_at: new Date().toISOString(),
                })
                .eq("id", conversationId)
                .select("id, admin_unread_count, admin_last_read_at")
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    error: "Conversation not found.",
                });
            }

            return res.json({
                success: true,
                conversation: data,
            });
        } catch (error) {
            console.error(
                "Mark chat conversation as read:",
                error.message
            );

            return res.status(500).json({
                error: "Could not mark conversation as read.",
            });
        }
    }
);


router.post("/api/chat/conversations/first-message", async (req, res) => {
    try {
        const user = await getUser(req);

        if (user && isAdmin(user)) {
            return res.status(403).json({ error: "Forbidden." });
        }

        const message =
            typeof req.body?.message === "string"
                ? req.body.message.trim()
                : "";

        if (!message || message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                error: `Message must contain 1-${MAX_MESSAGE_LENGTH} characters.`,
            });
        }

        const visitorToken =
            req.body?.visitorToken ||
            req.headers["x-chat-visitor-token"];

        if (!user && !validVisitorToken(visitorToken)) {
            return res.status(400).json({
                error: "A valid visitor token is required.",
            });
        }

        const rateKey = user
            ? `user:${user.id}`
            : `visitor:${hashVisitorToken(visitorToken)}`;

        if (!rateLimit(rateKey, 30, 60_000)) {
            return res.status(429).json({
                error: "You are sending messages too quickly.",
            });
        }

        const { data, error } = await supabase.rpc(
            "create_chat_with_first_message",
            {
                p_customer_id: user?.id || null,
                p_visitor_token_hash: user
                    ? null
                    : hashVisitorToken(visitorToken),
                p_customer_name:
                    req.body?.name ||
                    user?.user_metadata?.full_name ||
                    user?.user_metadata?.name ||
                    null,
                p_customer_email: user?.email || req.body?.email || null,
                p_message: message,
                p_sender_user_id: user?.id || null,
            }
        );

        if (error) throw error;

        const conversation = data.conversation;
        const newMessage = data.message;

        void notifyChatSubscribers(
            conversation,
            newMessage,
            "customer"
        );

        return res.status(201).json({
            conversation,
            message: newMessage,
        });
    } catch (error) {
        console.error("Send first chat message:", error.message);

        return res.status(500).json({
            error: "Could not send your message.",
        });
    }
});



module.exports = router;
