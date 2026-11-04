// Cliente mínimo GraphQL sobre fetch (sin librerías extra).
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || "http://localhost:5000/graphql";

export async function gql(query, variables = {}) {
  let response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("No se pudo conectar con el gateway. ¿Está levantado?");
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (json?.errors?.length) throw new Error(json.errors[0].message);
  if (!json || !response.ok) throw new Error(`Error del gateway (HTTP ${response.status})`);
  return json.data;
}

export async function uploadAttachment(channelId, userId, file) {
  const body = new FormData();
  body.append("operations", JSON.stringify({
    query: M.uploadAttachment,
    variables: { channelId, userId, file: null },
  }));
  body.append("map", JSON.stringify({ "0": ["variables.file"] }));
  body.append("0", file);
  let response;
  try {
    response = await fetch(GATEWAY_URL, { method: "POST", body });
  } catch {
    throw new Error("No se pudo conectar con el gateway para subir el archivo.");
  }
  let json;
  try { json = await response.json(); } catch { /* error HTTP sin JSON */ }
  if (json?.errors?.length) throw new Error(json.errors[0].message);
  if (!response.ok || !json?.data?.uploadAttachment) {
    throw new Error(`No se pudo subir el archivo (HTTP ${response.status}).`);
  }
  return json.data.uploadAttachment;
}

export function attachmentDownloadUrl(path) {
  if (!path) return null;
  const gateway = new URL(GATEWAY_URL, window.location.href);
  const url = new URL(path, gateway);
  // Las descargas deben permanecer en el gateway configurado.
  if (url.origin !== gateway.origin || !["http:", "https:"].includes(url.protocol)) return null;
  return url.href;
}

export const Q = {
  replies: `query($channelId: ID!, $messageId: ID!) {
    replies(channelId: $channelId, messageId: $messageId) {
      id content createdAt author { id displayName }
    }
  }`,
  attachments: `query($channelId: ID!, $userId: ID!, $limit: Int!, $offset: Int!) {
    attachments(channelId: $channelId, userId: $userId, limit: $limit, offset: $offset) {
      items { id filename mimeType sizeBytes category createdAt status downloadUrl uploader { id displayName } }
      limit offset
    }
  }`,
  user: `query($id: ID!) { user(id: $id) { id displayName } }`,
  channels: `query { channels { id name } }`,
  myScheduled: `query($a: ID!) {
    scheduledMessages(authorId: $a) { id content scheduledFor status lastError channelId }
  }`,
  channelMessages: `query($id: ID!) {
    channel(id: $id) {
      id name
      messages { id content createdAt author { id displayName } }
    }
  }`,
};

export const M = {
  uploadAttachment: `mutation($channelId: ID!, $userId: ID!, $file: Upload!) {
    uploadAttachment(channelId: $channelId, userId: $userId, file: $file) { id filename }
  }`,
  createReply: `mutation($channelId: ID!, $messageId: ID!, $authorId: ID!, $content: String!) {
    createReply(channelId: $channelId, messageId: $messageId, authorId: $authorId, content: $content) {
      id content createdAt author { id displayName }
    }
  }`,
  createUser: `mutation($name: String!) { createUser(displayName: $name) { id displayName } }`,
  createChannel: `mutation($name: String!) { createChannel(name: $name) { id name } }`,
  sendMessage: `mutation($channelId: ID!, $authorId: ID!, $content: String!) {
    sendMessage(channelId: $channelId, authorId: $authorId, content: $content) { id }
  }`,
  cancelScheduled: `mutation($id: ID!) { cancelScheduledMessage(id: $id) { id status } }`,
  scheduleMessage: `mutation($channelId: ID!, $authorId: ID!, $content: String!, $at: String!) {
    scheduleMessage(channelId: $channelId, authorId: $authorId, content: $content, scheduledFor: $at) {
      id scheduledFor status
    }
  }`,
};
