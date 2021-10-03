// Utility typings

import * as Discord from "discord.js";

export type MessageCollection = Discord.Collection<string, Discord.Message>;

// ThenArgRecursive from https://stackoverflow.com/a/49889856
export type ThenArg<T> = T extends PromiseLike<infer U> ? ThenArg<U> : T;
