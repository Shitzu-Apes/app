import { writable } from "svelte/store";

import { type MCMemeInfo } from "$lib/models/memecooking";

export const memebids = writable<MCMemeInfo[]>([]);
