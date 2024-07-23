import type { Meme } from "$lib/api/client";

export type MCMemeInfo = Meme;

export type MCReference = {
  description: string;
  twitterLink: string;
  telegramLink: string;
  website: string;
  image: string;
};

export type MCMemeInfoWithReference = Meme;

export type MCAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
  claims: Array<[string, string]>;
};
