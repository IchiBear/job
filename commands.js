// Add and edit your slash commands here.
// Each command needs:
//   data: Discord application command JSON
//   execute(interaction, env): return a Discord interaction response object.
//
// Keep this file free of secrets. Secrets belong in Cloudflare Worker settings.

export const commands = [
  {
    data: {
      name: "ping",
      description: "Check whether the bot is responding"
    },

    async execute(interaction, env) {
      return {
        content: "Pong! Your Discord bot is connected."
      };
    }
  }

  // Add more commands by copying this pattern:
  //
  // ,{
  //   data: {
  //     name: "hello",
  //     description: "Say hello"
  //   },
  //   async execute(interaction, env) {
  //     return { content: "Hello there!" };
  //   }
  // }
];
