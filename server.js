const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Import models from source of truth (after next prepares, so TS paths resolve)
  // We require the compiled models via Next.js module resolution
  const mongoose = require("mongoose");
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/chatting_app";

  if (mongoose.connection.readyState < 1) {
    await mongoose.connect(MONGODB_URI, { bufferCommands: false, dbName: process.env.MONGODB_DB_NAME });
  }

  // Reuse models if already registered (by Next.js API routes), otherwise define minimal versions
  function getModel(name, schemaDefinition) {
    if (mongoose.models[name]) return mongoose.models[name];
    return mongoose.model(name, new mongoose.Schema(schemaDefinition, { timestamps: true }));
  }

  const Message = getModel("Message", {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["client", "admin"], required: true },
    content: { type: String, default: "" },
    messageType: { type: String, enum: ["text", "file", "image", "system"], default: "text" },
    attachment: { url: String, filename: String, mimeType: String, size: Number },
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      senderName: String,
      content: String,
      messageType: { type: String, enum: ["text", "file", "image", "system"] },
      attachmentFilename: String,
    },
    readByAdmin: { type: Boolean, default: false },
    readByUser: { type: Boolean, default: false },
    externalMsgId: { type: Number, default: null },
  });

  const Conversation = getModel("Conversation", {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: "" },
    unreadByAdmin: { type: Number, default: 0 },
    unreadByUser: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    externalChatId: { type: Number, default: null },
    externalCode: { type: String, default: null },
  });

  const User = getModel("User", {
    email: String,
    name: String,
    password: { type: String, select: false },
    company: String,
    phone: String,
    role: { type: String, enum: ["client", "admin"], default: "client" },
    status: { type: String, enum: ["pending", "active", "suspended"], default: "pending" },
    lastLoginAt: Date,
    lastLoginIp: String,
    lastLoginUserAgent: String,
    lastLoginCountry: String,
    lastLoginCity: String,
    adminNotes: { type: String, default: "" },
    utmSource: { type: String, trim: true },
    utmMedium: { type: String, trim: true },
    utmCampaign: { type: String, trim: true },
    utmContent: { type: String, trim: true },
    utmTerm: { type: String, trim: true },
  });

  const LoginHistory = getModel("LoginHistory", {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    country: String,
    city: String,
    loginAt: { type: Date, default: Date.now },
  });

  const UtmEvent = getModel("UtmEvent", {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, enum: ["signup", "visit"], default: "visit" },
    utmSource: { type: String, trim: true },
    utmMedium: { type: String, trim: true },
    utmCampaign: { type: String, trim: true },
    utmContent: { type: String, trim: true },
    utmTerm: { type: String, trim: true },
    url: { type: String, default: "" },
  });

  const PushSubscription = getModel("PushSubscription", {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  });

  const Application = getModel("Application", {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    comment: { type: String, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  });

  // S3-compatible storage setup
  const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
  const s3 = process.env.AWS_ENDPOINT_URL ? new S3Client({
    region: process.env.AWS_DEFAULT_REGION || "auto",
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  }) : null;
  const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;

  // Helper: fetch file as Blob — from S3 if local path, or via HTTP if external URL
  async function fetchFileAsBlob(url) {
    if (url.startsWith("/api/files/")) {
      const key = url.replace("/api/files/", "");
      const response = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      const chunks = [];
      for await (const chunk of response.Body) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      return new Blob([buffer], { type: response.ContentType || "application/octet-stream" });
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  }

  // Push notification setup
  const webpush = require("web-push");
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails("mailto:admin@chatplatform.com", vapidPublicKey, vapidPrivateKey);
    console.log("VAPID push notifications configured");
  } else {
    console.warn("VAPID keys not set — push notifications disabled");
  }

  async function sendPushNotification(recipientId, payload) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[Push] VAPID keys not configured, skipping");
      return;
    }
    console.log(`[Push] Sending to user ${recipientId}:`, payload.title);
    const subscriptions = await PushSubscription.find({ userId: recipientId });
    console.log(`[Push] Found ${subscriptions.length} subscription(s) for user ${recipientId}`);
    if (subscriptions.length === 0) return;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          JSON.stringify(payload)
        );
        console.log(`[Push] Sent successfully to endpoint: ${sub.endpoint.substring(0, 60)}...`);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Push] Subscription expired (${err.statusCode}), removing`);
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.error(`[Push] Send error:`, err.statusCode || err.message);
        }
      }
    }
  }

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: dev ? "*" : appUrl },
    maxHttpBufferSize: 85e6,
  });

  // Connect Redis adapter for cross-server Socket.IO (multi-deployment)
  const REDIS_URL = process.env.REDIS_URL;
  if (REDIS_URL) {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Redis adapter connected for cross-server Socket.IO");
  } else {
    console.warn("REDIS_URL not set — Socket.IO running in single-server mode");
  }

  // Make io accessible globally for API routes
  global.io = io;

  // Auth middleware — reads the httpOnly session cookie from the handshake
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie || "";

      // Parse the Auth.js session cookie from the request
      const cookies = cookieHeader.split(";").reduce((acc, c) => {
        const [key, ...rest] = c.trim().split("=");
        if (key) acc[key] = decodeURIComponent(rest.join("="));
        return acc;
      }, {});

      const token =
        cookies["authjs.session-token"] ||
        cookies["__Secure-authjs.session-token"];

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const { decode } = require("next-auth/jwt");
      const decoded = await decode({
        token,
        secret: process.env.AUTH_SECRET,
        salt: cookies["__Secure-authjs.session-token"]
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      });

      if (!decoded) {
        return next(new Error("Invalid session"));
      }

      socket.data.userId = decoded.id || decoded.sub;
      socket.data.userRole = decoded.role;
      socket.data.userName = decoded.name;
      socket.data.userEmail = decoded.email;
      return next();
    } catch (err) {
      console.error("Socket auth error:", err);
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    const userRole = socket.data.userRole;

    console.log(`User connected: ${userId} (${userRole})`);

    // Capture login metadata from the HTTP handshake
    const req = socket.request;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? String(forwarded).split(",")[0].trim() : req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "";

    User.updateOne(
      { _id: userId },
      { lastLoginAt: new Date(), lastLoginIp: ip, lastLoginUserAgent: userAgent }
    ).catch((err) => console.error("Login metadata update error:", err));

    // Create login history entry
    const loginEntry = await LoginHistory.create({
      userId,
      ip: ip || "",
      userAgent,
    }).catch((err) => {
      console.error("Login history create error:", err);
      return null;
    });

    // Geo-resolve IP in background
    if (ip && ip !== "::1" && ip !== "127.0.0.1" && !ip.startsWith("192.168.")) {
      fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`)
        .then((r) => r.json())
        .then((geo) => {
          if (geo.status === "success") {
            User.updateOne(
              { _id: userId },
              { lastLoginCountry: geo.country, lastLoginCity: geo.city }
            ).catch(() => {});
            // Also update the login history entry
            if (loginEntry) {
              LoginHistory.updateOne(
                { _id: loginEntry._id },
                { country: geo.country, city: geo.city }
              ).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }

    // Join personal room
    socket.join(`user:${userId}`);

    // Admin joins admin room
    if (userRole === "admin") {
      socket.join("admin");
      // Join all active conversation rooms
      const conversations = await Conversation.find({ status: "active" });
      for (const conv of conversations) {
        socket.join(`conversation:${conv._id}`);
      }
    } else {
      // Client joins their own conversation room
      const conversation = await Conversation.findOne({ userId });
      if (conversation) {
        socket.join(`conversation:${conversation._id}`);
      }
    }

    // Join a specific conversation (for admin switching between chats)
    socket.on("join_conversation", ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Send message
    socket.on("send_message", async (data) => {
      try {
        const { conversationId, content, messageType, attachment, replyToMessageId } = data;

        // Basic input validation
        if (!conversationId || (!content && !attachment)) return;
        if (typeof content === "string" && content.length > 10000) return;

        // Verify user has access to conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        if (
          userRole !== "admin" &&
          conversation.userId.toString() !== userId
        ) {
          return;
        }

        // Build denormalized replyTo if replying to a message
        let replyTo = undefined;
        if (replyToMessageId) {
          console.log(`[send_message] Replying to messageId=${replyToMessageId}`);
          const originalMsg = await Message.findById(replyToMessageId).lean();
          if (originalMsg && originalMsg.conversationId.toString() === conversationId) {
            const originalSender = await User.findById(originalMsg.senderId).lean();
            replyTo = {
              messageId: originalMsg._id,
              senderName: originalSender ? originalSender.name : "Unknown",
              content: (originalMsg.content || "").substring(0, 100),
              messageType: originalMsg.messageType,
              attachmentFilename: originalMsg.attachment?.filename || undefined,
            };
            console.log(`[send_message] Built replyTo: sender=${replyTo.senderName}, type=${replyTo.messageType}, contentLen=${replyTo.content.length}`);
          } else {
            console.warn(`[send_message] Original message not found or wrong conversation: replyToMessageId=${replyToMessageId}`);
          }
        }

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: userId,
          senderRole: userRole,
          content: content || "",
          messageType: messageType || "text",
          attachment,
          replyTo,
          readByAdmin: userRole === "admin",
          readByUser: userRole === "client",
        });

        // Update conversation
        const preview =
          (content || "").substring(0, 100) || (attachment ? attachment.filename : "");

        if (userRole === "client") {
          await Conversation.findByIdAndUpdate(conversationId, {
            lastMessageAt: new Date(),
            lastMessagePreview: preview,
            $inc: { unreadByAdmin: 1 },
          });
        } else {
          await Conversation.findByIdAndUpdate(conversationId, {
            lastMessageAt: new Date(),
            lastMessagePreview: preview,
            $inc: { unreadByUser: 1 },
          });
        }

        // Get sender info
        const sender = await User.findById(userId);

        // Broadcast to conversation room
        const messageData = {
          _id: message._id.toString(),
          conversationId: message.conversationId.toString(),
          senderId: message.senderId.toString(),
          senderRole: message.senderRole,
          senderName: sender ? sender.name : "Unknown",
          content: message.content,
          messageType: message.messageType,
          attachment: message.attachment,
          replyTo: message.replyTo?.messageId ? {
            messageId: message.replyTo.messageId.toString(),
            senderName: message.replyTo.senderName,
            content: message.replyTo.content,
            messageType: message.replyTo.messageType,
            attachmentFilename: message.replyTo.attachmentFilename,
          } : undefined,
          readByAdmin: message.readByAdmin,
          readByUser: message.readByUser,
          createdAt: message.createdAt.toISOString(),
        };

        io.to(`conversation:${conversationId}`).emit("new_message", messageData);

        // Notify admin room if client sent the message
        if (userRole === "client") {
          // If this is the first message (no previous unread and no preview),
          // emit new_conversation so admin panel adds it to the list
          if (!conversation.unreadByAdmin && !conversation.lastMessagePreview) {
            const application = await Application.findOne(
              { email: sender?.email, status: "approved" },
              { comment: 1 }
            ).lean();
            io.to("admin").emit("new_conversation", {
              _id: conversationId,
              userId: conversation.userId.toString(),
              userName: sender?.name || "Unknown",
              userEmail: sender?.email || "",
              userCompany: sender?.company || "",
              applicationComment: application?.comment || "",
              lastMessageAt: message.createdAt.toISOString(),
              lastMessagePreview: preview,
              unreadByAdmin: 1,
              unreadByUser: 0,
              status: conversation.status || "active",
            });
            // Auto-join admin sockets to this conversation room
            const adminRoom = io.sockets.adapter.rooms.get("admin");
            if (adminRoom) {
              for (const socketId of adminRoom) {
                io.sockets.sockets.get(socketId)?.join(`conversation:${conversationId}`);
              }
            }
          }

          io.to("admin").emit("unread_update", {
            conversationId,
            unreadByAdmin: (conversation.unreadByAdmin || 0) + 1,
            unreadByUser: conversation.unreadByUser || 0,
          });
        } else {
          io.to(`user:${conversation.userId}`).emit("unread_update", {
            conversationId,
            unreadByAdmin: conversation.unreadByAdmin || 0,
            unreadByUser: (conversation.unreadByUser || 0) + 1,
          });
        }

        // Push notification for recipients
        if (userRole === "admin") {
          // Admin sent message → notify client
          const clientId = conversation.userId.toString();
          sendPushNotification(clientId, {
            title: `New message from ${sender ? sender.name : "Support"}`,
            body: preview || "New message",
            url: "/chat",
            tag: `chat-${conversationId}`,
          }).catch(console.error);
        } else {
          // Client sent message → notify all admins
          const admins = await User.find({ role: "admin" }, { _id: 1 });
          for (const admin of admins) {
            sendPushNotification(admin._id.toString(), {
              title: `New message from ${sender ? sender.name : "Client"}`,
              body: preview || "New message",
              url: "/admin",
              tag: `chat-${conversationId}`,
            }).catch(console.error);
          }
        }

        // Forward messages to external chat center
        if (process.env.CHATCENTER_ENABLED === "true") {
          const v2Url = process.env.CHATCENTER_V2_API_URL;
          const v2ApiKey = process.env.CHATCENTER_V2_API_KEY;
          const useV2 = !!(v2Url && v2ApiKey);

          if (useV2) {
            // ── ChatCenter v2 REST API ──
            (async () => {
              try {
                // Look up reply external ID if replying
                let replyExternalMsgId = undefined;
                if (replyToMessageId) {
                  const originalForReply = await Message.findById(replyToMessageId).lean();
                  console.log(`[ChatCenter v2] Reply lookup: replyToMessageId=${replyToMessageId}, found=${!!originalForReply}, externalMsgId=${originalForReply?.externalMsgId || "none"}`);
                  if (originalForReply?.externalMsgId) {
                    replyExternalMsgId = originalForReply.externalMsgId;
                  }
                }

                // Create chat on external system if first message
                let externalChatId = conversation.externalChatId;
                if (!externalChatId) {
                  const sender = await User.findById(userId).lean();
                  const startParam = sender?.utmSource
                    ? [sender.utmSource, sender.utmMedium, sender.utmCampaign].filter(Boolean).join("_")
                    : undefined;

                  const chatBody = {
                    firstName: sender?.name || userName || "Client",
                    ...(startParam && { startParam }),
                  };
                  const chatUrl = `${v2Url}/chats`;
                  console.log(`[ChatCenter v2] POST ${chatUrl}: ${JSON.stringify(chatBody)}`);

                  const chatRes = await fetch(chatUrl, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${v2ApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(chatBody),
                  });

                  const chatResBody = await chatRes.text();
                  console.log(`[ChatCenter v2] Create chat response: status=${chatRes.status}, body="${chatResBody}"`);

                  if (!chatRes.ok) {
                    console.error(`[ChatCenter v2] Failed to create chat (${chatRes.status}): ${chatResBody}`);
                    return;
                  }

                  let chatData;
                  try { chatData = JSON.parse(chatResBody); } catch { return; }
                  externalChatId = chatData.id;

                  if (externalChatId) {
                    await Conversation.findOneAndUpdate(
                      { _id: conversation._id, externalChatId: null },
                      { externalChatId, externalCode: chatData.code || null }
                    );
                    console.log(`[ChatCenter v2] Chat created: externalChatId=${externalChatId}, code=${chatData.code}`);
                  }
                }

                if (!externalChatId) {
                  console.error("[ChatCenter v2] No externalChatId available, skipping message forward");
                  return;
                }

                // Send message
                let msgRes;
                if (attachment && attachment.url) {
                  // File message → multipart POST to /chats/{id}/messages/file
                  const form = new FormData();
                  try {
                    const blob = await fetchFileAsBlob(attachment.url);
                    const safeName = (attachment.filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
                    form.append("file", blob, safeName);
                  } catch (fileErr) {
                    console.error("[ChatCenter v2] Failed to fetch file:", fileErr.message);
                  }
                  if (content) form.append("caption", content);
                  if (replyExternalMsgId) form.append("replyToMsgId", String(replyExternalMsgId));
                  const isImage = attachment.mimeType?.startsWith("image/");
                  form.append("fileType", isImage ? "image" : "document");

                  const fileUrl = `${v2Url}/chats/${externalChatId}/messages/file`;
                  console.log(`[ChatCenter v2] POST ${fileUrl} (fileType=${isImage ? "image" : "document"}, caption="${(content || "").substring(0, 50)}")`);
                  msgRes = await fetch(fileUrl, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${v2ApiKey}` },
                    body: form,
                  });
                } else {
                  // Text message → JSON POST to /chats/{id}/messages
                  const msgBody = {
                    text: content,
                    parseMode: "plain",
                    ...(replyExternalMsgId && { replyToMsgId: replyExternalMsgId }),
                  };
                  const msgUrl = `${v2Url}/chats/${externalChatId}/messages`;
                  console.log(`[ChatCenter v2] POST ${msgUrl}: ${JSON.stringify(msgBody)}`);
                  msgRes = await fetch(msgUrl, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${v2ApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(msgBody),
                  });
                }

                const msgResBody = await msgRes.text();
                console.log(`[ChatCenter v2] Message response: status=${msgRes.status}, body="${msgResBody}"`);

                if (msgRes.ok) {
                  let msgData;
                  try { msgData = JSON.parse(msgResBody); } catch { msgData = {}; }
                  if (msgData.id) {
                    await Message.updateOne({ _id: message._id }, { externalMsgId: msgData.id });
                    console.log(`[ChatCenter v2] Forwarded message ${message._id} → externalMsgId=${msgData.id}`);
                  }
                } else {
                  console.error(`[ChatCenter v2] Forward failed (${msgRes.status}): ${msgResBody}`);
                }
              } catch (err) {
                console.error("[ChatCenter v2] Forward error:", err.message);
              }
            })();
          } else {
            // ── ChatCenter v1 FormData API (fallback) ──
            (async () => {
              try {
                const chatCenterUrl = process.env.CHATCENTER_API_URL;
                const botId = process.env.CHATCENTER_BOT_ID;
                const incomingSecret = process.env.CHATCENTER_INCOMING_SECRET;
                if (!chatCenterUrl || !botId || !incomingSecret) return;

                const outboundType = attachment ? "file" : "text";
                const outboundChatId = conversation.externalChatId || 0;

                const form = new FormData();
                form.append("type", outboundType);
                form.append("chatId", String(outboundChatId));
                if (content) form.append("text", content);

                if (replyToMessageId) {
                  const originalForReply = await Message.findById(replyToMessageId).lean();
                  if (originalForReply?.externalMsgId) {
                    form.append("replayToMsgId", String(originalForReply.externalMsgId));
                  }
                }

                if (attachment && attachment.url) {
                  try {
                    const blob = await fetchFileAsBlob(attachment.url);
                    const safeName = (attachment.filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
                    form.append("file", blob, safeName);
                  } catch (fileErr) {
                    console.error("[ChatCenter v1] Failed to fetch file:", fileErr.message);
                  }
                }

                const outboundUrl = `${chatCenterUrl}/${botId}/${incomingSecret}`;
                console.log(`[ChatCenter v1] POST ${outboundUrl} type=${outboundType}, chatId=${outboundChatId}`);

                const res = await fetch(outboundUrl, { method: "POST", body: form });
                const resBody = await res.text();
                console.log(`[ChatCenter v1] Response: status=${res.status}, body="${resBody}"`);

                if (res.ok) {
                  let data;
                  try { data = JSON.parse(resBody); } catch { data = {}; }
                  if (data.chatId && !conversation.externalChatId) {
                    await Conversation.findOneAndUpdate(
                      { _id: conversation._id, externalChatId: null },
                      { externalChatId: data.chatId }
                    );
                  }
                  if (data.msgId) {
                    await Message.updateOne({ _id: message._id }, { externalMsgId: data.msgId });
                  }
                } else {
                  console.error(`[ChatCenter v1] Forward failed (${res.status}): ${resBody}`);
                }
              } catch (err) {
                console.error("[ChatCenter v1] Forward error:", err.message);
              }
            })();
          }
        }
      } catch (err) {
        console.error("send_message error:", err);
      }
    });

    // Mark messages as read
    socket.on("mark_read", async ({ conversationId }) => {
      try {
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        if (userRole === "admin") {
          await Message.updateMany(
            { conversationId, readByAdmin: false },
            { readByAdmin: true }
          );
          await Conversation.findByIdAndUpdate(conversationId, { unreadByAdmin: 0 });
        } else {
          await Message.updateMany(
            { conversationId, readByUser: false },
            { readByUser: true }
          );
          await Conversation.findByIdAndUpdate(conversationId, { unreadByUser: 0 });
        }

        io.to(`conversation:${conversationId}`).emit("message_read", {
          conversationId,
          readBy: userRole,
        });
      } catch (err) {
        console.error("mark_read error:", err);
      }
    });

    // Typing indicators
    socket.on("typing_start", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit("typing", { userId, isTyping: true });
    });

    socket.on("typing_stop", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit("typing", { userId, isTyping: false });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });

  // ── ChatCenter v2 SSE Listener (incoming messages from external operators) ──
  if (
    process.env.CHATCENTER_ENABLED === "true" &&
    process.env.CHATCENTER_V2_SSE_ENABLED === "true"
  ) {
    const v2Url = process.env.CHATCENTER_V2_API_URL;
    const v2ApiKey = process.env.CHATCENTER_V2_API_KEY;
    const SYSTEM_USER_ID = process.env.CHATCENTER_SYSTEM_USER_ID;

    if (v2Url && v2ApiKey && SYSTEM_USER_ID) {
      let reconnectDelay = 5000;
      const MAX_RECONNECT_DELAY = 60000;

      async function handleSSEMessage(eventData) {
        try {
          const { chatId, message: msg } = eventData;
          if (!chatId || !msg) {
            console.warn("[ChatCenter SSE] Invalid event data:", JSON.stringify(eventData).substring(0, 200));
            return;
          }

          // Only process outgoing messages (from operator/bot to client)
          // isOut=true means "from operator", isOut=false means "from client" (our own echo)
          if (!msg.isOut) {
            console.log(`[ChatCenter SSE] Skipping own message echo: msgId=${msg.id}`);
            return;
          }

          console.log(`[ChatCenter SSE] Processing new_message: chatId=${chatId}, msgId=${msg.id}, isOut=${msg.isOut}, text="${(msg.text || "").substring(0, 50)}"`);

          // Dedup by externalMsgId
          if (msg.id) {
            const existing = await Message.findOne({ externalMsgId: msg.id });
            if (existing) {
              console.log(`[ChatCenter SSE] Duplicate msgId=${msg.id}, skipping`);
              return;
            }
          }

          // Find conversation by externalChatId
          const conversation = await Conversation.findOne({ externalChatId: chatId });
          if (!conversation) {
            console.warn(`[ChatCenter SSE] No conversation for chatId=${chatId}, skipping`);
            return;
          }

          // Handle attachments
          let attachment = undefined;
          let messageType = "text";
          if (msg.attachments && msg.attachments.length > 0) {
            const att = msg.attachments[0];
            const isImage = att.fileType === "photo" || att.fileType === "image";
            messageType = isImage ? "image" : "file";

            // Download file from external system and upload to S3
            if (att.downloadUrl && s3) {
              try {
                const downloadFullUrl = att.downloadUrl.startsWith("http")
                  ? att.downloadUrl
                  : `${v2Url}${att.downloadUrl}`;
                const fileRes = await fetch(downloadFullUrl, {
                  headers: { "Authorization": `Bearer ${v2ApiKey}` },
                });
                if (fileRes.ok) {
                  const crypto = require("crypto");
                  const id = crypto.randomUUID();
                  const safeName = (att.fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
                  const key = `chat-attachments/${id}-${safeName}`;
                  const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
                  await s3.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: key,
                    Body: fileBuffer,
                    ContentType: att.mimeType || "application/octet-stream",
                  }));
                  const fileUrl = `/api/files/${key}`;
                  attachment = {
                    url: fileUrl,
                    filename: att.fileName || "file",
                    mimeType: att.mimeType || "application/octet-stream",
                    size: att.fileSize || 0,
                  };
                  console.log(`[ChatCenter SSE] Uploaded attachment: ${fileUrl}`);
                }
              } catch (fileErr) {
                console.error("[ChatCenter SSE] Failed to process attachment:", fileErr.message);
              }
            }
          }

          // Build replyTo if this is a reply
          let replyTo = undefined;
          if (msg.replyToMsgId) {
            const originalMsg = await Message.findOne({ externalMsgId: msg.replyToMsgId });
            if (originalMsg) {
              const isAdmin = originalMsg.senderRole === "admin";
              const user = isAdmin ? null : await User.findById(conversation.userId).lean();
              replyTo = {
                messageId: originalMsg._id,
                senderName: isAdmin ? "Оператор" : (user?.name || "Клиент"),
                content: (originalMsg.content || "").substring(0, 100),
                messageType: originalMsg.messageType,
                attachmentFilename: originalMsg.attachment?.filename,
              };
              console.log(`[ChatCenter SSE] Built replyTo: originalId=${originalMsg._id}, sender=${replyTo.senderName}`);
            } else {
              console.warn(`[ChatCenter SSE] Original message not found for replyToMsgId=${msg.replyToMsgId}`);
            }
          }

          // Create message
          const message = await Message.create({
            conversationId: conversation._id,
            senderId: SYSTEM_USER_ID,
            senderRole: "admin",
            content: msg.text || "",
            messageType,
            attachment,
            readByAdmin: true,
            readByUser: false,
            externalMsgId: msg.id || null,
            replyTo,
          });

          // Update conversation metadata
          const preview = (msg.text || "").substring(0, 100) || (attachment ? attachment.filename : "");
          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessageAt: new Date(),
            lastMessagePreview: preview,
            $inc: { unreadByUser: 1 },
          });

          // Broadcast via Socket.IO
          const messageData = {
            _id: message._id.toString(),
            conversationId: conversation._id.toString(),
            senderId: SYSTEM_USER_ID,
            senderRole: "admin",
            senderName: msg.fromUserName || "Оператор",
            content: message.content,
            messageType: message.messageType,
            attachment: message.attachment,
            readByAdmin: true,
            readByUser: false,
            createdAt: message.createdAt.toISOString(),
            replyTo: replyTo ? {
              messageId: replyTo.messageId.toString(),
              senderName: replyTo.senderName,
              content: replyTo.content,
              messageType: replyTo.messageType,
              attachmentFilename: replyTo.attachmentFilename,
            } : undefined,
          };

          io.to(`conversation:${conversation._id}`).emit("new_message", messageData);
          io.to(`user:${conversation.userId}`).emit("unread_update", {
            conversationId: conversation._id.toString(),
            unreadByAdmin: conversation.unreadByAdmin || 0,
            unreadByUser: (conversation.unreadByUser || 0) + 1,
          });

          // Push notification
          sendPushNotification(conversation.userId.toString(), {
            title: "Новое сообщение от оператора",
            body: preview || "Новое сообщение",
            url: "/chat",
            tag: `chat-${conversation._id}`,
          }).catch(console.error);

          console.log(`[ChatCenter SSE] Message created: ${message._id}, type=${messageType}, chatId=${chatId}, msgId=${msg.id}`);
        } catch (err) {
          console.error("[ChatCenter SSE] handleSSEMessage error:", err);
        }
      }

      async function connectSSE() {
        console.log("[ChatCenter SSE] Connecting...");
        try {
          const res = await fetch(`${v2Url}/events`, {
            headers: { "Authorization": `Bearer ${v2ApiKey}` },
          });

          if (!res.ok) {
            console.error(`[ChatCenter SSE] HTTP ${res.status}: ${await res.text()}`);
            scheduleReconnect();
            return;
          }

          console.log("[ChatCenter SSE] Connected successfully");
          reconnectDelay = 5000; // Reset delay on successful connection

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE frames separated by double newline
            const frames = buffer.split("\n\n");
            buffer = frames.pop(); // Keep incomplete frame in buffer

            for (const frame of frames) {
              if (!frame.trim()) continue;

              const eventMatch = frame.match(/^event:\s*(.+)$/m);
              const dataMatch = frame.match(/^data:\s*(.+)$/m);
              if (!dataMatch) continue;

              const eventType = eventMatch ? eventMatch[1].trim() : "message";
              let eventData;
              try { eventData = JSON.parse(dataMatch[1]); } catch {
                console.warn(`[ChatCenter SSE] Failed to parse event data: ${dataMatch[1].substring(0, 100)}`);
                continue;
              }

              console.log(`[ChatCenter SSE] Event: ${eventType}, chatId=${eventData.chatId || "?"}`);

              if (eventType === "new_message") {
                await handleSSEMessage(eventData);
              }
              // message_status and chat_updated events logged but not processed for now
            }
          }

          console.log("[ChatCenter SSE] Connection closed by server");
          scheduleReconnect();
        } catch (err) {
          console.error("[ChatCenter SSE] Connection error:", err.message);
          scheduleReconnect();
        }
      }

      function scheduleReconnect() {
        console.log(`[ChatCenter SSE] Reconnecting in ${reconnectDelay / 1000}s...`);
        setTimeout(connectSSE, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      }

      // Start SSE connection
      connectSSE();
      console.log("[ChatCenter SSE] Listener initialized");
    } else {
      console.warn("[ChatCenter SSE] Missing required env vars (CHATCENTER_V2_API_URL, CHATCENTER_V2_API_KEY, CHATCENTER_SYSTEM_USER_ID)");
    }
  }
});
