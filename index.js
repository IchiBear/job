import { commands } from "./commands.js";

const encoder = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verifyDiscordRequest(request, body, publicKey) {
  try {
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    if (!signature || !timestamp || !publicKey) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      hexToBytes(signature),
      encoder.encode(timestamp + body)
    );
  } catch {
    return false;
  }
}

function commandResponse(content) {
  return { type: 4, data: { content } };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Protected command-registration endpoint. Call once after deployment.
    if (url.pathname === "/__register" && request.method === "POST") {
      const suppliedSecret = request.headers.get("x-register-secret");
      if (!env.REGISTER_SECRET || suppliedSecret !== env.REGISTER_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (!env.DISCORD_APP_ID || !env.DISCORD_BOT_TOKEN) {
        return json({ error: "Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN secret" }, 500);
      }

      const response = await fetch(
        `https://discord.com/api/v10/applications/${env.DISCORD_APP_ID}/commands`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(commands.map(command => command.data))
        }
      );

      const result = await response.text();
      return new Response(result, {
        status: response.status,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    if (url.pathname !== "/" || request.method !== "POST") {
      return new Response("Discord interactions worker is running.", {
        status: 200
      });
    }

    const body = await request.text();

    if (!await verifyDiscordRequest(request, body, env.DISCORD_PUBLIC_KEY)) {
      return new Response("Invalid request signature.", { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON.", { status: 400 });
    }

    // Discord endpoint verification.
    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    // Application command interaction.
    if (interaction.type === 2) {
      const command = commands.find(item => item.data.name === interaction.data?.name);

      if (!command) {
        return json(commandResponse("Unknown command."));
      }

      try {
        const result = await command.execute(interaction, env);
        // A command can return a complete interaction callback object,
        // or a simple message payload such as { content: "Hello" }.
        if (result && Number.isInteger(result.type)) {
          return json(result);
        }
        return json({ type: 4, data: result ?? { content: "Command completed." } });
      } catch (error) {
        console.error("Command failed:", error);
        return json(commandResponse("Something went wrong while running this command."));
      }
    }

    return json({ type: 1 });
  }
};
