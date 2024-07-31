import type { Meme as MemeType } from "$lib/api/client";

// re-export Meme

export type MCReference = {
  description: string;
  twitterLink: string;
  telegramLink: string;
  website: string;
  image: string;
};

export type Meme = MemeType;

export type MCAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
  claims: Array<[string, string]>;
};
